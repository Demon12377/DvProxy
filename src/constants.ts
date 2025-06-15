
// constants.ts - Store widely used, unchanging values for the application.
import { SafetySettingRule } from './types';

export const DVACH_DOMAINS: string[] = ["https://2ch.hk", "https://2ch.life", "https://2ch.su"];

export const DEFAULT_CORS_ANYWHERE_PROXY = "https://cors-anywhere.herokuapp.com/"; // Standard public instance
export const PROXY_URL_GO_X2U_BASE = "https://go.x2u.in/proxy?url="; // Common go.x2u.in structure
export const PROXY_URL_CODETABS_BASE = "https://api.codetabs.com/v1/proxy?quest=";


// Keys for localStorage items
export const APP_SETTINGS_KEY = "dvach_gemini_app_settings_v2.11_streaming_lab"; 
export const SENT_MESSAGES_KEY = "dvach_gemini_sent_messages_v2.11_streaming_lab";
export const GEMINI_DVACH_CONVERSATIONS_KEY = "gemini_dvach_conversations_v2.11_streaming_lab";
export const DVACH_SESSION_COOKIES_KEY = "dvach_session_cookies_v1.1";
export const GEMINI_LAB_CHAT_HISTORY_KEY = "gemini_lab_chat_history_v2.11";


export const APP_VERSION = "2.11.0"; 
export const GEMINI_TEXT_MODEL = "gemini-2.5-flash-preview-04-17";
export const GEMINI_IMAGE_MODEL = "imagen-3.0-generate-002";
export const AUTONOMOUS_BOT_MAX_OUTPUT_TOKENS = 8000; // Increased for autonomous bot

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
