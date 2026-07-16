import { describe, it, expect } from "vitest";
import { computeFinancials, DEFAULT_ASSUMPTIONS, DEFAULT_IMPACT } from "./financial";

describe("financial model", () => {
  it("computes revenue recovered as recovered transactions × avg revenue", () => {
    const r = computeFinancials(DEFAULT_ASSUMPTIONS, DEFAULT_IMPACT);
    expect(r.revenueRecovered).toBe(DEFAULT_IMPACT.recoveredTransactions * DEFAULT_ASSUMPTIONS.avgRevenuePerTxn);
  });

  it("net = revenue + savings + retention - exposure - platform cost", () => {
    const a = DEFAULT_ASSUMPTIONS;
    const i = DEFAULT_IMPACT;
    const r = computeFinancials(a, i);
    const expected =
      i.recoveredTransactions * a.avgRevenuePerTxn +
      i.reducedReviews * a.investigationCost +
      i.complaintsReduced * a.supportCost +
      i.customersRetained * a.churnCost -
      i.additionalMissedFraud * a.avgFraudLoss -
      a.platformMonthlyCost;
    expect(r.netMonthly).toBeCloseTo(expected, 5);
    expect(r.netAnnual).toBeCloseTo(expected * 12, 5);
  });

  it("scenarios are ordered conservative < expected < optimistic", () => {
    const r = computeFinancials(DEFAULT_ASSUMPTIONS, DEFAULT_IMPACT);
    expect(r.scenarios.conservative).toBeLessThan(r.scenarios.expected);
    expect(r.scenarios.expected).toBeLessThan(r.scenarios.optimistic);
  });

  it("produces a positive net value and finite payback under defaults", () => {
    const r = computeFinancials(DEFAULT_ASSUMPTIONS, DEFAULT_IMPACT);
    expect(r.netMonthly).toBeGreaterThan(0);
    expect(Number.isFinite(r.paybackMonths)).toBe(true);
    expect(r.paybackMonths).toBeGreaterThan(0);
  });

  it("reacts to higher revenue assumptions", () => {
    const low = computeFinancials(DEFAULT_ASSUMPTIONS, DEFAULT_IMPACT);
    const high = computeFinancials({ ...DEFAULT_ASSUMPTIONS, avgRevenuePerTxn: 280 }, DEFAULT_IMPACT);
    expect(high.netMonthly).toBeGreaterThan(low.netMonthly);
  });
});
