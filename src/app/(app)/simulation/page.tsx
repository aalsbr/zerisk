import { getDataset } from "@/lib/store";
import { SimulationView, type SlimTxn } from "@/components/pages/simulation-view";

export default async function SimulationPage({
  searchParams,
}: {
  searchParams: Promise<{ rule?: string }>;
}) {
  const { rules, transactions } = getDataset();
  const { rule } = await searchParams;

  // Slim, serializable transactions carrying exactly the fields runSimulation needs.
  const slim: SlimTxn[] = transactions.map((t) => ({
    id: t.id,
    amount: t.amount,
    triggeredRuleIds: t.triggeredRuleIds,
    customer: { segment: t.customer.segment },
    isActuallyFraud: t.isActuallyFraud,
    isFalsePositive: t.isFalsePositive,
    ai: { optimizedRiskScore: t.ai.optimizedRiskScore },
  }));

  return <SimulationView rules={rules} transactions={slim} preselectRuleId={rule} />;
}
