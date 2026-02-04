"use client";

import { useState } from "react";
import { useSessionStore } from "@/stores/sessionStore";
import { useUIStore } from "@/stores/uiStore";
import { AGENTS, TASK_TYPES, TaskType, API_BASE_URL } from "@/lib/constants";
import { AgentCardsGrid } from "./AgentCardsGrid";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  Play,
  Settings2,
  Sparkles,
  Check,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  FileText,
  Lightbulb,
  Target,
} from "lucide-react";

export function AnalysisPanel() {
  const { currentSession } = useSessionStore();

  if (!currentSession) return null;

  if (currentSession.status === "complete" || currentSession.analyses.length > 0) {
    return <ResultsPanel />;
  }

  return <InputPanel />;
}

function InputPanel() {
  const {
    currentSession,
    updateTask,
    updateTaskType,
    updateSettings,
    startAnalysis,
    addTimelineEvent,
    addAnalysis,
    setSynthesis,
    updateMetrics,
    setStatus,
    setCurrentIteration,
  } = useSessionStore();

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!currentSession) return null;

  const runAnalysis = async () => {
    if (!currentSession.task.trim()) return;

    setIsAnalyzing(true);
    setError(null);
    startAnalysis();

    addTimelineEvent({
      timestamp: new Date(),
      type: "input_saved",
      title: "Ввод сохранён",
      status: "complete",
    });

    addTimelineEvent({
      timestamp: new Date(),
      type: "analysis_start",
      title: "Анализ начат",
      description: "4 агента работают параллельно",
      status: "running",
      data: { agents: currentSession.settings.agents },
    });

    try {
      const response = await fetch(`${API_BASE_URL}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: currentSession.task,
          task_type: currentSession.taskType,
          max_iterations: currentSession.settings.maxIterations,
        }),
      });

      if (!response.ok) {
        throw new Error(`Ошибка API: ${response.status}`);
      }

      const data = await response.json();

      if (data.analyses) {
        data.analyses.forEach((analysis: any) => {
          addAnalysis({
            agent_name: analysis.agent_name,
            confidence: analysis.confidence,
            analysis: analysis.analysis,
            key_points: analysis.key_points || [],
            risks: analysis.risks || [],
            assumptions: analysis.assumptions || [],
            duration: analysis.duration,
            tokens: analysis.tokens,
            cost: analysis.cost,
          });
        });
      }

      addTimelineEvent({
        timestamp: new Date(),
        type: "analysis_done",
        title: "Анализ завершён",
        status: "complete",
      });

      if (data.synthesis) {
        setSynthesis({
          summary: data.synthesis.summary || "",
          conclusions: data.synthesis.conclusions || [],
          recommendations: data.synthesis.recommendations || [],
          consensus_level: data.synthesis.consensus_level || 0,
        });

        updateMetrics({
          consensus: data.synthesis.consensus_level || 0,
          totalTokens: data.analyses?.reduce((sum: number, a: any) => sum + (a.tokens || 0), 0) || 0,
          totalCost: data.analyses?.reduce((sum: number, a: any) => sum + (a.cost || 0), 0) || 0,
        });
      }

      addTimelineEvent({
        timestamp: new Date(),
        type: "synthesis_complete",
        title: "Сессия завершена",
        status: "complete",
      });

      setStatus("complete");
      setCurrentIteration(currentSession.settings.maxIterations);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Неизвестная ошибка");
      setStatus("error");
      addTimelineEvent({
        timestamp: new Date(),
        type: "error",
        title: "Произошла ошибка",
        description: err instanceof Error ? err.message : "Неизвестная ошибка",
        status: "error",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 lg:p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl lg:text-2xl font-bold text-white flex items-center gap-2">
            <Sparkles className="h-5 w-5 lg:h-6 lg:w-6 text-violet-400" />
            Новый анализ
          </h1>
          <p className="text-slate-400 mt-1 text-sm lg:text-base">
            4 ИИ-агента проанализируют вашу задачу с разных точек зрения
          </p>
        </div>

        {/* Input Card */}
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-4 lg:p-6 space-y-4">
            {/* Task Input */}
            <div>
              <label className="text-sm text-slate-400 mb-2 block">Опишите вашу задачу</label>
              <Textarea
                placeholder="Что вы хотите проанализировать? Укажите контекст и цели..."
                className="min-h-28 lg:min-h-32 bg-slate-950 border-slate-700 text-white placeholder:text-slate-500 resize-none focus:border-violet-500"
                value={currentSession.task}
                onChange={(e) => updateTask(e.target.value)}
                disabled={isAnalyzing}
              />
            </div>

            {/* Basic Settings Row */}
            <div className="flex flex-wrap gap-3 lg:gap-4">
              <div className="flex-1 min-w-40 lg:min-w-48">
                <label className="text-sm text-slate-400 mb-2 block">Тип анализа</label>
                <Select
                  value={currentSession.taskType}
                  onValueChange={(v) => updateTaskType(v as TaskType)}
                  disabled={isAnalyzing}
                >
                  <SelectTrigger className="bg-slate-950 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700">
                    {TASK_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value} className="text-white hover:bg-slate-800">
                        <div>
                          <div className="font-medium">{type.label}</div>
                          <div className="text-xs text-slate-400">{type.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="w-28 lg:w-32">
                <label className="text-sm text-slate-400 mb-2 block">Итерации</label>
                <Select
                  value={String(currentSession.settings.maxIterations)}
                  onValueChange={(v) => updateSettings({ maxIterations: parseInt(v) })}
                  disabled={isAnalyzing}
                >
                  <SelectTrigger className="bg-slate-950 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <SelectItem key={n} value={String(n)} className="text-white hover:bg-slate-800">
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="w-28 lg:w-32">
                <label className="text-sm text-slate-400 mb-2 block">Бюджет</label>
                <Select
                  value={String(currentSession.settings.budget)}
                  onValueChange={(v) => updateSettings({ budget: parseFloat(v) })}
                  disabled={isAnalyzing}
                >
                  <SelectTrigger className="bg-slate-950 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700">
                    {[1, 2, 5, 10, 20].map((n) => (
                      <SelectItem key={n} value={String(n)} className="text-white hover:bg-slate-800">
                        ${n}.00
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Advanced Settings Toggle */}
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
            >
              {showAdvanced ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <Settings2 className="h-4 w-4" />
              Расширенные настройки
            </button>

            {/* Advanced Settings Panel */}
            {showAdvanced && (
              <div className="p-4 bg-slate-950/50 rounded-lg border border-slate-800 space-y-4">
                {/* Agents Selection */}
                <div>
                  <label className="text-sm text-slate-400 mb-2 block">Агенты</label>
                  <div className="flex flex-wrap gap-2">
                    {AGENTS.map((agent) => {
                      const isSelected = currentSession.settings.agents.includes(agent.id);
                      return (
                        <button
                          type="button"
                          key={agent.id}
                          onClick={() => {
                            const newAgents = isSelected
                              ? currentSession.settings.agents.filter((a) => a !== agent.id)
                              : [...currentSession.settings.agents, agent.id];
                            if (newAgents.length > 0) {
                              updateSettings({ agents: newAgents as any });
                            }
                          }}
                          disabled={isAnalyzing}
                          className={cn(
                            "flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors",
                            isSelected
                              ? "border-violet-500 bg-violet-500/10 text-white"
                              : "border-slate-700 text-slate-400 hover:border-slate-600"
                          )}
                        >
                          <div className={cn("w-2 h-2 rounded-full", agent.color)} />
                          {agent.name}
                          {isSelected && <Check className="h-3 w-3 text-violet-400" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Consensus Threshold */}
                <div>
                  <label className="text-sm text-slate-400 mb-2 block">
                    Порог консенсуса: {Math.round(currentSession.settings.consensusThreshold * 100)}%
                  </label>
                  <input
                    type="range"
                    min="50"
                    max="95"
                    value={currentSession.settings.consensusThreshold * 100}
                    onChange={(e) => updateSettings({ consensusThreshold: parseInt(e.target.value) / 100 })}
                    disabled={isAnalyzing}
                    className="w-full accent-violet-500"
                  />
                </div>

                {/* Temperature */}
                <div>
                  <label className="text-sm text-slate-400 mb-2 block">
                    Температура: {currentSession.settings.temperature}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={currentSession.settings.temperature * 100}
                    onChange={(e) => updateSettings({ temperature: parseInt(e.target.value) / 100 })}
                    disabled={isAnalyzing}
                    className="w-full accent-violet-500"
                  />
                </div>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="p-4 bg-red-950/50 border border-red-900 rounded-lg text-red-400 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            {/* Start Button */}
            <div className="flex items-center justify-between pt-2">
              <div className="text-xs text-slate-500">
                ~{currentSession.settings.maxIterations * 2} мин | ~${(currentSession.settings.maxIterations * 0.15).toFixed(2)}
              </div>
              <Button
                onClick={runAnalysis}
                disabled={isAnalyzing || !currentSession.task.trim()}
                className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white px-6 lg:px-8"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Анализирую...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Начать анализ
                    <kbd className="ml-2 text-xs opacity-70 hidden sm:inline">⌘↵</kbd>
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Agent Preview Grid */}
        <div className="mt-6 lg:mt-8">
          <h3 className="text-sm text-slate-500 uppercase tracking-wider mb-4">Агенты</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
            {AGENTS.map((agent) => {
              const isSelected = currentSession.settings.agents.includes(agent.id);
              return (
                <div
                  key={agent.id}
                  className={cn(
                    "p-3 lg:p-4 rounded-lg border transition-colors",
                    isSelected
                      ? "border-slate-700 bg-slate-900/50"
                      : "border-slate-800 bg-slate-900/25 opacity-50"
                  )}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className={cn("w-3 h-3 rounded-full", agent.color)} />
                    <span className="font-medium text-white text-sm">{agent.name}</span>
                  </div>
                  <p className="text-xs text-slate-400">{agent.role}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function ResultsPanel() {
  const { currentSession } = useSessionStore();
  const { openDrawer } = useUIStore();

  if (!currentSession) return null;

  const { analyses, synthesis, metrics } = currentSession;

  return (
    <div className="flex-1 overflow-y-auto p-4 lg:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-white">Сессия #{currentSession.id.slice(0, 8)}</h1>
            <p className="text-slate-400 mt-1 capitalize">Анализ: {currentSession.taskType}</p>
          </div>
          <Badge
            className={cn(
              "text-base lg:text-lg px-3 lg:px-4 py-1 w-fit",
              metrics.consensus >= 0.8 ? "bg-emerald-600" :
              metrics.consensus >= 0.6 ? "bg-amber-600" : "bg-red-600"
            )}
          >
            {Math.round(metrics.consensus * 100)}% Консенсус
          </Badge>
        </div>

        {/* Agent Cards Grid */}
        <AgentCardsGrid analyses={analyses} onAgentClick={(agentId) => openDrawer("agent", { agentId })} />

        {/* Tabbed Results */}
        <Tabs defaultValue="synthesis" className="w-full">
          <TabsList className="w-full bg-slate-900/50 border border-slate-800">
            <TabsTrigger value="input" className="flex-1">
              <FileText className="h-4 w-4 mr-2" />
              Ввод
            </TabsTrigger>
            <TabsTrigger value="synthesis" className="flex-1">
              <Sparkles className="h-4 w-4 mr-2" />
              Синтез
            </TabsTrigger>
            <TabsTrigger value="conclusions" className="flex-1">
              <Target className="h-4 w-4 mr-2" />
              Выводы
            </TabsTrigger>
            <TabsTrigger value="recommendations" className="flex-1">
              <Lightbulb className="h-4 w-4 mr-2" />
              Действия
            </TabsTrigger>
          </TabsList>

          <TabsContent value="input">
            <Card className="bg-slate-900/50 border-slate-800">
              <CardContent className="p-4">
                <p className="text-slate-300">{currentSession.task}</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="synthesis">
            {synthesis?.summary && (
              <Card className="bg-slate-900/50 border-slate-800">
                <CardContent className="p-4">
                  <p className="text-slate-300 whitespace-pre-wrap">{synthesis.summary}</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="conclusions">
            {synthesis && synthesis.conclusions.length > 0 && (
              <div className="space-y-3">
                {synthesis.conclusions.map((conclusion, i) => (
                  <Card key={i} className="bg-slate-900/50 border-slate-800">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-violet-600 flex items-center justify-center text-sm font-bold text-white shrink-0">
                          {i + 1}
                        </div>
                        <div className="flex-1">
                          <p className="text-white">{conclusion.conclusion}</p>
                          <div className="flex flex-wrap items-center gap-2 lg:gap-4 mt-2 text-xs text-slate-400">
                            <Badge variant="outline" className="border-violet-500 text-violet-400">
                              {conclusion.probability}
                            </Badge>
                            {conclusion.falsification_condition && (
                              <span className="text-slate-500">Фальсифицируемо если: {conclusion.falsification_condition}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="recommendations">
            {synthesis && synthesis.recommendations.length > 0 && (
              <div className="space-y-4">
                {synthesis.recommendations.map((rec, i) => (
                  <Card key={i} className="bg-slate-900/50 border-slate-800">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-base lg:text-lg font-medium text-white flex items-center gap-2">
                          {i === 0 && <span className="text-amber-400">⭐</span>}
                          {rec.option}
                        </h4>
                        {rec.score && (
                          <Badge variant="outline" className="border-slate-600">
                            Оценка: {rec.score}/10
                          </Badge>
                        )}
                      </div>
                      <p className="text-slate-300 mb-3 text-sm lg:text-base">{rec.description}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                        {rec.pros.length > 0 && (
                          <div>
                            <span className="text-emerald-400 font-medium">Плюсы:</span>
                            <ul className="mt-1 space-y-1">
                              {rec.pros.map((pro, j) => (
                                <li key={j} className="text-slate-400 flex items-start gap-1">
                                  <span className="text-emerald-400">+</span> {pro}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {rec.cons.length > 0 && (
                          <div>
                            <span className="text-red-400 font-medium">Минусы:</span>
                            <ul className="mt-1 space-y-1">
                              {rec.cons.map((con, j) => (
                                <li key={j} className="text-slate-400 flex items-start gap-1">
                                  <span className="text-red-400">-</span> {con}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
