import { create } from "zustand";

export type DrawerContent = "agent" | "critique" | "settings" | "export" | null;

interface UIState {
  // Layout
  sidebarCollapsed: boolean;
  drawerOpen: boolean;
  drawerContent: DrawerContent;
  drawerData: Record<string, unknown>;

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

export const useUIStore = create<UIState>((set) => ({
  // Initial state
  sidebarCollapsed: false,
  drawerOpen: false,
  drawerContent: null,
  drawerData: {},
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
