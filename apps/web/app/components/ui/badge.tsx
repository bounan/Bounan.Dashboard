import type * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/ui";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "border-slate-700 bg-slate-900 text-slate-100",
        secondary: "border-slate-800 bg-slate-950 text-slate-300",
        success: "border-emerald-900 bg-emerald-950/70 text-emerald-300",
        warning: "border-amber-900 bg-amber-950/70 text-amber-300",
        destructive: "border-red-900 bg-red-950/70 text-red-300",
        outline: "border-slate-700 text-slate-300",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
