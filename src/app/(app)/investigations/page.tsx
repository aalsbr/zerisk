import { getDataset } from "@/lib/store";
import { InvestigationsView, type InvestigationCase } from "@/components/pages/investigations-view";

export default function InvestigationsPage() {
  const { transactions } = getDataset();

  const isQueued = (t: (typeof transactions)[number]) =>
    t.originalDecision === "REVIEW" ||
    t.originalDecision === "REJECT" ||
    t.ai.recommendation === "REVIEW" ||
    t.ai.recommendation === "REJECT";

  const queued = transactions.filter(isQueued);

  // Similar cases lookup by scenario (ids only).
  const byScenario = new Map<string, string[]>();
  for (const t of transactions) {
    const arr = byScenario.get(t.scenario) ?? [];
    arr.push(t.id);
    byScenario.set(t.scenario, arr);
  }

  const cases: InvestigationCase[] = queued.slice(0, 25).map((t) => {
    const similar = (byScenario.get(t.scenario) ?? [])
      .filter((id) => id !== t.id)
      .slice(0, 3);

    return {
      id: t.id,
      amount: t.amount,
      currency: t.currency,
      channel: t.channel,
      customerName: t.customer.name,
      customerNameEn: t.customer.nameEn,
      segment: t.customer.segment,
      originalDecision: t.originalDecision,
      originalRiskScore: t.originalRiskScore,
      aiRecommendation: t.ai.recommendation,
      optimizedRiskScore: t.ai.optimizedRiskScore,
      falsePositiveProbability: t.ai.falsePositiveProbability,
      isActuallyFraud: t.isActuallyFraud,
      isFalsePositive: t.isFalsePositive,
      scenario: t.scenario,
      supporting: t.ai.supporting.slice(0, 3).map((r) => ({ ar: r.ar, en: r.en })),
      increasing: t.ai.increasing.slice(0, 3).map((r) => ({ ar: r.ar, en: r.en })),
      similarIds: similar,
      feedback: t.feedback
        ? {
            outcome: t.feedback.outcome,
            note: t.feedback.note,
            investigator: t.feedback.investigator,
            resolutionMinutes: t.feedback.resolutionMinutes,
            at: t.feedback.at,
          }
        : null,
    };
  });

  return <InvestigationsView cases={cases} />;
}
