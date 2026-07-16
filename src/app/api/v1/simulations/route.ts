import { NextResponse } from "next/server";
import { getDataset } from "@/lib/store";
import { defaultConfig, runSimulation, type SimulationConfig } from "@/lib/simulation";

// POST /api/v1/simulations — run a what-if rule change over the seeded dataset.
export async function POST(req: Request) {
  let b: Partial<SimulationConfig> & { ruleId?: string };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const ds = getDataset();
  const rule = ds.rules.find((r) => r.id === b.ruleId) ?? ds.rules[0];
  const config: SimulationConfig = { ...defaultConfig(rule), ...b, ruleId: rule.id };
  const result = runSimulation(config, ds.transactions);
  return NextResponse.json({ config, result });
}
