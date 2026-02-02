"use client";

import { useEffect } from "react";
import { useUIStore } from "@/stores/uiStore";
import { useSessionStore } from "@/stores/sessionStore";

export function useKeyboardShortcuts() {
  const {
    openCommandPalette,
    closeCommandPalette,
    commandPaletteOpen,
    toggleSidebar,
    toggleDrawer,
    expandAllSections,
    collapseAllSections,
  } = useUIStore();

  const { createSession, startAnalysis, pauseAnalysis, currentSession } = useSessionStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in input/textarea
      const target = e.target as HTMLElement;
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;

      // Cmd+K - Command palette (always works)
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (commandPaletteOpen) {
          closeCommandPalette();
        } else {
          openCommandPalette();
        }
        return;
      }

      // If command palette is open, let it handle keys
      if (commandPaletteOpen) return;

      // If typing in input, don't trigger single-key shortcuts
      if (isInput) return;

      // Single key shortcuts
      switch (e.key.toLowerCase()) {
        case "n":
          e.preventDefault();
          createSession();
          break;

        case "/":
          e.preventDefault();
          openCommandPalette();
          break;

        case "?":
          e.preventDefault();
          // Show help
          break;
      }

      // Cmd/Ctrl + key shortcuts
      if (e.metaKey || e.ctrlKey) {
        switch (e.key) {
          case "\\":
            e.preventDefault();
            if (e.shiftKey) {
              toggleDrawer();
            } else {
              toggleSidebar();
            }
            break;

          case "Enter":
            e.preventDefault();
            if (currentSession?.status === "input") {
              startAnalysis();
            }
            break;

          case ".":
            e.preventDefault();
            if (currentSession?.status === "running") {
              pauseAnalysis();
            }
            break;

          case "ArrowUp":
            e.preventDefault();
            collapseAllSections();
            break;

          case "ArrowDown":
            e.preventDefault();
            expandAllSections();
            break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    commandPaletteOpen,
    openCommandPalette,
    closeCommandPalette,
    toggleSidebar,
    toggleDrawer,
    createSession,
    startAnalysis,
    pauseAnalysis,
    expandAllSections,
    collapseAllSections,
    currentSession,
  ]);
}
