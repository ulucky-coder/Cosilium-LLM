"use client";

import { useUIStore } from "@/stores/uiStore";
import { useSessionStore, AgentAnalysis } from "@/stores/sessionStore";
import { AGENTS } from "@/lib/constants";
import { X, RefreshCw, Copy, Edit, BarChart3, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useState } from "react";

function AgentInspector({ agentId }: { agentId: string }) {
  const { currentSession } = useSessionStore();
  const [expandedSections, setExpandedSections] = useState({
    prompt: false,
    output: true,
    critique: true,
  });

  const agent = AGENTS.find((a) => a.id === agentId || a.name.toLowerCase() === agentId.toLowerCase());
  const analysis = currentSession?.analyses.find(
    (a) => a.agent_name.toLowerCase() === agentId.toLowerCase() || a.agent_name.toLowerCase() === agent?.name.toLowerCase()
  );
  const critiquesReceived = currentSession?.critiques.filter(
    (c) => c.target.toLowerCase() === agentId.toLowerCase() || c.target.toLowerCase() === agent?.name.toLowerCase()
  ) || [];

  if (!agent) {
    return <div className="p-4 text-slate-400">Агент не найден</div>;
  }

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  return (
    <div className="flex flex-col h-full">
      {/* Agent Header */}
      <div className="p-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", agent.color)}>
            <span className="text-white font-bold text-lg">{agent.name[0]}</span>
          </div>
          <div>
            <h3 className="text-white font-medium">{agent.name}</h3>
            <p className="text-xs text-slate-400">{agent.role}</p>
          </div>
        </div>
        {analysis && (
          <div className="mt-3 flex items-center gap-3">
            <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full",
                  analysis.confidence >= 0.8 ? "bg-emerald-500" :
                  analysis.confidence >= 0.6 ? "bg-amber-500" : "bg-red-500"
                )}
                style={{ width: `${analysis.confidence * 100}%` }}
              />
            </div>
            <span className="text-sm text-slate-300">{Math.round(analysis.confidence * 100)}%</span>
          </div>
        )}
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        {analysis ? (
          <>
            {/* Status Section */}
            <div className="p-4 border-b border-slate-800">
              <h4 className="text-xs text-slate-500 uppercase tracking-wider mb-3">Статус</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-slate-500">Время</span>
                  <p className="text-white">{analysis.duration?.toFixed(2) || "—"}с</p>
                </div>
                <div>
                  <span className="text-slate-500">Токены</span>
                  <p className="text-white">{analysis.tokens?.toLocaleString() || "—"}</p>
                </div>
                <div>
                  <span className="text-slate-500">Стоимость</span>
                  <p className="text-white">${analysis.cost?.toFixed(4) || "—"}</p>
                </div>
                <div>
                  <span className="text-slate-500">Уверенность</span>
                  <p className="text-white">{Math.round(analysis.confidence * 100)}%</p>
                </div>
              </div>
            </div>

            {/* Key Points */}
            {analysis.key_points && analysis.key_points.length > 0 && (
              <div className="p-4 border-b border-slate-800">
                <h4 className="text-xs text-slate-500 uppercase tracking-wider mb-3">Ключевые моменты</h4>
                <ul className="space-y-2">
                  {analysis.key_points.map((point, i) => (
                    <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                      <span className="text-violet-400 mt-0.5">•</span>
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Risks */}
            {analysis.risks && analysis.risks.length > 0 && (
              <div className="p-4 border-b border-slate-800">
                <h4 className="text-xs text-slate-500 uppercase tracking-wider mb-3">Выявленные риски</h4>
                <ul className="space-y-2">
                  {analysis.risks.map((risk, i) => (
                    <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                      <span className="text-amber-400 mt-0.5">⚠</span>
                      {risk}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Critique Received */}
            {critiquesReceived.length > 0 && (
              <div className="p-4 border-b border-slate-800">
                <button
                  type="button"
                  onClick={() => toggleSection("critique")}
                  className="w-full flex items-center justify-between text-xs text-slate-500 uppercase tracking-wider mb-3"
                >
                  <span>Полученная критика</span>
                  {expandedSections.critique ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
                {expandedSections.critique && (
                  <div className="space-y-3">
                    {critiquesReceived.map((critique, i) => {
                      const criticAgent = AGENTS.find(
                        (a) => a.id === critique.critic.toLowerCase() || a.name.toLowerCase() === critique.critic.toLowerCase()
                      );
                      return (
                        <div key={i} className="bg-slate-800/50 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-slate-300">От {criticAgent?.name || critique.critic}</span>
                            <Badge variant="outline" className={cn(
                              "text-xs",
                              critique.score >= 8 ? "border-emerald-500 text-emerald-400" :
                              critique.score >= 6 ? "border-amber-500 text-amber-400" : "border-red-500 text-red-400"
                            )}>
                              {critique.score}/10
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-400 line-clamp-3">{critique.critique}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Full Output */}
            <div className="p-4">
              <button
                type="button"
                onClick={() => toggleSection("output")}
                className="w-full flex items-center justify-between text-xs text-slate-500 uppercase tracking-wider mb-3"
              >
                <span>Полный вывод</span>
                {expandedSections.output ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
              {expandedSections.output && (
                <div className="bg-slate-800/50 rounded-lg p-3 max-h-64 overflow-y-auto">
                  <p className="text-sm text-slate-300 whitespace-pre-wrap">{analysis.analysis}</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="p-4 text-center text-slate-400">
            <p>Данные анализа пока отсутствуют</p>
            <p className="text-xs text-slate-500 mt-1">Запустите анализ, чтобы увидеть результаты</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-4 border-t border-slate-800">
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" className="text-xs border-slate-700 text-slate-300">
            <RefreshCw className="h-3 w-3 mr-1" />
            Перегенерировать
          </Button>
          <Button variant="outline" size="sm" className="text-xs border-slate-700 text-slate-300">
            <Copy className="h-3 w-3 mr-1" />
            Копировать
          </Button>
          <Button variant="outline" size="sm" className="text-xs border-slate-700 text-slate-300">
            <Edit className="h-3 w-3 mr-1" />
            Редактировать
          </Button>
          <Button variant="outline" size="sm" className="text-xs border-slate-700 text-slate-300">
            <BarChart3 className="h-3 w-3 mr-1" />
            Сравнить
          </Button>
        </div>
      </div>
    </div>
  );
}

export function Drawer() {
  const { drawerOpen, drawerContent, drawerData, closeDrawer } = useUIStore();

  if (!drawerOpen) return null;

  return (
    <aside className="w-80 border-l border-slate-800 bg-slate-950/80 backdrop-blur-sm flex flex-col h-full">
      {/* Header */}
      <div className="h-12 flex items-center justify-between px-4 border-b border-slate-800">
        <h2 className="text-sm font-medium text-white uppercase tracking-wider">
          {drawerContent === "agent" ? "Инспектор агента" :
           drawerContent === "critique" ? "Детали критики" :
           drawerContent === "settings" ? "Настройки" :
           drawerContent === "export" ? "Экспорт" : "Детали"}
        </h2>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white" onClick={closeDrawer}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {drawerContent === "agent" && typeof drawerData.agentId === "string" && (
          <AgentInspector agentId={drawerData.agentId} />
        )}
        {drawerContent === "critique" && (
          <div className="p-4 text-slate-400">Детали критики скоро будут доступны</div>
        )}
        {drawerContent === "settings" && (
          <div className="p-4 text-slate-400">Панель настроек скоро будет доступна</div>
        )}
        {drawerContent === "export" && (
          <div className="p-4 text-slate-400">Опции экспорта скоро будут доступны</div>
        )}
      </div>
    </aside>
  );
}
