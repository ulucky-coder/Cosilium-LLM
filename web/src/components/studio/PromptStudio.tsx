"use client";

import { useState, useEffect, useCallback } from "react";
import { usePromptStore } from "@/stores/promptStore";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Play,
  Save,
  RotateCcw,
  ChevronRight,
  FileCode,
  Bot,
  Sparkles,
  Copy,
  Check,
  Loader2,
  RefreshCw,
  Cloud,
  CloudOff,
} from "lucide-react";
import { VersionHistory } from "./VersionHistory";

interface PromptStudioProps {
  onLog?: (message: string) => void;
}

const AGENTS = [
  { id: "chatgpt", name: "ChatGPT", color: "bg-emerald-500" },
  { id: "claude", name: "Claude", color: "bg-amber-500" },
  { id: "gemini", name: "Gemini", color: "bg-blue-500" },
  { id: "deepseek", name: "DeepSeek", color: "bg-violet-500" },
];

const VARIABLES = [
  { name: "{{task}}", description: "Задача пользователя" },
  { name: "{{task_type}}", description: "Тип анализа" },
  { name: "{{context}}", description: "Дополнительный контекст" },
  { name: "{{agent.name}}", description: "Имя агента" },
  { name: "{{agent.role}}", description: "Роль агента" },
  { name: "{{patterns.active}}", description: "Активные паттерны мышления" },
];

export function PromptStudio({ onLog }: PromptStudioProps) {
  const {
    agentPrompts,
    agentConfigs,
    synthesisPrompt,
    updateAgentPrompts,
    updateAgentConfig,
    updateSynthesisPrompt,
  } = usePromptStore();

  const [selectedAgent, setSelectedAgent] = useState("chatgpt");
  const [activeTab, setActiveTab] = useState<"system" | "critique" | "user" | "config">("system");
  const [showVariables, setShowVariables] = useState(true);
  const [testInput, setTestInput] = useState("Оценить инвестиционную привлекательность стартапа в сфере AI");
  const [testOutput, setTestOutput] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [dataSource, setDataSource] = useState<"memory" | "database" | "loading">("loading");

  const currentPrompts = agentPrompts[selectedAgent];
  const currentConfig = agentConfigs.find((c) => c.id === selectedAgent);

  const [localPrompts, setLocalPrompts] = useState(currentPrompts);
  const [localConfig, setLocalConfig] = useState(currentConfig);

  // Load prompts from API on mount
  const loadPrompts = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/studio/prompts");
      const data = await response.json();

      if (data.success && data.data.length > 0) {
        setDataSource(data.source === "database" ? "database" : "memory");
        onLog?.(`✓ Loaded prompts from ${data.source}`);

        // Update store with loaded prompts
        const promptsByAgent: Record<string, Record<string, string>> = {};
        for (const prompt of data.data) {
          if (!promptsByAgent[prompt.agent_id]) {
            promptsByAgent[prompt.agent_id] = {};
          }
          const field = prompt.prompt_type === "system" ? "systemPrompt" :
                       prompt.prompt_type === "critique" ? "critiquePrompt" :
                       "userPromptTemplate";
          promptsByAgent[prompt.agent_id][field] = prompt.content;
        }

        // Update each agent's prompts
        for (const [agentId, prompts] of Object.entries(promptsByAgent)) {
          if (agentPrompts[agentId]) {
            updateAgentPrompts(agentId, { ...agentPrompts[agentId], ...prompts });
          }
        }
      } else {
        setDataSource("memory");
      }
    } catch (error) {
      console.error("Failed to load prompts:", error);
      setDataSource("memory");
      onLog?.("⚠ Using local prompts (API unavailable)");
    } finally {
      setIsLoading(false);
    }
  }, [agentPrompts, updateAgentPrompts, onLog]);

  useEffect(() => {
    loadPrompts();
  }, []);

  // Update local state when agent changes
  useEffect(() => {
    setLocalPrompts(agentPrompts[selectedAgent]);
    setLocalConfig(agentConfigs.find((c) => c.id === selectedAgent));
    setHasChanges(false);
  }, [selectedAgent, agentPrompts, agentConfigs]);

  const handlePromptChange = (field: string, value: string) => {
    setLocalPrompts({ ...localPrompts, [field]: value });
    setHasChanges(true);
  };

  const handleConfigChange = (field: string, value: any) => {
    setLocalConfig({ ...localConfig!, [field]: value });
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);

    // Save to local store first
    updateAgentPrompts(selectedAgent, localPrompts);
    if (localConfig) {
      updateAgentConfig(selectedAgent, localConfig);
    }

    // Try to save to API
    try {
      const promptTypes = [
        { type: "system", content: localPrompts.systemPrompt },
        { type: "critique", content: localPrompts.critiquePrompt },
        { type: "user_template", content: localPrompts.userPromptTemplate },
      ];

      for (const prompt of promptTypes) {
        if (prompt.content) {
          await fetch("/api/studio/prompts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              agent_id: selectedAgent,
              prompt_type: prompt.type,
              content: prompt.content,
            }),
          });
        }
      }

      // Auto-save current version (fire and forget)
      const currentContent =
        activeTab === "system"
          ? localPrompts.systemPrompt
          : activeTab === "critique"
          ? localPrompts.critiquePrompt
          : localPrompts.userPromptTemplate;

      fetch("/api/studio/versions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: selectedAgent,
          type: "prompt",
          content: currentContent,
          change_summary: `Saved ${activeTab} prompt`,
        }),
      }).catch(() => {
        // Ignore version save errors
      });

      setDataSource("database");
      onLog?.(`✓ Saved prompts for ${selectedAgent} to database`);
    } catch (error) {
      onLog?.(`✓ Saved prompts for ${selectedAgent} locally`);
    }

    setHasChanges(false);
    setIsSaving(false);
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestOutput("");
    onLog?.(`▶ Testing ${selectedAgent} prompt...`);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: testInput,
          task_type: "strategy",
          max_iterations: 1,
        }),
      });

      const data = await response.json();
      const agentResult = data.analyses?.find(
        (a: any) => a.agent_name.toLowerCase() === selectedAgent ||
                    a.agent_name === AGENTS.find(ag => ag.id === selectedAgent)?.name
      );

      if (agentResult) {
        setTestOutput(agentResult.analysis);
        onLog?.(`✓ Test completed. Tokens: ${agentResult.tokens}, Cost: $${agentResult.cost?.toFixed(4)}`);
      } else {
        setTestOutput("Результат не найден");
        onLog?.("⚠ No result from agent");
      }
    } catch (error) {
      setTestOutput("Ошибка: " + (error as Error).message);
      onLog?.(`✗ Test failed: ${(error as Error).message}`);
    } finally {
      setIsTesting(false);
    }
  };

  const handleCopy = () => {
    const content = activeTab === "system" ? localPrompts.systemPrompt :
                   activeTab === "critique" ? localPrompts.critiquePrompt :
                   localPrompts.userPromptTemplate;
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const insertVariable = (variable: string) => {
    const field = activeTab === "system" ? "systemPrompt" :
                 activeTab === "critique" ? "critiquePrompt" :
                 "userPromptTemplate";
    const currentValue = localPrompts[field as keyof typeof localPrompts];
    handlePromptChange(field, currentValue + variable);
  };

  return (
    <div className="flex h-full">
      {/* Left Panel - File Tree */}
      <div className="w-56 bg-slate-900 border-r border-slate-800 flex flex-col">
        <div className="p-3 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            Промпты агентов
          </h3>
          <div className="flex items-center gap-1">
            <span title={dataSource === "database" ? "Synced with database" : dataSource === "loading" ? "Loading..." : "Local only"}>
              {dataSource === "database" ? (
                <Cloud className="h-3 w-3 text-emerald-400" />
              ) : dataSource === "loading" ? (
                <Loader2 className="h-3 w-3 text-slate-400 animate-spin" />
              ) : (
                <CloudOff className="h-3 w-3 text-amber-400" />
              )}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={loadPrompts}
              disabled={isLoading}
            >
              <RefreshCw className={cn("h-3 w-3 text-slate-400", isLoading && "animate-spin")} />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto py-2">
          {AGENTS.map((agent) => (
            <button
              key={agent.id}
              type="button"
              onClick={() => setSelectedAgent(agent.id)}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors",
                selectedAgent === agent.id
                  ? "bg-violet-600/20 text-white"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              )}
            >
              <div className={cn("w-2 h-2 rounded-full", agent.color)} />
              <Bot className="h-4 w-4" />
              <span>{agent.name}</span>
              {selectedAgent === agent.id && hasChanges && (
                <span className="ml-auto w-2 h-2 rounded-full bg-amber-500" />
              )}
            </button>
          ))}

          <div className="my-2 border-t border-slate-800" />

          <button
            type="button"
            onClick={() => setSelectedAgent("synthesis")}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors",
              selectedAgent === "synthesis"
                ? "bg-violet-600/20 text-white"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            )}
          >
            <Sparkles className="h-4 w-4 text-violet-400" />
            <span>Синтез</span>
          </button>
        </div>
      </div>

      {/* Main Editor */}
      <div className="flex-1 flex flex-col">
        {/* Tabs */}
        <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800">
          <div className="flex gap-1">
            {selectedAgent !== "synthesis" ? (
              <>
                {(["system", "critique", "user", "config"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      "px-3 py-1.5 text-sm rounded transition-colors",
                      activeTab === tab
                        ? "bg-violet-600 text-white"
                        : "text-slate-400 hover:text-white hover:bg-slate-800"
                    )}
                  >
                    {tab === "system" && "System"}
                    {tab === "critique" && "Critique"}
                    {tab === "user" && "User Template"}
                    {tab === "config" && "Config"}
                  </button>
                ))}
              </>
            ) : (
              <span className="text-sm text-white px-3 py-1.5">Synthesis Prompt</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {selectedAgent !== "synthesis" && activeTab !== "config" && (
              <VersionHistory
                agentId={selectedAgent}
                agentName={AGENTS.find((a) => a.id === selectedAgent)?.name || selectedAgent}
                currentContent={
                  activeTab === "system"
                    ? localPrompts.systemPrompt
                    : activeTab === "critique"
                    ? localPrompts.critiquePrompt
                    : localPrompts.userPromptTemplate
                }
                onRollback={(content, version) => {
                  const field =
                    activeTab === "system"
                      ? "systemPrompt"
                      : activeTab === "critique"
                      ? "critiquePrompt"
                      : "userPromptTemplate";
                  handlePromptChange(field, content);
                  onLog?.(`✓ Rolled back to version ${version}`);
                }}
              />
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="h-8 text-slate-400"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setLocalPrompts(currentPrompts);
                setLocalConfig(currentConfig);
                setHasChanges(false);
              }}
              disabled={!hasChanges}
              className="h-8 text-slate-400"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
              className="h-8 text-blue-400 hover:text-blue-300"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Save className="h-4 w-4 mr-1" />
                  Save
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Editor Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Code Editor */}
          <div className="flex-1 flex flex-col">
            {selectedAgent !== "synthesis" && activeTab !== "config" ? (
              <div className="flex-1 p-4">
                <Textarea
                  value={
                    activeTab === "system" ? localPrompts.systemPrompt :
                    activeTab === "critique" ? localPrompts.critiquePrompt :
                    localPrompts.userPromptTemplate
                  }
                  onChange={(e) => handlePromptChange(
                    activeTab === "system" ? "systemPrompt" :
                    activeTab === "critique" ? "critiquePrompt" :
                    "userPromptTemplate",
                    e.target.value
                  )}
                  className="h-full min-h-[400px] bg-slate-950 border-slate-700 font-mono text-sm resize-none"
                  placeholder="Введите промпт..."
                />
              </div>
            ) : activeTab === "config" && localConfig ? (
              <div className="flex-1 p-4 space-y-4 overflow-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Роль</label>
                    <Input
                      value={localConfig.role}
                      onChange={(e) => handleConfigChange("role", e.target.value)}
                      className="bg-slate-950 border-slate-700"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Модель</label>
                    <Input
                      value={localConfig.model}
                      onChange={(e) => handleConfigChange("model", e.target.value)}
                      className="bg-slate-950 border-slate-700"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-400 mb-1 block">
                    Температура: {localConfig.temperature}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={localConfig.temperature * 100}
                    onChange={(e) => handleConfigChange("temperature", parseInt(e.target.value) / 100)}
                    className="w-full accent-violet-500"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Фокус</label>
                  <Input
                    value={localConfig.focus}
                    onChange={(e) => handleConfigChange("focus", e.target.value)}
                    className="bg-slate-950 border-slate-700"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 mb-1 block">
                    Сильные стороны (через запятую)
                  </label>
                  <Input
                    value={localConfig.strengths.join(", ")}
                    onChange={(e) => handleConfigChange(
                      "strengths",
                      e.target.value.split(",").map((s) => s.trim())
                    )}
                    className="bg-slate-950 border-slate-700"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={localConfig.enabled}
                    onChange={(e) => handleConfigChange("enabled", e.target.checked)}
                    className="accent-violet-500"
                  />
                  <label className="text-sm text-slate-400">Агент активен</label>
                </div>
              </div>
            ) : (
              <div className="flex-1 p-4">
                <Textarea
                  value={synthesisPrompt}
                  onChange={(e) => updateSynthesisPrompt(e.target.value)}
                  className="h-full min-h-[400px] bg-slate-950 border-slate-700 font-mono text-sm resize-none"
                  placeholder="Промпт синтеза..."
                />
              </div>
            )}

            {/* Test Panel */}
            <div className="border-t border-slate-800">
              <div className="flex items-center justify-between px-4 py-2 bg-slate-900">
                <span className="text-xs text-slate-400 font-medium">Test Input</span>
                <Button
                  size="sm"
                  onClick={handleTest}
                  disabled={isTesting}
                  className="h-7 bg-emerald-600 hover:bg-emerald-500"
                >
                  {isTesting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Play className="h-3 w-3 mr-1" />
                      Test
                    </>
                  )}
                </Button>
              </div>
              <div className="p-4 space-y-3">
                <Input
                  value={testInput}
                  onChange={(e) => setTestInput(e.target.value)}
                  placeholder="Тестовый ввод..."
                  className="bg-slate-950 border-slate-700"
                />
                {testOutput && (
                  <div className="p-3 bg-slate-950 rounded border border-slate-700 max-h-40 overflow-auto">
                    <pre className="text-xs text-slate-300 whitespace-pre-wrap">{testOutput}</pre>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Variables Panel */}
          {showVariables && activeTab !== "config" && (
            <div className="w-56 bg-slate-900 border-l border-slate-800">
              <div className="p-3 border-b border-slate-800 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Переменные
                </span>
                <button
                  type="button"
                  onClick={() => setShowVariables(false)}
                  className="text-slate-500 hover:text-white"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <div className="p-2 space-y-1">
                {VARIABLES.map((v) => (
                  <button
                    key={v.name}
                    type="button"
                    onClick={() => insertVariable(v.name)}
                    className="w-full text-left p-2 rounded hover:bg-slate-800 transition-colors"
                  >
                    <code className="text-xs text-violet-400">{v.name}</code>
                    <p className="text-xs text-slate-500 mt-0.5">{v.description}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
