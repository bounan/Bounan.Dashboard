import type * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/ui";

const alertVariants = cva("rounded-xl border px-4 py-3", {
  variants: {
    variant: {
      default: "border-slate-800 bg-slate-950/70 text-slate-100",
      success: "border-emerald-900 bg-emerald-950/40 text-emerald-100",
      warning: "border-amber-900 bg-amber-950/40 text-amber-100",
      destructive: "border-red-900 bg-red-950/40 text-red-100",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof alertVariants> {}

export function Alert({ className, variant, ...props }: AlertProps) {
  return <div role="alert" className={cn(alertVariants({ variant }), className)} {...props} />;
}

export function AlertTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h5 className={cn("font-medium", className)} {...props} />;
}

export function AlertDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("mt-1 text-sm text-slate-300", className)} {...props} />;
}
