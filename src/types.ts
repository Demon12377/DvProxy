/// <reference types="vite/client" />
import { Chat as GeminiChatInstanceTypeSDK, Part, GenerateContentResponse as ActualGenerateContentResponse, FinishReason as SDKFinishReason } from "@google/genai";

// Dvach API Types (aligned with OpenAPI spec where possible)
export interface DvachFile {
  name: string; // displayname from API
  fullname?: string; // fullname from API
  path: string; // Relative path to file on server
  thumbnail: string; // Relative path to thumbnail
  md5?: string;
  type: number; // FileType enum from API (e.g., 1: jpg, 2: png, 6: webm)
  size: number; // Size in KB from API in spec, but often in bytes in practice. Be mindful.
  width: number;
  height: number;
  tn_width: number;
  tn_height: number;
  duration?: string; // e.g., "00:00:53"
  duration_secs?: number;
  nsfw?: number; // 0 or 1 usually
  sticker?: string; // Sticker ID if type is 100
  pack?: string; // Sticker pack ID
  install?: string; // Sticker install link
}

export interface DvachPost {
  num: string; // Post number, always treat as string
  parent: string; // Thread OP number (for replies) or "0" for OP itself, always treat as string
  board?: string; // Board ID, useful when posts are out of thread context
  timestamp: number; // Unix timestamp
  lasthit?: number; // Unix timestamp of last bump for the thread (present on all posts in a thread response)
  date?: string; // Formatted date string from API
  email?: string; // mailto:sage or actual email
  subject?: string;
  comment: string; // HTML comment
  files?: DvachFile[];
  views?: number; // For OP post in catalog/threads list
  sticky?: number; // 0 or 1+
  closed?: number; // 0 or 1 (present on OP post if thread is closed)
  banned?: number; // 0 or 1 (if poster was banned for this post)
  op?: number; // 0 or 1 (1 if this post is by the OP of the thread)
  name?: string; // Poster name
  trip?: string;
  trip_style?: string; // For admin/mod trips
  icon?: string; // HTML string for flag/icon
  tags?: string; // Comma-separated or single tag (usually on OP post)
  likes?: number; // If likes enabled
  dislikes?: number; // If likes enabled
  posts_count?: number; // For OP post in catalog/threads list (number of replies)
  files_count?: number; // For OP post in catalog/threads list
  score?: number; // For threads.json (not used here)
  number?: number; // For posts within a thread response, usually indicates order (makaba.md specific)
}

// Response for /{board}/res/{thread_id}.json
export interface DvachThreadResponse {
  board?: string; // Board ID
  current_thread: string; // Thread ID (OP post number)
  max_num?: string; // Max post number in thread
  posts_count?: number; // Total posts in thread
  files_count?: number; // Total files in thread
  unique_posters?: number;
  is_closed?: number; // 0 or 1
  title?: string; // Thread title (from OP subject)
  thread_first_image?: string; // path to first image of OP
  is_board?: boolean; // false
  is_index?: boolean; // false
  file_prefix?: string; // for old archived threads
  threads: Array<{ // Dvach wraps posts in a threads array, even for a single thread response
    posts: DvachPost[];
  }>;
  // May include BoardBanner fields directly too.
  advert_top_image?: string;
  advert_top_link?: string;
  advert_bottom_image?: string;
  advert_bottom_link?: string;
  advert_mobile_image?: string;
  advert_mobile_link?: string;
  board_banner_image?: string;
  board_banner_link?: string;
}

// For API responses from /api/dvach-post and /api/dvach-login
export interface DvachPostApiResponse {
  result: number; // 0 for error, 1 for success (can also be 2 for passcode already active)
  reason?: string; // Error message from Dvach (makaba.md style)
  Error?: string; // Alternative error message (makaba.md style, less common now)
  error?: { code: number; message: string; }; // OpenAPI style error
  num?: string; // New post number (for replies), ensure string
  thread?: string; // New thread number (for new threads), ensure string
  target?: string; // Alternative for new thread number, ensure string
  status?: string; // Can be "OK" (old API for /user/passlogout)
  // For login success specifically (added by serverless function):
  message?: string; // e.g., "Dvach login successful."
  passcode_auth_cookie_value?: string;
  user_code_cookie_value?: string;
  passcode?: { // from Dvach's /user/passlogin?json=1
    type?: string;
    expires?: number;
  };
  [key: string]: any; // Allow other potential fields
}


// For API errors (parsed from DvachPostApiResponse or other error scenarios)
export interface DvachApiError {
  code: number; // Dvach specific error code (e.g., -19) or HTTP status
  message: string;
}


// Application Specific Types
export interface SentMessageInfo {
  num: string; // Post number of the sent message
  timestamp: number;
  comment: string;
  board: string;
  thread: string; // Thread ID (OP post number) this message belongs to
  parent?: string; // Post number this message replied to, if any
  file_info?: { name: string; size: number; hash?: string }; // Info about attached file
  isGeminiPost?: boolean;
  geminiTriggerPostNum?: string;
  geminiGeneratedImage?: boolean;
  geminiConversationId?: string;
  isBotSeedPost?: boolean;
}

export type ProxyModeForGET =
  | 'vercel_serverless'
  | 'custom_go_x2u'
  | 'custom_cors_anywhere'
  | 'custom_codetabs'
  | 'custom_general_prefix'
  | 'custom_general_param'
  | 'none';

export interface DvachSessionCookies {
  passcode_auth: string | null;
  usercode: string | null;
}

export type AutonomousBotReplyMode =
  | 'replies_to_bot'
  | 'random_in_thread';

export type AutonomousBotInitialContextScope =
  | 'op_only'
  | 'full_thread';

// Using string literals for HarmCategory and HarmBlockThreshold as enums might not be available in ESM build
export type HarmCategoryStrings =
  | "HARM_CATEGORY_UNSPECIFIED"
  | "HARM_CATEGORY_HARASSMENT"
  | "HARM_CATEGORY_HATE_SPEECH"
  | "HARM_CATEGORY_SEXUALLY_EXPLICIT"
  | "HARM_CATEGORY_DANGEROUS_CONTENT";

export type HarmBlockThresholdStrings =
  | "HARM_BLOCK_THRESHOLD_UNSPECIFIED"
  | "BLOCK_ONLY_HIGH"
  | "BLOCK_MEDIUM_AND_ABOVE"
  | "BLOCK_LOW_AND_ABOVE"
  | "BLOCK_NONE";

export interface SafetySettingRule {
  category: HarmCategoryStrings;
  threshold: HarmBlockThresholdStrings;
}

export interface AppSettings {
  // Global Dvach Settings (used by Manual Ops tab inputs primarily)
  board: string;
  threadId: string;
  dvachBaseDomainIndex: number; // New: Index for DVACH_DOMAINS
  dvachDomainUsageMode: 'predefined' | 'custom'; // New: Mode for domain usage
  customDvachDomain: string; // New: Custom domain URL

  purchasedPasscode: string;

  geminiApiKeySource: 'env' | 'user';
  userGeminiApiKey: string;

  theme: 'light' | 'dark' | 'system';

  // Proxy settings (primarily client-side for GETs not covered by serverless)
  proxyModeForGET: ProxyModeForGET; // For thread data, if not 'vercel_serverless'
  customProxyUrlForGET: string;

  proxyModeForImagesGET: ProxyModeForGET; // Specifically for fetching images/media by client
  customProxyUrlForImagesGET: string;

  userAgent: string;

  // Manual Gemini Reply settings (for Manual Ops tab)
  geminiAnalyzeOpMedia: boolean;
  geminiAnalyzeAnonMedia: boolean;

  // Global Gemini interaction settings (applies to both Manual and Bot where relevant)
  geminiReplyWithGeneratedImage: boolean;
  maxImagesToAnalyzePerPost: number;
  analyzeVideosInTriggerPosts: boolean; // Placeholder, not fully implemented
  geminiSafetySettings: SafetySettingRule[]; 

  // Autonomous Bot specific settings
  autonomousBotTargetBoard: string;
  autonomousBotTargetThreadId: string;
  autonomousBotSystemPrompt: string;
  botAnalyzesImagesInTriggerPosts: boolean;
  autonomousBotReplyMode: AutonomousBotReplyMode;
  autonomousBotCycleIntervalSeconds: number;
  autonomousBotAllowReplyToSelf: boolean;
  autonomousBotInitialContextScope: AutonomousBotInitialContextScope; 
  autonomousBotFullThreadContextMaxChars: number;
  autonomousBotMinReplyDelayMs: number;
  autonomousBotMaxReplyDelayMs: number;
  autonomousBotDisableThinking: boolean;

  // Gemini Model Configuration (for Manual Gemini Replies to Dvach posts)
  geminiSystemInstruction: string; 
  geminiTemperature: number;
  geminiTopP: number;
  geminiTopK: number;
  geminiMaxOutputTokens: number;
  geminiResponseMimeType: 'text/plain' | 'application/json'; // For manual replies; bot forces JSON.
  useThinkingBudget: boolean; // For manual replies
  geminiThinkingBudget: number; // For manual replies


  // Repetitive Posting Mode (Advanced/Botting Feature) - Kept from original, might be unused
  enableRepetitivePostingMode: boolean;
  repetitivePostMessage: string;
  repetitivePostCount: number;
  repetitivePostDelay: number;

  // Pre-filled Posting Mode (Advanced/Botting Feature) - Kept from original, might be unused
  enablePrefilledPostingMode: boolean;
  prefilledPostMessages: string;
  prefilledPostTargets: string;
}

export interface LogEntry {
  id: string;
  timestamp: number;
  message: string;
  type: 'info' | 'error' | 'success' | 'warning' | 'gemini' | 'dvach' | 'system' | 'auth' | 'bot_activity' | 'bot_error' | 'bot_setup' | 'bot_warning';
  data?: unknown;
}

export interface ChatMessage { // Primarily for Bot's internal conversation history
  id: string;
  role: 'user' | 'model' | 'system';
  parts: Part[];
  timestamp: number;
  imagePreview?: string; // Optional: If we want to show images related to this message in some debug UI
  isLoading?: boolean; // Not typically used for stored history
  isStreaming?: boolean; // Not typically used for stored history
}

export type GeminiChatInstance = GeminiChatInstanceTypeSDK; // Use SDK type

export interface GeneratedImage { // For image generation via manual replies
  base64Data: string;
  mimeType: string;
  prompt?: string;
}

export interface GeminiDvachConversation {
  id: string; // e.g., "board_threadId"
  board: string;
  threadId: string;
  triggerPostNum: string;
  botSystemPromptUsed: string;
  // geminiChatInstance removed as bot directly uses history with generateContent
  history: ChatMessage[];
  lastCheckedTimestamp: number;
  lastBotReplyNum?: string;
  participatingPostNumbers: string[];
  status: 'active' | 'dormant' | 'ended_by_bot' | 'error' | 'archived' | 'bot_seeded' | 'context_built';
  initialContext?: {
    opPostNum?: string;
    opPostText?: string;
    opPostImagePreviews?: string[];
    opPostMediaParts?: Part[];
    precedingPostsText?: string[];
    targetPostText?: string;
    targetPostImagePreviews?: string[];
  };
  isBotSeedConversation?: boolean;
  initialBotPostNum?: string;
}

// Types related to Gemini Grounding (for CustomGenerateContentResponse)
export interface GroundingChunk {
  web?: {
    uri?: string;
    title?: string;
  };
  retrievedContext?: {
    uri?: string;
    title?: string;
  };
}

export interface GroundingMetadata {
  webSearchQueries?: string[];
  groundingAttribution?: {
     sourceId: string;
     content: {
       text: string;
       title?: string;
       uri?: string;
     }
  }[];
}

type SDKCandidate = NonNullable<ActualGenerateContentResponse['candidates']>[0];
type ActualFinishReason = SDKFinishReason; // Keep SDK's FinishReason

export interface CustomGenerateContentResponse extends ActualGenerateContentResponse {
  candidates?: (SDKCandidate & { groundingMetadata?: GroundingMetadata; finishReason?: ActualFinishReason | string })[];
}

// Cache for OP media to avoid refetching/reprocessing constantly for the bot
export interface BotOpMediaCache {
  threadId: string; // Full thread ID this cache belongs to
  opPostNum: string; // OP post number
  mediaParts: Part[]; // Processed Gemini Parts for OP media
  mediaContextText: string; // A textual description/summary of the OP media for prompts
}

export interface ActiveTask {
  id: string;
  type: 'bot_cycle' | 'gemini_request' | 'dvach_post';
  description: string;
  startTime: number;
  stop?: () => void; // Optional function to attempt to stop the task
}