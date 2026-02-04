import { create } from "zustand";

export type DrawerContent = "agent" | "critique" | "settings" | "export" | "prompts" | "patterns" | null;
export type ViewMode = "workspace" | "document" | "present" | "compare";

interface UIState {
  // Layout
  sidebarCollapsed: boolean;
  drawerOpen: boolean;
  drawerContent: DrawerContent;
  drawerData: Record<string, unknown>;

  // View mode
  viewMode: ViewMode;
  previousViewMode: ViewMode;

  // Present mode
  presentSlideIndex: number;
  speakerNotesVisible: boolean;
  presentFullscreen: boolean;

  // Compare mode
  compareSessionIds: [string | null, string | null];
  compareSyncScroll: boolean;
  compareShowDiff: boolean;

  // Command palette
  commandPaletteOpen: boolean;
  commandQuery: string;

  // Document
  expandedSections: Set<string>;
  scrollPosition: number;

  // Selection
  selectedAgent: string | null;
  selectedCritique: { from: string; to: string } | null;

  // Actions
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;

  openDrawer: (content: DrawerContent, data?: Record<string, unknown>) => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;

  // View mode actions
  setViewMode: (mode: ViewMode) => void;
  cycleViewMode: () => void;

  // Present mode actions
  nextSlide: () => void;
  prevSlide: () => void;
  setSlideIndex: (index: number) => void;
  toggleSpeakerNotes: () => void;
  togglePresentFullscreen: () => void;
  exitPresentMode: () => void;

  // Compare mode actions
  setCompareSession: (slot: 0 | 1, sessionId: string | null) => void;
  toggleCompareSyncScroll: () => void;
  toggleCompareShowDiff: () => void;

  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  setCommandQuery: (query: string) => void;

  toggleSection: (sectionId: string) => void;
  expandAllSections: () => void;
  collapseAllSections: () => void;
  setExpandedSections: (sections: Set<string>) => void;

  setScrollPosition: (position: number) => void;

  selectAgent: (agentId: string | null) => void;
  selectCritique: (critique: { from: string; to: string } | null) => void;
}

const VIEW_MODE_ORDER: ViewMode[] = ["workspace", "document", "present", "compare"];

export const useUIStore = create<UIState>((set, get) => ({
  // Initial state
  sidebarCollapsed: false,
  drawerOpen: false,
  drawerContent: null,
  drawerData: {},

  // View mode
  viewMode: "workspace",
  previousViewMode: "workspace",

  // Present mode
  presentSlideIndex: 0,
  speakerNotesVisible: false,
  presentFullscreen: false,

  // Compare mode
  compareSessionIds: [null, null],
  compareSyncScroll: true,
  compareShowDiff: true,

  commandPaletteOpen: false,
  commandQuery: "",
  expandedSections: new Set<string>(),
  scrollPosition: 0,
  selectedAgent: null,
  selectedCritique: null,

  // Sidebar
  toggleSidebar: () => {
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }));
  },

  setSidebarCollapsed: (collapsed) => {
    set({ sidebarCollapsed: collapsed });
  },

  // Drawer
  openDrawer: (content, data = {}) => {
    set({ drawerOpen: true, drawerContent: content, drawerData: data });
  },

  closeDrawer: () => {
    set({ drawerOpen: false, drawerContent: null, drawerData: {} });
  },

  toggleDrawer: () => {
    set((state) => ({
      drawerOpen: !state.drawerOpen,
      drawerContent: state.drawerOpen ? null : state.drawerContent,
    }));
  },

  // View mode
  setViewMode: (mode) => {
    set((state) => ({
      viewMode: mode,
      previousViewMode: state.viewMode,
      presentSlideIndex: mode === "present" ? 0 : state.presentSlideIndex,
    }));
  },

  cycleViewMode: () => {
    set((state) => {
      const currentIndex = VIEW_MODE_ORDER.indexOf(state.viewMode);
      const nextIndex = (currentIndex + 1) % VIEW_MODE_ORDER.length;
      return {
        viewMode: VIEW_MODE_ORDER[nextIndex],
        previousViewMode: state.viewMode,
      };
    });
  },

  // Present mode
  nextSlide: () => {
    set((state) => ({ presentSlideIndex: state.presentSlideIndex + 1 }));
  },

  prevSlide: () => {
    set((state) => ({ presentSlideIndex: Math.max(0, state.presentSlideIndex - 1) }));
  },

  setSlideIndex: (index) => {
    set({ presentSlideIndex: Math.max(0, index) });
  },

  toggleSpeakerNotes: () => {
    set((state) => ({ speakerNotesVisible: !state.speakerNotesVisible }));
  },

  togglePresentFullscreen: () => {
    set((state) => ({ presentFullscreen: !state.presentFullscreen }));
  },

  exitPresentMode: () => {
    const { previousViewMode } = get();
    set({
      viewMode: previousViewMode === "present" ? "workspace" : previousViewMode,
      presentFullscreen: false,
      speakerNotesVisible: false,
    });
  },

  // Compare mode
  setCompareSession: (slot, sessionId) => {
    set((state) => {
      const newIds = [...state.compareSessionIds] as [string | null, string | null];
      newIds[slot] = sessionId;
      return { compareSessionIds: newIds };
    });
  },

  toggleCompareSyncScroll: () => {
    set((state) => ({ compareSyncScroll: !state.compareSyncScroll }));
  },

  toggleCompareShowDiff: () => {
    set((state) => ({ compareShowDiff: !state.compareShowDiff }));
  },

  // Command palette
  openCommandPalette: () => {
    set({ commandPaletteOpen: true, commandQuery: "" });
  },

  closeCommandPalette: () => {
    set({ commandPaletteOpen: false, commandQuery: "" });
  },

  setCommandQuery: (query) => {
    set({ commandQuery: query });
  },

  // Sections
  toggleSection: (sectionId) => {
    set((state) => {
      const newSections = new Set(state.expandedSections);
      if (newSections.has(sectionId)) {
        newSections.delete(sectionId);
      } else {
        newSections.add(sectionId);
      }
      return { expandedSections: newSections };
    });
  },

  expandAllSections: () => {
    set({ expandedSections: new Set(["input", "iteration-1", "iteration-2", "iteration-3", "synthesis", "notes"]) });
  },

  collapseAllSections: () => {
    set({ expandedSections: new Set() });
  },

  setExpandedSections: (sections) => {
    set({ expandedSections: sections });
  },

  // Scroll
  setScrollPosition: (position) => {
    set({ scrollPosition: position });
  },

  // Selection
  selectAgent: (agentId) => {
    set({ selectedAgent: agentId });
  },

  selectCritique: (critique) => {
    set({ selectedCritique: critique });
  },
}));
