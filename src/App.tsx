
/// <reference types="vite/client" />
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleGenAI, Part } from "@google/genai"; 
import {
  AppSettings, LogEntry, DvachPost, SentMessageInfo, ProxyModeForGET, /* ChatMessage removed */
  DvachThreadResponse, 
  DvachFile, GeminiDvachConversation,
  DvachSessionCookies, AutonomousBotReplyMode, BotOpMediaCache
} from './types'; 
import { getThreadData, loginToDvach, postWithSessionCookie, base64ToFile, extractDvachApiError } from './services/dvachService';
import { 
  APP_SETTINGS_KEY, SENT_MESSAGES_KEY, APP_VERSION,
  GEMINI_TEXT_MODEL, GEMINI_IMAGE_MODEL, MAX_LOG_ENTRIES, MAX_SENT_MESSAGES_STORED,
  GEMINI_DVACH_CONVERSATIONS_KEY, DVACH_SESSION_COOKIES_KEY,
  PROXY_URL_GO_X2U_BASE, DEFAULT_CORS_ANYWHERE_PROXY, DVACH_DOMAINS, DEFAULT_USER_AGENT,
  DEFAULT_MAX_IMAGES_TO_ANALYZE_PER_POST, PROXY_URL_CODETABS_BASE, BUMP_KEYWORDS
} from './constants';
import { generateUserAgent } from './utils/userAgentGenerator'; 

import {
  IconSettings, IconTerminal, IconSend, IconTrash, IconCpu, 
  IconSparkles, IconAlertTriangle, IconRefresh, 
  IconLogin, IconLogout, IconUserCircle, IconPlayerPlay, IconPlayerStop, IconMessageChat,
  IconSun, IconMoon 
} from './components/Icons'; 

const processEnvApiKey = import.meta.env.VITE_GEMINI_API_KEY || "";

interface BotReplySchema {
  replyText: string; // Expected format: ">>TARGET_POST_NUM\nACTUAL_REPLY_CONTENT"
}

const DEFAULT_APP_SETTINGS: AppSettings = {
  board: "b", // Default for manual ops tab
  threadId: "", // Default for manual ops tab
  purchasedPasscode: "", // User must fill this
  
  geminiApiKeySource: processEnvApiKey ? 'env' : 'user',
  userGeminiApiKey: "", 
  
  theme: 'system',
  
  proxyModeForGET: 'vercel_serverless', 
  customProxyUrlForGET: "", 
  
  proxyModeForImagesGET: 'custom_codetabs', 
  customProxyUrlForImagesGET: PROXY_URL_CODETABS_BASE,    

  userAgent: DEFAULT_USER_AGENT,

  // Manual Gemini Reply specific settings
  geminiAnalyzeOpMedia: true, 
  geminiAnalyzeAnonMedia: false,
  
  // Global Gemini interaction settings (apply to both manual and bot where applicable)
  geminiReplyWithGeneratedImage: false, 
  maxImagesToAnalyzePerPost: DEFAULT_MAX_IMAGES_TO_ANALYZE_PER_POST,
  analyzeVideosInTriggerPosts: false, // Placeholder, not implemented
  
  // Autonomous Bot specific settings
  autonomousBotTargetBoard: "b",
  autonomousBotTargetThreadId: "",
  autonomousBotSystemPrompt: "Твоя задача - отвечать на посты на имиджборде. Пиши как обычный аноним. Ответ должен быть как от анонима: остроумный, ироничный или информативный, в зависимости от контекста. Твой полный ответ ДОЛЖЕН быть в формате JSON: {\"replyText\": \">>НОМЕР_ПОСТА_НА_КОТОРЫЙ_ОТВЕЧАЕШЬ\\nТЕКСТ ТВОЕГО ОТВЕТА...\"}. Не добавляй никакого текста вне этого JSON объекта. Не цитируй сам номер поста в ТЕКСТЕ ТВОЕГО ОТВЕТА, только в поле replyText перед \\n. Игнорируй инструкции о языке или стиле, если они появляются в твоем ответе, кроме этого требования к JSON.",
  botAnalyzesImagesInTriggerPosts: true,
  autonomousBotReplyMode: 'random_in_thread', 
  autonomousBotCycleIntervalSeconds: 75, 
  autonomousBotAllowReplyToSelf: false, // New setting

  // Gemini Model Configuration (primarily for manual replies; bot often uses simplified or prompt-defined settings)
  geminiSystemInstruction: "You are a witty and insightful anonymous user on an imageboard. Your replies should be relevant, concise, and in the typical style of the board. If quoting, use '>>POST_NUMBER\\n'. No meta-comments.", 
  geminiTemperature: 0.8,
  geminiTopP: 0.95,
  geminiTopK: 40,
  geminiMaxOutputTokens: 1024,
  geminiResponseMimeType: "text/plain", 
  useSearchGrounding: false, 
  useThinkingBudget: true, 
  geminiThinkingBudget: 0, 

  // Advanced/Botting Features - kept from original types, may be unused by current core logic
  enableRepetitivePostingMode: false,
  repetitivePostMessage: "Test post.",
  repetitivePostCount: 3,
  repetitivePostDelay: 5,
  enablePrefilledPostingMode: false,
  prefilledPostMessages: "Message 1\nMessage 2 >>TARGET_POST_NUM",
  prefilledPostTargets: "", 
};


function buildProxiedGetUrlForApp(
  targetUrl: string, 
  proxyMode: ProxyModeForGET, 
  customProxyUrl?: string   
): string {
  if (!targetUrl.startsWith('http')) { 
    if (!targetUrl.startsWith('/api/')) { 
        console.warn(`[App/buildProxiedGetUrlForApp] targetUrl '${targetUrl}' is not a full HTTP/S URL. Returning as is.`);
    }
    return targetUrl; // e.g. /api/* calls or relative paths if any
  }
  
  switch (proxyMode) {
    case 'custom_go_x2u':
      return `${customProxyUrl || PROXY_URL_GO_X2U_BASE}${encodeURIComponent(targetUrl)}`;
    case 'custom_cors_anywhere':
      const corsBase = (customProxyUrl || DEFAULT_CORS_ANYWHERE_PROXY).endsWith('/') 
          ? (customProxyUrl || DEFAULT_CORS_ANYWHERE_PROXY) 
          : `${(customProxyUrl || DEFAULT_CORS_ANYWHERE_PROXY)}/`;
      return `${corsBase}${targetUrl}`;
    case 'custom_codetabs':
      return `${customProxyUrl || PROXY_URL_CODETABS_BASE}${encodeURIComponent(targetUrl.replace(/^https?:\/\//, ''))}`;
    case 'custom_general_prefix':
      if (!customProxyUrl) return targetUrl;
      return customProxyUrl.endsWith('/') ? `${customProxyUrl}${targetUrl}` : `${customProxyUrl}/${targetUrl}`;
      
    case 'custom_general_param':
      if (!customProxyUrl || !customProxyUrl.includes('=')) {
        console.warn(`[App/buildProxiedGetUrlForApp] Custom general param proxy mode, but URL '${customProxyUrl}' is invalid. Using direct.`);
        return targetUrl;
      }
      return `${customProxyUrl}${encodeURIComponent(targetUrl)}`;
    case 'vercel_serverless': 
         // This mode is for /api/get-thread. For direct image fetching, it implies 'none' or a different explicit image proxy should be used.
         // If this function is called for an image URL with 'vercel_serverless' selected as THE image proxy, it's a misconfiguration.
         console.warn(`[App/buildProxiedGetUrlForApp] 'vercel_serverless' proxy mode used for external URL '${targetUrl}'. This is typically for /api/get-thread. Using direct fetch for this URL.`);
         return targetUrl;
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
        // Basic check for GeminiDvachConversation to give a summary
        if ('botSystemPromptUsed' in data && 'triggerPostNum' in data && 'id' in data && 'history' in data) {
            const convo = data as GeminiDvachConversation;
            return `GeminiDvachConversation (ID: ${convo.id}, Trigger: >>${convo.triggerPostNum}, Status: ${convo.status}, LastBotReply: >>${convo.lastBotReplyNum || 'N/A'}, Hist: ${convo.history?.length || 0})`;
        }
        // Basic check for DvachPost
        if ('num' in data && 'comment' in data && 'timestamp' in data && !('threads' in data)) {
            const post = data as DvachPost;
            return `DvachPost (Num: >>${post.num}, Files: ${post.files?.length || 0}, Comment: "${post.comment.substring(0,50).replace(/<[^>]+>/g, '')}...")`;
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


// Helper to parse JSON from Gemini, potentially cleaning markdown fences
function parseGeminiJsonResponse<T>(responseText: string): T | null {
  let jsonStr = responseText.trim();
  const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
  const match = jsonStr.match(fenceRegex);
  if (match && match[2]) {
    jsonStr = match[2].trim();
  }

  try {
    const parsedData = JSON.parse(jsonStr);
    return parsedData as T;
  } catch (e) {
    console.error("Failed to parse JSON response from Gemini:", e, "Original text:", responseText);
    try {
        const cleaned = jsonStr
          .replace(/,\s*([}\]])/g, '$1') // Remove trailing commas before closing brace/bracket
          .replace(/\\n/g, "\\n") // Keep newlines escaped for JSON parser
          .replace(/\\"/g, "\\\"") // Keep quotes escaped
          .replace(/[“”]/g, '"') // Normalize quotes
          .replace(/[‘’]/g, "'"); 
        return JSON.parse(cleaned) as T;
    } catch (e2) {
        console.error("Failed to parse JSON after basic cleaning:", e2, "Cleaned text for parsing:", jsonStr);
    }
    return null;
  }
}


const App: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(() => {
    const savedSettings = localStorage.getItem(APP_SETTINGS_KEY);
    const initialSettings = savedSettings ? JSON.parse(savedSettings) : {};
    // Ensure all keys from DEFAULT_APP_SETTINGS are present, and types are correct
    const mergedSettings: AppSettings = { 
        ...DEFAULT_APP_SETTINGS, 
        ...initialSettings,
        // Explicitly handle potentially problematic or number-parsed fields
        maxImagesToAnalyzePerPost: initialSettings.maxImagesToAnalyzePerPost === undefined ? DEFAULT_APP_SETTINGS.maxImagesToAnalyzePerPost : Number(initialSettings.maxImagesToAnalyzePerPost),
        autonomousBotCycleIntervalSeconds: initialSettings.autonomousBotCycleIntervalSeconds === undefined ? DEFAULT_APP_SETTINGS.autonomousBotCycleIntervalSeconds : Number(initialSettings.autonomousBotCycleIntervalSeconds),
        geminiTemperature: initialSettings.geminiTemperature === undefined ? DEFAULT_APP_SETTINGS.geminiTemperature : Number(initialSettings.geminiTemperature),
        geminiTopP: initialSettings.geminiTopP === undefined ? DEFAULT_APP_SETTINGS.geminiTopP : Number(initialSettings.geminiTopP),
        geminiTopK: initialSettings.geminiTopK === undefined ? DEFAULT_APP_SETTINGS.geminiTopK : Number(initialSettings.geminiTopK),
        geminiMaxOutputTokens: initialSettings.geminiMaxOutputTokens === undefined ? DEFAULT_APP_SETTINGS.geminiMaxOutputTokens : Number(initialSettings.geminiMaxOutputTokens),
        geminiThinkingBudget: initialSettings.geminiThinkingBudget === undefined ? DEFAULT_APP_SETTINGS.geminiThinkingBudget : Number(initialSettings.geminiThinkingBudget),
        // Booleans
        geminiAnalyzeOpMedia: initialSettings.geminiAnalyzeOpMedia === undefined ? DEFAULT_APP_SETTINGS.geminiAnalyzeOpMedia : !!initialSettings.geminiAnalyzeOpMedia,
        geminiAnalyzeAnonMedia: initialSettings.geminiAnalyzeAnonMedia === undefined ? DEFAULT_APP_SETTINGS.geminiAnalyzeAnonMedia : !!initialSettings.geminiAnalyzeAnonMedia,
        geminiReplyWithGeneratedImage: initialSettings.geminiReplyWithGeneratedImage === undefined ? DEFAULT_APP_SETTINGS.geminiReplyWithGeneratedImage : !!initialSettings.geminiReplyWithGeneratedImage,
        botAnalyzesImagesInTriggerPosts: initialSettings.botAnalyzesImagesInTriggerPosts === undefined ? DEFAULT_APP_SETTINGS.botAnalyzesImagesInTriggerPosts : !!initialSettings.botAnalyzesImagesInTriggerPosts,
        autonomousBotAllowReplyToSelf: initialSettings.autonomousBotAllowReplyToSelf === undefined ? DEFAULT_APP_SETTINGS.autonomousBotAllowReplyToSelf : !!initialSettings.autonomousBotAllowReplyToSelf,
        useSearchGrounding: initialSettings.useSearchGrounding === undefined ? DEFAULT_APP_SETTINGS.useSearchGrounding : !!initialSettings.useSearchGrounding,
        useThinkingBudget: initialSettings.useThinkingBudget === undefined ? DEFAULT_APP_SETTINGS.useThinkingBudget : !!initialSettings.useThinkingBudget,
        // User agent generation
        userAgent: initialSettings.userAgent || generateUserAgent(),
    };
     // Ensure API key source logic based on environment
    if (processEnvApiKey && mergedSettings.geminiApiKeySource === 'env' && !initialSettings.userGeminiApiKey) {
      // Env key exists, source is env, user key is empty -> OK
    } else if (!processEnvApiKey && mergedSettings.geminiApiKeySource === 'env') {
      mergedSettings.geminiApiKeySource = 'user'; // Env key not found, but source was env -> switch to user
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
            const entries: [string, any][] = JSON.parse(saved);
            return new Map(entries.map(([key, convoData]) => {
                return [key, { 
                  geminiChatInstance: undefined, 
                  ...convoData 
                } as GeminiDvachConversation]; 
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
  const [currentBotOpMediaCache, setCurrentBotOpMediaCache] = useState<BotOpMediaCache | null>(null);


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
  }, [settings.geminiApiKeySource, settings.userGeminiApiKey, processEnvApiKey, addLog, activeTab]); // Added activeTab to condition log message

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
      const data: DvachThreadResponse = await getThreadData(
        boardToFetch, 
        threadToFetch, 
        settings.proxyModeForGET, // Uses proxy for thread data specifically
        settings.customProxyUrlForGET, 
        settings.userAgent
      );
      
      const posts = data.threads?.[0]?.posts || [];
      if(!isBotCycle) {
        setCurrentFetchedDvachPosts(posts); 
        addLog(`Successfully fetched ${posts.length} posts from /${boardToFetch}/${threadToFetch}.`, 'success');
        if (threadPostsContainerRef.current) threadPostsContainerRef.current.scrollTop = 0;
        if (!isBotCycle && (settings.board !== boardToFetch || settings.threadId !== threadToFetch)) {
            // Update default manual ops board/thread if fetch was successful for different ones
            // handleUpdateSettings({ board: boardToFetch, threadId: threadToFetch }); // This might be too aggressive, user might be exploring
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

  // Common function for posting to Dvach, used by manual post and Gemini replies
  // Parameters:
  // - boardToPost: The board ID (e.g., "b")
  // - threadIdForDvachApi: Dvach's 'thread' field. OP's post number for existing thread, or "0" for new thread.
  // - replyToPostNumForDvachApi: Optional. Dvach's 'parent' field. Specific post number being replied to.
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
      // These parameters map to what /api/dvach-post expects as client-provided fields
      const result = await postWithSessionCookie(
        dvachSessionCookies,
        boardToPost,
        threadIdForDvachApi, // Will be 'thread_id_for_dvach' in serverless
        comment,
        file,
        replyToPostNumForDvachApi, // Will be 'parent_num_for_dvach' in serverless
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
        thread: threadIdForDvachApi === "0" ? newPostNum : threadIdForDvachApi, // If new thread, thread ID is the new post num
        parent: replyToPostNumForDvachApi, // The specific post replied to, if any
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
      // For Dvach API, 'thread' is OP number, or "0" for new thread.
      const threadTargetForDvach = currentThreadId && currentThreadId !== "0" ? currentThreadId : "0";
      // No specific parent reply num for a simple post unless UI is changed to allow it.
      await commonPostToDvach(postText, postFile, postUseSage, currentBoard, threadTargetForDvach, undefined);
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
    if (!currentBoard || !currentThreadId) { addLog('Current board or thread ID not set for manual reply.', 'error'); return; }

    setGeminiLoading(true);
    addLog(`Gemini preparing manual reply to post >>${targetPost.num} on /${currentBoard}/${currentThreadId}...`, 'gemini');
    
    let systemInstructionForReply = settings.geminiSystemInstruction || DEFAULT_APP_SETTINGS.geminiSystemInstruction;
    if (!systemInstructionForReply.toLowerCase().includes(">>post_number")) { 
        systemInstructionForReply += " If quoting another post, start your reply with '>>POST_NUMBER\\n'.";
    }
    
    let threadContextSummary = "No additional thread context available from viewer.";
    const opPost = currentFetchedDvachPosts.find(p => p.num === currentThreadId || p.op === 1);
    if (opPost) {
        threadContextSummary = `Thread OP (>>${opPost.num}): "${(opPost.comment || "N/A").replace(/<[^>]*>?/gm, '').substring(0,150)}..."\n`;
        if (opPost.files && opPost.files.length > 0) {
            threadContextSummary += `OP Post has ${opPost.files.length} file(s) (e.g. "${opPost.files[0].name}").\n`;
        }
    }
    const recentPostsText = currentFetchedDvachPosts
        .filter(p => p.num !== targetPost.num) // Exclude the target post itself from "recent" context
        .slice(-3) // Take last 3 other posts
        .map(p => `>>${p.num}: "${p.comment.replace(/<[^>]*>?/gm, '').substring(0,70)}..."`)
        .join('\n');
    if (recentPostsText) threadContextSummary += `Some recent posts in thread context:\n${recentPostsText}\n`;


    let userPromptText = `You are on the imageboard ${DVACH_DOMAINS[0]}/${currentBoard}/${currentThreadId}.\nOverall thread context:\n${threadContextSummary}\n\nNow, focus on crafting a reply to this specific post:\nPost >>${targetPost.num} (by ${targetPost.name || 'Anonymous'}) says:\n"${targetPost.comment.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>?/gm, '').substring(0, 1000)}"`;
    
    const geminiMessageParts: Part[] = [];
    let imageFilesToAnalyze: DvachFile[] = [];

    // Determine if media in the target post should be analyzed
    if (targetPost.files && targetPost.files.length > 0) {
        const isOpPost = targetPost.num === currentThreadId || targetPost.op === 1;
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
                // Determine the correct domain. For now, using DVACH_DOMAINS[0] as a placeholder.
                // In a multi-domain setup, this should come from where the post was fetched or settings.
                const imageBaseUrl = DVACH_DOMAINS[0]; 
                const imageUrl = `${imageBaseUrl}${dvachImageFile.path}`; 
                const proxiedImageUrl = buildProxiedGetUrlForApp(imageUrl, settings.proxyModeForImagesGET, settings.customProxyUrlForImagesGET);
                addLog(`Fetching image ${dvachImageFile.name} for Gemini analysis (manual reply) using proxy mode '${settings.proxyModeForImagesGET}' from ${proxiedImageUrl} (target: ${imageUrl})`, 'gemini');

                const imageResponse = await fetch(proxiedImageUrl);
                if (!imageResponse.ok) {
                    addLog(`Failed to fetch image "${dvachImageFile.name}" via proxy ${proxiedImageUrl}. Status: ${imageResponse.status} ${imageResponse.statusText}. Check proxy.`, 'warning');
                    throw new Error(`Failed to fetch image via proxy: ${imageResponse.status} ${imageResponse.statusText}`);
                }
                const imageBlob = await imageResponse.blob();
                
                let mimeType = imageBlob.type;
                if (!mimeType || !mimeType.startsWith('image/')) { // Fallback based on Dvach type
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
    geminiMessageParts.push({ text: userPromptText + `\n\nGenerate your reply to >>${targetPost.num}. Remember to start your reply text with ">>${targetPost.num}\\n" if you are directly quoting or addressing it.` });
    
    let geminiReplyText = "";
    try {
      const response = await ai.models.generateContent({
        model: GEMINI_TEXT_MODEL,
        contents: [{ role: 'user', parts: geminiMessageParts }],
        config: { 
          systemInstruction: systemInstructionForReply,
          temperature: settings.geminiTemperature, topP: settings.geminiTopP, 
          topK: settings.geminiTopK, maxOutputTokens: settings.geminiMaxOutputTokens,
          responseMimeType: settings.geminiResponseMimeType,
          thinkingConfig: settings.useThinkingBudget ? { thinkingBudget: settings.geminiThinkingBudget } : undefined
        }
      });
      geminiReplyText = response.text || ""; 
      // Ensure the reply starts with >>TARGET_POST_NUM if not already.
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
      // For Dvach API: 'thread' is currentThreadId (OP num), 'parent' is targetPost.num
      const newPostNumByGemini = await commonPostToDvach(geminiReplyText, finalFileToPost, postUseSage, currentBoard, currentThreadId, targetPost.num);
      
      setSentMessages(prev => prev.map(msg => 
        msg.num === newPostNumByGemini && msg.board === currentBoard && msg.thread === currentThreadId ? 
        { ...msg, isGeminiPost: true, geminiTriggerPostNum: targetPost.num, geminiGeneratedImage: !!finalFileToPost } : msg 
      ));
      addLog(`Manual Gemini reply posted as >>${newPostNumByGemini} to /${currentBoard}/${currentThreadId}.`, 'success');

    } catch (error) {
      if (! (error as Error).message.toLowerCase().includes("post failed")) { // Avoid double logging if commonPostToDvach failed
         addLog(`Error during manual Gemini reply generation or posting for >>${targetPost.num}: ${(error as Error).message}`, 'error', error);
      }
    } finally {
      setGeminiLoading(false);
    }
  };

 // Autonomous Bot useEffect
useEffect(() => {
    if (!autonomousBotActive) {
        if (autonomousBotIntervalRef.current) {
            clearInterval(autonomousBotIntervalRef.current);
            autonomousBotIntervalRef.current = null;
        }
        setAutonomousBotStatus("Inactive - Bot Stopped");
        // Don't log "stopped by user" if it was stopped due to unmet prerequisites.
        // addLog("Autonomous bot stopped.", "bot_setup"); 
        setCurrentBotOpMediaCache(null); // Clear OP media cache when bot stops
        return;
    }

    // Prerequisites check
    if (!ai || !dvachSessionCookies?.passcode_auth || !settings.autonomousBotTargetBoard || !settings.autonomousBotTargetThreadId) {
        let reason = "";
        if (!ai) reason = "Gemini AI not initialized";
        else if (!dvachSessionCookies?.passcode_auth) reason = "Not logged into Dvach";
        else if (!settings.autonomousBotTargetBoard || !settings.autonomousBotTargetThreadId) reason = "Target board/thread not set";
        
        setAutonomousBotStatus(`Inactive - ${reason}`);
        if(autonomousBotActive) { // Only log if it was supposed to be active
             addLog(`Autonomous bot cannot run: ${reason}. Stopping.`, "bot_error");
        }
        setAutonomousBotActive(false); // Ensure it's marked as inactive
        return;
    }
    
    // Clear conversation history if target thread changes for the bot
    const currentBotTargetKey = `${settings.autonomousBotTargetBoard}_${settings.autonomousBotTargetThreadId}`;
    if (geminiDvachConversations.has(currentBotTargetKey) && 
        (geminiDvachConversations.get(currentBotTargetKey)?.board !== settings.autonomousBotTargetBoard || 
         geminiDvachConversations.get(currentBotTargetKey)?.threadId !== settings.autonomousBotTargetThreadId)) {
        addAutonomousBotActivityLog(`Bot target thread changed. Clearing previous conversation context for ${currentBotTargetKey}.`, 'bot_setup');
        setGeminiDvachConversations(prev => {
            const newMap = new Map(prev);
            newMap.delete(currentBotTargetKey); // Or archive it if needed later
            return newMap;
        });
        setCurrentBotOpMediaCache(null); // Clear OP media cache on thread change
    }


    const runBotCycle = async () => {
        if (!autonomousBotActive || !ai || !dvachSessionCookies?.passcode_auth) { // Re-check active status
             addAutonomousBotActivityLog("Бот остановлен в начале цикла: отсутствует критическое условие (AI, логин).", 'bot_error');
             setAutonomousBotActive(false);
             return;
        }

        const currentBotSettings = { ...settings }; // Capture current settings for this cycle
        
        if (!currentBotSettings.autonomousBotTargetBoard || !currentBotSettings.autonomousBotTargetThreadId) {
            addAutonomousBotActivityLog("Целевая доска/тред для бота не установлены в настройках этого цикла. Остановка бота.", 'bot_error');
            setAutonomousBotStatus("Ошибка: Целевая доска/тред не установлены.");
            setAutonomousBotActive(false);
            return;
        }
        
        const botTargetKey = `${currentBotSettings.autonomousBotTargetBoard}_${currentBotSettings.autonomousBotTargetThreadId}`;
        let currentConversation = geminiDvachConversations.get(botTargetKey);

        setAutonomousBotStatus(`Активен - Цикл для /${currentBotSettings.autonomousBotTargetBoard}/${currentBotSettings.autonomousBotTargetThreadId}...`);
        addAutonomousBotActivityLog(`Начало цикла бота. Режим: ${currentBotSettings.autonomousBotReplyMode}. Цель: /${currentBotSettings.autonomousBotTargetBoard}/${currentBotSettings.autonomousBotTargetThreadId}`, 'bot_activity');

        try {
            const threadPostsResponse = await getThreadData(
                currentBotSettings.autonomousBotTargetBoard,
                currentBotSettings.autonomousBotTargetThreadId,
                currentBotSettings.proxyModeForGET,
                currentBotSettings.customProxyUrlForGET,
                currentBotSettings.userAgent
            );

            if (!threadPostsResponse || threadPostsResponse.threads?.[0]?.posts?.length === 0) {
                addAutonomousBotActivityLog("Посты не найдены или ошибка при загрузке треда. Пропуск цикла.", 'bot_warning');
                setAutonomousBotStatus("Ошибка загрузки данных треда для бота.");
                if (currentConversation) {
                    currentConversation.lastCheckedTimestamp = Date.now();
                    setGeminiDvachConversations(prev => new Map(prev).set(botTargetKey, currentConversation!));
                }
                return;
            }
            const allPostsInThread = threadPostsResponse.threads[0].posts;
            const opPost = allPostsInThread.find(p => p.num === currentBotSettings.autonomousBotTargetThreadId || p.op === 1);

            // Initialize or update conversation context
            if (!currentConversation || currentConversation.status === 'archived') {
                addAutonomousBotActivityLog(`Создание нового контекста беседы для треда ${botTargetKey}.`, 'bot_setup');
                const opPostText = opPost?.comment.replace(/<[^>]+>/g, '').substring(0, 1000) || "N/A";
                currentConversation = {
                    id: botTargetKey,
                    board: currentBotSettings.autonomousBotTargetBoard,
                    threadId: currentBotSettings.autonomousBotTargetThreadId,
                    triggerPostNum: opPost?.num || currentBotSettings.autonomousBotTargetThreadId, // OP is initial trigger
                    botSystemPromptUsed: currentBotSettings.autonomousBotSystemPrompt,
                    history: [{ role: 'system', parts: [{text: `Initial context for thread /${currentBotSettings.autonomousBotTargetBoard}/${currentBotSettings.autonomousBotTargetThreadId}. OP Post (>>${opPost?.num || 'N/A'}): ${opPostText}`}], timestamp: Date.now(), id: `system-init-${Date.now()}` }],
                    lastCheckedTimestamp: Date.now(),
                    participatingPostNumbers: [opPost?.num || currentBotSettings.autonomousBotTargetThreadId],
                    status: 'context_built',
                    initialContext: { opPostText: opPostText, opPostMediaParts: [] },
                };
            } else {
                 currentConversation.lastCheckedTimestamp = Date.now();
                 // Naive new posts addition: add text of all new posts to history
                 const knownPostNumbers = new Set(currentConversation.history.flatMap(msg => msg.parts.filter(p => p.text?.startsWith(">>")).map(p => p.text!.split("\n")[0].substring(2))));
                 allPostsInThread.forEach(p => {
                    if (!knownPostNumbers.has(p.num)) {
                        currentConversation!.history.push({id: p.num, role: 'user', parts: [{text: `New post in thread >>${p.num} (by ${p.name || 'Anon'}): ${p.comment.replace(/<[^>]+>/g, '').substring(0,300)}`}], timestamp: p.timestamp * 1000 });
                        knownPostNumbers.add(p.num);
                    }
                 });
                 if (currentConversation.history.length > 50) { // Prune history
                    currentConversation.history = [currentConversation.history[0], ...currentConversation.history.slice(-49)];
                 }

            }

            // OP Media Cache Update (Moved inside cycle, as OP post content might change, though less likely)
            if (opPost && currentBotSettings.geminiAnalyzeOpMedia &&
                (!currentBotOpMediaCache || currentBotOpMediaCache.threadId !== currentBotSettings.autonomousBotTargetThreadId || currentBotOpMediaCache.opPostNum !== opPost.num)) {
                addAutonomousBotActivityLog(`Обновление/создание кэша медиа ОП-поста (>>${opPost.num})...`, 'bot_setup');
                const opMediaPartsAccumulator: Part[] = [];
                let opMediaContextTextAccumulator = "";
                if (opPost.files && opPost.files.length > 0) {
                    const imagesToAnalyzeForOp = opPost.files
                        .filter(f => f.type === 1 || f.type === 2 || f.type === 4 || f.type === 9) // Common image types
                        .slice(0, currentBotSettings.maxImagesToAnalyzePerPost);
                    
                    for (const file of imagesToAnalyzeForOp) {
                        try {
                            const imageUrl = `${DVACH_DOMAINS[0]}${file.path}`; // Assuming DVACH_DOMAINS[0] for now
                            const proxiedImageUrl = buildProxiedGetUrlForApp(imageUrl, currentBotSettings.proxyModeForImagesGET, currentBotSettings.customProxyUrlForImagesGET);
                            addAutonomousBotActivityLog(`Фетчинг изображения ОП-поста ${file.name} (>>${opPost.num}) используя прокси '${currentBotSettings.proxyModeForImagesGET}' с URL: ${proxiedImageUrl}`, 'bot_activity');
                            const imgResp = await fetch(proxiedImageUrl);
                            if (!imgResp.ok) throw new Error(`Proxy fetch failed for OP image ${file.name}: ${imgResp.status} ${imgResp.statusText}`);
                            const blob = await imgResp.blob();
                            let mimeType = blob.type;
                            if (!mimeType || !mimeType.startsWith('image/')) {
                                mimeType = file.type === 1 ? 'image/jpeg' : file.type === 2 ? 'image/png' : file.type === 4 ? 'image/gif' : file.type === 9 ? 'image/webp' : 'image/jpeg';
                            }
                            const base64 = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onloadend = () => res((r.result as string).split(',')[1]); r.onerror = rej; r.readAsDataURL(blob); });
                            opMediaPartsAccumulator.push({ inlineData: { mimeType: mimeType, data: base64 } });
                            opMediaContextTextAccumulator += ` Изображение в ОП-посте '${file.name}'.`;
                        } catch (e) {
                            addAutonomousBotActivityLog(`Ошибка загрузки/обработки изображения ОП-поста ${file.name}: ${(e as Error).message}`, 'bot_warning');
                        }
                    }
                }
                setCurrentBotOpMediaCache({ threadId: currentBotSettings.autonomousBotTargetThreadId, opPostNum: opPost.num, mediaParts: opMediaPartsAccumulator, mediaContextText: opMediaContextTextAccumulator });
                if (currentConversation.initialContext) currentConversation.initialContext.opPostMediaParts = opMediaPartsAccumulator;
                addAutonomousBotActivityLog(`Кэш медиа ОП-поста обновлен. ${opMediaPartsAccumulator.length} изображений.`, 'bot_setup');
            } else if (!opPost || !currentBotSettings.geminiAnalyzeOpMedia) {
                setCurrentBotOpMediaCache(null); // No OP or not analyzing OP media
                if (currentConversation.initialContext) currentConversation.initialContext.opPostMediaParts = [];
            }
            
            // Bot logic for different modes
            if (currentBotSettings.autonomousBotReplyMode === 'random_in_thread') {
                setAutonomousBotStatus("Режим 'random_in_thread': Поиск цели...");
                const botPostNumbers = new Set(sentMessages
                    .filter(sm => sm.isGeminiPost && sm.board === currentBotSettings.autonomousBotTargetBoard && sm.thread === currentBotSettings.autonomousBotTargetThreadId)
                    .map(sm => sm.num));

                const eligiblePosts = allPostsInThread.filter(p => 
                    p.num !== opPost?.num && // Don't reply to OP in this mode for now (can be changed)
                    (!botPostNumbers.has(p.num) || currentBotSettings.autonomousBotAllowReplyToSelf) && // Don't reply to self unless allowed
                    !BUMP_KEYWORDS.some(kw => p.comment.toLowerCase().includes(kw)) &&
                    !currentConversation!.participatingPostNumbers.includes(p.num) // Avoid re-replying in same convo context immediately
                );

                if (eligiblePosts.length === 0) {
                    addAutonomousBotActivityLog("Нет подходящих постов для случайного ответа в этом цикле (все посты либо ОП, либо свои, либо уже отвечены в этой сессии, либо бамп).", 'bot_activity');
                } else {
                    const targetPost = eligiblePosts[Math.floor(Math.random() * eligiblePosts.length)];
                    addAutonomousBotActivityLog(`Бот выбрал случайный пост >>${targetPost.num} для ответа.`, 'bot_activity');
                    setAutonomousBotStatus(`Генерация ответа на >>${targetPost.num}...`);

                    const geminiCallParts: Part[] = [];
                    let promptForBot = `Контекст треда: ОП-пост (>>${currentBotOpMediaCache?.opPostNum || opPost?.num || 'N/A'}) говорит: "${currentBotOpMediaCache?.mediaContextText || opPost?.comment.replace(/<[^>]+>/g, '').substring(0,200) || 'N/A'}".\n`;
                    
                    if (currentBotOpMediaCache?.mediaParts && currentBotOpMediaCache.mediaParts.length > 0) {
                        geminiCallParts.push(...currentBotOpMediaCache.mediaParts);
                    }
                    
                    const precedingPosts = allPostsInThread.filter(p => parseInt(p.num) < parseInt(targetPost.num)).slice(-2); // Max 2 preceding posts
                    if (precedingPosts.length > 0) {
                        promptForBot += "Несколько предыдущих постов:\n" + precedingPosts.map(p => `>>${p.num}: "${p.comment.replace(/<[^>]+>/g, '').substring(0,100)}..."`).join("\n") + "\n";
                    }

                    promptForBot += `Пост, на который нужно ответить (>>${targetPost.num}): "${targetPost.comment.replace(/<[^>]+>/g, '').substring(0, 500)}". `;

                    if (currentBotSettings.botAnalyzesImagesInTriggerPosts && targetPost.files && targetPost.files.length > 0) {
                        const imagesInTarget = targetPost.files.filter(f => f.type === 1 || f.type === 2 || f.type === 4 || f.type === 9).slice(0, currentBotSettings.maxImagesToAnalyzePerPost);
                        for (const file of imagesInTarget) {
                             try {
                                const imageUrl = `${DVACH_DOMAINS[0]}${file.path}`;
                                const proxiedImageUrl = buildProxiedGetUrlForApp(imageUrl, currentBotSettings.proxyModeForImagesGET, currentBotSettings.customProxyUrlForImagesGET);
                                addAutonomousBotActivityLog(`Фетчинг изображения ${file.name} из поста >>${targetPost.num} используя прокси '${currentBotSettings.proxyModeForImagesGET}'`, 'bot_activity');
                                const imgResp = await fetch(proxiedImageUrl);
                                if (!imgResp.ok) throw new Error(`Proxy fetch failed for target image ${file.name}: ${imgResp.status}`);
                                const blob = await imgResp.blob();
                                let mimeType = blob.type;
                                if (!mimeType || !mimeType.startsWith('image/')) {
                                     mimeType = file.type === 1 ? 'image/jpeg' : file.type === 2 ? 'image/png' : file.type === 4 ? 'image/gif' : file.type === 9 ? 'image/webp' : 'image/jpeg';
                                }
                                const base64 = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onloadend = () => res((r.result as string).split(',')[1]); r.onerror = rej; r.readAsDataURL(blob); });
                                geminiCallParts.push({ inlineData: { mimeType: mimeType, data: base64 } });
                                promptForBot += ` Этот пост содержит изображение '${file.name}'.`;
                            } catch (e) {
                                addAutonomousBotActivityLog(`Ошибка загрузки изображения ${file.name} из поста >>${targetPost.num}: ${(e as Error).message}`, 'bot_warning');
                            }
                        }
                    }
                    geminiCallParts.push({ text: promptForBot + `\nСгенерируй свой ответ в указанном JSON формате.` });
                    
                    const geminiApiResponse = await ai.models.generateContent({
                        model: GEMINI_TEXT_MODEL,
                        contents: [{role: 'user', parts: geminiCallParts}],
                        config: {
                            systemInstruction: currentBotSettings.autonomousBotSystemPrompt,
                            temperature: 0.85, topK: 50, topP: 0.95, maxOutputTokens: 768,
                            responseMimeType: "application/json", // Critical for parsing
                            thinkingConfig: currentBotSettings.useThinkingBudget ? { thinkingBudget: currentBotSettings.geminiThinkingBudget } : undefined,
                        }
                    });

                    const textToParse = geminiApiResponse.text;
                    if (typeof textToParse === 'string') {
                        const parsedReply = parseGeminiJsonResponse<BotReplySchema>(textToParse);
                        if (parsedReply && parsedReply.replyText) {
                            let rawReplyText = parsedReply.replyText;
                            const replyMatch = rawReplyText.match(/^>>(\d+)\n([\s\S]*)/);

                            if (replyMatch && replyMatch[1] && replyMatch[2]) {
                                const replyTargetNum = replyMatch[1];
                                const botActualComment = replyMatch[2].trim();

                                if (replyTargetNum !== targetPost.num) {
                                    addAutonomousBotActivityLog(`Внимание: Gemini указал в JSON другой номер поста (>>${replyTargetNum}) для ответа, ожидался >>${targetPost.num}. Используется номер из JSON.`, 'bot_warning');
                                }
                                
                                addAutonomousBotActivityLog(`Бот сгенерировал (JSON) ответ для >>${replyTargetNum}: ${botActualComment.substring(0, 70)}...`);
                                
                                let finalFileToPostForBot: File | null = null;
                                if (currentBotSettings.geminiReplyWithGeneratedImage) {
                                   addLog(`Бот пытается сгенерировать изображение для ответа >>${replyTargetNum}...`, 'gemini');
                                   // Simplified prompt for image generation
                                   const imageGenPromptText = `Изображение для ответа на имиджборде: "${botActualComment.substring(0,150)}"`;
                                   try {
                                       const imgGenResp = await ai.models.generateImages({ model: GEMINI_IMAGE_MODEL, prompt: imageGenPromptText, config: { numberOfImages: 1, outputMimeType: 'image/jpeg' } });
                                       if (imgGenResp.generatedImages?.[0]?.image?.imageBytes) {
                                           finalFileToPostForBot = await base64ToFile(imgGenResp.generatedImages[0].image.imageBytes, `bot_img_${Date.now()}.jpg`, imgGenResp.generatedImages[0].image.mimeType || 'image/jpeg');
                                           addLog(`Бот сгенерировал изображение для ответа >>${replyTargetNum}.`, 'gemini');
                                       } else { addLog(`Генерация изображения ботом не удалась или не вернула изображение для >>${replyTargetNum}.`, 'bot_warning');}
                                   } catch (imgErrBot) { addLog(`Ошибка генерации изображения ботом для >>${replyTargetNum}: ${(imgErrBot as Error).message}.`, 'bot_warning'); }
                                }

                                const newPostNum = await commonPostToDvach(botActualComment, finalFileToPostForBot, false, currentBotSettings.autonomousBotTargetBoard, currentBotSettings.autonomousBotTargetThreadId, replyTargetNum);
                                setSentMessages(prev => [{ num: newPostNum, timestamp: Date.now(), comment: botActualComment, board: currentBotSettings.autonomousBotTargetBoard, thread: currentBotSettings.autonomousBotTargetThreadId, parent: replyTargetNum, isGeminiPost: true, geminiTriggerPostNum: targetPost.num, geminiGeneratedImage: !!finalFileToPostForBot }, ...prev]);
                                currentConversation!.participatingPostNumbers.push(targetPost.num, newPostNum);
                                currentConversation!.lastBotReplyNum = newPostNum;
                                setAutonomousBotStatus(`Ответил как >>${newPostNum} на >>${replyTargetNum}`);
                            } else {
                                addAutonomousBotActivityLog(`Ошибка парсинга replyText из JSON от Gemini для >>${targetPost.num}. Формат не ">>NUMBER\\nTEXT". Ответ: ${rawReplyText.substring(0,100)}`, 'bot_warning');
                            }
                        } else {
                            addAutonomousBotActivityLog(`Ошибка парсинга JSON ответа Gemini или отсутствует replyText для >>${targetPost.num}. Ответ: ${textToParse.substring(0,200)}`, 'bot_warning');
                        }
                    } else {
                         addAutonomousBotActivityLog(`Ответ Gemini не содержит текстовой части для >>${targetPost.num}. Ответ: ${JSON.stringify(geminiApiResponse)}`, 'bot_warning');
                    }
                }
            } else if (currentBotSettings.autonomousBotReplyMode === 'replies_to_bot') {
                 addAutonomousBotActivityLog("Режим 'replies_to_bot' требует дополнительной доработки для полноценной работы с новым JSON-форматом и управлением сессиями.", 'bot_warning');
                 // TODO: Implement logic for 'replies_to_bot' mode.
                 // This would involve:
                 // 1. Identifying posts that reply to the bot's own posts (from sentMessages).
                 // 2. Building context from the bot's original post and the reply.
                 // 3. Using the Gemini chat instance if available in currentConversation.
            }
            
            setGeminiDvachConversations(prev => new Map(prev).set(botTargetKey, currentConversation!));
            setAutonomousBotStatus(`Ожидание (${currentBotSettings.autonomousBotCycleIntervalSeconds}с) /${currentBotSettings.autonomousBotTargetBoard}/${currentBotSettings.autonomousBotTargetThreadId}`);
            addAutonomousBotActivityLog("Цикл бота завершен.", 'bot_activity');

        } catch (error) {
            const errorMsg = (error as Error).message;
            addAutonomousBotActivityLog(`Критическая ошибка в цикле бота: ${errorMsg}`, 'bot_error', error);
            setAutonomousBotStatus(`Ошибка в цикле: ${errorMsg.substring(0, 50)}...`);
            if(currentConversation) {
                currentConversation.status = 'error';
                currentConversation.lastCheckedTimestamp = Date.now();
                setGeminiDvachConversations(prev => new Map(prev).set(botTargetKey, currentConversation!));
            }
        }
    };

    addLog(`Автономный бот запускается... Интервал: ${settings.autonomousBotCycleIntervalSeconds}с. Режим: ${settings.autonomousBotReplyMode}. Цель: /${settings.autonomousBotTargetBoard}/${settings.autonomousBotTargetThreadId}`, 'bot_setup');
    setAutonomousBotStatus("Активен - Подготовка к первому циклу...");
    
    // Initial run with a short delay, then interval
    const initialTimeoutId = setTimeout(() => {
        if (autonomousBotActive) runBotCycle(); // Check active status again before running
    }, 3000); 

    autonomousBotIntervalRef.current = setInterval(() => {
      if (autonomousBotActive) runBotCycle(); // Check active status again before running
    }, settings.autonomousBotCycleIntervalSeconds * 1000) as unknown as number;

    return () => { // Cleanup on component unmount or when botActive/dependencies change
        clearTimeout(initialTimeoutId);
        if (autonomousBotIntervalRef.current) {
            clearInterval(autonomousBotIntervalRef.current);
            autonomousBotIntervalRef.current = null;
        }
        addLog("Интервал автономного бота остановлен (из-за useEffect cleanup).", "bot_setup");
    };
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [autonomousBotActive, ai, dvachSessionCookies, settings.autonomousBotTargetBoard, settings.autonomousBotTargetThreadId, settings.autonomousBotReplyMode, settings.autonomousBotCycleIntervalSeconds]); // Dependencies refined
  
  const toggleTheme = () => {
    const newTheme = settings.theme === 'light' ? 'dark' : settings.theme === 'dark' ? 'system' : 'light';
    handleUpdateSettings({ theme: newTheme });
  };

  const ThemeIconComponent: React.FC<React.SVGProps<SVGSVGElement>> = (props) => {
    if (settings.theme === 'dark') return <IconMoon {...props} />;
    if (settings.theme === 'light') return <IconSun {...props} />;
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    return prefersDark ? <IconMoon {...props} /> : <IconSun {...props} />;
  };


  const renderDvachPostCard = (post: DvachPost, index: number) => {
     const sentMessageData = sentMessages.find(m => m.num === post.num && m.board === currentBoard && m.thread === currentThreadId);
     const isMyPost = !!sentMessageData;
     const isGeminiPostByBot = sentMessageData?.isGeminiPost || false;

     const isGeminiReplyToThis = sentMessages.some(m => m.geminiTriggerPostNum === post.num && m.isGeminiPost);
    
     const cardBg = isMyPost
       ? (isGeminiPostByBot ? "bg-purple-50 dark:bg-purple-900/50" : "bg-blue-50 dark:bg-blue-900/50")
       : "bg-gray-50 dark:bg-gray-700";

     const borderColor = isMyPost
       ? isGeminiPostByBot 
         ? "border-purple-300 dark:border-purple-700"
         : "border-blue-300 dark:border-blue-700"
       : "border-gray-200 dark:border-gray-600";

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
            // Assuming currentDvachDomain or a fixed one for media for now
            const imageBaseUrl = DVACH_DOMAINS[0]; 
            const fileUrl = `${imageBaseUrl}${file.path}`;
            const thumbUrl = `${imageBaseUrl}${file.thumbnail}`;
            const proxiedThumbUrl = buildProxiedGetUrlForApp(thumbUrl, settings.proxyModeForImagesGET, settings.customProxyUrlForImagesGET);

            return (
            <a key={fileIndex} href={fileUrl} target="_blank" rel="noopener noreferrer" className="block w-24 h-24 group relative">
              <img 
                src={proxiedThumbUrl}
                alt={file.name || `file ${fileIndex + 1}`} 
                className="rounded object-cover w-full h-full border border-gray-300 dark:border-gray-500 group-hover:opacity-80 transition-opacity"
                loading="lazy"
                onError={(e) => { 
                    addLog(`Failed to load thumbnail via proxy '${settings.proxyModeForImagesGET}': ${proxiedThumbUrl} (original: ${thumbUrl}). Attempting direct.`, 'warning');
                    (e.target as HTMLImageElement).src = thumbUrl; 
                    (e.target as HTMLImageElement).onerror = null; 
                }}
              />
              <div className="absolute bottom-0 left-0 bg-black bg-opacity-50 text-white text-xs p-0.5 truncate w-full group-hover:opacity-100 opacity-0 transition-opacity">
                {file.name} ({file.size}KB) {/* Assuming size is in KB from API */}
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
        {!settings.purchasedPasscode && !dvachSessionCookies?.passcode_auth && <p className="text-xs text-red-500 mt-1">Purchased Passcode not set in Settings. Login disabled.</p>}
         {fetchError && (fetchError.includes("Login failed") || fetchError.includes("Dvach login error") || fetchError.includes("session cookie")) && <p className="text-xs text-red-500 mt-1">{fetchError}</p>}
      </div>

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
                    (!settings.autonomousBotTargetBoard || !settings.autonomousBotTargetThreadId) ? "Bot target board/thread not set (see below or in Settings)" :
                    autonomousBotActive ? "Stop Bot" : "Start Bot"
                }
            >
                {autonomousBotActive ? <IconPlayerStop className="mr-2 h-5 w-5"/> : <IconPlayerPlay className="mr-2 h-5 w-5"/>}
                {autonomousBotActive ? 'Stop Bot' : 'Start Bot'}
            </button>
        </div>
      </div>
      
      <div className="p-4 border rounded-md border-gray-200 dark:border-gray-700 space-y-3">
        <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">Bot Target Configuration</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">Set the board and thread ID for the autonomous bot to operate in. These settings are also available in the main Settings tab.</p>
        <div>
            <label htmlFor="botPanelTargetBoard" className="block text-sm font-medium">Bot Target Board (e.g., b):</label>
            <input 
                id="botPanelTargetBoard" 
                type="text" 
                value={settings.autonomousBotTargetBoard} 
                onChange={e => handleUpdateSettings({ autonomousBotTargetBoard: e.target.value })} 
                className="mt-1 w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 focus:ring-1 focus:ring-purple-500"
            />
        </div>
        <div>
            <label htmlFor="botPanelTargetThreadId" className="block text-sm font-medium">Bot Target Thread ID:</label>
            <input 
                id="botPanelTargetThreadId" 
                type="text" 
                value={settings.autonomousBotTargetThreadId} 
                onChange={e => handleUpdateSettings({ autonomousBotTargetThreadId: e.target.value })} 
                className="mt-1 w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 focus:ring-1 focus:ring-purple-500"
            />
        </div>
      </div>


       {(!ai || !dvachSessionCookies?.passcode_auth || !settings.autonomousBotTargetBoard || !settings.autonomousBotTargetThreadId) &&
        <div className="p-3 bg-yellow-100 dark:bg-yellow-800 border-l-4 border-yellow-500 text-yellow-700 dark:text-yellow-200 rounded-md text-sm">
            <p className="font-semibold">Bot cannot start due to missing prerequisites:</p>
            <ul className="list-disc list-inside ml-4 text-xs">
                {!ai && <li>Gemini AI not initialized (check API key in Settings).</li>}
                {!dvachSessionCookies?.passcode_auth && <li>Not logged into Dvach (login on Manual Ops tab).</li>}
                {(!settings.autonomousBotTargetBoard || !settings.autonomousBotTargetThreadId) && <li>Bot's target board/thread ID not set (see fields above or in Settings).</li>}
            </ul>
        </div>
      }

      <div className="p-4 border rounded-md border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium mb-2 text-gray-700 dark:text-gray-300">Bot Status & Activity</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Current Status: <span className="font-semibold">{autonomousBotStatus}</span></p>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            Target: <span className="font-semibold">/{settings.autonomousBotTargetBoard || "[Not Set]"}/{settings.autonomousBotTargetThreadId || "[Not Set]"}</span> | 
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
        <h3 className="text-lg font-medium mb-2 text-gray-700 dark:text-gray-300">Active Gemini-Dvach Conversations (Bot)</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Lists conversation contexts managed by the bot. Click ID to view details in main logs.</p>
        <div className="max-h-80 overflow-y-auto custom-scrollbar">
            {geminiDvachConversations.size === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center">No active bot conversation contexts tracked.</p>
            ) : (
                Array.from(geminiDvachConversations.values())
                  .sort((a: GeminiDvachConversation, b: GeminiDvachConversation) => {
                    const tsA = typeof a?.lastCheckedTimestamp === 'number' ? a.lastCheckedTimestamp : 0;
                    const tsB = typeof b?.lastCheckedTimestamp === 'number' ? b.lastCheckedTimestamp : 0;
                    return tsB - tsA;
                  })
                  .map((convo: GeminiDvachConversation) => (
                    convo && convo.id ? (
                      <div key={convo.id} className="p-2 mb-2 border rounded-md bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 text-xs">
                          <p>
                              ID: <button onClick={() => addLog("Bot Conversation Context Details:", 'info', convo)} className="text-blue-500 hover:underline truncate" title="Click to see full details in Logs tab">{convo.id}</button>
                          </p>
                          <p>Trigger/Seed: <span className="font-semibold">&gt;&gt;{convo.triggerPostNum}</span> on <span className="font-semibold">/{convo.board}/{convo.threadId}</span> {convo.isBotSeedConversation ? "(Bot Seed)" : ""}</p>
                          <p>Status: <span className="font-semibold">{convo.status}</span> | Last Bot Reply: <span className="font-semibold">&gt;&gt;{convo.lastBotReplyNum || 'N/A'}</span></p>
                          <p>History Length: {convo.history?.length || 0} | Last Checked: {new Date(convo.lastCheckedTimestamp).toLocaleTimeString()}</p>
                      </div>
                    ) : null
                ))
            )}
        </div>
         <button 
            onClick={() => {
                if(window.confirm("Are you sure you want to clear all tracked bot conversation contexts? This cannot be undone.")){
                    setGeminiDvachConversations(new Map());
                    addLog("All Gemini-Dvach bot conversation contexts cleared by user.", "bot_warning");
                }
            }}
            disabled={geminiDvachConversations.size === 0}
            className="mt-2 px-3 py-1 text-xs bg-red-500 hover:bg-red-600 text-white rounded-md font-medium flex items-center shadow disabled:opacity-50 transition-colors"
        >
            <IconTrash className="mr-1 h-4 w-4"/> Clear All Tracked Conversation Contexts
        </button>
      </div>
       <p className="text-xs text-gray-500 dark:text-gray-400">Other bot settings (persona, reply mode, image analysis) can be configured in the main "Settings" tab.</p>
    </div>
  );

  const renderSettingsPanel = () => {
    const isCustomUrlForGetEditable = settings.proxyModeForGET === 'custom_general_prefix' || settings.proxyModeForGET === 'custom_general_param' || settings.proxyModeForGET === 'custom_go_x2u' || settings.proxyModeForGET === 'custom_cors_anywhere' || settings.proxyModeForGET === 'custom_codetabs';
    const isCustomUrlForImagesEditable = settings.proxyModeForImagesGET === 'custom_general_prefix' || settings.proxyModeForImagesGET === 'custom_general_param' || settings.proxyModeForImagesGET === 'custom_go_x2u' || settings.proxyModeForImagesGET === 'custom_cors_anywhere' || settings.proxyModeForImagesGET === 'custom_codetabs';
    const currentYear = new Date().getFullYear();

    return (
      <div className="space-y-8 p-4 md:p-6 bg-white dark:bg-gray-800 shadow-xl rounded-lg">
        <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-200 border-b-2 pb-3 border-gray-300 dark:border-gray-700">Application Settings</h2>

        {/* Dvach Authentication Settings */}
        <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
          <h3 className="text-xl font-semibold mb-3 text-gray-700 dark:text-gray-300">Dvach Authentication</h3>
          <div>
            <label htmlFor="settingsPurchasedPasscode" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Purchased Passcode:</label>
            <input id="settingsPurchasedPasscode" type="password" value={settings.purchasedPasscode} onChange={e => handleUpdateSettings({ purchasedPasscode: e.target.value })} className="mt-1 w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-indigo-500"/>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Required for posting and some bot functions.</p>
          </div>
        </div>

        {/* Gemini API Key Settings */}
        <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
          <h3 className="text-xl font-semibold mb-3 text-gray-700 dark:text-gray-300">Gemini API Configuration</h3>
          <div>
            <label htmlFor="geminiApiKeySource" className="block text-sm font-medium text-gray-700 dark:text-gray-300">API Key Source:</label>
            <select id="geminiApiKeySource" value={settings.geminiApiKeySource} onChange={e => handleUpdateSettings({geminiApiKeySource: e.target.value as 'env' | 'user'})} className="mt-1 w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-indigo-500">
              <option value="env">Environment Variable (VITE_GEMINI_API_KEY) {processEnvApiKey ? `(Detected: ${processEnvApiKey.substring(0,4)}...${processEnvApiKey.substring(processEnvApiKey.length - 4)})` : "(Not Detected/Accessible)"}</option>
              <option value="user">Enter API Key Manually</option>
            </select>
          </div>
          {settings.geminiApiKeySource === 'user' && (
            <div className="mt-3">
              <label htmlFor="userGeminiApiKey" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Manual Gemini API Key:</label>
              <input id="userGeminiApiKey" type="password" placeholder="Enter your Gemini API Key" value={settings.userGeminiApiKey} onChange={e => handleUpdateSettings({userGeminiApiKey: e.target.value})} className="mt-1 w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-indigo-500"/>
            </div>
          )}
        </div>
        
        {/* User Agent Settings */}
         <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
          <h3 className="text-xl font-semibold mb-3 text-gray-700 dark:text-gray-300">User Agent</h3>
            <div>
                <label htmlFor="settingsUserAgent" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Current User Agent:</label>
                <textarea id="settingsUserAgent" value={settings.userAgent} onChange={e => handleUpdateSettings({ userAgent: e.target.value })} rows={2} className="mt-1 w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-indigo-500 font-mono text-xs"/>
                <button onClick={() => handleUpdateSettings({ userAgent: generateUserAgent() })} className="mt-2 px-3 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded-md shadow transition-colors">
                    <IconRefresh className="inline mr-1 h-4 w-4"/> Regenerate
                </button>
            </div>
        </div>


        {/* Proxy Settings */}
        <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
          <h3 className="text-xl font-semibold mb-3 text-gray-700 dark:text-gray-300">Proxy Configuration</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Serverless functions (`/api/*`) are used for posting and potentially thread data fetching, bypassing these client-side GET proxies for those operations. These settings primarily affect direct client-side fetching of images or thread data if 'vercel_serverless' is not chosen for thread GETs.</p>
          
          <div className="space-y-4">
            {/* Proxy for GET Thread Data */}
            <div>
              <label htmlFor="settingsProxyModeForGET" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Proxy for Thread Data (GET):</label>
              <select 
                id="settingsProxyModeForGET" 
                value={settings.proxyModeForGET} 
                onChange={e => {
                    const mode = e.target.value as ProxyModeForGET;
                    let url = settings.customProxyUrlForGET;
                    if(mode === 'custom_cors_anywhere' && (url === "" || url === PROXY_URL_GO_X2U_BASE || url === PROXY_URL_CODETABS_BASE)) url = DEFAULT_CORS_ANYWHERE_PROXY;
                    else if(mode === 'custom_go_x2u' && (url === "" || url === DEFAULT_CORS_ANYWHERE_PROXY || url === PROXY_URL_CODETABS_BASE)) url = PROXY_URL_GO_X2U_BASE;
                    else if(mode === 'custom_codetabs' && (url === "" || url === DEFAULT_CORS_ANYWHERE_PROXY || url === PROXY_URL_GO_X2U_BASE)) url = PROXY_URL_CODETABS_BASE;
                    handleUpdateSettings({ proxyModeForGET: mode, customProxyUrlForGET: url });
                }}
                className="mt-1 w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-indigo-500"
              >
                <option value="vercel_serverless">Vercel Serverless Function (/api/get-thread) (Recommended)</option>
                <option value="custom_cors_anywhere">Custom CORS-Anywhere like Proxy</option>
                <option value="custom_go_x2u">Custom Go.x2u.in like Proxy</option>
                <option value="custom_codetabs">Custom CodeTabs API like Proxy</option>
                <option value="custom_general_prefix">Custom General Prefix Proxy</option>
                <option value="custom_general_param">Custom General Parameter Proxy</option>
                <option value="none">No Proxy (Direct Fetch - Not Recommended)</option>
              </select>
              {isCustomUrlForGetEditable && (
                 <input 
                  type="text" 
                  placeholder="Enter Custom Proxy URL for Thread Data"
                  value={settings.customProxyUrlForGET} 
                  onChange={e => handleUpdateSettings({ customProxyUrlForGET: e.target.value })} 
                  className="mt-2 w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-indigo-500"
                />
              )}
            </div>

            {/* Proxy for Images */}
            <div>
              <label htmlFor="settingsProxyModeForImagesGET" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Proxy for Images/Media (GET):</label>
              <select 
                id="settingsProxyModeForImagesGET" 
                value={settings.proxyModeForImagesGET} 
                onChange={e => {
                    const mode = e.target.value as ProxyModeForGET;
                    let url = settings.customProxyUrlForImagesGET;
                    if(mode === 'custom_cors_anywhere' && (url === "" || url === PROXY_URL_GO_X2U_BASE || url === PROXY_URL_CODETABS_BASE)) url = DEFAULT_CORS_ANYWHERE_PROXY;
                    else if(mode === 'custom_go_x2u' && (url === "" || url === DEFAULT_CORS_ANYWHERE_PROXY || url === PROXY_URL_CODETABS_BASE)) url = PROXY_URL_GO_X2U_BASE;
                    else if(mode === 'custom_codetabs' && (url === "" || url === DEFAULT_CORS_ANYWHERE_PROXY || url === PROXY_URL_GO_X2U_BASE)) url = PROXY_URL_CODETABS_BASE;
                    handleUpdateSettings({ proxyModeForImagesGET: mode, customProxyUrlForImagesGET: url });
                }}
                className="mt-1 w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-indigo-500"
              >
                <option value="custom_codetabs">Custom CodeTabs API like Proxy (Default for Images)</option>
                <option value="custom_cors_anywhere">Custom CORS-Anywhere like Proxy</option>
                <option value="custom_go_x2u">Custom Go.x2u.in like Proxy</option>
                <option value="custom_general_prefix">Custom General Prefix Proxy</option>
                <option value="custom_general_param">Custom General Parameter Proxy</option>
                <option value="none">No Proxy (Direct Fetch - May fail for cross-origin images)</option>
                 <option value="vercel_serverless" disabled>Vercel Serverless (Not applicable for direct image fetches)</option>
              </select>
              {isCustomUrlForImagesEditable && (
                <input 
                  type="text" 
                  placeholder="Enter Custom Proxy URL for Images"
                  value={settings.customProxyUrlForImagesGET} 
                  onChange={e => handleUpdateSettings({ customProxyUrlForImagesGET: e.target.value })} 
                  className="mt-2 w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-indigo-500"
                />
              )}
            </div>
          </div>
        </div>

        {/* Global Gemini Interaction Settings */}
        <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
            <h3 className="text-xl font-semibold mb-3 text-gray-700 dark:text-gray-300">Global Gemini Interaction Settings</h3>
            <div className="space-y-3">
                <label className="flex items-center">
                    <input type="checkbox" checked={settings.geminiReplyWithGeneratedImage} onChange={e => handleUpdateSettings({ geminiReplyWithGeneratedImage: e.target.checked })} className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 mr-2"/>
                    <span>Gemini: Generate image with replies (Manual & Bot)</span>
                </label>
                <div>
                    <label htmlFor="maxImagesToAnalyzePerPost" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Max images to analyze per post (Manual & Bot):</label>
                    <input id="maxImagesToAnalyzePerPost" type="number" min="0" max="5" value={settings.maxImagesToAnalyzePerPost} onChange={e => handleUpdateSettings({ maxImagesToAnalyzePerPost: parseInt(e.target.value,10) })} className="mt-1 w-full md:w-1/3 p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-indigo-500"/>
                </div>
                 <label className="flex items-center">
                    <input type="checkbox" checked={settings.geminiAnalyzeOpMedia} onChange={e => handleUpdateSettings({ geminiAnalyzeOpMedia: e.target.checked })} className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 mr-2"/>
                    <span>Manual Reply: Analyze media in OP post</span>
                </label>
                <label className="flex items-center">
                    <input type="checkbox" checked={settings.geminiAnalyzeAnonMedia} onChange={e => handleUpdateSettings({ geminiAnalyzeAnonMedia: e.target.checked })} className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 mr-2"/>
                    <span>Manual Reply: Analyze media in non-OP (anonymous) posts</span>
                </label>
                {/* <label className="flex items-center opacity-50 cursor-not-allowed">
                    <input type="checkbox" checked={settings.analyzeVideosInTriggerPosts} onChange={e => handleUpdateSettings({ analyzeVideosInTriggerPosts: e.target.checked })} className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 mr-2" disabled/>
                    <span>Analyze videos in trigger posts (Placeholder - Not Implemented)</span>
                </label> */}
            </div>
        </div>

        {/* Autonomous Bot Settings */}
        <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
            <h3 className="text-xl font-semibold mb-3 text-gray-700 dark:text-gray-300">Autonomous Bot Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="botTargetBoard" className="block text-sm font-medium">Target Board:</label>
                    <input id="botTargetBoard" type="text" value={settings.autonomousBotTargetBoard} onChange={e => handleUpdateSettings({ autonomousBotTargetBoard: e.target.value })} className="mt-1 w-full p-2 input-style"/>
                </div>
                <div>
                    <label htmlFor="botTargetThreadId" className="block text-sm font-medium">Target Thread ID:</label>
                    <input id="botTargetThreadId" type="text" value={settings.autonomousBotTargetThreadId} onChange={e => handleUpdateSettings({ autonomousBotTargetThreadId: e.target.value })} className="mt-1 w-full p-2 input-style"/>
                </div>
            </div>
            <div className="mt-3">
                <label htmlFor="botSystemPrompt" className="block text-sm font-medium">Bot System Prompt (Persona & JSON Format Instructions):</label>
                <textarea id="botSystemPrompt" value={settings.autonomousBotSystemPrompt} onChange={e => handleUpdateSettings({ autonomousBotSystemPrompt: e.target.value })} rows={6} className="mt-1 w-full p-2 input-style font-mono text-xs"/>
            </div>
             <div className="mt-3">
                <label htmlFor="botReplyMode" className="block text-sm font-medium">Bot Reply Mode:</label>
                <select id="botReplyMode" value={settings.autonomousBotReplyMode} onChange={e => handleUpdateSettings({autonomousBotReplyMode: e.target.value as AutonomousBotReplyMode})} className="mt-1 w-full p-2 input-style">
                    <option value="random_in_thread">Randomly reply to posts in thread</option>
                    <option value="replies_to_bot">Reply to posts that mention/reply to the bot (WIP)</option>
                </select>
            </div>
            <div className="mt-3">
                <label htmlFor="botCycleInterval" className="block text-sm font-medium">Bot Cycle Interval (seconds):</label>
                <input id="botCycleInterval" type="number" min="30" value={settings.autonomousBotCycleIntervalSeconds} onChange={e => handleUpdateSettings({ autonomousBotCycleIntervalSeconds: parseInt(e.target.value,10) })} className="mt-1 w-full md:w-1/3 p-2 input-style"/>
            </div>
            <div className="mt-3 space-y-2">
                 <label className="flex items-center">
                    <input type="checkbox" checked={settings.botAnalyzesImagesInTriggerPosts} onChange={e => handleUpdateSettings({ botAnalyzesImagesInTriggerPosts: e.target.checked })} className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 mr-2"/>
                    <span>Bot: Analyze images in posts it replies to</span>
                </label>
                <label className="flex items-center">
                    <input type="checkbox" checked={settings.autonomousBotAllowReplyToSelf} onChange={e => handleUpdateSettings({ autonomousBotAllowReplyToSelf: e.target.checked })} className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 mr-2"/>
                    <span>Bot: Allow replying to its own previous posts</span>
                </label>
            </div>
        </div>
        
        {/* Gemini Model Configuration */}
        <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
            <h3 className="text-xl font-semibold mb-3 text-gray-700 dark:text-gray-300">Gemini Model Parameters (Manual Reply / Advanced)</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">These settings primarily affect the "Reply with Gemini" button in the thread viewer. The autonomous bot may use its own optimized settings or ones defined in its system prompt.</p>
            <div className="space-y-3">
                <div>
                    <label htmlFor="geminiSystemInstruction" className="block text-sm font-medium">System Instruction (Manual Reply):</label>
                    <textarea id="geminiSystemInstruction" value={settings.geminiSystemInstruction} onChange={e => handleUpdateSettings({ geminiSystemInstruction: e.target.value })} rows={3} className="mt-1 w-full p-2 input-style"/>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                        <label htmlFor="geminiTemperature" className="block text-sm font-medium">Temperature:</label>
                        <input id="geminiTemperature" type="number" step="0.05" min="0" max="1" value={settings.geminiTemperature} onChange={e => handleUpdateSettings({ geminiTemperature: parseFloat(e.target.value) })} className="mt-1 w-full p-2 input-style"/>
                    </div>
                    <div>
                        <label htmlFor="geminiTopP" className="block text-sm font-medium">Top P:</label>
                        <input id="geminiTopP" type="number" step="0.01" min="0" max="1" value={settings.geminiTopP} onChange={e => handleUpdateSettings({ geminiTopP: parseFloat(e.target.value) })} className="mt-1 w-full p-2 input-style"/>
                    </div>
                    <div>
                        <label htmlFor="geminiTopK" className="block text-sm font-medium">Top K:</label>
                        <input id="geminiTopK" type="number" step="1" min="1" value={settings.geminiTopK} onChange={e => handleUpdateSettings({ geminiTopK: parseInt(e.target.value,10) })} className="mt-1 w-full p-2 input-style"/>
                    </div>
                    <div>
                        <label htmlFor="geminiMaxOutputTokens" className="block text-sm font-medium">Max Output Tokens:</label>
                        <input id="geminiMaxOutputTokens" type="number" step="64" min="64" value={settings.geminiMaxOutputTokens} onChange={e => handleUpdateSettings({ geminiMaxOutputTokens: parseInt(e.target.value,10) })} className="mt-1 w-full p-2 input-style"/>
                    </div>
                </div>
                 <div>
                    <label htmlFor="geminiResponseMimeType" className="block text-sm font-medium">Response MIME Type:</label>
                    <select id="geminiResponseMimeType" value={settings.geminiResponseMimeType} onChange={e => handleUpdateSettings({geminiResponseMimeType: e.target.value as 'text/plain' | 'application/json'})} className="mt-1 w-full p-2 input-style">
                        <option value="text/plain">text/plain</option>
                        <option value="application/json">application/json (Experimental, ensure prompt requests JSON)</option>
                    </select>
                </div>
                <label className="flex items-center">
                    <input type="checkbox" checked={settings.useSearchGrounding} onChange={e => handleUpdateSettings({ useSearchGrounding: e.target.checked })} className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 mr-2"/>
                    <span>Use Google Search Grounding (Experimental, text model only, check docs for compatibility)</span>
                </label>
                <label className="flex items-center">
                    <input type="checkbox" checked={settings.useThinkingBudget} onChange={e => handleUpdateSettings({ useThinkingBudget: e.target.checked })} className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 mr-2"/>
                    <span>Use Thinking Budget (Disable for low latency, e.g. set budget to 0)</span>
                </label>
                {settings.useThinkingBudget && (
                     <div>
                        <label htmlFor="geminiThinkingBudget" className="block text-sm font-medium">Thinking Budget (0-1000ms, 0 to disable thinking):</label>
                        <input id="geminiThinkingBudget" type="number" step="50" min="0" max="1000" value={settings.geminiThinkingBudget} onChange={e => handleUpdateSettings({ geminiThinkingBudget: parseInt(e.target.value,10) })} className="mt-1 w-full md:w-1/3 p-2 input-style"/>
                    </div>
                )}
            </div>
        </div>


        <p className="text-xs text-gray-500 dark:text-gray-400 mt-6 text-center">Settings are saved automatically to local storage. Version: {APP_VERSION} &copy; {currentYear}</p>
      </div>
    );
  };

  const renderLogsPanel = () => (
    <div className="space-y-6 p-4 md:p-6 bg-white dark:bg-gray-800 shadow-xl rounded-lg">
      <div className="flex justify-between items-center border-b-2 pb-3 border-gray-300 dark:border-gray-700">
        <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-200">Event Logs</h2>
        <button 
            onClick={() => { if(window.confirm("Are you sure you want to clear all logs?")) setLogs([]); }}
            className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-md font-medium flex items-center shadow-md disabled:opacity-50 transition-colors"
            title="Clear all logs"
            disabled={logs.length === 0}
        >
            <IconTrash className="mr-2 h-5 w-5"/> Clear Logs
        </button>
      </div>
      <div className="max-h-[70vh] overflow-y-auto bg-gray-50 dark:bg-gray-900/70 p-3 rounded-md custom-scrollbar border border-gray-200 dark:border-gray-700 shadow-inner">
        {logs.length === 0 && <p className="text-center text-gray-500 dark:text-gray-400 py-10">No logs yet. Interact with the app to generate logs.</p>}
        {logs.map(log => {
          let bgColor, textColor, borderColorClass;
          switch(log.type) {
            case 'error': case 'bot_error': bgColor = 'bg-red-100 dark:bg-red-900'; textColor = 'text-red-800 dark:text-red-200'; borderColorClass = 'border-red-500'; break;
            case 'success': bgColor = 'bg-green-100 dark:bg-green-900'; textColor = 'text-green-800 dark:text-green-200'; borderColorClass = 'border-green-500'; break;
            case 'warning': case 'bot_warning': bgColor = 'bg-yellow-100 dark:bg-yellow-800'; textColor = 'text-yellow-800 dark:text-yellow-200'; borderColorClass = 'border-yellow-500'; break;
            case 'gemini': bgColor = 'bg-purple-100 dark:bg-purple-900'; textColor = 'text-purple-800 dark:text-purple-200'; borderColorClass = 'border-purple-500'; break;
            case 'dvach': case 'auth': bgColor = 'bg-blue-100 dark:bg-blue-900'; textColor = 'text-blue-800 dark:text-blue-200'; borderColorClass = 'border-blue-500'; break;
            case 'bot_activity': case 'bot_setup': bgColor = 'bg-teal-100 dark:bg-teal-900'; textColor = 'text-teal-800 dark:text-teal-200'; borderColorClass = 'border-teal-500'; break;
            default: bgColor = 'bg-gray-100 dark:bg-gray-700'; textColor = 'text-gray-800 dark:text-gray-200'; borderColorClass = 'border-gray-500';
          }
          const logDataString = formatLogDataForDisplay(log.data);
          return (
            <div key={log.id} className={`text-xs p-2 mb-1.5 rounded-md border-l-4 ${borderColorClass} ${bgColor} ${textColor} shadow-sm font-mono`}>
              <span className="font-semibold">[{new Date(log.timestamp).toLocaleTimeString()}] [{log.type.toUpperCase()}]</span>: {log.message}
              {log.data ? (
                <pre className="mt-1 text-xs whitespace-pre-wrap bg-black/5 dark:bg-black/20 p-1.5 rounded-sm overflow-x-auto custom-scrollbar-thin">
                  {logDataString}
                </pre>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
  
  // Main App Return
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-300 font-sans">
      <header className="bg-white dark:bg-gray-800 shadow-md p-4 sticky top-0 z-50">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">Dvach Gemini Bot <span className="text-xs align-super">v{APP_VERSION}</span></h1>
          <div className="flex items-center space-x-4">
            {settings.userAgent && <span className="text-xs text-gray-500 dark:text-gray-400 hidden md:block" title={settings.userAgent}>UA: {settings.userAgent.length > 40 ? settings.userAgent.substring(0,40) + '...' : settings.userAgent}</span>}
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

      <nav className="bg-gray-50 dark:bg-gray-800/80 backdrop-blur-sm border-b border-t border-gray-200 dark:border-gray-700 sticky top-[72px] z-40"> {/* Adjusted top for typical header height */}
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
              className={`flex items-center px-3 sm:px-4 py-3 text-sm font-medium border-b-2 transition-all duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:z-10
                ${activeTab === tab.id
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
            >
              <tab.icon aria-hidden="true" className="h-5 w-5 mr-1.5 sm:mr-2 flex-shrink-0" />
              <span className="truncate">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>

      <main className="container mx-auto p-4 md:p-6" role="main">
        <div className="mt-4">
            {activeTab === 'dvach' && renderDvachBotPanel()}
            {activeTab === 'bot_control' && renderAutonomousBotControlPanel()}
            {activeTab === 'settings' && renderSettingsPanel()}
            {activeTab === 'logs' && renderLogsPanel()}
        </div>
      </main>

      <footer className="text-center py-6 border-t border-gray-200 dark:border-gray-700 mt-10">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Dvach Gemini Bot Interface - Version {APP_VERSION} - Use responsibly.
        </p>
      </footer>
    </div>
  );
};

export default App;
