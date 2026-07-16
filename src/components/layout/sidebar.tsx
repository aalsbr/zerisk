"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { NAV } from "./nav-config";
import { useI18n } from "@/providers";
import { cn } from "@/lib/utils";

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { t, pick } = useI18n();

  return (
    <div className="flex h-full flex-col">
      <Link
        href="/"
        onClick={onNavigate}
        className="flex items-center gap-3 px-5 py-5"
      >
        <span className="grid size-10 place-items-center rounded-xl grad-coral shadow-lg shadow-coral-600/30">
          <ShieldCheck className="size-6 text-white" />
        </span>
        <div className="leading-tight">
          <p className="text-sm font-bold text-slate-900">{t("app.name")}</p>
          <p className="text-[11px] text-muted">{pick("تحسين قرارات الاحتيال", "Fraud decision optimization")}</p>
        </div>
      </Link>

      <nav className="no-scrollbar flex-1 space-y-5 overflow-y-auto px-3 pb-6">
        {NAV.map((group) => (
          <div key={group.key}>
            <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted/70">
              {t(group.key)}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all",
                      active
                        ? "bg-navy-700/70 text-slate-900"
                        : "text-slate-600 hover:bg-navy-800/60 hover:text-slate-900",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-7 place-items-center rounded-lg transition-colors",
                        active ? "grad-coral text-white" : "bg-navy-800 text-muted group-hover:text-slate-700",
                      )}
                    >
                      <item.Icon className="size-4" />
                    </span>
                    <span className="truncate">{t(item.key)}</span>
                    {active && <span className="ms-auto size-1.5 rounded-full bg-coral-400" />}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </div>
  );
}
