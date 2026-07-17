// ============================================================================
// ZeRisk — deterministic base dataset generator.
//
// Produces reproducible entities + RAW transactions (with ground truth + seeded
// investigator labels). AI enrichment/scoring is applied dynamically by the
// store (so investigator feedback + recalibration change results live). The
// Prisma seed mirrors this into SQLite.
// ============================================================================

import { Rng } from "./prng";
import type {
  Beneficiary,
  Channel,
  Customer,
  CustomerSegment,
  Device,
  FraudRule,
  Insight,
  Integration,
  InvestigationOutcome,
  MonthlyMetric,
  Region,
  ScenarioType,
  Transaction,
  TxnCategory,
} from "./types";

export const BASE_NOW = Date.UTC(2026, 6, 17, 12, 0, 0);
const DAY = 86400000;
const iso = (msAgo: number) => new Date(BASE_NOW - msAgo).toISOString();

// ---- Fixed demo transactions (presenter can always search these) ------------

export const DEMO_IDS = {
  falsePositive: "TX-DEMO-FP-001",
  confirmedFraud: "TX-DEMO-FRAUD-001",
  lowRisk: "TX-DEMO-LOW-001",
  review: "TX-DEMO-REVIEW-001",
  ruleFailure: "TX-DEMO-RULE-001",
  falseNegative: "TX-DEMO-FN-001",
  learn1: "TX-DEMO-LEARN-001",
  learn2: "TX-DEMO-LEARN-002",
};
// Back-compat for existing Demo Story page.
export const HERO_IDS = {
  falsePositive: DEMO_IDS.falsePositive,
  confirmedFraud: DEMO_IDS.confirmedFraud,
  lowRisk: DEMO_IDS.lowRisk,
  ambiguous: DEMO_IDS.review,
  ruleFailure: DEMO_IDS.ruleFailure,
};
export const DEMO_ID_LIST = Object.values(DEMO_IDS);
export const LEARN_DEVICE_ID = "DEV-LEARN-01";
export const LEARN_BEN_ID = "BEN-LEARN-01";

// ---- Fraud rules (15) --------------------------------------------------------

export function buildRules(): FraudRule[] {
  const r = (
    id: string, name: string, nameEn: string, description: string, descriptionEn: string,
    category: string, categoryEn: string, status: FraudRule["status"], severity: FraudRule["severity"],
    action: FraudRule["action"], weight: number, amountThreshold?: number,
  ): FraudRule => ({ id, name, nameEn, description, descriptionEn, category, categoryEn, status, severity, action, weight, amountThreshold });
  return [
    r("FR-011", "مبلغ مرتفع لشريحة العميل", "High amount for customer segment", "يُفعّل عند تجاوز المبلغ الحد المعتاد للشريحة.", "Triggers when amount exceeds the segment band.", "المبلغ", "Amount", "ACTIVE", "MEDIUM", "REVIEW", 18, 15000),
    r("FR-017", "جهاز جديد ومبلغ مرتفع", "New device and high amount", "يرفض العمليات من جهاز جديد بمبلغ مرتفع.", "Rejects high-amount transactions from a new device.", "الجهاز", "Device", "ACTIVE", "HIGH", "REJECT", 34, 5000),
    r("FR-019", "محاولات دخول فاشلة متعددة", "Multiple failed login attempts", "يُفعّل عند تكرار محاولات الدخول الفاشلة.", "Triggers on repeated failed logins.", "المصادقة", "Authentication", "ACTIVE", "HIGH", "REVIEW", 28),
    r("FR-023", "أول تحويل لمستفيد دولي", "First transfer to international beneficiary", "يراجع أول تحويل لمستفيد دولي جديد.", "Reviews first transfer to a new international beneficiary.", "المستفيد", "Beneficiary", "ACTIVE", "MEDIUM", "REVIEW", 22),
    r("FR-024", "عملية خارج الأوقات الاعتيادية", "Transaction outside normal time", "يرفض العمليات خارج نمط أوقات العميل.", "Rejects transactions outside the customer's usual time.", "السلوك", "Behavior", "ACTIVE", "MEDIUM", "REJECT", 24),
    r("FR-028", "سرعة عمليات مرتفعة", "High transaction velocity", "يُفعّل عند تنفيذ عدة عمليات خلال فترة قصيرة.", "Triggers on many transactions in a short window.", "السرعة", "Velocity", "ACTIVE", "HIGH", "REVIEW", 30),
    r("FR-031", "مستفيد جديد بمبلغ مرتفع", "High-value new beneficiary", "يرفض التحويلات الكبيرة لمستفيد جديد.", "Rejects large transfers to a brand-new beneficiary.", "المستفيد", "Beneficiary", "ACTIVE", "HIGH", "REJECT", 32, 10000),
    r("FR-033", "موقع غير معتاد", "Unfamiliar location", "يُفعّل عند تنفيذ العملية من موقع غير معتاد.", "Triggers when the location is unfamiliar.", "الموقع", "Location", "ACTIVE", "MEDIUM", "REVIEW", 20),
    r("FR-042", "نشاط مفاجئ على حساب خامل", "Sudden activity on dormant account", "يراقب النشاط المفاجئ بعد خمول.", "Monitors sudden activity after dormancy.", "السلوك", "Behavior", "MONITORING", "LOW", "MONITOR", 12),
    r("FR-047", "مبلغ أسفل حد الإبلاغ", "Amount just below reporting threshold", "يراقب المبالغ القريبة من حد الإبلاغ.", "Monitors amounts near the reporting threshold.", "الامتثال", "Compliance", "ACTIVE", "MEDIUM", "MONITOR", 16),
    r("FR-052", "جهاز مشترك بين عدة عملاء", "Device shared across customers", "يُفعّل عند استخدام جهاز من قبل عملاء متعددين.", "Triggers when a device is used by multiple customers.", "الجهاز", "Device", "ACTIVE", "HIGH", "REVIEW", 26),
    r("FR-058", "تجزئة مبالغ لمستفيدين جدد", "Structuring to new beneficiaries", "يُفعّل عند تحويلات صغيرة متعددة لمستفيدين جدد.", "Triggers on many small transfers to new beneficiaries.", "غسل أموال", "AML", "ACTIVE", "HIGH", "REVIEW", 30),
    r("FR-063", "تحويل بعد إعادة تعيين كلمة المرور", "Transfer after password reset", "يُفعّل عند التحويل بعد إعادة تعيين كلمة المرور مباشرة.", "Triggers when a transfer follows a recent password reset.", "المصادقة", "Authentication", "ACTIVE", "HIGH", "REVIEW", 28),
    r("FR-070", "شذوذ في صرف القروض", "Loan disbursement anomaly", "يراقب أنماط صرف القروض غير المعتادة.", "Monitors unusual loan disbursement patterns.", "القروض", "Lending", "MONITORING", "MEDIUM", "MONITOR", 18),
    r("FR-075", "تحويل دولي عالي القيمة", "High-value international transfer", "يراجع التحويلات الدولية عالية القيمة.", "Reviews high-value international transfers.", "المستفيد", "Beneficiary", "ACTIVE", "MEDIUM", "REVIEW", 22, 20000),
    r("FR-081", "فشل التحقق الثنائي", "MFA failure", "يُفعّل عند فشل التحقق الثنائي قبل العملية.", "Triggers when MFA fails before the transaction.", "المصادقة", "Authentication", "ACTIVE", "HIGH", "REVIEW", 30),
  ];
}

// ---- Reference pools ---------------------------------------------------------

const AR_FIRST = ["محمد","أحمد","عبدالله","خالد","سعد","فيصل","نورة","سارة","ريم","لطيفة","هند","عبدالعزيز","بندر","ماجد","تركي","أمل","منى","دانة","يوسف","عمر","ناصر","سلطان","وليد","غادة","رغد","لمياء","فهد","مشعل","سلمى","جواهر"];
const AR_LAST = ["الشمري","القحطاني","العتيبي","الغامدي","الحربي","الدوسري","المطيري","الزهراني","السبيعي","البلوي","العنزي","الشهري","الرشيدي","المالكي","الحارثي","العمري"];
const EN_FIRST = ["Mohammed","Ahmed","Abdullah","Khalid","Saad","Faisal","Noura","Sara","Reem","Latifah","Hind","Abdulaziz","Bandar","Majed","Turki","Amal","Mona","Dana","Youssef","Omar","Nasser","Sultan","Waleed","Ghada","Raghad","Lamia","Fahad","Mishal","Salma","Jawaher"];
const EN_LAST = ["Al-Shammari","Al-Qahtani","Al-Otaibi","Al-Ghamdi","Al-Harbi","Al-Dosari","Al-Mutairi","Al-Zahrani","Al-Subaie","Al-Balawi","Al-Anazi","Al-Shehri","Al-Rashidi","Al-Maliki","Al-Harthy","Al-Omari"];
const REGIONS: Region[] = ["RIYADH","MAKKAH","EASTERN","MADINAH","QASSIM","ASIR"];
const REGION_CITY: Record<Region, [string, string]> = {
  RIYADH: ["الرياض","Riyadh"], MAKKAH: ["جدة","Jeddah"], EASTERN: ["الدمام","Dammam"],
  MADINAH: ["المدينة","Madinah"], QASSIM: ["بريدة","Buraidah"], ASIR: ["أبها","Abha"],
};
const BANKS = ["Al Rajhi Bank","SNB","Riyad Bank","SABB","Bank Albilad","Alinma Bank","Bank Aljazira","Wise (Intl)","Revolut (Intl)"];

const SEGMENTS: CustomerSegment[] = ["RETAIL","SME","PREMIUM","NEW_CUSTOMER","LONG_TERM_CUSTOMER","HIGH_VALUE_CUSTOMER"];
const SEG_AVG: Record<CustomerSegment, number> = {
  RETAIL: 2600, SME: 15000, PREMIUM: 9000, NEW_CUSTOMER: 1800, LONG_TERM_CUSTOMER: 6000, HIGH_VALUE_CUSTOMER: 42000,
};

export function buildCustomers(rng: Rng): Customer[] {
  const out: Customer[] = [];
  for (let i = 0; i < 150; i++) {
    const fi = rng.int(0, AR_FIRST.length - 1);
    const li = rng.int(0, AR_LAST.length - 1);
    const region = rng.pick(REGIONS);
    const segment = rng.weighted(SEGMENTS, [42, 16, 14, 10, 12, 6]);
    const avgBase = SEG_AVG[segment];
    const age =
      segment === "NEW_CUSTOMER" ? rng.int(1, 6) :
      segment === "LONG_TERM_CUSTOMER" ? rng.int(60, 140) :
      segment === "HIGH_VALUE_CUSTOMER" ? rng.int(36, 160) : rng.int(6, 96);
    const avg = Math.round(avgBase * rng.range(0.75, 1.35));
    const hs = rng.int(6, 11);
    out.push({
      id: `CUS-${8400 + i}`,
      name: `${AR_FIRST[fi]} ${AR_LAST[li]}`,
      nameEn: `${EN_FIRST[fi]} ${EN_LAST[li]}`,
      nationalIdMasked: `1${rng.int(0, 9)}••••••${rng.int(10, 99)}`,
      segment,
      accountAgeMonths: age,
      avgTxnAmount: avg,
      amountStdDev: Math.round(avg * rng.range(0.18, 0.4)),
      txnCount30d: rng.int(6, 90),
      homeCity: REGION_CITY[region][0],
      homeCityEn: REGION_CITY[region][1],
      region,
      normalHourStart: hs,
      normalHourEnd: rng.int(19, 23),
      trustScore: segment === "NEW_CUSTOMER" ? rng.int(45, 70) : rng.int(62, 97),
    });
  }
  return out;
}

const DEVICE_TYPES = ["MOBILE_IOS","MOBILE_ANDROID","DESKTOP","TABLET"] as const;
const DEVICE_LABELS: Record<string, string> = { MOBILE_IOS: "iPhone", MOBILE_ANDROID: "Android", DESKTOP: "Desktop", TABLET: "iPad" };

export function buildDevices(rng: Rng): Device[] {
  const out: Device[] = [];
  // Learning-scenario device: semi-known, few transactions (so it starts moderate).
  out.push({ id: LEARN_DEVICE_ID, type: "MOBILE_IOS", label: "iPhone ••LR", known: true, firstSeenDaysAgo: 40, txnCount: 4, trustScore: 52 });
  for (let i = 0; i < 165; i++) {
    const t = rng.pick(DEVICE_TYPES);
    const txn = rng.int(15, 260);
    out.push({ id: `DEV-${1000 + i}`, type: t, label: `${DEVICE_LABELS[t]} ••${rng.int(10, 99)}`, known: true, firstSeenDaysAgo: rng.int(45, 1100), txnCount: txn, trustScore: Math.min(98, 58 + Math.round(txn * 0.18)) });
  }
  for (let i = 0; i < 54; i++) {
    const t = rng.pick(DEVICE_TYPES);
    out.push({ id: `DEV-${2000 + i}`, type: t, label: `${DEVICE_LABELS[t]} ••${rng.int(10, 99)}`, known: false, firstSeenDaysAgo: rng.int(0, 3), txnCount: rng.int(0, 3), trustScore: rng.int(6, 32) });
  }
  return out;
}

const BEN_TYPES = ["INTERNAL","EXTERNAL","INTERNATIONAL","WALLET"] as const;

export function buildBeneficiaries(rng: Rng): Beneficiary[] {
  const out: Beneficiary[] = [];
  // Learning-scenario beneficiary: new (no history) so its trust is learned.
  out.push({ id: LEARN_BEN_ID, name: "شركة التوريدات المتحدة", nameEn: "United Supplies Co.", bank: "Al Rajhi Bank", type: "EXTERNAL", known: false, txnCount: 0, firstSeenDaysAgo: 2, trustScore: 22 });
  for (let i = 0; i < 210; i++) {
    const fi = rng.int(0, AR_FIRST.length - 1);
    const txn = rng.int(4, 60);
    out.push({ id: `BEN-${500 + i}`, name: `${AR_FIRST[fi]} ${rng.pick(AR_LAST)}`, nameEn: `${EN_FIRST[fi]} ${rng.pick(EN_LAST)}`, bank: rng.pick(BANKS), type: rng.weighted(BEN_TYPES, [40, 34, 12, 14]), known: true, txnCount: txn, firstSeenDaysAgo: rng.int(40, 900), trustScore: Math.min(96, 52 + Math.round(txn)) });
  }
  for (let i = 0; i < 90; i++) {
    const fi = rng.int(0, AR_FIRST.length - 1);
    out.push({ id: `BEN-${900 + i}`, name: `${AR_FIRST[fi]} ${rng.pick(AR_LAST)}`, nameEn: `${EN_FIRST[fi]} ${rng.pick(EN_LAST)}`, bank: rng.pick(BANKS), type: rng.weighted(BEN_TYPES, [10, 30, 40, 20]), known: false, txnCount: rng.int(0, 1), firstSeenDaysAgo: rng.int(0, 4), trustScore: rng.int(6, 28) });
  }
  return out;
}

const CHANNELS: Channel[] = ["MOBILE_APP","WEB","POS","ATM","INTERNAL_TRANSFER","VIBAN_CREDIT","LOAN_REPAYMENT","LOAN_DISBURSEMENT","WALLET_TRANSFER"];
const CATEGORIES: TxnCategory[] = ["TRANSFER","PAYMENT","SUPPLIER","SALARY","LOAN","PURCHASE","WALLET"];

// ---- Legacy engine (deliberately over-penalizes + misses some fraud) --------

function legacyEvaluate(
  amount: number, customerAvg: number, deviceKnown: boolean, beneficiaryKnown: boolean,
  failedLogins: number, timeFamiliar: boolean, locationFamiliar: boolean, rules: FraudRule[],
  forceMiss: boolean,
): { score: number; decision: Transaction["originalDecision"] } {
  let score = 16;
  for (const r of rules) score += r.weight * 0.9;
  const ratio = amount / Math.max(customerAvg, 1);
  if (ratio > 1.2) score += Math.min(30, (ratio - 1) * 26);
  if (!deviceKnown) score += 12;
  if (!beneficiaryKnown) score += 10;
  score += Math.min(failedLogins, 6) * 5;
  if (!timeFamiliar) score += 8;
  if (!locationFamiliar) score += 9;
  score = Math.max(3, Math.min(99, Math.round(score)));
  // False negatives: legacy misses structuring / low-amount fraud → approves.
  if (forceMiss) return { score: Math.min(score, 30), decision: "APPROVE" };
  const hasReject = rules.some((r) => r.action === "REJECT");
  const hasReview = rules.some((r) => r.action === "REVIEW");
  let decision: Transaction["originalDecision"];
  if (score >= 78 || (hasReject && score >= 60)) decision = "REJECT";
  else if (score >= 56 || hasReview) decision = "REVIEW";
  else if (score >= 38) decision = "MONITOR";
  else decision = "APPROVE";
  return { score, decision };
}

interface Signals {
  deviceKnown: boolean; beneficiaryKnown: boolean; mfaPassed: boolean; failedLogins: number;
  velocity1h: number; timeFamiliar: boolean; locationFamiliar: boolean; passwordReset: boolean;
  amountRatio: [number, number]; ruleIds: string[]; isFraud: boolean; forceMiss: boolean;
  sharedDevice?: boolean;
}

function scenarioSignals(s: ScenarioType, rng: Rng): Signals {
  switch (s) {
    case "FALSE_POSITIVE":
      return { deviceKnown: true, beneficiaryKnown: true, mfaPassed: true, failedLogins: 0, velocity1h: rng.int(1, 2), timeFamiliar: false, locationFamiliar: true, passwordReset: false, amountRatio: [1.3, 2.2], ruleIds: rng.pick([["FR-017", "FR-024"], ["FR-017"], ["FR-024", "FR-011"]]), isFraud: false, forceMiss: false };
    case "CONFIRMED_FRAUD":
      return { deviceKnown: false, beneficiaryKnown: false, mfaPassed: rng.chance(0.35), failedLogins: rng.int(2, 7), velocity1h: rng.int(5, 10), timeFamiliar: false, locationFamiliar: false, passwordReset: rng.chance(0.5), amountRatio: [1.8, 3.4], ruleIds: rng.pick([["FR-028", "FR-033", "FR-019"], ["FR-031", "FR-033"], ["FR-063", "FR-081"]]), isFraud: true, forceMiss: false };
    case "FALSE_NEGATIVE":
      return { deviceKnown: false, beneficiaryKnown: false, mfaPassed: true, failedLogins: 0, velocity1h: rng.int(6, 11), timeFamiliar: true, locationFamiliar: true, passwordReset: false, amountRatio: [0.15, 0.5], ruleIds: rng.chance(0.5) ? ["FR-058"] : [], isFraud: true, forceMiss: true, sharedDevice: true };
    case "LOW_RISK":
      return { deviceKnown: true, beneficiaryKnown: true, mfaPassed: true, failedLogins: 0, velocity1h: 1, timeFamiliar: true, locationFamiliar: true, passwordReset: false, amountRatio: [0.4, 1.05], ruleIds: [], isFraud: false, forceMiss: false };
    case "AMBIGUOUS":
      return { deviceKnown: true, beneficiaryKnown: false, mfaPassed: true, failedLogins: 0, velocity1h: rng.int(1, 3), timeFamiliar: rng.chance(0.5), locationFamiliar: true, passwordReset: false, amountRatio: [1.2, 1.7], ruleIds: rng.pick([["FR-031"], ["FR-023"], ["FR-031", "FR-047"]]), isFraud: rng.chance(0.06), forceMiss: false };
    case "RULE_FAILURE":
      return { deviceKnown: true, beneficiaryKnown: true, mfaPassed: true, failedLogins: 0, velocity1h: 1, timeFamiliar: true, locationFamiliar: true, passwordReset: false, amountRatio: [1.9, 3.0], ruleIds: rng.pick([["FR-031"], ["FR-011", "FR-031"]]), isFraud: false, forceMiss: false };
    default:
      return { deviceKnown: rng.chance(0.9), beneficiaryKnown: rng.chance(0.85), mfaPassed: rng.chance(0.97), failedLogins: rng.chance(0.08) ? 1 : 0, velocity1h: rng.int(1, 3), timeFamiliar: rng.chance(0.85), locationFamiliar: rng.chance(0.9), passwordReset: false, amountRatio: [0.5, 1.25], ruleIds: rng.chance(0.22) ? [rng.pick(["FR-042", "FR-047", "FR-011"])] : [], isFraud: rng.chance(0.012), forceMiss: false };
  }
}

// scenario plan for the ~1490 generated (non-demo) transactions
function scenarioPlan(): ScenarioType[] {
  const push = (s: ScenarioType, n: number) => Array<ScenarioType>(n).fill(s);
  return [
    ...push("LOW_RISK", 762),
    ...push("NORMAL", 320),
    ...push("FALSE_POSITIVE", 210),
    ...push("AMBIGUOUS", 90),
    ...push("RULE_FAILURE", 45),
    ...push("CONFIRMED_FRAUD", 40),
    ...push("FALSE_NEGATIVE", 25),
  ];
}

function pickCategory(channel: Channel, rng: Rng): TxnCategory {
  if (channel === "LOAN_DISBURSEMENT" || channel === "LOAN_REPAYMENT") return "LOAN";
  if (channel === "WALLET_TRANSFER") return "WALLET";
  if (channel === "POS") return "PURCHASE";
  return rng.pick(CATEGORIES);
}

function outcomeFor(isFraud: boolean, scenario: ScenarioType, labeled: boolean, rng: Rng): InvestigationOutcome | undefined {
  if (!labeled) return undefined;
  if (isFraud) return "CONFIRMED_FRAUD";
  if (scenario === "AMBIGUOUS" && rng.chance(0.35)) return "INCONCLUSIVE";
  return "LEGITIMATE";
}

export function buildRawTransactions(
  rng: Rng, customers: Customer[], devices: Device[], beneficiaries: Beneficiary[], rules: FraudRule[],
): Transaction[] {
  const ruleById = new Map(rules.map((r) => [r.id, r]));
  const knownDevices = devices.filter((d) => d.known && d.id !== LEARN_DEVICE_ID);
  const newDevices = devices.filter((d) => !d.known);
  const knownBens = beneficiaries.filter((b) => b.known);
  const newBens = beneficiaries.filter((b) => !b.known);

  const out: Transaction[] = [];

  // --- fixed demo transactions ---
  out.push(...demoTransactions(customers, devices, beneficiaries));

  const plan = deterministicShuffle(scenarioPlan(), rng);
  let seq = 1;
  for (let i = 0; i < plan.length; i++) {
    const scenario = plan[i];
    const s = scenarioSignals(scenario, rng);
    const customer =
      scenario === "RULE_FAILURE" ? pickSeg(customers, ["SME", "LONG_TERM_CUSTOMER", "HIGH_VALUE_CUSTOMER"], rng)
      : rng.pick(customers);
    const device = s.deviceKnown ? rng.pick(knownDevices) : rng.pick(newDevices);
    const beneficiary = s.beneficiaryKnown ? rng.pick(knownBens) : rng.pick(newBens);
    const triggered = s.ruleIds.map((id) => ruleById.get(id)!).filter(Boolean);
    const amount = Math.max(50, Math.round(customer.avgTxnAmount * rng.range(s.amountRatio[0], s.amountRatio[1]) / 10) * 10);
    const daysAgo = rng.int(0, 179);
    const hour = s.timeFamiliar ? rng.int(customer.normalHourStart, customer.normalHourEnd) : rng.pick([1, 2, 3, 4, 23, 0]);
    const ts = daysAgo * DAY + (24 - hour) * 3600000 + rng.int(0, 59) * 60000;
    const legacy = legacyEvaluate(amount, customer.avgTxnAmount, s.deviceKnown, s.beneficiaryKnown, s.failedLogins, s.timeFamiliar, s.locationFamiliar, triggered, s.forceMiss);
    const channel = pickChannel(scenario, rng);
    const labeled = rng.chance(0.67); // ~1000 labeled outcomes
    out.push({
      id: `TX-2026-${String(1000 + seq++).padStart(6, "0")}`,
      customerId: customer.id, amount, currency: "SAR", channel, category: pickCategory(channel, rng),
      deviceId: device.id, beneficiaryId: beneficiary.id, region: customer.region,
      timestamp: iso(ts), hour, originalDecision: legacy.decision, originalRiskScore: legacy.score,
      triggeredRuleIds: triggered.map((r) => r.id), mfaPassed: s.mfaPassed, failedLogins: s.failedLogins,
      velocity1h: s.velocity1h, passwordResetRecently: s.passwordReset, locationFamiliar: s.locationFamiliar,
      timeFamiliar: s.timeFamiliar, isActuallyFraud: s.isFraud, outcome: outcomeFor(s.isFraud, scenario, labeled, rng),
      scenario, processingTimeMs: 0,
    });
  }
  return out;
}

function pickChannel(scenario: ScenarioType, rng: Rng): Channel {
  if (scenario === "CONFIRMED_FRAUD" || scenario === "FALSE_NEGATIVE")
    return rng.weighted(CHANNELS, [26, 20, 3, 4, 16, 10, 2, 3, 16]);
  return rng.weighted(CHANNELS, [34, 16, 12, 8, 12, 6, 5, 3, 4]);
}
function pickSeg(customers: Customer[], segs: CustomerSegment[], rng: Rng): Customer {
  const pool = customers.filter((c) => segs.includes(c.segment));
  return pool.length ? rng.pick(pool) : rng.pick(customers);
}
function deterministicShuffle<T>(arr: readonly T[], rng: Rng): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = rng.int(0, i); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// ---- Fixed demo transactions -------------------------------------------------

function demoTransactions(customers: Customer[], devices: Device[], beneficiaries: Beneficiary[]): Transaction[] {
  const premium = customers.find((c) => c.segment === "HIGH_VALUE_CUSTOMER") ?? customers.find((c) => c.segment === "LONG_TERM_CUSTOMER") ?? customers[0];
  const sme = customers.find((c) => c.segment === "SME") ?? customers[1];
  const retails = customers.filter((c) => c.segment === "RETAIL");
  // distinct customers so one demo's fraud doesn't pollute another's history
  const fraudCust = retails[0] ?? customers[2];
  const lowCust = retails[1] ?? customers[3];
  const fnCust = retails[2] ?? customers[4];
  const learnCust = customers.find((c) => c.segment === "NEW_CUSTOMER") ?? retails[3] ?? customers[5];
  const trusted = devices.find((d) => d.known && d.txnCount > 100) ?? devices[1];
  const trusted2 = devices.find((d) => d.known && d.id !== trusted.id && d.txnCount > 60) ?? devices[2];
  const newDev = devices.find((d) => !d.known)!;
  const newDev2 = devices.find((d) => !d.known && d.id !== newDev.id)!;
  const knownBen = beneficiaries.find((b) => b.known && b.txnCount > 15) ?? beneficiaries[0];
  const newBen = beneficiaries.find((b) => !b.known && b.id !== LEARN_BEN_ID)!;
  const newBen2 = beneficiaries.find((b) => !b.known && b.id !== newBen.id && b.id !== LEARN_BEN_ID)!;
  const learnDev = devices.find((d) => d.id === LEARN_DEVICE_ID)!;
  const learnBen = beneficiaries.find((b) => b.id === LEARN_BEN_ID)!;

  const t = (o: Partial<Transaction> & Pick<Transaction, "id" | "customerId" | "amount" | "deviceId" | "beneficiaryId" | "originalDecision" | "originalRiskScore" | "triggeredRuleIds" | "isActuallyFraud" | "scenario">): Transaction => ({
    currency: "SAR", channel: "MOBILE_APP", category: "TRANSFER", region: "RIYADH", hour: 14,
    timestamp: iso(2 * DAY), mfaPassed: true, failedLogins: 0, velocity1h: 1, passwordResetRecently: false,
    locationFamiliar: true, timeFamiliar: true, processingTimeMs: 0, ...o,
  });

  return [
    t({ id: DEMO_IDS.falsePositive, customerId: premium.id, amount: 18500, deviceId: trusted.id, beneficiaryId: knownBen.id, region: premium.region, hour: 2, timeFamiliar: false, originalDecision: "REJECT", originalRiskScore: 86, triggeredRuleIds: ["FR-017", "FR-024"], isActuallyFraud: false, outcome: "LEGITIMATE", scenario: "FALSE_POSITIVE", category: "TRANSFER" }),
    t({ id: DEMO_IDS.confirmedFraud, customerId: fraudCust.id, amount: 24900, deviceId: newDev.id, beneficiaryId: newBen.id, region: "ASIR", hour: 3, mfaPassed: false, failedLogins: 7, velocity1h: 9, passwordResetRecently: true, locationFamiliar: false, timeFamiliar: false, originalDecision: "REVIEW", originalRiskScore: 74, triggeredRuleIds: ["FR-019", "FR-033", "FR-063", "FR-081"], isActuallyFraud: true, outcome: "CONFIRMED_FRAUD", scenario: "CONFIRMED_FRAUD", channel: "WEB", category: "TRANSFER" }),
    t({ id: DEMO_IDS.lowRisk, customerId: lowCust.id, amount: 420, deviceId: trusted2.id, beneficiaryId: knownBen.id, region: lowCust.region, hour: 13, originalDecision: "APPROVE", originalRiskScore: 12, triggeredRuleIds: [], isActuallyFraud: false, outcome: "LEGITIMATE", scenario: "LOW_RISK", channel: "POS", category: "PURCHASE" }),
    t({ id: DEMO_IDS.review, customerId: premium.id, amount: 7900, deviceId: trusted.id, beneficiaryId: newBen2.id, region: premium.region, hour: 15, originalDecision: "REVIEW", originalRiskScore: 58, triggeredRuleIds: ["FR-031"], isActuallyFraud: false, outcome: undefined, scenario: "AMBIGUOUS", category: "TRANSFER" }),
    t({ id: DEMO_IDS.ruleFailure, customerId: sme.id, amount: 52000, deviceId: trusted.id, beneficiaryId: newBen.id, region: sme.region, hour: 11, originalDecision: "REJECT", originalRiskScore: 82, triggeredRuleIds: ["FR-031"], isActuallyFraud: false, outcome: "LEGITIMATE", scenario: "RULE_FAILURE", channel: "INTERNAL_TRANSFER", category: "SUPPLIER" }),
    t({ id: DEMO_IDS.falseNegative, customerId: fnCust.id, amount: 950, deviceId: newDev2.id, beneficiaryId: newBen2.id, region: "EASTERN", hour: 14, velocity1h: 9, originalDecision: "APPROVE", originalRiskScore: 26, triggeredRuleIds: ["FR-058"], isActuallyFraud: true, outcome: "CONFIRMED_FRAUD", scenario: "FALSE_NEGATIVE", channel: "WALLET_TRANSFER", category: "WALLET" }),
    // learning pair — a NEW customer, a NEW beneficiary and a semi-known device,
    // so it starts borderline; confirming LEARN-001 as legitimate lowers LEARN-002.
    t({ id: DEMO_IDS.learn1, customerId: learnCust.id, amount: 4600, deviceId: learnDev.id, beneficiaryId: learnBen.id, region: learnCust.region, hour: 1, timeFamiliar: false, originalDecision: "REJECT", originalRiskScore: 72, triggeredRuleIds: ["FR-024", "FR-031"], isActuallyFraud: false, outcome: undefined, scenario: "FALSE_POSITIVE", category: "SUPPLIER", channel: "INTERNAL_TRANSFER" }),
    t({ id: DEMO_IDS.learn2, customerId: learnCust.id, amount: 4800, deviceId: learnDev.id, beneficiaryId: learnBen.id, region: learnCust.region, hour: 1, timeFamiliar: false, originalDecision: "REJECT", originalRiskScore: 73, triggeredRuleIds: ["FR-024", "FR-031"], isActuallyFraud: false, outcome: undefined, scenario: "FALSE_POSITIVE", category: "SUPPLIER", channel: "INTERNAL_TRANSFER" }),
  ];
}

// ---- Monthly metrics (12 months) --------------------------------------------

const MONTH_LABELS = ["أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر","يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو"];
const MONTH_KEYS = ["2025-08","2025-09","2025-10","2025-11","2025-12","2026-01","2026-02","2026-03","2026-04","2026-05","2026-06","2026-07"];

export function buildMonthlyMetrics(rng: Rng): MonthlyMetric[] {
  const out: MonthlyMetric[] = [];
  for (let i = 0; i < 12; i++) {
    const p = i / 11;
    const total = 980000 + Math.round(p * 270000) + rng.int(-15000, 15000);
    const fpBefore = 2.6 - p * 0.1 + rng.range(-0.05, 0.05);
    const fpAfter = 2.45 - p * 1.28 + rng.range(-0.04, 0.04);
    const recovered = Math.round((total * (fpBefore - fpAfter)) / 100 * 0.62);
    out.push({
      month: MONTH_KEYS[i], label: MONTH_LABELS[i], totalTransactions: total,
      fpRateBefore: +fpBefore.toFixed(2), fpRateAfter: +Math.max(0.9, fpAfter).toFixed(2),
      recoveredTransactions: recovered, revenueRecovered: recovered * 140,
      fraudPrevented: 2100000 + Math.round(p * 900000) + rng.int(-80000, 80000),
      manualReviews: Math.round(24000 - p * 6000 + rng.int(-600, 600)),
      manualReviewsReduced: Math.round(p * 6200 + rng.int(-200, 200)),
      customerFriction: +(48 - p * 22 + rng.range(-1, 1)).toFixed(1),
      accuracy: +(88 + p * 6 + rng.range(-0.6, 0.6)).toFixed(1),
      precision: +(83 + p * 8 + rng.range(-0.6, 0.6)).toFixed(1),
      recall: +(90 + p * 3.5 + rng.range(-0.5, 0.5)).toFixed(1),
      falseNegativeRate: +(2.4 - p * 0.9 + rng.range(-0.1, 0.1)).toFixed(2),
      drift: +Math.max(0, 0.22 - p * 0.14 + rng.range(-0.02, 0.03)).toFixed(3),
    });
  }
  return out;
}

// ---- Integrations ------------------------------------------------------------

export function buildIntegrations(rng: Rng): Integration[] {
  const defs: [string, string, string, string, boolean][] = [
    ["IBM Safer Payments","IBM Safer Payments","محرك احتيال","Fraud Engine",true],
    ["SAS Fraud Management","SAS Fraud Management","محرك احتيال","Fraud Engine",true],
    ["Feedzai","Feedzai","محرك احتيال","Fraud Engine",false],
    ["النظام البنكي الأساسي","Core Banking","أنظمة أساسية","Core",true],
    ["بوابة المدفوعات","Payment Gateway","مدفوعات","Payments",true],
    ["تطبيق الجوال","Mobile App","قنوات","Channels",true],
    ["المحفظة الرقمية","Digital Wallet","قنوات","Channels",true],
    ["منصة بيانات العملاء","Customer Data Platform","بيانات","Data",true],
    ["إدارة الحالات","Case Management","تحقيقات","Investigations",true],
    ["SIEM","SIEM","أمن","Security",true],
    ["Open Banking","Open Banking","مصرفية مفتوحة","Open Banking",false],
    ["نفاذ / مزود التحقق","Nafath / MFA Provider","مصادقة","Authentication",true],
  ];
  return defs.map(([name, nameEn, category, categoryEn, connected], i) => ({
    id: `INT-${100 + i}`, name, nameEn, category, categoryEn, connected,
    lastSync: connected ? iso(rng.int(1, 90) * 60000) : iso(rng.int(2, 20) * DAY),
    transactionsProcessed: connected ? rng.int(120000, 1600000) : 0,
    avgLatencyMs: connected ? rng.int(28, 140) : 0,
    health: connected ? (rng.chance(0.82) ? "HEALTHY" : "DEGRADED") : "DOWN",
  }));
}

// ---- AI insights (seed set; more are regenerated dynamically) ---------------

export function buildInsights(rng: Rng): Insight[] {
  const base: Omit<Insight, "id" | "status" | "createdAt">[] = [
    { titleAr: "القاعدة FR-031 تعاقب مدفوعات موردي المنشآت الصغيرة بإفراط", titleEn: "Rule FR-031 over-penalizes SME supplier payments", category: "قواعد", categoryEn: "Rules", severity: "CRITICAL", evidenceAr: "معظم رفض FR-031 لعملاء المنشآت الصغيرة كان سليمًا.", evidenceEn: "Most FR-031 rejections for SME customers were legitimate.", financialImpact: 0, actionAr: "إضافة استثناء لمدفوعات الموردين المعتمدة للمنشآت الصغيرة.", actionEn: "Add an exception for approved SME supplier payments.", confidence: 92 },
    { titleAr: "عمليات الأجهزة الموثوقة أقل احتيالًا بفارق كبير", titleEn: "Trusted-device transactions have far lower fraud", category: "سلوك", categoryEn: "Behavior", severity: "MEDIUM", evidenceAr: "معدل الاحتيال على الأجهزة الموثوقة أقل بكثير من الأجهزة الجديدة.", evidenceEn: "Fraud rate on trusted devices is far below new devices.", financialImpact: 0, actionAr: "اعتماد الجهاز الموثوق كعامل تخفيف.", actionEn: "Adopt trusted-device as a mitigating factor.", confidence: 90 },
    { titleAr: "العملاء القدامى يتعرضون لعقوبة مفرطة", titleEn: "Long-term customers are over-penalized", category: "شرائح", categoryEn: "Segments", severity: "HIGH", evidenceAr: "معدل الرفض الخاطئ لهذه الشريحة أعلى من المتوسط.", evidenceEn: "False-positive rate for this segment exceeds the average.", financialImpact: 0, actionAr: "إضافة استثناء السجل السلوكي للعملاء القدامى.", actionEn: "Add a behavioral-history exception for tenured customers.", confidence: 86 },
  ];
  const insights: Insight[] = base.map((b, i) => ({ ...b, id: `INS-${200 + i}`, status: i === 0 ? "NEW" : "NEW", createdAt: iso(rng.int(1, 20) * DAY) }));
  return insights;
}

// ---- Base dataset ------------------------------------------------------------

export interface BaseDataset {
  customers: Customer[];
  devices: Device[];
  beneficiaries: Beneficiary[];
  rules: FraudRule[];
  rawTransactions: Transaction[];
  insights: Insight[];
  metrics: MonthlyMetric[];
  integrations: Integration[];
}

export const SEED = 20260717;

export function generateBase(seed = SEED): BaseDataset {
  const rng = new Rng(seed);
  const rules = buildRules();
  const customers = buildCustomers(rng);
  const devices = buildDevices(rng);
  const beneficiaries = buildBeneficiaries(rng);
  const rawTransactions = buildRawTransactions(rng, customers, devices, beneficiaries, rules);
  const insights = buildInsights(rng);
  const metrics = buildMonthlyMetrics(rng);
  const integrations = buildIntegrations(rng);
  return { customers, devices, beneficiaries, rules, rawTransactions, insights, metrics, integrations };
}
