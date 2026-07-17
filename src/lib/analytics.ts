// ============================================================================
// ZeRisk — Analytics: pure aggregation functions over the dataset.
// Every dashboard/chart derives from these (no numbers hardcoded in the UI).
// ============================================================================

import type {
  Decision,
  EnrichedTransaction,
  FinancialAssumptions,
  FraudRule,
  Insight,
  KpiSnapshot,
  RuleRecommendationKey,
  RuleStat,
} from "./types";
import type { Profiles } from "./profiles";
import { SEGMENT_LABEL, CHANNEL_LABEL } from "./i18n";

// The seed now contains real, labeled transactions (~1500), so rule/FP counts
// are used directly — no synthetic projection factor.
export const PORTFOLIO_SCALE = 1;

const clampPct = (n: number) => Math.max(0, Math.round(n * 100) / 100);

// ---- Dynamic KPI snapshot (computed entirely from the dataset) ---------------

export function computeKpis(
  txns: EnrichedTransaction[],
  assumptions: FinancialAssumptions,
): KpiSnapshot {
  const total = txns.length || 1;
  const ai = countByDecision(txns, "aiDecision");
  const legit = txns.filter((t) => !t.isActuallyFraud);
  const legitN = Math.max(1, legit.length);

  const legacyNeg = (t: EnrichedTransaction) => t.originalDecision === "REJECT" || t.originalDecision === "REVIEW";
  const aiNeg = (t: EnrichedTransaction) => t.ai.recommendation === "REJECT" || t.ai.recommendation === "REVIEW";

  const originalFP = legit.filter(legacyNeg).length;
  const optimizedFP = legit.filter(aiNeg).length;
  const recovered = txns.filter((t) => t.isFalsePositive).length;

  const legacyReviews = txns.filter(legacyNeg).length;
  const aiReviews = txns.filter(aiNeg).length;
  const reducedReviews = Math.max(0, legacyReviews - aiReviews);

  const fraud = txns.filter((t) => t.isActuallyFraud);
  const fraudCaughtByAi = fraud.filter(aiNeg);
  const falseNegativesCaught = fraud.filter((t) => !legacyNeg(t) && aiNeg(t)).length;

  const revenueRecovered = Math.round(
    recovered * assumptions.avgRevenuePerTxn +
      txns.filter((t) => t.isFalsePositive).reduce((a, t) => a + t.amount, 0) * 0.015,
  );
  const fraudPrevented = Math.round(
    fraudCaughtByAi.length * assumptions.avgFraudLoss +
      fraudCaughtByAi.reduce((a, t) => a + t.amount, 0) * 0.05,
  );
  const operationalCostSaved = Math.round(reducedReviews * assumptions.investigationCost);

  const orig = confusionForDecision(txns, "original");
  const opt = confusionMetrics(txns);

  const fpRateBefore = clampPct((originalFP / legitN) * 100);
  const fpRateAfter = clampPct((optimizedFP / legitN) * 100);
  const frictionReductionPct = originalFP > 0 ? clampPct(((originalFP - optimizedFP) / originalFP) * 100) : 0;

  return {
    totalTransactions: txns.length,
    approved: ai.APPROVE,
    rejected: ai.REJECT,
    underReview: ai.REVIEW,
    monitored: ai.MONITOR,
    falsePositivesDetected: recovered,
    fpRateBefore,
    fpRateAfter,
    recoveredTransactions: recovered,
    revenueRecovered,
    fraudPrevented,
    operationalCostSaved,
    frictionReductionPct,
    aiAgreementRate: opt.accuracy,
    avgDecisionTimeMs: Math.round(txns.reduce((a, t) => a + t.ai.processingTimeMs, 0) / total),
    avgConfidence: Math.round(txns.reduce((a, t) => a + t.ai.confidence, 0) / total),
    manualReviewReductionPct: legacyReviews > 0 ? clampPct((reducedReviews / legacyReviews) * 100) : 0,
    originalRecall: orig.recall,
    optimizedRecall: opt.recall,
    originalFpRate: fpRateBefore,
    optimizedFpRate: fpRateAfter,
    falseNegativesCaught,
  };
}

export function countByDecision(
  txns: EnrichedTransaction[],
  key: "originalDecision" | "aiDecision",
): Record<Decision, number> {
  const acc: Record<Decision, number> = { APPROVE: 0, REVIEW: 0, REJECT: 0, MONITOR: 0 };
  for (const t of txns) {
    const d = key === "originalDecision" ? t.originalDecision : t.ai.recommendation;
    acc[d]++;
  }
  return acc;
}

export function riskLevelDistribution(txns: EnrichedTransaction[]) {
  const buckets = { low: 0, medium: 0, high: 0, critical: 0 };
  for (const t of txns) {
    const s = t.ai.optimizedRiskScore;
    if (s <= 34) buckets.low++;
    else if (s <= 59) buckets.medium++;
    else if (s <= 79) buckets.high++;
    else buckets.critical++;
  }
  return buckets;
}

export function sampleFalsePositives(txns: EnrichedTransaction[]) {
  return txns.filter((t) => t.isFalsePositive);
}

// ---- Rule statistics ---------------------------------------------------------

function ruleRecommendation(
  fpRate: number,
  precision: number,
  action: Decision,
): RuleRecommendationKey {
  if (fpRate >= 70 && precision < 5) return "DISABLE";
  if (fpRate >= 55 && action === "REJECT") return "REJECT_TO_REVIEW";
  if (fpRate >= 45) return "INCREASE_THRESHOLD";
  if (fpRate >= 30) return "ADD_TRUSTED_DEVICE";
  if (fpRate >= 20) return "ADD_HISTORY_EXCEPTION";
  if (fpRate >= 12) return "REDUCE_WEIGHT";
  if (precision >= 40) return "KEEP";
  return "MONITOR";
}

export function computeRuleStats(
  txns: EnrichedTransaction[],
  rules: FraudRule[],
  scale = PORTFOLIO_SCALE,
  avgRevenuePerTxn = 140,
): RuleStat[] {
  return rules
    .map((rule) => {
      const triggeredTxns = txns.filter((t) => t.triggeredRuleIds.includes(rule.id));
      const rawTriggers = triggeredTxns.length;
      const rawFraud = triggeredTxns.filter((t) => t.isActuallyFraud).length;
      const rawFp = triggeredTxns.filter((t) => t.isFalsePositive).length;

      const triggerCount = rawTriggers * scale;
      const confirmedFraud = rawFraud * scale;
      const falsePositives = rawFp * scale;

      const precision = rawTriggers > 0 ? (rawFraud / rawTriggers) * 100 : 0;
      const falsePositiveRate = rawTriggers > 0 ? (rawFp / rawTriggers) * 100 : 0;
      const financialImpact =
        falsePositives * avgRevenuePerTxn +
        triggeredTxns
          .filter((t) => t.isFalsePositive)
          .reduce((a, t) => a + t.amount, 0) *
          scale *
          0.02;

      return {
        rule,
        triggerCount,
        confirmedFraud,
        falsePositives,
        precision: +precision.toFixed(1),
        falsePositiveRate: +falsePositiveRate.toFixed(1),
        financialImpact: Math.round(financialImpact),
        recommendationKey: ruleRecommendation(falsePositiveRate, precision, rule.action),
      };
    })
    .sort((a, b) => b.falsePositives - a.falsePositives);
}

// ---- False-positive breakdowns ----------------------------------------------

function groupCount<T extends string>(
  txns: EnrichedTransaction[],
  key: (t: EnrichedTransaction) => T,
  scale = PORTFOLIO_SCALE,
): { label: T; value: number }[] {
  const map = new Map<T, number>();
  for (const t of txns) {
    const k = key(t);
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([label, value]) => ({ label, value: value * scale }))
    .sort((a, b) => b.value - a.value);
}

export function fpBreakdowns(txns: EnrichedTransaction[]) {
  const fp = sampleFalsePositives(txns);
  return {
    byChannel: groupCount(fp, (t) => t.channel),
    bySegment: groupCount(fp, (t) => t.customer.segment),
    byDevice: groupCount(fp, (t) => (t.device.known ? "KNOWN" : "NEW") as "KNOWN" | "NEW"),
    byBeneficiary: groupCount(fp, (t) => t.beneficiary.type),
    byHour: bucketByHour(fp),
    byAmount: bucketByAmount(fp),
  };
}

function bucketByHour(txns: EnrichedTransaction[]) {
  const bands = [
    { label: "00-06", lo: 0, hi: 6 },
    { label: "06-12", lo: 6, hi: 12 },
    { label: "12-18", lo: 12, hi: 18 },
    { label: "18-24", lo: 18, hi: 24 },
  ];
  return bands.map((b) => ({
    label: b.label,
    value: txns.filter((t) => t.hour >= b.lo && t.hour < b.hi).length * PORTFOLIO_SCALE,
  }));
}

function bucketByAmount(txns: EnrichedTransaction[]) {
  const bands = [
    { label: "< 1K", lo: 0, hi: 1000 },
    { label: "1K-5K", lo: 1000, hi: 5000 },
    { label: "5K-15K", lo: 5000, hi: 15000 },
    { label: "15K-50K", lo: 15000, hi: 50000 },
    { label: "50K+", lo: 50000, hi: Infinity },
  ];
  return bands.map((b) => ({
    label: b.label,
    value: txns.filter((t) => t.amount >= b.lo && t.amount < b.hi).length * PORTFOLIO_SCALE,
  }));
}

// ---- Model monitoring metrics (confusion-matrix over the sample) -------------

export function confusionForDecision(txns: EnrichedTransaction[], which: "original" | "ai") {
  // "flag as fraud" = REJECT/REVIEW, vs ground truth.
  let tp = 0, fp = 0, tn = 0, fn = 0;
  for (const t of txns) {
    const d = which === "original" ? t.originalDecision : t.ai.recommendation;
    const flagged = d === "REJECT" || d === "REVIEW";
    if (flagged && t.isActuallyFraud) tp++;
    else if (flagged && !t.isActuallyFraud) fp++;
    else if (!flagged && !t.isActuallyFraud) tn++;
    else fn++;
  }
  const precision = tp + fp > 0 ? (tp / (tp + fp)) * 100 : 0;
  const recall = tp + fn > 0 ? (tp / (tp + fn)) * 100 : 0;
  const accuracy = txns.length > 0 ? ((tp + tn) / txns.length) * 100 : 0;
  const fpRate = fp + tn > 0 ? (fp / (fp + tn)) * 100 : 0;
  const fnRate = fn + tp > 0 ? (fn / (fn + tp)) * 100 : 0;
  return {
    tp, fp, tn, fn,
    precision: +precision.toFixed(1),
    recall: +recall.toFixed(1),
    accuracy: +accuracy.toFixed(1),
    fpRate: +fpRate.toFixed(1),
    fnRate: +fnRate.toFixed(1),
  };
}

export function confusionMetrics(txns: EnrichedTransaction[]) {
  return confusionForDecision(txns, "ai");
}

export function scoreDistribution(txns: EnrichedTransaction[]) {
  const bands = ["0-20", "20-40", "40-60", "60-80", "80-100"];
  return bands.map((label, i) => ({
    label,
    original: txns.filter((t) => Math.min(4, Math.floor(t.originalRiskScore / 20)) === i).length,
    optimized: txns.filter((t) => Math.min(4, Math.floor(t.ai.optimizedRiskScore / 20)) === i).length,
  }));
}

export function confidenceDistribution(txns: EnrichedTransaction[]) {
  const bands = ["55-65", "65-75", "75-85", "85-95", "95-100"];
  const edges = [55, 65, 75, 85, 95, 101];
  return bands.map((label, i) => ({
    label,
    value: txns.filter((t) => t.ai.confidence >= edges[i] && t.ai.confidence < edges[i + 1]).length,
  }));
}

// ---- Dynamically generated AI insights (data-driven, not hardcoded) ----------

export function generateInsights(
  profiles: Profiles,
  kpis: KpiSnapshot,
  createdAt: string,
): Insight[] {
  const out: Insight[] = [];
  let n = 200;
  const add = (i: Omit<Insight, "id" | "status" | "createdAt">) =>
    out.push({ ...i, id: `INS-${n++}`, status: "NEW", createdAt });

  // Worst-performing rules
  const rules = [...profiles.rules.values()].filter((r) => r.triggerCount >= 2).sort((a, b) => b.falsePositiveCount - a.falsePositiveCount);
  for (const r of rules.slice(0, 6)) {
    if (r.falsePositiveRate < 15 && r.precision > 30) continue;
    const sev = r.falsePositiveRate >= 55 ? "CRITICAL" : r.falsePositiveRate >= 35 ? "HIGH" : "MEDIUM";
    add({
      titleAr: `القاعدة ${r.id} تُسبّب رفضًا خاطئًا مرتفعًا (${r.falsePositiveRate}%)`,
      titleEn: `Rule ${r.id} drives a high false-positive rate (${r.falsePositiveRate}%)`,
      category: "قواعد", categoryEn: "Rules", severity: sev as Insight["severity"],
      evidenceAr: `${r.falsePositiveCount} رفض خاطئ مقابل ${r.confirmedFraudCount} احتيال مؤكد ودقة ${r.precision}%.`,
      evidenceEn: `${r.falsePositiveCount} false positives vs ${r.confirmedFraudCount} confirmed fraud at ${r.precision}% precision.`,
      financialImpact: r.estimatedRevenueLost,
      actionAr: `خفض وزن القاعدة إلى ${r.recommendedWeight} أو إضافة استثناء الجهاز الموثوق.`,
      actionEn: `Reduce weight to ${r.recommendedWeight} or add a trusted-device exception.`,
      confidence: Math.min(95, 78 + r.triggerCount),
    });
  }

  // Segments over-penalized
  const segs = [...profiles.segments.values()].filter((g) => g.totalTransactions >= 5).sort((a, b) => b.falsePositiveRate - a.falsePositiveRate);
  for (const g of segs.slice(0, 3)) {
    if (g.falsePositiveRate < 0.03) continue;
    const lbl = SEGMENT_LABEL[g.key]?.ar ?? g.key;
    const lblEn = SEGMENT_LABEL[g.key]?.en ?? g.key;
    add({
      titleAr: `شريحة «${lbl}» تتعرض لرفض خاطئ أعلى من المتوسط`,
      titleEn: `Segment "${lblEn}" faces above-average false positives`,
      category: "شرائح", categoryEn: "Segments", severity: "HIGH",
      evidenceAr: `معدل الرفض الخاطئ ${(g.falsePositiveRate * 100).toFixed(1)}% مع معدل احتيال ${(g.fraudRate * 100).toFixed(1)}%.`,
      evidenceEn: `${(g.falsePositiveRate * 100).toFixed(1)}% false-positive rate at ${(g.fraudRate * 100).toFixed(1)}% fraud rate.`,
      financialImpact: Math.round(g.falsePositiveCount * 160),
      actionAr: "إضافة استثناء السجل السلوكي لهذه الشريحة.", actionEn: "Add a behavioral-history exception for this segment.",
      confidence: 86,
    });
  }

  // Channels
  const chans = [...profiles.channels.values()].filter((g) => g.totalTransactions >= 5).sort((a, b) => b.falsePositiveRate - a.falsePositiveRate);
  for (const g of chans.slice(0, 3)) {
    const lbl = CHANNEL_LABEL[g.key]?.ar ?? g.key;
    const lblEn = CHANNEL_LABEL[g.key]?.en ?? g.key;
    add({
      titleAr: `قناة «${lbl}»: فرصة لتحسين الرفض الخاطئ`,
      titleEn: `Channel "${lblEn}": false-positive optimization opportunity`,
      category: "قنوات", categoryEn: "Channels", severity: g.falsePositiveRate > 0.08 ? "MEDIUM" : "LOW",
      evidenceAr: `${g.falsePositiveCount} رفض خاطئ من ${g.totalTransactions} عملية على هذه القناة.`,
      evidenceEn: `${g.falsePositiveCount} false positives across ${g.totalTransactions} transactions on this channel.`,
      financialImpact: Math.round(g.falsePositiveCount * 150),
      actionAr: "ضبط عتبات القواعد لهذه القناة.", actionEn: "Tune rule thresholds for this channel.",
      confidence: 82,
    });
  }

  // Feature-level
  for (const f of profiles.features.slice(0, 6)) {
    if (f.totalWithFeature < 8) continue;
    add({
      titleAr: `الميزة «${f.feature}» ترتبط بمعدل احتيال ${(f.fraudRate * 100).toFixed(1)}%`,
      titleEn: `Feature "${f.feature}" carries a ${(f.fraudRate * 100).toFixed(1)}% fraud rate`,
      category: "سلوك", categoryEn: "Behavior", severity: f.fraudRate > 0.2 ? "HIGH" : "INFO",
      evidenceAr: `${f.fraudWithFeature} احتيال و${f.legitWithFeature} سليمة ضمن العمليات ذات هذه الميزة.`,
      evidenceEn: `${f.fraudWithFeature} fraud vs ${f.legitWithFeature} legitimate among transactions with this feature.`,
      financialImpact: Math.round(f.fraudWithFeature * 2400),
      actionAr: "تعديل وزن هذه الإشارة في المعايرة.", actionEn: "Adjust this signal's weight in calibration.",
      confidence: 84,
    });
  }

  // Operational
  add({
    titleAr: `يمكن خفض المراجعة اليدوية بنسبة ${kpis.manualReviewReductionPct}%`,
    titleEn: `Manual review volume can be reduced by ${kpis.manualReviewReductionPct}%`,
    category: "عمليات", categoryEn: "Operations", severity: "MEDIUM",
    evidenceAr: `التوصية المحسّنة تخفض قرارات المراجعة/الرفض مقارنة بالمحرك الأصلي.`,
    evidenceEn: `The optimized recommendation reduces review/reject decisions vs the legacy engine.`,
    financialImpact: kpis.operationalCostSaved,
    actionAr: "أتمتة الموافقة للحالات عالية الثقة ضمن حدود الحوكمة.", actionEn: "Automate approval for high-confidence cases within governance limits.",
    confidence: 88,
  });
  add({
    titleAr: `اكتشف النظام ${kpis.falseNegativesCaught} حالة احتيال فوّتها المحرك الأصلي`,
    titleEn: `The system caught ${kpis.falseNegativesCaught} fraud cases missed by the legacy engine`,
    category: "احتيال", categoryEn: "Fraud", severity: kpis.falseNegativesCaught > 0 ? "HIGH" : "INFO",
    evidenceAr: `عمليات وافق عليها المحرك الأصلي بينما توصي المنصة برفضها/مراجعتها.`,
    evidenceEn: `Transactions the legacy engine approved while the platform recommends reject/review.`,
    financialImpact: Math.round(kpis.falseNegativesCaught * 2400),
    actionAr: "مراجعة أنماط التجزئة والأجهزة المشتركة.", actionEn: "Review structuring and shared-device patterns.",
    confidence: 90,
  });

  return out;
}
