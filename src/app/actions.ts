"use server";

import { revalidatePath } from "next/cache";
import {
  getTransaction,
  ingestTransaction,
  recalibrate,
  resetDemo,
  saveSimulation,
  setAppliedDecision,
  setAssumptions,
  setFeedback,
  setGovernance,
  setInsightStatus,
  setRuleStatus,
} from "@/lib/store";
import type {
  FinancialAssumptions,
  IngestInput,
  InsightStatus,
  InvestigationOutcome,
  RuleStatus,
} from "@/lib/types";
import type { Governance } from "@/lib/scoring";

const NOW = () => new Date(Date.UTC(2026, 6, 17, 12, 0)).toISOString();

function refresh() {
  revalidatePath("/", "layout");
}

export async function submitFeedbackAction(
  id: string,
  outcome: InvestigationOutcome,
  note: string,
  investigator = "Investigator",
) {
  setFeedback(id, {
    outcome,
    note,
    investigator,
    resolutionMinutes: 12,
    at: NOW(),
  });
  refresh();
  return { ok: true };
}

export async function applyRecommendationAction(id: string) {
  const t = getTransaction(id);
  if (t) setAppliedDecision(id, t.ai.recommendation);
  refresh();
  return { ok: true, decision: t?.ai.recommendation };
}

export async function keepOriginalAction(id: string) {
  const t = getTransaction(id);
  if (t) setAppliedDecision(id, t.originalDecision);
  refresh();
  return { ok: true };
}

export async function sendToReviewAction(id: string) {
  setAppliedDecision(id, "REVIEW");
  refresh();
  return { ok: true };
}

export async function markFalsePositiveAction(id: string) {
  setFeedback(id, {
    outcome: "LEGITIMATE",
    note: "Marked as false positive",
    investigator: "Investigator",
    resolutionMinutes: 8,
    at: NOW(),
  });
  refresh();
  return { ok: true };
}

export async function markConfirmedFraudAction(id: string) {
  setFeedback(id, {
    outcome: "CONFIRMED_FRAUD",
    note: "Confirmed fraud",
    investigator: "Investigator",
    resolutionMinutes: 15,
    at: NOW(),
  });
  refresh();
  return { ok: true };
}

export async function addNoteAction(id: string, note: string) {
  setFeedback(id, {
    outcome: "INCONCLUSIVE",
    note,
    investigator: "Investigator",
    resolutionMinutes: 5,
    at: NOW(),
  });
  refresh();
  return { ok: true };
}

export async function setInsightStatusAction(id: string, status: InsightStatus) {
  setInsightStatus(id, status);
  refresh();
  return { ok: true };
}

export async function setRuleStatusAction(id: string, status: RuleStatus) {
  setRuleStatus(id, status);
  refresh();
  return { ok: true };
}

export async function saveGovernanceAction(gov: Partial<Governance>) {
  setGovernance(gov);
  refresh();
  return { ok: true };
}

export async function saveAssumptionsAction(a: Partial<FinancialAssumptions>) {
  setAssumptions(a);
  refresh();
  return { ok: true };
}

export async function saveSimulationAction(
  ruleId: string,
  netBenefit: number,
  verdict: string,
) {
  saveSimulation(ruleId, netBenefit, verdict);
  refresh();
  return { ok: true };
}

export async function resetDemoDataAction() {
  resetDemo();
  refresh();
  return { ok: true };
}

export async function recalibrateModelAction() {
  const summary = recalibrate();
  refresh();
  return { ok: true, summary };
}

export async function ingestTransactionAction(input: IngestInput) {
  const t = ingestTransaction(input);
  refresh();
  return {
    ok: true,
    id: t.id,
    source: t.source,
    original: { decision: t.originalDecision, riskScore: t.originalRiskScore },
    ai: {
      recommendation: t.ai.recommendation,
      optimizedRiskScore: t.ai.optimizedRiskScore,
      falsePositiveProbability: t.ai.falsePositiveProbability,
      confidence: t.ai.confidence,
      processingTimeMs: t.ai.processingTimeMs,
      supporting: t.ai.supporting.map((r) => ({ ar: r.ar, en: r.en })),
      increasing: t.ai.increasing.map((r) => ({ ar: r.ar, en: r.en })),
      riskBreakdown: t.ai.riskBreakdown,
    },
    isFalsePositive: t.isFalsePositive,
    customer: { name: t.customer.name, nameEn: t.customer.nameEn, segment: t.customer.segment },
    amount: t.amount,
    currency: t.currency,
  };
}
