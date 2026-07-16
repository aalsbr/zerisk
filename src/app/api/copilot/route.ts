import { NextResponse } from "next/server";
import { answerQuestion } from "@/lib/copilot";
import { copilotRefine, isCopilotOnline } from "@/lib/openai";
import { COPILOT_MODEL } from "@/lib/openai";

export async function POST(req: Request) {
  let body: { question?: string; lang?: "ar" | "en" };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const question = (body.question ?? "").toString().slice(0, 500);
  const lang = body.lang === "en" ? "en" : "ar";
  if (!question.trim()) {
    return NextResponse.json({ error: "question is required" }, { status: 400 });
  }

  // Local, deterministic answer is always the ground truth.
  const local = answerQuestion(question, lang);

  // Optionally refine wording via OpenAI (grounded strictly on the local facts).
  let answer = local.answer;
  let source: "openai" | "local" = "local";
  if (isCopilotOnline()) {
    const refined = await copilotRefine(question, local.answer, lang);
    if (refined && refined.trim().length > 0) {
      answer = refined.trim();
      source = "openai";
    }
  }

  return NextResponse.json({
    answer,
    followups: local.followups,
    sources: local.sources,
    meta: { source, online: isCopilotOnline(), model: COPILOT_MODEL },
  });
}
