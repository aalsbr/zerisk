"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Receipt,
  ShieldAlert,
  Gauge,
  Sparkles,
  UserSearch,
  Tags,
  Wrench,
  ArrowLeft,
  ArrowRight,
  GitBranch,
  History,
  Cpu,
  Smartphone,
  ShieldCheck,
  GraduationCap,
  Info,
  Wand2,
} from "lucide-react";
import { PageHeader, DisclaimerBar, SectionTitle, Stat, EmptyState } from "@/components/shared/misc";
import { DecisionBadge } from "@/components/shared/decision-badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { useI18n, useToast } from "@/providers";
import { OUTCOME_LABEL } from "@/lib/i18n";
import { fmtNumber, fmtPercent, fmtDateTime } from "@/lib/format";
import { submitFeedbackAction, recalibrateModelAction } from "@/app/actions";
import type {
  LearningEvent,
  ModelVersion,
  Calibration,
  Decision,
  InvestigationOutcome,
} from "@/lib/types";

interface LearnCard {
  id: string;
  originalDecision: Decision;
  originalRiskScore: number;
  ai: {
    recommendation: Decision;
    optimizedRiskScore: number;
    falsePositiveProbability: number;
    confidence: number;
  };
  feedback: { outcome: InvestigationOutcome; note: string | null; at: string } | null;
}

interface DeviceRow {
  id: string;
  label: string;
  known: boolean;
  successfulTransactionCount: number;
  fraudCount: number;
  legitimateCount: number;
  customerCount: number;
  trustScore: number;
}

interface RuleRow {
  id: string;
  name: string;
  nameEn: string;
  triggerCount: number;
  falsePositiveCount: number;
  confirmedFraudCount: number;
  falsePositiveRate: number;
  currentWeight: number;
  recommendedWeight: number;
}

export function LearningView({
  events,
  modelVersions,
  calibration,
  topDevices,
  topRules,
  learn1,
  learn2,
  learnId1,
}: {
  events: LearningEvent[];
  modelVersions: ModelVersion[];
  calibration: Calibration;
  topDevices: DeviceRow[];
  topRules: RuleRow[];
  learn1: LearnCard | null;
  learn2: LearnCard | null;
  learnId1: string;
  learnId2: string;
}) {
  const { t, lang, pick, tr } = useI18n();
  const { toast } = useToast();
  const [pending, startTransition] = React.useTransition();

  function teachAndRecalibrate() {
    startTransition(async () => {
      await submitFeedbackAction(learnId1, "LEGITIMATE", "Demo learning");
      const res = await recalibrateModelAction();
      toast({
        kind: "success",
        title: pick("تعلّم النظام", "System learned"),
        description: res.summary.changed
          ? `${res.summary.previousVersion} → ${res.summary.newVersion}`
          : pick("حُدّثت الإحصائيات", "Statistics updated"),
      });
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("page.learning.title")} subtitle={t("page.learning.subtitle")} />

      {/* Feedback loop diagram */}
      <FeedbackLoop />

      {/* Current model + calibration factors */}
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between gap-2">
          <SectionTitle className="mb-0">
            {pick("النموذج الحالي", "Current model")}
          </SectionTitle>
          <Badge variant="coral">
            <Cpu className="size-3" />
            {calibration.version}
          </Badge>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          <Stat label={pick("الإصدار", "Version")} value={calibration.version} />
          <Stat
            label={pick("عدد التسميات", "Labeled count")}
            value={fmtNumber(calibration.labeledCount)}
          />
          <Stat
            label={pick("تعزيز ثقة الجهاز", "Device trust boost")}
            value={calibration.deviceTrustBoost.toFixed(2)}
          />
          <Stat
            label={pick("تعزيز سجل المستفيد", "Beneficiary boost")}
            value={calibration.beneficiaryHistoryBoost.toFixed(2)}
          />
          <Stat
            label={pick("وزن السرعة", "Velocity weight")}
            value={calibration.velocityWeight.toFixed(2)}
          />
          <Stat
            label={pick("معايرة الرفض الخاطئ", "FP calibration")}
            value={calibration.fpCalibration.toFixed(2)}
          />
          <Stat
            label={pick("انحياز الثقة", "Confidence bias")}
            value={calibration.confidenceBias.toFixed(2)}
          />
        </div>
      </Card>

      {/* Interactive learning demo */}
      <Card className="p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-xl bg-coral-500/15 text-coral-600">
              <GraduationCap className="size-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                {pick("عرض التعلّم المباشر", "Live learning demo")}
              </h2>
              <p className="text-xs text-muted">
                {pick(
                  "علّم النظام من عملية، وشاهد الأخرى تتغيّر",
                  "Teach the system from one case and watch the other change",
                )}
              </p>
            </div>
          </div>
          <Button size="sm" onClick={teachAndRecalibrate} disabled={pending}>
            <Wand2 className={"size-4 " + (pending ? "animate-pulse" : "")} />
            {pick(
              "علّم النظام: تأكيد سلامة LEARN-001 ثم إعادة المعايرة",
              "Teach: confirm LEARN-001 legitimate & recalibrate",
            )}
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <LearnCardView
            card={learn1}
            title="LEARN-001"
            highlight="teach"
            pick={pick}
            tr={tr}
            lang={lang}
          />
          <LearnCardView
            card={learn2}
            title="LEARN-002"
            highlight="watch"
            pick={pick}
            tr={tr}
            lang={lang}
          />
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-xl border border-sky-500/25 bg-sky-500/[0.05] px-3.5 py-2.5">
          <Info className="mt-0.5 size-4 shrink-0 text-sky-700" />
          <p className="text-xs leading-relaxed text-slate-700">
            {pick(
              "بعد التعليم، ستتحدّث درجة LEARN-002 واحتمالية الرفض الخاطئ والثقة في القائمة أعلاه. هذا التغيير ناتج عن تغذية راجعة مُخزَّنة وإحصائيات مُعاد حسابها — وليس رسومًا متحركة. لإعادة الضبط، استخدم «إعادة تعيين بيانات العرض» في الإعدادات.",
              "After teaching, LEARN-002's score, false-positive probability, and confidence above will update. The change is caused by persisted feedback and recalculated statistics — not animation. To reset, use \"Reset demo data\" in Settings.",
            )}
          </p>
        </div>
      </Card>

      {/* Model versions table */}
      <Card className="p-5">
        <SectionTitle>{pick("إصدارات النموذج", "Model versions")}</SectionTitle>
        {modelVersions.length === 0 ? (
          <EmptyState />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>{pick("الإصدار", "Version")}</TH>
                <TH>{pick("التاريخ", "Created")}</TH>
                <TH>{pick("التسميات", "Labels")}</TH>
                <TH>{pick("المُشغِّل", "Triggered by")}</TH>
                <TH>{pick("ملاحظة", "Note")}</TH>
                <TH>{pick("رفض خاطئ", "FP rate")}</TH>
                <TH>{pick("استدعاء", "Recall")}</TH>
                <TH>{pick("ضبط", "Precision")}</TH>
                <TH>{pick("دقة", "Accuracy")}</TH>
              </TR>
            </THead>
            <TBody>
              {[...modelVersions].reverse().map((v) => (
                <TR key={v.version}>
                  <TD>
                    <Badge variant="coral">{v.version}</Badge>
                  </TD>
                  <TD className="text-muted">{fmtDateTime(v.createdAt, lang)}</TD>
                  <TD className="tabular-nums">{fmtNumber(v.labeledCount)}</TD>
                  <TD>{v.triggeredBy}</TD>
                  <TD className="max-w-[16rem] truncate text-muted">{v.note}</TD>
                  <TD className="tabular-nums">{fmtPercent(v.metrics.falsePositiveRate, 2)}</TD>
                  <TD className="tabular-nums">{fmtPercent(v.metrics.recall, 2)}</TD>
                  <TD className="tabular-nums">{fmtPercent(v.metrics.precision, 2)}</TD>
                  <TD className="tabular-nums">{fmtPercent(v.metrics.accuracy, 2)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      {/* Learning events timeline */}
      <div>
        <SectionTitle>{pick("أحداث التعلّم", "Learning events")}</SectionTitle>
        {events.length === 0 ? (
          <Card className="p-5">
            <EmptyState
              title={pick("لا توجد أحداث تعلّم بعد", "No learning events yet")}
              hint={pick(
                "سجّل تغذية راجعة أو أعد المعايرة لبدء التعلّم.",
                "Record feedback or recalibrate to start learning.",
              )}
            />
          </Card>
        ) : (
          <ol className="relative space-y-3 ps-4">
            <span className="absolute inset-y-0 start-0 w-px bg-navy-700/60" />
            {events.map((e, i) => (
              <LearningEventItem key={e.id} event={e} index={i} pick={pick} tr={tr} lang={lang} />
            ))}
          </ol>
        )}
      </div>

      {/* Top devices / top rules */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <Smartphone className="size-4 text-emerald-600" />
            <SectionTitle className="mb-0">
              {pick("الأجهزة الأعلى ثقة (مُتعلَّمة)", "Top learned-trust devices")}
            </SectionTitle>
          </div>
          {topDevices.length === 0 ? (
            <EmptyState />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>{pick("الجهاز", "Device")}</TH>
                  <TH>{pick("عمليات ناجحة", "Successful")}</TH>
                  <TH>{pick("سليمة", "Legit")}</TH>
                  <TH>{pick("احتيال", "Fraud")}</TH>
                  <TH>{pick("الثقة", "Trust")}</TH>
                </TR>
              </THead>
              <TBody>
                {topDevices.map((d) => (
                  <TR key={d.id}>
                    <TD>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-800">{d.label}</span>
                        {d.known && (
                          <Badge variant="success" className="px-1.5 py-0">
                            <ShieldCheck className="size-3" />
                          </Badge>
                        )}
                      </div>
                    </TD>
                    <TD className="tabular-nums">{fmtNumber(d.successfulTransactionCount)}</TD>
                    <TD className="tabular-nums text-emerald-700">{fmtNumber(d.legitimateCount)}</TD>
                    <TD className="tabular-nums text-rose-700">{fmtNumber(d.fraudCount)}</TD>
                    <TD className="tabular-nums font-semibold">{fmtNumber(d.trustScore)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <ShieldAlert className="size-4 text-amber-600" />
            <SectionTitle className="mb-0">
              {pick("القواعد الأعلى رفضًا خاطئًا", "Top false-positive rules")}
            </SectionTitle>
          </div>
          {topRules.length === 0 ? (
            <EmptyState />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>{pick("القاعدة", "Rule")}</TH>
                  <TH>{pick("إطلاقات", "Triggers")}</TH>
                  <TH>{pick("رفض خاطئ", "FP")}</TH>
                  <TH>{pick("معدل الرفض", "FP rate")}</TH>
                  <TH>{pick("الوزن", "Weight")}</TH>
                </TR>
              </THead>
              <TBody>
                {topRules.map((r) => (
                  <TR key={r.id}>
                    <TD>
                      <div className="flex flex-col">
                        <span className="font-mono text-xs text-coral-600">{r.id}</span>
                        <span className="max-w-[12rem] truncate text-xs text-muted">
                          {lang === "ar" ? r.name : r.nameEn}
                        </span>
                      </div>
                    </TD>
                    <TD className="tabular-nums">{fmtNumber(r.triggerCount)}</TD>
                    <TD className="tabular-nums text-rose-700">{fmtNumber(r.falsePositiveCount)}</TD>
                    <TD className="tabular-nums">{fmtPercent(r.falsePositiveRate, 1)}</TD>
                    <TD className="tabular-nums">
                      <span className="flex items-center gap-1">
                        {r.currentWeight.toFixed(2)}
                        {r.recommendedWeight !== r.currentWeight && (
                          <>
                            <ArrowRight className="size-3 text-muted rtl:rotate-180" />
                            <span className="text-emerald-700">
                              {r.recommendedWeight.toFixed(2)}
                            </span>
                          </>
                        )}
                      </span>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>
      </div>

      <DisclaimerBar />
    </div>
  );
}

// ---------------------------------------------------------------------------

const OUTCOME_BADGE: Record<InvestigationOutcome, "success" | "danger" | "warning" | "muted"> = {
  LEGITIMATE: "success",
  CONFIRMED_FRAUD: "danger",
  INCONCLUSIVE: "warning",
  PENDING: "muted",
};

function LearnCardView({
  card,
  title,
  highlight,
  pick,
  tr,
  lang,
}: {
  card: LearnCard | null;
  title: string;
  highlight: "teach" | "watch";
  pick: (ar: string, en: string) => string;
  tr: (v: { ar: string; en: string }) => string;
  lang: "ar" | "en";
}) {
  if (!card) {
    return (
      <div className="rounded-xl border border-navy-700/60 bg-navy-900/40 p-4">
        <EmptyState title={pick("العملية غير متوفرة", "Transaction unavailable")} />
      </div>
    );
  }
  const tone =
    highlight === "teach"
      ? "border-coral-500/30 bg-coral-500/[0.05]"
      : "border-sky-500/30 bg-sky-500/[0.05]";
  return (
    <div className={"rounded-xl border p-4 " + tone}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="font-mono text-sm font-semibold text-slate-900">{title}</span>
        <span
          className={
            "rounded-full px-2 py-0.5 text-[10px] font-medium " +
            (highlight === "teach"
              ? "bg-coral-500/15 text-coral-600"
              : "bg-sky-500/15 text-sky-700")
          }
        >
          {highlight === "teach"
            ? pick("علّم من هذه", "Teach from this")
            : pick("راقب التغيّر", "Watch this change")}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <MiniStat label={pick("القرار الأصلي", "Original")} value={<DecisionBadge decision={card.originalDecision} />} />
        <MiniStat label={pick("توصية AI", "AI reco")} value={<DecisionBadge decision={card.ai.recommendation} />} />
        <MiniStat
          label={pick("درجة محسّنة", "Optimized score")}
          value={<span className="tabular-nums">{card.ai.optimizedRiskScore}</span>}
        />
        <MiniStat
          label={pick("احتمالية رفض خاطئ", "FP probability")}
          value={<span className="tabular-nums">{fmtPercent(card.ai.falsePositiveProbability, 1)}</span>}
        />
        <MiniStat
          label={pick("الثقة", "Confidence")}
          value={<span className="tabular-nums">{fmtPercent(card.ai.confidence, 1)}</span>}
        />
        <MiniStat
          label={pick("درجة أصلية", "Original score")}
          value={<span className="tabular-nums">{card.originalRiskScore}</span>}
        />
      </div>

      {card.feedback && (
        <div className="mt-3 flex items-center gap-2 text-xs">
          <span className="text-muted">{pick("الحالة", "Status")}:</span>
          <Badge variant={OUTCOME_BADGE[card.feedback.outcome]}>
            {tr(OUTCOME_LABEL[card.feedback.outcome])}
          </Badge>
          <span className="text-muted">{fmtDateTime(card.feedback.at, lang)}</span>
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-navy-700/60 bg-navy-900/40 p-2.5">
      <p className="text-[11px] text-muted">{label}</p>
      <div className="mt-1 text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function LearningEventItem({
  event,
  index,
  tr,
  lang,
}: {
  event: LearningEvent;
  index: number;
  pick: (ar: string, en: string) => string;
  tr: (v: { ar: string; en: string }) => string;
  lang: "ar" | "en";
}) {
  return (
    <motion.li
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.3) }}
      className="relative"
    >
      <span className="absolute -start-4 top-3 grid size-3 -translate-x-1/2 place-items-center rounded-full bg-coral-500 ring-4 ring-navy-950 rtl:translate-x-1/2" />
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-violet-500/15 text-violet-700">
            <History className="size-4" />
          </span>
          <p className="min-w-0 flex-1 text-sm font-medium text-slate-800">
            {tr({ ar: event.ar, en: event.en })}
          </p>
          <span className="text-[11px] text-muted">{fmtDateTime(event.at, lang)}</span>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="muted">{event.actor}</Badge>
          {event.previousVersion !== event.newVersion && (
            <span className="inline-flex items-center gap-1.5">
              <Badge variant="muted">{event.previousVersion}</Badge>
              <ArrowRight className="size-3 text-muted rtl:rotate-180" />
              <Badge variant="coral">{event.newVersion}</Badge>
            </span>
          )}
          {event.transactionId && (
            <span className="font-mono text-[11px] text-sky-700">{event.transactionId}</span>
          )}
        </div>

        {(event.affectedRules.length > 0 || event.affectedFeatures.length > 0) && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {event.affectedRules.map((r) => (
              <span
                key={r}
                className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] text-amber-700"
              >
                {r}
              </span>
            ))}
            {event.affectedFeatures.map((f) => (
              <span
                key={f}
                className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-700"
              >
                {f}
              </span>
            ))}
          </div>
        )}

        {event.changes.length > 0 && (
          <ul className="mt-2 space-y-1.5">
            {event.changes.map((c, i) => (
              <li
                key={i}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-navy-700/60 bg-navy-900/40 px-2.5 py-2"
              >
                <span className="text-xs font-medium text-slate-800">{tr(c)}</span>
                <span className="flex items-center gap-1.5 font-mono text-[11px] text-muted">
                  <span>{String(c.before)}</span>
                  <ArrowRight className="size-3 rtl:rotate-180" />
                  <span className="text-slate-800">{String(c.after)}</span>
                </span>
                {typeof c.deltaPct === "number" && (
                  <span
                    className={
                      "text-[11px] " +
                      (c.deltaPct >= 0 ? "text-emerald-700" : "text-rose-700")
                    }
                  >
                    {c.deltaPct >= 0 ? "+" : ""}
                    {fmtPercent(c.deltaPct, 1)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </motion.li>
  );
}

// ---------------------------------------------------------------------------

function FeedbackLoop() {
  const { pick } = useI18n();
  const steps = [
    { icon: Receipt, ar: "العملية", en: "Transaction", accent: "text-sky-700 bg-sky-500/10 border-sky-500/30" },
    { icon: ShieldAlert, ar: "محرك الاحتيال", en: "Fraud Engine", accent: "text-amber-700 bg-amber-500/10 border-amber-500/30" },
    { icon: Gauge, ar: "محرك التقييم", en: "Scoring Engine", accent: "text-emerald-700 bg-emerald-500/10 border-emerald-500/30" },
    { icon: Sparkles, ar: "تحليل OpenAI", en: "OpenAI Analysis", accent: "text-coral-600 bg-coral-500/10 border-coral-500/30" },
    { icon: UserSearch, ar: "تغذية المحقق الراجعة", en: "Investigator Feedback", accent: "text-violet-700 bg-violet-500/10 border-violet-500/30" },
    { icon: Tags, ar: "نتيجة مُصنّفة", en: "Labeled Outcome", accent: "text-sky-700 bg-sky-500/10 border-sky-500/30" },
    { icon: Wrench, ar: "تحديث الميزة/القاعدة/المعايرة", en: "Feature/Rule/Calibration Update", accent: "text-rose-700 bg-rose-500/10 border-rose-500/30" },
    { icon: GitBranch, ar: "توصيات محسّنة", en: "Improved Recommendations", accent: "text-emerald-700 bg-emerald-500/10 border-emerald-500/30" },
  ];
  return (
    <Card className="p-5">
      <SectionTitle>{pick("حلقة التغذية الراجعة", "The feedback loop")}</SectionTitle>
      <div className="flex flex-wrap items-stretch gap-2">
        {steps.map((s, i) => (
          <React.Fragment key={s.en}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              className={"flex min-w-[8rem] flex-1 items-center gap-2 rounded-xl border px-3 py-2.5 " + s.accent}
            >
              <s.icon className="size-4 shrink-0" />
              <span className="text-xs font-medium leading-tight">{pick(s.ar, s.en)}</span>
            </motion.div>
            {i < steps.length - 1 && (
              <span className="hidden shrink-0 items-center text-muted sm:flex">
                <ArrowLeft className="size-4 rotate-180 rtl:rotate-0" />
              </span>
            )}
          </React.Fragment>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">
        {pick(
          "كل قرار يتخذه المحقق يتحوّل إلى نتيجة مُصنّفة تُعيد حساب الإحصائيات والمعايرة، فتتحسّن التوصيات في الدورة التالية.",
          "Every investigator decision becomes a labeled outcome that recomputes statistics and calibration, so recommendations improve on the next cycle.",
        )}
      </p>
    </Card>
  );
}
