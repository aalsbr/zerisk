// ============================================================================
// ZeRisk — dataset enrichment. Applies the deterministic scoring engine to the
// raw base data using the current calibration + adaptive profiles. Recomputed
// whenever labels/calibration change, so the learning loop is visible live.
// ============================================================================

import { generateBase, type BaseDataset } from "./demo-data";
import { computeProfiles, type LabelResolver, type Profiles } from "./profiles";
import { baselineCalibration, computeCalibration, nextVersion } from "./learning";
import { DEFAULT_GOVERNANCE, scoreTransaction, type Governance } from "./scoring";
import type {
  Beneficiary,
  Calibration,
  Customer,
  Device,
  EnrichedTransaction,
  FraudRule,
  Insight,
  Integration,
  InvestigationOutcome,
  MonthlyMetric,
  ScoringInput,
  Transaction,
} from "./types";

export interface Dataset {
  customers: Customer[];
  devices: Device[];
  beneficiaries: Beneficiary[];
  rules: FraudRule[];
  transactions: EnrichedTransaction[];
  insights: Insight[];
  metrics: MonthlyMetric[];
  integrations: Integration[];
}

export function toScoringInput(
  t: Transaction,
  customer: Customer,
  device: Device,
  beneficiary: Beneficiary,
  rules: FraudRule[],
  profiles: Profiles,
  calibration: Calibration,
  label?: InvestigationOutcome,
): ScoringInput {
  const triggered = rules.filter((r) => t.triggeredRuleIds.includes(r.id));
  const dp = profiles.devices.get(device.id);
  const bp = profiles.beneficiaries.get(beneficiary.id);
  const cp = profiles.customers.get(customer.id);
  const seg = profiles.segments.get(customer.segment);
  const chan = profiles.channels.get(t.channel);

  const ruleFactors = triggered.map((r) => calibration.ruleWeightAdjust[r.id] ?? 1);
  const ruleWeightFactor = ruleFactors.length
    ? ruleFactors.reduce((a, b) => a + b, 0) / ruleFactors.length
    : 1;

  return {
    originalRiskScore: t.originalRiskScore,
    amount: t.amount,
    customerAvgAmount: customer.avgTxnAmount,
    deviceKnown: device.known,
    deviceAgeDays: device.firstSeenDaysAgo,
    deviceTxnCount: device.txnCount,
    beneficiaryKnown: beneficiary.known,
    beneficiaryTxnCount: beneficiary.txnCount,
    accountAgeMonths: customer.accountAgeMonths,
    velocity1h: t.velocity1h,
    failedLogins: t.failedLogins,
    mfaPassed: t.mfaPassed,
    passwordResetRecently: t.passwordResetRecently,
    locationFamiliar: t.locationFamiliar,
    timeFamiliar: t.timeFamiliar,
    historicalFraudCount: cp?.confirmedFraudCount ?? 0,
    historicalLegitCount: cp?.legitimateCount ?? 0,
    triggeredRuleSeverities: triggered.map((r) => r.severity),
    similarLegitOutcomes: Math.min((dp?.legitimateCount ?? 0) + (bp?.legitimateCount ?? 0), 8),
    similarFraudOutcomes: (dp?.fraudCount ?? 0) + (bp?.fraudCount ?? 0),
    investigatorConfirmedLegit: label === "LEGITIMATE",
    deviceLegitCount: dp?.legitimateCount ?? 0,
    deviceFraudCount: dp?.fraudCount ?? 0,
    deviceCustomerCount: dp?.customerCount ?? 1,
    beneficiaryLegitCount: bp?.legitimateCount ?? 0,
    beneficiaryFraudCount: bp?.fraudCount ?? 0,
    segmentFraudRate: seg?.fraudRate ?? 0,
    channelFraudRate: chan?.fraudRate ?? 0,
    ruleWeightFactor,
  };
}

export interface EnrichResult {
  transactions: EnrichedTransaction[];
  profiles: Profiles;
}

export function buildEnriched(
  base: BaseDataset,
  calibration: Calibration,
  gov: Governance,
  labelOverlay: Map<string, InvestigationOutcome>,
  feedbackMap?: Map<string, EnrichedTransaction["feedback"]>,
): EnrichResult {
  const rawById = new Map(base.rawTransactions.map((t) => [t.id, t]));
  const label: LabelResolver = (id) => labelOverlay.get(id) ?? rawById.get(id)?.outcome;

  const profiles = computeProfiles(
    base.rawTransactions, base.customers, base.devices, base.beneficiaries, base.rules, label,
  );

  const cMap = new Map(base.customers.map((c) => [c.id, c]));
  const dMap = new Map(base.devices.map((d) => [d.id, d]));
  const bMap = new Map(base.beneficiaries.map((b) => [b.id, b]));

  const transactions = base.rawTransactions.map((t): EnrichedTransaction => {
    const customer = cMap.get(t.customerId)!;
    const device = dMap.get(t.deviceId)!;
    const beneficiary = bMap.get(t.beneficiaryId)!;
    const lbl = label(t.id);
    const input = toScoringInput(t, customer, device, beneficiary, base.rules, profiles, calibration, lbl);
    const ai = scoreTransaction(input, gov, calibration);
    const legacyNegative = t.originalDecision === "REJECT" || t.originalDecision === "REVIEW";
    const aiPositive = ai.recommendation === "APPROVE" || ai.recommendation === "MONITOR";
    const isFalsePositive = legacyNegative && aiPositive && !t.isActuallyFraud;
    const fb = feedbackMap?.get(t.id);
    return {
      ...t,
      outcome: lbl,
      processingTimeMs: ai.processingTimeMs,
      customer, device, beneficiary, ai,
      rules: base.rules.filter((r) => t.triggeredRuleIds.includes(r.id)),
      isFalsePositive,
      feedback: fb ?? undefined,
    };
  });

  return { transactions, profiles };
}

// Backward-compatible full dataset (seed labels, base calibration).
export const SEED = 20260717;

export function generateDataset(seed = SEED): Dataset {
  const base = generateBase(seed);
  const label: LabelResolver = (id) => base.rawTransactions.find((t) => t.id === id)?.outcome;
  const profiles = computeProfiles(base.customers.length ? base.rawTransactions : [], base.customers, base.devices, base.beneficiaries, base.rules, label);
  const calibration = computeCalibration(profiles, nextVersion(baselineCalibration().version), new Date(Date.UTC(2026, 6, 1)).toISOString());
  const { transactions } = buildEnriched(base, calibration, DEFAULT_GOVERNANCE, new Map());
  return {
    customers: base.customers,
    devices: base.devices,
    beneficiaries: base.beneficiaries,
    rules: base.rules,
    transactions,
    insights: base.insights,
    metrics: base.metrics,
    integrations: base.integrations,
  };
}
