"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Radio, Send, ArrowRight, Copy, ExternalLink, ShieldAlert, Server, Zap } from "lucide-react";
import { PageHeader, DisclaimerBar, Stat } from "@/components/shared/misc";
import { DecisionBadge } from "@/components/shared/decision-badge";
import { RiskGauge } from "@/components/shared/risk-gauge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useI18n, useToast } from "@/providers";
import { CHANNEL_LABEL, DECISION_LABEL, CATEGORY_LABEL } from "@/lib/i18n";
import { fmtCurrency } from "@/lib/format";
import { ingestTransactionAction } from "@/app/actions";
import type { Channel, Decision, IngestInput, TxnCategory } from "@/lib/types";

type CustomerOpt = { id: string; name: string; nameEn: string; segment: string };
type RuleOpt = { id: string; name: string; nameEn: string; action: Decision };
type RecentRow = {
  id: string; source: string; amount: number; currency: string;
  originalDecision: Decision; originalRiskScore: number; recommendation: Decision;
  optimizedRiskScore: number; falsePositiveProbability: number; isFalsePositive: boolean;
};

type ActionResult = Awaited<ReturnType<typeof ingestTransactionAction>>;

const CHANNELS: Channel[] = ["MOBILE_APP", "WEB", "POS", "ATM", "INTERNAL_TRANSFER", "VIBAN_CREDIT", "LOAN_REPAYMENT", "LOAN_DISBURSEMENT", "WALLET_TRANSFER"];
const CATEGORIES: TxnCategory[] = ["TRANSFER", "PAYMENT", "SUPPLIER", "SALARY", "LOAN", "PURCHASE", "WALLET"];
const DECISIONS: Decision[] = ["APPROVE", "REVIEW", "REJECT", "MONITOR"];

const DEFAULT_PAYLOAD = `{
  "transactionId": "TX-IBM-000777",
  "source": "IBM Safer Payments",
  "customerId": "CUS-8452",
  "amount": 18500,
  "currency": "SAR",
  "channel": "MOBILE_APP",
  "originalDecision": "REJECT",
  "originalRiskScore": 86,
  "triggeredRules": ["FR-017", "FR-024"],
  "deviceKnown": true,
  "beneficiaryKnown": true,
  "mfaPassed": true,
  "timeFamiliar": false
}`;

export function IngestView({ customers, rules, recent }: { customers: CustomerOpt[]; rules: RuleOpt[]; recent: RecentRow[] }) {
  const { t, lang, pick, tr } = useI18n();
  const { toast } = useToast();
  const [pending, startTransition] = React.useTransition();
  const [result, setResult] = React.useState<ActionResult | null>(null);

  // ---- form state ----
  const [form, setForm] = React.useState({
    customerId: "", amount: 18500, currency: "SAR", channel: "MOBILE_APP" as Channel, category: "TRANSFER" as TxnCategory,
    originalDecision: "REJECT" as Decision, originalRiskScore: 86, hour: 2, failedLogins: 0, velocity1h: 1,
    deviceKnown: true, beneficiaryKnown: true, mfaPassed: true, passwordResetRecently: false, locationFamiliar: true, timeFamiliar: false,
  });
  const [ruleIds, setRuleIds] = React.useState<string[]>(["FR-017", "FR-024"]);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const toggleRule = (id: string) => setRuleIds((r) => (r.includes(id) ? r.filter((x) => x !== id) : [...r, id]));

  function submitForm() {
    const input: IngestInput = { ...form, triggeredRuleIds: ruleIds, source: "Manual ingest (console)" };
    startTransition(async () => {
      const res = await ingestTransactionAction(input);
      setResult(res);
      toast({ kind: res.isFalsePositive ? "success" : "info", title: pick("تمت معالجة العملية الحية", "Live transaction processed"), description: `${res.id} → ${tr(DECISION_LABEL[res.ai.recommendation])}` });
    });
  }

  // ---- API simulator ----
  const [payload, setPayload] = React.useState(DEFAULT_PAYLOAD);
  const [apiResp, setApiResp] = React.useState<string>("");
  const [sending, setSending] = React.useState(false);
  async function sendApi() {
    setSending(true);
    setApiResp("");
    try {
      const res = await fetch("/api/v1/ingest", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload });
      const json = await res.json();
      setApiResp(JSON.stringify(json, null, 2));
      if (res.ok) toast({ kind: "success", title: pick("استقبلت ZeRisk العملية", "ZeRisk accepted the transaction"), description: json.transactionId });
      else toast({ kind: "error", title: pick("رُفض الطلب", "Request rejected"), description: json.error });
    } catch (e) {
      setApiResp(String(e));
      toast({ kind: "error", title: pick("فشل الإرسال", "Send failed") });
    } finally {
      setSending(false);
    }
  }
  const copy = (text: string) => { navigator.clipboard?.writeText(text); toast({ kind: "info", title: pick("تم النسخ", "Copied") }); };
  const curl = `curl -X POST ${typeof window !== "undefined" ? window.location.origin : ""}/api/v1/ingest \\\n  -H 'Content-Type: application/json' \\\n  -d '${payload.replace(/\n\s*/g, " ")}'`;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("page.ingest.title")}
        subtitle={t("page.ingest.subtitle")}
        actions={<Badge variant="coral"><Zap className="size-3" />{pick("صفحة مخفية", "Hidden page")}</Badge>}
      />

      {/* Flow explainer */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
          {[
            { icon: Server, label: pick("محرك الاحتيال (IBM)", "Fraud engine (IBM)"), c: "text-slate-600" },
            { icon: Send, label: pick("يرسل العملية", "pushes transaction"), c: "text-slate-500" },
            { icon: Radio, label: "ZeRisk", c: "text-coral-600" },
            { icon: Zap, label: pick("تقييم فوري", "instant scoring"), c: "text-slate-600" },
            { icon: ArrowRight, label: pick("تظهر في العمليات المباشرة ولوحات القيادة", "appears in Live Transactions & dashboards"), c: "text-emerald-600" },
          ].map((s, i, arr) => (
            <React.Fragment key={i}>
              <span className={`inline-flex items-center gap-1.5 ${s.c}`}><s.icon className="size-4" />{s.label}</span>
              {i < arr.length - 1 && <ArrowRight className="size-3.5 text-muted rotate-180 rtl:rotate-0" />}
            </React.Fragment>
          ))}
        </div>
      </Card>

      <Tabs defaultValue="form">
        <TabsList>
          <TabsTrigger value="form">{pick("عملية جديدة", "New transaction")}</TabsTrigger>
          <TabsTrigger value="api">{pick("محاكي واجهة IBM", "IBM API simulator")}</TabsTrigger>
        </TabsList>

        {/* ---- FORM ---- */}
        <TabsContent value="form" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <h3 className="mb-4 text-sm font-semibold text-slate-900">{pick("تفاصيل العملية الواردة من محرك الاحتيال", "Incoming transaction from the fraud engine")}</h3>
              <div className="grid grid-cols-2 gap-3">
                <Field label={pick("المبلغ", "Amount")}><Input type="number" value={form.amount} onChange={(e) => set("amount", Number(e.target.value))} /></Field>
                <Field label={pick("العملة", "Currency")}><Input value={form.currency} onChange={(e) => set("currency", e.target.value)} /></Field>
                <Field label={pick("القناة", "Channel")}><Select value={form.channel} onChange={(e) => set("channel", e.target.value as Channel)} options={CHANNELS.map((c) => ({ value: c, label: tr(CHANNEL_LABEL[c]) }))} /></Field>
                <Field label={pick("الفئة", "Category")}><Select value={form.category} onChange={(e) => set("category", e.target.value as TxnCategory)} options={CATEGORIES.map((c) => ({ value: c, label: tr(CATEGORY_LABEL[c]) }))} /></Field>
                <Field label={pick("العميل", "Customer")}><Select value={form.customerId} onChange={(e) => set("customerId", e.target.value)} options={[{ value: "", label: pick("تلقائي", "Auto") }, ...customers.slice(0, 40).map((c) => ({ value: c.id, label: `${pick(c.name, c.nameEn)} · ${c.id}` }))]} /></Field>
                <Field label={pick("الساعة", "Hour (0-23)")}><Input type="number" min={0} max={23} value={form.hour} onChange={(e) => set("hour", Number(e.target.value))} /></Field>
                <Field label={pick("القرار الأصلي (المحرك)", "Original decision (engine)")}><Select value={form.originalDecision} onChange={(e) => set("originalDecision", e.target.value as Decision)} options={DECISIONS.map((d) => ({ value: d, label: tr(DECISION_LABEL[d]) }))} /></Field>
                <Field label={pick("درجة المخاطر الأصلية", "Original risk score")}><Input type="number" min={0} max={100} value={form.originalRiskScore} onChange={(e) => set("originalRiskScore", Number(e.target.value))} /></Field>
                <Field label={pick("محاولات دخول فاشلة", "Failed logins")}><Input type="number" min={0} value={form.failedLogins} onChange={(e) => set("failedLogins", Number(e.target.value))} /></Field>
                <Field label={pick("سرعة العمليات/ساعة", "Velocity / hour")}><Input type="number" min={1} value={form.velocity1h} onChange={(e) => set("velocity1h", Number(e.target.value))} /></Field>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                {([
                  ["deviceKnown", pick("جهاز موثوق", "Trusted device")],
                  ["beneficiaryKnown", pick("مستفيد معروف", "Known beneficiary")],
                  ["mfaPassed", pick("نجاح التحقق الثنائي", "MFA passed")],
                  ["timeFamiliar", pick("وقت اعتيادي", "Familiar time")],
                  ["locationFamiliar", pick("موقع اعتيادي", "Familiar location")],
                  ["passwordResetRecently", pick("إعادة تعيين كلمة المرور", "Password reset")],
                ] as const).map(([k, label]) => (
                  <label key={k} className="flex items-center justify-between rounded-xl border border-navy-600 bg-navy-900/40 px-3 py-2">
                    <span className="text-xs text-slate-700">{label}</span>
                    <Switch checked={form[k]} onCheckedChange={(v) => set(k, v)} />
                  </label>
                ))}
              </div>

              <div className="mt-4">
                <Label>{pick("القواعد المُفعّلة (من محرك الاحتيال)", "Triggered rules (from the engine)")}</Label>
                <div className="mt-2 flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
                  {rules.map((r) => (
                    <button key={r.id} type="button" onClick={() => toggleRule(r.id)}
                      className={`rounded-lg border px-2 py-1 text-[11px] transition ${ruleIds.includes(r.id) ? "border-coral-500/50 bg-coral-500/10 text-coral-600" : "border-navy-600 bg-navy-900/40 text-muted hover:text-slate-700"}`}>
                      {r.id}
                    </button>
                  ))}
                </div>
              </div>

              <Button className="mt-5 w-full" onClick={submitForm} disabled={pending}>
                <Send className="size-4" />
                {pending ? pick("جارٍ المعالجة…", "Processing…") : pick("إرسال إلى ZeRisk", "Send to ZeRisk")}
              </Button>
            </Card>

            <ResultPanel result={result} />
          </div>
        </TabsContent>

        {/* ---- API SIMULATOR ---- */}
        <TabsContent value="api" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">POST /api/v1/ingest</h3>
                <Badge variant="muted">{pick("محاكاة دفع IBM", "IBM push simulation")}</Badge>
              </div>
              <p className="mb-3 text-xs text-muted">{pick("عدّل حمولة JSON التي يرسلها محرك الاحتيال ثم أرسلها إلى ZeRisk.", "Edit the JSON payload the fraud engine would send, then push it to ZeRisk.")}</p>
              <Textarea dir="ltr" className="min-h-64 font-mono text-xs" value={payload} onChange={(e) => setPayload(e.target.value)} />
              <div className="mt-3 flex gap-2">
                <Button onClick={sendApi} disabled={sending} className="flex-1">
                  <Send className="size-4" />{sending ? pick("جارٍ الإرسال…", "Sending…") : pick("إرسال الطلب", "Send request")}
                </Button>
                <Button variant="outline" onClick={() => copy(curl)}><Copy className="size-4" />curl</Button>
              </div>
            </Card>

            <Card className="p-5">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">{pick("استجابة ZeRisk", "ZeRisk response")}</h3>
              {apiResp ? (
                <pre dir="ltr" className="max-h-96 overflow-auto rounded-xl border border-navy-600 bg-navy-950/30 p-3 text-[11px] leading-relaxed text-slate-700">{apiResp}</pre>
              ) : (
                <div className="grid h-64 place-items-center text-center text-xs text-muted">
                  <div><Server className="mx-auto mb-2 size-8 opacity-40" />{pick("أرسل الطلب لعرض استجابة التقييم الحية", "Send the request to see the live scoring response")}</div>
                </div>
              )}
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Recent live transactions */}
      <Card className="p-5">
        <h3 className="mb-3 text-sm font-semibold text-slate-900">{pick("أحدث العمليات الحية المُدخلة", "Recent live-ingested transactions")}</h3>
        {recent.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted">{pick("لم تُدخل أي عملية حية بعد.", "No live transactions ingested yet.")}</p>
        ) : (
          <div className="space-y-2">
            {recent.map((r) => (
              <Link key={r.id} href={`/transactions/${r.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-navy-600 bg-navy-900/40 px-3 py-2 text-sm transition hover:border-coral-500/40">
                <span className="font-mono text-xs text-coral-600">{r.id}</span>
                <span className="text-slate-700">{fmtCurrency(r.amount, lang)}</span>
                <span className="flex items-center gap-1.5"><DecisionBadge decision={r.originalDecision} showIcon={false} /><ArrowRight className="size-3 text-muted rotate-180 rtl:rotate-0" /><DecisionBadge decision={r.recommendation} showIcon={false} /></span>
                {r.isFalsePositive && <Badge variant="coral"><ShieldAlert className="size-3" />{pick("رفض خاطئ", "False positive")}</Badge>}
                <ExternalLink className="size-3.5 text-muted" />
              </Link>
            ))}
          </div>
        )}
      </Card>

      <DisclaimerBar />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label>{label}</Label>{children}</div>;
}

function ResultPanel({ result }: { result: ActionResult | null }) {
  const { lang, pick, tr } = useI18n();
  if (!result) {
    return (
      <Card className="grid place-items-center p-5 text-center">
        <div className="text-muted"><Radio className="mx-auto mb-2 size-9 opacity-40" /><p className="text-sm">{pick("النتيجة الحية ستظهر هنا بعد الإرسال", "The live result will appear here after you send")}</p></div>
      </Card>
    );
  }
  const ai = result.ai;
  const recovered = result.isFalsePositive;
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="font-mono text-xs text-coral-600">{result.id}</p>
            <p className="text-xs text-muted">{result.source} · {fmtCurrency(result.amount, lang)}</p>
          </div>
          <Badge variant={recovered ? "coral" : "muted"}>{recovered ? pick("رفض خاطئ مُكتشف", "False positive detected") : pick("تم التقييم", "Assessed")}</Badge>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-navy-600 bg-navy-900/40 p-3 text-center">
            <p className="mb-2 text-[11px] text-muted">{pick("قرار المحرك الأصلي", "Original engine")}</p>
            <RiskGauge score={result.original.riskScore} size={104} />
            <div className="mt-2"><DecisionBadge decision={result.original.decision} /></div>
          </div>
          <div className="rounded-xl border border-coral-500/30 bg-coral-500/[0.04] p-3 text-center">
            <p className="mb-2 text-[11px] text-coral-600">{pick("توصية ZeRisk", "ZeRisk recommendation")}</p>
            <RiskGauge score={ai.optimizedRiskScore} size={104} />
            <div className="mt-2"><DecisionBadge decision={ai.recommendation} /></div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <Stat label={pick("احتمالية الرفض الخاطئ", "FP probability")} value={`${ai.falsePositiveProbability}%`} />
          <Stat label={pick("الثقة", "Confidence")} value={`${ai.confidence}%`} />
          <Stat label={pick("زمن المعالجة", "Latency")} value={`${ai.processingTimeMs} ms`} />
        </div>

        {ai.supporting.length > 0 && (
          <div className="mt-3">
            <p className="mb-1 text-xs font-medium text-emerald-700">{pick("أسباب تدعم الموافقة", "Reasons supporting approval")}</p>
            <ul className="space-y-0.5 text-xs text-slate-600">{ai.supporting.slice(0, 4).map((r, i) => <li key={i}>• {tr(r)}</li>)}</ul>
          </div>
        )}
        {ai.increasing.length > 0 && (
          <div className="mt-2">
            <p className="mb-1 text-xs font-medium text-amber-700">{pick("أسباب ترفع المخاطر", "Reasons increasing risk")}</p>
            <ul className="space-y-0.5 text-xs text-slate-600">{ai.increasing.slice(0, 4).map((r, i) => <li key={i}>• {tr(r)}</li>)}</ul>
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <Link href={`/transactions/${result.id}`} className="flex-1"><Button variant="secondary" className="w-full"><ExternalLink className="size-4" />{pick("التحليل الكامل", "Full analysis")}</Button></Link>
          <Link href={`/transactions?q=${result.id}`} className="flex-1"><Button variant="outline" className="w-full"><Radio className="size-4" />{pick("العمليات المباشرة", "Live transactions")}</Button></Link>
        </div>
      </Card>
    </motion.div>
  );
}
