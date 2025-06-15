
/// <reference types="vite/client" />
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  GoogleGenAI,
  Part,
  GenerateContentParameters
  // GeminiChat (unused) removed
} from "@google/genai";
import {
  AppSettings, LogEntry, DvachPost, SentMessageInfo, ProxyModeForGET,
  DvachThreadResponse,
  DvachFile, GeminiDvachConversation, ChatMessage,
  DvachSessionCookies, AutonomousBotReplyMode, BotOpMediaCache, AutonomousBotInitialContextScope,
  GroundingChunk, CustomGenerateContentResponse, ActiveTask
  // GroundingMetadata (unused) removed
} from './types';
import { getThreadData, loginToDvach, postWithSessionCookie, base64ToFile, extractDvachApiError, buildProxiedGetUrl } from './services/dvachService';
import { parseGeminiJsonResponse } from './services/geminiService.ts';
import {
  APP_SETTINGS_KEY, SENT_MESSAGES_KEY, APP_VERSION,
  GEMINI_TEXT_MODEL, GEMINI_IMAGE_MODEL, MAX_LOG_ENTRIES, MAX_SENT_MESSAGES_STORED,
  GEMINI_DVACH_CONVERSATIONS_KEY, DVACH_SESSION_COOKIES_KEY,
  DVACH_DOMAINS,
  BUMP_KEYWORDS,
  AUTONOMOUS_BOT_MAX_OUTPUT_TOKENS,
  DEFAULT_APP_SETTINGS
} from './constants';
import { generateUserAgent } from './utils/userAgentGenerator';

import {
  IconSettings, IconTerminal, IconSend, IconTrash, IconCpu,
  IconSparkles, IconAlertTriangle, IconRefresh,
  IconLogin, IconLogout, IconUserCircle, IconPlayerPlay, IconPlayerStop, IconMessageChat,
  IconSun, IconMoon,
} from './components/Icons';

interface BotReplySchema {
  replyText: string;
}

// Helper function for formatting log data
const formatLogDataForDisplay = (data: unknown): string | null => {
  if (data === undefined || data === null) {
    return null;
  }
  if (typeof data === 'string') {
    return data;
  }
  if (data instanceof Error) {
      return `Error: ${data.message}\nStack: ${data.stack}`;
  }
  if (typeof data === 'object' || Array.isArray(data)) {
    try {
      return JSON.stringify(data, null, 2);
    } catch (e) {
      return `[Unserializable Object: ${(e as Error).message || 'Serialization Error'}]`;
    }
  }
  return String(data);
};


const App: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(() => {
    const savedSettingsJson = localStorage.getItem(APP_SETTINGS_KEY);
    const loadedSettings = savedSettingsJson ? JSON.parse(savedSettingsJson) : {};
    const currentEnvKeyAvailable = typeof process.env.API_KEY === 'string' && process.env.API_KEY.length > 0;

    const mergedInitialSettings: AppSettings = {
        ...DEFAULT_APP_SETTINGS,
        ...loadedSettings,
    };
    if (mergedInitialSettings.geminiApiKeySource === 'env' && !currentEnvKeyAvailable) {
        mergedInitialSettings.geminiApiKeySource = 'user';
        if (loadedSettings.geminiApiKeySource === 'env') {
            console.warn("Environment API_KEY (process.env.API_KEY) was configured but is now missing. Switched to 'user' API key source.");
        }
    }
    const numericKeys: (keyof AppSettings)[] = ['maxImagesToAnalyzePerPost', 'autonomousBotCycleIntervalSeconds', 'autonomousBotFullThreadContextMaxChars', 'geminiTemperature', 'geminiTopP', 'geminiTopK', 'geminiMaxOutputTokens', 'geminiThinkingBudget', 'autonomousBotMinReplyDelayMs', 'autonomousBotMaxReplyDelayMs', 'repetitivePostCount', 'repetitivePostDelay'];
    const booleanKeys: (keyof AppSettings)[] = ['geminiAnalyzeOpMedia', 'geminiAnalyzeAnonMedia', 'geminiReplyWithGeneratedImage', 'botAnalyzesImagesInTriggerPosts', 'autonomousBotAllowReplyToSelf', 'useThinkingBudget', 'autonomousBotDisableThinking', 'enableRepetitivePostingMode', 'enablePrefilledPostingMode', 'analyzeVideosInTriggerPosts'];

    numericKeys.forEach(key => {
      if (loadedSettings[key] !== undefined) (mergedInitialSettings as any)[key] = Number(loadedSettings[key]);
      else (mergedInitialSettings as any)[key] = (DEFAULT_APP_SETTINGS as any)[key];
    });
    booleanKeys.forEach(key => {
      if (loadedSettings[key] !== undefined) (mergedInitialSettings as any)[key] = !!loadedSettings[key];
      else (mergedInitialSettings as any)[key] = (DEFAULT_APP_SETTINGS as any)[key];
    });
    mergedInitialSettings.autonomousBotInitialContextScope = loadedSettings.autonomousBotInitialContextScope || DEFAULT_APP_SETTINGS.autonomousBotInitialContextScope;
    mergedInitialSettings.geminiSafetySettings = loadedSettings.geminiSafetySettings || DEFAULT_APP_SETTINGS.geminiSafetySettings;
    mergedInitialSettings.userAgent = loadedSettings.userAgent || generateUserAgent();

    return mergedInitialSettings;
  });

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [ai, setAi] = useState<GoogleGenAI | null>(null);
  const currentAiApiKeyRef = useRef<string | null>(null);
  const [activeTab, setActiveTab] = useState<'dvach' | 'bot_control' | 'settings' | 'logs'>('dvach');

  const [dvachSessionCookies, setDvachSessionCookies] = useState<DvachSessionCookies | null>(() => {
    const savedCookies = localStorage.getItem(DVACH_SESSION_COOKIES_KEY);
    return savedCookies ? JSON.parse(savedCookies) : null;
  });
  const [isDvachLoggingIn, setIsDvachLoggingIn] = useState<boolean>(false);

  const [currentBoard, setCurrentBoard] = useState<string>(settings.board);
  const [currentThreadId, setCurrentThreadId] = useState<string>(settings.threadId);
  const [sentMessages, setSentMessages] = useState<SentMessageInfo[]>(() => {
    const saved = localStorage.getItem(SENT_MESSAGES_KEY);
    return saved ? JSON.parse(saved) : [];
  });
  const [postText, setPostText] = useState<string>('');
  const [postFile, setPostFile] = useState<File | null>(null);
  const [postUseSage, setPostUseSage] = useState<boolean>(false);
  const [isPosting, setIsPosting] = useState<boolean>(false);
  const [postActivityLog, setPostActivityLog] = useState<string[]>([]);

  const [currentFetchedDvachPosts, setCurrentFetchedDvachPosts] = useState<DvachPost[]>([]);
  const [isFetchingThread, setIsFetchingThread] = useState<boolean>(false);
  const threadPostsContainerRef = useRef<HTMLDivElement>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [geminiLoading, setGeminiLoading] = useState<boolean>(false);

  const [activeTasks, setActiveTasks] = useState<ActiveTask[]>([]);

  const [autonomousBotActive, setAutonomousBotActive] = useState<boolean>(false);
  const [autonomousBotStatus, setAutonomousBotStatus] = useState<string>("Inactive");
  const [autonomousBotActivityLog, setAutonomousBotActivityLog] = useState<string[]>([]);
  const [geminiDvachConversations, setGeminiDvachConversations] = useState<Map<string, GeminiDvachConversation>>(() => {
    const saved = localStorage.getItem(GEMINI_DVACH_CONVERSATIONS_KEY);
    if (saved) {
        try {
            const entries: [string, any][] = JSON.parse(saved);
            return new Map(entries.map(([key, convoData]) => [key, { ...convoData } as GeminiDvachConversation]));
        } catch (e) {
            console.error("Failed to parse Gemini Dvach Conversations from localStorage", e);
            localStorage.removeItem(GEMINI_DVACH_CONVERSATIONS_KEY);
            return new Map();
        }
    }
    return new Map();
  });
  const autonomousBotIntervalRef = useRef<number | null>(null);
  const [currentBotOpMediaCache, setCurrentBotOpMediaCache] = useState<BotOpMediaCache | null>(null);
  const initBotJsonInfoLoggedRef = useRef(false);


  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info', data?: unknown) => {
    setLogs(prevLogs => [{ id: Date.now().toString(), timestamp: Date.now(), message, type, data }, ...prevLogs.slice(0, MAX_LOG_ENTRIES - 1)]);
    const consoleMethod = type === 'error' || type === 'bot_error' ? console.error : type === 'warning' || type === 'bot_warning' ? console.warn : console.log;
    consoleMethod(`[${type.toUpperCase()}] ${message}`, data !== undefined ? data : "");
  }, []);

  const addPostActivity = useCallback((message: string) => {
    setPostActivityLog(prev => [ `[${new Date().toLocaleTimeString()}] ${message}`, ...prev.slice(0, 9)]);
  }, []);

  const addAutonomousBotActivityLog = useCallback((message: string, mainLogType: LogEntry['type'] = 'bot_activity', data?: unknown) => {
    setAutonomousBotActivityLog(prev => [ `[${new Date().toLocaleTimeString()}] ${message}`, ...prev.slice(0, 49)]);
     addLog(message, mainLogType, data);
  }, [addLog]);

  const addTask = useCallback((type: ActiveTask['type'], description: string, stop?: () => void): string => {
    const id = `${Date.now().toString()}-${Math.random().toString(36).substring(2, 7)}`;
    const newTask: ActiveTask = { id, type, description, startTime: Date.now(), stop };
    setActiveTasks(prevTasks => [...prevTasks, newTask]);
    addLog(`Task started: ${type} - ${description}`, 'system', { taskId: id });
    return id;
  }, [addLog]);

  const removeTask = useCallback((id: string) => {
    setActiveTasks(prevTasks => {
      const taskToRemove = prevTasks.find(t => t.id === id);
      if (taskToRemove) {
        addLog(`Task ended: ${taskToRemove.type} - ${taskToRemove.description}`, 'system', { taskId: id, durationMs: Date.now() - taskToRemove.startTime });
      }
      return prevTasks.filter(task => task.id !== id);
    });
  }, [addLog]);


  useEffect(() => {
    localStorage.setItem(APP_SETTINGS_KEY, JSON.stringify(settings));
    if (settings.theme === 'dark') document.documentElement.classList.add('dark');
    else if (settings.theme === 'light') document.documentElement.classList.remove('dark');
    else window.matchMedia('(prefers-color-scheme: dark)').matches ? document.documentElement.classList.add('dark') : document.documentElement.classList.remove('dark');
  }, [settings]);

  useEffect(() => {
    localStorage.setItem(SENT_MESSAGES_KEY, JSON.stringify(sentMessages.slice(0, MAX_SENT_MESSAGES_STORED)));
  }, [sentMessages]);

  useEffect(() => {
    const storableConversations = Array.from(geminiDvachConversations.entries()).map(([key, convo]) => {
        return [key, { ...convo, history: convo.history }];
    });
    localStorage.setItem(GEMINI_DVACH_CONVERSATIONS_KEY, JSON.stringify(storableConversations));
  }, [geminiDvachConversations]);

  useEffect(() => {
    if (dvachSessionCookies) {
      localStorage.setItem(DVACH_SESSION_COOKIES_KEY, JSON.stringify(dvachSessionCookies));
    } else {
      localStorage.removeItem(DVACH_SESSION_COOKIES_KEY);
    }
  }, [dvachSessionCookies]);


  useEffect(() => {
    const keyFromEnv = process.env.API_KEY;
    const keyToUse = settings.geminiApiKeySource === 'env' ? keyFromEnv : settings.userGeminiApiKey;

    if (keyToUse) {
      if (ai && currentAiApiKeyRef.current === keyToUse) return;
      addLog('Attempting to initialize Gemini API client...', 'system');
      try {
        const genAI = new GoogleGenAI({ apiKey: keyToUse });
        setAi(genAI);
        currentAiApiKeyRef.current = keyToUse;
        addLog('Gemini API client initialized successfully.', 'success');
        if (!initBotJsonInfoLoggedRef.current) {
           addLog("Note on Bot's JSON: Bot uses Gemini's native JSON output. Client code prefixes '>>POST_NUMBER'.", 'system');
           initBotJsonInfoLoggedRef.current = true;
        }
      } catch (error) {
        addLog(`Failed to initialize Gemini API: ${(error as Error).message}. Check API Key format/validity.`, 'error', error);
        setAi(null); currentAiApiKeyRef.current = null;
      }
    } else {
      if (ai) { setAi(null); currentAiApiKeyRef.current = null; addLog('Gemini API client de-initialized (no API key).', 'warning'); }
      if (currentAiApiKeyRef.current !== null || !ai) {
          if (settings.geminiApiKeySource === 'user' && !settings.userGeminiApiKey) addLog('Gemini API key (Manual) not set.', 'warning');
          else if (settings.geminiApiKeySource === 'env' && !keyFromEnv) addLog('Environment API_KEY not set/accessible. Gemini disabled if using "env" source.', 'warning');
      }
    }
  }, [settings.geminiApiKeySource, settings.userGeminiApiKey, addLog, ai]);


  const handleUpdateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  useEffect(() => {
    setCurrentBoard(settings.board.trim());
    setCurrentThreadId(settings.threadId.trim());
  }, [settings.board, settings.threadId]);


  const handleLoadThread = async (isBotCycle: boolean = false): Promise<DvachPost[] | null> => {
    const boardToFetch = (isBotCycle ? settings.autonomousBotTargetBoard : currentBoard).trim();
    const threadToFetch = (isBotCycle ? settings.autonomousBotTargetThreadId : currentThreadId).trim();

    if (!boardToFetch || !threadToFetch) {
      if (!isBotCycle) setFetchError('Board and Thread ID are required.');
      addLog('Board and Thread ID must be set to fetch thread posts.', 'warning', {boardToFetch, threadToFetch, isBotCycle});
      if (!isBotCycle) setCurrentFetchedDvachPosts([]);
      return null;
    }
    if (!isBotCycle) setIsFetchingThread(true);
    if (!isBotCycle) setFetchError(null);
    if (!isBotCycle) setCurrentFetchedDvachPosts([]);
    try {
      if(!isBotCycle) addLog(`Fetching thread /${boardToFetch}/${threadToFetch}... Proxy for GET (thread data): ${settings.proxyModeForGET}`, 'dvach');
      const data: DvachThreadResponse = await getThreadData(
        boardToFetch,
        threadToFetch,
        settings.proxyModeForGET,
        settings.customProxyUrlForGET,
        settings.userAgent
      );

      const posts = data.threads?.[0]?.posts || [];
      if(!isBotCycle) {
        setCurrentFetchedDvachPosts(posts);
        addLog(`Successfully fetched ${posts.length} posts from /${boardToFetch}/${threadToFetch}.`, 'success');
        if (threadPostsContainerRef.current) threadPostsContainerRef.current.scrollTop = 0;
      }
      return posts;
    } catch (err) {
      const errorMsg = (err as Error).message;
      if(!isBotCycle) setFetchError(errorMsg);
      addLog(`Failed to fetch thread /${boardToFetch}/${threadToFetch}: ${errorMsg}`, isBotCycle ? 'bot_error' : 'error', err);
      if (!isBotCycle) setCurrentFetchedDvachPosts([]);
      return null;
    } finally {
      if (!isBotCycle) setIsFetchingThread(false);
    }
  };

  const handleDvachLogin = async () => {
    if (!settings.purchasedPasscode) {
      addLog("Purchased Passcode is not set in settings.", 'error');
      return;
    }
    setIsDvachLoggingIn(true);
    setFetchError(null);
    addLog("Attempting to log into Dvach with purchased passcode...", 'auth');
    try {
      const cookies = await loginToDvach(settings.purchasedPasscode, settings.userAgent);
      setDvachSessionCookies(cookies);
      addLog("Successfully logged into Dvach. Session cookies stored.", 'success');
    } catch (error) {
      const errorMsg = (error as Error).message;
      setFetchError(errorMsg);
      addLog(`Dvach login failed: ${errorMsg}`, 'error', error);
      setDvachSessionCookies(null);
    } finally {
      setIsDvachLoggingIn(false);
    }
  };

  const handleDvachLogout = () => {
    setDvachSessionCookies(null);
    addLog("Logged out from Dvach. Session cookies cleared.", 'info');
  };

  const commonPostToDvach = async (
    comment: string,
    file: File | null,
    useSageFlag: boolean,
    boardToPostInput: string,
    threadIdForDvachApiInput: string,
    replyToPostNumForDvachApi?: string
  ): Promise<string> => {
    const boardToPost = boardToPostInput.trim();
    const threadIdForDvachApi = threadIdForDvachApiInput.trim();
    const finalReplyToPostNum = replyToPostNumForDvachApi?.trim();

    if (!dvachSessionCookies?.passcode_auth) {
      const errorMsg = 'Not logged into Dvach or session expired. Please login first.';
      addLog(errorMsg, 'auth');
      if(activeTab === 'dvach') addPostActivity(`Error: ${errorMsg}`);
      setFetchError(errorMsg);
      throw new Error(errorMsg);
    }
    if (!boardToPost || !comment.trim()) {
      const errorMsg = 'Board and Post Comment are required for posting.';
      addLog(errorMsg, 'error');
      if(activeTab === 'dvach') addPostActivity(`Error: ${errorMsg}`);
      throw new Error(errorMsg);
    }

    const effectiveThreadIdForDvach = (!threadIdForDvachApi || threadIdForDvachApi === "0") ? "0" : threadIdForDvachApi;

    const targetDesc = effectiveThreadIdForDvach === "0" ? 'new thread' : `thread ${effectiveThreadIdForDvach}`;
    const logMsg = `Attempting to post to /${boardToPost}/${targetDesc}${finalReplyToPostNum ? ` (reply to >>${finalReplyToPostNum})` : ''}. Comment: "${comment.substring(0,50)}..."`;
    addLog(logMsg, 'dvach');
    if (activeTab === 'dvach') addPostActivity(logMsg);

    setIsPosting(true);
    setFetchError(null);
    try {
      const result = await postWithSessionCookie(
        dvachSessionCookies,
        boardToPost,
        effectiveThreadIdForDvach,
        comment,
        file,
        finalReplyToPostNum,
        useSageFlag,
        settings.userAgent
      );

      const newPostNum = String(result.num || result.thread || result.target || Date.now());
      addLog(`Post successful! Dvach response: Num: ${newPostNum}`, 'success', result);
      if (activeTab === 'dvach') addPostActivity(`Success! Post Num: ${newPostNum}.`);

      setSentMessages(prevSentMessages => {
        const newSentMessage: SentMessageInfo = {
          num: newPostNum,
          timestamp: Date.now(),
          comment: comment,
          board: boardToPost,
          thread: effectiveThreadIdForDvach === "0" ? newPostNum : effectiveThreadIdForDvach,
          parent: finalReplyToPostNum,
          file_info: file ? { name: file.name, size: file.size } : undefined,
        };
        return [newSentMessage, ...prevSentMessages];
      });
      return newPostNum;
    } catch (err) {
      const error = err as Error;
      const dvachApiError = extractDvachApiError(error);
      let errorMsg = error.message;

      if (dvachApiError && (dvachApiError.code === -4 || dvachApiError.code === -6 || dvachApiError.code === -21 || dvachApiError.message.toLowerCase().includes("постинг запрещён") || dvachApiError.message.toLowerCase().includes("доступ запрещен"))) {
        errorMsg = `Dvach session likely expired or invalid (Error: ${dvachApiError.message}). Please log in again.`;
        addLog(errorMsg, 'auth', dvachApiError);
        setDvachSessionCookies(null);
      } else {
        addLog(`Failed to post: ${errorMsg}`, 'error', error);
      }
      setFetchError(errorMsg);
      if (activeTab === 'dvach') addPostActivity(`Post Failed: ${errorMsg}`);
      throw new Error(errorMsg);
    } finally {
      setIsPosting(false);
    }
  };

  const handleSimplePost = async () => {
    try {
      const board = currentBoard.trim();
      const threadContext = currentThreadId.trim();
      const threadTargetForDvach = threadContext && threadContext !== "0" ? threadContext : "0";

      await commonPostToDvach(postText, postFile, postUseSage, board, threadTargetForDvach, undefined);
      setPostText('');
      setPostFile(null);
    } catch (e) { /* error already logged by commonPostToDvach */ }
  };

  const handleManualGeminiReplyToDvachPost = async (targetPost: DvachPost) => {
    if (!ai) { addLog('Gemini AI not initialized.', 'error'); return; }
    if (!dvachSessionCookies?.passcode_auth) {
        addLog('Not logged into Dvach. Please login before replying with Gemini.', 'error');
        setFetchError('Not logged into Dvach. Please login before replying with Gemini.');
        return;
    }
    const boardForReply = currentBoard.trim();
    const threadForReply = currentThreadId.trim();
    if (!boardForReply || !threadForReply) { addLog('Current board or thread ID not set for manual reply.', 'error'); return; }

    setGeminiLoading(true);
    const taskId = addTask('gemini_request', `Manual Gemini reply to >>${targetPost.num}`);
    addLog(`Gemini preparing manual reply to post >>${targetPost.num} on /${boardForReply}/${threadForReply}...`, 'gemini');

    let systemInstructionForReply = settings.geminiSystemInstruction || DEFAULT_APP_SETTINGS.geminiSystemInstruction;

    let threadContextSummary = "No additional thread context available from viewer.";
    const opPost = currentFetchedDvachPosts.find(p => p.num === threadForReply || p.op === 1);
    if (opPost) {
        threadContextSummary = `Thread OP (>>${opPost.num}): "${(opPost.comment || "N/A").replace(/<[^>]*>?/gm, '').substring(0,150)}..."\n`;
        if (opPost.files && opPost.files.length > 0) {
            threadContextSummary += `OP Post has ${opPost.files.length} file(s) (e.g. "${opPost.files[0].name}").\n`;
        }
    }
    const recentPostsText = currentFetchedDvachPosts
        .filter(p => p.num !== targetPost.num)
        .slice(-3)
        .map(p => `>>${p.num}: "${p.comment.replace(/<[^>]*>?/gm, '').substring(0,70)}..."`)
        .join('\n');
    if (recentPostsText) threadContextSummary += `Some recent posts in thread context:\n${recentPostsText}\n`;


    let userPromptText = `You are on the imageboard ${DVACH_DOMAINS[0]}/${boardForReply}/${threadForReply}.\nOverall thread context:\n${threadContextSummary}\n\nNow, focus on crafting a reply to this specific post:\nPost >>${targetPost.num} (by ${targetPost.name || 'Anonymous'}) says:\n"${targetPost.comment.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>?/gm, '').substring(0, 1000)}"`;

    const geminiMessageParts: Part[] = [];
    let imageFilesToAnalyze: DvachFile[] = [];

    if (targetPost.files && targetPost.files.length > 0) {
        const isOpPost = targetPost.num === threadForReply || targetPost.op === 1;
        const analysisEnabled = (settings.geminiAnalyzeOpMedia && isOpPost) ||
                                (settings.geminiAnalyzeAnonMedia && !isOpPost);
        if (analysisEnabled) {
            imageFilesToAnalyze = targetPost.files
                .filter(file => (file.type === 1 || file.type === 2 || file.type === 4 || file.type === 9)) // Common image types
                .slice(0, settings.maxImagesToAnalyzePerPost);
        }
    }

    if (imageFilesToAnalyze.length > 0) {
        userPromptText += `\n\nThe post >>${targetPost.num} includes ${imageFilesToAnalyze.length} image(s) (e.g., "${imageFilesToAnalyze[0].name}"). Please analyze these images as part of your reply generation.`;
        for (const dvachImageFile of imageFilesToAnalyze) {
            try {
                const imageBaseUrl = DVACH_DOMAINS[0]; // Use current domain from settings? For now, hardcode for simplicity
                const imageUrl = `${imageBaseUrl}${dvachImageFile.path}`;
                const proxiedImageUrl = buildProxiedGetUrl(imageUrl, settings.proxyModeForImagesGET, settings.customProxyUrlForImagesGET);
                addLog(`Fetching image ${dvachImageFile.name} for Gemini analysis (manual reply) using proxy mode '${settings.proxyModeForImagesGET}' from ${proxiedImageUrl} (target: ${imageUrl})`, 'gemini');

                const imageResponse = await fetch(proxiedImageUrl);
                if (!imageResponse.ok) {
                    addLog(`Failed to fetch image "${dvachImageFile.name}" via proxy ${proxiedImageUrl}. Status: ${imageResponse.status} ${imageResponse.statusText}. Check proxy.`, 'warning');
                    throw new Error(`Failed to fetch image via proxy: ${imageResponse.status} ${imageResponse.statusText}`);
                }
                const imageBlob = await imageResponse.blob();

                let mimeType = imageBlob.type;
                if (!mimeType || !mimeType.startsWith('image/')) {
                    // Fallback based on Dvach file types
                    mimeType = dvachImageFile.type === 1 ? 'image/jpeg' :
                               dvachImageFile.type === 2 ? 'image/png' :
                               dvachImageFile.type === 4 ? 'image/gif' :
                               dvachImageFile.type === 9 ? 'image/webp' :
                               'image/jpeg'; // Default fallback
                }

                const base64data = await new Promise<string>((resolveP, rejectP) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolveP((reader.result as string).split(',')[1]);
                    reader.onerror = rejectP;
                    reader.readAsDataURL(imageBlob);
                });
                geminiMessageParts.push({ inlineData: { mimeType: mimeType, data: base64data } });
                addLog(`Image "${dvachImageFile.name}" successfully prepared for Gemini (manual reply).`, 'gemini');
            } catch (imgError) {
                addLog(`Failed to fetch/process image "${dvachImageFile.name}" for Gemini (manual reply): ${(imgError as Error).message}. Confirm proxy settings for images and external proxy status.`, 'warning', imgError);
                userPromptText += ` (Note: Analysis of image ${dvachImageFile.name} failed. Rely on text description if available).`;
            }
        }
    }
    geminiMessageParts.push({ text: userPromptText + `\n\nGenerate your reply to >>${targetPost.num}.` });

    let geminiReplyText = "";
    try {
      const requestConfig: GenerateContentParameters['config'] = {
        systemInstruction: systemInstructionForReply,
        temperature: settings.geminiTemperature, topP: settings.geminiTopP,
        topK: settings.geminiTopK, maxOutputTokens: settings.geminiMaxOutputTokens,
        responseMimeType: settings.geminiResponseMimeType,
        safetySettings: settings.geminiSafetySettings.map(s => ({ category: s.category as any, threshold: s.threshold as any})),
      };
      if (settings.useThinkingBudget) {
        requestConfig.thinkingConfig = { thinkingBudget: settings.geminiThinkingBudget > 0 ? settings.geminiThinkingBudget : undefined };
      }

      const response = await ai.models.generateContent({
        model: GEMINI_TEXT_MODEL,
        contents: [{ role: 'user', parts: geminiMessageParts }],
        config: requestConfig
      }) as CustomGenerateContentResponse; // Explicit cast

      let rawGeminiText = response.text || "";

      if (response.candidates?.[0]?.groundingMetadata?.groundingAttribution) {
        const attributions = response.candidates[0].groundingMetadata.groundingAttribution
          .map(ga => ga.content.uri ? ({ web: { uri: ga.content.uri, title: ga.content.title || ga.content.uri } }) : null)
          .filter(chunk => chunk !== null) as GroundingChunk[];
        if (attributions.length > 0) {
             addLog("Gemini used web grounding for manual reply:", 'gemini', attributions);
        }
      }


      if (settings.geminiResponseMimeType === 'application/json') {
          const parsedResult = parseGeminiJsonResponse<{replyText?: string, text?: string, response?: string}>(rawGeminiText);
          let parsedText: string | undefined;
          if (parsedResult) {
            if (!Array.isArray(parsedResult)) { // Single object
                parsedText = parsedResult.replyText || parsedResult.text || parsedResult.response;
            } else if (parsedResult.length > 0) { // Array of objects, take first
                addLog('Gemini JSON response was an array, taking first element for manual reply.', 'gemini', parsedResult);
                parsedText = parsedResult[0].replyText || parsedResult[0].text || parsedResult[0].response;
            }
          }
          rawGeminiText = parsedText || rawGeminiText; // Fallback to original if parsing fails or yields no text
      }

      // Ensure reply starts with quote to target post
      const quotePattern = new RegExp(`^>>${targetPost.num}\\s*\\n?`);
      if (quotePattern.test(rawGeminiText.trimStart())) {
          geminiReplyText = rawGeminiText.trim();
      } else {
          geminiReplyText = `>>${targetPost.num}\n${rawGeminiText.trim()}`;
      }

      addLog(`Gemini generated text for manual reply to >>${targetPost.num}: ${geminiReplyText.substring(0, 100)}...`, 'gemini');

      let finalFileToPost: File | null = null;
      if (settings.geminiReplyWithGeneratedImage) {
        addLog(`Gemini generating image for manual reply to >>${targetPost.num}...`, 'gemini');
        const imagePpt = `Imageboard reply context: "${rawGeminiText.substring(0, 200).trim()}". Style: relevant, meme-like, or abstract.`;
        try {
            const imgGenResp = await ai.models.generateImages({
              model: GEMINI_IMAGE_MODEL,
              prompt: imagePpt,
              config: {
                numberOfImages: 1,
                outputMimeType: 'image/jpeg', // Forcing JPEG for broader compatibility
              }
            });
            if (imgGenResp.generatedImages?.[0]?.image?.imageBytes) {
              finalFileToPost = await base64ToFile(imgGenResp.generatedImages[0].image.imageBytes, `gemini_img_${Date.now()}.jpg`, imgGenResp.generatedImages[0].image.mimeType || 'image/jpeg');
              addLog(`Gemini generated image for manual reply to >>${targetPost.num}.`, 'gemini');
            } else { addLog(`Gemini image generation failed or no image returned for manual reply. Response: ${JSON.stringify(imgGenResp)}`, 'warning'); }
        } catch (imgGenError) {
             const errorMsg = (imgGenError as Error).message;
            if (errorMsg.includes("Imagen API is only accessible to billed users") || errorMsg.includes("API key not valid")) {
                addLog(`Imagen API access error for manual reply: ${errorMsg}. Please check your Google Cloud project billing status or API key permissions. Proceeding with text-only reply.`, 'warning', imgGenError);
            } else {
                addLog(`Gemini image generation failed for manual reply: ${errorMsg}. Posting text only.`, 'warning', imgGenError);
            }
        }
      }
      const newPostNumByGemini = await commonPostToDvach(geminiReplyText, finalFileToPost, postUseSage, boardForReply, threadForReply, targetPost.num);

      // Update the sent message with Gemini specific flags
      setSentMessages(prev => prev.map(msg =>
        msg.num === newPostNumByGemini && msg.board === boardForReply && msg.thread === threadForReply ?
        { ...msg, isGeminiPost: true, geminiTriggerPostNum: targetPost.num, geminiGeneratedImage: !!finalFileToPost } : msg
      ));
      addLog(`Manual Gemini reply posted as >>${newPostNumByGemini} to /${boardForReply}/${threadForReply}.`, 'success');

    } catch (error) {
      // Avoid double-logging errors already handled by commonPostToDvach
      if (! (error as Error).message.toLowerCase().includes("post failed") && ! (error as Error).message.toLowerCase().includes("dvach login")) {
         addLog(`Error during manual Gemini reply generation for >>${targetPost.num}: ${(error as Error).message}`, 'error', error);
      }
    } finally {
      setGeminiLoading(false);
      removeTask(taskId);
    }
  };

const runBotCycleCallback = useCallback(async () => {
    if (!ai || !dvachSessionCookies?.passcode_auth) {
        addAutonomousBotActivityLog("Bot cycle skipped: AI or Dvach login missing.", 'bot_warning');
        if (autonomousBotActive) setAutonomousBotActive(false); // Stop if prerequisites fail
        return;
    }
    const currentBotSettings = settings; // Capture current settings at cycle start
    const botBoard = currentBotSettings.autonomousBotTargetBoard.trim();
    const botThreadId = currentBotSettings.autonomousBotTargetThreadId.trim();

    if (!botBoard || !botThreadId) {
        addAutonomousBotActivityLog("Target board/thread for bot not set. Stopping bot.", 'bot_error');
        setAutonomousBotStatus("Error: Target board/thread not set.");
        if (autonomousBotActive) setAutonomousBotActive(false);
        return;
    }
    const currentBotTargetKeyForCycle = `${botBoard}_${botThreadId}`;
    setAutonomousBotStatus(`Active - Running cycle for /${botBoard}/${botThreadId}...`);
    addAutonomousBotActivityLog(`Starting bot cycle. Mode: ${currentBotSettings.autonomousBotReplyMode}. Target: /${botBoard}/${botThreadId}`, 'bot_activity');

    let workingConvoCandidate: GeminiDvachConversation | undefined = geminiDvachConversations.get(currentBotTargetKeyForCycle);

    try {
        const threadPostsResponse = await getThreadData(botBoard, botThreadId, currentBotSettings.proxyModeForGET, currentBotSettings.customProxyUrlForGET, currentBotSettings.userAgent);
        const allPostsInThread = threadPostsResponse?.threads?.[0]?.posts || [];
        const opPost = allPostsInThread.find(p => p.num === botThreadId || p.op === 1);

        if (!opPost) { // Critical for context building
            addAutonomousBotActivityLog(`OP Post for /${botBoard}/${botThreadId} not found. Cannot build context or reply. Skipping cycle.`, 'bot_error');
            setAutonomousBotStatus(`Error: OP Post not found for /${botBoard}/${botThreadId}.`);
            if (workingConvoCandidate) {
                const erroredConvo = { ...workingConvoCandidate, lastCheckedTimestamp: Date.now(), status: 'error' as const };
                setGeminiDvachConversations(prevConvos => new Map(prevConvos).set(currentBotTargetKeyForCycle, erroredConvo));
           }
            return;
        }

        // Ensure workingConvoCandidate is a valid object before deep copy
        if (!workingConvoCandidate) {
           addAutonomousBotActivityLog(`No existing conversation context for /${botBoard}/${botThreadId}. Creating new.`, 'bot_setup');
        } else if (workingConvoCandidate.board !== botBoard || workingConvoCandidate.threadId !== botThreadId) {
           addAutonomousBotActivityLog(`Existing context is for a different target (${workingConvoCandidate.board}/${workingConvoCandidate.threadId}). Creating new for /${botBoard}/${botThreadId}.`, 'bot_setup');
           workingConvoCandidate = undefined; // Force creation of new context
        }

        let initialContextTextForSystemMessage = "";
        const maxChars = currentBotSettings.autonomousBotFullThreadContextMaxChars > 0 ? currentBotSettings.autonomousBotFullThreadContextMaxChars : Infinity;
        if (currentBotSettings.autonomousBotInitialContextScope === 'full_thread') {
            let ctx = `CONTEXT_START: Full thread /${botBoard}/${botThreadId}.\n`; let len = ctx.length;
            for (const p of allPostsInThread) {
                const s = `>>${p.num}(${p.name||'A'}):"${p.comment.replace(/<[^>]+>/g,'').substring(0,250)}"\n`;
                if (len + s.length > maxChars && maxChars !== Infinity) { ctx += "...(truncated)\n"; break; }
                ctx += s; len += s.length;
            }
            initialContextTextForSystemMessage = ctx + "CONTEXT_END\n";
        } else { // op_only
            const opText = opPost.comment.replace(/<[^>]+>/g, '').substring(0,1500) || "N/A";
            initialContextTextForSystemMessage = `CONTEXT_START: OP(>>${opPost.num}) for /${botBoard}/${botThreadId}:\n"${opText}"\nCONTEXT_END\n`;
        }

        if (currentBotSettings.geminiAnalyzeOpMedia && (!currentBotOpMediaCache || currentBotOpMediaCache.threadId !== botThreadId || currentBotOpMediaCache.opPostNum !== opPost.num)) {
            const opMediaParts: Part[] = []; let opMediaCtxText = "";
            if (opPost.files) {
                for (const file of opPost.files.filter(f=>f.type===1||f.type===2||f.type===4||f.type===9).slice(0,currentBotSettings.maxImagesToAnalyzePerPost)) { // Common image types
                    try {
                        const imgUrl = `${DVACH_DOMAINS[0]}${file.path}`;
                        const proxiedUrl = buildProxiedGetUrl(imgUrl, currentBotSettings.proxyModeForImagesGET, currentBotSettings.customProxyUrlForImagesGET);
                        const imgResp = await fetch(proxiedUrl); if(!imgResp.ok) throw new Error(`Proxy fetch failed ${imgResp.status}`);
                        const blob = await imgResp.blob(); let mime = blob.type; if(!mime||!mime.startsWith('image/')) mime=file.type===1?'image/jpeg':file.type===2?'image/png':file.type===4?'image/gif':file.type===9?'image/webp':'image/jpeg';
                        const b64 = await new Promise<string>((r,j)=>{const rd=new FileReader();rd.onloadend=()=>r((rd.result as string).split(',')[1]);rd.onerror=j;rd.readAsDataURL(blob);});
                        opMediaParts.push({inlineData:{mimeType:mime,data:b64}}); opMediaCtxText += ` OP Image: '${file.name}'.`;
                    } catch(e){addAutonomousBotActivityLog(`Error processing OP image ${file.name}: ${(e as Error).message}. Proxy: ${currentBotSettings.proxyModeForImagesGET}`,'bot_warning');}
                }
            }
            setCurrentBotOpMediaCache({threadId:botThreadId,opPostNum:opPost.num,mediaParts:opMediaParts,mediaContextText:opMediaCtxText});
            addAutonomousBotActivityLog(`OP Media for /${botBoard}/${botThreadId} processed. ${opMediaParts.length} items. Cache updated.`, 'bot_setup');
        } else if (!currentBotSettings.geminiAnalyzeOpMedia) { if(currentBotOpMediaCache) {setCurrentBotOpMediaCache(null); addAutonomousBotActivityLog(`OP Media cache cleared for /${botBoard}/${botThreadId} (analysis disabled).`, 'bot_setup');} }

        const opMediaPartsForCtx = (currentBotOpMediaCache?.threadId===botThreadId && currentBotOpMediaCache.opPostNum===opPost.num)?currentBotOpMediaCache.mediaParts:[];

        let activeConversationForCycle: GeminiDvachConversation;

        if (!workingConvoCandidate) { // True if undefined from get() or forced undefined above
            const initialParts:Part[] = [...opMediaPartsForCtx, {text: initialContextTextForSystemMessage}];
            activeConversationForCycle = { id:currentBotTargetKeyForCycle,board:botBoard,threadId:botThreadId,triggerPostNum:opPost.num,botSystemPromptUsed:currentBotSettings.autonomousBotSystemPrompt,history:[{id:`ctx-setup-${Date.now()}`,role:'user',parts:initialParts,timestamp:Date.now()}],lastCheckedTimestamp:Date.now(),participatingPostNumbers:[opPost.num],status:'context_built',initialContext:{opPostNum:opPost.num,opPostText:initialContextTextForSystemMessage,opPostMediaParts:opMediaPartsForCtx}};
            addAutonomousBotActivityLog(`New conversation context created for /${botBoard}/${botThreadId}.`, 'bot_setup');
        } else {
             // Defensive deep copy for modification
            const deepCopiedConvo = JSON.parse(JSON.stringify(workingConvoCandidate)) as GeminiDvachConversation;
            activeConversationForCycle = deepCopiedConvo;

            let updatedHist = [...activeConversationForCycle.history];
            const knownPostNums = new Set([...updatedHist.map(m=>m.id.replace(/^(user-dvach-|model-reply-to-|bot-)/,'')), ...activeConversationForCycle.participatingPostNumbers]);
            const newPosts = allPostsInThread.filter(p=>p.timestamp*1000 > activeConversationForCycle.lastCheckedTimestamp && !knownPostNums.has(p.num) && (!sentMessages.some(sm=>sm.num===p.num&&sm.isGeminiPost&&sm.board===botBoard&&sm.thread===botThreadId)||currentBotSettings.autonomousBotAllowReplyToSelf));
            if(newPosts.length > 0) addAutonomousBotActivityLog(`${newPosts.length} new posts detected in /${botBoard}/${botThreadId} since last check. Processing...`, 'bot_activity');

            newPosts.forEach(p=>{const txt=`>>${p.num}(${p.name||'A'}@${new Date(p.timestamp*1000).toLocaleTimeString()}):"${p.comment.replace(/<[^>]+>/g,'').substring(0,300)}"`;updatedHist.push({id:`user-dvach-${p.num}`,role:'user',parts:[{text:txt}],timestamp:p.timestamp*1000});if(!activeConversationForCycle.participatingPostNumbers.includes(p.num))activeConversationForCycle.participatingPostNumbers.push(p.num);});

            if(updatedHist.length > 50){ // History pruning
                const ctxMsg=updatedHist.find(m=>m.id.startsWith("ctx-setup-"));
                const otherMsgs=updatedHist.filter(m=>!m.id.startsWith("ctx-setup-"));
                updatedHist = ctxMsg ? [ctxMsg, ...otherMsgs.slice(-49)] : otherMsgs.slice(-50);
                addAutonomousBotActivityLog(`History pruned to ${updatedHist.length} messages for /${botBoard}/${botThreadId}.`, 'bot_setup');
            }
            activeConversationForCycle.history = updatedHist;
            if(activeConversationForCycle.initialContext) { // Update OP media in context if it was re-cached
                activeConversationForCycle.initialContext.opPostMediaParts = opMediaPartsForCtx;
            }
        }

        if (currentBotSettings.autonomousBotReplyMode === 'random_in_thread') {
            const eligiblePostsForReply = allPostsInThread.filter(p =>
                p.num !== opPost.num && // Don't reply to OP itself in this mode
                (!sentMessages.some(sm => sm.num === p.num && sm.isGeminiPost && sm.board === botBoard && sm.thread === botThreadId) || currentBotSettings.autonomousBotAllowReplyToSelf) && // Not replied by bot or allow self-reply
                !BUMP_KEYWORDS.some(kw => p.comment.toLowerCase().includes(kw)) && // Not a bump post
                !activeConversationForCycle.participatingPostNumbers.includes(p.num) // Not already part of this conversation cycle
            );

            if(eligiblePostsForReply.length > 0){
                const targetPost = eligiblePostsForReply[Math.floor(Math.random()*eligiblePostsForReply.length)];
                addAutonomousBotActivityLog(`Bot selected >>${targetPost.num} on /${botBoard}/${botThreadId} for random reply.`, 'bot_activity');
                setAutonomousBotStatus(`Generating reply to >>${targetPost.num}...`);

                let histForGemini = [...activeConversationForCycle.history];
                let currentUserMsgTxt = `Replying to >>${targetPost.num} (originally by ${targetPost.name||'Anonymous'}): "${targetPost.comment.replace(/<[^>]+>/g,'').substring(0,500)}"`;
                const currentUserMsgParts:Part[]=[];

                if(currentBotSettings.botAnalyzesImagesInTriggerPosts && targetPost.files){
                    for(const f of targetPost.files.filter(fl=>(fl.type===1||fl.type===2||fl.type===4||fl.type===9)).slice(0,currentBotSettings.maxImagesToAnalyzePerPost)){ // Common image types
                        try{
                            const iu=`${DVACH_DOMAINS[0]}${f.path}`;const piu=buildProxiedGetUrl(iu,currentBotSettings.proxyModeForImagesGET,currentBotSettings.customProxyUrlForImagesGET);
                            const ir=await fetch(piu);if(!ir.ok)throw new Error(`Proxy fetch failed ${ir.status}`);
                            const b=await ir.blob();let mt=b.type;if(!mt||!mt.startsWith('image/'))mt=f.type===1?'image/jpeg':f.type===2?'image/png':f.type===4?'image/gif':f.type===9?'image/webp':'image/jpeg';
                            const bs=await new Promise<string>((rs,rj)=>{const rdr=new FileReader();rdr.onloadend=()=>rs((rdr.result as string).split(',')[1]);rdr.onerror=rj;rdr.readAsDataURL(b);});
                            currentUserMsgParts.push({inlineData:{mimeType:mt,data:bs}}); currentUserMsgTxt+=` Image content associated with post: '${f.name}'.`;
                        }catch(e){addAutonomousBotActivityLog(`Error processing bot target image ${f.name}: ${(e as Error).message}. Proxy: ${currentBotSettings.proxyModeForImagesGET}`,'bot_warning');}
                    }
                }
                currentUserMsgParts.push({text:currentUserMsgTxt+`\n\nInstruction: Generate a suitable reply based on the conversation history and this target post. Your response must be in JSON format: { "replyText": "your reply content here" }. Ensure the reply content itself does not include the '>>${targetPost.num}' quote, as it will be added automatically.`});

                // Add as the last message in the history copy
                histForGemini.push({id:`user-dvach-${targetPost.num}`,role:'user',parts:currentUserMsgParts,timestamp:Date.now()});

                const botGenConfig:GenerateContentParameters['config']={
                    systemInstruction: currentBotSettings.autonomousBotSystemPrompt,
                    temperature:0.85, topK:50, topP:0.95,
                    maxOutputTokens: AUTONOMOUS_BOT_MAX_OUTPUT_TOKENS,
                    responseMimeType:"application/json",
                    responseSchema:{type:"object",properties:{replyText:{type:"string",description:"The bot's reply text, excluding the initial >>POST_NUM quote."}},required:["replyText"]},
                    safetySettings: currentBotSettings.geminiSafetySettings.map(s=>({category:s.category as any,threshold:s.threshold as any}))
                };
                if(currentBotSettings.autonomousBotDisableThinking) botGenConfig.thinkingConfig={thinkingBudget:0};

                const geminiResponse = await ai.models.generateContent({model:GEMINI_TEXT_MODEL,contents:histForGemini,config:botGenConfig});
                const textToParseForJson = geminiResponse.text;

                if(typeof textToParseForJson === 'string'){
                    const parsedResult = parseGeminiJsonResponse<BotReplySchema>(textToParseForJson);
                    let botReplyText: string | undefined;

                    if (parsedResult) {
                        if (!Array.isArray(parsedResult)) { // Single object
                            botReplyText = parsedResult.replyText;
                        } else if (parsedResult.length > 0) { // Array of objects, take first
                            addAutonomousBotActivityLog('Bot Gemini JSON response was an array, taking first element.', 'bot_activity', parsedResult);
                            botReplyText = parsedResult[0].replyText;
                        }
                    }

                    if(botReplyText){
                        let rawReplyContent = botReplyText.trim();
                        // Remove any accidental >>targetPost.num from Gemini's response as we add it manually
                        const quotePatternForReply = new RegExp(`^>>${targetPost.num}\\s*\\n?`, 'i');
                        rawReplyContent = rawReplyContent.replace(quotePatternForReply, '').trim();

                        const finalCommentToPost = `>>${targetPost.num}\n${rawReplyContent}`;
                        const replyDelayMs = Math.floor(Math.random()*(currentBotSettings.autonomousBotMaxReplyDelayMs-currentBotSettings.autonomousBotMinReplyDelayMs+1))+currentBotSettings.autonomousBotMinReplyDelayMs;
                        addAutonomousBotActivityLog(`Bot generated reply for >>${targetPost.num}. Waiting ${replyDelayMs}ms before posting... Text: "${rawReplyContent.substring(0,70)}..."`, 'bot_activity');
                        await new Promise(resolve => window.setTimeout(resolve,replyDelayMs));

                        let fileToPostForBot:File|null=null;
                        if(currentBotSettings.geminiReplyWithGeneratedImage){
                             try{const imgPromptForBot=`Image context: "${rawReplyContent.substring(0,150)}"`;const igr=await ai.models.generateImages({model:GEMINI_IMAGE_MODEL,prompt:imgPromptForBot,config:{numberOfImages:1,outputMimeType:'image/jpeg'}});if(igr.generatedImages?.[0]?.image?.imageBytes)fileToPostForBot=await base64ToFile(igr.generatedImages[0].image.imageBytes,`bot_img_${Date.now()}.jpg`,igr.generatedImages[0].image.mimeType||'image/jpeg');}catch(eImg){addLog(`Bot image gen error: ${(eImg as Error).message}`,'bot_warning');}
                        }
                        try {
                            const newPostNumByBot = await commonPostToDvach(finalCommentToPost, fileToPostForBot, false, botBoard, botThreadId, targetPost.num);
                            setSentMessages(prev => [{num:newPostNumByBot,timestamp:Date.now(),comment:finalCommentToPost,board:botBoard,thread:botThreadId,parent:targetPost.num,isGeminiPost:true,geminiTriggerPostNum:targetPost.num,geminiGeneratedImage:!!fileToPostForBot},...prev]);

                            const botReplyMessageToHistory:ChatMessage={id:`model-reply-to-${targetPost.num}-${newPostNumByBot}`,role:'model',parts:[{text:rawReplyContent}],timestamp:Date.now()};
                            const userMessageToHistory:ChatMessage={id:`user-dvach-${targetPost.num}`,role:'user',parts:currentUserMsgParts,timestamp:Date.now()-100};

                            activeConversationForCycle = {
                                ...activeConversationForCycle,
                                participatingPostNumbers: [...new Set([...activeConversationForCycle.participatingPostNumbers, targetPost.num, newPostNumByBot])],
                                history: [...activeConversationForCycle.history.filter(m=>m.id!==`user-dvach-${targetPost.num}`), userMessageToHistory, botReplyMessageToHistory],
                                lastBotReplyNum: newPostNumByBot,
                                status:'active'
                            };
                            setAutonomousBotStatus(`Replied as >>${newPostNumByBot} to >>${targetPost.num} in /${botBoard}/${botThreadId}`);
                        } catch(postErr){
                            const pe = postErr as Error;
                            if(pe.message.toLowerCase().includes("вы постите слишком быстро") || pe.message.includes("-8") || pe.message.includes("too fast")){
                                addAutonomousBotActivityLog(`Posting error (too fast/cooldown): ${pe.message}. Bot will retry in next cycle.`, 'bot_warning');
                            } else {
                                throw pe; // Rethrow other posting errors to be caught by main cycle catch
                            }
                        }
                    } else {addAutonomousBotActivityLog(`Error parsing Gemini JSON for bot reply to >>${targetPost.num} or replyText missing: ${textToParseForJson.substring(0,200)}`,'bot_warning');}
                } else {addAutonomousBotActivityLog(`Gemini response had no text for bot reply to >>${targetPost.num}: ${JSON.stringify(geminiResponse).substring(0,200)}`,'bot_warning');}
            } else { addAutonomousBotActivityLog("No eligible posts found for random reply in this cycle for /"+botBoard+"/"+botThreadId+".", 'bot_activity');}
        } else if (currentBotSettings.autonomousBotReplyMode === 'replies_to_bot') {
            addAutonomousBotActivityLog("Bot Mode 'replies_to_bot' is a placeholder and not yet fully implemented. Skipping active reply generation.", 'bot_warning');
            // Future: Implement logic to find replies to bot's own posts and respond.
        }
        activeConversationForCycle.lastCheckedTimestamp=Date.now();
        setGeminiDvachConversations(p=>new Map(p).set(currentBotTargetKeyForCycle,activeConversationForCycle));
        setAutonomousBotStatus(`Waiting (${currentBotSettings.autonomousBotCycleIntervalSeconds}s) /${botBoard}/${botThreadId}`);
        addAutonomousBotActivityLog("Bot cycle finished for /"+botBoard+"/"+botThreadId+".", 'bot_activity');

    } catch (cycleError) {
        const error = cycleError as Error;
        addAutonomousBotActivityLog(`Critical error in bot cycle for /${botBoard}/${botThreadId}: ${error.message}`, 'bot_error', error);
        setAutonomousBotStatus(`Error in cycle: ${error.message.substring(0,50)}...`);
        if (workingConvoCandidate) {
             const erroredConvo = { ...workingConvoCandidate, lastCheckedTimestamp: Date.now(), status: 'error' as const };
             setGeminiDvachConversations(prevConvos => new Map(prevConvos).set(currentBotTargetKeyForCycle, erroredConvo));
        }
    }
}, [ai, dvachSessionCookies, settings, addAutonomousBotActivityLog, setAutonomousBotStatus, geminiDvachConversations, setGeminiDvachConversations, sentMessages, setSentMessages, currentBotOpMediaCache, setCurrentBotOpMediaCache, addLog, commonPostToDvach, autonomousBotActive]);


useEffect(() => {
    if (!autonomousBotActive) {
        if (autonomousBotIntervalRef.current) {
            window.clearInterval(autonomousBotIntervalRef.current);
            removeTask('bot_cycle'); // Assuming 'bot_cycle' is the main task ID for the interval
            autonomousBotIntervalRef.current = null;
        }
        setAutonomousBotStatus("Inactive - Bot Stopped");
        setCurrentBotOpMediaCache(null); // Clear OP media cache when bot stops
        return;
    }

    let reason = "";
    if (!ai) reason = "Gemini AI not initialized";
    else if (!dvachSessionCookies?.passcode_auth) reason = "Not logged into Dvach";
    else if (!settings.autonomousBotTargetBoard.trim() || !settings.autonomousBotTargetThreadId.trim()) reason = "Target board/thread not set";

    if (reason) {
        setAutonomousBotStatus(`Inactive - ${reason}`);
        if (autonomousBotActive) addLog(`Autonomous bot cannot run: ${reason}. Stopping.`, "bot_error");
        setAutonomousBotActive(false); // Automatically turn off if prerequisites are not met
        return;
    }

    addLog(`Autonomous bot starting... Interval: ${settings.autonomousBotCycleIntervalSeconds}s.`, 'bot_setup');
    setAutonomousBotStatus("Active - Preparing initial cycle...");
    const botTaskId = addTask('bot_cycle', `Bot on /${settings.autonomousBotTargetBoard}/${settings.autonomousBotTargetThreadId}`, () => {
        setAutonomousBotActive(false); // This stop function will be called by removeTask
        addLog("Autonomous bot explicitly stopped via task manager.", "bot_setup");
    });

    // Initial run, then interval
    const initialTimeout = window.setTimeout(() => { if (autonomousBotActive) runBotCycleCallback(); }, 3000); // Delay first run slightly
    const intervalId = window.setInterval(() => {
        if (autonomousBotActive) {
            runBotCycleCallback();
        } else if(autonomousBotIntervalRef.current) { // Bot was stopped externally
            window.clearInterval(autonomousBotIntervalRef.current);
            removeTask(botTaskId); // Clean up task if bot stopped
            autonomousBotIntervalRef.current = null;
        }
    }, settings.autonomousBotCycleIntervalSeconds * 1000);
    autonomousBotIntervalRef.current = intervalId;

    return () => { // Cleanup on component unmount or when bot stops
        window.clearTimeout(initialTimeout);
        if (autonomousBotIntervalRef.current) window.clearInterval(autonomousBotIntervalRef.current);
        removeTask(botTaskId);
        autonomousBotIntervalRef.current = null;
        addLog("Autonomous bot interval stopped due to cleanup.", "bot_setup");
    };
}, [autonomousBotActive, runBotCycleCallback, settings.autonomousBotCycleIntervalSeconds, settings.autonomousBotTargetBoard, settings.autonomousBotTargetThreadId, ai, dvachSessionCookies, addLog, addTask, removeTask]); // Added dependencies

  const toggleTheme = () => {
    const newTheme = settings.theme === 'light' ? 'dark' : settings.theme === 'dark' ? 'system' : 'light';
    handleUpdateSettings({ theme: newTheme });
  };

  const ThemeIconComponent: React.FC<React.SVGProps<SVGSVGElement>> = (props) => {
    if (settings.theme === 'dark') return <IconMoon {...props} />;
    if (settings.theme === 'light') return <IconSun {...props} />;
    // For 'system' theme, check prefers-color-scheme
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    return prefersDark ? <IconMoon {...props} /> : <IconSun {...props} />;
  };

  const readFileContent = useCallback(async (file: File): Promise<string[]> => {
    addLog(`Reading file: ${file.name}`, 'info');
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        resolve(text.split(/\r\n|\n/).filter(line => line.trim() !== '')); // Filter out empty lines
      };
      reader.onerror = (error) => {
        addLog(`Error reading file ${file.name}`, 'error', error);
        reject(error);
      };
      reader.readAsText(file);
    });
  }, [addLog]);

  const handleFileUpload = useCallback(async (
    event: React.ChangeEvent<HTMLInputElement>,
    _setter?: React.Dispatch<React.SetStateAction<string[]>> // Setter still marked as potentially unused
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      try {
        const content = await readFileContent(file);
        addLog(`File "${file.name}" uploaded and processed. Lines: ${content.length}`, 'success');
        // Example of using setter if it were for a specific state:
        // if (_setter) _setter(content);
        // For now, just logs, as Gemini Lab features that might use this were removed.
      } catch (error) {
        addLog(`Failed to process file "${file.name}"`, 'error', error);
      }
    }
    if(event.target) event.target.value = ''; // Reset file input to allow re-uploading the same file
  }, [readFileContent, addLog]);

  // Simplified styles for code editor textareas
  const codeEditorStyle: React.CSSProperties = {
    fontFamily: 'monospace',
    fontSize: '0.875rem', // Equivalent to text-sm
    backgroundColor: settings.theme === 'dark' || (settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches) ? '#1f2937' : '#f9fafb', // gray-800 or gray-50
    color: settings.theme === 'dark' || (settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches) ? '#d1d5db' : '#111827', // gray-300 or gray-900
    border: `1px solid ${settings.theme === 'dark' || (settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches) ? '#4b5563' : '#e5e7eb'}`, // gray-600 or gray-200
    borderRadius: '0.375rem', // rounded-md
    padding: '0.5rem', // p-2
    minHeight: '100px',
    lineHeight: '1.5',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
  };


  // --- RENDER FUNCTIONS ---
  const renderDvachPostCard = (post: DvachPost, index: number) => {
     const boardIdentifier = currentBoard.trim(); // Use currentBoard state for manual ops panel
     const threadIdentifier = currentThreadId.trim(); // Use currentThreadId state for manual ops panel

     const sentMessageData = sentMessages.find(m => m.num === post.num && m.board === boardIdentifier && m.thread === threadIdentifier);
     const isMyPost = !!sentMessageData;
     const isGeminiPostByBot = sentMessageData?.isGeminiPost || false;
     // Check if any sent message (typically bot reply) targets this specific post
     const isGeminiReplyToThis = sentMessages.some(m => m.parent === post.num && m.isGeminiPost && m.board === boardIdentifier && m.thread === threadIdentifier);

     const cardBg = isMyPost ? (isGeminiPostByBot ? "bg-purple-50 dark:bg-purple-900/50" : "bg-blue-50 dark:bg-blue-900/50") : "bg-gray-50 dark:bg-gray-700";
     const borderColor = isMyPost ? isGeminiPostByBot ? "border-purple-300 dark:border-purple-700" : "border-blue-300 dark:border-blue-700" : "border-gray-200 dark:border-gray-600";

    return (
    <div key={`${post.num}-${index}`} id={`post-${post.num}`} className={`p-3 mb-3 ${cardBg} rounded-lg shadow border ${borderColor} transition-all hover:shadow-md`} role="article" aria-labelledby={`post-header-${post.num}`}>
      <div id={`post-header-${post.num}`} className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400 mb-1">
        <span>
          <span className="font-semibold text-gray-700 dark:text-gray-300">{post.name || 'Anonymous'}</span>
          {post.trip && <span className="ml-1 text-green-600 dark:text-green-400">{post.trip}</span>}
          {' - No. '}
          <a href={`${DVACH_DOMAINS[0]}/${boardIdentifier}/res/${threadIdentifier}.html#${post.num}`} target="_blank" rel="noopener noreferrer" className="hover:underline text-blue-500 dark:text-blue-400" onClick={(e) => { e.preventDefault(); document.getElementById(`post-${post.num}`)?.scrollIntoView({behavior: 'smooth'}); }} aria-label={`Link to post number ${post.num} on Dvach`}>{post.num}</a>
          {isMyPost && <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full bg-green-200 dark:bg-green-700 text-green-800 dark:text-green-100">You</span>}
          {isGeminiPostByBot && <IconSparkles className="inline-block ml-1 h-3 w-3 text-purple-500" title="Posted by Gemini"/>}
        </span>
        <time dateTime={new Date(post.timestamp * 1000).toISOString()}>{new Date(post.timestamp * 1000).toLocaleString()}</time>
      </div>
      {post.subject && <h4 className="font-semibold text-sm mb-1 text-gray-800 dark:text-gray-200">{post.subject}</h4>}
      {post.files && post.files.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {post.files.map((file, fileIndex) => {
            const imageBaseUrl = DVACH_DOMAINS[0]; // Consider using currentDvachDomain from settings if it varies
            const fileUrl = `${imageBaseUrl}${file.path}`;
            const thumbUrl = `${imageBaseUrl}${file.thumbnail}`;
            // Use proxy for thumbnails in the viewer
            const proxiedThumbUrl = buildProxiedGetUrl(thumbUrl, settings.proxyModeForImagesGET, settings.customProxyUrlForImagesGET);
            return (<a key={fileIndex} href={fileUrl} target="_blank" rel="noopener noreferrer" className="block w-24 h-24 group relative">
              <img src={proxiedThumbUrl} alt={file.name || `file ${fileIndex + 1}`} className="rounded object-cover w-full h-full border border-gray-300 dark:border-gray-500 group-hover:opacity-80 transition-opacity" loading="lazy" onError={(e) => { addLog(`Failed to load thumbnail via proxy '${settings.proxyModeForImagesGET}': ${proxiedThumbUrl}. Attempting direct. URL: ${thumbUrl}`, 'warning'); (e.target as HTMLImageElement).src = thumbUrl; (e.target as HTMLImageElement).onerror = null; }}/>
              <div className="absolute bottom-0 left-0 bg-black bg-opacity-50 text-white text-xs p-0.5 truncate w-full group-hover:opacity-100 opacity-0 transition-opacity">{file.name} ({file.size}KB)</div>
            </a>);
          })}
        </div>
      )}
      <div className="prose prose-sm dark:prose-invert max-w-none break-words" dangerouslySetInnerHTML={{ __html: post.comment.replace(/&gt;&gt;(\d+)/g, (_match, p1) => `<a href="#post-${p1}" class="text-blue-500 dark:text-blue-400 hover:underline" data-replyto="${p1}" aria-label="Reply to post ${p1}">&gt;&gt;${p1}</a>`) }}/>
      <div className="mt-2 text-right">
        {isGeminiReplyToThis && <span className="text-xs text-purple-600 dark:text-purple-400 mr-2">Gemini replied</span>}
        <button onClick={() => handleManualGeminiReplyToDvachPost(post)} disabled={geminiLoading || !ai || !dvachSessionCookies?.passcode_auth || !boardIdentifier || !threadIdentifier} className="px-3 py-1 text-xs bg-purple-500 hover:bg-purple-600 text-white rounded-md font-medium flex items-center shadow disabled:opacity-50 disabled:cursor-not-allowed transition-colors" title={!ai ? "Gemini AI not initialized" : !dvachSessionCookies?.passcode_auth ? "Login to Dvach to reply" : "Reply with Gemini"} aria-label={`Reply to post ${post.num} with Gemini`}>
          <IconSparkles className="mr-1 h-4 w-4"/> Reply with Gemini
        </button>
      </div>
    </div>
  )};

  const renderDvachBotPanel = () => (
    <div className="space-y-6 p-4 md:p-6 bg-white dark:bg-gray-800 shadow-lg rounded-lg">
      <h2 className="text-2xl font-semibold text-blue-600 dark:text-blue-400 border-b pb-2 border-gray-300 dark:border-gray-700">Dvach Manual Operations</h2>
      {/* Dvach Authentication Section */}
      <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-md">
        <h3 className="text-lg font-medium mb-2 text-gray-700 dark:text-gray-300">Dvach Authentication</h3>
        {dvachSessionCookies?.passcode_auth ? (
            <div className="flex items-center space-x-3"> <IconUserCircle className="h-6 w-6 text-green-500" /> <span className="text-sm text-green-700 dark:text-green-300">Logged in to Dvach.</span> <button onClick={handleDvachLogout} className="px-3 py-1 text-xs bg-red-500 hover:bg-red-600 text-white rounded-md flex items-center shadow transition-colors"><IconLogout className="mr-1 h-4 w-4"/> Logout</button> </div>
        ) : (
            <div className="flex items-center space-x-3"> <IconAlertTriangle className="h-6 w-6 text-yellow-500" /> <span className="text-sm text-yellow-700 dark:text-yellow-300">Not logged in.</span> <button onClick={handleDvachLogin} disabled={isDvachLoggingIn || !settings.purchasedPasscode} className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-md flex items-center shadow disabled:opacity-50 transition-colors">{isDvachLoggingIn ? <IconRefresh className="mr-1 h-4 w-4 animate-spin"/> : <IconLogin className="mr-1 h-4 w-4"/>}{isDvachLoggingIn ? 'Logging in...' : 'Login'}</button> </div>
        )}
        {!settings.purchasedPasscode && !dvachSessionCookies?.passcode_auth && <p className="text-xs text-red-500 mt-1">Passcode not set in Settings.</p>}
         {fetchError && (fetchError.includes("Login failed") || fetchError.includes("Dvach login error") || fetchError.includes("session cookie")) && <p className="text-xs text-red-500 mt-1">{fetchError}</p>}
      </div>

      {/* Manual Post Section */}
      <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-md">
        <h3 className="text-xl font-medium mb-3 text-gray-700 dark:text-gray-300">Manual Post</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
            <div><label htmlFor="manualBoard" className="block text-sm font-medium">Board:</label><input id="manualBoard" type="text" value={currentBoard} onChange={e => setCurrentBoard(e.target.value)} className="input-field"/></div>
            <div><label htmlFor="manualThreadId" className="block text-sm font-medium">Thread ID (0 for new):</label><input id="manualThreadId" type="text" value={currentThreadId} onChange={e => setCurrentThreadId(e.target.value)} className="input-field"/></div>
        </div>
        <textarea aria-label="Post comment" className="input-field w-full" rows={3} placeholder="Comment..." value={postText} onChange={(e) => setPostText(e.target.value)}/>
        <div className="flex items-center space-x-4 mt-2">
          <label className="text-sm">Attach Image:<input type="file" onChange={(e) => setPostFile(e.target.files?.[0] || null)} className="input-file ml-2"/>{postFile && <span className="text-xs ml-2">{postFile.name} (<button onClick={() => setPostFile(null)} className="text-red-500 hover:underline">x</button>)</span>}</label>
          <label className="flex items-center text-sm"><input type="checkbox" checked={postUseSage} onChange={(e) => setPostUseSage(e.target.checked)} className="mr-1 h-4 w-4 checkbox-field"/>Sage</label>
          <button onClick={handleSimplePost} disabled={isPosting || !dvachSessionCookies?.passcode_auth || !currentBoard.trim() || !postText.trim()} className="btn-primary flex items-center" title={!dvachSessionCookies?.passcode_auth ? "Login to post" : (!currentBoard.trim() || !postText.trim()) ? "Board/comment required" : "Post"}>
            {isPosting ? <IconRefresh className="mr-2 h-5 w-5 animate-spin"/> : <IconSend className="mr-2 h-5 w-5"/>}{isPosting ? 'Posting...' : 'Post'}
          </button>
        </div>
        {postActivityLog.length > 0 && <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 space-y-0.5">{postActivityLog.map((log,i) => <p key={i} className="truncate">{log}</p>)}</div>}
        {fetchError && (fetchError.includes("Failed to post") || fetchError.includes("Board and Post Comment")) && <p className="text-xs text-red-500 mt-1">{fetchError}</p>}
      </div>

      {/* Thread Viewer Section */}
      <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-md">
        <div className="flex justify-between items-center mb-3">
            <h3 className="text-xl font-medium text-gray-700 dark:text-gray-300">Thread Viewer & Gemini Reply</h3>
            <button onClick={() => handleLoadThread(false)} disabled={isFetchingThread || !currentBoard.trim() || !currentThreadId.trim()} className="btn-secondary flex items-center" title={(!currentBoard.trim() || !currentThreadId.trim()) ? "Enter Board/Thread ID" : "Fetch posts"}>
                <IconRefresh className={`mr-2 h-5 w-5 ${isFetchingThread ? 'animate-spin' : ''}`}/> Fetch Thread
            </button>
        </div>
        {(!currentBoard.trim() || !currentThreadId.trim()) && <p className="text-sm text-yellow-600 dark:text-yellow-400">Enter Board and Thread ID to view posts.</p>}
        {fetchError && !fetchError.includes("Login failed") && !fetchError.includes("Failed to post") && <p className="text-sm text-red-600 dark:text-red-400">Error: {fetchError}</p>}
        <div ref={threadPostsContainerRef} className="max-h-[600px] overflow-y-auto bg-gray-100 dark:bg-gray-800 p-2 rounded custom-scrollbar border border-gray-200 dark:border-gray-700">
            {isFetchingThread && <p className="text-center p-4">Loading thread...</p>}
            {!isFetchingThread && currentFetchedDvachPosts.length === 0 && (!currentBoard.trim() || !currentThreadId.trim() || fetchError) && <p className="text-center p-4 text-gray-500 dark:text-gray-400">No posts. Enter Board/Thread ID & Fetch.</p>}
            {!isFetchingThread && currentFetchedDvachPosts.length === 0 && currentBoard.trim() && currentThreadId.trim() && !fetchError && <p className="text-center p-4 text-gray-500 dark:text-gray-400">Thread empty or error (check logs).</p>}
            {currentFetchedDvachPosts.map(renderDvachPostCard)}
        </div>
      </div>
    </div>
  );

  const renderAutonomousBotControlPanel = () => (
    <div className="space-y-6 p-4 md:p-6 bg-white dark:bg-gray-800 shadow-lg rounded-lg">
      <div className="flex justify-between items-center border-b pb-2 border-gray-300 dark:border-gray-700">
        <h2 className="text-2xl font-semibold text-purple-600 dark:text-purple-400">Autonomous Gemini Bot Control</h2>
        <div className="flex items-center space-x-2">
            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${autonomousBotActive ? 'bg-green-200 text-green-800 dark:bg-green-700 dark:text-green-100' : 'bg-red-200 text-red-800 dark:bg-red-700 dark:text-red-100'}`}>{autonomousBotActive ? 'Active' : 'Inactive'}</span>
            <button onClick={() => setAutonomousBotActive(prev => !prev)} disabled={!ai || !dvachSessionCookies?.passcode_auth || !settings.autonomousBotTargetBoard.trim() || !settings.autonomousBotTargetThreadId.trim()} className={`btn ${autonomousBotActive ? 'btn-danger' : 'btn-success'} flex items-center`} title={!ai?"Gemini not init":!dvachSessionCookies?.passcode_auth?"Not logged in":(!settings.autonomousBotTargetBoard.trim()||!settings.autonomousBotTargetThreadId.trim())?"Bot target not set":autonomousBotActive?"Stop Bot":"Start Bot"}>
                {autonomousBotActive ? <IconPlayerStop className="mr-2 h-5 w-5"/> : <IconPlayerPlay className="mr-2 h-5 w-5"/>}
                {autonomousBotActive ? 'Stop Bot' : 'Start Bot'}
            </button>
        </div>
      </div>
      <div className="p-4 border rounded-md border-gray-200 dark:border-gray-700 space-y-3">
        <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">Bot Target Configuration</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">Also available in Settings tab.</p>
        <div><label htmlFor="botPanelTargetBoard" className="block text-sm font-medium">Bot Target Board:</label><input id="botPanelTargetBoard" type="text" value={settings.autonomousBotTargetBoard} onChange={e => handleUpdateSettings({ autonomousBotTargetBoard: e.target.value })} className="input-field mt-1"/></div>
        <div><label htmlFor="botPanelTargetThreadId" className="block text-sm font-medium">Bot Target Thread ID:</label><input id="botPanelTargetThreadId" type="text" value={settings.autonomousBotTargetThreadId} onChange={e => handleUpdateSettings({ autonomousBotTargetThreadId: e.target.value })} className="input-field mt-1"/></div>
      </div>
       {(!ai || !dvachSessionCookies?.passcode_auth || !settings.autonomousBotTargetBoard.trim() || !settings.autonomousBotTargetThreadId.trim()) && <div className="alert-warning"><p className="font-semibold">Bot cannot start:</p><ul className="list-disc list-inside ml-4 text-xs">{!ai && <li>Gemini AI not initialized.</li>}{!dvachSessionCookies?.passcode_auth && <li>Not logged into Dvach.</li>}{(!settings.autonomousBotTargetBoard.trim() || !settings.autonomousBotTargetThreadId.trim()) && <li>Bot target board/thread not set.</li>}</ul></div>}
      <div className="p-4 border rounded-md border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium mb-2 text-gray-700 dark:text-gray-300">Bot Status & Activity</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Status: <span className="font-semibold">{autonomousBotStatus}</span></p>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Target: <span className="font-semibold">/{settings.autonomousBotTargetBoard.trim()||"[NS]"}/{settings.autonomousBotTargetThreadId.trim()||"[NS]"}</span> | Mode: <span className="font-semibold">{settings.autonomousBotReplyMode.replace(/_/g,' ')}</span> | Interval: <span className="font-semibold">{settings.autonomousBotCycleIntervalSeconds}s</span></p>
        {activeTasks.filter(t=>t.type==='bot_cycle').length > 0 && <p className="text-xs text-green-600 dark:text-green-400">Active Bot Task ID: {activeTasks.find(t=>t.type==='bot_cycle')?.id}</p>}
        <div className="max-h-60 overflow-y-auto bg-gray-50 dark:bg-gray-900 p-2 rounded border border-gray-200 dark:border-gray-700 custom-scrollbar">{autonomousBotActivityLog.length===0 && <p className="text-xs text-gray-500 dark:text-gray-400 text-center">No bot activity.</p>}{autonomousBotActivityLog.map((log,idx) => (<p key={idx} className="text-xs text-gray-700 dark:text-gray-300 mb-0.5 font-mono">{log}</p>))}</div>
      </div>
      <div className="p-4 border rounded-md border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium mb-2 text-gray-700 dark:text-gray-300">Active Gemini-Dvach Conversations (Bot)</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Bot conversation contexts. Click ID for details in Logs.</p>
        <div className="max-h-[500px] overflow-y-auto custom-scrollbar space-y-2">
            {geminiDvachConversations.size===0?(<p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No bot contexts.</p>):(Array.from(geminiDvachConversations.values()).sort((a,b)=>(b?.lastCheckedTimestamp||0)-(a?.lastCheckedTimestamp||0)).map(c=>(c&&c.id?(<details key={c.id} className="p-2.5 mb-2 border rounded-lg bg-gray-50 dark:bg-gray-700/60 border-gray-200 dark:border-gray-600 text-xs shadow-sm hover:shadow-md transition-shadow"><summary className="cursor-pointer font-medium text-gray-700 dark:text-gray-300 select-none">ID: <button onClick={()=>addLog("Bot Conv Details:",'info',c)} className="text-indigo-500 hover:underline truncate" title="Details in Logs">{c.id}</button><span className="ml-2 text-gray-500 dark:text-gray-400">(Sts:{c.status}|LastReply:&gt;&gt;{c.lastBotReplyNum||'N/A'}|Hist:{c.history?.length||0})</span></summary><div className="mt-2 space-y-1.5 pl-2 border-l-2 border-gray-300 dark:border-gray-500"><p><strong>Trigger/Seed:</strong><span className="font-semibold">&gt;&gt;{c.triggerPostNum}</span> on <span className="font-semibold">/{c.board}/{c.threadId}</span> {c.isBotSeedConversation?"(Bot Seed)":""}</p><p><strong>Last Checked:</strong>{new Date(c.lastCheckedTimestamp).toLocaleTimeString()}</p>{c.initialContext&&(<details className="mt-1 text-xs"><summary className="cursor-pointer text-gray-600 dark:text-gray-400 italic">Initial Context...</summary><div className="pl-3 pt-1 space-y-0.5">{c.initialContext.opPostText&&<p><strong>Initial Thread Ctx:</strong>"{c.initialContext.opPostText.substring(0,200)}..."</p>}{c.initialContext.opPostMediaParts&&c.initialContext.opPostMediaParts.length>0&&<p><strong>OP Media:</strong>{c.initialContext.opPostMediaParts.length} item(s).</p>}</div></details>)}{c.history&&c.history.length>0&&(<details className="mt-1 text-xs"><summary className="cursor-pointer text-gray-600 dark:text-gray-400 italic">Last {Math.min(5,c.history.length)} messages...</summary><div className="pl-3 pt-1 space-y-0.5 max-h-32 overflow-y-auto custom-scrollbar">{c.history.slice(-5).map((m,i)=>(<p key={i} className="truncate"><strong className="capitalize">{m.role}:</strong>{(m.parts[0]?.text||'[Non-text/Media]').substring(0,100)}...</p>))}</div></details>)}</div></details>):null)))}
        </div>
        <button onClick={()=>{setGeminiDvachConversations(new Map());addLog("Cleared all Bot Conversation Contexts.","bot_warning");}} className="mt-4 btn-danger flex items-center text-xs" disabled={geminiDvachConversations.size===0}><IconTrash className="mr-1.5 h-4 w-4"/>Clear Contexts</button>
      </div>
    </div>
  );

  const renderSettingsPanel = () => {
    const currentProcessEnvApiKey = process.env.API_KEY;
    return (
     <div className="space-y-6 p-4 md:p-6 bg-white dark:bg-gray-800 shadow-lg rounded-lg">
      <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-300 border-b pb-2 border-gray-300 dark:border-gray-700">Application Settings</h2>
      <details open className="p-3 border rounded-md border-gray-200 dark:border-gray-600">
        <summary className="text-lg font-medium text-gray-700 dark:text-gray-300 cursor-pointer select-none">Global Dvach Settings</summary>
        <div className="mt-3 space-y-3">
            <div><label htmlFor="settingsBoard" className="block text-sm font-medium">Default Board (Manual Ops):</label><input id="settingsBoard" type="text" value={settings.board} onChange={e=>handleUpdateSettings({board:e.target.value})} className="input-field mt-1"/></div>
            <div><label htmlFor="settingsThreadId" className="block text-sm font-medium">Default Thread ID (Manual Ops):</label><input id="settingsThreadId" type="text" value={settings.threadId} onChange={e=>handleUpdateSettings({threadId:e.target.value})} className="input-field mt-1"/></div>
            <div><label htmlFor="settingsPasscode" className="block text-sm font-medium">Purchased Passcode:</label><input id="settingsPasscode" type="password" value={settings.purchasedPasscode} onChange={e=>handleUpdateSettings({purchasedPasscode:e.target.value})} autoComplete="new-password" placeholder="Your Dvach Passcode" className="input-field mt-1"/></div>
            <div><label htmlFor="settingsUserAgent" className="block text-sm font-medium">User Agent:</label><input id="settingsUserAgent" type="text" value={settings.userAgent} onChange={e=>handleUpdateSettings({userAgent:e.target.value})} className="input-field mt-1"/><button onClick={()=>handleUpdateSettings({userAgent:generateUserAgent()})} className="btn-secondary text-xs mt-1">Generate New</button></div>
             <div className="mt-2"><label className="block text-sm font-medium text-gray-400 dark:text-gray-500">(Debug) File Upload:</label><input type="file" onChange={(e)=>handleFileUpload(e)} className="input-file-sm"/></div>
        </div>
      </details>
      <details className="p-3 border rounded-md border-gray-200 dark:border-gray-600">
        <summary className="text-lg font-medium text-gray-700 dark:text-gray-300 cursor-pointer select-none">CORS Proxy (Client GETs)</summary>
        <div className="mt-3 space-y-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">For client-side GET requests (e.g., images, or thread data if not serverless). Dvach POSTs use serverless functions.</p>
            <div><label htmlFor="settingsProxyModeForGET" className="block text-sm font-medium">Proxy for Thread Data:</label><select id="settingsProxyModeForGET" value={settings.proxyModeForGET} onChange={e=>handleUpdateSettings({proxyModeForGET:e.target.value as ProxyModeForGET})} className="input-field mt-1"><option value="vercel_serverless">Vercel Serverless (Recommended)</option><option value="custom_cors_anywhere">CORS Anywhere Style</option><option value="custom_go_x2u">go.x2u.in Style</option><option value="custom_codetabs">CodeTabs Style</option><option value="custom_general_prefix">General Prefix Proxy</option><option value="custom_general_param">General Param Proxy</option><option value="none">No Proxy</option></select>{settings.proxyModeForGET!=='vercel_serverless'&&settings.proxyModeForGET!=='none'&&(<input type="text" placeholder="Custom Proxy URL for Thread Data" value={settings.customProxyUrlForGET} onChange={e=>handleUpdateSettings({customProxyUrlForGET:e.target.value})} className="input-field mt-1"/>)}</div>
            <div><label htmlFor="settingsProxyModeForImagesGET" className="block text-sm font-medium">Proxy for Images/Media:</label><select id="settingsProxyModeForImagesGET" value={settings.proxyModeForImagesGET} onChange={e=>handleUpdateSettings({proxyModeForImagesGET:e.target.value as ProxyModeForGET})} className="input-field mt-1"><option value="custom_codetabs">CodeTabs Style (Default Images)</option><option value="custom_cors_anywhere">CORS Anywhere Style</option><option value="custom_go_x2u">go.x2u.in Style</option><option value="custom_general_prefix">General Prefix Proxy</option><option value="custom_general_param">General Param Proxy</option><option value="none">No Proxy</option></select>{settings.proxyModeForImagesGET!=='none'&&(<input type="text" placeholder="Custom Proxy URL for Images" value={settings.customProxyUrlForImagesGET} onChange={e=>handleUpdateSettings({customProxyUrlForImagesGET:e.target.value})} className="input-field mt-1"/>)}</div>
        </div>
      </details>
      <details open className="p-3 border rounded-md border-gray-200 dark:border-gray-600">
        <summary className="text-lg font-medium text-gray-700 dark:text-gray-300 cursor-pointer select-none">Gemini API & Model Settings</summary>
        <div className="mt-3 space-y-3">
            <div><label className="block text-sm font-medium">Gemini API Key Source:</label><select aria-label="Gemini API Key Source" value={settings.geminiApiKeySource} onChange={e=>handleUpdateSettings({geminiApiKeySource:e.target.value as 'env'|'user'})} className="input-field mt-1"><option value="env">Env API_KEY {currentProcessEnvApiKey?`(Detected: ${currentProcessEnvApiKey.substring(0,4)}...${currentProcessEnvApiKey.substring(currentProcessEnvApiKey.length-4)})`:"(Not Detected)"}</option><option value="user">Manual Input</option></select>{settings.geminiApiKeySource==='user'&&(<input aria-label="User Gemini API Key" type="password" placeholder="Gemini API Key" value={settings.userGeminiApiKey} onChange={e=>handleUpdateSettings({userGeminiApiKey:e.target.value})} autoComplete="new-password" className="input-field mt-1"/>)}</div>
            <div className="p-2 border-t border-gray-200 dark:border-gray-600"><p className="text-sm text-gray-600 dark:text-gray-400">Safety: {settings.geminiSafetySettings.map(s=>`${s.category.replace("HARM_CATEGORY_","")}:${s.threshold.replace("BLOCK_","")}`).join(', ')}. (UI for this WIP)</p></div>
            <label className="checkbox-label"><input type="checkbox" checked={settings.geminiAnalyzeOpMedia} onChange={e=>handleUpdateSettings({geminiAnalyzeOpMedia:e.target.checked})} className="checkbox-field"/>Gemini: Analyze Media in OP Posts (Manual Reply)</label>
            <label className="checkbox-label"><input type="checkbox" checked={settings.geminiAnalyzeAnonMedia} onChange={e=>handleUpdateSettings({geminiAnalyzeAnonMedia:e.target.checked})} className="checkbox-field"/>Gemini: Analyze Media in Anon Posts (Manual Reply)</label>
            <label className="checkbox-label"><input type="checkbox" checked={settings.geminiReplyWithGeneratedImage} onChange={e=>handleUpdateSettings({geminiReplyWithGeneratedImage:e.target.checked})} className="checkbox-field"/>Gemini: Generate image with replies (Manual & Bot)</label>
            <div><label htmlFor="maxImagesToAnalyzePerPost" className="block text-sm font-medium">Max Images to Analyze/Post:</label><input id="maxImagesToAnalyzePerPost" type="number" min="0" max="5" value={settings.maxImagesToAnalyzePerPost} onChange={e=>handleUpdateSettings({maxImagesToAnalyzePerPost:parseInt(e.target.value)})} className="input-field mt-1"/></div>
            <h4 className="text-md font-medium pt-2 text-gray-700 dark:text-gray-300">Gemini Model Config (Manual Replies)</h4>
            <div><label htmlFor="geminiSystemInstructionManual" className="block text-sm font-medium">System Instruction (Manual Replies):</label><textarea id="geminiSystemInstructionManual" value={settings.geminiSystemInstruction} onChange={e=>handleUpdateSettings({geminiSystemInstruction:e.target.value})} rows={3} style={codeEditorStyle} className="mt-1 w-full"/></div>
            <div className="grid grid-cols-2 gap-4">
                <div><label htmlFor="geminiTemp" className="text-sm">Temperature:</label><input id="geminiTemp" type="number" step="0.05" min="0" max="1" value={settings.geminiTemperature} onChange={e=>handleUpdateSettings({geminiTemperature:parseFloat(e.target.value)})} className="input-field-sm w-full"/></div>
                <div><label htmlFor="geminiTopP" className="text-sm">Top P:</label><input id="geminiTopP" type="number" step="0.05" min="0" max="1" value={settings.geminiTopP} onChange={e=>handleUpdateSettings({geminiTopP:parseFloat(e.target.value)})} className="input-field-sm w-full"/></div>
                <div><label htmlFor="geminiTopK" className="text-sm">Top K:</label><input id="geminiTopK" type="number" step="1" min="1" value={settings.geminiTopK} onChange={e=>handleUpdateSettings({geminiTopK:parseInt(e.target.value)})} className="input-field-sm w-full"/></div>
                <div><label htmlFor="geminiMaxOut" className="text-sm">Max Output Tokens:</label><input id="geminiMaxOut" type="number" step="64" min="64" value={settings.geminiMaxOutputTokens} onChange={e=>handleUpdateSettings({geminiMaxOutputTokens:parseInt(e.target.value)})} className="input-field-sm w-full"/></div>
            </div>
            <div><label htmlFor="geminiMime" className="block text-sm">Response MIME Type (Manual):</label><select id="geminiMime" value={settings.geminiResponseMimeType} onChange={e=>handleUpdateSettings({geminiResponseMimeType:e.target.value as 'text/plain'|'application/json'})} className="input-field mt-1 w-full"><option value="text/plain">text/plain</option><option value="application/json">application/json</option></select></div>
            <label className="checkbox-label"><input type="checkbox" checked={settings.useThinkingBudget} onChange={e=>handleUpdateSettings({useThinkingBudget:e.target.checked})} className="checkbox-field"/>Use Thinking Budget (Manual)</label>
            {settings.useThinkingBudget && <div><label htmlFor="geminiThinkBudget" className="text-sm">Thinking Budget (Manual, 0 to disable):</label><input id="geminiThinkBudget" type="number" step="1" min="0" value={settings.geminiThinkingBudget} onChange={e=>handleUpdateSettings({geminiThinkingBudget:parseInt(e.target.value)})} className="input-field-sm w-full"/></div>}
        </div>
      </details>
      <details open className="p-3 border rounded-md border-gray-200 dark:border-gray-600">
        <summary className="text-lg font-medium text-gray-700 dark:text-gray-300 cursor-pointer select-none">Autonomous Bot Settings</summary>
        <div className="mt-3 space-y-3">
            <div><label htmlFor="botSystemPrompt" className="block text-sm font-medium">Bot System Prompt (Persona & Style):</label><textarea id="botSystemPrompt" value={settings.autonomousBotSystemPrompt} onChange={e=>handleUpdateSettings({autonomousBotSystemPrompt:e.target.value})} rows={4} style={codeEditorStyle} className="mt-1 w-full"/></div>
            <label className="checkbox-label"><input type="checkbox" checked={settings.botAnalyzesImagesInTriggerPosts} onChange={e=>handleUpdateSettings({botAnalyzesImagesInTriggerPosts:e.target.checked})} className="checkbox-field"/>Bot: Analyze Images in Trigger Posts</label>
            <div><label htmlFor="botReplyMode" className="block text-sm">Bot Reply Mode:</label><select id="botReplyMode" value={settings.autonomousBotReplyMode} onChange={e=>handleUpdateSettings({autonomousBotReplyMode:e.target.value as AutonomousBotReplyMode})} className="input-field mt-1 w-full"><option value="random_in_thread">Random Post in Thread</option><option value="replies_to_bot">Replies to Bot's Own Posts (WIP)</option></select></div>
            <div><label htmlFor="botInterval" className="block text-sm font-medium">Bot Cycle Interval (seconds):</label><input id="botInterval" type="number" min="10" value={settings.autonomousBotCycleIntervalSeconds} onChange={e=>handleUpdateSettings({autonomousBotCycleIntervalSeconds:parseInt(e.target.value)})} className="input-field mt-1"/></div>
            <div className="grid grid-cols-2 gap-4"><div><label htmlFor="botMinReplyDelay" className="block text-sm font-medium">Min Reply Delay (ms):</label><input id="botMinReplyDelay" type="number" min="0" step="500" value={settings.autonomousBotMinReplyDelayMs} onChange={e=>handleUpdateSettings({autonomousBotMinReplyDelayMs:parseInt(e.target.value)})} className="input-field mt-1"/></div><div><label htmlFor="botMaxReplyDelay" className="block text-sm font-medium">Max Reply Delay (ms):</label><input id="botMaxReplyDelay" type="number" min="0" step="500" value={settings.autonomousBotMaxReplyDelayMs} onChange={e=>handleUpdateSettings({autonomousBotMaxReplyDelayMs:parseInt(e.target.value)})} className="input-field mt-1"/></div></div>
            <label className="checkbox-label"><input type="checkbox" checked={settings.autonomousBotDisableThinking} onChange={e=>handleUpdateSettings({autonomousBotDisableThinking:e.target.checked})} className="checkbox-field"/>Bot: Disable Thinking (speed/lower quality)</label>
            <label className="checkbox-label"><input type="checkbox" checked={settings.autonomousBotAllowReplyToSelf} onChange={e=>handleUpdateSettings({autonomousBotAllowReplyToSelf:e.target.checked})} className="checkbox-field"/>Bot: Allow Reply to Own Posts</label>
            <div><label htmlFor="botInitialContextScope" className="block text-sm">Bot: Initial Thread Context Scope:</label><select id="botInitialContextScope" value={settings.autonomousBotInitialContextScope} onChange={e=>handleUpdateSettings({autonomousBotInitialContextScope:e.target.value as AutonomousBotInitialContextScope})} className="input-field mt-1 w-full"><option value="op_only">OP Post Only</option><option value="full_thread">Full Thread Summary</option></select></div>
            {settings.autonomousBotInitialContextScope==='full_thread'&&(<div><label htmlFor="botFullContextChars" className="block text-sm font-medium">Bot: Full Thread Context Max Chars (0=unlimited):</label><input id="botFullContextChars" type="number" min="0" step="1000" value={settings.autonomousBotFullThreadContextMaxChars} onChange={e=>handleUpdateSettings({autonomousBotFullThreadContextMaxChars:parseInt(e.target.value)})} className="input-field mt-1"/></div>)}
        </div>
      </details>
      <p className="text-xs text-gray-500 dark:text-gray-400">Settings are saved automatically.</p>
    </div>
  )};

  const renderLogsPanel = () => (
    <div className="space-y-6 p-4 md:p-6 bg-white dark:bg-gray-800 shadow-lg rounded-lg">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-300 border-b pb-2 border-gray-300 dark:border-gray-700 flex-grow">Event Logs</h2>
        <button onClick={()=>setLogs([])} className="btn-danger text-xs flex items-center" title="Clear Logs" disabled={logs.length===0}><IconTrash className="mr-1 h-4 w-4"/>Clear Logs</button>
      </div>
      <div className="max-h-[600px] overflow-y-auto bg-gray-50 dark:bg-gray-900 p-3 rounded custom-scrollbar border border-gray-200 dark:border-gray-700">
        {logs.length===0 && <p className="text-center text-gray-500 dark:text-gray-400">No logs yet.</p>}
        {logs.map(log=>{const dataDisplay:string|null=(log.data!==undefined&&log.data!==null)?formatLogDataForDisplay(log.data):null;return(<div key={log.id} className={`text-xs p-1.5 mb-1 rounded border-l-4 ${log.type==='error'||log.type==='bot_error'?'log-error':log.type==='success'?'log-success':log.type==='warning'||log.type==='bot_warning'?'log-warning':log.type==='gemini'?'log-gemini':log.type==='dvach'?'log-dvach':log.type==='auth'?'log-auth':log.type==='bot_activity'||log.type==='bot_setup'?'log-bot': 'log-info'}`}><span className="font-medium">[{new Date(log.timestamp).toLocaleTimeString()}] [{log.type.toUpperCase()}]</span>: {log.message}{dataDisplay&&(<pre className="mt-1 text-xs whitespace-pre-wrap bg-gray-200 dark:bg-gray-600 p-1 rounded overflow-x-auto">{dataDisplay}</pre>)}</div>);})}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-300 font-sans">
      <header className="bg-white dark:bg-gray-800 shadow-md p-4 sticky top-0 z-50">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold text-blue-600 dark:text-blue-400">Dvach Gemini Bot</h1>
          <div className="flex items-center space-x-4">
            {settings.userAgent && <span className="text-xs text-gray-500 dark:text-gray-400 hidden md:block truncate max-w-xs" title={settings.userAgent}>UA: {settings.userAgent.substring(0,40)}...</span>}
            <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors" aria-label={`Toggle theme (current: ${settings.theme})`} title={`Change theme. Current: ${settings.theme}.`}>
              <ThemeIconComponent className="h-6 w-6" />
            </button>
          </div>
        </div>
      </header>
      <nav className="bg-gray-50 dark:bg-gray-800 border-b border-t border-gray-200 dark:border-gray-700 sticky top-[72px] z-40"> {/* Assuming header height is approx 72px */}
        <div className="container mx-auto flex justify-center sm:justify-start flex-wrap">
          {[
            { id: 'dvach', label: 'Manual Ops', icon: IconCpu },
            { id: 'bot_control', label: 'Autonomous Bot', icon: IconMessageChat },
            { id: 'settings', label: 'Settings', icon: IconSettings },
            { id: 'logs', label: 'Logs', icon: IconTerminal },
          ].map((tabLink) => (
            <button key={tabLink.id} onClick={() => setActiveTab(tabLink.id as 'dvach' | 'bot_control' | 'settings' | 'logs')} aria-current={activeTab === tabLink.id ? "page" : undefined} className={`nav-tab-button ${activeTab === tabLink.id ? 'nav-tab-active' : 'nav-tab-inactive'}`}>
              <tabLink.icon aria-hidden="true" className="h-5 w-5 mr-1 sm:mr-1.5 flex-shrink-0" />
              <span className="truncate">{tabLink.label}</span>
            </button>
          ))}
        </div>
      </nav>
      <main className="container mx-auto p-4 md:p-6" role="main">
        <div className="mt-2">
            {activeTab === 'dvach' && renderDvachBotPanel()}
            {activeTab === 'bot_control' && renderAutonomousBotControlPanel()}
            {activeTab === 'settings' && renderSettingsPanel()}
            {activeTab === 'logs' && renderLogsPanel()}
        </div>
      </main>
      <footer className="text-center py-4 border-t border-gray-200 dark:border-gray-700 mt-8">
        <p className="text-xs text-gray-500 dark:text-gray-400">Dvach Gemini Bot Interface - Version {APP_VERSION} - Use responsibly.</p>
      </footer>
    </div>
  );
};

export default App;
