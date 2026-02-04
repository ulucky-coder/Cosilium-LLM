"use client";

import { useUIStore } from "@/stores/uiStore";
import { useSessionStore } from "@/stores/sessionStore";
import { AGENTS, AgentId } from "@/lib/constants";
import { X, RefreshCw, Copy, Edit, BarChart3, ChevronDown, ChevronUp, Download, FileJson, FileText, Printer, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useState } from "react";

// Available models for each provider
const AVAILABLE_MODELS: Record<AgentId, { id: string; name: string }[]> = {
  chatgpt: [
    { id: "gpt-4o", name: "GPT-4o" },
    { id: "gpt-4-turbo", name: "GPT-4 Turbo" },
    { id: "gpt-4", name: "GPT-4" },
    { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo" },
  ],
  claude: [
    { id: "claude-3-opus", name: "Claude 3 Opus" },
    { id: "claude-3-sonnet", name: "Claude 3 Sonnet" },
    { id: "claude-3-haiku", name: "Claude 3 Haiku" },
  ],
  gemini: [
    { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash" },
    { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro" },
    { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash" },
  ],
  deepseek: [
    { id: "deepseek-chat", name: "DeepSeek Chat" },
    { id: "deepseek-coder", name: "DeepSeek Coder" },
  ],
};

function AgentInspector({ agentId }: { agentId: string }) {
  const { currentSession } = useSessionStore();
  const { setViewMode } = useUIStore();
  const [expandedSections, setExpandedSections] = useState({
    prompt: false,
    output: true,
    critique: true,
  });
  const [copied, setCopied] = useState(false);

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

  const handleCopy = () => {
    if (analysis) {
      navigator.clipboard.writeText(analysis.analysis);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCompare = () => {
    setViewMode("compare");
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
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-xs border-slate-700 text-slate-300"
            onClick={() => alert("Перегенерация будет доступна в следующей версии")}
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Перегенерировать
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-xs border-slate-700 text-slate-300"
            onClick={handleCopy}
            disabled={!analysis}
          >
            {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
            {copied ? "Скопировано" : "Копировать"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-xs border-slate-700 text-slate-300"
            onClick={() => alert("Редактирование будет доступно в следующей версии")}
          >
            <Edit className="h-3 w-3 mr-1" />
            Редактировать
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-xs border-slate-700 text-slate-300"
            onClick={handleCompare}
          >
            <BarChart3 className="h-3 w-3 mr-1" />
            Сравнить
          </Button>
        </div>
      </div>
    </div>
  );
}

function SettingsPanel() {
  const { currentSession, updateSettings } = useSessionStore();

  if (!currentSession) {
    return <div className="p-4 text-slate-400">Создайте сессию для настройки</div>;
  }

  const { settings } = currentSession;

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Model Selection */}
      <div className="p-4 border-b border-slate-800">
        <h4 className="text-xs text-slate-500 uppercase tracking-wider mb-3">Модели агентов</h4>
        <div className="space-y-3">
          {AGENTS.map((agent) => (
            <div key={agent.id} className="flex items-center gap-3">
              <div className={cn("w-3 h-3 rounded-full", agent.color)} />
              <span className="text-sm text-slate-300 w-20">{agent.name}</span>
              <Select
                value={settings.models?.[agent.id as AgentId] || AVAILABLE_MODELS[agent.id as AgentId][0].id}
                onValueChange={(value) => {
                  updateSettings({
                    models: {
                      ...settings.models,
                      [agent.id]: value,
                    },
                  });
                }}
              >
                <SelectTrigger className="flex-1 h-8 text-xs bg-slate-900 border-slate-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700">
                  {AVAILABLE_MODELS[agent.id as AgentId].map((model) => (
                    <SelectItem key={model.id} value={model.id} className="text-xs">
                      {model.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </div>

      {/* Analysis Settings */}
      <div className="p-4 border-b border-slate-800">
        <h4 className="text-xs text-slate-500 uppercase tracking-wider mb-3">Параметры анализа</h4>

        <div className="space-y-4">
          {/* Max Iterations */}
          <div>
            <label className="text-xs text-slate-400 mb-1 block">
              Итерации: {settings.maxIterations}
            </label>
            <input
              type="range"
              min="1"
              max="5"
              value={settings.maxIterations}
              onChange={(e) => updateSettings({ maxIterations: parseInt(e.target.value) })}
              className="w-full accent-violet-500"
            />
            <div className="flex justify-between text-xs text-slate-500">
              <span>1</span>
              <span>5</span>
            </div>
          </div>

          {/* Temperature */}
          <div>
            <label className="text-xs text-slate-400 mb-1 block">
              Температура: {settings.temperature.toFixed(2)}
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={settings.temperature * 100}
              onChange={(e) => updateSettings({ temperature: parseInt(e.target.value) / 100 })}
              className="w-full accent-violet-500"
            />
            <div className="flex justify-between text-xs text-slate-500">
              <span>Точный (0)</span>
              <span>Креативный (1)</span>
            </div>
          </div>

          {/* Consensus Threshold */}
          <div>
            <label className="text-xs text-slate-400 mb-1 block">
              Порог консенсуса: {Math.round(settings.consensusThreshold * 100)}%
            </label>
            <input
              type="range"
              min="50"
              max="95"
              value={settings.consensusThreshold * 100}
              onChange={(e) => updateSettings({ consensusThreshold: parseInt(e.target.value) / 100 })}
              className="w-full accent-violet-500"
            />
            <div className="flex justify-between text-xs text-slate-500">
              <span>50%</span>
              <span>95%</span>
            </div>
          </div>

          {/* Budget */}
          <div>
            <label className="text-xs text-slate-400 mb-1 block">
              Бюджет: ${settings.budget.toFixed(2)}
            </label>
            <input
              type="range"
              min="1"
              max="50"
              value={settings.budget}
              onChange={(e) => updateSettings({ budget: parseInt(e.target.value) })}
              className="w-full accent-violet-500"
            />
            <div className="flex justify-between text-xs text-slate-500">
              <span>$1</span>
              <span>$50</span>
            </div>
          </div>
        </div>
      </div>

      {/* Agent Selection */}
      <div className="p-4">
        <h4 className="text-xs text-slate-500 uppercase tracking-wider mb-3">Активные агенты</h4>
        <div className="space-y-2">
          {AGENTS.map((agent) => {
            const isActive = settings.agents.includes(agent.id as AgentId);
            return (
              <button
                type="button"
                key={agent.id}
                onClick={() => {
                  const newAgents = isActive
                    ? settings.agents.filter((a) => a !== agent.id)
                    : [...settings.agents, agent.id as AgentId];
                  if (newAgents.length > 0) {
                    updateSettings({ agents: newAgents });
                  }
                }}
                className={cn(
                  "w-full flex items-center gap-3 p-2 rounded-lg border transition-colors text-left",
                  isActive
                    ? "border-violet-500 bg-violet-500/10"
                    : "border-slate-700 hover:border-slate-600"
                )}
              >
                <div className={cn("w-3 h-3 rounded-full", agent.color)} />
                <div className="flex-1">
                  <div className="text-sm text-white">{agent.name}</div>
                  <div className="text-xs text-slate-500">{agent.role}</div>
                </div>
                {isActive && <Check className="h-4 w-4 text-violet-400" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ExportPanel() {
  const { currentSession } = useSessionStore();
  const [copied, setCopied] = useState(false);

  if (!currentSession) {
    return <div className="p-4 text-slate-400">Нет данных для экспорта</div>;
  }

  const exportAsJSON = () => {
    const data = {
      id: currentSession.id,
      task: currentSession.task,
      taskType: currentSession.taskType,
      analyses: currentSession.analyses,
      synthesis: currentSession.synthesis,
      critiques: currentSession.critiques,
      metrics: currentSession.metrics,
      createdAt: currentSession.createdAt,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `llm-top-session-${currentSession.id.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportAsMarkdown = () => {
    let md = `# LLM-top Analysis Report\n\n`;
    md += `**Session:** #${currentSession.id.slice(0, 8)}\n`;
    md += `**Type:** ${currentSession.taskType}\n`;
    md += `**Date:** ${new Date(currentSession.createdAt).toLocaleString()}\n\n`;
    md += `## Task\n\n${currentSession.task}\n\n`;

    if (currentSession.analyses.length > 0) {
      md += `## Agent Analyses\n\n`;
      currentSession.analyses.forEach((a) => {
        md += `### ${a.agent_name} (${Math.round(a.confidence * 100)}% confidence)\n\n`;
        md += `${a.analysis}\n\n`;
        if (a.key_points.length > 0) {
          md += `**Key Points:**\n`;
          a.key_points.forEach((p) => md += `- ${p}\n`);
          md += `\n`;
        }
      });
    }

    if (currentSession.synthesis) {
      md += `## Synthesis\n\n${currentSession.synthesis.summary}\n\n`;
      if (currentSession.synthesis.conclusions.length > 0) {
        md += `### Conclusions\n\n`;
        currentSession.synthesis.conclusions.forEach((c, i) => {
          md += `${i + 1}. ${c.conclusion} (${c.probability})\n`;
        });
        md += `\n`;
      }
    }

    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `llm-top-session-${currentSession.id.slice(0, 8)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = () => {
    const text = currentSession.synthesis?.summary || currentSession.task;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Export Options */}
      <div className="p-4 border-b border-slate-800">
        <h4 className="text-xs text-slate-500 uppercase tracking-wider mb-3">Экспорт результатов</h4>
        <div className="space-y-2">
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start border-slate-700 text-slate-300"
            onClick={exportAsMarkdown}
          >
            <FileText className="h-4 w-4 mr-2" />
            Экспорт в Markdown
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start border-slate-700 text-slate-300"
            onClick={exportAsJSON}
          >
            <FileJson className="h-4 w-4 mr-2" />
            Экспорт в JSON
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start border-slate-700 text-slate-300"
            onClick={copyToClipboard}
          >
            {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
            {copied ? "Скопировано!" : "Копировать в буфер"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start border-slate-700 text-slate-300"
            onClick={handlePrint}
          >
            <Printer className="h-4 w-4 mr-2" />
            Печать
          </Button>
        </div>
      </div>

      {/* Session Info */}
      <div className="p-4">
        <h4 className="text-xs text-slate-500 uppercase tracking-wider mb-3">Информация о сессии</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">ID сессии</span>
            <span className="text-slate-300">#{currentSession.id.slice(0, 8)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Тип анализа</span>
            <span className="text-slate-300 capitalize">{currentSession.taskType}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Агентов</span>
            <span className="text-slate-300">{currentSession.analyses.length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Консенсус</span>
            <span className="text-slate-300">{Math.round(currentSession.metrics.consensus * 100)}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Токены</span>
            <span className="text-slate-300">{currentSession.metrics.totalTokens.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Стоимость</span>
            <span className="text-slate-300">${currentSession.metrics.totalCost.toFixed(4)}</span>
          </div>
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
          <div className="p-4 text-slate-400">Выберите критику для просмотра деталей</div>
        )}
        {drawerContent === "settings" && <SettingsPanel />}
        {drawerContent === "export" && <ExportPanel />}
      </div>
    </aside>
  );
}
