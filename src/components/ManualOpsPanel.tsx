import React, { useState } from 'react';
import { useAppStore } from '../store/appStore';
import * as dvachApi from '../services/dvachApi';
import * as geminiApi from '../services/geminiApi';
import { DvachPost } from '../core/types';
import { IconRefresh, IconSend, IconSparkles } from './Icons';

const ManualOpsPanel: React.FC = () => {
  const {
    settings,
    ai,
    currentBoard,
    setCurrentBoard,
    currentThreadId,
    setCurrentThreadId,
    currentFetchedDvachPosts,
    setCurrentFetchedDvachPosts,
    isFetchingThread,
    setIsFetchingThread,
    postText,
    setPostText,
    addLog,
    dvachSessionCookies,
    addSentMessage,
  } = useAppStore();
  const [isGenerating, setIsGenerating] = useState(false);

  const handleFetchThread = async () => {
    setIsFetchingThread(true);
    try {
      const threadData = await dvachApi.getThreadData(
        useAppStore.getState().currentDvachBaseUrl,
        currentBoard,
        currentThreadId,
        settings.proxyModeForGET,
        settings.customProxyUrlForGET,
        settings.userAgent
      );
      setCurrentFetchedDvachPosts(threadData.threads[0].posts);
    } catch (error) {
      addLog(`Failed to fetch thread: ${(error as Error).message}`, 'error', error);
    } finally {
      setIsFetchingThread(false);
    }
  };

  const handleManualReply = async (post: DvachPost) => {
    if (!ai) {
      addLog('AI not initialized, cannot generate reply.', 'error');
      return;
    }
    setIsGenerating(true);
    try {
      const reply = await geminiApi.generateReply(
        ai,
        settings,
        currentFetchedDvachPosts,
        post,
        []
      );
      setPostText(`>>${post.num}\\n${reply}`);
    } catch (error) {
      addLog(`Failed to generate manual reply: ${(error as Error).message}`, 'error', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePost = async () => {
    try {
      const newPost = await dvachApi.postWithSessionCookie(
        dvachSessionCookies!,
        currentBoard,
        currentThreadId,
        postText,
        null, // file
        undefined, // parent
        false, // sage
        settings.userAgent
      );
      const newPostNum = newPost.num || newPost.thread || '';
      addSentMessage({
        num: newPostNum,
        timestamp: Date.now(),
        comment: postText,
        board: currentBoard,
        thread: currentThreadId,
        isGeminiPost: false,
      });
      setPostText('');
      addLog(`Posted manual reply as >>${newPostNum}`, 'success');
    } catch (error) {
        addLog(`Failed to post manual reply: ${(error as Error).message}`, 'error', error);
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-6 bg-white dark:bg-gray-800 shadow-lg rounded-lg">
      <h2 className="text-2xl font-semibold text-blue-600 dark:text-blue-400 border-b pb-2">Manual Operations</h2>
      <div className="grid grid-cols-2 gap-4">
        <input type="text" value={currentBoard} onChange={e => setCurrentBoard(e.target.value)} placeholder="Board" className="input-field" />
        <input type="text" value={currentThreadId} onChange={e => setCurrentThreadId(e.target.value)} placeholder="Thread ID" className="input-field" />
      </div>
      <button onClick={handleFetchThread} disabled={isFetchingThread} className="btn-primary">
        <IconRefresh className={`mr-2 ${isFetchingThread ? 'animate-spin' : ''}`} /> Fetch Thread
      </button>

      <div className="max-h-96 overflow-y-auto">
        {currentFetchedDvachPosts.map(post => (
          <div key={post.num} className="p-2 border-b">
            <p><strong>{post.num}</strong></p>
            <div dangerouslySetInnerHTML={{ __html: post.comment }} />
            <button onClick={() => handleManualReply(post)} disabled={isGenerating} className="btn-secondary mt-2">
              <IconSparkles className="mr-2" />
              {isGenerating ? 'Generating...' : 'Reply'}
            </button>
          </div>
        ))}
      </div>

      <textarea value={postText} onChange={e => setPostText(e.target.value)} className="input-field w-full" rows={5} placeholder="Post text..." />
      <button onClick={handlePost} className="btn-success"><IconSend className="mr-2" /> Post Reply</button>
    </div>
  );
};

export default ManualOpsPanel;
