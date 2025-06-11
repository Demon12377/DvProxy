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
  GEMINI_MULTIMODAL_MODEL, GEMINI_IMAGE_MODEL, MAX_LOG_ENTRIES, MAX_SENT_MESSAGES_STORED,
  GEMINI_CHAT_HISTORY_KEY, GEMINI_DVACH_CONVERSATIONS_KEY, DVACH_SESSION_COOKIES_KEY,
  PROXY_URL_GO_X2U_BASE, DEFAULT_CORS_ANYWHERE_PROXY, DVACH_DOMAINS, DEFAULT_USER_AGENT
} from './constants';
import { fetchImageAsBase64 } from './services/dvachService'; // Added for image fetching
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
  geminiResponseMimeType: "text/plain", // This might need to be reviewed if gemini-2.5-flash handles JSON better for analysis.
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

  useFullThreadContext: false,
  threadContextLength: 5,

  monitoringIntervalSeconds: 60,
  autoStartMonitoring: false,
  allowReplyToOwnBotPosts: false,
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

// Helper function to get thread context for a reply - Переименовано
const получитьКонтекстТредаДляОтвета = (
  номерЦелевогоПоста: string,
  всеПосты: DvachPost[],
  длинаКонтекста: number
): DvachPost[] => {
  if (!номерЦелевогоПоста || длинаКонтекста <= 0) return [];

  const индексЦелевогоПоста = всеПосты.findIndex(p => p.num === номерЦелевогоПоста);

  if (индексЦелевогоПоста === -1) {
    console.warn(`[получитьКонтекстТредаДляОтвета] Целевой пост ${номерЦелевогоПоста} не найден в массиве постов.`);
    return [];
  }

  const начальныйИндекс = Math.max(0, индексЦелевогоПоста - длинаКонтекста);
  // Контекст должен содержать посты *перед* целевым постом.
  const контекстныеПосты = всеПосты.slice(начальныйИндекс, индексЦелевогоПоста);

  return контекстныеПосты;
};

// Форматирование данных лога для отображения (оставляем англ., т.к. внутренняя утилита)
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
  const [входНаДвачВПроцессе, установитьВходНаДвачВПроцессе] = useState<boolean>(false);

  const [текущаяДоска, установитьТекущуюДоску] = useState<string>(settings.board);
  const [текущийТредId, установитьТекущийТредId] = useState<string>(settings.threadId);
  const [отправленныеСообщения, установитьОтправленныеСообщения] = useState<SentMessageInfo[]>(() => {
    const saved = localStorage.getItem(SENT_MESSAGES_KEY);
    return saved ? JSON.parse(saved) : [];
  });
  const [текстПоста, установитьТекстПоста] = useState<string>('');
  const [файлПоста, установитьФайлПоста] = useState<File | null>(null);
  const [использоватьSage, установитьИспользоватьSage] = useState<boolean>(false);
  const [постингВПроцессе, установитьПостингВПроцессе] = useState<boolean>(false);
  const [журналАктивностиПостинга, установитьЖурналАктивностиПостинга] = useState<string[]>([]);

  const [загруженныеПостыТреда, установитьЗагруженныеПостыТреда] = useState<DvachPost[]>([]);
  const [загрузкаТредаВПроцессе, установитьЗагрузкуТредаВПроцессе] = useState<boolean>(false);
  const threadPostsContainerRef = useRef<HTMLDivElement>(null);
  const [ошибкаЗагрузки, установитьОшибкуЗагрузки] = useState<string | null>(null);

  // Gemini states - Состояния Gemini (оставляем англ. названия для соотв. с SDK)
  const [geminiLoading, setGeminiLoading] = useState<boolean>(false); // Общая загрузка Gemini
  // Следующие состояния были для старой панели "Gemini Lab", будут заменены состояниями лаборатории
  // const [textGenPrompt, setTextGenPrompt] = useState<string>(''); // Заменено на geminiLabPrompt
  // const [geminiOutputText, setGeminiOutputText] = useState<string>(''); // Заменено на geminiLabOutput
  // const [groundingSources, setGroundingSources] = useState<GroundingChunk[]>([]); // Пока не используется в новой лабе
  // const [imageGenPrompt, setImageGenPrompt] = useState<string>(''); // Заменено на geminiLabPrompt
  // const [numImagesToGenerate, setNumImagesToGenerate] = useState<number>(1); // Заменено на geminiLabNumImagesToGenerate
  // const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]); // Заменено на geminiLabOutput
  // const [isGeneratingImage, setIsGeneratingImage] = useState<boolean>(false); // Заменено на geminiLabLoading

  const [geminiChatInput, setGeminiChatInput] = useState<string>('');
  const [geminiChatMessages, setGeminiChatMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem(GEMINI_CHAT_HISTORY_KEY);
    return saved ? JSON.parse(saved) : [];
  });
  const [currentGeminiChat, setCurrentGeminiChat] = useState<GeminiChatInstanceType | null>(null);
  const [isStreamingChat, setIsStreamingChat] = useState<boolean>(false);
  const [imageForGeminiChat, setImageForGeminiChat] = useState<File | null>(null);
  const chatMessagesEndRef = useRef<HTMLDivElement>(null);
  const [анализТредаВПроцессе, установитьАнализТредаВПроцессе] = useState<boolean>(false);
  const [загрузкаИзображенияДляGemini, установитьЗагрузкуИзображенияДляGemini] = useState<boolean>(false);
  
  // States for the new Gemini Lab panel - Состояния для новой панели "Лаборатория Gemini"
  const [модельЛабораторииGemini, установитьМодельЛабораторииGemini] = useState<string>(GEMINI_MULTIMODAL_MODEL); // Default to the new multimodal model
  const [промптЛабораторииGemini, установитьПромптЛабораторииGemini] = useState<string>('');
  const [файлИзображенияЛаборатории, установитьФайлИзображенияЛаборатории] = useState<File | null>(null);
  const [превьюИзображенияЛаборатории, установитьПревьюИзображенияЛаборатории] = useState<string | null>(null);
  const [количествоИзображенийДляГенерацииВЛаборатории, установитьКоличествоИзображенийДляГенерацииВЛаборатории] = useState<number>(1);
  const [выводЛабораторииGemini, установитьВыводЛабораторииGemini] = useState<string | GeneratedImage[] | null>(null);
  const [загрузкаВЛабораторииGemini, установитьЗагрузкуВЛабораторииGemini] = useState<boolean>(false);

  // State for turnkey bot monitoring - Состояния для мониторинга треда ботом
  const [мониторингТредаАктивен, установитьМониторингТредаАктивен] = useState<boolean>(false);
  const monitoringIntervalIdRef = useRef<NodeJS.Timeout | null>(null); // Оставляем англ. для useRef ID интервала
  const [номерПоследнегоОбработанногоПоста, установитьНомерПоследнегоОбработанногоПоста] = useState<string | null>(null);
  const [времяНачалаМониторинга, установитьВремяНачалаМониторинга] = useState<number | null>(null);
  const [времяПоследнегоАвтоответа, установитьВремяПоследнегоАвтоответа] = useState<number | null>(null);
  const [сводкиДействийБота, установитьСводкиДействийБота] = useState<Array<{id: string, timestamp: number, message: string}>>([]);

  const [geminiDvachConversations, setGeminiDvachConversations] = useState<Map<string, GeminiDvachConversation>>(() => {
    const saved = localStorage.getItem(GEMINI_DVACH_CONVERSATIONS_KEY);
    return saved ? new Map(JSON.parse(saved)) : new Map();
  });


  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info', data?: unknown) => {
    setLogs(prevLogs => [{ id: Date.now().toString(), timestamp: Date.now(), message, type, data }, ...prevLogs.slice(0, MAX_LOG_ENTRIES - 1)]);
    const consoleMethod = type === 'error' ? console.error : type === 'warning' ? console.warn : console.log;
    consoleMethod(`[${type.toUpperCase()}] ${message}`, data !== undefined ? data : "");
  }, []);

  const добавитьСводкуДействия = useCallback((message: string) => {
    установитьСводкиДействийБота(prevSummaries => [
      { id: Date.now().toString() + Math.random().toString(36).substring(2,9), timestamp: Date.now(), message },
      ...prevSummaries.slice(0, 14) // Хранить последние 15 сводок
    ]);
  }, []);

  const addPostActivity = useCallback((message: string) => { // Журнал ручного постинга, можно оставить англ.
    установитьЖурналАктивностиПостинга(prev => [ `[${new Date().toLocaleTimeString()}] ${message}`, ...prev.slice(0, 9)]);
  }, []);


  useEffect(() => {
    localStorage.setItem(APP_SETTINGS_KEY, JSON.stringify(settings));
    if (settings.theme === 'dark') document.documentElement.classList.add('dark');
    else if (settings.theme === 'light') document.documentElement.classList.remove('dark');
    else window.matchMedia('(prefers-color-scheme: dark)').matches ? document.documentElement.classList.add('dark') : document.documentElement.classList.remove('dark');
  }, [settings]);

  useEffect(() => {
    localStorage.setItem(SENT_MESSAGES_KEY, JSON.stringify(отправленныеСообщения.slice(0, MAX_SENT_MESSAGES_STORED)));
  }, [отправленныеСообщения]);

  useEffect(() => {
    localStorage.setItem(GEMINI_CHAT_HISTORY_KEY, JSON.stringify(geminiChatMessages)); // Чат Gemini, можно оставить
    chatMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [geminiChatMessages]);
  
  useEffect(() => {
    localStorage.setItem(GEMINI_DVACH_CONVERSATIONS_KEY, JSON.stringify(Array.from(geminiDvachConversations.entries()))); // Разговоры Gemini, можно оставить
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
    установитьТекущуюДоску(settings.board);
    установитьТекущийТредId(settings.threadId);
  }, [settings.board, settings.threadId]);

 // Переименовано
  const загрузитьТред = async () => {
    if (!текущаяДоска || !текущийТредId) {
      установитьОшибкуЗагрузки('Необходимо указать доску и ID треда.');
      addLog('Необходимо указать доску и ID треда для загрузки постов.', 'warning');
      установитьЗагруженныеПостыТреда([]);
      return;
    }
    установитьЗагрузкуТредаВПроцессе(true);
    установитьОшибкуЗагрузки(null);
    установитьЗагруженныеПостыТреда([]);
    try {
      addLog(`Загрузка треда /${текущаяДоска}/${текущийТредId}... Proxy для GET: ${settings.proxyModeForGET}`, 'dvach');
      const data: DvachThreadResponse = await getThreadData(текущаяДоска, текущийТредId, settings.proxyModeForGET, settings.customProxyUrlForGET, settings.userAgent);
      
      const posts = data.threads?.[0]?.posts || [];
      установитьЗагруженныеПостыТреда(posts);
      addLog(`Успешно загружено ${posts.length} постов из /${текущаяДоска}/${текущийТредId}.`, 'success');
      if (threadPostsContainerRef.current) threadPostsContainerRef.current.scrollTop = 0;
      handleUpdateSettings({ board: текущаяДоска, threadId: текущийТредId });

    } catch (err) {
      const errorMsg = (err as Error).message;
      установитьОшибкуЗагрузки(errorMsg);
      addLog(`Ошибка загрузки треда /${текущаяДоска}/${текущийТредId}: ${errorMsg}`, 'error', err);
      установитьЗагруженныеПостыТреда([]);
    } finally {
      установитьЗагрузкуТредаВПроцессе(false);
    }
  };
  
  // Переименовано
  const войтиНаДвач = async () => {
    if (!settings.purchasedPasscode) {
      addLog("Пропуск для Двача не указан в настройках.", 'error');
      return;
    }
    установитьВходНаДвачВПроцессе(true);
    установитьОшибкуЗагрузки(null);
    addLog("Попытка входа на Двач с использованием пропуска...", 'auth');
    try {
      const cookies = await loginToDvach(settings.purchasedPasscode, settings.userAgent);
      setDvachSessionCookies(cookies);
      addLog("Успешный вход на Двач. Сессионные куки сохранены.", 'success');
    } catch (error) {
      const errorMsg = (error as Error).message;
      установитьОшибкуЗагрузки(errorMsg);
      addLog(`Ошибка входа на Двач: ${errorMsg}`, 'error', error);
      setDvachSessionCookies(null);
    } finally {
      установитьВходНаДвачВПроцессе(false);
    }
  };

  // Переименовано
  const выйтиИзДвача = () => {
    setDvachSessionCookies(null);
    addLog("Выход из Двача. Сессионные куки очищены.", 'info');
  };

  // Переименовано
  const отправитьПостНаДвачОбщий = async (
    комментарий: string,
    файл: File | null,
    использоватьSageПост: boolean,
    доскаДляПостинга: string,
    контекстТредаId: string,
    ответНаПостNum?: string
  ): Promise<string> => { 
    if (!dvachSessionCookies?.passcode_auth) {
      const errorMsg = 'Нет входа на Двач или сессия истекла. Пожалуйста, войдите сначала.';
      addLog(errorMsg, 'error');
      addPostActivity(`Ошибка: ${errorMsg}`);
      установитьОшибкуЗагрузки(errorMsg);
      throw new Error(errorMsg);
    }
    if (!доскаДляПостинга || !комментарий.trim()) {
      const errorMsg = 'Доска и комментарий обязательны для постинга.';
      addLog(errorMsg, 'error');
      addPostActivity(`Ошибка: ${errorMsg}`);
      throw new Error(errorMsg);
    }

    установитьПостингВПроцессе(true);
    установитьОшибкуЗагрузки(null);
    const актуальныйIdТредаДляДвача = контекстТредаId === "0" || контекстТредаId === "" ? "0" : контекстТредаId;
    const описаниеЦели = актуальныйIdТредаДляДвача === "0" ? 'новый тред' : `тред ${актуальныйIdТредаДляДвача}`;
    const сообщЛога = `Попытка отправки поста в /${доскаДляПостинга}/${описаниеЦели}${ответНаПостNum ? ` (ответ на >>${ответНаПостNum})` : ''}. Комментарий: "${комментарий.substring(0,50)}..."`;
    addLog(сообщЛога, 'dvach');
    addPostActivity(сообщЛога);

    try {
      const result = await postWithSessionCookie(
        dvachSessionCookies,
        доскаДляПостинга,
        актуальныйIdТредаДляДвача,
        комментарий,
        файл,
        ответНаПостNum,
        использоватьSageПост,
        settings.userAgent
      );
      
      const новыйНомерПоста = String(result.num || result.thread || result.target || Date.now());
      addLog(`Пост успешно отправлен! Ответ Двача: Номер: ${новыйНомерПоста}`, 'success', result);
      addPostActivity(`Успех! Номер поста: ${новыйНомерПоста}.`);
      
      const новоеОтправленноеСообщение: SentMessageInfo = {
        num: новыйНомерПоста,
        timestamp: Date.now(),
        comment: комментарий,
        board: доскаДляПостинга,
        thread: актуальныйIdТредаДляДвача === "0" ? новыйНомерПоста : актуальныйIdТредаДляДвача,
        parent: ответНаПостNum || (актуальныйIdТредаДляДвача === "0" ? undefined : актуальныйIdТредаДляДвача),
        file_info: файл ? { name: файл.name, size: файл.size } : undefined,
      };
      установитьОтправленныеСообщения(prev => [новоеОтправленноеСообщение, ...prev]);
      return новыйНомерПоста;
    } catch (err) {
      const error = err as Error;
      const dvachApiError = extractDvachApiError(error);
      let errorMsg = error.message;

      if (dvachApiError && (dvachApiError.code === -4 || dvachApiError.code === -6 || dvachApiError.code === -21 || dvachApiError.message.toLowerCase().includes("постинг запрещён") || dvachApiError.message.toLowerCase().includes("доступ запрещен"))) {
        // Specific auth-related errors from Dvach
        errorMsg = `Сессия Двача, вероятно, истекла или недействительна (Ошибка: ${dvachApiError.message}). Пожалуйста, войдите снова.`;
        addLog(errorMsg, 'auth', dvachApiError);
        setDvachSessionCookies(null);
      } else {
        addLog(`Ошибка отправки поста: ${errorMsg}`, 'error', err);
      }
      установитьОшибкуЗагрузки(errorMsg);
      addPostActivity(`Ошибка поста: ${errorMsg}`);
      throw new Error(errorMsg); 
    } finally {
      установитьПостингВПроцессе(false);
    }
  };

  // Переименовано
  const отправитьПростойПост = async () => {
    try {
      await отправитьПостНаДвачОбщий(текстПоста, файлПоста, использоватьSage, текущаяДоска, текущийТредId);
      установитьТекстПоста('');
      установитьФайлПоста(null);
    } catch (e) { /* ошибка уже залогирована в отправитьПостНаДвачОбщий */ }
  };

  // Переименовано
  const ответитьЧерезGeminiНаПост = async (targetPost: DvachPost) => {
    if (!ai) { addLog('Gemini AI не инициализирован.', 'error'); return; }
    if (!dvachSessionCookies?.passcode_auth) {
        addLog('Нет входа на Двач. Пожалуйста, войдите перед ответом с помощью Gemini.', 'error');
        установитьОшибкуЗагрузки('Нет входа на Двач. Пожалуйста, войдите перед ответом с помощью Gemini.');
        return;
    }
    // targetPost.parent is the thread_id, targetPost.board is the board_id
    if (!targetPost.board || !targetPost.parent) {
      addLog('Target post is missing board or thread ID information.', 'error');
      return;
    }

    setGeminiLoading(true);
    // Используем состояние `загрузкаИзображенияДляGemini` (которое связано с `установитьЗагрузкуИзображенияДляGemini`)
    addLog(`Gemini готовит ответ на пост >>${targetPost.num} в /${targetPost.board}/${targetPost.parent}...`, 'gemini');
    
    let systemInstructionForReply = settings.geminiSystemInstruction || DEFAULT_APP_SETTINGS.geminiSystemInstruction;
    
    let userPromptText = "";
    const geminiMessageParts: Part[] = [];
    // let modelToUse = GEMINI_TEXT_MODEL; // Deprecated: modelToUse will be GEMINI_MULTIMODAL_MODEL
    let dvachImageToAnalyze: DvachFile | null = null;
    let imageSuccessfullyProcessed = false;
    let threadPostsForContext: DvachPost[] = [];

    // 1. Получение полного контекста треда, если включено
    if (settings.useFullThreadContext && targetPost.board && targetPost.parent) {
      addLog(`Полный контекст треда включен. Сбор постов для /${targetPost.board}/${targetPost.parent}.`, 'gemini');
      if (текущаяДоска === targetPost.board && текущийТредId === targetPost.parent && загруженныеПостыТреда.length > 0) {
        addLog(`Использование уже загруженных постов (${загруженныеПостыТреда.length}) для контекста.`, 'gemini');
        threadPostsForContext = загруженныеПостыТреда;
      } else {
        addLog(`Текущие загруженные посты не подходят или пусты. Загрузка свежих данных треда /${targetPost.board}/${targetPost.parent} для контекста.`, 'gemini');
        try {
          const contextThreadData = await getThreadData(targetPost.board, targetPost.parent, settings.proxyModeForGET, settings.customProxyUrlForGET, settings.userAgent);
          threadPostsForContext = contextThreadData.threads?.[0]?.posts || [];
          addLog(`Успешно загружено ${threadPostsForContext.length} постов для контекста из /${targetPost.board}/${targetPost.parent}.`, 'gemini');
        } catch (err) {
          addLog(`Не удалось загрузить контекст треда для /${targetPost.board}/${targetPost.parent}: ${(err as Error).message}. Продолжение без полного контекста.`, 'warning', err);
          threadPostsForContext = [];
        }
      }
    }

    // 2. Подготовка текстового промпта (с контекстом или без)
    const cleanComment = (text: string) => text.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>?/gm, '').trim();
    const contextualPostsFormatted: string[] = [];

    if (settings.useFullThreadContext && threadPostsForContext.length > 0) {
        const contextPosts = получитьКонтекстТредаДляОтвета(targetPost.num, threadPostsForContext, settings.threadContextLength);
        contextPosts.forEach(p => {
            contextualPostsFormatted.push(`>>${p.num} (${p.name || 'Anon'}): ${cleanComment(p.comment).substring(0, 250)}...`);
        });

        if (contextualPostsFormatted.length > 0) {
            userPromptText = "Вот предыдущие сообщения в треде:\n" + contextualPostsFormatted.join('\n\n') + "\n\n";
            userPromptText += `Пост, на который нужно ответить (>>${targetPost.num}):\n`;
            // Обновляем системную инструкцию, чтобы она включала указание на контекст
            systemInstructionForReply += ` Учитывая предыдущий контекст обсуждения и следующий пост, напиши развернутый и интересный ответ на пост >>${targetPost.num}. Твой ответ ДОЛЖЕН начинаться с ">>${targetPost.num}\\n".`;
        } else {
            systemInstructionForReply += ` Твой ответ ДОЛЖЕН начинаться с ">>${targetPost.num}\\n".`;
        }
    } else {
        systemInstructionForReply += ` Твой ответ ДОЛЖЕН начинаться с ">>${targetPost.num}\\n".`;
    }

    userPromptText += `>>${targetPost.num} (${targetPost.name || 'Anonymous'}):\n"${cleanComment(targetPost.comment)}"`;


    // 3. Обработка изображения (если есть и разрешено настройками)
    if (targetPost.files && targetPost.files.length > 0 &&
        ((settings.geminiAnalyzeOpMedia && targetPost.op === 1) || (settings.geminiAnalyzeAnonMedia && targetPost.op !== 1))) {

      dvachImageToAnalyze = targetPost.files[0]; // Берем первое изображение

      if (dvachImageToAnalyze) {
        const currentDvachDomain = DVACH_DOMAINS[0]; // Можно сделать выбор домена более гибким
        const imageUrl = dvachImageToAnalyze.path.startsWith('http') ? dvachImageToAnalyze.path : `${currentDvachDomain}${dvachImageToAnalyze.path}`;

        let proxyPrefixForImageFetch = "";
        if (settings.proxyModeForGET !== 'none' && settings.proxyModeForGET !== 'vercel_serverless') {
            if (settings.proxyModeForGET === 'custom_go_x2u') {
                proxyPrefixForImageFetch = settings.customProxyUrlForGET || PROXY_URL_GO_X2U_BASE;
            } else if (settings.proxyModeForGET === 'custom_cors_anywhere') {
                proxyPrefixForImageFetch = (settings.customProxyUrlForGET || DEFAULT_CORS_ANYWHERE_PROXY).endsWith('/')
                    ? (settings.customProxyUrlForGET || DEFAULT_CORS_ANYWHERE_PROXY)
                    : `${(settings.customProxyUrlForGET || DEFAULT_CORS_ANYWHERE_PROXY)}/`;
            } else if (settings.proxyModeForGET === 'custom_general_prefix') {
                 proxyPrefixForImageFetch = settings.customProxyUrlForGET || "";
            } else if (settings.proxyModeForGET === 'custom_general_param' && settings.customProxyUrlForGET) {
                 proxyPrefixForImageFetch = settings.customProxyUrlForGET.endsWith('=') ? settings.customProxyUrlForGET : `${settings.customProxyUrlForGET}=`;
                 addLog(`Загрузка изображения: используется 'custom_general_param'. Убедитесь, что URL прокси в настройках вида 'https://myproxy.com?url='`, 'info');
            }
        }

        addLog(`Попытка загрузки изображения "${dvachImageToAnalyze.name}" для анализа Gemini. URL: ${imageUrl}. Прокси-префикс: "${proxyPrefixForImageFetch || 'нет'}"`, 'gemini');
        установитьЗагрузкуИзображенияДляGemini(true);
        try {
          const { base64Data, mimeType } = await fetchImageAsBase64(imageUrl, proxyPrefixForImageFetch);
          geminiMessageParts.push({ inlineData: { mimeType: mimeType, data: base64Data } });
          // modelToUse = GEMINI_VISION_MODEL; // No longer needed, GEMINI_MULTIMODAL_MODEL is used
          userPromptText = `Проанализируй этот текст и ИЗОБРАЖЕНИЕ и напиши ответ. ${userPromptText}`;
          addLog(`Изображение "${dvachImageToAnalyze.name}" (MIME: ${mimeType}) успешно загружено и подготовлено. Используется модель: ${GEMINI_MULTIMODAL_MODEL}.`, 'success');
          imageSuccessfullyProcessed = true;
        } catch (imgError) {
          addLog(`Не удалось загрузить/обработать изображение "${dvachImageToAnalyze.name}": ${(imgError as Error).message}. Ответ будет только на основе текста.`, 'warning', imgError);
          userPromptText = `(Анализ изображения не удался, внимательно прочти только текст и ответь на него). ${userPromptText}`;
        } finally {
          установитьЗагрузкуИзображенияДляGemini(false);
        }
      }
    }
    
    userPromptText += `\n\nТвой ответ:`;
    geminiMessageParts.push({ text: userPromptText });

    // 4. Вызов Gemini API
    let geminiReplyText = "";
    try {
      addLog(`Отправка запроса в Gemini. Модель: ${GEMINI_MULTIMODAL_MODEL}. Системная инструкция: "${systemInstructionForReply.substring(0,100)}..." Промпт: "${userPromptText.substring(0,200)}..."`, 'gemini');
      const modelInstance = ai.getGenerativeModel({ model: GEMINI_MULTIMODAL_MODEL, systemInstruction: systemInstructionForReply });
      const response = await modelInstance.generateContent({
        contents: [{ role: 'user', parts: geminiMessageParts }],
        generationConfig: {
          temperature: settings.geminiTemperature, topP: settings.geminiTopP, 
          topK: settings.geminiTopK, maxOutputTokens: settings.geminiMaxOutputTokens 
        }
      });
      geminiReplyText = response.response.text() || "";

      if (!geminiReplyText.trim().startsWith(`>>${targetPost.num}`)) { 
          geminiReplyText = `>>${targetPost.num}\n${geminiReplyText.trim()}`;
      }
      addLog(`Gemini сгенерировал текстовый ответ для >>${targetPost.num}: ${geminiReplyText.substring(0, 100)}...`, 'gemini');

      let finalFileToPost: File | null = null;
      if (settings.geminiReplyWithGeneratedImage) {
        addLog(`Gemini генерирует изображение для ответа на >>${targetPost.num}...`, 'gemini');
        const imagePpt = `Контекст ответа на имиджборде: "${geminiReplyText.substring(geminiReplyText.indexOf('\n') + 1, 200).trim()}". Стиль: интересный, мемный или абстрактный.`;

        const imageModelInstance = ai.getGenerativeModel({model: GEMINI_IMAGE_MODEL});
        // Note: The exact response structure for generateImages can vary. Adjust if needed.
        const imgGenResp = await imageModelInstance.generateImages({prompt: imagePpt, number_of_images: 1 });

        const firstGeneratedImage = imgGenResp?.response?.[0];
        if (firstGeneratedImage && (firstGeneratedImage as any).image_bytes) { // Check for image_bytes, cast to any if type is too strict
          finalFileToPost = await base64ToFile(Buffer.from((firstGeneratedImage as any).image_bytes).toString('base64'), `gemini_img_${Date.now()}.jpg`, (firstGeneratedImage as any).mime_type || 'image/jpeg');
          addLog(`Gemini сгенерировал изображение для ответа на >>${targetPost.num}.`, 'gemini');
        } else {
            addLog(`Генерация изображения Gemini не удалась или изображение не возвращено для ответа на >>${targetPost.num}.`, 'warning');
        }
      }
      // Ensure the correct function name for posting is used, matching the rest of App.tsx
      const newPostNumByGemini = await отправитьПостНаДвачОбщий(geminiReplyText, finalFileToPost, использоватьSage, targetPost.board, targetPost.parent, targetPost.num);
      
      установитьОтправленныеСообщения(prev => prev.map(msg =>
        msg.num === newPostNumByGemini ? { ...msg, isGeminiPost: true, geminiTriggerPostNum: targetPost.num, geminiGeneratedImage: !!finalFileToPost } : msg
      ));
      addLog(`Ответ Gemini опубликован как >>${newPostNumByGemini} в /${targetPost.board}/${targetPost.parent}.`, 'success');

      const этоАвтоматическийВызов = мониторингТредаАктивен && targetPost.board === settings.board && targetPost.parent === settings.threadId;
      if (этоАвтоматическийВызов) {
        установитьВремяПоследнегоАвтоответа(Date.now());
        добавитьСводкуДействия(`Авто-ответ на >>${newPostNumByGemini} в /${targetPost.board}/${targetPost.parent}. Изобр: ${imageSuccessfullyProcessed?'Да':'Нет'}`);
      }

      if (settings.autoMonitorDvachThreadForGemini && ai) {
        const convoId = targetPost.num;
        const initialUserContentParts: Part[] = [];
        if (settings.useFullThreadContext && contextualPostsFormatted.length > 0) {
            initialUserContentParts.push({text: "Контекст треда:\n" + contextualPostsFormatted.join('\n\n') + `\n\nПост, на который был дан ответ (>>${targetPost.num}):\n${cleanComment(targetPost.comment)}`});
        } else {
            initialUserContentParts.push({text: `Original post by ${targetPost.name || 'Anon'} (>>${targetPost.num}):\n${cleanComment(targetPost.comment)}`});
        }

        if (imageSuccessfullyProcessed && dvachImageToAnalyze) {
            const imagePart = geminiMessageParts.find(part => part.inlineData);
            if (imagePart) {
                initialUserContentParts.push(imagePart);
            }
        }
        const initialUserContent: Content = { role: 'user', parts: initialUserContentParts };
        const initialModelContent: Content = { role: 'model', parts: [{text: geminiReplyText}]};

        const newChatHistoryForConvo: ChatMessage[] = [
            { id: `convo-${convoId}-user-orig`, role: 'user', parts: initialUserContent.parts!, timestamp: targetPost.timestamp * 1000 },
            { id: `convo-${convoId}-model-initial`, role: 'model', parts: initialModelContent.parts!, timestamp: Date.now() }
        ];
        
        // For new SDK, chat session is started from a model instance
        const chatModelInstance = ai.getGenerativeModel({ model: GEMINI_MULTIMODAL_MODEL, systemInstruction: systemInstructionForReply });
        const geminiChat = chatModelInstance.startChat({
            history: [ ...newChatHistoryForConvo.map(h => ({role: h.role as 'user' | 'model', parts: h.parts! } as Content))],
            generationConfig: {
                temperature: settings.geminiTemperature,
                topK: settings.geminiTopK,
                topP: settings.geminiTopP,
                maxOutputTokens: settings.geminiMaxOutputTokens
             }
        });

        const newConversation: GeminiDvachConversation = {
            dvachRootPostByGeminiNum: newPostNumByGemini,
            board: targetPost.board,
            threadId: targetPost.parent,
            geminiChatInstance: geminiChat, // Store the chat instance
            history: newChatHistoryForConvo,
            lastCheckedTimestamp: Date.now(),
            participatingPostNumbers: [targetPost.num, newPostNumByGemini]
        };
        setGeminiDvachConversations(prev => new Map(prev).set(convoId, newConversation));
        addLog(`Разговор GeminiDvach инициирован для >>${targetPost.num}, ответ Gemini >>${newPostNumByGemini}. Изображение обработано: ${imageSuccessfullyProcessed}. Постов в контексте: ${contextualPostsFormatted.length}.`, 'gemini');
      }

    } catch (error) {
      const errorMessage = (error as Error).message;
      if (!errorMessage.toLowerCase().includes("post failed") && !errorMessage.toLowerCase().includes("отправки поста")) {
         addLog(`Ошибка в логике ответа Gemini для >>${targetPost.num}: ${errorMessage}`, 'error', error);
      }
    } finally {
      setGeminiLoading(false);
      установитьЗагрузкуИзображенияДляGemini(false);
    }
  };

  // Core Turnkey Bot Monitoring Functions - Основные функции мониторинга треда ботом
  // Переименовано
  const проверитьНовыеПосты = async () => {
    if (!settings.board || !settings.threadId || !ai || !dvachSessionCookies?.passcode_auth) {
      addLog("Проверка мониторинга пропущена: Доска/ID треда не установлены, AI не инициализирован или нет входа.", 'warning');
      if (!dvachSessionCookies?.passcode_auth && мониторингТредаАктивен) {
        добавитьСводкуДействия("Монитор: Нет входа на Двач. Остановка.");
        addLog("Нет входа на Двач. Остановка мониторинга.", 'auth');
        остановитьМониторингТреда();
      }
      return;
    }

    addLog(`Мониторинг: Проверка /${settings.board}/${settings.threadId} на наличие новых постов... Последний увиденный: >>${номерПоследнегоОбработанногоПоста || 'Нет'}`, 'dvach');
    let текущиеПостыТреда: DvachPost[] = [];
    try {
      const threadData = await getThreadData(settings.board, settings.threadId, settings.proxyModeForGET, settings.customProxyUrlForGET, settings.userAgent);
      текущиеПостыТреда = threadData.threads?.[0]?.posts || [];
    } catch (error) {
      const errorMsg = `Мониторинг: Ошибка загрузки данных треда для /${settings.board}/${settings.threadId}: ${(error as Error).message}`;
      addLog(errorMsg, 'error', error);
      добавитьСводкуДействия(errorMsg.substring(0, 100) + "...");
      return;
    }

    if (текущиеПостыТреда.length === 0) {
      addLog(`Мониторинг: Постов не найдено в /${settings.board}/${settings.threadId}.`, 'info');
      return;
    }

    const номерПоследнегоПостаВТредеСтрока = текущиеПостыТреда[текущиеПостыТреда.length - 1].num;

    if (номерПоследнегоОбработанногоПоста === null) {
        const сохраненныйПоследнийНомер = localStorage.getItem(`lastMonitored_${settings.board}_${settings.threadId}`);
        if (сохраненныйПоследнийНомер) {
            установитьНомерПоследнегоОбработанногоПоста(сохраненныйПоследнийНомер);
            addLog(`Мониторинг: Возобновлен с последнего обработанного поста >>${сохраненныйПоследнийНомер} из хранилища.`, 'info');
        } else {
            установитьНомерПоследнегоОбработанногоПоста(номерПоследнегоПостаВТредеСтрока);
            localStorage.setItem(`lastMonitored_${settings.board}_${settings.threadId}`, номерПоследнегоПостаВТредеСтрока);
            addLog(`Мониторинг: Инициализирован. Будут обрабатываться посты новее >>${номерПоследнегоПостаВТредеСтрока}.`, 'info');
            return;
        }
    }

    let новыеПостыДляОбработки: DvachPost[] = [];
    if (номерПоследнегоОбработанногоПоста) {
        const последнийНомер = parseInt(номерПоследнегоОбработанногоПоста, 10);
        новыеПостыДляОбработки = текущиеПостыТреда.filter(p => parseInt(p.num, 10) > последнийНомер);
    } else {
        новыеПостыДляОбработки = текущиеПостыТреда;
    }

    if (новыеПостыДляОбработки.length === 0) {
      addLog(`Мониторинг: Новых постов не найдено в /${settings.board}/${settings.threadId} после >>${номерПоследнегоОбработанногоПоста}.`, 'info');
      return;
    }

    добавитьСводкуДействия(`Монитор: Найдено ${новыеПостыДляОбработки.length} новых постов в /${settings.board}/${settings.threadId}.`);
    addLog(`Мониторинг: Найдено ${новыеПостыДляОбработки.length} новых постов в /${settings.board}/${settings.threadId}. Обработка...`, 'gemini');

    for (const новыйПост of новыеПостыДляОбработки.sort((a,b) => parseInt(a.num, 10) - parseInt(b.num, 10))) {
      if (!settings.allowReplyToOwnBotPosts) {
        const этоСобственныйПостБота = отправленныеСообщения.some(отпрСообщ => отпрСообщ.num === новыйПост.num && отпрСообщ.isGeminiPost && отпрСообщ.board === settings.board && отпрСообщ.thread === settings.threadId);
        if (этоСобственныйПостБота) {
          const сообщПропуска = `Мониторинг: Пропуск ответа на собственный пост бота >>${новыйПост.num}.`;
          addLog(сообщПропуска, 'gemini');
          установитьНомерПоследнегоОбработанногоПоста(новыйПост.num);
          localStorage.setItem(`lastMonitored_${settings.board}_${settings.threadId}`, новыйПост.num);
          continue;
        }
      }

      addLog(`Мониторинг: Подготовка автоматического ответа Gemini на новый пост >>${новыйПост.num}.`, 'gemini');
      try {
        const постДляОтвета: DvachPost = { ...новыйПост, board: settings.board, parent: settings.threadId };
        await ответитьЧерезGeminiНаПост(постДляОтвета);

        установитьНомерПоследнегоОбработанногоПоста(новыйПост.num);
        localStorage.setItem(`lastMonitored_${settings.board}_${settings.threadId}`, новыйПост.num);
        addLog(`Мониторинг: Попытка обработки поста >>${новыйПост.num}. Обновлен номер последнего обработанного поста.`, 'gemini');

        if (новыеПостыДляОбработки.length > 1 && новыеПостыДляОбработки.indexOf(новыйПост) < новыеПостыДляОбработки.length -1) {
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
      } catch (error) {
        const errorMsg = `Мониторинг: Ошибка обработки поста >>${новыйПост.num} через Gemini: ${(error as Error).message}`;
        addLog(errorMsg, 'error', error);
        добавитьСводкуДействия(errorMsg.substring(0,100) + "...");
        установитьНомерПоследнегоОбработанногоПоста(новыйПост.num);
        localStorage.setItem(`lastMonitored_${settings.board}_${settings.threadId}`, новыйПост.num);
      }
    }
  };

  // Переименовано
  const запуститьМониторингТреда = async () => {
    if (!settings.autoMonitorDvachThreadForGemini || !settings.board || !settings.threadId) {
      addLog("Не удается запустить мониторинг: Функция отключена или не указаны Доска/ID треда.", 'warning');
      добавитьСводкуДействия("Запуск монитора: не выполнены условия.");
      return;
    }
    if (мониторингТредаАктивен || monitoringIntervalIdRef.current) {
      addLog("Мониторинг уже активен.", 'warning');
      return;
    }
     if (!dvachSessionCookies?.passcode_auth) {
      addLog("Не удается запустить мониторинг: Нет входа на Двач.", 'error');
      добавитьСводкуДействия("Монитор: Нет входа на Двач.");
      return;
    }
    if (!ai) {
      addLog("Не удается запустить мониторинг: Gemini AI не инициализирован.", 'error');
      добавитьСводкуДействия("Монитор: Gemini AI не готов.");
      return;
    }

    установитьМониторингТредаАктивен(true);
    установитьВремяНачалаМониторинга(Date.now());
    const startMsg = `Запущен мониторинг /${settings.board}/${settings.threadId} (интервал: ${settings.monitoringIntervalSeconds}с).`;
    addLog(startMsg, 'system');
    добавитьСводкуДействия(startMsg);

    let initialLastNum = localStorage.getItem(`lastMonitored_${settings.board}_${settings.threadId}`);
    if (!initialLastNum) {
        addLog("Мониторинг: Нет номера последнего обработанного поста в хранилище. Загрузка треда для установки начальной отметки...", 'info');
        try {
            const threadData = await getThreadData(settings.board, settings.threadId, settings.proxyModeForGET, settings.customProxyUrlForGET, settings.userAgent);
            const posts = threadData.threads?.[0]?.posts || [];
            if (posts.length > 0) {
                initialLastNum = posts[posts.length - 1].num;
                localStorage.setItem(`lastMonitored_${settings.board}_${settings.threadId}`, initialLastNum);
                addLog(`Мониторинг: Инициализирован. Будут обрабатываться посты новее >>${initialLastNum} в /${settings.board}/${settings.threadId}.`, 'info');
            } else {
                 addLog(`Мониторинг: Тред /${settings.board}/${settings.threadId} пуст или ошибка загрузки. Начальная отметка не установлена.`, 'warning');
            }
        } catch (error) {
            addLog(`Мониторинг: Ошибка загрузки треда для начальной отметки: ${(error as Error).message}`, 'error');
        }
    }
    установитьНомерПоследнегоОбработанногоПоста(initialLastNum);

    проверитьНовыеПосты();
    monitoringIntervalIdRef.current = setInterval(проверитьНовыеПосты, settings.monitoringIntervalSeconds * 1000);
  };

  // Переименовано
  const остановитьМониторингТреда = () => {
    if (monitoringIntervalIdRef.current) {
      clearInterval(monitoringIntervalIdRef.current);
      monitoringIntervalIdRef.current = null;
    }
    установитьМониторингТредаАктивен(false);
    установитьВремяНачалаМониторинга(null);
    const stopMsg = `Остановлен мониторинг /${settings.board}/${settings.threadId || 'N/A'}.`;
    addLog(stopMsg, 'system');
    добавитьСводкуДействия(stopMsg);
  };

  // This useEffect handles the old auto-monitoring logic for GeminiDvachConversations.
  // It should be reviewed if it conflicts with or is made redundant by the new turnkey bot.
  // For now, it's kept separate. The new turnkey bot is the primary focus of this subtask.
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
      
      intervalId = setInterval(monitorLogic, 30000); // This is the old interval, uses hardcoded 30s
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
  }, []); // Removed dependencies to ensure it only runs once or is manually controlled if kept.
  // }, [settings.autoMonitorDvachThreadForGemini, ai, currentBoard, currentThreadId, geminiDvachConversations, dvachSessionCookies, settings.proxyModeForGET, settings.customProxyUrlForGET, settings.userAgent, addLog, commonPostToDvach]);

  // useEffect for new turnkey bot monitoring lifecycle
  useEffect(() => {
    if (settings.autoMonitorDvachThreadForGemini && settings.autoStartMonitoring && settings.board && settings.threadId && ai && dvachSessionCookies?.passcode_auth) {
      addLog("Auto-starting thread monitoring due to settings.", "system");
      startThreadMonitoring();
    } else if (!settings.autoMonitorDvachThreadForGemini && isMonitoringThread) {
      addLog("Stopping thread monitoring because autoMonitorDvachThreadForGemini is now false.", "system");
      stopThreadMonitoring();
    }
    // Cleanup on component unmount or if dependencies change such that monitoring should stop
    return () => {
      if (isMonitoringThread) {
        stopThreadMonitoring();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.autoMonitorDvachThreadForGemini, settings.autoStartMonitoring, settings.board, settings.threadId, ai, dvachSessionCookies?.passcode_auth]);


  // Effect to stop/restart monitoring if board/threadId changes while active
  useEffect(() => {
    if (isMonitoringThread) {
      addLog("Board or Thread ID changed while monitoring was active. Restarting monitoring for the new target.", "system");
      stopThreadMonitoring();
      // Use a timeout to allow state updates to propagate before restarting
      setTimeout(() => {
        if (settings.autoMonitorDvachThreadForGemini && settings.board && settings.threadId && ai && dvachSessionCookies?.passcode_auth) {
          startThreadMonitoring();
        }
      }, 100);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.board, settings.threadId]);

  const handleGeminiLabImageFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      // Basic validation (optional, can be enhanced)
      const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif'];
      if (!allowedTypes.includes(file.type)) {
         addLog(`Gemini Lab: Unsupported image type: ${file.type}. Allowed: ${allowedTypes.join(', ')}`, 'warning');
         setGeminiLabImageFile(null);
         setGeminiLabImagePreview(null);
         event.target.value = ''; return;
      }
      if (file.size > 10 * 1024 * 1024) { // Example: 10MB limit
          addLog("Gemini Lab: Image file exceeds 10MB limit.", 'warning');
          setGeminiLabImageFile(null);
          setGeminiLabImagePreview(null);
          event.target.value = ''; return;
      }
      setGeminiLabImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setGeminiLabImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
        setGeminiLabImageFile(null);
        setGeminiLabImagePreview(null);
    }
  };

  const handleGeminiLabGenerate = async () => {
    if (!ai) { addLog('Gemini AI not initialized.', 'error'); return; }

    setGeminiLabLoading(true);
    setGeminiLabOutput(null);
    addLog(`Gemini Lab: Starting generation with model ${geminiLabModel}.`, 'gemini');

    try {
      const generationConfig = {
        temperature: settings.geminiTemperature,
        topP: settings.geminiTopP,
        topK: settings.geminiTopK,
        maxOutputTokens: settings.geminiMaxOutputTokens,
        responseMimeType: settings.geminiResponseMimeType, // Used for text/vision
      };

      if (geminiLabModel === GEMINI_TEXT_MODEL || geminiLabModel === GEMINI_VISION_MODEL) {
        if (!geminiLabPrompt.trim() && !geminiLabImageFile) {
          addLog('Gemini Lab: Prompt (and image for Vision model) cannot be empty.', 'warning');
          setGeminiLabLoading(false);
          return;
        }
        const parts: Part[] = [];
        if (geminiLabPrompt.trim()) parts.push({ text: geminiLabPrompt });

        if (geminiLabModel === GEMINI_VISION_MODEL && geminiLabImageFile) {
          const base64data = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(geminiLabImageFile);
          });
          parts.push({ inlineData: { mimeType: geminiLabImageFile.type, data: base64data } });
        } else if (geminiLabModel === GEMINI_VISION_MODEL && !geminiLabImageFile) {
            addLog('Gemini Lab: Vision model selected, but no image provided. Proceeding with text only if prompt exists.', 'warning');
            if (!geminiLabPrompt.trim()) { // No prompt either
                 setGeminiLabOutput("Error: Vision model selected, but no image or text prompt provided.");
                 setGeminiLabLoading(false);
                 return;
            }
        }

        const contents: Content[] = [{ role: 'user', parts }];
        if (settings.geminiSystemInstruction && (geminiLabModel === GEMINI_TEXT_MODEL || geminiLabModel === GEMINI_VISION_MODEL)) {
           // Assuming system instruction is applicable here. The SDK structure might vary.
           // For generateContent, systemInstruction is usually top-level in the request if available.
           // The current SDK for generateContent may place it within config or at a higher level.
           // Let's assume it's part of the config for this generic lab.
           // generationConfig.systemInstruction = settings.geminiSystemInstruction; // This might not be correct for all models/SDK versions.
           // The GoogleGenAI SDK for generateContent typically uses a structure like:
           // ai.getGenerativeModel({ model: geminiLabModel, systemInstruction: settings.geminiSystemInstruction}).generateContent({ contents, generationConfig })
           // For simplicity here, we'll pass systemInstruction if the model is text/vision, and log it.
           addLog(`Gemini Lab: Using system instruction: "${settings.geminiSystemInstruction.substring(0,100)}..."`, 'gemini');
        }

        const modelInstance = ai.getGenerativeModel({ model: geminiLabModel, systemInstruction: settings.geminiSystemInstruction });
        const response = await modelInstance.generateContent({ contents, generationConfig });

        setGeminiLabOutput(response.response.text() ?? "No text content returned.");
        addLog('Gemini Lab: Content generation successful.', 'success');

      } else if (geminiLabModel === GEMINI_IMAGE_MODEL) {
        if (!geminiLabPrompt.trim()) { // Changed from imageGenPrompt to geminiLabPrompt for consistency
          addLog('Gemini Lab: Image generation prompt cannot be empty.', 'warning');
          setGeminiLabLoading(false);
          return;
        }
        // const imageResponse = await ai.models.generateImages({ // Old direct model access
        const imageModel = ai.getGenerativeModel({model: GEMINI_IMAGE_MODEL}); // Get the model instance
        const imageResponse = await imageModel.generateImages({ // Call generateImages on the instance
          prompt: geminiLabPrompt, // Use the unified geminiLabPrompt
          // config: { numberOfImages: geminiLabNumImagesToGenerate, outputMimeType: 'image/jpeg' }
          // The new SDK might take generationConfig directly or specific parameters.
          // For generateImages, it's usually simpler:
           number_of_images: geminiLabNumImagesToGenerate,
        });

        if (imageResponse.response && imageResponse.response.length > 0) {
           const imagesData: GeneratedImage[] = imageResponse.response
            .map((img: any /*SdkGenerateImagesResponse*/): GeneratedImage | null => { // Type might need to be from the SDK
                if (img.image_bytes) { // Assuming the SDK returns image_bytes
                    return { base64Data: Buffer.from(img.image_bytes).toString('base64'), mimeType: 'image/png', prompt: geminiLabPrompt };
                } else if (img.image?.imageBytes) { // Fallback for older structure if any
                     return { base64Data: img.image.imageBytes, mimeType: img.image.mimeType || 'image/png', prompt: geminiLabPrompt };
                }
                return null;
            })
            .filter((img): img is GeneratedImage => img !== null);
          setGeminiLabOutput(imagesData);
          addLog(`Gemini Lab: Successfully generated ${imagesData.length} image(s).`, 'success');
        } else {
          addLog("Gemini Lab: Image generation returned no images.", 'warning');
          setGeminiLabOutput("Image generation returned no images.");
        }
      } else {
        addLog(`Gemini Lab: Unknown model selected: ${geminiLabModel}`, 'error');
        setGeminiLabOutput(`Error: Unknown model selected - ${geminiLabModel}`);
      }
    } catch (error) {
      const errorMsg = `Gemini Lab: Generation failed - ${(error as Error).message}`;
      addLog(errorMsg, 'error', error);
      setGeminiLabOutput(errorMsg);
    } finally {
      setGeminiLabLoading(false);
    }
  };

  const clearGeminiLab = () => {
    setGeminiLabPrompt('');
    setGeminiLabImageFile(null);
    setGeminiLabImagePreview(null);
    setGeminiLabOutput(null);
    // Do not reset geminiLabModel or parameters, user might want to reuse them.
    addLog("Gemini Lab inputs and output cleared.", 'info');
  };


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
      // If chat doesn't exist or if the model of the existing chat is different from the new multimodal model (e.g. old chat was text-only)
      // This check for model change might be overly simplistic if `chat.model` isn't directly accessible or comparable like this.
      // A more robust way might be to store the model used for `currentGeminiChat` in a separate state.
      // For now, we assume a new chat is needed if it's the first message or if we want to ensure the new model is used.
      if (!chat || geminiChatMessages.length <= 1 ) {
        const historyForNewChat: Content[] = geminiChatMessages
            .filter(m => m.id !== modelMessageId && (m.role === 'user' || m.role === 'model') && m.parts.length > 0) 
            .map(m => ({ role: m.role as 'user' | 'model', parts: m.parts! }));

        const chatModelInstance = ai.getGenerativeModel({ model: GEMINI_MULTIMODAL_MODEL, systemInstruction: settings.geminiSystemInstruction });
        chat = chatModelInstance.startChat({
          history: historyForNewChat,
          generationConfig: { temperature: settings.geminiTemperature, topK: settings.geminiTopK, topP: settings.geminiTopP, maxOutputTokens: settings.geminiMaxOutputTokens }
        });
        setCurrentGeminiChat(chat);
        addLog("New Gemini chat session started with " + GEMINI_MULTIMODAL_MODEL, 'gemini');
      }
      const result = await chat.sendMessageStream(userMessageParts); // Send only parts for new SDK
      let currentStreamedText = "";
      // The new SDK's sendMessageStream yields GenerateContentResponse chunks
      for await (const chunk of result.stream) {
        currentStreamedText += chunk.text() || "";
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

  // This function is for the old "Gemini Lab" text generation, will be updated by handleGeminiLabGenerate
  const handleGenericGeminiTextGeneration = async () => {
    // This function's direct usage might be deprecated by the unified handleGeminiLabGenerate
    addLog("handleGenericGeminiTextGeneration called - this might be deprecated. Check Gemini Lab panel usage.", 'warning')
    if (!ai || !промптЛабораторииGemini.trim()) { addLog("AI not initialized or prompt is empty.", 'warning'); return; }
    setGeminiLoading(true); // Should use geminiLabLoading
    // setGeminiOutputText(''); // Should use setGeminiLabOutput
    // setGroundingSources([]); // Grounding sources might not be a separate state anymore
    addLog(`Gemini generating content for prompt: "${промптЛабораторииGemini.substring(0, 50)}..."`, 'gemini');
    try {
      const modelConfig: GenerateContentParameters['config'] = {
        temperature: settings.geminiTemperature, topK: settings.geminiTopK, topP: settings.geminiTopP,
        maxOutputTokens: settings.geminiMaxOutputTokens, responseMimeType: settings.geminiResponseMimeType,
      };
      if (settings.useSearchGrounding) modelConfig.tools = [{ googleSearch: {} }];
      
      // Example for thinking budget - ensure GEMINI_MULTIMODAL_MODEL is checked if it supports this
      // if (GEMINI_MULTIMODAL_MODEL === "gemini-2.5-flash-preview-05-20") { // Check against the correct model
      //   if (!settings.useThinkingBudget) {
      //       modelConfig.thinkingConfig = { thinkingBudget: 0 };
      //   } else if (settings.geminiThinkingBudget > 0) {
      //       modelConfig.thinkingConfig = { thinkingBudget: settings.geminiThinkingBudget };
      //   }
      // }

      const modelInstance = ai.getGenerativeModel({model: GEMINI_MULTIMODAL_MODEL, systemInstruction: settings.geminiSystemInstruction});
      const response = await modelInstance.generateContent({
         contents: [{role: 'user', parts: [{text: промптЛабораторииGemini}]}],
         generationConfig: modelConfig, // Use generationConfig for new SDK
      });
      const textOutput = response.response.text() || "No text content returned.";
      // setGeminiOutputText(textOutput); // Update lab output
      установитьВыводЛабораторииGemini(textOutput);
      addLog("Gemini content generation successful.", 'success');
      // Grounding metadata access might change with new SDK
      // if (settings.useSearchGrounding && response.response.candidates?.[0]?.groundingMetadata?.groundingAttributions) {
      //   // setGroundingSources(response.candidates[0].groundingMetadata.groundingChunks);
      //   addLog(`Grounding sources found. Check response for details.`, 'gemini');
      // }
    } catch (error) {
      const errorMsg = `Gemini content generation failed: ${(error as Error).message}`;
      addLog(errorMsg, 'error', error);
      // setGeminiOutputText(errorMsg); // Update lab output
      установитьВыводЛабораторииGemini(errorMsg);
    } finally {
      setGeminiLoading(false); // Should use setGeminiLabLoading
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
    if (загруженныеПостыТреда.length === 0) { addLog('No Dvach posts loaded to analyze.', 'warning'); return; }
    установитьАнализТредаВПроцессе(true);
    установитьВыводЛабораторииGemini(''); // Clear previous output from lab
    addLog(`Gemini analyzing ${загруженныеПостыТреда.length} posts from /${текущаяДоска}/${текущийТредId}...`, 'gemini');
    const postsSummary = загруженныеПостыТреда.slice(0, 30).map(p =>
      `Post >>${p.num} (by ${p.name || 'Anon'}): "${p.comment.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>?/gm, '').substring(0, 150)}..."`
    ).join('\n');
    const analysisPrompt = `Analyze the following imageboard thread posts from 2ch.hk/${текущаяДоска}/${текущийТредId}:\n\n${postsSummary}\n\nProvide:
1. A brief overall summary of the thread's discussion.
2. Main topics or themes.
3. Common sentiments expressed.
4. Key discussions or arguments initiated by specific posts (mention post numbers if significant).
5. Suggest 2-3 potential reply angles or interesting points to engage with.
Format your response as a JSON object with keys: "summary", "mainTopics" (array of strings), "commonSentiments" (array of strings), "keyDiscussions" (array of strings), "replyAngles" (array of strings).`;
    try {
      const modelInstance = ai.getGenerativeModel({ model: GEMINI_MULTIMODAL_MODEL }); // Use the new model
      const response = await modelInstance.generateContent({
         contents: [{ role: 'user', parts: [{ text: analysisPrompt }] }],
         generationConfig: { responseMimeType: 'application/json', temperature: 0.5 } // generationConfig for new SDK
      });
      let jsonStr = (response.response.text() || "").trim();
      const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
      const match = jsonStr.match(fenceRegex);
      if (match && match[2]) jsonStr = match[2].trim();
      try {
        const parsedAnalysis: GeminiThreadAnalysis = JSON.parse(jsonStr);
        // setGeminiOutputText(JSON.stringify(parsedAnalysis, null, 2)); // Update lab output
        установитьВыводЛабораторииGemini(JSON.stringify(parsedAnalysis, null, 2));
        addLog('Gemini thread analysis successful.', 'success');
      } catch (parseError) {
        addLog('Failed to parse Gemini analysis JSON response.', 'error', {jsonStr, parseError});
        // setGeminiOutputText(`Failed to parse analysis: ${jsonStr}`); // Update lab output
        установитьВыводЛабораторииGemini(`Failed to parse analysis: ${jsonStr}`);
      }
    } catch (error) {
      const errorMsg = `Gemini thread analysis failed: ${(error as Error).message}`;
      addLog(errorMsg, 'error', error);
      // setGeminiOutputText(errorMsg); // Update lab output
      установитьВыводЛабораторииGemini(errorMsg);
    } finally {
      установитьАнализТредаВПроцессе(false);
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
          <button
            onClick={() => ответитьЧерезGeminiНаПост(post)}
            disabled={geminiLoading || загрузкаИзображенияДляGemini || !ai || постингВПроцессе || !dvachSessionCookies?.passcode_auth}
            className="px-3 py-1 text-xs bg-purple-500 hover:bg-purple-600 text-white rounded-md font-medium flex items-center shadow disabled:opacity-50 transition-colors"
            title={!ai ? "Gemini AI не инициализирован. Проверьте API ключ." : (!dvachSessionCookies?.passcode_auth ? "Не выполнен вход на Двач." : (загрузкаИзображенияДляGemini && ((settings.geminiAnalyzeOpMedia && post.op === 1) || (settings.geminiAnalyzeAnonMedia && post.op !== 1)) ? "Загрузка изображения..." : "Ответить на этот пост с помощью Gemini AI"))}>
            {(загрузкаИзображенияДляGemini && post.files && post.files.length > 0 && ((settings.geminiAnalyzeOpMedia && post.op === 1) || (settings.geminiAnalyzeAnonMedia && post.op !== 1))) ?
              <IconRefresh className="animate-spin mr-1 h-4 w-4"/> : <IconSparkles className="mr-1 h-4 w-4"/>}
            Ответить с Gemini
          </button>
      </div>
    </div>
  );

  const renderDvachBotPanel = () => {
    const isMonitoringAllowed = settings.autoMonitorDvachThreadForGemini && settings.board && settings.threadId && ai && dvachSessionCookies?.passcode_auth;
    const canManuallyStartMonitoring = settings.autoMonitorDvachThreadForGemini && settings.board && settings.threadId && ai && dvachSessionCookies?.passcode_auth;

    return (
    <div className="space-y-6 p-4 md:p-6 bg-white dark:bg-gray-800 shadow-lg rounded-lg">
      <div className="flex justify-between items-center border-b pb-3 border-gray-300 dark:border-gray-700 mb-6">
        <h2 className="text-2xl font-semibold text-blue-600 dark:text-blue-400">Операции на Дваче</h2>
        <div className="flex items-center space-x-2">
            {dvachSessionCookies?.passcode_auth ? (
                <>
                    <span className="text-xs text-green-600 dark:text-green-400 flex items-center"><IconUserCircle className="h-4 w-4 mr-1"/>Вход выполнен</span>
                    <button onClick={выйтиИзДвача} title="Выйти из Двача"
                        className="px-3 py-1 text-xs bg-red-500 hover:bg-red-600 text-white rounded-md flex items-center shadow transition-colors">
                        <IconLogout className="mr-1 h-4 w-4"/> Выйти
                    </button>
                </>
            ) : (
                <button onClick={войтиНаДвач} disabled={входНаДвачВПроцессе || !settings.purchasedPasscode}
                    className="px-3 py-1 text-xs bg-green-500 hover:bg-green-600 text-white rounded-md flex items-center shadow disabled:opacity-50 transition-colors"
                    title={!settings.purchasedPasscode ? "Сначала введите код пропуска в Настройках" : "Войти на Двач с кодом пропуска"}>
                    <IconLogin className="mr-1 h-4 w-4"/> Войти на Двач
                </button>
            )}
        </div>
      </div>

      {ошибкаЗагрузки && (
         <div className="p-3 mb-4 bg-red-100 dark:bg-red-900 border-l-4 border-red-500 rounded-md text-red-700 dark:text-red-300 text-sm" role="alert">
            <div className="flex items-start"> <IconAlertTriangle className="h-5 w-5 mr-2 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div><strong className="font-bold">Операция не удалась:</strong> <p className="mt-1 break-all">{ошибкаЗагрузки}</p>
                 <p className="mt-1 text-xs">Проверьте логи для деталей. Если это CORS/прокси ошибка для GET, проверьте Настройки. Для POST ошибок, серверлесс функция может быть недоступна или Двач заблокировал запрос. Для ошибок авторизации, попробуйте войти снова.</p>
              </div></div></div>)}

      {/* Section 1: Automated Thread Monitoring */}
      <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
        <h3 className="text-xl font-medium text-indigo-600 dark:text-indigo-400 mb-3">Automated Thread Monitoring</h3>
        {!settings.autoMonitorDvachThreadForGemini ? (
          <p className="text-sm text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900 p-3 rounded-md">
            Enable <strong className="font-semibold">"Gemini Auto-Monitors Thread for Replies (Experimental)"</strong> in <button onClick={() => setActiveTab('settings')} className="underline hover:text-yellow-700 dark:hover:text-yellow-200">Settings</button> to use this feature.
          </p>
        ) : (
          <div className="space-y-3">
            <button
              onClick={isMonitoringThread ? stopThreadMonitoring : startThreadMonitoring}
              disabled={!canManuallyStartMonitoring && !isMonitoringThread}
              className={`w-full px-4 py-2.5 text-sm font-medium rounded-md shadow-md transition-colors flex items-center justify-center
                          ${isMonitoringThread ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-green-600 hover:bg-green-700 text-white'}
                          disabled:opacity-60 disabled:cursor-not-allowed`}
              title={!canManuallyStartMonitoring && !isMonitoringThread ? "Set Board/Thread ID in settings, ensure AI is ready and logged in." : (isMonitoringThread ? "Stop Monitoring" : "Start Monitoring Thread")}
            >
              {isMonitoringThread ? <IconAlertTriangle className="mr-2 h-5 w-5"/> : <IconCpu className="mr-2 h-5 w-5"/>}
              {isMonitoringThread ? 'Stop Monitoring' : 'Start Monitoring Thread'}
            </button>

            <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-md text-xs text-gray-700 dark:text-gray-300 space-y-1">
              <p><strong>Status:</strong> {isMonitoringThread
                ? <span className="text-green-600 dark:text-green-400 font-semibold">Monitoring /<span className="font-bold">{settings.board}</span>/<span className="font-bold">{settings.threadId}</span></span>
                : <span className="text-red-600 dark:text-red-400 font-semibold">Not Monitoring</span>}
              </p>
              {isMonitoringThread && monitoringStartTime && (
                <p><strong>Monitoring Since:</strong> {new Date(monitoringStartTime).toLocaleString()}</p>
              )}
              {lastMonitoredPostNum && isMonitoringThread && (
                <p><strong>Last Checked Post:</strong> <span className="font-semibold"> &gt;&gt;{lastMonitoredPostNum}</span></p>
              )}
              {lastBotReplyTimestamp && isMonitoringThread && (
                <p><strong>Last Automated Reply:</strong> {new Date(lastBotReplyTimestamp).toLocaleString()}</p>
              )}
            </div>

            <details className="text-xs">
              <summary className="cursor-pointer text-gray-500 dark:text-gray-400 hover:underline">View Active Monitoring Settings</summary>
              <div className="mt-1 p-2 bg-gray-100 dark:bg-gray-700 rounded space-y-0.5">
                <p><strong>Interval:</strong> {settings.monitoringIntervalSeconds}s</p>
                <p><strong>Context Length:</strong> {settings.threadContextLength} posts</p>
                <p><strong>Use Full Thread Context:</strong> {settings.useFullThreadContext ? 'Yes' : 'No'}</p>
                <p><strong>Reply to Own Posts:</strong> {settings.allowReplyToOwnBotPosts ? 'Yes' : 'No'}</p>
              </div>
            </details>

            {botActionSummaries.length > 0 && (
              <div className="mt-3">
                <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Recent Bot Activity:</h4>
                <div className="max-h-32 overflow-y-auto space-y-1 text-xs p-2 bg-gray-100 dark:bg-gray-700 rounded custom-scrollbar">
                  {botActionSummaries.map(summary => (
                    <p key={summary.id} className="truncate" title={summary.message}>
                      <span className="text-gray-500 dark:text-gray-400">[{new Date(summary.timestamp).toLocaleTimeString()}]</span> {summary.message}
                    </p>
                  ))}
                </div>
              </div>
            )}
             {!settings.board && !settings.threadId && (
               <p className="text-xs text-red-500 dark:text-red-400 mt-1 text-center">Board and Thread ID must be set in global settings to start monitoring.</p>
             )}
          </div>
        )}
      </div>

      {/* Section 2: Manual Thread Interaction */}
      <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
        <h3 className="text-xl font-medium text-teal-600 dark:text-teal-400 mb-3">Manual Thread Interaction</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div><label htmlFor="dvachBoardInput" className="block text-sm font-medium text-gray-600 dark:text-gray-300">Board:</label>
                <input id="dvachBoardInput" type="text" value={currentBoard} onChange={(e) => setCurrentBoard(e.target.value)} placeholder="e.g., b" className="mt-1 w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 focus:ring-1 focus:ring-blue-500"/></div>
            <div><label htmlFor="dvachThreadInput" className="block text-sm font-medium text-gray-600 dark:text-gray-300">Thread ID (OP Post #):</label>
                <input id="dvachThreadInput" type="text" value={currentThreadId} onChange={(e) => setCurrentThreadId(e.target.value)} placeholder="e.g., 12345678 or 0 for new thread" className="mt-1 w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 focus:ring-1 focus:ring-blue-500"/></div>
            <button onClick={handleLoadThread} disabled={isFetchingThread || !currentBoard || !currentThreadId}
                className="mt-1 md:mt-6 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-md font-medium flex items-center justify-center shadow disabled:opacity-50 transition-colors h-10"
                title="Fetch posts from specified board/thread ID">
                <IconRefresh className={`mr-2 h-5 w-5 ${isFetchingThread ? 'animate-spin' : ''}`}/> Fetch Thread</button>
        </div>
      </div>

      {/* Section 3: Manual Post */}
       <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
        <h3 className="text-xl font-medium text-blue-600 dark:text-blue-400 mb-3">Manual Post</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Posts to the board/thread specified in "Manual Thread Interaction" section. If Thread ID is "0" or empty, attempts to create a new thread.</p>
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
        {postActivityLog.length > 0 && (<div className="mt-2 text-xs text-gray-500 dark:text-gray-400 space-y-0.5">{postActivityLog.map((log, i) => <p key={i} className="truncate">{log}</p>)}</div>)}
        </div>

      {/* Section 4: Thread Viewer & Gemini Tools */}
      <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
        <div className="flex flex-wrap justify-between items-center mb-3 gap-2">
            <h3 className="text-xl font-medium text-purple-600 dark:text-purple-400">Thread Viewer & Gemini Tools</h3>
            <button onClick={handleAnalyzeThreadWithGemini} disabled={isAnalyzingThread || currentFetchedDvachPosts.length === 0 || !ai}
                className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-medium flex items-center shadow disabled:opacity-50 transition-colors"
                title={!ai ? "Gemini AI not initialized" : (currentFetchedDvachPosts.length === 0 ? "No posts loaded to analyze" : "Analyze loaded thread with Gemini")}>
                <IconBrain className="mr-2 h-5 w-5"/> Analyze Thread</button></div>
        {(!currentBoard || !currentThreadId) && <p className="text-sm text-yellow-600 dark:text-yellow-400">Specify Board and Thread ID then click "Fetch Thread" to view posts.</p>}
        <div ref={threadPostsContainerRef} className="max-h-[600px] overflow-y-auto bg-gray-100 dark:bg-gray-800 p-2 rounded custom-scrollbar">
            {isFetchingThread && <p className="text-center p-4">Loading thread...</p>}
            {!isFetchingThread && currentFetchedDvachPosts.length === 0 && <p className="text-center p-4 text-gray-500 dark:text-gray-400">No posts loaded. Fetch thread or check settings.</p>}
            {currentFetchedDvachPosts.map((post,idx) => renderDvachPostCard(post, idx))}</div>
      </div>
    </div>
  );
  };

const renderGeminiLabPanel = () => (
    <div className="space-y-6 p-4 md:p-6 bg-white dark:bg-gray-800 shadow-lg rounded-lg">
      <h2 className="text-2xl font-semibold text-purple-600 dark:text-purple-400 border-b pb-2 border-gray-300 dark:border-gray-700">Gemini AI Laboratory</h2>
      {!ai && (<div className="p-3 mb-4 bg-yellow-100 dark:bg-yellow-800 border border-yellow-300 dark:border-yellow-600 rounded-md text-yellow-700 dark:text-yellow-200 text-sm flex items-center" role="alert">
            <IconAlertTriangle className="h-5 w-5 mr-2 text-yellow-500 dark:text-yellow-400 flex-shrink-0" />
            <span><strong>Gemini AI Not Initialized:</strong> Please check your API key in Settings.</span></div>)}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column: Inputs & Config */}
        <div className="space-y-4 p-4 border rounded-md border-gray-200 dark:border-gray-700">
          <div>
            <label htmlFor="geminiLabModelSelect" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Select Model:</label>
            <select id="geminiLabModelSelect" value={модельЛабораторииGemini}
                    onChange={(e) => { установитьМодельЛабораторииGemini(e.target.value); установитьВыводЛабораторииGemini(null); установитьФайлИзображенияЛаборатории(null); установитьПревьюИзображенияЛаборатории(null);}}
              className="mt-1 block w-full p-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:opacity-50"
              disabled={загрузкаВЛабораторииGemini || !ai}>
              <option value={GEMINI_MULTIMODAL_MODEL}>Gemini 2.5 Flash (Multimodal Text/Image) - {GEMINI_MULTIMODAL_MODEL}</option>
              <option value={GEMINI_IMAGE_MODEL}>Imagen (Image Generation) - {GEMINI_IMAGE_MODEL}</option>
            </select>
          </div>

          {/* System Instruction is applicable to GEMINI_MULTIMODAL_MODEL */}
          {модельЛабораторииGemini === GEMINI_MULTIMODAL_MODEL && (
            <div>
              <label htmlFor="geminiLabSystemInstruction" className="block text-sm font-medium text-gray-700 dark:text-gray-300">System Instruction (Optional):</label>
              <textarea id="geminiLabSystemInstruction" value={settings.geminiSystemInstruction}
                onChange={e => handleUpdateSettings({geminiSystemInstruction: e.target.value})}
                rows={3} placeholder="e.g., You are a helpful assistant."
                className="mt-1 w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 focus:ring-1 focus:ring-purple-500 disabled:opacity-70"
                disabled={загрузкаВЛабораторииGemini || !ai}/>
            </div>
          )}

          <div>
            <label htmlFor="geminiLabPrompt" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {модельЛабораторииGemini === GEMINI_IMAGE_MODEL ? "Image Generation Prompt:" : "Prompt:"}
            </label>
            <textarea id="geminiLabPrompt" value={промптЛабораторииGemini} onChange={(e) => установитьПромптЛабораторииGemini(e.target.value)}
              placeholder={модельЛабораторииGemini === GEMINI_IMAGE_MODEL ? "e.g., A cat wearing a superhero costume" : "Enter your prompt..."}
              className="mt-1 w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 focus:ring-1 focus:ring-purple-500 disabled:opacity-70" rows={5}
              disabled={загрузкаВЛабораторииGemini || !ai}/>
          </div>

          {/* Image upload is only relevant for the multimodal model in this new setup */}
          {модельЛабораторииGemini === GEMINI_MULTIMODAL_MODEL && (
            <div>
              <label htmlFor="geminiLabImageUpload" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Upload Image (Optional for Multimodal):</label>
              <input id="geminiLabImageUpload" type="file" accept="image/png, image/jpeg, image/webp, image/heic, image/heif"
                     onChange={handleGeminiLabImageFileChange}
                     className="mt-1 block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 dark:file:bg-purple-700 file:text-purple-700 dark:file:text-purple-100 hover:file:bg-purple-100 dark:hover:file:bg-purple-600 disabled:opacity-50"
                     disabled={загрузкаВЛабораторииGemini || !ai}/>
              {превьюИзображенияЛаборатории && <img src={превьюИзображенияЛаборатории} alt="Lab image preview" className="mt-2 max-h-40 rounded border border-gray-300 dark:border-gray-600"/>}
            </div>
          )}

          {модельЛабораторииGemini === GEMINI_IMAGE_MODEL && (
            <div>
              <label htmlFor="geminiLabNumImages" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Number of Images to Generate:</label>
              <input id="geminiLabNumImages" type="number" value={количествоИзображенийДляГенерацииВЛаборатории} onChange={(e) => установитьКоличествоИзображенийДляГенерацииВЛаборатории(parseInt(e.target.value))}
                min="1" max="8" className="mt-1 w-20 p-2 border rounded bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 focus:ring-1 focus:ring-purple-500 disabled:opacity-70"
                disabled={загрузкаВЛабораторииGemini || !ai}/>
            </div>
          )}

          <fieldset className="mt-4 pt-4 border-t border-gray-300 dark:border-gray-600">
            <legend className="text-sm font-medium text-gray-700 dark:text-gray-300">Generation Parameters</legend>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-2">
              <div><label htmlFor="labGeminiTemp" className="block text-xs font-medium">Temperature:</label>
                  <input id="labGeminiTemp" type="number" step="0.05" min="0" max="1" value={settings.geminiTemperature} onChange={e => handleUpdateSettings({geminiTemperature: parseFloat(e.target.value)})} className="mt-1 w-full p-1.5 border rounded bg-gray-50 dark:bg-gray-700 dark:border-gray-600 disabled:opacity-70" disabled={загрузкаВЛабораторииGemini || !ai}/></div>
              <div><label htmlFor="labGeminiTopP" className="block text-xs font-medium">Top P:</label>
                  <input id="labGeminiTopP" type="number" step="0.05" min="0" max="1" value={settings.geminiTopP} onChange={e => handleUpdateSettings({geminiTopP: parseFloat(e.target.value)})} className="mt-1 w-full p-1.5 border rounded bg-gray-50 dark:bg-gray-700 dark:border-gray-600 disabled:opacity-70" disabled={загрузкаВЛабораторииGemini || !ai}/></div>
              <div><label htmlFor="labGeminiTopK" className="block text-xs font-medium">Top K:</label>
                  <input id="labGeminiTopK" type="number" step="1" min="1" value={settings.geminiTopK} onChange={e => handleUpdateSettings({geminiTopK: parseInt(e.target.value)})} className="mt-1 w-full p-1.5 border rounded bg-gray-50 dark:bg-gray-700 dark:border-gray-600 disabled:opacity-70" disabled={загрузкаВЛабораторииGemini || !ai}/></div>
              <div><label htmlFor="labGeminiMaxOut" className="block text-xs font-medium">Max Tokens:</label>
                  <input id="labGeminiMaxOut" type="number" step="64" min="64" value={settings.geminiMaxOutputTokens} onChange={e => handleUpdateSettings({geminiMaxOutputTokens: parseInt(e.target.value)})} className="mt-1 w-full p-1.5 border rounded bg-gray-50 dark:bg-gray-700 dark:border-gray-600 disabled:opacity-70" disabled={загрузкаВЛабораторииGemini || !ai}/></div>
            </div>
             {/* Response MIME type is relevant for multimodal model if it can output JSON */}
             {модельЛабораторииGemini === GEMINI_MULTIMODAL_MODEL && (
                <div className="mt-2">
                    <label htmlFor="labResponseMimeType" className="block text-xs font-medium">Response MIME Type (for Multimodal):</label>
                    <select id="labResponseMimeType" value={settings.geminiResponseMimeType} onChange={e => handleUpdateSettings({geminiResponseMimeType: e.target.value as 'text/plain' | 'application/json'})}
                        className="mt-1 w-full p-1.5 border rounded bg-gray-50 dark:bg-gray-700 dark:border-gray-600 disabled:opacity-70 text-xs" disabled={загрузкаВЛабораторииGemini || !ai}>
                        <option value="text/plain">text/plain</option>
                        <option value="application/json">application/json</option>
                    </select>
                </div>
            )}
          </fieldset>

          <div className="flex space-x-3 mt-6">
            <button onClick={handleGeminiLabGenerate} disabled={загрузкаВЛабораторииGemini || !ai}
              className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md flex items-center justify-center disabled:opacity-50 shadow transition-colors">
              {загрузкаВЛабораторииGemini ? <IconRefresh className="animate-spin mr-2 h-5 w-5"/> : <IconWand className="mr-2 h-5 w-5"/>}
              Generate
            </button>
            <button onClick={clearGeminiLab} disabled={загрузкаВЛабораторииGemini}
              className="px-3 py-2 bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-800 dark:text-gray-200 rounded-md flex items-center disabled:opacity-50 shadow transition-colors" title="Clear inputs and output">
              <IconTrash className="h-5 w-5"/>
            </button>
          </div>
        </div>

        {/* Right Column: Output */}
        <div className="p-4 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 min-h-[300px]">
          <h3 className="text-lg font-medium mb-2 text-gray-700 dark:text-gray-300">Output</h3>
          {geminiLabLoading && <p className="text-center text-gray-500 dark:text-gray-400">Generating...</p>}
          {!geminiLabLoading && !geminiLabOutput && <p className="text-center text-gray-500 dark:text-gray-400">Output will appear here.</p>}
          {geminiLabOutput && (
            typeof geminiLabOutput === 'string' ? (
              <pre className="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200 custom-scrollbar max-h-[500px] overflow-y-auto p-2 bg-white dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-500">{geminiLabOutput}</pre>
            ) : ( // Assuming it's GeneratedImage[]
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 custom-scrollbar max-h-[500px] overflow-y-auto">
                {(geminiLabOutput as GeneratedImage[]).map((img, idx) => (
                  <div key={idx} className="border rounded-md p-1 bg-white dark:bg-gray-800 shadow">
                    <img src={`data:${img.mimeType};base64,${img.base64Data}`} alt={img.prompt || `Generated Lab Image ${idx + 1}`} className="w-full h-auto rounded"/>
                    {img.prompt && <p className="text-xs mt-1 text-gray-500 dark:text-gray-400 truncate" title={img.prompt}>{img.prompt}</p>}
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>
       {/* Standalone Chat - kept separate from the Lab's direct model interaction section */}
       <div className="p-4 border rounded-md border-gray-200 dark:border-gray-700 mt-6">
            <h3 className="text-lg font-medium mb-2 text-gray-700 dark:text-gray-300">Standalone Gemini Chat (Legacy)</h3>
            {/* ... existing chat UI ... */}
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
            <button onClick={clearGeminiChatHistory} className="text-xs text-gray-500 hover:underline mt-1 disabled:opacity-50" disabled={geminiChatMessages.length === 0 || geminiLoading || isStreamingChat}>Clear Chat History</button>
            </div>
    </div>
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

        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
          <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
            <input type="checkbox" checked={settings.useFullThreadContext} onChange={e => handleUpdateSettings({useFullThreadContext: e.target.checked})} className="mr-2 h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"/>
            Provide Full Thread Context to Gemini for Replies
          </label>
          {settings.useFullThreadContext && (
            <div className="mt-1 pl-6">
              <label htmlFor="settingsThreadContextLength" className="block text-xs font-medium text-gray-600 dark:text-gray-400">Number of preceding posts for context:</label>
              <input id="settingsThreadContextLength" type="number" step="1" min="1" max="25" value={settings.threadContextLength}
                     onChange={e => handleUpdateSettings({threadContextLength: parseInt(e.target.value)})}
                     className="mt-1 w-24 p-1.5 border rounded bg-gray-50 dark:bg-gray-700 dark:border-gray-600 text-sm"/>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Max 25. Be mindful of token limits.</p>
            </div>
          )}
        </div>

        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
          <h4 className="text-md font-medium text-gray-700 dark:text-gray-300 mb-2">Turnkey Bot / Monitoring</h4>
          <label className="flex items-center text-sm">
            <input type="checkbox" checked={settings.autoStartMonitoring} onChange={e => handleUpdateSettings({autoStartMonitoring: e.target.checked})} className="mr-2 h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"/>
            Auto-start monitoring on app load (if "Gemini Auto-Monitors" is also enabled)
          </label>
          <label className="flex items-center text-sm mt-1">
            <input type="checkbox" checked={settings.allowReplyToOwnBotPosts} onChange={e => handleUpdateSettings({allowReplyToOwnBotPosts: e.target.checked})} className="mr-2 h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"/>
            Allow bot to reply to its own (Gemini-generated) posts
          </label>
          <div className="mt-1">
            <label htmlFor="settingsMonitoringInterval" className="block text-xs font-medium text-gray-600 dark:text-gray-400">Monitoring Interval (seconds):</label>
            <input id="settingsMonitoringInterval" type="number" step="5" min="15" max="600" value={settings.monitoringIntervalSeconds}
                   onChange={e => handleUpdateSettings({monitoringIntervalSeconds: parseInt(e.target.value)})}
                   className="mt-1 w-24 p-1.5 border rounded bg-gray-50 dark:bg-gray-700 dark:border-gray-600 text-sm"/>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Min 15s. How often to check for new posts.</p>
          </div>
        </div>
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
          <h1 className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400">Двач Gemini Бот</h1>
          <div className="flex items-center space-x-2 sm:space-x-4">
            <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              aria-label={`Переключить тему (текущая: ${settings.theme})`} title={`Изменить тему. Текущая: ${settings.theme}. Нажмите для смены.`}>
              <ThemeIcon className="h-5 w-5 sm:h-6 sm:w-6" /></button></div></div></header>
      <nav className="bg-gray-50 dark:bg-gray-800 border-b border-t border-gray-200 dark:border-gray-700 sticky top-[56px] sm:top-[68px] z-40">
        <div className="container mx-auto flex justify-center sm:justify-start flex-wrap">
          {[{ id: 'dvach', label: 'Операции Двач', icon: IconCpu }, { id: 'gemini', label: 'Лаборатория Gemini', icon: IconSparkles },
            { id: 'settings', label: 'Настройки', icon: IconSettings }, { id: 'logs', label: 'Логи', icon: IconTerminal }].map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as 'dvach' | 'gemini' | 'settings' | 'logs')}
              aria-current={activeTab === tab.id ? "page" : undefined}
              className={`flex items-center px-2 sm:px-3 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 transition-all duration-150 ease-in-out focus:outline-none focus:ring-1 focus:ring-blue-400
                ${activeTab === tab.id ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'}`}>
              <tab.icon aria-hidden="true" className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-1.5 flex-shrink-0" />
              <span className="truncate">{tab.label}</span></button>))}</div></nav>
      <main className="container mx-auto p-3 sm:p-4 md:p-6" role="main"><div className="mt-1 sm:mt-2">
            {activeTab === 'dvach' && renderDvachBotPanel()}
            {activeTab === 'gemini' && renderGeminiLabPanel()}
            {activeTab === 'settings' && renderSettingsPanel()}
            {activeTab === 'logs' && renderLogsPanel()}</div></main>
      <footer className="text-center py-4 border-t border-gray-200 dark:border-gray-700 mt-8">
        <p className="text-xs text-gray-500 dark:text-gray-400">Интерфейс Двач Gemini Бота - Версия {APP_VERSION} - Используйте ответственно.</p></footer></div>
  );
};
export default App;