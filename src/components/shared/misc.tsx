"use client";

import { motion } from "framer-motion";
import { Info, Inbox } from "lucide-react";
import { useI18n } from "@/providers";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-2xl font-bold tracking-tight text-slate-900"
        >
          {title}
        </motion.h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function DisclaimerBar({ className }: { className?: string }) {
  const { t } = useI18n();
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/5 px-3.5 py-2.5 text-xs text-amber-200/90",
        className,
      )}
    >
      <Info className="mt-0.5 size-4 shrink-0 text-amber-600" />
      <span>{t("disclaimer")}</span>
    </div>
  );
}

export function EmptyState({ title, hint }: { title?: string; hint?: string }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-navy-800 text-muted">
        <Inbox className="size-6" />
      </span>
      <p className="text-sm font-medium text-slate-700">{title ?? t("common.empty")}</p>
      <p className="max-w-xs text-xs text-muted">{hint ?? t("common.emptyHint")}</p>
    </div>
  );
}

export function SectionTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h2 className={cn("mb-3 text-sm font-semibold uppercase tracking-wide text-muted", className)}>
      {children}
    </h2>
  );
}

export function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl border border-navy-700/60 bg-navy-900/40 p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900 tabular-nums">{value}</p>
      {hint && <p className="text-[11px] text-muted">{hint}</p>}
    </div>
  );
}
