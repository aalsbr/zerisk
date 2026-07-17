import { getDataset, getIngested } from "@/lib/store";
import { IngestView } from "@/components/pages/ingest-view";

// Hidden page (not in the sidebar nav). Reachable at /ingest.
export default function IngestPage() {
  const { customers, rules } = getDataset();
  const recent = getIngested()
    .slice(0, 12)
    .map((t) => ({
      id: t.id,
      source: t.source ?? "",
      amount: t.amount,
      currency: t.currency,
      originalDecision: t.originalDecision,
      originalRiskScore: t.originalRiskScore,
      recommendation: t.ai.recommendation,
      optimizedRiskScore: t.ai.optimizedRiskScore,
      falsePositiveProbability: t.ai.falsePositiveProbability,
      isFalsePositive: t.isFalsePositive,
    }));

  return (
    <IngestView
      customers={customers.map((c) => ({ id: c.id, name: c.name, nameEn: c.nameEn, segment: c.segment }))}
      rules={rules.map((r) => ({ id: r.id, name: r.name, nameEn: r.nameEn, action: r.action }))}
      recent={recent}
    />
  );
}
