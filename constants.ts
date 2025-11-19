
import { AppSettings } from './types';

export const DVACH_DOMAINS: string[] = ["https://2ch.su", "https://2ch.life", "https://2ch.org"];
export const DEFAULT_PASSCODE: string = "7Iey09PSeH8R4CtxmMRyAVM79HAkZoUhH3wdZEG3wZVZ6IxpRlIPEi4785B7Vfdf";
export const DEFAULT_CORS_ANYWHERE_PROXY = "https://cors-anywhere.com/"; // Note: this is a public demo instance.

export const DEFAULT_APP_SETTINGS: AppSettings = {
  board: "b",
  threadId: "",
  passcode: DEFAULT_PASSCODE,
  geminiApiKeySource: 'env',
  userGeminiApiKey: "",
  useRandomDelayNormal: false,
  useRandomDelaySecure: false,
  allowReplyToSelf: false,
  currentDomainIndex: 0,
  theme: 'system',
  geminiReplyWithImage: false, 
  autoMonitorDvachThreadForGemini: false,
  proxyMode: 'cors-anywhere', // Default to using cors-anywhere
  customProxyUrl: "", // Empty by default
};

export const GEMINI_TEXT_MODEL = "gemini-2.5-flash-preview-04-17";
export const GEMINI_IMAGE_MODEL = "imagen-3.0-generate-002";

export const MAX_REPLIES_PER_POST_BATCH = 10; 
export const USER_AGENT_FILE_NAME = "user_agent_dvach_bot.txt"; 
export const AUTH_TOKEN_KEY = "dvach_auth_token_encrypted";
export const ENCRYPTION_KEY_LOCALSTORAGE = "dvach_encryption_key";
export const SENT_MESSAGES_KEY = "dvach_sent_messages";
export const APP_SETTINGS_KEY = "dvach_app_settings";
export const GEMINI_DVACH_CONVERSATIONS_KEY = "gemini_dvach_conversations";
export const THREAD_CACHE_DURATION_MS = 60000; // 60 seconds for thread data cache
