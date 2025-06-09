
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { GoogleGenAI, GenerateContentResponse, Content, Part, Chat as GeminiChat, GenerateContentParameters } from "@google/genai";
import { AppSettings, LogEntry, DvachPost, SentMessageInfo, ChatMessage, ActiveTask, GeminiFeature, CustomGenerateContentResponse, GroundingChunk, GeneratedImage, DvachThread, GeminiDvachConversation, DvachFile } from './types';
import { DVACH_DOMAINS, DEFAULT_APP_SETTINGS, APP_SETTINGS_KEY, SENT_MESSAGES_KEY, GEMINI_TEXT_MODEL, GEMINI_IMAGE_MODEL, GEMINI_DVACH_CONVERSATIONS_KEY, DEFAULT_CORS_ANYWHERE_PROXY, THREAD_CACHE_DURATION_MS } from './constants';
import { dvachPost, getDvachThread, obtainAuthToken, sha256File } from './services/dvachService';
import { IconSettings, IconTerminal, IconMessageCircle, IconCloudUpload, IconSend, IconTrash, IconSun, IconMoon, IconCpu, IconSparkles, IconFileText, IconClock, IconSearch, IconPlayerPlay, IconPlayerStop, IconFileImport, IconPhoto, IconMessageChat, IconListNumbers, IconAlertTriangle, IconRefresh, IconEye } from './components/Icons';
import { generateUserAgent } from './utils/userAgentGenerator';

const processEnvApiKey = process.env.API_KEY || "";


const App: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(() => {
    const savedSettings = localStorage.getItem(APP_SETTINGS_KEY);
    return savedSettings ? { ...DEFAULT_APP_SETTINGS, ...JSON.parse(savedSettings) } : DEFAULT_APP_SETTINGS;
  });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [apiKey, setApiKey] = useState<string>('');
  const [ai, setAi] = useState<GoogleGenAI | null>(null);
  
  const [activeTab, setActiveTab] = useState<'dvach' | 'gemini' | 'settings' | 'logs'>('dvach');

  const [dvachAuthToken, setDvachAuthToken] = useState<string | null>(null);
  const [sentMessages, setSentMessages] = useState<SentMessageInfo[]>(() => {
    const saved = localStorage.getItem(SENT_MESSAGES_KEY);
    return saved ? JSON.parse(saved) : [];
  });
  
  const [activeTasks, setActiveTasks] = useState<ActiveTask[]>([]);
  const [userAgent, setUserAgent] = useState<string>('');
  const [showCorsWarning, setShowCorsWarning] = useState<boolean>(false);
  const [lastFetchOperationFailed, setLastFetchOperationFailed] = useState<string | null>(null);


  // Dvach Bot state
  const [postComment, setPostComment] = useState<string>('');
  const [postFile, setPostFile] = useState<File | null>(null);
  const [postUseSage, setPostUseSage] = useState<boolean>(false);
  const [keyword, setKeyword] = useState<string>('');
  const [replyMessage, setReplyMessage] = useState<string>('');
  const [operationInterval, setOperationInterval] = useState<number | undefined>(undefined);
  
  const [slovaFileContent, setSlovaFileContent] = useState<string[]>([]);
  const [otvetyFileContent, setOtvetyFileContent] = useState<string[]>([]);
  const [spiskokFileContent, setSpiskokFileContent] = useState<string[]>([]);
  const [imageFiles, setImageFiles] = useState<File[]>([]);

  // Dvach Thread Viewer State
  const [currentFetchedDvachPosts, setCurrentFetchedDvachPosts] = useState<DvachPost[]>([]);
  const [isFetchingThread, setIsFetchingThread] = useState<boolean>(false);
  const threadPostsContainerRef = useRef<HTMLDivElement>(null);
  const [threadCache, setThreadCache] = useState<Map<string, { data: DvachThread, timestamp: number }>>(new Map());


  // Gemini specific state
  const [geminiPrompt, setGeminiPrompt] = useState<string>('');
  const [geminiSystemInstruction, setGeminiSystemInstruction] = useState<string>('');
  const [geminiTemperature, setGeminiTemperature] = useState<number>(0.9);
  const [geminiTopP, setGeminiTopP] = useState<number>(1);
  const [geminiTopK, setGeminiTopK] = useState<number>(32);
  const [geminiMaxOutputTokens, setGeminiMaxOutputTokens] = useState<number>(2048);
  const [geminiResponseMimeType, setGeminiResponseMimeType] = useState<string>('text/plain');
  const [useThinkingBudget, setUseThinkingBudget] = useState<boolean>(false);
  const [geminiThinkingBudget, setGeminiThinkingBudget] = useState<number>(0); 

  const [geminiChatMessages, setGeminiChatMessages] = useState<ChatMessage[]>([]);
  const [currentGeminiChat, setCurrentGeminiChat] = useState<GeminiChat | null>(null);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [geminiOutput, setGeminiOutput] = useState<string | GeneratedImage[] | null>(null);
  const [geminiLoading, setGeminiLoading] = useState<boolean>(false);
  const [useSearchGrounding, setUseSearchGrounding] = useState<boolean>(false);
  const [groundingSources, setGroundingSources] = useState<GroundingChunk[]>([]);
  const [numImagesToGenerate, setNumImagesToGenerate] = useState<number>(1);
  const [imageGenPrompt, setImageGenPrompt] = useState<string>('');
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [imageForGemini, setImageForGemini] = useState<File | null>(null);

  // Gemini-Dvach Integration State
  const [geminiDvachConversations, setGeminiDvachConversations] = useState<Map<string, GeminiDvachConversation>>(() => {
    const saved = localStorage.getItem(GEMINI_DVACH_CONVERSATIONS_KEY);
    return saved ? new Map(JSON.parse(saved)) : new Map();
  });


  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info', data?: unknown) => {
    setLogs(prevLogs => [{ id: Date.now().toString(), timestamp: Date.now(), message, type, data }, ...prevLogs.slice(0, 199)]);
    if (type === 'error') console.error(message, data);
    else if (type === 'warning') console.warn(message, data);
    else console.log(message, data);
  }, []);

  const getCurrentProxyPrefix = useCallback((): string => {
    if (settings.proxyMode === 'custom' && settings.customProxyUrl) {
        let url = settings.customProxyUrl;
        if (!url.endsWith('/')) { // Убедимся, что кастомный URL прокси заканчивается слэшем, если он префиксный
            if (url.includes('?') || url.includes('#')) { // Не добавляем слэш если это полный URL с query параметрами
                // No action needed, assume it's a full URL template like some proxies require
            } else {
                 url += '/';
            }
        }
        return url;
    }
    if (settings.proxyMode === 'cors-anywhere') {
        return DEFAULT_CORS_ANYWHERE_PROXY; // 'https://cors-anywhere.com/'
    }
    return ''; // 'none' mode or invalid custom URL
  }, [settings.proxyMode, settings.customProxyUrl]);


 const handleFetchError = useCallback((error: Error, operation: string, targetUrlConcept?: string) => {
    let errorMessage = `Failed to ${operation}: ${error.message}`;
    const usingCorsAnywhere = settings.proxyMode === 'cors-anywhere' && getCurrentProxyPrefix() === DEFAULT_CORS_ANYWHERE_PROXY;
    const usingCustomProxy = settings.proxyMode === 'custom' && settings.customProxyUrl;
    const noProxy = settings.proxyMode === 'none';
    const isPostOperation = operation.toLowerCase().includes('post');

    if (error.message.toLowerCase().includes('failed to fetch') || error instanceof TypeError || error.message.toLowerCase().includes('network error')) {
      setShowCorsWarning(true);
      setLastFetchOperationFailed(operation); 
      
      errorMessage += `. This indicates a network connectivity issue or a security restriction by your browser (CORS).`;
      
      if (isPostOperation) {
          errorMessage += `\n\nPOST operations now use an internal serverless function (/api/post). If this 'Failed to fetch' occurred for a POST, it means the app couldn't reach '/api/post'. Check your network and ensure the serverless function is deployed and accessible.`;
      } else if (usingCorsAnywhere) {
        errorMessage += `\n\nIMPORTANT: You are using the public 'cors-anywhere' proxy ('${DEFAULT_CORS_ANYWHERE_PROXY}'). This 'Failed to fetch' error likely means THE PROXY SERVER ITSELF is down, blocking, rate-limiting (e.g., ~50 requests/hour), or your network is preventing access to it. Public proxies can be unreliable and may require 'opt-in' (see cors-anywhere.herokuapp.com).`;
        errorMessage += `\n\nSuggestions for 'cors-anywhere':`;
        errorMessage += `\n- Verify '${DEFAULT_CORS_ANYWHERE_PROXY}' is operational by testing it directly with a simple GET request.`;
        errorMessage += `\n- Wait if it's a rate limit issue, or consider switching to a 'Custom Proxy' or 'No Proxy' (if you have other means to handle CORS like a browser extension for development) in Settings. For POSTs, this app now uses a serverless function, not this proxy.`;
      } else if (usingCustomProxy) {
        errorMessage += `\n\nIMPORTANT: You are using a Custom Proxy URL ('${settings.customProxyUrl}') for GET requests. This 'Failed to fetch' error likely means YOUR CUSTOM PROXY is down, misconfigured, or your network is preventing access to it. For POSTs, this app now uses a serverless function.`;
        errorMessage += `\n\nSuggestions for Custom Proxy:`;
        errorMessage += `\n- Verify your custom proxy server is running and accessible.`;
        errorMessage += `\n- Check its logs for errors.`;
      } else if (noProxy) {
         errorMessage += `\n\nYou are not using a proxy via this application's settings for GET requests. This 'Failed to fetch' to Dvach is very likely due to CORS restrictions by the Dvach server. Direct browser interaction is usually not possible. For POSTs, this app now uses a serverless function.`;
         errorMessage += `\n\nSuggestions for 'No Proxy' mode (for GET requests):`;
         errorMessage += `\n- Enable a proxy in this app's Settings (e.g., 'cors-anywhere' or your own 'Custom Proxy').`;
         errorMessage += `\n- Alternatively, use a browser extension that handles CORS (for development only, with caution).`;
      } else { 
         errorMessage += `\n\nUnable to determine proxy configuration for GET requests. POSTs use a serverless function. Check settings.`;
      }
      errorMessage += `\n\nPlease check your browser's Developer Console (Network and Console tabs) for more details. The console may show detailed logs from 'dvachService.ts' about the request being attempted (target: ${targetUrlConcept || 'N/A'}).`;
      
      addLog(errorMessage, 'error', { 
        originalError: error.toString(), 
        operation, 
        targetUrlConcept,
        proxyInUseForGET: isPostOperation ? 'N/A (Serverless for POST)' : (getCurrentProxyPrefix() || 'None'),
        proxyModeForGET: isPostOperation ? 'N/A' : settings.proxyMode
      });
    } else {
      if (lastFetchOperationFailed) setLastFetchOperationFailed(null); 
      addLog(errorMessage, 'error', { originalError: error.toString(), operation, targetUrlConcept });
    }
  }, [addLog, lastFetchOperationFailed, settings.proxyMode, settings.customProxyUrl, getCurrentProxyPrefix]);


  useEffect(() => {
    const storedUserAgent = localStorage.getItem('dvachUserAgent');
    if (storedUserAgent) setUserAgent(storedUserAgent);
    else {
      const newAgent = generateUserAgent();
      setUserAgent(newAgent);
      localStorage.setItem('dvachUserAgent', newAgent);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(APP_SETTINGS_KEY, JSON.stringify(settings));
    if (settings.theme === 'dark') {
        document.documentElement.classList.add('dark');
    } else if (settings.theme === 'light') {
        document.documentElement.classList.remove('dark');
    } else { // system
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, [settings]);

  useEffect(() => {
    localStorage.setItem(SENT_MESSAGES_KEY, JSON.stringify(sentMessages));
  }, [sentMessages]);

   useEffect(() => {
    localStorage.setItem(GEMINI_DVACH_CONVERSATIONS_KEY, JSON.stringify(Array.from(geminiDvachConversations.entries())));
  }, [geminiDvachConversations]);

  useEffect(() => {
    const keyToUse = settings.geminiApiKeySource === 'env' ? processEnvApiKey : settings.userGeminiApiKey;
    if (keyToUse) {
      setApiKey(keyToUse);
      try {
        const genAI = new GoogleGenAI({ apiKey: keyToUse });
        setAi(genAI);
        addLog('Gemini API initialized successfully.', 'success');
      } catch (error) {
        addLog(`Failed to initialize Gemini API: ${(error as Error).message}`, 'error', error);
        setAi(null);
      }
    } else {
      setAi(null);
      if (settings.geminiApiKeySource === 'user' && !settings.userGeminiApiKey) addLog('User API key is not set for Gemini.', 'warning');
      else if (settings.geminiApiKeySource === 'env' && !processEnvApiKey) addLog('Environment API_KEY is not set (or not accessible) for Gemini.', 'warning');
    }
  }, [settings.geminiApiKeySource, settings.userGeminiApiKey, addLog]);

  const handleUpdateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  const currentDvachDomain = useMemo(() => DVACH_DOMAINS[settings.currentDomainIndex], [settings.currentDomainIndex]);

 const getValidAuthToken = useCallback(async (forceNew = false): Promise<string> => {
    if (dvachAuthToken && !forceNew) return dvachAuthToken;
    
    const operationDescription = `obtain Dvach auth token from ${currentDvachDomain}`;
    // obtainAuthToken still uses proxy for GET/POST to Dvach's auth endpoint
    const proxyForAuth = getCurrentProxyPrefix(); 
    addLog(`Attempting to ${operationDescription}... Proxy for auth: ${proxyForAuth || 'None'}`, 'dvach');
    const targetUrlConcept = `${currentDvachDomain}/user/passlogin`; 
    try {
      const token = await obtainAuthToken(currentDvachDomain, settings.passcode, userAgent, proxyForAuth);
      setDvachAuthToken(token); 
      addLog(`Successfully attempted Dvach auth token acquisition using ${currentDvachDomain}. Browser should now have the necessary cookie.`, 'success');
      setShowCorsWarning(false); 
      setLastFetchOperationFailed(null);
      return token;
    } catch (error) {
      handleFetchError(error as Error, operationDescription, targetUrlConcept);
      setDvachAuthToken(null);
      
      if ( ((error as Error).message.toLowerCase().includes('failed to fetch') || 
            (error as Error).message.toLowerCase().includes('network error') ||
             error instanceof TypeError) &&
           !(error as Error).message.includes("auth token acquisition unclear") 
         ) {
          const nextDomainIndex = (settings.currentDomainIndex + 1) % DVACH_DOMAINS.length;
          addLog(`Authentication failed with ${currentDvachDomain}. Attempting next domain: ${DVACH_DOMAINS[nextDomainIndex]}`, 'warning');
          setSettings(prev => ({ ...prev, currentDomainIndex: nextDomainIndex }));
      }
      throw error; 
    }
  }, [dvachAuthToken, currentDvachDomain, settings.passcode, userAgent, addLog, settings.currentDomainIndex, handleFetchError, getCurrentProxyPrefix]);


  const handleSimplePost = async (commentOverride?: string, fileOverride?: File | null, parentOverride?: string) => {
    const effectiveComment = commentOverride || postComment;
    const effectiveFile = fileOverride === undefined ? postFile : fileOverride; 
    // parentOverride is the specific post being replied to.
    // settings.threadId is the general thread context from settings.
    const effectiveParentForDvachApi = parentOverride || settings.threadId; // This is what goes to dvachPost's 'parent' param.

    if (!effectiveComment.trim()) {
      addLog('Post comment cannot be empty.', 'error');
      return;
    }
    const operationDescription = `post to /${settings.board}/${effectiveParentForDvachApi || 'new thread'} on ${currentDvachDomain} (via /api/post)`;
    addLog(`Attempting to ${operationDescription}: "${effectiveComment.substring(0,50)}..."`, 'dvach');
    const targetUrlConcept = `/api/post (targeting Dvach: ${currentDvachDomain}/user/posting)`;
    try {
      const token = await getValidAuthToken(); // Ensures auth cookie is likely set
      // dvachPost now uses /api/post and doesn't need proxyPrefix or userAgent directly for its fetch
      const result = await dvachPost(
        currentDvachDomain, // Still passed for context, though /api/post might hardcode target
        token, // This is the passcode_auth
        settings.board, 
        settings.threadId, // Overall thread context from settings
        effectiveComment, 
        userAgent, // Still passed, though /api/post might set its own UA
        effectiveFile, 
        parentOverride, // Specific post num being replied to (undefined if not a direct reply)
        postUseSage
      );
      addLog(`Post successful (via /api/post)! Num: ${result.num}`, 'success', result);
      setShowCorsWarning(false);
      setLastFetchOperationFailed(null);
      
      let fileHash;
      if (effectiveFile) fileHash = await sha256File(effectiveFile);

      const newSentMessage: SentMessageInfo = {
        num: result.num.toString(), timestamp: Date.now(), comment: effectiveComment,
        board: settings.board, thread: settings.threadId, file_hash: fileHash, 
        parent: parentOverride || settings.threadId // Log the parent it was intended for
      };
      setSentMessages(prev => [...prev, newSentMessage]);
      
      if (!commentOverride) setPostComment(''); 
      if (fileOverride === undefined) setPostFile(null); 

      return result.num.toString(); 
    } catch (error) {
      // Check if it's a "Failed to fetch" specifically for /api/post
      if (((error as Error).message.toLowerCase().includes('failed to fetch') ||
           (error as Error).message.toLowerCase().includes('network error') ||
           error instanceof TypeError) &&
          !lastFetchOperationFailed // Avoid double-logging if getValidAuthToken failed first
         ) {
         handleFetchError(error as Error, operationDescription, targetUrlConcept);
      } else if (!((error as Error).message.includes('obtain Dvach auth token'))) { // Avoid double log if auth failed
         addLog(`Failed to post (via /api/post): ${(error as Error).message}`, 'error', error);
      }
      throw error; 
    }
  };


const fetchCurrentDvachThread = useCallback(async () => {
    if (!settings.board || !settings.threadId) {
      addLog("Board and Thread ID must be set in settings to fetch thread posts.", "warning");
      setCurrentFetchedDvachPosts([]);
      return;
    }

    const cacheKey = `${currentDvachDomain}/${settings.board}/${settings.threadId}`; 
    const cachedEntry = threadCache.get(cacheKey);

    if (cachedEntry && (Date.now() - cachedEntry.timestamp < THREAD_CACHE_DURATION_MS)) {
      addLog(`Using APP cached thread data for ${cacheKey}.`, 'info');
      setCurrentFetchedDvachPosts(cachedEntry.data.threads?.[0]?.posts || []);
      if (threadPostsContainerRef.current) {
        threadPostsContainerRef.current.scrollTop = 0;
      }
      return;
    }
    
    setIsFetchingThread(true);
    const proxyForGet = getCurrentProxyPrefix();
    const operationDescription = `fetch thread /${settings.board}/${settings.threadId} from ${currentDvachDomain}`;
    addLog(`Fetching posts for /${settings.board}/${settings.threadId} from ${currentDvachDomain}... Proxy for GET: ${proxyForGet || 'None'}`, 'dvach');
    const targetUrlConcept = `${currentDvachDomain}/${settings.board}/res/${settings.threadId}.json`;
    try {
      const threadJson = await getDvachThread(currentDvachDomain, settings.board, settings.threadId, userAgent, proxyForGet);
      const posts = threadJson?.threads?.[0]?.posts || [];
      setCurrentFetchedDvachPosts(posts);
      setThreadCache(prevCache => new Map(prevCache).set(cacheKey, { data: threadJson, timestamp: Date.now() }));
      addLog(`Successfully fetched ${posts.length} posts from ${currentDvachDomain}. App Cached.`, 'success');
      setShowCorsWarning(false);
      setLastFetchOperationFailed(null);
      if (threadPostsContainerRef.current) {
        threadPostsContainerRef.current.scrollTop = 0;
      }
    } catch (error) {
      handleFetchError(error as Error, operationDescription, targetUrlConcept);
      setCurrentFetchedDvachPosts([]); 
    } finally {
      setIsFetchingThread(false);
    }
  }, [settings.board, settings.threadId, currentDvachDomain, userAgent, addLog, handleFetchError, threadCache, getCurrentProxyPrefix, THREAD_CACHE_DURATION_MS]);


  const handleReplyWithGemini = useCallback(async (targetPost: DvachPost) => {
    if (!ai) {
      addLog('Gemini AI not initialized. Check API Key in settings.', 'error');
      return;
    }
    setGeminiLoading(true);
    addLog(`Gemini preparing reply to post >>${targetPost.num} on /${settings.board}/${settings.threadId}...`, 'gemini');

    let promptForGemini = `I am a user on an imageboard (${currentDvachDomain}/${settings.board}/${settings.threadId}). Here is a post I want to reply to:\n\n`;
    promptForGemini += `Post Number: ${targetPost.num}\n`;
    if(targetPost.name && targetPost.name !== "Anonymous") promptForGemini += `Author: ${targetPost.name}\n`;
    promptForGemini += `Timestamp: ${new Date(targetPost.timestamp * 1000).toLocaleString()}\n`;
    promptForGemini += `Comment: "${targetPost.comment}"\n\n`;
    if(targetPost.files && targetPost.files.length > 0){
        promptForGemini += `The post also included an image named "${targetPost.files[0].name}". Briefly acknowledge or react to the image if relevant, but focus on the text.\n`;
    }
    promptForGemini += `Please generate a relevant and engaging reply to this post. Maintain a casual, witty, or insightful tone typical for this imageboard. Make sure your reply directly quotes or addresses the post number >>${targetPost.num} at the beginning of your response.`;
    

    const geminiParts: Part[] = [{ text: promptForGemini }];
    
    let geminiReplyText = "";
    try {
      const response = await ai.models.generateContent({
        model: GEMINI_TEXT_MODEL,
        contents: [{role: 'user', parts: geminiParts}],
        config: { 
            temperature: settings.geminiReplyWithImage ? 0.75 : geminiTemperature, 
            topP: geminiTopP,
            topK: geminiTopK,
            maxOutputTokens: geminiMaxOutputTokens,
        } 
      });
      geminiReplyText = response.text;

      if (!geminiReplyText.trim().startsWith(`>>${targetPost.num}`)) { 
          geminiReplyText = `>>${targetPost.num}\n${geminiReplyText.trim()}`;
      }
      addLog(`Gemini generated text reply to >>${targetPost.num}: ${geminiReplyText.substring(0, 100)}...`, 'gemini');

      let finalFileToPost: File | null = null;
      if (settings.geminiReplyWithImage) {
        addLog(`Gemini attempting to generate an image for the reply...`, 'gemini');
        const imageGenEssence = geminiReplyText.substring(geminiReplyText.indexOf('\n') + 1, 300).trim(); 
        const imagePromptForImagen = `Create an image that visually represents or complements this imageboard reply: "${imageGenEssence}"`; 
        
        try {
            const imageGenResponse = await ai.models.generateImages({
              model: GEMINI_IMAGE_MODEL,
              prompt: imagePromptForImagen,
              config: { numberOfImages: 1, outputMimeType: 'image/jpeg' }
            });
            if (imageGenResponse.generatedImages && imageGenResponse.generatedImages.length > 0 && imageGenResponse.generatedImages[0].image?.imageBytes) {
              const base64Data = imageGenResponse.generatedImages[0].image.imageBytes;
              const mimeType = imageGenResponse.generatedImages[0].image.mimeType || 'image/jpeg';
              const byteCharacters = atob(base64Data);
              const byteNumbers = new Array(byteCharacters.length);
              for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
              }
              const byteArray = new Uint8Array(byteNumbers);
              finalFileToPost = new File([byteArray], `gemini_reply_image_${Date.now()}.jpg`, { type: mimeType });
              addLog(`Gemini generated an image for the reply.`, 'gemini');
            } else {
              addLog(`Gemini did not return a valid image. Posting text only. Response: ${JSON.stringify(imageGenResponse)}`, 'warning');
            }
        } catch (imgErr) {
             addLog(`Gemini image generation failed: ${(imgErr as Error).message}. Posting text only.`, 'warning', imgErr);
        }
      }

      // handleSimplePost now uses parentOverride for the specific post being replied to.
      const newPostNum = await handleSimplePost(geminiReplyText, finalFileToPost, targetPost.num.toString());
      if (newPostNum) {
          let fileHashForNewPost: string | undefined = undefined;
          if (finalFileToPost) {
            fileHashForNewPost = await sha256File(finalFileToPost);
          }
          setSentMessages(prev => {
            const updatedMessages = [...prev];
            // When adding new message, ensure parent is correctly set
            const newGeminiReplyMessage: SentMessageInfo = {
                num: newPostNum,
                timestamp: Date.now(),
                comment: geminiReplyText,
                board: settings.board,
                thread: settings.threadId, // Overall thread context
                parent: targetPost.num.toString(), // The post Gemini replied to
                isGeminiPost: true,
                geminiTriggerPostNum: targetPost.num.toString(),
                file_hash: fileHashForNewPost
            };
            // Check if a message with this num already exists (e.g. from handleSimplePost internal add)
            // This logic might be redundant if handleSimplePost reliably adds it once.
            // For now, let's assume handleSimplePost itself adds to sentMessages correctly.
            // This block here is more for potentially updating an existing entry, which is less likely.
            const existingMessageIndex = updatedMessages.findIndex(m => m.num === newPostNum && m.board === settings.board && m.thread === settings.threadId);
            if (existingMessageIndex !== -1) {
                updatedMessages[existingMessageIndex] = {
                    ...updatedMessages[existingMessageIndex], // Keep original post details if any
                    ...newGeminiReplyMessage, // Override with gemini specifics
                };
            } else {
                 // This case should be handled by handleSimplePost itself now.
                 // If not, then this add is necessary.
                 // Let's assume handleSimplePost adds it, so this might be for enriching it.
                 // The current handleSimplePost already adds a comprehensive SentMessageInfo.
                 // This block might become: find the message added by handleSimplePost and enrich it.
            }
            // To ensure the Gemini specific flags are set on the message added by handleSimplePost:
            const messageFromSimplePostIndex = updatedMessages.findIndex(m => m.num === newPostNum);
            if(messageFromSimplePostIndex !== -1) {
                updatedMessages[messageFromSimplePostIndex].isGeminiPost = true;
                updatedMessages[messageFromSimplePostIndex].geminiTriggerPostNum = targetPost.num.toString();
            }

            return updatedMessages;
          });
      }

    } catch (error) {
      addLog(`Error during Gemini reply to >>${targetPost.num}: ${(error as Error).message}`, 'error', error);
      // Let handleSimplePost's error handling manage "Failed to fetch" related to /api/post
      // Only log a generic error if it's not a fetch error already handled by handleSimplePost or getValidAuthToken
      if (!lastFetchOperationFailed && !((error as Error).message.toLowerCase().includes('failed to fetch') || (error as Error).message.toLowerCase().includes('network error') || error instanceof TypeError || (error as Error).message.includes('obtain Dvach auth token'))) {
         // This condition might be too complex, error from handleSimplePost should be sufficient.
      }
    } finally {
      setGeminiLoading(false);
    }

  }, [ai, settings, geminiTemperature, geminiTopK, geminiTopP, geminiMaxOutputTokens, handleSimplePost, addLog, currentDvachDomain, lastFetchOperationFailed]);


  // Placeholder functions
  const readFileContent = async (file: File): Promise<string[]> => { addLog('readFileContent not fully implemented.', 'warning'); return []; };
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, setter: React.Dispatch<React.SetStateAction<string[]>>) => { addLog('handleFileUpload not fully implemented.', 'warning'); };
  const handleImageFilesUpload = (event: React.ChangeEvent<HTMLInputElement>) => { addLog('handleImageFilesUpload not fully implemented.', 'warning'); };
  const addTask = (type: string, description: string, stop: () => void): string => { addLog('addTask not fully implemented.', 'warning'); return ""; };
  const removeTask = (id: string) => { addLog('removeTask not fully implemented.', 'warning'); };
  const runKeywordReply = useCallback(async () => { addLog('runKeywordReply not fully implemented.', 'warning'); }, []);
  const handleGeminiAction = useCallback(async (feature: GeminiFeature, promptText: string) => { addLog('handleGeminiAction not fully implemented.', 'warning'); }, []);
  const clearChatHistory = () => { setGeminiChatMessages([]); addLog('Gemini chat history cleared.', 'info'); };
  
  const toggleTheme = () => {
    handleUpdateSettings({ theme: settings.theme === 'dark' ? 'light' : (settings.theme === 'light' ? 'system' : 'dark') });
  };

  const ThemeIcon = useMemo(() => {
    if (settings.theme === 'dark') return IconMoon;
    if (settings.theme === 'light') return IconSun;
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    return prefersDark ? IconMoon : IconSun;
  }, [settings.theme]);


  const renderDvachPostCard = (post: DvachPost) => (
    <div key={post.num} id={`post-${post.num}`} className="p-3 mb-3 bg-gray-50 dark:bg-gray-700 rounded-lg shadow border border-gray-200 dark:border-gray-600 transition-all hover:shadow-md">
      <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400 mb-1">
        <span>
          {post.name || 'Anonymous'} - No. <a href={`#post-${post.num}`} className="hover:underline text-blue-500 dark:text-blue-400">{post.num}</a>
        </span>
        <span>{new Date(post.timestamp * 1000).toLocaleString()}</span>
      </div>
      {post.subject && <h4 className="font-semibold text-sm mb-1 text-gray-800 dark:text-gray-200">{post.subject}</h4>}
      {post.files && post.files.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {post.files.map((file, index) => (
            <a 
              key={index} 
              href={`${currentDvachDomain}${file.path}`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="block w-24 h-24"
            >
              <img 
                src={`${currentDvachDomain}${file.thumbnail}`} 
                alt={file.name} 
                className="rounded object-cover w-full h-full border border-gray-300 dark:border-gray-500 hover:opacity-80 transition-opacity"
                loading="lazy"
              />
            </a>
          ))}
        </div>
      )}
      <div 
        className="prose prose-sm dark:prose-invert max-w-none break-words" 
        dangerouslySetInnerHTML={{ __html: post.comment.replace(/&gt;&gt;(\d+)/g, `<a href="#post-$1" class="text-blue-500 hover:underline">&gt;&gt;$1</a>`) }}
      />
      <div className="mt-2 text-right">
        <button 
          onClick={() => handleReplyWithGemini(post)}
          disabled={geminiLoading || !ai || showCorsWarning} /* showCorsWarning here refers to GET issues, POST uses /api/post */
          className="px-3 py-1 text-xs bg-purple-500 hover:bg-purple-600 text-white rounded-md font-medium flex items-center shadow disabled:opacity-50 transition-colors"
          title={showCorsWarning && !lastFetchOperationFailed?.includes("post to") ? "Dvach GET interaction may be unstable. Check logs & proxy." : "Reply to this post using Gemini AI"}
        >
          <IconSparkles className="mr-1 h-4 w-4"/> Reply with Gemini
        </button>
      </div>
    </div>
  );

  const renderDvachBotPanel = () => (
    <div className="space-y-6 p-4 md:p-6 bg-white dark:bg-gray-800 shadow-lg rounded-lg">
      <h2 className="text-2xl font-semibold text-blue-600 dark:text-blue-400 border-b pb-2 border-gray-300 dark:border-gray-700">Dvach Bot Operations</h2>
      
      {showCorsWarning && (
         <div className="p-4 mb-4 bg-red-100 dark:bg-red-900 border-l-4 border-red-500 rounded-md text-red-700 dark:text-red-300 text-sm">
          <div className="flex items-start">
            <IconAlertTriangle className="h-6 w-6 mr-3 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <strong className="font-bold">Critical Network Issue (Likely CORS, Proxy, or /api/post Problem)</strong>
              <p className="mt-1">Failed to connect for operation: <span className="font-semibold">{lastFetchOperationFailed || "Unknown Operation"}</span>.</p>
              <ul className="list-disc list-inside mt-2 text-xs space-y-1">
                {lastFetchOperationFailed?.includes("post to") && <li>POST operations use an internal serverless function (/api/post). If this 'Failed to fetch' occurred for a POST, it means the app couldn't reach '/api/post'. Check your network and ensure the serverless function is deployed and accessible.</li>}
                {!lastFetchOperationFailed?.includes("post to") && settings.proxyMode === 'cors-anywhere' && <li>You are using the public 'cors-anywhere' proxy for GET requests. It might be down, rate-limiting, or blocked. Public proxies can be unreliable and may require 'opt-in'.</li>}
                {!lastFetchOperationFailed?.includes("post to") && settings.proxyMode === 'custom' && <li>You are using a Custom Proxy URL ('{settings.customProxyUrl}') for GET requests. Ensure it's running correctly.</li>}
                {!lastFetchOperationFailed?.includes("post to") && settings.proxyMode === 'none' && <li>You are not using an in-app proxy for GET requests. Dvach servers likely restrict direct browser requests (CORS).</li>}
                <li>Ensure you have a stable internet connection.</li>
                <li>Try changing the Dvach domain in Settings (for GET requests).</li>
                <li>Check the browser's Developer Console (Network and Console tabs) for detailed error messages.</li>
              </ul>
              <p className="mt-2 text-xs">Further Dvach interactions might fail until this is resolved.</p>
            </div>
          </div>
        </div>
      )}

       <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-md">
        <h3 className="text-xl font-medium mb-3 text-gray-700 dark:text-gray-300">Simple Post (via /api/post)</h3>
        <textarea 
          aria-label="Post comment"
          className="w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-500"
          rows={3} 
          placeholder="Enter post comment..."
          value={postComment}
          onChange={(e) => setPostComment(e.target.value)}
        />
        <div className="flex items-center space-x-4 mt-2">
          <label className="text-sm">
             Attach Image:
             <input type="file" onChange={(e) => setPostFile(e.target.files?.[0] || null)} className="ml-2 text-sm file:mr-2 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-800 dark:file:text-blue-200 dark:hover:file:bg-blue-700"/>
             {postFile && <span className="text-xs ml-2">{postFile.name}</span>}
          </label>
          <label className="flex items-center">
            <input type="checkbox" checked={postUseSage} onChange={(e) => setPostUseSage(e.target.checked)} className="mr-2 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"/>
            Use Sage
          </label>
          <button 
            onClick={() => handleSimplePost()} 
            disabled={showCorsWarning && lastFetchOperationFailed?.includes("post to")} /* Disable if /api/post fails */
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium flex items-center shadow transition-colors disabled:opacity-50"
            title={showCorsWarning && lastFetchOperationFailed?.includes("post to") ? "Posting disabled due to /api/post connection issues." : "Post message"}
          >
            <IconSend className="mr-2 h-5 w-5"/> Post
          </button>
        </div>
      </div>

      <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-md">
        <div className="flex justify-between items-center mb-3">
            <h3 className="text-xl font-medium text-gray-700 dark:text-gray-300">Thread Viewer & Gemini Reply</h3>
            <button
                onClick={fetchCurrentDvachThread}
                disabled={isFetchingThread || !settings.board || !settings.threadId || (showCorsWarning && !lastFetchOperationFailed?.includes("post to"))}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-md font-medium flex items-center shadow disabled:opacity-50 transition-colors"
                title={showCorsWarning && !lastFetchOperationFailed?.includes("post to") ? "Dvach GET interaction may be unstable. Check logs & proxy." : "Fetch posts from current board/thread ID in settings"}
            >
                <IconRefresh className={`mr-2 h-5 w-5 ${isFetchingThread ? 'animate-spin' : ''}`}/> Fetch Thread Posts
            </button>
        </div>
        {(!settings.board || !settings.threadId) && <p className="text-sm text-yellow-600 dark:text-yellow-400">Set Board and Thread ID in Settings to view posts.</p>}
        <div ref={threadPostsContainerRef} className="max-h-[600px] overflow-y-auto bg-gray-100 dark:bg-gray-800 p-2 rounded custom-scrollbar">
            {isFetchingThread && <p className="text-center p-4">Loading thread...</p>}
            {!isFetchingThread && currentFetchedDvachPosts.length === 0 && <p className="text-center p-4 text-gray-500 dark:text-gray-400">No posts loaded. Fetch thread or check settings.</p>}
            {currentFetchedDvachPosts.map(renderDvachPostCard)}
        </div>
      </div>
    </div>
  );

  const renderGeminiPanel = () => (
    <div className="space-y-6 p-4 md:p-6 bg-white dark:bg-gray-800 shadow-lg rounded-lg">
      <h2 className="text-2xl font-semibold text-purple-600 dark:text-purple-400 border-b pb-2 border-gray-300 dark:border-gray-700">Gemini AI Laboratory</h2>
      <p className="text-gray-600 dark:text-gray-300">
        This section is for direct interaction with the Gemini API. Ensure your API key is correctly set up in Settings.
      </p>
      {!ai && (
         <div className="p-3 mb-4 bg-yellow-100 dark:bg-yellow-800 border border-yellow-300 dark:border-yellow-600 rounded-md text-yellow-700 dark:text-yellow-200 text-sm">
          <div className="flex items-center">
            <IconAlertTriangle className="h-5 w-5 mr-2 text-yellow-500 dark:text-yellow-400" />
            <span>
              <strong>Gemini AI Not Initialized:</strong> Please check your API key in the Settings panel.
            </span>
          </div>
        </div>
      )}
      <div className="p-4 border rounded-md border-dashed border-gray-300 dark:border-gray-600">
        <p className="text-center text-gray-500 dark:text-gray-400">Gemini interaction UI to be implemented here.</p>
        <p className="text-center text-gray-500 dark:text-gray-400">For now, use "Reply with Gemini" in the Dvach Bot Panel.</p>
      </div>
       <div className="mt-6">
            <h3 className="text-lg font-medium mb-2">Gemini Chat (Standalone)</h3>
            <div className="h-64 overflow-y-auto border p-2 rounded mb-2 bg-gray-50 dark:bg-gray-700 custom-scrollbar">
                {geminiChatMessages.map((msg, index) => (
                    <div key={index} className={`mb-2 p-2 rounded-lg ${msg.role === 'user' ? 'bg-blue-100 dark:bg-blue-800 ml-auto' : 'bg-gray-200 dark:bg-gray-600 mr-auto'}`} style={{maxWidth: '80%'}}>
                        <p className="text-xs font-semibold">{msg.role}</p>
                        <p className="text-sm">{msg.parts[0]?.text || '[Non-text content]'}</p> 
                    </div>
                ))}
                {isStreaming && <p className="text-sm text-gray-500">Gemini is typing...</p>}
                 {!ai && geminiChatMessages.length === 0 && <p className="text-sm text-center text-gray-500">Initialize Gemini API in settings to start chatting.</p>}
            </div>
            <div className="flex">
                <input 
                    type="text" 
                    value={geminiPrompt} 
                    onChange={(e) => setGeminiPrompt(e.target.value)} 
                    placeholder="Type your message to Gemini..." 
                    className="flex-grow p-2 border rounded-l bg-gray-50 dark:bg-gray-700 dark:border-gray-600"
                    disabled={!ai || geminiLoading}
                />
                <button 
                  onClick={() => handleGeminiAction(GeminiFeature.CHAT, geminiPrompt)} 
                  disabled={geminiLoading || !ai || !geminiPrompt.trim()}
                  className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-r flex items-center disabled:opacity-50"
                >
                  Send <IconSend className="ml-2 h-4 w-4"/>
                </button>
            </div>
            <button onClick={clearChatHistory} className="text-xs text-gray-500 hover:underline mt-1 disabled:opacity-50" disabled={geminiChatMessages.length === 0}>Clear Chat</button>
        </div>
    </div>
  );

  const renderSettingsPanel = () => (
     <div className="space-y-6 p-4 md:p-6 bg-white dark:bg-gray-800 shadow-lg rounded-lg">
      <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-300 border-b pb-2 border-gray-300 dark:border-gray-700">Application Settings</h2>
      
      <div className="space-y-3">
        <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">Dvach Configuration</h3>
        <div>
          <label htmlFor="settingsBoard" className="block text-sm font-medium">Board (e.g., b):</label>
          <input id="settingsBoard" type="text" value={settings.board} onChange={e => handleUpdateSettings({board: e.target.value})} className="mt-1 w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"/>
        </div>
        <div>
          <label htmlFor="settingsThreadId" className="block text-sm font-medium">Thread ID:</label>
          <input id="settingsThreadId" type="text" value={settings.threadId} onChange={e => handleUpdateSettings({threadId: e.target.value})} className="mt-1 w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"/>
        </div>
        <div>
          <label htmlFor="settingsPasscode" className="block text-sm font-medium">Passcode:</label>
          <input id="settingsPasscode" type="password" value={settings.passcode} onChange={e => handleUpdateSettings({passcode: e.target.value})} className="mt-1 w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"/>
        </div>
         <div>
          <label htmlFor="settingsDomain" className="block text-sm font-medium">2ch.hk Domain (for GET requests):</label>
          <select id="settingsDomain" value={settings.currentDomainIndex} onChange={e => handleUpdateSettings({currentDomainIndex: parseInt(e.target.value)})}  className="mt-1 w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600">
            {DVACH_DOMAINS.map((domain, index) => (
              <option key={index} value={index}>{domain}</option>
            ))}
          </select>
        </div>
      </div>

       <div className="space-y-3">
        <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">CORS Proxy Configuration (for GET requests)</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">POST requests (sending messages) now use a dedicated serverless function (/api/post) and do not use these proxy settings.</p>
        <div>
          <label htmlFor="settingsProxyMode" className="block text-sm font-medium">Proxy Mode for GET requests:</label>
          <select 
            id="settingsProxyMode" 
            value={settings.proxyMode} 
            onChange={e => handleUpdateSettings({proxyMode: e.target.value as AppSettings['proxyMode']})}  
            className="mt-1 w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
          >
            <option value="cors-anywhere">Use cors-anywhere (Public, may have limits)</option>
            <option value="custom">Use Custom Proxy URL</option>
            <option value="none">No Proxy (May not work due to CORS)</option>
          </select>
        </div>
        {settings.proxyMode === 'custom' && (
          <div>
            <label htmlFor="settingsCustomProxyUrl" className="block text-sm font-medium">Custom Proxy URL for GET requests:</label>
            <input 
              id="settingsCustomProxyUrl" 
              type="text" 
              placeholder="e.g., https://my-proxy.example.com/"
              value={settings.customProxyUrl} 
              onChange={e => handleUpdateSettings({customProxyUrl: e.target.value})} 
              className="mt-1 w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Ensure the URL ends with a slash if it's a prefix proxy like cors-anywhere.</p>
          </div>
        )}
         <p className="text-xs text-gray-500 dark:text-gray-400">
            Using a proxy helps bypass browser CORS restrictions for GET requests. 'cors-anywhere' is public and may have request limits or require opt-in.
            For reliable use, consider setting up your own CORS proxy.
        </p>
      </div>


      <div className="space-y-3">
        <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">Gemini API Key</h3>
        <select aria-label="Gemini API Key Source" value={settings.geminiApiKeySource} onChange={e => handleUpdateSettings({geminiApiKeySource: e.target.value as 'env' | 'user'})} className="mt-1 w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600">
          <option value="env">Use Environment API_KEY {processEnvApiKey ? `(Detected: ${processEnvApiKey.substring(0,4)}...${processEnvApiKey.substring(processEnvApiKey.length - 4)})` : "(Not Detected/Accessible)"}</option>
          <option value="user">Enter API Key Manually</option>
        </select>
        {settings.geminiApiKeySource === 'user' && (
          <input aria-label="User Gemini API Key" type="password" placeholder="Enter your Gemini API Key" value={settings.userGeminiApiKey} onChange={e => handleUpdateSettings({userGeminiApiKey: e.target.value})} className="mt-1 w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"/>
        )}
      </div>

      <div className="space-y-2">
         <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">Bot Behavior</h3>
        <label className="flex items-center">
          <input type="checkbox" checked={settings.useRandomDelayNormal} onChange={e => handleUpdateSettings({useRandomDelayNormal: e.target.checked})} className="mr-2 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"/>
          Use random delay (normal mode)
        </label>
        <label className="flex items-center">
          <input type="checkbox" checked={settings.useRandomDelaySecure} onChange={e => handleUpdateSettings({useRandomDelaySecure: e.target.checked})} className="mr-2 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"/>
          Use random delay (secure mode - longer delays)
        </label>
        <label className="flex items-center">
          <input type="checkbox" checked={settings.allowReplyToSelf} onChange={e => handleUpdateSettings({allowReplyToSelf: e.target.checked})} className="mr-2 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"/>
          Allow reply to own posts
        </label>
        <label className="flex items-center">
          <input type="checkbox" checked={settings.geminiReplyWithImage} onChange={e => handleUpdateSettings({geminiReplyWithImage: e.target.checked})} className="mr-2 h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"/>
          Gemini: Generate image with replies
        </label>
         <label className="flex items-center">
          <input type="checkbox" checked={settings.autoMonitorDvachThreadForGemini} onChange={e => handleUpdateSettings({autoMonitorDvachThreadForGemini: e.target.checked})} className="mr-2 h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"/>
          Gemini: Auto-monitor thread for conversational replies (Experimental)
        </label>
      </div>
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
        >
            <IconTrash className="mr-1 h-4 w-4"/> Clear Logs
        </button>
      </div>
      <div className="max-h-[600px] overflow-y-auto bg-gray-50 dark:bg-gray-900 p-3 rounded custom-scrollbar border border-gray-200 dark:border-gray-700">
        {logs.length === 0 && <p className="text-center text-gray-500 dark:text-gray-400">No logs yet.</p>}
        {logs.map(log => (
          <div key={log.id} className={`text-xs p-1.5 mb-1 rounded border-l-4 ${
            log.type === 'error' ? 'bg-red-50 dark:bg-red-800 border-red-500 text-red-700 dark:text-red-300' : 
            log.type === 'success' ? 'bg-green-50 dark:bg-green-800 border-green-500 text-green-700 dark:text-green-300' :
            log.type === 'warning' ? 'bg-yellow-50 dark:bg-yellow-800 border-yellow-500 text-yellow-700 dark:text-yellow-300' :
            log.type === 'gemini' ? 'bg-purple-50 dark:bg-purple-800 border-purple-500 text-purple-700 dark:text-purple-300' :
            log.type === 'dvach' ? 'bg-blue-50 dark:bg-blue-800 border-blue-500 text-blue-700 dark:text-blue-300' :
            'bg-gray-100 dark:bg-gray-700 border-gray-500 text-gray-700 dark:text-gray-300' 
          }`}>
            <span className="font-medium">[{new Date(log.timestamp).toLocaleTimeString()}] [{log.type.toUpperCase()}]</span>: {log.message}
            {log.data && <pre className="mt-1 text-xs whitespace-pre-wrap bg-gray-200 dark:bg-gray-700 p-1 rounded">{typeof log.data === 'string' ? log.data : JSON.stringify(log.data, null, 2)}</pre>}
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
          <h1 className="text-2xl font-bold text-blue-600 dark:text-blue-400">Dvach Gemini Bot</h1>
          <div className="flex items-center space-x-4">
            {userAgent && <span className="text-xs text-gray-500 dark:text-gray-400 hidden md:block">UA: {userAgent.length > 30 ? userAgent.substring(0,30) + '...' : userAgent}</span>}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              aria-label={`Toggle theme (current: ${settings.theme})`}
              title={`Change theme. Current: ${settings.theme}. Click to cycle: light -> dark -> system -> light...`}
            >
              <ThemeIcon className="h-6 w-6" />
            </button>
          </div>
        </div>
      </header>

      <nav className="bg-gray-50 dark:bg-gray-800 border-b border-t border-gray-200 dark:border-gray-700 sticky top-[64px] z-40"> {/* Assuming header height is approx 64px */}
        <div className="container mx-auto flex justify-center sm:justify-start flex-wrap">
          {[
            { id: 'dvach', label: 'Dvach Bot', icon: IconCpu },
            { id: 'gemini', label: 'Gemini Lab', icon: IconSparkles },
            { id: 'settings', label: 'Settings', icon: IconSettings },
            { id: 'logs', label: 'Logs', icon: IconTerminal },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as 'dvach' | 'gemini' | 'settings' | 'logs')}
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
            {activeTab === 'gemini' && renderGeminiPanel()}
            {activeTab === 'settings' && renderSettingsPanel()}
            {activeTab === 'logs' && renderLogsPanel()}
        </div>
      </main>

      <footer className="text-center py-4 border-t border-gray-200 dark:border-gray-700 mt-8">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Dvach Gemini Bot Interface - Version 1.0.0 - Use responsibly.
        </p>
      </footer>
    </div>
  );
};

export default App;
