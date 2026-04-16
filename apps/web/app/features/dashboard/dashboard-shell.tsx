import type { ReactNode } from "react";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";

export function DashboardHeroSection({
  badge,
  title,
  description,
  actions,
}: {
  badge: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-slate-900 bg-slate-950/70 p-6 lg:flex-row lg:items-start lg:justify-between">
      <div className="space-y-3">
        <Badge variant="secondary">{badge}</Badge>
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold">{title}</h2>
          <p className="max-w-3xl text-sm text-slate-400">{description}</p>
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </section>
  );
}

export function DashboardSummaryCard({
  label,
  value,
  description,
  aside,
}: {
  label: string;
  value: string;
  description?: string;
  aside?: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-2xl capitalize">{value}</CardTitle>
          {aside}
        </div>
      </CardHeader>
      {description ? (
        <CardContent>
          <p className="text-sm text-slate-400">{description}</p>
        </CardContent>
      ) : null}
    </Card>
  );
}
