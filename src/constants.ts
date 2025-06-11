// constants.ts - Store widely used, unchanging values for the application.

// This constant is used by App.tsx for default settings (domain cycling for GET).
export const DVACH_DOMAINS: string[] = ["https://2ch.hk", "https://2ch.life", "https://2ch.su"];

// This constant is used by services/dvachService.ts if VITE_CORS_ANYWHERE_PROXY_URL is not set for GET requests.
// App.tsx also references it for display in settings.
export const DEFAULT_CORS_ANYWHERE_PROXY = "https://cors-anywhere.herokuapp.com/"; 
export const PROXY_URL_GO_X2U_BASE = "https://go.x2u.in/proxy?email=early4@punkproof.com&apiKey=d97e1643&url=";


// Keys for localStorage items, used in App.tsx
export const APP_SETTINGS_KEY = "dvach_gemini_app_settings_v2.4_bot_control"; // Incremented version
export const SENT_MESSAGES_KEY = "dvach_gemini_sent_messages_v2.3_bot_control";
export const GEMINI_CHAT_HISTORY_KEY = "gemini_standalone_chat_history_v2.3_bot_control";
export const GEMINI_DVACH_CONVERSATIONS_KEY = "gemini_dvach_conversations_v2.0_bot_control";
export const DVACH_SESSION_COOKIES_KEY = "dvach_session_cookies_v1.1";


export const APP_VERSION = "2.4.0"; // Updated version for bot control panel
export const GEMINI_TEXT_MODEL = "gemini-2.5-flash-preview-04-17";
export const GEMINI_IMAGE_MODEL = "imagen-3.0-generate-002";

export const THREAD_CACHE_DURATION_MS = 1 * 45 * 1000; // 45 seconds cache for thread data (used in dvachService for its own cache)
export const MAX_LOG_ENTRIES = 300;
export const MAX_SENT_MESSAGES_STORED = 200;

// Default User-Agent for client-side GETs and passed to serverless functions.
// Can be overridden in settings.
export const DEFAULT_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
