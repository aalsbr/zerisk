"use client";

import { createContext, useContext, useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Info, AlertTriangle, X } from "lucide-react";

type ToastKind = "success" | "info" | "warning" | "error";
interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  description?: string;
}

interface ToastContextValue {
  toast: (t: Omit<Toast, "id">) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS = {
  success: CheckCircle2,
  info: Info,
  warning: AlertTriangle,
  error: AlertTriangle,
};

const COLORS: Record<ToastKind, string> = {
  success: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700",
  info: "border-sky-500/40 bg-sky-500/10 text-sky-700",
  warning: "border-amber-500/40 bg-amber-500/10 text-amber-700",
  error: "border-rose-500/40 bg-rose-500/10 text-rose-700",
};

let counter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((t: Omit<Toast, "id">) => {
    const id = ++counter;
    setToasts((prev) => [...prev, { ...t, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 4200);
  }, []);

  const dismiss = (id: number) => setToasts((prev) => prev.filter((x) => x.id !== id));

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed bottom-5 left-1/2 z-[100] flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4">
        <AnimatePresence>
          {toasts.map((t) => {
            const Icon = ICONS[t.kind];
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 24, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.96 }}
                className={`pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg backdrop-blur-md ${COLORS[t.kind]}`}
              >
                <Icon className="mt-0.5 size-5 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-900">{t.title}</p>
                  {t.description && (
                    <p className="mt-0.5 text-xs text-slate-600">{t.description}</p>
                  )}
                </div>
                <button
                  onClick={() => dismiss(t.id)}
                  className="text-slate-500 transition hover:text-slate-900"
                >
                  <X className="size-4" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
