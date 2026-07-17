import { describe, it, expect } from "vitest";
import { scoreTransaction, computeRiskBreakdown, thresholdDecision, DEFAULT_GOVERNANCE } from "./scoring";
import type { ScoringInput } from "./types";

const base: ScoringInput = {
  originalRiskScore: 50,
  amount: 5000,
  customerAvgAmount: 5000,
  deviceKnown: true,
  deviceAgeDays: 200,
  deviceTxnCount: 40,
  beneficiaryKnown: true,
  beneficiaryTxnCount: 12,
  accountAgeMonths: 36,
  velocity1h: 1,
  failedLogins: 0,
  mfaPassed: true,
  locationFamiliar: true,
  timeFamiliar: true,
  historicalFraudCount: 0,
  historicalLegitCount: 30,
  triggeredRuleSeverities: [],
  similarLegitOutcomes: 3,
  similarFraudOutcomes: 0,
};

describe("scoring engine", () => {
  it("is deterministic — same input yields identical output", () => {
    const a = scoreTransaction(base);
    const b = scoreTransaction(base);
    expect(a).toEqual(b);
  });

  it("clamps all scores to 0..100", () => {
    const r = scoreTransaction(base);
    for (const v of Object.values(r.riskBreakdown)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
    expect(r.optimizedRiskScore).toBeGreaterThanOrEqual(0);
    expect(r.optimizedRiskScore).toBeLessThanOrEqual(100);
    expect(r.falsePositiveProbability).toBeLessThanOrEqual(100);
  });

  it("recommends APPROVE with high FP probability for a trusted false-positive case", () => {
    const fp: ScoringInput = {
      ...base,
      originalRiskScore: 84,
      amount: 7200,
      customerAvgAmount: 5100,
      deviceTxnCount: 96,
      beneficiaryTxnCount: 18,
      timeFamiliar: false,
      triggeredRuleSeverities: ["HIGH", "MEDIUM"],
      similarLegitOutcomes: 4,
    };
    const r = scoreTransaction(fp);
    expect(r.recommendation).toBe("APPROVE");
    expect(r.optimizedRiskScore).toBeLessThan(40);
    expect(r.falsePositiveProbability).toBeGreaterThan(75);
  });

  it("recommends REJECT/REVIEW for a strong fraud case", () => {
    const fraud: ScoringInput = {
      ...base,
      originalRiskScore: 70,
      amount: 18000,
      customerAvgAmount: 5000,
      deviceKnown: false,
      deviceAgeDays: 0,
      deviceTxnCount: 0,
      beneficiaryKnown: false,
      beneficiaryTxnCount: 0,
      velocity1h: 8,
      failedLogins: 3,
      mfaPassed: false,
      locationFamiliar: false,
      timeFamiliar: false,
      historicalFraudCount: 1,
      similarLegitOutcomes: 0,
      similarFraudOutcomes: 2,
      triggeredRuleSeverities: ["HIGH", "HIGH"],
    };
    const r = scoreTransaction(fraud);
    expect(["REJECT", "REVIEW"]).toContain(r.recommendation);
    expect(r.optimizedRiskScore).toBeGreaterThan(50);
    expect(r.falsePositiveProbability).toBeLessThan(40);
  });

  it("threshold decision boundaries follow governance bands", () => {
    const g = DEFAULT_GOVERNANCE;
    expect(thresholdDecision(10, g)).toBe("APPROVE");
    expect(thresholdDecision(45, g)).toBe("MONITOR");
    expect(thresholdDecision(70, g)).toBe("REVIEW");
    expect(thresholdDecision(90, g)).toBe("REJECT");
  });

  it("investigator confirmation reduces the optimized score", () => {
    const withConfirm = scoreTransaction({ ...base, originalRiskScore: 80, investigatorConfirmedLegit: true });
    const without = scoreTransaction({ ...base, originalRiskScore: 80 });
    expect(withConfirm.optimizedRiskScore).toBeLessThanOrEqual(without.optimizedRiskScore);
  });

  it("new device produces higher device risk than a trusted device", () => {
    const known = computeRiskBreakdown(base);
    const unknown = computeRiskBreakdown({ ...base, deviceKnown: false, deviceAgeDays: 0, deviceTxnCount: 0 });
    expect(unknown.device).toBeGreaterThan(known.device);
  });

  it("a new device alone does NOT force rejection when other signals are clean", () => {
    const r = scoreTransaction({ ...base, deviceKnown: false, deviceAgeDays: 1, deviceTxnCount: 0, originalRiskScore: 55 });
    expect(r.recommendation).not.toBe("REJECT");
  });

  it("a high amount alone does NOT force rejection for a trusted profile", () => {
    const r = scoreTransaction({ ...base, amount: 40000, customerAvgAmount: 8000, originalRiskScore: 70, triggeredRuleSeverities: ["HIGH"] });
    expect(r.recommendation).not.toBe("REJECT");
  });

  it("strong fraud indicators are NOT overridden by a high false-positive probability", () => {
    const fraud = scoreTransaction({
      ...base, originalRiskScore: 80, deviceKnown: false, deviceAgeDays: 0, deviceTxnCount: 0,
      beneficiaryKnown: false, mfaPassed: false, failedLogins: 4, velocity1h: 8,
      historicalFraudCount: 3, similarFraudOutcomes: 3, similarLegitOutcomes: 0,
      triggeredRuleSeverities: ["HIGH", "HIGH"],
    });
    expect(["REJECT", "REVIEW"]).toContain(fraud.recommendation);
  });

  it("governance prevents unsafe auto-approval above the override limit", () => {
    const gov = { ...DEFAULT_GOVERNANCE, maxOverrideAmount: 10000 };
    const r = scoreTransaction({ ...base, amount: 25000, originalRiskScore: 84, similarLegitOutcomes: 6 }, gov);
    expect(r.recommendation).not.toBe("APPROVE");
  });

  it("handles missing/undefined learned profile fields safely", () => {
    const minimal = { ...base };
    delete (minimal as Record<string, unknown>).deviceLegitCount;
    delete (minimal as Record<string, unknown>).segmentFraudRate;
    const r = scoreTransaction(minimal);
    expect(r.optimizedRiskScore).toBeGreaterThanOrEqual(0);
    expect(r.recommendation).toBeTruthy();
  });

  it("confidence decreases when adverse context is present", () => {
    const clean = scoreTransaction(base).confidence;
    const noisy = scoreTransaction({ ...base, failedLogins: 3 }).confidence;
    expect(noisy).toBeLessThanOrEqual(clean);
  });
});
