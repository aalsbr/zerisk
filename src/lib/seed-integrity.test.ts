import { describe, it, expect } from "vitest";
import { generateDataset } from "./dataset";
import { DEMO_ID_LIST, DEMO_IDS } from "./demo-data";
import { computeKpis, confusionForDecision } from "./analytics";
import { DEFAULT_ASSUMPTIONS } from "./financial";

const ds = generateDataset();
const byId = new Map(ds.transactions.map((t) => [t.id, t]));
const custIds = new Set(ds.customers.map((c) => c.id));
const devIds = new Set(ds.devices.map((d) => d.id));
const benIds = new Set(ds.beneficiaries.map((b) => b.id));
const ruleIds = new Set(ds.rules.map((r) => r.id));

describe("seed data integrity", () => {
  it("meets the minimum dataset sizes", () => {
    expect(ds.transactions.length).toBeGreaterThanOrEqual(1500);
    expect(ds.customers.length).toBeGreaterThanOrEqual(150);
    expect(ds.devices.length).toBeGreaterThanOrEqual(220);
    expect(ds.beneficiaries.length).toBeGreaterThanOrEqual(300);
    expect(ds.rules.length).toBeGreaterThanOrEqual(15);
    expect(ds.metrics.length).toBe(12);
  });

  it("contains all fixed demo transactions", () => {
    for (const id of DEMO_ID_LIST) expect(byId.has(id)).toBe(true);
  });

  it("every transaction references a valid customer, device, beneficiary and rules", () => {
    for (const t of ds.transactions) {
      expect(custIds.has(t.customerId)).toBe(true);
      expect(devIds.has(t.deviceId)).toBe(true);
      expect(benIds.has(t.beneficiaryId)).toBe(true);
      for (const r of t.triggeredRuleIds) expect(ruleIds.has(r)).toBe(true);
    }
  });

  it("contains true positives, true negatives, false positives and false negatives", () => {
    const c = confusionForDecision(ds.transactions, "original");
    expect(c.tp).toBeGreaterThan(0); // true positive
    expect(c.tn).toBeGreaterThan(0); // true negative
    expect(c.fp).toBeGreaterThan(0); // false positive
    expect(c.fn).toBeGreaterThan(0); // false negative
  });

  it("no CONFIRMED_FRAUD transaction is counted as a false positive; legit rejects ARE counted", () => {
    const legitRejectedNotFP = ds.transactions.filter(
      (t) => (t.originalDecision === "REJECT" || t.originalDecision === "REVIEW") && t.outcome === "LEGITIMATE" && t.ai.recommendation !== "REJECT" && t.ai.recommendation !== "REVIEW" && !t.isFalsePositive,
    );
    expect(legitRejectedNotFP).toHaveLength(0);
    for (const t of ds.transactions) if (t.outcome === "CONFIRMED_FRAUD") expect(t.isFalsePositive).toBe(false);
  });

  it("dashboard totals equal values computed from the dataset", () => {
    const k = computeKpis(ds.transactions, DEFAULT_ASSUMPTIONS);
    expect(k.totalTransactions).toBe(ds.transactions.length);
    const aiRej = ds.transactions.filter((t) => t.ai.recommendation === "REJECT").length;
    expect(k.rejected).toBe(aiRej);
  });

  it("produces a measurable before→after improvement (business value)", () => {
    const k = computeKpis(ds.transactions, DEFAULT_ASSUMPTIONS);
    expect(k.fpRateAfter).toBeLessThan(k.fpRateBefore);
    expect(k.recoveredTransactions).toBeGreaterThan(0);
    expect(k.optimizedRecall).toBeGreaterThanOrEqual(k.originalRecall);
  });

  it("recognizes the strong false-positive demo transaction", () => {
    const fp = byId.get(DEMO_IDS.falsePositive)!;
    expect(fp.originalDecision).toBe("REJECT");
    expect(fp.isFalsePositive).toBe(true);
    expect(["APPROVE", "MONITOR"]).toContain(fp.ai.recommendation);
  });

  it("detects the false-negative demo transaction the legacy engine missed", () => {
    const fn = byId.get(DEMO_IDS.falseNegative)!;
    expect(fn.originalDecision).toBe("APPROVE");
    expect(["REJECT", "REVIEW"]).toContain(fn.ai.recommendation);
  });

  it("keeps the ambiguous demo transaction in REVIEW", () => {
    expect(byId.get(DEMO_IDS.review)!.ai.recommendation).toBe("REVIEW");
  });

  it("confirmed-fraud demo is caught and low-risk demo is approved", () => {
    expect(["REJECT", "REVIEW"]).toContain(byId.get(DEMO_IDS.confirmedFraud)!.ai.recommendation);
    expect(byId.get(DEMO_IDS.lowRisk)!.ai.recommendation).toBe("APPROVE");
  });
});
