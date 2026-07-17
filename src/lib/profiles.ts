// ============================================================================
// ZeRisk — adaptive risk profiles, recalculated from stored transactions and
// confirmed investigator labels. These feed the deterministic scoring engine
// and the learning loop (they change as feedback is added).
// ============================================================================

import type {
  BeneficiaryProfile,
  CustomerProfile,
  DeviceProfile,
  FeatureStatistic,
  FraudRule,
  GroupProfile,
  InvestigationOutcome,
  RuleProfile,
  Transaction,
  Beneficiary,
  Customer,
  Device,
} from "./types";

export type LabelResolver = (id: string) => InvestigationOutcome | undefined;

export interface Profiles {
  customers: Map<string, CustomerProfile>;
  devices: Map<string, DeviceProfile>;
  beneficiaries: Map<string, BeneficiaryProfile>;
  channels: Map<string, GroupProfile>;
  segments: Map<string, GroupProfile>;
  rules: Map<string, RuleProfile>;
  features: FeatureStatistic[];
  labeledCount: number;
  baseFraudRate: number;
}

const AVG_FRAUD_LOSS = 2400;
const AVG_REVENUE = 140;

function isFraud(l?: InvestigationOutcome) {
  return l === "CONFIRMED_FRAUD";
}
function isLegit(l?: InvestigationOutcome) {
  return l === "LEGITIMATE";
}

// A false positive is a legacy negative decision on a transaction confirmed legit.
function isFP(t: Transaction, l?: InvestigationOutcome) {
  const legacyNegative = t.originalDecision === "REJECT" || t.originalDecision === "REVIEW";
  return legacyNegative && isLegit(l);
}

export function computeProfiles(
  raw: Transaction[],
  customers: Customer[],
  devices: Device[],
  beneficiaries: Beneficiary[],
  rules: FraudRule[],
  label: LabelResolver,
): Profiles {
  const cMap = new Map(customers.map((c) => [c.id, c]));
  const dMap = new Map(devices.map((d) => [d.id, d]));
  const bMap = new Map(beneficiaries.map((b) => [b.id, b]));

  let labeledCount = 0;
  let fraudTotal = 0;

  // accumulators
  const cust = new Map<string, CustomerProfile>();
  const dev = new Map<string, DeviceProfile>();
  const ben = new Map<string, BeneficiaryProfile>();
  const devCustomers = new Map<string, Set<string>>();
  const benSenders = new Map<string, Set<string>>();
  const chan = new Map<string, GroupProfile>();
  const seg = new Map<string, GroupProfile>();
  const ruleAcc = new Map<string, RuleProfile>();

  const group = (m: Map<string, GroupProfile>, key: string): GroupProfile => {
    let g = m.get(key);
    if (!g) { g = { key, totalTransactions: 0, confirmedFraudCount: 0, legitimateCount: 0, falsePositiveCount: 0, fraudRate: 0, falsePositiveRate: 0, riskScore: 0 }; m.set(key, g); }
    return g;
  };

  for (const r of rules) {
    ruleAcc.set(r.id, { id: r.id, name: r.name, nameEn: r.nameEn, severity: r.severity, action: r.action, triggerCount: 0, confirmedFraudCount: 0, legitimateCount: 0, falsePositiveCount: 0, precision: 0, falsePositiveRate: 0, estimatedLossPrevented: 0, estimatedRevenueLost: 0, currentWeight: r.weight, recommendedWeight: r.weight });
  }

  // feature accumulators
  type FAcc = { total: number; fraud: number; legit: number };
  const feat: Record<string, FAcc> = {};
  const fAdd = (name: string, has: boolean, l?: InvestigationOutcome) => {
    if (!has) return;
    const a = (feat[name] ??= { total: 0, fraud: 0, legit: 0 });
    a.total++;
    if (isFraud(l)) a.fraud++;
    else if (isLegit(l)) a.legit++;
  };

  for (const t of raw) {
    const l = label(t.id);
    const labeled = l === "CONFIRMED_FRAUD" || l === "LEGITIMATE";
    if (labeled) labeledCount++;
    if (isFraud(l)) fraudTotal++;

    const c = cMap.get(t.customerId);
    const d = dMap.get(t.deviceId);
    const b = bMap.get(t.beneficiaryId);

    // customer
    if (c) {
      let p = cust.get(c.id);
      if (!p) { p = { id: c.id, name: c.name, segment: c.segment, region: c.region, totalTransactions: 0, confirmedFraudCount: 0, legitimateCount: 0, falsePositiveCount: 0, averageAmount: c.avgTxnAmount, amountStandardDeviation: c.amountStdDev, trustedDeviceRate: 0, knownBeneficiaryRate: 0, normalHourStart: c.normalHourStart, normalHourEnd: c.normalHourEnd, historicalRiskRate: 0, trustScore: c.trustScore }; cust.set(c.id, p); }
      p.totalTransactions++;
      if (isFraud(l)) p.confirmedFraudCount++;
      if (isLegit(l)) p.legitimateCount++;
      if (isFP(t, l)) p.falsePositiveCount++;
      if (d?.known) p.trustedDeviceRate++;
      if (b?.known) p.knownBeneficiaryRate++;
    }

    // device
    if (d) {
      let p = dev.get(d.id);
      if (!p) { p = { id: d.id, label: d.label, known: d.known, firstSeenAt: t.timestamp, lastSeenAt: t.timestamp, successfulTransactionCount: 0, fraudCount: 0, legitimateCount: 0, customerCount: 0, trustScore: d.trustScore }; dev.set(d.id, p); }
      p.successfulTransactionCount++;
      if (t.timestamp < p.firstSeenAt) p.firstSeenAt = t.timestamp;
      if (t.timestamp > p.lastSeenAt) p.lastSeenAt = t.timestamp;
      if (isFraud(l)) p.fraudCount++;
      if (isLegit(l)) p.legitimateCount++;
      (devCustomers.get(d.id) ?? devCustomers.set(d.id, new Set()).get(d.id)!).add(t.customerId);
    }

    // beneficiary
    if (b) {
      let p = ben.get(b.id);
      if (!p) { p = { id: b.id, name: b.name, type: b.type, firstSeenAt: t.timestamp, successfulTransactionCount: 0, fraudCount: 0, legitimateCount: 0, uniqueSenderCount: 0, trustScore: b.trustScore }; ben.set(b.id, p); }
      p.successfulTransactionCount++;
      if (t.timestamp < p.firstSeenAt) p.firstSeenAt = t.timestamp;
      if (isFraud(l)) p.fraudCount++;
      if (isLegit(l)) p.legitimateCount++;
      (benSenders.get(b.id) ?? benSenders.set(b.id, new Set()).get(b.id)!).add(t.customerId);
    }

    // channel + segment groups
    const gc = group(chan, t.channel);
    gc.totalTransactions++;
    if (isFraud(l)) gc.confirmedFraudCount++;
    if (isLegit(l)) gc.legitimateCount++;
    if (isFP(t, l)) gc.falsePositiveCount++;
    if (c) {
      const gs = group(seg, c.segment);
      gs.totalTransactions++;
      if (isFraud(l)) gs.confirmedFraudCount++;
      if (isLegit(l)) gs.legitimateCount++;
      if (isFP(t, l)) gs.falsePositiveCount++;
    }

    // rules
    for (const rid of t.triggeredRuleIds) {
      const rp = ruleAcc.get(rid);
      if (!rp) continue;
      rp.triggerCount++;
      if (isFraud(l)) { rp.confirmedFraudCount++; rp.estimatedLossPrevented += AVG_FRAUD_LOSS; }
      if (isLegit(l)) rp.legitimateCount++;
      if (isFP(t, l)) { rp.falsePositiveCount++; rp.estimatedRevenueLost += t.amount * 0.02 + AVG_REVENUE; }
    }

    // feature statistics
    fAdd("TRUSTED_DEVICE", !!d?.known, l);
    fAdd("NEW_DEVICE", !d?.known, l);
    fAdd("KNOWN_BENEFICIARY", !!b?.known, l);
    fAdd("NEW_BENEFICIARY", !b?.known, l);
    fAdd("MFA_PASS", t.mfaPassed, l);
    fAdd("MFA_FAIL", !t.mfaPassed, l);
    fAdd("HIGH_VELOCITY", t.velocity1h >= 5, l);
    fAdd("FAILED_LOGINS", t.failedLogins > 0, l);
    fAdd("UNUSUAL_TIME", !t.timeFamiliar, l);
    fAdd("PASSWORD_RESET", t.passwordResetRecently, l);
  }

  const baseFraudRate = labeledCount > 0 ? fraudTotal / labeledCount : 0.03;

  // finalize customers (rates + learned trust)
  for (const p of cust.values()) {
    const n = Math.max(1, p.totalTransactions);
    p.trustedDeviceRate = +(p.trustedDeviceRate / n).toFixed(3);
    p.knownBeneficiaryRate = +(p.knownBeneficiaryRate / n).toFixed(3);
    const labeledC = p.confirmedFraudCount + p.legitimateCount;
    p.historicalRiskRate = labeledC > 0 ? +(p.confirmedFraudCount / labeledC).toFixed(3) : 0;
    p.trustScore = Math.round(Math.max(20, Math.min(99, 70 + p.legitimateCount * 1.5 - p.confirmedFraudCount * 25 + p.trustedDeviceRate * 12)));
  }
  for (const p of dev.values()) {
    p.customerCount = devCustomers.get(p.id)?.size ?? 1;
    const labeledD = p.fraudCount + p.legitimateCount;
    const legitShare = labeledD > 0 ? p.legitimateCount / labeledD : (p.known ? 0.9 : 0.4);
    p.trustScore = Math.round(Math.max(4, Math.min(99, legitShare * 70 + Math.min(p.successfulTransactionCount, 60) * 0.4 - p.fraudCount * 20 - Math.max(0, p.customerCount - 2) * 8)));
  }
  for (const p of ben.values()) {
    p.uniqueSenderCount = benSenders.get(p.id)?.size ?? 1;
    const labeledB = p.fraudCount + p.legitimateCount;
    const legitShare = labeledB > 0 ? p.legitimateCount / labeledB : (p.type === "INTERNATIONAL" ? 0.5 : 0.8);
    p.trustScore = Math.round(Math.max(4, Math.min(96, legitShare * 60 + Math.min(p.successfulTransactionCount, 40) - p.fraudCount * 18)));
  }
  for (const g of [...chan.values(), ...seg.values()]) {
    const labeled = g.confirmedFraudCount + g.legitimateCount;
    g.fraudRate = labeled > 0 ? +(g.confirmedFraudCount / labeled).toFixed(3) : 0;
    g.falsePositiveRate = g.totalTransactions > 0 ? +(g.falsePositiveCount / g.totalTransactions).toFixed(3) : 0;
    g.riskScore = Math.round(Math.min(100, g.fraudRate * 260 + g.falsePositiveRate * 40));
  }
  for (const rp of ruleAcc.values()) {
    rp.precision = rp.triggerCount > 0 ? +((rp.confirmedFraudCount / rp.triggerCount) * 100).toFixed(1) : 0;
    const labeledR = rp.confirmedFraudCount + rp.legitimateCount + rp.falsePositiveCount;
    rp.falsePositiveRate = labeledR > 0 ? +((rp.falsePositiveCount / labeledR) * 100).toFixed(1) : 0;
    rp.estimatedLossPrevented = Math.round(rp.estimatedLossPrevented);
    rp.estimatedRevenueLost = Math.round(rp.estimatedRevenueLost);
    // recommended weight: high FP + low precision → lower weight
    const factor = rp.falsePositiveRate >= 60 ? 0.5 : rp.falsePositiveRate >= 40 ? 0.68 : rp.falsePositiveRate >= 25 ? 0.82 : 1;
    rp.recommendedWeight = Math.max(4, Math.round(rp.currentWeight * factor));
  }

  const features: FeatureStatistic[] = Object.entries(feat).map(([feature, a]) => {
    const labeledF = a.fraud + a.legit;
    const fraudRate = labeledF > 0 ? a.fraud / labeledF : 0;
    return { feature, totalWithFeature: a.total, fraudWithFeature: a.fraud, legitWithFeature: a.legit, fraudRate: +fraudRate.toFixed(4), weightHint: +(fraudRate * 100).toFixed(1) };
  }).sort((x, y) => y.fraudRate - x.fraudRate);

  return { customers: cust, devices: dev, beneficiaries: ben, channels: chan, segments: seg, rules: ruleAcc, features, labeledCount, baseFraudRate: +baseFraudRate.toFixed(4) };
}
