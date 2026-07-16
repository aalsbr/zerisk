"use client";

import { CheckCircle2, XCircle, Search, Eye } from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { DECISION_LABEL } from "@/lib/i18n";
import { useI18n } from "@/providers";
import type { Decision } from "@/lib/types";

const MAP: Record<Decision, { variant: BadgeProps["variant"]; Icon: typeof CheckCircle2 }> = {
  APPROVE: { variant: "approve", Icon: CheckCircle2 },
  REJECT: { variant: "reject", Icon: XCircle },
  REVIEW: { variant: "review", Icon: Search },
  MONITOR: { variant: "monitor", Icon: Eye },
};

export function DecisionBadge({ decision, showIcon = true }: { decision: Decision; showIcon?: boolean }) {
  const { tr } = useI18n();
  const { variant, Icon } = MAP[decision];
  return (
    <Badge variant={variant}>
      {showIcon && <Icon className="size-3" />}
      {tr(DECISION_LABEL[decision])}
    </Badge>
  );
}

export function decisionColor(d: Decision): string {
  return d === "APPROVE"
    ? "#34d399"
    : d === "REJECT"
      ? "#fb7185"
      : d === "REVIEW"
        ? "#fbbf24"
        : "#38bdf8";
}
