"use client";

import { useSessionStore } from "@/stores/sessionStore";
import { useUIStore } from "@/stores/uiStore";
import { SessionsPanel } from "./SessionsPanel";
import { AnalysisPanel } from "./AnalysisPanel";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

export function WorkspaceLayout() {
  const { currentSession } = useSessionStore();
  const { sidebarCollapsed } = useUIStore();

  if (!currentSession) {
    return <WelcomeScreen />;
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Sessions Panel - Hidden on mobile, shown on larger screens */}
      <div className={`hidden lg:flex flex-col border-r border-slate-800 bg-slate-950/50 transition-all duration-300 ${
        sidebarCollapsed ? "w-0 overflow-hidden" : "w-60"
      }`}>
        <SessionsPanel />
      </div>

      {/* Main Analysis Panel */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <AnalysisPanel />
      </div>
    </div>
  );
}

function WelcomeScreen() {
  const { createSession } = useSessionStore();
  const { openCommandPalette } = useUIStore();

  const handleCreateSession = () => {
    console.log("Creating session...");
    createSession();
  };

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center max-w-md px-4">
        <div className="text-6xl mb-6">◈</div>
        <h2 className="text-2xl font-bold text-white mb-3">Добро пожаловать в LLM-top</h2>
        <p className="text-slate-400 mb-6 leading-relaxed">
          Мульти-агентная аналитическая система, объединяющая несколько LLM для экспертных результатов.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            type="button"
            onClick={handleCreateSession}
            className="bg-violet-600 hover:bg-violet-500"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Новый анализ
          </Button>
          <Button
            type="button"
            variant="outline"
            className="border-slate-700 hover:bg-slate-800"
            onClick={openCommandPalette}
          >
            <kbd className="mr-2 text-xs opacity-70">⌘K</kbd>
            Командная палитра
          </Button>
        </div>
        <div className="mt-8 flex justify-center gap-8 text-xs text-slate-500">
          <span>Нажмите <kbd className="px-1.5 py-0.5 bg-slate-800 rounded">N</kbd> для новой сессии</span>
          <span>Нажмите <kbd className="px-1.5 py-0.5 bg-slate-800 rounded">1-4</kbd> для смены режима</span>
        </div>
      </div>
    </div>
  );
}
