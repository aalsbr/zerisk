// ============================================================================
// ZeRisk — Core domain types (single source of truth for the whole app)
// ============================================================================

export type Decision = "APPROVE" | "REVIEW" | "REJECT" | "MONITOR";

export type Channel = "MOBILE" | "WEB" | "POS" | "ATM" | "WALLET" | "BRANCH";

export type CustomerSegment =
  | "RETAIL"
  | "PREMIER"
  | "PRIVATE"
  | "SME"
  | "CORPORATE";

export type RuleStatus = "ACTIVE" | "MONITORING" | "DISABLED";
export type RuleSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type BeneficiaryType =
  | "INTERNAL"
  | "EXTERNAL"
  | "INTERNATIONAL"
  | "WALLET";

export type DeviceType = "MOBILE_IOS" | "MOBILE_ANDROID" | "DESKTOP" | "TABLET";

export type ScenarioType =
  | "FALSE_POSITIVE"
  | "CONFIRMED_FRAUD"
  | "LOW_RISK"
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
  txnCount30d: number;
  homeCity: string;
  homeCityEn: string;
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
  deviceId: string;
  beneficiaryId: string;
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
  locationFamiliar: boolean;
  timeFamiliar: boolean;
  // ground truth (used to measure the engine, never shown as "the answer")
  isActuallyFraud: boolean;
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
