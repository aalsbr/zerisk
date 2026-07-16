// ============================================================================
// ZeRisk — Deterministic fraud decision-optimization engine
//
// Pure, explainable, unit-testable. The SAME input always produces the SAME
// output (no randomness anywhere). This is the intelligence layer that sits
// ABOVE the existing fraud engine and re-evaluates its decisions.
// ============================================================================

import type {
  Decision,
  ReasonCode,
  ReasonDetail,
  RiskBreakdown,
  RuleSeverity,
  ScoringInput,
  ScoringResult,
} from "./types";

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const round = (n: number) => Math.round(n);

const SEVERITY_WEIGHT: Record<RuleSeverity, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 5,
};

// Governance guardrails (defaults mirror Settings page defaults)
export interface Governance {
  maxOverrideAmount: number; // above this, AI cannot auto-approve a legacy reject
  minConfidence: number; // below this, an APPROVE override is softened to REVIEW
  approveMax: number; // optimized score upper bound for APPROVE
  monitorMax: number;
  reviewMax: number;
}

export const DEFAULT_GOVERNANCE: Governance = {
  maxOverrideAmount: 50000,
  minConfidence: 70,
  approveMax: 34,
  monitorMax: 59,
  reviewMax: 79,
};

// ---- Sub-score computation ---------------------------------------------------

export function computeRiskBreakdown(i: ScoringInput): RiskBreakdown {
  // Device risk
  let device: number;
  if (i.deviceKnown) {
    device = 20 - Math.min(i.deviceTxnCount, 100) * 0.14;
    if (i.deviceAgeDays < 3) device += 8;
  } else {
    device = 58 + (i.deviceAgeDays < 1 ? 12 : 0);
  }

  // Behavioral risk (amount vs personal baseline + auth signals + time)
  const ratio = i.amount / Math.max(i.customerAvgAmount, 1);
  let behavioral = 0;
  if (ratio <= 1.1) behavioral += 5;
  else if (ratio <= 1.5) behavioral += 16;
  else if (ratio <= 2.5) behavioral += 30;
  else behavioral += 46;
  if (!i.mfaPassed) behavioral += 22;
  behavioral += Math.min(i.failedLogins, 5) * 6;
  if (!i.timeFamiliar) behavioral += 10;

  // Beneficiary risk
  let beneficiary: number;
  if (i.beneficiaryKnown) {
    beneficiary = 16 - Math.min(i.beneficiaryTxnCount, 40) * 0.3;
  } else {
    beneficiary = 50;
  }

  // Velocity risk
  const velocity = Math.min(i.velocity1h, 10) * 6;

  // Location risk
  const location = i.locationFamiliar ? 8 : 46;

  // Historical fraud risk
  let historical = i.historicalFraudCount * 22;
  historical -= Math.min(i.historicalLegitCount, 50) * 0.2;
  historical += i.similarFraudOutcomes * 8 - i.similarLegitOutcomes * 2;
  if (i.accountAgeMonths > 24) historical -= 6;
  else if (i.accountAgeMonths < 3) historical += 8;

  return {
    device: round(clamp(device)),
    behavioral: round(clamp(behavioral)),
    beneficiary: round(clamp(beneficiary)),
    velocity: round(clamp(velocity)),
    location: round(clamp(location)),
    historical: round(clamp(historical)),
  };
}

const WEIGHTS = {
  device: 0.16,
  behavioral: 0.22,
  beneficiary: 0.16,
  velocity: 0.18,
  location: 0.12,
  historical: 0.16,
};

function severitySum(sev: RuleSeverity[]) {
  return sev.reduce((a, s) => a + SEVERITY_WEIGHT[s], 0);
}

// ---- Reason detail catalogue -------------------------------------------------

function detail(
  code: ReasonCode,
  ar: string,
  en: string,
  weight: number,
): ReasonDetail {
  return { code, ar, en, weight };
}

// ---- Main engine -------------------------------------------------------------

export function scoreTransaction(
  input: ScoringInput,
  gov: Governance = DEFAULT_GOVERNANCE,
): ScoringResult {
  const breakdown = computeRiskBreakdown(input);

  let optimized =
    breakdown.device * WEIGHTS.device +
    breakdown.behavioral * WEIGHTS.behavioral +
    breakdown.beneficiary * WEIGHTS.beneficiary +
    breakdown.velocity * WEIGHTS.velocity +
    breakdown.location * WEIGHTS.location +
    breakdown.historical * WEIGHTS.historical;

  // Triggered-rule severity nudges the score up (a structural signal that the
  // legacy engine saw something worth flagging, even if mitigated).
  const sev = severitySum(input.triggeredRuleSeverities);
  optimized += Math.min(sev, 16) * 0.7 + input.triggeredRuleSeverities.length * 2;

  // Investigator ground-truth override: a human confirmed this is legitimate
  if (input.investigatorConfirmedLegit) {
    optimized = Math.min(optimized * 0.5, 28);
  }

  const optimizedRiskScore = round(clamp(optimized));

  // ---- Signal aggregation for FP probability & recommendation ----
  const mitigation =
    (input.deviceKnown ? 10 : 0) +
    (input.beneficiaryKnown ? 8 : 0) +
    (input.mfaPassed ? 10 : 0) +
    (input.locationFamiliar ? 6 : 0) +
    (input.historicalLegitCount > 20 ? 6 : 0) +
    input.similarLegitOutcomes * 3;

  const legitSignal = mitigation + Math.max(0, 45 - optimizedRiskScore);

  const fraudSignal =
    Math.max(0, optimizedRiskScore - 45) +
    (input.mfaPassed ? 0 : 15) +
    input.failedLogins * 4 +
    (input.deviceKnown ? 0 : 10) +
    input.historicalFraudCount * 10 +
    input.similarFraudOutcomes * 6 +
    Math.max(0, input.velocity1h - 3) * 3;

  // False-positive probability: how likely a legacy reject/review is a false
  // decline. Only meaningful signal when legacy leaned negative — but we always
  // compute it so the UI can show the gap.
  const legacyNegative = input.originalRiskScore >= 45;
  const stabilizer = 6;
  let fp = (100 * legitSignal) / (legitSignal + fraudSignal + stabilizer);
  if (!legacyNegative) fp *= 0.35; // legacy already approved → low FP relevance
  const falsePositiveProbability = round(clamp(fp));

  // ---- Confidence ----
  const boundaries = [gov.approveMax, gov.monitorMax, gov.reviewMax];
  const decisiveness = Math.min(
    20,
    Math.min(...boundaries.map((b) => Math.abs(optimizedRiskScore - b))),
  );
  const confidence = round(
    clamp(
      72 +
        decisiveness * 0.6 +
        Math.min(input.historicalLegitCount, 50) * 0.18 +
        (input.deviceKnown ? 5 : 0) +
        (input.mfaPassed ? 4 : 0) -
        (input.failedLogins > 0 ? 6 : 0),
      55,
      98,
    ),
  );

  // ---- Recommendation ----
  let recommendation = thresholdDecision(optimizedRiskScore, gov);

  const strongFraud =
    input.historicalFraudCount > 0 ||
    (!input.mfaPassed && !input.deviceKnown) ||
    optimizedRiskScore >= 80 ||
    fraudSignal >= 45;

  if (strongFraud) {
    recommendation = optimizedRiskScore >= 60 ? "REJECT" : "REVIEW";
  } else if (falsePositiveProbability >= 80 && optimizedRiskScore < 60) {
    // Strong false-positive signal → recover the legitimate transaction
    recommendation = optimizedRiskScore <= gov.monitorMax ? "APPROVE" : "REVIEW";
  }

  // Governance guardrails (never silently auto-approve high-value overrides)
  const overridesLegacyReject =
    (input.originalRiskScore >= 60 || input.amount > 0) &&
    recommendation === "APPROVE";
  if (recommendation === "APPROVE" && input.amount > gov.maxOverrideAmount) {
    recommendation = "REVIEW";
  }
  if (
    recommendation === "APPROVE" &&
    confidence < gov.minConfidence &&
    overridesLegacyReject
  ) {
    recommendation = "REVIEW";
  }

  // ---- Reason codes & explanations ----
  const { codes, supporting, increasing } = buildReasons(input);

  return {
    optimizedRiskScore,
    falsePositiveProbability,
    recommendation,
    confidence,
    reasonCodes: codes,
    riskBreakdown: breakdown,
    supporting,
    increasing,
    processingTimeMs: pseudoLatency(input),
  };
}

export function thresholdDecision(score: number, gov: Governance): Decision {
  if (score <= gov.approveMax) return "APPROVE";
  if (score <= gov.monitorMax) return "MONITOR";
  if (score <= gov.reviewMax) return "REVIEW";
  return "REJECT";
}

// Deterministic "processing time" derived from inputs (55–99 ms), no randomness.
function pseudoLatency(i: ScoringInput): number {
  const h =
    (Math.round(i.amount) * 31 +
      i.originalRiskScore * 17 +
      i.deviceTxnCount * 7 +
      i.beneficiaryTxnCount * 13 +
      i.failedLogins * 5) %
    45;
  return 55 + Math.abs(h);
}

function buildReasons(i: ScoringInput): {
  codes: ReasonCode[];
  supporting: ReasonDetail[];
  increasing: ReasonDetail[];
} {
  const supporting: ReasonDetail[] = [];
  const increasing: ReasonDetail[] = [];

  if (i.deviceKnown && i.deviceTxnCount >= 5) {
    supporting.push(
      detail(
        "TRUSTED_DEVICE",
        `الجهاز مستخدم بنجاح في ${i.deviceTxnCount} عملية سابقة`,
        `Device used successfully in ${i.deviceTxnCount} previous transactions`,
        12,
      ),
    );
  }
  if (i.beneficiaryKnown && i.beneficiaryTxnCount >= 3) {
    supporting.push(
      detail(
        "KNOWN_BENEFICIARY",
        `المستفيد تم التحويل إليه ${i.beneficiaryTxnCount} مرة سابقًا`,
        `Beneficiary has been used ${i.beneficiaryTxnCount} times before`,
        10,
      ),
    );
  }
  if (i.mfaPassed) {
    supporting.push(
      detail(
        "SUCCESSFUL_MFA",
        "تم التحقق الثنائي بنجاح (نفاذ/OTP)",
        "Multi-factor authentication passed successfully",
        9,
      ),
    );
  }
  if (i.amount <= i.customerAvgAmount * 1.1) {
    supporting.push(
      detail(
        "NORMAL_AMOUNT",
        "المبلغ ضمن النطاق الاعتيادي للعميل",
        "Amount is within the customer's normal range",
        7,
      ),
    );
  }
  if (i.locationFamiliar) {
    supporting.push(
      detail(
        "FAMILIAR_LOCATION",
        "الموقع الجغرافي مطابق لسلوك العميل التاريخي",
        "Customer location matches historical behavior",
        6,
      ),
    );
  }
  if (i.accountAgeMonths >= 24) {
    supporting.push(
      detail(
        "LONG_TENURE",
        `عميل قديم منذ ${i.accountAgeMonths} شهرًا`,
        `Long-standing customer (${i.accountAgeMonths} months tenure)`,
        6,
      ),
    );
  }
  if (i.failedLogins === 0) {
    supporting.push(
      detail(
        "CLEAN_HISTORY",
        "لا توجد محاولات دخول فاشلة حديثة",
        "No recent failed authentication attempts",
        5,
      ),
    );
  }
  if (i.similarLegitOutcomes > 0) {
    supporting.push(
      detail(
        "SIMILAR_LEGIT",
        `${i.similarLegitOutcomes} عملية مشابهة تم تأكيد سلامتها`,
        `${i.similarLegitOutcomes} similar transactions were confirmed legitimate`,
        6,
      ),
    );
  }

  const ratio = i.amount / Math.max(i.customerAvgAmount, 1);
  if (ratio > 1.3) {
    const pct = Math.round((ratio - 1) * 100);
    increasing.push(
      detail(
        "UNUSUAL_AMOUNT",
        `المبلغ أعلى بنسبة ${pct}% من متوسط العميل`,
        `Amount is ${pct}% higher than customer average`,
        Math.min(20, pct / 4),
      ),
    );
  }
  if (!i.timeFamiliar) {
    increasing.push(
      detail(
        "UNUSUAL_TIME",
        "العملية تمت خارج الأوقات الاعتيادية للعميل",
        "Transaction occurred outside normal hours",
        8,
      ),
    );
  }
  if (!i.deviceKnown) {
    increasing.push(
      detail(
        "NEW_DEVICE",
        "الجهاز غير معروف / مستخدم لأول مرة",
        "New / unrecognized device",
        14,
      ),
    );
  }
  if (!i.beneficiaryKnown) {
    increasing.push(
      detail(
        "NEW_BENEFICIARY",
        "المستفيد جديد ولم يسبق التحويل إليه",
        "New beneficiary — never used before",
        12,
      ),
    );
  }
  if (!i.mfaPassed) {
    increasing.push(
      detail(
        "MFA_FAILED",
        "فشل التحقق الثنائي",
        "Multi-factor authentication failed",
        16,
      ),
    );
  }
  if (i.failedLogins > 0) {
    increasing.push(
      detail(
        "FAILED_LOGINS",
        `${i.failedLogins} محاولات دخول فاشلة حديثة`,
        `${i.failedLogins} recent failed login attempts`,
        i.failedLogins * 4,
      ),
    );
  }
  if (i.velocity1h > 3) {
    increasing.push(
      detail(
        "HIGH_VELOCITY",
        `سرعة عمليات مرتفعة: ${i.velocity1h} عمليات في الساعة`,
        `High transaction velocity: ${i.velocity1h} in the last hour`,
        (i.velocity1h - 3) * 3,
      ),
    );
  }
  if (!i.locationFamiliar) {
    increasing.push(
      detail(
        "UNFAMILIAR_LOCATION",
        "الموقع الجغرافي غير معتاد للعميل",
        "Unfamiliar geographic location",
        10,
      ),
    );
  }
  if (i.historicalFraudCount > 0) {
    increasing.push(
      detail(
        "HISTORICAL_FRAUD",
        `${i.historicalFraudCount} حالات احتيال مؤكدة في السجل`,
        `${i.historicalFraudCount} confirmed fraud cases in history`,
        i.historicalFraudCount * 12,
      ),
    );
  }
  if (i.triggeredRuleSeverities.some((s) => s === "HIGH" || s === "CRITICAL")) {
    increasing.push(
      detail(
        "HIGH_SEVERITY_RULE",
        "تم تفعيل قاعدة عالية الخطورة",
        "A high-severity rule was triggered",
        6,
      ),
    );
  }

  supporting.sort((a, c) => c.weight - a.weight);
  increasing.sort((a, c) => c.weight - a.weight);

  const codes = [
    ...supporting.map((r) => r.code),
    ...increasing.map((r) => r.code),
  ].slice(0, 8);

  return { codes, supporting, increasing };
}
