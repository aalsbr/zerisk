import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-10 w-full rounded-xl border border-navy-600 bg-navy-900/60 px-3 text-sm text-slate-900 placeholder:text-muted focus:border-coral-500/60 focus:outline-none focus:ring-2 focus:ring-coral-500/20 disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "min-h-20 w-full rounded-xl border border-navy-600 bg-navy-900/60 px-3 py-2 text-sm text-slate-900 placeholder:text-muted focus:border-coral-500/60 focus:outline-none focus:ring-2 focus:ring-coral-500/20",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-xs font-medium text-muted", className)} {...props} />;
}
