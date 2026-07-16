import { getDataset } from "@/lib/store";
import { IntegrationsView } from "@/components/pages/integrations-view";
import type { Integration } from "@/lib/types";

export default function IntegrationsPage() {
  const { integrations } = getDataset();

  // Pass a plain serializable copy.
  const data: Integration[] = integrations.map((x) => ({
    id: x.id,
    name: x.name,
    nameEn: x.nameEn,
    category: x.category,
    categoryEn: x.categoryEn,
    connected: x.connected,
    lastSync: x.lastSync,
    transactionsProcessed: x.transactionsProcessed,
    avgLatencyMs: x.avgLatencyMs,
    health: x.health,
  }));

  return <IntegrationsView integrations={data} />;
}
