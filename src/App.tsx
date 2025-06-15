
/// <reference types="vite/client" />
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleGenAI, Part, Type, GenerateContentParameters, GenerateContentResponse, Chat as GeminiChat } from "@google/genai"; 
import {
  AppSettings, LogEntry, DvachPost, SentMessageInfo, ProxyModeForGET,
  DvachThreadResponse, 
  DvachFile, GeminiDvachConversation, ChatMessage, 
  DvachSessionCookies, AutonomousBotReplyMode, BotOpMediaCache, AutonomousBotInitialContextScope,
  GeminiFeature, GroundingChunk, GeneratedImage, CustomGenerateContentResponse, ActiveTask
} from './types'; 
import { getThreadData, loginToDvach, postWithSessionCookie, base64ToFile, extractDvachApiError, buildProxiedGetUrl } from './services/dvachService';
import { 
  APP_SETTINGS_KEY, SENT_MESSAGES_KEY, APP_VERSION,
  GEMINI_TEXT_MODEL, GEMINI_IMAGE_MODEL, MAX_LOG_ENTRIES, MAX_SENT_MESSAGES_STORED,
  GEMINI_DVACH_CONVERSATIONS_KEY, DVACH_SESSION_COOKIES_KEY,
  DVACH_DOMAINS, DEFAULT_USER_AGENT,
  DEFAULT_MAX_IMAGES_TO_ANALYZE_PER_POST, PROXY_URL_CODETABS_BASE, BUMP_KEYWORDS,
  AUTONOMOUS_BOT_MAX_OUTPUT_TOKENS, DEFAULT_GEMINI_SAFETY_SETTINGS, GEMINI_LAB_CHAT_HISTORY_KEY
} from './constants';
import { generateUserAgent } from './utils/userAgentGenerator'; 

import {
  IconSettings, IconTerminal, IconSend, IconTrash, IconCpu, 
  IconSparkles, IconAlertTriangle, IconRefresh, 
  IconLogin, IconLogout, IconUserCircle, IconPlayerPlay, IconPlayerStop, IconMessageChat,
  IconSun, IconMoon, IconPhoto, IconCloudUpload, IconFileText, IconSearch, IconEye, IconClock
} from './components/Icons'; 

// Ensure VITE_GEMINI_API_KEY is read correctly from import.meta.env
const processEnvApiKey = import.meta.env.VITE_GEMINI_API_KEY || "";

interface BotReplySchema {
  replyText: string; 
}

const DEFAULT_APP_SETTINGS: AppSettings = {
  board: "b", 
  threadId: "", 
  purchasedPasscode: "", 
  
  geminiApiKeySource: processEnvApiKey ? 'env' : 'user',
  userGeminiApiKey: "", 
  
  theme: 'system',
  
  proxyModeForGET: 'vercel_serverless', 
  customProxyUrlForGET: "", 
  
  proxyModeForImagesGET: 'custom_codetabs', 
  customProxyUrlForImagesGET: PROXY_URL_CODETABS_BASE,    

  userAgent: DEFAULT_USER_AGENT,

  geminiAnalyzeOpMedia: true, 
  geminiAnalyzeAnonMedia: false,
  
  geminiReplyWithGeneratedImage: false, 
  maxImagesToAnalyzePerPost: DEFAULT_MAX_IMAGES_TO_ANALYZE_PER_POST,
  analyzeVideosInTriggerPosts: false, 
  geminiSafetySettings: DEFAULT_GEMINI_SAFETY_SETTINGS,
  
  autonomousBotTargetBoard: "b",
  autonomousBotTargetThreadId: "",
  autonomousBotSystemPrompt: "Ты — анонимный пользователь имиджборда. Твои ответы должны быть остроумными, ироничными или информативными, в зависимости от контекста. Пиши в стиле, характерном для имиджбордов.",
  botAnalyzesImagesInTriggerPosts: true,
  autonomousBotReplyMode: 'random_in_thread', 
  autonomousBotCycleIntervalSeconds: 75, 
  autonomousBotAllowReplyToSelf: false,
  autonomousBotInitialContextScope: 'op_only',
  autonomousBotFullThreadContextMaxChars: 5000, 
  autonomousBotMinReplyDelayMs: 2000, 
  autonomousBotMaxReplyDelayMs: 7000, 
  autonomousBotDisableThinking: false, 


  geminiSystemInstruction: "You are a witty and insightful anonymous user on an imageboard. Your replies should be relevant, concise, and in the typical style of the board. If quoting, use '>>POST_NUMBER\\n'. No meta-comments.", 
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


const formatLogDataForDisplay = (data: unknown): string => { // Explicit return type
  if (typeof data === 'string') return data;
  if (typeof data === 'number' || typeof data === 'boolean' || data === null || data === undefined) {
    return String(data);
  }

  if (data instanceof Error) {
    return `Error: ${data.message}\nStack: ${data.stack || 'N/A'}`;
  }

  try {
    // Specific object formatting
    if (typeof data === 'object' && data !== null) {
      if ('botSystemPromptUsed' in data && 'triggerPostNum' in data && 'id' in data && 'history' in data) {
        const convo = data as GeminiDvachConversation;
        let historySummary = "No history.";
        if (convo.history && convo.history.length > 0) {
          historySummary = convo.history.slice(-3).map(msg => `${msg.role}: "${(msg.parts[0]?.text || "").substring(0,30)}..."`).join('; ');
        }
        const opText = convo.initialContext?.opPostText ? `InitialCtx: "${convo.initialContext.opPostText.substring(0,30)}..."` : "";
        return `Conv(ID:${convo.id},Trg:>>${convo.triggerPostNum},Sts:${convo.status},LastReply:>>${convo.lastBotReplyNum||'N/A'},Hist:${convo.history?.length||0} ${historySummary} ${opText})`.trim();
      }
      if ('num' in data && 'comment' in data && 'timestamp' in data && !('threads' in data)) { // DvachPost like
        const post = data as DvachPost;
        return `Post(>>${post.num},Files:${post.files?.length||0},Comm:"${post.comment.substring(0,30).replace(/<[^>]+>/g,'')}...")`;
      }
    }

    // Generic object stringification
    const replacer = (_key: string, value: any) =>
      typeof value === 'bigint' ? value.toString() : value;

    const jsonString = JSON.stringify(data, replacer, 2);
    if (jsonString.length > 700) { // Abbreviate very long JSON
        return `Object with keys: ${Object.keys(data as object).join(', ')} (JSON too long for log, see console)`;
    }
    return jsonString;

  } catch (e) {
    // Fallback for complex/circular objects or other stringify errors
    console.warn("formatLogDataForDisplay: JSON.stringify or custom formatting failed. Falling back.", e, data);
    if (typeof data === 'symbol') return data.toString();
    if (typeof data === 'object' && data !== null) {
        const objDesc = Object.prototype.toString.call(data);
        const keys = Object.keys(data);
        return `Object (${objDesc}) with keys: ${keys.slice(0,5).join(', ')}${keys.length > 5 ? '...' : ''}`;
    }
    return String(data);
  }
};


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
    console.warn("Initial JSON.parse failed:", e, "Original text:", responseText.substring(0, 200));
    try {
      let cleaned = jsonStr.replace(/,\s*([}\]])/g, '$1'); 

      if (cleaned.includes(`"replyText": "`) && !cleaned.match(/"replyText":\s*".*?"\s*}/s)) {
        const parts = cleaned.split(`"replyText": "`);
        if (parts.length === 2) {
            let potentialFix = `${parts[0]}"replyText": "${parts[1].replace(/"\s*$/, '')}"}`; 
            if (potentialFix.endsWith('"}')) { 
                 console.log("Attempting JSON parse with heuristic fix for unterminated string:", potentialFix);
                 try { return JSON.parse(potentialFix) as T; } catch (eFix) { console.error("Heuristic fix also failed:", eFix); }
            }
        }
      }
      
      const moreCleaned = cleaned
        .replace(/\\n/g, "\\n") 
        .replace(/\\"/g, "\\\"") 
        .replace(/[“”]/g, '"') 
        .replace(/[‘’]/g, "'"); 
      return JSON.parse(moreCleaned) as T;
    } catch (e2) {
      console.error("Failed to parse JSON even after cleaning attempts:", e2, "Cleaned text for parsing:", jsonStr.substring(0,200));
    }
    return null;
  }
}


const App: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(() => {
    const savedSettings = localStorage.getItem(APP_SETTINGS_KEY);
    const initialSettings = savedSettings ? JSON.parse(savedSettings) : {};
    const mergedSettings: AppSettings = { 
        ...DEFAULT_APP_SETTINGS, 
        ...initialSettings,
        maxImagesToAnalyzePerPost: initialSettings.maxImagesToAnalyzePerPost === undefined ? DEFAULT_APP_SETTINGS.maxImagesToAnalyzePerPost : Number(initialSettings.maxImagesToAnalyzePerPost),
        autonomousBotCycleIntervalSeconds: initialSettings.autonomousBotCycleIntervalSeconds === undefined ? DEFAULT_APP_SETTINGS.autonomousBotCycleIntervalSeconds : Number(initialSettings.autonomousBotCycleIntervalSeconds),
        autonomousBotFullThreadContextMaxChars: initialSettings.autonomousBotFullThreadContextMaxChars === undefined ? DEFAULT_APP_SETTINGS.autonomousBotFullThreadContextMaxChars : Number(initialSettings.autonomousBotFullThreadContextMaxChars),
        geminiTemperature: initialSettings.geminiTemperature === undefined ? DEFAULT_APP_SETTINGS.geminiTemperature : Number(initialSettings.geminiTemperature),
        geminiTopP: initialSettings.geminiTopP === undefined ? DEFAULT_APP_SETTINGS.geminiTopP : Number(initialSettings.geminiTopP),
        geminiTopK: initialSettings.geminiTopK === undefined ? DEFAULT_APP_SETTINGS.geminiTopK : Number(initialSettings.geminiTopK),
        geminiMaxOutputTokens: initialSettings.geminiMaxOutputTokens === undefined ? DEFAULT_APP_SETTINGS.geminiMaxOutputTokens : Number(initialSettings.geminiMaxOutputTokens),
        geminiThinkingBudget: initialSettings.geminiThinkingBudget === undefined ? DEFAULT_APP_SETTINGS.geminiThinkingBudget : Number(initialSettings.geminiThinkingBudget),
        geminiAnalyzeOpMedia: initialSettings.geminiAnalyzeOpMedia === undefined ? DEFAULT_APP_SETTINGS.geminiAnalyzeOpMedia : !!initialSettings.geminiAnalyzeOpMedia,
        geminiAnalyzeAnonMedia: initialSettings.geminiAnalyzeAnonMedia === undefined ? DEFAULT_APP_SETTINGS.geminiAnalyzeAnonMedia : !!initialSettings.geminiAnalyzeAnonMedia,
        geminiReplyWithGeneratedImage: initialSettings.geminiReplyWithGeneratedImage === undefined ? DEFAULT_APP_SETTINGS.geminiReplyWithGeneratedImage : !!initialSettings.geminiReplyWithGeneratedImage,
        botAnalyzesImagesInTriggerPosts: initialSettings.botAnalyzesImagesInTriggerPosts === undefined ? DEFAULT_APP_SETTINGS.botAnalyzesImagesInTriggerPosts : !!initialSettings.botAnalyzesImagesInTriggerPosts,
        autonomousBotAllowReplyToSelf: initialSettings.autonomousBotAllowReplyToSelf === undefined ? DEFAULT_APP_SETTINGS.autonomousBotAllowReplyToSelf : !!initialSettings.autonomousBotAllowReplyToSelf,
        autonomousBotInitialContextScope: initialSettings.autonomousBotInitialContextScope || DEFAULT_APP_SETTINGS.autonomousBotInitialContextScope,
        useSearchGrounding: initialSettings.useSearchGrounding === undefined ? DEFAULT_APP_SETTINGS.useSearchGrounding : !!initialSettings.useSearchGrounding,
        useThinkingBudget: initialSettings.useThinkingBudget === undefined ? DEFAULT_APP_SETTINGS.useThinkingBudget : !!initialSettings.useThinkingBudget,
        userAgent: initialSettings.userAgent || generateUserAgent(),
        geminiSafetySettings: initialSettings.geminiSafetySettings || DEFAULT_GEMINI_SAFETY_SETTINGS, 
        autonomousBotMinReplyDelayMs: initialSettings.autonomousBotMinReplyDelayMs === undefined ? DEFAULT_APP_SETTINGS.autonomousBotMinReplyDelayMs : Number(initialSettings.autonomousBotMinReplyDelayMs), 
        autonomousBotMaxReplyDelayMs: initialSettings.autonomousBotMaxReplyDelayMs === undefined ? DEFAULT_APP_SETTINGS.autonomousBotMaxReplyDelayMs : Number(initialSettings.autonomousBotMaxReplyDelayMs), 
        autonomousBotDisableThinking: initialSettings.autonomousBotDisableThinking === undefined ? DEFAULT_APP_SETTINGS.autonomousBotDisableThinking : !!initialSettings.autonomousBotDisableThinking, 
    };
    if (processEnvApiKey && mergedSettings.geminiApiKeySource === 'env' && !initialSettings.userGeminiApiKey) {
    } else if (!processEnvApiKey && mergedSettings.geminiApiKeySource === 'env') {
      mergedSettings.geminiApiKeySource = 'user'; 
    }
    return mergedSettings;
  });

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [ai, setAi] = useState<GoogleGenAI | null>(null);
  const currentAiApiKeyRef = useRef<string | null>(null); 
  const [activeTab, setActiveTab] = useState<'dvach' | 'gemini' | 'bot_control' | 'settings' | 'logs'>('dvach');
  
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

  // Gemini Lab State
  const [geminiLabPrompt, setGeminiLabPrompt] = useState<string>('');
  const [geminiLabChatMessages, setGeminiLabChatMessages] = useState<ChatMessage[]>(() => {
    const savedChat = localStorage.getItem(GEMINI_LAB_CHAT_HISTORY_KEY);
    return savedChat ? JSON.parse(savedChat) : [];
  });
  const [currentGeminiLabChat, setCurrentGeminiLabChat] = useState<GeminiChat | null>(null);
  const [currentStreamingMessage, setCurrentStreamingMessage] = useState<ChatMessage | null>(null);
  const [geminiLabOutput, setGeminiLabOutput] = useState<string | GeneratedImage[] | null>(null);
  const [geminiLoading, setGeminiLoading] = useState<boolean>(false);
  const [geminiLabGroundingSources, setGeminiLabGroundingSources] = useState<GroundingChunk[]>([]);
  const [geminiLabImageGenPrompt, setGeminiLabImageGenPrompt] = useState<string>('');
  const [geminiLabNumImagesToGenerate, setGeminiLabNumImagesToGenerate] = useState<number>(1);
  const [geminiLabImageForMultimodal, setGeminiLabImageForMultimodal] = useState<File | null>(null);
  
  const [activeTasks, setActiveTasks] = useState<ActiveTask[]>([]);


  // Autonomous Bot state (remains largely the same)
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
    localStorage.setItem(GEMINI_LAB_CHAT_HISTORY_KEY, JSON.stringify(geminiLabChatMessages));
  }, [geminiLabChatMessages]);


  useEffect(() => {
    const keyToUse = settings.geminiApiKeySource === 'env' ? processEnvApiKey : settings.userGeminiApiKey;

    if (keyToUse) {
      if (ai && currentAiApiKeyRef.current === keyToUse) {
        return;
      }

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
        setAi(null);
        currentAiApiKeyRef.current = null;
      }
    } else {
      if (ai) { 
        setAi(null);
        currentAiApiKeyRef.current = null;
        addLog('Gemini API client de-initialized (no API key).', 'warning');
      }
      if (currentAiApiKeyRef.current !== null || !ai) { 
          if (settings.geminiApiKeySource === 'user' && !settings.userGeminiApiKey) {
            addLog('Gemini API key (Manual) is not set. Gemini features disabled.', 'warning');
          } else if (settings.geminiApiKeySource === 'env' && !processEnvApiKey) {
            addLog('Gemini API key (VITE_GEMINI_API_KEY) not detected. Gemini features disabled.', 'warning');
          }
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
                .filter(file => (file.type === 1 || file.type === 2 || file.type === 4 || file.type === 9)) 
                .slice(0, settings.maxImagesToAnalyzePerPost);
        }
    }

    if (imageFilesToAnalyze.length > 0) {
        userPromptText += `\n\nThe post >>${targetPost.num} includes ${imageFilesToAnalyze.length} image(s) (e.g., "${imageFilesToAnalyze[0].name}"). Please analyze these images as part of your reply generation.`;
        for (const dvachImageFile of imageFilesToAnalyze) {
            try {
                const imageBaseUrl = DVACH_DOMAINS[0]; 
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
                    mimeType = dvachImageFile.type === 1 ? 'image/jpeg' : 
                               dvachImageFile.type === 2 ? 'image/png' : 
                               dvachImageFile.type === 4 ? 'image/gif' : 
                               dvachImageFile.type === 9 ? 'image/webp' : 
                               'image/jpeg'; 
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
        requestConfig.thinkingConfig = { thinkingBudget: settings.geminiThinkingBudget };
      }
      
      const response = await ai.models.generateContent({
        model: GEMINI_TEXT_MODEL,
        contents: [{ role: 'user', parts: geminiMessageParts }],
        config: requestConfig
      });
      const rawGeminiText = response.text || "";

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
                outputMimeType: 'image/jpeg',
                // safetySettings removed as it's not a valid property here
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
      
      setSentMessages(prev => prev.map(msg => 
        msg.num === newPostNumByGemini && msg.board === boardForReply && msg.thread === threadForReply ? 
        { ...msg, isGeminiPost: true, geminiTriggerPostNum: targetPost.num, geminiGeneratedImage: !!finalFileToPost } : msg 
      ));
      addLog(`Manual Gemini reply posted as >>${newPostNumByGemini} to /${boardForReply}/${threadForReply}.`, 'success');

    } catch (error) {
      if (! (error as Error).message.toLowerCase().includes("post failed") && ! (error as Error).message.toLowerCase().includes("dvach login")) { 
         addLog(`Error during manual Gemini reply generation for >>${targetPost.num}: ${(error as Error).message}`, 'error', error);
      }
    } finally {
      setGeminiLoading(false);
    }
  };


const runBotCycleCallback = useCallback(async () => {
    if (!ai || !dvachSessionCookies?.passcode_auth) { 
        addAutonomousBotActivityLog("Bot cycle skipped: AI or Dvach login missing.", 'bot_warning');
        if (autonomousBotActive) setAutonomousBotActive(false);
        return;
    }

    const currentBotSettings = settings;
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

    let workingConvo: GeminiDvachConversation | undefined = undefined; 
    const existingConversation = geminiDvachConversations.get(currentBotTargetKeyForCycle);

    try {
        const threadPostsResponse = await getThreadData(
            botBoard, botThreadId,
            currentBotSettings.proxyModeForGET, currentBotSettings.customProxyUrlForGET, currentBotSettings.userAgent
        );

        if (!threadPostsResponse || threadPostsResponse.threads?.[0]?.posts?.length === 0) {
            addAutonomousBotActivityLog("No posts found or error loading thread for bot cycle.", 'bot_warning', { threadKey: currentBotTargetKeyForCycle });
            setAutonomousBotStatus("Error loading thread data for bot.");
            if (existingConversation) {
                workingConvo = { ...existingConversation, lastCheckedTimestamp: Date.now(), status: 'error' };
            } 
        } else {
            const allPostsInThread = threadPostsResponse.threads[0].posts;
            const opPost = allPostsInThread.find(p => p.num === botThreadId || p.op === 1);
            
            let initialContextTextForSystemMessage = "";
            const maxCharsForFullContext = currentBotSettings.autonomousBotFullThreadContextMaxChars > 0 ? currentBotSettings.autonomousBotFullThreadContextMaxChars : Infinity;

            if (currentBotSettings.autonomousBotInitialContextScope === 'full_thread') {
                addAutonomousBotActivityLog(`Building full thread context. Max Chars: ${maxCharsForFullContext === Infinity ? 'Unlimited' : maxCharsForFullContext}`, 'bot_setup');
                let fullThreadSummary = `CONTEXT_START: Full thread overview for /${botBoard}/${botThreadId} on ${DVACH_DOMAINS[0]}.\n`;
                let currentChars = fullThreadSummary.length;
                for (const post of allPostsInThread) {
                    const postSummary = `Post >>${post.num} (by ${post.name || 'Anonymous'}): "${post.comment.replace(/<[^>]+>/g, '').substring(0, 250)}"\n`;
                    if (currentChars + postSummary.length > maxCharsForFullContext && maxCharsForFullContext !== Infinity) {
                        fullThreadSummary += "... (thread context truncated due to length)\n";
                        break;
                    }
                    fullThreadSummary += postSummary;
                    currentChars += postSummary.length;
                }
                initialContextTextForSystemMessage = fullThreadSummary + "CONTEXT_END\n";
            } else { 
                const opPostTextContent = opPost?.comment.replace(/<[^>]+>/g, '').substring(0, 1500) || "N/A";
                initialContextTextForSystemMessage = `CONTEXT_START: OP Post (>>${opPost?.num || 'N/A'}) for thread /${botBoard}/${botThreadId} on ${DVACH_DOMAINS[0]}:\n"${opPostTextContent}"\nCONTEXT_END\n`;
            }
            
            if (opPost && currentBotSettings.geminiAnalyzeOpMedia &&
                (!currentBotOpMediaCache || currentBotOpMediaCache.threadId !== botThreadId || currentBotOpMediaCache.opPostNum !== opPost.num)) {
                addAutonomousBotActivityLog(`Updating/creating OP media cache (>>${opPost.num})...`, 'bot_setup');
                const opMediaPartsAccumulator: Part[] = [];
                let opMediaContextTextAccumulator = "";
                if (opPost.files && opPost.files.length > 0) {
                    const imagesToAnalyzeForOp = opPost.files
                        .filter(f => f.type === 1 || f.type === 2 || f.type === 4 || f.type === 9) 
                        .slice(0, currentBotSettings.maxImagesToAnalyzePerPost);
                    for (const file of imagesToAnalyzeForOp) {
                        try {
                            const imageUrl = `${DVACH_DOMAINS[0]}${file.path}`; 
                            const proxiedImageUrl = buildProxiedGetUrl(imageUrl, currentBotSettings.proxyModeForImagesGET, currentBotSettings.customProxyUrlForImagesGET);
                            addAutonomousBotActivityLog(`Fetching OP image ${file.name} (>>${opPost.num}) using proxy '${currentBotSettings.proxyModeForImagesGET}'`, 'bot_activity');
                            const imgResp = await fetch(proxiedImageUrl);
                            if (!imgResp.ok) throw new Error(`Proxy fetch failed for OP image ${file.name}: ${imgResp.status} ${imgResp.statusText}`);
                            const blob = await imgResp.blob();
                            let mimeType = blob.type;
                            if (!mimeType || !mimeType.startsWith('image/')) mimeType = file.type === 1 ? 'image/jpeg' : file.type === 2 ? 'image/png' : file.type === 4 ? 'image/gif' : file.type === 9 ? 'image/webp' : 'image/jpeg';
                            const base64 = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onloadend = () => res((r.result as string).split(',')[1]); r.onerror = rej; r.readAsDataURL(blob); });
                            opMediaPartsAccumulator.push({ inlineData: { mimeType: mimeType, data: base64 } });
                            opMediaContextTextAccumulator += ` OP Image: '${file.name}'.`;
                        } catch (e) { addAutonomousBotActivityLog(`Error fetching/processing OP image ${file.name}: ${(e as Error).message}`, 'bot_warning'); }
                    }
                }
                setCurrentBotOpMediaCache({ threadId: botThreadId, opPostNum: opPost.num, mediaParts: opMediaPartsAccumulator, mediaContextText: opMediaContextTextAccumulator });
                addAutonomousBotActivityLog(`OP media cache updated. ${opMediaPartsAccumulator.length} images. Context: ${opMediaContextTextAccumulator}`, 'bot_setup');
            } else if (!opPost || !currentBotSettings.geminiAnalyzeOpMedia) {
                if (currentBotOpMediaCache) setCurrentBotOpMediaCache(null); 
            }

            const opMediaPartsForInitialContext = (currentBotOpMediaCache?.threadId === botThreadId && currentBotOpMediaCache.opPostNum === opPost?.num) ? currentBotOpMediaCache.mediaParts : [];

            if (!existingConversation || existingConversation.status === 'archived' || existingConversation.board !== botBoard || existingConversation.threadId !== botThreadId) {
                addAutonomousBotActivityLog(`Creating new conversation context for ${currentBotTargetKeyForCycle}. Scope: ${currentBotSettings.autonomousBotInitialContextScope}`, 'bot_setup');
                const initialHistoryMessageParts: Part[] = [...opMediaPartsForInitialContext, { text: initialContextTextForSystemMessage }];
                workingConvo = {
                    id: currentBotTargetKeyForCycle, board: botBoard, threadId: botThreadId,
                    triggerPostNum: opPost?.num || botThreadId, 
                    botSystemPromptUsed: currentBotSettings.autonomousBotSystemPrompt,
                    history: [{ role: 'user', parts: initialHistoryMessageParts, timestamp: Date.now(), id: `context-setup-${Date.now()}` }],
                    lastCheckedTimestamp: Date.now(), participatingPostNumbers: [opPost?.num || botThreadId],
                    status: 'context_built',
                    initialContext: { opPostNum: opPost?.num, opPostText: initialContextTextForSystemMessage, opPostMediaParts: opMediaPartsForInitialContext }
                };
            } else { 
                 workingConvo = JSON.parse(JSON.stringify(existingConversation)); 
                 let updatedHistory = [...workingConvo!.history];
                 const knownPostNumbersInHistoryOrProcessed = new Set([
                    ...updatedHistory.filter(msg => msg.role === 'user' && msg.id.startsWith("user-dvach-")).map(msg => msg.id.replace("user-dvach-","")),
                    ...updatedHistory.filter(msg => msg.role === 'model' && msg.id.startsWith("model-reply-to-")).map(msg => msg.id.replace("model-reply-to-","")),
                    ...updatedHistory.filter(msg => msg.id.startsWith("bot-")).map(msg => msg.id.replace('bot-','')), 
                    ...workingConvo!.participatingPostNumbers
                 ]);
                 
                 const newPostsFromThread = allPostsInThread.filter(p => 
                    p.timestamp * 1000 > workingConvo!.lastCheckedTimestamp && 
                    !knownPostNumbersInHistoryOrProcessed.has(p.num) &&
                    (!sentMessages.some(sm => sm.num === p.num && sm.isGeminiPost && sm.board === botBoard && sm.thread === botThreadId) || currentBotSettings.autonomousBotAllowReplyToSelf)
                );

                 if (newPostsFromThread.length > 0) {
                    addAutonomousBotActivityLog(`Adding ${newPostsFromThread.length} new posts to conversation history.`, 'bot_setup');
                    newPostsFromThread.forEach(p => {
                        const postContentForHistory = `Post >>${p.num} (by ${p.name || 'Anon'} at ${new Date(p.timestamp * 1000).toLocaleTimeString()}): "${p.comment.replace(/<[^>]+>/g, '').substring(0,300)}"`;
                        updatedHistory.push({id: `user-dvach-${p.num}`, role: 'user', parts: [{text: postContentForHistory}], timestamp: p.timestamp * 1000 });
                        if(!workingConvo!.participatingPostNumbers.includes(p.num)) workingConvo!.participatingPostNumbers.push(p.num);
                    });
                    
                    if (updatedHistory.length > 50) { 
                        const contextSetupMessage = updatedHistory.find(msg => msg.id.startsWith("context-setup-"));
                        const otherMessages = updatedHistory.filter(msg => !msg.id.startsWith("context-setup-"));
                        updatedHistory = contextSetupMessage ? [contextSetupMessage, ...otherMessages.slice(-49)] : otherMessages.slice(-50);
                    }
                 }
                 workingConvo!.history = updatedHistory;
                 if (workingConvo!.initialContext) { 
                    workingConvo!.initialContext.opPostMediaParts = opMediaPartsForInitialContext;
                 }
            }
        }
    } catch (err) {
        addAutonomousBotActivityLog(`Error during thread data fetch/context setup for bot: ${(err as Error).message}. Cycle ending.`, 'bot_error', err);
        if (existingConversation) { 
            workingConvo = { ...existingConversation, lastCheckedTimestamp: Date.now(), status: 'error' };
        } 
    }
    
    if (!workingConvo) {
        addAutonomousBotActivityLog("CRITICAL: Bot conversation context is null/undefined (e.g., initial thread fetch failed). Cycle ending.", 'bot_error', { contextKey: currentBotTargetKeyForCycle, existingConvoStatus: existingConversation?.status });
        setAutonomousBotStatus("Error: Bot context initialization failure.");
        if (existingConversation && existingConversation.status !== 'error') {
             const erroredConvo = { ...existingConversation, lastCheckedTimestamp: Date.now(), status: 'error' as const };
             setGeminiDvachConversations(prevConvos => new Map(prevConvos).set(currentBotTargetKeyForCycle, erroredConvo));
        }
        return; 
    }
    
    let activeConversationForCycle: GeminiDvachConversation = workingConvo;

    if (currentBotSettings.autonomousBotReplyMode === 'random_in_thread') {
        setAutonomousBotStatus("Mode 'random_in_thread': Finding target...");
        const allPostsInThreadForRandom = (await getThreadData(botBoard, botThreadId, currentBotSettings.proxyModeForGET, currentBotSettings.customProxyUrlForGET, currentBotSettings.userAgent))?.threads?.[0]?.posts || [];
        const opPostNumInBotLogic = allPostsInThreadForRandom.find(p => p.num === botThreadId || p.op ===1)?.num;

        const botPostNumbers = new Set(sentMessages
            .filter(sm => sm.isGeminiPost && sm.board === botBoard && sm.thread === botThreadId)
            .map(sm => sm.num));

        const eligiblePosts = allPostsInThreadForRandom.filter(p => 
            p.num !== opPostNumInBotLogic && 
            (!botPostNumbers.has(p.num) || currentBotSettings.autonomousBotAllowReplyToSelf) && 
            !BUMP_KEYWORDS.some(kw => p.comment.toLowerCase().includes(kw)) &&
            !activeConversationForCycle.participatingPostNumbers.includes(p.num) 
        );

        if (eligiblePosts.length === 0) {
            addAutonomousBotActivityLog("No eligible posts for random reply in this cycle.", 'bot_activity');
        } else {
            const targetPost = eligiblePosts[Math.floor(Math.random() * eligiblePosts.length)];
            addAutonomousBotActivityLog(`Bot selected random post >>${targetPost.num} for reply.`, 'bot_activity');
            setAutonomousBotStatus(`Generating reply to >>${targetPost.num}...`);

            let historyForGeminiCall = [...activeConversationForCycle.history];
            
            let currentUserMessageText = `You are replying to post >>${targetPost.num}. This post says: "${targetPost.comment.replace(/<[^>]+>/g, '').substring(0, 500)}".`;
            const currentUserMessageParts: Part[] = [];

            if (currentBotSettings.botAnalyzesImagesInTriggerPosts && targetPost.files && targetPost.files.length > 0) {
                const imagesInTarget = targetPost.files.filter(f => f.type === 1 || f.type === 2 || f.type === 4 || f.type === 9).slice(0, currentBotSettings.maxImagesToAnalyzePerPost);
                for (const file of imagesInTarget) {
                      try {
                        const imageUrl = `${DVACH_DOMAINS[0]}${file.path}`;
                        const proxiedImageUrl = buildProxiedGetUrl(imageUrl, currentBotSettings.proxyModeForImagesGET, currentBotSettings.customProxyUrlForImagesGET);
                        addAutonomousBotActivityLog(`Fetching image ${file.name} from post >>${targetPost.num} using proxy '${currentBotSettings.proxyModeForImagesGET}'`, 'bot_activity');
                        const imgResp = await fetch(proxiedImageUrl);
                        if (!imgResp.ok) throw new Error(`Proxy fetch failed for target image ${file.name}: ${imgResp.status}`);
                        const blob = await imgResp.blob();
                        let mimeType = blob.type;
                        if (!mimeType || !mimeType.startsWith('image/')) mimeType = file.type === 1 ? 'image/jpeg' : file.type === 2 ? 'image/png' : file.type === 4 ? 'image/gif' : file.type === 9 ? 'image/webp' : 'image/jpeg';
                        const base64 = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onloadend = () => res((r.result as string).split(',')[1]); r.onerror = rej; r.readAsDataURL(blob); });
                        currentUserMessageParts.push({ inlineData: { mimeType: mimeType, data: base64 } });
                        currentUserMessageText += ` This post contains image '${file.name}'.`;
                    } catch (e) { addAutonomousBotActivityLog(`Error fetching image ${file.name} from post >>${targetPost.num}: ${(e as Error).message}`, 'bot_warning'); }
                }
            }
            currentUserMessageParts.push({text: currentUserMessageText + `\nGenerate your reply.`});
            historyForGeminiCall.push({ role: 'user', parts: currentUserMessageParts, timestamp: Date.now(), id: `user-dvach-${targetPost.num}`}); 
            
            try {
                const botGenConfig: GenerateContentParameters['config'] = {
                    systemInstruction: currentBotSettings.autonomousBotSystemPrompt, 
                    temperature: 0.85, topK: 50, topP: 0.95, 
                    maxOutputTokens: AUTONOMOUS_BOT_MAX_OUTPUT_TOKENS,
                    responseMimeType: "application/json", 
                    responseSchema: { type: Type.OBJECT, properties: { replyText: { type: Type.STRING } }, required: ["replyText"] },
                    safetySettings: currentBotSettings.geminiSafetySettings.map(s => ({ category: s.category as any, threshold: s.threshold as any})),
                };
                if (currentBotSettings.autonomousBotDisableThinking) {
                    botGenConfig.thinkingConfig = { thinkingBudget: 0 };
                } // else, omit to use default thinking

                const geminiApiResponse = await ai.models.generateContent({
                    model: GEMINI_TEXT_MODEL,
                    contents: historyForGeminiCall, 
                    config: botGenConfig
                });

                const textToParse = geminiApiResponse.text;
                if (typeof textToParse === 'string') {
                    const parsedReply = parseGeminiJsonResponse<BotReplySchema>(textToParse);
                    if (parsedReply && parsedReply.replyText) {
                        let rawReplyBody = parsedReply.replyText.trim();
                        const quotePatternForBot = new RegExp(`^>>${targetPost.num}\\s*\\n?`);
                        if (quotePatternForBot.test(rawReplyBody)) { // Check if Gemini included the quote
                           rawReplyBody = rawReplyBody.replace(quotePatternForBot, '').trim(); // Remove Gemini's quote
                        }
                        const finalCommentToPost = `>>${targetPost.num}\n${rawReplyBody}`; // Add our own consistent quote
                            
                        addAutonomousBotActivityLog(`Bot generated (JSON) reply for >>${targetPost.num}: ${rawReplyBody.substring(0, 70)}...`);
                        
                        const replyDelay = Math.floor(Math.random() * (currentBotSettings.autonomousBotMaxReplyDelayMs - currentBotSettings.autonomousBotMinReplyDelayMs + 1)) + currentBotSettings.autonomousBotMinReplyDelayMs;
                        addAutonomousBotActivityLog(`Waiting for ${replyDelay}ms before posting reply...`, 'bot_activity');
                        await new Promise(resolve => window.setTimeout(resolve, replyDelay));

                        let finalFileToPostForBot: File | null = null;
                        if (currentBotSettings.geminiReplyWithGeneratedImage) {
                            addLog(`Bot attempting to generate image for reply >>${targetPost.num}...`, 'gemini');
                            const imageGenPromptText = `Imageboard reply context: "${rawReplyBody.substring(0,150)}"`;
                            try {
                                const imgGenResp = await ai.models.generateImages({ model: GEMINI_IMAGE_MODEL, prompt: imageGenPromptText, config: { numberOfImages: 1, outputMimeType: 'image/jpeg' } });
                                if (imgGenResp.generatedImages?.[0]?.image?.imageBytes) {
                                    finalFileToPostForBot = await base64ToFile(imgGenResp.generatedImages[0].image.imageBytes, `bot_img_${Date.now()}.jpg`, imgGenResp.generatedImages[0].image.mimeType || 'image/jpeg');
                                    addLog(`Bot generated image for reply >>${targetPost.num}.`, 'gemini');
                                } else { addLog(`Bot image generation failed or no image returned for >>${targetPost.num}.`, 'bot_warning');}
                            } catch (imgErrBot) { addLog(`Bot image generation error for >>${targetPost.num}: ${(imgErrBot as Error).message}.`, 'bot_warning'); }
                        }

                        try {
                            const newPostNum = await commonPostToDvach(finalCommentToPost, finalFileToPostForBot, false, botBoard, botThreadId, targetPost.num);
                            setSentMessages(prev => [{ num: newPostNum, timestamp: Date.now(), comment: finalCommentToPost, board: botBoard, thread: botThreadId, parent: targetPost.num, isGeminiPost: true, geminiTriggerPostNum: targetPost.num, geminiGeneratedImage: !!finalFileToPostForBot }, ...prev]);
                            
                            const botReplyChatMessage: ChatMessage = { id: `model-reply-to-${targetPost.num}-${newPostNum}`, role: 'model', parts: [{text: rawReplyBody}], timestamp: Date.now() }; 
                            const userMessageForHistory: ChatMessage = { id: `user-dvach-${targetPost.num}`, role: 'user', parts: currentUserMessageParts, timestamp: Date.now() - 100 }; 
                            
                            activeConversationForCycle = { 
                                ...activeConversationForCycle,
                                participatingPostNumbers: [...activeConversationForCycle.participatingPostNumbers, targetPost.num, newPostNum],
                                history: [...activeConversationForCycle.history.filter(m => m.id !== `user-dvach-${targetPost.num}`), userMessageForHistory, botReplyChatMessage], 
                                lastBotReplyNum: newPostNum,
                                status: 'active'
                            };
                            setAutonomousBotStatus(`Replied as >>${newPostNum} to >>${targetPost.num}`);
                        } catch (postError) {
                              const pe = postError as Error;
                              if (pe.message.toLowerCase().includes("вы постите слишком быстро") || pe.message.includes("-8")) { 
                                addAutonomousBotActivityLog(`Posting error: Posting too fast. Skipping this reply. Consider increasing bot cycle interval.`, 'bot_warning', {message: pe.message});
                              } else { throw pe; } 
                        }
                    } else {
                        addAutonomousBotActivityLog(`Error parsing Gemini JSON response or replyText missing for >>${targetPost.num}. Response: ${textToParse.substring(0,200)}`, 'bot_warning', parsedReply);
                    }
                } else {
                      addAutonomousBotActivityLog(`Gemini response has no text part for >>${targetPost.num}. Response: ${JSON.stringify(geminiApiResponse)}`, 'bot_warning');
                }
            } catch (geminiError) { 
                const errorMsg = (geminiError as Error).message;
                let finalErrorMsg = errorMsg;
                if (errorMsg && errorMsg.includes("got status: 429")) { 
                      try {
                        const errorJsonMatch = errorMsg.match(/{.*}/s); 
                        if (errorJsonMatch && errorJsonMatch[0]) {
                            const errorDetails = JSON.parse(errorJsonMatch[0]);
                            if (errorDetails.error?.status === "RESOURCE_EXHAUSTED") {
                                const retryInfo = errorDetails.error.details?.find((d: any) => d['@type'] === 'type.googleapis.com/google.rpc.RetryInfo');
                                const delay = retryInfo?.retryDelay; 
                                finalErrorMsg = `Gemini API rate limit (429) hit. Suggested delay: ${delay || 'N/A'}. Review quota or wait.`;
                                addAutonomousBotActivityLog(finalErrorMsg, 'bot_error', errorDetails);
                            } else { addAutonomousBotActivityLog(`Gemini API error (in bot cycle): ${errorMsg}`, 'bot_error', geminiError); }
                        } else { addAutonomousBotActivityLog(`Gemini API error (unparsable 429 details, in bot cycle): ${errorMsg}`, 'bot_error', geminiError); }
                      } catch (parseErr) { addAutonomousBotActivityLog(`Gemini API error (parsing 429 message failed, in bot cycle): ${errorMsg}`, 'bot_error', geminiError); }
                } else { addAutonomousBotActivityLog(`Gemini API error during bot reply generation: ${errorMsg}`, 'bot_error', geminiError); }
                setAutonomousBotStatus(`Error: Gemini API issue for >>${targetPost.num}`);
                activeConversationForCycle = { ...activeConversationForCycle, status: 'error' };
            }
        }
    } else if (currentBotSettings.autonomousBotReplyMode === 'replies_to_bot') {
          addAutonomousBotActivityLog("Mode 'replies_to_bot' needs further development.", 'bot_warning');
    }
    
    activeConversationForCycle.lastCheckedTimestamp = Date.now();
    setGeminiDvachConversations(prevConvos => new Map(prevConvos).set(currentBotTargetKeyForCycle, activeConversationForCycle));
    
    setAutonomousBotStatus(`Waiting (${currentBotSettings.autonomousBotCycleIntervalSeconds}s) /${botBoard}/${botThreadId}`);
    addAutonomousBotActivityLog("Bot cycle finished.", 'bot_activity');

}, [
    ai, dvachSessionCookies, settings, addAutonomousBotActivityLog,
    setAutonomousBotStatus, geminiDvachConversations, setGeminiDvachConversations, 
    sentMessages, setSentMessages, currentBotOpMediaCache, setCurrentBotOpMediaCache
]);


// Main useEffect for managing the autonomous bot's interval and lifecycle
useEffect(() => {
    if (!autonomousBotActive) {
        if (autonomousBotIntervalRef.current) {
            window.clearInterval(autonomousBotIntervalRef.current);
            autonomousBotIntervalRef.current = null;
            removeTask('bot_cycle'); // Use the correct task type
        }
        setAutonomousBotStatus("Inactive - Bot Stopped");
        setCurrentBotOpMediaCache(null); 
        return;
    }

    if (!ai || !dvachSessionCookies?.passcode_auth || !settings.autonomousBotTargetBoard.trim() || !settings.autonomousBotTargetThreadId.trim()) {
        let reason = "";
        if (!ai) reason = "Gemini AI not initialized";
        else if (!dvachSessionCookies?.passcode_auth) reason = "Not logged into Dvach";
        else if (!settings.autonomousBotTargetBoard.trim() || !settings.autonomousBotTargetThreadId.trim()) reason = "Target board/thread not set";
        
        setAutonomousBotStatus(`Inactive - ${reason}`);
        if (autonomousBotActive) { 
             addLog(`Autonomous bot cannot run: ${reason}. Stopping.`, "bot_error");
        }
        setAutonomousBotActive(false); 
        return;
    }
    
    addLog(`Autonomous bot starting interval... Interval: ${settings.autonomousBotCycleIntervalSeconds}s. Target: /${settings.autonomousBotTargetBoard.trim()}/${settings.autonomousBotTargetThreadId.trim()}`, 'bot_setup');
    setAutonomousBotStatus("Active - Preparing for first cycle...");
    addTask('bot_cycle', `Bot running on /${settings.autonomousBotTargetBoard}/${settings.autonomousBotTargetThreadId}`, () => setAutonomousBotActive(false));
    
    const initialTimeoutId = window.setTimeout(() => {
        if (autonomousBotActive) runBotCycleCallback(); 
    }, 3000); 

    const intervalId = window.setInterval(() => {
      if (autonomousBotActive) runBotCycleCallback(); 
    }, settings.autonomousBotCycleIntervalSeconds * 1000);
    
    autonomousBotIntervalRef.current = intervalId;

    return () => { 
        window.clearTimeout(initialTimeoutId);
        window.clearInterval(intervalId);
        autonomousBotIntervalRef.current = null;
        removeTask('bot_cycle'); // Use the correct task type
        addLog("Autonomous bot interval stopped (useEffect cleanup).", "bot_setup");
    };
}, [
    autonomousBotActive, 
    runBotCycleCallback, 
    settings.autonomousBotCycleIntervalSeconds, 
    addLog, 
    ai, 
    dvachSessionCookies, 
    settings.autonomousBotTargetBoard, 
    settings.autonomousBotTargetThreadId,
    addTask, // Added missing dependency
    removeTask // Added missing dependency
]);

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

   // Placeholder function implementations
  const readFileContent = async (file: File): Promise<string[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        resolve(text.split(/\r\n|\n/));
      };
      reader.onerror = (error) => reject(error);
      reader.readAsText(file);
    });
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
    _setter: React.Dispatch<React.SetStateAction<string[]>> // Original setter, not used directly for single file
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      addLog(`File "${file.name}" selected for generic upload. This uploader is a placeholder.`, 'info', { name: file.name, size: file.size });
      // Example usage:
      // const lines = await readFileContent(file);
      // setter(lines);
      // addLog(`File "${file.name}" content read (first 5 lines):`, 'info', lines.slice(0,5));
    }
  };
  
  const handleGeminiLabImageForMultimodalUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setGeminiLabImageForMultimodal(file);
      addLog(`Image "${file.name}" selected for Gemini Lab multimodal input.`, 'gemini');
    } else {
      setGeminiLabImageForMultimodal(null);
    }
  };


  const runKeywordReply = useCallback(async () => { 
    addLog('runKeywordReply function (old bot logic) is not applicable to the current autonomous bot structure.', 'warning');
  }, [addLog]);

  // Gemini Lab Actions
  const handleGeminiAction = useCallback(async (feature: GeminiFeature) => {
    if (!ai) { addLog('Gemini AI not initialized. Check API Key.', 'error'); return; }
    setGeminiLoading(true);
    setGeminiLabOutput(null);
    setGeminiLabGroundingSources([]);

    const currentLabPrompt = geminiLabPrompt.trim();
    const currentImageGenPrompt = geminiLabImageGenPrompt.trim();
    const taskId = addTask('gemini_request', `Gemini Lab: ${feature} - Prompt: "${(feature === GeminiFeature.IMAGE_GENERATION ? currentImageGenPrompt : currentLabPrompt).substring(0, 30)}..."`, () => setGeminiLoading(false));

    try {
      const baseConfig: GenerateContentParameters['config'] = {
        temperature: settings.geminiTemperature,
        topP: settings.geminiTopP,
        topK: settings.geminiTopK,
        maxOutputTokens: settings.geminiMaxOutputTokens,
        responseMimeType: settings.geminiResponseMimeType, // Note: Not applicable for image generation
        safetySettings: settings.geminiSafetySettings.map(s => ({ category: s.category as any, threshold: s.threshold as any })),
      };
      if(settings.useThinkingBudget && feature !== GeminiFeature.IMAGE_GENERATION) {
        baseConfig.thinkingConfig = {thinkingBudget: settings.geminiThinkingBudget};
      }
      if(settings.useSearchGrounding && (feature === GeminiFeature.GENERATE_CONTENT || feature === GeminiFeature.GENERATE_CONTENT_STREAM)) {
        baseConfig.tools = [{googleSearch: {}}];
      }

      if (feature === GeminiFeature.CHAT) {
        if (!currentLabPrompt) {
          addLog("Chat prompt cannot be empty for Gemini Lab.", 'warning');
          setGeminiLoading(false);
          removeTask(taskId);
          return;
        }
        
        let chat = currentGeminiLabChat;
        if (!chat) {
          chat = ai.chats.create({ 
            model: GEMINI_TEXT_MODEL, 
            config: { systemInstruction: settings.geminiSystemInstruction, safetySettings: baseConfig.safetySettings },
            history: geminiLabChatMessages.map(m => ({ role: m.role, parts: m.parts })) // Convert app history to SDK history
          });
          setCurrentGeminiLabChat(chat);
        }

        const userMessage: ChatMessage = { id: `lab-user-${Date.now()}`, role: 'user', parts: [{text: currentLabPrompt}], timestamp: Date.now(), isLoading: true };
        setGeminiLabChatMessages(prev => [...prev, userMessage]);
        setGeminiLabPrompt(''); // Clear input after sending

        const streamResponse = await chat.sendMessageStream({ message: currentLabPrompt });
        
        const modelStreamingMessage: ChatMessage = { id: `lab-model-stream-${Date.now()}`, role: 'model', parts: [{text: ""}], timestamp: Date.now(), isStreaming: true };
        setCurrentStreamingMessage(modelStreamingMessage);
        setGeminiLabChatMessages(prev => prev.map(m => m.id === userMessage.id ? {...m, isLoading: false} : m));


        let accumulatedText = "";
        for await (const chunk of streamResponse) {
          accumulatedText += chunk.text;
          setCurrentStreamingMessage(prev => prev ? { ...prev, parts: [{ text: accumulatedText }] } : null);
        }
        
        if (currentStreamingMessage) { // Ensure it hasn't been cleared by clearChatHistory
             setGeminiLabChatMessages(prev => [...prev.filter(m => m.id !== modelStreamingMessage.id), { ...modelStreamingMessage, parts: [{ text: accumulatedText }], isStreaming: false }]);
        }
        setCurrentStreamingMessage(null);

      } else if (feature === GeminiFeature.GENERATE_CONTENT || feature === GeminiFeature.GENERATE_CONTENT_STREAM) {
        if (!currentLabPrompt) { addLog("Prompt cannot be empty for Generate Content.", 'warning'); setGeminiLoading(false); removeTask(taskId); return;}
        
        const contentParts: Part[] = [];
        if(geminiLabImageForMultimodal){
            const imageBytes = await geminiLabImageForMultimodal.arrayBuffer();
            contentParts.push({ inlineData: { mimeType: geminiLabImageForMultimodal.type, data: Buffer.from(imageBytes).toString('base64') }});
        }
        contentParts.push({text: currentLabPrompt});
        
        addLog(`Gemini Lab: ${feature} with prompt: "${currentLabPrompt.substring(0,50)}..." ${geminiLabImageForMultimodal ? `and image ${geminiLabImageForMultimodal.name}` : '' }`, 'gemini');

        if (feature === GeminiFeature.GENERATE_CONTENT_STREAM) {
          const streamResponse = await ai.models.generateContentStream({ model: GEMINI_TEXT_MODEL, contents: [{role: 'user', parts: contentParts}], config: baseConfig });
          let fullText = "";
          for await (const chunk of streamResponse) {
            fullText += chunk.text;
            setGeminiLabOutput(fullText); // Update UI incrementally
          }
          const finalResponse = await streamResponse.response;
          setGeminiLabGroundingSources(finalResponse.candidates?.[0]?.groundingMetadata?.groundingAttribution?.map(ga => ({ web: { uri: ga.content.uri, title: ga.content.title } })) || []);
          addLog(`Gemini Lab (Stream) response received. Length: ${fullText.length}`, 'gemini');
        } else { // GENERATE_CONTENT
          const response = await ai.models.generateContent({ model: GEMINI_TEXT_MODEL, contents: [{role: 'user', parts: contentParts}], config: baseConfig }) as CustomGenerateContentResponse;
          setGeminiLabOutput(response.text || "No text content received.");
          setGeminiLabGroundingSources(response.candidates?.[0]?.groundingMetadata?.groundingAttribution?.map(ga => ({ web: { uri: ga.content.uri, title: ga.content.title } })) || []);
          addLog(`Gemini Lab (Generate) response received. Length: ${response.text?.length || 0}`, 'gemini');
        }
      } else if (feature === GeminiFeature.IMAGE_GENERATION) {
        if (!currentImageGenPrompt) { addLog("Image generation prompt cannot be empty.", 'warning'); setGeminiLoading(false); removeTask(taskId); return; }
        addLog(`Gemini Lab: Generating ${geminiLabNumImagesToGenerate} image(s) for prompt: "${currentImageGenPrompt.substring(0,50)}..."`, 'gemini');
        const response = await ai.models.generateImages({
            model: GEMINI_IMAGE_MODEL,
            prompt: currentImageGenPrompt,
            config: { numberOfImages: geminiLabNumImagesToGenerate, outputMimeType: 'image/jpeg' } // safetySettings removed
        });
        const images: GeneratedImage[] = response.generatedImages.map(img => ({
            base64Data: img.image.imageBytes,
            mimeType: img.image.mimeType || 'image/jpeg',
            prompt: currentImageGenPrompt
        }));
        setGeminiLabOutput(images); // For display in the lab output area
        addLog(`Gemini Lab: ${images.length} image(s) generated.`, 'gemini');
      }
    } catch (error) {
      addLog(`Error in Gemini Lab (${feature}): ${(error as Error).message}`, 'error', error);
      setGeminiLabOutput(`Error: ${(error as Error).message}`);
    } finally {
      setGeminiLoading(false);
      removeTask(taskId);
    }
  }, [ai, settings, geminiLabPrompt, geminiLabImageForMultimodal, geminiLabImageGenPrompt, geminiLabNumImagesToGenerate, currentGeminiLabChat, geminiLabChatMessages, addLog, addTask, removeTask]);

  const clearGeminiLabChatHistory = () => { 
    setGeminiLabChatMessages([]); 
    setCurrentGeminiLabChat(null);
    setCurrentStreamingMessage(null);
    addLog('Gemini Lab chat history cleared.', 'info'); 
  };
  

  const renderDvachPostCard = (post: DvachPost, index: number) => {
     const boardIdentifier = currentBoard.trim();
     const threadIdentifier = currentThreadId.trim();
     const sentMessageData = sentMessages.find(m => m.num === post.num && m.board === boardIdentifier && m.thread === threadIdentifier);
     const isMyPost = !!sentMessageData;
     const isGeminiPostByBot = sentMessageData?.isGeminiPost || false;

     const isGeminiReplyToThis = sentMessages.some(m => m.geminiTriggerPostNum === post.num && m.isGeminiPost && m.board === boardIdentifier && m.thread === threadIdentifier);
    
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
          <a href={`${DVACH_DOMAINS[0]}/${boardIdentifier}/res/${threadIdentifier}.html#${post.num}`} 
             target="_blank" rel="noopener noreferrer"
             className="hover:underline text-blue-500 dark:text-blue-400"
             onClick={(e) => { e.preventDefault(); document.getElementById(`post-${post.num}`)?.scrollIntoView({behavior: 'smooth'}); }}
             aria-label={`Link to post number ${post.num} on Dvach`}
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
            const imageBaseUrl = DVACH_DOMAINS[0]; 
            const fileUrl = `${imageBaseUrl}${file.path}`;
            const thumbUrl = `${imageBaseUrl}${file.thumbnail}`;
            const proxiedThumbUrl = buildProxiedGetUrl(thumbUrl, settings.proxyModeForImagesGET, settings.customProxyUrlForImagesGET);

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
                {file.name} ({file.size}KB) 
              </div>
            </a>
          );
        })}
        </div>
      )}

      <div 
        className="prose prose-sm dark:prose-invert max-w-none break-words"
        dangerouslySetInnerHTML={{ __html: post.comment.replace(/&gt;&gt;(\d+)/g, (_match, p1) => `<a href="#post-${p1}" class="text-blue-500 dark:text-blue-400 hover:underline" data-replyto="${p1}" aria-label="Reply to post ${p1}">&gt;&gt;${p1}</a>`) }}
      />

      <div className="mt-2 text-right">
        {isGeminiReplyToThis && <span className="text-xs text-purple-600 dark:text-purple-400 mr-2">Gemini replied</span>}
        <button 
          onClick={() => handleManualGeminiReplyToDvachPost(post)}
          disabled={geminiLoading || !ai || !dvachSessionCookies?.passcode_auth || !boardIdentifier || !threadIdentifier}
          className="px-3 py-1 text-xs bg-purple-500 hover:bg-purple-600 text-white rounded-md font-medium flex items-center shadow disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title={!ai ? "Gemini AI not initialized. Check API Key." : !dvachSessionCookies?.passcode_auth ? "Login to Dvach to reply." : "Reply to this post using Gemini AI"}
          aria-label={`Reply to post ${post.num} with Gemini`}
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
            disabled={isPosting || !dvachSessionCookies?.passcode_auth || !currentBoard.trim() || !postText.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium flex items-center shadow transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={!dvachSessionCookies?.passcode_auth ? "Login to post" : (!currentBoard.trim() || !postText.trim()) ? "Board and comment required" : "Post message"}
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
                disabled={isFetchingThread || !currentBoard.trim() || !currentThreadId.trim()}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-md font-medium flex items-center shadow disabled:opacity-50 transition-colors"
                title={(!currentBoard.trim() || !currentThreadId.trim()) ? "Enter Board and Thread ID above" : "Fetch posts"}
            >
                <IconRefresh className={`mr-2 h-5 w-5 ${isFetchingThread ? 'animate-spin' : ''}`}/> Fetch Thread Posts
            </button>
        </div>
        {(!currentBoard.trim() || !currentThreadId.trim()) && <p className="text-sm text-yellow-600 dark:text-yellow-400">Enter Board and Thread ID above to view posts.</p>}
        {fetchError && !fetchError.includes("Login failed") && !fetchError.includes("Failed to post") && <p className="text-sm text-red-600 dark:text-red-400">Error: {fetchError}</p>}
        <div ref={threadPostsContainerRef} className="max-h-[600px] overflow-y-auto bg-gray-100 dark:bg-gray-800 p-2 rounded custom-scrollbar border border-gray-200 dark:border-gray-700">
            {isFetchingThread && <p className="text-center p-4">Loading thread...</p>}
            {!isFetchingThread && currentFetchedDvachPosts.length === 0 && (!currentBoard.trim() || !currentThreadId.trim() || fetchError) &&
                 <p className="text-center p-4 text-gray-500 dark:text-gray-400">No posts loaded. Enter Board/Thread ID and click "Fetch Thread Posts".</p>
            }
             {!isFetchingThread && currentFetchedDvachPosts.length === 0 && currentBoard.trim() && currentThreadId.trim() && !fetchError &&
                 <p className="text-center p-4 text-gray-500 dark:text-gray-400">Thread fetched, but it's empty or an error occurred preventing display (check logs).</p>
            }
            {currentFetchedDvachPosts.map(renderDvachPostCard)}
        </div>
      </div>
    </div>
  );

  const renderGeminiPanel = () => (
    <div className="space-y-6 p-4 md:p-6 bg-white dark:bg-gray-800 shadow-lg rounded-lg">
      <h2 className="text-2xl font-semibold text-purple-600 dark:text-purple-400 border-b pb-2 border-gray-300 dark:border-gray-700">Gemini AI Laboratory</h2>
      {!ai && (
         <div className="p-3 mb-4 bg-yellow-100 dark:bg-yellow-800 border border-yellow-300 dark:border-yellow-600 rounded-md text-yellow-700 dark:text-yellow-200 text-sm flex items-center">
            <IconAlertTriangle className="h-5 w-5 mr-2 text-yellow-500 dark:text-yellow-400" />
            <strong>Gemini AI Not Initialized.</strong> Please check API key in Settings.
        </div>
      )}

      {/* Gemini Lab Chat */}
      <div className="p-4 border rounded-md border-gray-200 dark:border-gray-600">
        <h3 className="text-lg font-medium mb-2">Gemini Chat (Streaming)</h3>
        <div className="h-80 overflow-y-auto border p-3 rounded mb-2 bg-gray-50 dark:bg-gray-700 custom-scrollbar space-y-2">
            {geminiLabChatMessages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] p-2.5 rounded-lg shadow ${msg.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100'}`}>
                        <p className="text-xs font-semibold capitalize mb-0.5">{msg.role} {msg.isLoading ? '(Sending...)' : ''}</p>
                        <div className="prose prose-sm dark:prose-invert max-w-none break-words whitespace-pre-wrap">{msg.parts[0]?.text || '[Non-text content]'}</div>
                        {msg.imagePreview && <img src={msg.imagePreview} alt="Preview" className="mt-1.5 rounded max-w-xs max-h-32 object-contain"/>}
                    </div>
                </div>
            ))}
            {currentStreamingMessage && (
                 <div className="flex justify-start">
                    <div className="max-w-[80%] p-2.5 rounded-lg shadow bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100">
                        <p className="text-xs font-semibold capitalize mb-0.5">Model (Streaming...)</p>
                         <div className="prose prose-sm dark:prose-invert max-w-none break-words whitespace-pre-wrap">{currentStreamingMessage.parts[0]?.text}<span className="animate-pulse">▍</span></div>
                    </div>
                </div>
            )}
            {geminiLabChatMessages.length === 0 && !currentStreamingMessage && <p className="text-sm text-center text-gray-500 py-10">Chat history is empty. Send a message to start.</p>}
        </div>
        <div className="flex items-center">
            <input 
                type="text" 
                value={geminiLabPrompt} 
                onChange={(e) => setGeminiLabPrompt(e.target.value)} 
                placeholder="Type your message to Gemini..." 
                className="flex-grow p-2 border rounded-l-md bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 focus:ring-1 focus:ring-purple-500"
                disabled={!ai || geminiLoading || !!currentStreamingMessage}
                onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && ai && !geminiLoading && geminiLabPrompt.trim() && handleGeminiAction(GeminiFeature.CHAT)}
            />
            <button 
              onClick={() => handleGeminiAction(GeminiFeature.CHAT)} 
              disabled={geminiLoading || !ai || !geminiLabPrompt.trim() || !!currentStreamingMessage}
              className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-r-md flex items-center disabled:opacity-50 transition-colors"
              title="Send message to Gemini Chat"
            >
              <IconSend className="h-5 w-5"/>
            </button>
        </div>
        <button onClick={clearGeminiLabChatHistory} className="text-xs text-gray-500 hover:underline mt-1.5 disabled:opacity-50" disabled={geminiLabChatMessages.length === 0 && !currentStreamingMessage}>Clear Chat History</button>
      </div>
      
      {/* Standalone Gemini Actions */}
      <div className="grid md:grid-cols-2 gap-4 mt-4">
        {/* Generate Content Section */}
        <div className="p-4 border rounded-md border-gray-200 dark:border-gray-600">
            <h3 className="text-lg font-medium mb-2">Generate Content (Text & Multimodal)</h3>
            <textarea value={geminiLabPrompt} onChange={e => setGeminiLabPrompt(e.target.value)} placeholder="Enter prompt for text/multimodal generation..." rows={3} className="w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 mb-2"/>
            <label className="block text-sm mb-2">
                Optional Image for Multimodal:
                <input type="file" accept="image/*" onChange={handleGeminiLabImageForMultimodalUpload} className="ml-2 text-xs file:text-xs file:font-semibold file:p-1 file:rounded-md file:border-0 file:bg-gray-200 dark:file:bg-gray-600 hover:file:bg-gray-300 dark:hover:file:bg-gray-500"/>
                {geminiLabImageForMultimodal && <span className="text-xs ml-2">{geminiLabImageForMultimodal.name} <button onClick={()=>setGeminiLabImageForMultimodal(null)} className="text-red-500 text-xs hover:underline">(clear)</button></span>}
            </label>
            <div className="flex space-x-2">
                <button onClick={() => handleGeminiAction(GeminiFeature.GENERATE_CONTENT)} disabled={geminiLoading || !ai || !geminiLabPrompt.trim()} className="btn-gemini flex-1"><IconFileText className="mr-1"/> Generate</button>
                <button onClick={() => handleGeminiAction(GeminiFeature.GENERATE_CONTENT_STREAM)} disabled={geminiLoading || !ai || !geminiLabPrompt.trim()} className="btn-gemini flex-1"><IconClock className="mr-1"/> Stream</button>
            </div>
        </div>

        {/* Image Generation Section */}
        <div className="p-4 border rounded-md border-gray-200 dark:border-gray-600">
            <h3 className="text-lg font-medium mb-2">Generate Images</h3>
            <input type="text" value={geminiLabImageGenPrompt} onChange={e => setGeminiLabImageGenPrompt(e.target.value)} placeholder="Enter prompt for image generation..." className="w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 mb-2"/>
            <div className="mb-2">
              <label htmlFor="numImages" className="text-sm mr-2">Number of Images:</label>
              <input type="number" id="numImages" min="1" max="4" value={geminiLabNumImagesToGenerate} onChange={e => setGeminiLabNumImagesToGenerate(parseInt(e.target.value))} className="w-20 p-1 border rounded bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"/>
            </div>
            <button onClick={() => handleGeminiAction(GeminiFeature.IMAGE_GENERATION)} disabled={geminiLoading || !ai || !geminiLabImageGenPrompt.trim()} className="btn-gemini w-full"><IconPhoto className="mr-1"/> Generate Images</button>
        </div>
      </div>

      {/* Output Area for Standalone Actions */}
      {(geminiLoading || geminiLabOutput) && (
        <div className="mt-4 p-4 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600">
            <h3 className="text-md font-medium mb-2">Gemini Lab Output:</h3>
            {geminiLoading && <p className="text-sm text-gray-500 dark:text-gray-400">Loading response...</p>}
            {geminiLabOutput && typeof geminiLabOutput === 'string' && <pre className="whitespace-pre-wrap text-sm">{geminiLabOutput}</pre>}
            {geminiLabOutput && Array.isArray(geminiLabOutput) && (
                <div className="flex flex-wrap gap-2">
                    {geminiLabOutput.map((img, idx) => (
                        <img key={idx} src={`data:${img.mimeType};base64,${img.base64Data}`} alt={img.prompt || `Generated Image ${idx + 1}`} className="max-w-xs max-h-64 border rounded object-contain shadow-md"/>
                    ))}
                </div>
            )}
            {geminiLabGroundingSources.length > 0 && (
                <div className="mt-3 pt-2 border-t border-gray-300 dark:border-gray-600">
                    <h4 className="text-xs font-semibold mb-1">Grounding Sources:</h4>
                    <ul className="list-disc list-inside text-xs space-y-0.5">
                        {geminiLabGroundingSources.map((source, idx) => (
                            <li key={idx}>
                                {source.web?.uri ? <a href={source.web.uri} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">{source.web.title || source.web.uri}</a> : 
                                 source.retrievedContext?.uri ? <a href={source.retrievedContext.uri} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">{source.retrievedContext.title || source.retrievedContext.uri}</a> : 
                                 'Unknown source'}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
      )}
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
                disabled={!ai || !dvachSessionCookies?.passcode_auth || !settings.autonomousBotTargetBoard.trim() || !settings.autonomousBotTargetThreadId.trim()}
                className={`px-4 py-2 text-sm font-medium rounded-md flex items-center shadow transition-colors
                    ${autonomousBotActive ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'} text-white
                    disabled:opacity-50 disabled:cursor-not-allowed`}
                title={
                    !ai ? "Gemini AI not initialized (check API key)" : 
                    !dvachSessionCookies?.passcode_auth ? "Not logged into Dvach" : 
                    (!settings.autonomousBotTargetBoard.trim() || !settings.autonomousBotTargetThreadId.trim()) ? "Bot target board/thread not set (see below or in Settings)" :
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


       {(!ai || !dvachSessionCookies?.passcode_auth || !settings.autonomousBotTargetBoard.trim() || !settings.autonomousBotTargetThreadId.trim()) &&
        <div className="p-3 bg-yellow-100 dark:bg-yellow-800 border-l-4 border-yellow-500 text-yellow-700 dark:text-yellow-200 rounded-md text-sm">
            <p className="font-semibold">Bot cannot start due to missing prerequisites:</p>
            <ul className="list-disc list-inside ml-4 text-xs">
                {!ai && <li>Gemini AI not initialized (check API key in Settings).</li>}
                {!dvachSessionCookies?.passcode_auth && <li>Not logged into Dvach (login on Manual Ops tab).</li>}
                {(!settings.autonomousBotTargetBoard.trim() || !settings.autonomousBotTargetThreadId.trim()) && <li>Bot's target board/thread ID not set (see fields above or in Settings).</li>}
            </ul>
        </div>
      }

      <div className="p-4 border rounded-md border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium mb-2 text-gray-700 dark:text-gray-300">Bot Status & Activity</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Current Status: <span className="font-semibold">{autonomousBotStatus}</span></p>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            Target: <span className="font-semibold">/{settings.autonomousBotTargetBoard.trim() || "[Not Set]"}/{settings.autonomousBotTargetThreadId.trim() || "[Not Set]"}</span> | 
            Mode: <span className="font-semibold">{settings.autonomousBotReplyMode.replace(/_/g, ' ')}</span> | 
            Interval: <span className="font-semibold">{settings.autonomousBotCycleIntervalSeconds}s</span> |
            Reply Delay: <span className="font-semibold">{settings.autonomousBotMinReplyDelayMs}-{settings.autonomousBotMaxReplyDelayMs}ms</span>
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
        <div className="max-h-[500px] overflow-y-auto custom-scrollbar space-y-2">
            {geminiDvachConversations.size === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No active bot conversation contexts tracked.</p>
            ) : (
                Array.from(geminiDvachConversations.values())
                  .sort((a: GeminiDvachConversation, b: GeminiDvachConversation) => (b?.lastCheckedTimestamp || 0) - (a?.lastCheckedTimestamp || 0))
                  .map((convo: GeminiDvachConversation) => (
                    convo && convo.id ? (
                      <details key={convo.id} className="p-2.5 mb-2 border rounded-lg bg-gray-50 dark:bg-gray-700/60 border-gray-200 dark:border-gray-600 text-xs shadow-sm hover:shadow-md transition-shadow">
                          <summary className="cursor-pointer font-medium text-gray-700 dark:text-gray-300 select-none">
                              ID: <button onClick={() => addLog("Bot Conversation Context Details:", 'info', convo)} className="text-indigo-500 hover:underline truncate" title="Click to see full details in Logs tab">{convo.id}</button>
                              <span className="ml-2 text-gray-500 dark:text-gray-400">(Status: {convo.status} | Last Bot Reply: &gt;&gt;{convo.lastBotReplyNum || 'N/A'} | Hist: {convo.history?.length || 0})</span>
                          </summary>
                          <div className="mt-2 space-y-1.5 pl-2 border-l-2 border-gray-300 dark:border-gray-500">
                            <p><strong>Trigger/Seed:</strong> <span className="font-semibold">&gt;&gt;{convo.triggerPostNum}</span> on <span className="font-semibold">/{convo.board}/{convo.threadId}</span> {convo.isBotSeedConversation ? "(Bot Seed)" : ""}</p>
                            <p><strong>Last Checked:</strong> {new Date(convo.lastCheckedTimestamp).toLocaleTimeString()}</p>
                            
                            {convo.initialContext && (
                              <details className="mt-1 text-xs">
                                <summary className="cursor-pointer text-gray-600 dark:text-gray-400 italic">Initial Context Details...</summary>
                                <div className="pl-3 pt-1 space-y-0.5">
                                  {convo.initialContext.opPostText && <p><strong>Initial Thread Context:</strong> "{convo.initialContext.opPostText.substring(0,200)}..."</p>}
                                  {convo.initialContext.opPostMediaParts && convo.initialContext.opPostMediaParts.length > 0 && <p><strong>OP Media:</strong> {convo.initialContext.opPostMediaParts.length} item(s) analyzed.</p>}
                                </div>
                              </details>
                            )}

                            {convo.history && convo.history.length > 0 && (
                                <details className="mt-1 text-xs">
                                    <summary className="cursor-pointer text-gray-600 dark:text-gray-400 italic">Last {Math.min(5, convo.history.length)} messages in history...</summary>
                                    <div className="pl-3 pt-1 space-y-0.5 max-h-32 overflow-y-auto custom-scrollbar">
                                        {convo.history.slice(-5).map((msg, idx) => (
                                            <p key={idx} className="truncate">
                                                <strong className="capitalize">{msg.role}:</strong> {(msg.parts[0]?.text || '[Non-text/Media]').substring(0, 100)}...
                                            </p>
                                        ))}
                                    </div>
                                </details>
                            )}
                          </div>
                      </details>
                    ) : null
                  ))
            )}
        </div>
        <button
            onClick={() => {
                setGeminiDvachConversations(new Map());
                addLog("Cleared all tracked Bot Conversation Contexts.", "bot_warning");
            }}
            className="mt-4 px-3 py-1.5 text-xs bg-red-500 hover:bg-red-600 text-white rounded-md font-medium flex items-center shadow disabled:opacity-50 transition-colors"
            disabled={geminiDvachConversations.size === 0}
        >
            <IconTrash className="mr-1.5 h-4 w-4"/> Clear All Tracked Conversation Contexts
        </button>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">Other bot settings (persona, reply mode, image analysis) can be configured in the main "Settings" tab.</p>
    </div>
  );

  const renderSettingsPanel = () => (
     <div className="space-y-6 p-4 md:p-6 bg-white dark:bg-gray-800 shadow-lg rounded-lg">
      <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-300 border-b pb-2 border-gray-300 dark:border-gray-700">Application Settings</h2>
      
      <details open className="p-3 border rounded-md border-gray-200 dark:border-gray-600">
        <summary className="text-lg font-medium text-gray-700 dark:text-gray-300 cursor-pointer select-none">Global Dvach Settings</summary>
        <div className="mt-3 space-y-3">
            <div>
              <label htmlFor="settingsBoard" className="block text-sm font-medium">Default Board (for Manual Ops):</label>
              <input id="settingsBoard" type="text" value={settings.board} onChange={e => handleUpdateSettings({board: e.target.value})} className="mt-1 w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"/>
            </div>
            <div>
              <label htmlFor="settingsThreadId" className="block text-sm font-medium">Default Thread ID (for Manual Ops, 0 for new):</label>
              <input id="settingsThreadId" type="text" value={settings.threadId} onChange={e => handleUpdateSettings({threadId: e.target.value})} className="mt-1 w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"/>
            </div>
            <div>
              <label htmlFor="settingsPasscode" className="block text-sm font-medium">Purchased Passcode (for Dvach Login):</label>
              <input id="settingsPasscode" type="password" value={settings.purchasedPasscode} onChange={e => handleUpdateSettings({purchasedPasscode: e.target.value})} autoComplete="new-password" placeholder="Enter your Dvach Passcode" className="mt-1 w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"/>
            </div>
            <div>
                <label htmlFor="settingsUserAgent" className="block text-sm font-medium">User Agent:</label>
                <input id="settingsUserAgent" type="text" value={settings.userAgent} onChange={e => handleUpdateSettings({userAgent: e.target.value})} className="mt-1 w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"/>
                <button onClick={() => handleUpdateSettings({userAgent: generateUserAgent()})} className="mt-1 text-xs px-2 py-1 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded">Generate New</button>
            </div>
        </div>
      </details>

      <details className="p-3 border rounded-md border-gray-200 dark:border-gray-600">
        <summary className="text-lg font-medium text-gray-700 dark:text-gray-300 cursor-pointer select-none">CORS Proxy Configuration (for Client-Side GET Requests)</summary>
        <div className="mt-3 space-y-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">These settings apply to client-side GET requests (e.g., fetching images for analysis, or thread data if not using serverless). POSTs to Dvach always use serverless functions.</p>
            <div>
              <label htmlFor="settingsProxyModeForGET" className="block text-sm font-medium">Proxy for Thread Data GETs (if not Serverless):</label>
              <select id="settingsProxyModeForGET" value={settings.proxyModeForGET} onChange={e => handleUpdateSettings({proxyModeForGET: e.target.value as ProxyModeForGET})} className="mt-1 w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600">
                <option value="vercel_serverless">Vercel Serverless Function (/api/get-thread) (Recommended)</option>
                <option value="custom_cors_anywhere">Custom CORS Anywhere Style (Prefix)</option>
                <option value="custom_go_x2u">Custom go.x2u.in Style (URL as param)</option>
                <option value="custom_codetabs">Custom CodeTabs Style (URL as param, no http)</option>
                <option value="custom_general_prefix">Custom General Prefix Proxy</option>
                <option value="custom_general_param">Custom General Parameter Proxy (e.g., ?url=)</option>
                <option value="none">No Proxy (May not work)</option>
              </select>
              {settings.proxyModeForGET !== 'vercel_serverless' && settings.proxyModeForGET !== 'none' && (
                <input type="text" placeholder="Custom Proxy URL for Thread Data" value={settings.customProxyUrlForGET} onChange={e => handleUpdateSettings({customProxyUrlForGET: e.target.value})} className="mt-1 w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"/>
              )}
            </div>
            <div>
              <label htmlFor="settingsProxyModeForImagesGET" className="block text-sm font-medium">Proxy for Image/Media GETs:</label>
               <select id="settingsProxyModeForImagesGET" value={settings.proxyModeForImagesGET} onChange={e => handleUpdateSettings({proxyModeForImagesGET: e.target.value as ProxyModeForGET})} className="mt-1 w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600">
                <option value="custom_codetabs">CodeTabs Style (Default for Images)</option>
                <option value="custom_cors_anywhere">CORS Anywhere Style (Prefix)</option>
                <option value="custom_go_x2u">go.x2u.in Style (URL as param)</option>
                <option value="custom_general_prefix">Custom General Prefix Proxy</option>
                <option value="custom_general_param">Custom General Parameter Proxy (e.g., ?url=)</option>
                <option value="none">No Proxy (May not work)</option>
              </select>
              {settings.proxyModeForImagesGET !== 'none' && (
                 <input type="text" placeholder="Custom Proxy URL for Images" value={settings.customProxyUrlForImagesGET} onChange={e => handleUpdateSettings({customProxyUrlForImagesGET: e.target.value})} className="mt-1 w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"/>
              )}
            </div>
        </div>
      </details>

      <details open className="p-3 border rounded-md border-gray-200 dark:border-gray-600">
        <summary className="text-lg font-medium text-gray-700 dark:text-gray-300 cursor-pointer select-none">Gemini API & Model Settings</summary>
        <div className="mt-3 space-y-3">
            <div>
                <label className="block text-sm font-medium">Gemini API Key Source:</label>
                <select aria-label="Gemini API Key Source" value={settings.geminiApiKeySource} onChange={e => handleUpdateSettings({geminiApiKeySource: e.target.value as 'env' | 'user'})} className="mt-1 w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600">
                  <option value="env">Use Environment API_KEY {processEnvApiKey ? `(Detected: ${processEnvApiKey.substring(0,4)}...${processEnvApiKey.substring(processEnvApiKey.length - 4)})` : "(Not Detected/Accessible)"}</option>
                  <option value="user">Enter API Key Manually</option>
                </select>
                {settings.geminiApiKeySource === 'user' && (
                  <input aria-label="User Gemini API Key" type="password" placeholder="Enter your Gemini API Key" value={settings.userGeminiApiKey} onChange={e => handleUpdateSettings({userGeminiApiKey: e.target.value})} autoComplete="new-password" className="mt-1 w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"/>
                )}
            </div>
             {/* Placeholder for Gemini Safety Settings UI */}
            <div className="p-2 border-t border-gray-200 dark:border-gray-600">
                <p className="text-sm text-gray-600 dark:text-gray-400">Gemini Safety Settings UI placeholder. Currently uses defaults: {DEFAULT_GEMINI_SAFETY_SETTINGS.map(s => `${s.category}:${s.threshold}`).join(', ')}.</p>
            </div>
            <label className="flex items-center">
              <input type="checkbox" checked={settings.geminiAnalyzeOpMedia} onChange={e => handleUpdateSettings({geminiAnalyzeOpMedia: e.target.checked})} className="mr-2 h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"/>
              Gemini: Analyze Media in OP Posts (Manual Reply)
            </label>
            <label className="flex items-center">
              <input type="checkbox" checked={settings.geminiAnalyzeAnonMedia} onChange={e => handleUpdateSettings({geminiAnalyzeAnonMedia: e.target.checked})} className="mr-2 h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"/>
              Gemini: Analyze Media in Anonymous Posts (Manual Reply)
            </label>
            <label className="flex items-center">
              <input type="checkbox" checked={settings.geminiReplyWithGeneratedImage} onChange={e => handleUpdateSettings({geminiReplyWithGeneratedImage: e.target.checked})} className="mr-2 h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"/>
              Gemini: Generate image with replies (Manual & Bot)
            </label>
             <div>
                <label htmlFor="maxImagesToAnalyzePerPost" className="block text-sm font-medium">Max Images to Analyze per Post (Manual & Bot):</label>
                <input id="maxImagesToAnalyzePerPost" type="number" min="0" max="5" value={settings.maxImagesToAnalyzePerPost} onChange={e => handleUpdateSettings({maxImagesToAnalyzePerPost: parseInt(e.target.value)})} className="mt-1 w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"/>
            </div>

            <h4 className="text-md font-medium pt-2 text-gray-700 dark:text-gray-300">Gemini Model Config (Manual Replies & Lab Chat)</h4>
            <div>
                <label htmlFor="geminiSystemInstructionManual" className="block text-sm font-medium">System Instruction (Manual Replies & Lab Chat):</label>
                <textarea id="geminiSystemInstructionManual" value={settings.geminiSystemInstruction} onChange={e => handleUpdateSettings({geminiSystemInstruction: e.target.value})} rows={2} className="mt-1 w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"/>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div><label htmlFor="geminiTemp" className="text-sm">Temperature:</label><input id="geminiTemp" type="number" step="0.05" min="0" max="1" value={settings.geminiTemperature} onChange={e => handleUpdateSettings({geminiTemperature: parseFloat(e.target.value)})} className="w-full p-1 border r"/></div>
                <div><label htmlFor="geminiTopP" className="text-sm">Top P:</label><input id="geminiTopP" type="number" step="0.05" min="0" max="1" value={settings.geminiTopP} onChange={e => handleUpdateSettings({geminiTopP: parseFloat(e.target.value)})} className="w-full p-1 border r"/></div>
                <div><label htmlFor="geminiTopK" className="text-sm">Top K:</label><input id="geminiTopK" type="number" step="1" min="1" value={settings.geminiTopK} onChange={e => handleUpdateSettings({geminiTopK: parseInt(e.target.value)})} className="w-full p-1 border r"/></div>
                <div><label htmlFor="geminiMaxOut" className="text-sm">Max Output Tokens:</label><input id="geminiMaxOut" type="number" step="64" min="64" value={settings.geminiMaxOutputTokens} onChange={e => handleUpdateSettings({geminiMaxOutputTokens: parseInt(e.target.value)})} className="w-full p-1 border r"/></div>
            </div>
            <div>
                <label htmlFor="geminiMime" className="block text-sm">Response MIME Type (Manual/Lab GenContent):</label>
                <select id="geminiMime" value={settings.geminiResponseMimeType} onChange={e => handleUpdateSettings({geminiResponseMimeType: e.target.value as 'text/plain' | 'application/json'})} className="w-full p-2 border r">
                    <option value="text/plain">text/plain</option>
                    <option value="application/json">application/json</option>
                </select>
            </div>
            <label className="flex items-center"><input type="checkbox" checked={settings.useSearchGrounding} onChange={e => handleUpdateSettings({useSearchGrounding: e.target.checked})} className="mr-2"/> Use Google Search Grounding (Manual/Lab)</label>
            <label className="flex items-center"><input type="checkbox" checked={settings.useThinkingBudget} onChange={e => handleUpdateSettings({useThinkingBudget: e.target.checked})} className="mr-2"/> Use Thinking Budget (Manual/Lab, 0=disable)</label>
            {settings.useThinkingBudget && <div><label htmlFor="geminiThinkBudget" className="text-sm">Thinking Budget (Manual/Lab, 0-1):</label><input id="geminiThinkBudget" type="number" step="1" min="0" value={settings.geminiThinkingBudget} onChange={e => handleUpdateSettings({geminiThinkingBudget: parseInt(e.target.value)})} className="w-full p-1 border r"/></div>}
        </div>
      </details>

       <details open className="p-3 border rounded-md border-gray-200 dark:border-gray-600">
        <summary className="text-lg font-medium text-gray-700 dark:text-gray-300 cursor-pointer select-none">Autonomous Bot Settings</summary>
        <div className="mt-3 space-y-3">
            <div>
                <label htmlFor="botSystemPrompt" className="block text-sm font-medium">Bot System Prompt (Persona & Style):</label>
                <textarea id="botSystemPrompt" value={settings.autonomousBotSystemPrompt} onChange={e => handleUpdateSettings({autonomousBotSystemPrompt: e.target.value})} rows={3} className="mt-1 w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"/>
            </div>
            <label className="flex items-center">
              <input type="checkbox" checked={settings.botAnalyzesImagesInTriggerPosts} onChange={e => handleUpdateSettings({botAnalyzesImagesInTriggerPosts: e.target.checked})} className="mr-2 h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"/>
              Bot: Analyze Images in Trigger Posts
            </label>
            <div>
                <label htmlFor="botReplyMode" className="block text-sm">Bot Reply Mode:</label>
                <select id="botReplyMode" value={settings.autonomousBotReplyMode} onChange={e => handleUpdateSettings({autonomousBotReplyMode: e.target.value as AutonomousBotReplyMode})} className="w-full p-2 border r">
                    <option value="random_in_thread">Random Post in Thread</option>
                    <option value="replies_to_bot">Replies to Bot's Own Posts (WIP)</option>
                </select>
            </div>
             <div>
                <label htmlFor="botInterval" className="block text-sm font-medium">Bot Cycle Interval (seconds):</label>
                <input id="botInterval" type="number" min="10" value={settings.autonomousBotCycleIntervalSeconds} onChange={e => handleUpdateSettings({autonomousBotCycleIntervalSeconds: parseInt(e.target.value)})} className="mt-1 w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"/>
            </div>
             <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label htmlFor="botMinReplyDelay" className="block text-sm font-medium">Min Reply Delay (ms):</label>
                    <input id="botMinReplyDelay" type="number" min="0" step="500" value={settings.autonomousBotMinReplyDelayMs} onChange={e => handleUpdateSettings({autonomousBotMinReplyDelayMs: parseInt(e.target.value)})} className="mt-1 w-full p-2 border r"/>
                 </div>
                 <div>
                    <label htmlFor="botMaxReplyDelay" className="block text-sm font-medium">Max Reply Delay (ms):</label>
                    <input id="botMaxReplyDelay" type="number" min="0" step="500" value={settings.autonomousBotMaxReplyDelayMs} onChange={e => handleUpdateSettings({autonomousBotMaxReplyDelayMs: parseInt(e.target.value)})} className="mt-1 w-full p-2 border r"/>
                 </div>
             </div>
             <label className="flex items-center">
              <input type="checkbox" checked={settings.autonomousBotDisableThinking} onChange={e => handleUpdateSettings({autonomousBotDisableThinking: e.target.checked})} className="mr-2 h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"/>
              Bot: Disable Thinking Process (for speed, lower quality)
            </label>
            <label className="flex items-center">
              <input type="checkbox" checked={settings.autonomousBotAllowReplyToSelf} onChange={e => handleUpdateSettings({autonomousBotAllowReplyToSelf: e.target.checked})} className="mr-2 h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"/>
              Bot: Allow Reply to Own Posts (if eligible)
            </label>
             <div>
                <label htmlFor="botInitialContextScope" className="block text-sm">Bot: Initial Thread Context Scope:</label>
                <select id="botInitialContextScope" value={settings.autonomousBotInitialContextScope} onChange={e => handleUpdateSettings({autonomousBotInitialContextScope: e.target.value as AutonomousBotInitialContextScope})} className="w-full p-2 border r">
                    <option value="op_only">OP Post Only</option>
                    <option value="full_thread">Full Thread Summary</option>
                </select>
            </div>
            {settings.autonomousBotInitialContextScope === 'full_thread' && (
                <div>
                    <label htmlFor="botFullContextChars" className="block text-sm font-medium">Bot: Full Thread Context Max Chars (0 for unlimited):</label>
                    <input id="botFullContextChars" type="number" min="0" step="1000" value={settings.autonomousBotFullThreadContextMaxChars} onChange={e => handleUpdateSettings({autonomousBotFullThreadContextMaxChars: parseInt(e.target.value)})} className="mt-1 w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"/>
                </div>
            )}
        </div>
      </details>
      <p className="text-xs text-gray-500 dark:text-gray-400">Settings are saved automatically to local storage.</p>
    </div>
  );

  const renderLogsPanel = () => (
    <div className="space-y-6 p-4 md:p-6 bg-white dark:bg-gray-800 shadow-lg rounded-lg">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-300 border-b pb-2 border-gray-300 dark:border-gray-700 flex-grow">Event Logs</h2>
        <button 
            onClick={() => setLogs([])}
            className="px-3 py-1 text-xs bg-red-500 hover:bg-red-600 text-white rounded-md font-medium flex items-center shadow disabled:opacity-50 transition-colors"
            title="Clear all logs"
            disabled={logs.length === 0}
        >
            <IconTrash className="mr-1 h-4 w-4"/> Clear Logs
        </button>
      </div>
      <div className="max-h-[600px] overflow-y-auto bg-gray-50 dark:bg-gray-900 p-3 rounded custom-scrollbar border border-gray-200 dark:border-gray-700">
        {logs.length === 0 && <p className="text-center text-gray-500 dark:text-gray-400">No logs yet.</p>}
        {logs.map(log => {
          const dataDisplay: string | null = (log.data !== undefined && log.data !== null) 
            ? formatLogDataForDisplay(log.data) 
            : null;
          return (
            <div key={log.id} className={`text-xs p-1.5 mb-1 rounded border-l-4 ${
              log.type === 'error' || log.type === 'bot_error' ? 'bg-red-50 dark:bg-red-900/50 border-red-500 text-red-700 dark:text-red-200' : 
              log.type === 'success' ? 'bg-green-50 dark:bg-green-900/50 border-green-500 text-green-700 dark:text-green-200' :
              log.type === 'warning' || log.type === 'bot_warning' ? 'bg-yellow-50 dark:bg-yellow-900/50 border-yellow-500 text-yellow-700 dark:text-yellow-200' :
              log.type === 'gemini' ? 'bg-purple-50 dark:bg-purple-900/50 border-purple-500 text-purple-700 dark:text-purple-200' :
              log.type === 'dvach' ? 'bg-blue-50 dark:bg-blue-900/50 border-blue-500 text-blue-700 dark:text-blue-200' :
              log.type === 'auth' ? 'bg-cyan-50 dark:bg-cyan-900/50 border-cyan-500 text-cyan-700 dark:text-cyan-200' :
              log.type === 'bot_activity' || log.type === 'bot_setup' ? 'bg-indigo-50 dark:bg-indigo-900/50 border-indigo-500 text-indigo-700 dark:text-indigo-200' :
              'bg-gray-100 dark:bg-gray-700/50 border-gray-500 text-gray-700 dark:text-gray-300' 
            }`}>
              <span className="font-medium">[{new Date(log.timestamp).toLocaleTimeString()}] [{log.type.toUpperCase()}]</span>: {log.message}
              {dataDisplay && (
                <pre className="mt-1 text-xs whitespace-pre-wrap bg-gray-200 dark:bg-gray-600 p-1 rounded overflow-x-auto">
                  {dataDisplay}
                </pre>
              )}
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
          <h1 className="text-2xl font-bold text-blue-600 dark:text-blue-400">Dvach Gemini Bot</h1>
          <div className="flex items-center space-x-4">
            {settings.userAgent && <span className="text-xs text-gray-500 dark:text-gray-400 hidden md:block truncate max-w-xs" title={settings.userAgent}>UA: {settings.userAgent.substring(0,40)}...</span>}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              aria-label={`Toggle theme (current: ${settings.theme})`}
              title={`Change theme. Current: ${settings.theme}. Click to cycle.`}
            >
              <ThemeIconComponent className="h-6 w-6" />
            </button>
          </div>
        </div>
      </header>

      <nav className="bg-gray-50 dark:bg-gray-800 border-b border-t border-gray-200 dark:border-gray-700 sticky top-[72px] z-40"> {/* Adjusted top value if header height changes */}
        <div className="container mx-auto flex justify-center sm:justify-start flex-wrap">
          {[
            { id: 'dvach', label: 'Manual Ops', icon: IconCpu },
            { id: 'gemini', label: 'Gemini Lab', icon: IconSparkles },
            { id: 'bot_control', label: 'Autonomous Bot', icon: IconMessageChat },
            { id: 'settings', label: 'Settings', icon: IconSettings },
            { id: 'logs', label: 'Logs', icon: IconTerminal },
          ].map((tabLink) => (
            <button
              key={tabLink.id}
              onClick={() => setActiveTab(tabLink.id as 'dvach' |'gemini'| 'bot_control' | 'settings' | 'logs')}
              aria-current={activeTab === tabLink.id ? "page" : undefined}
              className={`flex items-center px-2 sm:px-3 py-3 text-sm font-medium border-b-2 transition-all duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-400
                ${activeTab === tabLink.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
            >
              <tabLink.icon aria-hidden="true" className="h-5 w-5 mr-1 sm:mr-1.5 flex-shrink-0" />
              <span className="truncate">{tabLink.label}</span>
            </button>
          ))}
        </div>
      </nav>

      <main className="container mx-auto p-4 md:p-6" role="main">
        <div className="mt-2"> 
            {activeTab === 'dvach' && renderDvachBotPanel()}
            {activeTab === 'gemini' && renderGeminiPanel()}
            {activeTab === 'bot_control' && renderAutonomousBotControlPanel()}
            {activeTab === 'settings' && renderSettingsPanel()}
            {activeTab === 'logs' && renderLogsPanel()}
        </div>
      </main>

      <footer className="text-center py-4 border-t border-gray-200 dark:border-gray-700 mt-8">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Dvach Gemini Bot Interface - Version ${APP_VERSION} - Use responsibly.
        </p>
      </footer>
    </div>
  );
};

export default App;
