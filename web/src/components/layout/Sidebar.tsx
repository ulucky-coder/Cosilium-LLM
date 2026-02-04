"use client";

import { useUIStore } from "@/stores/uiStore";
import { useSessionStore } from "@/stores/sessionStore";
import { AGENTS } from "@/lib/constants";
import {
  Plus,
  Download,
  GitCompare,
  HelpCircle,
  ChevronRight,
  ChevronDown,
  Clock,
  FileText,
  Sparkles,
  Brain,
  Check,
  Loader2,
  Circle,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface TimelineEventItemProps {
  event: {
    id: string;
    type: string;
    title: string;
    status: "complete" | "running" | "pending" | "error";
    description?: string;
    timestamp: Date;
    data?: Record<string, unknown>;
  };
  isLast: boolean;
}

function TimelineEventItem({ event, isLast }: TimelineEventItemProps) {
  const getStatusIcon = () => {
    switch (event.status) {
      case "complete":
        return <Check className="h-3 w-3 text-emerald-400" />;
      case "running":
        return <Loader2 className="h-3 w-3 text-amber-400 animate-spin" />;
      case "pending":
        return <Circle className="h-3 w-3 text-slate-500" />;
      case "error":
        return <AlertCircle className="h-3 w-3 text-red-400" />;
    }
  };

  const getStatusColor = () => {
    switch (event.status) {
      case "complete":
        return "bg-emerald-500";
      case "running":
        return "bg-amber-500";
      case "pending":
        return "bg-slate-600";
      case "error":
        return "bg-red-500";
    }
  };

  return (
    <div className="relative pl-6">
      {/* Connector line */}
      {!isLast && (
        <div className="absolute left-[9px] top-5 bottom-0 w-px bg-slate-700" />
      )}

      {/* Status dot */}
      <div
        className={cn(
          "absolute left-0 top-1 w-[18px] h-[18px] rounded-full flex items-center justify-center",
          event.status === "running" ? "bg-amber-500/20" : "bg-slate-800"
        )}
      >
        {getStatusIcon()}
      </div>

      {/* Content */}
      <div className="pb-4">
        <div className="text-xs text-slate-500">
          {event.timestamp.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
        </div>
        <div className="text-sm text-slate-300">{event.title}</div>
        {event.description && (
          <div className="text-xs text-slate-500 mt-0.5">{event.description}</div>
        )}

        {/* Agent sub-events */}
        {event.type === "analysis_start" && Array.isArray(event.data?.agents) && (
          <div className="mt-2 space-y-1">
            {(event.data.agents as string[]).map((agentId) => {
              const agent = AGENTS.find((a) => a.id === agentId);
              const agentStatus = (event.data?.agentStatuses as Record<string, string>)?.[agentId] || "pending";
              return (
                <div key={agentId} className="flex items-center gap-2 text-xs text-slate-400">
                  <div className={cn("w-1.5 h-1.5 rounded-full", agent?.color || "bg-slate-600")} />
                  <span>{agent?.name || agentId}</span>
                  {agentStatus === "complete" && <Check className="h-3 w-3 text-emerald-400" />}
                  {agentStatus === "running" && <Loader2 className="h-3 w-3 text-amber-400 animate-spin" />}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const TEMPLATES = [
  { id: "strategy", name: "Стратегический анализ", description: "Анализ бизнес-стратегии" },
  { id: "investment", name: "Инвестиционный анализ", description: "Оценка инвестиций" },
  { id: "research", name: "Исследование", description: "Глубокий ресёрч темы" },
  { id: "technical", name: "Технический аудит", description: "Аудит кода/архитектуры" },
];

const THINKING_PATTERNS = [
  { id: "first-principles", name: "First Principles", description: "Мышление с нуля" },
  { id: "inversion", name: "Инверсия", description: "Анализ от обратного" },
  { id: "second-order", name: "Эффекты 2-го порядка", description: "Последствия последствий" },
  { id: "probabilistic", name: "Вероятностное", description: "Байесовский подход" },
];

export function Sidebar() {
  const { sidebarCollapsed, viewMode, openDrawer, setViewMode, openCommandPalette } = useUIStore();
  const { currentSession, sessions, createSession, updateSettings } = useSessionStore();
  const [expandedSections, setExpandedSections] = useState({
    history: false,
    templates: false,
    prompts: false,
    patterns: false,
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  // Hide sidebar in present mode
  if (viewMode === "present") {
    return null;
  }

  if (sidebarCollapsed) {
    return (
      <aside className="w-14 border-r border-slate-800 bg-slate-950/50 flex flex-col py-4">
        <div className="flex flex-col items-center gap-2">
          <Button variant="ghost" size="icon" className="h-10 w-10 text-slate-400 hover:text-white" onClick={createSession} title="Новая сессия">
            <Plus className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-10 w-10 text-slate-400 hover:text-white" onClick={openCommandPalette} title="История">
            <Clock className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-10 w-10 text-slate-400 hover:text-white" onClick={() => openDrawer("export")} title="Экспорт">
            <FileText className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-10 w-10 text-slate-400 hover:text-white" onClick={() => openDrawer("settings")} title="Настройки">
            <Brain className="h-5 w-5" />
          </Button>
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-72 border-r border-slate-800 bg-slate-950/50 flex flex-col overflow-hidden">
      {/* Current Session */}
      {currentSession && (
        <div className="p-4 border-b border-slate-800">
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Текущая сессия</div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-white">
                #{currentSession.id.slice(0, 8)}
              </div>
              <div className="text-xs text-slate-400 capitalize">{currentSession.taskType}</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-violet-400">
                {Math.round(currentSession.metrics.consensus * 100)}%
              </div>
              <div className="text-xs text-slate-500">${currentSession.metrics.totalCost.toFixed(2)}</div>
            </div>
          </div>
          {currentSession.status === "running" && (
            <div className="mt-2 flex items-center gap-2 text-xs text-amber-400">
              <Loader2 className="h-3 w-3 animate-spin" />
              Итерация {currentSession.currentIteration}/{currentSession.settings.maxIterations}
            </div>
          )}
        </div>
      )}

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="text-xs text-slate-500 uppercase tracking-wider mb-3">Хронология</div>

        {currentSession && currentSession.timeline.length > 0 ? (
          <div className="space-y-0">
            {currentSession.timeline.map((event, index) => (
              <TimelineEventItem
                key={event.id}
                event={event}
                isLast={index === currentSession.timeline.length - 1}
              />
            ))}
          </div>
        ) : (
          <div className="text-sm text-slate-500 text-center py-8">
            Пока нет событий
          </div>
        )}
      </div>

      {/* Collapsible Sections */}
      <div className="border-t border-slate-800">
        {/* History */}
        <button
          type="button"
          onClick={() => toggleSection("history")}
          className="w-full px-4 py-3 flex items-center justify-between text-sm text-slate-300 hover:bg-slate-800/50"
        >
          <span className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-slate-500" />
            История
          </span>
          {expandedSections.history ? (
            <ChevronDown className="h-4 w-4 text-slate-500" />
          ) : (
            <ChevronRight className="h-4 w-4 text-slate-500" />
          )}
        </button>
        {expandedSections.history && (
          <div className="px-4 pb-3 space-y-1">
            {sessions.length > 0 ? (
              sessions.slice(0, 5).map((session) => (
                <div
                  key={session.id}
                  className="text-xs text-slate-400 py-1 px-2 rounded hover:bg-slate-800 cursor-pointer"
                >
                  #{session.id.slice(0, 8)} {session.taskType}
                </div>
              ))
            ) : (
              <div className="text-xs text-slate-500">Нет истории</div>
            )}
          </div>
        )}

        {/* Templates */}
        <button
          type="button"
          onClick={() => toggleSection("templates")}
          className="w-full px-4 py-3 flex items-center justify-between text-sm text-slate-300 hover:bg-slate-800/50"
        >
          <span className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-slate-500" />
            Шаблоны
          </span>
          {expandedSections.templates ? (
            <ChevronDown className="h-4 w-4 text-slate-500" />
          ) : (
            <ChevronRight className="h-4 w-4 text-slate-500" />
          )}
        </button>
        {expandedSections.templates && (
          <div className="px-4 pb-3 space-y-1">
            {TEMPLATES.map((template) => (
              <button
                type="button"
                key={template.id}
                onClick={() => {
                  if (currentSession) {
                    updateSettings({ thinkingPatterns: [] });
                  }
                }}
                className="w-full text-left text-xs text-slate-400 py-1.5 px-2 rounded hover:bg-slate-800 cursor-pointer"
              >
                <div className="font-medium text-slate-300">{template.name}</div>
                <div className="text-slate-500">{template.description}</div>
              </button>
            ))}
          </div>
        )}

        {/* Thinking Patterns */}
        <button
          type="button"
          onClick={() => toggleSection("patterns")}
          className="w-full px-4 py-3 flex items-center justify-between text-sm text-slate-300 hover:bg-slate-800/50"
        >
          <span className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-slate-500" />
            Паттерны мышления
          </span>
          {expandedSections.patterns ? (
            <ChevronDown className="h-4 w-4 text-slate-500" />
          ) : (
            <ChevronRight className="h-4 w-4 text-slate-500" />
          )}
        </button>
        {expandedSections.patterns && (
          <div className="px-4 pb-3 space-y-1">
            {THINKING_PATTERNS.map((pattern) => {
              const isActive = currentSession?.settings.thinkingPatterns?.includes(pattern.id);
              return (
                <button
                  type="button"
                  key={pattern.id}
                  onClick={() => {
                    if (currentSession) {
                      const current = currentSession.settings.thinkingPatterns || [];
                      const updated = isActive
                        ? current.filter((p) => p !== pattern.id)
                        : [...current, pattern.id];
                      updateSettings({ thinkingPatterns: updated });
                    }
                  }}
                  className={cn(
                    "w-full text-left text-xs py-1.5 px-2 rounded cursor-pointer transition-colors",
                    isActive
                      ? "bg-violet-600/20 border border-violet-500/50 text-violet-300"
                      : "text-slate-400 hover:bg-slate-800"
                  )}
                >
                  <div className="font-medium">{pattern.name}</div>
                  <div className="text-slate-500">{pattern.description}</div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="p-4 border-t border-slate-800 space-y-1">
        <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Быстрые действия</div>
        <button
          type="button"
          onClick={createSession}
          className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-slate-400 hover:text-white hover:bg-slate-800/50 rounded"
        >
          <kbd className="w-5 text-center text-xs text-slate-500">[N]</kbd>
          <span>Новая сессия</span>
        </button>
        <button
          type="button"
          onClick={() => openDrawer("export")}
          className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-slate-400 hover:text-white hover:bg-slate-800/50 rounded"
        >
          <kbd className="w-5 text-center text-xs text-slate-500">[E]</kbd>
          <span>Экспорт</span>
        </button>
        <button
          type="button"
          onClick={() => setViewMode("compare")}
          className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-slate-400 hover:text-white hover:bg-slate-800/50 rounded"
        >
          <kbd className="w-5 text-center text-xs text-slate-500">[C]</kbd>
          <span>Сравнить</span>
        </button>
        <button
          type="button"
          onClick={openCommandPalette}
          className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-slate-400 hover:text-white hover:bg-slate-800/50 rounded"
        >
          <kbd className="w-5 text-center text-xs text-slate-500">[?]</kbd>
          <span>Горячие клавиши</span>
        </button>
      </div>
    </aside>
  );
}
