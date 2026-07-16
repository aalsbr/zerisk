"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search,
  Bell,
  Menu,
  Languages,
  UserCog,
  Check,
  Bot,
  BotOff,
} from "lucide-react";
import { NAV, ALL_NAV_ITEMS } from "./nav-config";
import { useI18n, useRole } from "@/providers";
import { ROLE_LABEL } from "@/lib/i18n";
import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";

const ROLES: Role[] = [
  "EXECUTIVE",
  "FRAUD_MANAGER",
  "INVESTIGATOR",
  "DATA_SCIENTIST",
  "AUDITOR",
  "ADMINISTRATOR",
];

function useOutside<T extends HTMLElement>(onClose: () => void) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);
  return ref;
}

export function Topbar({
  onMenu,
  copilotOnline,
  notifications,
}: {
  onMenu: () => void;
  copilotOnline: boolean;
  notifications: { id: string; title: string; severity: string }[];
}) {
  const { t, lang, toggle } = useI18n();
  const { role, setRole } = useRole();
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [showRole, setShowRole] = useState(false);

  const searchRef = useOutside<HTMLDivElement>(() => setShowSearch(false));
  const notifRef = useOutside<HTMLDivElement>(() => setShowNotif(false));
  const roleRef = useOutside<HTMLDivElement>(() => setShowRole(false));

  const matches = query
    ? ALL_NAV_ITEMS.filter((i) => t(i.key).toLowerCase().includes(query.toLowerCase())).slice(0, 5)
    : [];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query) return;
    router.push(`/transactions?q=${encodeURIComponent(query)}`);
    setShowSearch(false);
  };

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-navy-700/60 bg-navy-950/70 px-4 backdrop-blur-xl">
      <button
        onClick={onMenu}
        className="grid size-9 place-items-center rounded-lg text-muted hover:bg-navy-800 hover:text-slate-900 lg:hidden"
      >
        <Menu className="size-5" />
      </button>

      {/* Search */}
      <div ref={searchRef} className="relative hidden max-w-md flex-1 sm:block">
        <form onSubmit={submit}>
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowSearch(true);
            }}
            onFocus={() => setShowSearch(true)}
            placeholder={t("common.searchFull")}
            className="h-10 w-full rounded-xl border border-navy-600 bg-navy-900/60 ps-9 pe-3 text-sm text-slate-900 placeholder:text-muted focus:border-coral-500/60 focus:outline-none"
          />
        </form>
        {showSearch && matches.length > 0 && (
          <div className="absolute mt-2 w-full overflow-hidden rounded-xl border border-navy-600 bg-navy-850 shadow-2xl">
            {matches.map((m) => (
              <Link
                key={m.href}
                href={m.href}
                onClick={() => setShowSearch(false)}
                className="flex items-center gap-3 px-3 py-2.5 text-sm text-slate-700 hover:bg-navy-800"
              >
                <m.Icon className="size-4 text-coral-600" />
                {t(m.key)}
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 sm:hidden" />

      {/* Copilot status */}
      <span
        className={cn(
          "hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium md:inline-flex",
          copilotOnline
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700"
            : "border-navy-600 bg-navy-800 text-muted",
        )}
      >
        {copilotOnline ? <Bot className="size-3.5" /> : <BotOff className="size-3.5" />}
        {copilotOnline ? t("common.copilotOnline") : t("common.copilotOffline")}
      </span>

      {/* Language */}
      <button
        onClick={toggle}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-navy-600 bg-navy-900/60 px-2.5 text-xs font-medium text-slate-700 hover:bg-navy-800"
      >
        <Languages className="size-4" />
        {lang === "ar" ? "English" : "العربية"}
      </button>

      {/* Notifications */}
      <div ref={notifRef} className="relative">
        <button
          onClick={() => setShowNotif((v) => !v)}
          className="relative grid size-9 place-items-center rounded-lg border border-navy-600 bg-navy-900/60 text-slate-700 hover:bg-navy-800"
        >
          <Bell className="size-4" />
          {notifications.length > 0 && (
            <span className="absolute -end-0.5 -top-0.5 grid size-4 place-items-center rounded-full bg-coral-500 text-[9px] font-bold text-white">
              {notifications.length}
            </span>
          )}
        </button>
        {showNotif && (
          <div className="absolute end-0 mt-2 w-80 overflow-hidden rounded-xl border border-navy-600 bg-navy-850 shadow-2xl">
            <div className="border-b border-navy-700 px-4 py-3 text-sm font-semibold text-slate-900">
              {t("common.notifications")}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.map((n) => (
                <Link
                  key={n.id}
                  href="/insights"
                  onClick={() => setShowNotif(false)}
                  className="flex items-start gap-3 border-b border-navy-800 px-4 py-3 hover:bg-navy-800"
                >
                  <span
                    className={cn(
                      "mt-1.5 size-2 shrink-0 rounded-full",
                      n.severity === "CRITICAL" || n.severity === "HIGH"
                        ? "bg-rose-400"
                        : "bg-amber-400",
                    )}
                  />
                  <p className="text-xs leading-relaxed text-slate-700">{n.title}</p>
                </Link>
              ))}
            </div>
            <Link
              href="/insights"
              onClick={() => setShowNotif(false)}
              className="block px-4 py-2.5 text-center text-xs font-medium text-coral-600 hover:bg-navy-800"
            >
              {t("common.viewAll")}
            </Link>
          </div>
        )}
      </div>

      {/* Role switcher */}
      <div ref={roleRef} className="relative">
        <button
          onClick={() => setShowRole((v) => !v)}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-navy-600 bg-navy-900/60 px-2.5 text-xs font-medium text-slate-700 hover:bg-navy-800"
        >
          <span className="grid size-6 place-items-center rounded-md grad-coral text-white">
            <UserCog className="size-3.5" />
          </span>
          <span className="hidden sm:inline">
            {lang === "ar" ? ROLE_LABEL[role].ar : ROLE_LABEL[role].en}
          </span>
        </button>
        {showRole && (
          <div className="absolute end-0 mt-2 w-52 overflow-hidden rounded-xl border border-navy-600 bg-navy-850 shadow-2xl">
            <div className="border-b border-navy-700 px-4 py-2.5 text-xs font-semibold text-muted">
              {t("common.role")}
            </div>
            {ROLES.map((r) => (
              <button
                key={r}
                onClick={() => {
                  setRole(r);
                  setShowRole(false);
                }}
                className="flex w-full items-center justify-between px-4 py-2.5 text-sm text-slate-700 hover:bg-navy-800"
              >
                {lang === "ar" ? ROLE_LABEL[r].ar : ROLE_LABEL[r].en}
                {r === role && <Check className="size-4 text-coral-600" />}
              </button>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}

export { NAV };
