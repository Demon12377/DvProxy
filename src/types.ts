
import { Chat as GeminiChatInstanceType, Part, GenerateContentResponse as GeminiGenerateContentResponseSDK } from "@google/genai"; // GeminiChat renamed to GeminiChatInstanceType

// Dvach API Types (aligned with OpenAPI spec where possible)
export interface DvachFile {
  name: string; // displayname from API
  fullname?: string; // fullname from API
  path: string; // Relative path to file on server
  thumbnail: string; // Relative path to thumbnail
  md5?: string;
  type: number; // FileType enum from API (0: none, 1: jpg, 2: png, 4: gif, 6: webm, 10: mp4 etc.)
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
  parent: string; // Thread number (OP post num), or "0" for OP itself, always treat as string
  board?: string; // Board ID, useful when posts are out of thread context
  timestamp: number; // Unix timestamp
  lasthit?: number; // Unix timestamp of last bump
  date?: string; // Formatted date string from API
  email?: string; // mailto:sage or actual email
  subject?: string;
  comment: string; // HTML comment
  files?: DvachFile[];
  views?: number;
  sticky?: number; // 0 or 1+
  closed?: number; // 0 or 1
  banned?: number; // 0 or 1
  op?: number; // 0 or 1 // 1 if this post is by the OP of the thread
  name?: string; // Poster name
  trip?: string;
  trip_style?: string; // For admin/mod trips
  icon?: string; // HTML string for flag/icon
  tags?: string; // Comma-separated or single tag
  likes?: number;
  dislikes?: number;
  posts_count?: number; // For OP post in catalog/threads list
  files_count?: number; // For OP post in catalog/threads list
  score?: number; // For threads.json
  number?: number; // For posts within a thread response, usually indicates order.
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
export interface DvachPostApiResponse { // Also used for login response structure where applicable
  result: number; // 0 for error, 1 for success (can also be 2 for passcode already active)
  reason?: string; // Error message from Dvach (makaba.md style)
  Error?: string; // Alternative error message (makaba.md style, less common now)
  error?: { code: number; message: string; }; // OpenAPI style error
  num?: string; // New post number (for replies), ensure string
  thread?: string; // New thread number (for new threads), ensure string
  target?: string; // Alternative for new thread number, ensure string
  status?: string; // Can be "OK" (old API for /user/passlogout)
  // For login success specifically:
  message?: string; // e.g., "Dvach login successful."
  passcode_auth_cookie_value?: string;
  user_code_cookie_value?: string;
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
  geminiTriggerPostNum?: string; // If Gemini replied to a specific post OR if this is the bot's initial seed post in "replies_to_bot" mode.
  geminiGeneratedImage?: boolean; // If Gemini generated an image for this post
  geminiConversationId?: string; // To link to a specific GeminiDvachConversation
  isBotSeedPost?: boolean; // True if this is the bot's initial post in 'replies_to_bot' mode for a thread
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
  | 'random_in_thread'
  | 'replies_to_bot_initial_post'; // Internal state for bot making its first post in 'replies_to_bot' mode

export interface AppSettings {
  board: string; // Default board for manual operations tab
  threadId: string; // Default thread ID for manual operations tab
  purchasedPasscode: string; 

  geminiApiKeySource: 'env' | 'user';
  userGeminiApiKey: string;

  theme: 'light' | 'dark' | 'system';

  proxyModeForGET: ProxyModeForGET; 
  customProxyUrlForGET: string;    
  
  proxyModeForImagesGET: ProxyModeForGET; 
  customProxyUrlForImagesGET: string;   
  
  userAgent: string; 

  geminiAnalyzeOpMedia: boolean; 
  geminiAnalyzeAnonMedia: boolean; 
  geminiReplyWithGeneratedImage: boolean;
  maxImagesToAnalyzePerPost: number;
  analyzeVideosInTriggerPosts: boolean; 


  // Autonomous Bot specific settings
  autonomousBotTargetBoard: string; // Specific target board for the bot
  autonomousBotTargetThreadId: string; // Specific target thread for the bot
  autonomousBotSystemPrompt: string; 
  botAnalyzesImagesInTriggerPosts: boolean; 
  autonomousBotReplyMode: Omit<AutonomousBotReplyMode, 'replies_to_bot_initial_post'>; // User selects 'replies_to_bot' or 'random_in_thread'
  autonomousBotCycleIntervalSeconds: number; 

  // Gemini Model Configuration (Mainly for manual replies now, bot uses its own system prompt)
  geminiSystemInstruction: string; 
  geminiTemperature: number;
  geminiTopP: number;
  geminiTopK: number;
  geminiMaxOutputTokens: number;
  geminiResponseMimeType: 'text/plain' | 'application/json'; 
  useSearchGrounding: boolean; 
  useThinkingBudget: boolean; 
  geminiThinkingBudget: number;


  // Repetitive Posting Mode (Advanced/Botting Feature) 
  enableRepetitivePostingMode: boolean;
  repetitivePostMessage: string;
  repetitivePostCount: number; 
  repetitivePostDelay: number; 

  // Pre-filled Posting Mode (Advanced/Botting Feature) 
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

export interface ChatMessage { 
  id: string; 
  role: 'user' | 'model' | 'system'; 
  parts: Part[]; 
  timestamp: number;
  imagePreview?: string; 
  isLoading?: boolean; 
}

export type GeminiChat = GeminiChatInstanceType; 

export interface GeneratedImage { 
  base64Data: string; 
  mimeType: string;   
  prompt?: string;     
}

export interface GeminiDvachConversation {
  id: string; 
  board: string;
  threadId: string;
  triggerPostNum: string; // The post that initiated this specific interaction chain OR the bot's own seed post.
  botSystemPromptUsed: string; 
  geminiChatInstance?: GeminiChat; 
  history: ChatMessage[]; 
  lastCheckedTimestamp: number; 
  lastBotReplyNum?: string; // The most recent reply made by the bot in this conversation
  participatingPostNumbers: string[]; // All post numbers involved in this direct convo (trigger, replies to it, bot's replies)
  status: 'active' | 'dormant' | 'ended_by_bot' | 'error' | 'archived' | 'bot_seeded'; 
  initialContext?: { 
    opPostText?: string;
    opPostImagePreview?: string; 
    precedingPostsText?: string[];
    targetPostText: string; // Text of the triggerPostNum
    targetPostImagePreview?: string; 
  };
  isBotSeedConversation?: boolean; // True if this conversation was initiated by the bot's own post in 'replies_to_bot' mode
  initialBotPostNum?: string; // If isBotSeedConversation, this is the num of the bot's first post in the thread.
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
  groundingChunks?: GroundingChunk[];
}

type SDKCandidate = NonNullable<GeminiGenerateContentResponseSDK['candidates']>[0];

export interface CustomGenerateContentResponse extends GeminiGenerateContentResponseSDK {
  candidates?: (SDKCandidate & { groundingMetadata?: GroundingMetadata })[];
}
