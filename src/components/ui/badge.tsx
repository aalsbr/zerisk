import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "border-navy-600 bg-navy-800 text-slate-700",
        approve: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700",
        reject: "border-rose-500/40 bg-rose-500/10 text-rose-700",
        review: "border-amber-500/40 bg-amber-500/10 text-amber-700",
        monitor: "border-sky-500/40 bg-sky-500/10 text-sky-700",
        coral: "border-coral-500/40 bg-coral-500/10 text-coral-600",
        muted: "border-navy-600 bg-navy-850 text-muted",
        success: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700",
        danger: "border-rose-500/40 bg-rose-500/10 text-rose-700",
        warning: "border-amber-500/40 bg-amber-500/10 text-amber-700",
        info: "border-sky-500/40 bg-sky-500/10 text-sky-700",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { badgeVariants };
