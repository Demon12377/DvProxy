import { useAppStore } from '../store/appStore';
import * as dvachApi from '../services/dvachApi';
import * as geminiApi from '../services/geminiApi';
import { DvachPost, Part } from './types';
import { GoogleGenAI } from '@google/genai';

type AppStore = ReturnType<typeof useAppStore['getState']>;

class BotEngine {
  private store: AppStore;
  private intervalId: NodeJS.Timeout | null = null;

  // State for Protagonist Mode
  private ownPostIds: Set<string> = new Set();
  private repliesToProcess: Map<string, DvachPost[]> = new Map();

  constructor() {
    useAppStore.subscribe(
      (state) => (this.store = state)
    );
    this.store = useAppStore.getState();
  }

  start() {
    if (this.intervalId) {
      console.log("BotEngine already running.");
      return;
    }

    this.store.addLog('BotEngine started.', 'bot_setup');
    const intervalSeconds = this.store.settings.autonomousBotCycleIntervalSeconds;
    this.intervalId = setInterval(this.run, intervalSeconds * 1000);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.store.addLog('BotEngine stopped.', 'bot_setup');
    }
  }

  private run = async () => {
    if (!this.store.autonomousBotActive || !this.store.ai) {
      this.store.addLog('Bot cycle skipped: bot inactive or AI not initialized.', 'bot_warning');
      this.stop();
      return;
    }

    const { settings, ai } = this.store;

    this.store.setAutonomousBotStatus('Running cycle...');

    try {
      switch (settings.botOperationMode) {
        case 'observer':
          await this.runObserverMode(ai);
          break;
        case 'protagonist':
          await this.runProtagonistMode(ai);
          break;
        default:
          this.store.addLog(`Unknown bot operation mode: ${settings.botOperationMode}`, 'bot_error');
          this.store.setAutonomousBotActive(false);
      }
    } catch (error) {
      this.store.addLog(`Error in bot cycle: ${(error as Error).message}`, 'bot_error', error);
      this.store.setAutonomousBotStatus('Error in cycle.');
    } finally {
        this.store.setAutonomousBotStatus('Waiting for next cycle...');
    }
  };

  private async runObserverMode(ai: GoogleGenAI) {
    const { settings, addLog, addSentMessage, setAutonomousBotStatus, currentDvachBaseUrl } = this.store;
    const { autonomousBotTargetBoard: board, autonomousBotTargetThreadId: threadId } = settings;

    addLog('Running Observer Mode cycle.', 'bot_activity');
    setAutonomousBotStatus('Observer: Fetching thread...');

    const threadPosts = await dvachApi.getThreadData(
        currentDvachBaseUrl,
        board,
        threadId,
        settings.proxyModeForGET,
        settings.customProxyUrlForGET,
        settings.userAgent
      );

    const eligiblePosts = threadPosts.threads[0].posts.filter(p => !this.ownPostIds.has(p.num));
    if (eligiblePosts.length === 0) {
        addLog('Observer: No eligible posts to reply to.', 'bot_activity');
        return;
    }
    const targetPost = eligiblePosts[Math.floor(Math.random() * eligiblePosts.length)];

    setAutonomousBotStatus(`Observer: Preparing reply to >>${targetPost.num}`);

    const conversationWindow = threadPosts.threads[0].posts.slice(-10);

    const mediaParts: Part[] = [];
    // ... vision logic ...

    const replyText = await geminiApi.generateReply(
        ai,
        settings,
        conversationWindow,
        targetPost,
        mediaParts
    );

    const finalComment = `>>${targetPost.num}\n${replyText}`;

    setAutonomousBotStatus(`Observer: Posting reply to >>${targetPost.num}`);
    const newPost = await dvachApi.postWithSessionCookie(
        this.store.dvachSessionCookies!,
        board,
        threadId,
        finalComment,
        null,
        targetPost.num,
        false,
        settings.userAgent
    );

    const newPostNum = newPost.num || newPost.thread || '';
    this.ownPostIds.add(newPostNum);
    addSentMessage({
        num: newPostNum,
        timestamp: Date.now(),
        comment: finalComment,
        board,
        thread: threadId,
        parent: targetPost.num,
        isGeminiPost: true,
    });
    addLog(`Observer: Posted reply as >>${newPostNum}`, 'bot_activity');
  }

  private async runProtagonistMode(ai: GoogleGenAI) {
    const { settings, addLog, addSentMessage, setAutonomousBotStatus, currentDvachBaseUrl } = this.store;
    const { autonomousBotTargetBoard: board, autonomousBotTargetThreadId: threadId } = settings;

    addLog('Running Protagonist Mode cycle.', 'bot_activity');
    setAutonomousBotStatus('Protagonist: Fetching new posts...');

    const threadPosts = await dvachApi.getThreadData(
        currentDvachBaseUrl,
        board,
        threadId,
        settings.proxyModeForGET,
        settings.customProxyUrlForGET,
        settings.userAgent
      );
    const allPosts = threadPosts.threads[0].posts;

    if (this.ownPostIds.size === 0) {
        const opPost = allPosts.find(p => p.op === 1);
        if (opPost) {
            setAutonomousBotStatus('Protagonist: Initiating with a post to OP...');
            const initialComment = await geminiApi.generateInitialPost(ai, settings, opPost);

            const newPost = await dvachApi.postWithSessionCookie(
                this.store.dvachSessionCookies!,
                board,
                threadId,
                initialComment,
                null,
                opPost.num,
                false,
                settings.userAgent
            );
            const newPostNum = newPost.num || newPost.thread || '';
            this.ownPostIds.add(newPostNum);
            addSentMessage({
                num: newPostNum,
                timestamp: Date.now(),
                comment: initialComment,
                board,
                thread: threadId,
                parent: opPost.num,
                isGeminiPost: true,
            });
            addLog(`Protagonist: Initiated conversation with post >>${newPostNum}`, 'bot_setup');
            return;
        }
    }

    setAutonomousBotStatus('Protagonist: Scanning for replies...');
    for (const post of allPosts) {
        for (const ownId of this.ownPostIds) {
            if (post.comment.includes(`>>${ownId}`) && !this.ownPostIds.has(post.num)) {
                if (!this.repliesToProcess.has(ownId)) {
                    this.repliesToProcess.set(ownId, []);
                }
                if (!this.repliesToProcess.get(ownId)!.find(r => r.num === post.num)) {
                    this.repliesToProcess.get(ownId)!.push(post);
                    addLog(`Protagonist: Queued reply >>${post.num} to own post >>${ownId}`, 'bot_activity');
                }
            }
        }
    }

    for (const [ownPostId, replies] of this.repliesToProcess.entries()) {
        if (replies.length >= 3) {
            setAutonomousBotStatus(`Protagonist: Aggregating ${replies.length} replies to >>${ownPostId}`);

            const originalPost = allPosts.find(p => p.num === ownPostId);

            const aggregatedReply = await geminiApi.generateAggregatedReply(
                ai,
                settings,
                originalPost!,
                replies
            );

            const newPost = await dvachApi.postWithSessionCookie(
                this.store.dvachSessionCookies!,
                board,
                threadId,
                aggregatedReply,
                null,
                threadId,
                false,
                settings.userAgent
            );

            const newPostNum = newPost.num || newPost.thread || '';
            this.ownPostIds.add(newPostNum);
            addSentMessage({
                num: newPostNum,
                timestamp: Date.now(),
                comment: aggregatedReply,
                board,
                thread: threadId,
                parent: threadId,
                isGeminiPost: true,
            });

            addLog(`Protagonist: Posted aggregated reply as >>${newPostNum}`, 'success');
            this.repliesToProcess.delete(ownPostId);
        }
    }
  }
}

export const botEngine = new BotEngine();
