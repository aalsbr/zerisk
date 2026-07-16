"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  SlidersHorizontal,
  ShieldCheck,
  Users,
  ScrollText,
  Save,
  RotateCcw,
  AlertTriangle,
  Crown,
  Search,
  FlaskConical,
  FileSearch,
  Settings2,
  Shield,
} from "lucide-react";
import { PageHeader, DisclaimerBar } from "@/components/shared/misc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch, Separator } from "@/components/ui/misc";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Dialog } from "@/components/ui/dialog";
import { useI18n, useToast } from "@/providers";
import { ROLE_LABEL, SEGMENT_LABEL } from "@/lib/i18n";
import { fmtDateTime, fmtNumber } from "@/lib/format";
import { saveGovernanceAction, resetDemoDataAction } from "@/app/actions";
import type { Governance } from "@/lib/scoring";
import type { CustomerSegment, Role } from "@/lib/types";

interface AuditRow {
  id: string;
  at: string;
  actor: string;
  action: string;
  detail: string;
}

const ROLE_ORDER: Role[] = [
  "EXECUTIVE",
  "FRAUD_MANAGER",
  "INVESTIGATOR",
  "DATA_SCIENTIST",
  "AUDITOR",
  "ADMINISTRATOR",
];

const ROLE_META: Record<Role, { icon: typeof Crown; ar: string; en: string }> = {
  EXECUTIVE: { icon: Crown, ar: "رؤية تنفيذية للقيمة التجارية والمؤشرات.", en: "Executive view of business value and KPIs." },
  FRAUD_MANAGER: { icon: Shield, ar: "إدارة القواعد والقرارات وتوصيات التحسين.", en: "Manages rules, decisions and optimization recommendations." },
  INVESTIGATOR: { icon: Search, ar: "معالجة قائمة العمل وتغذية حلقة التعلّم.", en: "Works the case queue and feeds the learning loop." },
  DATA_SCIENTIST: { icon: FlaskConical, ar: "مراقبة النموذج والانحراف وأداء التوصيات.", en: "Monitors the model, drift and recommendation quality." },
  AUDITOR: { icon: FileSearch, ar: "مراجعة سجل التدقيق والامتثال للحوكمة.", en: "Reviews the audit log and governance compliance." },
  ADMINISTRATOR: { icon: Settings2, ar: "ضبط العتبات والحوكمة وصلاحيات النظام.", en: "Configures thresholds, governance and system access." },
};

const SEGMENTS: CustomerSegment[] = ["RETAIL", "PREMIER", "PRIVATE", "SME", "CORPORATE"];

export function SettingsView({ governance, audit }: { governance: Governance; audit: AuditRow[] }) {
  const { t, lang, pick, tr } = useI18n();
  const { toast } = useToast();
  const [saving, startSave] = React.useTransition();
  const [resetting, startReset] = React.useTransition();
  const [resetOpen, setResetOpen] = React.useState(false);

  // Thresholds tab local state
  const [gov, setGov] = React.useState<Governance>(governance);
  const [autoApprovalLimit, setAutoApprovalLimit] = React.useState<number>(15000);

  // Governance tab local state
  const [protectedSegments, setProtectedSegments] = React.useState<CustomerSegment[]>([
    "PRIVATE",
    "CORPORATE",
  ]);
  const [highRiskCountries] = React.useState<string[]>(
    lang === "ar"
      ? ["كوريا الشمالية", "إيران", "دولة مجهولة", "شبكة VPN"]
      : ["North Korea", "Iran", "Unknown", "VPN network"],
  );
  const [retention, setRetention] = React.useState<string>("24");
  const [explanationRequired, setExplanationRequired] = React.useState(true);
  const [fourEyes, setFourEyes] = React.useState(true);

  function saveThresholds() {
    startSave(async () => {
      await saveGovernanceAction({
        approveMax: gov.approveMax,
        monitorMax: gov.monitorMax,
        reviewMax: gov.reviewMax,
        minConfidence: gov.minConfidence,
        maxOverrideAmount: gov.maxOverrideAmount,
      });
      toast({
        kind: "success",
        title: pick("تم حفظ العتبات", "Thresholds saved"),
        description: pick("تم تحديث إعدادات الحوكمة بنجاح.", "Governance settings updated successfully."),
      });
    });
  }

  function toggleSegment(s: CustomerSegment) {
    setProtectedSegments((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
  }

  function doReset() {
    startReset(async () => {
      await resetDemoDataAction();
      setResetOpen(false);
      toast({
        kind: "info",
        title: pick("تمت إعادة التعيين", "Demo data reset"),
        description: pick("عادت البيانات إلى حالتها الأولية.", "All demo data returned to its initial state."),
      });
    });
  }

  const retentionOptions = [
    { value: "12", label: pick("١٢ شهرًا", "12 months") },
    { value: "24", label: pick("٢٤ شهرًا", "24 months") },
    { value: "36", label: pick("٣٦ شهرًا", "36 months") },
    { value: "60", label: pick("٦٠ شهرًا", "60 months") },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("page.settings.title")}
        subtitle={t("page.settings.subtitle")}
        actions={
          <Button variant="destructive" size="sm" onClick={() => setResetOpen(true)}>
            <RotateCcw className="size-4" />
            {pick("إعادة تعيين بيانات العرض", "Reset demo data")}
          </Button>
        }
      />

      <Tabs defaultValue="thresholds">
        <TabsList>
          <TabsTrigger value="thresholds">
            <span className="inline-flex items-center gap-1.5">
              <SlidersHorizontal className="size-3.5" />
              {pick("التوصيات والعتبات", "Thresholds")}
            </span>
          </TabsTrigger>
          <TabsTrigger value="governance">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="size-3.5" />
              {pick("الحوكمة", "Governance")}
            </span>
          </TabsTrigger>
          <TabsTrigger value="roles">
            <span className="inline-flex items-center gap-1.5">
              <Users className="size-3.5" />
              {pick("الأدوار", "Roles")}
            </span>
          </TabsTrigger>
          <TabsTrigger value="audit">
            <span className="inline-flex items-center gap-1.5">
              <ScrollText className="size-3.5" />
              {pick("سجل التدقيق", "Audit log")}
            </span>
          </TabsTrigger>
        </TabsList>

        {/* ---------------- Thresholds ---------------- */}
        <TabsContent value="thresholds" className="mt-5">
          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <Card>
              <CardHeader>
                <CardTitle>{pick("عتبات التوصية", "Recommendation thresholds")}</CardTitle>
                <CardDescription>
                  {pick("درجة المخاطر المحسّنة (٠-١٠٠) تحدّد التوصية.", "The optimized risk score (0-100) drives the recommendation.")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <NumberField label={pick("حد الموافقة (≤)", "Approve max (≤)")} value={gov.approveMax} onChange={(v) => setGov((g) => ({ ...g, approveMax: v }))} />
                  <NumberField label={pick("حد المراقبة (≤)", "Monitor max (≤)")} value={gov.monitorMax} onChange={(v) => setGov((g) => ({ ...g, monitorMax: v }))} />
                  <NumberField label={pick("حد المراجعة (≤)", "Review max (≤)")} value={gov.reviewMax} onChange={(v) => setGov((g) => ({ ...g, reviewMax: v }))} />
                </div>

                <ScoreBands approveMax={gov.approveMax} monitorMax={gov.monitorMax} reviewMax={gov.reviewMax} pick={pick} />

                <Separator />

                <div className="grid gap-4 sm:grid-cols-3">
                  <NumberField label={pick("أدنى ثقة للموافقة %", "Min confidence %")} value={gov.minConfidence} onChange={(v) => setGov((g) => ({ ...g, minConfidence: v }))} />
                  <NumberField label={pick("أقصى مبلغ قابل للتجاوز", "Max override amount")} value={gov.maxOverrideAmount} onChange={(v) => setGov((g) => ({ ...g, maxOverrideAmount: v }))} step={1000} />
                  <NumberField label={pick("حد الموافقة التلقائية", "Auto-approval limit")} value={autoApprovalLimit} onChange={setAutoApprovalLimit} step={1000} />
                </div>

                <div className="flex justify-end">
                  <Button size="sm" onClick={saveThresholds} disabled={saving}>
                    <Save className="size-4" />
                    {saving ? pick("جارٍ الحفظ…", "Saving…") : t("common.save")}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{pick("كيف تُقرأ العتبات", "How thresholds read")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <BandRow color="bg-emerald-400" label={pick("موافقة", "Approve")} range={`0 – ${gov.approveMax}`} />
                <BandRow color="bg-sky-400" label={pick("مراقبة", "Monitor")} range={`${gov.approveMax + 1} – ${gov.monitorMax}`} />
                <BandRow color="bg-amber-400" label={pick("مراجعة", "Review")} range={`${gov.monitorMax + 1} – ${gov.reviewMax}`} />
                <BandRow color="bg-rose-400" label={pick("رفض", "Reject")} range={`${gov.reviewMax + 1} – 100`} />
                <Separator />
                <p className="text-xs text-muted">
                  {pick(
                    `لا يجوز للنظام تجاوز رفض قديم تلقائيًا لعملية تفوق قيمتها ${fmtNumber(gov.maxOverrideAmount)} ريال، أو عند ثقة أقل من ${gov.minConfidence}%.`,
                    `The system may not auto-approve a legacy reject above SAR ${fmtNumber(gov.maxOverrideAmount)}, or when confidence is below ${gov.minConfidence}%.`,
                  )}
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ---------------- Governance ---------------- */}
        <TabsContent value="governance" className="mt-5">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{pick("شرائح العملاء المحمية", "Protected customer segments")}</CardTitle>
                <CardDescription>{pick("تخضع دائمًا للمراجعة البشرية قبل الرفض التلقائي.", "Always subject to human review before any auto-decline.")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {SEGMENTS.map((s) => (
                  <label
                    key={s}
                    className="flex cursor-pointer items-center justify-between rounded-xl border border-navy-700/60 bg-navy-900/40 px-3 py-2.5"
                  >
                    <span className="text-sm text-slate-700">{tr(SEGMENT_LABEL[s])}</span>
                    <input
                      type="checkbox"
                      checked={protectedSegments.includes(s)}
                      onChange={() => toggleSegment(s)}
                      className="size-4 accent-coral-500"
                    />
                  </label>
                ))}
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>{pick("دول عالية الخطورة", "High-risk countries")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {highRiskCountries.map((c) => (
                      <Badge key={c} variant="danger">
                        <AlertTriangle className="size-3" />
                        {c}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{pick("قواعد مراجعة إلزامية", "Mandatory review rules")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-slate-700">
                    {[
                      pick("كل تحويل دولي جديد يفوق ٥٠٬٠٠٠ ريال", "Every new international transfer above SAR 50,000"),
                      pick("أول عملية من جهاز غير معروف", "First transaction from an unknown device"),
                      pick("أي تجاوز يخالف توصية عالية الخطورة", "Any override contradicting a high-severity rule"),
                    ].map((r, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-coral-600" />
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>{pick("الاحتفاظ والإصدارات", "Retention & versions")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label>{pick("مدة الاحتفاظ بسجل التدقيق", "Audit retention period")}</Label>
                  <div className="mt-1">
                    <Select options={retentionOptions} value={retention} onChange={(e) => setRetention(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <ReadOnly label={pick("إصدار النموذج", "Model version")} value="v2.4.1" />
                  <ReadOnly label={pick("إصدار القواعد", "Rule version")} value="v3.1.0" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{pick("ضوابط الحوكمة", "Governance controls")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <ToggleRow
                  label={pick("اشتراط التفسير", "Explanation requirement")}
                  hint={pick("كل توصية يجب أن تُرفق بمبرّرات قابلة للتدقيق.", "Every recommendation must ship auditable reasons.")}
                  checked={explanationRequired}
                  onChange={setExplanationRequired}
                />
                <Separator />
                <ToggleRow
                  label={pick("موافقة الأربع أعين", "Four-eyes approval")}
                  hint={pick("تجاوز القرارات عالية القيمة يتطلب مُعتمِدَين.", "High-value overrides require two approvers.")}
                  checked={fourEyes}
                  onChange={setFourEyes}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ---------------- Roles ---------------- */}
        <TabsContent value="roles" className="mt-5">
          <div className="mb-3 rounded-xl border border-sky-500/25 bg-sky-500/5 px-3.5 py-2.5 text-xs text-sky-200/90">
            {pick(
              "تبديل الدور متاح من الشريط العلوي (مبدّل الأدوار التجريبي) لعرض المنصة من منظور كل مستخدم.",
              "Role switching is available in the top bar (demo role switcher) to preview the platform from each user's perspective.",
            )}
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {ROLE_ORDER.map((role, i) => {
              const meta = ROLE_META[role];
              const Icon = meta.icon;
              return (
                <motion.div
                  key={role}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: Math.min(i * 0.04, 0.3) }}
                  className="surface card-hover rounded-2xl p-4"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="grid size-9 place-items-center rounded-xl bg-navy-800 text-coral-600">
                      <Icon className="size-4" />
                    </span>
                    <p className="font-semibold text-slate-900">{tr(ROLE_LABEL[role])}</p>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-muted">{pick(meta.ar, meta.en)}</p>
                </motion.div>
              );
            })}
          </div>
        </TabsContent>

        {/* ---------------- Audit log ---------------- */}
        <TabsContent value="audit" className="mt-5">
          <Card>
            <CardHeader>
              <CardTitle>{pick("سجل التدقيق", "Audit log")}</CardTitle>
              <CardDescription>{pick("جميع التغييرات مسجّلة زمنيًا وقابلة للتتبع.", "All changes are timestamped and traceable.")}</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <THead>
                  <TR>
                    <TH>{pick("المعرّف", "ID")}</TH>
                    <TH>{pick("الوقت", "Time")}</TH>
                    <TH>{pick("المستخدم", "Actor")}</TH>
                    <TH>{pick("الإجراء", "Action")}</TH>
                    <TH>{pick("التفاصيل", "Detail")}</TH>
                  </TR>
                </THead>
                <TBody>
                  {audit.map((a) => (
                    <TR key={a.id}>
                      <TD className="font-mono text-xs">{a.id}</TD>
                      <TD className="text-xs text-muted">{fmtDateTime(a.at, lang)}</TD>
                      <TD>{a.actor}</TD>
                      <TD>
                        <Badge variant="muted">{a.action}</Badge>
                      </TD>
                      <TD className="whitespace-normal text-slate-600">{a.detail}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <DisclaimerBar />

      <Dialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title={pick("إعادة تعيين بيانات العرض؟", "Reset demo data?")}
        description={pick(
          "سيتم مسح جميع القرارات والتغذية الراجعة والتعديلات وإعادة البيانات إلى حالتها الأولية.",
          "All decisions, feedback and tweaks will be cleared and data returned to its initial state.",
        )}
      >
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setResetOpen(false)} disabled={resetting}>
            {t("common.cancel")}
          </Button>
          <Button variant="destructive" size="sm" onClick={doReset} disabled={resetting}>
            <RotateCcw className="size-4" />
            {resetting ? pick("جارٍ…", "Resetting…") : t("common.confirm")}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------

function NumberField({
  label,
  value,
  onChange,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input
        type="number"
        step={step}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          onChange(Number.isFinite(n) ? n : 0);
        }}
        className="mt-1 tabular-nums"
      />
    </div>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-navy-700/60 bg-navy-900/40 p-3">
      <p className="text-[11px] text-muted">{label}</p>
      <p className="mt-1 font-mono text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function BandRow({ color, label, range }: { color: string; label: string; range: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-navy-700/60 bg-navy-900/40 px-3 py-2">
      <span className="flex items-center gap-2 text-slate-700">
        <span className={"size-2.5 rounded-full " + color} />
        {label}
      </span>
      <span className="font-mono text-xs text-muted tabular-nums" dir="ltr">
        {range}
      </span>
    </div>
  );
}

function ScoreBands({
  approveMax,
  monitorMax,
  reviewMax,
  pick,
}: {
  approveMax: number;
  monitorMax: number;
  reviewMax: number;
  pick: (ar: string, en: string) => string;
}) {
  const clamp = (n: number) => Math.max(0, Math.min(100, n));
  const a = clamp(approveMax);
  const m = clamp(monitorMax);
  const r = clamp(reviewMax);
  const segs = [
    { w: a, color: "bg-emerald-500", label: pick("موافقة", "Approve") },
    { w: Math.max(0, m - a), color: "bg-sky-500", label: pick("مراقبة", "Monitor") },
    { w: Math.max(0, r - m), color: "bg-amber-500", label: pick("مراجعة", "Review") },
    { w: Math.max(0, 100 - r), color: "bg-rose-500", label: pick("رفض", "Reject") },
  ];
  return (
    <div>
      <div className="flex h-6 w-full overflow-hidden rounded-lg" dir="ltr">
        {segs.map((s, i) => (
          <div
            key={i}
            className={"flex items-center justify-center " + s.color}
            style={{ width: `${s.w}%` }}
            title={`${s.label} (${s.w}%)`}
          />
        ))}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
        {segs.map((s, i) => (
          <span key={i} className="flex items-center gap-1.5 text-[11px] text-muted">
            <span className={"size-2 rounded-full " + s.color} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div>
        <p className="text-sm font-medium text-slate-700">{label}</p>
        <p className="text-xs text-muted">{hint}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
