import type { BackupRuleDefinition, BackupRuleViolationItem } from "../../lib/types";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { ScrollArea } from "../ui/scroll-area";
import type { RowRefetchActionResult } from "./hooks/action-results";

export function RulesViolationsSummary({
  selectedRule,
  selectedRuleViolations,
  updatingViolationKeys,
  onUpdateViolation,
}: {
  selectedRule: BackupRuleDefinition | null;
  selectedRuleViolations: BackupRuleViolationItem[];
  updatingViolationKeys: Set<string>;
  onUpdateViolation: (tableKey: string, rowId: string) => Promise<RowRefetchActionResult>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Violation summary</CardTitle>
        <CardDescription>
          {selectedRule
            ? `${selectedRule.id} · ${selectedRule.kind}`
            : "Select a rule to inspect its violating entries."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!selectedRule ? (
          <Alert>
            <AlertTitle>No rule selected</AlertTitle>
            <AlertDescription>
              Choose a rule from the catalog to inspect its violating keys.
            </AlertDescription>
          </Alert>
        ) : selectedRuleViolations.length === 0 ? (
          <Alert>
            <AlertTitle>No visible violations</AlertTitle>
            <AlertDescription>
              This rule is selected, but no current violation rows were resolved.
            </AlertDescription>
          </Alert>
        ) : (
          <ScrollArea className="h-[34rem]">
            <div className="space-y-3 pr-4">
              {selectedRuleViolations.map((item) => {
                const updating = updatingViolationKeys.has(`${item.tableKey}::${item.rowId}`);

                return (
                  <div
                    key={`${item.ruleId}-${item.tableKey}-${item.rowIdentityKey ?? item.rowId}`}
                    className="rounded-xl border border-slate-900 bg-slate-950/70 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-2">
                        <p className="font-medium text-white">{item.entity}</p>
                        <div className="space-y-1 text-sm text-slate-400">
                          <p>
                            {item.primaryKey.label}:{" "}
                            <span className="text-slate-200">{item.primaryKey.value}</span>
                          </p>
                          {item.secondaryKey ? (
                            <p>
                              {item.secondaryKey.label}:{" "}
                              <span className="text-slate-200">{item.secondaryKey.value}</span>
                            </p>
                          ) : null}
                          <p>Table: {item.tableKey}</p>
                        </div>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={!item.isActionable || updating}
                        onClick={() => void onUpdateViolation(item.tableKey, item.rowId)}
                      >
                        {updating ? "Updating..." : "Update"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
