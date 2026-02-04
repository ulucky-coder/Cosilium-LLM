"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Beaker,
  Plus,
  Play,
  Pause,
  Trophy,
  BarChart3,
  Clock,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronRight,
  Loader2,
  Trash2,
  RefreshCw,
  Star,
  Zap,
} from "lucide-react";

interface Variant {
  id: string;
  experiment_id: string;
  name: string;
  prompt_content: string;
  traffic_percentage: number;
  total_runs: number;
  avg_quality_score?: number;
  avg_latency_ms?: number;
  avg_cost_usd?: number;
  error_count: number;
}

interface Experiment {
  id: string;
  name: string;
  description?: string;
  agent_id: string;
  status: "draft" | "running" | "paused" | "completed";
  sample_size: number;
  metrics_to_track: string[];
  created_at: string;
  started_at?: string;
  completed_at?: string;
  winner_variant_id?: string;
  results_summary?: Record<string, unknown>;
  variants?: Variant[];
  variants_count?: number;
}

const AGENT_COLORS: Record<string, string> = {
  chatgpt: "bg-emerald-500",
  claude: "bg-amber-500",
  gemini: "bg-blue-500",
  deepseek: "bg-violet-500",
};

const STATUS_CONFIG = {
  draft: { color: "bg-slate-600", icon: Beaker, label: "Черновик" },
  running: { color: "bg-blue-600", icon: Play, label: "Запущен" },
  paused: { color: "bg-amber-600", icon: Pause, label: "Пауза" },
  completed: { color: "bg-emerald-600", icon: CheckCircle, label: "Завершён" },
};

interface ExperimentPanelProps {
  onLog?: (message: string) => void;
}

export function ExperimentPanel({ onLog }: ExperimentPanelProps) {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [selectedExperiment, setSelectedExperiment] = useState<Experiment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [testInput, setTestInput] = useState("");
  const [isRunningTest, setIsRunningTest] = useState<string | null>(null);

  // Form state for new experiment
  const [newExperiment, setNewExperiment] = useState({
    name: "",
    description: "",
    agent_id: "chatgpt",
    sample_size: 10,
    variants: [
      { name: "Control", prompt_content: "" },
      { name: "Variant A", prompt_content: "" },
    ],
  });

  const loadExperiments = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/studio/experiments");
      const data = await response.json();
      if (data.success) {
        setExperiments(data.data);
      }
    } catch (error) {
      console.error("Failed to load experiments:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadExperimentDetails = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/studio/experiments?id=${id}`);
      const data = await response.json();
      if (data.success) {
        setSelectedExperiment(data.data);
      }
    } catch (error) {
      console.error("Failed to load experiment details:", error);
    }
  }, []);

  useEffect(() => {
    loadExperiments();
  }, [loadExperiments]);

  const handleCreateExperiment = async () => {
    if (!newExperiment.name || newExperiment.variants.some((v) => !v.prompt_content)) {
      onLog?.("⚠ Fill in all required fields");
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch("/api/studio/experiments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_experiment",
          ...newExperiment,
        }),
      });

      const data = await response.json();
      if (data.success) {
        onLog?.(`✓ Experiment "${newExperiment.name}" created`);
        setShowCreateForm(false);
        setNewExperiment({
          name: "",
          description: "",
          agent_id: "chatgpt",
          sample_size: 10,
          variants: [
            { name: "Control", prompt_content: "" },
            { name: "Variant A", prompt_content: "" },
          ],
        });
        loadExperiments();
      }
    } catch (error) {
      onLog?.(`✗ Failed to create experiment`);
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      const response = await fetch("/api/studio/experiments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });

      const data = await response.json();
      if (data.success) {
        onLog?.(`✓ Experiment status updated to ${status}`);
        loadExperiments();
        if (selectedExperiment?.id === id) {
          loadExperimentDetails(id);
        }
      }
    } catch (error) {
      onLog?.(`✗ Failed to update status`);
    }
  };

  const handleRunTest = async (variantId: string) => {
    if (!selectedExperiment || !testInput) {
      onLog?.("⚠ Enter test input first");
      return;
    }

    setIsRunningTest(variantId);
    try {
      const response = await fetch("/api/studio/experiments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "run_test",
          experiment_id: selectedExperiment.id,
          variant_id: variantId,
          test_input: testInput,
        }),
      });

      const data = await response.json();
      if (data.success) {
        onLog?.(
          `✓ Test completed: ${data.data.latency_ms}ms, ${data.data.tokens} tokens, $${data.data.cost?.toFixed(4)}`
        );
        loadExperimentDetails(selectedExperiment.id);
      }
    } catch (error) {
      onLog?.(`✗ Test failed`);
    } finally {
      setIsRunningTest(null);
    }
  };

  const handleDeclareWinner = async (variantId: string) => {
    if (!selectedExperiment) return;

    try {
      const winner = selectedExperiment.variants?.find((v) => v.id === variantId);
      const response = await fetch("/api/studio/experiments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedExperiment.id,
          status: "completed",
          winner_variant_id: variantId,
          results_summary: {
            winner_name: winner?.name,
            avg_quality: winner?.avg_quality_score,
            total_runs: winner?.total_runs,
          },
        }),
      });

      const data = await response.json();
      if (data.success) {
        onLog?.(`🏆 Winner declared: ${winner?.name}`);
        loadExperiments();
        loadExperimentDetails(selectedExperiment.id);
      }
    } catch (error) {
      onLog?.(`✗ Failed to declare winner`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this experiment?")) return;

    try {
      const response = await fetch(`/api/studio/experiments?id=${id}`, {
        method: "DELETE",
      });

      const data = await response.json();
      if (data.success) {
        onLog?.("✓ Experiment deleted");
        if (selectedExperiment?.id === id) {
          setSelectedExperiment(null);
        }
        loadExperiments();
      }
    } catch (error) {
      onLog?.(`✗ Failed to delete`);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="flex h-full">
      {/* Left Panel - Experiment List */}
      <div className="w-72 bg-slate-900 border-r border-slate-800 flex flex-col">
        <div className="p-3 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-medium text-white flex items-center gap-2">
            <Beaker className="h-4 w-4 text-violet-400" />
            A/B Эксперименты
          </h3>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={loadExperiments}
              disabled={isLoading}
            >
              <RefreshCw className={cn("h-3 w-3", isLoading && "animate-spin")} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-emerald-400"
              onClick={() => setShowCreateForm(true)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            </div>
          ) : experiments.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-sm">
              Нет экспериментов
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {experiments.map((exp) => {
                const StatusIcon = STATUS_CONFIG[exp.status].icon;
                return (
                  <button
                    key={exp.id}
                    type="button"
                    onClick={() => {
                      setSelectedExperiment(exp);
                      loadExperimentDetails(exp.id);
                    }}
                    className={cn(
                      "w-full p-3 text-left transition-colors",
                      selectedExperiment?.id === exp.id
                        ? "bg-violet-600/20"
                        : "hover:bg-slate-800"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-white truncate">
                        {exp.name}
                      </span>
                      <Badge className={cn("text-xs", STATUS_CONFIG[exp.status].color)}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {STATUS_CONFIG[exp.status].label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <div className={cn("w-2 h-2 rounded-full", AGENT_COLORS[exp.agent_id])} />
                      <span>{exp.agent_id}</span>
                      <span>•</span>
                      <span>{exp.variants_count || exp.variants?.length || 0} варианта</span>
                    </div>
                    {exp.winner_variant_id && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-amber-400">
                        <Trophy className="h-3 w-3" />
                        Победитель определён
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Main Panel */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {showCreateForm ? (
          // Create Form
          <div className="flex-1 p-6 overflow-auto">
            <div className="max-w-2xl">
              <h2 className="text-lg font-bold text-white mb-4">Новый эксперимент</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Название</label>
                  <Input
                    value={newExperiment.name}
                    onChange={(e) => setNewExperiment({ ...newExperiment, name: e.target.value })}
                    placeholder="Prompt Clarity Test"
                    className="bg-slate-800 border-slate-700"
                  />
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-1">Описание</label>
                  <Input
                    value={newExperiment.description}
                    onChange={(e) =>
                      setNewExperiment({ ...newExperiment, description: e.target.value })
                    }
                    placeholder="Сравнение разных вариантов промпта"
                    className="bg-slate-800 border-slate-700"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Агент</label>
                    <select
                      value={newExperiment.agent_id}
                      onChange={(e) =>
                        setNewExperiment({ ...newExperiment, agent_id: e.target.value })
                      }
                      className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white text-sm"
                    >
                      <option value="chatgpt">ChatGPT</option>
                      <option value="claude">Claude</option>
                      <option value="gemini">Gemini</option>
                      <option value="deepseek">DeepSeek</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Размер выборки</label>
                    <Input
                      type="number"
                      value={newExperiment.sample_size}
                      onChange={(e) =>
                        setNewExperiment({
                          ...newExperiment,
                          sample_size: parseInt(e.target.value) || 10,
                        })
                      }
                      className="bg-slate-800 border-slate-700"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-2">Варианты промптов</label>
                  {newExperiment.variants.map((variant, index) => (
                    <div key={index} className="mb-3 p-3 bg-slate-800/50 rounded border border-slate-700">
                      <div className="flex items-center justify-between mb-2">
                        <Input
                          value={variant.name}
                          onChange={(e) => {
                            const variants = [...newExperiment.variants];
                            variants[index].name = e.target.value;
                            setNewExperiment({ ...newExperiment, variants });
                          }}
                          className="w-32 h-7 text-sm bg-slate-900 border-slate-600"
                        />
                        {index > 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-red-400"
                            onClick={() => {
                              const variants = newExperiment.variants.filter((_, i) => i !== index);
                              setNewExperiment({ ...newExperiment, variants });
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      <Textarea
                        value={variant.prompt_content}
                        onChange={(e) => {
                          const variants = [...newExperiment.variants];
                          variants[index].prompt_content = e.target.value;
                          setNewExperiment({ ...newExperiment, variants });
                        }}
                        placeholder="Системный промпт..."
                        rows={3}
                        className="bg-slate-900 border-slate-600 text-sm"
                      />
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-slate-700"
                    onClick={() => {
                      const index = newExperiment.variants.length;
                      setNewExperiment({
                        ...newExperiment,
                        variants: [
                          ...newExperiment.variants,
                          { name: `Variant ${String.fromCharCode(65 + index - 1)}`, prompt_content: "" },
                        ],
                      });
                    }}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Добавить вариант
                  </Button>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    onClick={handleCreateExperiment}
                    disabled={isCreating}
                    className="bg-violet-600 hover:bg-violet-700"
                  >
                    {isCreating ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Beaker className="h-4 w-4 mr-2" />
                    )}
                    Создать эксперимент
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowCreateForm(false)}
                    className="border-slate-700"
                  >
                    Отмена
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : selectedExperiment ? (
          // Experiment Details
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-slate-800 bg-slate-900">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    {selectedExperiment.name}
                    {selectedExperiment.winner_variant_id && (
                      <Trophy className="h-5 w-5 text-amber-400" />
                    )}
                  </h2>
                  <p className="text-sm text-slate-400">{selectedExperiment.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  {selectedExperiment.status === "draft" && (
                    <Button
                      size="sm"
                      onClick={() => handleUpdateStatus(selectedExperiment.id, "running")}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      <Play className="h-4 w-4 mr-1" />
                      Запустить
                    </Button>
                  )}
                  {selectedExperiment.status === "running" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUpdateStatus(selectedExperiment.id, "paused")}
                      className="border-amber-600 text-amber-400"
                    >
                      <Pause className="h-4 w-4 mr-1" />
                      Пауза
                    </Button>
                  )}
                  {selectedExperiment.status === "paused" && (
                    <Button
                      size="sm"
                      onClick={() => handleUpdateStatus(selectedExperiment.id, "running")}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      <Play className="h-4 w-4 mr-1" />
                      Продолжить
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(selectedExperiment.id)}
                    className="text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Test input */}
              {selectedExperiment.status !== "completed" && (
                <div className="mt-3 flex gap-2">
                  <Input
                    value={testInput}
                    onChange={(e) => setTestInput(e.target.value)}
                    placeholder="Введите тестовый запрос..."
                    className="bg-slate-800 border-slate-700"
                  />
                </div>
              )}
            </div>

            {/* Variants comparison */}
            <div className="flex-1 p-4 overflow-auto">
              <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${selectedExperiment.variants?.length || 2}, 1fr)` }}>
                {selectedExperiment.variants?.map((variant) => {
                  const isWinner = selectedExperiment.winner_variant_id === variant.id;
                  return (
                    <div
                      key={variant.id}
                      className={cn(
                        "bg-slate-900 rounded-lg border p-4",
                        isWinner ? "border-amber-500" : "border-slate-800"
                      )}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-medium text-white flex items-center gap-2">
                          {variant.name}
                          {isWinner && <Trophy className="h-4 w-4 text-amber-400" />}
                        </h3>
                        <Badge variant="outline" className="text-xs border-slate-700">
                          {variant.traffic_percentage}%
                        </Badge>
                      </div>

                      {/* Metrics */}
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div className="bg-slate-800/50 rounded p-2">
                          <div className="flex items-center gap-1 text-xs text-slate-400 mb-1">
                            <Star className="h-3 w-3" />
                            Качество
                          </div>
                          <div className="text-lg font-bold text-white">
                            {variant.avg_quality_score?.toFixed(1) || "—"}
                          </div>
                        </div>
                        <div className="bg-slate-800/50 rounded p-2">
                          <div className="flex items-center gap-1 text-xs text-slate-400 mb-1">
                            <Zap className="h-3 w-3" />
                            Тестов
                          </div>
                          <div className="text-lg font-bold text-white">{variant.total_runs}</div>
                        </div>
                        <div className="bg-slate-800/50 rounded p-2">
                          <div className="flex items-center gap-1 text-xs text-slate-400 mb-1">
                            <Clock className="h-3 w-3" />
                            Latency
                          </div>
                          <div className="text-lg font-bold text-white">
                            {variant.avg_latency_ms ? `${(variant.avg_latency_ms / 1000).toFixed(1)}s` : "—"}
                          </div>
                        </div>
                        <div className="bg-slate-800/50 rounded p-2">
                          <div className="flex items-center gap-1 text-xs text-slate-400 mb-1">
                            <DollarSign className="h-3 w-3" />
                            Стоимость
                          </div>
                          <div className="text-lg font-bold text-white">
                            {variant.avg_cost_usd ? `$${variant.avg_cost_usd.toFixed(3)}` : "—"}
                          </div>
                        </div>
                      </div>

                      {/* Error count */}
                      {variant.error_count > 0 && (
                        <div className="flex items-center gap-1 text-xs text-red-400 mb-3">
                          <AlertTriangle className="h-3 w-3" />
                          {variant.error_count} ошибок
                        </div>
                      )}

                      {/* Prompt preview */}
                      <div className="mb-3">
                        <div className="text-xs text-slate-400 mb-1">Промпт:</div>
                        <pre className="text-xs text-slate-300 bg-slate-800 rounded p-2 max-h-24 overflow-auto whitespace-pre-wrap">
                          {variant.prompt_content.slice(0, 200)}
                          {variant.prompt_content.length > 200 && "..."}
                        </pre>
                      </div>

                      {/* Actions */}
                      {selectedExperiment.status !== "completed" && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 border-slate-700"
                            onClick={() => handleRunTest(variant.id)}
                            disabled={!testInput || isRunningTest === variant.id}
                          >
                            {isRunningTest === variant.id ? (
                              <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            ) : (
                              <Play className="h-3 w-3 mr-1" />
                            )}
                            Тест
                          </Button>
                          {selectedExperiment.status === "running" && variant.total_runs >= 3 && (
                            <Button
                              size="sm"
                              className="bg-amber-600 hover:bg-amber-700"
                              onClick={() => handleDeclareWinner(variant.id)}
                            >
                              <Trophy className="h-3 w-3 mr-1" />
                              Победитель
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Results summary for completed experiments */}
              {selectedExperiment.status === "completed" && selectedExperiment.results_summary && (
                <div className="mt-6 p-4 bg-emerald-950/30 border border-emerald-900/50 rounded-lg">
                  <h3 className="font-medium text-emerald-400 mb-2 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" />
                    Результаты эксперимента
                  </h3>
                  <div className="text-sm text-slate-300">
                    <p>
                      <strong>Победитель:</strong>{" "}
                      {String(selectedExperiment.results_summary.winner_name)}
                    </p>
                    {selectedExperiment.results_summary.avg_quality !== undefined && (
                      <p>
                        <strong>Среднее качество:</strong>{" "}
                        {Number(selectedExperiment.results_summary.avg_quality).toFixed(1)}
                      </p>
                    )}
                    {selectedExperiment.results_summary.total_runs !== undefined && (
                      <p>
                        <strong>Всего тестов:</strong>{" "}
                        {String(selectedExperiment.results_summary.total_runs)}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          // Empty state
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Beaker className="h-12 w-12 text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-400 mb-2">
                Выберите эксперимент
              </h3>
              <p className="text-sm text-slate-500 mb-4">
                Или создайте новый A/B тест для промптов
              </p>
              <Button onClick={() => setShowCreateForm(true)} className="bg-violet-600">
                <Plus className="h-4 w-4 mr-2" />
                Новый эксперимент
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
