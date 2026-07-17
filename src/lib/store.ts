// ============================================================================
// ZeRisk — server-side runtime store with the adaptive learning loop.
//
// Holds the deterministic base data + a mutable overlay (investigator labels,
// feedback, calibration, model versions, learning events, governance, etc.).
// Enrichment (scoring) is recomputed from the CURRENT labels + calibration, so
// investigator feedback and recalibration change results live. Memoized per
// revision for performance.
// ============================================================================

import { generateBase, type BaseDataset, DEMO_ID_LIST } from "./demo-data";
import { buildEnriched, type Dataset } from "./dataset";
import { computeProfiles, type LabelResolver, type Profiles } from "./profiles";
import {
  baselineCalibration, computeCalibration, nextVersion, diffCalibration, buildModelVersion,
} from "./learning";
import { computeKpis, confusionForDecision, generateInsights } from "./analytics";
import { DEFAULT_ASSUMPTIONS } from "./financial";
import { DEFAULT_GOVERNANCE, type Governance } from "./scoring";
import type {
  Calibration, EnrichedTransaction, FinancialAssumptions, Insight, InsightStatus,
  InvestigationOutcome, InvestigatorFeedback, KpiSnapshot, LearningChange, LearningEvent,
  ModelVersion, MvpEvidence, RuleStatus,
} from "./types";

const NOW = () => new Date(Date.UTC(2026, 6, 17, 12, 0)).toISOString();

interface AuditEntry { id: string; at: string; actor: string; action: string; detail: string; }

interface Cache {
  rev: number;
  transactions: EnrichedTransaction[];
  profiles: Profiles;
  kpis: KpiSnapshot;
  insights: Insight[];
}

interface Store {
  base: BaseDataset;
  labelOverlay: Map<string, InvestigationOutcome>;
  feedbackMap: Map<string, InvestigatorFeedback>;
  calibration: Calibration;
  lastCalibratedLabeledCount: number;
  modelVersions: ModelVersion[];
  learningEvents: LearningEvent[];
  insightStatus: Map<string, InsightStatus>;
  ruleStatus: Map<string, RuleStatus>;
  governance: Governance;
  assumptions: FinancialAssumptions;
  audit: AuditEntry[];
  simulations: { id: string; at: string; ruleId: string; netBenefit: number; verdict: string }[];
  auditSeq: number;
  eventSeq: number;
  rev: number;
  cache?: Cache;
}

const g = globalThis as unknown as { __zrStore?: Store };

function seedLabels(base: BaseDataset): Map<string, InvestigationOutcome> {
  // Seeded labels come from the raw transactions' `outcome`.
  const m = new Map<string, InvestigationOutcome>();
  for (const t of base.rawTransactions) if (t.outcome) m.set(t.id, t.outcome);
  return m;
}

function init(): Store {
  const base = generateBase();
  const labelOverlay = seedLabels(base);
  const label: LabelResolver = (id) => labelOverlay.get(id);
  const profiles0 = computeProfiles(base.rawTransactions, base.customers, base.devices, base.beneficiaries, base.rules, label);
  const v1 = nextVersion(baselineCalibration().version); // FL-MVP-1.1
  const calibration = computeCalibration(profiles0, v1, new Date(Date.UTC(2026, 6, 1)).toISOString());

  const mv0 = buildModelVersion(baselineCalibration().version, new Date(Date.UTC(2025, 7, 1)).toISOString(), 0, "System", "الإصدار الأساسي غير المعاير", { falsePositiveRate: 0, recall: 0, precision: 0, accuracy: 0 });
  const store: Store = {
    base, labelOverlay, feedbackMap: new Map(), calibration,
    lastCalibratedLabeledCount: profiles0.labeledCount,
    modelVersions: [mv0], learningEvents: [],
    insightStatus: new Map(), ruleStatus: new Map(),
    governance: { ...DEFAULT_GOVERNANCE }, assumptions: { ...DEFAULT_ASSUMPTIONS },
    audit: seedAudit(), simulations: [], auditSeq: 1002, eventSeq: 1, rev: 1,
  };
  // record the initial calibrated version metrics
  const enr = buildEnriched(base, calibration, store.governance, labelOverlay).transactions;
  const opt = confusionForDecision(enr, "ai");
  store.modelVersions.push(buildModelVersion(v1, new Date(Date.UTC(2026, 6, 1)).toISOString(), profiles0.labeledCount, "Data Scientist", "معايرة أولية من بيانات التسميات", { falsePositiveRate: opt.fpRate, recall: opt.recall, precision: opt.precision, accuracy: opt.accuracy }));
  return store;
}

function seedAudit(): AuditEntry[] {
  return [
    { id: "AUD-1001", at: new Date(Date.UTC(2026, 6, 17, 9, 12)).toISOString(), actor: "Fraud Manager", action: "RULE_REVIEW", detail: "راجعت أداء القاعدة FR-017" },
    { id: "AUD-1000", at: new Date(Date.UTC(2026, 6, 16, 15, 40)).toISOString(), actor: "Data Scientist", action: "MODEL_DEPLOY", detail: "نشر معايرة النموذج FL-MVP-1.1" },
  ];
}

function store(): Store {
  if (!g.__zrStore) g.__zrStore = init();
  return g.__zrStore;
}

function invalidate() { store().rev++; }

function enriched(): Cache {
  const s = store();
  if (s.cache && s.cache.rev === s.rev) return s.cache;
  const { transactions, profiles } = buildEnriched(s.base, s.calibration, s.governance, s.labelOverlay, s.feedbackMap);
  const kpis = computeKpis(transactions, s.assumptions);
  const insights = generateInsights(profiles, kpis, NOW());
  s.cache = { rev: s.rev, transactions, profiles, kpis, insights };
  return s.cache;
}

// ---- Reads -------------------------------------------------------------------

export function getDataset(): Dataset {
  const s = store();
  const c = enriched();
  const insights = c.insights.map((i) => ({ ...i, status: s.insightStatus.get(i.id) ?? i.status }));
  const rules = s.base.rules.map((r) => ({ ...r, status: s.ruleStatus.get(r.id) ?? r.status }));
  return {
    customers: s.base.customers, devices: s.base.devices, beneficiaries: s.base.beneficiaries,
    rules, transactions: c.transactions, insights, metrics: s.base.metrics, integrations: s.base.integrations,
  };
}

export function getTransaction(id: string): EnrichedTransaction | undefined {
  return enriched().transactions.find((t) => t.id === id);
}
export function getProfiles(): Profiles { return enriched().profiles; }
export function getKpis(): KpiSnapshot { return enriched().kpis; }
export function getCalibration(): Calibration { return store().calibration; }
export function getModelVersions(): ModelVersion[] { return store().modelVersions; }
export function getLearningEvents(): LearningEvent[] { return store().learningEvents; }
export function getGovernance(): Governance { return store().governance; }
export function getAssumptions(): FinancialAssumptions { return store().assumptions; }
export function getAudit(): AuditEntry[] { return store().audit; }
export function getSimulations() { return store().simulations; }

export function getEvidence(): MvpEvidence {
  const s = store();
  const c = enriched();
  const k = c.kpis;
  const orig = confusionForDecision(c.transactions, "original");
  const opt = confusionForDecision(c.transactions, "ai");
  const lastVersion = s.modelVersions[s.modelVersions.length - 1];
  return {
    transactionsAnalyzed: c.transactions.length,
    labeledOutcomes: c.profiles.labeledCount,
    learningEvents: s.learningEvents.length,
    modelVersion: s.calibration.version,
    originalFalsePositiveRate: orig.fpRate,
    optimizedFalsePositiveRate: opt.fpRate,
    originalRecall: orig.recall,
    optimizedRecall: opt.recall,
    manualReviewsReduced: k.manualReviewReductionPct,
    revenueRecovered: k.revenueRecovered,
    fraudExposureChange: k.fraudPrevented,
    lastRecalibrationAt: lastVersion.createdAt,
    falseNegativesCaught: k.falseNegativesCaught,
    demoTransactionsPresent: DEMO_ID_LIST.every((id) => s.base.rawTransactions.some((t) => t.id === id)),
    generatedAt: NOW(),
  };
}

// ---- Mutations ---------------------------------------------------------------

function audit(actor: string, action: string, detail: string) {
  const s = store();
  s.audit.unshift({ id: `AUD-${++s.auditSeq}`, at: NOW(), actor, action, detail });
}

export function setFeedback(id: string, feedback: InvestigatorFeedback, actor = "Investigator") {
  const s = store();
  const prev = getTransaction(id); // before mutation (uses current cache)
  const previousRecommendation = prev?.ai.recommendation;
  s.feedbackMap.set(id, feedback);
  if (feedback.outcome === "LEGITIMATE" || feedback.outcome === "CONFIRMED_FRAUD" || feedback.outcome === "INCONCLUSIVE") {
    s.labelOverlay.set(id, feedback.outcome);
  }
  invalidate();
  // learning event: which entity stats moved
  const dev = prev?.device.id;
  const affectedFeatures = prev ? [prev.device.known ? "TRUSTED_DEVICE" : "NEW_DEVICE", prev.beneficiary.known ? "KNOWN_BENEFICIARY" : "NEW_BENEFICIARY"] : [];
  const changes: LearningChange[] = [];
  if (prev && (feedback.outcome === "LEGITIMATE" || feedback.outcome === "CONFIRMED_FRAUD")) {
    const dir = feedback.outcome === "LEGITIMATE" ? "+1 سليمة" : "+1 احتيال";
    changes.push({ field: `device:${dev}`, before: "—", after: dir, ar: `تحديث إحصائيات الجهاز ${dev}`, en: `Device ${dev} statistics updated (${feedback.outcome})` });
  }
  addLearningEvent({
    transactionId: id, feedbackOutcome: feedback.outcome, previousRecommendation,
    finalOutcome: feedback.outcome, affectedRules: prev?.triggeredRuleIds ?? [],
    affectedFeatures, changes,
    ar: `سُجّلت التغذية الراجعة (${feedback.outcome}) للعملية ${id} وحُدّثت الإحصائيات المرتبطة.`,
    en: `Feedback (${feedback.outcome}) recorded for ${id}; related statistics updated.`,
    actor,
  });
  audit(actor, "FEEDBACK", `${feedback.outcome} — ${id}`);
}

function addLearningEvent(e: Omit<LearningEvent, "id" | "at" | "previousVersion" | "newVersion">) {
  const s = store();
  s.learningEvents.unshift({ ...e, id: `LRN-${s.eventSeq++}`, at: NOW(), previousVersion: s.calibration.version, newVersion: s.calibration.version });
}

export interface RecalibrationSummary {
  changed: boolean;
  previousVersion: string;
  newVersion: string;
  labeledCount: number;
  changes: LearningChange[];
  before: { fpRate: number; recall: number };
  after: { fpRate: number; recall: number };
}

export function recalibrate(actor = "Data Scientist"): RecalibrationSummary {
  const s = store();
  const before = enriched();
  const profiles = before.profiles;
  const prevCal = s.calibration;

  // Only recalibrate when new labels exist since last calibration.
  if (profiles.labeledCount <= s.lastCalibratedLabeledCount) {
    const optNow = confusionForDecision(before.transactions, "ai");
    return { changed: false, previousVersion: prevCal.version, newVersion: prevCal.version, labeledCount: profiles.labeledCount, changes: [], before: { fpRate: optNow.fpRate, recall: optNow.recall }, after: { fpRate: optNow.fpRate, recall: optNow.recall } };
  }

  const beforeConf = confusionForDecision(before.transactions, "ai");
  const newVersion = nextVersion(prevCal.version);
  const newCal = computeCalibration(profiles, newVersion, NOW());
  const changes = diffCalibration(prevCal, newCal);

  s.calibration = newCal;
  s.lastCalibratedLabeledCount = profiles.labeledCount;
  invalidate();

  const after = enriched();
  const afterConf = confusionForDecision(after.transactions, "ai");
  s.modelVersions.push(buildModelVersion(newVersion, NOW(), profiles.labeledCount, actor, "إعادة معايرة بناءً على تسميات جديدة", { falsePositiveRate: afterConf.fpRate, recall: afterConf.recall, precision: afterConf.precision, accuracy: afterConf.accuracy }));

  s.learningEvents.unshift({
    id: `LRN-${s.eventSeq++}`, affectedRules: Object.keys(newCal.ruleWeightAdjust),
    affectedFeatures: ["TRUSTED_DEVICE", "KNOWN_BENEFICIARY", "HIGH_VELOCITY"], changes,
    previousVersion: prevCal.version, newVersion, at: NOW(), actor,
    ar: `إعادة معايرة النموذج من ${prevCal.version} إلى ${newVersion} باستخدام ${profiles.labeledCount} تسمية.`,
    en: `Model recalibrated from ${prevCal.version} to ${newVersion} using ${profiles.labeledCount} labels.`,
  });
  audit(actor, "RECALIBRATE", `${prevCal.version} → ${newVersion}`);

  return {
    changed: true, previousVersion: prevCal.version, newVersion, labeledCount: profiles.labeledCount, changes,
    before: { fpRate: beforeConf.fpRate, recall: beforeConf.recall },
    after: { fpRate: afterConf.fpRate, recall: afterConf.recall },
  };
}

export function setInsightStatus(id: string, status: InsightStatus, actor = "Fraud Manager") {
  store().insightStatus.set(id, status);
  audit(actor, "INSIGHT", `${status} — ${id}`);
}
export function setRuleStatus(id: string, status: RuleStatus, actor = "Fraud Manager") {
  store().ruleStatus.set(id, status);
  invalidate();
  audit(actor, "RULE_CHANGE", `${status} — ${id}`);
}
export function setGovernance(gov: Partial<Governance>, actor = "Administrator") {
  const s = store();
  s.governance = { ...s.governance, ...gov };
  invalidate();
  audit(actor, "GOVERNANCE", "تحديث إعدادات الحوكمة");
}
export function setAssumptions(a: Partial<FinancialAssumptions>) {
  const s = store();
  s.assumptions = { ...s.assumptions, ...a };
  invalidate();
}
export function setAppliedDecision(id: string, decision: string, actor = "Fraud Manager") {
  audit(actor, "DECISION", `${decision} — ${id}`);
}
export function saveSimulation(ruleId: string, netBenefit: number, verdict: string, actor = "Fraud Manager") {
  const s = store();
  s.simulations.unshift({ id: `SIM-${1000 + s.simulations.length}`, at: NOW(), ruleId, netBenefit, verdict });
  audit(actor, "SIMULATION", `حفظ محاكاة للقاعدة ${ruleId}`);
}
export function resetDemo() { g.__zrStore = init(); }
