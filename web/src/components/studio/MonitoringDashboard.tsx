"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Zap,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Download,
  Bell,
  Loader2,
  Cloud,
  CloudOff,
} from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: React.ReactNode;
  color: string;
  loading?: boolean;
}

function MetricCard({ title, value, change, icon, color, loading }: MetricCardProps) {
  return (
    <div className="p-4 bg-slate-900 rounded-lg border border-slate-800">
      <div className="flex items-start justify-between mb-2">
        <div className={cn("p-2 rounded-lg", color)}>{icon}</div>
        {change !== undefined && (
          <div
            className={cn(
              "flex items-center gap-1 text-xs",
              change >= 0 ? "text-emerald-400" : "text-red-400"
            )}
          >
            {change >= 0 ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            {Math.abs(change)}%
          </div>
        )}
      </div>
      <div className="text-2xl font-bold text-white">
        {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : value}
      </div>
      <div className="text-xs text-slate-400 mt-1">{title}</div>
    </div>
  );
}

interface Metrics {
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
  totalErrors: number;
  byAgent: Record<string, {
    requests: number;
    tokens: number;
    cost: number;
    avgLatency: number;
    errors: number;
  }>;
}

interface LogEntry {
  id: string;
  created_at: string;
  level: "info" | "warning" | "error" | "success";
  message: string;
  agent_id: string;
}

const AGENT_COLORS: Record<string, string> = {
  chatgpt: "bg-emerald-500",
  claude: "bg-amber-500",
  gemini: "bg-blue-500",
  deepseek: "bg-violet-500",
};

export function MonitoringDashboard() {
  const [timeRange, setTimeRange] = useState("24h");
  const [logFilter, setLogFilter] = useState<"all" | "error" | "warning" | "success">("all");
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(true);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);
  const [dataSource, setDataSource] = useState<"mock" | "database">("mock");

  const loadMetrics = useCallback(async () => {
    setIsLoadingMetrics(true);
    try {
      const response = await fetch(`/api/studio/metrics?period=${timeRange}`);
      const data = await response.json();
      if (data.success) {
        setMetrics(data.data);
        setDataSource(data.source === "database" ? "database" : "mock");
      }
    } catch (error) {
      console.error("Failed to load metrics:", error);
    } finally {
      setIsLoadingMetrics(false);
    }
  }, [timeRange]);

  const loadLogs = useCallback(async () => {
    setIsLoadingLogs(true);
    try {
      const levelParam = logFilter !== "all" ? `&level=${logFilter}` : "";
      const response = await fetch(`/api/studio/logs?limit=50${levelParam}`);
      const data = await response.json();
      if (data.success) {
        setLogs(data.data);
      }
    } catch (error) {
      console.error("Failed to load logs:", error);
    } finally {
      setIsLoadingLogs(false);
    }
  }, [logFilter]);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const handleRefresh = () => {
    loadMetrics();
    loadLogs();
  };

  const exportLogs = () => {
    const csv = [
      ["Time", "Level", "Message", "Agent"].join(","),
      ...logs.map(log => [
        new Date(log.created_at).toISOString(),
        log.level,
        `"${log.message.replace(/"/g, '""')}"`,
        log.agent_id
      ].join(","))
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `llm-top-logs-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  // Calculate percentages for agent usage chart
  const agentUsage = metrics?.byAgent ? Object.entries(metrics.byAgent).map(([id, data]) => ({
    name: id.charAt(0).toUpperCase() + id.slice(1),
    tokens: data.tokens,
    cost: data.cost,
    percentage: metrics.totalTokens > 0 ? Math.round((data.tokens / metrics.totalTokens) * 100) : 0,
    color: AGENT_COLORS[id] || "bg-slate-500",
    avgLatency: data.avgLatency,
  })) : [];

  return (
    <div className="p-6 space-y-6 overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            Monitoring Dashboard
            {dataSource === "database" ? (
              <Cloud className="h-4 w-4 text-emerald-400" title="Live data" />
            ) : (
              <CloudOff className="h-4 w-4 text-amber-400" title="Demo data" />
            )}
          </h2>
          <p className="text-sm text-slate-400">Real-time system metrics and logs</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-sm text-white"
          >
            <option value="1h">Last 1 hour</option>
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
          </select>
          <Button
            variant="outline"
            size="sm"
            className="border-slate-700"
            onClick={handleRefresh}
            disabled={isLoadingMetrics || isLoadingLogs}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", (isLoadingMetrics || isLoadingLogs) && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard
          title="Total Requests"
          value={metrics?.totalRequests?.toLocaleString() || "0"}
          change={23}
          icon={<Zap className="h-5 w-5 text-white" />}
          color="bg-violet-600"
          loading={isLoadingMetrics}
        />
        <MetricCard
          title="Total Tokens"
          value={metrics?.totalTokens?.toLocaleString() || "0"}
          change={45}
          icon={<BarChart3 className="h-5 w-5 text-white" />}
          color="bg-blue-600"
          loading={isLoadingMetrics}
        />
        <MetricCard
          title="Total Cost"
          value={`$${metrics?.totalCost?.toFixed(2) || "0.00"}`}
          change={12}
          icon={<DollarSign className="h-5 w-5 text-white" />}
          color="bg-emerald-600"
          loading={isLoadingMetrics}
        />
        <MetricCard
          title="Errors"
          value={metrics?.totalErrors || 0}
          change={-50}
          icon={<AlertTriangle className="h-5 w-5 text-white" />}
          color="bg-red-600"
          loading={isLoadingMetrics}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-2 gap-6">
        {/* Token Usage by Agent */}
        <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
          <h3 className="text-sm font-medium text-white mb-4">Token Usage by Agent</h3>
          <div className="space-y-3">
            {agentUsage.map((agent) => (
              <div key={agent.name}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-slate-300">{agent.name}</span>
                  <span className="text-slate-400">
                    {agent.tokens.toLocaleString()} ({agent.percentage}%)
                  </span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", agent.color)}
                    style={{ width: `${agent.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-slate-800">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Total Cost</span>
              <span className="text-white font-medium">
                ${agentUsage.reduce((sum, a) => sum + a.cost, 0).toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Response Time */}
        <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
          <h3 className="text-sm font-medium text-white mb-4">Average Response Time</h3>
          <div className="space-y-3">
            {agentUsage.map((agent) => {
              const latencyMs = agent.avgLatency || 0;
              const latencySec = (latencyMs / 1000).toFixed(1);
              const status = latencyMs < 2000 ? "excellent" : latencyMs < 3500 ? "good" : "warning";

              return (
                <div key={agent.name} className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">{agent.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-400">{latencySec}s</span>
                    <div
                      className={cn(
                        "w-2 h-2 rounded-full",
                        status === "excellent" && "bg-emerald-500",
                        status === "good" && "bg-blue-500",
                        status === "warning" && "bg-amber-500"
                      )}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 pt-4 border-t border-slate-800">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Average</span>
              <span className="text-white font-medium">
                {agentUsage.length > 0
                  ? (agentUsage.reduce((sum, a) => sum + (a.avgLatency || 0), 0) / agentUsage.length / 1000).toFixed(1)
                  : "0"}s
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Logs */}
      <div className="bg-slate-900 rounded-lg border border-slate-800">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <h3 className="text-sm font-medium text-white">Recent Logs</h3>
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {(["all", "error", "warning", "success"] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setLogFilter(filter)}
                  className={cn(
                    "px-2 py-1 text-xs rounded transition-colors",
                    logFilter === filter
                      ? "bg-violet-600 text-white"
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  )}
                >
                  {filter === "all" ? "All" : filter.charAt(0).toUpperCase() + filter.slice(1)}
                </button>
              ))}
            </div>
            <Button variant="ghost" size="sm" className="h-7 text-slate-400" onClick={exportLogs}>
              <Download className="h-3 w-3 mr-1" />
              Export
            </Button>
          </div>
        </div>

        <div className="divide-y divide-slate-800 max-h-64 overflow-auto">
          {isLoadingLogs ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-slate-500">No logs found</div>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="flex items-center gap-4 px-4 py-2 text-sm hover:bg-slate-800/50">
                <span className="text-xs text-slate-500 font-mono w-20">
                  {new Date(log.created_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
                <div className="w-20">
                  {log.level === "error" && (
                    <Badge className="bg-red-600 text-xs">
                      <XCircle className="h-3 w-3 mr-1" />
                      Error
                    </Badge>
                  )}
                  {log.level === "warning" && (
                    <Badge className="bg-amber-600 text-xs">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Warn
                    </Badge>
                  )}
                  {log.level === "success" && (
                    <Badge className="bg-emerald-600 text-xs">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      OK
                    </Badge>
                  )}
                  {log.level === "info" && (
                    <Badge className="bg-blue-600 text-xs">Info</Badge>
                  )}
                </div>
                <span className="flex-1 text-slate-300">{log.message}</span>
                <Badge variant="outline" className="text-xs border-slate-700">
                  {log.agent_id}
                </Badge>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Alerts */}
      <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-white flex items-center gap-2">
            <Bell className="h-4 w-4 text-violet-400" />
            Active Alerts
          </h3>
          <Button variant="outline" size="sm" className="h-7 border-slate-700">
            Configure Alerts
          </Button>
        </div>

        <div className="space-y-2">
          {(metrics?.totalErrors || 0) > 2 && (
            <div className="flex items-center gap-3 p-3 bg-red-950/30 border border-red-900/50 rounded">
              <AlertTriangle className="h-4 w-4 text-red-400" />
              <div className="flex-1">
                <p className="text-sm text-red-300">High error rate detected ({metrics?.totalErrors} errors)</p>
                <p className="text-xs text-red-400/70">Check agent configurations</p>
              </div>
              <Button variant="ghost" size="sm" className="h-7 text-red-400">
                Dismiss
              </Button>
            </div>
          )}

          {agentUsage.some(a => a.avgLatency > 4000) && (
            <div className="flex items-center gap-3 p-3 bg-amber-950/30 border border-amber-900/50 rounded">
              <Clock className="h-4 w-4 text-amber-400" />
              <div className="flex-1">
                <p className="text-sm text-amber-300">
                  Slow response times detected ({agentUsage.filter(a => a.avgLatency > 4000).map(a => a.name).join(", ")})
                </p>
                <p className="text-xs text-amber-400/70">Consider optimizing prompts or switching models</p>
              </div>
              <Button variant="ghost" size="sm" className="h-7 text-amber-400">
                Dismiss
              </Button>
            </div>
          )}

          {(metrics?.totalErrors || 0) <= 2 && !agentUsage.some(a => a.avgLatency > 4000) && (
            <div className="flex items-center gap-3 p-3 bg-emerald-950/30 border border-emerald-900/50 rounded">
              <CheckCircle className="h-4 w-4 text-emerald-400" />
              <div className="flex-1">
                <p className="text-sm text-emerald-300">All systems operating normally</p>
                <p className="text-xs text-emerald-400/70">No active alerts</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
