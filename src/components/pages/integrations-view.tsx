"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Plug,
  PlugZap,
  Activity,
  Clock,
  Zap,
  ArrowLeft,
  Copy,
  Check,
  Smartphone,
  ShieldAlert,
  Sparkles,
  GitBranch,
  CreditCard,
  Code2,
} from "lucide-react";
import { KpiCard } from "@/components/shared/kpi-card";
import { PageHeader, DisclaimerBar, SectionTitle } from "@/components/shared/misc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { useI18n, useToast } from "@/providers";
import { fmtNumber, fmtTimeAgo, fmtDateTime } from "@/lib/format";
import type { Integration } from "@/lib/types";

type Health = Integration["health"];

const HEALTH_BADGE: Record<Health, { variant: "success" | "warning" | "danger"; ar: string; en: string }> = {
  HEALTHY: { variant: "success", ar: "سليم", en: "Healthy" },
  DEGRADED: { variant: "warning", ar: "متدهور", en: "Degraded" },
  DOWN: { variant: "danger", ar: "متوقف", en: "Down" },
};

export function IntegrationsView({ integrations }: { integrations: Integration[] }) {
  const { t, lang, pick } = useI18n();
  const { toast } = useToast();

  // Local UI connection state (simulated toggles).
  const [connected, setConnected] = React.useState<Record<string, boolean>>(() =>
    Object.fromEntries(integrations.map((x) => [x.id, x.connected])),
  );
  const [category, setCategory] = React.useState<string>("ALL");

  const categories = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const x of integrations) map.set(x.category, x.categoryEn);
    return Array.from(map.entries());
  }, [integrations]);

  const filtered =
    category === "ALL" ? integrations : integrations.filter((x) => x.category === category);

  const connectedCount = integrations.filter((x) => connected[x.id]).length;
  const totalProcessed = integrations.reduce((a, x) => a + x.transactionsProcessed, 0);
  const avgLatency = Math.round(
    integrations.reduce((a, x) => a + x.avgLatencyMs, 0) / Math.max(integrations.length, 1),
  );
  const healthy = integrations.filter((x) => x.health === "HEALTHY").length;

  function toggle(x: Integration) {
    setConnected((prev) => {
      const next = !prev[x.id];
      toast({
        kind: next ? "success" : "info",
        title: next ? pick("تم الربط", "Connected") : pick("تم الفصل", "Disconnected"),
        description: lang === "ar" ? x.name : x.nameEn,
      });
      return { ...prev, [x.id]: next };
    });
  }

  const categoryOptions = [
    { value: "ALL", label: t("common.all") },
    ...categories.map(([ar, en]) => ({ value: ar, label: lang === "ar" ? ar : en })),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("page.integrations.title")}
        subtitle={t("page.integrations.subtitle")}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label={pick("تكاملات مفعّلة", "Active integrations")} value={`${fmtNumber(connectedCount)}/${fmtNumber(integrations.length)}`} Icon={PlugZap} accent="emerald" delay={0.02} />
        <KpiCard label={pick("عمليات معالَجة", "Transactions processed")} value={fmtNumber(totalProcessed)} Icon={Activity} accent="sky" delay={0.04} />
        <KpiCard label={pick("متوسط زمن الاستجابة", "Avg latency")} value={`${avgLatency} ms`} Icon={Zap} accent="amber" delay={0.06} />
        <KpiCard label={pick("أنظمة سليمة", "Healthy systems")} value={`${fmtNumber(healthy)}/${fmtNumber(integrations.length)}`} Icon={Check} accent="violet" delay={0.08} />
      </div>

      {/* Architecture flow */}
      <ArchitectureFlow />

      {/* Integration cards */}
      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <SectionTitle className="mb-0">{pick("التكاملات", "Integrations")}</SectionTitle>
          <div className="w-48">
            <Select
              options={categoryOptions}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((x, i) => {
            const isOn = connected[x.id];
            const h = HEALTH_BADGE[x.health];
            return (
              <motion.div
                key={x.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: Math.min(i * 0.03, 0.3) }}
                className="surface card-hover flex flex-col rounded-2xl p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">{lang === "ar" ? x.name : x.nameEn}</p>
                    <Badge variant="muted" className="mt-1">
                      {lang === "ar" ? x.category : x.categoryEn}
                    </Badge>
                  </div>
                  <Badge variant={isOn ? "success" : "muted"}>
                    {isOn ? <PlugZap className="size-3" /> : <Plug className="size-3" />}
                    {isOn ? pick("متصل", "Connected") : pick("غير متصل", "Disconnected")}
                  </Badge>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Field icon={Clock} label={pick("آخر مزامنة", "Last sync")} value={isOn ? fmtTimeAgo(x.lastSync, lang) : "—"} title={fmtDateTime(x.lastSync, lang)} />
                  <Field icon={Activity} label={pick("عمليات", "Processed")} value={fmtNumber(x.transactionsProcessed)} />
                  <Field icon={Zap} label={pick("زمن الاستجابة", "Latency")} value={`${x.avgLatencyMs} ms`} />
                  <div className="rounded-lg border border-navy-700/60 bg-navy-900/40 p-2.5">
                    <p className="text-[11px] text-muted">{pick("الحالة", "Health")}</p>
                    <Badge variant={h.variant} className="mt-1">
                      <Activity className="size-3" />
                      {pick(h.ar, h.en)}
                    </Badge>
                  </div>
                </div>

                <div className="mt-4 flex-1" />
                <Button
                  variant={isOn ? "outline" : "default"}
                  size="sm"
                  className="mt-3 w-full"
                  onClick={() => toggle(x)}
                >
                  {isOn ? pick("فصل الاتصال", "Disconnect") : pick("ربط", "Connect")}
                </Button>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* API docs */}
      <ApiDocs />

      <DisclaimerBar />
    </div>
  );
}

function Field({
  icon: Icon,
  label,
  value,
  title,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
  title?: string;
}) {
  return (
    <div className="rounded-lg border border-navy-700/60 bg-navy-900/40 p-2.5" title={title}>
      <p className="flex items-center gap-1 text-[11px] text-muted">
        <Icon className="size-3" />
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-slate-900 tabular-nums">{value}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------

function ArchitectureFlow() {
  const { pick } = useI18n();
  const steps = [
    { icon: Smartphone, ar: "قناة العميل", en: "Customer Channel", accent: "text-sky-700 bg-sky-500/10 border-sky-500/30" },
    { icon: ShieldAlert, ar: "محرك الاحتيال الحالي", en: "Existing Fraud Engine", accent: "text-amber-700 bg-amber-500/10 border-amber-500/30" },
    { icon: Sparkles, ar: "ZeRisk", en: "ZeRisk", accent: "text-coral-600 bg-coral-500/10 border-coral-500/30" },
    { icon: GitBranch, ar: "منسّق القرار", en: "Decision Orchestrator", accent: "text-violet-700 bg-violet-500/10 border-violet-500/30" },
    { icon: CreditCard, ar: "نظام المدفوعات", en: "Payment System", accent: "text-emerald-700 bg-emerald-500/10 border-emerald-500/30" },
  ];
  return (
    <Card className="p-5">
      <SectionTitle>{pick("بنية التدفق", "Architecture flow")}</SectionTitle>
      <div className="flex flex-wrap items-stretch gap-2">
        {steps.map((s, i) => (
          <React.Fragment key={s.en}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.06 }}
              className={"flex min-w-[8rem] flex-1 items-center gap-2 rounded-xl border px-3 py-3 " + s.accent}
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
          "تعمل «ZeRisk» كطبقة اعتراضية بين محرك الاحتيال الحالي ونظام المدفوعات، دون استبدال أنظمتك القائمة.",
          "ZeRisk operates as an interception layer between your existing fraud engine and the payment system — without replacing your current stack.",
        )}
      </p>
    </Card>
  );
}

// ---------------------------------------------------------------------------

const SCORE_REQUEST = `{
  "transactionId": "TX-2026-000145",
  "customerId": "CUS-8452",
  "amount": 7200,
  "currency": "SAR",
  "channel": "MOBILE",
  "originalDecision": "REJECT",
  "originalRiskScore": 84,
  "triggeredRules": ["FR-017", "FR-024"],
  "deviceKnown": true,
  "beneficiaryKnown": true,
  "mfaPassed": true
}`;

const SCORE_RESPONSE = `{
  "transactionId": "TX-2026-000145",
  "optimizedRiskScore": 29,
  "falsePositiveProbability": 91,
  "recommendation": "APPROVE",
  "confidence": 94,
  "reasonCodes": [
    "TRUSTED_DEVICE",
    "KNOWN_BENEFICIARY",
    "SUCCESSFUL_MFA",
    "NORMAL_BEHAVIOR"
  ],
  "processingTimeMs": 68
}`;

const ENDPOINTS: { method: "POST" | "GET"; path: string; ar: string; en: string }[] = [
  { method: "POST", path: "/api/v1/score", ar: "تقييم عملية وإرجاع التوصية المحسّنة", en: "Score a transaction and return the optimized recommendation" },
  { method: "POST", path: "/api/v1/feedback", ar: "إرسال قرار المحقق لتغذية حلقة التعلّم", en: "Submit an investigator decision into the learning loop" },
  { method: "POST", path: "/api/v1/simulations", ar: "تشغيل محاكاة (ماذا لو؟) لتعديل قاعدة", en: "Run a what-if simulation for a rule change" },
  { method: "GET", path: "/api/v1/rules", ar: "جلب القواعد وإحصاءات أدائها", en: "Fetch rules and their performance stats" },
  { method: "GET", path: "/api/v1/analytics/summary", ar: "ملخص المؤشرات التنفيذية", en: "Executive KPI summary" },
];

function ApiDocs() {
  const { pick } = useI18n();
  const { toast } = useToast();
  const [copied, setCopied] = React.useState<string | null>(null);

  async function copy(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      toast({ kind: "success", title: pick("تم النسخ", "Copied"), description: pick("تم نسخ النص إلى الحافظة", "Text copied to clipboard") });
      window.setTimeout(() => setCopied((c) => (c === id ? null : c)), 1500);
    } catch {
      toast({ kind: "error", title: pick("تعذّر النسخ", "Copy failed") });
    }
  }

  return (
    <div>
      <SectionTitle>{pick("توثيق واجهات البرمجة", "API documentation")}</SectionTitle>

      <div className="mb-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {ENDPOINTS.map((e) => (
          <div key={e.path} className="surface flex items-center gap-2.5 rounded-xl p-3">
            <Badge variant={e.method === "GET" ? "info" : "coral"}>{e.method}</Badge>
            <div className="min-w-0">
              <p className="truncate font-mono text-xs text-slate-900">{e.path}</p>
              <p className="truncate text-[11px] text-muted">{pick(e.ar, e.en)}</p>
            </div>
          </div>
        ))}
      </div>

      <Card>
        <CardContent className="pt-5">
          <div className="mb-3 flex items-center gap-2">
            <Code2 className="size-4 text-coral-600" />
            <span className="font-mono text-sm text-slate-900">POST /api/v1/score</span>
            <Badge variant="coral">{pick("مثال", "Example")}</Badge>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <CodeBlock
              title={pick("الطلب", "Request")}
              code={SCORE_REQUEST}
              copied={copied === "req"}
              onCopy={() => copy("req", SCORE_REQUEST)}
            />
            <CodeBlock
              title={pick("الاستجابة", "Response")}
              code={SCORE_RESPONSE}
              copied={copied === "res"}
              onCopy={() => copy("res", SCORE_RESPONSE)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CodeBlock({
  title,
  code,
  copied,
  onCopy,
}: {
  title: string;
  code: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-navy-700/60 bg-navy-950/60">
      <div className="flex items-center justify-between border-b border-navy-700/60 px-3 py-2">
        <span className="text-xs font-medium text-muted">{title}</span>
        <Button variant="ghost" size="sm" onClick={onCopy}>
          {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
        </Button>
      </div>
      <pre className="overflow-x-auto p-3 text-start" dir="ltr">
        <code className="font-mono text-xs leading-relaxed text-slate-700">{code}</code>
      </pre>
    </div>
  );
}
