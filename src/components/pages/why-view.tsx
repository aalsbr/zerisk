"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Sparkles,
  Layers,
  Wallet,
  Network,
  Check,
  X,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  BrainCircuit,
  GitCompareArrows,
  PlayCircle,
  Rocket,
  Radio,
  Globe,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PageHeader, DisclaimerBar, SectionTitle } from "@/components/shared/misc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/providers";

interface Bilingual {
  ar: string;
  en: string;
}

// ---- Content -----------------------------------------------------------------

const SECTIONS: {
  key: string;
  icon: LucideIcon;
  accent: "rose" | "coral" | "violet" | "emerald" | "sky";
  title: Bilingual;
  body: Bilingual;
  points: Bilingual[];
}[] = [
  {
    key: "problem",
    icon: AlertTriangle,
    accent: "rose",
    title: { ar: "المشكلة", en: "The Problem" },
    body: {
      ar: "أنظمة الاحتيال الحالية تحمي المؤسسة، لكنها قد ترفض عملاء شرعيين بسبب قواعد ثابتة صارمة.",
      en: "Existing fraud systems protect the institution, but they may reject legitimate customers due to rigid static rules.",
    },
    points: [
      { ar: "رفض خاطئ يُفقد إيرادات مشروعة", en: "False declines lose legitimate revenue" },
      { ar: "إحباط العملاء ومخاطر التسرّب", en: "Customer frustration and churn risk" },
      { ar: "عبء مراجعة يدوية متزايد", en: "Growing manual-review workload" },
    ],
  },
  {
    key: "solution",
    icon: Sparkles,
    accent: "coral",
    title: { ar: "الحل", en: "The Solution" },
    body: {
      ar: "تحسّن ZeRisk قرارات الاحتيال باستخدام السلوك، والنتائج التاريخية، والذكاء الاصطناعي القابل للتفسير.",
      en: "ZeRisk improves fraud decisions using behavior, historical outcomes, and explainable AI.",
    },
    points: [
      { ar: "تحليل سلوكي وسياقي لكل عملية", en: "Behavioral and contextual analysis per transaction" },
      { ar: "تعلّم من نتائج التحقيقات السابقة", en: "Learns from past investigation outcomes" },
      { ar: "توصيات مُفسّرة وقابلة للتدقيق", en: "Explainable, auditable recommendations" },
    ],
  },
  {
    key: "innovation",
    icon: Layers,
    accent: "violet",
    title: { ar: "الابتكار", en: "The Innovation" },
    body: {
      ar: "ZeRisk تُحسّن محركات الاحتيال القائمة بدلًا من استبدالها — طبقة ذكاء فوق أنظمتك الحالية.",
      en: "ZeRisk optimizes existing fraud engines instead of replacing them — an intelligence layer above your current systems.",
    },
    points: [
      { ar: "تكامل غير تدخّلي مع الأنظمة الحالية", en: "Non-intrusive integration with current systems" },
      { ar: "لا مخاطر استبدال أو انقطاع", en: "No rip-and-replace risk or disruption" },
      { ar: "قيمة فورية فوق الاستثمار القائم", en: "Immediate value on top of existing investment" },
    ],
  },
  {
    key: "value",
    icon: Wallet,
    accent: "emerald",
    title: { ar: "القيمة التجارية", en: "Business Value" },
    body: {
      ar: "تسترد الإيرادات، وتخفض التكلفة التشغيلية، وتحسّن تجربة العميل، مع الحفاظ على حماية الاحتيال.",
      en: "Recovers revenue, reduces operational cost, improves customer experience, and preserves fraud protection.",
    },
    points: [
      { ar: "استرداد الإيرادات من الرفض الخاطئ", en: "Recover revenue from false declines" },
      { ar: "خفض تكاليف المراجعة اليدوية", en: "Cut manual-review operating costs" },
      { ar: "رفع رضا العملاء وتقليل الاحتكاك", en: "Higher CSAT and lower friction" },
    ],
  },
  {
    key: "scalability",
    icon: Network,
    accent: "sky",
    title: { ar: "القابلية للتوسّع", en: "Scalability" },
    body: {
      ar: "تتكامل مع محركات احتيال متعددة، وقنوات دفع متنوعة، ومؤسسات مالية مختلفة.",
      en: "Integrates with multiple fraud engines, payment channels, and institutions.",
    },
    points: [
      { ar: "دعم محركات احتيال متعددة", en: "Support for multiple fraud engines" },
      { ar: "تغطية كل قنوات الدفع", en: "Coverage across all payment channels" },
      { ar: "نشر متعدد المؤسسات", en: "Multi-institution deployment" },
    ],
  },
];

const ACCENT: Record<string, { chip: string; glow: string }> = {
  rose: { chip: "bg-rose-500/15 text-rose-700", glow: "bg-rose-500/10" },
  coral: { chip: "bg-coral-500/15 text-coral-600", glow: "bg-coral-500/10" },
  violet: { chip: "bg-violet-500/15 text-violet-700", glow: "bg-violet-500/10" },
  emerald: { chip: "bg-emerald-500/15 text-emerald-700", glow: "bg-emerald-500/10" },
  sky: { chip: "bg-sky-500/15 text-sky-700", glow: "bg-sky-500/10" },
};

const TRADITIONAL: Bilingual[] = [
  { ar: "يكتشف المخاطر", en: "Detects risk" },
  { ar: "يطبّق قواعد ثابتة", en: "Applies static rules" },
  { ar: "يُنتج قرارًا", en: "Produces a decision" },
  { ar: "غالبًا يعمل بمعزل", en: "Often works in isolation" },
];

const FRAUDLENS: Bilingual[] = [
  { ar: "يقيّم جودة القرار", en: "Evaluates decision quality" },
  { ar: "يتعلّم من نتائج التحقيقات", en: "Learns from investigation outcomes" },
  { ar: "يقيس تكلفة الرفض الخاطئ", en: "Measures false-positive costs" },
  { ar: "يحاكي تغييرات القواعد", en: "Simulates rule changes" },
  { ar: "يفسّر التوصيات", en: "Explains recommendations" },
  { ar: "يُحسّن النتائج المالية وتجربة العميل", en: "Optimizes financial & customer outcomes" },
];

const ROADMAP: {
  phase: string;
  icon: LucideIcon;
  title: Bilingual;
  items: Bilingual[];
}[] = [
  {
    phase: "Phase 1",
    icon: Rocket,
    title: { ar: "المرحلة الأولى", en: "Phase 1" },
    items: [
      { ar: "تحليلات القرار", en: "Decision analytics" },
      { ar: "اكتشاف الرفض الخاطئ", en: "False-positive detection" },
      { ar: "مراقبة أداء القواعد", en: "Rule performance monitoring" },
      { ar: "محاكاة تاريخية", en: "Historical simulations" },
    ],
  },
  {
    phase: "Phase 2",
    icon: Radio,
    title: { ar: "المرحلة الثانية", en: "Phase 2" },
    items: [
      { ar: "تكامل واجهات فورية", en: "Real-time API integration" },
      { ar: "تعلّم من تغذية المحققين", en: "Investigator feedback learning" },
      { ar: "دعم نماذج متعددة", en: "Multi-model support" },
      { ar: "تحليلات سلوكية متقدمة", en: "Advanced behavioral analytics" },
    ],
  },
  {
    phase: "Phase 3",
    icon: Globe,
    title: { ar: "المرحلة الثالثة", en: "Phase 3" },
    items: [
      { ar: "التعلّم الاتحادي", en: "Federated learning" },
      { ar: "ذكاء احتيال عابر للمؤسسات", en: "Cross-institution fraud intelligence" },
      { ar: "نماذج لغة احتيال عربية", en: "Arabic fraud-language models" },
      { ar: "قرارات تكيّفية فورية", en: "Real-time adaptive decisioning" },
    ],
  },
];

// ---- View --------------------------------------------------------------------

export function WhyView() {
  const { t, lang, pick, tr } = useI18n();

  return (
    <div className="space-y-8">
      <PageHeader
        title={t("page.why.title")}
        subtitle={pick(
          "طبقة ذكية تُحسّن قرارات الاحتيال فوق أنظمتك الحالية",
          "An intelligent layer that optimizes fraud decisions above your existing systems",
        )}
      />

      {/* Hero statement */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="surface relative overflow-hidden rounded-2xl p-7 sm:p-10"
      >
        <div className="pointer-events-none absolute -end-16 -top-16 size-72 rounded-full bg-coral-500/12 blur-3xl" />
        <div className="pointer-events-none absolute -start-16 -bottom-16 size-64 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="relative max-w-4xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-navy-600 bg-navy-900/60 px-3 py-1.5 text-xs font-semibold text-coral-600">
            <BrainCircuit className="size-4" />
            {pick("طبقة تحسين القرار", "Decision-optimization layer")}
          </span>
          <h2 className="mt-4 text-3xl font-extrabold leading-tight text-slate-900 sm:text-4xl">
            {pick(
              "أنظمة الاحتيال تحمي المؤسسة. ZeRisk تحمي العميل أيضًا.",
              "Fraud systems protect the institution. ZeRisk protects the customer too.",
            )}
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted">
            {pick(
              "لا نستبدل محرك الاحتيال لديك — بل نضيف طبقة ذكاء تقيس جودة كل قرار، وتكتشف الرفض الخاطئ، وتحوّله إلى إيراد مسترد وتجربة عميل أفضل.",
              "We don't replace your fraud engine — we add an intelligence layer that measures the quality of every decision, detects false declines, and turns them into recovered revenue and a better customer experience.",
            )}
          </p>
        </div>
      </motion.div>

      {/* Value sections */}
      <div className="grid gap-4 lg:grid-cols-2">
        {SECTIONS.map((s, i) => {
          const Icon = s.icon;
          const a = ACCENT[s.accent];
          const wide = i === SECTIONS.length - 1 && SECTIONS.length % 2 === 1;
          return (
            <motion.div
              key={s.key}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ delay: (i % 2) * 0.08 }}
              className={[
                "surface card-hover relative overflow-hidden rounded-2xl p-6",
                wide ? "lg:col-span-2" : "",
              ].join(" ")}
            >
              <div className={["pointer-events-none absolute -end-10 -top-10 size-40 rounded-full blur-3xl", a.glow].join(" ")} />
              <div className="relative">
                <div className="flex items-center gap-3">
                  <span className={["grid size-11 place-items-center rounded-xl", a.chip].join(" ")}>
                    <Icon className="size-5" />
                  </span>
                  <h3 className="text-lg font-bold text-slate-900">{tr(s.title)}</h3>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-slate-700">{tr(s.body)}</p>
                <ul className="mt-4 grid gap-2 sm:grid-cols-1">
                  {s.points.map((p) => (
                    <li key={p.en} className="flex items-start gap-2 text-sm text-muted">
                      <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                      <span>{tr(p)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Comparison table */}
      <section>
        <SectionTitle className="flex items-center gap-2">
          <GitCompareArrows className="size-4" />
          {pick("المقارنة", "The Comparison")}
        </SectionTitle>
        <div className="grid gap-4 md:grid-cols-2">
          {/* Traditional */}
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="surface rounded-2xl p-6"
          >
            <div className="mb-4 flex items-center gap-2">
              <span className="grid size-9 place-items-center rounded-lg bg-navy-800 text-slate-500">
                <ShieldCheck className="size-4" />
              </span>
              <div>
                <h3 className="text-base font-bold text-slate-700">
                  {pick("محرك الاحتيال التقليدي", "Traditional Fraud Engine")}
                </h3>
                <p className="text-xs text-muted">{pick("النهج الحالي", "The current approach")}</p>
              </div>
            </div>
            <ul className="space-y-2.5">
              {TRADITIONAL.map((r) => (
                <li
                  key={r.en}
                  className="flex items-center gap-3 rounded-xl border border-navy-700/60 bg-navy-900/40 p-3 text-sm text-slate-600"
                >
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-navy-800 text-muted">
                    <X className="size-3.5" />
                  </span>
                  {tr(r)}
                </li>
              ))}
            </ul>
          </motion.div>

          {/* ZeRisk — coral accented */}
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="relative overflow-hidden rounded-2xl border border-coral-500/40 bg-coral-500/[0.05] p-6 shadow-lg shadow-coral-600/10"
          >
            <div className="pointer-events-none absolute -end-12 -top-12 size-44 rounded-full bg-coral-500/15 blur-3xl" />
            <div className="relative">
              <div className="mb-4 flex items-center gap-2">
                <span className="grid size-9 place-items-center rounded-lg grad-coral text-white">
                  <Sparkles className="size-4" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {pick("ZeRisk", "ZeRisk")}
                  </h3>
                  <p className="text-xs text-coral-200/80">
                    {pick("طبقة تحسين القرار", "Decision-optimization layer")}
                  </p>
                </div>
              </div>
              <ul className="space-y-2.5">
                {FRAUDLENS.map((r) => (
                  <li
                    key={r.en}
                    className="flex items-center gap-3 rounded-xl border border-coral-500/20 bg-navy-900/40 p-3 text-sm font-medium text-slate-900"
                  >
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-coral-500/20 text-coral-600">
                      <Check className="size-3.5" />
                    </span>
                    {tr(r)}
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Roadmap */}
      <section>
        <SectionTitle className="flex items-center gap-2">
          <Rocket className="size-4" />
          {pick("خارطة الطريق المستقبلية", "Future Roadmap")}
        </SectionTitle>
        <div className="grid gap-4 md:grid-cols-3">
          {ROADMAP.map((phase, i) => {
            const Icon = phase.icon;
            return (
              <motion.div
                key={phase.phase}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="surface card-hover relative overflow-hidden rounded-2xl p-6"
              >
                <div className="pointer-events-none absolute -end-8 -top-8 size-28 rounded-full bg-coral-500/10 blur-2xl" />
                <div className="relative">
                  <div className="flex items-center justify-between">
                    <span className="grid size-11 place-items-center rounded-xl bg-coral-500/15 text-coral-600">
                      <Icon className="size-5" />
                    </span>
                    <Badge variant="coral">{phase.phase}</Badge>
                  </div>
                  <h3 className="mt-4 text-lg font-bold text-slate-900">{tr(phase.title)}</h3>
                  <ul className="mt-4 space-y-2.5">
                    {phase.items.map((item, j) => (
                      <li key={item.en} className="flex items-start gap-2.5 text-sm text-slate-600">
                        <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-navy-800 text-[10px] font-bold text-coral-600">
                          {j + 1}
                        </span>
                        <span>{tr(item)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Closing CTA */}
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="grad-coral relative overflow-hidden rounded-2xl p-8 text-white shadow-xl shadow-coral-600/25"
      >
        <div className="pointer-events-none absolute -end-10 -top-10 size-48 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
          <div className="max-w-2xl">
            <h3 className="text-2xl font-extrabold">
              {pick("شاهد ZeRisk وهي تعمل", "See ZeRisk in action")}
            </h3>
            <p className="mt-2 text-sm text-white/85">
              {pick(
                "جولة موجهة من خمس خطوات تُظهر كيف نحوّل رفضًا خاطئًا إلى إيراد مسترد وقرار أفضل.",
                "A guided five-step walkthrough showing how we turn a false decline into recovered revenue and a better decision.",
              )}
            </p>
          </div>
          <Link href="/demo">
            <Button variant="secondary" size="lg" className="border-white/20 bg-white/15 text-white hover:bg-white/25">
              <PlayCircle className="size-5" />
              {pick("شاهد العرض التوضيحي", "Watch the demo")}
              {lang === "ar" ? <ArrowLeft className="size-4" /> : <ArrowRight className="size-4" />}
            </Button>
          </Link>
        </div>
      </motion.div>

      <DisclaimerBar />
    </div>
  );
}
