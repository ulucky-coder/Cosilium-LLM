import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { TaskType, AgentId, DEFAULT_SETTINGS } from "@/lib/constants";

// Types
export interface AgentAnalysis {
  agent_name: string;
  confidence: number;
  analysis: string;
  key_points: string[];
  risks: string[];
  assumptions: string[];
  duration?: number;
  tokens?: number;
  cost?: number;
}

export interface CritiqueEntry {
  critic: string;
  target: string;
  score: number;
  critique: string;
  weaknesses: string[];
  strengths: string[];
}

export interface Conclusion {
  conclusion: string;
  probability: string;
  confidence_interval?: string;
  falsification_condition?: string;
}

export interface Recommendation {
  option: string;
  description: string;
  score?: number;
  pros: string[];
  cons: string[];
  optimal_when?: string[];
  dangerous_when?: string[];
}

export interface SynthesisResult {
  summary: string;
  conclusions: Conclusion[];
  recommendations: Recommendation[];
  formulas?: string[];
  consensus_level: number;
}

export interface TimelineEvent {
  id: string;
  timestamp: Date;
  type: "session_start" | "input_saved" | "analysis_start" | "agent_complete" | "analysis_done" | "critique_start" | "critique_complete" | "synthesis_start" | "synthesis_complete" | "note" | "error";
  title: string;
  description?: string;
  data?: Record<string, unknown>;
  status: "complete" | "running" | "pending" | "error";
}

export interface Note {
  id: string;
  content: string;
  timestamp: Date;
  position?: number;
}

export interface SessionSettings {
  maxIterations: number;
  consensusThreshold: number;
  temperature: number;
  budget: number;
  agents: AgentId[];
  models: Record<AgentId, string>;
  thinkingPatterns: string[];
}

export interface Session {
  id: string;
  status: "input" | "running" | "paused" | "complete" | "error";
  task: string;
  taskType: TaskType;
  settings: SessionSettings;
  currentIteration: number;
  timeline: TimelineEvent[];
  analyses: AgentAnalysis[];
  critiques: CritiqueEntry[];
  synthesis: SynthesisResult | null;
  metrics: {
    consensus: number;
    totalTokens: number;
    totalCost: number;
    duration: number;
  };
  notes: Note[];
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

interface SessionState {
  // Current session
  currentSession: Session | null;

  // Session history
  sessions: Session[];

  // Actions
  createSession: () => void;
  updateTask: (task: string) => void;
  updateTaskType: (taskType: TaskType) => void;
  updateSettings: (settings: Partial<SessionSettings>) => void;
  startAnalysis: () => void;
  pauseAnalysis: () => void;
  resumeAnalysis: () => void;
  cancelAnalysis: () => void;

  // Timeline
  addTimelineEvent: (event: Omit<TimelineEvent, "id">) => void;
  updateTimelineEvent: (id: string, updates: Partial<TimelineEvent>) => void;

  // Results
  addAnalysis: (analysis: AgentAnalysis) => void;
  addCritique: (critique: CritiqueEntry) => void;
  setSynthesis: (synthesis: SynthesisResult) => void;
  updateMetrics: (metrics: Partial<Session["metrics"]>) => void;

  // Notes
  addNote: (content: string, position?: number) => void;
  deleteNote: (id: string) => void;

  // Tags
  addTag: (tag: string) => void;
  removeTag: (tag: string) => void;

  // History
  loadSession: (id: string) => void;
  deleteSession: (id: string) => void;

  // Status
  setStatus: (status: Session["status"]) => void;
  setCurrentIteration: (iteration: number) => void;
}

const createEmptySession = (): Session => ({
  id: crypto.randomUUID(),
  status: "input",
  task: "",
  taskType: "strategy",
  settings: {
    ...DEFAULT_SETTINGS,
    models: {
      chatgpt: "gpt-4o",
      claude: "claude-3-haiku",
      gemini: "gemini-2.0-flash",
      deepseek: "deepseek-chat",
    },
    thinkingPatterns: [],
  },
  currentIteration: 0,
  timeline: [],
  analyses: [],
  critiques: [],
  synthesis: null,
  metrics: {
    consensus: 0,
    totalTokens: 0,
    totalCost: 0,
    duration: 0,
  },
  notes: [],
  tags: [],
  createdAt: new Date(),
  updatedAt: new Date(),
});

// Date reviver for JSON parsing
const dateReviver = (_key: string, value: unknown): unknown => {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
    return new Date(value);
  }
  return value;
};

// Custom storage wrapper that handles Date serialization
const customStorage = {
  getItem: (name: string): string | null => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(name);
  },
  setItem: (name: string, value: string): void => {
    if (typeof window === "undefined") return;
    localStorage.setItem(name, value);
  },
  removeItem: (name: string): void => {
    if (typeof window === "undefined") return;
    localStorage.removeItem(name);
  },
};

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      currentSession: null,
      sessions: [],

      createSession: () => {
    const session = createEmptySession();
    set({ currentSession: session });
  },

  updateTask: (task) => {
    set((state) => ({
      currentSession: state.currentSession
        ? { ...state.currentSession, task, updatedAt: new Date() }
        : null,
    }));
  },

  updateTaskType: (taskType) => {
    set((state) => ({
      currentSession: state.currentSession
        ? { ...state.currentSession, taskType, updatedAt: new Date() }
        : null,
    }));
  },

  updateSettings: (settings) => {
    set((state) => ({
      currentSession: state.currentSession
        ? {
            ...state.currentSession,
            settings: { ...state.currentSession.settings, ...settings },
            updatedAt: new Date(),
          }
        : null,
    }));
  },

  startAnalysis: () => {
    const { currentSession, addTimelineEvent } = get();
    if (!currentSession) return;

    set((state) => ({
      currentSession: state.currentSession
        ? { ...state.currentSession, status: "running", updatedAt: new Date() }
        : null,
    }));

    addTimelineEvent({
      timestamp: new Date(),
      type: "session_start",
      title: "Session started",
      status: "complete",
    });
  },

  pauseAnalysis: () => {
    set((state) => ({
      currentSession: state.currentSession
        ? { ...state.currentSession, status: "paused", updatedAt: new Date() }
        : null,
    }));
  },

  resumeAnalysis: () => {
    set((state) => ({
      currentSession: state.currentSession
        ? { ...state.currentSession, status: "running", updatedAt: new Date() }
        : null,
    }));
  },

  cancelAnalysis: () => {
    set((state) => ({
      currentSession: state.currentSession
        ? { ...state.currentSession, status: "input", updatedAt: new Date() }
        : null,
    }));
  },

  addTimelineEvent: (event) => {
    set((state) => ({
      currentSession: state.currentSession
        ? {
            ...state.currentSession,
            timeline: [
              ...state.currentSession.timeline,
              { ...event, id: crypto.randomUUID() },
            ],
            updatedAt: new Date(),
          }
        : null,
    }));
  },

  updateTimelineEvent: (id, updates) => {
    set((state) => ({
      currentSession: state.currentSession
        ? {
            ...state.currentSession,
            timeline: state.currentSession.timeline.map((e) =>
              e.id === id ? { ...e, ...updates } : e
            ),
            updatedAt: new Date(),
          }
        : null,
    }));
  },

  addAnalysis: (analysis) => {
    set((state) => ({
      currentSession: state.currentSession
        ? {
            ...state.currentSession,
            analyses: [...state.currentSession.analyses, analysis],
            updatedAt: new Date(),
          }
        : null,
    }));
  },

  addCritique: (critique) => {
    set((state) => ({
      currentSession: state.currentSession
        ? {
            ...state.currentSession,
            critiques: [...state.currentSession.critiques, critique],
            updatedAt: new Date(),
          }
        : null,
    }));
  },

  setSynthesis: (synthesis) => {
    set((state) => ({
      currentSession: state.currentSession
        ? {
            ...state.currentSession,
            synthesis,
            status: "complete",
            updatedAt: new Date(),
          }
        : null,
    }));
  },

  updateMetrics: (metrics) => {
    set((state) => ({
      currentSession: state.currentSession
        ? {
            ...state.currentSession,
            metrics: { ...state.currentSession.metrics, ...metrics },
            updatedAt: new Date(),
          }
        : null,
    }));
  },

  addNote: (content, position) => {
    set((state) => ({
      currentSession: state.currentSession
        ? {
            ...state.currentSession,
            notes: [
              ...state.currentSession.notes,
              {
                id: crypto.randomUUID(),
                content,
                timestamp: new Date(),
                position,
              },
            ],
            updatedAt: new Date(),
          }
        : null,
    }));
  },

  deleteNote: (id) => {
    set((state) => ({
      currentSession: state.currentSession
        ? {
            ...state.currentSession,
            notes: state.currentSession.notes.filter((n) => n.id !== id),
            updatedAt: new Date(),
          }
        : null,
    }));
  },

  addTag: (tag) => {
    set((state) => ({
      currentSession: state.currentSession
        ? {
            ...state.currentSession,
            tags: [...new Set([...state.currentSession.tags, tag])],
            updatedAt: new Date(),
          }
        : null,
    }));
  },

  removeTag: (tag) => {
    set((state) => ({
      currentSession: state.currentSession
        ? {
            ...state.currentSession,
            tags: state.currentSession.tags.filter((t) => t !== tag),
            updatedAt: new Date(),
          }
        : null,
    }));
  },

  loadSession: (id) => {
    const session = get().sessions.find((s) => s.id === id);
    if (session) {
      set({ currentSession: session });
    }
  },

  deleteSession: (id) => {
    set((state) => ({
      sessions: state.sessions.filter((s) => s.id !== id),
      currentSession:
        state.currentSession?.id === id ? null : state.currentSession,
    }));
  },

  setStatus: (status) => {
    set((state) => {
      if (!state.currentSession) return state;

      const updatedSession = { ...state.currentSession, status, updatedAt: new Date() };

      // When session completes, add to history if not already there
      if (status === "complete") {
        const existsInHistory = state.sessions.some((s) => s.id === updatedSession.id);
        if (!existsInHistory) {
          return {
            currentSession: updatedSession,
            sessions: [updatedSession, ...state.sessions].slice(0, 50), // Keep max 50 sessions
          };
        }
      }

      return { currentSession: updatedSession };
    });
  },

  setCurrentIteration: (currentIteration) => {
    set((state) => ({
      currentSession: state.currentSession
        ? { ...state.currentSession, currentIteration, updatedAt: new Date() }
        : null,
    }));
  },
    }),
    {
      name: "llm-top-sessions",
      storage: createJSONStorage(() => customStorage, {
        reviver: dateReviver,
      }),
      partialize: (state) => ({
        sessions: state.sessions,
        currentSession: state.currentSession,
      }) as SessionState,
      skipHydration: true,
    }
  )
);

// Rehydrate on client side
if (typeof window !== "undefined") {
  useSessionStore.persist.rehydrate();
}
