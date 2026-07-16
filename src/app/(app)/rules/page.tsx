import { getDataset } from "@/lib/store";
import { computeRuleStats } from "@/lib/analytics";
import { RulesView } from "@/components/pages/rules-view";
import type { RuleStatus } from "@/lib/types";

// Fraud loss avoided per confirmed-fraud case caught (aligned to simulation AVG_FRAUD_LOSS).
const FRAUD_LOSS_AVOIDED = 2400;

interface VersionEntry {
  version: string;
  date: string;
  changeAr: string;
  changeEn: string;
}

// Deterministic, plausible bilingual version history per rule (no randomness).
function versionHistory(ruleId: string): VersionEntry[] {
  return [
    {
      version: "v3",
      date: "2026-06-02",
      changeAr: `رفع عتبة المبلغ ومعايرة الوزن للقاعدة ${ruleId} لخفض الرفض الخاطئ.`,
      changeEn: `Raised amount threshold and recalibrated weight for ${ruleId} to cut false positives.`,
    },
    {
      version: "v2",
      date: "2026-03-14",
      changeAr: `إضافة استثناء السجل السلوكي للعملاء ذوي التاريخ النظيف على القاعدة ${ruleId}.`,
      changeEn: `Added customer-history exception for clean-history customers on ${ruleId}.`,
    },
    {
      version: "v1",
      date: "2026-01-05",
      changeAr: `الإصدار الأولي للقاعدة ${ruleId} ضمن حزمة الحوكمة الأساسية.`,
      changeEn: `Initial release of ${ruleId} within the baseline governance pack.`,
    },
  ];
}

export default function RulesPage() {
  const { transactions, rules } = getDataset();
  const ruleStats = computeRuleStats(transactions, rules);

  const data = {
    rules: ruleStats.map((s) => ({
      id: s.rule.id,
      nameAr: s.rule.name,
      nameEn: s.rule.nameEn,
      descriptionAr: s.rule.description,
      descriptionEn: s.rule.descriptionEn,
      categoryAr: s.rule.category,
      categoryEn: s.rule.categoryEn,
      status: s.rule.status as RuleStatus,
      severity: s.rule.severity,
      action: s.rule.action,
      amountThreshold: s.rule.amountThreshold ?? null,
      triggerCount: s.triggerCount,
      confirmedFraud: s.confirmedFraud,
      falsePositives: s.falsePositives,
      precision: s.precision,
      falsePositiveRate: s.falsePositiveRate,
      financialImpact: s.financialImpact,
      estimatedBenefit: s.confirmedFraud * FRAUD_LOSS_AVOIDED,
      recommendationKey: s.recommendationKey,
      lastUpdated: versionHistory(s.rule.id)[0].date,
      history: versionHistory(s.rule.id),
    })),
  };

  return <RulesView data={data} />;
}
