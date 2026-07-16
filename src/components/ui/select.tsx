import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: { value: string; label: string }[];
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, options, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          "h-10 w-full appearance-none rounded-xl border border-navy-600 bg-navy-900/60 px-3 pe-9 text-sm text-slate-900 focus:border-coral-500/60 focus:outline-none focus:ring-2 focus:ring-coral-500/20",
          className,
        )}
        {...props}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-navy-850 text-slate-900">
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
    </div>
  ),
);
Select.displayName = "Select";
