"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { PromptStudio } from "./PromptStudio";
import { PipelineBuilder } from "./PipelineBuilder";
import { DatabaseStudio } from "./DatabaseStudio";
import { MonitoringDashboard } from "./MonitoringDashboard";
import { ExperimentPanel } from "./ExperimentPanel";
import {
  Home,
  FileCode,
  GitBranch,
  Database,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  Play,
  Save,
  Undo,
  Terminal,
  X,
  Beaker,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type StudioTab = "home" | "prompts" | "experiments" | "pipeline" | "database" | "monitoring" | "settings";

interface NavItem {
  id: StudioTab;
  label: string;
  icon: React.ReactNode;
  shortcut: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: "home", label: "Главная", icon: <Home className="h-5 w-5" />, shortcut: "H" },
  { id: "prompts", label: "Промпты", icon: <FileCode className="h-5 w-5" />, shortcut: "P" },
  { id: "experiments", label: "A/B Тесты", icon: <Beaker className="h-5 w-5" />, shortcut: "E" },
  { id: "pipeline", label: "Пайплайн", icon: <GitBranch className="h-5 w-5" />, shortcut: "L" },
  { id: "database", label: "База данных", icon: <Database className="h-5 w-5" />, shortcut: "D" },
  { id: "monitoring", label: "Мониторинг", icon: <BarChart3 className="h-5 w-5" />, shortcut: "M" },
  { id: "settings", label: "Настройки", icon: <Settings className="h-5 w-5" />, shortcut: "S" },
];

export function ControlPlane({ onClose }: { onClose?: () => void }) {
  const [activeTab, setActiveTab] = useState<StudioTab>("prompts");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [consoleOutput, setConsoleOutput] = useState<string[]>([
    "LLM-top Control Plane v1.0",
    "Ready.",
  ]);

  const addConsoleLog = (message: string) => {
    setConsoleOutput(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const handleSave = () => {
    addConsoleLog("✓ Configuration saved");
  };

  const handleRun = () => {
    addConsoleLog("▶ Running test...");
    setTimeout(() => addConsoleLog("✓ Test completed successfully"), 1000);
  };

  return (
    <div className="fixed inset-0 bg-slate-950 z-50 flex flex-col">
      {/* Top Bar */}
      <div className="h-12 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <h1 className="text-sm font-semibold text-white flex items-center gap-2">
            <Terminal className="h-4 w-4 text-violet-400" />
            LLM-top Control Plane
          </h1>
          <div className="h-4 w-px bg-slate-700" />
          <span className="text-xs text-slate-500">
            {NAV_ITEMS.find(n => n.id === activeTab)?.label}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRun}
            className="h-8 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950"
          >
            <Play className="h-4 w-4 mr-1" />
            Run
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSave}
            className="h-8 text-blue-400 hover:text-blue-300 hover:bg-blue-950"
          >
            <Save className="h-4 w-4 mr-1" />
            Save
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-slate-400 hover:text-white"
          >
            <Undo className="h-4 w-4 mr-1" />
            Undo
          </Button>
          <div className="h-4 w-px bg-slate-700 mx-2" />
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 text-slate-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div
          className={cn(
            "bg-slate-900 border-r border-slate-800 flex flex-col transition-all duration-200",
            sidebarCollapsed ? "w-14" : "w-48"
          )}
        >
          <nav className="flex-1 py-2">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors",
                  activeTab === item.id
                    ? "bg-violet-600/20 text-violet-400 border-r-2 border-violet-500"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                )}
              >
                {item.icon}
                {!sidebarCollapsed && (
                  <>
                    <span className="flex-1 text-left">{item.label}</span>
                    <kbd className="text-xs text-slate-600">{item.shortcut}</kbd>
                  </>
                )}
              </button>
            ))}
          </nav>

          <button
            type="button"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-3 text-slate-500 hover:text-white border-t border-slate-800"
          >
            {sidebarCollapsed ? (
              <ChevronRight className="h-4 w-4 mx-auto" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-auto">
            {activeTab === "home" && <HomePanel />}
            {activeTab === "prompts" && <PromptStudio onLog={addConsoleLog} />}
            {activeTab === "experiments" && <ExperimentPanel onLog={addConsoleLog} />}
            {activeTab === "pipeline" && <PipelineBuilder onLog={addConsoleLog} />}
            {activeTab === "database" && <DatabaseStudio onLog={addConsoleLog} />}
            {activeTab === "monitoring" && <MonitoringDashboard />}
            {activeTab === "settings" && <SettingsPanel />}
          </div>

          {/* Console */}
          {consoleOpen && (
            <div className="h-48 bg-slate-950 border-t border-slate-800">
              <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800">
                <span className="text-xs text-slate-400 font-medium">Console</span>
                <button
                  type="button"
                  onClick={() => setConsoleOpen(false)}
                  className="text-slate-500 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="p-4 font-mono text-xs text-slate-400 overflow-auto h-full">
                {consoleOutput.map((line, i) => (
                  <div key={i} className={cn(
                    line.includes("✓") && "text-emerald-400",
                    line.includes("✗") && "text-red-400",
                    line.includes("⚠") && "text-amber-400"
                  )}>
                    {line}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="h-6 bg-slate-900 border-t border-slate-800 flex items-center justify-between px-4 text-xs">
        <div className="flex items-center gap-4 text-slate-500">
          <span>Supabase: <span className="text-emerald-400">Connected</span></span>
          <span>Mode: <span className="text-amber-400">Demo</span></span>
        </div>
        <button
          type="button"
          onClick={() => setConsoleOpen(!consoleOpen)}
          className="text-slate-500 hover:text-white flex items-center gap-1"
        >
          <Terminal className="h-3 w-3" />
          Console
        </button>
      </div>
    </div>
  );
}

function HomePanel() {
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-white mb-2">Control Plane</h2>
      <p className="text-slate-400 mb-8">Полное управление системой LLM-top</p>

      <div className="grid grid-cols-2 gap-4">
        <QuickCard
          icon={<FileCode className="h-6 w-6" />}
          title="Prompt Studio"
          description="Редактирование промптов агентов с тестированием"
          shortcut="P"
        />
        <QuickCard
          icon={<GitBranch className="h-6 w-6" />}
          title="Pipeline Builder"
          description="Визуальный конструктор пайплайнов"
          shortcut="L"
        />
        <QuickCard
          icon={<Database className="h-6 w-6" />}
          title="Database Studio"
          description="Управление схемой и данными БД"
          shortcut="D"
        />
        <QuickCard
          icon={<BarChart3 className="h-6 w-6" />}
          title="Monitoring"
          description="Метрики, логи, расходы"
          shortcut="M"
        />
      </div>

      <div className="mt-8 p-4 bg-slate-900 rounded-lg border border-slate-800">
        <h3 className="text-sm font-medium text-white mb-2">Быстрые команды</h3>
        <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
          <div><kbd className="bg-slate-800 px-1 rounded">Ctrl+S</kbd> Сохранить</div>
          <div><kbd className="bg-slate-800 px-1 rounded">Ctrl+Enter</kbd> Запустить тест</div>
          <div><kbd className="bg-slate-800 px-1 rounded">Ctrl+Z</kbd> Отменить</div>
          <div><kbd className="bg-slate-800 px-1 rounded">Ctrl+`</kbd> Консоль</div>
        </div>
      </div>
    </div>
  );
}

function QuickCard({ icon, title, description, shortcut }: {
  icon: React.ReactNode;
  title: string;
  description: string;
  shortcut: string;
}) {
  return (
    <div className="p-4 bg-slate-900 rounded-lg border border-slate-800 hover:border-violet-500/50 transition-colors cursor-pointer">
      <div className="flex items-start justify-between mb-2">
        <div className="text-violet-400">{icon}</div>
        <kbd className="text-xs text-slate-600 bg-slate-800 px-1.5 py-0.5 rounded">{shortcut}</kbd>
      </div>
      <h3 className="font-medium text-white mb-1">{title}</h3>
      <p className="text-xs text-slate-400">{description}</p>
    </div>
  );
}

function SettingsPanel() {
  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h2 className="text-xl font-bold text-white mb-6">Настройки системы</h2>

      <div className="space-y-6">
        <div className="p-4 bg-slate-900 rounded-lg border border-slate-800">
          <h3 className="text-sm font-medium text-white mb-4">API Ключи</h3>
          <div className="space-y-3">
            {["OpenAI", "Anthropic", "Google AI", "DeepSeek"].map((name) => (
              <div key={name} className="flex items-center justify-between">
                <span className="text-sm text-slate-400">{name}</span>
                <span className="text-xs text-amber-400">Не настроен</span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 bg-slate-900 rounded-lg border border-slate-800">
          <h3 className="text-sm font-medium text-white mb-4">База данных</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Supabase URL</span>
              <span className="text-emerald-400 text-xs">Подключено</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Таблиц</span>
              <span className="text-white">12</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
