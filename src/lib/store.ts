// ============================================================================
// ZeRisk — server-side runtime store.
//
// The deterministic dataset is the base; a module-level mutable overlay holds
// live demo mutations (investigator feedback, decision overrides, insight
// statuses, rule tweaks, settings, saved simulations, audit log). In the Next
// dev/single-process runtime this persists across requests so mutations update
// dashboards live. The Prisma seed mirrors the same base into SQLite.
// ============================================================================

import { generateDataset, type Dataset } from "./demo-data";
import { DEFAULT_ASSUMPTIONS } from "./financial";
import { DEFAULT_GOVERNANCE, type Governance } from "./scoring";
import type {
  EnrichedTransaction,
  FinancialAssumptions,
  InsightStatus,
  InvestigatorFeedback,
  RuleStatus,
} from "./types";

interface TxnOverlay {
  feedback?: InvestigatorFeedback;
  appliedDecision?: string;
}

interface AuditEntry {
  id: string;
  at: string;
  actor: string;
  action: string;
  detail: string;
}

interface Store {
  base: Dataset;
  txnOverlay: Map<string, TxnOverlay>;
  insightStatus: Map<string, InsightStatus>;
  ruleStatus: Map<string, RuleStatus>;
  governance: Governance;
  assumptions: FinancialAssumptions;
  audit: AuditEntry[];
  simulations: { id: string; at: string; ruleId: string; netBenefit: number; verdict: string }[];
  auditSeq: number;
}

// Persist across HMR reloads in dev via globalThis.
const g = globalThis as unknown as { __flStore?: Store };

function seedAudit(): AuditEntry[] {
  return [
    { id: "AUD-1001", at: new Date(Date.UTC(2026, 6, 17, 9, 12)).toISOString(), actor: "Fraud Manager", action: "RULE_REVIEW", detail: "راجعت أداء القاعدة FR-017" },
    { id: "AUD-1000", at: new Date(Date.UTC(2026, 6, 16, 15, 40)).toISOString(), actor: "Data Scientist", action: "MODEL_DEPLOY", detail: "نشر إصدار النموذج v2.4.1" },
    { id: "AUD-999", at: new Date(Date.UTC(2026, 6, 16, 11, 5)).toISOString(), actor: "Investigator", action: "FEEDBACK", detail: "تأكيد سلامة العملية TX-2026-000145" },
  ];
}

function init(): Store {
  return {
    base: generateDataset(),
    txnOverlay: new Map(),
    insightStatus: new Map(),
    ruleStatus: new Map(),
    governance: { ...DEFAULT_GOVERNANCE },
    assumptions: { ...DEFAULT_ASSUMPTIONS },
    audit: seedAudit(),
    simulations: [],
    auditSeq: 1002,
  };
}

function store(): Store {
  if (!g.__flStore) g.__flStore = init();
  return g.__flStore;
}

// ---- Reads -------------------------------------------------------------------

export function getDataset(): Dataset {
  const s = store();
  const transactions: EnrichedTransaction[] = s.base.transactions.map((t) => {
    const ov = s.txnOverlay.get(t.id);
    return ov?.feedback ? { ...t, feedback: ov.feedback } : t;
  });
  const insights = s.base.insights.map((i) => ({
    ...i,
    status: s.insightStatus.get(i.id) ?? i.status,
  }));
  const rules = s.base.rules.map((r) => ({
    ...r,
    status: s.ruleStatus.get(r.id) ?? r.status,
  }));
  return { ...s.base, transactions, insights, rules };
}

export function getTransaction(id: string): EnrichedTransaction | undefined {
  return getDataset().transactions.find((t) => t.id === id);
}

export function getGovernance(): Governance {
  return store().governance;
}

export function getAssumptions(): FinancialAssumptions {
  return store().assumptions;
}

export function getAudit(): AuditEntry[] {
  return store().audit;
}

export function getSimulations() {
  return store().simulations;
}

// ---- Mutations ---------------------------------------------------------------

function audit(actor: string, action: string, detail: string) {
  const s = store();
  s.audit.unshift({
    id: `AUD-${++s.auditSeq}`,
    at: new Date(Date.UTC(2026, 6, 17, 12, 0)).toISOString(),
    actor,
    action,
    detail,
  });
}

export function setFeedback(id: string, feedback: InvestigatorFeedback, actor = "Investigator") {
  const s = store();
  const ov = s.txnOverlay.get(id) ?? {};
  ov.feedback = feedback;
  s.txnOverlay.set(id, ov);
  audit(actor, "FEEDBACK", `${feedback.outcome} — ${id}`);
}

export function setAppliedDecision(id: string, decision: string, actor = "Fraud Manager") {
  const s = store();
  const ov = s.txnOverlay.get(id) ?? {};
  ov.appliedDecision = decision;
  s.txnOverlay.set(id, ov);
  audit(actor, "DECISION", `${decision} — ${id}`);
}

export function setInsightStatus(id: string, status: InsightStatus, actor = "Fraud Manager") {
  store().insightStatus.set(id, status);
  audit(actor, "INSIGHT", `${status} — ${id}`);
}

export function setRuleStatus(id: string, status: RuleStatus, actor = "Fraud Manager") {
  store().ruleStatus.set(id, status);
  audit(actor, "RULE_CHANGE", `${status} — ${id}`);
}

export function setGovernance(gov: Partial<Governance>, actor = "Administrator") {
  const s = store();
  s.governance = { ...s.governance, ...gov };
  audit(actor, "GOVERNANCE", `تحديث إعدادات الحوكمة`);
}

export function setAssumptions(a: Partial<FinancialAssumptions>) {
  const s = store();
  s.assumptions = { ...s.assumptions, ...a };
}

export function saveSimulation(ruleId: string, netBenefit: number, verdict: string, actor = "Fraud Manager") {
  const s = store();
  s.simulations.unshift({
    id: `SIM-${1000 + s.simulations.length}`,
    at: new Date(Date.UTC(2026, 6, 17, 12, 0)).toISOString(),
    ruleId,
    netBenefit,
    verdict,
  });
  audit(actor, "SIMULATION", `حفظ محاكاة للقاعدة ${ruleId}`);
}

export function resetDemo() {
  g.__flStore = init();
}
