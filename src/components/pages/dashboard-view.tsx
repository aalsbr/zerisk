"use client";

import { motion } from "framer-motion";
import {
  Layers,
  CheckCircle2,
  XCircle,
  Search,
  ShieldAlert,
  Percent,
  ShieldCheck,
  Wallet,
  PiggyBank,
  Smile,
  Target,
  Timer,
  Sparkles,
} from "lucide-react";
import { KpiCard } from "@/components/shared/kpi-card";
import { PageHeader, DisclaimerBar } from "@/components/shared/misc";
import { Button } from "@/components/ui/button";
import {
  ChartCard,
  LineSeries,
  AreaSeries,
  BarSeries,
  DonutChart,
  CHART_COLORS,
} from "@/components/charts";
import { useI18n } from "@/providers";
import { DECISION_LABEL } from "@/lib/i18n";
import { fmtNumber, compactCurrency, fmtPercent } from "@/lib/format";
import { Download } from "lucide-react";

interface DashboardData {
  kpi: Record<string, number>;
  fpTrend: { label: string; before: number; after: number }[];
  decisionCompare: { label: string; original: number; ai: number }[];
  riskLevels: { name: string; value: number }[];
  fraudByMonth: { label: string; value: number }[];
  revenueByMonth: { label: string; value: number }[];
  reviewReduction: { label: string; value: number }[];
  frictionTrend: { label: string; value: number }[];
  topRules: { label: string; value: number }[];
}

export function DashboardView({ data }: { data: DashboardData }) {
  const { t, lang, tr } = useI18n();
  const k = data.kpi;

  const riskColors: Record<string, string> = {
    low: CHART_COLORS.emerald,
    medium: CHART_COLORS.sky,
    high: CHART_COLORS.amber,
    critical: CHART_COLORS.rose,
  };
  const riskNames: Record<string, { ar: string; en: string }> = {
    low: { ar: "منخفضة", en: "Low" },
    medium: { ar: "متوسطة", en: "Medium" },
    high: { ar: "عالية", en: "High" },
    critical: { ar: "حرجة", en: "Critical" },
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("page.dashboard.title")}
        subtitle={t("page.dashboard.subtitle")}
        actions={
          <Button variant="secondary" size="sm">
            <Download className="size-4" />
            {t("common.export")}
          </Button>
        }
      />

      {/* Executive summary */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="surface relative overflow-hidden rounded-2xl p-6"
      >
        <div className="absolute -end-10 -top-10 size-40 rounded-full bg-coral-500/10 blur-3xl" />
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl grad-coral">
            <Sparkles className="size-5 text-white" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-coral-600">
              {lang === "ar" ? "الملخص التنفيذي" : "Executive Summary"}
            </h2>
            <p className="mt-1 max-w-4xl text-sm leading-relaxed text-slate-700">
              {t("demo.summary")}
            </p>
          </div>
        </div>
      </motion.div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        <KpiCard label={t("kpi.total")} value={fmtNumber(k.total)} Icon={Layers} accent="sky" delay={0.02} sub={lang === "ar" ? "خلال ٣٠ يومًا" : "last 30 days"} />
        <KpiCard label={t("kpi.approved")} value={fmtNumber(k.approved)} Icon={CheckCircle2} accent="emerald" delay={0.04} />
        <KpiCard label={t("kpi.rejected")} value={fmtNumber(k.rejected)} Icon={XCircle} accent="rose" delay={0.06} sub={`${lang === "ar" ? "قبل" : "before"}: ${fmtNumber(k.rejectedBefore)}`} />
        <KpiCard label={t("kpi.review")} value={fmtNumber(k.review)} Icon={Search} accent="amber" delay={0.08} />
        <KpiCard label={t("kpi.fpDetected")} value={fmtNumber(k.fpDetected)} Icon={ShieldAlert} accent="coral" delay={0.1} />
        <KpiCard label={t("kpi.fpRate")} value={fmtPercent(k.fpRateAfter, 2)} Icon={Percent} accent="emerald" delay={0.12} trend={`${(k.fpRateBefore - k.fpRateAfter).toFixed(2)}pt`} trendPositive sub={`${lang === "ar" ? "قبل" : "before"} ${fmtPercent(k.fpRateBefore, 2)}`} />
        <KpiCard label={t("kpi.fraudPrevented")} value={compactCurrency(k.fraudPrevented, lang)} Icon={ShieldCheck} accent="violet" delay={0.14} />
        <KpiCard label={t("kpi.revenueRecovered")} value={compactCurrency(k.revenueRecovered, lang)} Icon={Wallet} accent="emerald" delay={0.16} sub={`${fmtNumber(k.recovered)} ${lang === "ar" ? "عملية" : "txns"}`} />
        <KpiCard label={t("kpi.costSaved")} value={compactCurrency(k.costSaved, lang)} Icon={PiggyBank} accent="sky" delay={0.18} />
        <KpiCard label={t("kpi.friction")} value={`-${k.frictionReduction}%`} Icon={Smile} accent="emerald" delay={0.2} trend={`${k.frictionReduction}%`} trendPositive />
        <KpiCard label={t("kpi.accuracy")} value={fmtPercent(k.accuracy)} Icon={Target} accent="coral" delay={0.22} />
        <KpiCard label={t("kpi.decisionTime")} value={`${k.decisionTime} ms`} Icon={Timer} accent="sky" delay={0.24} />
      </div>

      {/* Charts row 1 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title={lang === "ar" ? "معدل الرفض الخاطئ: قبل وبعد التحسين" : "False Positive Rate: Before vs After"}
          subtitle={lang === "ar" ? "نسبة مئوية شهرية" : "Monthly %"}
        >
          <LineSeries
            data={data.fpTrend}
            series={[
              { key: "before", name: lang === "ar" ? "قبل" : "Before", color: CHART_COLORS.rose },
              { key: "after", name: lang === "ar" ? "بعد" : "After", color: CHART_COLORS.emerald },
            ]}
          />
        </ChartCard>

        <ChartCard
          title={lang === "ar" ? "القرار الأصلي مقابل توصية الذكاء الاصطناعي" : "Original Decision vs AI Recommendation"}
          subtitle={lang === "ar" ? "عيّنة العمليات الحية" : "Live transaction sample"}
        >
          <BarSeries
            data={data.decisionCompare.map((d) => ({ ...d, label: tr(DECISION_LABEL[d.label as keyof typeof DECISION_LABEL]) }))}
            series={[
              { key: "original", name: t("common.original"), color: CHART_COLORS.slate },
              { key: "ai", name: t("common.aiReco"), color: CHART_COLORS.coral },
            ]}
          />
        </ChartCard>
      </div>

      {/* Charts row 2 */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title={lang === "ar" ? "العمليات حسب مستوى المخاطر" : "Transactions by Risk Level"}>
          <DonutChart
            data={data.riskLevels.map((r) => ({
              name: tr(riskNames[r.name]),
              value: r.value,
              color: riskColors[r.name],
            }))}
          />
        </ChartCard>
        <ChartCard
          title={lang === "ar" ? "الاحتيال الممنوع شهريًا" : "Fraud Loss Prevented by Month"}
          subtitle={lang === "ar" ? "بالريال" : "SAR"}
        >
          <AreaSeries data={data.fraudByMonth} series={[{ key: "value", name: t("kpi.fraudPrevented"), color: CHART_COLORS.violet }]} />
        </ChartCard>
        <ChartCard
          title={lang === "ar" ? "الإيرادات المستردة شهريًا" : "Revenue Recovered by Month"}
          subtitle={lang === "ar" ? "بالريال" : "SAR"}
        >
          <AreaSeries data={data.revenueByMonth} series={[{ key: "value", name: t("kpi.revenueRecovered"), color: CHART_COLORS.emerald }]} />
        </ChartCard>
      </div>

      {/* Charts row 3 */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard
          title={lang === "ar" ? "انخفاض حجم المراجعة اليدوية" : "Manual Review Volume Reduction"}
        >
          <AreaSeries data={data.reviewReduction} series={[{ key: "value", name: t("nav.investigations"), color: CHART_COLORS.sky }]} />
        </ChartCard>
        <ChartCard
          title={lang === "ar" ? "القواعد الأعلى تسببًا في الرفض الخاطئ" : "Top Rules Causing False Positives"}
        >
          <BarSeries
            data={data.topRules}
            vertical
            series={[{ key: "value", name: t("kpi.fpDetected"), color: CHART_COLORS.coral }]}
          />
        </ChartCard>
        <ChartCard
          title={lang === "ar" ? "اتجاه احتكاك العميل" : "Customer Friction Trend"}
          subtitle={lang === "ar" ? "مؤشر ٠-١٠٠" : "Index 0-100"}
        >
          <LineSeries data={data.frictionTrend} series={[{ key: "value", name: t("kpi.friction"), color: CHART_COLORS.amber }]} />
        </ChartCard>
      </div>

      <DisclaimerBar />
    </div>
  );
}
