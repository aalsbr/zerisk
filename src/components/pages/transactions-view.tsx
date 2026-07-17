"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Download,
  Search,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  Smartphone,
  ShieldAlert,
} from "lucide-react";
import { PageHeader, DisclaimerBar, EmptyState } from "@/components/shared/misc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/misc";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { DecisionBadge } from "@/components/shared/decision-badge";
import { riskColor } from "@/components/shared/risk-gauge";
import { useI18n } from "@/providers";
import {
  DECISION_LABEL,
  CHANNEL_LABEL,
  SEGMENT_LABEL,
} from "@/lib/i18n";
import { fmtNumber, fmtDateTime, fmtPercent } from "@/lib/format";
import type {
  Channel,
  CustomerSegment,
  Decision,
  BeneficiaryType,
} from "@/lib/types";

export interface TxnRow {
  id: string;
  customerId: string;
  customerName: string;
  customerNameEn: string;
  segment: CustomerSegment;
  amount: number;
  currency: string;
  channel: Channel;
  deviceId: string;
  deviceKnown: boolean;
  beneficiaryName: string;
  beneficiaryNameEn: string;
  beneficiaryType: BeneficiaryType;
  timestamp: string;
  originalDecision: Decision;
  originalRiskScore: number;
  aiRecommendation: Decision;
  optimizedRiskScore: number;
  falsePositiveProbability: number;
  confidence: number;
  processingTimeMs: number;
  triggeredRuleIds: string[];
  isFalsePositive: boolean;
  hasFeedback: boolean;
}

interface RuleOption {
  id: string;
  name: string;
  nameEn: string;
}

type SortKey =
  | "amount"
  | "originalRiskScore"
  | "optimizedRiskScore"
  | "falsePositiveProbability"
  | "timestamp";

const PAGE_SIZE = 10;

const DECISIONS: Decision[] = ["APPROVE", "REVIEW", "REJECT", "MONITOR"];
const CHANNELS: Channel[] = ["MOBILE_APP", "WEB", "POS", "ATM", "INTERNAL_TRANSFER", "VIBAN_CREDIT", "LOAN_REPAYMENT", "LOAN_DISBURSEMENT", "WALLET_TRANSFER"];
const SEGMENTS: CustomerSegment[] = ["RETAIL", "SME", "PREMIUM", "NEW_CUSTOMER", "LONG_TERM_CUSTOMER", "HIGH_VALUE_CUSTOMER"];

function riskLevel(score: number): "low" | "medium" | "high" | "critical" {
  if (score <= 34) return "low";
  if (score <= 59) return "medium";
  if (score <= 79) return "high";
  return "critical";
}

function RiskPill({ score }: { score: number }) {
  const color = riskColor(score);
  return (
    <span
      className="inline-flex min-w-9 items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums"
      style={{ color, backgroundColor: `${color}1a`, border: `1px solid ${color}40` }}
    >
      {Math.round(score)}
    </span>
  );
}

export function TransactionsView({
  rows,
  ruleOptions,
  initialQuery,
}: {
  rows: TxnRow[];
  ruleOptions: RuleOption[];
  initialQuery: string;
}) {
  const { t, lang, pick, tr } = useI18n();

  const [query, setQuery] = useState(initialQuery);
  const [originalDecision, setOriginalDecision] = useState("");
  const [aiDecision, setAiDecision] = useState("");
  const [risk, setRisk] = useState("");
  const [channel, setChannel] = useState("");
  const [segment, setSegment] = useState("");
  const [rule, setRule] = useState("");
  const [minFp, setMinFp] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [fpOnly, setFpOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("timestamp");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);

  const allOpt = { value: "", label: t("common.all") };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const minFpNum = minFp ? Number(minFp) : null;
    const minAmountNum = minAmount ? Number(minAmount) : null;

    return rows.filter((r) => {
      if (q) {
        const hay = [
          r.id,
          r.customerId,
          r.customerName,
          r.customerNameEn,
          r.deviceId,
          r.beneficiaryName,
          r.beneficiaryNameEn,
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (originalDecision && r.originalDecision !== originalDecision) return false;
      if (aiDecision && r.aiRecommendation !== aiDecision) return false;
      if (risk && riskLevel(r.optimizedRiskScore) !== risk) return false;
      if (channel && r.channel !== channel) return false;
      if (segment && r.segment !== segment) return false;
      if (rule && !r.triggeredRuleIds.includes(rule)) return false;
      if (minFpNum != null && r.falsePositiveProbability < minFpNum) return false;
      if (minAmountNum != null && r.amount < minAmountNum) return false;
      if (fpOnly && !r.isFalsePositive) return false;
      return true;
    });
  }, [
    rows,
    query,
    originalDecision,
    aiDecision,
    risk,
    channel,
    segment,
    rule,
    minFp,
    minAmount,
    fpOnly,
  ]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let av: number;
      let bv: number;
      if (sortKey === "timestamp") {
        av = new Date(a.timestamp).getTime();
        bv = new Date(b.timestamp).getTime();
      } else {
        av = a[sortKey];
        bv = b[sortKey];
      }
      return sortDir === "asc" ? av - bv : bv - av;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const pageRows = sorted.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
    setPage(0);
  }

  function resetFilters() {
    setQuery("");
    setOriginalDecision("");
    setAiDecision("");
    setRisk("");
    setChannel("");
    setSegment("");
    setRule("");
    setMinFp("");
    setMinAmount("");
    setFpOnly(false);
    setPage(0);
  }

  const sortHeader = (label: string, key: SortKey) => {
    const active = sortKey === key;
    const Icon = !active ? ChevronsUpDown : sortDir === "asc" ? ChevronUp : ChevronDown;
    return (
      <button
        type="button"
        onClick={() => toggleSort(key)}
        className={`inline-flex items-center gap-1 transition-colors hover:text-slate-900 ${
          active ? "text-coral-600" : ""
        }`}
      >
        {label}
        <Icon className="size-3.5" />
      </button>
    );
  };

  const decisionOptions = [
    allOpt,
    ...DECISIONS.map((d) => ({ value: d, label: tr(DECISION_LABEL[d]) })),
  ];
  const riskOptions = [
    allOpt,
    { value: "low", label: pick("منخفضة", "Low") },
    { value: "medium", label: pick("متوسطة", "Medium") },
    { value: "high", label: pick("عالية", "High") },
    { value: "critical", label: pick("حرجة", "Critical") },
  ];
  const channelOptions = [
    allOpt,
    ...CHANNELS.map((c) => ({ value: c, label: tr(CHANNEL_LABEL[c]) })),
  ];
  const segmentOptions = [
    allOpt,
    ...SEGMENTS.map((s) => ({ value: s, label: tr(SEGMENT_LABEL[s]) })),
  ];
  const ruleFilterOptions = [
    allOpt,
    ...ruleOptions.map((r) => ({ value: r.id, label: `${r.id} — ${pick(r.name, r.nameEn)}` })),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("page.transactions.title")}
        subtitle={t("page.transactions.subtitle")}
        actions={
          <Button variant="secondary" size="sm">
            <Download className="size-4" />
            {t("common.export")}
          </Button>
        }
      />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="space-y-5"
      >
        {/* Filters */}
        <Card className="p-5">
          <div className="flex flex-col gap-4">
            <div className="relative">
              <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <Input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(0);
                }}
                placeholder={t("common.searchFull")}
                className="ps-9"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
              <div className="flex flex-col gap-1">
                <Label>{t("common.original")}</Label>
                <Select
                  options={decisionOptions}
                  value={originalDecision}
                  onChange={(e) => {
                    setOriginalDecision(e.target.value);
                    setPage(0);
                  }}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label>{t("common.aiReco")}</Label>
                <Select
                  options={decisionOptions}
                  value={aiDecision}
                  onChange={(e) => {
                    setAiDecision(e.target.value);
                    setPage(0);
                  }}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label>{pick("مستوى المخاطر", "Risk level")}</Label>
                <Select
                  options={riskOptions}
                  value={risk}
                  onChange={(e) => {
                    setRisk(e.target.value);
                    setPage(0);
                  }}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label>{pick("القناة", "Channel")}</Label>
                <Select
                  options={channelOptions}
                  value={channel}
                  onChange={(e) => {
                    setChannel(e.target.value);
                    setPage(0);
                  }}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label>{pick("شريحة العميل", "Customer segment")}</Label>
                <Select
                  options={segmentOptions}
                  value={segment}
                  onChange={(e) => {
                    setSegment(e.target.value);
                    setPage(0);
                  }}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label>{pick("القاعدة المُفعّلة", "Triggered rule")}</Label>
                <Select
                  options={ruleFilterOptions}
                  value={rule}
                  onChange={(e) => {
                    setRule(e.target.value);
                    setPage(0);
                  }}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label>{pick("أدنى احتمالية رفض خاطئ %", "Min FP probability %")}</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={minFp}
                  onChange={(e) => {
                    setMinFp(e.target.value);
                    setPage(0);
                  }}
                  placeholder="0"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label>{pick("أدنى مبلغ", "Min amount")}</Label>
                <Input
                  type="number"
                  min={0}
                  value={minAmount}
                  onChange={(e) => {
                    setMinAmount(e.target.value);
                    setPage(0);
                  }}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                <Switch checked={fpOnly} onCheckedChange={(v) => { setFpOnly(v); setPage(0); }} />
                {pick("الرفض الخاطئ فقط", "False positives only")}
              </label>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted">
                  {fmtNumber(sorted.length)} {pick("نتيجة", "results")}
                </span>
                <Button variant="ghost" size="sm" onClick={resetFilters}>
                  {t("common.reset")}
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Table */}
        <Card className="p-2">
          {pageRows.length === 0 ? (
            <EmptyState />
          ) : (
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>{pick("رقم العملية", "Transaction ID")}</TH>
                  <TH>{pick("العميل", "Customer")}</TH>
                  <TH>{sortHeader(pick("المبلغ", "Amount"), "amount")}</TH>
                  <TH>{pick("القناة", "Channel")}</TH>
                  <TH>{pick("الجهاز", "Device")}</TH>
                  <TH>{pick("المستفيد", "Beneficiary")}</TH>
                  <TH>{t("common.original")}</TH>
                  <TH>{sortHeader(t("common.originalScore"), "originalRiskScore")}</TH>
                  <TH>{t("common.aiReco")}</TH>
                  <TH>{sortHeader(t("common.optimizedScore"), "optimizedRiskScore")}</TH>
                  <TH>{sortHeader(t("common.fpProbability"), "falsePositiveProbability")}</TH>
                  <TH>{t("common.confidence")}</TH>
                  <TH>{pick("زمن المعالجة", "Processing")}</TH>
                  <TH>{sortHeader(pick("التاريخ والوقت", "Date/Time"), "timestamp")}</TH>
                  <TH>{pick("الحالة", "Status")}</TH>
                </TR>
              </THead>
              <TBody>
                {pageRows.map((r) => (
                  <TR key={r.id} className="cursor-pointer">
                    <TD className="font-mono text-xs">
                      <Link href={`/transactions/${r.id}`} className="block text-coral-600 hover:underline">
                        {r.id}
                      </Link>
                    </TD>
                    <TD>
                      <Link href={`/transactions/${r.id}`} className="block">
                        <span className="font-medium text-slate-900">{pick(r.customerName, r.customerNameEn)}</span>
                        <span className="block text-[11px] text-muted">
                          {tr(SEGMENT_LABEL[r.segment])} · {r.customerId}
                        </span>
                      </Link>
                    </TD>
                    <TD className="tabular-nums">
                      <Link href={`/transactions/${r.id}`} className="block">
                        <span className="font-semibold text-slate-900">{fmtNumber(r.amount)}</span>{" "}
                        <span className="text-[11px] text-muted">{r.currency}</span>
                      </Link>
                    </TD>
                    <TD>{tr(CHANNEL_LABEL[r.channel])}</TD>
                    <TD>
                      <span className="inline-flex items-center gap-1">
                        <Smartphone className="size-3.5 text-muted" />
                        <Badge variant={r.deviceKnown ? "success" : "warning"}>
                          {r.deviceKnown ? pick("معروف", "Known") : pick("جديد", "New")}
                        </Badge>
                      </span>
                    </TD>
                    <TD>
                      <span className="text-slate-700">{pick(r.beneficiaryName, r.beneficiaryNameEn)}</span>
                      <span className="block text-[11px] text-muted">{r.beneficiaryType}</span>
                    </TD>
                    <TD>
                      <DecisionBadge decision={r.originalDecision} />
                    </TD>
                    <TD>
                      <RiskPill score={r.originalRiskScore} />
                    </TD>
                    <TD>
                      <DecisionBadge decision={r.aiRecommendation} />
                    </TD>
                    <TD>
                      <RiskPill score={r.optimizedRiskScore} />
                    </TD>
                    <TD className="tabular-nums">{fmtPercent(r.falsePositiveProbability, 0)}</TD>
                    <TD className="tabular-nums">{fmtPercent(r.confidence, 0)}</TD>
                    <TD className="tabular-nums text-muted">{r.processingTimeMs} ms</TD>
                    <TD className="text-xs text-muted">{fmtDateTime(r.timestamp, lang)}</TD>
                    <TD>
                      {r.isFalsePositive ? (
                        <Badge variant="coral">
                          <ShieldAlert className="size-3" />
                          {pick("رفض خاطئ", "False positive")}
                        </Badge>
                      ) : r.hasFeedback ? (
                        <Badge variant="info">{pick("تمت المراجعة", "Reviewed")}</Badge>
                      ) : (
                        <Badge variant="muted">{pick("نشطة", "Live")}</Badge>
                      )}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>

        {/* Pagination */}
        {sorted.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-muted">
              {t("common.page")} {current + 1} {t("common.of")} {pageCount}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={current === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                <ChevronRight className="size-4 rtl:hidden" />
                <ChevronLeft className="hidden size-4 rtl:block" />
                {pick("السابق", "Prev")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={current >= pageCount - 1}
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              >
                {pick("التالي", "Next")}
                <ChevronLeft className="size-4 rtl:hidden" />
                <ChevronRight className="hidden size-4 rtl:block" />
              </Button>
            </div>
          </div>
        )}

        <DisclaimerBar />
      </motion.div>
    </div>
  );
}
