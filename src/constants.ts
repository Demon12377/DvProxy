
// constants.ts - Store widely used, unchanging values for the application.

export const DVACH_DOMAINS: string[] = ["https://2ch.hk", "https://2ch.life", "https://2ch.su"];

export const DEFAULT_CORS_ANYWHERE_PROXY = "https://cors-anywhere.com/"; // Standard public instance
export const PROXY_URL_GO_X2U_BASE = "https://go.x2u.in/proxy?url="; // Common go.x2u.in structure
export const PROXY_URL_CODETABS_BASE = "https://api.codetabs.com/v1/proxy?quest=";


// Keys for localStorage items
export const APP_SETTINGS_KEY = "dvach_gemini_app_settings_v2.8_bot_overhaul"; 
export const SENT_MESSAGES_KEY = "dvach_gemini_sent_messages_v2.8_bot_overhaul";
export const GEMINI_DVACH_CONVERSATIONS_KEY = "gemini_dvach_conversations_v2.8_bot_overhaul";
export const DVACH_SESSION_COOKIES_KEY = "dvach_session_cookies_v1.1";


export const APP_VERSION = "2.8.0"; 
export const GEMINI_TEXT_MODEL = "gemini-2.5-flash-preview-04-17";
export const GEMINI_IMAGE_MODEL = "imagen-3.0-generate-002";

export const THREAD_CACHE_DURATION_MS = 1 * 45 * 1000; // 45 seconds cache for thread data (used in dvachService for its own cache)
export const MAX_LOG_ENTRIES = 300;
export const MAX_SENT_MESSAGES_STORED = 200;
export const DEFAULT_MAX_IMAGES_TO_ANALYZE_PER_POST = 1; // Default for settings
export const BUMP_KEYWORDS = ["bump", "бамп", "ап", "up", "апну", "бампую", "bump^", "бaмп"]; // Added Cyrillic 'a'

// Default User-Agent for client-side GETs and passed to serverless functions.
export const DEFAULT_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
