// constants.ts - Store widely used, unchanging values for the application.
import { AppSettings, SafetySettingRule } from '../core/types';

export const DVACH_DOMAINS: string[] = ["https://2ch.su", "https://2ch.hk", "https://2ch.life"];

export const PROXY_URL_CORS_ANYWHERE_OFFICIAL = "https://cors-anywhere.com/"; // User-provided
export const PROXY_URL_X2U_KEYED_BASE = "https://go.x2u.in/proxy?email=early4@punkproof.com&apiKey=d97e1643&url="; // User-provided

export const DEFAULT_CORS_ANYWHERE_PROXY = "https://cors-anywhere.herokuapp.com/"; // Standard public instance - kept for legacy or other uses
export const PROXY_URL_GO_X2U_BASE = "https://go.x2u.in/proxy?url="; // Common go.x2u.in structure
export const PROXY_URL_CODETABS_BASE = "https://api.codetabs.com/v1/proxy?quest=";


// Keys for localStorage items
export const APP_SETTINGS_KEY = "dvach_gemini_app_settings_v2.12_no_lab";
export const SENT_MESSAGES_KEY = "dvach_gemini_sent_messages_v2.12_no_lab";
export const GEMINI_DVACH_CONVERSATIONS_KEY = "gemini_dvach_conversations_v2.12_no_lab";
export const DVACH_SESSION_COOKIES_KEY = "dvach_session_cookies_v1.1";


export const APP_VERSION = "2.12.0";
export const GEMINI_TEXT_MODEL_DEFAULT = "gemini-2.5-flash";
export const SUPPORTED_GEMINI_TEXT_MODELS = [
  "gemini-3-pro-preview",
  "gemini-2.5-pro",
  "gemini-2.5-flash",
  "gemini-2.5-flash-preview-09-2025",
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash-lite-preview-09-2025",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
];
export const GEMINI_IMAGE_MODEL = "gemini-2.5-flash-image";
export const AUTONOMOUS_BOT_MAX_OUTPUT_TOKENS = 8000;

export const THREAD_CACHE_DURATION_MS = 1 * 45 * 1000;
export const MAX_LOG_ENTRIES = 300;
export const MAX_SENT_MESSAGES_STORED = 200;
export const DEFAULT_MAX_IMAGES_TO_ANALYZE_PER_POST = 1;
export const BUMP_KEYWORDS = ["bump", "бамп", "ап", "up", "апну", "бампую", "bump^", "бaмп"];

export const DEFAULT_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export const DEFAULT_GEMINI_SAFETY_SETTINGS: SafetySettingRule[] = [
  { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
  { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
  { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
  { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
];

const envKeyIsAvailableForDefaults = typeof process.env.API_KEY === 'string' && process.env.API_KEY.length > 0;


export const DEFAULT_APP_SETTINGS: AppSettings = {
  botOperationMode: 'observer',
  persona: 'Intellectual/Analyst',
  board: "b",
  threadId: "",
  dvachBaseDomainIndex: 0,
  dvachDomainUsageMode: "predefined",
  customDvachDomain: "",

  purchasedPasscode: "",

  geminiApiKeySource: envKeyIsAvailableForDefaults ? 'env' : 'user',
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
  geminiMediaResolution: 'high',

  autonomousBotTargetBoard: "b",
  autonomousBotTargetThreadId: "",
  autonomousBotSystemPrompt: "Ты — анонимный пользователь имиджборда. Твоя цель — поддерживать интересный и живой диалог. Задавай вопросы, делись мнениями и старайся вовлечь других в разговор. Не отвечай самому себе. Твои ответы должны быть остроумными, ироничными или информативными, в зависимости от контекста. Пиши в стиле, характерном для имиджбордов. Обращай внимание на историю беседы, включая свои предыдущие сообщения, чтобы избегать повторений и давать разнообразные ответы. Ты должен ответить в формате JSON { \"replyText\": \"твой ответ\" }.",
  botAnalyzesImagesInTriggerPosts: true,
  autonomousBotReplyMode: 'random_in_thread',
  autonomousBotCycleIntervalSeconds: 75,
  autonomousBotMinPostIntervalSeconds: 60,
  autonomousBotAllowReplyToSelf: false,
  autonomousBotInitialContextScope: 'op_only',
  autonomousBotFullThreadContextMaxChars: 5000,
  autonomousBotMinReplyDelayMs: 2000,
  autonomousBotMaxReplyDelayMs: 7000,
  autonomousBotDisableThinking: false,

  geminiSystemInstruction: "You are a witty and insightful anonymous user on an imageboard. Your replies should be relevant, concise, and in the typical style of the board. If quoting, use '>>POST_NUMBER\\n'. No meta-comments. Your primary focus is generating text for the Dvach reply; image generation will be handled separately if needed.",
  geminiTemperature: 0.8,
  geminiTopP: 0.95,
  geminiTopK: 40,
  geminiMaxOutputTokens: 1024,
  geminiResponseMimeType: "text/plain", // Manual replies can be text/plain

  enableRepetitivePostingMode: false,
  repetitivePostMessage: "Test post.",
  repetitivePostCount: 3,
  repetitivePostDelay: 5,
  enablePrefilledPostingMode: false,
  prefilledPostMessages: "Message 1\nMessage 2 >>TARGET_POST_NUM",
  prefilledPostTargets: "",
  geminiTextModel: GEMINI_TEXT_MODEL_DEFAULT,
};