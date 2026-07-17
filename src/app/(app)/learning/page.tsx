import {
  getLearningEvents,
  getModelVersions,
  getCalibration,
  getProfiles,
  getTransaction,
} from "@/lib/store";
import { LearningView } from "@/components/pages/learning-view";
import { DEMO_IDS } from "@/lib/demo-data";
import type { EnrichedTransaction } from "@/lib/types";

function learnCard(id: string) {
  const t: EnrichedTransaction | undefined = getTransaction(id);
  if (!t) return null;
  return {
    id: t.id,
    originalDecision: t.originalDecision,
    originalRiskScore: t.originalRiskScore,
    ai: {
      recommendation: t.ai.recommendation,
      optimizedRiskScore: t.ai.optimizedRiskScore,
      falsePositiveProbability: t.ai.falsePositiveProbability,
      confidence: t.ai.confidence,
    },
    feedback: t.feedback
      ? {
          outcome: t.feedback.outcome,
          note: t.feedback.note ?? null,
          at: t.feedback.at,
        }
      : null,
  };
}

export default function LearningPage() {
  const profiles = getProfiles();

  const topDevices = Array.from(profiles.devices.values())
    .sort((a, b) => b.successfulTransactionCount - a.successfulTransactionCount)
    .slice(0, 8)
    .map((d) => ({
      id: d.id,
      label: d.label,
      known: d.known,
      successfulTransactionCount: d.successfulTransactionCount,
      fraudCount: d.fraudCount,
      legitimateCount: d.legitimateCount,
      customerCount: d.customerCount,
      trustScore: d.trustScore,
    }));

  const topRules = Array.from(profiles.rules.values())
    .sort((a, b) => b.falsePositiveCount - a.falsePositiveCount)
    .slice(0, 8)
    .map((r) => ({
      id: r.id,
      name: r.name,
      nameEn: r.nameEn,
      triggerCount: r.triggerCount,
      falsePositiveCount: r.falsePositiveCount,
      confirmedFraudCount: r.confirmedFraudCount,
      falsePositiveRate: r.falsePositiveRate,
      currentWeight: r.currentWeight,
      recommendedWeight: r.recommendedWeight,
    }));

  return (
    <LearningView
      events={getLearningEvents()}
      modelVersions={getModelVersions()}
      calibration={getCalibration()}
      topDevices={topDevices}
      topRules={topRules}
      learn1={learnCard(DEMO_IDS.learn1)}
      learn2={learnCard(DEMO_IDS.learn2)}
      learnId1={DEMO_IDS.learn1}
      learnId2={DEMO_IDS.learn2}
    />
  );
}
