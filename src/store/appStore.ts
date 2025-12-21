import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { GoogleGenAI } from '@google/genai';
import {
  AppSettings,
  LogEntry,
  DvachPost,
  SentMessageInfo,
  DvachSessionCookies,
  ActiveTask,
  GeminiDvachConversation,
  BotOpMediaCache,
} from '../core/types';
import { DEFAULT_APP_SETTINGS, MAX_LOG_ENTRIES, MAX_SENT_MESSAGES_STORED, DVACH_DOMAINS } from '../config/constants';
import { generateUserAgent } from '../core/utils/userAgentGenerator';

// Define the state shape
interface AppState {
  settings: AppSettings;
  logs: LogEntry[];
  postActivityLog: string[];
  autonomousBotActivityLog: string[];
  dvachSessionCookies: DvachSessionCookies | null;
  isDvachLoggingIn: boolean;
  isPosting: boolean;
  isFetchingThread: boolean;
  fetchError: string | null;
  geminiLoading: boolean;
  isAnalyzingThread: boolean;
  threadAnalysis: string | null;
  currentBoard: string;
  currentThreadId: string;
  postText: string;
  postFile: File | null;
  postUseSage: boolean;
  currentFetchedDvachPosts: DvachPost[];
  sentMessages: SentMessageInfo[];
  availableThreads: DvachPost[];
  activeTasks: ActiveTask[];
  autonomousBotActive: boolean;
  autonomousBotStatus: string;
  geminiDvachConversations: Map<string, GeminiDvachConversation>;
  currentBotOpMediaCache: BotOpMediaCache | null;
  ai: GoogleGenAI | null;
  currentDvachBaseUrl: string;
}

// Define the actions
interface AppActions {
  // AI Client
  initializeAi: () => void;

  // Settings
  updateSettings: (newSettings: Partial<AppSettings>) => void;

  // Logs
  addLog: (message: string, type?: LogEntry['type'], data?: unknown) => void;
  addPostActivity: (message: string) => void;
  addAutonomousBotActivityLog: (message: string) => void;
  clearLogs: () => void;

  // Dvach
  setDvachSession: (cookies: DvachSessionCookies | null) => void;
  setIsDvachLoggingIn: (status: boolean) => void;
  setIsPosting: (status: boolean) => void;
  setIsFetchingThread: (status: boolean) => void;
  setFetchError: (error: string | null) => void;
  setCurrentBoard: (board: string) => void;
  setCurrentThreadId: (threadId: string) => void;
  setPostText: (text: string) => void;
  setPostFile: (file: File | null) => void;
  setPostUseSage: (sage: boolean) => void;
  setCurrentFetchedDvachPosts: (posts: DvachPost[]) => void;
  addSentMessage: (message: SentMessageInfo) => void;
  setAvailableThreads: (threads: DvachPost[]) => void;

  // Gemini
  setGeminiLoading: (status: boolean) => void;
  setIsAnalyzingThread: (status: boolean) => void;
  setThreadAnalysis: (analysis: string | null) => void;
  setGeminiDvachConversations: (conversations: Map<string, GeminiDvachConversation>) => void;

  // Bot
  setAutonomousBotActive: (active: boolean) => void;
  setAutonomousBotStatus: (status: string) => void;
  setCurrentBotOpMediaCache: (cache: BotOpMediaCache | null) => void;

  // Tasks
  addTask: (task: Omit<ActiveTask, 'id' | 'startTime'>) => string;
  removeTask: (id: string) => void;
}

// Create the store
export const useAppStore = create<AppState & AppActions>()(
  persist(
    (set, get) => ({
      // Initial State
      settings: { ...DEFAULT_APP_SETTINGS, userAgent: generateUserAgent() },
      logs: [],
      postActivityLog: [],
      autonomousBotActivityLog: [],
      dvachSessionCookies: null,
      isDvachLoggingIn: false,
      isPosting: false,
      isFetchingThread: false,
      fetchError: null,
      geminiLoading: false,
      isAnalyzingThread: false,
      threadAnalysis: null,
      currentBoard: DEFAULT_APP_SETTINGS.board,
      currentThreadId: DEFAULT_APP_SETTINGS.threadId,
      postText: '',
      postFile: null,
      postUseSage: false,
      currentFetchedDvachPosts: [],
      sentMessages: [],
      availableThreads: [],
      activeTasks: [],
      autonomousBotActive: false,
      autonomousBotStatus: 'Inactive',
      geminiDvachConversations: new Map(),
      currentBotOpMediaCache: null,
      ai: null,
      currentDvachBaseUrl: DVACH_DOMAINS[DEFAULT_APP_SETTINGS.dvachBaseDomainIndex],

      // Actions
      initializeAi: () => {
        const { settings, addLog } = get();
        const keyToUse = settings.geminiApiKeySource === 'env' ? process.env.API_KEY : settings.userGeminiApiKey;

        if (keyToUse) {
          try {
            const genAI = new GoogleGenAI({ apiKey: keyToUse });
            set({ ai: genAI });
            addLog('Gemini API client initialized successfully.', 'success');
          } catch (error) {
            addLog(`Failed to initialize Gemini API: ${(error as Error).message}.`, 'error', error);
            set({ ai: null });
          }
        } else {
          set({ ai: null });
          addLog('Gemini API key not set.', 'warning');
        }
      },
      updateSettings: (newSettings) => {
        const oldSettings = get().settings;
        const newMergedSettings = { ...oldSettings, ...newSettings };

        let newBaseUrl = get().currentDvachBaseUrl;
        if (newMergedSettings.dvachDomainUsageMode === 'custom' && newMergedSettings.customDvachDomain) {
          newBaseUrl = newMergedSettings.customDvachDomain;
        } else {
          newBaseUrl = DVACH_DOMAINS[newMergedSettings.dvachBaseDomainIndex];
        }

        set({ settings: newMergedSettings, currentDvachBaseUrl: newBaseUrl });

        if (
          newSettings.geminiApiKeySource !== oldSettings.geminiApiKeySource ||
          newSettings.userGeminiApiKey !== oldSettings.userGeminiApiKey
        ) {
          get().initializeAi();
        }
      },
      addLog: (message, type = 'info', data) => set((state) => ({
        logs: [{ id: Date.now().toString(), timestamp: Date.now(), message, type, data }, ...state.logs.slice(0, MAX_LOG_ENTRIES - 1)],
      })),
      addPostActivity: (message) => set((state) => ({
        postActivityLog: [`[${new Date().toLocaleTimeString()}] ${message}`, ...state.postActivityLog.slice(0, 9)],
      })),
      addAutonomousBotActivityLog: (message) => {
        set((state) => ({
          autonomousBotActivityLog: [`[${new Date().toLocaleTimeString()}] ${message}`, ...state.autonomousBotActivityLog.slice(0, 49)],
        }));
        get().addLog(message, 'bot_activity');
      },
      clearLogs: () => set({ logs: [], postActivityLog: [], autonomousBotActivityLog: [] }),
      setDvachSession: (cookies) => set({ dvachSessionCookies: cookies }),
      setIsDvachLoggingIn: (status) => set({ isDvachLoggingIn: status }),
      setIsPosting: (status) => set({ isPosting: status }),
      setIsFetchingThread: (status) => set({ isFetchingThread: status }),
      setFetchError: (error) => set({ fetchError: error }),
      setCurrentBoard: (board) => set({ currentBoard: board }),
      setCurrentThreadId: (threadId) => set({ currentThreadId: threadId }),
      setPostText: (text) => set({ postText: text }),
      setPostFile: (file) => set({ postFile: file }),
      setPostUseSage: (sage) => set({ postUseSage: sage }),
      setCurrentFetchedDvachPosts: (posts) => set({ currentFetchedDvachPosts: posts }),
      addSentMessage: (message) => set((state) => ({
        sentMessages: [message, ...state.sentMessages.slice(0, MAX_SENT_MESSAGES_STORED - 1)],
      })),
      setAvailableThreads: (threads) => set({ availableThreads: threads }),
      setGeminiLoading: (status) => set({ geminiLoading: status }),
      setIsAnalyzingThread: (status) => set({ isAnalyzingThread: status }),
      setThreadAnalysis: (analysis) => set({ threadAnalysis: analysis }),
      setGeminiDvachConversations: (conversations) => set({ geminiDvachConversations: conversations }),
      setAutonomousBotActive: (active) => set({ autonomousBotActive: active }),
      setAutonomousBotStatus: (status) => set({ autonomousBotStatus: status }),
      setCurrentBotOpMediaCache: (cache) => set({ currentBotOpMediaCache: cache }),
      addTask: (task) => {
        const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        const newTask: ActiveTask = { ...task, id, startTime: Date.now() };
        set((state) => ({ activeTasks: [...state.activeTasks, newTask] }));
        return id;
      },
      removeTask: (id) => set((state) => ({ activeTasks: state.activeTasks.filter((task) => task.id !== id) })),
    }),
    {
      name: 'dvach-gemini-bot-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => {
        const { ai, ...rest } = state;
        return {
          ...rest,
          postFile: null,
          geminiDvachConversations: Array.from(state.geminiDvachConversations.entries()),
        };
      },
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...(persistedState as any),
        geminiDvachConversations: new Map((persistedState as any).geminiDvachConversations),
      }),
    }
  )
);