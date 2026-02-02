"use client";

import { useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { Drawer } from "@/components/layout/Drawer";
import { StatusBar } from "@/components/layout/StatusBar";
import { CommandPalette } from "@/components/command/CommandPalette";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useUIStore } from "@/stores/uiStore";
import { useSessionStore } from "@/stores/sessionStore";
import { AGENTS, TASK_TYPES, TaskType, API_BASE_URL } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronRight,
  Play,
  Settings2,
  Sparkles,
  Check,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { useState } from "react";

function InputSection() {
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
  const { openDrawer } = useUIStore();

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runAnalysis = async () => {
    if (!currentSession || !currentSession.task.trim()) return;

    setIsAnalyzing(true);
    setError(null);
    startAnalysis();

    addTimelineEvent({
      timestamp: new Date(),
      type: "input_saved",
      title: "Input saved",
      status: "complete",
    });

    addTimelineEvent({
      timestamp: new Date(),
      type: "analysis_start",
      title: "Analysis started",
      description: "4 agents running in parallel",
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
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();

      // Add analyses
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
        title: "Analysis complete",
        status: "complete",
      });

      // Set synthesis
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
        title: "Session complete",
        status: "complete",
      });

      setStatus("complete");
      setCurrentIteration(currentSession.settings.maxIterations);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setStatus("error");
      addTimelineEvent({
        timestamp: new Date(),
        type: "error",
        title: "Error occurred",
        description: err instanceof Error ? err.message : "Unknown error",
        status: "error",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (!currentSession) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">◈</div>
          <h2 className="text-2xl font-bold text-white mb-2">Welcome to LLM-top</h2>
          <p className="text-slate-400 mb-6">
            Press <kbd className="px-2 py-1 bg-slate-800 rounded text-sm">N</kbd> or{" "}
            <kbd className="px-2 py-1 bg-slate-800 rounded text-sm">⌘K</kbd> to start a new session
          </p>
          <Button
            onClick={() => useSessionStore.getState().createSession()}
            className="bg-violet-600 hover:bg-violet-500"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            New Analysis
          </Button>
        </div>
      </div>
    );
  }

  if (currentSession.status === "complete" || currentSession.analyses.length > 0) {
    return <ResultsSection />;
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-violet-400" />
            New Analysis
          </h1>
          <p className="text-slate-400 mt-1">
            4 AI agents will analyze your task from different perspectives
          </p>
        </div>

        {/* Input Card */}
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-6 space-y-4">
            {/* Task Input */}
            <div>
              <label className="text-sm text-slate-400 mb-2 block">Describe your task</label>
              <Textarea
                placeholder="What do you want to analyze? Be specific about your context and goals..."
                className="min-h-32 bg-slate-950 border-slate-700 text-white placeholder:text-slate-500 resize-none focus:border-violet-500"
                value={currentSession.task}
                onChange={(e) => updateTask(e.target.value)}
                disabled={isAnalyzing}
              />
            </div>

            {/* Basic Settings Row */}
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-48">
                <label className="text-sm text-slate-400 mb-2 block">Analysis Type</label>
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

              <div className="w-32">
                <label className="text-sm text-slate-400 mb-2 block">Iterations</label>
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

              <div className="w-32">
                <label className="text-sm text-slate-400 mb-2 block">Budget</label>
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
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
            >
              {showAdvanced ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <Settings2 className="h-4 w-4" />
              Advanced Settings
            </button>

            {/* Advanced Settings Panel */}
            {showAdvanced && (
              <div className="p-4 bg-slate-950/50 rounded-lg border border-slate-800 space-y-4">
                {/* Agents Selection */}
                <div>
                  <label className="text-sm text-slate-400 mb-2 block">Agents</label>
                  <div className="flex flex-wrap gap-2">
                    {AGENTS.map((agent) => {
                      const isSelected = currentSession.settings.agents.includes(agent.id);
                      return (
                        <button
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
                    Consensus Threshold: {Math.round(currentSession.settings.consensusThreshold * 100)}%
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
                    Temperature: {currentSession.settings.temperature}
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
                Estimated: ~{currentSession.settings.maxIterations * 2} min | ~${(currentSession.settings.maxIterations * 0.15).toFixed(2)}
              </div>
              <Button
                onClick={runAnalysis}
                disabled={isAnalyzing || !currentSession.task.trim()}
                className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white px-8"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Start Analysis
                    <kbd className="ml-2 text-xs opacity-70">⌘↵</kbd>
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Agent Preview */}
        <div className="mt-8">
          <h3 className="text-sm text-slate-500 uppercase tracking-wider mb-4">Agents</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {AGENTS.map((agent) => {
              const isSelected = currentSession.settings.agents.includes(agent.id);
              return (
                <div
                  key={agent.id}
                  className={cn(
                    "p-4 rounded-lg border transition-colors",
                    isSelected
                      ? "border-slate-700 bg-slate-900/50"
                      : "border-slate-800 bg-slate-900/25 opacity-50"
                  )}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className={cn("w-3 h-3 rounded-full", agent.color)} />
                    <span className="font-medium text-white">{agent.name}</span>
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

function ResultsSection() {
  const { currentSession } = useSessionStore();
  const { openDrawer } = useUIStore();

  if (!currentSession) return null;

  const { analyses, synthesis, metrics } = currentSession;

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Session #{currentSession.id.slice(0, 8)}</h1>
            <p className="text-slate-400 mt-1 capitalize">{currentSession.taskType} Analysis</p>
          </div>
          <Badge
            className={cn(
              "text-lg px-4 py-1",
              metrics.consensus >= 0.8 ? "bg-emerald-600" :
              metrics.consensus >= 0.6 ? "bg-amber-600" : "bg-red-600"
            )}
          >
            {Math.round(metrics.consensus * 100)}% Consensus
          </Badge>
        </div>

        {/* Metrics Snapshot */}
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-4">
            <div className="grid grid-cols-4 gap-4">
              {analyses.map((analysis) => {
                const agent = AGENTS.find(
                  (a) => a.id === analysis.agent_name.toLowerCase() || a.name.toLowerCase() === analysis.agent_name.toLowerCase()
                );
                return (
                  <button
                    key={analysis.agent_name}
                    onClick={() => openDrawer("agent", { agentId: agent?.id || analysis.agent_name.toLowerCase() })}
                    className="p-3 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className={cn("w-2 h-2 rounded-full", agent?.color || "bg-slate-500")} />
                      <span className="text-sm font-medium text-white">{analysis.agent_name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={analysis.confidence * 100} className="h-1.5 flex-1" />
                      <span className="text-xs text-slate-400">{Math.round(analysis.confidence * 100)}%</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Input */}
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-4">
            <h3 className="text-sm text-slate-500 uppercase tracking-wider mb-2">Input</h3>
            <p className="text-slate-300">{currentSession.task}</p>
          </CardContent>
        </Card>

        {/* Synthesis */}
        {synthesis && (
          <>
            {/* Summary */}
            {synthesis.summary && (
              <Card className="bg-slate-900/50 border-slate-800">
                <CardContent className="p-4">
                  <h3 className="text-sm text-slate-500 uppercase tracking-wider mb-2">Summary</h3>
                  <p className="text-slate-300">{synthesis.summary}</p>
                </CardContent>
              </Card>
            )}

            {/* Conclusions */}
            {synthesis.conclusions.length > 0 && (
              <Card className="bg-slate-900/50 border-slate-800">
                <CardContent className="p-4">
                  <h3 className="text-sm text-slate-500 uppercase tracking-wider mb-4">Conclusions</h3>
                  <div className="space-y-3">
                    {synthesis.conclusions.map((conclusion, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 bg-slate-800/50 rounded-lg">
                        <div className="w-6 h-6 rounded-full bg-violet-600 flex items-center justify-center text-sm font-bold text-white shrink-0">
                          {i + 1}
                        </div>
                        <div className="flex-1">
                          <p className="text-white">{conclusion.conclusion}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                            <Badge variant="outline" className="border-violet-500 text-violet-400">
                              {conclusion.probability}
                            </Badge>
                            {conclusion.falsification_condition && (
                              <span>Falsifiable if: {conclusion.falsification_condition}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Recommendations */}
            {synthesis.recommendations.length > 0 && (
              <Card className="bg-slate-900/50 border-slate-800">
                <CardContent className="p-4">
                  <h3 className="text-sm text-slate-500 uppercase tracking-wider mb-4">Recommendations</h3>
                  <div className="space-y-4">
                    {synthesis.recommendations.map((rec, i) => (
                      <div key={i} className="p-4 bg-slate-800/50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-lg font-medium text-white flex items-center gap-2">
                            {i === 0 && <span className="text-amber-400">⭐</span>}
                            {rec.option}
                          </h4>
                          {rec.score && (
                            <Badge variant="outline" className="border-slate-600">
                              Score: {rec.score}/10
                            </Badge>
                          )}
                        </div>
                        <p className="text-slate-300 mb-3">{rec.description}</p>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          {rec.pros.length > 0 && (
                            <div>
                              <span className="text-emerald-400 font-medium">Pros:</span>
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
                              <span className="text-red-400 font-medium">Cons:</span>
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
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  useKeyboardShortcuts();

  const { drawerOpen } = useUIStore();

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <Header />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar />

        <main className="flex-1 flex flex-col overflow-hidden">
          <InputSection />
        </main>

        {drawerOpen && <Drawer />}
      </div>

      <StatusBar />

      <CommandPalette />
    </div>
  );
}
