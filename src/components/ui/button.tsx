import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-500/50 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "grad-coral text-white shadow-lg shadow-coral-600/20 hover:brightness-110",
        secondary: "bg-navy-700 text-slate-900 hover:bg-navy-600 border border-navy-600",
        outline: "border border-navy-600 bg-transparent text-slate-700 hover:bg-navy-800",
        ghost: "text-slate-600 hover:bg-navy-800 hover:text-slate-900",
        subtle: "bg-navy-800/60 text-slate-700 hover:bg-navy-700",
        destructive: "bg-rose-600/90 text-white hover:bg-rose-600",
        success: "bg-emerald-600/90 text-white hover:bg-emerald-600",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-4",
        lg: "h-12 px-6 text-base",
        icon: "size-9",
      },
    },
    defaultVariants: { variant: "default", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = "Button";

export { buttonVariants };
