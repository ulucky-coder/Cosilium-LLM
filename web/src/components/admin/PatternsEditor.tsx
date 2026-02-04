"use client";

import { useState } from "react";
import { usePromptStore, ThinkingPattern } from "@/stores/promptStore";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Check,
  X,
  Edit,
  Save,
  Brain,
  Lightbulb,
} from "lucide-react";

interface PatternCardProps {
  pattern: ThinkingPattern;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (updates: Partial<ThinkingPattern>) => void;
  onDelete: () => void;
  onToggleEnabled: () => void;
}

function PatternCard({
  pattern,
  isExpanded,
  onToggleExpand,
  onUpdate,
  onDelete,
  onToggleEnabled,
}: PatternCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedPattern, setEditedPattern] = useState(pattern);

  const handleSave = () => {
    onUpdate(editedPattern);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedPattern(pattern);
    setIsEditing(false);
  };

  return (
    <div
      className={cn(
        "border rounded-lg transition-colors",
        pattern.enabled
          ? "border-violet-500/50 bg-violet-500/5"
          : "border-slate-700 bg-slate-900/50"
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 p-3">
        <button
          type="button"
          className="text-slate-500 hover:text-slate-300 cursor-grab"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={onToggleExpand}
          className="flex-1 flex items-center gap-2 text-left"
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-slate-500" />
          ) : (
            <ChevronRight className="h-4 w-4 text-slate-500" />
          )}
          <Brain className="h-4 w-4 text-violet-400" />
          {isEditing ? (
            <Input
              value={editedPattern.name}
              onChange={(e) =>
                setEditedPattern({ ...editedPattern, name: e.target.value })
              }
              onClick={(e) => e.stopPropagation()}
              className="h-7 w-40 bg-slate-800 border-slate-600 text-sm"
            />
          ) : (
            <span className="font-medium text-white">{pattern.name}</span>
          )}
        </button>

        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-emerald-400 hover:text-emerald-300"
                onClick={handleSave}
              >
                <Save className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-slate-400 hover:text-slate-300"
                onClick={handleCancel}
              >
                <X className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-slate-400 hover:text-white"
                onClick={() => setIsEditing(true)}
              >
                <Edit className="h-4 w-4" />
              </Button>
              <button
                type="button"
                onClick={onToggleEnabled}
                className={cn(
                  "px-2 py-1 rounded text-xs font-medium transition-colors",
                  pattern.enabled
                    ? "bg-violet-600 text-white"
                    : "bg-slate-700 text-slate-400"
                )}
              >
                {pattern.enabled ? "ON" : "OFF"}
              </button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-red-400 hover:text-red-300"
                onClick={onDelete}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-3 pb-3 space-y-4 border-t border-slate-700/50 pt-3">
          {/* Description */}
          <div>
            <label className="text-xs text-slate-500 uppercase tracking-wider mb-1 block">
              Описание
            </label>
            {isEditing ? (
              <Input
                value={editedPattern.description}
                onChange={(e) =>
                  setEditedPattern({
                    ...editedPattern,
                    description: e.target.value,
                  })
                }
                className="bg-slate-800 border-slate-600"
              />
            ) : (
              <p className="text-sm text-slate-300">{pattern.description}</p>
            )}
          </div>

          {/* System Prompt */}
          <div>
            <label className="text-xs text-slate-500 uppercase tracking-wider mb-1 block">
              Системный промпт
            </label>
            {isEditing ? (
              <Textarea
                value={editedPattern.systemPrompt}
                onChange={(e) =>
                  setEditedPattern({
                    ...editedPattern,
                    systemPrompt: e.target.value,
                  })
                }
                className="min-h-[200px] bg-slate-800 border-slate-600 font-mono text-sm"
              />
            ) : (
              <pre className="text-xs text-slate-400 bg-slate-800/50 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap">
                {pattern.systemPrompt}
              </pre>
            )}
          </div>

          {/* Examples */}
          <div>
            <label className="text-xs text-slate-500 uppercase tracking-wider mb-1 block flex items-center gap-2">
              <Lightbulb className="h-3 w-3" />
              Примеры использования
            </label>
            {isEditing ? (
              <div className="space-y-2">
                {editedPattern.examples.map((example, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      value={example}
                      onChange={(e) => {
                        const newExamples = [...editedPattern.examples];
                        newExamples[i] = e.target.value;
                        setEditedPattern({
                          ...editedPattern,
                          examples: newExamples,
                        });
                      }}
                      className="flex-1 bg-slate-800 border-slate-600 text-sm"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-red-400"
                      onClick={() => {
                        const newExamples = editedPattern.examples.filter(
                          (_, idx) => idx !== i
                        );
                        setEditedPattern({
                          ...editedPattern,
                          examples: newExamples,
                        });
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full border-dashed border-slate-600"
                  onClick={() =>
                    setEditedPattern({
                      ...editedPattern,
                      examples: [...editedPattern.examples, ""],
                    })
                  }
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Добавить пример
                </Button>
              </div>
            ) : (
              <ul className="space-y-1">
                {pattern.examples.map((example, i) => (
                  <li
                    key={i}
                    className="text-xs text-slate-400 flex items-start gap-2"
                  >
                    <span className="text-violet-400 mt-0.5">→</span>
                    {example}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function PatternsEditor() {
  const {
    thinkingPatterns,
    addPattern,
    updatePattern,
    deletePattern,
    togglePattern,
  } = usePromptStore();

  const [expandedPatterns, setExpandedPatterns] = useState<Set<string>>(
    new Set()
  );
  const [isCreating, setIsCreating] = useState(false);
  const [newPattern, setNewPattern] = useState({
    name: "",
    description: "",
    systemPrompt: "",
    examples: [""],
    enabled: true,
  });

  const toggleExpanded = (id: string) => {
    setExpandedPatterns((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleCreatePattern = () => {
    if (newPattern.name.trim()) {
      addPattern(newPattern);
      setNewPattern({
        name: "",
        description: "",
        systemPrompt: "",
        examples: [""],
        enabled: true,
      });
      setIsCreating(false);
    }
  };

  const enabledCount = thinkingPatterns.filter((p) => p.enabled).length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-slate-800">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-white">Паттерны мышления</h3>
          <Badge variant="outline" className="border-violet-500 text-violet-400">
            {enabledCount} активных
          </Badge>
        </div>
        <p className="text-xs text-slate-500">
          Когнитивные модели, применяемые агентами при анализе
        </p>
      </div>

      {/* Patterns List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {thinkingPatterns.map((pattern) => (
          <PatternCard
            key={pattern.id}
            pattern={pattern}
            isExpanded={expandedPatterns.has(pattern.id)}
            onToggleExpand={() => toggleExpanded(pattern.id)}
            onUpdate={(updates) => updatePattern(pattern.id, updates)}
            onDelete={() => deletePattern(pattern.id)}
            onToggleEnabled={() => togglePattern(pattern.id)}
          />
        ))}

        {/* Create New Pattern */}
        {isCreating ? (
          <div className="border border-dashed border-violet-500 rounded-lg p-4 space-y-3">
            <h4 className="text-sm font-medium text-white">Новый паттерн</h4>

            <div>
              <label className="text-xs text-slate-500 mb-1 block">
                Название
              </label>
              <Input
                value={newPattern.name}
                onChange={(e) =>
                  setNewPattern({ ...newPattern, name: e.target.value })
                }
                placeholder="Например: Системное мышление"
                className="bg-slate-800 border-slate-600"
              />
            </div>

            <div>
              <label className="text-xs text-slate-500 mb-1 block">
                Описание
              </label>
              <Input
                value={newPattern.description}
                onChange={(e) =>
                  setNewPattern({ ...newPattern, description: e.target.value })
                }
                placeholder="Краткое описание паттерна"
                className="bg-slate-800 border-slate-600"
              />
            </div>

            <div>
              <label className="text-xs text-slate-500 mb-1 block">
                Системный промпт
              </label>
              <Textarea
                value={newPattern.systemPrompt}
                onChange={(e) =>
                  setNewPattern({ ...newPattern, systemPrompt: e.target.value })
                }
                placeholder="Инструкции для агента при использовании этого паттерна..."
                className="min-h-[120px] bg-slate-800 border-slate-600"
              />
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                onClick={handleCreatePattern}
                className="bg-violet-600 hover:bg-violet-500"
                disabled={!newPattern.name.trim()}
              >
                <Check className="h-4 w-4 mr-1" />
                Создать
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreating(false)}
                className="border-slate-600"
              >
                Отмена
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="w-full border-dashed border-slate-600 text-slate-400 hover:text-white hover:border-violet-500"
            onClick={() => setIsCreating(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Добавить паттерн мышления
          </Button>
        )}
      </div>
    </div>
  );
}
