"use client";

import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function KpiCard({
  label,
  value,
  sub,
  Icon,
  trend,
  trendPositive = true,
  accent = "coral",
  delay = 0,
}: {
  label: string;
  value: string;
  sub?: string;
  Icon?: LucideIcon;
  trend?: string;
  trendPositive?: boolean;
  accent?: "coral" | "emerald" | "sky" | "amber" | "rose" | "violet";
  delay?: number;
}) {
  const accentBg: Record<string, string> = {
    coral: "bg-coral-500/15 text-coral-600",
    emerald: "bg-emerald-500/15 text-emerald-700",
    sky: "bg-sky-500/15 text-sky-700",
    amber: "bg-amber-500/15 text-amber-700",
    rose: "bg-rose-500/15 text-rose-700",
    violet: "bg-violet-500/15 text-violet-700",
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="surface card-hover rounded-2xl p-4"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-muted">{label}</p>
        {Icon && (
          <span className={cn("grid size-8 place-items-center rounded-lg", accentBg[accent])}>
            <Icon className="size-4" />
          </span>
        )}
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">{value}</p>
      <div className="mt-1 flex items-center gap-2">
        {trend && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-xs font-medium",
              trendPositive ? "text-emerald-600" : "text-rose-600",
            )}
          >
            {trendPositive ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
            {trend}
          </span>
        )}
        {sub && <span className="text-xs text-muted">{sub}</span>}
      </div>
    </motion.div>
  );
}
