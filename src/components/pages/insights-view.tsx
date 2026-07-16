"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Sparkles,
  Inbox,
  Flame,
  Wallet,
  CheckCircle2,
  Eye,
  RotateCcw,
  XCircle,
  Lightbulb,
  Wrench,
  ShieldAlert,
} from "lucide-react";
import { KpiCard } from "@/components/shared/kpi-card";
import { PageHeader, DisclaimerBar, EmptyState } from "@/components/shared/misc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Progress } from "@/components/ui/misc";
import { useI18n, useToast } from "@/providers";
import { INSIGHT_SEVERITY_LABEL } from "@/lib/i18n";
import { fmtCurrency, compactCurrency } from "@/lib/format";
import { setInsightStatusAction } from "@/app/actions";
import type { Insight, InsightSeverity, InsightStatus } from "@/lib/types";

// ---- severity → badge variant / accent color -------------------------------
const SEVERITY_VARIANT: Record<
  InsightSeverity,
  "danger" | "warning" | "info" | "muted"
> = {
  CRITICAL: "danger",
  HIGH: "danger",
  MEDIUM: "warning",
  LOW: "info",
  INFO: "muted",
};

const SEVERITY_BAR: Record<InsightSeverity, string> = {
  CRITICAL: "bg-rose-500",
  HIGH: "bg-rose-500",
  MEDIUM: "bg-amber-500",
  LOW: "bg-sky-500",
  INFO: "bg-slate-500",
};

const STATUS_META: Record<
  InsightStatus,
  { variant: "coral" | "info" | "success" | "muted"; icon: typeof Eye; ar: string; en: string }
> = {
  NEW: { variant: "coral", icon: Sparkles, ar: "جديدة", en: "New" },
  REVIEWED: { variant: "info", icon: Eye, ar: "تمت المراجعة", en: "Reviewed" },
  ACCEPTED: { variant: "success", icon: CheckCircle2, ar: "مقبولة", en: "Accepted" },
  DISMISSED: { variant: "muted", icon: XCircle, ar: "مرفوضة", en: "Dismissed" },
};

const STATUS_ACTIONS: { status: InsightStatus; icon: typeof Eye; ar: string; en: string }[] = [
  { status: "NEW", icon: Sparkles, ar: "جديدة", en: "New" },
  { status: "REVIEWED", icon: Eye, ar: "مراجعة", en: "Reviewed" },
  { status: "ACCEPTED", icon: CheckCircle2, ar: "قبول", en: "Accept" },
  { status: "DISMISSED", icon: XCircle, ar: "رفض", en: "Dismiss" },
];

export function InsightsView({ insights }: { insights: Insight[] }) {
  const { t, lang, tr, pick } = useI18n();
  const { toast } = useToast();
  const [pending, startTransition] = React.useTransition();
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const [severity, setSeverity] = React.useState<string>("ALL");
  const [category, setCategory] = React.useState<string>("ALL");
  const [status, setStatus] = React.useState<string>("ALL");

  const categories = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const i of insights) map.set(i.category, i.categoryEn);
    return [...map.entries()].map(([ar, en]) => ({ ar, en }));
  }, [insights]);

  const filtered = React.useMemo(
    () =>
      insights.filter(
        (i) =>
          (severity === "ALL" || i.severity === severity) &&
          (category === "ALL" || i.category === category) &&
          (status === "ALL" || i.status === status),
      ),
    [insights, severity, category, status],
  );

  // KPIs
  const total = insights.length;
  const newCount = insights.filter((i) => i.status === "NEW").length;
  const highCount = insights.filter(
    (i) => i.severity === "HIGH" || i.severity === "CRITICAL",
  ).length;
  const totalImpact = insights.reduce((a, i) => a + i.financialImpact, 0);

  function changeStatus(id: string, next: InsightStatus, currentStatus: InsightStatus) {
    if (next === currentStatus) return;
    setBusyId(id);
    startTransition(async () => {
      await setInsightStatusAction(id, next);
      setBusyId(null);
      const meta = STATUS_META[next];
      toast({
        kind: next === "DISMISSED" ? "warning" : "success",
        title: pick("تم تحديث حالة الرؤية", "Insight status updated"),
        description: `${id} → ${tr({ ar: meta.ar, en: meta.en })}`,
      });
    });
  }

  const severityOptions = [
    { value: "ALL", label: t("common.all") },
    ...(["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"] as InsightSeverity[]).map((s) => ({
      value: s,
      label: tr(INSIGHT_SEVERITY_LABEL[s]),
    })),
  ];
  const categoryOptions = [
    { value: "ALL", label: t("common.all") },
    ...categories.map((c) => ({ value: c.ar, label: tr(c) })),
  ];
  const statusOptions = [
    { value: "ALL", label: t("common.all") },
    ...(["NEW", "REVIEWED", "ACCEPTED", "DISMISSED"] as InsightStatus[]).map((s) => ({
      value: s,
      label: tr({ ar: STATUS_META[s].ar, en: STATUS_META[s].en }),
    })),
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("page.insights.title")} subtitle={t("page.insights.subtitle")} />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label={pick("إجمالي الرؤى", "Total insights")}
          value={String(total)}
          Icon={Lightbulb}
          accent="coral"
          delay={0.02}
        />
        <KpiCard
          label={pick("رؤى جديدة", "New insights")}
          value={String(newCount)}
          Icon={Sparkles}
          accent="sky"
          delay={0.05}
        />
        <KpiCard
          label={pick("خطورة عالية/حرجة", "High / critical")}
          value={String(highCount)}
          Icon={Flame}
          accent="rose"
          delay={0.08}
        />
        <KpiCard
          label={pick("الأثر المالي التقديري", "Estimated financial impact")}
          value={compactCurrency(totalImpact, lang)}
          Icon={Wallet}
          accent="emerald"
          delay={0.11}
        />
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block space-y-1.5">
            <span className="text-xs text-muted">{pick("الخطورة", "Severity")}</span>
            <Select
              options={severityOptions}
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs text-muted">{pick("الفئة", "Category")}</span>
            <Select
              options={categoryOptions}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs text-muted">{pick("الحالة", "Status")}</span>
            <Select
              options={statusOptions}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            />
          </label>
        </div>
      </Card>

      {/* Insight cards */}
      {filtered.length === 0 ? (
        <Card className="p-5">
          <EmptyState />
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {filtered.map((insight, idx) => (
            <InsightCard
              key={insight.id}
              insight={insight}
              index={idx}
              busy={pending && busyId === insight.id}
              onStatus={changeStatus}
            />
          ))}
        </div>
      )}

      <DisclaimerBar />
    </div>
  );
}

function InsightCard({
  insight,
  index,
  busy,
  onStatus,
}: {
  insight: Insight;
  index: number;
  busy: boolean;
  onStatus: (id: string, next: InsightStatus, current: InsightStatus) => void;
}) {
  const { lang, tr, pick } = useI18n();
  const statusMeta = STATUS_META[insight.status];
  const StatusIcon = statusMeta.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.04, 0.3) }}
    >
      <Card className="card-hover relative overflow-hidden">
        <span
          className={`absolute inset-y-0 start-0 w-1 ${SEVERITY_BAR[insight.severity]}`}
          aria-hidden
        />
        <div className="space-y-4 p-5 ps-6">
          {/* Header */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={SEVERITY_VARIANT[insight.severity]}>
              <ShieldAlert className="size-3" />
              {tr(INSIGHT_SEVERITY_LABEL[insight.severity])}
            </Badge>
            <Badge variant="muted">{tr({ ar: insight.category, en: insight.categoryEn })}</Badge>
            <span className="ms-auto inline-flex items-center gap-1">
              <Badge variant={statusMeta.variant}>
                <StatusIcon className="size-3" />
                {tr({ ar: statusMeta.ar, en: statusMeta.en })}
              </Badge>
            </span>
          </div>

          <h3 className="text-base font-semibold leading-relaxed text-slate-900">
            {tr({ ar: insight.titleAr, en: insight.titleEn })}
          </h3>

          {/* Evidence */}
          <div className="rounded-xl border border-navy-700/60 bg-navy-900/40 p-3">
            <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted">
              <Inbox className="size-3.5" />
              {pick("الأدلة المساندة", "Supporting evidence")}
            </p>
            <p className="text-sm leading-relaxed text-slate-700">
              {tr({ ar: insight.evidenceAr, en: insight.evidenceEn })}
            </p>
          </div>

          {/* Impact + confidence */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
              <p className="flex items-center gap-1.5 text-xs text-muted">
                <Wallet className="size-3.5 text-emerald-700" />
                {pick("الأثر المالي التقديري", "Estimated financial impact")}
              </p>
              <p className="mt-1 text-lg font-semibold text-emerald-700 tabular-nums">
                {fmtCurrency(insight.financialImpact, lang)}
              </p>
            </div>
            <div className="rounded-xl border border-navy-700/60 bg-navy-900/40 p-3">
              <div className="flex items-center justify-between text-xs text-muted">
                <span>{pick("درجة الثقة", "Confidence")}</span>
                <span className="font-semibold text-slate-900 tabular-nums">
                  {insight.confidence}%
                </span>
              </div>
              <Progress value={insight.confidence} className="mt-2" />
            </div>
          </div>

          {/* Recommended action */}
          <div className="rounded-xl border border-coral-500/20 bg-coral-500/5 p-3">
            <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-coral-600">
              <Wrench className="size-3.5" />
              {pick("الإجراء الموصى به", "Recommended action")}
            </p>
            <p className="text-sm leading-relaxed text-slate-700">
              {tr({ ar: insight.actionAr, en: insight.actionEn })}
            </p>
          </div>

          {/* Status buttons */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {STATUS_ACTIONS.map((a) => {
              const active = insight.status === a.status;
              const Icon = a.icon;
              return (
                <Button
                  key={a.status}
                  size="sm"
                  variant={active ? "default" : "outline"}
                  disabled={busy || active}
                  onClick={() => onStatus(insight.id, a.status, insight.status)}
                >
                  <Icon className="size-3.5" />
                  {tr({ ar: a.ar, en: a.en })}
                </Button>
              );
            })}
            {busy && (
              <span className="inline-flex items-center gap-1 text-xs text-muted">
                <RotateCcw className="size-3.5 animate-spin" />
                {pick("جارٍ الحفظ…", "Saving…")}
              </span>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
