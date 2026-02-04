"use client";

import { Slide } from "./useSlideBuilder";
import { cn } from "@/lib/utils";
import { FileText, X } from "lucide-react";

interface SpeakerNotesProps {
  slide: Slide;
  visible: boolean;
  onClose: () => void;
}

export function SpeakerNotes({ slide, visible, onClose }: SpeakerNotesProps) {
  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-sm border-t border-slate-700 p-4 z-40 animate-in slide-in-from-bottom duration-200">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium text-slate-400 flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Заметки спикера
          </h4>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-slate-300">
          {slide.notes || "Нет заметок для этого слайда."}
        </p>
      </div>
    </div>
  );
}
