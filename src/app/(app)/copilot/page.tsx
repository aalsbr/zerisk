import { isCopilotOnline } from "@/lib/openai";
import { CopilotView } from "@/components/pages/copilot-view";

// Suggested starter prompts (bilingual). Kept server-side and passed as plain data.
const SUGGESTIONS: { ar: string; en: string }[] = [
  {
    ar: "لماذا رُفضت العملية TX-2026-000145؟",
    en: "Why was transaction TX-2026-000145 rejected?",
  },
  { ar: "اشرح القاعدة FR-017", en: "Explain rule FR-017" },
  {
    ar: "أي قاعدة تسبب أعلى رفض خاطئ؟",
    en: "Which rule causes the most false positives?",
  },
  {
    ar: "أظهر لي الرفض الخاطئ عالي القيمة",
    en: "Show me high-value false positives",
  },
  { ar: "كم المبلغ الذي يمكن استرداده؟", en: "How much can be recovered?" },
  { ar: "لخّص نشاط الاحتيال اليوم", en: "Summarize today's fraud activity" },
  { ar: "اقترح تحسينات على القواعد", en: "Suggest rule improvements" },
];

export default function CopilotPage() {
  return <CopilotView online={isCopilotOnline()} suggestions={SUGGESTIONS} />;
}
