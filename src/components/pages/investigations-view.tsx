"use client";

import * as React from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Inbox,
  CheckCircle2,
  ShieldAlert,
  ShieldCheck,
  ThumbsUp,
  ThumbsDown,
  HelpCircle,
  Timer,
  ArrowLeft,
  ExternalLink,
  ChevronDown,
  Receipt,
  Sparkles,
  UserSearch,
  Database,
  Wrench,
} from "lucide-react";
import { KpiCard } from "@/components/shared/kpi-card";
import { PageHeader, DisclaimerBar, SectionTitle, EmptyState } from "@/components/shared/misc";
import { DecisionBadge } from "@/components/shared/decision-badge";
import { RiskGauge } from "@/components/shared/risk-gauge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/input";
import { Separator } from "@/components/ui/misc";
import { useI18n, useToast } from "@/providers";
import { OUTCOME_LABEL, SEGMENT_LABEL, CHANNEL_LABEL } from "@/lib/i18n";
import { fmtCurrency, fmtNumber, fmtTimeAgo } from "@/lib/format";
import { submitFeedbackAction } from "@/app/actions";
import type {
  Channel,
  CustomerSegment,
  Decision,
  InvestigationOutcome,
  ScenarioType,
} from "@/lib/types";

type ResolvableOutcome = "LEGITIMATE" | "CONFIRMED_FRAUD" | "INCONCLUSIVE";

export interface InvestigationCase {
  id: string;
  amount: number;
  currency: string;
  channel: Channel;
  customerName: string;
  customerNameEn: string;
  segment: CustomerSegment;
  originalDecision: Decision;
  originalRiskScore: number;
  aiRecommendation: Decision;
  optimizedRiskScore: number;
  falsePositiveProbability: number;
  isActuallyFraud: boolean;
  isFalsePositive: boolean;
  scenario: ScenarioType;
  supporting: { ar: string; en: string }[];
  increasing: { ar: string; en: string }[];
  similarIds: string[];
  feedback: {
    outcome: InvestigationOutcome;
    note?: string;
    investigator: string;
    resolutionMinutes: number;
    at: string;
  } | null;
}

const OUTCOME_BADGE: Record<InvestigationOutcome, "success" | "danger" | "warning" | "muted"> = {
  LEGITIMATE: "success",
  CONFIRMED_FRAUD: "danger",
  INCONCLUSIVE: "warning",
  PENDING: "muted",
};

export function InvestigationsView({ cases }: { cases: InvestigationCase[] }) {
  const { t, lang, pick, tr } = useI18n();
  const { toast } = useToast();
  const [filter, setFilter] = React.useState<"pending" | "resolved">("pending");
  // Optimistic local overlay for freshly-submitted resolutions.
  const [local, setLocal] = React.useState<Record<string, InvestigationCase["feedback"]>>({});
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const merged = React.useMemo(
    () => cases.map((c) => (local[c.id] ? { ...c, feedback: local[c.id] } : c)),
    [cases, local],
  );

  const resolvedList = merged.filter((c) => c.feedback);
  const pendingList = merged.filter((c) => !c.feedback);

  const kpi = {
    open: pendingList.length,
    resolved: resolvedList.length,
    confirmedFraud: resolvedList.filter((c) => c.feedback?.outcome === "CONFIRMED_FRAUD").length,
    falsePositives: resolvedList.filter((c) => c.feedback?.outcome === "LEGITIMATE").length,
  };

  const shown = filter === "pending" ? pendingList : resolvedList;

  function submit(c: InvestigationCase, outcome: ResolvableOutcome, note: string) {
    setBusyId(c.id);
    startTransition(async () => {
      await submitFeedbackAction(c.id, outcome, note);
      setLocal((prev) => ({
        ...prev,
        [c.id]: {
          outcome,
          note,
          investigator: "Investigator",
          resolutionMinutes: 12,
          at: new Date().toISOString(),
        },
      }));
      setBusyId(null);
      setOpenId(null);
      toast({
        kind: outcome === "CONFIRMED_FRAUD" ? "warning" : "success",
        title: pick("تم تسجيل القرار", "Decision recorded"),
        description: `${c.id} — ${tr(OUTCOME_LABEL[outcome])}`,
      });
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("page.investigations.title")}
        subtitle={t("page.investigations.subtitle")}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label={pick("حالات مفتوحة", "Open cases")} value={fmtNumber(kpi.open)} Icon={Inbox} accent="amber" delay={0.02} />
        <KpiCard label={pick("حالات محلولة", "Resolved")} value={fmtNumber(kpi.resolved)} Icon={CheckCircle2} accent="emerald" delay={0.04} />
        <KpiCard label={pick("احتيال مؤكد", "Confirmed fraud")} value={fmtNumber(kpi.confirmedFraud)} Icon={ShieldAlert} accent="rose" delay={0.06} />
        <KpiCard label={pick("رفض خاطئ مكتشف", "False positives found")} value={fmtNumber(kpi.falsePositives)} Icon={ShieldCheck} accent="sky" delay={0.08} />
      </div>

      {/* Feedback loop visualization */}
      <FeedbackLoop />

      {/* Filter + queue */}
      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <SectionTitle className="mb-0">{pick("قائمة عمل المحققين", "Investigator work queue")}</SectionTitle>
          <div className="inline-flex items-center gap-1 rounded-xl border border-navy-600 bg-navy-900/50 p-1">
            <button
              onClick={() => setFilter("pending")}
              className={
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-all " +
                (filter === "pending" ? "grad-coral text-white shadow" : "text-muted hover:text-slate-900")
              }
            >
              {pick("قيد الانتظار", "Pending")} ({pendingList.length})
            </button>
            <button
              onClick={() => setFilter("resolved")}
              className={
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-all " +
                (filter === "resolved" ? "grad-coral text-white shadow" : "text-muted hover:text-slate-900")
              }
            >
              {pick("محلولة", "Resolved")} ({resolvedList.length})
            </button>
          </div>
        </div>

        {shown.length === 0 ? (
          <Card className="p-5">
            <EmptyState
              title={filter === "pending" ? pick("لا توجد حالات معلّقة", "No pending cases") : pick("لا توجد حالات محلولة بعد", "No resolved cases yet")}
              hint={pick("جميع الحالات في هذه القائمة تمت معالجتها.", "All cases in this view are processed.")}
            />
          </Card>
        ) : (
          <div className="space-y-2.5">
            {shown.map((c, i) => (
              <CaseRow
                key={c.id}
                c={c}
                index={i}
                lang={lang}
                pick={pick}
                tr={tr}
                open={openId === c.id}
                onToggle={() => setOpenId((prev) => (prev === c.id ? null : c.id))}
                onSubmit={submit}
                busy={pending && busyId === c.id}
              />
            ))}
          </div>
        )}
      </div>

      <DisclaimerBar />
    </div>
  );
}

// ---------------------------------------------------------------------------

function CaseRow({
  c,
  index,
  lang,
  pick,
  tr,
  open,
  onToggle,
  onSubmit,
  busy,
}: {
  c: InvestigationCase;
  index: number;
  lang: "ar" | "en";
  pick: (ar: string, en: string) => string;
  tr: (v: { ar: string; en: string }) => string;
  open: boolean;
  onToggle: () => void;
  onSubmit: (c: InvestigationCase, outcome: ResolvableOutcome, note: string) => void;
  busy: boolean;
}) {
  const [note, setNote] = React.useState("");
  const resolved = c.feedback;
  const name = lang === "ar" ? c.customerName : c.customerNameEn;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.03, 0.3) }}
      className="surface card-hover overflow-hidden rounded-2xl"
    >
      {/* Summary row */}
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 p-4 text-start"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-navy-800 text-coral-600">
          <UserSearch className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-semibold text-slate-900">{c.id}</span>
            <Badge variant="muted">{tr(SEGMENT_LABEL[c.segment])}</Badge>
            <span className="hidden text-xs text-muted sm:inline">{tr(CHANNEL_LABEL[c.channel])}</span>
          </div>
          <p className="truncate text-xs text-muted">{name}</p>
        </div>
        <div className="hidden text-end md:block">
          <p className="text-sm font-semibold text-slate-900 tabular-nums">{fmtCurrency(c.amount, lang)}</p>
          <p className="text-[11px] text-muted">{pick("المبلغ", "Amount")}</p>
        </div>
        <div className="hidden items-center gap-2 lg:flex">
          <DecisionBadge decision={c.aiRecommendation} />
        </div>
        {resolved ? (
          <Badge variant={OUTCOME_BADGE[resolved.outcome]}>{tr(OUTCOME_LABEL[resolved.outcome])}</Badge>
        ) : (
          <Badge variant="warning">{tr(OUTCOME_LABEL.PENDING)}</Badge>
        )}
        <ChevronDown className={"size-4 shrink-0 text-muted transition-transform " + (open ? "rotate-180" : "")} />
      </button>

      {open && (
        <div className="border-t border-navy-700/50 p-4">
          <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
            {/* Left: details */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <MiniStat label={pick("القرار الأصلي", "Original")} value={<DecisionBadge decision={c.originalDecision} />} />
                <MiniStat label={pick("توصية AI", "AI reco")} value={<DecisionBadge decision={c.aiRecommendation} />} />
                <MiniStat label={pick("درجة أصلية", "Orig. score")} value={<span className="tabular-nums">{c.originalRiskScore}</span>} />
                <MiniStat label={pick("درجة محسّنة", "Optimized")} value={<span className="tabular-nums">{c.optimizedRiskScore}</span>} />
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <MiniStat label={pick("المبلغ", "Amount")} value={fmtCurrency(c.amount, lang)} />
                <MiniStat label={pick("القناة", "Channel")} value={tr(CHANNEL_LABEL[c.channel])} />
                <MiniStat label={pick("احتمالية رفض خاطئ", "FP prob.")} value={<span className="tabular-nums">{c.falsePositiveProbability}%</span>} />
                <MiniStat label={pick("زمن الحل", "Resolution time")} value={<span className="tabular-nums">{resolved?.resolutionMinutes ?? 12} {pick("د", "min")}</span>} />
              </div>

              {/* Evidence */}
              <div className="grid gap-3 sm:grid-cols-2">
                <EvidenceList
                  title={pick("مؤشرات داعمة للسلامة", "Supporting evidence")}
                  items={c.supporting.map((r) => tr(r))}
                  tone="emerald"
                />
                <EvidenceList
                  title={pick("مؤشرات ترفع المخاطر", "Risk-increasing evidence")}
                  items={c.increasing.map((r) => tr(r))}
                  tone="rose"
                />
              </div>

              {/* Similar cases */}
              {c.similarIds.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-medium text-muted">{pick("حالات مشابهة", "Similar cases")}</p>
                  <div className="flex flex-wrap gap-2">
                    {c.similarIds.map((id) => (
                      <Link
                        key={id}
                        href={`/transactions/${id}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-navy-600 bg-navy-900/50 px-2.5 py-1 font-mono text-xs text-sky-700 transition hover:border-sky-500/40 hover:bg-sky-500/5"
                      >
                        <ExternalLink className="size-3" />
                        {id}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right: decision panel */}
            <div className="space-y-3 rounded-xl border border-navy-700/60 bg-navy-900/40 p-4">
              <div className="flex items-center justify-center">
                <RiskGauge score={c.optimizedRiskScore} size={92} label={pick("مخاطر محسّنة", "Optimized")} />
              </div>
              <Separator />

              {resolved ? (
                <div className="space-y-2 text-center">
                  <Badge variant={OUTCOME_BADGE[resolved.outcome]}>
                    <CheckCircle2 className="size-3" />
                    {tr(OUTCOME_LABEL[resolved.outcome])}
                  </Badge>
                  <p className="text-xs text-muted">
                    <Timer className="me-1 inline size-3" />
                    {pick("تم الحل خلال", "Resolved in")} {resolved.resolutionMinutes} {pick("دقيقة", "min")} — {fmtTimeAgo(resolved.at, lang)}
                  </p>
                  {resolved.note && (
                    <p className="rounded-lg bg-navy-800/60 p-2 text-start text-xs text-slate-600">{resolved.note}</p>
                  )}
                  <p className="text-[11px] text-muted">{pick("بواسطة", "by")} {resolved.investigator}</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <p className="text-xs font-medium text-muted">{pick("قرار المحقق", "Investigator decision")}</p>
                  <Textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={pick("أضف ملاحظة التحقيق…", "Add investigation note…")}
                    className="min-h-16"
                  />
                  <div className="grid gap-2">
                    <Button variant="success" size="sm" disabled={busy} onClick={() => onSubmit(c, "LEGITIMATE", note)}>
                      <ThumbsUp className="size-4" />
                      {pick("سليمة", "Legitimate")}
                    </Button>
                    <Button variant="destructive" size="sm" disabled={busy} onClick={() => onSubmit(c, "CONFIRMED_FRAUD", note)}>
                      <ThumbsDown className="size-4" />
                      {pick("احتيال مؤكد", "Confirmed fraud")}
                    </Button>
                    <Button variant="outline" size="sm" disabled={busy} onClick={() => onSubmit(c, "INCONCLUSIVE", note)}>
                      <HelpCircle className="size-4" />
                      {pick("غير حاسمة", "Inconclusive")}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </motion.div>
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

function EvidenceList({ title, items, tone }: { title: string; items: string[]; tone: "emerald" | "rose" }) {
  const dot = tone === "emerald" ? "bg-emerald-400" : "bg-rose-400";
  return (
    <div className="rounded-xl border border-navy-700/60 bg-navy-900/40 p-3">
      <p className="mb-2 text-xs font-medium text-muted">{title}</p>
      {items.length === 0 ? (
        <p className="text-xs text-muted">—</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((it, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-slate-700">
              <span className={"mt-1.5 size-1.5 shrink-0 rounded-full " + dot} />
              <span>{it}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function FeedbackLoop() {
  const { pick } = useI18n();
  const steps = [
    { icon: Receipt, ar: "العملية", en: "Transaction", accent: "text-sky-700 bg-sky-500/10 border-sky-500/30" },
    { icon: ShieldAlert, ar: "محرك الاحتيال", en: "Fraud Engine", accent: "text-amber-700 bg-amber-500/10 border-amber-500/30" },
    { icon: Sparkles, ar: "ZeRisk", en: "ZeRisk", accent: "text-coral-600 bg-coral-500/10 border-coral-500/30" },
    { icon: UserSearch, ar: "المحقق", en: "Investigator", accent: "text-violet-700 bg-violet-500/10 border-violet-500/30" },
    { icon: Database, ar: "بيانات التعلّم", en: "Learning Dataset", accent: "text-emerald-700 bg-emerald-500/10 border-emerald-500/30" },
    { icon: Wrench, ar: "تحسين القواعد", en: "Rule Optimization", accent: "text-rose-700 bg-rose-500/10 border-rose-500/30" },
  ];
  return (
    <Card className="p-5">
      <SectionTitle>{pick("حلقة التعلّم", "The learning loop")}</SectionTitle>
      <div className="flex flex-wrap items-stretch gap-2">
        {steps.map((s, i) => (
          <React.Fragment key={s.en}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.06 }}
              className={"flex min-w-[7.5rem] flex-1 items-center gap-2 rounded-xl border px-3 py-2.5 " + s.accent}
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
          "كل قرار يتخذه المحقق يُغذّي بيانات التعلّم، فتتحسّن توصيات القواعد تلقائيًا في الدورة التالية.",
          "Every investigator decision feeds the learning dataset, so rule recommendations improve automatically on the next cycle.",
        )}
      </p>
    </Card>
  );
}
