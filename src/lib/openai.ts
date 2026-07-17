// ============================================================================
// ZeRisk — Optional OpenAI Copilot service.
//
// The Copilot ONLY explains / summarizes / recommends. It NEVER approves or
// rejects transactions — the local deterministic scoring engine is always the
// source of truth. If no OPENAI_API_KEY is configured (or the API errors), every
// function transparently falls back to a local, data-driven answer so the whole
// app keeps working offline.
//
// Architecture:  Rule Engine → Scoring Engine → OpenAI Copilot (optional) → Insights
// ============================================================================

import "server-only";
import { z } from "zod";
import type { EnrichedTransaction, RuleStat } from "./types";
import type { SimulationConfig, SimulationOutput } from "./simulation";
import { sar } from "./format";
import { getCalibration, getProfiles } from "./store";

export const COPILOT_MODEL = process.env.OPENAI_MODEL || "gpt-5.5";

export function isCopilotOnline(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export interface CopilotMeta {
  source: "openai" | "local";
  model: string;
  online: boolean;
}

function meta(source: CopilotMeta["source"]): CopilotMeta {
  return { source, model: COPILOT_MODEL, online: isCopilotOnline() };
}

// ---- Low-level Responses API call (no SDK; plain fetch) ----------------------

async function callResponses(
  system: string,
  user: string,
  json = true,
): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const controller = new AbortController();
  // Reasoning models (e.g. gpt-5.5) can take a while — allow generous time.
  const timeout = setTimeout(() => controller.abort(), 45000);
  try {
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: COPILOT_MODEL,
        input: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        ...(json ? { text: { format: { type: "json_object" } } } : {}),
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return extractResponseText(data);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// Robustly extract assistant text from a Responses API payload. Reasoning models
// return an `output` array whose first item is a `reasoning` block and whose
// actual answer lives in a later `message` item's `output_text` content.
function extractResponseText(data: unknown): string | null {
  const d = data as {
    output_text?: unknown;
    output?: Array<{ type?: string; content?: Array<{ type?: string; text?: unknown }> }>;
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  if (typeof d.output_text === "string" && d.output_text.trim()) return d.output_text;
  const items = Array.isArray(d.output) ? d.output : [];
  const message = items.find((o) => o?.type === "message") ?? items[items.length - 1];
  const content = Array.isArray(message?.content) ? message!.content : [];
  const part =
    content.find((c) => c?.type === "output_text" && typeof c.text === "string") ??
    content.find((c) => typeof c?.text === "string");
  if (part && typeof part.text === "string" && part.text.trim()) return part.text;
  const legacy = d.choices?.[0]?.message?.content;
  return typeof legacy === "string" ? legacy : null;
}

function parseJson<T>(text: string | null): T | null {
  if (!text) return null;
  try {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) return null;
    return JSON.parse(text.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

// ---- Copilot chat refinement (grounded on local facts) ----------------------

const COPILOT_SYSTEM =
  "You are the Fraud AI Copilot for a bank. You ONLY explain, summarize and recommend — " +
  "you never make the final approve/reject decision (the local scoring engine is the source " +
  "of truth). You are given GROUNDED FACTS computed locally; base your answer strictly on them, " +
  "never invent numbers or decisions. Answer in the user's language, concise and professional. " +
  "Return plain text (short paragraphs / dash bullets), not JSON.";

// Returns a refined answer string, or null to signal the caller to use the local answer.
export async function copilotRefine(
  question: string,
  groundedFacts: string,
  lang: "ar" | "en",
): Promise<string | null> {
  if (!isCopilotOnline()) return null;
  const user =
    `User question (${lang}): ${question}\n\nGROUNDED FACTS (authoritative — do not contradict):\n${groundedFacts}\n\n` +
    `Write a helpful ${lang === "ar" ? "Arabic" : "English"} answer using only these facts.`;
  return callResponses(COPILOT_SYSTEM, user, false);
}

const ANALYST_SYSTEM =
  "You are a senior fraud analytics expert acting as a decision-support copilot for a bank. " +
  "You ONLY explain, summarize, and recommend. You never make the final approve/reject decision — " +
  "the bank's deterministic scoring engine is the source of truth. Always respond in valid JSON only.";

// ---- 1. Transaction analysis (Zod-validated, grounded on dynamic context) ----

const EvidenceItem = z.object({
  signal: z.string(),
  value: z.string(),
  source: z.string(),
});
const RuleAssessmentItem = z.object({
  ruleId: z.string(),
  falsePositiveRate: z.number(),
  recommendation: z.string(),
});
// The LLM must return this exact shape; anything else → validation fails → local.
const TxnAnalysisSchema = z.object({
  summary: z.string().min(1),
  customerImpact: z.string().min(1),
  businessImpact: z.string().min(1),
  supportingEvidence: z.array(EvidenceItem).default([]),
  contradictingEvidence: z.array(EvidenceItem).default([]),
  ruleAssessment: z.array(RuleAssessmentItem).default([]),
});
type TxnAnalysisPayload = z.infer<typeof TxnAnalysisSchema>;

export interface TxnAnalysis extends TxnAnalysisPayload {
  // decisions/scores ALWAYS from the local engine, never the LLM
  optimizedDecision: string;
  confidence: number;
  falsePositiveProbability: number;
  validationFailed: boolean;
  meta: CopilotMeta;
}

// Build the dynamic, authoritative context the LLM must reason over (it must not
// invent numbers — every figure here is computed locally from profiles/labels).
function buildTxnContext(t: EnrichedTransaction) {
  const profiles = getProfiles();
  const cal = getCalibration();
  const dp = profiles.devices.get(t.deviceId);
  const bp = profiles.beneficiaries.get(t.beneficiaryId);
  const cp = profiles.customers.get(t.customerId);
  const seg = profiles.segments.get(t.customer.segment);
  const chan = profiles.channels.get(t.channel);
  const rulePerf = t.triggeredRuleIds.map((id) => {
    const r = profiles.rules.get(id);
    return r ? { ruleId: id, precision: r.precision, falsePositiveRate: r.falsePositiveRate, confirmedFraud: r.confirmedFraudCount } : { ruleId: id };
  });
  return {
    modelVersion: cal.version,
    governance: "Local scoring engine is the source of truth; you only explain.",
    transaction: {
      id: t.id, amount: t.amount, currency: t.currency, channel: t.channel, category: t.category,
      originalDecision: t.originalDecision, originalRiskScore: t.originalRiskScore, triggeredRules: t.triggeredRuleIds,
      hour: t.hour, mfaPassed: t.mfaPassed, failedLogins: t.failedLogins, velocity1h: t.velocity1h,
    },
    localEngineResult: {
      recommendation: t.ai.recommendation, optimizedRiskScore: t.ai.optimizedRiskScore,
      falsePositiveProbability: t.ai.falsePositiveProbability, confidence: t.ai.confidence,
      riskBreakdown: t.ai.riskBreakdown,
    },
    customerProfile: cp && { segment: cp.segment, accountAgeMonths: t.customer.accountAgeMonths, confirmedFraud: cp.confirmedFraudCount, legitimate: cp.legitimateCount, historicalRiskRate: cp.historicalRiskRate, avgAmount: cp.averageAmount },
    deviceProfile: dp && { trusted: dp.known, successfulTransactions: dp.successfulTransactionCount, fraud: dp.fraudCount, legit: dp.legitimateCount, customerCount: dp.customerCount, trustScore: dp.trustScore },
    beneficiaryProfile: bp && { known: t.beneficiary.known, type: bp.type, successfulTransactions: bp.successfulTransactionCount, fraud: bp.fraudCount, legit: bp.legitimateCount, trustScore: bp.trustScore },
    channelRisk: chan?.fraudRate, segmentRisk: seg?.fraudRate,
    rulePerformance: rulePerf,
    supportingSignals: t.ai.supporting.map((r) => r.en),
    contradictingSignals: t.ai.increasing.map((r) => r.en),
  };
}

export async function analyzeTransaction(t: EnrichedTransaction): Promise<TxnAnalysis> {
  const local = localTxnAnalysis(t);
  if (!isCopilotOnline()) return local;

  const ctx = buildTxnContext(t);
  const user =
    "Analyze this transaction. The local engine already produced the decision — EXPLAIN it, do not change it. " +
    "Use ONLY the numbers provided (never invent statistics). Every evidence item MUST include a `source` field " +
    "(e.g. device_profile, beneficiary_profile, transaction, rule_performance). Return JSON with keys: " +
    "summary, customerImpact, businessImpact, supportingEvidence (array of {signal,value,source}), " +
    "contradictingEvidence (array of {signal,value,source}), ruleAssessment (array of {ruleId,falsePositiveRate,recommendation}).\n\n" +
    JSON.stringify(ctx, null, 2);

  const raw = parseJson<unknown>(await callResponses(ANALYST_SYSTEM, user));
  const parsed = raw ? TxnAnalysisSchema.safeParse(raw) : null;
  if (!parsed || !parsed.success) {
    // Reject unsupported/invalid output → fall back to the local explanation engine.
    console.warn("[copilot] OpenAI transaction analysis failed validation; using local fallback", parsed && !parsed.success ? parsed.error.issues.slice(0, 2) : "no-json");
    return { ...local, validationFailed: true };
  }
  return {
    ...parsed.data,
    optimizedDecision: t.ai.recommendation,
    confidence: t.ai.confidence,
    falsePositiveProbability: t.ai.falsePositiveProbability,
    validationFailed: false,
    meta: meta("openai"),
  };
}

function localTxnAnalysis(t: EnrichedTransaction): TxnAnalysis {
  const dp = getProfiles().devices.get(t.deviceId);
  const bp = getProfiles().beneficiaries.get(t.beneficiaryId);
  const recovered = t.isFalsePositive;
  const supportingEvidence = t.ai.supporting.slice(0, 4).map((r) => ({
    signal: r.code, value: r.en, source: r.code.includes("DEVICE") ? "device_profile" : r.code.includes("BENEFICIARY") ? "beneficiary_profile" : "transaction",
  }));
  const contradictingEvidence = t.ai.increasing.slice(0, 4).map((r) => ({ signal: r.code, value: r.en, source: "transaction" }));
  return {
    summary: recovered
      ? `The legacy engine ${t.originalDecision.toLowerCase()}ed a ${sar(t.amount)} transaction that ZeRisk assesses as legitimate (optimized risk ${t.ai.optimizedRiskScore}/100, ${t.ai.falsePositiveProbability}% false-positive probability). Recommendation: ${t.ai.recommendation}.`
      : `ZeRisk confirms an optimized risk score of ${t.ai.optimizedRiskScore}/100 with recommendation ${t.ai.recommendation} at ${t.ai.confidence}% confidence.`,
    customerImpact: recovered
      ? "A legitimate customer would have faced a declined transaction and likely a support call. Approving preserves the customer experience."
      : "Recommendation protects the customer while maintaining fraud controls.",
    businessImpact: recovered
      ? `Recovering this transaction protects ~${sar(t.amount)} in transaction value and avoids manual review and support cost.`
      : "Decision maintains fraud protection within governance limits.",
    supportingEvidence: supportingEvidence.length ? supportingEvidence : [{ signal: "BALANCED", value: `${dp?.legitimateCount ?? 0} legit device outcomes, ${bp?.legitimateCount ?? 0} legit beneficiary outcomes`, source: "profiles" }],
    contradictingEvidence,
    ruleAssessment: t.triggeredRuleIds.map((id) => {
      const r = getProfiles().rules.get(id);
      return { ruleId: id, falsePositiveRate: r?.falsePositiveRate ?? 0, recommendation: (r?.falsePositiveRate ?? 0) >= 40 ? "Reduce rule weight for trusted patterns" : "Keep" };
    }),
    optimizedDecision: t.ai.recommendation,
    confidence: t.ai.confidence,
    falsePositiveProbability: t.ai.falsePositiveProbability,
    validationFailed: false,
    meta: meta("local"),
  };
}

// ---- 2. Rule performance analysis -------------------------------------------

export interface RuleAnalysis {
  weaknesses: string[];
  falsePositiveCauses: string[];
  businessImpact: string;
  recommendation: string;
  suggestedThreshold: number | null;
  confidence: number;
  meta: CopilotMeta;
}

export async function analyzeRulePerformance(stat: RuleStat): Promise<RuleAnalysis> {
  const local = localRuleAnalysis(stat);
  const user =
    "Analyze this fraud rule performance. Return JSON with keys: weaknesses (array), " +
    "falsePositiveCauses (array), businessImpact (string), recommendation (string), " +
    "suggestedThreshold (number or null), confidence (number).\n\n" +
    JSON.stringify(
      {
        rule: stat.rule.nameEn,
        action: stat.rule.action,
        severity: stat.rule.severity,
        triggerCount: stat.triggerCount,
        confirmedFraud: stat.confirmedFraud,
        falsePositives: stat.falsePositives,
        precision: stat.precision,
        falsePositiveRate: stat.falsePositiveRate,
        currentThreshold: stat.rule.amountThreshold ?? null,
      },
      null,
      2,
    );
  const out = parseJson<Partial<RuleAnalysis>>(await callResponses(ANALYST_SYSTEM, user));
  if (!out) return local;
  return { ...local, ...out, meta: meta("openai") };
}

function localRuleAnalysis(s: RuleStat): RuleAnalysis {
  return {
    weaknesses: [
      `${s.falsePositiveRate}% false-positive rate against ${s.precision}% precision.`,
      s.rule.action === "REJECT"
        ? "Hard-rejects transactions without a mitigating-signal exception."
        : "Escalates too many legitimate transactions to manual review.",
    ],
    falsePositiveCauses: [
      "Static threshold ignores trusted-device and customer-history context.",
      "No exception for tenured customers with clean behavioral history.",
    ],
    businessImpact: `Estimated ${sar(s.financialImpact)} in false-decline impact from ${s.falsePositives.toLocaleString()} false positives.`,
    recommendation:
      s.falsePositiveRate >= 45
        ? "Raise the amount threshold and add a trusted-device exception."
        : "Reduce rule weight and monitor precision.",
    suggestedThreshold: s.rule.amountThreshold ? Math.round(s.rule.amountThreshold * 1.6) : null,
    confidence: 86,
    meta: meta("local"),
  };
}

// ---- 3. Executive summary ----------------------------------------------------

export async function generateExecutiveSummary(ctx: {
  recoveredTransactions: number;
  revenueRecovered: number;
  fpRateBefore: number;
  fpRateAfter: number;
  topRule: string;
}): Promise<{ text: string; meta: CopilotMeta }> {
  const local = {
    text: `Over the last 30 days ZeRisk recovered ${ctx.recoveredTransactions.toLocaleString()} legitimate transactions that were set to be declined, worth an estimated ${sar(ctx.revenueRecovered)}, while cutting the false-positive rate from ${ctx.fpRateBefore}% to ${ctx.fpRateAfter}% and keeping fraud detection within approved limits. Rule ${ctx.topRule} remains the largest single source of false declines and is the top optimization opportunity.`,
    meta: meta("local"),
  };
  const user =
    "Write a concise 3-4 sentence executive summary (JSON: {\"text\": \"...\"}) from this data:\n" +
    JSON.stringify(ctx, null, 2);
  const out = parseJson<{ text: string }>(await callResponses(ANALYST_SYSTEM, user));
  return out?.text ? { text: out.text, meta: meta("openai") } : local;
}

// ---- 4. Fraud insights -------------------------------------------------------

export async function generateFraudInsights(
  stats: RuleStat[],
): Promise<{ insights: string[]; meta: CopilotMeta }> {
  const worst = stats[0];
  const local = {
    insights: [
      `Rule ${worst?.rule.id} drives the most false positives (${worst?.falsePositives.toLocaleString()}) at only ${worst?.precision}% precision.`,
      "Known-device transactions show a materially lower confirmed-fraud rate than new-device transactions.",
      "Tenured customers (24+ months) are over-penalized relative to their actual fraud rate.",
      "A meaningful share of manual reviews on high-confidence cases could be safely automated.",
    ],
    meta: meta("local"),
  };
  const user =
    "Generate 4 sharp fraud analytics insights (JSON: {\"insights\": [\"...\"]}) from these rule stats:\n" +
    JSON.stringify(stats.slice(0, 5).map((s) => ({ id: s.rule.id, fp: s.falsePositives, precision: s.precision })), null, 2);
  const out = parseJson<{ insights: string[] }>(await callResponses(ANALYST_SYSTEM, user));
  return out?.insights?.length ? { insights: out.insights, meta: meta("openai") } : local;
}

// ---- 5. Simulation summary ---------------------------------------------------

export async function generateSimulationSummary(
  config: SimulationConfig,
  result: SimulationOutput,
): Promise<{ text: string; meta: CopilotMeta }> {
  const local = {
    text: `Applying this change to the historical dataset would recover ${(result.transactionsAffected && result.fpBefore - result.fpAfter).toLocaleString()} legitimate transactions, reduce manual reviews by ${result.frictionReduction}%, and create an estimated net benefit of ${sar(result.netBenefit)}, with an estimated additional fraud exposure of ${sar(result.fraudExposure)}. Verdict: ${result.verdict.replace(/_/g, " ").toLowerCase()}.`,
    meta: meta("local"),
  };
  const user =
    "Summarize this rule-change simulation in 2-3 sentences (JSON: {\"text\": \"...\"}):\n" +
    JSON.stringify({ config, result }, null, 2);
  const out = parseJson<{ text: string }>(await callResponses(ANALYST_SYSTEM, user));
  return out?.text ? { text: out.text, meta: meta("openai") } : local;
}

// ---- 6. Investigator recommendation -----------------------------------------

export async function generateInvestigatorRecommendation(
  t: EnrichedTransaction,
): Promise<{ recommendation: string; rationale: string[]; meta: CopilotMeta }> {
  const local = {
    recommendation:
      t.ai.recommendation === "APPROVE"
        ? "Likely legitimate — approve unless new adverse evidence appears."
        : t.ai.recommendation === "REJECT"
          ? "Strong fraud indicators — confirm and block."
          : "Insufficient certainty — gather one additional signal before deciding.",
    rationale: [
      ...t.ai.supporting.slice(0, 2).map((r) => r.en),
      ...t.ai.increasing.slice(0, 2).map((r) => r.en),
    ],
    meta: meta("local"),
  };
  const user =
    "Give an investigator a recommendation and rationale (JSON: {\"recommendation\": \"...\", \"rationale\": [\"...\"]}):\n" +
    JSON.stringify(buildTxnContext(t), null, 2);
  const out = parseJson<{ recommendation: string; rationale: string[] }>(
    await callResponses(ANALYST_SYSTEM, user),
  );
  return out?.recommendation
    ? { recommendation: out.recommendation, rationale: out.rationale ?? local.rationale, meta: meta("openai") }
    : local;
}
