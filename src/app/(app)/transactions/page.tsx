import { getDataset } from "@/lib/store";
import { TransactionsView, type TxnRow } from "@/components/pages/transactions-view";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sp = await searchParams;
  const { transactions, rules } = getDataset();

  const rows: TxnRow[] = transactions.map((t) => ({
    id: t.id,
    customerId: t.customerId,
    customerName: t.customer.name,
    customerNameEn: t.customer.nameEn,
    segment: t.customer.segment,
    amount: t.amount,
    currency: t.currency,
    channel: t.channel,
    deviceId: t.deviceId,
    deviceKnown: t.device.known,
    beneficiaryName: t.beneficiary.name,
    beneficiaryNameEn: t.beneficiary.nameEn,
    beneficiaryType: t.beneficiary.type,
    timestamp: t.timestamp,
    originalDecision: t.originalDecision,
    originalRiskScore: t.originalRiskScore,
    aiRecommendation: t.ai.recommendation,
    optimizedRiskScore: t.ai.optimizedRiskScore,
    falsePositiveProbability: t.ai.falsePositiveProbability,
    confidence: t.ai.confidence,
    processingTimeMs: t.ai.processingTimeMs,
    triggeredRuleIds: t.triggeredRuleIds,
    isFalsePositive: t.isFalsePositive,
    hasFeedback: Boolean(t.feedback),
  }));

  const ruleOptions = rules.map((r) => ({
    id: r.id,
    name: r.name,
    nameEn: r.nameEn,
  }));

  return <TransactionsView rows={rows} ruleOptions={ruleOptions} initialQuery={sp.q ?? ""} />;
}
