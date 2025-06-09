/// <reference types="vite/client" />
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { GoogleGenAI, Part, Chat as GeminiChatInstanceType, Content, GenerateContentParameters, GenerateImagesResponse } from "@google/genai";
import {
  AppSettings, LogEntry, DvachPost, SentMessageInfo, ChatMessage, ProxyModeForGET,
  GeneratedImage, GroundingChunk, DvachThreadResponse, 
  GeminiThreadAnalysis, CustomGenerateContentResponse, DvachFile, GeminiDvachConversation,
  DvachSessionCookies
} from './types'; 
import { getThreadData, loginToDvach, postWithSessionCookie, base64ToFile, extractDvachApiError } from './services/dvachService';
import { 
  APP_SETTINGS_KEY, SENT_MESSAGES_KEY, APP_VERSION,
  GEMINI_TEXT_MODEL, GEMINI_IMAGE_MODEL, MAX_LOG_ENTRIES, MAX_SENT_MESSAGES_STORED,
  GEMINI_CHAT_HISTORY_KEY, GEMINI_DVACH_CONVERSATIONS_KEY, DVACH_SESSION_COOKIES_KEY,
  PROXY_URL_GO_X2U_BASE, DEFAULT_CORS_ANYWHERE_PROXY, DVACH_DOMAINS, DEFAULT_USER_AGENT
} from './constants';
import { generateUserAgent } from './utils/userAgentGenerator'; // Corrected import path

import {
  IconSettings, IconTerminal, IconSend, IconTrash, IconSun, IconMoon, IconCpu, 
  IconSparkles, IconAlertTriangle, IconRefresh, IconPhoto, IconBrain, IconCopy, IconWand,
  IconLogin, IconLogout, IconUserCircle // Added login/logout icons
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
  geminiReplyWithGeneratedImage: false,
  autoMonitorDvachThreadForGemini: false,

  geminiSystemInstruction: "You are a witty and insightful anonymous user on the 2ch.hk imageboard. Your replies should be relevant, concise, and in the typical style of the board. If quoting, use '>>POST_NUMBER\\n'.",
  geminiTemperature: 0.75,
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

function buildProxiedGetUrlForApp(
  targetUrl: string,
  proxyMode: ProxyModeForGET,
  customProxyUrl?: string
): string {
  switch (proxyMode) {
    case 'vercel_serverless':
      console.warn("[App.tsx/buildProxiedUrl] 'vercel_serverless' selected for GET, but attempting to build external URL. This may not work as expected for images without a dedicated image proxy function. Falling back to custom/none for this URL.");
      if (customProxyUrl) { 
        if (customProxyUrl.includes('go.x2u.in')) return `${customProxyUrl}${encodeURIComponent(targetUrl)}`;
        if (customProxyUrl.includes('cors-anywhere')) return customProxyUrl.endsWith('/') ? `${customProxyUrl}${targetUrl}` : `${customProxyUrl}/${targetUrl}`;
        return customProxyUrl.endsWith('=') ? `${customProxyUrl}${encodeURIComponent(targetUrl)}` : (customProxyUrl.endsWith('/') ? `${customProxyUrl}${targetUrl}` : `${customProxyUrl}/${targetUrl}`);
      }
      return targetUrl; 
    case 'custom_go_x2u':
      return `${customProxyUrl || PROXY_URL_GO_X2U_BASE}${encodeURIComponent(targetUrl)}`;
    case 'custom_cors_anywhere':
      const corsBase = (customProxyUrl || DEFAULT_CORS_ANYWHERE_PROXY).endsWith('/') ? (customProxyUrl || DEFAULT_CORS_ANYWHERE_PROXY) : `${(customProxyUrl || DEFAULT_CORS_ANYWHERE_PROXY)}/`;
      return `${corsBase}${targetUrl}`;
    case 'custom_general_prefix':
      if (!customProxyUrl) return targetUrl;
      return customProxyUrl.endsWith('/') ? `${customProxyUrl}${targetUrl}` : `${customProxyUrl}/${targetUrl}`;
    case 'custom_general_param':
      if (!customProxyUrl) return targetUrl;
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
    const replacer = (_key: string, value: any) =>
      typeof value === 'bigint' ? value.toString() : value;
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
      return `Object with keys: ${Object.keys(data).join(', ')}`;
    }
    return String(data);
  }
};

const App: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(() => {
    const savedSettings = localStorage.getItem(APP_SETTINGS_KEY);
    const initialSettings = savedSettings ? JSON.parse(savedSettings) : {};
    const mergedSettings = { 
        ...DEFAULT_APP_SETTINGS, 
        ...initialSettings,
        proxyModeForGET: initialSettings.proxyModeForGET || DEFAULT_APP_SETTINGS.proxyModeForGET,
        customProxyUrlForGET: initialSettings.customProxyUrlForGET || DEFAULT_APP_SETTINGS.customProxyUrlForGET,
        autoMonitorDvachThreadForGemini: initialSettings.autoMonitorDvachThreadForGemini || DEFAULT_APP_SETTINGS.autoMonitorDvachThreadForGemini,
        userAgent: initialSettings.userAgent || generateUserAgent(), // Ensure userAgent is initialized
    };
    if (!mergedSettings.purchasedPasscode) { 
        mergedSettings.purchasedPasscode = DEFAULT_APP_SETTINGS.purchasedPasscode;
    }
    if (processEnvApiKey && mergedSettings.geminiApiKeySource === 'env' && !initialSettings.userGeminiApiKey) {
      // Preserve empty user key if env is source
    } else if (!processEnvApiKey && mergedSettings.geminiApiKeySource === 'env') {
      mergedSettings.geminiApiKeySource = 'user'; 
    }
    return mergedSettings;
  });

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [ai, setAi] = useState<GoogleGenAI | null>(null);
  const [activeTab, setActiveTab] = useState<'dvach' | 'gemini' | 'settings' | 'logs'>('dvach');
  
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

  // Gemini states
  const [geminiLoading, setGeminiLoading] = useState<boolean>(false); 
  const [textGenPrompt, setTextGenPrompt] = useState<string>('');
  const [geminiOutputText, setGeminiOutputText] = useState<string>(''); 
  const [groundingSources, setGroundingSources] = useState<GroundingChunk[]>([]);
  const [imageGenPrompt, setImageGenPrompt] = useState<string>('');
  const [numImagesToGenerate, setNumImagesToGenerate] = useState<number>(1);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]); 
  const [isGeneratingImage, setIsGeneratingImage] = useState<boolean>(false);
  const [geminiChatInput, setGeminiChatInput] = useState<string>('');
  const [geminiChatMessages, setGeminiChatMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem(GEMINI_CHAT_HISTORY_KEY);
    return saved ? JSON.parse(saved) : [];
  });
  const [currentGeminiChat, setCurrentGeminiChat] = useState<GeminiChatInstanceType | null>(null);
  const [isStreamingChat, setIsStreamingChat] = useState<boolean>(false);
  const [imageForGeminiChat, setImageForGeminiChat] = useState<File | null>(null);
  const chatMessagesEndRef = useRef<HTMLDivElement>(null);
  const [isAnalyzingThread, setIsAnalyzingThread] = useState<boolean>(false);
  
  const [geminiDvachConversations, setGeminiDvachConversations] = useState<Map<string, GeminiDvachConversation>>(() => {
    const saved = localStorage.getItem(GEMINI_DVACH_CONVERSATIONS_KEY);
    return saved ? new Map(JSON.parse(saved)) : new Map();
  });


  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info', data?: unknown) => {
    setLogs(prevLogs => [{ id: Date.now().toString(), timestamp: Date.now(), message, type, data }, ...prevLogs.slice(0, MAX_LOG_ENTRIES - 1)]);
    const consoleMethod = type === 'error' ? console.error : type === 'warning' ? console.warn : console.log;
    consoleMethod(`[${type.toUpperCase()}] ${message}`, data !== undefined ? data : "");
  }, []);

  const addPostActivity = useCallback((message: string) => {
    setPostActivityLog(prev => [ `[${new Date().toLocaleTimeString()}] ${message}`, ...prev.slice(0, 9)]);
  }, []);


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
    localStorage.setItem(GEMINI_CHAT_HISTORY_KEY, JSON.stringify(geminiChatMessages));
    chatMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [geminiChatMessages]);
  
  useEffect(() => {
    localStorage.setItem(GEMINI_DVACH_CONVERSATIONS_KEY, JSON.stringify(Array.from(geminiDvachConversations.entries())));
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
        if (!ai || (ai && (settings.geminiApiKeySource === 'env' ? processEnvApiKey : settings.userGeminiApiKey) !== (genAI as any).apiKey )) { 
             addLog('Gemini API initialized successfully.', 'success');
        }
      } catch (error) {
        addLog(`Failed to initialize Gemini API: ${(error as Error).message}. Check API Key format/validity.`, 'error', error);
        setAi(null);
      }
    } else {
      setAi(null);
      if (activeTab === 'gemini' || settings.geminiReplyWithGeneratedImage || activeTab === 'dvach' || settings.autoMonitorDvachThreadForGemini ) { 
        if (settings.geminiApiKeySource === 'user' && !settings.userGeminiApiKey) addLog('Gemini API key (Manual) is not set.', 'warning');
        else if (settings.geminiApiKeySource === 'env' && !processEnvApiKey) addLog('Gemini API key (VITE_GEMINI_API_KEY) not detected or accessible.', 'warning');
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.geminiApiKeySource, settings.userGeminiApiKey, processEnvApiKey]); 

  const handleUpdateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };
  
  useEffect(() => {
    setCurrentBoard(settings.board);
    setCurrentThreadId(settings.threadId);
  }, [settings.board, settings.threadId]);


  const handleLoadThread = async () => {
    if (!currentBoard || !currentThreadId) {
      setFetchError('Board and Thread ID are required.');
      addLog('Board and Thread ID must be set to fetch thread posts.', 'warning');
      setCurrentFetchedDvachPosts([]);
      return;
    }
    setIsFetchingThread(true);
    setFetchError(null);
    setCurrentFetchedDvachPosts([]);
    try {
      addLog(`Fetching thread /${currentBoard}/${currentThreadId}... Proxy for GET: ${settings.proxyModeForGET}`, 'dvach');
      const data: DvachThreadResponse = await getThreadData(currentBoard, currentThreadId, settings.proxyModeForGET, settings.customProxyUrlForGET, settings.userAgent);
      
      const posts = data.threads?.[0]?.posts || [];
      setCurrentFetchedDvachPosts(posts);
      addLog(`Successfully fetched ${posts.length} posts from /${currentBoard}/${currentThreadId}.`, 'success');
      if (threadPostsContainerRef.current) threadPostsContainerRef.current.scrollTop = 0;
      handleUpdateSettings({ board: currentBoard, threadId: currentThreadId });

    } catch (err) {
      const errorMsg = (err as Error).message;
      setFetchError(errorMsg);
      addLog(`Failed to fetch thread /${currentBoard}/${currentThreadId}: ${errorMsg}`, 'error', err);
      setCurrentFetchedDvachPosts([]);
    } finally {
      setIsFetchingThread(false);
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
      setDvachSessionCookies(null); // Clear any old cookies on failure
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
    useSage: boolean,
    boardToPost: string,
    threadIdContext: string, 
    replyToPostNum?: string  
  ): Promise<string> => { 
    if (!dvachSessionCookies?.passcode_auth) {
      const errorMsg = 'Not logged into Dvach or session expired. Please login first.';
      addLog(errorMsg, 'error');
      addPostActivity(`Error: ${errorMsg}`);
      setFetchError(errorMsg); // Show error to user
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
    const effectiveThreadIdForDvach = threadIdContext === "0" || threadIdContext === "" ? "0" : threadIdContext;
    const targetDesc = effectiveThreadIdForDvach === "0" ? 'new thread' : `thread ${effectiveThreadIdForDvach}`;
    const logMsg = `Attempting to post to /${boardToPost}/${targetDesc}${replyToPostNum ? ` (reply to >>${replyToPostNum})` : ''}. Comment: "${comment.substring(0,50)}..."`;
    addLog(logMsg, 'dvach');
    addPostActivity(logMsg);

    try {
      const result = await postWithSessionCookie(
        dvachSessionCookies,
        boardToPost,
        effectiveThreadIdForDvach, 
        comment,
        file,
        replyToPostNum, 
        useSage,
        settings.userAgent
      );
      
      const newPostNum = String(result.num || result.thread || result.target || Date.now()); 
      addLog(`Post successful! Dvach response: Num: ${newPostNum}`, 'success', result);
      addPostActivity(`Success! Post Num: ${newPostNum}.`);
      
      const newSentMessage: SentMessageInfo = {
        num: newPostNum,
        timestamp: Date.now(),
        comment: comment,
        board: boardToPost,
        thread: effectiveThreadIdForDvach === "0" ? newPostNum : effectiveThreadIdForDvach, 
        parent: replyToPostNum || (effectiveThreadIdForDvach === "0" ? undefined : effectiveThreadIdForDvach), 
        file_info: file ? { name: file.name, size: file.size } : undefined,
      };
      setSentMessages(prev => [newSentMessage, ...prev]);
      return newPostNum;
    } catch (err) {
      const error = err as Error;
      const dvachApiError = extractDvachApiError(error);
      let errorMsg = error.message;

      if (dvachApiError && (dvachApiError.code === -4 || dvachApiError.code === -6 || dvachApiError.code === -21 || dvachApiError.message.toLowerCase().includes("постинг запрещён") || dvachApiError.message.toLowerCase().includes("доступ запрещен"))) {
        // Specific auth-related errors from Dvach
        errorMsg = `Dvach session likely expired or invalid (Error: ${dvachApiError.message}). Please log in again.`;
        addLog(errorMsg, 'auth', dvachApiError);
        setDvachSessionCookies(null); // Clear invalid session
      } else {
        addLog(`Failed to post: ${errorMsg}`, 'error', err);
      }
      setFetchError(errorMsg); 
      addPostActivity(`Post Failed: ${errorMsg}`);
      throw new Error(errorMsg); 
    } finally {
      setIsPosting(false);
    }
  };

  const handleSimplePost = async () => {
    try {
      await commonPostToDvach(postText, postFile, postUseSage, currentBoard, currentThreadId);
      setPostText('');
      setPostFile(null);
    } catch (e) { /* error already logged by commonPostToDvach */ }
  };

  const handleGeminiReplyToDvachPost = async (targetPost: DvachPost) => {
    if (!ai) { addLog('Gemini AI not initialized.', 'error'); return; }
    if (!dvachSessionCookies?.passcode_auth) { 
        addLog('Not logged into Dvach. Please login before replying with Gemini.', 'error'); 
        setFetchError('Not logged into Dvach. Please login before replying with Gemini.');
        return; 
    }
    if (!currentBoard || !currentThreadId) { addLog('Current board or thread ID not set.', 'error'); return; }

    setGeminiLoading(true);
    addLog(`Gemini preparing reply to post >>${targetPost.num} on /${currentBoard}/${currentThreadId}...`, 'gemini');
    
    let systemInstructionForReply = settings.geminiSystemInstruction || DEFAULT_APP_SETTINGS.geminiSystemInstruction;
    systemInstructionForReply += ` You are replying to post number ${targetPost.num}. Your reply MUST start with ">>${targetPost.num}\\n".`;
    
    let userPromptText = `Post >>${targetPost.num} (by ${targetPost.name || 'Anonymous'}) says:\n"${targetPost.comment.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>?/gm, '').substring(0, 1000)}"`;
    
    const geminiMessageParts: Part[] = [];
    let dvachImageToAnalyze: DvachFile | null = null;

    if (targetPost.files && targetPost.files.length > 0) {
        if ((settings.geminiAnalyzeOpMedia && targetPost.op === 1) || (settings.geminiAnalyzeAnonMedia && targetPost.op !== 1)) {
            dvachImageToAnalyze = targetPost.files[0]; 
        }
    }

    if (dvachImageToAnalyze) {
        userPromptText += `\n\nThe post >>${targetPost.num} includes media file "${dvachImageToAnalyze.name}". Consider this image in your reply.`;
        try {
            const imageUrl = DVACH_DOMAINS[0] + dvachImageToAnalyze.path; 
            const proxiedImageUrl = buildProxiedGetUrlForApp(imageUrl, settings.proxyModeForGET, settings.customProxyUrlForGET);
            addLog(`Fetching image ${dvachImageToAnalyze.name} for Gemini analysis from ${proxiedImageUrl} (target: ${imageUrl})`, 'gemini');

            const imageResponse = await fetch(proxiedImageUrl);
            if (!imageResponse.ok) throw new Error(`Failed to fetch image: ${imageResponse.status} ${imageResponse.statusText}`);
            const imageBlob = await imageResponse.blob();
            
            let mimeType = dvachImageToAnalyze.path.endsWith('.png') ? 'image/png' : 
                           dvachImageToAnalyze.path.endsWith('.gif') ? 'image/gif' : 
                           dvachImageToAnalyze.path.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
            if (dvachImageToAnalyze.type === 1) mimeType = 'image/jpeg';
            else if (dvachImageToAnalyze.type === 2) mimeType = 'image/png';
            else if (dvachImageToAnalyze.type === 4) mimeType = 'image/gif';

            const base64data = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
                reader.onerror = reject;
                reader.readAsDataURL(imageBlob);
            });
            geminiMessageParts.push({ inlineData: { mimeType: mimeType, data: base64data } });
            addLog(`Image "${dvachImageToAnalyze.name}" successfully prepared for Gemini.`, 'gemini');
        } catch (imgError) {
            addLog(`Failed to fetch or process image "${dvachImageToAnalyze.name}" for Gemini: ${(imgError as Error).message}. Proceeding with text only.`, 'warning', imgError);
            userPromptText += ` (Image analysis failed, rely on text).`;
        }
    }
    geminiMessageParts.push({ text: userPromptText + `\n\nGenerate your reply.` });
    
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
      addLog(`Gemini generated text reply for >>${targetPost.num}: ${geminiReplyText.substring(0, 100)}...`, 'gemini');

      let finalFileToPost: File | null = null;
      if (settings.geminiReplyWithGeneratedImage) {
        addLog(`Gemini generating image for reply to >>${targetPost.num}...`, 'gemini');
        const imagePpt = `Imageboard reply context: "${geminiReplyText.substring(geminiReplyText.indexOf('\n') + 1, 200).trim()}". Style: interesting, meme-like, or abstract.`;
        const imgGenResp = await ai.models.generateImages({ model: GEMINI_IMAGE_MODEL, prompt: imagePpt, config: { numberOfImages: 1, outputMimeType: 'image/jpeg' } });
        if (imgGenResp.generatedImages?.[0]?.image?.imageBytes) {
          finalFileToPost = await base64ToFile(imgGenResp.generatedImages[0].image.imageBytes, `gemini_img_${Date.now()}.jpg`, imgGenResp.generatedImages[0].image.mimeType || 'image/jpeg');
          addLog(`Gemini generated image for reply to >>${targetPost.num}.`, 'gemini');
        } else { addLog(`Gemini image generation failed or no image returned for reply to >>${targetPost.num}.`, 'warning'); }
      }
      const newPostNumByGemini = await commonPostToDvach(geminiReplyText, finalFileToPost, postUseSage, currentBoard, currentThreadId, targetPost.num);
      
      setSentMessages(prev => prev.map(msg => 
        msg.num === newPostNumByGemini ? { ...msg, isGeminiPost: true, geminiTriggerPostNum: targetPost.num, geminiGeneratedImage: !!finalFileToPost } : msg 
      ));
      addLog(`Gemini reply posted as >>${newPostNumByGemini} to /${currentBoard}/${currentThreadId}.`, 'success');

      if (settings.autoMonitorDvachThreadForGemini && ai) {
        const convoId = targetPost.num; 
        const initialUserContent: Content = { role: 'user', parts: [{text: `Original post content by ${targetPost.name || 'Anon'} (>>${targetPost.num}):\n${targetPost.comment}`}]};
        if (dvachImageToAnalyze && geminiMessageParts.find(p => p.inlineData)) { 
            const imgPart = geminiMessageParts.find(p => p.inlineData);
            if(imgPart && initialUserContent.parts) initialUserContent.parts.push(imgPart);
        }
        const initialModelContent: Content = { role: 'model', parts: [{text: geminiReplyText}]};

        const newChatHistory: ChatMessage[] = [
            { id: `convo-${convoId}-user-orig`, role: 'user', parts: initialUserContent.parts!, timestamp: targetPost.timestamp * 1000 },
            { id: `convo-${convoId}-model-initial`, role: 'model', parts: initialModelContent.parts!, timestamp: Date.now() }
        ];
        
        const geminiChat = ai.chats.create({
            model: GEMINI_TEXT_MODEL,
            history: [ ...newChatHistory.map(h => ({role: h.role as 'user' | 'model', parts: h.parts! } as Content))], 
            config: { systemInstruction: systemInstructionForReply, temperature: settings.geminiTemperature, topK: settings.geminiTopK, topP: settings.geminiTopP, maxOutputTokens: settings.geminiMaxOutputTokens }
        });

        const newConversation: GeminiDvachConversation = {
            dvachRootPostByGeminiNum: newPostNumByGemini,
            board: currentBoard,
            threadId: currentThreadId,
            geminiChatInstance: geminiChat,
            history: newChatHistory,
            lastCheckedTimestamp: Date.now(),
            participatingPostNumbers: [targetPost.num, newPostNumByGemini]
        };
        setGeminiDvachConversations(prev => new Map(prev).set(convoId, newConversation));
        addLog(`GeminiDvachConversation initiated for >>${targetPost.num}, Gemini's reply >>${newPostNumByGemini}.`, 'gemini');
      }

    } catch (error) {
      // Error logging handled by commonPostToDvach for post failures
      if (! (error as Error).message.toLowerCase().includes("post failed")) { // Avoid double logging
         addLog(`Error during Gemini reply generation or processing for >>${targetPost.num}: ${(error as Error).message}`, 'error', error);
      }
    } finally {
      setGeminiLoading(false);
    }
  };

  useEffect(() => {
    let intervalId: NodeJS.Timeout | undefined;
    if (settings.autoMonitorDvachThreadForGemini && ai && currentBoard && currentThreadId && geminiDvachConversations.size > 0 && dvachSessionCookies?.passcode_auth) {
      addLog(`Auto-monitoring Gemini conversations started for /${currentBoard}/${currentThreadId}. Interval: 30s.`, 'gemini');
      
      const monitorLogic = async () => {
        if (!dvachSessionCookies?.passcode_auth) {
          addLog("Auto-monitor: Dvach session lost, stopping.", 'auth');
          if (intervalId) clearInterval(intervalId); // Clear interval here
          return;
        }
        addLog(`Auto-monitor: Checking for replies to Gemini posts in /${currentBoard}/${currentThreadId}.`, 'gemini');
        try {
          const threadData = await getThreadData(currentBoard, currentThreadId, settings.proxyModeForGET, settings.customProxyUrlForGET, settings.userAgent);
          const latestPosts = threadData.threads?.[0]?.posts || [];
          if (latestPosts.length === 0) return;

          const updatedConversations = new Map(geminiDvachConversations);
          let newPostsMadeByBot = false;

          for (const [convoId, convo] of updatedConversations.entries()) {
            if (convo.board !== currentBoard || convo.threadId !== currentThreadId) continue;

            const lastGeminiPostNumInConvo = convo.participatingPostNumbers.filter(num => 
                sentMessages.find(sm => sm.num === num && sm.isGeminiPost && sm.board === currentBoard && sm.thread === currentThreadId)
            ).pop();

            if (!lastGeminiPostNumInConvo) continue;

            for (const newPost of latestPosts) {
              if (newPost.timestamp * 1000 <= convo.lastCheckedTimestamp) continue; 
              if (sentMessages.some(sm => sm.num === newPost.num && sm.board === currentBoard && sm.thread === currentThreadId)) continue; 

              const repliedToBotPostRegex = new RegExp(`&gt;&gt;(${lastGeminiPostNumInConvo})`);
              if (newPost.comment.match(repliedToBotPostRegex) && !convo.participatingPostNumbers.includes(newPost.num)) {
                addLog(`Auto-monitor: New reply >>${newPost.num} found for Gemini's post >>${lastGeminiPostNumInConvo} in conversation ${convoId}.`, 'gemini');
                
                const userReplyContent: Content = { role: 'user', parts: [{ text: newPost.comment.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>?/gm, '') }]};
                
                convo.history.push({ id: `convo-${convoId}-user-${newPost.num}`, role: 'user', parts: userReplyContent.parts!, timestamp: newPost.timestamp*1000});
                
                if (!convo.geminiChatInstance) {
                    addLog(`Error: Chat instance missing for convo ${convoId}. Recreating.`, 'warning');
                    convo.geminiChatInstance = ai.chats.create({ model: GEMINI_TEXT_MODEL, history: [ ...convo.history.map(h => ({role: h.role as 'user' | 'model', parts: h.parts! } as Content))] });
                }

                const geminiResponse = await convo.geminiChatInstance.sendMessageStream({message: userReplyContent.parts!});
                let geminiFollowUpText = "";
                for await (const chunk of geminiResponse) {
                    geminiFollowUpText += chunk.text || "";
                }


                if (!geminiFollowUpText.trim().startsWith(`>>${newPost.num}`)) {
                    geminiFollowUpText = `>>${newPost.num}\n${geminiFollowUpText.trim()}`;
                }
                addLog(`Auto-monitor: Gemini generated follow-up for >>${newPost.num}: ${geminiFollowUpText.substring(0,100)}...`, 'gemini');

                const newBotPostNum = await commonPostToDvach(geminiFollowUpText, null, false, currentBoard, currentThreadId, newPost.num);
                newPostsMadeByBot = true;
                
                convo.history.push({ id: `convo-${convoId}-model-${newBotPostNum}`, role: 'model', parts: [{text: geminiFollowUpText}], timestamp: Date.now() });
                convo.participatingPostNumbers.push(newPost.num, newBotPostNum);
                convo.lastCheckedTimestamp = Date.now(); 
                updatedConversations.set(convoId, convo);

                 setSentMessages(prev => [{
                    num: newBotPostNum, timestamp: Date.now(), comment: geminiFollowUpText,
                    board: currentBoard, thread: currentThreadId, parent: newPost.num,
                    isGeminiPost: true, geminiTriggerPostNum: convoId,
                    geminiConversationId: convoId,
                }, ...prev]);
                break; 
              }
            }
          }
          if (newPostsMadeByBot || Array.from(updatedConversations.values()).some(c => c.lastCheckedTimestamp > (geminiDvachConversations.get(c.dvachRootPostByGeminiNum)?.lastCheckedTimestamp || 0 ) )) {
            setGeminiDvachConversations(new Map(updatedConversations));
          }

        } catch (error) {
          addLog(`Error during auto-monitoring: ${(error as Error).message}`, 'error', error);
           if ((error as Error).message.toLowerCase().includes("session expired") || (error as Error).message.toLowerCase().includes("login failed")) {
                setDvachSessionCookies(null); // Clear session if auth fails during monitor
                addLog("Auto-monitor: Dvach session seems to have expired. Logging out.", "auth");
           }
        }
      };
      
      intervalId = setInterval(monitorLogic, 30000); 
    } else {
      if (intervalId) {
        clearInterval(intervalId);
        addLog('Auto-monitoring Gemini conversations stopped.', 'gemini');
      }
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.autoMonitorDvachThreadForGemini, ai, currentBoard, currentThreadId, geminiDvachConversations, dvachSessionCookies, settings.proxyModeForGET, settings.customProxyUrlForGET, settings.userAgent, addLog, commonPostToDvach]);


  const handleSendGeminiChatMessage = async () => {
    if (!ai || (!geminiChatInput.trim() && !imageForGeminiChat)) return;
    const userMessageParts: Part[] = [];
    if (imageForGeminiChat) {
      const currentImageFile = imageForGeminiChat; 
      try {
        const base64data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(currentImageFile);
        });
        userMessageParts.push({ inlineData: { mimeType: currentImageFile.type, data: base64data } });
      } catch (error) {
        addLog("Error reading image file for chat.", 'error', error); return;
      }
    }
    if (geminiChatInput.trim()) userMessageParts.push({ text: geminiChatInput });
    const userMessage: ChatMessage = {
      id: `chat-user-${Date.now()}`, role: 'user', parts: userMessageParts, timestamp: Date.now(),
      imagePreview: imageForGeminiChat ? URL.createObjectURL(imageForGeminiChat) : undefined,
    };
    setGeminiChatMessages(prev => [...prev, userMessage]);
    setGeminiChatInput('');
    setImageForGeminiChat(null); 
    const modelMessageId = `chat-model-${Date.now()}`;
    setGeminiChatMessages(prev => [...prev, { id: modelMessageId, role: 'model', parts: [{text: ""}], timestamp: Date.now(), isLoading: true }]);
    setIsStreamingChat(true);
    setGeminiLoading(true);
    try {
      let chat = currentGeminiChat;
      if (!chat || geminiChatMessages.length <= 1) { 
        const historyForNewChat: Content[] = geminiChatMessages
            .filter(m => m.id !== modelMessageId && (m.role === 'user' || m.role === 'model') && m.parts.length > 0) 
            .map(m => ({ role: m.role as 'user' | 'model', parts: m.parts! }));
        const systemInstructionConfig = settings.geminiSystemInstruction ? { systemInstruction: settings.geminiSystemInstruction } : {};
        chat = ai.chats.create({
          model: GEMINI_TEXT_MODEL, history: historyForNewChat,
          config: { ...systemInstructionConfig, temperature: settings.geminiTemperature, topK: settings.geminiTopK, topP: settings.geminiTopP, maxOutputTokens: settings.geminiMaxOutputTokens }
        });
        setCurrentGeminiChat(chat);
        addLog("New Gemini chat session started.", 'gemini');
      }
      const result = await chat.sendMessageStream({ message: userMessageParts });
      let currentStreamedText = "";
      for await (const chunk of result) { // chunk is GenerateContentResponse
        currentStreamedText += chunk.text || ""; 
        setGeminiChatMessages(prev => prev.map(m => 
            m.id === modelMessageId ? { ...m, parts: [{ text: currentStreamedText }], isLoading: true } : m 
        ));
      }
      setGeminiChatMessages(prev => prev.map(m => 
        m.id === modelMessageId ? { ...m, parts: [{ text: currentStreamedText }], isLoading: false, timestamp: Date.now() } : m
      ));
      addLog("Gemini chat stream finished.", 'gemini');
    } catch (error) {
      const errorMsg = `Error in Gemini chat: ${(error as Error).message}`;
      addLog(errorMsg, 'error', error);
      setGeminiChatMessages(prev => prev.map(m => m.id === modelMessageId ? {id: modelMessageId, role: 'system', parts: [{text: `Error: ${errorMsg}`}], timestamp: Date.now(), isLoading: false } : m));
    } finally {
      setIsStreamingChat(false);
      setGeminiLoading(false);
    }
  };

  const clearGeminiChatHistory = () => {
    setGeminiChatMessages([]);
    setCurrentGeminiChat(null); 
    addLog('Gemini chat history and session cleared.', 'info');
  };

  const handleGenericGeminiTextGeneration = async () => {
    if (!ai || !textGenPrompt.trim()) { addLog("AI not initialized or prompt is empty.", 'warning'); return; }
    setGeminiLoading(true);
    setGeminiOutputText('');
    setGroundingSources([]);
    addLog(`Gemini generating content for prompt: "${textGenPrompt.substring(0, 50)}..."`, 'gemini');
    try {
      const modelConfig: GenerateContentParameters['config'] = {
        temperature: settings.geminiTemperature, topK: settings.geminiTopK, topP: settings.geminiTopP,
        maxOutputTokens: settings.geminiMaxOutputTokens, responseMimeType: settings.geminiResponseMimeType,
      };
      if (settings.useSearchGrounding) modelConfig.tools = [{ googleSearch: {} }];
      
      if (GEMINI_TEXT_MODEL === "gemini-2.5-flash-preview-04-17") {
        if (!settings.useThinkingBudget) { 
            modelConfig.thinkingConfig = { thinkingBudget: 0 };
        } else if (settings.geminiThinkingBudget > 0) { 
            modelConfig.thinkingConfig = { thinkingBudget: settings.geminiThinkingBudget };
        }
      }

      const response: CustomGenerateContentResponse = await ai.models.generateContent({
        model: GEMINI_TEXT_MODEL, contents: [{role: 'user', parts: [{text: textGenPrompt}]}],
         config: modelConfig,
      });
      const textOutput = response.text || "No text content returned.";
      setGeminiOutputText(textOutput);
      addLog("Gemini content generation successful.", 'success');
      if (settings.useSearchGrounding && response.candidates?.[0]?.groundingMetadata?.groundingChunks) {
        setGroundingSources(response.candidates[0].groundingMetadata.groundingChunks);
        addLog(`Grounding sources found: ${response.candidates[0].groundingMetadata.groundingChunks.length}`, 'gemini');
      }
    } catch (error) {
      const errorMsg = `Gemini content generation failed: ${(error as Error).message}`;
      addLog(errorMsg, 'error', error);
      setGeminiOutputText(errorMsg);
    } finally {
      setGeminiLoading(false);
    }
  };
  
  const handleGeminiImageGeneration = async () => {
    if (!ai || !imageGenPrompt.trim()) { addLog("AI not initialized or image prompt is empty.", 'warning'); return; }
    setIsGeneratingImage(true);
    setGeneratedImages([]);
    addLog(`Gemini generating ${numImagesToGenerate} image(s) for prompt: "${imageGenPrompt.substring(0, 50)}..."`, 'gemini');
    try {
      const response: GenerateImagesResponse = await ai.models.generateImages({
        model: GEMINI_IMAGE_MODEL, prompt: imageGenPrompt,
        config: { numberOfImages: numImagesToGenerate, outputMimeType: 'image/jpeg' } 
      });
      if (response.generatedImages && response.generatedImages.length > 0) {
        const imagesData: GeneratedImage[] = (response.generatedImages || [])
          .map((sdkImg): GeneratedImage | null => sdkImg.image?.imageBytes ? ({ base64Data: sdkImg.image.imageBytes, mimeType: sdkImg.image.mimeType || 'image/jpeg', prompt: imageGenPrompt }) : null)
          .filter((img): img is GeneratedImage => img !== null);
        setGeneratedImages(imagesData);
        addLog(`Gemini successfully generated ${imagesData.length} image(s).`, 'success');
      } else { addLog("Gemini image generation returned no images.", 'warning'); }
    } catch (error) {
      const errorMsg = `Gemini image generation failed: ${(error as Error).message}`;
      addLog(errorMsg, 'error', error);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleAnalyzeThreadWithGemini = async () => {
    if (!ai) { addLog('Gemini AI not initialized.', 'error'); return; }
    if (currentFetchedDvachPosts.length === 0) { addLog('No Dvach posts loaded to analyze.', 'warning'); return; }
    setIsAnalyzingThread(true);
    setGeminiOutputText('');
    addLog(`Gemini analyzing ${currentFetchedDvachPosts.length} posts from /${currentBoard}/${currentThreadId}...`, 'gemini');
    const postsSummary = currentFetchedDvachPosts.slice(0, 30).map(p => 
      `Post >>${p.num} (by ${p.name || 'Anon'}): "${p.comment.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>?/gm, '').substring(0, 150)}..."`
    ).join('\n');
    const analysisPrompt = `Analyze the following imageboard thread posts from 2ch.hk/${currentBoard}/${currentThreadId}:\n\n${postsSummary}\n\nProvide:
1. A brief overall summary of the thread's discussion.
2. Main topics or themes.
3. Common sentiments expressed.
4. Key discussions or arguments initiated by specific posts (mention post numbers if significant).
5. Suggest 2-3 potential reply angles or interesting points to engage with.
Format your response as a JSON object with keys: "summary", "mainTopics" (array of strings), "commonSentiments" (array of strings), "keyDiscussions" (array of strings), "replyAngles" (array of strings).`;
    try {
      const response = await ai.models.generateContent({
        model: GEMINI_TEXT_MODEL, contents: [{ role: 'user', parts: [{ text: analysisPrompt }] }],
        config: { responseMimeType: 'application/json', temperature: 0.5 }
      });
      let jsonStr = (response.text || "").trim(); 
      const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
      const match = jsonStr.match(fenceRegex);
      if (match && match[2]) jsonStr = match[2].trim();
      try {
        const parsedAnalysis: GeminiThreadAnalysis = JSON.parse(jsonStr);
        setGeminiOutputText(JSON.stringify(parsedAnalysis, null, 2)); 
        addLog('Gemini thread analysis successful.', 'success');
      } catch (parseError) {
        addLog('Failed to parse Gemini analysis JSON response.', 'error', {jsonStr, parseError});
        setGeminiOutputText(`Failed to parse analysis: ${jsonStr}`);
      }
    } catch (error) {
      const errorMsg = `Gemini thread analysis failed: ${(error as Error).message}`;
      addLog(errorMsg, 'error', error);
      setGeminiOutputText(errorMsg);
    } finally {
      setIsAnalyzingThread(false);
    }
  };
  
  const toggleTheme = () => {
    handleUpdateSettings({ theme: settings.theme === 'dark' ? 'light' : (settings.theme === 'light' ? 'system' : 'dark') });
  };

  const ThemeIcon = useMemo(() => {
    if (settings.theme === 'dark') return IconMoon;
    if (settings.theme === 'light') return IconSun;
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return IconMoon;
    return IconSun;
  }, [settings.theme]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => addLog('Copied to clipboard!', 'success'))
      .catch(err => addLog('Failed to copy text.', 'error', err));
  };

  const handleImageFileChangeForChat = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      if (file.size > 4 * 1024 * 1024) { 
        addLog("Image for chat exceeds 4MB limit.", 'warning');
        setImageForGeminiChat(null); event.target.value = ''; return;
      }
      const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif'];
      if (!allowedTypes.includes(file.type)) {
         addLog(`Unsupported image type for chat: ${file.type}. Allowed: PNG, JPEG, WEBP, HEIC, HEIF.`, 'warning');
         setImageForGeminiChat(null); event.target.value = ''; return;
      }
      setImageForGeminiChat(file);
    } else { setImageForGeminiChat(null); }
  };

  const renderDvachPostCard = (post: DvachPost, index: number) => (
    <div key={post.num || `post-idx-${index}`} id={`post-${post.num}`} className="p-3 mb-3 bg-gray-50 dark:bg-gray-700 rounded-lg shadow border border-gray-200 dark:border-gray-600 transition-all hover:shadow-md">
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
            <a key={`${post.num}-file-${fileIndex}`} href={`https://2ch.hk${file.path}`} target="_blank" rel="noopener noreferrer"
              className="block w-24 h-24" title={`Name: ${file.name}\nSize: ${file.size}KB\nDimensions: ${file.width}x${file.height}${file.duration ? `\nDuration: ${file.duration}` : ''}`}>
              <img src={`https://2ch.hk${file.thumbnail}`} alt={file.name} className="rounded object-cover w-full h-full border border-gray-300 dark:border-gray-500 hover:opacity-80 transition-opacity" loading="lazy"/>
            </a>
          ))}
        </div>
      )}
      <div className="prose prose-sm dark:prose-invert max-w-none break-words" dangerouslySetInnerHTML={{ __html: post.comment.replace(/&gt;&gt;(\d+)/g, `<a href="#post-$1" class="text-blue-500 hover:underline">&gt;&gt;$1</a>`) }}/>
      <div className="mt-2 text-right">
        <button onClick={() => handleGeminiReplyToDvachPost(post)} disabled={geminiLoading || !ai || isPosting || !dvachSessionCookies?.passcode_auth}
          className="px-3 py-1 text-xs bg-purple-500 hover:bg-purple-600 text-white rounded-md font-medium flex items-center shadow disabled:opacity-50 transition-colors"
          title={!ai ? "Gemini AI not initialized. Check API Key." : (!dvachSessionCookies?.passcode_auth ? "Not logged into Dvach." : "Reply to this post using Gemini AI")}>
          <IconSparkles className="mr-1 h-4 w-4"/> Reply with Gemini
        </button>
      </div>
    </div>
  );

  const renderDvachBotPanel = () => (
    <div className="space-y-6 p-4 md:p-6 bg-white dark:bg-gray-800 shadow-lg rounded-lg">
      <div className="flex justify-between items-center border-b pb-2 border-gray-300 dark:border-gray-700">
        <h2 className="text-2xl font-semibold text-blue-600 dark:text-blue-400">Dvach Operations</h2>
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
        <h3 className="text-xl font-medium text-gray-700 dark:text-gray-300">Load Thread</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div><label htmlFor="dvachBoardInput" className="block text-sm font-medium text-gray-600 dark:text-gray-300">Board:</label>
                <input id="dvachBoardInput" type="text" value={currentBoard} onChange={(e) => setCurrentBoard(e.target.value)} placeholder="e.g., b" className="mt-1 w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 focus:ring-1 focus:ring-blue-500"/></div>
            <div><label htmlFor="dvachThreadInput" className="block text-sm font-medium text-gray-600 dark:text-gray-300">Thread ID (OP Post #):</label>
                <input id="dvachThreadInput" type="text" value={currentThreadId} onChange={(e) => setCurrentThreadId(e.target.value)} placeholder="e.g., 12345678 or 0 for new thread" className="mt-1 w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 focus:ring-1 focus:ring-blue-500"/></div>
            <button onClick={handleLoadThread} disabled={isFetchingThread || !currentBoard || !currentThreadId}
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
            <h3 className="text-xl font-medium text-gray-700 dark:text-gray-300">Thread Viewer & Gemini Tools</h3>
            <button onClick={handleAnalyzeThreadWithGemini} disabled={isAnalyzingThread || currentFetchedDvachPosts.length === 0 || !ai}
                className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-medium flex items-center shadow disabled:opacity-50 transition-colors"
                title={!ai ? "Gemini AI not initialized" : (currentFetchedDvachPosts.length === 0 ? "No posts loaded to analyze" : "Analyze loaded thread with Gemini")}>
                <IconBrain className="mr-2 h-5 w-5"/> Analyze Thread</button></div>
        {(!currentBoard || !currentThreadId) && <p className="text-sm text-yellow-600 dark:text-yellow-400">Specify Board and Thread ID then click "Fetch Thread" to view posts.</p>}
        <div ref={threadPostsContainerRef} className="max-h-[600px] overflow-y-auto bg-gray-100 dark:bg-gray-800 p-2 rounded custom-scrollbar">
            {isFetchingThread && <p className="text-center p-4">Loading thread...</p>}
            {!isFetchingThread && currentFetchedDvachPosts.length === 0 && <p className="text-center p-4 text-gray-500 dark:text-gray-400">No posts loaded. Fetch thread or check settings.</p>}
            {currentFetchedDvachPosts.map((post,idx) => renderDvachPostCard(post, idx))}</div></div></div>
  );

  const renderGeminiPanel = () => (
    <div className="space-y-6 p-4 md:p-6 bg-white dark:bg-gray-800 shadow-lg rounded-lg">
      <h2 className="text-2xl font-semibold text-purple-600 dark:text-purple-400 border-b pb-2 border-gray-300 dark:border-gray-700">Gemini AI Laboratory</h2>
      {!ai && (<div className="p-3 mb-4 bg-yellow-100 dark:bg-yellow-800 border border-yellow-300 dark:border-yellow-600 rounded-md text-yellow-700 dark:text-yellow-200 text-sm flex items-center" role="alert">
            <IconAlertTriangle className="h-5 w-5 mr-2 text-yellow-500 dark:text-yellow-400 flex-shrink-0" />
            <span><strong>Gemini AI Not Initialized:</strong> Please check your API key in Settings.</span></div>)}
      <div className="p-4 border rounded-md border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium mb-2 text-gray-700 dark:text-gray-300">Generic Text Generation</h3>
        <textarea aria-label="Gemini text generation prompt" value={textGenPrompt} onChange={(e) => setTextGenPrompt(e.target.value)} placeholder="Enter your prompt for text generation..." 
            className="w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 focus:ring-1 focus:ring-purple-500" rows={3} disabled={!ai || geminiLoading}/>
        <div className="mt-2 flex items-center space-x-2">
            <button onClick={handleGenericGeminiTextGeneration} disabled={!ai || geminiLoading || !textGenPrompt.trim()}
                className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-md flex items-center disabled:opacity-50 shadow transition-colors">
                <IconWand className="mr-2 h-5 w-5"/> Generate Text</button></div>
        {geminiOutputText && (<div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">
                <div className="flex justify-between items-center mb-1">
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Generated Output:</h4>
                    <button onClick={() => copyToClipboard(geminiOutputText)} title="Copy output" className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded">
                        <IconCopy className="h-4 w-4 text-gray-500 dark:text-gray-400"/></button></div>
                <pre className="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200 custom-scrollbar max-h-60 overflow-y-auto">{geminiOutputText}</pre>
                {groundingSources.length > 0 && (<div className="mt-2">
                        <h5 className="text-xs font-semibold text-gray-600 dark:text-gray-400">Grounding Sources:</h5>
                        <ul className="list-disc list-inside text-xs">
                        {groundingSources.map((source, idx) => (<li key={idx}><a href={source.web?.uri || source.retrievedContext?.uri} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                                    {source.web?.title || source.retrievedContext?.title || source.web?.uri || source.retrievedContext?.uri}</a></li>))}</ul></div>)}</div>)}</div>
      <div className="p-4 border rounded-md border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium mb-2 text-gray-700 dark:text-gray-300">Image Generation (Imagen)</h3>
        <textarea aria-label="Gemini image generation prompt" value={imageGenPrompt} onChange={(e) => setImageGenPrompt(e.target.value)} placeholder="Enter prompt for image generation..."
            className="w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 focus:ring-1 focus:ring-pink-500" rows={2} disabled={!ai || isGeneratingImage}/>
        <div className="mt-2 flex items-center space-x-2">
            <button onClick={handleGeminiImageGeneration} disabled={!ai || isGeneratingImage || !imageGenPrompt.trim()}
                className="px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-md flex items-center disabled:opacity-50 shadow transition-colors">
                <IconPhoto className="mr-2 h-5 w-5"/> Generate Image(s)</button>
            <label className="text-sm text-gray-600 dark:text-gray-300">Number:
                <select value={numImagesToGenerate} onChange={(e) => setNumImagesToGenerate(parseInt(e.target.value))} className="ml-1 p-1 border rounded bg-gray-50 dark:bg-gray-700 dark:border-gray-600 focus:ring-1 focus:ring-pink-500" disabled={!ai || isGeneratingImage}>
                    {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}</select></label></div>
        {generatedImages.length > 0 && (<div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
                {generatedImages.map((img, idx) => (<div key={idx} className="border rounded-md p-1 bg-gray-50 dark:bg-gray-700">
                        <img src={`data:${img.mimeType};base64,${img.base64Data}`} alt={img.prompt || `Generated Image ${idx + 1}`} className="w-full h-auto rounded"/>
                        {img.prompt && <p className="text-xs mt-1 text-gray-500 dark:text-gray-400 truncate" title={img.prompt}>{img.prompt}</p>}</div>))}</div>)}</div>
      <div className="p-4 border rounded-md border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium mb-2 text-gray-700 dark:text-gray-300">Standalone Gemini Chat</h3>
            <div className="h-80 overflow-y-auto border p-3 rounded mb-2 bg-gray-100 dark:bg-gray-700 custom-scrollbar" ref={chatMessagesEndRef}>
                {geminiChatMessages.length === 0 && <p className="text-sm text-center text-gray-500 dark:text-gray-400">Chat history is empty. Send a message to start.</p>}
                {geminiChatMessages.map((msg) => (<div key={msg.id} className={`mb-3 clear-both ${msg.role === 'user' ? 'float-right' : 'float-left'}`}>
                        <div className={`p-2.5 rounded-lg shadow ${msg.role === 'user' ? 'bg-blue-500 text-white ml-auto rounded-br-none' : 'bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-100 rounded-bl-none'}`} style={{maxWidth: '85%'}}>
                            {msg.parts.map((part, partIdx) => (<div key={partIdx}> {part.text && <p className="text-sm whitespace-pre-wrap">{part.text}</p>}
                                    {part.inlineData && msg.imagePreview && <img src={msg.imagePreview} alt="Chat image" className="max-w-xs max-h-48 rounded mt-1"/>}</div>))}
                            {msg.isLoading && <span className="text-xs italic opacity-70 block mt-1">Gemini is thinking...</span>}
                            {!msg.isLoading && <p className="text-xs opacity-60 mt-1 text-right">{new Date(msg.timestamp).toLocaleTimeString()}</p>}</div></div>))}</div>
            <div className="flex items-center space-x-2">
                <input type="text" value={geminiChatInput} onChange={(e) => setGeminiChatInput(e.target.value)} 
                    onKeyPress={(e) => e.key === 'Enter' && !isStreamingChat && (geminiChatInput.trim() || imageForGeminiChat) && handleSendGeminiChatMessage()}
                    placeholder="Type your message..." className="flex-grow p-2 border rounded-l bg-gray-50 dark:bg-gray-700 dark:border-gray-600 focus:ring-1 focus:ring-purple-500"
                    disabled={!ai || geminiLoading || isStreamingChat}/>
                 <label htmlFor="chat-image-upload" className="p-2 border rounded bg-gray-100 hover:bg-gray-200 dark:bg-gray-600 dark:hover:bg-gray-500 dark:border-gray-500 cursor-pointer" title="Attach image">
                    <IconPhoto className="h-5 w-5 text-gray-600 dark:text-gray-300"/>
                    <input id="chat-image-upload" type="file" accept="image/png, image/jpeg, image/webp, image/heic, image/heif" className="hidden" onChange={handleImageFileChangeForChat} disabled={!ai || geminiLoading || isStreamingChat} /></label>
                <button onClick={handleSendGeminiChatMessage} disabled={!ai || geminiLoading || isStreamingChat || (!geminiChatInput.trim() && !imageForGeminiChat)}
                  className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-r flex items-center disabled:opacity-50 shadow transition-colors">
                  Send <IconSend className="ml-2 h-4 w-4"/></button></div>
            {imageForGeminiChat && <p className="text-xs text-gray-500 mt-1">Attached: {imageForGeminiChat.name} <button onClick={() => setImageForGeminiChat(null)} className="ml-1 text-red-500 hover:underline">(remove)</button></p>}
            <button onClick={clearGeminiChatHistory} className="text-xs text-gray-500 hover:underline mt-1 disabled:opacity-50" disabled={geminiChatMessages.length === 0 || geminiLoading || isStreamingChat}>Clear Chat History</button></div></div>
  );

  const renderSettingsPanel = () => (
     <div className="space-y-6 p-4 md:p-6 bg-white dark:bg-gray-800 shadow-lg rounded-lg">
      <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-300 border-b pb-2 border-gray-300 dark:border-gray-700">Application Settings</h2>
      <div className="p-4 border rounded-md border-gray-200 dark:border-gray-700 space-y-3">
        <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">Dvach Configuration</h3>
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
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Used for client-side GET requests and passed to serverless functions.</p>
          </div>
        </div>
      <div className="p-4 border rounded-md border-gray-200 dark:border-gray-700 space-y-3">
        <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">Proxy for Dvach GET Requests</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">POST requests (sending messages) use the Vercel serverless function `/api/dvach-post` and ignore these settings.</p>
        <div><label htmlFor="settingsProxyModeForGET" className="block text-sm font-medium">Proxy Mode for GET:</label>
          <select id="settingsProxyModeForGET" value={settings.proxyModeForGET} 
            onChange={e => {
                const mode = e.target.value as ProxyModeForGET;
                let newCustomUrl = settings.customProxyUrlForGET;
                if (mode === 'custom_go_x2u') newCustomUrl = PROXY_URL_GO_X2U_BASE;
                else if (mode === 'custom_cors_anywhere') newCustomUrl = DEFAULT_CORS_ANYWHERE_PROXY;
                handleUpdateSettings({ proxyModeForGET: mode, customProxyUrlForGET: newCustomUrl });
            }}  
            className="mt-1 w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 focus:ring-1 focus:ring-blue-500">
            <option value="vercel_serverless">Vercel Serverless Proxy (Recommended for thread data)</option>
            <option value="custom_go_x2u">Custom: go.x2u.in Format</option>
            <option value="custom_cors_anywhere">Custom: cors-anywhere.com Format</option>
            <option value="custom_general_prefix">Custom: General Prefix URL</option>
            <option value="custom_general_param">Custom: General Parameter URL (e.g., ...?url=)</option>
            <option value="none">No Proxy (May not work due to CORS)</option></select></div>
        {(settings.proxyModeForGET === 'custom_general_prefix' || settings.proxyModeForGET === 'custom_general_param' || settings.proxyModeForGET === 'custom_go_x2u' || settings.proxyModeForGET === 'custom_cors_anywhere') && (
          <div><label htmlFor="settingsCustomProxyUrlForGET" className="block text-sm font-medium">Custom Proxy URL Base for GET:</label>
            <input id="settingsCustomProxyUrlForGET" type="text" placeholder="Enter custom proxy base URL" value={settings.customProxyUrlForGET} 
              onChange={e => handleUpdateSettings({customProxyUrlForGET: e.target.value})} 
              className="mt-1 w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 focus:ring-1 focus:ring-blue-500"/>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {settings.proxyModeForGET === 'custom_go_x2u' && `Should be the go.x2u URL ending in '&url='.`}
              {settings.proxyModeForGET === 'custom_cors_anywhere' && `Should be the cors-anywhere URL ending in '/'.`}
              {settings.proxyModeForGET === 'custom_general_prefix' && `Prefix, e.g., https://myproxy.com/ (ends with /).`}
              {settings.proxyModeForGET === 'custom_general_param' && `Parameter based, e.g., https://myproxy.com?target= (ends with query param name and =).`}
            </p></div>)}</div>
       <div className="p-4 border rounded-md border-gray-200 dark:border-gray-700 space-y-3">
        <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">Gemini API Configuration</h3>
        <div><label htmlFor="geminiApiKeySource" className="block text-sm font-medium">API Key Source:</label>
            <select id="geminiApiKeySource" value={settings.geminiApiKeySource} onChange={e => handleUpdateSettings({geminiApiKeySource: e.target.value as 'env' | 'user'})} className="mt-1 w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 focus:ring-1 focus:ring-purple-500">
              <option value="env">Use Environment API_KEY (VITE_GEMINI_API_KEY) {processEnvApiKey ? `(Detected)` : "(Not Detected)"}</option>
              <option value="user">Enter API Key Manually</option></select></div>
        {settings.geminiApiKeySource === 'user' && (<div><label htmlFor="userGeminiApiKey" className="block text-sm font-medium">Manual Gemini API Key:</label>
            <input id="userGeminiApiKey" type="password" placeholder="Enter your Gemini API Key" value={settings.userGeminiApiKey} onChange={e => handleUpdateSettings({userGeminiApiKey: e.target.value})} className="mt-1 w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 focus:ring-1 focus:ring-purple-500"/></div>)}
        <div><label htmlFor="geminiSystemInstruction" className="block text-sm font-medium">Gemini System Instruction (Default for replies & chat):</label>
            <textarea id="geminiSystemInstruction" value={settings.geminiSystemInstruction} onChange={e => handleUpdateSettings({geminiSystemInstruction: e.target.value})} rows={3} className="mt-1 w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 focus:ring-1 focus:ring-purple-500"/></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div><label htmlFor="geminiTemp" className="block text-xs font-medium">Temperature:</label>
                <input id="geminiTemp" type="number" step="0.05" min="0" max="1" value={settings.geminiTemperature} onChange={e => handleUpdateSettings({geminiTemperature: parseFloat(e.target.value)})} className="mt-1 w-full p-1.5 border rounded bg-gray-50 dark:bg-gray-700 dark:border-gray-600"/></div>
             <div><label htmlFor="geminiTopP" className="block text-xs font-medium">Top P:</label>
                <input id="geminiTopP" type="number" step="0.05" min="0" max="1" value={settings.geminiTopP} onChange={e => handleUpdateSettings({geminiTopP: parseFloat(e.target.value)})} className="mt-1 w-full p-1.5 border rounded bg-gray-50 dark:bg-gray-700 dark:border-gray-600"/></div>
            <div><label htmlFor="geminiTopK" className="block text-xs font-medium">Top K:</label>
                <input id="geminiTopK" type="number" step="1" min="1" value={settings.geminiTopK} onChange={e => handleUpdateSettings({geminiTopK: parseInt(e.target.value)})} className="mt-1 w-full p-1.5 border rounded bg-gray-50 dark:bg-gray-700 dark:border-gray-600"/></div>
            <div><label htmlFor="geminiMaxOut" className="block text-xs font-medium">Max Tokens:</label>
                <input id="geminiMaxOut" type="number" step="64" min="64" value={settings.geminiMaxOutputTokens} onChange={e => handleUpdateSettings({geminiMaxOutputTokens: parseInt(e.target.value)})} className="mt-1 w-full p-1.5 border rounded bg-gray-50 dark:bg-gray-700 dark:border-gray-600"/></div></div>
         <div className="flex items-center space-x-4">
            <label className="flex items-center text-sm"><input type="checkbox" checked={settings.useSearchGrounding} onChange={e => handleUpdateSettings({useSearchGrounding: e.target.checked})} className="mr-2 h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"/>Use Google Search Grounding (Text Gen)</label>
            <label className="flex items-center text-sm"><input type="checkbox" checked={settings.useThinkingBudget} onChange={e => handleUpdateSettings({useThinkingBudget: e.target.checked})} className="mr-2 h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"/>Use Thinking Budget (Text Gen)</label>
             {settings.useThinkingBudget && (<input type="number" step="100" min="0" value={settings.geminiThinkingBudget} onChange={e => handleUpdateSettings({geminiThinkingBudget: parseInt(e.target.value)})} title="Thinking Budget (ms), 0 for default/enabled" placeholder="Budget (ms)" className="p-1.5 w-24 border rounded bg-gray-50 dark:bg-gray-700 dark:border-gray-600 text-sm"/>)}</div></div>
      <div className="p-4 border rounded-md border-gray-200 dark:border-gray-700 space-y-2">
         <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">Gemini-Dvach Interaction</h3>
        <label className="flex items-center text-sm"><input type="checkbox" checked={settings.geminiAnalyzeOpMedia} onChange={e => handleUpdateSettings({geminiAnalyzeOpMedia: e.target.checked})} className="mr-2 h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"/>Gemini Considers Media in OP Post</label>
        <label className="flex items-center text-sm"><input type="checkbox" checked={settings.geminiAnalyzeAnonMedia} onChange={e => handleUpdateSettings({geminiAnalyzeAnonMedia: e.target.checked})} className="mr-2 h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"/>Gemini Considers Media in Non-OP Posts</label>
        <label className="flex items-center text-sm"><input type="checkbox" checked={settings.geminiReplyWithGeneratedImage} onChange={e => handleUpdateSettings({geminiReplyWithGeneratedImage: e.target.checked})} className="mr-2 h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"/>Gemini Attempts to Generate Image with Replies</label>
        <label className="flex items-center text-sm"><input type="checkbox" checked={settings.autoMonitorDvachThreadForGemini} onChange={e => handleUpdateSettings({autoMonitorDvachThreadForGemini: e.target.checked})} className="mr-2 h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"/>Gemini Auto-Monitors Thread for Replies (Experimental)</label>
      </div>
      <details className="p-4 border rounded-md border-gray-200 dark:border-gray-700">
        <summary className="text-lg font-medium text-gray-700 dark:text-gray-300 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400">Advanced Botting Features (Experimental)</summary>
        <div className="mt-3 space-y-3"><p className="text-sm text-yellow-600 dark:text-yellow-400">Caution: Use these features responsibly and be aware of imageboard rules.</p>
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
          {[{ id: 'dvach', label: 'Dvach Ops', icon: IconCpu }, { id: 'gemini', label: 'Gemini Lab', icon: IconSparkles },
            { id: 'settings', label: 'Settings', icon: IconSettings }, { id: 'logs', label: 'Logs', icon: IconTerminal }].map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as 'dvach' | 'gemini' | 'settings' | 'logs')}
              aria-current={activeTab === tab.id ? "page" : undefined}
              className={`flex items-center px-2 sm:px-3 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 transition-all duration-150 ease-in-out focus:outline-none focus:ring-1 focus:ring-blue-400
                ${activeTab === tab.id ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'}`}>
              <tab.icon aria-hidden="true" className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-1.5 flex-shrink-0" />
              <span className="truncate">{tab.label}</span></button>))}</div></nav>
      <main className="container mx-auto p-3 sm:p-4 md:p-6" role="main"><div className="mt-1 sm:mt-2">
            {activeTab === 'dvach' && renderDvachBotPanel()}
            {activeTab === 'gemini' && renderGeminiPanel()}
            {activeTab === 'settings' && renderSettingsPanel()}
            {activeTab === 'logs' && renderLogsPanel()}</div></main>
      <footer className="text-center py-4 border-t border-gray-200 dark:border-gray-700 mt-8">
        <p className="text-xs text-gray-500 dark:text-gray-400">Dvach Gemini Bot Interface - Version {APP_VERSION} - Use responsibly.</p></footer></div>
  );
};
export default App;