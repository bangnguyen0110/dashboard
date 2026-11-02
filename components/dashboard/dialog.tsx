"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";

type DialogProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

export function Dialog({ open, title, onClose, children }: DialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div className="bg-white dark:bg-[#0c1830] border border-[#bfd7ee] dark:border-slate-700 shadow-2xl relative w-full max-w-md rounded-xl p-6 text-slate-800 dark:text-slate-100">
        <div className="mb-4 flex items-center justify-between gap-3 border-b border-[#bfd7ee] dark:border-white/10 pb-3">
          <h3 className="text-lg font-bold text-blue-900 dark:text-blue-100">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="rounded-xl p-1.5 text-foreground/60 transition hover:bg-white/10 hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}