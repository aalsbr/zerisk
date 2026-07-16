import { NextResponse } from "next/server";
import { getTransaction, setFeedback } from "@/lib/store";
import type { InvestigationOutcome } from "@/lib/types";

const VALID: InvestigationOutcome[] = ["LEGITIMATE", "CONFIRMED_FRAUD", "INCONCLUSIVE", "PENDING"];

// POST /api/v1/feedback — record an investigator outcome for a transaction.
export async function POST(req: Request) {
  let b: { transactionId?: string; outcome?: string; note?: string; investigator?: string };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const id = b.transactionId ?? "";
  const outcome = (b.outcome ?? "").toUpperCase() as InvestigationOutcome;
  if (!getTransaction(id)) {
    return NextResponse.json({ error: `Unknown transaction ${id}` }, { status: 404 });
  }
  if (!VALID.includes(outcome)) {
    return NextResponse.json({ error: "outcome must be one of " + VALID.join(", ") }, { status: 400 });
  }
  setFeedback(id, {
    outcome,
    note: b.note ?? "",
    investigator: b.investigator ?? "api",
    resolutionMinutes: 10,
    at: new Date(Date.UTC(2026, 6, 17, 12, 0)).toISOString(),
  });
  return NextResponse.json({ ok: true, transactionId: id, outcome });
}
