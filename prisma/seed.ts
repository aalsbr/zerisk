// ZeRisk — Prisma seed. Mirrors the deterministic generator + learning state into SQLite.
import { PrismaClient } from "@prisma/client";
import { generateBase } from "../src/lib/demo-data";
import { generateDataset } from "../src/lib/dataset";
import { computeProfiles } from "../src/lib/profiles";
import { computeCalibration, nextVersion, baselineCalibration } from "../src/lib/learning";
import { computeKpis, confusionForDecision, generateInsights } from "../src/lib/analytics";
import { DEFAULT_ASSUMPTIONS } from "../src/lib/financial";
import type { InvestigationOutcome } from "../src/lib/types";

const prisma = new PrismaClient();

async function main() {
  const base = generateBase();
  const ds = generateDataset(); // enriched (ai) transactions
  const labels = new Map<string, InvestigationOutcome>();
  for (const t of base.rawTransactions) if (t.outcome) labels.set(t.id, t.outcome);
  const profiles = computeProfiles(base.rawTransactions, base.customers, base.devices, base.beneficiaries, base.rules, (id) => labels.get(id));
  const calVersion = nextVersion(baselineCalibration().version);
  const calibration = computeCalibration(profiles, calVersion, new Date(Date.UTC(2026, 6, 1)).toISOString());
  const kpis = computeKpis(ds.transactions, DEFAULT_ASSUMPTIONS);
  const opt = confusionForDecision(ds.transactions, "ai");

  // Clear (child → parent order)
  await prisma.decisionOutcome.deleteMany();
  await prisma.learningEvent.deleteMany();
  await prisma.riskProfileSnapshot.deleteMany();
  await prisma.featureStatistic.deleteMany();
  await prisma.modelCalibration.deleteMany();
  await prisma.modelVersion.deleteMany();
  await prisma.investigatorFeedback.deleteMany();
  await prisma.investigationCase.deleteMany();
  await prisma.simulationResult.deleteMany();
  await prisma.simulation.deleteMany();
  await prisma.aIRecommendation.deleteMany();
  await prisma.fraudDecision.deleteMany();
  await prisma.ruleTrigger.deleteMany();
  await prisma.ruleVersion.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.device.deleteMany();
  await prisma.beneficiary.deleteMany();
  await prisma.fraudRule.deleteMany();
  await prisma.insight.deleteMany();
  await prisma.modelMetric.deleteMany();
  await prisma.integration.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.financialAssumption.deleteMany();

  await prisma.customer.createMany({ data: ds.customers });
  await prisma.device.createMany({ data: ds.devices });
  await prisma.beneficiary.createMany({
    data: ds.beneficiaries.map((b) => ({ id: b.id, name: b.name, nameEn: b.nameEn, bank: b.bank, type: b.type, known: b.known, txnCount: b.txnCount, firstSeenDaysAgo: b.firstSeenDaysAgo, trustScore: b.trustScore })),
  });
  await prisma.fraudRule.createMany({
    data: ds.rules.map((r) => ({ id: r.id, name: r.name, nameEn: r.nameEn, description: r.description, descriptionEn: r.descriptionEn, category: r.category, categoryEn: r.categoryEn, status: r.status, severity: r.severity, action: r.action, weight: r.weight, amountThreshold: r.amountThreshold ?? null })),
  });
  for (const r of ds.rules) {
    await prisma.ruleVersion.createMany({
      data: [
        { ruleId: r.id, version: "v1.0", changeAr: "إصدار أولي", changeEn: "Initial rule version", at: new Date(Date.UTC(2025, 8, 1)) },
        { ruleId: r.id, version: "v1.1", changeAr: "معايرة العتبة", changeEn: "Threshold calibration", at: new Date(Date.UTC(2026, 6, 10)) },
      ],
    });
  }

  // Transactions (batched) + triggers + decisions + AI recs + decision outcomes
  await prisma.transaction.createMany({
    data: ds.transactions.map((t) => ({
      id: t.id, customerId: t.customerId, amount: t.amount, currency: t.currency, channel: t.channel, category: t.category,
      deviceId: t.deviceId, beneficiaryId: t.beneficiaryId, region: t.region, timestamp: new Date(t.timestamp), hour: t.hour,
      originalDecision: t.originalDecision, originalRiskScore: t.originalRiskScore, mfaPassed: t.mfaPassed, failedLogins: t.failedLogins,
      velocity1h: t.velocity1h, passwordResetRecently: t.passwordResetRecently, locationFamiliar: t.locationFamiliar, timeFamiliar: t.timeFamiliar,
      isActuallyFraud: t.isActuallyFraud, outcome: t.outcome ?? null, scenario: t.scenario, processingTimeMs: t.processingTimeMs,
    })),
  });
  await prisma.ruleTrigger.createMany({
    data: ds.transactions.flatMap((t) => t.triggeredRuleIds.map((ruleId) => ({ transactionId: t.id, ruleId }))),
  });
  await prisma.fraudDecision.createMany({
    data: ds.transactions.map((t) => ({ transactionId: t.id, decision: t.originalDecision, riskScore: t.originalRiskScore, engine: "IBM Safer Payments (sim)" })),
  });
  await prisma.aIRecommendation.createMany({
    data: ds.transactions.map((t) => ({ transactionId: t.id, recommendation: t.ai.recommendation, optimizedRiskScore: t.ai.optimizedRiskScore, falsePositiveProbability: t.ai.falsePositiveProbability, confidence: t.ai.confidence, reasonCodes: JSON.stringify(t.ai.reasonCodes) })),
  });
  await prisma.decisionOutcome.createMany({
    data: ds.transactions.filter((t) => t.outcome === "CONFIRMED_FRAUD" || t.outcome === "LEGITIMATE").map((t) => ({ transactionId: t.id, originalDecision: t.originalDecision, aiRecommendation: t.ai.recommendation, finalOutcome: t.outcome!, isActuallyFraud: t.isActuallyFraud, at: new Date(t.timestamp) })),
  });

  // Investigation cases (~250) + feedback for a subset
  const caseTxns = ds.transactions.filter((t) => t.originalDecision === "REVIEW" || t.originalDecision === "REJECT" || t.ai.recommendation === "REJECT" || t.ai.recommendation === "REVIEW").slice(0, 250);
  let i = 0;
  for (const t of caseTxns) {
    const c = await prisma.investigationCase.create({ data: { transactionId: t.id, status: i < 130 ? "RESOLVED" : "PENDING" } });
    if (i < 130) {
      const outcome = t.outcome ?? (t.isActuallyFraud ? "CONFIRMED_FRAUD" : t.isFalsePositive ? "LEGITIMATE" : "INCONCLUSIVE");
      await prisma.investigatorFeedback.create({ data: { caseId: c.id, outcome, note: outcome === "LEGITIMATE" ? "عملية سليمة مؤكدة" : "تمت المراجعة", investigator: "Investigator", resolutionMinutes: 8 + (i % 12), at: new Date(Date.UTC(2026, 6, 15, 8 + (i % 12))) } });
    }
    i++;
  }

  const insights = generateInsights(profiles, kpis, new Date(Date.UTC(2026, 6, 17)).toISOString());
  await prisma.insight.createMany({ data: insights.map((n) => ({ id: n.id, titleAr: n.titleAr, titleEn: n.titleEn, category: n.category, categoryEn: n.categoryEn, severity: n.severity, evidenceAr: n.evidenceAr, evidenceEn: n.evidenceEn, financialImpact: n.financialImpact, actionAr: n.actionAr, actionEn: n.actionEn, confidence: n.confidence, status: n.status, createdAt: new Date(n.createdAt) })) });

  await prisma.modelMetric.createMany({
    data: ds.metrics.map((m) => ({ id: m.month, label: m.label, totalTransactions: m.totalTransactions, fpRateBefore: m.fpRateBefore, fpRateAfter: m.fpRateAfter, recoveredTransactions: m.recoveredTransactions, revenueRecovered: m.revenueRecovered, fraudPrevented: m.fraudPrevented, manualReviews: m.manualReviews, accuracy: m.accuracy, precision: m.precision, recall: m.recall, falseNegativeRate: m.falseNegativeRate, drift: m.drift })),
  });
  await prisma.integration.createMany({ data: ds.integrations.map((g) => ({ ...g, lastSync: new Date(g.lastSync) })) });

  // ---- Learning state ----
  await prisma.modelVersion.createMany({
    data: [
      { version: baselineCalibration().version, createdAt: new Date(Date.UTC(2025, 7, 1)), labeledCount: 0, triggeredBy: "System", note: "Baseline (uncalibrated)", fpRate: 0, recall: 0, precision: 0, accuracy: 0 },
      { version: calVersion, createdAt: new Date(Date.UTC(2026, 6, 1)), labeledCount: profiles.labeledCount, triggeredBy: "Data Scientist", note: "Initial calibration from labels", fpRate: opt.fpRate, recall: opt.recall, precision: opt.precision, accuracy: opt.accuracy },
    ],
  });
  await prisma.modelCalibration.create({ data: { version: calibration.version, createdAt: new Date(calibration.createdAt), labeledCount: calibration.labeledCount, deviceTrustBoost: calibration.deviceTrustBoost, beneficiaryHistoryBoost: calibration.beneficiaryHistoryBoost, velocityWeight: calibration.velocityWeight, fpCalibration: calibration.fpCalibration, confidenceBias: calibration.confidenceBias, payload: JSON.stringify(calibration) } });
  await prisma.featureStatistic.createMany({ data: profiles.features.map((f) => ({ feature: f.feature, totalWithFeature: f.totalWithFeature, fraudWithFeature: f.fraudWithFeature, legitWithFeature: f.legitWithFeature, fraudRate: f.fraudRate, weightHint: f.weightHint })) });
  await prisma.learningEvent.createMany({
    data: [
      { id: "LRN-seed-1", transactionId: "TX-DEMO-FP-001", feedbackOutcome: "LEGITIMATE", previousRecommendation: "APPROVE", finalOutcome: "LEGITIMATE", affectedRules: JSON.stringify(["FR-017", "FR-024"]), affectedFeatures: JSON.stringify(["TRUSTED_DEVICE", "KNOWN_BENEFICIARY"]), changes: JSON.stringify([]), previousVersion: baselineCalibration().version, newVersion: calVersion, at: new Date(Date.UTC(2026, 6, 1)), actor: "Data Scientist", descriptionEn: "Initial calibration from seeded labels." },
    ],
  });
  const snap = (kind: string, id: string, payload: unknown) => ({ kind, entityId: id, version: calVersion, at: new Date(Date.UTC(2026, 6, 1)), payload: JSON.stringify(payload) });
  const topDevices = [...profiles.devices.values()].sort((a, b) => b.successfulTransactionCount - a.successfulTransactionCount).slice(0, 5);
  const topRules = [...profiles.rules.values()].slice(0, 5);
  await prisma.riskProfileSnapshot.createMany({ data: [...topDevices.map((d) => snap("device", d.id, d)), ...topRules.map((r) => snap("rule", r.id, r))] });

  await prisma.auditLog.createMany({
    data: [
      { id: "AUD-1001", at: new Date(Date.UTC(2026, 6, 17, 9, 12)), actor: "Fraud Manager", action: "RULE_REVIEW", detail: "راجعت أداء القاعدة FR-017" },
      { id: "AUD-1000", at: new Date(Date.UTC(2026, 6, 16, 15, 40)), actor: "Data Scientist", action: "MODEL_DEPLOY", detail: `نشر معايرة النموذج ${calVersion}` },
    ],
  });
  await prisma.financialAssumption.create({ data: { id: "default", ...DEFAULT_ASSUMPTIONS } });

  console.log("✔ Seed complete:", {
    customers: ds.customers.length, devices: ds.devices.length, beneficiaries: ds.beneficiaries.length,
    rules: ds.rules.length, transactions: ds.transactions.length, labeled: profiles.labeledCount,
    cases: caseTxns.length, insights: insights.length, features: profiles.features.length,
    modelVersions: 2, calibration: calVersion,
  });
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
