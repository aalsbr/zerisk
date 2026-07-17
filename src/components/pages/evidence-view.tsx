"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Database,
  Tags,
  GitBranch,
  BadgeCheck,
  ShieldAlert,
  Users2,
  Banknote,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Download,
  RefreshCcw,
  FlaskConical,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { KpiCard } from "@/components/shared/kpi-card";
import { PageHeader, DisclaimerBar, SectionTitle, Stat } from "@/components/shared/misc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { useI18n, useToast } from "@/providers";
import {
  fmtNumber,
  fmtCurrency,
  fmtPercent,
  fmtDateTime,
} from "@/lib/format";
import { recalibrateModelAction } from "@/app/actions";
import type {
  MvpEvidence,
  KpiSnapshot,
  ModelVersion,
  LearningChange,
} from "@/lib/types";

interface RecalSummary {
  changed: boolean;
  previousVersion: string;
  newVersion: string;
  labeledCount: number;
  changes: LearningChange[];
  before: { fpRate: number; recall: number };
  after: { fpRate: number; recall: number };
}

interface TestStatus {
  passing: boolean;
  suites: string[];
}

const DISCLAIMER_AR =
  "هذه النتائج مُنتَجة من مجموعة بيانات اصطناعية قابلة للتكرار وتوضّح منهجية المنصة. يجب التحقق من الأداء الإنتاجي باستخدام بيانات المؤسسة المالية التاريخية المُصنّفة.";
const DISCLAIMER_EN =
  "These results are produced from a synthetic, reproducible MVP dataset and demonstrate the platform methodology. Production performance must be validated using the financial institution's historical labeled data.";

const ASSUMPTIONS_NOTE =
  "MVP evidence computed on a synthetic, reproducible dataset. Metrics are illustrative of the platform methodology and must be re-validated on the institution's historical labeled data before production use.";

const SUITE_LABEL: Record<string, { ar: string; en: string }> = {
  scoring: { ar: "محرك التقييم", en: "Scoring engine" },
  financial: { ar: "الأثر المالي", en: "Financial impact" },
  simulation: { ar: "المحاكاة", en: "Simulation" },
  learning: { ar: "حلقة التعلّم", en: "Learning loop" },
  "seed-integrity": { ar: "سلامة البيانات", en: "Seed integrity" },
};

export function EvidenceView({
  evidence,
  kpis,
  modelVersions,
  testStatus,
}: {
  evidence: MvpEvidence;
  kpis: KpiSnapshot;
  modelVersions: ModelVersion[];
  testStatus: TestStatus;
}) {
  const { t, lang, pick, tr } = useI18n();
  const { toast } = useToast();
  const [pending, startTransition] = React.useTransition();
  const [summary, setSummary] = React.useState<RecalSummary | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const fpDelta = evidence.originalFalsePositiveRate - evidence.optimizedFalsePositiveRate;
  const recallDelta = evidence.optimizedRecall - evidence.originalRecall;

  function downloadReport() {
    const report = {
      product: "ZeRisk",
      report: "MVP Evidence",
      generatedAt: evidence.generatedAt,
      assumptions: ASSUMPTIONS_NOTE,
      evidence,
      kpis,
      modelVersions,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "zerisk-mvp-evidence.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({
      kind: "success",
      title: pick("تم تنزيل التقرير", "Report downloaded"),
      description: "zerisk-mvp-evidence.json",
    });
  }

  function recalibrate() {
    startTransition(async () => {
      const res = await recalibrateModelAction();
      setSummary(res.summary as RecalSummary);
      setDialogOpen(true);
      toast({
        kind: res.summary.changed ? "success" : "info",
        title: res.summary.changed
          ? pick("تمت إعادة المعايرة", "Model recalibrated")
          : pick("لا توجد تسميات جديدة", "No new labels"),
        description: res.summary.changed
          ? `${res.summary.previousVersion} → ${res.summary.newVersion}`
          : undefined,
      });
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("page.evidence.title")}
        subtitle={t("page.evidence.subtitle")}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={downloadReport}>
              <Download className="size-4" />
              {pick("تنزيل تقرير JSON", "Download JSON report")}
            </Button>
            <Button size="sm" onClick={recalibrate} disabled={pending}>
              <RefreshCcw className={"size-4 " + (pending ? "animate-spin" : "")} />
              {pick("إعادة معايرة النموذج", "Recalibrate Model")}
            </Button>
          </>
        }
      />

      {/* Headline KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label={pick("العمليات المُحلَّلة", "Transactions analyzed")}
          value={fmtNumber(evidence.transactionsAnalyzed)}
          Icon={Database}
          accent="coral"
          delay={0.02}
        />
        <KpiCard
          label={pick("النتائج المُصنّفة", "Labeled outcomes")}
          value={fmtNumber(evidence.labeledOutcomes)}
          Icon={Tags}
          accent="emerald"
          delay={0.04}
        />
        <KpiCard
          label={pick("أحداث التعلّم", "Learning events")}
          value={fmtNumber(evidence.learningEvents)}
          Icon={GitBranch}
          accent="violet"
          delay={0.06}
        />
        <KpiCard
          label={pick("إصدار النموذج الحالي", "Current model version")}
          value={evidence.modelVersion}
          Icon={BadgeCheck}
          accent="sky"
          delay={0.08}
        />
      </div>

      {/* Before → after comparison */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ComparisonCard
          title={pick("معدل الرفض الخاطئ", "False-positive rate")}
          subtitle={pick("الأصلي مقابل المحسّن", "Original vs optimized")}
          before={fmtPercent(evidence.originalFalsePositiveRate, 2)}
          after={fmtPercent(evidence.optimizedFalsePositiveRate, 2)}
          improved={fpDelta > 0}
          deltaLabel={
            (fpDelta >= 0 ? "−" : "+") +
            fmtPercent(Math.abs(fpDelta), 2)
          }
          improvedGood="down"
        />
        <ComparisonCard
          title={pick("الاستدعاء (Recall)", "Recall")}
          subtitle={pick("الأصلي مقابل المحسّن", "Original vs optimized")}
          before={fmtPercent(evidence.originalRecall, 2)}
          after={fmtPercent(evidence.optimizedRecall, 2)}
          improved={recallDelta > 0}
          deltaLabel={
            (recallDelta >= 0 ? "+" : "−") +
            fmtPercent(Math.abs(recallDelta), 2)
          }
          improvedGood="up"
        />
      </div>

      {/* Impact metrics */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label={pick("خفض المراجعات اليدوية", "Manual reviews reduced")}
          value={fmtPercent(evidence.manualReviewsReduced, 1)}
          Icon={Users2}
          accent="emerald"
          delay={0.02}
        />
        <KpiCard
          label={pick("الإيراد المُستعاد", "Revenue recovered")}
          value={fmtCurrency(evidence.revenueRecovered, lang)}
          Icon={Banknote}
          accent="coral"
          delay={0.04}
        />
        <KpiCard
          label={pick("تغيّر التعرّض للاحتيال", "Fraud exposure change")}
          value={fmtCurrency(evidence.fraudExposureChange, lang)}
          Icon={ShieldCheck}
          accent="sky"
          delay={0.06}
        />
        <KpiCard
          label={pick("احتيال فائت تم اكتشافه", "False negatives caught")}
          value={fmtNumber(evidence.falseNegativesCaught)}
          Icon={ShieldAlert}
          accent="rose"
          delay={0.08}
        />
      </div>

      {/* Detail + test status */}
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="p-5">
          <SectionTitle>{pick("تفاصيل الأدلة", "Evidence details")}</SectionTitle>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat
              label={pick("العمليات المُحلَّلة", "Transactions analyzed")}
              value={fmtNumber(evidence.transactionsAnalyzed)}
            />
            <Stat
              label={pick("النتائج المُصنّفة", "Labeled outcomes")}
              value={fmtNumber(evidence.labeledOutcomes)}
            />
            <Stat
              label={pick("أحداث التعلّم", "Learning events")}
              value={fmtNumber(evidence.learningEvents)}
            />
            <Stat
              label={pick("إصدار النموذج", "Model version")}
              value={evidence.modelVersion}
            />
            <Stat
              label={pick("رفض خاطئ أصلي", "Original FP rate")}
              value={fmtPercent(evidence.originalFalsePositiveRate, 2)}
            />
            <Stat
              label={pick("رفض خاطئ محسّن", "Optimized FP rate")}
              value={fmtPercent(evidence.optimizedFalsePositiveRate, 2)}
            />
            <Stat
              label={pick("استدعاء أصلي", "Original recall")}
              value={fmtPercent(evidence.originalRecall, 2)}
            />
            <Stat
              label={pick("استدعاء محسّن", "Optimized recall")}
              value={fmtPercent(evidence.optimizedRecall, 2)}
            />
            <Stat
              label={pick("خفض المراجعات", "Reviews reduced")}
              value={fmtPercent(evidence.manualReviewsReduced, 1)}
            />
            <Stat
              label={pick("الإيراد المُستعاد", "Revenue recovered")}
              value={fmtCurrency(evidence.revenueRecovered, lang)}
            />
            <Stat
              label={pick("تغيّر التعرّض", "Exposure change")}
              value={fmtCurrency(evidence.fraudExposureChange, lang)}
            />
            <Stat
              label={pick("احتيال فائت مُكتشَف", "False negatives caught")}
              value={fmtNumber(evidence.falseNegativesCaught)}
            />
            <Stat
              label={pick("آخر معايرة", "Last recalibration")}
              value={fmtDateTime(evidence.lastRecalibrationAt, lang)}
            />
            <Stat
              label={pick("تم التوليد في", "Generated at")}
              value={fmtDateTime(evidence.generatedAt, lang)}
            />
            <Stat
              label={pick("عمليات العرض التوضيحي", "Demo transactions")}
              value={
                evidence.demoTransactionsPresent ? (
                  <span className="inline-flex items-center gap-1 text-emerald-700">
                    <CheckCircle2 className="size-4" />
                    {pick("موجودة", "Present")}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-rose-700">
                    <XCircle className="size-4" />
                    {pick("غير موجودة", "Absent")}
                  </span>
                )
              }
            />
          </div>
        </Card>

        {/* Test suite status */}
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <SectionTitle className="mb-0">
              {pick("حالة الاختبارات", "Test suite status")}
            </SectionTitle>
            <Badge variant={testStatus.passing ? "success" : "danger"}>
              <FlaskConical className="size-3" />
              {testStatus.passing
                ? pick("كلها ناجحة", "All passing")
                : pick("فشل", "Failing")}
            </Badge>
          </div>
          <ul className="space-y-2">
            {testStatus.suites.map((s, i) => (
              <motion.li
                key={s}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 + i * 0.05 }}
                className="flex items-center gap-2.5 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.05] px-3 py-2.5"
              >
                <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                <span className="text-sm font-medium text-slate-800">
                  {tr(SUITE_LABEL[s] ?? { ar: s, en: s })}
                </span>
                <span className="ms-auto font-mono text-[11px] text-emerald-700">
                  PASS
                </span>
              </motion.li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Prominent disclaimer */}
      <Card className="border border-amber-500/30 bg-amber-500/[0.06] p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-amber-500/15 text-amber-700">
            <ShieldAlert className="size-4" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              {pick("إخلاء مسؤولية عن البيانات", "Data disclaimer")}
            </h3>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-700">
              {pick(DISCLAIMER_AR, DISCLAIMER_EN)}
            </p>
          </div>
        </div>
      </Card>

      <DisclaimerBar />

      {/* Recalibration summary dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={pick("ملخّص إعادة المعايرة", "Recalibration summary")}
        description={
          summary
            ? `${summary.previousVersion} → ${summary.newVersion}`
            : undefined
        }
      >
        {summary && (
          <RecalibrationSummaryBody summary={summary} pick={pick} tr={tr} />
        )}
      </Dialog>
    </div>
  );
}

function OriginalLabel() {
  const { pick } = useI18n();
  return <>{pick("الأصلي", "Original")}</>;
}

function OptimizedLabel() {
  const { pick } = useI18n();
  return <>{pick("المحسّن", "Optimized")}</>;
}

function ComparisonCard({
  title,
  subtitle,
  before,
  after,
  improved,
  deltaLabel,
  improvedGood,
}: {
  title: string;
  subtitle: string;
  before: string;
  after: string;
  improved: boolean;
  deltaLabel: string;
  improvedGood: "up" | "down";
}) {
  const Trend = improvedGood === "down" ? TrendingDown : TrendingUp;
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          <p className="text-xs text-muted">{subtitle}</p>
        </div>
        <span
          className={
            "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold " +
            (improved
              ? "bg-emerald-500/15 text-emerald-700"
              : "bg-rose-500/15 text-rose-700")
          }
        >
          <Trend className="size-3.5" />
          {deltaLabel}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex-1 rounded-xl border border-navy-700/60 bg-navy-900/40 p-3 text-center">
          <p className="text-[11px] text-muted">
            <OriginalLabel />
          </p>
          <p className="mt-1 text-xl font-bold tabular-nums text-slate-500">
            {before}
          </p>
        </div>
        <ArrowRight className="size-5 shrink-0 text-muted rtl:rotate-180" />
        <div
          className={
            "flex-1 rounded-xl border p-3 text-center " +
            (improved
              ? "border-emerald-500/30 bg-emerald-500/[0.06]"
              : "border-rose-500/30 bg-rose-500/[0.06]")
          }
        >
          <p className="text-[11px] text-muted">
            <OptimizedLabel />
          </p>
          <p
            className={
              "mt-1 text-xl font-bold tabular-nums " +
              (improved ? "text-emerald-700" : "text-rose-700")
            }
          >
            {after}
          </p>
        </div>
      </div>
    </Card>
  );
}

function RecalibrationSummaryBody({
  summary,
  pick,
  tr,
}: {
  summary: RecalSummary;
  pick: (ar: string, en: string) => string;
  tr: (v: { ar: string; en: string }) => string;
}) {
  if (!summary.changed) {
    return (
      <div className="rounded-xl border border-sky-500/25 bg-sky-500/[0.05] p-4 text-sm text-slate-700">
        {pick(
          "لا توجد تسميات جديدة كافية لإعادة المعايرة",
          "No new labels to recalibrate on",
        )}
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="muted">{summary.previousVersion}</Badge>
        <ArrowRight className="size-4 text-muted rtl:rotate-180" />
        <Badge variant="coral">{summary.newVersion}</Badge>
        <span className="ms-auto text-xs text-muted">
          {pick("التسميات", "Labels")}: {fmtNumber(summary.labeledCount)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-navy-700/60 bg-navy-900/40 p-3">
          <p className="text-[11px] text-muted">
            {pick("معدل الرفض الخاطئ", "False-positive rate")}
          </p>
          <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-slate-900 tabular-nums">
            <span className="text-slate-500">
              {fmtPercent(summary.before.fpRate, 2)}
            </span>
            <ArrowRight className="size-3.5 text-muted rtl:rotate-180" />
            <span className="text-emerald-700">
              {fmtPercent(summary.after.fpRate, 2)}
            </span>
          </p>
        </div>
        <div className="rounded-xl border border-navy-700/60 bg-navy-900/40 p-3">
          <p className="text-[11px] text-muted">{pick("الاستدعاء", "Recall")}</p>
          <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-slate-900 tabular-nums">
            <span className="text-slate-500">
              {fmtPercent(summary.before.recall, 2)}
            </span>
            <ArrowRight className="size-3.5 text-muted rtl:rotate-180" />
            <span className="text-emerald-700">
              {fmtPercent(summary.after.recall, 2)}
            </span>
          </p>
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-muted">
          {pick("التغييرات المُطبَّقة", "Applied changes")} ({summary.changes.length})
        </p>
        {summary.changes.length === 0 ? (
          <p className="text-xs text-muted">
            {pick("لا تغييرات تفصيلية.", "No detailed changes.")}
          </p>
        ) : (
          <ul className="max-h-56 space-y-1.5 overflow-y-auto pe-1">
            {summary.changes.map((c, i) => (
              <li
                key={i}
                className="rounded-lg border border-navy-700/60 bg-navy-900/40 p-2.5"
              >
                <p className="text-xs font-medium text-slate-800">{tr(c)}</p>
                <p className="mt-1 flex items-center gap-2 font-mono text-[11px] text-muted">
                  <span>{String(c.before)}</span>
                  <ArrowRight className="size-3 rtl:rotate-180" />
                  <span className="text-slate-800">{String(c.after)}</span>
                  {typeof c.deltaPct === "number" && (
                    <span
                      className={
                        "ms-1 " +
                        (c.deltaPct >= 0 ? "text-emerald-700" : "text-rose-700")
                      }
                    >
                      ({c.deltaPct >= 0 ? "+" : ""}
                      {fmtPercent(c.deltaPct, 1)})
                    </span>
                  )}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
