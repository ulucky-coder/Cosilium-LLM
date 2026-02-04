"use client";

import { useUIStore, ViewMode } from "@/stores/uiStore";
import { VIEW_MODES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { LayoutDashboard, FileText, Presentation, GitCompare } from "lucide-react";

const ICONS = {
  LayoutDashboard,
  FileText,
  Presentation,
  GitCompare,
} as const;

export function ModeSwitcher() {
  const { viewMode, setViewMode } = useUIStore();

  return (
    <div className="flex items-center gap-1 p-1 bg-slate-900/50 rounded-lg border border-slate-800">
      {VIEW_MODES.map((mode) => {
        const Icon = ICONS[mode.icon as keyof typeof ICONS];
        const isActive = viewMode === mode.id;

        return (
          <button
            type="button"
            key={mode.id}
            onClick={() => setViewMode(mode.id as ViewMode)}
            title={`${mode.label} (${mode.shortcut})`}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
              isActive
                ? "bg-violet-600 text-white shadow-sm"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden lg:inline">{mode.label}</span>
            <kbd className={cn(
              "hidden xl:inline-flex h-5 items-center px-1.5 rounded text-xs font-mono",
              isActive
                ? "bg-violet-500/50 text-violet-200"
                : "bg-slate-800 text-slate-500"
            )}>
              {mode.shortcut}
            </kbd>
          </button>
        );
      })}
    </div>
  );
}
