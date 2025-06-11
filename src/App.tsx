
/// <reference types="vite/client" />
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { GoogleGenAI, Part } from "@google/genai"; // Removed unused GeminiChatInstance, CreateChatOptions, SendMessageRequest
import {
  AppSettings, LogEntry, DvachPost, SentMessageInfo, ChatMessage, ProxyModeForGET,
  DvachThreadResponse, 
  DvachFile, GeminiDvachConversation,
  DvachSessionCookies, AutonomousBotPersonalityPreset, AutonomousBotReplyMode,
  GeminiChat // Keep GeminiChat from ./types
} from './types'; 
import { getThreadData, loginToDvach, postWithSessionCookie, base64ToFile, extractDvachApiError } from './services/dvachService';
import { 
  APP_SETTINGS_KEY, SENT_MESSAGES_KEY, APP_VERSION,
  GEMINI_TEXT_MODEL, GEMINI_IMAGE_MODEL, MAX_LOG_ENTRIES, MAX_SENT_MESSAGES_STORED,
  GEMINI_DVACH_CONVERSATIONS_KEY, DVACH_SESSION_COOKIES_KEY,
  PROXY_URL_GO_X2U_BASE, DEFAULT_CORS_ANYWHERE_PROXY, DVACH_DOMAINS, DEFAULT_USER_AGENT
} from './constants';
import { generateUserAgent } from './utils/userAgentGenerator'; 

import {
  IconSettings, IconTerminal, IconSend, IconTrash, IconSun, IconMoon, IconCpu, 
  IconSparkles, IconAlertTriangle, IconRefresh, 
  IconLogin, IconLogout, IconUserCircle, IconPlayerPlay, IconPlayerStop, IconMessageChat
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
  userAgent: DEFAULT_USER_AGENT,

  geminiAnalyzeOpMedia: true,
  geminiAnalyzeAnonMedia: false,
  geminiReplyWithGeneratedImage: false, // For both manual and bot
  
  // Autonomous Bot specific settings
  autonomousBotTargetBoard: "b",
  autonomousBotTargetThreadId: "",
  autonomousBotSystemPrompt: "You are an insightful and witty anonymous user on a popular imageboard. Your replies should be relevant, concise, and in the typical style of the board. If quoting a post, use '>>POST_NUMBER\\n' format. Keep your replies relatively short and engaging.",
  botAnalyzesImagesInTriggerPosts: true,
  autonomousBotReplyMode: 'random_in_thread', 
  autonomousBotCycleIntervalSeconds: 75, 
  autonomousBotPersonalityPreset: 'default', 


  geminiSystemInstruction: "You are a witty and insightful anonymous user on the 2ch.hk imageboard. Your replies should be relevant, concise, and in the typical style of the board. If quoting, use '>>POST_NUMBER\\n'.", // For manual replies
  geminiTemperature: 0.8,
  geminiTopP: 0.95,
  geminiTopK: 40,
  geminiMaxOutputTokens: 1024,
  geminiResponseMimeType: "text/plain", // For old generic tool, not used now
  useSearchGrounding: false, // For old generic tool, not used now
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

function buildProxiedGetUrlForApp(
  targetUrl: string, 
  proxyMode: ProxyModeForGET,
  customProxyUrl?: string
): string {
  if (!targetUrl.startsWith('http')) { 
    console.warn(`[App/buildProxiedUrl] targetUrl '${targetUrl}' is not a full URL. Returning as is.`);
    return targetUrl;
  }
  switch (proxyMode) {
    case 'vercel_serverless':
      // This mode is for /api/get-thread. For direct image GETs, it's not applicable unless customProxyUrl is also set for images.
      if (customProxyUrl) { // If a custom proxy is *also* set, assume it's for non-API GETs like images
         if (customProxyUrl.startsWith(PROXY_URL_GO_X2U_BASE.split('?')[0])) return `${customProxyUrl}${encodeURIComponent(targetUrl)}`;
         if (customProxyUrl.startsWith('http') && customProxyUrl.includes('cors-anywhere')) return customProxyUrl.endsWith('/') ? `${customProxyUrl}${targetUrl}` : `${customProxyUrl}/${targetUrl}`;
         if (customProxyUrl.endsWith('=')) return `${customProxyUrl}${encodeURIComponent(targetUrl)}`; // Param style for custom
         return customProxyUrl.endsWith('/') ? `${customProxyUrl}${targetUrl}` : `${customProxyUrl}/${targetUrl}`; // Prefix style for custom
      }
      console.warn(`[App/buildProxiedUrl] 'vercel_serverless' proxy mode selected, but no custom proxy specified for external GET to '${targetUrl}'. Attempting direct fetch. This might fail due to CORS.`);
      return targetUrl; 

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
        console.warn(`[App/buildProxiedUrl] Custom general param proxy mode, but URL '${customProxyUrl}' is invalid. Using direct.`);
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
        userAgent: initialSettings.userAgent || generateUserAgent(),
        purchasedPasscode: initialSettings.purchasedPasscode || DEFAULT_APP_SETTINGS.purchasedPasscode,
        autonomousBotTargetBoard: initialSettings.autonomousBotTargetBoard || DEFAULT_APP_SETTINGS.autonomousBotTargetBoard,
        autonomousBotTargetThreadId: initialSettings.autonomousBotTargetThreadId || DEFAULT_APP_SETTINGS.autonomousBotTargetThreadId,
        autonomousBotSystemPrompt: initialSettings.autonomousBotSystemPrompt || DEFAULT_APP_SETTINGS.autonomousBotSystemPrompt,
        botAnalyzesImagesInTriggerPosts: initialSettings.botAnalyzesImagesInTriggerPosts === undefined ? DEFAULT_APP_SETTINGS.botAnalyzesImagesInTriggerPosts : initialSettings.botAnalyzesImagesInTriggerPosts,
        geminiSystemInstruction: initialSettings.geminiSystemInstruction || DEFAULT_APP_SETTINGS.geminiSystemInstruction,
        // Ensure enum types have defaults if not in saved settings or if enum changed
        autonomousBotReplyMode: initialSettings.autonomousBotReplyMode || DEFAULT_APP_SETTINGS.autonomousBotReplyMode,
        autonomousBotPersonalityPreset: initialSettings.autonomousBotPersonalityPreset || DEFAULT_APP_SETTINGS.autonomousBotPersonalityPreset,
        autonomousBotCycleIntervalSeconds: initialSettings.autonomousBotCycleIntervalSeconds || DEFAULT_APP_SETTINGS.autonomousBotCycleIntervalSeconds,
        geminiReplyWithGeneratedImage: initialSettings.geminiReplyWithGeneratedImage === undefined ? DEFAULT_APP_SETTINGS.geminiReplyWithGeneratedImage : initialSettings.geminiReplyWithGeneratedImage,
    };
    if (processEnvApiKey && mergedSettings.geminiApiKeySource === 'env' && !initialSettings.userGeminiApiKey) {
      // Preserve empty user key if env is source
    } else if (!processEnvApiKey && mergedSettings.geminiApiKeySource === 'env') {
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

  const [geminiLoading, setGeminiLoading] = useState<boolean>(false); // General Gemini loading for manual replies
  
  const [autonomousBotActive, setAutonomousBotActive] = useState<boolean>(false);
  const [autonomousBotStatus, setAutonomousBotStatus] = useState<string>("Inactive");
  const [autonomousBotActivityLog, setAutonomousBotActivityLog] = useState<string[]>([]);
  const [geminiDvachConversations, setGeminiDvachConversations] = useState<Map<string, GeminiDvachConversation>>(() => {
    const saved = localStorage.getItem(GEMINI_DVACH_CONVERSATIONS_KEY);
    if (saved) {
        const entries: [string, Omit<GeminiDvachConversation, 'geminiChatInstance'> & { history: ChatMessage[] }][] = JSON.parse(saved);
        return new Map(entries.map(([key, convoData]) => {
            // GeminiChatInstance will be re-initialized on demand if needed by the bot
            return [key, { ...convoData, geminiChatInstance: undefined }]; 
        }));
    }
    return new Map();
  });
  const autonomousBotIntervalRef = useRef<number | null>(null);


  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info', data?: unknown) => {
    setLogs(prevLogs => [{ id: Date.now().toString(), timestamp: Date.now(), message, type, data }, ...prevLogs.slice(0, MAX_LOG_ENTRIES - 1)]);
    const consoleMethod = type === 'error' ? console.error : type === 'warning' ? console.warn : console.log;
    consoleMethod(`[${type.toUpperCase()}] ${message}`, data !== undefined ? data : "");
  }, []);

  const addPostActivity = useCallback((message: string) => {
    setPostActivityLog(prev => [ `[${new Date().toLocaleTimeString()}] ${message}`, ...prev.slice(0, 9)]);
  }, []);

  const addAutonomousBotActivityLog = useCallback((message: string) => {
    setAutonomousBotActivityLog(prev => [ `[${new Date().toLocaleTimeString()}] ${message}`, ...prev.slice(0, 49)]);
     addLog(message, 'bot_activity');
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
      addLog('Board and Thread ID must be set to fetch thread posts.', 'warning');
      if (!isBotCycle) setCurrentFetchedDvachPosts([]);
      return null;
    }
    if (!isBotCycle) setIsFetchingThread(true);
    if (!isBotCycle) setFetchError(null);
    if (!isBotCycle) setCurrentFetchedDvachPosts([]);
    try {
      addLog(`Fetching thread /${boardToFetch}/${threadToFetch}... Proxy for GET: ${settings.proxyModeForGET}`, 'dvach');
      const data: DvachThreadResponse = await getThreadData(boardToFetch, threadToFetch, settings.proxyModeForGET, settings.customProxyUrlForGET, settings.userAgent);
      
      const posts = data.threads?.[0]?.posts || [];
      if(!isBotCycle) setCurrentFetchedDvachPosts(posts); 
      addLog(`Successfully fetched ${posts.length} posts from /${boardToFetch}/${threadToFetch}.`, 'success');
      if (!isBotCycle && threadPostsContainerRef.current) threadPostsContainerRef.current.scrollTop = 0;
      
      if (activeTab === 'dvach' && !isBotCycle) {
        handleUpdateSettings({ board: boardToFetch, threadId: threadToFetch });
      }
      return posts; 
    } catch (err) {
      const errorMsg = (err as Error).message;
      if(!isBotCycle) setFetchError(errorMsg);
      addLog(`Failed to fetch thread /${boardToFetch}/${threadToFetch}: ${errorMsg}`, 'error', err);
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
      addLog(errorMsg, 'error');
      addPostActivity(`Error: ${errorMsg}`);
      setFetchError(errorMsg);
      throw new Error(errorMsg);
    }
    if (!boardToPost || !comment.trim()) {
      const errorMsg = 'Board and Post Comment are required for posting.';
      addLog(errorMsg, 'error');
      addPostActivity(`Error: ${errorMsg}`);
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
      await commonPostToDvach(postText, postFile, postUseSage, currentBoard, currentThreadId, undefined);
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
    if (!systemInstructionForReply.includes(">>POST_NUMBER\\n")) { // Ensure quoting instruction is present
        systemInstructionForReply += " If quoting, use '>>POST_NUMBER\\n'.";
    }
    systemInstructionForReply = systemInstructionForReply.replace("POST_NUMBER", targetPost.num);
    
    let threadContextSummary = "No additional thread context available.";
    if (currentFetchedDvachPosts.length > 0) {
        const opPost = currentFetchedDvachPosts.find(p => p.num === currentThreadId || p.op === 1);
        const recentPosts = currentFetchedDvachPosts.slice(-5); 
        threadContextSummary = `Thread OP (>>${opPost?.num || currentThreadId}): "${(opPost?.comment || "N/A").replace(/<[^>]*>?/gm, '').substring(0,100)}...".\n`;
        threadContextSummary += `Recent posts include:\n` + recentPosts.map(p => `>>${p.num}: "${p.comment.replace(/<[^>]*>?/gm, '').substring(0,70)}..."`).join('\n');
    }

    let userPromptText = `Imageboard: ${DVACH_DOMAINS[0]}/${currentBoard}/${currentThreadId}\nOverall thread context:\n${threadContextSummary}\n\nNow, focus on this specific post:\nPost >>${targetPost.num} (by ${targetPost.name || 'Anonymous'}) says:\n"${targetPost.comment.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>?/gm, '').substring(0, 1000)}"`;
    
    const geminiMessageParts: Part[] = [];
    let dvachImageToAnalyze: DvachFile | null = null;

    if (targetPost.files && targetPost.files.length > 0) {
        if ((settings.geminiAnalyzeOpMedia && targetPost.op === 1) || (settings.geminiAnalyzeAnonMedia && targetPost.op !== 1)) {
            dvachImageToAnalyze = targetPost.files[0]; 
        }
    }

    if (dvachImageToAnalyze) {
        userPromptText += `\n\nThe post >>${targetPost.num} includes media file "${dvachImageToAnalyze.name}". Please analyze this image as part of your reply generation.`;
        try {
            const imageUrl = `${DVACH_DOMAINS[0]}${dvachImageToAnalyze.path}`; 
            const proxiedImageUrl = buildProxiedGetUrlForApp(imageUrl, settings.proxyModeForGET, settings.customProxyUrlForGET);
            addLog(`Fetching image ${dvachImageToAnalyze.name} for Gemini analysis (manual reply) from ${proxiedImageUrl} (target: ${imageUrl})`, 'gemini');

            const imageResponse = await fetch(proxiedImageUrl);
            if (!imageResponse.ok) throw new Error(`Failed to fetch image: ${imageResponse.status} ${imageResponse.statusText} from ${proxiedImageUrl}`);
            const imageBlob = await imageResponse.blob();
            
            let mimeType = dvachImageToAnalyze.type === 1 ? 'image/jpeg' : 
                           dvachImageToAnalyze.type === 2 ? 'image/png' : 
                           dvachImageToAnalyze.type === 4 ? 'image/gif' : 
                           imageBlob.type; 
            if (!mimeType.startsWith('image/')) mimeType = 'image/jpeg'; 

            const base64data = await new Promise<string>((resolveP, rejectP) => {
                const reader = new FileReader();
                reader.onloadend = () => resolveP((reader.result as string).split(',')[1]);
                reader.onerror = rejectP;
                reader.readAsDataURL(imageBlob);
            });
            geminiMessageParts.push({ inlineData: { mimeType: mimeType, data: base64data } });
            addLog(`Image "${dvachImageToAnalyze.name}" successfully prepared for Gemini (manual reply).`, 'gemini');
        } catch (imgError) {
            addLog(`Failed to fetch or process image "${dvachImageToAnalyze.name}" for Gemini (manual reply): ${(imgError as Error).message}. Proceeding with text only for image part.`, 'warning', imgError);
            userPromptText += ` (Note: Image analysis failed due to error: ${(imgError as Error).message.substring(0,100)}... rely on text description if available).`;
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
          topK: settings.geminiTopK, maxOutputTokens: settings.geminiMaxOutputTokens 
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
            const imgGenResp = await ai.models.generateImages({ model: GEMINI_IMAGE_MODEL, prompt: imagePpt, config: { numberOfImages: 1, outputMimeType: 'image/jpeg' } });
            if (imgGenResp.generatedImages?.[0]?.image?.imageBytes) {
              finalFileToPost = await base64ToFile(imgGenResp.generatedImages[0].image.imageBytes, `gemini_img_${Date.now()}.jpg`, imgGenResp.generatedImages[0].image.mimeType || 'image/jpeg');
              addLog(`Gemini generated image for manual reply to >>${targetPost.num}.`, 'gemini');
            } else { addLog(`Gemini image generation failed or no image returned for manual reply to >>${targetPost.num}.`, 'warning'); }
        } catch (imgGenError) {
            const errorMsg = (imgGenError as Error).message;
            if (errorMsg.includes("Imagen API is only accessible to billed users")) {
                addLog(`Imagen API access error for manual reply: Google indicates this is typically available only for billed accounts. Please check your Google Cloud project settings. Proceeding with text-only reply.`, 'warning', imgGenError);
            } else {
                addLog(`Gemini image generation failed for manual reply: ${errorMsg}. Posting text only.`, 'warning', imgGenError);
            }
        }
      }
      const newPostNumByGemini = await commonPostToDvach(geminiReplyText, finalFileToPost, postUseSage, currentBoard, currentThreadId, targetPost.num);
      
      setSentMessages(prev => prev.map(msg => 
        msg.num === newPostNumByGemini ? { ...msg, isGeminiPost: true, geminiTriggerPostNum: targetPost.num, geminiGeneratedImage: !!finalFileToPost } : msg 
      ));
      addLog(`Manual Gemini reply posted as >>${newPostNumByGemini} to /${currentBoard}/${currentThreadId}.`, 'success');

    } catch (error) {
      if (! (error as Error).message.toLowerCase().includes("post failed")) { // Avoid double-logging if commonPostToDvach already logged
         addLog(`Error during manual Gemini reply generation or processing for >>${targetPost.num}: ${(error as Error).message}`, 'error', error);
      }
    } finally {
      setGeminiLoading(false);
    }
  };

  // Autonomous Bot Logic
  useEffect(() => {
    if (!autonomousBotActive || !ai || !dvachSessionCookies?.passcode_auth || !settings.autonomousBotTargetBoard || !settings.autonomousBotTargetThreadId) {
      if (autonomousBotIntervalRef.current) {
        clearInterval(autonomousBotIntervalRef.current);
        autonomousBotIntervalRef.current = null;
        setAutonomousBotStatus("Inactive - Stopped or Missing Config/Login");
      }
      return;
    }

    const getModifiedBotSystemPrompt = (basePrompt: string, preset: AutonomousBotPersonalityPreset): string => {
        let prefix = "";
        switch (preset) {
            case 'concise_witty': prefix = "Your reply must be very short, witty, and punchy. Aim for one or two sentences.\n\n"; break;
            case 'elaborate_detailed': prefix = "Provide a more detailed and elaborate response. Expand on your points.\n\n"; break;
            case 'slightly_aggressive': prefix = "Adopt a mildly confrontational and assertive tone. Question the previous post if appropriate, but avoid direct insults.\n\n"; break;
            case 'sarcastic_ironic': prefix = "Employ sarcasm or irony in your response. Be subtle but clear.\n\n"; break;
            case 'neutral_informative': prefix = "Maintain a neutral and informative tone. Stick to facts or objective analysis if possible.\n\n"; break;
            case 'custom': /* For future custom input */ break;
            default: break;
        }
        return prefix + basePrompt;
    };
    
    const runBotCycle = async () => {
      if (!autonomousBotActive || !ai || !dvachSessionCookies?.passcode_auth) { // Re-check criticals
          setAutonomousBotActive(false); // Stop if criticals lost during operation
          addAutonomousBotActivityLog("Bot stopping: critical prerequisite lost (AI, Login, or Bot not active).");
          return;
      }
      setAutonomousBotStatus(`Monitoring /${settings.autonomousBotTargetBoard}/${settings.autonomousBotTargetThreadId}...`);
      addAutonomousBotActivityLog(`Checking for new posts in /${settings.autonomousBotTargetBoard}/${settings.autonomousBotTargetThreadId}... Mode: ${settings.autonomousBotReplyMode}`);

      try {
        const latestPostsInThread = await handleLoadThread(true); 
        if (!latestPostsInThread || latestPostsInThread.length === 0) {
          addAutonomousBotActivityLog("No posts found or error fetching thread for bot cycle.");
          setAutonomousBotStatus("Error fetching thread data for bot.");
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
                addAutonomousBotActivityLog(`Bot selected random post >>${randomPostToReply.num} to reply to.`);
                
                const convoId = `${settings.autonomousBotTargetBoard}-${settings.autonomousBotTargetThreadId}-${randomPostToReply.num}`;
                if (newConversationsMap.has(convoId)) {
                    addAutonomousBotActivityLog(`Conversation with >>${randomPostToReply.num} already exists, skipping for random reply.`);
                } else {
                    setAutonomousBotStatus(`Preparing reply to random post >>${randomPostToReply.num}`);
                    const modifiedSystemPrompt = getModifiedBotSystemPrompt(settings.autonomousBotSystemPrompt, settings.autonomousBotPersonalityPreset);
                    
                    const createChatOpts = { // Removed CreateChatOptions type
                        model: GEMINI_TEXT_MODEL,
                        config: { systemInstruction: modifiedSystemPrompt, temperature: 0.8, topK: 40, topP: 0.95, maxOutputTokens: 512 },
                        history: []
                    };
                    const botChat = ai.chats.create(createChatOpts); // Corrected call
                    
                    const initialUserMessageParts: Part[] = [{ text: randomPostToReply.comment.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>?/gm, '') }];
                    if (settings.botAnalyzesImagesInTriggerPosts && randomPostToReply.files && randomPostToReply.files.length > 0) {
                        const imageFile = randomPostToReply.files[0];
                        try {
                            const imageUrl = `${DVACH_DOMAINS[0]}${imageFile.path}`;
                            const proxiedImageUrl = buildProxiedGetUrlForApp(imageUrl, settings.proxyModeForGET, settings.customProxyUrlForGET);
                            const imageResponse = await fetch(proxiedImageUrl);
                            if (imageResponse.ok) {
                                const imageBlob = await imageResponse.blob();
                                const base64data = await new Promise<string>((res, rej) => { const r=new FileReader(); r.onloadend=()=>res((r.result as string).split(',')[1]); r.onerror=rej; r.readAsDataURL(imageBlob);});
                                let mimeType = imageFile.type === 1 ? 'image/jpeg' : imageFile.type === 2 ? 'image/png' : imageBlob.type;
                                if (!mimeType.startsWith('image/')) mimeType = 'image/jpeg';
                                initialUserMessageParts.unshift({ inlineData: { mimeType, data: base64data } });
                                addAutonomousBotActivityLog(`Image ${imageFile.name} from >>${randomPostToReply.num} prepared for bot.`);
                            } else { throw new Error(`Fetch failed ${imageResponse.status}`); }
                        } catch (imgErr) { addAutonomousBotActivityLog(`Error processing image from >>${randomPostToReply.num} for bot: ${(imgErr as Error).message}`); }
                    }
                    
                    const stream = await botChat.sendMessageStream({ message: { parts: initialUserMessageParts } }); // Corrected call

                    let botReplyText = "";
                    for await (const chunk of stream) { botReplyText += chunk.text || ""; }
                    
                    if (!botReplyText.trim().startsWith(`>>${randomPostToReply.num}`)) {
                        botReplyText = `>>${randomPostToReply.num}\n${botReplyText.trim()}`;
                    }
                    addAutonomousBotActivityLog(`Bot generated reply to >>${randomPostToReply.num}: ${botReplyText.substring(0,70)}...`);
                    
                    let botPostFile: File | null = null;
                    if (settings.geminiReplyWithGeneratedImage) {
                        const imgPrompt = `Visual for imageboard reply: "${botReplyText.substring(botReplyText.indexOf('\n') + 1, 150).trim()}"`;
                        try {
                            const imgResp = await ai.models.generateImages({ model: GEMINI_IMAGE_MODEL, prompt: imgPrompt, config: {numberOfImages: 1, outputMimeType: 'image/jpeg'}});
                            if (imgResp.generatedImages?.[0]?.image?.imageBytes) {
                                botPostFile = await base64ToFile(imgResp.generatedImages[0].image.imageBytes, `bot_img_${Date.now()}.jpg`, 'image/jpeg');
                                addAutonomousBotActivityLog(`Bot generated image for reply to >>${randomPostToReply.num}.`);
                            }
                        } catch (imgGenErr) {
                             const errorMsg = (imgGenErr as Error).message;
                             if (errorMsg.includes("Imagen API is only accessible to billed users")) {
                                addAutonomousBotActivityLog(`Imagen API access error for bot: Billed account needed. Proceeding text-only.`, 'warning');
                             } else {
                                addAutonomousBotActivityLog(`Bot image generation failed: ${errorMsg}. Posting text only.`, 'warning');
                             }
                        }
                    }

                    const newBotPostNum = await commonPostToDvach(botReplyText, botPostFile, false, settings.autonomousBotTargetBoard, settings.autonomousBotTargetThreadId, randomPostToReply.num);
                    botMadeAPostThisCycle = true;
                    
                    const newConvo: GeminiDvachConversation = {
                        id: convoId, board: settings.autonomousBotTargetBoard, threadId: settings.autonomousBotTargetThreadId,
                        triggerPostNum: randomPostToReply.num, botSystemPromptUsed: modifiedSystemPrompt,
                        geminiChatInstance: botChat, // Store the live instance
                        history: [
                            { id: `user-${randomPostToReply.num}`, role: 'user', parts: initialUserMessageParts, timestamp: randomPostToReply.timestamp * 1000 },
                            { id: `model-${newBotPostNum}`, role: 'model', parts: [{text: botReplyText}], timestamp: Date.now() }
                        ],
                        lastCheckedTimestamp: Date.now(), lastBotReplyNum: newBotPostNum,
                        participatingPostNumbers: [randomPostToReply.num, newBotPostNum], status: 'active'
                    };
                    newConversationsMap.set(convoId, newConvo);
                    setSentMessages(prev => [{
                        num: newBotPostNum, timestamp: Date.now(), comment: botReplyText, board: settings.autonomousBotTargetBoard, thread: settings.autonomousBotTargetThreadId, parent: randomPostToReply.num,
                        isGeminiPost: true, geminiConversationId: convoId, geminiTriggerPostNum: randomPostToReply.num, geminiGeneratedImage: !!botPostFile
                    }, ...prev]);
                    setAutonomousBotStatus(`Replied as >>${newBotPostNum} to >>${randomPostToReply.num}`);
                }
            } else { addAutonomousBotActivityLog("No new eligible posts found for random reply this cycle."); }
        } else if (settings.autonomousBotReplyMode === 'replies_to_bot') {
            // Existing logic to check replies to bot's own ongoing conversations
             for (const [convoId, convo] of newConversationsMap.entries()) {
                if (convo.status !== 'active' || convo.board !== settings.autonomousBotTargetBoard || convo.threadId !== settings.autonomousBotTargetThreadId || !convo.lastBotReplyNum) continue;
                if (!convo.geminiChatInstance && ai) { // Rehydrate chat instance if missing and AI is available
                   const rehydratedHistory = convo.history
                        .filter(m => m.role === 'user' || m.role === 'model')
                        .map(m => ({
                            role: m.role as 'user' | 'model', 
                            parts: m.parts
                        }));

                   const rehydrateChatOpts = { // Removed CreateChatOptions type
                       model: GEMINI_TEXT_MODEL,
                       config: { systemInstruction: convo.botSystemPromptUsed, temperature: 0.8, topK: 40, topP: 0.95, maxOutputTokens: 512 },
                       history: rehydratedHistory
                   };
                   const rehydratedChat = ai.chats.create(rehydrateChatOpts); // Corrected call
                   convo.geminiChatInstance = rehydratedChat;
                   newConversationsMap.set(convoId, convo);
                   addAutonomousBotActivityLog(`Rehydrated chat instance for convo ${convoId}`);
                }
                if (!convo.geminiChatInstance) {
                    addAutonomousBotActivityLog(`Skipping convo ${convoId}, chat instance not available.`);
                    continue;
                }

                const lastBotPostInConvoNum = convo.lastBotReplyNum;
                
                for (const dvachPost of latestPostsInThread) {
                    if (Number(dvachPost.timestamp) * 1000 <= convo.history.find(m => m.id.endsWith(lastBotPostInConvoNum))?.timestamp!) continue;
                    if (sentMessages.some(sm => sm.num === dvachPost.num && sm.isGeminiPost)) continue; // Skip bot's own posts
                    if (convo.participatingPostNumbers.includes(dvachPost.num)) continue;
            
                    const botPostMentionedRegex = new RegExp(`&gt;&gt;(${lastBotPostInConvoNum})`);
                    if (dvachPost.comment.match(botPostMentionedRegex)) {
                        setAutonomousBotStatus(`Found reply >>${dvachPost.num} to bot's post >>${lastBotPostInConvoNum}`);
                        addAutonomousBotActivityLog(`New reply >>${dvachPost.num} to bot's post >>${lastBotPostInConvoNum} in convo ${convoId}. Processing...`);
              
                        const userReplyParts: Part[] = [{ text: dvachPost.comment.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>?/gm, '') }];
                        if (settings.botAnalyzesImagesInTriggerPosts && dvachPost.files && dvachPost.files.length > 0) { /* ... image processing ... */ }

                        convo.history.push({ id: `user-${dvachPost.num}`, role: 'user', parts: userReplyParts, timestamp: dvachPost.timestamp * 1000 });
                        
                        const geminiResponse = await convo.geminiChatInstance.sendMessageStream({ message: { parts: userReplyParts } }); // Corrected call
                        let botFollowUpText = "";
                        for await (const chunk of geminiResponse) { botFollowUpText += chunk.text || ""; }

                        if (!botFollowUpText.trim().startsWith(`>>${dvachPost.num}`)) {
                            botFollowUpText = `>>${dvachPost.num}\n${botFollowUpText.trim()}`;
                        }
                        addAutonomousBotActivityLog(`Bot generated reply to >>${dvachPost.num}: ${botFollowUpText.substring(0,70)}...`);
                        
                        const newBotPostNum = await commonPostToDvach(botFollowUpText, null, false, convo.board, convo.threadId, dvachPost.num);
                        botMadeAPostThisCycle = true;
              
                        convo.history.push({ id: `model-${newBotPostNum}`, role: 'model', parts: [{text: botFollowUpText}], timestamp: Date.now() });
                        convo.participatingPostNumbers.push(dvachPost.num, newBotPostNum);
                        convo.lastCheckedTimestamp = Date.now();
                        convo.lastBotReplyNum = newBotPostNum;
                        newConversationsMap.set(convoId, convo);
                        setSentMessages(prev => [{
                            num: newBotPostNum, timestamp: Date.now(), comment: botFollowUpText, board: convo.board, thread: convo.threadId, parent: dvachPost.num,
                            isGeminiPost: true, geminiConversationId: convoId, geminiTriggerPostNum: convo.triggerPostNum
                        }, ...prev]);
                        setAutonomousBotStatus(`Replied as >>${newBotPostNum} to >>${dvachPost.num}`);
                        break; 
                    }
                }
            }
        }


        if (botMadeAPostThisCycle) {
            setGeminiDvachConversations(new Map(newConversationsMap)); 
        }
        addAutonomousBotActivityLog("Bot cycle finished.");

      } catch (error) {
        addAutonomousBotActivityLog(`Error in bot cycle: ${(error as Error).message}`);
        setAutonomousBotStatus(`Error: ${(error as Error).message.substring(0,50)}...`);
        if ((error as Error).message.toLowerCase().includes("session expired") || (error as Error).message.toLowerCase().includes("login failed")) {
            setDvachSessionCookies(null);
            setAutonomousBotActive(false); 
            addLog("Autonomous Bot: Dvach session seems to have expired. Bot stopped. Please login again.", "auth");
       }
      }
    };

    setAutonomousBotStatus(`Starting bot for /${settings.autonomousBotTargetBoard}/${settings.autonomousBotTargetThreadId}...`);
    addAutonomousBotActivityLog(`Bot started. Target: /${settings.autonomousBotTargetBoard}/${settings.autonomousBotTargetThreadId}. Mode: ${settings.autonomousBotReplyMode}. Interval: ${settings.autonomousBotCycleIntervalSeconds}s.`);
    runBotCycle(); 
    autonomousBotIntervalRef.current = setInterval(runBotCycle, settings.autonomousBotCycleIntervalSeconds * 1000) as any as number;

    return () => {
      if (autonomousBotIntervalRef.current) {
        clearInterval(autonomousBotIntervalRef.current);
        autonomousBotIntervalRef.current = null;
        addAutonomousBotActivityLog("Bot monitoring interval cleared.");
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autonomousBotActive, ai, dvachSessionCookies, settings]); // Simplified deps, check if settings changes should restart.
  
  const toggleTheme = () => {
    handleUpdateSettings({ theme: settings.theme === 'dark' ? 'light' : (settings.theme === 'light' ? 'system' : 'dark') });
  };

  const ThemeIcon = useMemo(() => {
    if (settings.theme === 'dark') return IconMoon;
    if (settings.theme === 'light') return IconSun;
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return IconMoon;
    return IconSun;
  }, [settings.theme]);

  const renderDvachPostCard = (post: DvachPost, index: number) => (
    <div key={`${post.num}-${index}`} id={`post-${post.num}`} className="p-3 mb-3 bg-gray-50 dark:bg-gray-700 rounded-lg shadow border border-gray-200 dark:border-gray-600 transition-all hover:shadow-md">
      <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400 mb-1">
        <span>
          {post.name || 'Anonymous'} - No. <a href={`#post-${post.num}`} className="hover:underline text-blue-500 dark:text-blue-400">{post.num}</a>
          {post.op === 1 && <span className="ml-1 px-1.5 py-0.5 text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-700 dark:text-blue-100 rounded-full">OP</span>}
          {post.trip && <span className="ml-1 text-green-600 dark:text-green-400">{post.trip}</span>}
        </span>
        <span>{new Date(post.timestamp * 1000).toLocaleString()}</span>
      </div>
      {post.subject && <h4 className="font-semibold text-sm mb-1 text-gray-800 dark:text-gray-200">{post.subject}</h4>}
      {post.files && post.files.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {post.files.map((file, fileIndex) => (
            <a key={`${post.num}-file-${fileIndex}`} 
              href={`${DVACH_DOMAINS[0]}${file.path}`} 
              target="_blank" rel="noopener noreferrer"
              className="block w-24 h-24" title={`Name: ${file.name}\nSize: ${file.size}KB\nDimensions: ${file.width}x${file.height}${file.duration ? `\nDuration: ${file.duration}` : ''}`}>
              <img src={`${DVACH_DOMAINS[0]}${file.thumbnail}`} alt={file.name || `file ${fileIndex}`} className="rounded object-cover w-full h-full border border-gray-300 dark:border-gray-500 hover:opacity-80 transition-opacity" loading="lazy"/>
            </a>
          ))}
        </div>
      )}
      <div className="prose prose-sm dark:prose-invert max-w-none break-words" dangerouslySetInnerHTML={{ __html: post.comment.replace(/&gt;&gt;(\d+)/g, `<a href="#post-$1" class="text-blue-500 hover:underline">&gt;&gt;$1</a>`) }}/>
      <div className="mt-2 text-right">
        <button onClick={() => handleManualGeminiReplyToDvachPost(post)} disabled={geminiLoading || !ai || isPosting || !dvachSessionCookies?.passcode_auth}
          className="px-3 py-1 text-xs bg-purple-500 hover:bg-purple-600 text-white rounded-md font-medium flex items-center shadow disabled:opacity-50 transition-colors"
          title={!ai ? "Gemini AI not initialized. Check API Key." : (!dvachSessionCookies?.passcode_auth ? "Not logged into Dvach." : "Reply to this post using Gemini AI (with thread context & image analysis)")}>
          <IconSparkles className="mr-1 h-4 w-4"/> Reply with Gemini
        </button>
      </div>
    </div>
  );

  const renderDvachBotPanel = () => ( // This is the "Dvach Ops" tab
    <div className="space-y-6 p-4 md:p-6 bg-white dark:bg-gray-800 shadow-lg rounded-lg">
      <div className="flex justify-between items-center border-b pb-2 border-gray-300 dark:border-gray-700">
        <h2 className="text-2xl font-semibold text-blue-600 dark:text-blue-400">Dvach Operations (Manual)</h2>
        <div className="flex items-center space-x-2">
            {dvachSessionCookies?.passcode_auth ? (
                <>
                    <span className="text-xs text-green-600 dark:text-green-400 flex items-center"><IconUserCircle className="h-4 w-4 mr-1"/>Logged In</span>
                    <button onClick={handleDvachLogout} title="Logout from Dvach"
                        className="px-3 py-1 text-xs bg-red-500 hover:bg-red-600 text-white rounded-md flex items-center shadow transition-colors">
                        <IconLogout className="mr-1 h-4 w-4"/> Logout
                    </button>
                </>
            ) : (
                <button onClick={handleDvachLogin} disabled={isDvachLoggingIn || !settings.purchasedPasscode}
                    className="px-3 py-1 text-xs bg-green-500 hover:bg-green-600 text-white rounded-md flex items-center shadow disabled:opacity-50 transition-colors"
                    title={!settings.purchasedPasscode ? "Enter Purchased Passcode in Settings first" : "Login to Dvach using Purchased Passcode"}>
                    <IconLogin className="mr-1 h-4 w-4"/> Login to Dvach
                </button>
            )}
        </div>
      </div>

      {fetchError && (
         <div className="p-3 mb-4 bg-red-100 dark:bg-red-900 border-l-4 border-red-500 rounded-md text-red-700 dark:text-red-300 text-sm" role="alert">
            <div className="flex items-start"> <IconAlertTriangle className="h-5 w-5 mr-2 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div><strong className="font-bold">Operation Failed:</strong> <p className="mt-1 break-all">{fetchError}</p>
                 <p className="mt-1 text-xs">Check logs for details. If this is a CORS/proxy issue for GET, check Settings. For POST issues, the serverless function might be down or Dvach blocked the request. For auth issues, try logging in again.</p>
              </div></div></div>)}
      <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-md space-y-3">
        <h3 className="text-xl font-medium text-gray-700 dark:text-gray-300">Load Thread (for Viewer)</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div><label htmlFor="dvachBoardInput" className="block text-sm font-medium text-gray-600 dark:text-gray-300">Board:</label>
                <input id="dvachBoardInput" type="text" value={currentBoard} onChange={(e) => setCurrentBoard(e.target.value)} placeholder="e.g., b" className="mt-1 w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 focus:ring-1 focus:ring-blue-500"/></div>
            <div><label htmlFor="dvachThreadInput" className="block text-sm font-medium text-gray-600 dark:text-gray-300">Thread ID (OP Post #):</label>
                <input id="dvachThreadInput" type="text" value={currentThreadId} onChange={(e) => setCurrentThreadId(e.target.value)} placeholder="e.g., 12345678" className="mt-1 w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 focus:ring-1 focus:ring-blue-500"/></div>
            <button onClick={() => handleLoadThread(false)} disabled={isFetchingThread || !currentBoard || !currentThreadId}
                className="mt-1 md:mt-6 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-md font-medium flex items-center justify-center shadow disabled:opacity-50 transition-colors h-10"
                title="Fetch posts from specified board/thread ID">
                <IconRefresh className={`mr-2 h-5 w-5 ${isFetchingThread ? 'animate-spin' : ''}`}/> Fetch Thread</button></div></div>
       <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-md">
        <h3 className="text-xl font-medium mb-3 text-gray-700 dark:text-gray-300">Manual Post</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Posts to the board/thread specified above. If Thread ID is "0" or empty, attempts to create a new thread (may require a file).</p>
        <textarea aria-label="Post comment" className="w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 focus:ring-1 focus:ring-blue-500"
          rows={3} placeholder="Enter post comment..." value={postText} onChange={(e) => setPostText(e.target.value)}/>
        <div className="flex flex-wrap items-center space-x-4 mt-2">
          <label className="text-sm my-1"> Attach File:
             <input type="file" onChange={(e) => setPostFile(e.target.files?.[0] || null)} className="ml-2 text-sm file:mr-2 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-800 dark:file:text-blue-200 dark:hover:file:bg-blue-700"/>
             {postFile && <span className="text-xs ml-2 inline-block max-w-[150px] truncate" title={postFile.name}>{postFile.name}</span>}</label>
          <label className="flex items-center my-1">
            <input type="checkbox" checked={postUseSage} onChange={(e) => setPostUseSage(e.target.checked)} className="mr-2 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"/>Use Sage</label>
          <button onClick={handleSimplePost} disabled={isPosting || !currentBoard || !postText.trim() || !dvachSessionCookies?.passcode_auth}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium flex items-center shadow transition-colors disabled:opacity-50 my-1"
            title={!dvachSessionCookies?.passcode_auth ? "Not logged into Dvach. Please Login." : "Post message"}> <IconSend className="mr-2 h-5 w-5"/> Post</button></div>
        {postActivityLog.length > 0 && (<div className="mt-2 text-xs text-gray-500 dark:text-gray-400 space-y-0.5">{postActivityLog.map((log, i) => <p key={i} className="truncate">{log}</p>)}</div>)}</div>
      <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-md">
        <div className="flex flex-wrap justify-between items-center mb-3 gap-2">
            <h3 className="text-xl font-medium text-gray-700 dark:text-gray-300">Thread Viewer</h3>
        </div>
        {(!currentBoard || !currentThreadId) && <p className="text-sm text-yellow-600 dark:text-yellow-400">Specify Board and Thread ID then click "Fetch Thread" to view posts.</p>}
        <div ref={threadPostsContainerRef} className="max-h-[600px] overflow-y-auto bg-gray-100 dark:bg-gray-800 p-2 rounded custom-scrollbar">
            {isFetchingThread && <p className="text-center p-4">Loading thread...</p>}
            {!isFetchingThread && currentFetchedDvachPosts.length === 0 && <p className="text-center p-4 text-gray-500 dark:text-gray-400">No posts loaded. Fetch thread or check settings.</p>}
            {currentFetchedDvachPosts.map((post,idx) => renderDvachPostCard(post, idx))}</div></div></div>
  );

  const renderAutonomousBotControlPanel = () => (
    <div className="space-y-6 p-4 md:p-6 bg-white dark:bg-gray-800 shadow-lg rounded-lg">
      <h2 className="text-2xl font-semibold text-green-600 dark:text-green-400 border-b pb-2 border-gray-300 dark:border-gray-700">Dvach Bot Control (Autonomous)</h2>
      {!ai && (<div className="p-3 mb-4 bg-yellow-100 dark:bg-yellow-800 border border-yellow-300 dark:border-yellow-600 rounded-md text-yellow-700 dark:text-yellow-200 text-sm flex items-center" role="alert">
            <IconAlertTriangle className="h-5 w-5 mr-2 text-yellow-500 dark:text-yellow-400 flex-shrink-0" />
            <span><strong>Gemini AI Not Initialized:</strong> Bot requires API key in Settings.</span></div>)}
      {!dvachSessionCookies?.passcode_auth && (<div className="p-3 mb-4 bg-orange-100 dark:bg-orange-800 border border-orange-300 dark:border-orange-600 rounded-md text-orange-700 dark:text-orange-200 text-sm flex items-center" role="alert">
            <IconAlertTriangle className="h-5 w-5 mr-2 text-orange-500 dark:text-orange-400 flex-shrink-0" />
            <span><strong>Dvach Login Required:</strong> Bot requires Dvach login via Dvach Ops tab.</span></div>)}
      
      <div className="p-4 border rounded-md border-gray-200 dark:border-gray-700 space-y-4">
        <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">Bot Configuration & Control</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label htmlFor="botTargetBoard" className="block text-sm font-medium">Target Board:</label>
                <input id="botTargetBoard" type="text" value={settings.autonomousBotTargetBoard} onChange={e => handleUpdateSettings({autonomousBotTargetBoard: e.target.value})} placeholder="e.g., b" className="mt-1 w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"/></div>
            <div><label htmlFor="botTargetThreadId" className="block text-sm font-medium">Target Thread ID:</label>
                <input id="botTargetThreadId" type="text" value={settings.autonomousBotTargetThreadId} onChange={e => handleUpdateSettings({autonomousBotTargetThreadId: e.target.value})} placeholder="e.g., 12345678" className="mt-1 w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"/></div>
        </div>
        <div><label htmlFor="botSystemPrompt" className="block text-sm font-medium">Bot System Prompt (Persona & Rules):</label>
            <textarea id="botSystemPrompt" value={settings.autonomousBotSystemPrompt} onChange={e => handleUpdateSettings({autonomousBotSystemPrompt: e.target.value})} rows={4} className="mt-1 w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"/></div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><label htmlFor="botReplyMode" className="block text-sm font-medium">Bot Reply Mode:</label>
                 <select id="botReplyMode" value={settings.autonomousBotReplyMode} onChange={e => handleUpdateSettings({autonomousBotReplyMode: e.target.value as AutonomousBotReplyMode})} className="mt-1 w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 dark:border-gray-600">
                    <option value="random_in_thread">Reply to Random Posts</option>
                    <option value="replies_to_bot">Reply to Bot's Own Posts</option>
                 </select></div>
            <div><label htmlFor="botPersonality" className="block text-sm font-medium">Bot Personality Preset:</label>
                 <select id="botPersonality" value={settings.autonomousBotPersonalityPreset} onChange={e => handleUpdateSettings({autonomousBotPersonalityPreset: e.target.value as AutonomousBotPersonalityPreset})} className="mt-1 w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 dark:border-gray-600">
                    <option value="default">Default (from System Prompt)</option>
                    <option value="concise_witty">Concise & Witty</option>
                    <option value="elaborate_detailed">Elaborate & Detailed</option>
                    <option value="slightly_aggressive">Slightly Aggressive</option>
                    <option value="sarcastic_ironic">Sarcastic / Ironic</option>
                    <option value="neutral_informative">Neutral & Informative</option>
                 </select></div>
            <div><label htmlFor="botCycleInterval" className="block text-sm font-medium">Check Interval (seconds):</label>
                <input id="botCycleInterval" type="number" min="15" max="300" step="5" value={settings.autonomousBotCycleIntervalSeconds} onChange={e => handleUpdateSettings({autonomousBotCycleIntervalSeconds: parseInt(e.target.value)})} className="mt-1 w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 dark:border-gray-600"/></div>
        </div>

        <div className="flex items-center space-x-4">
             <label className="flex items-center text-sm"><input type="checkbox" checked={settings.botAnalyzesImagesInTriggerPosts} onChange={e => handleUpdateSettings({botAnalyzesImagesInTriggerPosts: e.target.checked})} className="mr-2 h-4 w-4 text-green-600"/>Bot analyzes images in trigger posts</label>
             <label className="flex items-center text-sm"><input type="checkbox" checked={settings.geminiReplyWithGeneratedImage} onChange={e => handleUpdateSettings({geminiReplyWithGeneratedImage: e.target.checked})} className="mr-2 h-4 w-4 text-green-600"/>Bot generates images with replies</label>
        </div>
        <div className="flex items-center space-x-3">
            <button onClick={() => setAutonomousBotActive(prev => !prev)} disabled={!ai || !dvachSessionCookies?.passcode_auth || !settings.autonomousBotTargetBoard || !settings.autonomousBotTargetThreadId}
                className={`px-4 py-2 text-white rounded-md font-medium flex items-center shadow transition-colors disabled:opacity-50 ${autonomousBotActive ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`}>
                {autonomousBotActive ? <IconPlayerStop className="mr-2 h-5 w-5"/> : <IconPlayerPlay className="mr-2 h-5 w-5"/>}
                {autonomousBotActive ? 'Stop Bot' : 'Start Bot'}
            </button>
            <span className={`text-sm font-semibold ${autonomousBotActive ? 'text-green-500' : 'text-red-500'}`}>{autonomousBotStatus}</span>
        </div>
      </div>

      <div className="p-4 border rounded-md border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium mb-2 text-gray-700 dark:text-gray-300">Autonomous Bot Activity Log</h3>
        <div className="max-h-80 overflow-y-auto bg-gray-50 dark:bg-gray-900 p-2 rounded custom-scrollbar border border-gray-100 dark:border-gray-700 text-xs">
            {autonomousBotActivityLog.length === 0 ? <p className="text-center text-gray-500 dark:text-gray-400">No bot activity yet.</p> : 
             autonomousBotActivityLog.map((log, i) => <p key={i} className="py-0.5 border-b border-gray-200 dark:border-gray-700 last:border-b-0">{log}</p>)}
        </div>
      </div>
      
      <div className="p-4 border rounded-md border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium mb-2 text-gray-700 dark:text-gray-300">Bot's Ongoing Conversations ({geminiDvachConversations.size})</h3>
          {geminiDvachConversations.size === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">No active conversations tracked by the bot.</p>}
          <div className="max-h-60 overflow-y-auto custom-scrollbar">
            {Array.from(geminiDvachConversations.values()).map(convo => (
                <details key={convo.id} className="mb-2 p-2 border rounded-md text-xs bg-gray-50 dark:bg-gray-700">
                    <summary className="cursor-pointer font-semibold">
                        Convo for &gt;&gt;{convo.triggerPostNum} (Status: {convo.status}, Last Bot: &gt;&gt;{convo.lastBotReplyNum || 'N/A'}, Hist: {convo.history.length})
                    </summary>
                    <pre className="mt-1 text-xs whitespace-pre-wrap bg-gray-100 dark:bg-gray-800 p-1 rounded max-h-40 overflow-y-auto">
                        {convo.history.map(msg => `${msg.role === 'model' ? 'Bot' : 'User'} (>>${msg.id.split('-')[1]}): ${msg.parts[0]?.text?.substring(0,100) || '[media]'}\n`).join('')}
                    </pre>
                </details>
            ))}
          </div>
      </div>

    </div>
  );

  const renderSettingsPanel = () => (
     <div className="space-y-6 p-4 md:p-6 bg-white dark:bg-gray-800 shadow-lg rounded-lg">
      <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-300 border-b pb-2 border-gray-300 dark:border-gray-700">Application Settings</h2>
      <div className="p-4 border rounded-md border-gray-200 dark:border-gray-700 space-y-3">
        <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">Dvach Configuration (Manual Ops Tab)</h3>
        <div><label htmlFor="settingsBoard" className="block text-sm font-medium">Current Board (for viewer/quick post):</label>
          <input id="settingsBoard" type="text" value={settings.board} onChange={e => handleUpdateSettings({board: e.target.value})} className="mt-1 w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 focus:ring-1 focus:ring-blue-500"/></div>
        <div><label htmlFor="settingsThreadId" className="block text-sm font-medium">Current Thread ID (for viewer/quick post, "0" for new thread):</label>
          <input id="settingsThreadId" type="text" value={settings.threadId} onChange={e => handleUpdateSettings({threadId: e.target.value})} className="mt-1 w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 focus:ring-1 focus:ring-blue-500"/></div>
        <div><label htmlFor="settingsPurchasedPasscode" className="block text-sm font-medium">Dvach Purchased Passcode:</label>
          <input id="settingsPurchasedPasscode" type="password" placeholder="Enter your long-term purchased passcode string" value={settings.purchasedPasscode} onChange={e => handleUpdateSettings({purchasedPasscode: e.target.value})} className="mt-1 w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 focus:ring-1 focus:ring-blue-500"/>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">This is your permanent purchased passcode string, used to obtain temporary session cookies.</p></div>
         <div><label htmlFor="settingsUserAgent" className="block text-sm font-medium">User-Agent for Requests:</label>
            <div className="flex items-center space-x-2">
              <input id="settingsUserAgent" type="text" value={settings.userAgent} onChange={e => handleUpdateSettings({userAgent: e.target.value})} className="mt-1 w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 focus:ring-1 focus:ring-blue-500"/>
              <button onClick={() => handleUpdateSettings({userAgent: generateUserAgent()})} title="Generate new random User-Agent"
                className="mt-1 px-3 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 rounded-md text-sm">
                <IconRefresh className="h-5 w-5"/>
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Used for client-side GET requests (like images) and passed to serverless functions.</p>
          </div>
        </div>
      <div className="p-4 border rounded-md border-gray-200 dark:border-gray-700 space-y-3">
        <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">Proxy for Dvach GET Requests (e.g., Thread Data, Images)</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">POST requests (sending messages) use the Vercel serverless function `/api/dvach-post` and ignore these settings.</p>
        <div><label htmlFor="settingsProxyModeForGET" className="block text-sm font-medium">Proxy Mode for GET:</label>
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
            <option value="vercel_serverless">Vercel Serverless Proxy (Recommended for thread data; images might need other modes or a custom URL below)</option>
            <option value="custom_go_x2u">Custom: go.x2u.in Format (e.g., ...&url=)</option>
            <option value="custom_cors_anywhere">Custom: cors-anywhere.com Format (e.g., .../)</option>
            <option value="custom_general_prefix">Custom: General Prefix URL (e.g., https://myproxy.com/)</option>
            <option value="custom_general_param">Custom: General Parameter URL (e.g., ...?url=)</option>
            <option value="none">No Proxy (May not work due to CORS)</option></select></div>
        {(settings.proxyModeForGET.startsWith('custom_') || settings.proxyModeForGET === 'vercel_serverless') && ( // Show custom URL if custom mode OR if vercel_serverless (for images)
          <div><label htmlFor="settingsCustomProxyUrlForGET" className="block text-sm font-medium">
            {settings.proxyModeForGET === 'vercel_serverless' ? "Optional Custom Proxy for Images (if Vercel Serverless for thread data):" : "Custom Proxy URL Base for GET:"}
            </label>
            <input id="settingsCustomProxyUrlForGET" type="text" placeholder="Enter custom proxy base URL" value={settings.customProxyUrlForGET} 
              onChange={e => handleUpdateSettings({customProxyUrlForGET: e.target.value})} 
              className="mt-1 w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 focus:ring-1 focus:ring-blue-500"/>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {settings.proxyModeForGET === 'custom_go_x2u' && `Should be the go.x2u URL typically ending in '&url='.`}
              {settings.proxyModeForGET === 'custom_cors_anywhere' && `Should be the cors-anywhere URL typically ending in '/'.`}
              {settings.proxyModeForGET === 'custom_general_prefix' && `A prefix URL, e.g., https://myproxy.com/ (should end with /).`}
              {settings.proxyModeForGET === 'custom_general_param' && `Parameter-based URL, e.g., https://myproxy.com?target= (should end with query param name and =).`}
              {settings.proxyModeForGET === 'vercel_serverless' && `If set, this custom proxy will be used for fetching images, while /api/get-thread is used for thread data.`}
            </p></div>)}</div>
       <div className="p-4 border rounded-md border-gray-200 dark:border-gray-700 space-y-3">
        <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">Gemini API Configuration</h3>
        <div><label htmlFor="geminiApiKeySource" className="block text-sm font-medium">API Key Source:</label>
            <select id="geminiApiKeySource" value={settings.geminiApiKeySource} onChange={e => handleUpdateSettings({geminiApiKeySource: e.target.value as 'env' | 'user'})} className="mt-1 w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 focus:ring-1 focus:ring-purple-500">
              <option value="env">Use Environment API_KEY (VITE_GEMINI_API_KEY) {processEnvApiKey ? `(Detected: ${processEnvApiKey.substring(0,4)}...${processEnvApiKey.substring(processEnvApiKey.length-4)})` : "(Not Detected/Accessible)"}</option>
              <option value="user">Enter API Key Manually</option></select></div>
        {settings.geminiApiKeySource === 'user' && (<div><label htmlFor="userGeminiApiKey" className="block text-sm font-medium">Manual Gemini API Key:</label>
            <input id="userGeminiApiKey" type="password" placeholder="Enter your Gemini API Key" value={settings.userGeminiApiKey} onChange={e => handleUpdateSettings({userGeminiApiKey: e.target.value})} className="mt-1 w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 focus:ring-1 focus:ring-purple-500"/></div>)}
        <div><label htmlFor="geminiSystemInstruction" className="block text-sm font-medium">Default Gemini System Instruction (for manual replies):</label>
            <textarea id="geminiSystemInstruction" value={settings.geminiSystemInstruction} onChange={e => handleUpdateSettings({geminiSystemInstruction: e.target.value})} rows={3} className="mt-1 w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 focus:ring-1 focus:ring-purple-500"/></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div><label htmlFor="geminiTemp" className="block text-xs font-medium">Temperature:</label>
                <input id="geminiTemp" type="number" step="0.05" min="0" max="2" value={settings.geminiTemperature} onChange={e => handleUpdateSettings({geminiTemperature: parseFloat(e.target.value)})} className="mt-1 w-full p-1.5 border rounded bg-gray-50 dark:bg-gray-700 dark:border-gray-600"/></div>
             <div><label htmlFor="geminiTopP" className="block text-xs font-medium">Top P:</label>
                <input id="geminiTopP" type="number" step="0.05" min="0" max="1" value={settings.geminiTopP} onChange={e => handleUpdateSettings({geminiTopP: parseFloat(e.target.value)})} className="mt-1 w-full p-1.5 border rounded bg-gray-50 dark:bg-gray-700 dark:border-gray-600"/></div>
            <div><label htmlFor="geminiTopK" className="block text-xs font-medium">Top K:</label>
                <input id="geminiTopK" type="number" step="1" min="1" value={settings.geminiTopK} onChange={e => handleUpdateSettings({geminiTopK: parseInt(e.target.value)})} className="mt-1 w-full p-1.5 border rounded bg-gray-50 dark:bg-gray-700 dark:border-gray-600"/></div>
            <div><label htmlFor="geminiMaxOut" className="block text-xs font-medium">Max Tokens:</label>
                <input id="geminiMaxOut" type="number" step="64" min="64" value={settings.geminiMaxOutputTokens} onChange={e => handleUpdateSettings({geminiMaxOutputTokens: parseInt(e.target.value)})} className="mt-1 w-full p-1.5 border rounded bg-gray-50 dark:bg-gray-700 dark:border-gray-600"/></div></div>
         <div className="flex items-center space-x-4">
            <label className="flex items-center text-sm"><input type="checkbox" checked={settings.useThinkingBudget} onChange={e => handleUpdateSettings({useThinkingBudget: e.target.checked})} className="mr-2 h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"/>Enable Thinking Budget Override (Flash model)</label>
             {settings.useThinkingBudget && (<input type="number" step="100" min="0" value={settings.geminiThinkingBudget} onChange={e => handleUpdateSettings({geminiThinkingBudget: parseInt(e.target.value)})} title="Thinking Budget (ms). 0 + Enabled = Default Thinking. >0 = Custom Budget. If 'Enable Thinking Budget Override' is unchecked, thinking is default ON (non-zero budget)." placeholder="Budget (ms) or 0" className="p-1.5 w-32 border rounded bg-gray-50 dark:bg-gray-700 dark:border-gray-600 text-sm"/>)}</div></div>
      <div className="p-4 border rounded-md border-gray-200 dark:border-gray-700 space-y-2">
         <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">Gemini-Dvach Interaction</h3>
        <label className="flex items-center text-sm"><input type="checkbox" checked={settings.geminiAnalyzeOpMedia} onChange={e => handleUpdateSettings({geminiAnalyzeOpMedia: e.target.checked})} className="mr-2 h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"/>Gemini Considers Media in OP Post (Manual Reply)</label>
        <label className="flex items-center text-sm"><input type="checkbox" checked={settings.geminiAnalyzeAnonMedia} onChange={e => handleUpdateSettings({geminiAnalyzeAnonMedia: e.target.checked})} className="mr-2 h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"/>Gemini Considers Media in Non-OP Posts (Manual Reply)</label>
        <label className="flex items-center text-sm"><input type="checkbox" checked={settings.geminiReplyWithGeneratedImage} onChange={e => handleUpdateSettings({geminiReplyWithGeneratedImage: e.target.checked})} className="mr-2 h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"/>Gemini Attempts to Generate Image with Replies (Manual & Bot)</label>
      </div>
      <details className="p-4 border rounded-md border-gray-200 dark:border-gray-700">
        <summary className="text-lg font-medium text-gray-700 dark:text-gray-300 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400">Advanced Botting Features (Experimental/Legacy)</summary>
        <div className="mt-3 space-y-3"><p className="text-sm text-yellow-600 dark:text-yellow-400">Caution: Use these features responsibly and be aware of imageboard rules. These might be removed in future versions.</p>
            <div className="space-y-1"><label className="flex items-center text-sm">
                    <input type="checkbox" checked={settings.enableRepetitivePostingMode} onChange={e => handleUpdateSettings({enableRepetitivePostingMode: e.target.checked})} className="mr-2 h-4 w-4 text-orange-600 rounded focus:ring-orange-500"/>Enable Repetitive Posting Mode</label>
                {settings.enableRepetitivePostingMode && (<div className="pl-6 space-y-2 text-sm">
                        <textarea value={settings.repetitivePostMessage} onChange={e=>handleUpdateSettings({repetitivePostMessage: e.target.value})} placeholder="Message to repeat" className="w-full p-1.5 border rounded"/>
                        <input type="number" value={settings.repetitivePostCount} onChange={e=>handleUpdateSettings({repetitivePostCount: parseInt(e.target.value)})} placeholder="Count" className="w-20 p-1.5 border rounded"/>
                        <input type="number" value={settings.repetitivePostDelay} onChange={e=>handleUpdateSettings({repetitivePostDelay: parseInt(e.target.value)})} placeholder="Delay (s)" className="w-20 p-1.5 border rounded ml-2"/></div>)}</div>
            <div className="space-y-1"><label className="flex items-center text-sm">
                    <input type="checkbox" checked={settings.enablePrefilledPostingMode} onChange={e => handleUpdateSettings({enablePrefilledPostingMode: e.target.checked})} className="mr-2 h-4 w-4 text-orange-600 rounded focus:ring-orange-500"/>Enable Pre-filled Batch Posting Mode</label>
                 {settings.enablePrefilledPostingMode && (<div className="pl-6 space-y-2 text-sm">
                        <textarea value={settings.prefilledPostMessages} onChange={e=>handleUpdateSettings({prefilledPostMessages: e.target.value})} placeholder="Messages (one per line)" rows={3} className="w-full p-1.5 border rounded"/>
                        <textarea value={settings.prefilledPostTargets} onChange={e=>handleUpdateSettings({prefilledPostTargets: e.target.value})} placeholder="Target Post # (one per line, optional)" rows={3} className="w-full p-1.5 border rounded mt-1"/></div>)}</div></div></details>
      <p className="text-xs text-gray-500 dark:text-gray-400">Settings are saved automatically to local storage.</p></div>
  );

  const renderLogsPanel = () => (
    <div className="space-y-6 p-4 md:p-6 bg-white dark:bg-gray-800 shadow-lg rounded-lg">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-300 border-b pb-2 border-gray-300 dark:border-gray-700 flex-grow">Event Logs</h2>
        <button onClick={() => setLogs([])}
            className="px-3 py-1 text-xs bg-red-500 hover:bg-red-600 text-white rounded-md font-medium flex items-center shadow disabled:opacity-50 transition-colors"
            title="Clear all logs" disabled={logs.length === 0}> <IconTrash className="mr-1 h-4 w-4"/> Clear Logs</button></div>
      <div className="max-h-[600px] min-h-[200px] overflow-y-auto bg-gray-50 dark:bg-gray-900 p-3 rounded custom-scrollbar border border-gray-200 dark:border-gray-700">
        {logs.length === 0 && <p className="text-center text-gray-500 dark:text-gray-400">No logs yet.</p>}
        {logs.map(log => {
          const formattedData: string = formatLogDataForDisplay(log.data);
          return (
            <div key={log.id} className={`text-xs p-1.5 mb-1 rounded border-l-4 ${
              log.type === 'error' ? 'bg-red-50 dark:bg-red-900 border-red-500 text-red-700 dark:text-red-200' : 
              log.type === 'success' ? 'bg-green-50 dark:bg-green-900 border-green-500 text-green-700 dark:text-green-200' :
              log.type === 'warning' ? 'bg-yellow-50 dark:bg-yellow-900 border-yellow-500 text-yellow-700 dark:text-yellow-200' :
              log.type === 'gemini' ? 'bg-purple-50 dark:bg-purple-900 border-purple-500 text-purple-700 dark:text-purple-200' :
              log.type === 'dvach' ? 'bg-blue-50 dark:bg-blue-900 border-blue-500 text-blue-700 dark:text-blue-200' :
              log.type === 'auth' ? 'bg-orange-50 dark:bg-orange-900 border-orange-500 text-orange-700 dark:text-orange-200' :
              log.type === 'bot_activity' ? 'bg-teal-50 dark:bg-teal-900 border-teal-500 text-teal-700 dark:text-teal-200' :
              'bg-gray-100 dark:bg-gray-700 border-gray-500 text-gray-700 dark:text-gray-200'}`}>
              <span className="font-medium">[{new Date(log.timestamp).toLocaleTimeString()}] [{log.type.toUpperCase()}]</span>: {log.message}
              {Boolean(log.data) && <pre className="mt-1 text-xs whitespace-pre-wrap bg-black bg-opacity-10 dark:bg-opacity-20 p-1 rounded font-mono">{`${formattedData}`}</pre>}
            </div>
          );
        })}
      </div>
    </div>
  );
  
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-300 font-sans">
      <header className="bg-white dark:bg-gray-800 shadow-md p-3 sm:p-4 sticky top-0 z-50">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400">Dvach Gemini Bot</h1>
          <div className="flex items-center space-x-2 sm:space-x-4">
            <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              aria-label={`Toggle theme (current: ${settings.theme})`} title={`Change theme. Current: ${settings.theme}. Click to cycle.`}>
              <ThemeIcon className="h-5 w-5 sm:h-6 sm:w-6" /></button></div></div></header>
      <nav className="bg-gray-50 dark:bg-gray-800 border-b border-t border-gray-200 dark:border-gray-700 sticky top-[56px] sm:top-[68px] z-40">
        <div className="container mx-auto flex justify-center sm:justify-start flex-wrap">
          {[
            { id: 'dvach', label: 'Dvach Ops', icon: IconCpu },
            { id: 'bot_control', label: 'Bot Control', icon: IconMessageChat },
            // { id: 'gemini_lab', label: 'Gemini Tools', icon: IconSparkles }, // Removed
            { id: 'settings', label: 'Settings', icon: IconSettings }, 
            { id: 'logs', label: 'Logs', icon: IconTerminal }
           ].map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as 'dvach' | 'bot_control' | 'settings' | 'logs')} // Removed 'gemini_lab' from type
              aria-current={activeTab === tab.id ? "page" : undefined}
              className={`flex items-center px-2 sm:px-3 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 transition-all duration-150 ease-in-out focus:outline-none focus:ring-1 focus:ring-blue-400
                ${activeTab === tab.id ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'}`}>
              <tab.icon aria-hidden="true" className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-1.5 flex-shrink-0" />
              <span className="truncate">{tab.label}</span></button>))}</div></nav>
      <main className="container mx-auto p-3 sm:p-4 md:p-6" role="main"><div className="mt-1 sm:mt-2">
            {activeTab === 'dvach' && renderDvachBotPanel()}
            {activeTab === 'bot_control' && renderAutonomousBotControlPanel()}
            {/* {activeTab === 'gemini_lab' && renderGeminiLabPanel()} */} {/* Removed */}
            {activeTab === 'settings' && renderSettingsPanel()}
            {activeTab === 'logs' && renderLogsPanel()}</div></main>
      <footer className="text-center py-4 border-t border-gray-200 dark:border-gray-700 mt-8">
        <p className="text-xs text-gray-500 dark:text-gray-400">Dvach Gemini Bot Interface - Version {APP_VERSION} - Use responsibly.</p></footer></div>
  );
};
export default App;
