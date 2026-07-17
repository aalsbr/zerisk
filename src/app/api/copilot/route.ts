import { NextResponse } from "next/server";
import { answerQuestion, buildCopilotContext } from "@/lib/copilot";
import { copilotRefine, isCopilotOnline, COPILOT_MODEL } from "@/lib/openai";

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

  // Local, deterministic answer: offline fallback + extracts the most relevant
  // computed facts (specific transaction / rule) for the question.
  const local = answerQuestion(question, lang);

  let answer = local.answer;
  let source: "openai" | "local" = "local";

  // When online, let the AI actually answer ANY question, grounded on live facts
  // (rich dataset context + the specific facts the local engine surfaced).
  if (isCopilotOnline()) {
    const facts =
      buildCopilotContext(lang) +
      `\n\nMOST RELEVANT COMPUTED FACTS FOR THIS QUESTION:\n${local.answer}` +
      (local.sources.length ? `\nSources: ${local.sources.join(", ")}` : "");
    const refined = await copilotRefine(question, facts, lang);
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
