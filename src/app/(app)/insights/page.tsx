import { getDataset } from "@/lib/store";
import { InsightsView } from "@/components/pages/insights-view";

export default function InsightsPage() {
  const { insights } = getDataset();

  // Insights are already plain-serializable (see Insight type). Pass a sorted
  // copy (severity desc, then newest first) so the client renders deterministically.
  const order = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, INFO: 0 } as const;
  const sorted = [...insights].sort((a, b) => {
    const s = order[b.severity] - order[a.severity];
    if (s !== 0) return s;
    return b.createdAt.localeCompare(a.createdAt);
  });

  return <InsightsView insights={sorted} />;
}
