// ============================================================================
// ZeRisk — Core domain types (single source of truth for the whole app)
// ============================================================================

export type Decision = "APPROVE" | "REVIEW" | "REJECT" | "MONITOR";

export type Channel =
  | "MOBILE_APP"
  | "WEB"
  | "POS"
  | "ATM"
  | "INTERNAL_TRANSFER"
  | "VIBAN_CREDIT"
  | "LOAN_REPAYMENT"
  | "LOAN_DISBURSEMENT"
  | "WALLET_TRANSFER";

export type CustomerSegment =
  | "RETAIL"
  | "SME"
  | "PREMIUM"
  | "NEW_CUSTOMER"
  | "LONG_TERM_CUSTOMER"
  | "HIGH_VALUE_CUSTOMER";

export type Region =
  | "RIYADH"
  | "MAKKAH"
  | "EASTERN"
  | "MADINAH"
  | "QASSIM"
  | "ASIR";

export type TxnCategory =
  | "TRANSFER"
  | "PAYMENT"
  | "SUPPLIER"
  | "SALARY"
  | "LOAN"
  | "PURCHASE"
  | "WALLET";

export type RuleStatus = "ACTIVE" | "MONITORING" | "DISABLED";
export type RuleSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type BeneficiaryType =
  | "INTERNAL"
  | "EXTERNAL"
  | "INTERNATIONAL"
  | "WALLET";

export type DeviceType = "MOBILE_IOS" | "MOBILE_ANDROID" | "DESKTOP" | "TABLET";

export type ScenarioType =
  | "FALSE_POSITIVE" // legit rejected/reviewed by legacy (FP)
  | "CONFIRMED_FRAUD" // fraud caught by legacy (TP)
  | "LOW_RISK" // legit approved by legacy (TN)
  | "FALSE_NEGATIVE" // fraud approved by legacy (FN) — AI must catch
  | "AMBIGUOUS"
  | "RULE_FAILURE"
  | "NORMAL";

export type InvestigationOutcome =
  | "LEGITIMATE"
  | "CONFIRMED_FRAUD"
  | "INCONCLUSIVE"
  | "PENDING";

export type Role =
  | "EXECUTIVE"
  | "FRAUD_MANAGER"
  | "INVESTIGATOR"
  | "DATA_SCIENTIST"
  | "AUDITOR"
  | "ADMINISTRATOR";

export interface Customer {
  id: string;
  name: string;
  nameEn: string;
  nationalIdMasked: string;
  segment: CustomerSegment;
  accountAgeMonths: number;
  avgTxnAmount: number;
  amountStdDev: number; // baseline spread
  txnCount30d: number;
  homeCity: string;
  homeCityEn: string;
  region: Region;
  normalHourStart: number; // baseline active hours
  normalHourEnd: number;
  trustScore: number; // 0-100
}

export interface Device {
  id: string;
  type: DeviceType;
  label: string;
  known: boolean;
  firstSeenDaysAgo: number;
  txnCount: number;
  trustScore: number; // 0-100
}

export interface Beneficiary {
  id: string;
  name: string;
  nameEn: string;
  bank: string;
  type: BeneficiaryType;
  known: boolean;
  txnCount: number;
  firstSeenDaysAgo: number;
  trustScore: number; // 0-100
}

export interface FraudRule {
  id: string; // FR-017
  name: string;
  nameEn: string;
  description: string;
  descriptionEn: string;
  category: string;
  categoryEn: string;
  status: RuleStatus;
  severity: RuleSeverity;
  action: Decision; // action the rule triggers in the legacy engine
  weight: number; // contribution to legacy risk score
  amountThreshold?: number;
}

// ---- Scoring engine contract -------------------------------------------------

export type ReasonCode =
  | "TRUSTED_DEVICE"
  | "KNOWN_BENEFICIARY"
  | "SUCCESSFUL_MFA"
  | "NORMAL_BEHAVIOR"
  | "NORMAL_AMOUNT"
  | "FAMILIAR_LOCATION"
  | "LONG_TENURE"
  | "CLEAN_HISTORY"
  | "SIMILAR_LEGIT"
  | "NEW_DEVICE"
  | "NEW_BENEFICIARY"
  | "MFA_FAILED"
  | "HIGH_VELOCITY"
  | "UNUSUAL_AMOUNT"
  | "UNUSUAL_TIME"
  | "UNFAMILIAR_LOCATION"
  | "FAILED_LOGINS"
  | "HISTORICAL_FRAUD"
  | "HIGH_SEVERITY_RULE";

export interface ScoringInput {
  originalRiskScore: number;
  amount: number;
  customerAvgAmount: number;
  deviceKnown: boolean;
  deviceAgeDays: number;
  deviceTxnCount: number;
  beneficiaryKnown: boolean;
  beneficiaryTxnCount: number;
  accountAgeMonths: number;
  velocity1h: number; // transactions in the last hour
  failedLogins: number;
  mfaPassed: boolean;
  locationFamiliar: boolean;
  timeFamiliar: boolean;
  historicalFraudCount: number;
  historicalLegitCount: number;
  triggeredRuleSeverities: RuleSeverity[];
  similarLegitOutcomes: number; // similar past transactions confirmed legit
  similarFraudOutcomes: number; // similar past transactions confirmed fraud
  investigatorConfirmedLegit?: boolean;
  passwordResetRecently?: boolean;
  // ---- learned signals (from adaptive risk profiles / calibration) ----
  deviceLegitCount?: number; // confirmed-legit outcomes on this device
  deviceFraudCount?: number;
  deviceCustomerCount?: number; // shared-device signal
  beneficiaryLegitCount?: number;
  beneficiaryFraudCount?: number;
  segmentFraudRate?: number; // 0-1, learned
  channelFraudRate?: number; // 0-1, learned
  ruleWeightFactor?: number; // avg learned weight multiplier of triggered rules
}

export interface RiskBreakdown {
  device: number;
  behavioral: number;
  beneficiary: number;
  velocity: number;
  location: number;
  historical: number;
}

export interface ReasonDetail {
  code: ReasonCode;
  ar: string;
  en: string;
  weight: number; // signed contribution used for explanation ordering
}

export interface ScoringResult {
  optimizedRiskScore: number; // 0-100
  falsePositiveProbability: number; // 0-100
  recommendation: Decision;
  confidence: number; // 0-100
  reasonCodes: ReasonCode[];
  riskBreakdown: RiskBreakdown;
  supporting: ReasonDetail[]; // reasons supporting approval
  increasing: ReasonDetail[]; // reasons increasing risk
  processingTimeMs: number;
}

// ---- Transactions ------------------------------------------------------------

export interface Transaction {
  id: string;
  customerId: string;
  amount: number;
  currency: string;
  channel: Channel;
  category: TxnCategory;
  deviceId: string;
  beneficiaryId: string;
  region: Region;
  timestamp: string; // ISO
  hour: number;
  // legacy engine
  originalDecision: Decision;
  originalRiskScore: number;
  triggeredRuleIds: string[];
  // scoring signals
  mfaPassed: boolean;
  failedLogins: number;
  velocity1h: number;
  passwordResetRecently: boolean;
  locationFamiliar: boolean;
  timeFamiliar: boolean;
  // ground truth (used to measure the engine, never shown as "the answer")
  isActuallyFraud: boolean;
  // confirmed investigator label (present for "labeled" transactions); the
  // learning loop calibrates from these.
  outcome?: InvestigationOutcome;
  scenario: ScenarioType;
  processingTimeMs: number;
}

export interface InvestigatorFeedback {
  outcome: InvestigationOutcome;
  note?: string;
  investigator: string;
  resolutionMinutes: number;
  at: string; // ISO
}

export interface EnrichedTransaction extends Transaction {
  customer: Customer;
  device: Device;
  beneficiary: Beneficiary;
  ai: ScoringResult;
  rules: FraudRule[];
  isFalsePositive: boolean; // legacy said reject/review but legit & AI approves/monitors
  feedback?: InvestigatorFeedback;
}

// ---- Analytics / rule stats --------------------------------------------------

export interface RuleStat {
  rule: FraudRule;
  triggerCount: number;
  confirmedFraud: number;
  falsePositives: number;
  precision: number; // 0-100
  falsePositiveRate: number; // 0-100
  financialImpact: number; // SAR of false declines caused
  recommendationKey: RuleRecommendationKey;
}

export type RuleRecommendationKey =
  | "REDUCE_WEIGHT"
  | "INCREASE_THRESHOLD"
  | "ADD_HISTORY_EXCEPTION"
  | "ADD_TRUSTED_DEVICE"
  | "REJECT_TO_REVIEW"
  | "COMBINE"
  | "MONITOR"
  | "DISABLE"
  | "KEEP";

// ---- Insights ----------------------------------------------------------------

export type InsightSeverity = "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type InsightStatus = "NEW" | "REVIEWED" | "ACCEPTED" | "DISMISSED";

export interface Insight {
  id: string;
  titleAr: string;
  titleEn: string;
  category: string;
  categoryEn: string;
  severity: InsightSeverity;
  evidenceAr: string;
  evidenceEn: string;
  financialImpact: number;
  actionAr: string;
  actionEn: string;
  confidence: number;
  status: InsightStatus;
  createdAt: string;
}

// ---- Monthly metrics ---------------------------------------------------------

export interface MonthlyMetric {
  month: string; // 2026-01
  label: string;
  totalTransactions: number;
  fpRateBefore: number;
  fpRateAfter: number;
  recoveredTransactions: number;
  revenueRecovered: number;
  fraudPrevented: number;
  manualReviews: number;
  manualReviewsReduced: number;
  customerFriction: number; // index 0-100
  accuracy: number;
  precision: number;
  recall: number;
  falseNegativeRate: number;
  drift: number;
}

// ---- Integrations ------------------------------------------------------------

export interface Integration {
  id: string;
  name: string;
  nameEn: string;
  category: string;
  categoryEn: string;
  connected: boolean;
  lastSync: string;
  transactionsProcessed: number;
  avgLatencyMs: number;
  health: "HEALTHY" | "DEGRADED" | "DOWN";
}

// ---- Financial ---------------------------------------------------------------

export interface FinancialAssumptions {
  avgRevenuePerTxn: number;
  investigationCost: number;
  supportCost: number;
  churnCost: number;
  avgFraudLoss: number;
  monthlyVolume: number;
  platformMonthlyCost: number;
}

export interface FinancialResult {
  revenueRecovered: number;
  manualReviewSavings: number;
  supportSavings: number;
  retentionValue: number;
  fraudExposure: number;
  platformCost: number;
  netMonthly: number;
  netAnnual: number;
  monthlyRoi: number;
  annualRoi: number;
  paybackMonths: number;
  scenarios: {
    conservative: number;
    expected: number;
    optimistic: number;
  };
}

// ============================================================================
// Adaptive risk profiles (recalculated from stored data + labels)
// ============================================================================

export interface CustomerProfile {
  id: string;
  name: string;
  segment: CustomerSegment;
  region: Region;
  totalTransactions: number;
  confirmedFraudCount: number;
  legitimateCount: number;
  falsePositiveCount: number;
  averageAmount: number;
  amountStandardDeviation: number;
  trustedDeviceRate: number; // 0-1
  knownBeneficiaryRate: number; // 0-1
  normalHourStart: number;
  normalHourEnd: number;
  historicalRiskRate: number; // 0-1 confirmed-fraud share
  trustScore: number; // 0-100
}

export interface DeviceProfile {
  id: string;
  label: string;
  known: boolean;
  firstSeenAt: string;
  lastSeenAt: string;
  successfulTransactionCount: number;
  fraudCount: number;
  legitimateCount: number;
  customerCount: number; // unique customers on this device
  trustScore: number; // 0-100, learned
}

export interface BeneficiaryProfile {
  id: string;
  name: string;
  type: BeneficiaryType;
  firstSeenAt: string;
  successfulTransactionCount: number;
  fraudCount: number;
  legitimateCount: number;
  uniqueSenderCount: number;
  trustScore: number; // learned
}

export interface RuleProfile {
  id: string;
  name: string;
  nameEn: string;
  severity: RuleSeverity;
  action: Decision;
  triggerCount: number;
  confirmedFraudCount: number;
  legitimateCount: number;
  falsePositiveCount: number;
  precision: number; // 0-100
  falsePositiveRate: number; // 0-100
  estimatedLossPrevented: number;
  estimatedRevenueLost: number;
  currentWeight: number;
  recommendedWeight: number;
}

export interface GroupProfile {
  key: string; // channel or segment value
  totalTransactions: number;
  confirmedFraudCount: number;
  legitimateCount: number;
  falsePositiveCount: number;
  fraudRate: number; // 0-1
  falsePositiveRate: number; // 0-1
  riskScore: number; // 0-100
}

export interface FeatureStatistic {
  feature: string; // e.g. TRUSTED_DEVICE, NEW_BENEFICIARY
  totalWithFeature: number;
  fraudWithFeature: number;
  legitWithFeature: number;
  fraudRate: number; // 0-1
  weightHint: number; // learned contribution hint
}

// ============================================================================
// Learning loop: calibration, model versions, learning events
// ============================================================================

export interface Calibration {
  version: string; // FL-MVP-1.x
  createdAt: string;
  labeledCount: number;
  // learned multipliers applied on top of the deterministic base weights
  deviceTrustBoost: number; // >0 reduces device risk for trusted devices
  beneficiaryHistoryBoost: number;
  velocityWeight: number;
  fpCalibration: number; // scales false-positive probability
  confidenceBias: number; // additive confidence adjustment
  ruleWeightAdjust: Record<string, number>; // ruleId -> multiplier (0-1)
  segmentRisk: Record<string, number>; // segment -> 0-1 learned risk
  channelRisk: Record<string, number>; // channel -> 0-1 learned risk
}

export interface ModelVersion {
  version: string; // FL-MVP-1.x
  createdAt: string;
  labeledCount: number;
  triggeredBy: string; // role/user
  note: string;
  metrics: {
    falsePositiveRate: number;
    recall: number;
    precision: number;
    accuracy: number;
  };
}

export interface LearningChange {
  field: string;
  before: number | string;
  after: number | string;
  deltaPct?: number;
  ar: string;
  en: string;
}

export interface LearningEvent {
  id: string;
  transactionId?: string;
  feedbackOutcome?: InvestigationOutcome;
  previousRecommendation?: Decision;
  finalOutcome?: InvestigationOutcome;
  affectedRules: string[];
  affectedFeatures: string[];
  changes: LearningChange[];
  previousVersion: string;
  newVersion: string;
  at: string;
  actor: string;
  ar: string;
  en: string;
}

export interface KpiSnapshot {
  totalTransactions: number;
  approved: number;
  rejected: number;
  underReview: number;
  monitored: number;
  falsePositivesDetected: number;
  fpRateBefore: number;
  fpRateAfter: number;
  recoveredTransactions: number;
  revenueRecovered: number;
  fraudPrevented: number;
  operationalCostSaved: number;
  frictionReductionPct: number;
  aiAgreementRate: number;
  avgDecisionTimeMs: number;
  avgConfidence: number;
  manualReviewReductionPct: number;
  // model quality (confusion over labeled/ground-truth)
  originalRecall: number;
  optimizedRecall: number;
  originalFpRate: number;
  optimizedFpRate: number;
  falseNegativesCaught: number;
}

export interface MvpEvidence {
  transactionsAnalyzed: number;
  labeledOutcomes: number;
  learningEvents: number;
  modelVersion: string;
  originalFalsePositiveRate: number;
  optimizedFalsePositiveRate: number;
  originalRecall: number;
  optimizedRecall: number;
  manualReviewsReduced: number;
  revenueRecovered: number;
  fraudExposureChange: number;
  lastRecalibrationAt: string;
  falseNegativesCaught: number;
  demoTransactionsPresent: boolean;
  generatedAt: string;
}
