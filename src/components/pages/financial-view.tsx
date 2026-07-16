"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Wallet,
  PiggyBank,
  Headset,
  UserCheck,
  ShieldAlert,
  Server,
  TrendingUp,
  CalendarClock,
  Percent,
  Timer,
  Save,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { KpiCard } from "@/components/shared/kpi-card";
import { PageHeader, DisclaimerBar, SectionTitle } from "@/components/shared/misc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { ChartCard, DonutChart, BarSeries, CHART_COLORS } from "@/components/charts";
import { useI18n, useToast } from "@/providers";
import { fmtCurrency, fmtNumber, fmtPercent, compactCurrency } from "@/lib/format";
import {
  computeFinancials,
  DEFAULT_ASSUMPTIONS,
  type ImpactProfile,
} from "@/lib/financial";
import type { FinancialAssumptions, FinancialResult } from "@/lib/types";
import { saveAssumptionsAction } from "@/app/actions";

interface AssumptionField {
  key: keyof FinancialAssumptions;
  ar: string;
  en: string;
  hintAr: string;
  hintEn: string;
}

const FIELDS: AssumptionField[] = [
  {
    key: "avgRevenuePerTxn",
    ar: "متوسط الإيراد لكل عملية",
    en: "Avg revenue per transaction",
    hintAr: "ريال",
    hintEn: "SAR",
  },
  {
    key: "investigationCost",
    ar: "تكلفة التحقيق اليدوي",
    en: "Manual investigation cost",
    hintAr: "ريال لكل مراجعة",
    hintEn: "SAR per review",
  },
  {
    key: "supportCost",
    ar: "تكلفة دعم الشكوى",
    en: "Support cost per complaint",
    hintAr: "ريال",
    hintEn: "SAR",
  },
  {
    key: "churnCost",
    ar: "تكلفة فقدان العميل",
    en: "Customer churn cost",
    hintAr: "ريال لكل عميل",
    hintEn: "SAR per customer",
  },
  {
    key: "avgFraudLoss",
    ar: "متوسط خسارة الاحتيال",
    en: "Avg fraud loss",
    hintAr: "ريال لكل حادثة",
    hintEn: "SAR per incident",
  },
  {
    key: "monthlyVolume",
    ar: "الحجم الشهري للعمليات",
    en: "Monthly transaction volume",
    hintAr: "عملية",
    hintEn: "transactions",
  },
  {
    key: "platformMonthlyCost",
    ar: "تكلفة المنصة الشهرية",
    en: "Platform monthly cost",
    hintAr: "ريال",
    hintEn: "SAR",
  },
];

export function FinancialView({
  initialAssumptions,
  impact,
}: {
  initialAssumptions: FinancialAssumptions;
  impact: ImpactProfile;
}) {
  const { t, lang, pick } = useI18n();
  const { toast } = useToast();
  const [pending, startTransition] = React.useTransition();

  const [assumptions, setAssumptions] =
    React.useState<FinancialAssumptions>(initialAssumptions);

  // Instant, pure recompute — no server round trip.
  const result: FinancialResult = React.useMemo(
    () => computeFinancials(assumptions, impact),
    [assumptions, impact],
  );

  const setField = (key: keyof FinancialAssumptions, value: number) =>
    setAssumptions((a) => ({ ...a, [key]: value }));

  const save = () => {
    startTransition(async () => {
      await saveAssumptionsAction(assumptions);
      toast({
        kind: "success",
        title: pick("تم حفظ الافتراضات", "Assumptions saved"),
        description: pick(
          `صافي سنوي متوقع ${fmtCurrency(result.netAnnual, "ar")}`,
          `Expected net annual ${fmtCurrency(result.netAnnual, "en")}`,
        ),
      });
    });
  };

  const reset = () => {
    setAssumptions(DEFAULT_ASSUMPTIONS);
    toast({
      kind: "info",
      title: pick("تمت الاستعادة", "Reset to defaults"),
      description: pick(
        "أُعيدت الافتراضات إلى القيم الافتراضية",
        "Assumptions restored to defaults",
      ),
    });
  };

  const paybackLabel = Number.isFinite(result.paybackMonths)
    ? `${result.paybackMonths.toFixed(1)} ${pick("شهر", "mo")}`
    : pick("غير محقق", "N/A");
  const paybackNum = Number.isFinite(result.paybackMonths)
    ? result.paybackMonths.toFixed(1)
    : "—";

  // Value component breakdown (positive contributors).
  const breakdown = [
    { name: pick("إيرادات مستردة", "Revenue recovered"), value: result.revenueRecovered, color: CHART_COLORS.emerald },
    { name: pick("توفير المراجعة", "Review savings"), value: result.manualReviewSavings, color: CHART_COLORS.sky },
    { name: pick("توفير الدعم", "Support savings"), value: result.supportSavings, color: CHART_COLORS.violet },
    { name: pick("قيمة الاحتفاظ", "Retention value"), value: result.retentionValue, color: CHART_COLORS.coral },
  ];

  const scenarios = [
    { label: pick("متحفّظ", "Conservative"), value: result.scenarios.conservative },
    { label: pick("متوقّع", "Expected"), value: result.scenarios.expected },
    { label: pick("متفائل", "Optimistic"), value: result.scenarios.optimistic },
  ];

  const execAr = `بناءً على الافتراضات الحالية، يُتوقع أن تحقق «ZeRisk» ${fmtNumber(result.netAnnual)} ريال قيمة صافية سنوية مع فترة استرداد قدرها ${paybackNum} شهرًا.`;
  const execEn = `Based on the current assumptions, ZeRisk is expected to deliver ${fmtCurrency(result.netAnnual, "en")} in net annual value with a payback period of ${paybackNum} months.`;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("page.financial.title")}
        subtitle={t("page.financial.subtitle")}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={reset}>
              <RotateCcw className="size-4" />
              {pick("استعادة الافتراضي", "Reset to defaults")}
            </Button>
            <Button size="sm" onClick={save} disabled={pending}>
              <Save className="size-4" />
              {pick("حفظ الافتراضات", "Save assumptions")}
            </Button>
          </div>
        }
      />

      {/* Executive statement */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="surface relative overflow-hidden rounded-2xl p-6"
      >
        <div className="absolute -end-10 -top-10 size-40 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl grad-coral">
            <Sparkles className="size-5 text-white" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-coral-600">
              {pick("الملخص التنفيذي المالي", "Financial Executive Summary")}
            </h2>
            <p className="mt-1 max-w-4xl text-sm leading-relaxed text-slate-700">
              {pick(execAr, execEn)}
            </p>
          </div>
        </div>
      </motion.div>

      <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
        {/* ---- Assumption inputs ---- */}
        <Card className="h-fit p-5">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-slate-900">
              {pick("الافتراضات المالية", "Financial assumptions")}
            </h3>
            <p className="text-xs text-muted">
              {pick("عدّل أي قيمة لإعادة الحساب فورًا", "Edit any value to recompute instantly")}
            </p>
          </div>
          <div className="space-y-3.5">
            {FIELDS.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <Label htmlFor={f.key}>{pick(f.ar, f.en)}</Label>
                <div className="relative">
                  <Input
                    id={f.key}
                    type="number"
                    min={0}
                    value={assumptions[f.key]}
                    onChange={(e) => setField(f.key, Number(e.target.value))}
                    className="pe-16"
                  />
                  <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-[11px] text-muted">
                    {pick(f.hintAr, f.hintEn)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* ---- Results ---- */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <KpiCard label={pick("إيرادات مستردة", "Revenue recovered")} value={compactCurrency(result.revenueRecovered, lang)} Icon={Wallet} accent="emerald" delay={0.02} sub={pick("شهريًا", "monthly")} />
            <KpiCard label={pick("توفير المراجعة اليدوية", "Manual review savings")} value={compactCurrency(result.manualReviewSavings, lang)} Icon={PiggyBank} accent="sky" delay={0.04} />
            <KpiCard label={pick("توفير الدعم", "Support savings")} value={compactCurrency(result.supportSavings, lang)} Icon={Headset} accent="violet" delay={0.06} />
            <KpiCard label={pick("قيمة الاحتفاظ بالعملاء", "Customer retention value")} value={compactCurrency(result.retentionValue, lang)} Icon={UserCheck} accent="coral" delay={0.08} />
            <KpiCard label={pick("تعرض للاحتيال", "Fraud exposure")} value={compactCurrency(result.fraudExposure, lang)} Icon={ShieldAlert} accent="rose" delay={0.1} />
            <KpiCard label={pick("تكلفة المنصة", "Platform cost")} value={compactCurrency(result.platformCost, lang)} Icon={Server} accent="amber" delay={0.12} />
            <KpiCard label={pick("صافي شهري", "Net monthly")} value={compactCurrency(result.netMonthly, lang)} Icon={TrendingUp} accent={result.netMonthly >= 0 ? "emerald" : "rose"} delay={0.14} />
            <KpiCard label={pick("صافي سنوي", "Net annual")} value={compactCurrency(result.netAnnual, lang)} Icon={CalendarClock} accent={result.netAnnual >= 0 ? "emerald" : "rose"} delay={0.16} />
            <KpiCard label={pick("العائد الشهري", "Monthly ROI")} value={fmtPercent(result.monthlyRoi, 0)} Icon={Percent} accent="emerald" delay={0.18} />
            <KpiCard label={pick("العائد السنوي", "Annual ROI")} value={fmtPercent(result.annualRoi, 0)} Icon={Percent} accent="emerald" delay={0.2} />
            <KpiCard label={pick("فترة الاسترداد", "Payback period")} value={paybackLabel} Icon={Timer} accent="sky" delay={0.22} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard
              title={pick("مكوّنات القيمة الشهرية", "Monthly value components")}
              subtitle={pick("المساهمات الإيجابية", "Positive contributors")}
            >
              <DonutChart data={breakdown} />
            </ChartCard>

            <ChartCard
              title={pick("سيناريوهات القيمة السنوية", "Annual value scenarios")}
              subtitle={pick("متحفّظ · متوقّع · متفائل", "Conservative · Expected · Optimistic")}
            >
              <BarSeries
                data={scenarios}
                series={[
                  { key: "value", name: pick("صافي سنوي", "Net annual"), color: CHART_COLORS.emerald },
                ]}
              />
            </ChartCard>
          </div>

          <Card className="p-5">
            <SectionTitle>{pick("ملخص السيناريوهات", "Scenario summary")}</SectionTitle>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <ScenarioCard
                title={pick("متحفّظ", "Conservative")}
                value={fmtCurrency(result.scenarios.conservative, lang)}
                accent="border-slate-500/25 bg-slate-500/5"
              />
              <ScenarioCard
                title={pick("متوقّع", "Expected")}
                value={fmtCurrency(result.scenarios.expected, lang)}
                accent="border-emerald-500/30 bg-emerald-500/5"
              />
              <ScenarioCard
                title={pick("متفائل", "Optimistic")}
                value={fmtCurrency(result.scenarios.optimistic, lang)}
                accent="border-coral-500/30 bg-coral-500/5"
              />
            </div>
          </Card>
        </div>
      </div>

      <DisclaimerBar />
    </div>
  );
}

function ScenarioCard({
  title,
  value,
  accent,
}: {
  title: string;
  value: string;
  accent: string;
}) {
  return (
    <div className={`rounded-xl border p-4 ${accent}`}>
      <p className="text-xs text-muted">{title}</p>
      <p className="mt-1.5 text-xl font-bold text-slate-900 tabular-nums">{value}</p>
    </div>
  );
}
