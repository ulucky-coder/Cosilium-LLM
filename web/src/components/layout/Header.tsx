"use client";

import { useUIStore } from "@/stores/uiStore";
import { useSessionStore } from "@/stores/sessionStore";
import { AGENTS } from "@/lib/constants";
import { Search, Bell, Settings, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModeSwitcher } from "@/components/mode/ModeSwitcher";

export function Header() {
  const { openCommandPalette, toggleSidebar, sidebarCollapsed, viewMode } = useUIStore();
  const { currentSession } = useSessionStore();

  const activeAgents = currentSession?.analyses.map((a) => a.agent_name.toLowerCase()) || [];

  // Hide sidebar toggle in present mode
  const showSidebarToggle = viewMode !== "present";

  return (
    <header className="h-12 border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm flex items-center px-4 gap-4 sticky top-0 z-50">
      {/* Logo & Sidebar Toggle */}
      <div className="flex items-center gap-2">
        {showSidebarToggle && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-400 hover:text-white"
            onClick={toggleSidebar}
          >
            <ChevronLeft className={`h-4 w-4 transition-transform ${sidebarCollapsed ? "rotate-180" : ""}`} />
          </Button>
        )}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-sm">
            ◈
          </div>
          <span className="font-semibold text-white text-sm hidden sm:inline">LLM-top</span>
        </div>
      </div>

      {/* Mode Switcher */}
      <div className="hidden md:block">
        <ModeSwitcher />
      </div>

      {/* Command Bar */}
      <button
        type="button"
        onClick={openCommandPalette}
        className="flex-1 max-w-md mx-auto h-8 px-3 rounded-lg bg-slate-900 border border-slate-700 flex items-center gap-2 text-slate-400 text-sm hover:border-slate-600 hover:text-slate-300 transition-colors"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left hidden sm:inline">Поиск, создание, навигация...</span>
        <kbd className="hidden lg:inline-flex h-5 items-center gap-1 rounded border border-slate-600 bg-slate-800 px-1.5 font-mono text-xs text-slate-400">
          ⌘K
        </kbd>
      </button>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Agent Status Indicators */}
        <div className="hidden sm:flex items-center gap-1.5" title="Agent Status">
          <span className="text-xs text-slate-500 mr-1">⚡</span>
          {AGENTS.map((agent) => (
            <div
              key={agent.id}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                activeAgents.includes(agent.id) || activeAgents.includes(agent.name.toLowerCase())
                  ? agent.color
                  : "bg-slate-700"
              }`}
              title={agent.name}
            />
          ))}
        </div>

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white">
          <Bell className="h-4 w-4" />
        </Button>

        {/* Settings */}
        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white">
          <Settings className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
