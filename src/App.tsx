/// <reference types="vite/client" />
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  GoogleGenAI,
  Part,
  GenerateContentParameters
} from "@google/genai";
import {
  AppSettings, LogEntry, DvachPost, SentMessageInfo, ProxyModeForGET,
  DvachThreadResponse,
  DvachFile, GeminiDvachConversation, ChatMessage,
  DvachSessionCookies, AutonomousBotReplyMode, BotOpMediaCache, AutonomousBotInitialContextScope,
  GroundingChunk, CustomGenerateContentResponse, ActiveTask
} from './types';
import { getThreadData, loginToDvach, postWithSessionCookie, base64ToFile, extractDvachApiError, buildProxiedGetUrl } from './services/dvachService';
import { parseGeminiJsonResponse } from './services/geminiService';
import {
  APP_SETTINGS_KEY, SENT_MESSAGES_KEY, APP_VERSION,
  MAX_LOG_ENTRIES, MAX_SENT_MESSAGES_STORED,
  GEMINI_DVACH_CONVERSATIONS_KEY, DVACH_SESSION_COOKIES_KEY,
  DVACH_DOMAINS,
  BUMP_KEYWORDS,
  AUTONOMOUS_BOT_MAX_OUTPUT_TOKENS,
  DEFAULT_APP_SETTINGS,
  PROXY_URL_X2U_KEYED_BASE, // Added for user's custom proxy
  PROXY_URL_CORS_ANYWHERE_OFFICIAL, // Added for user's custom proxy
  SUPPORTED_GEMINI_TEXT_MODELS,
  SUPPORTED_GEMINI_IMAGE_MODELS,
  SUPPORTED_GEMINI_AUDIO_MODELS,
} from './constants';
import { generateUserAgent } from '../utils/userAgentGenerator';

import {
  IconSettings, IconTerminal, IconSend, IconTrash, IconCpu,
  IconSparkles, IconAlertTriangle, IconRefresh, IconSearch,
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
    const numericKeys: (keyof AppSettings)[] = ['maxImagesToAnalyzePerPost', 'autonomousBotCycleIntervalSeconds', 'autonomousBotFullThreadContextMaxChars', 'geminiTemperature', 'geminiTopP', 'geminiTopK', 'geminiMaxOutputTokens', 'geminiThinkingBudget', 'autonomousBotMinReplyDelayMs', 'autonomousBotMaxReplyDelayMs', 'repetitivePostCount', 'repetitivePostDelay', 'dvachBaseDomainIndex', 'autonomousBotMinPostIntervalSeconds'];
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
    mergedInitialSettings.geminiSystemInstruction = loadedSettings.geminiSystemInstruction || DEFAULT_APP_SETTINGS.geminiSystemInstruction;
    mergedInitialSettings.dvachDomainUsageMode = loadedSettings.dvachDomainUsageMode || DEFAULT_APP_SETTINGS.dvachDomainUsageMode;
    mergedInitialSettings.customDvachDomain = loadedSettings.customDvachDomain || DEFAULT_APP_SETTINGS.customDvachDomain;
    mergedInitialSettings.autonomousBotMinPostIntervalSeconds = loadedSettings.autonomousBotMinPostIntervalSeconds || DEFAULT_APP_SETTINGS.autonomousBotMinPostIntervalSeconds;


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
  const sentMessagesRef = useRef(sentMessages); // Ref for runBotCycleCallback
  useEffect(() => { sentMessagesRef.current = sentMessages; }, [sentMessages]);


  const [postText, setPostText] = useState<string>('');
  const [postFile, setPostFile] = useState<File | null>(null);
  const [postUseSage, setPostUseSage] = useState<boolean>(false);
  const [isPosting, setIsPosting] = useState<boolean>(false);
  const [postActivityLog, setPostActivityLog] = useState<string[]>([]);
  const [threadUrl, setThreadUrl] = useState<string>('');

  const [imagePrompt, setImagePrompt] = useState<string>('');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState<boolean>(false);

  const [audioPrompt, setAudioPrompt] = useState<string>('');
  const [generatedAudio, setGeneratedAudio] = useState<string | null>(null);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState<boolean>(false);
  const [generatedVideo, setGeneratedVideo] = useState<string | null>(null);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState<boolean>(false);

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
  const currentBotOpMediaCacheRef = useRef(currentBotOpMediaCache); // Ref for runBotCycleCallback
  useEffect(() => { currentBotOpMediaCacheRef.current = currentBotOpMediaCache; }, [currentBotOpMediaCache]);
  
  const initBotJsonInfoLoggedRef = useRef(false);
  const lastBotPostAttemptTimeRef = useRef<number>(0);

  const currentDvachBaseUrl = useMemo(() => {
    if (settings.dvachDomainUsageMode === 'custom' && settings.customDvachDomain && settings.customDvachDomain.trim().startsWith('http')) {
      return settings.customDvachDomain.trim().replace(/\/+$/, ""); // Remove trailing slashes
    }
    const idx = settings.dvachBaseDomainIndex;
    return (idx >= 0 && idx < DVACH_DOMAINS.length) ? DVACH_DOMAINS[idx] : DVACH_DOMAINS[0];
  }, [settings.dvachDomainUsageMode, settings.customDvachDomain, settings.dvachBaseDomainIndex]);


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
    try {
      const storableConversations = Array.from(geminiDvachConversations.entries()).map(([key, convo]) => {
        const storableHistory = convo.history.map(chatMessage => {
          const storableParts = chatMessage.parts.map(part => {
            if (part.inlineData && typeof part.inlineData.data === 'string') { // Check if data is string
              return {
                inlineData: {
                  mimeType: part.inlineData.mimeType,
                  data: `[Inline data omitted for localStorage: ${part.inlineData.mimeType}, original data length: ${part.inlineData.data.length}]`
                }
              };
            }
            return part;
          });
          return { ...chatMessage, parts: storableParts, imagePreview: undefined }; // Remove imagePreview
        });

        let storableInitialContext = convo.initialContext;
        if (convo.initialContext?.opPostMediaParts) {
            const storableOpMediaParts = convo.initialContext.opPostMediaParts.map(part => {
              if (part.inlineData && typeof part.inlineData.data === 'string') {
                  return {
                      inlineData: {
                          mimeType: part.inlineData.mimeType,
                          data: `[OP Media data omitted for localStorage: ${part.inlineData.mimeType}, original data length: ${part.inlineData.data.length}]`
                      }
                  };
              }
              return part;
            });
            storableInitialContext = { ...convo.initialContext, opPostMediaParts: storableOpMediaParts };
        }
        return [key, { ...convo, history: storableHistory, initialContext: storableInitialContext }];
      });
      localStorage.setItem(GEMINI_DVACH_CONVERSATIONS_KEY, JSON.stringify(storableConversations));
    } catch (error) {
      if (error instanceof DOMException && (error.name === 'QuotaExceededError' || error.code === 22)) {
        addLog('LocalStorage quota exceeded while saving bot conversations. Attempting to clear bot conversations to recover.', 'error', error);
        try {
          localStorage.removeItem(GEMINI_DVACH_CONVERSATIONS_KEY);
          setGeminiDvachConversations(new Map()); // Clear in-memory state as well
          addLog('Cleared bot conversations from localStorage and memory due to quota error. App should function, but bot context is lost.', 'warning');
        } catch (clearError) {
          addLog('Failed to clear bot conversations from localStorage after quota error. Manual clearing of localStorage might be needed.', 'error', clearError);
        }
      } else {
        addLog('Error saving bot conversations to localStorage: ' + (error as Error).message, 'error', error);
      }
    }
  }, [geminiDvachConversations, addLog, setGeminiDvachConversations]);


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


  const handleLoadThread = async (isBotCycle: boolean = false, board?: string, threadId?: string): Promise<DvachPost[] | null> => {
    const boardToFetch = board || (isBotCycle ? settings.autonomousBotTargetBoard : currentBoard).trim();
    const threadToFetch = threadId || (isBotCycle ? settings.autonomousBotTargetThreadId : currentThreadId).trim();

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
      if(!isBotCycle) addLog(`Fetching thread /${boardToFetch}/${threadToFetch} using base URL ${currentDvachBaseUrl}... Proxy for GET (thread data): ${settings.proxyModeForGET}`, 'dvach');
      const data: DvachThreadResponse = await getThreadData(
        currentDvachBaseUrl, // Pass the dynamic base URL
        boardToFetch,
        threadToFetch,
        settings.proxyModeForGET,
        settings.customProxyUrlForGET,
        settings.userAgent
      );

      const posts = data.threads?.[0]?.posts || [];
      if(!isBotCycle) {
        setCurrentFetchedDvachPosts(posts);
        addLog(`Successfully fetched ${posts.length} posts from ${currentDvachBaseUrl}/${boardToFetch}/${threadToFetch}.`, 'success');
        if (threadPostsContainerRef.current) threadPostsContainerRef.current.scrollTop = 0;
      }
      return posts;
    } catch (err) {
      const errorMsg = (err as Error).message;
      if(!isBotCycle) setFetchError(errorMsg);
      addLog(`Failed to fetch thread ${currentDvachBaseUrl}/${boardToFetch}/${threadToFetch}: ${errorMsg}`, isBotCycle ? 'bot_error' : 'error', err);
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
    addLog("Attempting to log into Dvach with purchased passcode (via /api/dvach-login, targets 2ch.hk)...", 'auth');
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

  const handleGenerateImage = async () => {
    if (!ai) {
      addLog('Gemini AI not initialized.', 'error');
      return;
    }
    if (!imagePrompt.trim()) {
      addLog('Image prompt is empty.', 'warning');
      return;
    }

    setIsGeneratingImage(true);
    setGeneratedImage(null);
    const taskId = addTask('image_generation', `Generating image with prompt: "${imagePrompt.substring(0, 50)}..."`);
    addLog(`Generating image with prompt: "${imagePrompt}"`, 'gemini');

    try {
      const response = await ai.models.generateImages({
        model: settings.geminiImageModel,
        prompt: imagePrompt,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/jpeg',
        },
      });

      if (response.generatedImages?.[0]?.image?.imageBytes) {
        const base64Image = `data:image/jpeg;base64,${response.generatedImages[0].image.imageBytes}`;
        setGeneratedImage(base64Image);
        addLog('Image generated successfully.', 'success');
      } else {
        throw new Error('No image data returned from API.');
      }
    } catch (error) {
      const errorMsg = (error as Error).message;
      addLog(`Image generation failed: ${errorMsg}`, 'error', error);
      setFetchError(`Image generation failed: ${errorMsg}`);
    } finally {
      setIsGeneratingImage(false);
      removeTask(taskId);
    }
  };

  const handleGenerateAudio = async () => {
    if (!ai) {
      addLog('Gemini AI not initialized.', 'error');
      return;
    }
    if (!audioPrompt.trim()) {
      addLog('Audio prompt is empty.', 'warning');
      return;
    }

    setIsGeneratingAudio(true);
    setGeneratedAudio(null);
    const taskId = addTask('audio_generation', `Generating audio with prompt: "${audioPrompt.substring(0, 50)}..."`);
    addLog(`Generating audio with prompt: "${audioPrompt}"`, 'gemini');

    try {
      const response = await ai.models.generateContent({
        model: settings.geminiAudioModel,
        contents: [{ role: 'user', parts: [{ text: audioPrompt }] }],
      });

      if (response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data) {
        const base64Audio = `data:audio/mp3;base64,${response.candidates[0].content.parts[0].inlineData.data}`;
        setGeneratedAudio(base64Audio);
        addLog('Audio generated successfully.', 'success');
      } else {
        throw new Error('No audio data returned from API.');
      }
    } catch (error) {
      const errorMsg = (error as Error).message;
      addLog(`Audio generation failed: ${errorMsg}`, 'error', error);
      setFetchError(`Audio generation failed: ${errorMsg}`);
    } finally {
      setIsGeneratingAudio(false);
      removeTask(taskId);
    }
  };

  const handleGenerateVideo = () => {
    if (!generatedImage || !generatedAudio) {
      addLog('Image or audio not generated.', 'warning');
      return;
    }

    setIsGeneratingVideo(true);
    const worker = new Worker('ffmpeg-worker.js');
    worker.postMessage({
      image: generatedImage,
      audio: generatedAudio,
    });

    worker.onmessage = (event) => {
      const { data } = event.data;
      const videoBlob = new Blob([data], { type: 'video/mp4' });
      const videoUrl = URL.createObjectURL(videoBlob);
      setGeneratedVideo(videoUrl);
      setIsGeneratingVideo(false);
      addLog('Video generated successfully.', 'success');
    };
  };

  const commonPostToDvach = useCallback(async (
    comment: string,
    file: File | null,
    useSageFlag: boolean,
    boardToPostInput: string,
    threadIdForDvachApiInput: string,
    userAgentToUse: string, 
    dvachSessionCookiesToUse: DvachSessionCookies | null, 
    replyToPostNumForDvachApi?: string
  ): Promise<string> => {
    const boardToPost = boardToPostInput.trim();
    const threadIdForDvachApi = threadIdForDvachApiInput.trim();
    const finalReplyToPostNum = replyToPostNumForDvachApi?.trim();
  
    if (!dvachSessionCookiesToUse?.passcode_auth) {
      const errorMsg = 'Not logged into Dvach or session expired. Please login first.';
      addLog(errorMsg, 'auth');
      throw new Error(errorMsg);
    }
    if (!boardToPost || !comment.trim()) {
      const errorMsg = 'Board and Post Comment are required for posting.';
      addLog(errorMsg, 'error');
      throw new Error(errorMsg);
    }
  
    const effectiveThreadIdForDvach = (!threadIdForDvachApi || threadIdForDvachApi === "0") ? "0" : threadIdForDvachApi;
  
    const targetDesc = effectiveThreadIdForDvach === "0" ? 'new thread' : `thread ${effectiveThreadIdForDvach}`;
    const logMsg = `Attempting to post to /${boardToPost}/${targetDesc}${finalReplyToPostNum ? ` (reply to >>${finalReplyToPostNum})` : ''} (via /api/dvach-post, targets 2ch.hk). Comment: "${comment.substring(0,50)}..."`;
    addLog(logMsg, 'dvach');
  
    setIsPosting(true); 
    try {
      const result = await postWithSessionCookie(
        dvachSessionCookiesToUse,
        boardToPost,
        effectiveThreadIdForDvach,
        comment,
        file,
        finalReplyToPostNum,
        useSageFlag,
        userAgentToUse
      );
  
      const newPostNum = String(result.num || result.thread || result.target || Date.now());
      addLog(`Post successful! Dvach response: Num: ${newPostNum}`, 'success', result);
  
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
      addLog(`Failed to post (commonPostToDvach): ${error.message}`, 'error', error);
      throw error; 
    } finally {
      setIsPosting(false);
    }
  }, [addLog]); // Removed setIsPosting, setSentMessages from deps as they are stable setters


  const handleSimplePost = async () => {
    const board = currentBoard.trim();
    const threadContext = currentThreadId.trim();
    const threadTargetForDvach = threadContext && threadContext !== "0" ? threadContext : "0";
    addPostActivity(`Attempting manual post to /${board}/${threadTargetForDvach || 'new thread'}...`);
    setFetchError(null);
    try {
      await commonPostToDvach(
        postText, 
        postFile, 
        postUseSage, 
        board, 
        threadTargetForDvach,
        settings.userAgent,
        dvachSessionCookies,
        undefined 
      );
      addPostActivity(`Manual post successful!`);
      setPostText('');
      setPostFile(null);
    } catch (e) {
      const errorMsg = (e as Error).message;
      addPostActivity(`Manual Post Failed: ${errorMsg}`);
      setFetchError(errorMsg);
      const dvachApiError = extractDvachApiError(e);
      if (dvachApiError && (dvachApiError.code === -4 || dvachApiError.code === -6 || dvachApiError.code === -21 || dvachApiError.message.toLowerCase().includes("постинг запрещён") || dvachApiError.message.toLowerCase().includes("доступ запрещен"))) {
        addLog(`Session likely expired or invalid for manual post. Please log in again. Error: ${dvachApiError.message}`, 'auth');
        setDvachSessionCookies(null); 
      }
    }
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
    addLog(`Gemini preparing manual reply to post >>${targetPost.num} on ${currentDvachBaseUrl}/${boardForReply}/${threadForReply}...`, 'gemini');
    setFetchError(null); 

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


    let userPromptText = `You are on the imageboard ${currentDvachBaseUrl}/${boardForReply}/${threadForReply}.\nOverall thread context:\n${threadContextSummary}\n\nNow, focus on crafting a reply to this specific post:\nPost >>${targetPost.num} (by ${targetPost.name || 'Anonymous'}) says:\n"${targetPost.comment.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>?/gm, '').substring(0, 1000)}"`;

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
                const imageUrl = `${currentDvachBaseUrl}${dvachImageFile.path}`; // Use dynamic base URL
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
      const requestConfig:GenerateContentParameters['config'] = {
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
        model: settings.geminiTextModel,
        contents: [{ role: 'user', parts: geminiMessageParts }],
        config: requestConfig
      }) as CustomGenerateContentResponse; 

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
            if (!Array.isArray(parsedResult)) { 
                parsedText = parsedResult.replyText || parsedResult.text || parsedResult.response;
            } else if (parsedResult.length > 0) { 
                addLog('Gemini JSON response was an array, taking first element for manual reply.', 'gemini', parsedResult);
                parsedText = parsedResult[0].replyText || parsedResult[0].text || parsedResult[0].response;
            }
          }
          rawGeminiText = parsedText || rawGeminiText; 
      }

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
              model: settings.geminiImageModel,
              prompt: imagePpt,
              config: {
                numberOfImages: 1,
                outputMimeType: 'image/jpeg', 
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
      const newPostNumByGemini = await commonPostToDvach(
        geminiReplyText, 
        finalFileToPost, 
        postUseSage, 
        boardForReply, 
        threadForReply, 
        settings.userAgent,
        dvachSessionCookies,
        targetPost.num
        );

      setSentMessages(prev => prev.map(msg =>
        msg.num === newPostNumByGemini && msg.board === boardForReply && msg.thread === threadForReply ?
        { ...msg, isGeminiPost: true, geminiTriggerPostNum: targetPost.num, geminiGeneratedImage: !!finalFileToPost } : msg
      ));
      addLog(`Manual Gemini reply posted as >>${newPostNumByGemini} to /${boardForReply}/${threadForReply}.`, 'success');

    } catch (error) {
      const errorMsg = (error as Error).message;
      addLog(`Error during manual Gemini reply for >>${targetPost.num}: ${errorMsg}`, 'error', error);
      setFetchError(errorMsg); 
      const dvachApiError = extractDvachApiError(error);
      if (dvachApiError && (dvachApiError.code === -4 || dvachApiError.code === -6 || dvachApiError.code === -21 || dvachApiError.message.toLowerCase().includes("постинг запрещён") || dvachApiError.message.toLowerCase().includes("доступ запрещен"))) {
        addLog(`Session likely expired or invalid for Gemini reply. Please log in again. Error: ${dvachApiError.message}`, 'auth');
        setDvachSessionCookies(null);
      }
    } finally {
      setGeminiLoading(false);
      removeTask(taskId);
    }
  };

  // Destructure settings for runBotCycleCallback dependencies
  const {
    autonomousBotTargetBoard, autonomousBotTargetThreadId, proxyModeForGET, customProxyUrlForGET, userAgent,
    geminiAnalyzeOpMedia: botGeminiAnalyzeOpMedia, 
    proxyModeForImagesGET, customProxyUrlForImagesGET: botCustomProxyUrlForImagesGET, 
    maxImagesToAnalyzePerPost: botMaxImagesToAnalyzePerPost,
    autonomousBotSystemPrompt, autonomousBotReplyMode, 
    geminiReplyWithGeneratedImage: botGeminiReplyWithGeneratedImage,
    autonomousBotMinReplyDelayMs, autonomousBotMaxReplyDelayMs, autonomousBotDisableThinking,
    geminiSafetySettings: botGeminiSafetySettings, 
    autonomousBotInitialContextScope, autonomousBotFullThreadContextMaxChars,
    botAnalyzesImagesInTriggerPosts, autonomousBotAllowReplyToSelf,
    autonomousBotMinPostIntervalSeconds
  } = settings; 

const runBotCycleCallback = useCallback(async () => {
    if (!ai || !dvachSessionCookies?.passcode_auth) {
        addAutonomousBotActivityLog("Bot cycle skipped: AI or Dvach login missing.", 'bot_warning');
        if (autonomousBotActive) setAutonomousBotActive(false); 
        return;
    }
    
    const botBoard = autonomousBotTargetBoard.trim();
    const botThreadId = autonomousBotTargetThreadId.trim();

    if (!botBoard || !botThreadId) {
        addAutonomousBotActivityLog("Target board/thread for bot not set. Stopping bot.", 'bot_error');
        setAutonomousBotStatus("Error: Target board/thread not set.");
        if (autonomousBotActive) setAutonomousBotActive(false);
        return;
    }

    if ( (Date.now() - lastBotPostAttemptTimeRef.current) < autonomousBotMinPostIntervalSeconds * 1000) {
        addAutonomousBotActivityLog(`Bot cycle skipped: Minimum post interval (${autonomousBotMinPostIntervalSeconds}s) not met. Last attempt: ${new Date(lastBotPostAttemptTimeRef.current).toLocaleTimeString()}`, 'bot_activity');
        setAutonomousBotStatus(`Waiting (min post interval) /${botBoard}/${botThreadId}`);
        return;
    }

    const currentBotTargetKeyForCycle = `${botBoard}_${botThreadId}`;
    setAutonomousBotStatus(`Active - Running cycle for /${botBoard}/${botThreadId}...`);
    addAutonomousBotActivityLog(`Starting bot cycle. Mode: ${autonomousBotReplyMode}. Target: ${currentDvachBaseUrl}/${botBoard}/${botThreadId}`, 'bot_activity');

    let workingConvoCandidate: GeminiDvachConversation | undefined;
    setGeminiDvachConversations(prevConvos => { 
        workingConvoCandidate = prevConvos.get(currentBotTargetKeyForCycle);
        return prevConvos; 
    });


    try {
        const threadPostsResponse = await getThreadData(currentDvachBaseUrl, botBoard, botThreadId, proxyModeForGET, customProxyUrlForGET, userAgent);
        const allPostsInThread = threadPostsResponse?.threads?.[0]?.posts || [];
        const opPost = allPostsInThread.find(p => p.num === botThreadId || p.op === 1);

        if (!opPost) { 
            addAutonomousBotActivityLog(`OP Post for ${currentDvachBaseUrl}/${botBoard}/${botThreadId} not found. Cannot build context or reply. Skipping cycle.`, 'bot_error');
            setAutonomousBotStatus(`Error: OP Post not found for /${botBoard}/${botThreadId}.`);
            setGeminiDvachConversations(prevConvos => {
                const newConvos = new Map(prevConvos);
                const convoToUpdate = newConvos.get(currentBotTargetKeyForCycle);
                if (convoToUpdate) {
                    newConvos.set(currentBotTargetKeyForCycle, { ...convoToUpdate, lastCheckedTimestamp: Date.now(), status: 'error' as const });
                }
                return newConvos;
            });
           
            return;
        }

        if (!workingConvoCandidate) {
           addAutonomousBotActivityLog(`No existing conversation context for /${botBoard}/${botThreadId}. Creating new.`, 'bot_setup');
        } else if (workingConvoCandidate.board !== botBoard || workingConvoCandidate.threadId !== botThreadId) {
           addAutonomousBotActivityLog(`Existing context is for a different target (${workingConvoCandidate.board}/${workingConvoCandidate.threadId}). Creating new for /${botBoard}/${botThreadId}.`, 'bot_setup');
           workingConvoCandidate = undefined; 
        }

        let initialContextTextForSystemMessage = "";
        const maxChars = autonomousBotFullThreadContextMaxChars > 0 ? autonomousBotFullThreadContextMaxChars : Infinity;
        if (autonomousBotInitialContextScope === 'full_thread') {
            let ctx = `CONTEXT_START: Full thread ${currentDvachBaseUrl}/${botBoard}/${botThreadId}.\n`; let len = ctx.length;
            for (const p of allPostsInThread) {
                const s = `>>${p.num}(${p.name||'A'}):"${p.comment.replace(/<[^>]+>/g,'').substring(0,250)}"\n`;
                if (len + s.length > maxChars && maxChars !== Infinity) { ctx += "...(truncated)\n"; break; }
                ctx += s; len += s.length;
            }
            initialContextTextForSystemMessage = ctx + "CONTEXT_END\n";
        } else { 
            const opText = opPost.comment.replace(/<[^>]+>/g, '').substring(0,1500) || "N/A";
            initialContextTextForSystemMessage = `CONTEXT_START: OP(>>${opPost.num}) for ${currentDvachBaseUrl}/${botBoard}/${botThreadId}:\n"${opText}"\nCONTEXT_END\n`;
        }
        
        let opMediaPartsForCtx: Part[] = [];
        if (botGeminiAnalyzeOpMedia) {
            if (!currentBotOpMediaCacheRef.current || currentBotOpMediaCacheRef.current.threadId !== botThreadId || currentBotOpMediaCacheRef.current.opPostNum !== opPost.num) {
                const opMediaPartsCalc: Part[] = []; let opMediaCtxTextCalc = "";
                if (opPost.files) {
                    for (const file of opPost.files.filter(f=>f.type===1||f.type===2||f.type===4||f.type===9).slice(0, botMaxImagesToAnalyzePerPost)) {
                        try {
                            const imgUrl = `${currentDvachBaseUrl}${file.path}`;
                            const proxiedUrl = buildProxiedGetUrl(imgUrl, proxyModeForImagesGET, botCustomProxyUrlForImagesGET);
                            const imgResp = await fetch(proxiedUrl); if(!imgResp.ok) throw new Error(`Proxy fetch failed ${imgResp.status}`);
                            const blob = await imgResp.blob(); let mime = blob.type; if(!mime||!mime.startsWith('image/')) mime=file.type===1?'image/jpeg':file.type===2?'image/png':file.type===4?'image/gif':file.type===9?'image/webp':'image/jpeg';
                            const b64 = await new Promise<string>((r,j)=>{const rd=new FileReader();rd.onloadend=()=>r((rd.result as string).split(',')[1]);rd.onerror=j;rd.readAsDataURL(blob);});
                            opMediaPartsCalc.push({inlineData:{mimeType:mime,data:b64}}); opMediaCtxTextCalc += ` OP Image: '${file.name}'.`;
                        }catch(e){addAutonomousBotActivityLog(`Error processing OP image ${file.name}: ${(e as Error).message}. Proxy: ${proxyModeForImagesGET}`,'bot_warning');}
                    }
                }
                setCurrentBotOpMediaCache({threadId:botThreadId,opPostNum:opPost.num,mediaParts:opMediaPartsCalc,mediaContextText:opMediaCtxTextCalc});
                opMediaPartsForCtx = opMediaPartsCalc;
                addAutonomousBotActivityLog(`OP Media for /${botBoard}/${botThreadId} processed. ${opMediaPartsCalc.length} items. Cache updated.`, 'bot_setup');
            } else {
                 opMediaPartsForCtx = currentBotOpMediaCacheRef.current.mediaParts;
            }
        } else { if(currentBotOpMediaCacheRef.current) {setCurrentBotOpMediaCache(null); addAutonomousBotActivityLog(`OP Media cache cleared for /${botBoard}/${botThreadId} (analysis disabled).`, 'bot_setup');} }
        

        let activeConversationForCycle: GeminiDvachConversation;

        if (!workingConvoCandidate) { 
            const initialParts:Part[] = [...opMediaPartsForCtx, {text: initialContextTextForSystemMessage}];
            activeConversationForCycle = { id:currentBotTargetKeyForCycle,board:botBoard,threadId:botThreadId,triggerPostNum:opPost.num,botSystemPromptUsed:autonomousBotSystemPrompt,history:[{id:`ctx-setup-${Date.now()}`,role:'user',parts:initialParts,timestamp:Date.now()}],lastCheckedTimestamp:Date.now(),participatingPostNumbers:[opPost.num],status:'context_built',initialContext:{opPostNum:opPost.num,opPostText:initialContextTextForSystemMessage,opPostMediaParts:opMediaPartsForCtx}};
            addAutonomousBotActivityLog(`New conversation context created for /${botBoard}/${botThreadId}.`, 'bot_setup');
        } else {
            const deepCopiedConvo = JSON.parse(JSON.stringify(workingConvoCandidate)) as GeminiDvachConversation;
            activeConversationForCycle = deepCopiedConvo;

            let updatedHist = [...activeConversationForCycle.history];
            const knownPostNums = new Set([...updatedHist.map(m=>m.id.replace(/^(user-dvach-|model-reply-to-|bot-)/,'')), ...activeConversationForCycle.participatingPostNumbers]);
            const newPosts = allPostsInThread.filter(p=>p.timestamp*1000 > activeConversationForCycle.lastCheckedTimestamp && !knownPostNums.has(p.num) && (!sentMessagesRef.current.some(sm=>sm.num===p.num&&sm.isGeminiPost&&sm.board===botBoard&&sm.thread===botThreadId)||autonomousBotAllowReplyToSelf));
            if(newPosts.length > 0) addAutonomousBotActivityLog(`${newPosts.length} new posts detected in /${botBoard}/${botThreadId} since last check. Processing...`, 'bot_activity');

            newPosts.forEach(p=>{const txt=`>>${p.num}(${p.name||'A'}@${new Date(p.timestamp*1000).toLocaleTimeString()}):"${p.comment.replace(/<[^>]+>/g,'').substring(0,300)}"`;updatedHist.push({id:`user-dvach-${p.num}`,role:'user',parts:[{text:txt}],timestamp:p.timestamp*1000});if(!activeConversationForCycle.participatingPostNumbers.includes(p.num))activeConversationForCycle.participatingPostNumbers.push(p.num);});

            if(updatedHist.length > 50){ 
                const ctxMsg=updatedHist.find(m=>m.id.startsWith("ctx-setup-"));
                const otherMsgs=updatedHist.filter(m=>!m.id.startsWith("ctx-setup-"));
                updatedHist = ctxMsg ? [ctxMsg, ...otherMsgs.slice(-49)] : otherMsgs.slice(-50);
                addAutonomousBotActivityLog(`History pruned to ${updatedHist.length} messages for /${botBoard}/${botThreadId}.`, 'bot_setup');
            }
            activeConversationForCycle.history = updatedHist;
            if(activeConversationForCycle.initialContext) { 
                activeConversationForCycle.initialContext.opPostMediaParts = opMediaPartsForCtx;
            }
        }

        if (autonomousBotReplyMode === 'random_in_thread') {
            const eligiblePostsForReply = allPostsInThread.filter(p =>
                p.num !== opPost.num && 
                (!sentMessagesRef.current.some(sm => sm.num === p.num && sm.isGeminiPost && sm.board === botBoard && sm.thread === botThreadId) || autonomousBotAllowReplyToSelf) && 
                !BUMP_KEYWORDS.some((kw: string) => p.comment.toLowerCase().includes(kw)) && 
                !activeConversationForCycle.participatingPostNumbers.includes(p.num) 
            );

            if(eligiblePostsForReply.length > 0){
                const targetPost = eligiblePostsForReply[Math.floor(Math.random()*eligiblePostsForReply.length)];
                addAutonomousBotActivityLog(`Bot selected >>${targetPost.num} on /${botBoard}/${botThreadId} for random reply.`, 'bot_activity');
                setAutonomousBotStatus(`Generating reply to >>${targetPost.num}...`);

                let histForGemini = [...activeConversationForCycle.history];
                let currentUserMsgTxt = `Replying to >>${targetPost.num} (originally by ${targetPost.name||'Anonymous'}): "${targetPost.comment.replace(/<[^>]+>/g,'').substring(0,500)}"`;
                const currentUserMsgParts:Part[]=[];

                if(botAnalyzesImagesInTriggerPosts && targetPost.files){
                    for(const f of targetPost.files.filter(fl=>(fl.type===1||fl.type===2||fl.type===4||fl.type===9)).slice(0, botMaxImagesToAnalyzePerPost)){ 
                        try{
                            const iu=`${currentDvachBaseUrl}${f.path}`;const piu=buildProxiedGetUrl(iu, proxyModeForImagesGET, botCustomProxyUrlForImagesGET);
                            const ir=await fetch(piu);if(!ir.ok)throw new Error(`Proxy fetch failed ${ir.status}`);
                            const b=await ir.blob();let mt=b.type;if(!mt||!mt.startsWith('image/'))mt=f.type===1?'image/jpeg':f.type===2?'image/png':f.type===4?'image/gif':f.type===9?'image/webp':'image/jpeg';
                            const bs=await new Promise<string>((rs,rj)=>{const rdr=new FileReader();rdr.onloadend=()=>rs((rdr.result as string).split(',')[1]);rdr.onerror=rj;rdr.readAsDataURL(b);});
                            currentUserMsgParts.push({inlineData:{mimeType:mt,data:bs}}); currentUserMsgTxt+=` Image content associated with post: '${f.name}'.`;
                        }catch(e){addAutonomousBotActivityLog(`Error processing bot target image ${f.name}: ${(e as Error).message}. Proxy: ${proxyModeForImagesGET}`,'bot_warning');}
                    }
                }
                currentUserMsgParts.push({text:currentUserMsgTxt+`\n\nInstruction: Generate a suitable reply based on the conversation history and this target post. Your response must be in JSON format: { "replyText": "your reply content here" }. Ensure the reply content itself does not include the '>>${targetPost.num}' quote, as it will be added automatically.`});
                histForGemini.push({id:`user-dvach-${targetPost.num}`,role:'user',parts:currentUserMsgParts,timestamp:Date.now()});

                const botGenConfig:GenerateContentParameters['config']={
                    systemInstruction: autonomousBotSystemPrompt,
                    temperature:0.85, topK:50, topP:0.95,
                    maxOutputTokens: AUTONOMOUS_BOT_MAX_OUTPUT_TOKENS,
                    responseMimeType:"application/json",
                    responseSchema:{type:"object",properties:{replyText:{type:"string",description:"The bot's reply text, excluding the initial >>POST_NUM quote."}},required:["replyText"]},
                    safetySettings: botGeminiSafetySettings.map(s=>({category:s.category as any,threshold:s.threshold as any}))
                };
                if(autonomousBotDisableThinking) botGenConfig.thinkingConfig={thinkingBudget:0};

                const geminiResponse = await ai.models.generateContent({model:settings.geminiTextModel,contents:histForGemini,config:botGenConfig});
                const textToParseForJson = geminiResponse.text;

                if(typeof textToParseForJson === 'string'){
                    const parsedResult = parseGeminiJsonResponse<BotReplySchema>(textToParseForJson);
                    let botReplyText: string | undefined;

                    if (parsedResult) {
                        if (!Array.isArray(parsedResult)) { 
                            botReplyText = parsedResult.replyText;
                        } else if (parsedResult.length > 0) { 
                            addAutonomousBotActivityLog('Bot Gemini JSON response was an array, taking first element.', 'bot_activity', parsedResult);
                            botReplyText = parsedResult[0].replyText;
                        }
                    }

                    if(botReplyText){
                        let rawReplyContent = botReplyText.trim();
                        const quotePatternForReply = new RegExp(`^>>${targetPost.num}\\s*\\n?`, 'i');
                        rawReplyContent = rawReplyContent.replace(quotePatternForReply, '').trim();

                        const finalCommentToPost = `>>${targetPost.num}\n${rawReplyContent}`;
                        const replyDelayMs = Math.floor(Math.random()*(autonomousBotMaxReplyDelayMs-autonomousBotMinReplyDelayMs+1))+autonomousBotMinReplyDelayMs;
                        addAutonomousBotActivityLog(`Bot generated reply for >>${targetPost.num}. Waiting ${replyDelayMs}ms before posting... Text: "${rawReplyContent.substring(0,70)}..."`, 'bot_activity');
                        await new Promise(resolve => window.setTimeout(resolve,replyDelayMs));
                        
                        lastBotPostAttemptTimeRef.current = Date.now(); // Update before attempt

                        let fileToPostForBot:File|null=null;
                        if(botGeminiReplyWithGeneratedImage){
                             try{const imgPromptForBot=`Image context: "${rawReplyContent.substring(0,150)}"`;const igr=await ai.models.generateImages({model:settings.geminiImageModel,prompt:imgPromptForBot,config:{numberOfImages:1,outputMimeType:'image/jpeg'}});if(igr.generatedImages?.[0]?.image?.imageBytes)fileToPostForBot=await base64ToFile(igr.generatedImages[0].image.imageBytes,`bot_img_${Date.now()}.jpg`,igr.generatedImages[0].image.mimeType||'image/jpeg');}catch(eImg){addLog(`Bot image gen error: ${(eImg as Error).message}`,'bot_warning');}
                        }
                        try {
                            const newPostNumByBot = await commonPostToDvach(finalCommentToPost, fileToPostForBot, false, botBoard, botThreadId, userAgent, dvachSessionCookies, targetPost.num);
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
                                throw pe; 
                            }
                        }
                    } else {addAutonomousBotActivityLog(`Error parsing Gemini JSON for bot reply to >>${targetPost.num} or replyText missing: ${textToParseForJson.substring(0,200)}`,'bot_warning');}
                } else {addAutonomousBotActivityLog(`Gemini response had no text for bot reply to >>${targetPost.num}: ${JSON.stringify(geminiResponse).substring(0,200)}`,'bot_warning');}
            } else { addAutonomousBotActivityLog("No eligible posts found for random reply in this cycle for /"+botBoard+"/"+botThreadId+".", 'bot_activity');}
        } else if (autonomousBotReplyMode === 'replies_to_bot') {
            addAutonomousBotActivityLog("Bot Mode 'replies_to_bot' is a placeholder and not yet fully implemented. Skipping active reply generation.", 'bot_warning');
        } else if (autonomousBotReplyMode === 'bump') {
            addAutonomousBotActivityLog("Bot Mode 'bump' is a placeholder and not yet fully implemented. Skipping active reply generation.", 'bot_warning');
        }
        activeConversationForCycle.lastCheckedTimestamp=Date.now();
         setGeminiDvachConversations(prevConvos => {
            const newConvos = new Map(prevConvos);
            newConvos.set(currentBotTargetKeyForCycle, activeConversationForCycle);
            return newConvos;
        });
        setAutonomousBotStatus(`Waiting (${settings.autonomousBotCycleIntervalSeconds}s) /${botBoard}/${botThreadId}`); 
        addAutonomousBotActivityLog("Bot cycle finished for /"+botBoard+"/"+botThreadId+".", 'bot_activity');

    } catch (cycleError) {
        const error = cycleError as Error;
        addAutonomousBotActivityLog(`Critical error in bot cycle for /${botBoard}/${botThreadId}: ${error.message}`, 'bot_error', error);
        setAutonomousBotStatus(`Error in cycle: ${error.message.substring(0,50)}...`);
         setGeminiDvachConversations(prevConvos => {
            const newConvos = new Map(prevConvos);
            const convoToUpdate = newConvos.get(currentBotTargetKeyForCycle);
            if (convoToUpdate) { 
                newConvos.set(currentBotTargetKeyForCycle, { ...convoToUpdate, lastCheckedTimestamp: Date.now(), status: 'error' as const });
            } 
            return newConvos;
        });
    }
}, [ // Dependencies for useCallback
    ai, dvachSessionCookies, currentDvachBaseUrl,
    autonomousBotTargetBoard, autonomousBotTargetThreadId, proxyModeForGET, customProxyUrlForGET, userAgent,
    botGeminiAnalyzeOpMedia, proxyModeForImagesGET, botCustomProxyUrlForImagesGET, botMaxImagesToAnalyzePerPost,
    autonomousBotSystemPrompt, autonomousBotReplyMode, botGeminiReplyWithGeneratedImage,
    autonomousBotMinReplyDelayMs, autonomousBotMaxReplyDelayMs, autonomousBotDisableThinking,
    botGeminiSafetySettings, autonomousBotInitialContextScope, autonomousBotFullThreadContextMaxChars,
    botAnalyzesImagesInTriggerPosts, autonomousBotAllowReplyToSelf,
    autonomousBotMinPostIntervalSeconds, // New setting
    addAutonomousBotActivityLog, setAutonomousBotStatus,
    setGeminiDvachConversations, setCurrentBotOpMediaCache, // Stable setters
    addLog, commonPostToDvach, autonomousBotActive, settings.autonomousBotCycleIntervalSeconds 
  ]
);


useEffect(() => {
    if (!autonomousBotActive) {
        if (autonomousBotIntervalRef.current) {
            window.clearInterval(autonomousBotIntervalRef.current);
            autonomousBotIntervalRef.current = null;
        }
        setAutonomousBotStatus("Inactive - Bot Stopped");
        setCurrentBotOpMediaCache(null); 
        return;
    }

    let reason = "";
    if (!ai) reason = "Gemini AI not initialized";
    else if (!dvachSessionCookies?.passcode_auth) reason = "Not logged into Dvach";
    else if (!settings.autonomousBotTargetBoard.trim() || !settings.autonomousBotTargetThreadId.trim()) reason = "Target board/thread not set";

    if (reason) {
        setAutonomousBotStatus(`Inactive - ${reason}`);
        if (autonomousBotActive) addLog(`Autonomous bot cannot run: ${reason}. Stopping.`, "bot_error");
        setAutonomousBotActive(false); 
        return;
    }

    addLog(`Autonomous bot starting... Interval: ${settings.autonomousBotCycleIntervalSeconds}s. Min Post Interval: ${settings.autonomousBotMinPostIntervalSeconds}s`, 'bot_setup');
    setAutonomousBotStatus("Active - Preparing initial cycle...");
    const botTaskId = addTask('bot_cycle', `Bot on ${currentDvachBaseUrl}/${settings.autonomousBotTargetBoard}/${settings.autonomousBotTargetThreadId}`, () => {
        setAutonomousBotActive(false); 
        addLog("Autonomous bot explicitly stopped via task manager.", "bot_setup");
    });

    const initialTimeout = window.setTimeout(() => { if (autonomousBotActive) runBotCycleCallback(); }, 3000); 
    const intervalId = window.setInterval(() => {
        if (autonomousBotActive) {
            runBotCycleCallback();
        } else if(autonomousBotIntervalRef.current) { 
            window.clearInterval(autonomousBotIntervalRef.current);
            removeTask(botTaskId); 
            autonomousBotIntervalRef.current = null;
        }
    }, settings.autonomousBotCycleIntervalSeconds * 1000);
    autonomousBotIntervalRef.current = intervalId;

    return () => { 
        window.clearTimeout(initialTimeout);
        if (autonomousBotIntervalRef.current) window.clearInterval(autonomousBotIntervalRef.current);
        removeTask(botTaskId); 
        autonomousBotIntervalRef.current = null;
        addLog("Autonomous bot interval stopped due to cleanup.", "bot_setup"); 
    };
}, [
    autonomousBotActive, 
    runBotCycleCallback, 
    settings.autonomousBotCycleIntervalSeconds, 
    settings.autonomousBotMinPostIntervalSeconds,
    settings.autonomousBotTargetBoard, 
    settings.autonomousBotTargetThreadId, 
    ai, 
    dvachSessionCookies, 
    addLog, 
    addTask, 
    removeTask,
    currentDvachBaseUrl
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

  const readFileContent = useCallback(async (file: File): Promise<string[]> => {
    addLog(`Reading file: ${file.name}`, 'info');
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        resolve(text.split(/\r\n|\n/).filter(line => line.trim() !== '')); 
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
    _setter?: React.Dispatch<React.SetStateAction<string[]>> 
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      try {
        const content = await readFileContent(file);
        addLog(`File "${file.name}" uploaded and processed. Lines: ${content.length}`, 'success');
      } catch (error) {
        addLog(`Failed to process file "${file.name}"`, 'error', error);
      }
    }
    if(event.target) event.target.value = ''; 
  }, [readFileContent, addLog]);

  const codeEditorStyle: React.CSSProperties = {
    fontFamily: 'monospace',
    fontSize: '0.875rem', 
    backgroundColor: settings.theme === 'dark' || (settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches) ? '#1f2937' : '#f9fafb', 
    color: settings.theme === 'dark' || (settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches) ? '#d1d5db' : '#111827', 
    border: `1px solid ${settings.theme === 'dark' || (settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches) ? '#4b5563' : '#e5e7eb'}`, 
    borderRadius: '0.375rem', 
    padding: '0.5rem', 
    minHeight: '100px',
    lineHeight: '1.5',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
  };

  const handleAnalyzeThreadFromUrl = async () => {
    addLog(`Analyzing thread from URL: ${threadUrl}`, 'info');
    if (!threadUrl.trim()) {
        addLog("URL is empty.", 'warning');
        return;
    }

    try {
        const url = new URL(threadUrl);
        const pathParts = url.pathname.split('/').filter(part => part.length > 0);

        if (pathParts.length >= 3 && pathParts[1] === 'res') {
            const board = pathParts[0];
            const threadId = pathParts[2].split('.')[0];

            if (board && threadId && /^\d+$/.test(threadId)) {
                addLog(`Parsed from URL: Board='${board}', Thread ID='${threadId}'`, 'info');
                setCurrentBoard(board);
                setCurrentThreadId(threadId);
                handleUpdateSettings({ board: board, threadId: threadId });
                await handleLoadThread(false, board, threadId);
                setThreadUrl('');
            } else {
                throw new Error("Could not extract a valid board and numeric thread ID.");
            }
        } else {
            throw new Error("URL path does not match expected format (.../board/res/thread.html).");
        }
    } catch (error) {
        const errorMessage = (error as Error).message;
        addLog(`Failed to parse or analyze thread from URL: ${errorMessage}`, 'error', error);
        setFetchError(`Invalid URL format: ${errorMessage}`);
    }
  };

  // --- RENDER FUNCTIONS ---
  const renderDvachPostCard = (post: DvachPost, index: number) => {
     const boardIdentifier = currentBoard.trim(); 
     const threadIdentifier = currentThreadId.trim(); 

     const sentMessageData = sentMessages.find(m => m.num === post.num && m.board === boardIdentifier && m.thread === threadIdentifier);
     const isMyPost = !!sentMessageData;
     const isGeminiPostByBot = sentMessageData?.isGeminiPost || false;
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
          <a href={`${currentDvachBaseUrl}/${boardIdentifier}/res/${threadIdentifier}.html#${post.num}`} target="_blank" rel="noopener noreferrer" className="hover:underline text-blue-500 dark:text-blue-400" onClick={(e) => { e.preventDefault(); document.getElementById(`post-${post.num}`)?.scrollIntoView({behavior: 'smooth'}); }} aria-label={`Link to post number ${post.num} on Dvach`}>{post.num}</a>
          {isMyPost && <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full bg-green-200 dark:bg-green-700 text-green-800 dark:text-green-100">You</span>}
          {isGeminiPostByBot && <IconSparkles className="inline-block ml-1 h-3 w-3 text-purple-500" title="Posted by Gemini"/>}
        </span>
        <time dateTime={new Date(post.timestamp * 1000).toISOString()}>{new Date(post.timestamp * 1000).toLocaleString()}</time>
      </div>
      {post.subject && <h4 className="font-semibold text-sm mb-1 text-gray-800 dark:text-gray-200">{post.subject}</h4>}
      {post.files && post.files.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {post.files.map((file, fileIndex) => {
            const fileUrl = `${currentDvachBaseUrl}${file.path}`;
            const thumbUrl = `${currentDvachBaseUrl}${file.thumbnail}`;
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
        <button onClick={() => handleManualGeminiReplyToDvachPost(post)} disabled={geminiLoading || !ai || !dvachSessionCookies?.passcode_auth || !boardIdentifier || !threadIdentifier} className="btn-primary px-3 py-1 text-xs flex items-center" title={!ai ? "Gemini AI not initialized" : !dvachSessionCookies?.passcode_auth ? "Login to Dvach to reply" : "Reply with Gemini"} aria-label={`Reply to post ${post.num} with Gemini`}>
          <IconSparkles className="mr-1 h-4 w-4"/> Reply with Gemini
        </button>
      </div>
    </div>
  )};

  const renderDvachBotPanel = () => (
    <div className="space-y-6 p-4 md:p-6 bg-white dark:bg-gray-800 shadow-lg rounded-lg">
      <h2 className="text-2xl font-semibold text-blue-600 dark:text-blue-400 border-b pb-2 border-gray-300 dark:border-gray-700">Ручные операции</h2>

      <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-md">
        <h3 className="text-xl font-medium mb-3 text-gray-700 dark:text-gray-300">Анализ треда по URL</h3>
        <div className="flex items-center space-x-2">
          <input
            type="text"
            placeholder="Введите URL треда (.html или .json)"
            value={threadUrl}
            onChange={(e) => setThreadUrl(e.target.value)}
            className="input-field w-full"
          />
          <button
            onClick={() => handleAnalyzeThreadFromUrl()}
            disabled={!threadUrl.trim()}
            className="btn-primary flex items-center"
          >
            <IconSearch className="mr-2 h-5 w-5"/> Анализировать
          </button>
        </div>
      </div>

      <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-md">
        <h3 className="text-xl font-medium mb-3 text-gray-700 dark:text-gray-300">Генерация изображений</h3>
        <div className="flex items-center space-x-2">
          <input
            type="text"
            placeholder="Введите промпт для генерации изображения"
            value={imagePrompt}
            onChange={(e) => setImagePrompt(e.target.value)}
            className="input-field w-full"
          />
          <button
            onClick={handleGenerateImage}
            disabled={isGeneratingImage || !imagePrompt.trim()}
            className="btn-primary flex items-center"
          >
            {isGeneratingImage ? <IconRefresh className="mr-2 h-5 w-5 animate-spin"/> : <IconSparkles className="mr-2 h-5 w-5"/>}
            {isGeneratingImage ? 'Генерация...' : 'Генерировать'}
          </button>
        </div>
        {generatedImage && (
          <div className="mt-4">
            <img src={generatedImage} alt="Generated" className="rounded-lg shadow-md" />
          </div>
        )}
      </div>

      <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-md">
        <h3 className="text-xl font-medium mb-3 text-gray-700 dark:text-gray-300">Генерация аудио</h3>
        <div className="flex items-center space-x-2">
          <input
            type="text"
            placeholder="Введите текст для генерации аудио"
            value={audioPrompt}
            onChange={(e) => setAudioPrompt(e.target.value)}
            className="input-field w-full"
          />
          <button
            onClick={handleGenerateAudio}
            disabled={isGeneratingAudio || !audioPrompt.trim()}
            className="btn-primary flex items-center"
          >
            {isGeneratingAudio ? <IconRefresh className="mr-2 h-5 w-5 animate-spin"/> : <IconSparkles className="mr-2 h-5 w-5"/>}
            {isGeneratingAudio ? 'Генерация...' : 'Генерировать'}
          </button>
        </div>
        {generatedAudio && (
          <div className="mt-4">
            <audio controls src={generatedAudio} className="w-full" />
          </div>
        )}
        <div className="mt-4">
          <button
            onClick={handleGenerateVideo}
            disabled={isGeneratingVideo || !generatedImage || !generatedAudio}
            className="btn-primary flex items-center"
          >
            {isGeneratingVideo ? <IconRefresh className="mr-2 h-5 w-5 animate-spin"/> : <IconSparkles className="mr-2 h-5 w-5"/>}
            {isGeneratingVideo ? 'Генерация видео...' : 'Сгенерировать видео'}
          </button>
        </div>
        {generatedVideo && (
          <div className="mt-4">
            <video controls src={generatedVideo} className="w-full rounded-lg shadow-md" />
          </div>
        )}
      </div>

      <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-md">
        <h3 className="text-lg font-medium mb-2 text-gray-700 dark:text-gray-300">Аутентификация</h3>
        {dvachSessionCookies?.passcode_auth ? (
            <div className="flex items-center space-x-3"> <IconUserCircle className="h-6 w-6 text-green-500" /> <span className="text-sm text-green-700 dark:text-green-300">Вы вошли в систему.</span> <button onClick={handleDvachLogout} className="btn-danger px-3 py-1 text-xs flex items-center"><IconLogout className="mr-1 h-4 w-4"/> Выйти</button> </div>
        ) : (
            <div className="flex items-center space-x-3"> <IconAlertTriangle className="h-6 w-6 text-yellow-500" /> <span className="text-sm text-yellow-700 dark:text-yellow-300">Вы не вошли в систему.</span> <button onClick={handleDvachLogin} disabled={isDvachLoggingIn || !settings.purchasedPasscode} className="btn-primary px-3 py-1 text-xs flex items-center">{isDvachLoggingIn ? <IconRefresh className="mr-1 h-4 w-4 animate-spin"/> : <IconLogin className="mr-1 h-4 w-4"/>}{isDvachLoggingIn ? 'Вход...' : 'Войти'}</button> </div>
        )}
        {!settings.purchasedPasscode && !dvachSessionCookies?.passcode_auth && <p className="text-xs text-red-500 mt-1">Пасскод не установлен в настройках.</p>}
         {fetchError && (fetchError.includes("Login failed") || fetchError.includes("Dvach login error") || fetchError.includes("session cookie")) && <p className="text-xs text-red-500 mt-1">{fetchError}</p>}
      </div>

      <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-md">
        <h3 className="text-xl font-medium mb-3 text-gray-700 dark:text-gray-300">Ручной постинг</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
            <div><label htmlFor="manualBoard" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Доска:</label><input id="manualBoard" type="text" value={currentBoard} onChange={e => setCurrentBoard(e.target.value)} className="input-field"/></div>
            <div><label htmlFor="manualThreadId" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Тред (0 для нового):</label><input id="manualThreadId" type="text" value={currentThreadId} onChange={e => setCurrentThreadId(e.target.value)} className="input-field"/></div>
        </div>
        <textarea aria-label="Post comment" className="input-field w-full" rows={3} placeholder="Комментарий..." value={postText} onChange={(e) => setPostText(e.target.value)}/>
        <div className="flex items-center space-x-4 mt-2">
          <label className="text-sm text-gray-700 dark:text-gray-300">Прикрепить изображение:<input type="file" onChange={(e) => setPostFile(e.target.files?.[0] || null)} className="input-file ml-2"/>{postFile && <span className="text-xs ml-2">{postFile.name} (<button onClick={() => setPostFile(null)} className="text-red-500 hover:underline">x</button>)</span>}</label>
          <label className="checkbox-label"><input type="checkbox" checked={postUseSage} onChange={(e) => setPostUseSage(e.target.checked)} className="checkbox-field"/>Sage</label>
          <button onClick={handleSimplePost} disabled={isPosting || !dvachSessionCookies?.passcode_auth || !currentBoard.trim() || !postText.trim()} className="btn-primary flex items-center" title={!dvachSessionCookies?.passcode_auth ? "Войдите, чтобы постить" : (!currentBoard.trim() || !postText.trim()) ? "Требуется доска/комментарий" : "Отправить"}>
            {isPosting ? <IconRefresh className="mr-2 h-5 w-5 animate-spin"/> : <IconSend className="mr-2 h-5 w-5"/>}{isPosting ? 'Отправка...' : 'Отправить'}
          </button>
        </div>
        {postActivityLog.length > 0 && <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 space-y-0.5">{postActivityLog.map((log,i) => <p key={i} className="truncate">{log}</p>)}</div>}
        {fetchError && (fetchError.includes("Failed to post") || fetchError.includes("Board and Post Comment")) && <p className="text-xs text-red-500 mt-1">{fetchError}</p>}
      </div>

      <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-md">
        <div className="flex justify-between items-center mb-3">
            <h3 className="text-xl font-medium text-gray-700 dark:text-gray-300">Просмотр треда и ответ с Gemini</h3>
            <button onClick={() => handleLoadThread(false)} disabled={isFetchingThread || !currentBoard.trim() || !currentThreadId.trim()} className="btn-secondary flex items-center" title={(!currentBoard.trim() || !currentThreadId.trim()) ? "Введите доску/тред" : "Загрузить посты"}>
                <IconRefresh className={`mr-2 h-5 w-5 ${isFetchingThread ? 'animate-spin' : ''}`}/> Загрузить тред
            </button>
        </div>
        {(!currentBoard.trim() || !currentThreadId.trim()) && <p className="text-sm text-yellow-600 dark:text-yellow-400">Введите доску и ID треда для просмотра постов.</p>}
        {fetchError && !fetchError.includes("Login failed") && !fetchError.includes("Failed to post") && <p className="text-sm text-red-600 dark:text-red-400">Ошибка: {fetchError}</p>}
        <div ref={threadPostsContainerRef} className="max-h-[600px] overflow-y-auto bg-gray-100 dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700">
            {isFetchingThread && <p className="text-center p-4">Загрузка треда...</p>}
            {!isFetchingThread && currentFetchedDvachPosts.length === 0 && (!currentBoard.trim() || !currentThreadId.trim() || fetchError) && <p className="text-center p-4 text-gray-500 dark:text-gray-400">Нет постов. Введите доску/ID треда и загрузите.</p>}
            {!isFetchingThread && currentFetchedDvachPosts.length === 0 && currentBoard.trim() && currentThreadId.trim() && !fetchError && <p className="text-center p-4 text-gray-500 dark:text-gray-400">Тред пуст или произошла ошибка (см. логи).</p>}
            {currentFetchedDvachPosts.map(renderDvachPostCard)}
        </div>
      </div>
    </div>
  );

  const renderAutonomousBotControlPanel = () => (
    <div className="space-y-6 p-4 md:p-6 bg-white dark:bg-gray-800 shadow-lg rounded-lg">
      <div className="flex justify-between items-center border-b pb-2 border-gray-300 dark:border-gray-700">
        <h2 className="text-2xl font-semibold text-purple-600 dark:text-purple-400">Управление автономным ботом Gemini</h2>
        <div className="flex items-center space-x-2">
            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${autonomousBotActive ? 'bg-green-200 text-green-800 dark:bg-green-700 dark:text-green-100' : 'bg-red-200 text-red-800 dark:bg-red-700 dark:text-red-100'}`}>{autonomousBotActive ? 'Активен' : 'Неактивен'}</span>
            <button onClick={() => setAutonomousBotActive(prev => !prev)} disabled={!ai || !dvachSessionCookies?.passcode_auth || !settings.autonomousBotTargetBoard.trim() || !settings.autonomousBotTargetThreadId.trim()} className={`btn ${autonomousBotActive ? 'btn-danger' : 'btn-success'} flex items-center`} title={!ai?"Gemini не инициализирован":!dvachSessionCookies?.passcode_auth?"Не выполнен вход":(!settings.autonomousBotTargetBoard.trim()||!settings.autonomousBotTargetThreadId.trim())?"Цель бота не установлена":autonomousBotActive?"Остановить бота":"Запустить бота"}>
                {autonomousBotActive ? <IconPlayerStop className="mr-2 h-5 w-5"/> : <IconPlayerPlay className="mr-2 h-5 w-5"/>}
                {autonomousBotActive ? 'Остановить' : 'Запустить'}
            </button>
        </div>
      </div>
      <div className="p-4 border rounded-md border-gray-200 dark:border-gray-700 space-y-3">
        <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">Настройки цели бота</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">Также доступно во вкладке "Настройки".</p>
        <div><label htmlFor="botPanelTargetBoard" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Целевая доска:</label><input id="botPanelTargetBoard" type="text" value={settings.autonomousBotTargetBoard} onChange={e => handleUpdateSettings({ autonomousBotTargetBoard: e.target.value })} className="input-field mt-1"/></div>
        <div><label htmlFor="botPanelTargetThreadId" className="block text-sm font-medium text-gray-700 dark:text-gray-300">ID целевого треда:</label><input id="botPanelTargetThreadId" type="text" value={settings.autonomousBotTargetThreadId} onChange={e => handleUpdateSettings({ autonomousBotTargetThreadId: e.target.value })} className="input-field mt-1"/></div>
      </div>
       {(!ai || !dvachSessionCookies?.passcode_auth || !settings.autonomousBotTargetBoard.trim() || !settings.autonomousBotTargetThreadId.trim()) && <div className="alert-warning"><p className="font-semibold">Бот не может запуститься:</p><ul className="list-disc list-inside ml-4 text-xs">{!ai && <li>Gemini AI не инициализирован.</li>}{!dvachSessionCookies?.passcode_auth && <li>Не выполнен вход в Двач.</li>}{(!settings.autonomousBotTargetBoard.trim() || !settings.autonomousBotTargetThreadId.trim()) && <li>Не указана целевая доска/тред для бота.</li>}</ul></div>}
      <div className="p-4 border rounded-md border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium mb-2 text-gray-700 dark:text-gray-300">Статус и активность бота</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Статус: <span className="font-semibold">{autonomousBotStatus}</span></p>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Цель: <span className="font-semibold">{currentDvachBaseUrl}/{settings.autonomousBotTargetBoard.trim()||"[NS]"}/{settings.autonomousBotTargetThreadId.trim()||"[NS]"}</span> | Режим: <span className="font-semibold">{settings.autonomousBotReplyMode.replace(/_/g,' ')}</span> | Интервал: <span className="font-semibold">{settings.autonomousBotCycleIntervalSeconds}с</span> | Мин. интервал постов: <span className="font-semibold">{settings.autonomousBotMinPostIntervalSeconds}с</span></p>
        {activeTasks.filter(t=>t.type==='bot_cycle').length > 0 && <p className="text-xs text-green-600 dark:text-green-400">ID активной задачи бота: {activeTasks.find(t=>t.type==='bot_cycle')?.id}</p>}
        <div className="max-h-60 overflow-y-auto bg-gray-50 dark:bg-gray-900 p-2 rounded border border-gray-200 dark:border-gray-700">{autonomousBotActivityLog.length===0 && <p className="text-xs text-gray-500 dark:text-gray-400 text-center">Нет активности бота.</p>}{autonomousBotActivityLog.map((log,idx) => (<p key={idx} className="text-xs text-gray-700 dark:text-gray-300 mb-0.5 font-mono">{log}</p>))}</div>
      </div>
      <div className="p-4 border rounded-md border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium mb-2 text-gray-700 dark:text-gray-300">Активные диалоги Gemini-Двач (Бот)</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Контексты диалогов бота. Нажмите на ID для просмотра деталей в логах.</p>
        <div className="max-h-[500px] overflow-y-auto space-y-2">
            {geminiDvachConversations.size===0?(<p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">Нет контекстов бота.</p>):(Array.from(geminiDvachConversations.values()).sort((a,b)=>(b?.lastCheckedTimestamp||0)-(a?.lastCheckedTimestamp||0)).map(c=>(c&&c.id?(<details key={c.id} className="p-2.5 mb-2 border rounded-lg bg-gray-50 dark:bg-gray-700/60 border-gray-200 dark:border-gray-600 text-xs shadow-sm hover:shadow-md transition-shadow"><summary className="cursor-pointer font-medium text-gray-700 dark:text-gray-300 select-none">ID: <button onClick={()=>addLog("Детали диалога:",'info',c)} className="text-indigo-500 hover:underline truncate" title="Детали в логах">{c.id}</button><span className="ml-2 text-gray-500 dark:text-gray-400">(Статус:{c.status}|Последний ответ:&gt;&gt;{c.lastBotReplyNum||'N/A'}|История:{c.history?.length||0})</span></summary><div className="mt-2 space-y-1.5 pl-2 border-l-2 border-gray-300 dark:border-gray-500"><p><strong>Триггер/Начало:</strong><span className="font-semibold">&gt;&gt;{c.triggerPostNum}</span> на <span className="font-semibold">/{c.board}/{c.threadId}</span> {c.isBotSeedConversation?"(Начало бота)":""}</p><p><strong>Последняя проверка:</strong>{new Date(c.lastCheckedTimestamp).toLocaleTimeString()}</p>{c.initialContext&&(<details className="mt-1 text-xs"><summary className="cursor-pointer text-gray-600 dark:text-gray-400 italic">Начальный контекст...</summary><div className="pl-3 pt-1 space-y-0.5">{c.initialContext.opPostText&&<p><strong>Начальный контекст треда:</strong>"{c.initialContext.opPostText.substring(0,200)}..."</p>}{c.initialContext.opPostMediaParts&&c.initialContext.opPostMediaParts.length>0&&<p><strong>Медиа ОП-поста:</strong>{c.initialContext.opPostMediaParts.length} элемент(ов).</p>}</div></details>)}{c.history&&c.history.length>0&&(<details className="mt-1 text-xs"><summary className="cursor-pointer text-gray-600 dark:text-gray-400 italic">Последние {Math.min(5,c.history.length)} сообщений...</summary><div className="pl-3 pt-1 space-y-0.5 max-h-32 overflow-y-auto">{c.history.slice(-5).map((m,i)=>(<p key={i} className="truncate"><strong className="capitalize">{m.role}:</strong>{(m.parts[0]?.text||'[Нетекст/Медиа]').substring(0,100)}...</p>))}</div></details>)}</div></details>):null)))}
        </div>
        <button onClick={()=>{setGeminiDvachConversations(new Map());addLog("Все контексты диалогов бота очищены.","bot_warning");}} className="mt-4 btn-danger flex items-center text-xs" disabled={geminiDvachConversations.size===0}><IconTrash className="mr-1.5 h-4 w-4"/>Очистить контексты</button>
      </div>
    </div>
  );

  const handleProxyModeChange = (
    e: React.ChangeEvent<HTMLSelectElement>, 
    type: 'GET' | 'ImagesGET'
  ) => {
    const newModeValue = e.target.value;
    let newMode: ProxyModeForGET;
    let newCustomUrl = type === 'GET' ? settings.customProxyUrlForGET : settings.customProxyUrlForImagesGET;

    if (newModeValue === "USER_X2U_KEYED") {
      newMode = 'custom_general_param';
      newCustomUrl = PROXY_URL_X2U_KEYED_BASE;
    } else if (newModeValue === "USER_CORS_ANYWHERE_OFFICIAL") {
      newMode = 'custom_cors_anywhere';
      newCustomUrl = PROXY_URL_CORS_ANYWHERE_OFFICIAL;
    } else {
      newMode = newModeValue as ProxyModeForGET;
    }
    
    if (type === 'GET') {
      handleUpdateSettings({ proxyModeForGET: newMode, customProxyUrlForGET: newCustomUrl });
    } else {
      handleUpdateSettings({ proxyModeForImagesGET: newMode, customProxyUrlForImagesGET: newCustomUrl });
    }
  };
  
  const renderSettingsPanel = () => {
    const currentProcessEnvApiKey = process.env.API_KEY;
    return (
     <div className="space-y-6 p-4 md:p-6 bg-white dark:bg-gray-800 shadow-lg rounded-lg">
      <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-300 border-b pb-2 border-gray-300 dark:border-gray-700">Настройки приложения</h2>
      <details open className="p-3 border rounded-md border-gray-200 dark:border-gray-600">
        <summary className="text-lg font-medium text-gray-700 dark:text-gray-300 cursor-pointer select-none">Общие настройки Двача</summary>
        <div className="mt-3 space-y-3">
            <div><label htmlFor="settingsBoard" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Доска по умолчанию (ручные операции):</label><input id="settingsBoard" type="text" value={settings.board} onChange={e=>handleUpdateSettings({board:e.target.value})} className="input-field mt-1"/></div>
            <div><label htmlFor="settingsThreadId" className="block text-sm font-medium text-gray-700 dark:text-gray-300">ID треда по умолчанию (ручные операции):</label><input id="settingsThreadId" type="text" value={settings.threadId} onChange={e=>handleUpdateSettings({threadId:e.target.value})} className="input-field mt-1"/></div>
            <div>
              <label htmlFor="settingsDomainUsageMode" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Базовый домен Двача (для URL на клиенте):</label>
              <select id="settingsDomainUsageMode" value={settings.dvachDomainUsageMode} onChange={e => handleUpdateSettings({ dvachDomainUsageMode: e.target.value as 'predefined' | 'custom' })} className="input-field mt-1">
                <option value="predefined">Использовать предустановленный домен</option>
                <option value="custom">Использовать свой домен</option>
              </select>
            </div>
            {settings.dvachDomainUsageMode === 'predefined' && (
              <div>
                <label htmlFor="settingsDvachBaseDomainIndex" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Предустановленный домен:</label>
                <select id="settingsDvachBaseDomainIndex" value={settings.dvachBaseDomainIndex} onChange={e => handleUpdateSettings({ dvachBaseDomainIndex: parseInt(e.target.value) })} className="input-field mt-1">
                  {DVACH_DOMAINS.map((domain, index) => (
                    <option key={index} value={index}>{domain}</option>
                  ))}
                </select>
              </div>
            )}
            {settings.dvachDomainUsageMode === 'custom' && (
              <div>
                <label htmlFor="settingsCustomDvachDomain" className="block text-sm font-medium text-gray-700 dark:text-gray-300">URL своего домена Двача:</label>
                <input id="settingsCustomDvachDomain" type="url" placeholder="например, https://2ch.life" value={settings.customDvachDomain} onChange={e => handleUpdateSettings({ customDvachDomain: e.target.value })} className="input-field mt-1" />
                 <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Убедитесь, что это валидный базовый URL (например, https://custom.domain). Косая черта в конце не нужна.</p>
              </div>
            )}
             <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Текущий используемый домен: <strong className="text-indigo-500">{currentDvachBaseUrl}</strong>. Примечание: серверные функции для постинга/входа все равно используют 2ch.hk.</p>
            <div><label htmlFor="settingsPasscode" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Купленный пасскод:</label><input id="settingsPasscode" type="password" value={settings.purchasedPasscode} onChange={e=>handleUpdateSettings({purchasedPasscode:e.target.value})} autoComplete="new-password" placeholder="Ваш пасскод Двача" className="input-field mt-1"/></div>
            <div><label htmlFor="settingsUserAgent" className="block text-sm font-medium text-gray-700 dark:text-gray-300">User Agent:</label><input id="settingsUserAgent" type="text" value={settings.userAgent} onChange={e=>handleUpdateSettings({userAgent:e.target.value})} className="input-field mt-1"/><button onClick={()=>handleUpdateSettings({userAgent:generateUserAgent()})} className="btn-secondary text-xs mt-1">Сгенерировать новый</button></div>
             <div className="mt-2"><label className="block text-sm font-medium text-gray-400 dark:text-gray-500">(Отладка) Загрузка файла:</label><input type="file" onChange={(e)=>handleFileUpload(e)} className="input-file-sm"/></div>
        </div>
      </details>
      <details className="p-3 border rounded-md border-gray-200 dark:border-gray-600">
        <summary className="text-lg font-medium text-gray-700 dark:text-gray-300 cursor-pointer select-none">CORS прокси (GET-запросы клиента)</summary>
        <div className="mt-3 space-y-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">Для GET-запросов на стороне клиента (например, изображений или данных треда, если не используется serverless). POST-запросы на Двач используют серверные функции.</p>
            <div>
                <label htmlFor="settingsProxyModeForGET" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Прокси для данных треда:</label>
                <select id="settingsProxyModeForGET" value={settings.proxyModeForGET === 'custom_general_param' && settings.customProxyUrlForGET === PROXY_URL_X2U_KEYED_BASE ? 'USER_X2U_KEYED' : (settings.proxyModeForGET === 'custom_cors_anywhere' && settings.customProxyUrlForGET === PROXY_URL_CORS_ANYWHERE_OFFICIAL ? 'USER_CORS_ANYWHERE_OFFICIAL' : settings.proxyModeForGET)} onChange={(e) => handleProxyModeChange(e, 'GET')} className="input-field mt-1">
                    <option value="vercel_serverless">Vercel Serverless (цель: 2ch.hk)</option>
                    <option value="USER_X2U_KEYED">X2U с ключом (пользовательский)</option>
                    <option value="USER_CORS_ANYWHERE_OFFICIAL">Официальный CORS Anywhere (пользовательский)</option>
                    <option value="custom_cors_anywhere">Стиль CORS Anywhere (свой)</option>
                    <option value="custom_go_x2u">Стиль go.x2u.in (свой)</option>
                    <option value="custom_codetabs">Стиль CodeTabs (свой)</option>
                    <option value="custom_general_prefix">Общий префикс-прокси (свой)</option>
                    <option value="custom_general_param">Общий прокси с параметром (свой)</option>
                    <option value="none">Без прокси</option>
                </select>
                {(settings.proxyModeForGET !=='vercel_serverless' && settings.proxyModeForGET !=='none') && (<input type="text" placeholder="URL своего прокси для данных треда" value={settings.customProxyUrlForGET} onChange={e=>handleUpdateSettings({customProxyUrlForGET:e.target.value})} className="input-field mt-1"/>)}
            </div>
            <div>
                <label htmlFor="settingsProxyModeForImagesGET" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Прокси для изображений/медиа:</label>
                <select id="settingsProxyModeForImagesGET" value={settings.proxyModeForImagesGET === 'custom_general_param' && settings.customProxyUrlForImagesGET === PROXY_URL_X2U_KEYED_BASE ? 'USER_X2U_KEYED' : (settings.proxyModeForImagesGET === 'custom_cors_anywhere' && settings.customProxyUrlForImagesGET === PROXY_URL_CORS_ANYWHERE_OFFICIAL ? 'USER_CORS_ANYWHERE_OFFICIAL' : settings.proxyModeForImagesGET)} onChange={(e) => handleProxyModeChange(e, 'ImagesGET')} className="input-field mt-1">
                    <option value="USER_X2U_KEYED">X2U с ключом (пользовательский)</option>
                    <option value="USER_CORS_ANYWHERE_OFFICIAL">Официальный CORS Anywhere (пользовательский)</option>
                    <option value="custom_codetabs">Стиль CodeTabs (по умолчанию для изображений)</option>
                    <option value="custom_cors_anywhere">Стиль CORS Anywhere (свой)</option>
                    <option value="custom_go_x2u">Стиль go.x2u.in (свой)</option>
                    <option value="custom_general_prefix">Общий префикс-прокси (свой)</option>
                    <option value="custom_general_param">Общий прокси с параметром (свой)</option>
                    <option value="none">Без прокси</option>
                </select>
                {settings.proxyModeForImagesGET !=='none' && (<input type="text" placeholder="URL своего прокси для изображений" value={settings.customProxyUrlForImagesGET} onChange={e=>handleUpdateSettings({customProxyUrlForImagesGET:e.target.value})} className="input-field mt-1"/>)}
            </div>
        </div>
      </details>
      <details open className="p-3 border rounded-md border-gray-200 dark:border-gray-600">
        <summary className="text-lg font-medium text-gray-700 dark:text-gray-300 cursor-pointer select-none">Настройки Gemini API и моделей</summary>
        <div className="mt-3 space-y-3">
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Источник Gemini API ключа:</label><select aria-label="Источник Gemini API ключа" value={settings.geminiApiKeySource} onChange={e=>handleUpdateSettings({geminiApiKeySource:e.target.value as 'env'|'user'})} className="input-field mt-1"><option value="env">Env API_KEY {currentProcessEnvApiKey?`(Обнаружен: ${currentProcessEnvApiKey.substring(0,4)}...${currentProcessEnvApiKey.substring(currentProcessEnvApiKey.length-4)})`:"(Не обнаружен)"}</option><option value="user">Ручной ввод</option></select>{settings.geminiApiKeySource==='user'&&(<input aria-label="User Gemini API Key" type="password" placeholder="Gemini API ключ" value={settings.userGeminiApiKey} onChange={e=>handleUpdateSettings({userGeminiApiKey:e.target.value})} autoComplete="new-password" className="input-field mt-1"/>)}</div>
            <div className="p-2 border-t border-gray-200 dark:border-gray-600"><p className="text-sm text-gray-600 dark:text-gray-400">Безопасность: {settings.geminiSafetySettings.map(s=>`${s.category.replace("HARM_CATEGORY_","")}:${s.threshold.replace("BLOCK_","")}`).join(', ')}. (UI для этого в разработке)</p></div>
            <div>
              <label htmlFor="settingsGeminiModel" className="block text-sm font-medium">Текстовая модель:</label>
              <select
                id="settingsGeminiModel"
                value={settings.geminiTextModel}
                onChange={e => handleUpdateSettings({geminiTextModel: e.target.value})}
                className="input-field mt-1 w-full"
              >
                {SUPPORTED_GEMINI_TEXT_MODELS.map(model => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="settingsGeminiImageModel" className="block text-sm font-medium">Модель генерации изображений:</label>
              <select
                id="settingsGeminiImageModel"
                value={settings.geminiImageModel}
                onChange={e => handleUpdateSettings({geminiImageModel: e.target.value})}
                className="input-field mt-1 w-full"
              >
                {SUPPORTED_GEMINI_IMAGE_MODELS.map(model => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </select>
            </div>
            <label className="checkbox-label"><input type="checkbox" checked={settings.geminiAnalyzeOpMedia} onChange={e=>handleUpdateSettings({geminiAnalyzeOpMedia:e.target.checked})} className="checkbox-field"/>Gemini: Анализировать медиа в ОП-постах (ручной ответ)</label>
            <label className="checkbox-label"><input type="checkbox" checked={settings.geminiAnalyzeAnonMedia} onChange={e=>handleUpdateSettings({geminiAnalyzeAnonMedia:e.target.checked})} className="checkbox-field"/>Gemini: Анализировать медиа в постах анонов (ручной ответ)</label>
            <label className="checkbox-label"><input type="checkbox" checked={settings.geminiReplyWithGeneratedImage} onChange={e=>handleUpdateSettings({geminiReplyWithGeneratedImage:e.target.checked})} className="checkbox-field"/>Gemini: Генерировать изображение с ответами (ручной и бот)</label>
            <div>
              <label htmlFor="settingsGeminiAudioModel" className="block text-sm font-medium">Модель генерации аудио:</label>
              <select
                id="settingsGeminiAudioModel"
                value={settings.geminiAudioModel}
                onChange={e => handleUpdateSettings({geminiAudioModel: e.target.value})}
                className="input-field mt-1 w-full"
              >
                {SUPPORTED_GEMINI_AUDIO_MODELS.map(model => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </select>
            </div>
            <div><label htmlFor="maxImagesToAnalyzePerPost" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Макс. изображений для анализа/поста:</label><input id="maxImagesToAnalyzePerPost" type="number" min="0" max="5" value={settings.maxImagesToAnalyzePerPost} onChange={e=>handleUpdateSettings({maxImagesToAnalyzePerPost:parseInt(e.target.value)})} className="input-field mt-1"/></div>
            <h4 className="text-md font-medium pt-2 text-gray-700 dark:text-gray-300">Настройки модели Gemini (ручные ответы)</h4>
            <div><label htmlFor="geminiSystemInstructionManual" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Системная инструкция (ручные ответы):</label><textarea id="geminiSystemInstructionManual" value={settings.geminiSystemInstruction} onChange={e=>handleUpdateSettings({geminiSystemInstruction:e.target.value})} rows={3} style={codeEditorStyle} className="mt-1 w-full"/></div>
            <div className="grid grid-cols-2 gap-4">
                <div><label htmlFor="geminiTemp" className="text-sm text-gray-700 dark:text-gray-300">Температура:</label><input id="geminiTemp" type="number" step="0.05" min="0" max="1" value={settings.geminiTemperature} onChange={e=>handleUpdateSettings({geminiTemperature:parseFloat(e.target.value)})} className="input-field-sm w-full"/></div>
                <div><label htmlFor="geminiTopP" className="text-sm text-gray-700 dark:text-gray-300">Top P:</label><input id="geminiTopP" type="number" step="0.05" min="0" max="1" value={settings.geminiTopP} onChange={e=>handleUpdateSettings({geminiTopP:parseFloat(e.target.value)})} className="input-field-sm w-full"/></div>
                <div><label htmlFor="geminiTopK" className="text-sm text-gray-700 dark:text-gray-300">Top K:</label><input id="geminiTopK" type="number" step="1" min="1" value={settings.geminiTopK} onChange={e=>handleUpdateSettings({geminiTopK:parseInt(e.target.value)})} className="input-field-sm w-full"/></div>
                <div><label htmlFor="geminiMaxOut" className="text-sm text-gray-700 dark:text-gray-300">Макс. выходных токенов:</label><input id="geminiMaxOut" type="number" step="64" min="64" value={settings.geminiMaxOutputTokens} onChange={e=>handleUpdateSettings({geminiMaxOutputTokens:parseInt(e.target.value)})} className="input-field-sm w-full"/></div>
            </div>
            <div><label htmlFor="geminiMime" className="block text-sm text-gray-700 dark:text-gray-300">MIME-тип ответа (ручной):</label><select id="geminiMime" value={settings.geminiResponseMimeType} onChange={e=>handleUpdateSettings({geminiResponseMimeType:e.target.value as 'text/plain'|'application/json'})} className="input-field mt-1 w-full"><option value="text/plain">text/plain</option><option value="application/json">application/json</option></select></div>
            <label className="checkbox-label"><input type="checkbox" checked={settings.useThinkingBudget} onChange={e=>handleUpdateSettings({useThinkingBudget:e.target.checked})} className="checkbox-field"/>Использовать бюджет на обдумывание (ручной)</label>
            {settings.useThinkingBudget && <div><label htmlFor="geminiThinkBudget" className="text-sm text-gray-700 dark:text-gray-300">Бюджет на обдумывание (ручной, 0 для откл.):</label><input id="geminiThinkBudget" type="number" step="1" min="0" value={settings.geminiThinkingBudget} onChange={e=>handleUpdateSettings({geminiThinkingBudget:parseInt(e.target.value)})} className="input-field-sm w-full"/></div>}
        </div>
      </details>
      <details open className="p-3 border rounded-md border-gray-200 dark:border-gray-600">
        <summary className="text-lg font-medium text-gray-700 dark:text-gray-300 cursor-pointer select-none">Настройки автономного бота</summary>
        <div className="mt-3 space-y-3">
            <div><label htmlFor="botSystemPrompt" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Системный промпт бота (персона и стиль):</label><textarea id="botSystemPrompt" value={settings.autonomousBotSystemPrompt} onChange={e=>handleUpdateSettings({autonomousBotSystemPrompt:e.target.value})} rows={4} style={codeEditorStyle} className="mt-1 w-full"/></div>
            <label className="checkbox-label"><input type="checkbox" checked={settings.botAnalyzesImagesInTriggerPosts} onChange={e=>handleUpdateSettings({botAnalyzesImagesInTriggerPosts:e.target.checked})} className="checkbox-field"/>Бот: Анализировать изображения в триггер-постах</label>
            <div><label htmlFor="botReplyMode" className="block text-sm text-gray-700 dark:text-gray-300">Режим ответов бота:</label><select id="botReplyMode" value={settings.autonomousBotReplyMode} onChange={e=>handleUpdateSettings({autonomousBotReplyMode:e.target.value as AutonomousBotReplyMode})} className="input-field mt-1 w-full"><option value="random_in_thread">Случайный пост в треде</option><option value="replies_to_bot">Ответы на посты бота (в разработке)</option><option value="bump">Бапм</option></select></div>
            <div><label htmlFor="botInterval" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Интервал циклов бота (секунды):</label><input id="botInterval" type="number" min="10" value={settings.autonomousBotCycleIntervalSeconds} onChange={e=>handleUpdateSettings({autonomousBotCycleIntervalSeconds:parseInt(e.target.value)})} className="input-field mt-1"/></div>
            <div><label htmlFor="botMinPostInterval" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Мин. интервал постов (секунды, для всего бота):</label><input id="botMinPostInterval" type="number" min="10" value={settings.autonomousBotMinPostIntervalSeconds} onChange={e=>handleUpdateSettings({autonomousBotMinPostIntervalSeconds:parseInt(e.target.value)})} className="input-field mt-1"/></div>
            <div className="grid grid-cols-2 gap-4"><div><label htmlFor="botMinReplyDelay" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Мин. задержка ответа (мс):</label><input id="botMinReplyDelay" type="number" min="0" step="500" value={settings.autonomousBotMinReplyDelayMs} onChange={e=>handleUpdateSettings({autonomousBotMinReplyDelayMs:parseInt(e.target.value)})} className="input-field mt-1"/></div><div><label htmlFor="botMaxReplyDelay" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Макс. задержка ответа (мс):</label><input id="botMaxReplyDelay" type="number" min="0" step="500" value={settings.autonomousBotMaxReplyDelayMs} onChange={e=>handleUpdateSettings({autonomousBotMaxReplyDelayMs:parseInt(e.target.value)})} className="input-field mt-1"/></div></div>
            <label className="checkbox-label"><input type="checkbox" checked={settings.autonomousBotDisableThinking} onChange={e=>handleUpdateSettings({autonomousBotDisableThinking:e.target.checked})} className="checkbox-field"/>Бот: Отключить обдумывание (скорость/ниже качество)</label>
            <label className="checkbox-label"><input type="checkbox" checked={settings.autonomousBotAllowReplyToSelf} onChange={e=>handleUpdateSettings({autonomousBotAllowReplyToSelf:e.target.checked})} className="checkbox-field"/>Бот: Разрешить отвечать на свои посты</label>
            <div><label htmlFor="botInitialContextScope" className="block text-sm text-gray-700 dark:text-gray-300">Бот: Область начального контекста треда:</label><select id="botInitialContextScope" value={settings.autonomousBotInitialContextScope} onChange={e=>handleUpdateSettings({autonomousBotInitialContextScope:e.target.value as AutonomousBotInitialContextScope})} className="input-field mt-1 w-full"><option value="op_only">Только ОП-пост</option><option value="full_thread">Сводка по всему треду</option></select></div>
            {settings.autonomousBotInitialContextScope==='full_thread'&&(<div><label htmlFor="botFullContextChars" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Бот: Макс. символов контекста треда (0=без огр.):</label><input id="botFullContextChars" type="number" min="0" step="1000" value={settings.autonomousBotFullThreadContextMaxChars} onChange={e=>handleUpdateSettings({autonomousBotFullThreadContextMaxChars:parseInt(e.target.value)})} className="input-field mt-1"/></div>)}
        </div>
      </details>
      <p className="text-xs text-gray-500 dark:text-gray-400">Настройки сохраняются автоматически.</p>
    </div>
  )};

  const renderLogsPanel = () => (
    <div className="space-y-6 p-4 md:p-6 bg-white dark:bg-gray-800 shadow-lg rounded-lg">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-300 border-b pb-2 border-gray-300 dark:border-gray-700 flex-grow">Журнал событий</h2>
        <button onClick={()=>setLogs([])} className="btn-danger text-xs flex items-center" title="Очистить логи" disabled={logs.length===0}><IconTrash className="mr-1 h-4 w-4"/>Очистить логи</button>
      </div>
      <div className="max-h-[600px] overflow-y-auto bg-gray-50 dark:bg-gray-900 p-3 rounded border border-gray-200 dark:border-gray-700">
        {logs.length===0 && <p className="text-center text-gray-500 dark:text-gray-400">Логов пока нет.</p>}
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
            <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors" aria-label={`Переключить тему (текущая: ${settings.theme})`} title={`Сменить тему. Текущая: ${settings.theme}.`}>
              <ThemeIconComponent className="h-6 w-6" />
            </button>
          </div>
        </div>
      </header>
      <nav className="bg-gray-50 dark:bg-gray-800 border-b border-t border-gray-200 dark:border-gray-700 sticky top-[72px] z-40"> {/* Assuming header height is approx 72px */}
        <div className="container mx-auto flex justify-center sm:justify-start flex-wrap">
          {[
            { id: 'dvach', label: 'Ручные операции', icon: IconCpu },
            { id: 'bot_control', label: 'Автономный бот', icon: IconMessageChat },
            { id: 'settings', label: 'Настройки', icon: IconSettings },
            { id: 'logs', label: 'Логи', icon: IconTerminal },
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
        <p className="text-xs text-gray-500 dark:text-gray-400">Интерфейс Dvach Gemini Bot - Версия {APP_VERSION} - Используйте ответственно.</p>
      </footer>
    </div>
  );
};

export default App;