import type { BackupRuleViolationSummary } from "../../lib/types";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import type { ReturnTypeUseRulesController } from "./hooks/use-rules-controller";

export function RulesCatalogTree({
  groupedRules,
  selectedRuleId,
  setSelectedRuleId,
  violations,
}: {
  groupedRules: ReturnTypeUseRulesController["groupedRules"];
  selectedRuleId: string | null;
  setSelectedRuleId: (ruleId: string) => void;
  violations: BackupRuleViolationSummary[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Rule catalog</CardTitle>
        <CardDescription>
          The catalog is grouped by table family and expanded by default so rule selection and
          violation counts stay readable.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {groupedRules.map((group) => (
          <details
            key={group.tablePattern}
            open
            className="rounded-xl border border-slate-900 bg-slate-950/60"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="font-medium text-white">{group.tablePattern}</p>
                <p className="text-sm text-slate-500">
                  {group.rules.length} rules in this table family
                </p>
              </div>
              <Badge variant={group.violationCount > 0 ? "destructive" : "secondary"}>
                {group.violationCount}
              </Badge>
            </summary>
            <div className="space-y-3 border-t border-slate-900 p-3">
              {group.rules.map((rule) => {
                const violationCount =
                  violations.find((item) => item.ruleId === rule.id)?.violationCount ?? 0;
                const selected = selectedRuleId === rule.id;

                return (
                  <button
                    key={rule.id}
                    type="button"
                    onClick={() => setSelectedRuleId(rule.id)}
                    className={`w-full rounded-xl border p-4 text-left transition ${
                      selected
                        ? "border-sky-600 bg-slate-900"
                        : "border-slate-900 bg-slate-950/70 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-white">{rule.id}</span>
                          <Badge variant={rule.severity === "critical" ? "destructive" : "warning"}>
                            {rule.severity}
                          </Badge>
                          <Badge variant="secondary">{rule.kind}</Badge>
                        </div>
                        <p className="text-sm text-slate-400">{rule.description}</p>
                      </div>
                      <Badge variant={violationCount > 0 ? "destructive" : "secondary"}>
                        {violationCount}
                      </Badge>
                    </div>
                  </button>
                );
              })}
            </div>
          </details>
        ))}
      </CardContent>
    </Card>
  );
}
