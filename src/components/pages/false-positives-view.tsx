"use client";

import {
  Percent,
  Ban,
  Wallet,
  RotateCcw,
  AlertTriangle,
  Download,
  ShieldAlert,
} from "lucide-react";
import { KpiCard } from "@/components/shared/kpi-card";
import { PageHeader, DisclaimerBar, SectionTitle } from "@/components/shared/misc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import {
  ChartCard,
  BarSeries,
  DonutChart,
  ParetoChart,
  CHART_COLORS,
} from "@/components/charts";
import { useI18n, useToast } from "@/providers";
import { CHANNEL_LABEL, SEGMENT_LABEL, RULE_RECO_LABEL } from "@/lib/i18n";
import { fmtNumber, fmtPercent, fmtCurrency, compactCurrency } from "@/lib/format";
import type {
  BeneficiaryType,
  Decision,
  RuleRecommendationKey,
  RuleSeverity,
} from "@/lib/types";

interface Breakdown {
  label: string;
  value: number;
}
interface RuleRow {
  id: string;
  nameAr: string;
  nameEn: string;
  severity: RuleSeverity;
  action: Decision;
  triggerCount: number;
  confirmedFraud: number;
  falsePositives: number;
  precision: number;
  falsePositiveRate: number;
  financialImpact: number;
  recommendationKey: RuleRecommendationKey;
}
interface FpData {
  kpi: {
    fpRateAfter: number;
    fpRateBefore: number;
    estimatedFalsePositives: number;
    fpAmountValue: number;
    revenueRecovered: number;
    recoveredTransactions: number;
    originalRejected: number;
  };
  breakdowns: {
    byChannel: Breakdown[];
    bySegment: Breakdown[];
    byDevice: Breakdown[];
    byBeneficiary: Breakdown[];
    byHour: Breakdown[];
    byAmount: Breakdown[];
  };
  ruleStats: RuleRow[];
}

const BENEFICIARY_LABEL: Record<BeneficiaryType, { ar: string; en: string }> = {
  INTERNAL: { ar: "داخلي", en: "Internal" },
  EXTERNAL: { ar: "خارجي", en: "External" },
  INTERNATIONAL: { ar: "دولي", en: "International" },
  WALLET: { ar: "محفظة", en: "Wallet" },
};

const DEVICE_LABEL: Record<string, { ar: string; en: string }> = {
  KNOWN: { ar: "جهاز موثوق", en: "Known device" },
  NEW: { ar: "جهاز جديد", en: "New device" },
};

// Rows whose FP rate is above this are highlighted as poorly performing.
const POOR_FP_RATE = 45;

export function FalsePositivesView({ data }: { data: FpData }) {
  const { t, lang, tr } = useI18n();
  const { toast } = useToast();
  const k = data.kpi;

  const mapLabels = (
    rows: Breakdown[],
    map: Record<string, { ar: string; en: string }>,
  ) => rows.map((r) => ({ label: map[r.label] ? tr(map[r.label]) : r.label, value: r.value }));

  const channelData = mapLabels(data.breakdowns.byChannel, CHANNEL_LABEL);
  const segmentData = mapLabels(data.breakdowns.bySegment, SEGMENT_LABEL);
  const beneficiaryData = mapLabels(data.breakdowns.byBeneficiary, BENEFICIARY_LABEL);
  const deviceDonut = data.breakdowns.byDevice.map((r) => ({
    name: DEVICE_LABEL[r.label] ? tr(DEVICE_LABEL[r.label]) : r.label,
    value: r.value,
    color: r.label === "KNOWN" ? CHART_COLORS.emerald : CHART_COLORS.rose,
  }));
  const hourData = data.breakdowns.byHour;
  const amountData = data.breakdowns.byAmount;

  // Pareto over top rules by false positives (already sorted desc; take meaningful ones).
  const paretoData = data.ruleStats
    .filter((r) => r.falsePositives > 0)
    .slice(0, 8)
    .map((r) => ({ label: r.id, falsePositives: r.falsePositives }));

  const exportReport = () =>
    toast({
      kind: "info",
      title: lang === "ar" ? "تم تجهيز التقرير" : "Report ready",
      description:
        lang === "ar"
          ? "تم تجهيز تقرير تحليلات الرفض الخاطئ للتصدير."
          : "The false-positive analytics report has been prepared for export.",
    });

  const fpProbReduction = (k.fpRateBefore - k.fpRateAfter).toFixed(2);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("page.fp.title")}
        subtitle={t("page.fp.subtitle")}
        actions={
          <Button variant="secondary" size="sm" onClick={exportReport}>
            <Download className="size-4" />
            {t("common.exportReport")}
          </Button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          label={t("kpi.fpRate")}
          value={fmtPercent(k.fpRateAfter, 2)}
          Icon={Percent}
          accent="emerald"
          delay={0.02}
          trend={`${fpProbReduction}pt`}
          trendPositive
          sub={`${lang === "ar" ? "قبل" : "before"} ${fmtPercent(k.fpRateBefore, 2)}`}
        />
        <KpiCard
          label={lang === "ar" ? "عمليات سليمة مرفوضة بالخطأ" : "Legit txns wrongly rejected"}
          value={fmtNumber(k.estimatedFalsePositives)}
          Icon={Ban}
          accent="rose"
          delay={0.04}
          sub={`${lang === "ar" ? "من أصل" : "of"} ${fmtNumber(k.originalRejected)} ${lang === "ar" ? "مرفوضة" : "rejected"}`}
        />
        <KpiCard
          label={lang === "ar" ? "القيمة المالية للرفض الخاطئ" : "Value of false declines"}
          value={compactCurrency(k.fpAmountValue, lang)}
          Icon={Wallet}
          accent="amber"
          delay={0.06}
          sub={lang === "ar" ? "قيمة العمليات المتأثرة" : "affected transaction value"}
        />
        <KpiCard
          label={t("common.recovered")}
          value={fmtNumber(k.recoveredTransactions)}
          Icon={RotateCcw}
          accent="emerald"
          delay={0.08}
          sub={compactCurrency(k.revenueRecovered, lang)}
        />
      </div>

      {/* Breakdown charts */}
      <div>
        <SectionTitle>
          {lang === "ar" ? "توزيع الرفض الخاطئ" : "False Positive Breakdown"}
        </SectionTitle>
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard
            title={lang === "ar" ? "الرفض الخاطئ حسب القناة" : "False Positives by Channel"}
            subtitle={lang === "ar" ? "تقدير شهري" : "monthly estimate"}
          >
            <BarSeries
              data={channelData}
              series={[
                {
                  key: "value",
                  name: t("kpi.fpDetected"),
                  color: CHART_COLORS.coral,
                },
              ]}
            />
          </ChartCard>

          <ChartCard
            title={lang === "ar" ? "الرفض الخاطئ حسب شريحة العميل" : "False Positives by Customer Segment"}
          >
            <BarSeries
              data={segmentData}
              series={[
                {
                  key: "value",
                  name: t("kpi.fpDetected"),
                  color: CHART_COLORS.sky,
                },
              ]}
            />
          </ChartCard>

          <ChartCard
            title={lang === "ar" ? "الرفض الخاطئ حسب حالة الجهاز" : "False Positives by Device Status"}
            subtitle={lang === "ar" ? "موثوق مقابل جديد" : "known vs new"}
          >
            <DonutChart data={deviceDonut} />
          </ChartCard>

          <ChartCard
            title={lang === "ar" ? "الرفض الخاطئ حسب نوع المستفيد" : "False Positives by Beneficiary Type"}
          >
            <BarSeries
              data={beneficiaryData}
              series={[
                {
                  key: "value",
                  name: t("kpi.fpDetected"),
                  color: CHART_COLORS.violet,
                },
              ]}
            />
          </ChartCard>

          <ChartCard
            title={lang === "ar" ? "الرفض الخاطئ حسب وقت اليوم" : "False Positives by Time of Day"}
            subtitle={lang === "ar" ? "نطاقات زمنية (٢٤ ساعة)" : "hour bands (24h)"}
          >
            <BarSeries
              data={hourData}
              series={[
                {
                  key: "value",
                  name: t("kpi.fpDetected"),
                  color: CHART_COLORS.amber,
                },
              ]}
            />
          </ChartCard>

          <ChartCard
            title={lang === "ar" ? "الرفض الخاطئ حسب نطاق المبلغ" : "False Positives by Amount Band"}
            subtitle={lang === "ar" ? "بالريال" : "SAR"}
          >
            <BarSeries
              data={amountData}
              series={[
                {
                  key: "value",
                  name: t("kpi.fpDetected"),
                  color: CHART_COLORS.emerald,
                },
              ]}
            />
          </ChartCard>
        </div>
      </div>

      {/* Pareto */}
      <div>
        <SectionTitle>
          {lang === "ar" ? "القواعد الأكثر تسببًا في الرفض الخاطئ (باريتو)" : "Rules Driving Most False Positives (Pareto)"}
        </SectionTitle>
        <ChartCard
          title={lang === "ar" ? "تحليل باريتو للقواعد" : "Rule Pareto Analysis"}
          subtitle={
            lang === "ar"
              ? "قلة من القواعد تسبب أغلب حالات الرفض الخاطئ"
              : "A few rules account for most false positives"
          }
        >
          <ParetoChart
            data={paretoData}
            barKey="falsePositives"
            barName={t("kpi.fpDetected")}
          />
        </ChartCard>
      </div>

      {/* Rule table */}
      <div>
        <SectionTitle>
          {lang === "ar" ? "أداء القواعد وأثرها" : "Rule Performance & Impact"}
        </SectionTitle>
        <Card className="p-5">
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>{lang === "ar" ? "المعرّف" : "Rule ID"}</TH>
                <TH>{lang === "ar" ? "اسم القاعدة" : "Rule name"}</TH>
                <TH className="text-end">{lang === "ar" ? "مرات التفعيل" : "Triggers"}</TH>
                <TH className="text-end">{lang === "ar" ? "احتيال مؤكد" : "Confirmed fraud"}</TH>
                <TH className="text-end">{lang === "ar" ? "رفض خاطئ" : "False positives"}</TH>
                <TH className="text-end">{lang === "ar" ? "الدقة" : "Precision"}</TH>
                <TH className="text-end">{lang === "ar" ? "معدل الرفض الخاطئ" : "FP rate"}</TH>
                <TH className="text-end">{lang === "ar" ? "الأثر المالي" : "Financial impact"}</TH>
                <TH>{lang === "ar" ? "التوصية" : "Recommendation"}</TH>
              </TR>
            </THead>
            <TBody>
              {data.ruleStats.map((r) => {
                const poor = r.falsePositiveRate >= POOR_FP_RATE;
                return (
                  <TR key={r.id} className={poor ? "bg-rose-500/5 hover:bg-rose-500/10" : ""}>
                    <TD className="font-mono text-xs text-coral-600">{r.id}</TD>
                    <TD className="max-w-[220px] whitespace-normal text-slate-900">
                      <span className="flex items-center gap-1.5">
                        {lang === "ar" ? r.nameAr : r.nameEn}
                        {poor && (
                          <Badge variant="warning" className="shrink-0">
                            <AlertTriangle className="size-3" />
                            {lang === "ar" ? "أداء ضعيف" : "Poor"}
                          </Badge>
                        )}
                      </span>
                    </TD>
                    <TD className="text-end tabular-nums">{fmtNumber(r.triggerCount)}</TD>
                    <TD className="text-end tabular-nums text-emerald-700">
                      {fmtNumber(r.confirmedFraud)}
                    </TD>
                    <TD className="text-end tabular-nums text-rose-700">
                      {fmtNumber(r.falsePositives)}
                    </TD>
                    <TD className="text-end tabular-nums">{fmtPercent(r.precision)}</TD>
                    <TD
                      className={`text-end tabular-nums font-semibold ${
                        poor ? "text-rose-600" : "text-slate-700"
                      }`}
                    >
                      {fmtPercent(r.falsePositiveRate)}
                    </TD>
                    <TD className="text-end tabular-nums">
                      {fmtCurrency(r.financialImpact, lang)}
                    </TD>
                    <TD>
                      <Badge variant={poor ? "danger" : "muted"}>
                        {tr(RULE_RECO_LABEL[r.recommendationKey])}
                      </Badge>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
            <ShieldAlert className="size-3.5 text-rose-600" />
            {lang === "ar"
              ? `الصفوف المميزة بالوردي تتجاوز معدل رفض خاطئ ${POOR_FP_RATE}٪ وتحتاج مراجعة عاجلة.`
              : `Rose-tinted rows exceed a ${POOR_FP_RATE}% false-positive rate and need urgent review.`}
          </p>
        </Card>
      </div>

      <DisclaimerBar />
    </div>
  );
}
