"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Target,
  Crosshair,
  Radar,
  ShieldAlert,
  ShieldX,
  Activity,
  AlertTriangle,
  TrendingUp,
  DatabaseZap,
  Gauge,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { KpiCard } from "@/components/shared/kpi-card";
import { PageHeader, DisclaimerBar } from "@/components/shared/misc";
import { Card } from "@/components/ui/card";
import {
  ChartCard,
  LineSeries,
  AreaSeries,
  BarSeries,
  DonutChart,
  CHART_COLORS,
} from "@/components/charts";
import { useI18n } from "@/providers";
import { DECISION_LABEL, SEGMENT_LABEL, CHANNEL_LABEL } from "@/lib/i18n";
import { fmtPercent, fmtNumber } from "@/lib/format";
import type { Decision } from "@/lib/types";

interface MonitoringData {
  kpi: {
    accuracy: number;
    precision: number;
    recall: number;
    fpRate: number;
    fnRate: number;
    tp: number;
    fp: number;
    tn: number;
    fn: number;
  };
  performanceTrend: { label: string; accuracy: number; precision: number; recall: number }[];
  driftTrend: { label: string; value: number }[];
  fnRateTrend: { label: string; value: number; fpRate: number }[];
  scoreDist: { label: string; original: number; optimized: number }[];
  confidenceDist: { label: string; value: number }[];
  decisionDist: { key: Decision; value: number }[];
  bySegment: { label: string; value: number }[];
  byChannel: { label: string; value: number }[];
  alerts: {
    drift: number;
    driftPct: number;
    lowConfidenceShare: number;
    lowConfidenceCount: number;
    worstRuleId: string;
    worstRuleFpRate: number;
    worstRuleNameAr: string;
    worstRuleNameEn: string;
    fpRateAfter: number;
    fpRateBefore: number;
  };
}

type AlertSeverity = "critical" | "warning" | "info";

interface AlertItem {
  id: string;
  severity: AlertSeverity;
  Icon: LucideIcon;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
}

const DECISION_COLOR: Record<Decision, string> = {
  APPROVE: CHART_COLORS.emerald,
  REVIEW: CHART_COLORS.amber,
  REJECT: CHART_COLORS.rose,
  MONITOR: CHART_COLORS.sky,
};

export function MonitoringView({ data }: { data: MonitoringData }) {
  const { t, tr, pick } = useI18n();
  const k = data.kpi;
  const a = data.alerts;

  const alerts = React.useMemo<AlertItem[]>(() => {
    const list: AlertItem[] = [];

    if (a.drift > 0.1) {
      list.push({
        id: "drift",
        severity: a.drift > 0.18 ? "critical" : "warning",
        Icon: Radar,
        titleAr: "تم رصد انحراف في النموذج",
        titleEn: "Model drift detected",
        bodyAr: `ارتفع مؤشر انحراف البيانات إلى ${a.driftPct}% هذا الشهر، ما يعني أن أنماط العمليات الجديدة بدأت تبتعد عمّا تدرّب عليه النموذج. يُنصح بمراجعة العيّنات الحديثة وإعادة المعايرة قبل أن تتأثر الدقة.`,
        bodyEn: `Data drift rose to ${a.driftPct}% this month, meaning recent transaction patterns are moving away from what the model learned. Review recent samples and recalibrate before accuracy is affected.`,
      });
    }

    if (a.worstRuleFpRate >= 45 && a.worstRuleId) {
      list.push({
        id: "rule",
        severity: a.worstRuleFpRate >= 60 ? "critical" : "warning",
        Icon: ShieldAlert,
        titleAr: "تدهور أداء قاعدة",
        titleEn: "Rule performance degraded",
        bodyAr: `القاعدة ${a.worstRuleId} («${a.worstRuleNameAr}») ترفض عمليات سليمة بمعدل رفض خاطئ ${a.worstRuleFpRate}%. هذا يعني أن كثيراً من العملاء الجيّدين يتم إيقافهم بلا داعٍ — يُنصح بتحويل الرفض إلى مراجعة أو رفع العتبة.`,
        bodyEn: `Rule ${a.worstRuleId} ("${a.worstRuleNameEn}") is declining legitimate transactions at a ${a.worstRuleFpRate}% false-positive rate. Many good customers are being stopped unnecessarily — consider changing Reject to Review or raising the threshold.`,
      });
    }

    if (a.lowConfidenceShare > 10) {
      list.push({
        id: "confidence",
        severity: "warning",
        Icon: Gauge,
        titleAr: "توصيات منخفضة الثقة",
        titleEn: "Low-confidence recommendations",
        bodyAr: `${a.lowConfidenceShare}% من التوصيات (${fmtNumber(a.lowConfidenceCount)} عملية) صدرت بثقة أقل من 65%. هذه الحالات الرمادية تستحق مراجعة بشرية إضافية بدل الاعتماد الكامل على التوصية الآلية.`,
        bodyEn: `${a.lowConfidenceShare}% of recommendations (${fmtNumber(a.lowConfidenceCount)} transactions) were issued below 65% confidence. These gray-zone cases warrant extra human review rather than fully automated handling.`,
      });
    }

    if (a.fpRateAfter > a.fpRateBefore + 0.15) {
      list.push({
        id: "fp-spike",
        severity: "warning",
        Icon: TrendingUp,
        titleAr: "زيادة مفاجئة في الرفض الخاطئ",
        titleEn: "Sudden rise in false positives",
        bodyAr: `ارتفع معدل الرفض الخاطئ من ${fmtPercent(a.fpRateBefore, 2)} إلى ${fmtPercent(a.fpRateAfter, 2)} مقارنةً بالشهر السابق. راقب القواعد الأعلى إطلاقاً وتأكد من عدم تغيّر مصدر البيانات.`,
        bodyEn: `The false-positive rate rose from ${fmtPercent(a.fpRateBefore, 2)} to ${fmtPercent(a.fpRateAfter, 2)} versus last month. Watch the highest-firing rules and confirm no upstream data source changed.`,
      });
    }

    // Illustrative operational alerts (sample) so the panel always demonstrates coverage.
    list.push({
      id: "data-source",
      severity: "info",
      Icon: DatabaseZap,
      titleAr: "مصدر بيانات مفقود",
      titleEn: "Missing data source",
      bodyAr:
        "لم تصل تحديثات إشارة «سجل الجهاز» من أحد التكاملات خلال آخر ساعة. تعمل التوصيات حالياً على آخر قيمة معروفة؛ يُرجى التحقق من حالة التكامل في مركز التكامل.",
      bodyEn:
        "The device-history signal from one integration hasn't updated in the last hour. Recommendations are running on the last known value; check the integration status in the Integration Center.",
    });

    return list;
  }, [a]);

  return (
    <div className="space-y-6">
      <PageHeader title={t("page.monitoring.title")} subtitle={t("page.monitoring.subtitle")} />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard
          label={pick("الدقة الإجمالية", "Accuracy")}
          value={fmtPercent(k.accuracy)}
          Icon={Target}
          accent="coral"
          delay={0.02}
        />
        <KpiCard
          label={pick("الدقة (Precision)", "Precision")}
          value={fmtPercent(k.precision)}
          Icon={Crosshair}
          accent="emerald"
          delay={0.05}
        />
        <KpiCard
          label={pick("الاستدعاء (Recall)", "Recall")}
          value={fmtPercent(k.recall)}
          Icon={Activity}
          accent="sky"
          delay={0.08}
        />
        <KpiCard
          label={pick("معدل الرفض الخاطئ", "False-positive rate")}
          value={fmtPercent(k.fpRate)}
          Icon={ShieldAlert}
          accent="amber"
          delay={0.11}
        />
        <KpiCard
          label={pick("معدل الاحتيال الفائت", "False-negative rate")}
          value={fmtPercent(k.fnRate)}
          Icon={ShieldX}
          accent="rose"
          delay={0.14}
        />
      </div>

      {/* Alerts panel */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <AlertTriangle className="size-4 text-amber-600" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            {pick("تنبيهات المراقبة", "Monitoring alerts")}
          </h2>
          <span className="rounded-full bg-navy-700 px-2 py-0.5 text-xs text-slate-600">
            {alerts.length}
          </span>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {alerts.map((al, i) => (
            <AlertCard key={al.id} alert={al} index={i} />
          ))}
        </div>
      </div>

      {/* Trends row */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title={pick("أداء النموذج عبر الأشهر", "Model performance over months")}
          subtitle={pick("الدقة والضبط والاستدعاء (%)", "Accuracy, precision & recall (%)")}
        >
          <LineSeries
            data={data.performanceTrend}
            series={[
              { key: "accuracy", name: pick("الدقة", "Accuracy"), color: CHART_COLORS.coral },
              { key: "precision", name: pick("الضبط", "Precision"), color: CHART_COLORS.emerald },
              { key: "recall", name: pick("الاستدعاء", "Recall"), color: CHART_COLORS.sky },
            ]}
          />
        </ChartCard>

        <ChartCard
          title={pick("انحراف البيانات عبر الأشهر", "Data drift over months")}
          subtitle={pick("مؤشر الانحراف (%)", "Drift index (%)")}
        >
          <AreaSeries
            data={data.driftTrend}
            series={[{ key: "value", name: pick("الانحراف", "Drift"), color: CHART_COLORS.violet }]}
          />
        </ChartCard>
      </div>

      {/* Distribution row */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard
          title={pick("توزيع الدرجات: الأصلية مقابل المحسّنة", "Score distribution: original vs optimized")}
        >
          <BarSeries
            data={data.scoreDist}
            series={[
              { key: "original", name: t("common.original"), color: CHART_COLORS.slate },
              { key: "optimized", name: pick("محسّنة", "Optimized"), color: CHART_COLORS.coral },
            ]}
          />
        </ChartCard>

        <ChartCard title={pick("توزيع قرارات الذكاء الاصطناعي", "AI decision distribution")}>
          <DonutChart
            data={data.decisionDist.map((d) => ({
              name: tr(DECISION_LABEL[d.key]),
              value: d.value,
              color: DECISION_COLOR[d.key],
            }))}
          />
        </ChartCard>

        <ChartCard
          title={pick("توزيع درجة الثقة", "Confidence distribution")}
          subtitle={pick("عدد العمليات لكل نطاق ثقة", "Transactions per confidence band")}
        >
          <BarSeries
            data={data.confidenceDist}
            series={[{ key: "value", name: t("common.confidence"), color: CHART_COLORS.sky }]}
          />
        </ChartCard>
      </div>

      {/* Segment / channel performance */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title={pick("الأداء حسب شريحة العميل", "Performance by customer segment")}
          subtitle={pick("نسبة التوصيات الصحيحة (%)", "Correct recommendations (%)")}
        >
          <BarSeries
            data={data.bySegment.map((s) => ({
              ...s,
              label: tr(SEGMENT_LABEL[s.label] ?? { ar: s.label, en: s.label }),
            }))}
            vertical
            series={[{ key: "value", name: pick("الدقة", "Accuracy"), color: CHART_COLORS.emerald }]}
          />
        </ChartCard>

        <ChartCard
          title={pick("الأداء حسب القناة", "Performance by channel")}
          subtitle={pick("نسبة التوصيات الصحيحة (%)", "Correct recommendations (%)")}
        >
          <BarSeries
            data={data.byChannel.map((c) => ({
              ...c,
              label: tr(CHANNEL_LABEL[c.label] ?? { ar: c.label, en: c.label }),
            }))}
            vertical
            series={[{ key: "value", name: pick("الدقة", "Accuracy"), color: CHART_COLORS.sky }]}
          />
        </ChartCard>
      </div>

      {/* Error-rate trend */}
      <ChartCard
        title={pick("معدلات الخطأ عبر الأشهر", "Error rates over months")}
        subtitle={pick("الرفض الخاطئ مقابل الاحتيال الفائت (%)", "False-positive vs false-negative rate (%)")}
      >
        <LineSeries
          data={data.fnRateTrend}
          series={[
            { key: "fpRate", name: pick("الرفض الخاطئ", "False-positive"), color: CHART_COLORS.amber },
            { key: "value", name: pick("الاحتيال الفائت", "False-negative"), color: CHART_COLORS.rose },
          ]}
        />
      </ChartCard>

      <DisclaimerBar />
    </div>
  );
}

const ALERT_STYLE: Record<
  AlertSeverity,
  { card: string; icon: string; ar: string; en: string; badge: string }
> = {
  critical: {
    card: "border-rose-500/30 bg-rose-500/[0.06]",
    icon: "bg-rose-500/15 text-rose-700",
    badge: "bg-rose-500/15 text-rose-700",
    ar: "حرج",
    en: "Critical",
  },
  warning: {
    card: "border-amber-500/30 bg-amber-500/[0.06]",
    icon: "bg-amber-500/15 text-amber-700",
    badge: "bg-amber-500/15 text-amber-700",
    ar: "تحذير",
    en: "Warning",
  },
  info: {
    card: "border-sky-500/30 bg-sky-500/[0.05]",
    icon: "bg-sky-500/15 text-sky-700",
    badge: "bg-sky-500/15 text-sky-700",
    ar: "معلومة",
    en: "Info",
  },
};

function AlertCard({ alert, index }: { alert: AlertItem; index: number }) {
  const { tr } = useI18n();
  const s = ALERT_STYLE[alert.severity];
  const Icon = alert.Icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.05, 0.3) }}
    >
      <Card className={`h-full border p-4 ${s.card}`}>
        <div className="flex items-start gap-3">
          <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${s.icon}`}>
            <Icon className="size-4" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-900">
                {tr({ ar: alert.titleAr, en: alert.titleEn })}
              </h3>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${s.badge}`}>
                {tr({ ar: s.ar, en: s.en })}
              </span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
              {tr({ ar: alert.bodyAr, en: alert.bodyEn })}
            </p>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
