// ============================================================================
// ZeRisk — Fraud Copilot local answer engine.
//
// Answers natural-language questions using the application's own data. This is
// the deterministic, offline-first brain: it always works with no API key. When
// OpenAI is configured, the route layer may refine the wording — but the facts
// and any decision references ALWAYS come from the local scoring engine here.
// ============================================================================

import "server-only";
import { getDataset, getKpis, getCalibration } from "./store";
import { computeRuleStats, sampleFalsePositives } from "./analytics";
import { DECISION_LABEL, RULE_RECO_LABEL } from "./i18n";
import { fmtCurrency, fmtNumber, fmtPercent } from "./format";
import type { Lang } from "./format";
import { DEMO_IDS } from "./demo-data";

// Rich, live grounded-facts context so the LLM can answer ANY question about the
// platform accurately (never invents figures — every number here is computed).
export function buildCopilotContext(lang: Lang): string {
  const ds = getDataset();
  const k = getKpis();
  const cal = getCalibration();
  const stats = computeRuleStats(ds.transactions, ds.rules);
  const cur = (n: number) => fmtCurrency(n, "en");

  const topRules = stats.slice(0, 6).map((s) =>
    `${s.rule.id} (${s.rule.nameEn}): triggers ${s.triggerCount}, confirmedFraud ${s.confirmedFraud}, falsePositives ${s.falsePositives}, precision ${s.precision}%, fpRate ${s.falsePositiveRate}%, recommendation "${RULE_RECO_LABEL[s.recommendationKey].en}"`,
  ).join("\n  ");

  const demo = Object.entries(DEMO_IDS).map(([label, id]) => {
    const t = ds.transactions.find((x) => x.id === id);
    return t ? `${id} [${label}]: ${cur(t.amount)}, legacy ${t.originalDecision}(${t.originalRiskScore}) -> ZeRisk ${t.ai.recommendation}(opt ${t.ai.optimizedRiskScore}), FPprob ${t.ai.falsePositiveProbability}%, isFalsePositive=${t.isFalsePositive}` : "";
  }).filter(Boolean).join("\n  ");

  return `PLATFORM: ZeRisk — an AI fraud decision-optimization layer above the legacy fraud engine (IBM Safer Payments). It re-scores decisions to cut false positives while preserving fraud detection. The local deterministic scoring engine is the source of truth; you only explain.
MODEL: version ${cal.version}, labeled outcomes ${fmtNumber(cal.labeledCount)}; calibration factors: deviceTrustBoost ${cal.deviceTrustBoost}, beneficiaryHistoryBoost ${cal.beneficiaryHistoryBoost}, fpCalibration ${cal.fpCalibration}, confidenceBias ${cal.confidenceBias}.
DATASET: ${fmtNumber(ds.transactions.length)} transactions, ${ds.customers.length} customers, ${ds.devices.length} devices, ${ds.beneficiaries.length} beneficiaries, ${ds.rules.length} fraud rules, ${sampleFalsePositives(ds.transactions).length} false positives detected.
KPIs: approved ${fmtNumber(k.approved)}, rejected ${fmtNumber(k.rejected)}, under review ${fmtNumber(k.underReview)}, monitored ${fmtNumber(k.monitored)}; false-positive rate before ${fmtPercent(k.fpRateBefore, 2)} -> after ${fmtPercent(k.fpRateAfter, 2)}; recovered ${fmtNumber(k.recoveredTransactions)} legitimate transactions; revenue recovered ${cur(k.revenueRecovered)}; fraud prevented ${cur(k.fraudPrevented)}; operational cost saved ${cur(k.operationalCostSaved)}; recall before ${fmtPercent(k.originalRecall)} -> after ${fmtPercent(k.optimizedRecall)}; false negatives caught (missed by legacy) ${k.falseNegativesCaught}; average confidence ${fmtPercent(k.avgConfidence)}; average decision time ${k.avgDecisionTimeMs}ms; accuracy ${fmtPercent(k.aiAgreementRate)}.
TOP RULES BY FALSE POSITIVES:
  ${topRules}
NOTABLE (searchable) TRANSACTIONS:
  ${demo}
Answer in ${lang === "ar" ? "Arabic" : "English"}.`;
}

export interface CopilotAnswer {
  answer: string;
  followups: string[];
  sources: string[];
}

const A = (ar: string, en: string, lang: Lang) => (lang === "ar" ? ar : en);

export function answerQuestion(question: string, lang: Lang): CopilotAnswer {
  const q = question.trim();
  const lower = q.toLowerCase();
  const ds = getDataset();
  const k = getKpis();
  const stats = computeRuleStats(ds.transactions, ds.rules);

  // 1) Transaction lookup ("why was TX-... rejected / approved")
  const txMatch = q.match(/TX-?\d{4}-?\d{3,6}/i);
  if (txMatch) {
    const id = normalizeTxId(txMatch[0]);
    const t = ds.transactions.find((x) => x.id.toUpperCase() === id);
    if (t) {
      const dl = (d: keyof typeof DECISION_LABEL) => DECISION_LABEL[d][lang];
      const reasons = (t.ai.recommendation === "APPROVE" ? t.ai.supporting : t.ai.increasing)
        .slice(0, 4)
        .map((r) => `- ${lang === "ar" ? r.ar : r.en}`)
        .join("\n");
      const ar = `العملية ${t.id} بمبلغ ${fmtCurrency(t.amount, "ar")}:
- القرار الأصلي للمحرك: ${dl(t.originalDecision)} (درجة مخاطر ${t.originalRiskScore})
- توصية ZeRisk: ${dl(t.ai.recommendation)} (درجة محسنة ${t.ai.optimizedRiskScore})
- احتمالية الرفض الخاطئ: ${t.ai.falsePositiveProbability}% — درجة الثقة ${t.ai.confidence}%
${t.isFalsePositive ? "هذه عملية سليمة كان من المتوقع رفضها (رفض خاطئ).\n" : ""}الأسباب الرئيسية:
${reasons}`;
      const en = `Transaction ${t.id} for ${fmtCurrency(t.amount, "en")}:
- Legacy engine decision: ${dl(t.originalDecision)} (risk ${t.originalRiskScore})
- ZeRisk recommendation: ${dl(t.ai.recommendation)} (optimized ${t.ai.optimizedRiskScore})
- False-positive probability: ${t.ai.falsePositiveProbability}% — confidence ${t.ai.confidence}%
${t.isFalsePositive ? "This is a legitimate transaction that was set to be declined (false positive).\n" : ""}Key reasons:
${reasons}`;
      return {
        answer: A(ar, en, lang),
        followups: followupsFor("txn", lang),
        sources: [t.id, ...t.triggeredRuleIds],
      };
    }
    return {
      answer: A(`لم أعثر على العملية ${id} في مجموعة البيانات.`, `I couldn't find transaction ${id} in the dataset.`, lang),
      followups: followupsFor("default", lang),
      sources: [],
    };
  }

  // 2) Rule explanation ("explain FR-017")
  const ruleMatch = q.match(/FR-?\d{2,3}/i);
  if (ruleMatch) {
    const id = ruleMatch[0].toUpperCase().replace(/FR-?/, "FR-");
    const stat = stats.find((s) => s.rule.id === id);
    if (stat) {
      const r = stat.rule;
      const reco = RULE_RECO_LABEL[stat.recommendationKey][lang];
      const ar = `القاعدة ${r.id} — ${r.name}
${r.description}
- عدد مرات التفعيل: ${fmtNumber(stat.triggerCount)}
- احتيال مؤكد: ${fmtNumber(stat.confirmedFraud)} | رفض خاطئ: ${fmtNumber(stat.falsePositives)}
- الدقة: ${fmtPercent(stat.precision)} | معدل الرفض الخاطئ: ${fmtPercent(stat.falsePositiveRate)}
- الأثر المالي التقديري: ${fmtCurrency(stat.financialImpact, "ar")}
- توصية ZeRisk: ${reco}`;
      const en = `Rule ${r.id} — ${r.nameEn}
${r.descriptionEn}
- Trigger count: ${fmtNumber(stat.triggerCount)}
- Confirmed fraud: ${fmtNumber(stat.confirmedFraud)} | False positives: ${fmtNumber(stat.falsePositives)}
- Precision: ${fmtPercent(stat.precision)} | FP rate: ${fmtPercent(stat.falsePositiveRate)}
- Estimated financial impact: ${fmtCurrency(stat.financialImpact, "en")}
- ZeRisk recommendation: ${reco}`;
      return { answer: A(ar, en, lang), followups: followupsFor("rule", lang), sources: [r.id] };
    }
  }

  // 3) Highest false-positive rule
  if (/(highest|most|worst|top).*(false|positive|decline)|أعلى.*(رفض|خاطئ)|أكثر.*قاعدة/.test(lower) || /(أي|ما).*قاعدة.*رفض/.test(q)) {
    const top = stats[0];
    const ar = `القاعدة الأعلى تسببًا في الرفض الخاطئ هي ${top.rule.id} (${top.rule.name}) بعدد ${fmtNumber(top.falsePositives)} رفض خاطئ ودقة ${fmtPercent(top.precision)} فقط. التوصية: ${RULE_RECO_LABEL[top.recommendationKey].ar}.`;
    const en = `The rule causing the most false positives is ${top.rule.id} (${top.rule.nameEn}) with ${fmtNumber(top.falsePositives)} false positives and only ${fmtPercent(top.precision)} precision. Recommendation: ${RULE_RECO_LABEL[top.recommendationKey].en}.`;
    return { answer: A(ar, en, lang), followups: followupsFor("rule", lang), sources: [top.rule.id] };
  }

  // 4) High-value false positives
  if (/high.?value|large|عالي.*قيمة|كبير/.test(lower) && /false|positive|رفض|خاطئ/.test(lower)) {
    const fps = sampleFalsePositives(ds.transactions)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
    const lines = fps
      .map((t) => `- ${t.id}: ${fmtCurrency(t.amount, lang)} — ${t.customer[lang === "ar" ? "name" : "nameEn"]}`)
      .join("\n");
    return {
      answer: A(`أعلى عمليات الرفض الخاطئ قيمةً:\n${lines}`, `Highest-value false positives:\n${lines}`, lang),
      followups: followupsFor("txn", lang),
      sources: fps.map((t) => t.id),
    };
  }

  // 5) How much can we recover
  if (/recover|money|revenue|استرداد|إيراد|مبلغ|كم/.test(lower)) {
    const ar = `يمكن استرداد ما يقارب ${fmtNumber(k.recoveredTransactions)} عملية سليمة شهريًا بقيمة تقديرية ${fmtCurrency(k.revenueRecovered, "ar")}، مع توفير ${fmtCurrency(k.operationalCostSaved, "ar")} في تكلفة المراجعة اليدوية.`;
    const en = `We can recover about ${fmtNumber(k.recoveredTransactions)} legitimate transactions per month worth an estimated ${fmtCurrency(k.revenueRecovered, "en")}, plus ${fmtCurrency(k.operationalCostSaved, "en")} in manual-review savings.`;
    return { answer: A(ar, en, lang), followups: followupsFor("value", lang), sources: ["analytics/summary"] };
  }

  // 6) Suggest rule improvements
  if (/suggest|improve|optimi|تحسين|اقترح|حسّن/.test(lower)) {
    const top = stats.slice(0, 3);
    const lines = top
      .map((s) => `- ${s.rule.id}: ${RULE_RECO_LABEL[s.recommendationKey][lang]} (${fmtPercent(s.falsePositiveRate)} ${lang === "ar" ? "رفض خاطئ" : "FP rate"})`)
      .join("\n");
    return {
      answer: A(`أهم توصيات تحسين القواعد:\n${lines}`, `Top rule optimization recommendations:\n${lines}`, lang),
      followups: followupsFor("rule", lang),
      sources: top.map((s) => s.rule.id),
    };
  }

  // 7) Summarize today's activity / executive summary
  if (/summar|today|activity|executive|لخّص|لخص|اليوم|نشاط|تنفيذي/.test(lower)) {
    const fpCount = sampleFalsePositives(ds.transactions).length;
    const ar = `ملخص النشاط: تمت معالجة عيّنة من ${fmtNumber(ds.transactions.length)} عملية. اكتشفت المنصة ${fmtNumber(fpCount)} عملية رفض خاطئ ضمن العيّنة، ويُقدَّر على مستوى المحفظة استرداد ${fmtCurrency(k.revenueRecovered, "ar")} شهريًا مع خفض معدل الرفض الخاطئ من ${fmtPercent(k.fpRateBefore, 2)} إلى ${fmtPercent(k.fpRateAfter, 2)} والحفاظ على اكتشاف الاحتيال ضمن الحدود المعتمدة.`;
    const en = `Activity summary: processed a sample of ${fmtNumber(ds.transactions.length)} transactions. The platform flagged ${fmtNumber(fpCount)} false positives in the sample; at portfolio scale it recovers an estimated ${fmtCurrency(k.revenueRecovered, "en")} monthly while cutting the false-positive rate from ${fmtPercent(k.fpRateBefore, 2)} to ${fmtPercent(k.fpRateAfter, 2)} and keeping fraud detection within approved limits.`;
    return { answer: A(ar, en, lang), followups: followupsFor("value", lang), sources: ["analytics/summary"] };
  }

  // Default: capabilities
  const ar = `أنا مساعد الاحتيال الذكي. يمكنني الشرح والتلخيص والتوصية اعتمادًا على بيانات المنصة (لا أتخذ قرار الموافقة/الرفض النهائي). جرّب أن تسألني:
- لماذا رُفضت العملية TX-2026-000145؟
- اشرح القاعدة FR-017
- أي قاعدة تسبب أعلى رفض خاطئ؟
- كم المبلغ الذي يمكن استرداده؟`;
  const en = `I'm the Fraud AI Copilot. I explain, summarize and recommend using the platform's data (I never make the final approve/reject decision). Try asking:
- Why was transaction TX-2026-000145 rejected?
- Explain rule FR-017
- Which rule causes the highest false positives?
- How much money can we recover?`;
  return { answer: A(ar, en, lang), followups: followupsFor("default", lang), sources: [] };
}

function normalizeTxId(raw: string): string {
  const digits = raw.toUpperCase().replace(/[^0-9]/g, "");
  if (digits.length >= 7) return `TX-${digits.slice(0, 4)}-${digits.slice(4)}`;
  return raw.toUpperCase();
}

function followupsFor(kind: string, lang: Lang): string[] {
  const map: Record<string, [string, string][]> = {
    txn: [
      ["اشرح هذه العملية لمسؤول تنفيذي", "Explain this transaction to an executive"],
      ["أظهر عمليات مشابهة", "Show similar transactions"],
    ],
    rule: [
      ["حاكِ تعديل هذه القاعدة", "Simulate changing this rule"],
      ["أي قاعدة تسبب أعلى رفض خاطئ؟", "Which rule causes the highest false positives?"],
    ],
    value: [
      ["لخّص نشاط الاحتيال اليوم", "Summarize today's fraud activity"],
      ["اقترح تحسينات على القواعد", "Suggest rule improvements"],
    ],
    default: [
      ["كم المبلغ الذي يمكن استرداده؟", "How much money can we recover?"],
      ["اشرح القاعدة FR-017", "Explain rule FR-017"],
    ],
  };
  return (map[kind] ?? map.default).map(([ar, en]) => (lang === "ar" ? ar : en));
}
