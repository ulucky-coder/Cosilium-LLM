"use client";

import { AgentAnalysis } from "@/stores/sessionStore";
import { AGENTS } from "@/lib/constants";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Clock, Coins, MessageSquare, ChevronRight } from "lucide-react";

interface AgentCardsGridProps {
  analyses: AgentAnalysis[];
  onAgentClick?: (agentId: string) => void;
  compact?: boolean;
}

export function AgentCardsGrid({ analyses, onAgentClick, compact = false }: AgentCardsGridProps) {
  if (analyses.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        Анализы пока недоступны
      </div>
    );
  }

  return (
    <div className={cn(
      "grid gap-3 lg:gap-4",
      compact ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-1 sm:grid-cols-2"
    )}>
      {analyses.map((analysis) => {
        const agent = AGENTS.find(
          (a) => a.id === analysis.agent_name.toLowerCase() ||
                 a.name.toLowerCase() === analysis.agent_name.toLowerCase()
        );

        return (
          <AgentCard
            key={analysis.agent_name}
            analysis={analysis}
            agent={agent}
            onClick={() => onAgentClick?.(agent?.id || analysis.agent_name.toLowerCase())}
            compact={compact}
          />
        );
      })}
    </div>
  );
}

interface AgentCardProps {
  analysis: AgentAnalysis;
  agent?: typeof AGENTS[number];
  onClick?: () => void;
  compact?: boolean;
}

function AgentCard({ analysis, agent, onClick, compact }: AgentCardProps) {
  const confidencePercent = Math.round(analysis.confidence * 100);
  const confidenceColor =
    analysis.confidence >= 0.8 ? "text-emerald-400" :
    analysis.confidence >= 0.6 ? "text-amber-400" : "text-red-400";

  if (compact) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="text-left p-3 rounded-lg bg-slate-900/50 border border-slate-800 hover:border-slate-700 transition-colors"
      >
        <div className="flex items-center gap-2 mb-2">
          <div className={cn("w-2 h-2 rounded-full", agent?.color || "bg-slate-500")} />
          <span className="text-sm font-medium text-white truncate">{analysis.agent_name}</span>
        </div>
        <div className="flex items-center gap-2">
          <Progress value={confidencePercent} className="h-1.5 flex-1" />
          <span className={cn("text-xs font-medium", confidenceColor)}>{confidencePercent}%</span>
        </div>
      </button>
    );
  }

  return (
    <Card
      className="bg-slate-900/50 border-slate-800 hover:border-slate-700 transition-colors cursor-pointer group"
      onClick={onClick}
    >
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={cn("w-3 h-3 rounded-full", agent?.color || "bg-slate-500")} />
            <span className="font-medium text-white">{analysis.agent_name}</span>
          </div>
          <ChevronRight className="h-4 w-4 text-slate-500 group-hover:text-white transition-colors" />
        </div>

        {/* Confidence Bar */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-400">Уверенность</span>
            <span className={cn("text-sm font-semibold", confidenceColor)}>{confidencePercent}%</span>
          </div>
          <Progress value={confidencePercent} className="h-2" />
        </div>

        {/* Key Points Preview */}
        {analysis.key_points.length > 0 && (
          <div className="mb-3">
            <ul className="space-y-1">
              {analysis.key_points.slice(0, 2).map((point, i) => (
                <li key={i} className="text-xs text-slate-400 truncate">
                  • {point}
                </li>
              ))}
              {analysis.key_points.length > 2 && (
                <li className="text-xs text-slate-500">
                  +{analysis.key_points.length - 2} ещё
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Metrics Row */}
        <div className="flex items-center gap-3 pt-2 border-t border-slate-800 text-xs text-slate-500">
          {analysis.duration && (
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {analysis.duration.toFixed(1)}s
            </div>
          )}
          {analysis.tokens && (
            <div className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {analysis.tokens.toLocaleString()}
            </div>
          )}
          {analysis.cost && (
            <div className="flex items-center gap-1">
              <Coins className="h-3 w-3" />
              ${analysis.cost.toFixed(3)}
            </div>
          )}
        </div>

        {/* Risks Badge */}
        {analysis.risks.length > 0 && (
          <Badge variant="outline" className="mt-2 border-amber-500/50 text-amber-400 text-xs">
            {analysis.risks.length} рисков выявлено
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}
