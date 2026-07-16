import { getTransaction } from "@/lib/store";
import { HERO_IDS } from "@/lib/demo-data";
import { DemoView, type DemoStoryData } from "@/components/pages/demo-view";

export default function DemoPage() {
  const t = getTransaction(HERO_IDS.falsePositive);
  if (!t) throw new Error("Hero transaction not found");

  // Pass the FULL enriched (serializable) transaction so the story renders LIVE engine values.
  const data: DemoStoryData = {
    id: t.id,
    amount: t.amount,
    currency: t.currency,
    channel: t.channel,
    timestamp: t.timestamp,
    originalDecision: t.originalDecision,
    originalRiskScore: t.originalRiskScore,
    triggeredRuleIds: t.triggeredRuleIds,
    customer: {
      name: t.customer.name,
      nameEn: t.customer.nameEn,
      segment: t.customer.segment,
      accountAgeMonths: t.customer.accountAgeMonths,
      homeCity: t.customer.homeCity,
      homeCityEn: t.customer.homeCityEn,
      avgTxnAmount: t.customer.avgTxnAmount,
    },
    device: {
      label: t.device.label,
      known: t.device.known,
      trustScore: t.device.trustScore,
    },
    beneficiary: {
      name: t.beneficiary.name,
      nameEn: t.beneficiary.nameEn,
      bank: t.beneficiary.bank,
      known: t.beneficiary.known,
      trustScore: t.beneficiary.trustScore,
    },
    mfaPassed: t.mfaPassed,
    rules: t.rules.map((r) => ({
      id: r.id,
      name: r.name,
      nameEn: r.nameEn,
      severity: r.severity,
    })),
    ai: {
      optimizedRiskScore: t.ai.optimizedRiskScore,
      falsePositiveProbability: t.ai.falsePositiveProbability,
      recommendation: t.ai.recommendation,
      confidence: t.ai.confidence,
      supporting: t.ai.supporting.map((s) => ({
        code: s.code,
        ar: s.ar,
        en: s.en,
        weight: s.weight,
      })),
      processingTimeMs: t.ai.processingTimeMs,
    },
  };

  return <DemoView data={data} />;
}
