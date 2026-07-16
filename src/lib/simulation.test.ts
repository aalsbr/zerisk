import { describe, it, expect } from "vitest";
import { generateDataset } from "./demo-data";
import { defaultConfig, runSimulation } from "./simulation";

const ds = generateDataset();

describe("what-if simulation", () => {
  it("produces coherent before/after numbers for every rule", () => {
    for (const rule of ds.rules) {
      const cfg = defaultConfig(rule);
      const r = runSimulation(cfg, ds.transactions);
      expect(r.fpAfter).toBeLessThanOrEqual(r.fpBefore);
      expect(r.fraudAfter).toBeLessThanOrEqual(r.fraudBefore);
      expect(r.missedFraud).toBeGreaterThanOrEqual(0);
      expect(r.transactionsAffected).toBeGreaterThanOrEqual(0);
      expect(["RECOMMENDED", "RECOMMENDED_WITH_SAFEGUARDS", "NOT_RECOMMENDED"]).toContain(r.verdict);
    }
  });

  it("is deterministic for the same config and dataset", () => {
    const rule = ds.rules.find((r) => r.id === "FR-017")!;
    const cfg = defaultConfig(rule);
    expect(runSimulation(cfg, ds.transactions)).toEqual(runSimulation(cfg, ds.transactions));
  });

  it("raising the amount threshold recovers false positives for FR-017", () => {
    const rule = ds.rules.find((r) => r.id === "FR-017")!;
    const cfg = { ...defaultConfig(rule), proposedThreshold: (rule.amountThreshold ?? 5000) * 3 };
    const r = runSimulation(cfg, ds.transactions);
    expect(r.fpAfter).toBeLessThan(r.fpBefore);
    expect(r.revenueRecovered).toBeGreaterThan(0);
  });

  it("net benefit is a finite number", () => {
    const rule = ds.rules[0];
    const r = runSimulation(defaultConfig(rule), ds.transactions);
    expect(Number.isFinite(r.netBenefit)).toBe(true);
  });
});
