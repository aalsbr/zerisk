// Locale-agnostic formatting helpers (safe on both client and server).

export type Lang = "ar" | "en";

export function fmtNumber(n: number, digits = 0): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function fmtCurrency(n: number, lang: Lang = "ar", digits = 0): string {
  const value = fmtNumber(Math.round(n), digits);
  return lang === "ar" ? `${value} ريال` : `SAR ${value}`;
}

// English-text currency (used inside Copilot English summaries).
export function sar(n: number): string {
  return `SAR ${fmtNumber(Math.round(n))}`;
}

export function compact(n: number, lang: Lang = "en"): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(2)}${lang === "ar" ? "م" : "M"}`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(1)}${lang === "ar" ? "ألف" : "K"}`;
  return `${sign}${abs}`;
}

export function compactCurrency(n: number, lang: Lang = "ar"): string {
  return lang === "ar" ? `${compact(n, "ar")} ريال` : `SAR ${compact(n, "en")}`;
}

export function fmtPercent(n: number, digits = 1): string {
  return `${n.toFixed(digits)}%`;
}

export function fmtDate(iso: string, lang: Lang = "ar"): string {
  const d = new Date(iso);
  return d.toLocaleDateString(lang === "ar" ? "ar-SA-u-nu-latn" : "en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function fmtDateTime(iso: string, lang: Lang = "ar"): string {
  const d = new Date(iso);
  return d.toLocaleString(lang === "ar" ? "ar-SA-u-nu-latn" : "en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fmtTimeAgo(iso: string, lang: Lang = "ar"): string {
  const diff = Date.UTC(2026, 6, 17, 12, 0, 0) - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 60) return lang === "ar" ? `قبل ${mins} دقيقة` : `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return lang === "ar" ? `قبل ${hrs} ساعة` : `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return lang === "ar" ? `قبل ${days} يوم` : `${days}d ago`;
}
