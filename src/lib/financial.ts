// ============================================================================
// ZeRisk — Financial impact model (CFO-friendly, fully recalculable)
// ============================================================================

import type { FinancialAssumptions, FinancialResult } from "./types";

export const DEFAULT_ASSUMPTIONS: FinancialAssumptions = {
  avgRevenuePerTxn: 140,
  investigationCost: 42,
  supportCost: 26,
  churnCost: 1200,
  avgFraudLoss: 2400,
  monthlyVolume: 1250000,
  platformMonthlyCost: 85000,
};

// Operational impact profile (monthly) derived from the optimization layer.
export interface ImpactProfile {
  recoveredTransactions: number; // legitimate transactions saved from false decline
  reducedReviews: number; // manual reviews avoided
  complaintsReduced: number; // support complaints avoided
  customersRetained: number; // churn avoided
  additionalMissedFraud: number; // extra fraud potentially let through
}

export const DEFAULT_IMPACT: ImpactProfile = {
  recoveredTransactions: 8460,
  reducedReviews: 6200,
  complaintsReduced: 4100,
  customersRetained: 355,
  additionalMissedFraud: 4,
};

export function computeFinancials(
  a: FinancialAssumptions,
  impact: ImpactProfile = DEFAULT_IMPACT,
): FinancialResult {
  const revenueRecovered = impact.recoveredTransactions * a.avgRevenuePerTxn;
  const manualReviewSavings = impact.reducedReviews * a.investigationCost;
  const supportSavings = impact.complaintsReduced * a.supportCost;
  const retentionValue = impact.customersRetained * a.churnCost;
  const fraudExposure = impact.additionalMissedFraud * a.avgFraudLoss;
  const platformCost = a.platformMonthlyCost;

  const netMonthly =
    revenueRecovered +
    manualReviewSavings +
    supportSavings +
    retentionValue -
    fraudExposure -
    platformCost;

  const netAnnual = netMonthly * 12;

  const totalCostMonthly = platformCost + fraudExposure;
  const monthlyRoi = totalCostMonthly > 0 ? (netMonthly / totalCostMonthly) * 100 : 0;
  const annualRoi = monthlyRoi;

  // One-time onboarding/integration cost approximated at 3 months of platform fee.
  const setupCost = platformCost * 3;
  const paybackMonths = netMonthly > 0 ? setupCost / netMonthly : Infinity;

  return {
    revenueRecovered,
    manualReviewSavings,
    supportSavings,
    retentionValue,
    fraudExposure,
    platformCost,
    netMonthly,
    netAnnual,
    monthlyRoi,
    annualRoi,
    paybackMonths,
    scenarios: {
      conservative: Math.round(netAnnual * 0.62),
      expected: Math.round(netAnnual),
      optimistic: Math.round(netAnnual * 1.34),
    },
  };
}
