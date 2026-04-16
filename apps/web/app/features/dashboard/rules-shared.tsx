import { Badge } from "../ui/badge";
import { DashboardHeroSection, DashboardSummaryCard } from "./dashboard-shell";

export function RulesSummaryCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) {
  return <DashboardSummaryCard label={label} value={value} description={description} />;
}

export function RulesHero() {
  return (
    <DashboardHeroSection
      badge="Rules"
      title="Structured validation catalog and live violations"
      description="The old Rules page mixed table totals and rule-level detail poorly. This redesign keeps a stable left-side catalog tree and a focused violation panel on the right."
      actions={<Badge variant="secondary">Rule catalog</Badge>}
    />
  );
}
