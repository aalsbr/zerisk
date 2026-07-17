import { NextResponse } from "next/server";
import { ingestTransaction } from "@/lib/store";
import type { Channel, Decision, IngestInput, TxnCategory } from "@/lib/types";

const DECISIONS: Decision[] = ["APPROVE", "REVIEW", "REJECT", "MONITOR"];

// POST /api/v1/ingest — a fraud engine (e.g. IBM Safer Payments) pushes a live
// transaction. ZeRisk scores + persists it and returns its optimized decision.
export async function POST(req: Request) {
  let b: Record<string, unknown>;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const amount = Number(b.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "amount (positive number) is required" }, { status: 400 });
  }
  const originalDecision = String(b.originalDecision ?? "").toUpperCase() as Decision;
  if (!DECISIONS.includes(originalDecision)) {
    return NextResponse.json({ error: `originalDecision must be one of ${DECISIONS.join(", ")}` }, { status: 400 });
  }

  const input: IngestInput = {
    transactionId: typeof b.transactionId === "string" ? b.transactionId : undefined,
    customerId: typeof b.customerId === "string" ? b.customerId : undefined,
    amount,
    currency: typeof b.currency === "string" ? b.currency : "SAR",
    channel: (b.channel as Channel) ?? "WEB",
    category: b.category as TxnCategory | undefined,
    region: b.region as IngestInput["region"],
    deviceKnown: Boolean(b.deviceKnown ?? true),
    beneficiaryKnown: Boolean(b.beneficiaryKnown ?? true),
    mfaPassed: Boolean(b.mfaPassed ?? true),
    failedLogins: b.failedLogins != null ? Number(b.failedLogins) : 0,
    velocity1h: b.velocity1h != null ? Number(b.velocity1h) : 1,
    passwordResetRecently: Boolean(b.passwordResetRecently ?? false),
    locationFamiliar: Boolean(b.locationFamiliar ?? true),
    timeFamiliar: Boolean(b.timeFamiliar ?? true),
    hour: b.hour != null ? Number(b.hour) : undefined,
    originalDecision,
    originalRiskScore: Number(b.originalRiskScore ?? 50),
    // accept both `triggeredRules` (IBM-style) and `triggeredRuleIds`
    triggeredRuleIds: Array.isArray(b.triggeredRules)
      ? (b.triggeredRules as string[])
      : Array.isArray(b.triggeredRuleIds)
        ? (b.triggeredRuleIds as string[])
        : [],
    source: typeof b.source === "string" ? b.source : "IBM Safer Payments",
  };

  const t = ingestTransaction(input);
  return NextResponse.json({
    accepted: true,
    transactionId: t.id,
    source: t.source,
    original: { decision: t.originalDecision, riskScore: t.originalRiskScore },
    zerisk: {
      recommendation: t.ai.recommendation,
      optimizedRiskScore: t.ai.optimizedRiskScore,
      falsePositiveProbability: t.ai.falsePositiveProbability,
      confidence: t.ai.confidence,
      isFalsePositive: t.isFalsePositive,
      reasonCodes: t.ai.reasonCodes,
      processingTimeMs: t.ai.processingTimeMs,
    },
    links: { analysis: `/transactions/${t.id}`, live: `/transactions?q=${t.id}` },
    disclaimer: "Decision-support only. Final enforcement depends on approved governance policies.",
  });
}
