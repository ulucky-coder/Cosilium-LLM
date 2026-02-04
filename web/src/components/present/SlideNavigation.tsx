"use client";

import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface SlideNavigationProps {
  currentIndex: number;
  totalSlides: number;
  onPrev: () => void;
  onNext: () => void;
  onGoTo: (index: number) => void;
}

export function SlideNavigation({
  currentIndex,
  totalSlides,
  onPrev,
  onNext,
  onGoTo,
}: SlideNavigationProps) {
  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 z-50">
      {/* Prev Button */}
      <button
        type="button"
        onClick={onPrev}
        disabled={currentIndex === 0}
        className={cn(
          "w-10 h-10 rounded-full bg-slate-800/80 backdrop-blur-sm flex items-center justify-center transition-all",
          currentIndex === 0
            ? "opacity-50 cursor-not-allowed"
            : "hover:bg-slate-700"
        )}
      >
        <ChevronLeft className="h-5 w-5 text-white" />
      </button>

      {/* Dots */}
      <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/80 backdrop-blur-sm rounded-full">
        {Array.from({ length: totalSlides }).map((_, i) => (
          <button
            type="button"
            key={i}
            onClick={() => onGoTo(i)}
            className={cn(
              "w-2 h-2 rounded-full transition-all",
              i === currentIndex
                ? "w-6 bg-violet-500"
                : "bg-slate-600 hover:bg-slate-500"
            )}
            title={`Слайд ${i + 1}`}
          />
        ))}
      </div>

      {/* Next Button */}
      <button
        type="button"
        onClick={onNext}
        disabled={currentIndex === totalSlides - 1}
        className={cn(
          "w-10 h-10 rounded-full bg-slate-800/80 backdrop-blur-sm flex items-center justify-center transition-all",
          currentIndex === totalSlides - 1
            ? "opacity-50 cursor-not-allowed"
            : "hover:bg-slate-700"
        )}
      >
        <ChevronRight className="h-5 w-5 text-white" />
      </button>
    </div>
  );
}
