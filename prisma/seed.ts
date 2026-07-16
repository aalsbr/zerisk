// FraudLens AI — Prisma seed. Mirrors the deterministic generator into SQLite.
import { PrismaClient } from "@prisma/client";
import { generateDataset } from "../src/lib/demo-data";
import { DEFAULT_ASSUMPTIONS } from "../src/lib/financial";

const prisma = new PrismaClient();

async function main() {
  const ds = generateDataset();

  // Clear (child → parent order) for idempotent re-seeding.
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
    data: ds.beneficiaries.map((b) => ({
      id: b.id, name: b.name, nameEn: b.nameEn, bank: b.bank, type: b.type,
      known: b.known, txnCount: b.txnCount, firstSeenDaysAgo: b.firstSeenDaysAgo,
      trustScore: b.trustScore,
    })),
  });

  await prisma.fraudRule.createMany({
    data: ds.rules.map((r) => ({
      id: r.id, name: r.name, nameEn: r.nameEn, description: r.description,
      descriptionEn: r.descriptionEn, category: r.category, categoryEn: r.categoryEn,
      status: r.status, severity: r.severity, action: r.action, weight: r.weight,
      amountThreshold: r.amountThreshold ?? null,
    })),
  });

  // Rule versions (2 per rule)
  const now = new Date(Date.UTC(2026, 6, 10));
  for (const r of ds.rules) {
    await prisma.ruleVersion.createMany({
      data: [
        { ruleId: r.id, version: "v1.0", changeAr: "إصدار أولي للقاعدة", changeEn: "Initial rule version", at: new Date(Date.UTC(2025, 8, 1)) },
        { ruleId: r.id, version: "v1.1", changeAr: "معايرة العتبة", changeEn: "Threshold calibration", at: now },
      ],
    });
  }

  // Transactions + triggers + decisions + AI recs
  for (const t of ds.transactions) {
    await prisma.transaction.create({
      data: {
        id: t.id, customerId: t.customerId, amount: t.amount, currency: t.currency,
        channel: t.channel, deviceId: t.deviceId, beneficiaryId: t.beneficiaryId,
        timestamp: new Date(t.timestamp), hour: t.hour,
        originalDecision: t.originalDecision, originalRiskScore: t.originalRiskScore,
        mfaPassed: t.mfaPassed, failedLogins: t.failedLogins, velocity1h: t.velocity1h,
        locationFamiliar: t.locationFamiliar, timeFamiliar: t.timeFamiliar,
        isActuallyFraud: t.isActuallyFraud, scenario: t.scenario,
        processingTimeMs: t.processingTimeMs,
      },
    });
    if (t.triggeredRuleIds.length) {
      await prisma.ruleTrigger.createMany({
        data: t.triggeredRuleIds.map((ruleId) => ({ transactionId: t.id, ruleId })),
      });
    }
    await prisma.fraudDecision.create({
      data: { transactionId: t.id, decision: t.originalDecision, riskScore: t.originalRiskScore, engine: "IBM Safer Payments (sim)" },
    });
    await prisma.aIRecommendation.create({
      data: {
        transactionId: t.id, recommendation: t.ai.recommendation,
        optimizedRiskScore: t.ai.optimizedRiskScore,
        falsePositiveProbability: t.ai.falsePositiveProbability,
        confidence: t.ai.confidence, reasonCodes: JSON.stringify(t.ai.reasonCodes),
      },
    });
  }

  // Investigation cases (~25) + feedback for a subset
  const cases = ds.transactions
    .filter((t) => t.originalDecision === "REVIEW" || t.originalDecision === "REJECT" || t.ai.recommendation === "REJECT")
    .slice(0, 25);
  let i = 0;
  for (const t of cases) {
    const c = await prisma.investigationCase.create({
      data: { transactionId: t.id, status: i < 12 ? "RESOLVED" : "PENDING" },
    });
    if (i < 12) {
      const outcome = t.isActuallyFraud ? "CONFIRMED_FRAUD" : t.isFalsePositive ? "LEGITIMATE" : "INCONCLUSIVE";
      await prisma.investigatorFeedback.create({
        data: {
          caseId: c.id, outcome, note: outcome === "LEGITIMATE" ? "عملية سليمة مؤكدة" : "تمت المراجعة",
          investigator: "Investigator", resolutionMinutes: 8 + (i % 10),
          at: new Date(Date.UTC(2026, 6, 15, 10 + (i % 8))),
        },
      });
    }
    i++;
  }

  await prisma.insight.createMany({
    data: ds.insights.map((n) => ({ ...n, createdAt: new Date(n.createdAt) })),
  });

  await prisma.modelMetric.createMany({
    data: ds.metrics.map((m) => ({
      id: m.month, label: m.label, totalTransactions: m.totalTransactions,
      fpRateBefore: m.fpRateBefore, fpRateAfter: m.fpRateAfter,
      recoveredTransactions: m.recoveredTransactions, revenueRecovered: m.revenueRecovered,
      fraudPrevented: m.fraudPrevented, manualReviews: m.manualReviews,
      accuracy: m.accuracy, precision: m.precision, recall: m.recall,
      falseNegativeRate: m.falseNegativeRate, drift: m.drift,
    })),
  });

  await prisma.integration.createMany({
    data: ds.integrations.map((g) => ({ ...g, lastSync: new Date(g.lastSync) })),
  });

  await prisma.auditLog.createMany({
    data: [
      { id: "AUD-1001", at: new Date(Date.UTC(2026, 6, 17, 9, 12)), actor: "Fraud Manager", action: "RULE_REVIEW", detail: "راجعت أداء القاعدة FR-017" },
      { id: "AUD-1000", at: new Date(Date.UTC(2026, 6, 16, 15, 40)), actor: "Data Scientist", action: "MODEL_DEPLOY", detail: "نشر إصدار النموذج v2.4.1" },
      { id: "AUD-999", at: new Date(Date.UTC(2026, 6, 16, 11, 5)), actor: "Investigator", action: "FEEDBACK", detail: "تأكيد سلامة العملية TX-2026-000145" },
    ],
  });

  await prisma.financialAssumption.create({ data: { id: "default", ...DEFAULT_ASSUMPTIONS } });

  const counts = {
    customers: ds.customers.length, devices: ds.devices.length,
    beneficiaries: ds.beneficiaries.length, rules: ds.rules.length,
    transactions: ds.transactions.length, insights: ds.insights.length,
    metrics: ds.metrics.length, integrations: ds.integrations.length, cases: cases.length,
  };
  console.log("✔ Seed complete:", counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
