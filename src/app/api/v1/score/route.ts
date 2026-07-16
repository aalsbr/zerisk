import { NextResponse } from "next/server";
import { scoreTransaction } from "@/lib/scoring";
import { buildRules } from "@/lib/demo-data";
import { getGovernance } from "@/lib/store";
import type { ScoringInput } from "@/lib/types";

// POST /api/v1/score — re-evaluate an existing fraud-engine decision.
export async function POST(req: Request) {
  let b: Record<string, unknown>;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const amount = Number(b.amount ?? 0);
  const deviceKnown = Boolean(b.deviceKnown ?? true);
  const beneficiaryKnown = Boolean(b.beneficiaryKnown ?? true);
  const rules = buildRules();
  const triggered = Array.isArray(b.triggeredRules) ? (b.triggeredRules as string[]) : [];
  const severities = triggered
    .map((id) => rules.find((r) => r.id === id)?.severity)
    .filter(Boolean) as ScoringInput["triggeredRuleSeverities"];

  const input: ScoringInput = {
    originalRiskScore: Number(b.originalRiskScore ?? 50),
    amount,
    customerAvgAmount: Number(b.customerAvgAmount ?? (amount / 1.4 || 1)),
    deviceKnown,
    deviceAgeDays: Number(b.deviceAgeDays ?? (deviceKnown ? 180 : 1)),
    deviceTxnCount: Number(b.deviceTxnCount ?? (deviceKnown ? 40 : 0)),
    beneficiaryKnown,
    beneficiaryTxnCount: Number(b.beneficiaryTxnCount ?? (beneficiaryKnown ? 12 : 0)),
    accountAgeMonths: Number(b.accountAgeMonths ?? 36),
    velocity1h: Number(b.velocity1h ?? 1),
    failedLogins: Number(b.failedLogins ?? 0),
    mfaPassed: Boolean(b.mfaPassed ?? true),
    locationFamiliar: Boolean(b.locationFamiliar ?? true),
    timeFamiliar: Boolean(b.timeFamiliar ?? true),
    historicalFraudCount: Number(b.historicalFraudCount ?? 0),
    historicalLegitCount: Number(b.historicalLegitCount ?? 30),
    triggeredRuleSeverities: severities,
    similarLegitOutcomes: Number(b.similarLegitOutcomes ?? 3),
    similarFraudOutcomes: Number(b.similarFraudOutcomes ?? 0),
  };

  const r = scoreTransaction(input, getGovernance());
  return NextResponse.json({
    transactionId: b.transactionId ?? null,
    optimizedRiskScore: r.optimizedRiskScore,
    falsePositiveProbability: r.falsePositiveProbability,
    recommendation: r.recommendation,
    confidence: r.confidence,
    reasonCodes: r.reasonCodes,
    processingTimeMs: r.processingTimeMs,
    disclaimer:
      "Decision-support only. Final enforcement depends on approved governance policies.",
  });
}
