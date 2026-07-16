"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-xl bg-navy-700/50", className)}
      {...props}
    />
  );
}

export function Separator({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-navy-600/60", className)} />;
}

export function Progress({
  value,
  className,
  indicatorClassName,
}: {
  value: number;
  className?: string;
  indicatorClassName?: string;
}) {
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-navy-700/70", className)}>
      <div
        className={cn("h-full rounded-full grad-coral transition-all", indicatorClassName)}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

export function Switch({
  checked,
  onCheckedChange,
  id,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  id?: string;
}) {
  return (
    <button
      id={id}
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
        checked ? "grad-coral" : "bg-navy-600",
      )}
    >
      <span
        className={cn(
          "inline-block size-4 transform rounded-full bg-white transition-transform",
          checked ? "translate-x-[-1.4rem] rtl:translate-x-[1.4rem]" : "translate-x-[-0.15rem] rtl:translate-x-[0.15rem]",
        )}
      />
    </button>
  );
}

export function Tooltip({
  content,
  children,
}: {
  content: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <span className="group/tt relative inline-flex">
      {children}
      <span className="pointer-events-none absolute bottom-full start-1/2 z-50 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-navy-600 bg-navy-850 px-2.5 py-1.5 text-xs text-slate-700 shadow-xl group-hover/tt:block rtl:translate-x-1/2">
        {content}
      </span>
    </span>
  );
}
