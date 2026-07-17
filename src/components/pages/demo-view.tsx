"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Ban,
  CheckCircle2,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  UserCheck,
  Fingerprint,
  Activity,
  History,
  Sparkles,
  Wallet,
  HeartHandshake,
  ShieldHalf,
  Users,
  Layers,
  TrendingUp,
  Target,
  Coins,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PageHeader, DisclaimerBar } from "@/components/shared/misc";
import { RiskGauge } from "@/components/shared/risk-gauge";
import { DecisionBadge } from "@/components/shared/decision-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/providers";
import { DECISION_LABEL, SEGMENT_LABEL, CHANNEL_LABEL, SEVERITY_LABEL } from "@/lib/i18n";
import { fmtCurrency, fmtNumber, fmtPercent, compactCurrency } from "@/lib/format";

// ---- Serializable props from the server (LIVE engine values) ----------------

export interface DemoKpi {
  manualReviewReductionPct: number;
  fpRateBefore: number;
  fpRateAfter: number;
  revenueRecovered: number;
  recoveredTransactions: number;
}

export interface DemoStoryData {
  id: string;
  amount: number;
  currency: string;
  channel: string;
  kpi: DemoKpi;
  timestamp: string;
  originalDecision: "APPROVE" | "REVIEW" | "REJECT" | "MONITOR";
  originalRiskScore: number;
  triggeredRuleIds: string[];
  customer: {
    name: string;
    nameEn: string;
    segment: string;
    accountAgeMonths: number;
    homeCity: string;
    homeCityEn: string;
    avgTxnAmount: number;
  };
  device: { label: string; known: boolean; trustScore: number };
  beneficiary: {
    name: string;
    nameEn: string;
    bank: string;
    known: boolean;
    trustScore: number;
  };
  mfaPassed: boolean;
  rules: { id: string; name: string; nameEn: string; severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" }[];
  ai: {
    optimizedRiskScore: number;
    falsePositiveProbability: number;
    recommendation: "APPROVE" | "REVIEW" | "REJECT" | "MONITOR";
    confidence: number;
    supporting: { code: string; ar: string; en: string; weight: number }[];
    processingTimeMs: number;
  };
}

const TOTAL_STEPS = 5;

const stepIn = {
  initial: { opacity: 0, y: 26, filter: "blur(6px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  exit: { opacity: 0, y: -26, filter: "blur(6px)" },
};

export function DemoView({ data }: { data: DemoStoryData }) {
  const { t, lang, pick, tr } = useI18n();
  const [step, setStep] = useState(1);

  const customerName = pick(data.customer.name, data.customer.nameEn);
  const beneficiaryName = pick(data.beneficiary.name, data.beneficiary.nameEn);
  const city = pick(data.customer.homeCity, data.customer.homeCityEn);
  const savedDelta = data.originalRiskScore - data.ai.optimizedRiskScore;

  const stepLabels: { ar: string; en: string }[] = [
    { ar: "المشكلة التجارية", en: "The business problem" },
    { ar: "قرار محرك الاحتيال الأصلي", en: "Original engine decision" },
    { ar: "تحليل ZeRisk", en: "ZeRisk analysis" },
    { ar: "توصية الذكاء الاصطناعي", en: "AI recommendation" },
    { ar: "الأثر التجاري", en: "Business impact" },
  ];

  const goNext = () => setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  const goPrev = () => setStep((s) => Math.max(1, s - 1));
  const restart = () => setStep(1);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("page.demo.title")}
        subtitle={t("page.demo.subtitle")}
        actions={
          <Button variant="outline" size="sm" onClick={restart}>
            <RotateCcw className="size-4" />
            {pick("إعادة التشغيل", "Restart")}
          </Button>
        }
      />

      {/* Stepper progress */}
      <div className="surface rounded-2xl p-4">
        <div className="flex items-center justify-between gap-1 sm:gap-2">
          {stepLabels.map((label, i) => {
            const idx = i + 1;
            const active = idx === step;
            const done = idx < step;
            return (
              <div key={idx} className="flex flex-1 items-center gap-1 sm:gap-2">
                <button
                  onClick={() => setStep(idx)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-start"
                >
                  <span
                    className={[
                      "grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold transition-all",
                      active
                        ? "grad-coral text-white shadow-lg shadow-coral-600/30 scale-110"
                        : done
                          ? "bg-emerald-500/20 text-emerald-700"
                          : "bg-navy-800 text-muted",
                    ].join(" ")}
                  >
                    {done ? <CheckCircle2 className="size-4" /> : idx}
                  </span>
                  <span
                    className={[
                      "hidden truncate text-xs font-medium lg:block",
                      active ? "text-slate-900" : "text-muted",
                    ].join(" ")}
                  >
                    {tr(label)}
                  </span>
                </button>
                {idx < TOTAL_STEPS && (
                  <span
                    className={[
                      "h-0.5 flex-1 rounded-full transition-colors",
                      done ? "bg-emerald-500/50" : "bg-navy-700",
                    ].join(" ")}
                  />
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-muted">
          <span>
            {pick("الخطوة", "Step")} {step} {t("common.of")} {TOTAL_STEPS}
          </span>
          <span className="font-mono text-coral-600">{data.id}</span>
        </div>
      </div>

      {/* Step stage */}
      <div className="relative min-h-[30rem]">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            variants={stepIn}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            {step === 1 && (
              <Step1
                amount={data.amount}
                currency={data.currency}
                customerName={customerName}
                segment={tr(SEGMENT_LABEL[data.customer.segment])}
                city={city}
                channel={tr(CHANNEL_LABEL[data.channel])}
                beneficiaryName={beneficiaryName}
              />
            )}
            {step === 2 && (
              <Step2
                originalRiskScore={data.originalRiskScore}
                rules={data.rules}
                decisionLabel={tr(DECISION_LABEL[data.originalDecision])}
              />
            )}
            {step === 3 && <Step3 supporting={data.ai.supporting} />}
            {step === 4 && (
              <Step4
                originalRiskScore={data.originalRiskScore}
                optimizedRiskScore={data.ai.optimizedRiskScore}
                falsePositiveProbability={data.ai.falsePositiveProbability}
                recommendation={data.ai.recommendation}
                confidence={data.ai.confidence}
                savedDelta={savedDelta}
                processingTimeMs={data.ai.processingTimeMs}
              />
            )}
            {step === 5 && <Step5 amount={data.amount} customerName={customerName} kpi={data.kpi} onRestart={restart} />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Nav controls */}
      <div className="flex items-center justify-between gap-3">
        <Button variant="subtle" onClick={goPrev} disabled={step === 1}>
          {lang === "ar" ? <ArrowRight className="size-4" /> : <ArrowLeft className="size-4" />}
          {t("common.prev")}
        </Button>
        <div className="flex items-center gap-1.5">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i + 1)}
              className={[
                "h-2 rounded-full transition-all",
                i + 1 === step ? "w-7 grad-coral" : "w-2 bg-navy-700 hover:bg-navy-600",
              ].join(" ")}
              aria-label={`step ${i + 1}`}
            />
          ))}
        </div>
        {step < TOTAL_STEPS ? (
          <Button onClick={goNext}>
            {t("common.next")}
            {lang === "ar" ? <ArrowLeft className="size-4" /> : <ArrowRight className="size-4" />}
          </Button>
        ) : (
          <Button variant="success" onClick={restart}>
            <RotateCcw className="size-4" />
            {pick("إعادة التشغيل", "Restart")}
          </Button>
        )}
      </div>

      <DisclaimerBar />
    </div>
  );
}

// ---- Shared hero shell -------------------------------------------------------

function StepShell({
  eyebrow,
  Icon,
  accent,
  children,
}: {
  eyebrow: string;
  Icon: LucideIcon;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div className="surface relative overflow-hidden rounded-2xl p-6 sm:p-8">
      <div
        className="pointer-events-none absolute -end-16 -top-16 size-64 rounded-full blur-3xl"
        style={{ background: accent }}
      />
      <div className="relative">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-navy-600 bg-navy-900/60 px-3 py-1.5">
          <Icon className="size-4" style={{ color: accent.replace(/0\.\d+/, "1") }} />
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            {eyebrow}
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}

// ---- Step 1: the business problem -------------------------------------------

function Step1({
  amount,
  currency,
  customerName,
  segment,
  city,
  channel,
  beneficiaryName,
}: {
  amount: number;
  currency: string;
  customerName: string;
  segment: string;
  city: string;
  channel: string;
  beneficiaryName: string;
}) {
  const { lang, pick } = useI18n();
  return (
    <StepShell
      eyebrow={pick("المشكلة", "The problem")}
      Icon={AlertTriangle}
      accent="rgba(251,113,133,0.18)"
    >
      <motion.h2
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="max-w-3xl text-3xl font-bold leading-tight text-slate-900 sm:text-4xl"
      >
        {pick(
          "عميل موثوق حاول تنفيذ عملية سليمة تمامًا — فرفضها النظام.",
          "A trusted customer made a perfectly legitimate transaction — and the system rejected it.",
        )}
      </motion.h2>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.25 }}
        className="mt-3 max-w-2xl text-base leading-relaxed text-muted"
      >
        {pick(
          "كل رفض خاطئ يعني إيرادًا ضائعًا، وعميلًا محبطًا، وعبء مراجعة إضافيًا على الفريق.",
          "Every false decline means lost revenue, a frustrated customer, and extra review workload on the team.",
        )}
      </motion.p>

      <div className="mt-7 grid gap-4 md:grid-cols-[auto_1fr]">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.35, type: "spring", stiffness: 200 }}
          className="grad-coral flex flex-col justify-center rounded-2xl p-6 text-white shadow-xl shadow-coral-600/25"
        >
          <span className="text-xs font-medium uppercase tracking-wide text-white/80">
            {pick("مبلغ العملية", "Transaction amount")}
          </span>
          <span className="mt-1 text-4xl font-extrabold tabular-nums">
            {fmtCurrency(amount, lang)}
          </span>
          <span className="mt-1 text-xs text-white/70">{currency}</span>
        </motion.div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Fact label={pick("العميل", "Customer")} value={customerName} icon={UserCheck} delay={0.4} />
          <Fact label={pick("الشريحة", "Segment")} value={segment} icon={Users} delay={0.45} />
          <Fact label={pick("المدينة", "City")} value={city} icon={Target} delay={0.5} />
          <Fact label={pick("القناة", "Channel")} value={channel} icon={Smartphone} delay={0.55} />
          <Fact
            label={pick("المستفيد", "Beneficiary")}
            value={beneficiaryName}
            icon={Wallet}
            delay={0.6}
            span
          />
        </div>
      </div>
    </StepShell>
  );
}

function Fact({
  label,
  value,
  icon: Icon,
  delay = 0,
  span = false,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  delay?: number;
  span?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className={[
        "rounded-xl border border-navy-700/60 bg-navy-900/40 p-3",
        span ? "col-span-2 sm:col-span-1" : "",
      ].join(" ")}
    >
      <div className="flex items-center gap-1.5 text-muted">
        <Icon className="size-3.5" />
        <span className="text-[11px]">{label}</span>
      </div>
      <p className="mt-1 truncate text-sm font-semibold text-slate-900">{value}</p>
    </motion.div>
  );
}

// ---- Step 2: original engine decision ---------------------------------------

function Step2({
  originalRiskScore,
  rules,
  decisionLabel,
}: {
  originalRiskScore: number;
  rules: { id: string; name: string; nameEn: string; severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" }[];
  decisionLabel: string;
}) {
  const { pick, tr } = useI18n();
  return (
    <StepShell
      eyebrow={pick("محرك الاحتيال التقليدي", "Traditional fraud engine")}
      Icon={Ban}
      accent="rgba(251,113,133,0.18)"
    >
      <div className="grid gap-8 md:grid-cols-[auto_1fr] md:items-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15 }}
          className="flex flex-col items-center gap-3"
        >
          <RiskGauge score={originalRiskScore} size={168} label={pick("درجة المخاطر", "Risk score")} />
          <Badge variant="reject">
            <Ban className="size-3" />
            {decisionLabel}
          </Badge>
        </motion.div>

        <div>
          <motion.h2
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-2xl font-bold text-slate-900 sm:text-3xl"
          >
            {pick(
              "قام المحرك التقليدي برفض العملية بناءً على قواعد ثابتة.",
              "The legacy engine rejected the transaction based on static rules.",
            )}
          </motion.h2>
          <p className="mt-2 text-sm text-muted">
            {pick(
              "القواعد التالية تم تفعيلها ودفعت درجة المخاطر إلى مستوى الرفض:",
              "The following rules fired and pushed the risk score into the reject band:",
            )}
          </p>

          <div className="mt-5 space-y-3">
            {rules.map((r, i) => (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.35 + i * 0.15 }}
                className="flex items-start gap-3 rounded-xl border border-rose-500/25 bg-rose-500/5 p-3.5"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-rose-500/15 text-rose-700">
                  <AlertTriangle className="size-4" />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="danger">{r.id}</Badge>
                    <Badge variant="muted">{tr(SEVERITY_LABEL[r.severity])}</Badge>
                  </div>
                  <p className="mt-1.5 text-sm font-medium text-slate-700">
                    {pick(r.name, r.nameEn)}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </StepShell>
  );
}

// ---- Step 3: ZeRisk analysis ------------------------------------------

const REASON_ICONS: Record<string, LucideIcon> = {
  TRUSTED_DEVICE: Smartphone,
  KNOWN_BENEFICIARY: UserCheck,
  SUCCESSFUL_MFA: Fingerprint,
  NORMAL_BEHAVIOR: Activity,
  NORMAL_AMOUNT: Wallet,
  FAMILIAR_LOCATION: Target,
  LONG_TENURE: History,
  CLEAN_HISTORY: ShieldCheck,
  SIMILAR_LEGIT: Layers,
};

function Step3({
  supporting,
}: {
  supporting: { code: string; ar: string; en: string; weight: number }[];
}) {
  const { pick } = useI18n();
  return (
    <StepShell
      eyebrow={pick("تحليل ZeRisk", "ZeRisk analysis")}
      Icon={Sparkles}
      accent="rgba(56,189,248,0.16)"
    >
      <motion.h2
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="max-w-3xl text-2xl font-bold text-slate-900 sm:text-3xl"
      >
        {pick(
          "لكن ZeRisk تقرأ السياق الكامل — وليس القواعد فقط.",
          "But ZeRisk reads the full context — not just the rules.",
        )}
      </motion.h2>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        {pick(
          "إشارات سلوكية وتاريخية تدعم أن هذه العملية سليمة:",
          "Behavioral and historical signals that support this transaction being legitimate:",
        )}
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {supporting.map((s, i) => {
          const Icon = REASON_ICONS[s.code] ?? CheckCircle2;
          return (
            <motion.div
              key={s.code}
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.25 + i * 0.12, type: "spring", stiffness: 160 }}
              className="card-hover flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-500/15 text-emerald-700">
                <Icon className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">{pick(s.ar, s.en)}</p>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-navy-800">
                  <motion.div
                    className="h-full rounded-full bg-emerald-400"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, Math.abs(s.weight) * 5)}%` }}
                    transition={{ delay: 0.4 + i * 0.12, duration: 0.7 }}
                  />
                </div>
              </div>
              <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
            </motion.div>
          );
        })}
      </div>
    </StepShell>
  );
}

// ---- Step 4: AI recommendation ----------------------------------------------

function Step4({
  originalRiskScore,
  optimizedRiskScore,
  falsePositiveProbability,
  recommendation,
  confidence,
  savedDelta,
  processingTimeMs,
}: {
  originalRiskScore: number;
  optimizedRiskScore: number;
  falsePositiveProbability: number;
  recommendation: "APPROVE" | "REVIEW" | "REJECT" | "MONITOR";
  confidence: number;
  savedDelta: number;
  processingTimeMs: number;
}) {
  const { pick } = useI18n();
  return (
    <StepShell
      eyebrow={pick("توصية الذكاء الاصطناعي", "AI recommendation")}
      Icon={ShieldCheck}
      accent="rgba(52,211,153,0.16)"
    >
      <div className="flex flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15, type: "spring", stiffness: 200 }}
          className="scale-125"
        >
          <DecisionBadge decision={recommendation} />
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="mt-5 text-2xl font-bold text-slate-900 sm:text-3xl"
        >
          {pick(
            "التوصية: الموافقة — عميل سليم، لا احتيال.",
            "Recommendation: Approve — legitimate customer, no fraud.",
          )}
        </motion.h2>
      </div>

      <div className="mt-8 grid items-center gap-6 md:grid-cols-[1fr_auto_1fr]">
        <motion.div
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="flex flex-col items-center gap-2 rounded-2xl border border-navy-700/60 bg-navy-900/40 p-5"
        >
          <span className="text-xs text-muted">{pick("قبل — القرار الأصلي", "Before — original")}</span>
          <RiskGauge score={originalRiskScore} size={140} />
          <Badge variant="reject">{pick("رفض", "Reject")}</Badge>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.45 }}
          className="flex flex-col items-center gap-1"
        >
          <span className="grid size-12 place-items-center rounded-full grad-coral text-white shadow-lg shadow-coral-600/30">
            <TrendingUp className="size-6 rotate-180" />
          </span>
          <span className="text-2xl font-extrabold text-emerald-600 tabular-nums">
            -{savedDelta}
          </span>
          <span className="text-[11px] text-muted">{pick("نقطة مخاطر", "risk points")}</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="flex flex-col items-center gap-2 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.06] p-5"
        >
          <span className="text-xs text-muted">{pick("بعد — المحسّنة", "After — optimized")}</span>
          <RiskGauge score={optimizedRiskScore} size={140} />
          <DecisionBadge decision={recommendation} />
        </motion.div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <BigStat
          label={pick("احتمالية الرفض الخاطئ", "False-positive probability")}
          value={fmtPercent(falsePositiveProbability, 0)}
          accent="text-coral-600"
          delay={0.55}
        />
        <BigStat
          label={pick("درجة الثقة", "Confidence")}
          value={fmtPercent(confidence, 0)}
          accent="text-emerald-700"
          delay={0.62}
        />
        <BigStat
          label={pick("زمن القرار", "Decision time")}
          value={`${processingTimeMs} ms`}
          accent="text-sky-700"
          delay={0.69}
        />
      </div>
    </StepShell>
  );
}

function BigStat({
  label,
  value,
  accent,
  delay = 0,
}: {
  label: string;
  value: string;
  accent: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="rounded-xl border border-navy-700/60 bg-navy-900/40 p-4 text-center"
    >
      <p className="text-xs text-muted">{label}</p>
      <p className={["mt-1 text-3xl font-extrabold tabular-nums", accent].join(" ")}>{value}</p>
    </motion.div>
  );
}

// ---- Step 5: business impact + finale ---------------------------------------

function Step5({
  amount,
  customerName,
  kpi,
  onRestart,
}: {
  amount: number;
  customerName: string;
  kpi: DemoKpi;
  onRestart: () => void;
}) {
  const { lang, pick } = useI18n();

  const kpis = [
    {
      icon: Coins,
      label: pick("الإيراد المسترد", "Revenue recovered"),
      value: fmtCurrency(amount, lang),
      accent: "emerald" as const,
    },
    {
      icon: HeartHandshake,
      label: pick("شكوى عميل تم تفاديها", "Customer complaint avoided"),
      value: "1",
      accent: "coral" as const,
    },
    {
      icon: Users,
      label: pick("خفض تكلفة المراجعة", "Review cost reduced"),
      value: `-${kpi.manualReviewReductionPct}%`,
      accent: "sky" as const,
    },
    {
      icon: TrendingUp,
      label: pick("تحسّن معدل الموافقة", "Approval rate improved"),
      value: `+${(kpi.fpRateBefore - kpi.fpRateAfter).toFixed(2)}pt`,
      accent: "violet" as const,
    },
  ];

  const accentMap: Record<string, string> = {
    emerald: "bg-emerald-500/15 text-emerald-700",
    coral: "bg-coral-500/15 text-coral-600",
    sky: "bg-sky-500/15 text-sky-700",
    violet: "bg-violet-500/15 text-violet-700",
  };

  const finale: { icon: LucideIcon; ar: string; en: string }[] = [
    { icon: HeartHandshake, ar: "حماية رحلة العميل", en: "Customer journey protected" },
    { icon: Coins, ar: "استرداد الإيراد المشروع", en: "Legitimate revenue recovered" },
    { icon: ShieldHalf, ar: "الحفاظ على ضبط الاحتيال", en: "Fraud control preserved" },
    { icon: Users, ar: "تقليل عبء عمل المحققين", en: "Investigator workload reduced" },
    {
      icon: Layers,
      ar: "تعزيز أنظمة الاحتيال القائمة لا استبدالها",
      en: "Existing fraud systems enhanced, not replaced",
    },
  ];

  return (
    <div className="space-y-6">
      <StepShell
        eyebrow={pick("الأثر التجاري", "Business impact")}
        Icon={Wallet}
        accent="rgba(52,211,153,0.16)"
      >
        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="max-w-3xl text-2xl font-bold text-slate-900 sm:text-3xl"
        >
          {pick(
            `بقرار واحد صحيح، احتفظنا بالعميل ${customerName} واسترددنا إيرادًا كان سيُفقد.`,
            `With one correct decision, we retained ${customerName} and recovered revenue that would have been lost.`,
          )}
        </motion.h2>

        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {kpis.map((kpi, i) => {
            const Icon = kpi.icon;
            return (
              <motion.div
                key={kpi.label}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.1 }}
                className="surface card-hover rounded-2xl p-4"
              >
                <span
                  className={[
                    "grid size-9 place-items-center rounded-lg",
                    accentMap[kpi.accent],
                  ].join(" ")}
                >
                  <Icon className="size-4" />
                </span>
                <p className="mt-3 text-2xl font-extrabold text-slate-900 tabular-nums">{kpi.value}</p>
                <p className="mt-1 text-xs text-muted">{kpi.label}</p>
              </motion.div>
            );
          })}
        </div>
      </StepShell>

      {/* Celebratory finale */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="surface relative overflow-hidden rounded-2xl p-6 sm:p-8"
      >
        <div className="pointer-events-none absolute -start-20 -bottom-20 size-72 rounded-full bg-coral-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -end-16 -top-16 size-56 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="relative">
          <div className="mb-6 flex items-center gap-3">
            <motion.span
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.35, type: "spring", stiffness: 200 }}
              className="grid size-12 place-items-center rounded-2xl grad-coral text-white shadow-xl shadow-coral-600/30"
            >
              <Sparkles className="size-6" />
            </motion.span>
            <div>
              <h3 className="text-xl font-bold text-slate-900">
                {pick("قيمة ZeRisk باختصار", "The ZeRisk value, in one screen")}
              </h3>
              <p className="text-sm text-muted">
                {pick("خمس نتائج من قرار واحد أفضل", "Five outcomes from one better decision")}
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {finale.map((f, i) => {
              const Icon = f.icon;
              return (
                <motion.div
                  key={f.en}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.45 + i * 0.1 }}
                  className={[
                    "flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4",
                    i === finale.length - 1 ? "sm:col-span-2" : "",
                  ].join(" ")}
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-500/15 text-emerald-700">
                    <Icon className="size-5" />
                  </span>
                  <span className="flex-1 text-sm font-semibold text-slate-900">
                    {pick(f.ar, f.en)}
                  </span>
                  <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
                </motion.div>
              );
            })}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <div className="flex-1 rounded-xl border border-navy-700/60 bg-navy-900/40 p-4">
              <p className="text-xs text-muted">
                {pick("الأثر الشهري التقديري على مستوى المحفظة", "Estimated monthly portfolio impact")}
              </p>
              <p className="mt-1 text-2xl font-extrabold text-emerald-700 tabular-nums">
                {compactCurrency(kpi.revenueRecovered, lang)}
                <span className="ms-2 text-sm font-medium text-muted">
                  · {fmtNumber(kpi.recoveredTransactions)} {pick("عملية", "txns")}
                </span>
              </p>
            </div>
            <Button variant="success" onClick={onRestart}>
              <RotateCcw className="size-4" />
              {pick("إعادة العرض", "Replay demo")}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
