// ============================================================================
// ZeRisk — lightweight adaptive learning: derive calibration factors from the
// adaptive risk profiles (historical frequencies / feature risk rates), version
// the model, and produce explainable learning events. No neural nets; fully
// deterministic given the same labeled data.
// ============================================================================

import type { Calibration, LearningChange, ModelVersion } from "./types";
import type { Profiles } from "./profiles";

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

// Uncalibrated baseline (FL-MVP-1.0) — neutral multipliers.
export const BASE_VERSION = "FL-MVP-1.0";

export function baselineCalibration(): Calibration {
  return {
    version: BASE_VERSION,
    createdAt: new Date(Date.UTC(2025, 7, 1)).toISOString(),
    labeledCount: 0,
    deviceTrustBoost: 0,
    beneficiaryHistoryBoost: 0,
    velocityWeight: 1,
    fpCalibration: 1,
    confidenceBias: 0,
    ruleWeightAdjust: {},
    segmentRisk: {},
    channelRisk: {},
  };
}

function featureRate(profiles: Profiles, name: string): number | null {
  const f = profiles.features.find((x) => x.feature === name);
  return f && f.legitWithFeature + f.fraudWithFeature > 0 ? f.fraudRate : null;
}

// Derive calibration from labeled profiles. Deterministic.
export function computeCalibration(profiles: Profiles, version: string, createdAt: string): Calibration {
  const base = profiles.baseFraudRate || 0.03;

  const trustedRate = featureRate(profiles, "TRUSTED_DEVICE") ?? base * 0.2;
  const knownBenRate = featureRate(profiles, "KNOWN_BENEFICIARY") ?? base * 0.3;
  const velocityRate = featureRate(profiles, "HIGH_VELOCITY") ?? base * 3;

  // Trusted device / known beneficiary fraud far below base → boost their trust.
  const deviceTrustBoost = clamp((base - trustedRate) * 220, 0, 22);
  const beneficiaryHistoryBoost = clamp((base - knownBenRate) * 180, 0, 16);
  const velocityWeight = clamp(0.9 + (velocityRate / Math.max(base, 0.001)) * 0.06, 0.9, 1.8);

  // FP calibration: the more the labeled data shows recoverable FPs, the more we
  // trust the false-positive signal (>1 amplifies recovery of legitimate txns).
  const totalFP = [...profiles.rules.values()].reduce((a, r) => a + r.falsePositiveCount, 0);
  const totalTrig = [...profiles.rules.values()].reduce((a, r) => a + r.triggerCount, 0) || 1;
  const fpCalibration = clamp(1 + (totalFP / totalTrig) * 0.6, 1, 1.6);

  const confidenceBias = clamp(Math.log10(Math.max(10, profiles.labeledCount)) * 2 - 2, 0, 8);

  const ruleWeightAdjust: Record<string, number> = {};
  for (const r of profiles.rules.values()) {
    ruleWeightAdjust[r.id] = +(r.recommendedWeight / Math.max(1, r.currentWeight)).toFixed(3);
  }
  const segmentRisk: Record<string, number> = {};
  for (const g of profiles.segments.values()) segmentRisk[g.key] = g.fraudRate;
  const channelRisk: Record<string, number> = {};
  for (const g of profiles.channels.values()) channelRisk[g.key] = g.fraudRate;

  return {
    version, createdAt, labeledCount: profiles.labeledCount,
    deviceTrustBoost: +deviceTrustBoost.toFixed(2),
    beneficiaryHistoryBoost: +beneficiaryHistoryBoost.toFixed(2),
    velocityWeight: +velocityWeight.toFixed(3),
    fpCalibration: +fpCalibration.toFixed(3),
    confidenceBias: +confidenceBias.toFixed(2),
    ruleWeightAdjust, segmentRisk, channelRisk,
  };
}

export function nextVersion(v: string): string {
  const m = v.match(/FL-MVP-(\d+)\.(\d+)/);
  if (!m) return "FL-MVP-1.1";
  const major = Number(m[1]);
  const minor = Number(m[2]) + 1;
  return `FL-MVP-${major}.${minor}`;
}

// Explainable diff between two calibrations.
export function diffCalibration(prev: Calibration, next: Calibration): LearningChange[] {
  const changes: LearningChange[] = [];
  const num = (field: string, ar: string, en: string, a: number, b: number, unit = "") => {
    if (Math.abs(a - b) < 1e-6) return;
    const deltaPct = a !== 0 ? +(((b - a) / Math.abs(a)) * 100).toFixed(1) : undefined;
    changes.push({ field, before: `${a}${unit}`, after: `${b}${unit}`, deltaPct, ar, en });
  };
  num("deviceTrustBoost", "وزن ثقة الجهاز", "Device trust weighting", prev.deviceTrustBoost, next.deviceTrustBoost);
  num("beneficiaryHistoryBoost", "وزن سجل المستفيد", "Beneficiary history weighting", prev.beneficiaryHistoryBoost, next.beneficiaryHistoryBoost);
  num("velocityWeight", "وزن السرعة", "Velocity weighting", prev.velocityWeight, next.velocityWeight);
  num("fpCalibration", "معايرة الرفض الخاطئ", "False-positive calibration", prev.fpCalibration, next.fpCalibration);
  num("confidenceBias", "معايرة الثقة", "Confidence calibration", prev.confidenceBias, next.confidenceBias);
  // rule weight changes
  for (const id of Object.keys(next.ruleWeightAdjust)) {
    const a = prev.ruleWeightAdjust[id] ?? 1;
    const b = next.ruleWeightAdjust[id];
    if (Math.abs(a - b) > 0.02) {
      changes.push({ field: `rule:${id}`, before: a, after: b, deltaPct: +(((b - a) / a) * 100).toFixed(1), ar: `وزن القاعدة ${id}`, en: `Rule ${id} weight` });
    }
  }
  return changes;
}

export function buildModelVersion(
  version: string, createdAt: string, labeledCount: number, triggeredBy: string, note: string,
  metrics: ModelVersion["metrics"],
): ModelVersion {
  return { version, createdAt, labeledCount, triggeredBy, note, metrics };
}
