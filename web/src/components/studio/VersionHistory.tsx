"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  History,
  RotateCcw,
  Eye,
  X,
  Clock,
  User,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";

interface Version {
  id: string;
  agent_id: string;
  version: number;
  content: string;
  change_summary?: string;
  created_at: string;
  created_by: string;
}

interface VersionHistoryProps {
  agentId: string;
  agentName: string;
  currentContent: string;
  onRollback: (content: string, version: number) => void;
  type?: "prompt" | "config";
}

export function VersionHistory({
  agentId,
  agentName,
  currentContent,
  onRollback,
  type = "prompt",
}: VersionHistoryProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [versions, setVersions] = useState<Version[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<Version | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [rollbackSuccess, setRollbackSuccess] = useState(false);

  const loadVersions = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/studio/versions?agent_id=${agentId}&type=${type}&limit=20`
      );
      const data = await response.json();
      if (data.success) {
        setVersions(data.data);
      }
    } catch (error) {
      console.error("Failed to load versions:", error);
    } finally {
      setIsLoading(false);
    }
  }, [agentId, type]);

  useEffect(() => {
    if (isOpen) {
      loadVersions();
    }
  }, [isOpen, loadVersions]);

  const handlePreview = (version: Version) => {
    setSelectedVersion(version);
    setPreviewContent(version.content);
  };

  const handleRollback = async () => {
    if (!selectedVersion) return;

    setIsRollingBack(true);
    try {
      const response = await fetch("/api/studio/versions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: agentId,
          version: selectedVersion.version,
          type,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setRollbackSuccess(true);
        onRollback(selectedVersion.content, selectedVersion.version);
        setTimeout(() => {
          setRollbackSuccess(false);
          setSelectedVersion(null);
          setPreviewContent(null);
          loadVersions(); // Refresh to show new backup version
        }, 1500);
      }
    } catch (error) {
      console.error("Failed to rollback:", error);
    } finally {
      setIsRollingBack(false);
    }
  };

  const saveCurrentVersion = async (summary: string) => {
    try {
      const response = await fetch("/api/studio/versions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: agentId,
          type,
          content: currentContent,
          change_summary: summary,
        }),
      });

      const data = await response.json();
      if (data.success) {
        loadVersions();
      }
    } catch (error) {
      console.error("Failed to save version:", error);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "только что";
    if (diffMins < 60) return `${diffMins} мин назад`;
    if (diffHours < 24) return `${diffHours} ч назад`;
    if (diffDays < 7) return `${diffDays} дн назад`;
    return date.toLocaleDateString("ru-RU");
  };

  return (
    <div className="relative">
      {/* Toggle button */}
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-slate-400 hover:text-white"
        onClick={() => setIsOpen(!isOpen)}
      >
        <History className="h-3.5 w-3.5 mr-1" />
        История
        {isOpen ? (
          <ChevronUp className="h-3 w-3 ml-1" />
        ) : (
          <ChevronDown className="h-3 w-3 ml-1" />
        )}
      </Button>

      {/* Dropdown panel */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-96 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800">
            <span className="text-sm font-medium text-white">
              История версий: {agentName}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-slate-400"
                onClick={() => {
                  const summary = prompt("Описание версии:");
                  if (summary) saveCurrentVersion(summary);
                }}
              >
                Сохранить версию
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Version list */}
          <div className="max-h-64 overflow-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
              </div>
            ) : versions.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm">
                Нет сохранённых версий
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {versions.map((version) => (
                  <div
                    key={version.id}
                    className={cn(
                      "px-3 py-2 hover:bg-slate-800/50 cursor-pointer transition-colors",
                      selectedVersion?.id === version.id && "bg-slate-800"
                    )}
                    onClick={() => handlePreview(version)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className="text-xs border-slate-700"
                        >
                          v{version.version}
                        </Badge>
                        <span className="text-sm text-slate-300 truncate max-w-[180px]">
                          {version.change_summary || "Без описания"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-slate-500 hover:text-white"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePreview(version);
                          }}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDate(version.created_at)}
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {version.created_by}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Preview panel */}
          {previewContent && selectedVersion && (
            <div className="border-t border-slate-700">
              <div className="px-3 py-2 bg-slate-800/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-400">
                    Предпросмотр v{selectedVersion.version}
                  </span>
                  <div className="flex items-center gap-2">
                    {rollbackSuccess ? (
                      <Badge className="bg-emerald-600 text-xs">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Восстановлено
                      </Badge>
                    ) : (
                      <Button
                        variant="default"
                        size="sm"
                        className="h-7 text-xs bg-amber-600 hover:bg-amber-700"
                        onClick={handleRollback}
                        disabled={isRollingBack}
                      >
                        {isRollingBack ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <RotateCcw className="h-3 w-3 mr-1" />
                        )}
                        Восстановить
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        setSelectedVersion(null);
                        setPreviewContent(null);
                      }}
                    >
                      Закрыть
                    </Button>
                  </div>
                </div>
                <pre className="text-xs text-slate-300 bg-slate-900 rounded p-2 max-h-32 overflow-auto whitespace-pre-wrap font-mono">
                  {previewContent}
                </pre>
              </div>
            </div>
          )}

          {/* Warning */}
          {selectedVersion && !rollbackSuccess && (
            <div className="px-3 py-2 bg-amber-950/30 border-t border-amber-900/50">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-400">
                  Восстановление заменит текущий промпт. Текущая версия будет автоматически сохранена.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
