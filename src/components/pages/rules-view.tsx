"use client";

import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  Activity,
  Percent,
  TrendingUp,
  Coins,
  PiggyBank,
  CalendarClock,
  History,
  FlaskConical,
  Check,
  X,
  Download,
  Sparkles,
  Power,
  Gauge,
} from "lucide-react";
import Link from "next/link";
import { PageHeader, DisclaimerBar } from "@/components/shared/misc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch, Separator } from "@/components/ui/misc";
import { Dialog } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useI18n, useToast } from "@/providers";
import { SEVERITY_LABEL, RULE_RECO_LABEL } from "@/lib/i18n";
import { setRuleStatusAction } from "@/app/actions";
import { fmtNumber, fmtPercent, fmtCurrency, fmtDate } from "@/lib/format";
import type {
  Decision,
  RuleRecommendationKey,
  RuleSeverity,
  RuleStatus,
} from "@/lib/types";

interface VersionEntry {
  version: string;
  date: string;
  changeAr: string;
  changeEn: string;
}
interface RuleRow {
  id: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  categoryAr: string;
  categoryEn: string;
  status: RuleStatus;
  severity: RuleSeverity;
  action: Decision;
  amountThreshold: number | null;
  triggerCount: number;
  confirmedFraud: number;
  falsePositives: number;
  precision: number;
  falsePositiveRate: number;
  financialImpact: number;
  estimatedBenefit: number;
  recommendationKey: RuleRecommendationKey;
  lastUpdated: string;
  history: VersionEntry[];
}
interface RulesData {
  rules: RuleRow[];
}

const STATUS_LABEL: Record<RuleStatus, { ar: string; en: string }> = {
  ACTIVE: { ar: "نشطة", en: "Active" },
  MONITORING: { ar: "قيد المراقبة", en: "Monitoring" },
  DISABLED: { ar: "معطّلة", en: "Disabled" },
};

const statusVariant: Record<RuleStatus, "approve" | "monitor" | "muted"> = {
  ACTIVE: "approve",
  MONITORING: "monitor",
  DISABLED: "muted",
};

const severityVariant: Record<RuleSeverity, "info" | "warning" | "coral" | "danger"> = {
  LOW: "info",
  MEDIUM: "warning",
  HIGH: "coral",
  CRITICAL: "danger",
};

const POOR_FP_RATE = 45;

export function RulesView({ data }: { data: RulesData }) {
  const { t, lang, tr } = useI18n();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [historyRule, setHistoryRule] = useState<RuleRow | null>(null);

  // Local optimistic status overlay (server action revalidates full tree afterwards).
  const [statusOverride, setStatusOverride] = useState<Record<string, RuleStatus>>({});
  const statusOf = (r: RuleRow): RuleStatus => statusOverride[r.id] ?? r.status;

  const changeStatus = (r: RuleRow, next: RuleStatus, successMsg: { ar: string; en: string }) => {
    setBusyId(r.id);
    setStatusOverride((s) => ({ ...s, [r.id]: next }));
    startTransition(async () => {
      await setRuleStatusAction(r.id, next);
      setBusyId(null);
      toast({ kind: "success", title: lang === "ar" ? successMsg.ar : successMsg.en });
    });
  };

  const approve = (r: RuleRow) =>
    changeStatus(r, "MONITORING", {
      ar: `تم اعتماد توصية القاعدة ${r.id} ونقلها للمراقبة`,
      en: `Recommendation for ${r.id} approved — moved to monitoring`,
    });

  const reject = (r: RuleRow) => {
    setBusyId(r.id);
    setStatusOverride((s) => ({ ...s, [r.id]: "ACTIVE" }));
    startTransition(async () => {
      await setRuleStatusAction(r.id, "ACTIVE");
      setBusyId(null);
      toast({
        kind: "info",
        title:
          lang === "ar"
            ? `تم رفض التوصية والإبقاء على القاعدة ${r.id} نشطة`
            : `Recommendation rejected — ${r.id} kept active`,
      });
    });
  };

  const toggleEnabled = (r: RuleRow) => {
    const currentlyOn = statusOf(r) !== "DISABLED";
    const next: RuleStatus = currentlyOn ? "DISABLED" : "ACTIVE";
    changeStatus(r, next, {
      ar: currentlyOn ? `تم تعطيل القاعدة ${r.id}` : `تم تفعيل القاعدة ${r.id}`,
      en: currentlyOn ? `${r.id} disabled` : `${r.id} enabled`,
    });
  };

  const exportRule = (r: RuleRow) =>
    toast({
      kind: "info",
      title: lang === "ar" ? "تم تجهيز التقرير" : "Report ready",
      description:
        lang === "ar"
          ? `تم تجهيز تقرير القاعدة ${r.id} للتصدير.`
          : `Report for ${r.id} has been prepared for export.`,
    });

  const filtered = (mode: "all" | "poor" | "monitoring") =>
    data.rules.filter((r) => {
      if (mode === "poor") return r.falsePositiveRate >= POOR_FP_RATE;
      if (mode === "monitoring") return statusOf(r) === "MONITORING";
      return true;
    });

  const renderGrid = (rows: RuleRow[]) => (
    <div className="grid gap-4 xl:grid-cols-2">
      {rows.map((r, i) => (
        <RuleCard key={r.id} rule={r} index={i} />
      ))}
      {rows.length === 0 && (
        <p className="col-span-full rounded-xl border border-navy-700/60 bg-navy-900/40 px-4 py-8 text-center text-sm text-muted">
          {t("common.empty")}
        </p>
      )}
    </div>
  );

  function RuleCard({ rule: r, index }: { rule: RuleRow; index: number }) {
    const st = statusOf(r);
    const poor = r.falsePositiveRate >= POOR_FP_RATE;
    const enabled = st !== "DISABLED";
    const isBusy = busyId === r.id && pending;

    // Concrete AI recommendation sentence — estimates computed PER RULE from its
    // own false-positive rate / precision (not a shared constant).
    const reductionPct = Math.round(r.falsePositiveRate * 0.32);
    const exposurePct = +(Math.max(0.1, (100 - r.falsePositiveRate) * 0.02)).toFixed(1);
    const sentence =
      lang === "ar"
        ? `القاعدة ${r.id} تسببت في ${fmtNumber(r.falsePositives)} رفضًا خاطئًا واكتشفت ${fmtNumber(
            r.confirmedFraud,
          )} حالة احتيال مؤكدة فقط. ${tr(RULE_RECO_LABEL[r.recommendationKey])} يُقدّر أن يخفض الرفض الخاطئ بنسبة ${reductionPct}٪ مقابل زيادة تعرض الاحتيال بنسبة ${exposurePct}٪ فقط.`
        : `${r.id} caused ${fmtNumber(r.falsePositives)} false declines and caught only ${fmtNumber(
            r.confirmedFraud,
          )} confirmed fraud cases. ${tr(
            RULE_RECO_LABEL[r.recommendationKey],
          )} is estimated to reduce false declines by ${reductionPct}% for only a ${exposurePct}% increase in fraud exposure.`;

    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: Math.min(index * 0.04, 0.3) }}
      >
        <Card
          className={`card-hover flex h-full flex-col p-5 ${
            poor ? "border-rose-500/30" : ""
          }`}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-coral-600">{r.id}</span>
                <Badge variant={statusVariant[st]}>{tr(STATUS_LABEL[st])}</Badge>
                <Badge variant={severityVariant[r.severity]}>
                  {tr(SEVERITY_LABEL[r.severity])}
                </Badge>
              </div>
              <h3 className="mt-1.5 truncate text-base font-semibold text-slate-900">
                {lang === "ar" ? r.nameAr : r.nameEn}
              </h3>
              <p className="mt-0.5 text-xs text-muted">
                {lang === "ar" ? r.categoryAr : r.categoryEn}
              </p>
            </div>
            <div className="flex flex-col items-center gap-1">
              <Switch checked={enabled} onCheckedChange={() => toggleEnabled(r)} id={`sw-${r.id}`} />
              <span className="flex items-center gap-0.5 text-[10px] text-muted">
                <Power className="size-2.5" />
                {enabled ? (lang === "ar" ? "مفعّلة" : "On") : lang === "ar" ? "معطّلة" : "Off"}
              </span>
            </div>
          </div>

          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            {lang === "ar" ? r.descriptionAr : r.descriptionEn}
          </p>

          {/* Metrics grid */}
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Metric
              Icon={Activity}
              label={lang === "ar" ? "مرات التفعيل" : "Triggers"}
              value={fmtNumber(r.triggerCount)}
            />
            <Metric
              Icon={ShieldCheck}
              label={lang === "ar" ? "معدل الاكتشاف" : "Detection rate"}
              value={fmtPercent(r.precision)}
              tone="emerald"
            />
            <Metric
              Icon={Percent}
              label={lang === "ar" ? "معدل الرفض الخاطئ" : "FP rate"}
              value={fmtPercent(r.falsePositiveRate)}
              tone={poor ? "rose" : "default"}
            />
            <Metric
              Icon={Gauge}
              label={lang === "ar" ? "الدقة" : "Precision"}
              value={fmtPercent(r.precision)}
            />
            <Metric
              Icon={Coins}
              label={lang === "ar" ? "التكلفة التقديرية" : "Est. cost"}
              value={fmtCurrency(r.financialImpact, lang)}
              tone="rose"
            />
            <Metric
              Icon={PiggyBank}
              label={lang === "ar" ? "الفائدة التقديرية" : "Est. benefit"}
              value={fmtCurrency(r.estimatedBenefit, lang)}
              tone="emerald"
            />
          </div>

          <div className="mt-2 flex items-center gap-1.5 text-xs text-muted">
            <CalendarClock className="size-3.5" />
            {lang === "ar" ? "آخر تحديث" : "Last updated"}: {fmtDate(r.lastUpdated, lang)}
          </div>

          {/* AI recommendation */}
          <div className="mt-3 rounded-xl border border-coral-500/20 bg-coral-500/5 p-3">
            <div className="flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-coral-600" />
              <span className="text-xs font-semibold text-coral-600">
                {lang === "ar" ? "توصية الذكاء الاصطناعي" : "AI recommendation"}
              </span>
              <Badge variant="coral" className="ms-auto">
                {tr(RULE_RECO_LABEL[r.recommendationKey])}
              </Badge>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">{sentence}</p>
          </div>

          <Separator className="my-4" />

          {/* Actions */}
          <div className="mt-auto flex flex-wrap items-center gap-2">
            <Link href={`/simulation?rule=${r.id}`}>
              <Button variant="secondary" size="sm">
                <FlaskConical className="size-4" />
                {lang === "ar" ? "محاكاة التوصية" : "Simulate"}
              </Button>
            </Link>
            <Button variant="success" size="sm" disabled={isBusy} onClick={() => approve(r)}>
              <Check className="size-4" />
              {lang === "ar" ? "اعتماد" : "Approve"}
            </Button>
            <Button variant="outline" size="sm" disabled={isBusy} onClick={() => reject(r)}>
              <X className="size-4" />
              {lang === "ar" ? "رفض" : "Reject"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setHistoryRule(r)}>
              <History className="size-4" />
              {lang === "ar" ? "السجل" : "History"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => exportRule(r)}>
              <Download className="size-4" />
              {lang === "ar" ? "تصدير" : "Export"}
            </Button>
          </div>
        </Card>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("page.rules.title")} subtitle={t("page.rules.subtitle")} />

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">
            {t("common.all")} ({data.rules.length})
          </TabsTrigger>
          <TabsTrigger value="poor">
            {lang === "ar" ? "أداء ضعيف" : "Poorly performing"} ({filtered("poor").length})
          </TabsTrigger>
          <TabsTrigger value="monitoring">
            {lang === "ar" ? "تحت المراقبة" : "Monitoring"} ({filtered("monitoring").length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4">
          {renderGrid(filtered("all"))}
        </TabsContent>
        <TabsContent value="poor" className="mt-4">
          {renderGrid(filtered("poor"))}
        </TabsContent>
        <TabsContent value="monitoring" className="mt-4">
          {renderGrid(filtered("monitoring"))}
        </TabsContent>
      </Tabs>

      {/* Version history dialog */}
      <Dialog
        open={historyRule !== null}
        onClose={() => setHistoryRule(null)}
        title={
          historyRule
            ? `${lang === "ar" ? "سجل إصدارات القاعدة" : "Version history"} — ${historyRule.id}`
            : ""
        }
        description={
          historyRule ? (lang === "ar" ? historyRule.nameAr : historyRule.nameEn) : undefined
        }
      >
        <ol className="relative space-y-4 ps-5">
          <span className="absolute inset-y-1 start-1.5 w-px bg-navy-600" aria-hidden />
          {historyRule?.history.map((v, i) => (
            <li key={v.version} className="relative">
              <span
                className={`absolute -start-[1.35rem] top-1 size-3 rounded-full border-2 ${
                  i === 0
                    ? "border-coral-400 bg-coral-500"
                    : "border-navy-500 bg-navy-800"
                }`}
                aria-hidden
              />
              <div className="flex items-center gap-2">
                <Badge variant={i === 0 ? "coral" : "muted"}>{v.version}</Badge>
                <span className="text-xs text-muted">{fmtDate(v.date, lang)}</span>
                {i === 0 && (
                  <span className="flex items-center gap-0.5 text-[10px] text-coral-600">
                    <TrendingUp className="size-3" />
                    {lang === "ar" ? "الحالي" : "current"}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-slate-600">
                {lang === "ar" ? v.changeAr : v.changeEn}
              </p>
            </li>
          ))}
        </ol>
      </Dialog>

      <DisclaimerBar />
    </div>
  );
}

function Metric({
  Icon,
  label,
  value,
  tone = "default",
}: {
  Icon: typeof Activity;
  label: string;
  value: string;
  tone?: "default" | "emerald" | "rose";
}) {
  const toneClass =
    tone === "emerald" ? "text-emerald-700" : tone === "rose" ? "text-rose-700" : "text-slate-900";
  return (
    <div className="rounded-lg border border-navy-700/50 bg-navy-900/40 p-2.5">
      <div className="flex items-center gap-1 text-[11px] text-muted">
        <Icon className="size-3" />
        <span className="truncate">{label}</span>
      </div>
      <p className={`mt-1 text-sm font-semibold tabular-nums ${toneClass}`}>{value}</p>
    </div>
  );
}
