"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { Lang } from "@/lib/format";
import { translate } from "@/lib/i18n";

interface LanguageContextValue {
  lang: Lang;
  dir: "rtl" | "ltr";
  setLang: (l: Lang) => void;
  toggle: () => void;
  t: (key: string) => string;
  pick: (ar: string, en: string) => string;
  tr: (obj: { ar: string; en: string }) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("ar");

  useEffect(() => {
    const stored = (typeof window !== "undefined" &&
      window.localStorage.getItem("fl-lang")) as Lang | null;
    // Intentional mount-time preference hydration (server renders the "ar"
    // default; syncing here avoids a hydration text mismatch).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored === "ar" || stored === "en") setLangState(stored);
  }, []);

  useEffect(() => {
    const dir = lang === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
    if (typeof window !== "undefined") window.localStorage.setItem("fl-lang", lang);
  }, [lang]);

  const setLang = useCallback((l: Lang) => setLangState(l), []);
  const toggle = useCallback(() => setLangState((p) => (p === "ar" ? "en" : "ar")), []);
  const t = useCallback((key: string) => translate(lang, key), [lang]);
  const pick = useCallback((ar: string, en: string) => (lang === "ar" ? ar : en), [lang]);
  const tr = useCallback(
    (obj: { ar: string; en: string }) => (lang === "ar" ? obj.ar : obj.en),
    [lang],
  );

  return (
    <LanguageContext.Provider
      value={{ lang, dir: lang === "ar" ? "rtl" : "ltr", setLang, toggle, t, pick, tr }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useI18n must be used within LanguageProvider");
  return ctx;
}
