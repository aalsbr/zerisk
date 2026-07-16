// ============================================================================
// ZeRisk — Deterministic demo dataset generator
//
// Produces a fully reproducible, internally-consistent dataset (customers,
// devices, beneficiaries, rules, transactions, cases, insights, metrics,
// integrations). The Prisma seed writes THIS into SQLite; the app reads the
// same generator so charts and analytics always render, online or offline.
// ============================================================================

import { Rng } from "./prng";
import { scoreTransaction } from "./scoring";
import type {
  Beneficiary,
  Customer,
  Device,
  EnrichedTransaction,
  FraudRule,
  Insight,
  Integration,
  MonthlyMetric,
  ScenarioType,
  ScoringInput,
  Transaction,
} from "./types";

// Fixed reference "now" so timestamps are deterministic (today per demo).
export const BASE_NOW = Date.UTC(2026, 6, 17, 12, 0, 0);
const DAY = 86400000;

const iso = (msAgo: number) => new Date(BASE_NOW - msAgo).toISOString();

// ---- Fraud rules -------------------------------------------------------------

export function buildRules(): FraudRule[] {
  return [
    {
      id: "FR-011",
      name: "مبلغ مرتفع لشريحة العميل",
      nameEn: "High amount for customer segment",
      description: "يُفعّل عند تجاوز المبلغ الحد المعتاد لشريحة العميل.",
      descriptionEn: "Triggers when the amount exceeds the segment's usual band.",
      category: "المبلغ",
      categoryEn: "Amount",
      status: "ACTIVE",
      severity: "MEDIUM",
      action: "REVIEW",
      weight: 18,
      amountThreshold: 15000,
    },
    {
      id: "FR-017",
      name: "جهاز جديد ومبلغ يتجاوز 5,000 ريال",
      nameEn: "New device and amount above SAR 5,000",
      description: "يرفض العمليات من جهاز جديد بمبلغ يتجاوز 5,000 ريال.",
      descriptionEn: "Rejects transactions from a new device above SAR 5,000.",
      category: "الجهاز",
      categoryEn: "Device",
      status: "ACTIVE",
      severity: "HIGH",
      action: "REJECT",
      weight: 34,
      amountThreshold: 5000,
    },
    {
      id: "FR-019",
      name: "محاولات دخول فاشلة متعددة",
      nameEn: "Multiple failed login attempts",
      description: "يُفعّل عند تكرار محاولات الدخول الفاشلة قبل العملية.",
      descriptionEn: "Triggers on repeated failed logins before the transaction.",
      category: "المصادقة",
      categoryEn: "Authentication",
      status: "ACTIVE",
      severity: "HIGH",
      action: "REVIEW",
      weight: 28,
    },
    {
      id: "FR-023",
      name: "أول تحويل لمستفيد دولي",
      nameEn: "First transfer to international beneficiary",
      description: "يراجع أول تحويل إلى مستفيد دولي جديد.",
      descriptionEn: "Reviews the first transfer to a new international beneficiary.",
      category: "المستفيد",
      categoryEn: "Beneficiary",
      status: "ACTIVE",
      severity: "MEDIUM",
      action: "REVIEW",
      weight: 22,
    },
    {
      id: "FR-024",
      name: "عملية خارج الأوقات الاعتيادية للعميل",
      nameEn: "Transaction outside customer's normal time",
      description: "يرفض العمليات التي تتم خارج نمط الأوقات المعتاد للعميل.",
      descriptionEn: "Rejects transactions outside the customer's usual time pattern.",
      category: "السلوك",
      categoryEn: "Behavior",
      status: "ACTIVE",
      severity: "MEDIUM",
      action: "REJECT",
      weight: 24,
    },
    {
      id: "FR-028",
      name: "سرعة عمليات مرتفعة في نافذة قصيرة",
      nameEn: "High transaction velocity in short window",
      description: "يُفعّل عند تنفيذ عدة عمليات خلال فترة قصيرة.",
      descriptionEn: "Triggers on many transactions within a short window.",
      category: "السرعة",
      categoryEn: "Velocity",
      status: "ACTIVE",
      severity: "HIGH",
      action: "REVIEW",
      weight: 30,
    },
    {
      id: "FR-031",
      name: "مستفيد جديد بمبلغ مرتفع",
      nameEn: "New beneficiary with high amount",
      description: "يرفض التحويلات الكبيرة إلى مستفيد جديد.",
      descriptionEn: "Rejects large transfers to a brand-new beneficiary.",
      category: "المستفيد",
      categoryEn: "Beneficiary",
      status: "ACTIVE",
      severity: "HIGH",
      action: "REJECT",
      weight: 32,
      amountThreshold: 10000,
    },
    {
      id: "FR-033",
      name: "موقع غير معتاد / تنقل جغرافي سريع",
      nameEn: "Unfamiliar location / geo-velocity",
      description: "يُفعّل عند تنفيذ العملية من موقع غير معتاد للعميل.",
      descriptionEn: "Triggers when the transaction is from an unfamiliar location.",
      category: "الموقع",
      categoryEn: "Location",
      status: "ACTIVE",
      severity: "MEDIUM",
      action: "REVIEW",
      weight: 20,
    },
    {
      id: "FR-042",
      name: "نشاط مفاجئ على حساب خامل",
      nameEn: "Sudden activity on dormant account",
      description: "يراقب النشاط المفاجئ بعد فترة خمول طويلة.",
      descriptionEn: "Monitors sudden activity after a long dormant period.",
      category: "السلوك",
      categoryEn: "Behavior",
      status: "MONITORING",
      severity: "LOW",
      action: "MONITOR",
      weight: 12,
    },
    {
      id: "FR-047",
      name: "مبلغ أسفل حد الإبلاغ مباشرة",
      nameEn: "Amount just below reporting threshold",
      description: "يراقب المبالغ القريبة من حد الإبلاغ التنظيمي.",
      descriptionEn: "Monitors amounts just under the regulatory reporting threshold.",
      category: "الامتثال",
      categoryEn: "Compliance",
      status: "ACTIVE",
      severity: "MEDIUM",
      action: "MONITOR",
      weight: 16,
    },
  ];
}

// ---- Reference data pools ----------------------------------------------------

const AR_FIRST = [
  "محمد", "أحمد", "عبدالله", "خالد", "سعد", "فيصل", "نورة", "سارة", "ريم",
  "لطيفة", "هند", "عبدالعزيز", "بندر", "ماجد", "تركي", "أمل", "منى", "دانة",
  "يوسف", "عمر", "ناصر", "سلطان", "وليد", "غادة", "رغد",
];
const AR_LAST = [
  "الشمري", "القحطاني", "العتيبي", "الغامدي", "الحربي", "الدوسري", "المطيري",
  "الزهراني", "السبيعي", "البلوي", "العنزي", "الشهري", "الرشيدي", "المالكي",
];
const EN_FIRST = [
  "Mohammed", "Ahmed", "Abdullah", "Khalid", "Saad", "Faisal", "Noura", "Sara",
  "Reem", "Latifah", "Hind", "Abdulaziz", "Bandar", "Majed", "Turki", "Amal",
  "Mona", "Dana", "Youssef", "Omar", "Nasser", "Sultan", "Waleed", "Ghada", "Raghad",
];
const EN_LAST = [
  "Al-Shammari", "Al-Qahtani", "Al-Otaibi", "Al-Ghamdi", "Al-Harbi", "Al-Dosari",
  "Al-Mutairi", "Al-Zahrani", "Al-Subaie", "Al-Balawi", "Al-Anazi", "Al-Shehri",
  "Al-Rashidi", "Al-Maliki",
];
const CITIES: [string, string][] = [
  ["الرياض", "Riyadh"], ["جدة", "Jeddah"], ["الدمام", "Dammam"],
  ["مكة", "Makkah"], ["المدينة", "Madinah"], ["الخبر", "Khobar"],
  ["أبها", "Abha"], ["تبوك", "Tabuk"], ["الطائف", "Taif"], ["بريدة", "Buraidah"],
];
const BANKS: [string, string][] = [
  ["الراجحي", "Al Rajhi Bank"], ["الأهلي", "SNB"], ["الرياض", "Riyad Bank"],
  ["ساب", "SABB"], ["البلاد", "Bank Albilad"], ["الإنماء", "Alinma Bank"],
  ["الجزيرة", "Bank Aljazira"], ["Wise", "Wise (Intl)"], ["Revolut", "Revolut (Intl)"],
];

// ---- Customers ---------------------------------------------------------------

const SEGMENTS = ["RETAIL", "PREMIER", "PRIVATE", "SME", "CORPORATE"] as const;

export function buildCustomers(rng: Rng): Customer[] {
  const out: Customer[] = [];
  for (let i = 0; i < 30; i++) {
    const fi = rng.int(0, AR_FIRST.length - 1);
    const li = rng.int(0, AR_LAST.length - 1);
    const ci = rng.int(0, CITIES.length - 1);
    const segment = rng.weighted(SEGMENTS, [50, 22, 10, 12, 6]);
    const avgBase =
      segment === "RETAIL" ? 2600 :
      segment === "PREMIER" ? 6200 :
      segment === "PRIVATE" ? 18000 :
      segment === "SME" ? 9000 : 24000;
    out.push({
      id: `CUS-${8400 + i}`,
      name: `${AR_FIRST[fi]} ${AR_LAST[li]}`,
      nameEn: `${EN_FIRST[fi]} ${EN_LAST[li]}`,
      nationalIdMasked: `1${rng.int(0, 9)}••••••${rng.int(10, 99)}`,
      segment,
      accountAgeMonths: rng.int(4, 96),
      avgTxnAmount: Math.round(avgBase * rng.range(0.7, 1.4)),
      txnCount30d: rng.int(6, 80),
      homeCity: CITIES[ci][0],
      homeCityEn: CITIES[ci][1],
      trustScore: rng.int(58, 97),
    });
  }
  return out;
}

// ---- Devices -----------------------------------------------------------------

const DEVICE_TYPES = ["MOBILE_IOS", "MOBILE_ANDROID", "DESKTOP", "TABLET"] as const;
const DEVICE_LABELS: Record<string, string> = {
  MOBILE_IOS: "iPhone",
  MOBILE_ANDROID: "Android",
  DESKTOP: "Desktop",
  TABLET: "iPad",
};

export function buildDevices(rng: Rng): Device[] {
  const out: Device[] = [];
  // 15 trusted/known devices
  for (let i = 0; i < 15; i++) {
    const t = rng.pick(DEVICE_TYPES);
    const txn = rng.int(18, 140);
    out.push({
      id: `DEV-${1000 + i}`,
      type: t,
      label: `${DEVICE_LABELS[t]} ••${rng.int(10, 99)}`,
      known: true,
      firstSeenDaysAgo: rng.int(60, 900),
      txnCount: txn,
      trustScore: Math.min(98, 60 + Math.round(txn * 0.3)),
    });
  }
  // 7 new/unknown devices
  for (let i = 0; i < 7; i++) {
    const t = rng.pick(DEVICE_TYPES);
    out.push({
      id: `DEV-${2000 + i}`,
      type: t,
      label: `${DEVICE_LABELS[t]} ••${rng.int(10, 99)}`,
      known: false,
      firstSeenDaysAgo: rng.int(0, 2),
      txnCount: rng.int(0, 2),
      trustScore: rng.int(8, 30),
    });
  }
  return out;
}

// ---- Beneficiaries -----------------------------------------------------------

const BEN_TYPES = ["INTERNAL", "EXTERNAL", "INTERNATIONAL", "WALLET"] as const;

export function buildBeneficiaries(rng: Rng): Beneficiary[] {
  const out: Beneficiary[] = [];
  for (let i = 0; i < 17; i++) {
    const b = rng.pick(BANKS);
    const fi = rng.int(0, AR_FIRST.length - 1);
    const txn = rng.int(4, 40);
    out.push({
      id: `BEN-${500 + i}`,
      name: `${AR_FIRST[fi]} ${rng.pick(AR_LAST)}`,
      nameEn: `${EN_FIRST[fi]} ${rng.pick(EN_LAST)}`,
      bank: b[1],
      type: rng.weighted(BEN_TYPES, [40, 34, 12, 14]),
      known: true,
      txnCount: txn,
      firstSeenDaysAgo: rng.int(40, 800),
      trustScore: Math.min(96, 55 + Math.round(txn)),
    });
  }
  for (let i = 0; i < 8; i++) {
    const b = rng.pick(BANKS);
    const fi = rng.int(0, AR_FIRST.length - 1);
    out.push({
      id: `BEN-${900 + i}`,
      name: `${AR_FIRST[fi]} ${rng.pick(AR_LAST)}`,
      nameEn: `${EN_FIRST[fi]} ${rng.pick(EN_LAST)}`,
      bank: b[1],
      type: rng.weighted(BEN_TYPES, [10, 30, 40, 20]),
      known: false,
      txnCount: rng.int(0, 1),
      firstSeenDaysAgo: rng.int(0, 3),
      trustScore: rng.int(6, 28),
    });
  }
  return out;
}

const CHANNELS = ["MOBILE", "WEB", "POS", "ATM", "WALLET", "BRANCH"] as const;

// ---- Legacy engine simulation (deliberately over-penalizing) -----------------

function legacyEvaluate(
  amount: number,
  customerAvg: number,
  deviceKnown: boolean,
  beneficiaryKnown: boolean,
  failedLogins: number,
  timeFamiliar: boolean,
  locationFamiliar: boolean,
  rules: FraudRule[],
): { score: number; decision: Transaction["originalDecision"] } {
  let score = 18;
  for (const r of rules) score += r.weight * 0.9;
  const ratio = amount / Math.max(customerAvg, 1);
  if (ratio > 1.2) score += Math.min(28, (ratio - 1) * 26);
  if (!deviceKnown) score += 12;
  if (!beneficiaryKnown) score += 10;
  score += Math.min(failedLogins, 5) * 5;
  if (!timeFamiliar) score += 8;
  if (!locationFamiliar) score += 9;
  score = Math.max(4, Math.min(99, Math.round(score)));

  const hasReject = rules.some((r) => r.action === "REJECT");
  const hasReview = rules.some((r) => r.action === "REVIEW");
  let decision: Transaction["originalDecision"];
  if (score >= 78 || (hasReject && score >= 62)) decision = "REJECT";
  else if (score >= 58 || hasReview) decision = "REVIEW";
  else if (score >= 38) decision = "MONITOR";
  else decision = "APPROVE";
  return { score, decision };
}

// ---- Scenario blueprint ------------------------------------------------------

interface ScenarioSignals {
  deviceKnown: boolean;
  beneficiaryKnown: boolean;
  mfaPassed: boolean;
  failedLogins: number;
  velocity1h: number;
  timeFamiliar: boolean;
  locationFamiliar: boolean;
  amountRatio: [number, number];
  ruleIds: string[];
  isActuallyFraud: boolean;
  similarLegit: number;
  similarFraud: number;
}

function scenarioSignals(scenario: ScenarioType, rng: Rng): ScenarioSignals {
  switch (scenario) {
    case "FALSE_POSITIVE":
      return {
        deviceKnown: true, beneficiaryKnown: true, mfaPassed: true,
        failedLogins: 0, velocity1h: rng.int(1, 2), timeFamiliar: false,
        locationFamiliar: true, amountRatio: [1.3, 2.1],
        ruleIds: rng.pick([["FR-017", "FR-024"], ["FR-017"], ["FR-024", "FR-011"]]),
        isActuallyFraud: false, similarLegit: rng.int(2, 6), similarFraud: 0,
      };
    case "CONFIRMED_FRAUD":
      return {
        deviceKnown: false, beneficiaryKnown: false,
        mfaPassed: rng.chance(0.4), failedLogins: rng.int(1, 4),
        velocity1h: rng.int(5, 9), timeFamiliar: false, locationFamiliar: false,
        amountRatio: [1.8, 3.2],
        ruleIds: rng.pick([["FR-028", "FR-033", "FR-019"], ["FR-031", "FR-033"], ["FR-019", "FR-028"]]),
        isActuallyFraud: true, similarLegit: 0, similarFraud: rng.int(1, 3),
      };
    case "LOW_RISK":
      return {
        deviceKnown: true, beneficiaryKnown: true, mfaPassed: true,
        failedLogins: 0, velocity1h: 1, timeFamiliar: true, locationFamiliar: true,
        amountRatio: [0.4, 1.05], ruleIds: [],
        isActuallyFraud: false, similarLegit: rng.int(3, 8), similarFraud: 0,
      };
    case "AMBIGUOUS":
      return {
        deviceKnown: true, beneficiaryKnown: false, mfaPassed: true,
        failedLogins: 0, velocity1h: rng.int(1, 3), timeFamiliar: rng.chance(0.5),
        locationFamiliar: true, amountRatio: [1.2, 1.7],
        ruleIds: rng.pick([["FR-031"], ["FR-023"], ["FR-031", "FR-047"]]),
        isActuallyFraud: rng.chance(0.15), similarLegit: rng.int(0, 2), similarFraud: 0,
      };
    case "RULE_FAILURE":
      return {
        deviceKnown: true, beneficiaryKnown: true, mfaPassed: true,
        failedLogins: 0, velocity1h: 1, timeFamiliar: true, locationFamiliar: true,
        amountRatio: [1.9, 2.8], ruleIds: rng.pick([["FR-011", "FR-017"], ["FR-017"]]),
        isActuallyFraud: false, similarLegit: rng.int(4, 9), similarFraud: 0,
      };
    default: // NORMAL
      return {
        deviceKnown: rng.chance(0.85), beneficiaryKnown: rng.chance(0.8),
        mfaPassed: rng.chance(0.95), failedLogins: rng.chance(0.1) ? 1 : 0,
        velocity1h: rng.int(1, 3), timeFamiliar: rng.chance(0.8),
        locationFamiliar: rng.chance(0.85), amountRatio: [0.5, 1.3],
        ruleIds: rng.chance(0.3) ? [rng.pick(["FR-042", "FR-047", "FR-011"])] : [],
        isActuallyFraud: rng.chance(0.04), similarLegit: rng.int(1, 5), similarFraud: 0,
      };
  }
}

// Hero transactions (fixed, referenced by Demo Story) followed by generated mix.
const SCENARIO_PLAN: ScenarioType[] = [
  ...Array<ScenarioType>(34).fill("FALSE_POSITIVE"),
  ...Array<ScenarioType>(16).fill("CONFIRMED_FRAUD"),
  ...Array<ScenarioType>(34).fill("LOW_RISK"),
  ...Array<ScenarioType>(16).fill("AMBIGUOUS"),
  ...Array<ScenarioType>(10).fill("RULE_FAILURE"),
  ...Array<ScenarioType>(12).fill("NORMAL"),
];

export const HERO_IDS = {
  falsePositive: "TX-2026-000145",
  confirmedFraud: "TX-2026-000212",
  lowRisk: "TX-2026-000078",
  ambiguous: "TX-2026-000301",
  ruleFailure: "TX-2026-000356",
};

export function buildRawTransactions(
  rng: Rng,
  customers: Customer[],
  devices: Device[],
  beneficiaries: Beneficiary[],
  rules: FraudRule[],
): Transaction[] {
  const ruleById = new Map(rules.map((r) => [r.id, r]));
  const knownDevices = devices.filter((d) => d.known);
  const newDevices = devices.filter((d) => !d.known);
  const knownBens = beneficiaries.filter((b) => b.known);
  const newBens = beneficiaries.filter((b) => !b.known);

  // Order the plan so hero scenarios come first with fixed IDs, then shuffle rest deterministically.
  const plan = [
    "FALSE_POSITIVE", "CONFIRMED_FRAUD", "LOW_RISK", "AMBIGUOUS", "RULE_FAILURE",
    ...deterministicShuffle(SCENARIO_PLAN, rng),
  ] as ScenarioType[];

  const heroMap: Record<number, string> = {
    0: HERO_IDS.falsePositive,
    1: HERO_IDS.confirmedFraud,
    2: HERO_IDS.lowRisk,
    3: HERO_IDS.ambiguous,
    4: HERO_IDS.ruleFailure,
  };

  const out: Transaction[] = [];
  let seq = 1;
  for (let idx = 0; idx < plan.length; idx++) {
    const scenario = plan[idx];
    const s = scenarioSignals(scenario, rng);
    const customer =
      scenario === "RULE_FAILURE"
        ? pickTenured(customers, rng)
        : rng.pick(customers);

    const device = s.deviceKnown ? rng.pick(knownDevices) : rng.pick(newDevices);
    const beneficiary = s.beneficiaryKnown ? rng.pick(knownBens) : rng.pick(newBens);
    const triggered = s.ruleIds.map((id) => ruleById.get(id)!).filter(Boolean);

    const amount = Math.round(
      customer.avgTxnAmount * rng.range(s.amountRatio[0], s.amountRatio[1]) / 10,
    ) * 10;

    const daysAgo = rng.int(0, 89);
    const hour = s.timeFamiliar ? rng.int(9, 20) : rng.pick([1, 2, 3, 4, 23, 0]);
    const ts = daysAgo * DAY + (24 - hour) * 3600000 + rng.int(0, 59) * 60000;

    const legacy = legacyEvaluate(
      amount, customer.avgTxnAmount, s.deviceKnown, s.beneficiaryKnown,
      s.failedLogins, s.timeFamiliar, s.locationFamiliar, triggered,
    );

    const id = heroMap[idx] ?? `TX-2026-${String(700 + seq).padStart(6, "0")}`;
    if (!heroMap[idx]) seq++;

    out.push({
      id,
      customerId: customer.id,
      amount,
      currency: "SAR",
      channel: pickChannel(scenario, rng),
      deviceId: device.id,
      beneficiaryId: beneficiary.id,
      timestamp: iso(ts),
      hour,
      originalDecision: legacy.decision,
      originalRiskScore: legacy.score,
      triggeredRuleIds: triggered.map((r) => r.id),
      mfaPassed: s.mfaPassed,
      failedLogins: s.failedLogins,
      velocity1h: s.velocity1h,
      locationFamiliar: s.locationFamiliar,
      timeFamiliar: s.timeFamiliar,
      isActuallyFraud: s.isActuallyFraud,
      scenario,
      processingTimeMs: 0, // filled from scoring during enrichment
    });
  }
  return out;
}

function pickChannel(scenario: ScenarioType, rng: Rng) {
  if (scenario === "CONFIRMED_FRAUD") return rng.weighted(CHANNELS, [30, 30, 4, 6, 22, 2]);
  return rng.weighted(CHANNELS, [42, 22, 12, 8, 12, 4]);
}

function pickTenured(customers: Customer[], rng: Rng): Customer {
  const tenured = customers.filter((c) => c.accountAgeMonths >= 36);
  return tenured.length ? rng.pick(tenured) : rng.pick(customers);
}

function deterministicShuffle<T>(arr: readonly T[], rng: Rng): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---- Enrichment (run the scoring engine) -------------------------------------

export function toScoringInput(
  t: Transaction,
  customer: Customer,
  device: Device,
  beneficiary: Beneficiary,
  rules: FraudRule[],
): ScoringInput {
  const triggered = rules.filter((r) => t.triggeredRuleIds.includes(r.id));
  const s = scenarioSignalsFrom(t);
  return {
    originalRiskScore: t.originalRiskScore,
    amount: t.amount,
    customerAvgAmount: customer.avgTxnAmount,
    deviceKnown: device.known,
    deviceAgeDays: device.firstSeenDaysAgo,
    deviceTxnCount: device.txnCount,
    beneficiaryKnown: beneficiary.known,
    beneficiaryTxnCount: beneficiary.txnCount,
    accountAgeMonths: customer.accountAgeMonths,
    velocity1h: t.velocity1h,
    failedLogins: t.failedLogins,
    mfaPassed: t.mfaPassed,
    locationFamiliar: t.locationFamiliar,
    timeFamiliar: t.timeFamiliar,
    historicalFraudCount: s.histFraud,
    historicalLegitCount: s.histLegit,
    triggeredRuleSeverities: triggered.map((r) => r.severity),
    similarLegitOutcomes: s.similarLegit,
    similarFraudOutcomes: s.similarFraud,
  };
}

// Derive history/similarity counts deterministically from the transaction.
function scenarioSignalsFrom(t: Transaction) {
  const seedFromId = [...t.id].reduce((a, c) => a + c.charCodeAt(0), 0);
  const histLegit =
    t.scenario === "CONFIRMED_FRAUD" ? 2 :
    t.scenario === "LOW_RISK" ? 30 + (seedFromId % 20) :
    t.scenario === "RULE_FAILURE" ? 40 + (seedFromId % 25) :
    12 + (seedFromId % 24);
  const histFraud = t.isActuallyFraud ? (seedFromId % 2) : 0;
  const similarLegit =
    t.scenario === "CONFIRMED_FRAUD" ? 0 :
    t.scenario === "AMBIGUOUS" ? seedFromId % 3 :
    2 + (seedFromId % 5);
  const similarFraud = t.isActuallyFraud ? 1 + (seedFromId % 3) : 0;
  return { histLegit, histFraud, similarLegit, similarFraud };
}

export function enrich(
  raw: Transaction[],
  customers: Customer[],
  devices: Device[],
  beneficiaries: Beneficiary[],
  rules: FraudRule[],
): EnrichedTransaction[] {
  const cMap = new Map(customers.map((c) => [c.id, c]));
  const dMap = new Map(devices.map((d) => [d.id, d]));
  const bMap = new Map(beneficiaries.map((b) => [b.id, b]));

  return raw.map((t) => {
    const customer = cMap.get(t.customerId)!;
    const device = dMap.get(t.deviceId)!;
    const beneficiary = bMap.get(t.beneficiaryId)!;
    const input = toScoringInput(t, customer, device, beneficiary, rules);
    const ai = scoreTransaction(input);
    const legacyNegative =
      t.originalDecision === "REJECT" || t.originalDecision === "REVIEW";
    const aiPositive = ai.recommendation === "APPROVE" || ai.recommendation === "MONITOR";
    const isFalsePositive = legacyNegative && aiPositive && !t.isActuallyFraud;
    return {
      ...t,
      processingTimeMs: ai.processingTimeMs,
      customer,
      device,
      beneficiary,
      ai,
      rules: rules.filter((r) => t.triggeredRuleIds.includes(r.id)),
      isFalsePositive,
    };
  });
}

// ---- Monthly metrics (12 months, deterministic upward trend) -----------------

const MONTH_LABELS = [
  "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر", "يناير",
  "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو",
];
const MONTH_KEYS = [
  "2025-08", "2025-09", "2025-10", "2025-11", "2025-12", "2026-01",
  "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07",
];

export function buildMonthlyMetrics(rng: Rng): MonthlyMetric[] {
  const out: MonthlyMetric[] = [];
  for (let i = 0; i < 12; i++) {
    const p = i / 11; // 0..1 improvement progress
    const total = 980000 + Math.round(p * 270000) + rng.int(-15000, 15000);
    const fpBefore = 2.6 - p * 0.1 + rng.range(-0.05, 0.05);
    const fpAfter = 2.45 - p * 1.28 + rng.range(-0.04, 0.04);
    const recovered = Math.round(total * (fpBefore - fpAfter) / 100 * 0.62);
    out.push({
      month: MONTH_KEYS[i],
      label: MONTH_LABELS[i],
      totalTransactions: total,
      fpRateBefore: +fpBefore.toFixed(2),
      fpRateAfter: +Math.max(0.9, fpAfter).toFixed(2),
      recoveredTransactions: recovered,
      revenueRecovered: recovered * 140,
      fraudPrevented: 2100000 + Math.round(p * 900000) + rng.int(-80000, 80000),
      manualReviews: Math.round((24000 - p * 6000) + rng.int(-600, 600)),
      manualReviewsReduced: Math.round(p * 6200 + rng.int(-200, 200)),
      customerFriction: +(48 - p * 22 + rng.range(-1, 1)).toFixed(1),
      accuracy: +(88 + p * 6 + rng.range(-0.6, 0.6)).toFixed(1),
      precision: +(83 + p * 8 + rng.range(-0.6, 0.6)).toFixed(1),
      recall: +(90 + p * 3.5 + rng.range(-0.5, 0.5)).toFixed(1),
      falseNegativeRate: +(2.4 - p * 0.9 + rng.range(-0.1, 0.1)).toFixed(2),
      drift: +(Math.max(0, 0.22 - p * 0.14 + rng.range(-0.02, 0.03))).toFixed(3),
    });
  }
  return out;
}

// ---- Integrations ------------------------------------------------------------

export function buildIntegrations(rng: Rng): Integration[] {
  const defs: [string, string, string, string, boolean][] = [
    ["IBM Safer Payments", "IBM Safer Payments", "محرك احتيال", "Fraud Engine", true],
    ["SAS Fraud Management", "SAS Fraud Management", "محرك احتيال", "Fraud Engine", true],
    ["Feedzai", "Feedzai", "محرك احتيال", "Fraud Engine", false],
    ["النظام البنكي الأساسي", "Core Banking", "أنظمة أساسية", "Core", true],
    ["بوابة المدفوعات", "Payment Gateway", "مدفوعات", "Payments", true],
    ["تطبيق الجوال", "Mobile App", "قنوات", "Channels", true],
    ["المحفظة الرقمية", "Digital Wallet", "قنوات", "Channels", true],
    ["منصة بيانات العملاء", "Customer Data Platform", "بيانات", "Data", true],
    ["إدارة الحالات", "Case Management", "تحقيقات", "Investigations", true],
    ["SIEM", "SIEM", "أمن", "Security", true],
    ["Open Banking", "Open Banking", "مصرفية مفتوحة", "Open Banking", false],
    ["نفاذ / مزود التحقق", "Nafath / MFA Provider", "مصادقة", "Authentication", true],
  ];
  return defs.map(([name, nameEn, category, categoryEn, connected], i) => ({
    id: `INT-${100 + i}`,
    name, nameEn, category, categoryEn, connected,
    lastSync: connected ? iso(rng.int(1, 90) * 60000) : iso(rng.int(2, 20) * DAY),
    transactionsProcessed: connected ? rng.int(120000, 1600000) : 0,
    avgLatencyMs: connected ? rng.int(28, 140) : 0,
    health: connected ? (rng.chance(0.82) ? "HEALTHY" : "DEGRADED") : "DOWN",
  }));
}

// ---- AI insights -------------------------------------------------------------

export function buildInsights(rng: Rng): Insight[] {
  const raw: Omit<Insight, "id" | "status" | "createdAt">[] = [
    {
      titleAr: "ارتفاع الرفض الخاطئ لعمليات المحفظة الرقمية بنسبة 14% هذا الأسبوع",
      titleEn: "False positives up 14% for mobile wallet transactions this week",
      category: "قنوات", categoryEn: "Channels", severity: "HIGH",
      evidenceAr: "312 عملية محفظة سليمة تم رفضها مقابل 274 الأسبوع الماضي.",
      evidenceEn: "312 legitimate wallet transactions rejected vs 274 last week.",
      financialImpact: 168000, confidence: 88,
      actionAr: "مراجعة عتبة القاعدة FR-031 لقناة المحفظة.",
      actionEn: "Review FR-031 threshold for the wallet channel.",
    },
    {
      titleAr: "القاعدة FR-024 مسؤولة عن 38% من رفض العمليات السليمة",
      titleEn: "Rule FR-024 is responsible for 38% of rejected legitimate transactions",
      category: "قواعد", categoryEn: "Rules", severity: "CRITICAL",
      evidenceAr: "FR-024 سببت 4,010 رفض خاطئ باكتشاف 61 حالة احتيال فقط.",
      evidenceEn: "FR-024 caused 4,010 false declines while catching only 61 fraud cases.",
      financialImpact: 561000, confidence: 93,
      actionAr: "تحويل الإجراء من رفض إلى مراجعة مع استثناء الجهاز الموثوق.",
      actionEn: "Change action from Reject to Review with a trusted-device exception.",
    },
    {
      titleAr: "عمليات الأجهزة الموثوقة أقل عرضة للاحتيال المؤكد بنسبة 94%",
      titleEn: "Trusted-device transactions have a 94% lower confirmed-fraud rate",
      category: "سلوك", categoryEn: "Behavior", severity: "MEDIUM",
      evidenceAr: "معدل الاحتيال 0.03% على الأجهزة الموثوقة مقابل 0.51% للأجهزة الجديدة.",
      evidenceEn: "0.03% fraud rate on trusted devices vs 0.51% on new devices.",
      financialImpact: 240000, confidence: 90,
      actionAr: "إضافة شرط الجهاز الموثوق كعامل تخفيف معتمد.",
      actionEn: "Add trusted-device as an approved mitigating condition.",
    },
    {
      titleAr: "العملاء الأقدم من 24 شهرًا يتعرضون لعقوبة مفرطة من القواعد الحالية",
      titleEn: "Customers older than 24 months are over-penalized by current rules",
      category: "شرائح", categoryEn: "Segments", severity: "HIGH",
      evidenceAr: "معدل الرفض الخاطئ 3.1% لهذه الشريحة مقابل 1.2% للمتوسط.",
      evidenceEn: "3.1% false-positive rate for this segment vs 1.2% average.",
      financialImpact: 302000, confidence: 86,
      actionAr: "إضافة استثناء السجل السلوكي للعملاء ذوي الأقدمية.",
      actionEn: "Add a behavioral-history exception for tenured customers.",
    },
    {
      titleAr: "يمكن خفض حجم المراجعة اليدوية بنسبة تقديرية 22%",
      titleEn: "Manual review volume can be reduced by an estimated 22%",
      category: "عمليات", categoryEn: "Operations", severity: "MEDIUM",
      evidenceAr: "5,140 حالة مراجعة شهريًا يمكن أتمتتها بثقة تتجاوز 90%.",
      evidenceEn: "5,140 monthly reviews can be automated with >90% confidence.",
      financialImpact: 205600, confidence: 84,
      actionAr: "تفعيل الموافقة الآلية للحالات عالية الثقة ضمن حدود الحوكمة.",
      actionEn: "Enable auto-approval for high-confidence cases within governance limits.",
    },
  ];

  const extra = [
    ["تركّز الرفض الخاطئ في ساعات الليل المتأخرة", "False positives cluster in late-night hours", "سلوك", "Behavior"],
    ["ارتفاع طفيف في الانحراف على شريحة الشركات", "Slight drift detected on the corporate segment", "نموذج", "Model"],
    ["المستفيدون الدوليون الجدد يمثلون فرصة تحسين", "New international beneficiaries are an optimization opportunity", "مستفيد", "Beneficiary"],
    ["قناة نقاط البيع تُظهر دقة عالية ومستقرة", "POS channel shows high, stable precision", "قنوات", "Channels"],
    ["تحسّن ثقة التوصيات بعد أحدث تغذية راجعة", "Recommendation confidence improved after latest feedback", "نموذج", "Model"],
  ];
  const sevs = ["LOW", "MEDIUM", "INFO", "LOW", "INFO"] as const;

  const insights: Insight[] = raw.map((r, i) => ({
    ...r,
    id: `INS-${200 + i}`,
    status: i === 0 ? "NEW" : i === 1 ? "REVIEWED" : "NEW",
    createdAt: iso(rng.int(1, 20) * DAY),
  }));

  extra.forEach(([titleAr, titleEn, category, categoryEn], i) => {
    insights.push({
      id: `INS-${300 + i}`,
      titleAr, titleEn, category, categoryEn,
      severity: sevs[i],
      evidenceAr: "بناءً على تحليل مجموعة البيانات التاريخية المجمّعة.",
      evidenceEn: "Based on analysis of the aggregated historical dataset.",
      financialImpact: rng.int(20000, 120000),
      actionAr: "مراجعة التفاصيل واتخاذ الإجراء المناسب.",
      actionEn: "Review details and take the appropriate action.",
      confidence: rng.int(72, 92),
      status: rng.pick(["NEW", "REVIEWED", "ACCEPTED", "DISMISSED"]),
      createdAt: iso(rng.int(1, 28) * DAY),
    });
  });

  // pad to 20
  while (insights.length < 20) {
    const i = insights.length;
    insights.push({
      id: `INS-${400 + i}`,
      titleAr: "ملاحظة أداء دورية على مجموعة القواعد",
      titleEn: "Periodic performance note on the rule set",
      category: "قواعد", categoryEn: "Rules", severity: "INFO",
      evidenceAr: "مراجعة دورية مجدولة لأداء القواعد.",
      evidenceEn: "Scheduled periodic rule performance review.",
      financialImpact: rng.int(10000, 60000),
      actionAr: "لا يتطلب إجراءً فوريًا.",
      actionEn: "No immediate action required.",
      confidence: rng.int(70, 85),
      status: "REVIEWED",
      createdAt: iso(rng.int(5, 40) * DAY),
    });
  }
  return insights;
}

// ---- Top-level dataset -------------------------------------------------------

export interface Dataset {
  customers: Customer[];
  devices: Device[];
  beneficiaries: Beneficiary[];
  rules: FraudRule[];
  transactions: EnrichedTransaction[];
  insights: Insight[];
  metrics: MonthlyMetric[];
  integrations: Integration[];
}

export const SEED = 20260717;

export function generateDataset(seed = SEED): Dataset {
  const rng = new Rng(seed);
  const rules = buildRules();
  const customers = buildCustomers(rng);
  const devices = buildDevices(rng);
  const beneficiaries = buildBeneficiaries(rng);
  const raw = buildRawTransactions(rng, customers, devices, beneficiaries, rules);
  const transactions = enrich(raw, customers, devices, beneficiaries, rules);
  const insights = buildInsights(rng);
  const metrics = buildMonthlyMetrics(rng);
  const integrations = buildIntegrations(rng);
  return { customers, devices, beneficiaries, rules, transactions, insights, metrics, integrations };
}
