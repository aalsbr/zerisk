"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Layers,
  ShieldAlert,
  ShieldCheck,
  Wallet,
  PiggyBank,
  Smile,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  ShieldQuestion,
  Play,
  Save,
  Sparkles,
} from "lucide-react";
import { KpiCard } from "@/components/shared/kpi-card";
import { PageHeader, DisclaimerBar, SectionTitle, Stat } from "@/components/shared/misc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ChartCard, BarSeries, CHART_COLORS } from "@/components/charts";
import { useI18n, useToast } from "@/providers";
import { DECISION_LABEL, SEGMENT_LABEL } from "@/lib/i18n";
import { fmtCurrency, fmtNumber, fmtPercent, compactCurrency } from "@/lib/format";
import {
  defaultConfig,
  runSimulation,
  type SimulationConfig,
  type SimulationOutput,
} from "@/lib/simulation";
import type {
  CustomerSegment,
  Decision,
  EnrichedTransaction,
  FraudRule,
} from "@/lib/types";
import { saveSimulationAction } from "@/app/actions";

// Slim serializable transaction (only fields runSimulation reads).
export interface SlimTxn {
  id: string;
  amount: number;
  triggeredRuleIds: string[];
  customer: { segment: CustomerSegment };
  isActuallyFraud: boolean;
  isFalsePositive: boolean;
  ai: { optimizedRiskScore: number };
}

const DECISIONS: Decision[] = ["APPROVE", "REVIEW", "REJECT", "MONITOR"];
const SEGMENTS: (CustomerSegment | "ALL")[] = [
  "ALL",
  "RETAIL",
  "SME",
  "PREMIUM",
  "NEW_CUSTOMER",
  "LONG_TERM_CUSTOMER",
  "HIGH_VALUE_CUSTOMER",
];

export function SimulationView({
  rules,
  transactions,
  preselectRuleId,
}: {
  rules: FraudRule[];
  transactions: SlimTxn[];
  preselectRuleId?: string;
}) {
  const { t, lang, pick, tr } = useI18n();
  const { toast } = useToast();
  const [pending, startTransition] = React.useTransition();

  // Rules that actually appear on transactions get priority; fall back to all.
  const initialRule =
    rules.find((r) => r.id === preselectRuleId) ?? rules[0];

  const [ruleId, setRuleId] = React.useState<string>(initialRule.id);

  const [config, setConfig] = React.useState<SimulationConfig>(() =>
    defaultConfig(initialRule),
  );

  // Changing the rule resets the whole config from its defaults.
  const onSelectRule = (id: string) => {
    setRuleId(id);
    const r = rules.find((x) => x.id === id);
    if (r) setConfig(defaultConfig(r));
  };

  const patch = (p: Partial<SimulationConfig>) =>
    setConfig((c) => ({ ...c, ...p }));

  // runSimulation only reads the slim fields; cast is safe.
  const txns = transactions as unknown as EnrichedTransaction[];

  // Live recompute (derived state) — always reflects the current config.
  const result = React.useMemo<SimulationOutput>(
    () => runSimulation(config, txns),
    [config, txns],
  );

  const run = () =>
    toast({
      kind: "info",
      title: pick("تم تشغيل المحاكاة", "Simulation run"),
      description: pick("النتائج محدّثة أدناه", "Results updated below"),
    });

  const save = () => {
    startTransition(async () => {
      await saveSimulationAction(config.ruleId, result.netBenefit, result.verdict);
      toast({
        kind: "success",
        title: pick("تم حفظ المحاكاة", "Simulation saved"),
        description: pick(
          `القاعدة ${config.ruleId} • صافي المنفعة ${fmtCurrency(result.netBenefit, "ar")}`,
          `Rule ${config.ruleId} • net benefit ${fmtCurrency(result.netBenefit, "en")}`,
        ),
      });
    });
  };

  const ruleOptions = rules.map((r) => ({
    value: r.id,
    label: `${r.id} — ${pick(r.name, r.nameEn)}`,
  }));

  const verdictMeta: Record<
    SimulationOutput["verdict"],
    { ar: string; en: string; badge: "success" | "warning" | "danger"; ring: string; Icon: typeof CheckCircle2 }
  > = {
    RECOMMENDED: {
      ar: "موصى به",
      en: "Recommended",
      badge: "success",
      ring: "border-emerald-500/30 bg-emerald-500/5",
      Icon: CheckCircle2,
    },
    RECOMMENDED_WITH_SAFEGUARDS: {
      ar: "موصى به مع ضوابط",
      en: "Recommended with safeguards",
      badge: "warning",
      ring: "border-amber-500/30 bg-amber-500/5",
      Icon: AlertTriangle,
    },
    NOT_RECOMMENDED: {
      ar: "غير موصى به",
      en: "Not recommended",
      badge: "danger",
      ring: "border-rose-500/30 bg-rose-500/5",
      Icon: ShieldQuestion,
    },
  };
  const v = verdictMeta[result.verdict];

  const beforeAfter = [
    {
      label: pick("رفض خاطئ", "False positives"),
      before: result.fpBefore,
      after: result.fpAfter,
    },
    {
      label: pick("احتيال مؤكد", "Confirmed fraud"),
      before: result.fraudBefore,
      after: result.fraudAfter,
    },
  ];

  // Bilingual impact sentence.
  const recovered = Math.max(
    0,
    Math.round((result.fpBefore - result.fpAfter)),
  );
  const impactAr = `سيؤدي تطبيق هذا التغيير على البيانات التاريخية إلى استرداد ${fmtNumber(recovered)} عملية سليمة، وخفض المراجعات اليدوية بنسبة ${result.frictionReduction}٪، وتحقيق صافي منفعة يقدر بـ ${fmtNumber(result.netBenefit)} ريال، مقابل تعرض إضافي للاحتيال يقدر بـ ${fmtNumber(result.fraudExposure)} ريال.`;
  const impactEn = `Applying this change to the historical data would recover ${fmtNumber(recovered)} legitimate transactions, cut manual reviews by ${result.frictionReduction}%, and deliver an estimated net benefit of ${fmtCurrency(result.netBenefit, "en")} against an additional fraud exposure of ${fmtCurrency(result.fraudExposure, "en")}.`;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("page.simulation.title")}
        subtitle={t("page.simulation.subtitle")}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={save} disabled={pending}>
              <Save className="size-4" />
              {pick("حفظ المحاكاة", "Save simulation")}
            </Button>
            <Button size="sm" onClick={run}>
              <Play className="size-4" />
              {pick("تشغيل المحاكاة", "Run simulation")}
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
        {/* ---- Controls ---- */}
        <Card className="h-fit p-5">
          <div className="mb-4 flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-xl grad-coral">
              <Sparkles className="size-4 text-white" />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                {pick("إعدادات السيناريو", "Scenario configuration")}
              </h3>
              <p className="text-xs text-muted">
                {pick("عدّل القيم لرؤية الأثر فورًا", "Adjust values to see impact instantly")}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <Field label={pick("القاعدة", "Rule")}>
              <Select
                options={ruleOptions}
                value={ruleId}
                onChange={(e) => onSelectRule(e.target.value)}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label={pick("الحد الحالي", "Current threshold")}>
                <Input
                  type="number"
                  value={config.currentThreshold}
                  readOnly
                  className="opacity-70"
                />
              </Field>
              <Field label={pick("الحد المقترح", "Proposed threshold")}>
                <Input
                  type="number"
                  value={config.proposedThreshold}
                  min={0}
                  onChange={(e) => patch({ proposedThreshold: Number(e.target.value) })}
                />
              </Field>
            </div>
            <input
              type="range"
              min={0}
              max={Math.max(config.currentThreshold * 4, 50000)}
              step={500}
              value={config.proposedThreshold}
              onChange={(e) => patch({ proposedThreshold: Number(e.target.value) })}
              className="w-full accent-coral-500"
            />

            <div className="grid grid-cols-2 gap-3">
              <Field label={pick("الوزن الحالي", "Current weight")}>
                <Input type="number" value={config.currentWeight} readOnly className="opacity-70" />
              </Field>
              <Field label={pick("الوزن المقترح", "Proposed weight")}>
                <Input
                  type="number"
                  value={config.proposedWeight}
                  min={0}
                  max={100}
                  onChange={(e) => patch({ proposedWeight: Number(e.target.value) })}
                />
              </Field>
            </div>
            <input
              type="range"
              min={0}
              max={Math.max(config.currentWeight * 2, 40)}
              step={1}
              value={config.proposedWeight}
              onChange={(e) => patch({ proposedWeight: Number(e.target.value) })}
              className="w-full accent-coral-500"
            />

            <div className="grid grid-cols-2 gap-3">
              <Field label={pick("الإجراء الحالي", "Current action")}>
                <Input
                  value={tr(DECISION_LABEL[config.currentAction])}
                  readOnly
                  className="opacity-70"
                />
              </Field>
              <Field label={pick("الإجراء المقترح", "Proposed action")}>
                <Select
                  options={DECISIONS.map((d) => ({
                    value: d,
                    label: tr(DECISION_LABEL[d]),
                  }))}
                  value={config.proposedAction}
                  onChange={(e) => patch({ proposedAction: e.target.value as Decision })}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label={pick("شريحة العميل", "Customer segment")}>
                <Select
                  options={SEGMENTS.map((s) => ({
                    value: s,
                    label:
                      s === "ALL"
                        ? pick("الكل", "All")
                        : tr(SEGMENT_LABEL[s]),
                  }))}
                  value={config.segment}
                  onChange={(e) =>
                    patch({ segment: e.target.value as CustomerSegment | "ALL" })
                  }
                />
              </Field>
              <Field label={pick("الفترة الزمنية", "Time period")}>
                <Select
                  options={[30, 60, 90].map((d) => ({
                    value: String(d),
                    label: pick(`${d} يوم`, `${d} days`),
                  }))}
                  value={String(config.periodDays)}
                  onChange={(e) => patch({ periodDays: Number(e.target.value) })}
                />
              </Field>
            </div>
          </div>
        </Card>

        {/* ---- Results ---- */}
        <div className="space-y-4">
          {/* Verdict banner */}
          <motion.div
            key={result.verdict}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`surface flex items-start gap-3 rounded-2xl border p-5 ${v.ring}`}
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/5">
              <v.Icon className="size-5 text-slate-900" />
            </span>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-slate-900">
                  {pick("توصية الذكاء الاصطناعي", "AI recommendation")}
                </span>
                <Badge variant={v.badge}>{pick(v.ar, v.en)}</Badge>
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-700">
                {pick(impactAr, impactEn)}
              </p>
            </div>
          </motion.div>

          {/* KPI grid */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <KpiCard
              label={pick("عمليات متأثرة", "Transactions affected")}
              value={fmtNumber(result.transactionsAffected)}
              Icon={Layers}
              accent="sky"
              delay={0.02}
            />
            <KpiCard
              label={pick("رفض خاطئ (قبل ← بعد)", "False positives (before → after)")}
              value={`${fmtNumber(result.fpBefore)} → ${fmtNumber(result.fpAfter)}`}
              Icon={ShieldAlert}
              accent="coral"
              delay={0.04}
            />
            <KpiCard
              label={pick("احتيال مؤكد (قبل ← بعد)", "Confirmed fraud (before → after)")}
              value={`${fmtNumber(result.fraudBefore)} → ${fmtNumber(result.fraudAfter)}`}
              Icon={ShieldCheck}
              accent="violet"
              delay={0.06}
            />
            <KpiCard
              label={pick("احتيال محتمل مفقود", "Potential missed fraud")}
              value={fmtNumber(result.missedFraud)}
              Icon={AlertTriangle}
              accent={result.missedFraud > 0 ? "rose" : "emerald"}
              delay={0.08}
            />
            <KpiCard
              label={pick("تحسّن معدل القبول", "Approval rate improvement")}
              value={`+${fmtPercent(result.approvalRateImprovement, 2)}`}
              Icon={TrendingUp}
              accent="emerald"
              delay={0.1}
              sub={pick("نقطة مئوية", "pp")}
            />
            <KpiCard
              label={pick("إيرادات مستردة", "Revenue recovered")}
              value={compactCurrency(result.revenueRecovered, lang)}
              Icon={Wallet}
              accent="emerald"
              delay={0.12}
            />
            <KpiCard
              label={pick("تكلفة تحقيق موفّرة", "Investigation cost saved")}
              value={compactCurrency(result.investigationSaved, lang)}
              Icon={PiggyBank}
              accent="sky"
              delay={0.14}
            />
            <KpiCard
              label={pick("خفض احتكاك العميل", "Customer friction reduction")}
              value={`-${fmtPercent(result.frictionReduction, 1)}`}
              Icon={Smile}
              accent="emerald"
              delay={0.16}
              trend={fmtPercent(result.frictionReduction, 1)}
              trendPositive
            />
            <KpiCard
              label={pick("صافي المنفعة المالية", "Net financial benefit")}
              value={compactCurrency(result.netBenefit, lang)}
              Icon={TrendingUp}
              accent={result.netBenefit >= 0 ? "emerald" : "rose"}
              delay={0.18}
            />
            <KpiCard
              label={pick("تعرض إضافي للاحتيال", "Additional fraud exposure")}
              value={compactCurrency(result.fraudExposure, lang)}
              Icon={ShieldAlert}
              accent={result.fraudExposure > 0 ? "rose" : "emerald"}
              delay={0.2}
            />
          </div>

          {/* Before/after chart */}
          <ChartCard
            title={pick("مقارنة قبل / بعد", "Before / After comparison")}
            subtitle={pick(
              "الرفض الخاطئ والاحتيال المؤكد على المقياس الشهري",
              "False positives & confirmed fraud at monthly scale",
            )}
          >
            <BarSeries
              data={beforeAfter}
              series={[
                { key: "before", name: pick("قبل", "Before"), color: CHART_COLORS.slate },
                { key: "after", name: pick("بعد", "After"), color: CHART_COLORS.coral },
              ]}
            />
          </ChartCard>

          {/* Detail stats */}
          <Card className="p-5">
            <SectionTitle>{pick("تفاصيل الأثر", "Impact detail")}</SectionTitle>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat
                label={pick("رفض خاطئ قبل", "FP before")}
                value={fmtNumber(result.fpBefore)}
              />
              <Stat
                label={pick("رفض خاطئ بعد", "FP after")}
                value={fmtNumber(result.fpAfter)}
              />
              <Stat
                label={pick("احتيال قبل", "Fraud before")}
                value={fmtNumber(result.fraudBefore)}
              />
              <Stat
                label={pick("احتيال بعد", "Fraud after")}
                value={fmtNumber(result.fraudAfter)}
              />
              <Stat
                label={pick("إيرادات مستردة", "Revenue recovered")}
                value={fmtCurrency(result.revenueRecovered, lang)}
              />
              <Stat
                label={pick("تكلفة موفّرة", "Cost saved")}
                value={fmtCurrency(result.investigationSaved, lang)}
              />
              <Stat
                label={pick("صافي المنفعة", "Net benefit")}
                value={fmtCurrency(result.netBenefit, lang)}
              />
              <Stat
                label={pick("تعرض للاحتيال", "Fraud exposure")}
                value={fmtCurrency(result.fraudExposure, lang)}
              />
            </div>
          </Card>
        </div>
      </div>

      <DisclaimerBar />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
