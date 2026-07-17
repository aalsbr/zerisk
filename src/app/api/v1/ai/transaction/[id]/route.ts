import { NextResponse } from "next/server";
import { getTransaction } from "@/lib/store";
import { analyzeTransaction } from "@/lib/openai";

// GET /api/v1/ai/transaction/:id — OpenAI-assisted, Zod-validated analysis with
// source references. Falls back to the local engine when offline/invalid; the
// decision + scores are ALWAYS from the local scoring engine.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const t = getTransaction(id);
  if (!t) return NextResponse.json({ error: `Unknown transaction ${id}` }, { status: 404 });
  const analysis = await analyzeTransaction(t);
  return NextResponse.json(analysis);
}
