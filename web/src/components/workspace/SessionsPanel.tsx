"use client";

import { useSessionStore, Session } from "@/stores/sessionStore";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
} from "lucide-react";

export function SessionsPanel() {
  const { sessions, currentSession, createSession, loadSession, deleteSession } = useSessionStore();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-slate-800">
        <Button
          onClick={createSession}
          size="sm"
          className="w-full bg-violet-600 hover:bg-violet-500 justify-start"
        >
          <Plus className="h-4 w-4 mr-2" />
          Новая сессия
        </Button>
      </div>

      {/* Sessions List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {sessions.length === 0 && !currentSession && (
          <div className="text-center py-8 text-slate-500 text-sm">
            Сессий пока нет
          </div>
        )}

        {/* Current Session */}
        {currentSession && (
          <SessionCard
            session={currentSession}
            isActive={true}
            onSelect={() => {}}
            onDelete={() => {}}
          />
        )}

        {/* History */}
        {sessions.map((session) => (
          <SessionCard
            key={session.id}
            session={session}
            isActive={currentSession?.id === session.id}
            onSelect={() => loadSession(session.id)}
            onDelete={() => deleteSession(session.id)}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-slate-800 text-xs text-slate-500">
        {sessions.length + (currentSession ? 1 : 0)} сессий
      </div>
    </div>
  );
}

interface SessionCardProps {
  session: Session;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

function SessionCard({ session, isActive, onSelect, onDelete }: SessionCardProps) {
  const StatusIcon = {
    input: Clock,
    running: Loader2,
    paused: Clock,
    complete: CheckCircle2,
    error: AlertCircle,
  }[session.status];

  const statusColor = {
    input: "text-slate-400",
    running: "text-blue-400 animate-spin",
    paused: "text-amber-400",
    complete: "text-emerald-400",
    error: "text-red-400",
  }[session.status];

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full text-left p-3 rounded-lg transition-colors group",
        isActive
          ? "bg-violet-600/20 border border-violet-500/50"
          : "hover:bg-slate-800/50 border border-transparent"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <StatusIcon className={cn("h-3.5 w-3.5 shrink-0", statusColor)} />
            <span className="text-sm font-medium text-white truncate">
              #{session.id.slice(0, 8)}
            </span>
          </div>
          <p className="text-xs text-slate-400 truncate">
            {session.task || "Задача не определена"}
          </p>
        </div>
        <Badge variant="outline" className="text-xs shrink-0 capitalize">
          {session.taskType}
        </Badge>
      </div>

      {session.status === "complete" && session.metrics.consensus > 0 && (
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                session.metrics.consensus >= 0.8 ? "bg-emerald-500" :
                session.metrics.consensus >= 0.6 ? "bg-amber-500" : "bg-red-500"
              )}
              style={{ width: `${session.metrics.consensus * 100}%` }}
            />
          </div>
          <span className="text-xs text-slate-500">
            {Math.round(session.metrics.consensus * 100)}%
          </span>
        </div>
      )}

      {/* Delete button - show on hover */}
      {!isActive && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-all"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </button>
  );
}
