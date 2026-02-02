"use client";

import { useSessionStore } from "@/stores/sessionStore";
import { AGENTS } from "@/lib/constants";
import { Check, Loader2, Circle, Pause, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export function StatusBar() {
  const { currentSession, pauseAnalysis, resumeAnalysis, cancelAnalysis } = useSessionStore();

  if (!currentSession) {
    return (
      <footer className="h-8 border-t border-slate-800 bg-slate-950/80 flex items-center px-4 text-xs text-slate-500">
        <span>Ready</span>
      </footer>
    );
  }

  const { status, currentIteration, settings, metrics, analyses } = currentSession;
  const isRunning = status === "running";
  const isPaused = status === "paused";
  const isComplete = status === "complete";

  // Calculate progress
  const totalSteps = settings.maxIterations * 3; // analysis + critique + synthesis per iteration
  const completedSteps = currentIteration * 3 + (analyses.length > 0 ? 1 : 0);
  const progressPercent = Math.min((completedSteps / totalSteps) * 100, 100);

  // Estimate time
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <footer className="h-auto border-t border-slate-800 bg-slate-950/80">
      {/* Main status row */}
      <div className="h-8 flex items-center px-4 gap-4 text-xs">
        {/* Status indicator */}
        <div className="flex items-center gap-2">
          {isRunning && <Loader2 className="h-3 w-3 text-amber-400 animate-spin" />}
          {isPaused && <Pause className="h-3 w-3 text-amber-400" />}
          {isComplete && <Check className="h-3 w-3 text-emerald-400" />}
          <span className={cn(
            isRunning && "text-amber-400",
            isPaused && "text-amber-400",
            isComplete && "text-emerald-400",
            !isRunning && !isPaused && !isComplete && "text-slate-400"
          )}>
            {isComplete ? "Complete" : isPaused ? "Paused" : isRunning ? `Iteration ${currentIteration}/${settings.maxIterations}` : "Ready"}
          </span>
        </div>

        <div className="h-4 w-px bg-slate-700" />

        {/* Consensus */}
        <div className="flex items-center gap-2">
          <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                metrics.consensus >= 0.8 ? "bg-emerald-500" :
                metrics.consensus >= 0.6 ? "bg-amber-500" : "bg-red-500"
              )}
              style={{ width: `${metrics.consensus * 100}%` }}
            />
          </div>
          <span className="text-slate-400">{Math.round(metrics.consensus * 100)}%</span>
        </div>

        <div className="h-4 w-px bg-slate-700" />

        {/* Cost */}
        <div className="text-slate-400">
          <span className="text-slate-500">$</span>
          {metrics.totalCost.toFixed(2)}
          <span className="text-slate-600">/{settings.budget.toFixed(2)}</span>
        </div>

        <div className="h-4 w-px bg-slate-700" />

        {/* Time */}
        <div className="text-slate-400">
          {formatDuration(metrics.duration)}
        </div>

        <div className="h-4 w-px bg-slate-700" />

        {/* Agent status */}
        <div className="flex items-center gap-2">
          {AGENTS.map((agent) => {
            const analysis = analyses.find(
              (a) => a.agent_name.toLowerCase() === agent.id || a.agent_name.toLowerCase() === agent.name.toLowerCase()
            );
            return (
              <div key={agent.id} className="flex items-center gap-1" title={agent.name}>
                <span className="text-slate-500">{agent.name.slice(0, 3).toUpperCase()}</span>
                {analysis ? (
                  <Check className="h-3 w-3 text-emerald-400" />
                ) : isRunning ? (
                  <Loader2 className="h-3 w-3 text-slate-500 animate-spin" />
                ) : (
                  <Circle className="h-3 w-3 text-slate-600" />
                )}
              </div>
            );
          })}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Controls */}
        {(isRunning || isPaused) && (
          <div className="flex items-center gap-1">
            {isRunning ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-slate-400 hover:text-white"
                onClick={pauseAnalysis}
              >
                <Pause className="h-3 w-3 mr-1" />
                Pause
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-amber-400 hover:text-amber-300"
                onClick={resumeAnalysis}
              >
                Resume
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-slate-400 hover:text-red-400"
              onClick={cancelAnalysis}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      {/* Progress bar (only when running) */}
      {(isRunning || isPaused) && (
        <div className="h-6 px-4 pb-2">
          <div className="relative">
            <Progress value={progressPercent} className="h-1" />
            <div className="absolute top-2 left-0 right-0 flex justify-between text-[10px] text-slate-500">
              <span className={analyses.length > 0 ? "text-emerald-400" : ""}>Analysis</span>
              <span>Critique</span>
              <span>Synthesis</span>
            </div>
          </div>
        </div>
      )}
    </footer>
  );
}
