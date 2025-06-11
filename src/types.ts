/// <reference types="vite/client" />
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
  geminiTriggerPostNum?: string; // If Gemini replied to a specific post
  geminiGeneratedImage?: boolean; // If Gemini generated an image for this post
  geminiConversationId?: string; // To link to a specific GeminiDvachConversation
}

export type ProxyModeForGET =
  | 'vercel_serverless' // Uses /api/get-thread for thread data, other GETs might need different handling or this mode implies specific proxy for images
  | 'custom_go_x2u'
  | 'custom_cors_anywhere'
  | 'custom_general_prefix'
  | 'custom_general_param'
  | 'none';

export interface DvachSessionCookies {
  passcode_auth: string | null;
  usercode: string | null; // Dvach also sets a 'usercode' cookie
}

export type AutonomousBotReplyMode = 'replies_to_bot' | 'random_in_thread';
export type AutonomousBotPersonalityPreset =
  | 'default'
  | 'concise_witty'
  | 'elaborate_detailed'
  | 'slightly_aggressive'
  | 'sarcastic_ironic'
  | 'neutral_informative'
  | 'custom'; // For user-defined modifications later

export interface AppSettings {
  board: string;
  threadId: string; // Current thread ID user is interacting with
  purchasedPasscode: string; // This is the user's long-term purchased passcode string.

  geminiApiKeySource: 'env' | 'user';
  userGeminiApiKey: string;

  theme: 'light' | 'dark' | 'system';

  proxyModeForGET: ProxyModeForGET;
  customProxyUrlForGET: string;
  userAgent: string; // User agent for client-side GETs and to pass to serverless

  // Gemini specific settings for Dvach interaction
  geminiAnalyzeOpMedia: boolean; // Whether Gemini should consider media in OP post
  geminiAnalyzeAnonMedia: boolean; // Whether Gemini should consider media in non-OP posts
  geminiReplyWithGeneratedImage: boolean; // Whether Gemini should attempt to generate an image with its reply

  // Autonomous Bot specific settings
  autonomousBotTargetBoard: string;
  autonomousBotTargetThreadId: string;
  autonomousBotSystemPrompt: string;
  botAnalyzesImagesInTriggerPosts: boolean; // Specific to autonomous bot
  autonomousBotReplyMode: AutonomousBotReplyMode;
  autonomousBotCycleIntervalSeconds: number; // Interval in seconds
  autonomousBotPersonalityPreset: AutonomousBotPersonalityPreset;


  // Gemini Model Configuration (Mainly for manual replies now, bot uses its own system prompt + preset)
  geminiSystemInstruction: string; // Default system instruction for manual replies
  geminiTemperature: number;
  geminiTopP: number;
  geminiTopK: number;
  geminiMaxOutputTokens: number;
  geminiResponseMimeType: 'text/plain' | 'application/json';
  useSearchGrounding: boolean; // For generic text gen, if kept
  useThinkingBudget: boolean; // If false, thinkingBudget is 0
  geminiThinkingBudget: number; // In milliseconds, 0 disables it (for gemini-2.5-flash-preview-04-17)


  // Repetitive Posting Mode (Advanced/Botting Feature) - Kept for now, might be deprecated
  enableRepetitivePostingMode: boolean;
  repetitivePostMessage: string;
  repetitivePostCount: number; // How many times to post
  repetitivePostDelay: number; // Delay in seconds between posts

  // Pre-filled Posting Mode (Advanced/Botting Feature) - Kept for now
  enablePrefilledPostingMode: boolean;
  prefilledPostMessages: string; // Newline-separated messages
  prefilledPostTargets: string; // Newline-separated target post numbers (optional)
}

export interface LogEntry {
  id: string;
  timestamp: number;
  message: string;
  type: 'info' | 'error' | 'success' | 'warning' | 'gemini' | 'dvach' | 'system' | 'auth' | 'bot_activity';
  data?: unknown; // For structured error data or additional info
}

export interface ChatMessage { // For GeminiDvachConversation history
  id: string; // Unique ID for React key
  role: 'user' | 'model' | 'system'; // 'system' for initial prompt or errors from system
  parts: Part[]; // Using Gemini's Part type (can include text and inlineData for images)
  timestamp: number;
  imagePreview?: string; // base64 data URL for displaying sent/received images in chat UI
  isLoading?: boolean; // True if this is a model message currently being streamed
}

export type GeminiChat = GeminiChatInstanceType; // Type alias for clarity (Gemini's Chat instance)

export interface GeneratedImage { // For images generated by Gemini
  base64Data: string; // Base64 encoded image string
  mimeType: string;   // e.g., 'image/jpeg', 'image/png'
  prompt?: string;     // The prompt used to generate this image (optional)
}

// For ongoing Gemini-Dvach conversations (Autonomous Bot)
export interface GeminiDvachConversation {
  id: string; // Unique conversation ID, e.g., board-threadId-triggerPostNum
  board: string;
  threadId: string;
  triggerPostNum: string; // The Dvach post number that initiated this specific bot interaction branch
  botSystemPromptUsed: string; // System prompt (including personality modifications) active for this conversation when it started/last replied
  geminiChatInstance?: GeminiChat; // Stored chat instance for this specific conversation branch (optional if rehydrated)
  history: ChatMessage[]; // History specific to this conversation branch
  lastCheckedTimestamp: number; // When this specific conversation branch was last updated by checking Dvach
  lastBotReplyNum?: string; // The post number of the bot's last reply in this conversation
  participatingPostNumbers: string[]; // All Dvach post numbers involved in this branch (bot and user)
  status: 'active' | 'dormant' | 'ended_by_bot' | 'error'; // Status of the conversation
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

// Custom response type to potentially include grounding metadata
// Candidate type is inferred from GeminiGenerateContentResponseSDK['candidates']
// which is (GenerateContentCandidate | undefined)[] | undefined
// So GenerateContentCandidate is the base for Candidate
type SDKCandidate = NonNullable<GeminiGenerateContentResponseSDK['candidates']>[0];

export interface CustomGenerateContentResponse extends GeminiGenerateContentResponseSDK {
  candidates?: (SDKCandidate & { groundingMetadata?: GroundingMetadata })[];
}