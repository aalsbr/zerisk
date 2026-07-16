import { notFound } from "next/navigation";
import { getDataset, getTransaction } from "@/lib/store";
import {
  TransactionAnalysisView,
  type SimilarTxn,
} from "@/components/pages/transaction-analysis-view";

export default async function TransactionAnalysisPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const txn = getTransaction(id);
  if (!txn) notFound();

  const { transactions } = getDataset();
  const similar: SimilarTxn[] = transactions
    .filter((t) => t.id !== txn.id && t.scenario === txn.scenario)
    .slice(0, 4)
    .map((t) => ({
      id: t.id,
      customerName: t.customer.name,
      customerNameEn: t.customer.nameEn,
      amount: t.amount,
      currency: t.currency,
      timestamp: t.timestamp,
      originalDecision: t.originalDecision,
      aiRecommendation: t.ai.recommendation,
      optimizedRiskScore: t.ai.optimizedRiskScore,
      isFalsePositive: t.isFalsePositive,
    }));

  return <TransactionAnalysisView txn={txn} similar={similar} />;
}
