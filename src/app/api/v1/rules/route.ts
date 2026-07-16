import { NextResponse } from "next/server";
import { getDataset } from "@/lib/store";
import { computeRuleStats } from "@/lib/analytics";

// GET /api/v1/rules — fraud rules with performance statistics.
export async function GET() {
  const ds = getDataset();
  const stats = computeRuleStats(ds.transactions, ds.rules);
  return NextResponse.json({
    count: stats.length,
    rules: stats.map((s) => ({
      id: s.rule.id,
      name: s.rule.nameEn,
      status: s.rule.status,
      severity: s.rule.severity,
      action: s.rule.action,
      triggerCount: s.triggerCount,
      confirmedFraud: s.confirmedFraud,
      falsePositives: s.falsePositives,
      precision: s.precision,
      falsePositiveRate: s.falsePositiveRate,
      financialImpact: s.financialImpact,
      recommendation: s.recommendationKey,
    })),
  });
}
