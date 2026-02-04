"use client";

import { useState } from "react";
import { usePromptStore } from "@/stores/promptStore";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Save,
  RotateCcw,
  Check,
  Bot,
  MessageSquare,
  Sparkles,
  Settings2,
  Plus,
  X,
} from "lucide-react";

const AGENTS = [
  { id: "chatgpt", name: "ChatGPT", color: "bg-emerald-500" },
  { id: "claude", name: "Claude", color: "bg-amber-500" },
  { id: "gemini", name: "Gemini", color: "bg-blue-500" },
  { id: "deepseek", name: "DeepSeek", color: "bg-violet-500" },
];

function AgentPromptsEditor({ agentId }: { agentId: string }) {
  const { agentPrompts, updateAgentPrompts, agentConfigs, updateAgentConfig } =
    usePromptStore();

  const prompts = agentPrompts[agentId];
  const config = agentConfigs.find((c) => c.id === agentId);

  const [localPrompts, setLocalPrompts] = useState(prompts);
  const [localConfig, setLocalConfig] = useState(config);
  const [hasChanges, setHasChanges] = useState(false);
  const [saved, setSaved] = useState(false);

  const handlePromptChange = (
    field: keyof typeof prompts,
    value: string
  ) => {
    setLocalPrompts({ ...localPrompts, [field]: value });
    setHasChanges(true);
    setSaved(false);
  };

  const handleConfigChange = (field: string, value: any) => {
    setLocalConfig({ ...localConfig!, [field]: value });
    setHasChanges(true);
    setSaved(false);
  };

  const handleSave = () => {
    updateAgentPrompts(agentId, localPrompts);
    if (localConfig) {
      updateAgentConfig(agentId, localConfig);
    }
    setHasChanges(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setLocalPrompts(prompts);
    setLocalConfig(config);
    setHasChanges(false);
  };

  if (!prompts || !config) return null;

  return (
    <div className="space-y-6">
      {/* Agent Config */}
      <div className="space-y-4">
        <h4 className="text-xs text-slate-500 uppercase tracking-wider flex items-center gap-2">
          <Settings2 className="h-3 w-3" />
          Конфигурация агента
        </h4>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Роль</label>
            <Input
              value={localConfig?.role || ""}
              onChange={(e) => handleConfigChange("role", e.target.value)}
              className="bg-slate-800 border-slate-600 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">
              Температура
            </label>
            <Input
              type="number"
              step="0.1"
              min="0"
              max="1"
              value={localConfig?.temperature || 0.3}
              onChange={(e) =>
                handleConfigChange("temperature", parseFloat(e.target.value))
              }
              className="bg-slate-800 border-slate-600 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="text-xs text-slate-400 mb-1 block">Фокус</label>
          <Input
            value={localConfig?.focus || ""}
            onChange={(e) => handleConfigChange("focus", e.target.value)}
            className="bg-slate-800 border-slate-600 text-sm"
          />
        </div>

        <div>
          <label className="text-xs text-slate-400 mb-1 block">
            Сильные стороны (через запятую)
          </label>
          <Input
            value={localConfig?.strengths?.join(", ") || ""}
            onChange={(e) =>
              handleConfigChange(
                "strengths",
                e.target.value.split(",").map((s) => s.trim())
              )
            }
            className="bg-slate-800 border-slate-600 text-sm"
          />
        </div>
      </div>

      {/* System Prompt */}
      <div>
        <label className="text-xs text-slate-500 uppercase tracking-wider mb-2 block flex items-center gap-2">
          <Bot className="h-3 w-3" />
          Системный промпт (анализ)
        </label>
        <Textarea
          value={localPrompts.systemPrompt}
          onChange={(e) => handlePromptChange("systemPrompt", e.target.value)}
          className="min-h-[200px] bg-slate-800 border-slate-600 font-mono text-xs"
          placeholder="Инструкции для агента при анализе..."
        />
      </div>

      {/* Critique Prompt */}
      <div>
        <label className="text-xs text-slate-500 uppercase tracking-wider mb-2 block flex items-center gap-2">
          <MessageSquare className="h-3 w-3" />
          Промпт критики (adversarial mode)
        </label>
        <Textarea
          value={localPrompts.critiquePrompt}
          onChange={(e) => handlePromptChange("critiquePrompt", e.target.value)}
          className="min-h-[150px] bg-slate-800 border-slate-600 font-mono text-xs"
          placeholder="Инструкции для критического анализа других агентов..."
        />
      </div>

      {/* User Prompt Template */}
      <div>
        <label className="text-xs text-slate-500 uppercase tracking-wider mb-2 block">
          Шаблон пользовательского промпта
        </label>
        <Textarea
          value={localPrompts.userPromptTemplate}
          onChange={(e) =>
            handlePromptChange("userPromptTemplate", e.target.value)
          }
          className="min-h-[100px] bg-slate-800 border-slate-600 font-mono text-xs"
          placeholder="Используйте {task}, {task_type}, {context} как переменные..."
        />
        <p className="text-xs text-slate-500 mt-1">
          Переменные: {"{task}"}, {"{task_type}"}, {"{context}"}
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2 border-t border-slate-800">
        <Button
          type="button"
          onClick={handleSave}
          disabled={!hasChanges}
          className={cn(
            "flex-1",
            saved
              ? "bg-emerald-600 hover:bg-emerald-500"
              : "bg-violet-600 hover:bg-violet-500"
          )}
        >
          {saved ? (
            <>
              <Check className="h-4 w-4 mr-1" />
              Сохранено
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-1" />
              Сохранить
            </>
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleReset}
          disabled={!hasChanges}
          className="border-slate-600"
        >
          <RotateCcw className="h-4 w-4 mr-1" />
          Сбросить
        </Button>
      </div>
    </div>
  );
}

function SynthesisEditor() {
  const { synthesisPrompt, updateSynthesisPrompt } = usePromptStore();
  const [localPrompt, setLocalPrompt] = useState(synthesisPrompt);
  const [hasChanges, setHasChanges] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleChange = (value: string) => {
    setLocalPrompt(value);
    setHasChanges(true);
    setSaved(false);
  };

  const handleSave = () => {
    updateSynthesisPrompt(localPrompt);
    setHasChanges(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setLocalPrompt(synthesisPrompt);
    setHasChanges(false);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs text-slate-500 uppercase tracking-wider mb-2 block flex items-center gap-2">
          <Sparkles className="h-3 w-3" />
          Промпт синтеза (интеграция результатов)
        </label>
        <Textarea
          value={localPrompt}
          onChange={(e) => handleChange(e.target.value)}
          className="min-h-[300px] bg-slate-800 border-slate-600 font-mono text-xs"
          placeholder="Инструкции для синтеза результатов всех агентов..."
        />
        <p className="text-xs text-slate-500 mt-1">
          Этот промпт используется Claude для объединения результатов всех
          агентов в финальный отчёт.
        </p>
      </div>

      <div className="flex gap-2 pt-2 border-t border-slate-800">
        <Button
          type="button"
          onClick={handleSave}
          disabled={!hasChanges}
          className={cn(
            "flex-1",
            saved
              ? "bg-emerald-600 hover:bg-emerald-500"
              : "bg-violet-600 hover:bg-violet-500"
          )}
        >
          {saved ? (
            <>
              <Check className="h-4 w-4 mr-1" />
              Сохранено
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-1" />
              Сохранить
            </>
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleReset}
          disabled={!hasChanges}
          className="border-slate-600"
        >
          <RotateCcw className="h-4 w-4 mr-1" />
          Сбросить
        </Button>
      </div>
    </div>
  );
}

export function PromptsEditor() {
  const [selectedAgent, setSelectedAgent] = useState("chatgpt");
  const { resetToDefaults } = usePromptStore();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-slate-800">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-white">Редактор промптов</h3>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-xs text-slate-400 hover:text-red-400"
            onClick={() => {
              if (confirm("Сбросить все промпты к значениям по умолчанию?")) {
                resetToDefaults();
              }
            }}
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Сбросить всё
          </Button>
        </div>
        <p className="text-xs text-slate-500">
          Настройте поведение каждого агента через системные промпты
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <Tabs defaultValue="agents" className="h-full">
          <TabsList className="w-full bg-slate-900/50 border-b border-slate-800 rounded-none p-0">
            <TabsTrigger
              value="agents"
              className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-violet-500"
            >
              Агенты
            </TabsTrigger>
            <TabsTrigger
              value="synthesis"
              className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-violet-500"
            >
              Синтез
            </TabsTrigger>
          </TabsList>

          <TabsContent value="agents" className="p-4 space-y-4">
            {/* Agent Selector */}
            <div className="flex gap-2">
              {AGENTS.map((agent) => (
                <button
                  type="button"
                  key={agent.id}
                  onClick={() => setSelectedAgent(agent.id)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors",
                    selectedAgent === agent.id
                      ? "border-violet-500 bg-violet-500/10 text-white"
                      : "border-slate-700 text-slate-400 hover:border-slate-600"
                  )}
                >
                  <div className={cn("w-2 h-2 rounded-full", agent.color)} />
                  <span className="text-sm">{agent.name}</span>
                </button>
              ))}
            </div>

            {/* Agent Editor */}
            <AgentPromptsEditor agentId={selectedAgent} />
          </TabsContent>

          <TabsContent value="synthesis" className="p-4">
            <SynthesisEditor />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
