"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Search,
  ThumbsUp,
  Flag,
  StickyNote,
  Cpu,
  Smartphone,
  UserCheck,
  Building2,
  Activity,
} from "lucide-react";
import { PageHeader, DisclaimerBar, SectionTitle, Stat } from "@/components/shared/misc";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { DecisionBadge } from "@/components/shared/decision-badge";
import { RiskGauge, riskColor } from "@/components/shared/risk-gauge";
import { useI18n, useToast } from "@/providers";
import {
  DECISION_LABEL,
  CHANNEL_LABEL,
  SEGMENT_LABEL,
  SEVERITY_LABEL,
  OUTCOME_LABEL,
} from "@/lib/i18n";
import { fmtNumber, fmtDateTime, fmtPercent } from "@/lib/format";
import {
  applyRecommendationAction,
  keepOriginalAction,
  sendToReviewAction,
  markFalsePositiveAction,
  markConfirmedFraudAction,
  addNoteAction,
} from "@/app/actions";
import type { Decision, EnrichedTransaction, RiskBreakdown, RuleSeverity } from "@/lib/types";

export interface SimilarTxn {
  id: string;
  customerName: string;
  customerNameEn: string;
  amount: number;
  currency: string;
  timestamp: string;
  originalDecision: Decision;
  aiRecommendation: Decision;
  optimizedRiskScore: number;
  isFalsePositive: boolean;
}

const SEVERITY_VARIANT: Record<RuleSeverity, "info" | "warning" | "danger" | "coral"> = {
  LOW: "info",
  MEDIUM: "warning",
  HIGH: "danger",
  CRITICAL: "coral",
};

function BigStat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="rounded-2xl border border-navy-700/60 bg-navy-900/40 p-4 text-center">
      <p className="text-3xl font-bold tabular-nums" style={color ? { color } : undefined}>
        {value}
      </p>
      <p className="mt-1 text-xs text-muted">{label}</p>
    </div>
  );
}

export function TransactionAnalysisView({
  txn,
  similar,
}: {
  txn: EnrichedTransaction;
  similar: SimilarTxn[];
}) {
  const { t, lang, pick, tr } = useI18n();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");

  const ai = txn.ai;

  function run(
    key: string,
    fn: () => Promise<{ ok: boolean }>,
    successTitle: string,
    description?: string,
  ) {
    setPendingAction(key);
    startTransition(async () => {
      await fn();
      setPendingAction(null);
      toast({ kind: "success", title: successTitle, description });
    });
  }

  function submitNote() {
    if (!note.trim()) return;
    const value = note.trim();
    setPendingAction("note");
    startTransition(async () => {
      await addNoteAction(txn.id, value);
      setPendingAction(null);
      setNoteOpen(false);
      setNote("");
      toast({
        kind: "success",
        title: pick("تمت إضافة الملاحظة", "Note added"),
      });
    });
  }

  const breakdownItems: { key: keyof RiskBreakdown; ar: string; en: string }[] = [
    { key: "device", ar: "مخاطر الجهاز", en: "Device risk" },
    { key: "behavioral", ar: "المخاطر السلوكية", en: "Behavioral risk" },
    { key: "beneficiary", ar: "مخاطر المستفيد", en: "Beneficiary risk" },
    { key: "velocity", ar: "مخاطر السرعة", en: "Velocity risk" },
    { key: "location", ar: "مخاطر الموقع", en: "Location risk" },
    { key: "historical", ar: "المخاطر التاريخية", en: "Historical risk" },
  ];

  const behavioralSignals: { label: string; value: React.ReactNode; hint?: string }[] = [
    {
      label: pick("التحقق الثنائي", "MFA"),
      value: txn.mfaPassed ? pick("ناجح", "Passed") : pick("فشل", "Failed"),
    },
    { label: pick("محاولات الدخول الفاشلة", "Failed logins"), value: fmtNumber(txn.failedLogins) },
    { label: pick("السرعة (آخر ساعة)", "Velocity (1h)"), value: fmtNumber(txn.velocity1h) },
    {
      label: pick("الموقع مألوف", "Location familiar"),
      value: txn.locationFamiliar ? pick("نعم", "Yes") : pick("لا", "No"),
    },
    {
      label: pick("الوقت مألوف", "Time familiar"),
      value: txn.timeFamiliar ? pick("نعم", "Yes") : pick("لا", "No"),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-muted">
        <Link href="/transactions" className="transition-colors hover:text-slate-900">
          {t("nav.transactions")}
        </Link>
        <ChevronLeft className="size-4 rtl:hidden" />
        <ChevronRight className="hidden size-4 rtl:block" />
        <span className="font-mono text-slate-700">{txn.id}</span>
      </nav>

      <PageHeader
        title={`${t("page.analysis.title")} · ${txn.id}`}
        subtitle={`${fmtNumber(txn.amount)} ${txn.currency} · ${fmtDateTime(txn.timestamp, lang)}`}
        actions={
          <div className="flex items-center gap-2">
            <DecisionBadge decision={txn.originalDecision} />
            <ArrowRight className="size-4 text-muted rtl:rotate-180" />
            <DecisionBadge decision={ai.recommendation} />
          </div>
        }
      />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="space-y-6"
      >
        {/* False positive banner */}
        {txn.isFalsePositive && (
          <div className="flex items-start gap-3 rounded-2xl border border-coral-500/40 bg-coral-500/10 p-4 text-coral-200">
            <ShieldAlert className="mt-0.5 size-5 shrink-0 text-coral-600" />
            <div>
              <p className="text-sm font-semibold text-coral-200">
                {pick(
                  "عملية سليمة كان من المتوقع رفضها",
                  "Legitimate transaction set to be declined",
                )}
              </p>
              <p className="mt-0.5 text-xs text-coral-200/80">
                {pick(
                  "يوصي الذكاء الاصطناعي بمعاملة مختلفة عن قرار المحرك التقليدي لتفادي رفض خاطئ.",
                  "The AI recommends a different treatment than the legacy engine to avoid a false decline.",
                )}
              </p>
            </div>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left / main column */}
          <div className="space-y-6 lg:col-span-2">
            {/* Comparison card */}
            <Card className="p-5">
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="flex flex-col items-center gap-3 rounded-2xl border border-navy-700/60 bg-navy-900/40 p-4">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                    {pick("المحرك التقليدي", "Legacy engine")}
                  </span>
                  <RiskGauge score={txn.originalRiskScore} label={t("common.originalScore")} />
                  <DecisionBadge decision={txn.originalDecision} />
                </div>
                <div className="flex flex-col items-center gap-3 rounded-2xl border border-coral-500/30 bg-coral-500/5 p-4">
                  <span className="text-xs font-semibold uppercase tracking-wide text-coral-600">
                    {pick("ZeRisk", "ZeRisk")}
                  </span>
                  <RiskGauge score={ai.optimizedRiskScore} label={t("common.optimizedScore")} />
                  <DecisionBadge decision={ai.recommendation} />
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <BigStat
                  label={t("common.fpProbability")}
                  value={fmtPercent(ai.falsePositiveProbability, 0)}
                  color="#fb7185"
                />
                <BigStat
                  label={t("common.confidence")}
                  value={fmtPercent(ai.confidence, 0)}
                  color="#34d399"
                />
              </div>
            </Card>

            {/* Risk breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>{pick("تفصيل المخاطر", "Risk breakdown")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3.5">
                {breakdownItems.map((item) => {
                  const val = ai.riskBreakdown[item.key];
                  const color = riskColor(val);
                  return (
                    <div key={item.key}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="text-slate-700">{pick(item.ar, item.en)}</span>
                        <span className="tabular-nums text-muted">{Math.round(val)}/100</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-navy-700/70">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ backgroundColor: color }}
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.max(0, Math.min(100, val))}%` }}
                          transition={{ duration: 0.8, ease: "easeOut" }}
                        />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Explainable AI */}
            <Card>
              <CardHeader>
                <CardTitle>{pick("الذكاء القابل للتفسير", "Explainable AI")}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-4">
                  <SectionTitle className="text-emerald-700">
                    {pick("أسباب تدعم الموافقة", "Reasons supporting approval")}
                  </SectionTitle>
                  <ul className="space-y-2.5">
                    {ai.supporting.length === 0 && (
                      <li className="text-xs text-muted">{pick("لا يوجد", "None")}</li>
                    )}
                    {ai.supporting.map((r) => (
                      <li key={r.code} className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                        <div>
                          <p className="text-sm text-slate-700">{pick(r.ar, r.en)}</p>
                          <Badge variant="muted" className="mt-1 font-mono text-[10px]">
                            {r.code}
                          </Badge>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4">
                  <SectionTitle className="text-amber-700">
                    {pick("أسباب ترفع المخاطر", "Reasons increasing risk")}
                  </SectionTitle>
                  <ul className="space-y-2.5">
                    {ai.increasing.length === 0 && (
                      <li className="text-xs text-muted">{pick("لا يوجد", "None")}</li>
                    )}
                    {ai.increasing.map((r) => (
                      <li key={r.code} className="flex items-start gap-2">
                        <XCircle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                        <div>
                          <p className="text-sm text-slate-700">{pick(r.ar, r.en)}</p>
                          <Badge variant="muted" className="mt-1 font-mono text-[10px]">
                            {r.code}
                          </Badge>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Profiles */}
            <Card>
              <CardHeader>
                <CardTitle>{pick("ملف العميل والإشارات", "Customer profile & signals")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <SectionTitle className="flex items-center gap-1.5">
                    <UserCheck className="size-3.5" /> {pick("العميل", "Customer")}
                  </SectionTitle>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                    <Stat label={pick("الاسم", "Name")} value={pick(txn.customer.name, txn.customer.nameEn)} />
                    <Stat label={pick("الشريحة", "Segment")} value={tr(SEGMENT_LABEL[txn.customer.segment])} />
                    <Stat
                      label={pick("عمر الحساب", "Account age")}
                      value={`${fmtNumber(txn.customer.accountAgeMonths)} ${pick("شهر", "mo")}`}
                    />
                    <Stat
                      label={pick("متوسط المبلغ", "Avg amount")}
                      value={fmtNumber(txn.customer.avgTxnAmount)}
                    />
                    <Stat label={pick("درجة الثقة", "Trust score")} value={`${txn.customer.trustScore}`} />
                    <Stat
                      label={pick("مدينة الإقامة", "Home city")}
                      value={pick(txn.customer.homeCity, txn.customer.homeCityEn)}
                    />
                  </div>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <SectionTitle className="flex items-center gap-1.5">
                      <Smartphone className="size-3.5" /> {pick("ثقة الجهاز", "Device trust")}
                    </SectionTitle>
                    <div className="grid grid-cols-2 gap-3">
                      <Stat
                        label={pick("الحالة", "Status")}
                        value={txn.device.known ? pick("معروف", "Known") : pick("جديد", "New")}
                      />
                      <Stat label={pick("عدد العمليات", "Txn count")} value={fmtNumber(txn.device.txnCount)} />
                      <Stat label={pick("درجة الثقة", "Trust score")} value={`${txn.device.trustScore}`} />
                      <Stat
                        label={pick("أول ظهور", "First seen")}
                        value={`${fmtNumber(txn.device.firstSeenDaysAgo)} ${pick("يوم", "d")}`}
                      />
                    </div>
                  </div>
                  <div>
                    <SectionTitle className="flex items-center gap-1.5">
                      <Building2 className="size-3.5" /> {pick("ثقة المستفيد", "Beneficiary trust")}
                    </SectionTitle>
                    <div className="grid grid-cols-2 gap-3">
                      <Stat
                        label={pick("الحالة", "Status")}
                        value={txn.beneficiary.known ? pick("معروف", "Known") : pick("جديد", "New")}
                      />
                      <Stat label={pick("النوع", "Type")} value={txn.beneficiary.type} />
                      <Stat
                        label={pick("عدد العمليات", "Txn count")}
                        value={fmtNumber(txn.beneficiary.txnCount)}
                      />
                      <Stat label={pick("درجة الثقة", "Trust score")} value={`${txn.beneficiary.trustScore}`} />
                    </div>
                  </div>
                </div>

                <div>
                  <SectionTitle className="flex items-center gap-1.5">
                    <Activity className="size-3.5" /> {pick("الإشارات السلوكية", "Behavioral signals")}
                  </SectionTitle>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                    {behavioralSignals.map((s) => (
                      <Stat key={s.label} label={s.label} value={s.value} />
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Triggered rules */}
            <Card>
              <CardHeader>
                <CardTitle>{pick("القواعد المُفعّلة", "Triggered rules")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {txn.rules.length === 0 && (
                  <p className="text-sm text-muted">{pick("لم تُفعّل أي قاعدة", "No rules triggered")}</p>
                )}
                {txn.rules.map((r) => (
                  <div
                    key={r.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-navy-700/60 bg-navy-900/40 p-3"
                  >
                    <div>
                      <span className="font-mono text-xs text-coral-600">{r.id}</span>
                      <span className="ms-2 text-sm text-slate-700">{pick(r.name, r.nameEn)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={SEVERITY_VARIANT[r.severity]}>{tr(SEVERITY_LABEL[r.severity])}</Badge>
                      <DecisionBadge decision={r.action} showIcon={false} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Right / actions column */}
          <div className="space-y-6">
            {/* Actions */}
            <Card className="p-5">
              <SectionTitle>{pick("الإجراءات", "Actions")}</SectionTitle>

              {txn.feedback && (
                <div className="mb-3 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3 text-xs text-emerald-200">
                  <p className="font-semibold">
                    {pick("النتيجة المسجلة:", "Recorded outcome:")}{" "}
                    {tr(OUTCOME_LABEL[txn.feedback.outcome])}
                  </p>
                  {txn.feedback.note && <p className="mt-1 text-emerald-200/80">{txn.feedback.note}</p>}
                  <p className="mt-1 text-emerald-200/60">
                    {txn.feedback.investigator} · {fmtDateTime(txn.feedback.at, lang)}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Button
                  className="w-full"
                  disabled={isPending}
                  onClick={() =>
                    run(
                      "apply",
                      () => applyRecommendationAction(txn.id),
                      pick("تم تطبيق توصية الذكاء الاصطناعي", "AI recommendation applied"),
                      `${tr(DECISION_LABEL[ai.recommendation])}`,
                    )
                  }
                >
                  <ThumbsUp className="size-4" />
                  {pick("تطبيق توصية الذكاء الاصطناعي", "Accept AI recommendation")}
                  {pendingAction === "apply" && <span className="ms-1 animate-pulse">…</span>}
                </Button>
                <Button
                  variant="secondary"
                  className="w-full"
                  disabled={isPending}
                  onClick={() =>
                    run(
                      "keep",
                      () => keepOriginalAction(txn.id),
                      pick("تم الإبقاء على القرار الأصلي", "Original decision kept"),
                    )
                  }
                >
                  <CheckCircle2 className="size-4" />
                  {pick("الإبقاء على القرار الأصلي", "Keep original decision")}
                  {pendingAction === "keep" && <span className="ms-1 animate-pulse">…</span>}
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={isPending}
                  onClick={() =>
                    run(
                      "review",
                      () => sendToReviewAction(txn.id),
                      pick("تم الإرسال للمراجعة", "Sent to review"),
                    )
                  }
                >
                  <Search className="size-4" />
                  {pick("إرسال للمراجعة", "Send to review")}
                  {pendingAction === "review" && <span className="ms-1 animate-pulse">…</span>}
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={isPending}
                  onClick={() =>
                    run(
                      "fp",
                      () => markFalsePositiveAction(txn.id),
                      pick("تم وسمها كرفض خاطئ", "Marked as false positive"),
                    )
                  }
                >
                  <ShieldAlert className="size-4" />
                  {pick("وسم كرفض خاطئ", "Mark as false positive")}
                  {pendingAction === "fp" && <span className="ms-1 animate-pulse">…</span>}
                </Button>
                <Button
                  variant="destructive"
                  className="w-full"
                  disabled={isPending}
                  onClick={() =>
                    run(
                      "fraud",
                      () => markConfirmedFraudAction(txn.id),
                      pick("تم تأكيد الاحتيال", "Confirmed fraud recorded"),
                    )
                  }
                >
                  <Flag className="size-4" />
                  {pick("تأكيد الاحتيال", "Mark as confirmed fraud")}
                  {pendingAction === "fraud" && <span className="ms-1 animate-pulse">…</span>}
                </Button>
                <Button
                  variant="ghost"
                  className="w-full"
                  disabled={isPending}
                  onClick={() => setNoteOpen(true)}
                >
                  <StickyNote className="size-4" />
                  {pick("إضافة ملاحظة المحقق", "Add investigator note")}
                </Button>
              </div>
            </Card>

            {/* Meta */}
            <Card className="p-5">
              <SectionTitle className="flex items-center gap-1.5">
                <Cpu className="size-3.5" /> {pick("بيانات المعالجة", "Processing")}
              </SectionTitle>
              <div className="grid grid-cols-2 gap-3">
                <Stat label={pick("زمن المعالجة", "Processing time")} value={`${ai.processingTimeMs} ms`} />
                <Stat label={pick("القناة", "Channel")} value={tr(CHANNEL_LABEL[txn.channel])} />
              </div>
            </Card>

            {/* Similar */}
            <Card className="p-5">
              <SectionTitle>
                {pick("عمليات تاريخية مشابهة", "Similar historical transactions")}
              </SectionTitle>
              {similar.length === 0 ? (
                <p className="text-sm text-muted">{pick("لا يوجد", "None")}</p>
              ) : (
                <ul className="space-y-2">
                  {similar.map((s) => (
                    <li key={s.id}>
                      <Link
                        href={`/transactions/${s.id}`}
                        className="flex items-center justify-between gap-2 rounded-xl border border-navy-700/60 bg-navy-900/40 p-3 transition-colors hover:border-coral-500/40 hover:bg-navy-800/60"
                      >
                        <div>
                          <span className="font-mono text-xs text-coral-600">{s.id}</span>
                          <span className="block text-xs text-muted">
                            {fmtNumber(s.amount)} {s.currency} · {fmtDateTime(s.timestamp, lang)}
                          </span>
                        </div>
                        <span
                          className="inline-flex min-w-8 items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums"
                          style={{
                            color: riskColor(s.optimizedRiskScore),
                            backgroundColor: `${riskColor(s.optimizedRiskScore)}1a`,
                          }}
                        >
                          {Math.round(s.optimizedRiskScore)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>

        <DisclaimerBar />
      </motion.div>

      <Dialog
        open={noteOpen}
        onClose={() => setNoteOpen(false)}
        title={pick("إضافة ملاحظة المحقق", "Add investigator note")}
        description={pick(
          "ستُسجّل الملاحظة ضمن حلقة تغذية التحقيقات.",
          "The note will be recorded in the investigation feedback loop.",
        )}
      >
        <div className="space-y-4">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={pick("اكتب ملاحظتك…", "Write your note…")}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setNoteOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={submitNote} disabled={isPending || !note.trim()}>
              {t("common.save")}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
