"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight } from "lucide-react";

interface CollapsibleSectionProps {
  id: string;
  title: string;
  children: ReactNode;
  defaultExpanded?: boolean;
  isExpanded?: boolean;
  onToggle?: () => void;
  className?: string;
}

export function CollapsibleSection({
  id,
  title,
  children,
  defaultExpanded = false,
  isExpanded,
  onToggle,
  className,
}: CollapsibleSectionProps) {
  const expanded = isExpanded ?? defaultExpanded;

  return (
    <section id={id} className={cn("mb-8", className)}>
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-2 w-full text-left group"
      >
        {expanded ? (
          <ChevronDown className="h-5 w-5 text-slate-500 group-hover:text-white transition-colors" />
        ) : (
          <ChevronRight className="h-5 w-5 text-slate-500 group-hover:text-white transition-colors" />
        )}
        <h2 className="text-lg font-semibold text-white group-hover:text-violet-400 transition-colors">
          {title}
        </h2>
      </button>

      {expanded && (
        <div className="mt-4 ml-7 animate-in fade-in slide-in-from-top-2 duration-200">
          {children}
        </div>
      )}
    </section>
  );
}
