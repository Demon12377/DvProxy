
/// <reference types="vite/client" />
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleGenAI, Part, Chat } from "@google/genai"; 
import {
  AppSettings, LogEntry, DvachPost, SentMessageInfo, ChatMessage, ProxyModeForGET,
  DvachThreadResponse, 
  DvachFile, GeminiDvachConversation,
  DvachSessionCookies, AutonomousBotReplyMode
} from './types'; 
import { getThreadData, loginToDvach, postWithSessionCookie, base64ToFile, extractDvachApiError } from './services/dvachService';
import { 
  APP_SETTINGS_KEY, SENT_MESSAGES_KEY, APP_VERSION,
  GEMINI_TEXT_MODEL, GEMINI_IMAGE_MODEL, MAX_LOG_ENTRIES, MAX_SENT_MESSAGES_STORED,
  GEMINI_DVACH_CONVERSATIONS_KEY, DVACH_SESSION_COOKIES_KEY,
  PROXY_URL_GO_X2U_BASE, DEFAULT_CORS_ANYWHERE_PROXY, DVACH_DOMAINS, DEFAULT_USER_AGENT,
  DEFAULT_MAX_IMAGES_TO_ANALYZE_PER_POST
} from './constants';
import { generateUserAgent } from './utils/userAgentGenerator'; 

import {
  IconSettings, IconTerminal, IconSend, IconTrash, IconCpu, 
  IconSparkles, IconAlertTriangle, IconRefresh, 
  IconLogin, IconLogout, IconUserCircle, IconPlayerPlay, IconPlayerStop, IconMessageChat,
  IconSun, IconMoon // Keep IconSun and IconMoon for the new ThemeIcon component
} from './components/Icons'; 

const processEnvApiKey = import.meta.env.VITE_GEMINI_API_KEY || "";

const DEFAULT_APP_SETTINGS: AppSettings = {
  board: "b",
  threadId: "",
  purchasedPasscode: "7Iey09PSeH8R4CtxmMRyAVM79HAkZoUhH3wdZEG3wZVZ6IxpRlIPEi4785B7Vfdf", 
  geminiApiKeySource: processEnvApiKey ? 'env' : 'user',
  userGeminiApiKey: "", 
  theme: 'system',
  
  proxyModeForGET: 'vercel_serverless', 
  customProxyUrlForGET: "", 
  
  proxyModeForImagesGET: 'custom_cors_anywhere', // Default to cors-anywhere for images
  customProxyUrlForImagesGET: DEFAULT_CORS_ANYWHERE_PROXY,    // Default to cors-anywhere for images

  userAgent: DEFAULT_USER_AGENT,

  geminiAnalyzeOpMedia: true,
  geminiAnalyzeAnonMedia: false,
  geminiReplyWithGeneratedImage: false, 
  maxImagesToAnalyzePerPost: DEFAULT_MAX_IMAGES_TO_ANALYZE_PER_POST,
  analyzeVideosInTriggerPosts: false, // Video analysis not yet implemented
  
  // Autonomous Bot specific settings
  autonomousBotTargetBoard: "b",
  autonomousBotTargetThreadId: "",
  autonomousBotSystemPrompt: "Ты — остроумный и проницательный анонимный пользователь популярного имиджборда (например, Двач). Твои ответы должны быть релевантными, краткими и соответствовать типичному стилю общения на таких сайтах. **Ты ОБЯЗАН отвечать на РУССКОМ языке.** Если цитируешь пост, используй формат '>>НОМЕР_ПОСТА\\n'. Твои ответы должны быть короткими и вовлекающими. Не используй английский язык в своих ответах, если только он не является частью цитаты из оригинального поста. Учитывай контекст треда и изображения в постах, если они есть и тебе дана инструкция их анализировать.",
  botAnalyzesImagesInTriggerPosts: true,
  autonomousBotReplyMode: 'random_in_thread', 
  autonomousBotCycleIntervalSeconds: 75, 


  geminiSystemInstruction: "You are a witty and insightful anonymous user on the 2ch.hk imageboard. Your replies should be relevant, concise, and in the typical style of the board. If quoting, use '>>POST_NUMBER\\n'.", // For manual replies
  geminiTemperature: 0.8,
  geminiTopP: 0.95,
  geminiTopK: 40,
  geminiMaxOutputTokens: 1024,
  geminiResponseMimeType: "text/plain", 
  useSearchGrounding: false, 
  useThinkingBudget: true, 
  geminiThinkingBudget: 0, 

  enableRepetitivePostingMode: false,
  repetitivePostMessage: "Test post.",
  repetitivePostCount: 3,
  repetitivePostDelay: 5,
  enablePrefilledPostingMode: false,
  prefilledPostMessages: "Message 1\nMessage 2 >>TARGET_POST_NUM",
  prefilledPostTargets: "", 
};

// Simplified buildProxiedUrl, primarily for thread data when using vercel_serverless for threads
// or as a general helper for other proxy modes if a specific media proxy isn't used.
function buildProxiedGetUrlForApp(
  targetUrl: string, 
  proxyMode: ProxyModeForGET, // Typically settings.proxyModeForGET for thread data
  customProxyUrl?: string   // Typically settings.customProxyUrlForGET for thread data
): string {
  if (!targetUrl.startsWith('http')) { 
    // This might be an internal API path like /api/get-thread, which doesn't need proxying here.
    // Or it's an incomplete URL.
    if (!targetUrl.startsWith('/api/')) { // only warn if not an api path
        console.warn(`[App/buildProxiedGetUrlForApp] targetUrl '${targetUrl}' is not a full HTTP/S URL. Returning as is.`);
    }
    return targetUrl;
  }
  
  // If mode is vercel_serverless, this function should ideally not be called for external URLs.
  // /api/get-thread is handled by dvachService which forms its own path.
  // This check is more for if it *is* called with vercel_serverless for an external URL.
  if (proxyMode === 'vercel_serverless') {
      // If vercel_serverless is the mode for thread data, but this function is somehow called for an external image,
      // it means the image proxy logic should have handled it. Fallback to direct or custom if provided.
      console.warn(`[App/buildProxiedGetUrlForApp] 'vercel_serverless' proxy mode was passed for external URL '${targetUrl}'. This mode is for internal /api/get-thread. Trying custom URL if provided, or direct fetch.`);
      if (customProxyUrl) { // Attempt to use the general custom proxy if available in this odd case
        if (customProxyUrl.startsWith(PROXY_URL_GO_X2U_BASE.split('?')[0])) return `${customProxyUrl}${encodeURIComponent(targetUrl)}`;
        if (customProxyUrl.includes(DEFAULT_CORS_ANYWHERE_PROXY.split('/')[2])) return customProxyUrl.endsWith('/') ? `${customProxyUrl}${targetUrl}` : `${customProxyUrl}/${targetUrl}`;
        if (customProxyUrl.endsWith('=')) return `${customProxyUrl}${encodeURIComponent(targetUrl)}`; 
        return customProxyUrl.endsWith('/') ? `${customProxyUrl}${targetUrl}` : `${customProxyUrl}/${targetUrl}`; 
      }
      return targetUrl; // Fallback to direct (likely CORS fail)
  }

  // Logic for other proxy modes (custom_go_x2u, custom_cors_anywhere, etc.)
  switch (proxyMode) {
    case 'custom_go_x2u':
      const goX2UBase = (customProxyUrl || PROXY_URL_GO_X2U_BASE);
      return `${goX2UBase}${encodeURIComponent(targetUrl)}`;
    case 'custom_cors_anywhere':
      const corsBase = (customProxyUrl || DEFAULT_CORS_ANYWHERE_PROXY).endsWith('/') ? (customProxyUrl || DEFAULT_CORS_ANYWHERE_PROXY) : `${(customProxyUrl || DEFAULT_CORS_ANYWHERE_PROXY)}/`;
      return `${corsBase}${targetUrl}`;
    case 'custom_general_prefix':
      if (!customProxyUrl) return targetUrl;
      return customProxyUrl.endsWith('/') ? `${customProxyUrl}${targetUrl}` : `${customProxyUrl}/${targetUrl}`;
    case 'custom_general_param':
      if (!customProxyUrl || !customProxyUrl.includes('=')) {
        console.warn(`[App/buildProxiedGetUrlForApp] Custom general param proxy mode, but URL '${customProxyUrl}' is invalid. Using direct.`);
        return targetUrl;
      }
      return `${customProxyUrl}${encodeURIComponent(targetUrl)}`;
    case 'none':
    default:
      return targetUrl;
  }
}


const formatLogDataForDisplay = (data: unknown): string => {
  if (typeof data === 'string') return data;
  if (data === null || data === undefined) return "";
  try {
    if (data instanceof Error) {
        return `Error: ${data.message}\nStack: ${data.stack}`;
    }
    const replacer = (_key: string, value: any) =>
      typeof value === 'bigint' ? value.toString() : value;
    
    if (typeof data === 'object' && data !== null) {
        // For GeminiDvachConversation, print only key fields to avoid logging huge histories or chat instances
        if ('botSystemPromptUsed' in data && 'triggerPostNum' in data && 'id' in data) {
            const convo = data as GeminiDvachConversation;
            return `GeminiDvachConversation (ID: ${convo.id}, Trigger: >>${convo.triggerPostNum}, Status: ${convo.status}, LastBotReply: >>${convo.lastBotReplyNum || 'N/A'}, Hist: ${convo.history?.length || 0})`;
        }
        if (Object.keys(data).length > 10 || JSON.stringify(data, replacer).length > 500) {
            return `Object with keys: ${Object.keys(data).join(', ')} (Data too large for inline log, check console)`;
        }
    }
    return JSON.stringify(data, replacer, 2);
  } catch (e) {
    console.warn("JSON.stringify failed in formatLogDataForDisplay, falling back to String()", e, data);
    if (typeof data === 'object' && data !== null && typeof (data as any).toString === 'function') {
      const strRepresentation = (data as any).toString();
      if (strRepresentation !== '[object Object]' || Object.keys(data).length === 0) {
        return strRepresentation;
      }
    }
    if (typeof data === 'object' && data !== null) {
      return `Object (type: ${Object.prototype.toString.call(data)}) with keys: ${Object.keys(data).join(', ')}`;
    }
    return String(data);
  }
};

const App: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(() => {
    const savedSettings = localStorage.getItem(APP_SETTINGS_KEY);
    const initialSettings = savedSettings ? JSON.parse(savedSettings) : {};
    const mergedSettings: AppSettings = { 
        ...DEFAULT_APP_SETTINGS, 
        ...initialSettings,
        proxyModeForGET: initialSettings.proxyModeForGET || DEFAULT_APP_SETTINGS.proxyModeForGET,
        customProxyUrlForGET: initialSettings.customProxyUrlForGET || DEFAULT_APP_SETTINGS.customProxyUrlForGET,
        proxyModeForImagesGET: initialSettings.proxyModeForImagesGET || DEFAULT_APP_SETTINGS.proxyModeForImagesGET,
        customProxyUrlForImagesGET: initialSettings.customProxyUrlForImagesGET || DEFAULT_APP_SETTINGS.customProxyUrlForImagesGET,
        maxImagesToAnalyzePerPost: initialSettings.maxImagesToAnalyzePerPost === undefined ? DEFAULT_APP_SETTINGS.maxImagesToAnalyzePerPost : Number(initialSettings.maxImagesToAnalyzePerPost),
        analyzeVideosInTriggerPosts: initialSettings.analyzeVideosInTriggerPosts === undefined ? DEFAULT_APP_SETTINGS.analyzeVideosInTriggerPosts : initialSettings.analyzeVideosInTriggerPosts,
        userAgent: initialSettings.userAgent || generateUserAgent(),
        purchasedPasscode: initialSettings.purchasedPasscode || DEFAULT_APP_SETTINGS.purchasedPasscode,
        autonomousBotTargetBoard: initialSettings.autonomousBotTargetBoard || DEFAULT_APP_SETTINGS.autonomousBotTargetBoard,
        autonomousBotTargetThreadId: initialSettings.autonomousBotTargetThreadId || DEFAULT_APP_SETTINGS.autonomousBotTargetThreadId,
        autonomousBotSystemPrompt: initialSettings.autonomousBotSystemPrompt || DEFAULT_APP_SETTINGS.autonomousBotSystemPrompt,
        botAnalyzesImagesInTriggerPosts: initialSettings.botAnalyzesImagesInTriggerPosts === undefined ? DEFAULT_APP_SETTINGS.botAnalyzesImagesInTriggerPosts : initialSettings.botAnalyzesImagesInTriggerPosts,
        geminiSystemInstruction: initialSettings.geminiSystemInstruction || DEFAULT_APP_SETTINGS.geminiSystemInstruction,
        autonomousBotReplyMode: initialSettings.autonomousBotReplyMode || DEFAULT_APP_SETTINGS.autonomousBotReplyMode,
        autonomousBotCycleIntervalSeconds: initialSettings.autonomousBotCycleIntervalSeconds || DEFAULT_APP_SETTINGS.autonomousBotCycleIntervalSeconds,
        geminiReplyWithGeneratedImage: initialSettings.geminiReplyWithGeneratedImage === undefined ? DEFAULT_APP_SETTINGS.geminiReplyWithGeneratedImage : initialSettings.geminiReplyWithGeneratedImage,
    };
    delete (mergedSettings as any).autonomousBotPersonalityPreset;
    if (processEnvApiKey && mergedSettings.geminiApiKeySource === 'env' && !initialSettings.userGeminiApiKey) {} 
    else if (!processEnvApiKey && mergedSettings.geminiApiKeySource === 'env') {
      mergedSettings.geminiApiKeySource = 'user'; 
    }
    return mergedSettings;
  });

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [ai, setAi] = useState<GoogleGenAI | null>(null);
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
  
  const [autonomousBotActive, setAutonomousBotActive] = useState<boolean>(false);
  const [autonomousBotStatus, setAutonomousBotStatus] = useState<string>("Inactive");
  const [autonomousBotActivityLog, setAutonomousBotActivityLog] = useState<string[]>([]);
  const [geminiDvachConversations, setGeminiDvachConversations] = useState<Map<string, GeminiDvachConversation>>(() => {
    const saved = localStorage.getItem(GEMINI_DVACH_CONVERSATIONS_KEY);
    if (saved) {
        try {
            const entries: [string, Omit<GeminiDvachConversation, 'geminiChatInstance'> & { history: ChatMessage[] }][] = JSON.parse(saved);
            return new Map(entries.map(([key, convoData]) => {
                return [key, { ...convoData, geminiChatInstance: undefined } as GeminiDvachConversation]; 
            }));
        } catch (e) {
            console.error("Failed to parse Gemini Dvach Conversations from localStorage", e);
            localStorage.removeItem(GEMINI_DVACH_CONVERSATIONS_KEY); 
            return new Map();
        }
    }
    return new Map();
  });
  const autonomousBotIntervalRef = useRef<number | null>(null);


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
        const { geminiChatInstance, ...restOfConvo } = convo; 
        return [key, { ...restOfConvo, history: convo.history }]; 
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
    const keyToUse = settings.geminiApiKeySource === 'env' ? processEnvApiKey : settings.userGeminiApiKey;
    if (keyToUse) {
      try {
        const genAI = new GoogleGenAI({ apiKey: keyToUse });
        setAi(genAI);
        const prevApiKey = (ai as any)?._apiKey; 
        if (!prevApiKey || prevApiKey !== keyToUse) {
            addLog('Gemini API initialized successfully.', 'success');
        }
      } catch (error) {
        addLog(`Failed to initialize Gemini API: ${(error as Error).message}. Check API Key format/validity.`, 'error', error);
        setAi(null);
      }
    } else {
      setAi(null);
      if (activeTab === 'bot_control' || activeTab === 'dvach') { 
        if (settings.geminiApiKeySource === 'user' && !settings.userGeminiApiKey) addLog('Gemini API key (Manual) is not set.', 'warning');
        else if (settings.geminiApiKeySource === 'env' && !processEnvApiKey) addLog('Gemini API key (VITE_GEMINI_API_KEY) not detected or accessible.', 'warning');
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.geminiApiKeySource, settings.userGeminiApiKey, processEnvApiKey, addLog]);

  const handleUpdateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };
  
  useEffect(() => {
    if(activeTab === 'dvach') {
        setCurrentBoard(settings.board);
        setCurrentThreadId(settings.threadId);
    }
  }, [settings.board, settings.threadId, activeTab]);


  const handleLoadThread = async (isBotCycle: boolean = false): Promise<DvachPost[] | null> => {
    const boardToFetch = isBotCycle ? settings.autonomousBotTargetBoard : currentBoard;
    const threadToFetch = isBotCycle ? settings.autonomousBotTargetThreadId : currentThreadId;

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
      // getThreadData uses settings.proxyModeForGET and settings.customProxyUrlForGET internally
      const data: DvachThreadResponse = await getThreadData(boardToFetch, threadToFetch, settings.proxyModeForGET, settings.customProxyUrlForGET, settings.userAgent);
      
      const posts = data.threads?.[0]?.posts || [];
      if(!isBotCycle) {
        setCurrentFetchedDvachPosts(posts); 
        addLog(`Successfully fetched ${posts.length} posts from /${boardToFetch}/${threadToFetch}.`, 'success');
        if (threadPostsContainerRef.current) threadPostsContainerRef.current.scrollTop = 0;
        // Update general settings if manual fetch was successful, so user doesn't have to re-type
        if (!isBotCycle && (settings.board !== boardToFetch || settings.threadId !== threadToFetch)) {
            handleUpdateSettings({ board: boardToFetch, threadId: threadToFetch });
        }
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
    boardToPost: string,
    threadIdForDvachApi: string, 
    replyToPostNumForDvachApi?: string  
  ): Promise<string> => { 
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

    setIsPosting(true); 
    setFetchError(null);
    const targetDesc = threadIdForDvachApi === "0" ? 'new thread' : `thread ${threadIdForDvachApi}`;
    const logMsg = `Attempting to post to /${boardToPost}/${targetDesc}${replyToPostNumForDvachApi ? ` (reply to >>${replyToPostNumForDvachApi})` : ''}. Comment: "${comment.substring(0,50)}..."`;
    addLog(logMsg, 'dvach');
    if (activeTab === 'dvach') addPostActivity(logMsg);

    try {
      const result = await postWithSessionCookie(
        dvachSessionCookies,
        boardToPost,
        threadIdForDvachApi, 
        comment,
        file,
        replyToPostNumForDvachApi, 
        useSageFlag,
        settings.userAgent
      );
      
      const newPostNum = String(result.num || result.thread || result.target || Date.now()); 
      addLog(`Post successful! Dvach response: Num: ${newPostNum}`, 'success', result);
      if (activeTab === 'dvach') addPostActivity(`Success! Post Num: ${newPostNum}.`);
      
      const newSentMessage: SentMessageInfo = {
        num: newPostNum,
        timestamp: Date.now(),
        comment: comment,
        board: boardToPost,
        thread: threadIdForDvachApi === "0" ? newPostNum : threadIdForDvachApi, 
        parent: replyToPostNumForDvachApi || (threadIdForDvachApi === "0" ? undefined : threadIdForDvachApi), 
        file_info: file ? { name: file.name, size: file.size } : undefined,
      };
      setSentMessages(prev => [newSentMessage, ...prev]);
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
      // For manual post, threadId '0' means new thread.
      const threadTargetForDvach = currentThreadId && currentThreadId !== "0" ? currentThreadId : "0";
      await commonPostToDvach(postText, postFile, postUseSage, currentBoard, threadTargetForDvach, undefined);
      setPostText('');
      setPostFile(null);
    } catch (e) { /* error already logged */ }
  };
  
  const handleManualGeminiReplyToDvachPost = async (targetPost: DvachPost) => {
    if (!ai) { addLog('Gemini AI not initialized.', 'error'); return; }
    if (!dvachSessionCookies?.passcode_auth) { 
        addLog('Not logged into Dvach. Please login before replying with Gemini.', 'error'); 
        setFetchError('Not logged into Dvach. Please login before replying with Gemini.');
        return; 
    }
    if (!currentBoard || !currentThreadId) { addLog('Current board or thread ID not set for manual reply.', 'error'); return; }

    setGeminiLoading(true);
    addLog(`Gemini preparing manual reply to post >>${targetPost.num} on /${currentBoard}/${currentThreadId}...`, 'gemini');
    
    let systemInstructionForReply = settings.geminiSystemInstruction || DEFAULT_APP_SETTINGS.geminiSystemInstruction;
    if (!systemInstructionForReply.includes(">>POST_NUMBER\\n")) { 
        systemInstructionForReply += " If quoting, use '>>POST_NUMBER\\n'.";
    }
    systemInstructionForReply = systemInstructionForReply.replace("POST_NUMBER", targetPost.num);
    
    let threadContextSummary = "No additional thread context available from viewer.";
    if (currentFetchedDvachPosts.length > 0) {
        const opPost = currentFetchedDvachPosts.find(p => p.num === currentThreadId || p.op === 1);
        const recentPosts = currentFetchedDvachPosts.slice(-5); 
        threadContextSummary = `Thread OP (>>${opPost?.num || currentThreadId}): "${(opPost?.comment || "N/A").replace(/<[^>]*>?/gm, '').substring(0,100)}..."\n`;
        threadContextSummary += `Recent posts in viewer include:\n` + recentPosts.map(p => `>>${p.num}: "${p.comment.replace(/<[^>]*>?/gm, '').substring(0,70)}..."`).join('\n');
    }

    let userPromptText = `Imageboard: ${DVACH_DOMAINS[0]}/${currentBoard}/${currentThreadId}\nOverall thread context (from viewer):\n${threadContextSummary}\n\nNow, focus on this specific post:\nPost >>${targetPost.num} (by ${targetPost.name || 'Anonymous'}) says:\n"${targetPost.comment.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>?/gm, '').substring(0, 1000)}"`;
    
    const geminiMessageParts: Part[] = [];
    let imageFilesToAnalyze: DvachFile[] = [];

    if (targetPost.files && targetPost.files.length > 0) {
        const analysisEnabled = (settings.geminiAnalyzeOpMedia && targetPost.op === 1) || 
                                (settings.geminiAnalyzeAnonMedia && targetPost.op !== 1);
        if (analysisEnabled) {
            imageFilesToAnalyze = targetPost.files
                .filter(file => file.type === 1 || file.type === 2 || file.type === 4 || file.type === 9) // jpg, png, gif, webp (image types)
                .slice(0, settings.maxImagesToAnalyzePerPost);
        }
    }

    if (imageFilesToAnalyze.length > 0) {
        userPromptText += `\n\nThe post >>${targetPost.num} includes ${imageFilesToAnalyze.length} image(s) (e.g., "${imageFilesToAnalyze[0].name}"). Please analyze these images as part of your reply generation.`;
        for (const dvachImageFile of imageFilesToAnalyze) {
            try {
                const imageUrl = `${DVACH_DOMAINS[0]}${dvachImageFile.path}`; 
                const proxiedImageUrl = buildProxiedGetUrlForApp(imageUrl, settings.proxyModeForImagesGET, settings.customProxyUrlForImagesGET);
                addLog(`Fetching image ${dvachImageFile.name} for Gemini analysis (manual reply) from ${proxiedImageUrl} (target: ${imageUrl})`, 'gemini');

                const imageResponse = await fetch(proxiedImageUrl);
                if (!imageResponse.ok) throw new Error(`Failed to fetch image: ${imageResponse.status} ${imageResponse.statusText} from ${proxiedImageUrl}`);
                const imageBlob = await imageResponse.blob();
                
                let mimeType = dvachImageFile.type === 1 ? 'image/jpeg' : 
                               dvachImageFile.type === 2 ? 'image/png' : 
                               dvachImageFile.type === 4 ? 'image/gif' : 
                               dvachImageFile.type === 9 ? 'image/webp' : // webp
                               imageBlob.type; 
                if (!mimeType.startsWith('image/')) mimeType = 'image/jpeg'; 

                const base64data = await new Promise<string>((resolveP, rejectP) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolveP((reader.result as string).split(',')[1]);
                    reader.onerror = rejectP;
                    reader.readAsDataURL(imageBlob);
                });
                geminiMessageParts.push({ inlineData: { mimeType: mimeType, data: base64data } });
                addLog(`Image "${dvachImageFile.name}" successfully prepared for Gemini (manual reply).`, 'gemini');
            } catch (imgError) {
                addLog(`Failed to fetch/process image "${dvachImageFile.name}" for Gemini (manual reply): ${(imgError as Error).message}.`, 'warning', imgError);
                userPromptText += ` (Note: Analysis of image ${dvachImageFile.name} failed. Rely on text description if available).`;
            }
        }
    }
    geminiMessageParts.push({ text: userPromptText + `\n\nGenerate your reply to >>${targetPost.num}.` });
    
    let geminiReplyText = "";
    try {
      const response = await ai.models.generateContent({
        model: GEMINI_TEXT_MODEL,
        contents: [{ role: 'user', parts: geminiMessageParts }],
        config: { 
          systemInstruction: systemInstructionForReply,
          temperature: settings.geminiTemperature, topP: settings.geminiTopP, 
          topK: settings.geminiTopK, maxOutputTokens: settings.geminiMaxOutputTokens,
          ...(settings.useThinkingBudget && { thinkingConfig: { thinkingBudget: settings.geminiThinkingBudget }})
        }
      });
      geminiReplyText = response.text || ""; 
      if (!geminiReplyText.trim().startsWith(`>>${targetPost.num}`)) { 
          geminiReplyText = `>>${targetPost.num}\n${geminiReplyText.trim()}`;
      }
      addLog(`Gemini generated text for manual reply to >>${targetPost.num}: ${geminiReplyText.substring(0, 100)}...`, 'gemini');

      let finalFileToPost: File | null = null;
      if (settings.geminiReplyWithGeneratedImage) {
        addLog(`Gemini generating image for manual reply to >>${targetPost.num}...`, 'gemini');
        const imagePpt = `Imageboard reply context: "${geminiReplyText.substring(geminiReplyText.indexOf('\n') + 1, 200).trim()}". Style: relevant, meme-like, or abstract.`;
        try {
            const imgGenResp = await ai.models.generateImages({ 
              model: GEMINI_IMAGE_MODEL, 
              prompt: imagePpt, 
              config: { numberOfImages: 1, outputMimeType: 'image/jpeg' } 
            });
            if (imgGenResp.generatedImages?.[0]?.image?.imageBytes) {
              finalFileToPost = await base64ToFile(imgGenResp.generatedImages[0].image.imageBytes, `gemini_img_${Date.now()}.jpg`, imgGenResp.generatedImages[0].image.mimeType || 'image/jpeg');
              addLog(`Gemini generated image for manual reply to >>${targetPost.num}.`, 'gemini');
            } else { addLog(`Gemini image generation failed or no image returned for manual reply to >>${targetPost.num}. Response: ${JSON.stringify(imgGenResp)}`, 'warning'); }
        } catch (imgGenError) {
            const errorMsg = (imgGenError as Error).message;
            if (errorMsg.includes("Imagen API is only accessible to billed users")) {
                addLog(`Imagen API access error for manual reply: Google indicates this is typically available only for billed accounts. Please check your Google Cloud project settings. Proceeding with text-only reply.`, 'warning', imgGenError);
            } else {
                addLog(`Gemini image generation failed for manual reply: ${errorMsg}. Posting text only.`, 'warning', imgGenError);
            }
        }
      }
      // currentThreadId here is the OP post number of the thread the targetPost belongs to.
      const newPostNumByGemini = await commonPostToDvach(geminiReplyText, finalFileToPost, postUseSage, currentBoard, currentThreadId, targetPost.num);
      
      setSentMessages(prev => prev.map(msg => 
        msg.num === newPostNumByGemini && msg.board === currentBoard && msg.thread === currentThreadId ? 
        { ...msg, isGeminiPost: true, geminiTriggerPostNum: targetPost.num, geminiGeneratedImage: !!finalFileToPost } : msg 
      ));
      addLog(`Manual Gemini reply posted as >>${newPostNumByGemini} to /${currentBoard}/${currentThreadId}.`, 'success');

    } catch (error) {
      if (! (error as Error).message.toLowerCase().includes("post failed")) { 
         addLog(`Error during manual Gemini reply generation or processing for >>${targetPost.num}: ${(error as Error).message}`, 'error', error);
      }
    } finally {
      setGeminiLoading(false);
    }
  };

  useEffect(() => {
    if (!autonomousBotActive || !ai || !dvachSessionCookies?.passcode_auth || !settings.autonomousBotTargetBoard || !settings.autonomousBotTargetThreadId) {
      if (autonomousBotIntervalRef.current) {
        clearInterval(autonomousBotIntervalRef.current);
        autonomousBotIntervalRef.current = null;
        setAutonomousBotStatus("Inactive - Stopped or Missing Config/Login/API Key");
        addLog("Autonomous bot stopped or prerequisites not met.", "bot_setup");
      }
      return;
    }
    
    const runBotCycle = async () => {
      if (!autonomousBotActive || !ai || !dvachSessionCookies?.passcode_auth) { 
          setAutonomousBotActive(false); 
          addAutonomousBotActivityLog("Бот остановлен: отсутствует критическое условие (AI, Логин или Бот не активен).", 'bot_error');
          return;
      }
      setAutonomousBotStatus(`Мониторинг /${settings.autonomousBotTargetBoard}/${settings.autonomousBotTargetThreadId}...`); 
      
      try {
        const latestPostsInThread = await handleLoadThread(true); 
        if (!latestPostsInThread || latestPostsInThread.length === 0) {
          addAutonomousBotActivityLog("Посты не найдены или ошибка при загрузке треда для цикла бота.", 'bot_warning');
          setAutonomousBotStatus("Ошибка загрузки данных треда для бота.");
          return;
        }
        
        let botMadeAPostThisCycle = false;
        const newConversationsMap = new Map(geminiDvachConversations); 

        if (settings.autonomousBotReplyMode === 'random_in_thread') {
            const eligiblePosts = latestPostsInThread.filter(p => {
                const isByBot = sentMessages.some(sm => sm.num === p.num && sm.isGeminiPost && sm.board === settings.autonomousBotTargetBoard && sm.thread === settings.autonomousBotTargetThreadId);
                const alreadyInActiveConvo = Array.from(newConversationsMap.values()).some(convo => convo.participatingPostNumbers.includes(p.num) || convo.triggerPostNum === p.num);
                return !isByBot && !alreadyInActiveConvo;
            });

            if (eligiblePosts.length > 0) {
                const randomPostToReply = eligiblePosts[Math.floor(Math.random() * eligiblePosts.length)];
                addAutonomousBotActivityLog(`Бот выбрал случайный пост >>${randomPostToReply.num} для ответа.`);
                
                const convoId = `${settings.autonomousBotTargetBoard}-${settings.autonomousBotTargetThreadId}-trigger-${randomPostToReply.num}`;
                if (newConversationsMap.has(convoId)) { 
                    addAutonomousBotActivityLog(`Разговор с >>${randomPostToReply.num} уже существует, пропускаем для случайного ответа.`, 'bot_warning');
                } else {
                    setAutonomousBotStatus(`Подготовка ответа на случайный пост >>${randomPostToReply.num}`);
                                        
                    let contextPrompt = `Контекст треда на имиджборде ${DVACH_DOMAINS[0]}/${settings.autonomousBotTargetBoard}/${settings.autonomousBotTargetThreadId}:\n`;
                    const opPost = latestPostsInThread.find(p => p.num === settings.autonomousBotTargetThreadId || p.op === 1);
                    if (opPost) {
                        contextPrompt += `Пост ОПа (>>${opPost.num}): "${(opPost.comment || "N/A").replace(/<[^>]*>?/gm, '').substring(0,250)}..."\n`;
                    }
                    const postsBeforeTarget = latestPostsInThread.filter(p => 
                        Number(p.timestamp) < Number(randomPostToReply.timestamp) && p.num !== randomPostToReply.num
                    ).slice(-3);
                    if (postsBeforeTarget.length > 0) {
                        contextPrompt += `Несколько предыдущих постов:\n` + 
                        postsBeforeTarget.map(p => `>>${p.num}: "${p.comment.replace(/<[^>]*>?/gm, '').substring(0,150)}..."`).join('\n') + "\n";
                    }
                    contextPrompt += `\nЦелевой пост для твоего ответа:\nПост >>${randomPostToReply.num} (от ${randomPostToReply.name || 'Аноним'}) содержит:\n"${randomPostToReply.comment.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>?/gm, '').substring(0, 1500)}"`;

                    const initialUserMessageParts: Part[] = [];
                    let initialContextForStorage: GeminiDvachConversation['initialContext'] = { targetPostText: randomPostToReply.comment.replace(/<[^>]*>?/gm, '') };

                    // Analyze OP image(s)
                    if (settings.geminiAnalyzeOpMedia && opPost?.files?.length) {
                        const opImagesToAnalyze = opPost.files.filter(f => f.type === 1 || f.type === 2 || f.type === 4 || f.type === 9).slice(0, settings.maxImagesToAnalyzePerPost);
                        if (opImagesToAnalyze.length > 0) {
                             contextPrompt += `\n\nПост ОПа >>${opPost.num} также содержит ${opImagesToAnalyze.length} изображение(й) (напр., "${opImagesToAnalyze[0].name}"). Учти их.`;
                             for (const opImageFile of opImagesToAnalyze) {
                                try { 
                                    const imageUrl = `${DVACH_DOMAINS[0]}${opImageFile.path}`;
                                    const proxiedImageUrl = buildProxiedGetUrlForApp(imageUrl, settings.proxyModeForImagesGET, settings.customProxyUrlForImagesGET);
                                    const imageResponse = await fetch(proxiedImageUrl);
                                    if (imageResponse.ok) {
                                        const imageBlob = await imageResponse.blob();
                                        const base64data = await new Promise<string>((res, rej) => { const r=new FileReader(); r.onloadend=()=>res((r.result as string).split(',')[1]); r.onerror=rej; r.readAsDataURL(imageBlob);});
                                        let mimeType = opImageFile.type === 1 ? 'image/jpeg' : opImageFile.type === 2 ? 'image/png' : imageBlob.type || 'image/jpeg';
                                        initialUserMessageParts.push({ inlineData: { mimeType, data: base64data } });
                                        initialContextForStorage.opPostImagePreview = `data:${mimeType};base64,...`; 
                                        addAutonomousBotActivityLog(`Изображение ${opImageFile.name} из ОП-поста >>${opPost.num} подготовлено для бота.`);
                                    } else { throw new Error(`Fetch failed ${imageResponse.status}`); }
                                } catch (imgErr) { addAutonomousBotActivityLog(`Ошибка обработки изображения ${opImageFile.name} из ОП-поста для бота: ${(imgErr as Error).message}`, 'bot_warning');}
                             }
                        }
                    }
                    initialContextForStorage.opPostText = opPost?.comment.replace(/<[^>]*>?/gm, '');
                    initialContextForStorage.precedingPostsText = postsBeforeTarget.map(p => p.comment.replace(/<[^>]*>?/gm, ''));

                    // Analyze Target Post image(s)
                    if (settings.botAnalyzesImagesInTriggerPosts && randomPostToReply.files?.length) {
                         const targetImagesToAnalyze = randomPostToReply.files.filter(f => f.type === 1 || f.type === 2 || f.type === 4 || f.type === 9).slice(0, settings.maxImagesToAnalyzePerPost);
                         if (targetImagesToAnalyze.length > 0) {
                            contextPrompt += `\n\nЦелевой пост >>${randomPostToReply.num} также содержит ${targetImagesToAnalyze.length} изображение(й) (напр., "${targetImagesToAnalyze[0].name}"). Проанализируй их.`;
                            for (const imageFile of targetImagesToAnalyze) {
                                try { 
                                    const imageUrl = `${DVACH_DOMAINS[0]}${imageFile.path}`;
                                    const proxiedImageUrl = buildProxiedGetUrlForApp(imageUrl, settings.proxyModeForImagesGET, settings.customProxyUrlForImagesGET);
                                    const imageResponse = await fetch(proxiedImageUrl);
                                    if (imageResponse.ok) {
                                        const imageBlob = await imageResponse.blob();
                                        const base64data = await new Promise<string>((res, rej) => { const r=new FileReader(); r.onloadend=()=>res((r.result as string).split(',')[1]); r.onerror=rej; r.readAsDataURL(imageBlob);});
                                        let mimeType = imageFile.type === 1 ? 'image/jpeg' : imageFile.type === 2 ? 'image/png' : imageBlob.type || 'image/jpeg';
                                        initialUserMessageParts.push({ inlineData: { mimeType, data: base64data } });
                                        initialContextForStorage.targetPostImagePreview = `data:${mimeType};base64,...`;
                                        addAutonomousBotActivityLog(`Изображение ${imageFile.name} из целевого поста >>${randomPostToReply.num} подготовлено для бота.`);
                                    } else { throw new Error(`Fetch failed ${imageResponse.status}`);}
                                } catch (imgErr) { addAutonomousBotActivityLog(`Ошибка обработки изображения ${imageFile.name} из целевого поста для бота: ${(imgErr as Error).message}`, 'bot_warning');}
                            }
                         }
                    }
                    
                    initialUserMessageParts.push({ text: contextPrompt + `\n\nВот целевой пост. Сгенерируй свой ответ на него. Ответ ДОЛЖЕН быть на РУССКОМ языке.`});
                    
                    const botChat: Chat = ai.chats.create({
                        model: GEMINI_TEXT_MODEL,
                        config: {
                            systemInstruction: settings.autonomousBotSystemPrompt,
                            temperature: 0.85, topK: 40, topP: 0.95, maxOutputTokens: 512, 
                            ...(settings.useThinkingBudget && { thinkingConfig: { thinkingBudget: settings.geminiThinkingBudget } })
                        },
                        history: [] 
                    }); 

                    const stream = await botChat.sendMessageStream({ message: initialUserMessageParts });
                    let rawBotReplyText = "";
                    for await (const chunk of stream) { rawBotReplyText += chunk.text || ""; }
                    
                    let botReplyText = rawBotReplyText.trim();
                    const leadingPostNumRegex = /^(?:>>\d+\s*)/; 
                    botReplyText = botReplyText.replace(leadingPostNumRegex, '').trim();
                    botReplyText = `>>${randomPostToReply.num}\n${botReplyText}`; 
                    
                    addAutonomousBotActivityLog(`Бот сгенерировал ответ для >>${randomPostToReply.num}: ${botReplyText.substring(0,70)}...`);
                    
                    let botPostFile: File | null = null;
                    if (settings.geminiReplyWithGeneratedImage) { 
                        addAutonomousBotActivityLog(`Бот генерирует изображение для ответа на >>${randomPostToReply.num}...`, 'gemini');
                        const imagePromptForBot = `Imageboard reply context: "${botReplyText.substring(botReplyText.indexOf('\n') + 1, 200).trim()}". Style: relevant to imageboard, subtly humorous, or abstract.`;
                        try {
                            const imgGenResponse = await ai.models.generateImages({
                                model: GEMINI_IMAGE_MODEL,
                                prompt: imagePromptForBot,
                                config: { numberOfImages: 1, outputMimeType: 'image/jpeg' }
                            });
                            if (imgGenResponse.generatedImages?.[0]?.image?.imageBytes) {
                                botPostFile = await base64ToFile(imgGenResponse.generatedImages[0].image.imageBytes, `bot_img_${Date.now()}.jpg`, imgGenResponse.generatedImages[0].image.mimeType || 'image/jpeg');
                                addAutonomousBotActivityLog(`Бот сгенерировал изображение для ответа на >>${randomPostToReply.num}.`, 'gemini');
                            } else {
                                addAutonomousBotActivityLog(`Генерация изображения ботом не удалась или не вернула изображение для >>${randomPostToReply.num}.`, 'bot_warning');
                            }
                        } catch (imgGenErr) {
                             addAutonomousBotActivityLog(`Ошибка генерации изображения ботом для >>${randomPostToReply.num}: ${(imgGenErr as Error).message}. Постинг только текста.`, 'bot_warning', imgGenErr);
                        }
                    }

                    const newBotPostNum = await commonPostToDvach(botReplyText, botPostFile, false, settings.autonomousBotTargetBoard, settings.autonomousBotTargetThreadId, randomPostToReply.num);
                    botMadeAPostThisCycle = true;
                    
                    const currentTimestamp = Date.now();
                    const newConvo: GeminiDvachConversation = {
                        id: convoId,
                        board: settings.autonomousBotTargetBoard,
                        threadId: settings.autonomousBotTargetThreadId,
                        triggerPostNum: randomPostToReply.num,
                        botSystemPromptUsed: settings.autonomousBotSystemPrompt,
                        geminiChatInstance: botChat, // Will be stripped for localStorage, used in-memory for active sessions
                        history: [
                          { 
                            id: `bot-user-msg-${currentTimestamp -1}`, 
                            role: 'user', 
                            parts: initialUserMessageParts, 
                            timestamp: currentTimestamp -1 
                          },
                          { 
                            id: `bot-model-msg-${currentTimestamp}`,
                            role: 'model', 
                            parts: [{ text: botReplyText }], 
                            timestamp: currentTimestamp 
                          }
                        ],
                        lastCheckedTimestamp: currentTimestamp,
                        lastBotReplyNum: newBotPostNum,
                        participatingPostNumbers: [randomPostToReply.num, newBotPostNum],
                        status: 'active',
                        initialContext: initialContextForStorage,
                    };
                    newConversationsMap.set(convoId, newConvo);

                    setSentMessages(prev => [
                        {
                            num: newBotPostNum,
                            timestamp: currentTimestamp,
                            comment: botReplyText,
                            board: settings.autonomousBotTargetBoard,
                            thread: settings.autonomousBotTargetThreadId,
                            parent: randomPostToReply.num,
                            file_info: botPostFile ? { name: botPostFile.name, size: botPostFile.size } : undefined,
                            isGeminiPost: true,
                            geminiTriggerPostNum: randomPostToReply.num,
                            geminiGeneratedImage: !!botPostFile,
                            geminiConversationId: convoId,
                        }, 
                        ...prev
                    ]);
                    setAutonomousBotStatus(`Ответил как >>${newBotPostNum} на >>${randomPostToReply.num}`);
                }
            } else { addAutonomousBotActivityLog("Нет подходящих постов для случайного ответа в этом цикле.", 'bot_activity'); }
        } else if (settings.autonomousBotReplyMode === 'replies_to_bot') {
            // ... existing logic for replies_to_bot, ensure image analysis uses new settings and multi-image logic
        }

        if (botMadeAPostThisCycle) {
            setGeminiDvachConversations(new Map(newConversationsMap)); 
        }
        setAutonomousBotStatus(`Ожидание следующего цикла /${settings.autonomousBotTargetBoard}/${settings.autonomousBotTargetThreadId}`);
        addAutonomousBotActivityLog("Цикл бота завершен.", 'bot_activity');

      } catch (error) { 
        const errorMsg = (error as Error).message;
        addAutonomousBotActivityLog(`Критическая ошибка в цикле бота: ${errorMsg}`, 'bot_error', error);
        setAutonomousBotStatus(`Ошибка в цикле бота: ${errorMsg.substring(0,50)}...`);
      }
    };
    
    addLog(`Autonomous bot started. Interval: ${settings.autonomousBotCycleIntervalSeconds}s. Mode: ${settings.autonomousBotReplyMode}. Target: /${settings.autonomousBotTargetBoard}/${settings.autonomousBotTargetThreadId}`, 'bot_setup');
    setAutonomousBotStatus("Активен - Первый цикл скоро начнется...");
    // Initial run then interval
    setTimeout(runBotCycle, 5000); // Initial delay before first cycle
    autonomousBotIntervalRef.current = setInterval(runBotCycle, settings.autonomousBotCycleIntervalSeconds * 1000) as unknown as number;

    return () => {
      if (autonomousBotIntervalRef.current) {
        clearInterval(autonomousBotIntervalRef.current);
        autonomousBotIntervalRef.current = null;
        addLog("Autonomous bot interval cleared.", "bot_setup");
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autonomousBotActive, ai, dvachSessionCookies, settings]); 
  
  const toggleTheme = () => {
    const newTheme = settings.theme === 'light' ? 'dark' : settings.theme === 'dark' ? 'system' : 'light';
    handleUpdateSettings({ theme: newTheme });
  };

  const ThemeIconComponent: React.FC<React.SVGProps<SVGSVGElement>> = (props) => {
    if (settings.theme === 'dark') return <IconMoon {...props} />;
    if (settings.theme === 'light') return <IconSun {...props} />;
    // System theme
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    return prefersDark ? <IconMoon {...props} /> : <IconSun {...props} />;
  };


  const renderDvachPostCard = (post: DvachPost, index: number) => {
     const sentMessageData = sentMessages.find(m => m.num === post.num && m.board === currentBoard && m.thread === currentThreadId);
     const isMyPost = !!sentMessageData;
     const isGeminiPostByBot = sentMessageData?.isGeminiPost || false;

     const isGeminiReplyToThis = sentMessages.some(m => m.geminiTriggerPostNum === post.num && m.isGeminiPost);
    
     const cardBg = isMyPost ? 
        (isGeminiPostByBot ? "bg-purple-50 dark:bg-purple-900/50" : "bg-blue-50 dark:bg-blue-900/50") : 
        "bg-gray-50 dark:bg-gray-700";
     const borderColor = isMyPost ?
        (isGeminiPostByBot ? "border-purple-300 dark:border-purple-700" : "border-blue-300 dark:border-blue-700") :
        "border-gray-200 dark:border-gray-600";

    return (
    <div 
        key={`${post.num}-${index}`} 
        id={`post-${post.num}`} 
        className={`p-3 mb-3 ${cardBg} rounded-lg shadow border ${borderColor} transition-all hover:shadow-md`}
        role="article" 
        aria-labelledby={`post-header-${post.num}`}
    >
      <div id={`post-header-${post.num}`} className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400 mb-1">
        <span>
          <span className="font-semibold text-gray-700 dark:text-gray-300">{post.name || 'Anonymous'}</span>
          {post.trip && <span className="ml-1 text-green-600 dark:text-green-400">{post.trip}</span>}
          {' - No. '}
          <a href={`${DVACH_DOMAINS[0]}/${currentBoard}/res/${currentThreadId}.html#${post.num}`} 
             target="_blank" rel="noopener noreferrer"
             className="hover:underline text-blue-500 dark:text-blue-400"
             onClick={(e) => { e.preventDefault(); document.getElementById(`post-${post.num}`)?.scrollIntoView({behavior: 'smooth'}); }}
          >
            {post.num}
          </a>
          {isMyPost && <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full bg-green-200 dark:bg-green-700 text-green-800 dark:text-green-100">You</span>}
          {isGeminiPostByBot && <IconSparkles className="inline-block ml-1 h-3 w-3 text-purple-500" title="Posted by Gemini (via bot/manual reply)"/>}
        </span>
        <time dateTime={new Date(post.timestamp * 1000).toISOString()}>
          {new Date(post.timestamp * 1000).toLocaleString()}
        </time>
      </div>
      {post.subject && <h4 className="font-semibold text-sm mb-1 text-gray-800 dark:text-gray-200">{post.subject}</h4>}
      
      {post.files && post.files.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {post.files.map((file, fileIndex) => {
            const fileUrl = `${DVACH_DOMAINS[0]}${file.path}`;
            const thumbUrl = `${DVACH_DOMAINS[0]}${file.thumbnail}`;
            // Use image proxy for thumbs if enabled
            const proxiedThumbUrl = buildProxiedGetUrlForApp(thumbUrl, settings.proxyModeForImagesGET, settings.customProxyUrlForImagesGET);

            return (
            <a key={fileIndex} href={fileUrl} target="_blank" rel="noopener noreferrer" className="block w-24 h-24 group relative">
              <img 
                src={proxiedThumbUrl}
                alt={file.name || `file ${fileIndex + 1}`} 
                className="rounded object-cover w-full h-full border border-gray-300 dark:border-gray-500 group-hover:opacity-80 transition-opacity"
                loading="lazy"
                onError={(e) => { 
                    addLog(`Failed to load thumbnail: ${proxiedThumbUrl} (original: ${thumbUrl}). Attempting direct.`, 'warning');
                    (e.target as HTMLImageElement).src = thumbUrl; // Fallback to direct URL on error
                    (e.target as HTMLImageElement).onerror = null; // Prevent infinite loop
                }}
              />
              <div className="absolute bottom-0 left-0 bg-black bg-opacity-50 text-white text-xs p-0.5 truncate w-full group-hover:opacity-100 opacity-0 transition-opacity">
                {file.name} ({Math.round(file.size / 1024)}KB)
              </div>
            </a>
          );
        })}
        </div>
      )}

      <div 
        className="prose prose-sm dark:prose-invert max-w-none break-words"
        dangerouslySetInnerHTML={{ __html: post.comment.replace(/&gt;&gt;(\d+)/g, (_match, p1) => `<a href="#post-${p1}" class="text-blue-500 dark:text-blue-400 hover:underline" data-replyto="${p1}">&gt;&gt;${p1}</a>`) }}
      />

      <div className="mt-2 text-right">
        {isGeminiReplyToThis && <span className="text-xs text-purple-600 dark:text-purple-400 mr-2">Gemini replied</span>}
        <button 
          onClick={() => handleManualGeminiReplyToDvachPost(post)}
          disabled={geminiLoading || !ai || !dvachSessionCookies?.passcode_auth || !currentBoard || !currentThreadId}
          className="px-3 py-1 text-xs bg-purple-500 hover:bg-purple-600 text-white rounded-md font-medium flex items-center shadow disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title={!ai ? "Gemini AI not initialized. Check API Key." : !dvachSessionCookies?.passcode_auth ? "Login to Dvach to reply." : "Reply to this post using Gemini AI"}
        >
          <IconSparkles className="mr-1 h-4 w-4"/> Reply with Gemini
        </button>
      </div>
    </div>
  )};

  const renderDvachBotPanel = () => ( 
    <div className="space-y-6 p-4 md:p-6 bg-white dark:bg-gray-800 shadow-lg rounded-lg">
      <h2 className="text-2xl font-semibold text-blue-600 dark:text-blue-400 border-b pb-2 border-gray-300 dark:border-gray-700">Dvach Manual Operations</h2>
      
      {/* Dvach Auth Status & Login/Logout */}
      <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-md">
        <h3 className="text-lg font-medium mb-2 text-gray-700 dark:text-gray-300">Dvach Authentication</h3>
        {dvachSessionCookies?.passcode_auth ? (
            <div className="flex items-center space-x-3">
                <IconUserCircle className="h-6 w-6 text-green-500" />
                <span className="text-sm text-green-700 dark:text-green-300">Logged in to Dvach.</span>
                <button onClick={handleDvachLogout} className="px-3 py-1 text-xs bg-red-500 hover:bg-red-600 text-white rounded-md flex items-center shadow transition-colors">
                    <IconLogout className="mr-1 h-4 w-4"/> Logout
                </button>
            </div>
        ) : (
            <div className="flex items-center space-x-3">
                <IconAlertTriangle className="h-6 w-6 text-yellow-500" />
                <span className="text-sm text-yellow-700 dark:text-yellow-300">Not logged in to Dvach.</span>
                <button onClick={handleDvachLogin} disabled={isDvachLoggingIn || !settings.purchasedPasscode} className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-md flex items-center shadow disabled:opacity-50 transition-colors">
                    {isDvachLoggingIn ? <IconRefresh className="mr-1 h-4 w-4 animate-spin"/> : <IconLogin className="mr-1 h-4 w-4"/>}
                    {isDvachLoggingIn ? 'Logging in...' : 'Login with Passcode'}
                </button>
            </div>
        )}
        {!settings.purchasedPasscode && !dvachSessionCookies?.passcode_auth && <p className="text-xs text-red-500 mt-1">Passcode not set in Settings. Login disabled.</p>}
         {fetchError && (fetchError.includes("Login failed") || fetchError.includes("Dvach login error") || fetchError.includes("session cookie")) && <p className="text-xs text-red-500 mt-1">{fetchError}</p>}
      </div>

      {/* Manual Post Section */}
      <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-md">
        <h3 className="text-xl font-medium mb-3 text-gray-700 dark:text-gray-300">Manual Post</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
            <div>
                <label htmlFor="manualBoard" className="block text-sm font-medium">Board (e.g., b):</label>
                <input id="manualBoard" type="text" value={currentBoard} onChange={e => setCurrentBoard(e.target.value)} className="mt-1 w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 focus:ring-1 focus:ring-blue-500"/>
            </div>
            <div>
                <label htmlFor="manualThreadId" className="block text-sm font-medium">Thread ID (0 for new thread):</label>
                <input id="manualThreadId" type="text" value={currentThreadId} onChange={e => setCurrentThreadId(e.target.value)} className="mt-1 w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 focus:ring-1 focus:ring-blue-500"/>
            </div>
        </div>
        <textarea 
          aria-label="Post comment"
          className="w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-500"
          rows={3} 
          placeholder="Enter post comment..."
          value={postText}
          onChange={(e) => setPostText(e.target.value)}
        />
        <div className="flex items-center space-x-4 mt-2">
          <label className="text-sm">
             Attach Image:
             <input type="file" onChange={(e) => setPostFile(e.target.files?.[0] || null)} className="ml-2 text-sm file:mr-2 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-800 dark:file:text-blue-200 dark:hover:file:bg-blue-700"/>
             {postFile && <span className="text-xs ml-2">{postFile.name} (<button onClick={() => setPostFile(null)} className="text-red-500 hover:underline">remove</button>)</span>}
          </label>
          <label className="flex items-center text-sm">
            <input type="checkbox" checked={postUseSage} onChange={(e) => setPostUseSage(e.target.checked)} className="mr-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"/>
            Sage
          </label>
          <button 
            onClick={handleSimplePost} 
            disabled={isPosting || !dvachSessionCookies?.passcode_auth || !currentBoard || !postText.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium flex items-center shadow transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={!dvachSessionCookies?.passcode_auth ? "Login to post" : (!currentBoard || !postText.trim()) ? "Board and comment required" : "Post message"}
          >
            {isPosting ? <IconRefresh className="mr-2 h-5 w-5 animate-spin"/> : <IconSend className="mr-2 h-5 w-5"/>}
            {isPosting ? 'Posting...' : 'Post'}
          </button>
        </div>
        {postActivityLog.length > 0 && 
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
                {postActivityLog.map((log,i) => <p key={i} className="truncate">{log}</p>)}
            </div>
        }
        {fetchError && (fetchError.includes("Failed to post") || fetchError.includes("Board and Post Comment")) && <p className="text-xs text-red-500 mt-1">{fetchError}</p>}
      </div>

      {/* Thread Viewer Section */}
      <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-md">
        <div className="flex justify-between items-center mb-3">
            <h3 className="text-xl font-medium text-gray-700 dark:text-gray-300">Thread Viewer & Gemini Reply</h3>
            <button
                onClick={() => handleLoadThread(false)}
                disabled={isFetchingThread || !currentBoard || !currentThreadId}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-md font-medium flex items-center shadow disabled:opacity-50 transition-colors"
                title={(!currentBoard || !currentThreadId) ? "Enter Board and Thread ID above" : "Fetch posts"}
            >
                <IconRefresh className={`mr-2 h-5 w-5 ${isFetchingThread ? 'animate-spin' : ''}`}/> Fetch Thread Posts
            </button>
        </div>
        {(!currentBoard || !currentThreadId) && <p className="text-sm text-yellow-600 dark:text-yellow-400">Enter Board and Thread ID above to view posts.</p>}
        {fetchError && !fetchError.includes("Login failed") && !fetchError.includes("Failed to post") && <p className="text-sm text-red-600 dark:text-red-400">Error: {fetchError}</p>}
        <div ref={threadPostsContainerRef} className="max-h-[600px] overflow-y-auto bg-gray-100 dark:bg-gray-800 p-2 rounded custom-scrollbar border border-gray-200 dark:border-gray-700">
            {isFetchingThread && <p className="text-center p-4">Loading thread...</p>}
            {!isFetchingThread && currentFetchedDvachPosts.length === 0 && (!currentBoard || !currentThreadId || fetchError) &&
                 <p className="text-center p-4 text-gray-500 dark:text-gray-400">No posts loaded. Enter Board/Thread ID and click "Fetch Thread Posts".</p>
            }
             {!isFetchingThread && currentFetchedDvachPosts.length === 0 && currentBoard && currentThreadId && !fetchError &&
                 <p className="text-center p-4 text-gray-500 dark:text-gray-400">Thread fetched, but it's empty or an error occurred preventing display (check logs).</p>
            }
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
            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${autonomousBotActive ? 'bg-green-200 text-green-800 dark:bg-green-700 dark:text-green-100' : 'bg-red-200 text-red-800 dark:bg-red-700 dark:text-red-100'}`}>
                {autonomousBotActive ? 'Active' : 'Inactive'}
            </span>
            <button
                onClick={() => setAutonomousBotActive(prev => !prev)}
                disabled={!ai || !dvachSessionCookies?.passcode_auth || !settings.autonomousBotTargetBoard || !settings.autonomousBotTargetThreadId}
                className={`px-4 py-2 text-sm font-medium rounded-md flex items-center shadow transition-colors
                    ${autonomousBotActive ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'} text-white
                    disabled:opacity-50 disabled:cursor-not-allowed`}
                title={
                    !ai ? "Gemini AI not initialized (check API key)" : 
                    !dvachSessionCookies?.passcode_auth ? "Not logged into Dvach" : 
                    (!settings.autonomousBotTargetBoard || !settings.autonomousBotTargetThreadId) ? "Bot target board/thread not set in Settings" :
                    autonomousBotActive ? "Stop Bot" : "Start Bot"
                }
            >
                {autonomousBotActive ? <IconPlayerStop className="mr-2 h-5 w-5"/> : <IconPlayerPlay className="mr-2 h-5 w-5"/>}
                {autonomousBotActive ? 'Stop Bot' : 'Start Bot'}
            </button>
        </div>
      </div>

       {(!ai || !dvachSessionCookies?.passcode_auth || !settings.autonomousBotTargetBoard || !settings.autonomousBotTargetThreadId) &&
        <div className="p-3 bg-yellow-100 dark:bg-yellow-800 border-l-4 border-yellow-500 text-yellow-700 dark:text-yellow-200 rounded-md text-sm">
            <p className="font-semibold">Bot cannot start due to missing prerequisites:</p>
            <ul className="list-disc list-inside ml-4 text-xs">
                {!ai && <li>Gemini AI not initialized (check API key in Settings).</li>}
                {!dvachSessionCookies?.passcode_auth && <li>Not logged into Dvach (login on Manual Ops tab).</li>}
                {(!settings.autonomousBotTargetBoard || !settings.autonomousBotTargetThreadId) && <li>Bot's target board/thread ID not set (check Bot Configuration in Settings).</li>}
            </ul>
        </div>
      }

      <div className="p-4 border rounded-md border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium mb-2 text-gray-700 dark:text-gray-300">Bot Status & Activity</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Current Status: <span className="font-semibold">{autonomousBotStatus}</span></p>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            Target: <span className="font-semibold">/{settings.autonomousBotTargetBoard}/{settings.autonomousBotTargetThreadId}</span> | 
            Mode: <span className="font-semibold">{settings.autonomousBotReplyMode.replace(/_/g, ' ')}</span> | 
            Interval: <span className="font-semibold">{settings.autonomousBotCycleIntervalSeconds}s</span>
        </p>
        <div className="max-h-60 overflow-y-auto bg-gray-50 dark:bg-gray-900 p-2 rounded border border-gray-200 dark:border-gray-700 custom-scrollbar">
            {autonomousBotActivityLog.length === 0 && <p className="text-xs text-gray-500 dark:text-gray-400 text-center">No bot activity yet.</p>}
            {autonomousBotActivityLog.map((log, index) => (
                <p key={index} className="text-xs text-gray-700 dark:text-gray-300 mb-0.5 font-mono">{log}</p>
            ))}
        </div>
      </div>

      <div className="p-4 border rounded-md border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium mb-2 text-gray-700 dark:text-gray-300">Active Gemini-Dvach Conversations</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Lists conversations initiated or significantly interacted with by the bot. Click ID to view details in logs.</p>
        <div className="max-h-80 overflow-y-auto custom-scrollbar">
            {geminiDvachConversations.size === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center">No active conversations tracked.</p>
            ) : (
                Array.from(geminiDvachConversations.values()).sort((a,b) => b.lastCheckedTimestamp - a.lastCheckedTimestamp).map(convo => (
                    <div key={convo.id} className="p-2 mb-2 border rounded-md bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 text-xs">
                        <p>
                            ID: <button onClick={() => addLog("Conversation Details:", 'info', convo)} className="text-blue-500 hover:underline truncate" title="Click to see full details in Logs tab">{convo.id}</button>
                        </p>
                        <p>Trigger: <span className="font-semibold">&gt;&gt;{convo.triggerPostNum}</span> on <span className="font-semibold">/{convo.board}/{convo.threadId}</span></p>
                        <p>Status: <span className="font-semibold">{convo.status}</span> | Last Bot Reply: <span className="font-semibold">&gt;&gt;{convo.lastBotReplyNum || 'N/A'}</span></p>
                        <p>History Length: {convo.history.length} | Last Checked: {new Date(convo.lastCheckedTimestamp).toLocaleTimeString()}</p>
                    </div>
                ))
            )}
        </div>
         <button 
            onClick={() => {
                if(window.confirm("Are you sure you want to clear all tracked bot conversations? This cannot be undone.")){
                    setGeminiDvachConversations(new Map());
                    addLog("All Gemini-Dvach bot conversations cleared by user.", "bot_warning");
                }
            }}
            disabled={geminiDvachConversations.size === 0}
            className="mt-2 px-3 py-1 text-xs bg-red-500 hover:bg-red-600 text-white rounded-md font-medium flex items-center shadow disabled:opacity-50 transition-colors"
        >
            <IconTrash className="mr-1 h-4 w-4"/> Clear All Tracked Conversations
        </button>
      </div>
       <p className="text-xs text-gray-500 dark:text-gray-400">Bot settings can be configured in the main "Settings" tab under "Autonomous Bot Configuration".</p>
    </div>
  );

  const renderSettingsPanel = () => (
     <div className="space-y-6 p-4 md:p-6 bg-white dark:bg-gray-800 shadow-lg rounded-lg">
      <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-300 border-b pb-2 border-gray-300 dark:border-gray-700">Application Settings</h2>
      
      {/* Dvach Configuration (Manual Ops Tab) */}
      <div className="p-4 border rounded-md border-gray-200 dark:border-gray-700 space-y-3">
        <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">Dvach Configuration (Manual Ops Tab & Bot Default)</h3>
        <div>
          <label htmlFor="settingsBoard" className="block text-sm font-medium">Default Board (e.g., b):</label>
          <input id="settingsBoard" type="text" value={settings.board} onChange={e => handleUpdateSettings({board: e.target.value})} className="mt-1 w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 focus:ring-1 focus:ring-blue-500"/>
        </div>
        <div>
          <label htmlFor="settingsThreadId" className="block text-sm font-medium">Default Thread ID (0 for new thread):</label>
          <input id="settingsThreadId" type="text" value={settings.threadId} onChange={e => handleUpdateSettings({threadId: e.target.value})} className="mt-1 w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 focus:ring-1 focus:ring-blue-500"/>
        </div>
        <div>
          <label htmlFor="settingsPasscode" className="block text-sm font-medium">Purchased Dvach Passcode:</label>
          <input id="settingsPasscode" type="password" value={settings.purchasedPasscode} onChange={e => handleUpdateSettings({purchasedPasscode: e.target.value})} className="mt-1 w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 focus:ring-1 focus:ring-blue-500"/>
        </div>
         <div>
          <label htmlFor="settingsUserAgent" className="block text-sm font-medium">User Agent (for all requests):</label>
          <div className="flex items-center">
            <input id="settingsUserAgent" type="text" value={settings.userAgent} onChange={e => handleUpdateSettings({userAgent: e.target.value})} className="mt-1 w-full p-2 border rounded-l bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 focus:ring-1 focus:ring-blue-500"/>
            <button onClick={() => handleUpdateSettings({userAgent: generateUserAgent()})} className="mt-1 px-3 py-2 border border-l-0 border-gray-300 dark:border-gray-600 rounded-r bg-gray-100 hover:bg-gray-200 dark:bg-gray-600 dark:hover:bg-gray-500" title="Generate Random User Agent">
                <IconRefresh className="h-5 w-5"/>
            </button>
          </div>
        </div>
      </div>
      
      {/* Proxy for Dvach GET Requests (Thread Data) */}
      <div className="p-4 border rounded-md border-gray-200 dark:border-gray-700 space-y-3">
        <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">Proxy for Dvach GET Requests (Thread Data)</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">Used by "Fetch Thread" in Manual Ops and by Bot for thread monitoring. POSTs use serverless /api/dvach-post.</p>
        <div><label htmlFor="settingsProxyModeForGET" className="block text-sm font-medium">Proxy Mode for Thread Data GET:</label>
          <select id="settingsProxyModeForGET" value={settings.proxyModeForGET} 
            onChange={e => {
                const mode = e.target.value as ProxyModeForGET;
                let newCustomUrl = settings.customProxyUrlForGET;
                if (mode === 'custom_go_x2u' && (!newCustomUrl || newCustomUrl === DEFAULT_CORS_ANYWHERE_PROXY)) newCustomUrl = PROXY_URL_GO_X2U_BASE;
                else if (mode === 'custom_cors_anywhere' && (!newCustomUrl || newCustomUrl === PROXY_URL_GO_X2U_BASE)) newCustomUrl = DEFAULT_CORS_ANYWHERE_PROXY;
                else if (mode === 'vercel_serverless' || mode === 'none') newCustomUrl = ""; 
                handleUpdateSettings({ proxyModeForGET: mode, customProxyUrlForGET: newCustomUrl });
            }}  
            className="mt-1 w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 focus:ring-1 focus:ring-blue-500">
            <option value="vercel_serverless">Vercel Serverless (/api/get-thread) (Recommended for thread data)</option>
            <option value="custom_go_x2u">Custom: go.x2u.in Format (e.g., ...&amp;url=)</option>
            <option value="custom_cors_anywhere">Custom: cors-anywhere.com Format (e.g., .../)</option>
            <option value="custom_general_prefix">Custom: General Prefix URL (e.g., https://myproxy.com/)</option>
            <option value="custom_general_param">Custom: General Parameter URL (e.g., ...?url=)</option>
            <option value="none">No Proxy (May not work due to CORS)</option></select></div>
        {(settings.proxyModeForGET.startsWith('custom_') ) && ( 
          <div><label htmlFor="settingsCustomProxyUrlForGET" className="block text-sm font-medium">Custom Proxy URL Base for Thread Data GET:</label>
            <input id="settingsCustomProxyUrlForGET" type="text" placeholder="Enter custom proxy base URL" value={settings.customProxyUrlForGET} 
              onChange={e => handleUpdateSettings({customProxyUrlForGET: e.target.value})} 
              className="mt-1 w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 focus:ring-1 focus:ring-blue-500"/>
             <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                E.g., for go.x2u format: <code>{PROXY_URL_GO_X2U_BASE.replace('YOUR_API_KEY_HERE&', '')}</code> (replace with your key).
                For cors-anywhere: <code>{DEFAULT_CORS_ANYWHERE_PROXY}</code> or your own instance.
                Ensure prefix proxies end with '/' and param proxies end with '='.
            </p>
            </div>)}
      </div>

      {/* Proxy for Image/Media GET Requests */}
      <div className="p-4 border rounded-md border-gray-200 dark:border-gray-700 space-y-3">
        <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">Proxy for Image/Media GET Requests</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">Used by Manual Reply and Bot for fetching images/media for Gemini analysis.</p>
        <div><label htmlFor="settingsProxyModeForImagesGET" className="block text-sm font-medium">Proxy Mode for Images/Media GET:</label>
          <select id="settingsProxyModeForImagesGET" value={settings.proxyModeForImagesGET} 
            onChange={e => {
                const mode = e.target.value as ProxyModeForGET;
                let newCustomUrl = settings.customProxyUrlForImagesGET;
                if (mode === 'custom_go_x2u' && (!newCustomUrl || newCustomUrl === DEFAULT_CORS_ANYWHERE_PROXY || newCustomUrl === "")) newCustomUrl = PROXY_URL_GO_X2U_BASE;
                else if (mode === 'custom_cors_anywhere' && (!newCustomUrl || newCustomUrl === PROXY_URL_GO_X2U_BASE || newCustomUrl === "")) newCustomUrl = DEFAULT_CORS_ANYWHERE_PROXY;
                else if (mode === 'none') newCustomUrl = ""; 
                handleUpdateSettings({ proxyModeForImagesGET: mode, customProxyUrlForImagesGET: newCustomUrl });
            }}  
            className="mt-1 w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 focus:ring-1 focus:ring-blue-500">
            <option value="custom_cors_anywhere">Cors-Anywhere (Public or Custom)</option>
            <option value="custom_go_x2u">Go.x2u.in Format (Public or Custom)</option>
            <option value="custom_general_prefix">Custom: General Prefix URL</option>
            <option value="custom_general_param">Custom: General Parameter URL</option>
            <option value="none">No Proxy (Direct Fetch - Likely CORS Fail)</option></select></div>
        {(settings.proxyModeForImagesGET.startsWith('custom_')) && ( 
          <div><label htmlFor="settingsCustomProxyUrlForImagesGET" className="block text-sm font-medium">Custom Proxy URL Base for Images/Media GET:</label>
            <input id="settingsCustomProxyUrlForImagesGET" type="text" placeholder="Enter custom proxy base URL for images" value={settings.customProxyUrlForImagesGET} 
              onChange={e => handleUpdateSettings({customProxyUrlForImagesGET: e.target.value})} 
              className="mt-1 w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 focus:ring-1 focus:ring-blue-500"/>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                E.g., for cors-anywhere: <code>{DEFAULT_CORS_ANYWHERE_PROXY}</code>. For go.x2u: <code>{PROXY_URL_GO_X2U_BASE}</code>.
            </p>
            </div>)}
      </div>

      {/* Gemini API Configuration */}
      <div className="p-4 border rounded-md border-gray-200 dark:border-gray-700 space-y-3">
        <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">Gemini API Configuration</h3>
        <select aria-label="Gemini API Key Source" value={settings.geminiApiKeySource} onChange={e => handleUpdateSettings({geminiApiKeySource: e.target.value as 'env' | 'user'})} className="mt-1 w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 focus:ring-1 focus:ring-blue-500">
          <option value="env">Use Environment API_KEY (VITE_GEMINI_API_KEY) {processEnvApiKey ? `(Detected: ${processEnvApiKey.substring(0,4)}...${processEnvApiKey.substring(processEnvApiKey.length - 4)})` : "(Not Detected/Accessible)"}</option>
          <option value="user">Enter API Key Manually</option>
        </select>
        {settings.geminiApiKeySource === 'user' && (
          <input aria-label="User Gemini API Key" type="password" placeholder="Enter your Gemini API Key" value={settings.userGeminiApiKey} onChange={e => handleUpdateSettings({userGeminiApiKey: e.target.value})} className="mt-1 w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 focus:ring-1 focus:ring-blue-500"/>
        )}
        <div><label htmlFor="geminiSystemInstruction" className="block text-sm font-medium">System Instruction (for Manual Replies):</label>
          <textarea id="geminiSystemInstruction" value={settings.geminiSystemInstruction} onChange={e => handleUpdateSettings({geminiSystemInstruction: e.target.value})} rows={3} className="mt-1 w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 focus:ring-1 focus:ring-blue-500"/></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div><label htmlFor="geminiTemp" className="block text-xs font-medium">Temp:</label><input id="geminiTemp" type="number" step="0.05" min="0" max="1" value={settings.geminiTemperature} onChange={e => handleUpdateSettings({geminiTemperature: parseFloat(e.target.value)})} className="mt-1 w-full p-1.5 border rounded bg-gray-50 dark:bg-gray-700 dark:border-gray-600"/></div>
            <div><label htmlFor="geminiTopP" className="block text-xs font-medium">TopP:</label><input id="geminiTopP" type="number" step="0.05" min="0" max="1" value={settings.geminiTopP} onChange={e => handleUpdateSettings({geminiTopP: parseFloat(e.target.value)})} className="mt-1 w-full p-1.5 border rounded bg-gray-50 dark:bg-gray-700 dark:border-gray-600"/></div>
            <div><label htmlFor="geminiTopK" className="block text-xs font-medium">TopK:</label><input id="geminiTopK" type="number" step="1" min="1" value={settings.geminiTopK} onChange={e => handleUpdateSettings({geminiTopK: parseInt(e.target.value)})} className="mt-1 w-full p-1.5 border rounded bg-gray-50 dark:bg-gray-700 dark:border-gray-600"/></div>
            <div><label htmlFor="geminiMaxTokens" className="block text-xs font-medium">Max Tokens:</label><input id="geminiMaxTokens" type="number" step="64" min="64" value={settings.geminiMaxOutputTokens} onChange={e => handleUpdateSettings({geminiMaxOutputTokens: parseInt(e.target.value)})} className="mt-1 w-full p-1.5 border rounded bg-gray-50 dark:bg-gray-700 dark:border-gray-600"/></div>
        </div>
         <label className="flex items-center text-sm"><input type="checkbox" checked={settings.useThinkingBudget} onChange={e => handleUpdateSettings({useThinkingBudget: e.target.checked})} className="mr-2 h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"/>Enable Thinking Budget (0 for instant)</label>
        {settings.useThinkingBudget && <div><label htmlFor="geminiThinkingBudget" className="block text-xs font-medium">Thinking Budget (ms):</label><input id="geminiThinkingBudget" type="number" step="100" min="0" value={settings.geminiThinkingBudget} onChange={e => handleUpdateSettings({geminiThinkingBudget: parseInt(e.target.value)})} className="mt-1 w-1/2 p-1.5 border rounded bg-gray-50 dark:bg-gray-700 dark:border-gray-600"/></div>}
      </div>

      {/* Gemini-Dvach Interaction (Global) */}
      <div className="p-4 border rounded-md border-gray-200 dark:border-gray-700 space-y-2">
         <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">Gemini-Dvach Interaction (Global)</h3>
        <label className="flex items-center text-sm"><input type="checkbox" checked={settings.geminiAnalyzeOpMedia} onChange={e => handleUpdateSettings({geminiAnalyzeOpMedia: e.target.checked})} className="mr-2 h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"/>Manual Reply: Gemini Considers Media in OP Post</label>
        <label className="flex items-center text-sm"><input type="checkbox" checked={settings.geminiAnalyzeAnonMedia} onChange={e => handleUpdateSettings({geminiAnalyzeAnonMedia: e.target.checked})} className="mr-2 h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"/>Manual Reply: Gemini Considers Media in Non-OP Posts</label>
        <label className="flex items-center text-sm"><input type="checkbox" checked={settings.geminiReplyWithGeneratedImage} onChange={e => handleUpdateSettings({geminiReplyWithGeneratedImage: e.target.checked})} className="mr-2 h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"/>Gemini Generates Image with Replies (Manual & Bot)</label>
        <div>
          <label htmlFor="maxImagesToAnalyze" className="block text-sm font-medium">Max Images to Analyze per Post (Manual & Bot):</label>
          <input id="maxImagesToAnalyze" type="number" min="1" max="5" step="1" value={settings.maxImagesToAnalyzePerPost} onChange={e => handleUpdateSettings({maxImagesToAnalyzePerPost: parseInt(e.target.value) || 1})} className="mt-1 w-24 p-1.5 border rounded bg-gray-50 dark:bg-gray-700 dark:border-gray-600"/>
        </div>
        <label className="flex items-center text-sm"><input type="checkbox" checked={settings.analyzeVideosInTriggerPosts} onChange={e => handleUpdateSettings({analyzeVideosInTriggerPosts: e.target.checked})} className="mr-2 h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500" disabled/>Analyze Videos in Posts (Bot & Manual - Not Yet Implemented)</label>
      </div>

      {/* Autonomous Bot Configuration */}
       <div className="p-4 border rounded-md border-gray-200 dark:border-gray-700 space-y-3">
        <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">Autonomous Bot Configuration</h3>
        <div><label htmlFor="botTargetBoard" className="block text-sm font-medium">Target Board (e.g., b):</label><input id="botTargetBoard" type="text" value={settings.autonomousBotTargetBoard} onChange={e => handleUpdateSettings({autonomousBotTargetBoard: e.target.value})} className="mt-1 w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"/></div>
        <div><label htmlFor="botTargetThreadId" className="block text-sm font-medium">Target Thread ID:</label><input id="botTargetThreadId" type="text" value={settings.autonomousBotTargetThreadId} onChange={e => handleUpdateSettings({autonomousBotTargetThreadId: e.target.value})} className="mt-1 w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"/></div>
        <div><label htmlFor="botSystemPrompt" className="block text-sm font-medium">Bot System Prompt/Persona:</label><textarea id="botSystemPrompt" value={settings.autonomousBotSystemPrompt} onChange={e => handleUpdateSettings({autonomousBotSystemPrompt: e.target.value})} rows={4} className="mt-1 w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"/></div>
        <div><label htmlFor="botReplyMode" className="block text-sm font-medium">Bot Reply Mode:</label>
          <select id="botReplyMode" value={settings.autonomousBotReplyMode} onChange={e => handleUpdateSettings({autonomousBotReplyMode: e.target.value as AutonomousBotReplyMode})} className="mt-1 w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600">
            <option value="random_in_thread">Reply to Random Posts in Thread</option>
            <option value="replies_to_bot">Reply to Mentions of Bot's Posts (Conversational)</option>
          </select></div>
        <div><label htmlFor="botCycleInterval" className="block text-sm font-medium">Bot Cycle Interval (seconds):</label><input id="botCycleInterval" type="number" min="30" step="5" value={settings.autonomousBotCycleIntervalSeconds} onChange={e => handleUpdateSettings({autonomousBotCycleIntervalSeconds: parseInt(e.target.value) || 60})} className="mt-1 w-1/2 p-1.5 border rounded bg-gray-50 dark:bg-gray-700 dark:border-gray-600"/></div>
        <label className="flex items-center text-sm"><input type="checkbox" checked={settings.botAnalyzesImagesInTriggerPosts} onChange={e => handleUpdateSettings({botAnalyzesImagesInTriggerPosts: e.target.checked})} className="mr-2 h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"/>Bot Considers Images in Posts It Replies To</label>
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400">Settings are saved automatically to local storage.</p></div>
  );

  const renderLogsPanel = () => (
    <div className="space-y-6 p-4 md:p-6 bg-white dark:bg-gray-800 shadow-lg rounded-lg">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-300 border-b pb-2 border-gray-300 dark:border-gray-700 flex-grow">Event Logs</h2>
        <button 
            onClick={() => { if(window.confirm("Are you sure you want to clear all logs?")) setLogs([]); }}
            className="px-3 py-1 text-xs bg-red-500 hover:bg-red-600 text-white rounded-md font-medium flex items-center shadow disabled:opacity-50 transition-colors"
            title="Clear all logs"
            disabled={logs.length === 0}
        >
            <IconTrash className="mr-1 h-4 w-4"/> Clear Logs
        </button>
      </div>
      <div className="max-h-[600px] overflow-y-auto bg-gray-50 dark:bg-gray-900 p-3 rounded custom-scrollbar border border-gray-200 dark:border-gray-700">
        {logs.length === 0 && <p className="text-center text-gray-500 dark:text-gray-400">No logs yet.</p>}
        {logs.map(log => (
          <div key={log.id} className={`text-xs p-1.5 mb-1 rounded border-l-4 ${
            log.type === 'error' || log.type === 'bot_error' ? 'bg-red-50 dark:bg-red-900/60 border-red-500 text-red-700 dark:text-red-300' : 
            log.type === 'success' ? 'bg-green-50 dark:bg-green-900/60 border-green-500 text-green-700 dark:text-green-300' :
            log.type === 'warning' || log.type === 'bot_warning' ? 'bg-yellow-50 dark:bg-yellow-900/60 border-yellow-500 text-yellow-700 dark:text-yellow-300' :
            log.type === 'gemini' ? 'bg-purple-50 dark:bg-purple-900/60 border-purple-500 text-purple-700 dark:text-purple-300' :
            log.type === 'dvach' ? 'bg-blue-50 dark:bg-blue-900/60 border-blue-500 text-blue-700 dark:text-blue-300' :
            log.type === 'auth' ? 'bg-orange-50 dark:bg-orange-900/60 border-orange-500 text-orange-700 dark:text-orange-300' :
            log.type === 'bot_activity' || log.type === 'bot_setup' ? 'bg-cyan-50 dark:bg-cyan-900/60 border-cyan-500 text-cyan-700 dark:text-cyan-300' :
            'bg-gray-100 dark:bg-gray-700/60 border-gray-500 text-gray-700 dark:text-gray-300' 
          }`}>
            <span className="font-medium">[{new Date(log.timestamp).toLocaleTimeString()}] [{log.type.toUpperCase().replace(/_/g, ' ')}]</span>: {log.message}
            {(log.data !== undefined && log.data !== null) && (<pre className="mt-1 text-xs whitespace-pre-wrap bg-gray-200 dark:bg-gray-800 p-1 rounded max-w-full overflow-x-auto">{formatLogDataForDisplay(log.data)}</pre>)}
          </div>
        ))}
      </div>
    </div>
  );
  
  // Main App Return
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-300 font-sans">
      <header className="bg-white dark:bg-gray-800 shadow-md p-4 sticky top-0 z-50">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold text-blue-600 dark:text-blue-400 flex items-center">
            <IconCpu className="h-7 w-7 mr-2"/> Dvach Gemini Bot <span className="text-xs ml-2 text-gray-400">v{APP_VERSION}</span>
          </h1>
          <div className="flex items-center space-x-4">
            {settings.userAgent && <span className="text-xs text-gray-500 dark:text-gray-400 hidden md:block" title={settings.userAgent}>UA: {settings.userAgent.length > 30 ? settings.userAgent.substring(0,30) + '...' : settings.userAgent}</span>}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              aria-label={`Toggle theme (current: ${settings.theme})`}
              title={`Change theme. Current: ${settings.theme}. Click to cycle: light -> dark -> system -> light...`}
            >
              <ThemeIconComponent className="h-6 w-6" />
            </button>
          </div>
        </div>
      </header>

      <nav className="bg-gray-50 dark:bg-gray-800 border-b border-t border-gray-200 dark:border-gray-700 sticky top-[72px] z-40"> {/* Adjusted top for header height */}
        <div className="container mx-auto flex justify-center sm:justify-start flex-wrap">
          {[
            { id: 'dvach', label: 'Manual Ops', icon: IconCpu },
            { id: 'bot_control', label: 'Autonomous Bot', icon: IconMessageChat },
            { id: 'settings', label: 'Settings', icon: IconSettings },
            { id: 'logs', label: 'Logs', icon: IconTerminal },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as 'dvach' | 'bot_control' | 'settings' | 'logs')}
              aria-current={activeTab === tab.id ? "page" : undefined}
              className={`flex items-center px-2 sm:px-3 py-3 text-sm font-medium border-b-2 transition-all duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-400
                ${activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
            >
              <tab.icon aria-hidden="true" className="h-5 w-5 mr-1 sm:mr-1.5 flex-shrink-0" />
              <span className="truncate">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>

      <main className="container mx-auto p-4 md:p-6" role="main">
        <div className="mt-2"> {/* Added small margin-top for breathing room after sticky nav */}
            {activeTab === 'dvach' && renderDvachBotPanel()}
            {activeTab === 'bot_control' && renderAutonomousBotControlPanel()}
            {activeTab === 'settings' && renderSettingsPanel()}
            {activeTab === 'logs' && renderLogsPanel()}
        </div>
      </main>

      <footer className="text-center py-4 border-t border-gray-200 dark:border-gray-700 mt-8">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Dvach Gemini Bot Interface - Version {APP_VERSION} - Use responsibly.
        </p>
      </footer>
    </div>
  );
};
export default App;