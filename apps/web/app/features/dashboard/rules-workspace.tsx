"use client";

import { useMemo } from "react";
import type {
  BackupRuleDefinition,
  BackupRuleViolationSummary,
  BackupSourceStatus,
  BackupTableDefinition,
} from "../../lib/types";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { RulesCatalogTree } from "./rules-catalog-tree";
import { useRulesController } from "./hooks/use-rules-controller";
import type { RowRefetchActionResult } from "./hooks/action-results";
import { RulesHero, RulesSummaryCard } from "./rules-shared";
import { RulesViolationsSummary } from "./rules-violations-summary";

export function RulesWorkspace({
  source,
  tables,
  rules,
  violations,
  updatingViolationKeys,
  onUpdateViolation,
  onOpenConfig,
}: {
  source: BackupSourceStatus | null;
  tables: BackupTableDefinition[];
  rules: BackupRuleDefinition[];
  violations: BackupRuleViolationSummary[];
  updatingViolationKeys: Set<string>;
  onUpdateViolation: (tableKey: string, rowId: string) => Promise<RowRefetchActionResult>;
  onOpenConfig: () => void;
}) {
  const safeRules = useMemo(() => (Array.isArray(rules) ? rules : []), [rules]);
  const safeViolations = useMemo(() => (Array.isArray(violations) ? violations : []), [violations]);
  const { groupedRules, selectedRule, selectedRuleViolations, setSelectedRuleId } =
    useRulesController({
      tables: Array.isArray(tables) ? tables : [],
      rules: safeRules,
      violations: safeViolations,
    });

  if (!source?.ok) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Rules need a validated backup snapshot</CardTitle>
          <CardDescription>
            This page depends on a loaded backup snapshot. Validate access on Config and load the
            snapshot from Backup before returning here.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="warning">
            <AlertTitle>No rule data yet</AlertTitle>
            <AlertDescription>
              Rules are generated from the loaded JSONL tables. Until a backup snapshot is
              available, this page remains informational.
            </AlertDescription>
          </Alert>
          <Button variant="secondary" onClick={onOpenConfig}>
            Open config
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (safeRules.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No rules were produced for this snapshot</CardTitle>
          <CardDescription>
            The repository validated, but no rule catalog was attached to the current analyzer
            payload.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <RulesHero />

      <div className="grid gap-4 md:grid-cols-3">
        <RulesSummaryCard
          label="Rules"
          value={safeRules.length.toString()}
          description="Entry, cross-entry, and cross-table definitions"
        />
        <RulesSummaryCard
          label="Active violations"
          value={safeViolations.reduce((sum, item) => sum + item.violationCount, 0).toString()}
          description="Total current violations across all rules"
        />
        <RulesSummaryCard
          label="Critical rules"
          value={safeRules.filter((rule) => rule.severity === "critical").length.toString()}
          description="High-priority checks in the catalog"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <RulesCatalogTree
          groupedRules={groupedRules}
          selectedRuleId={selectedRule?.id ?? null}
          setSelectedRuleId={setSelectedRuleId}
          violations={safeViolations}
        />

        <RulesViolationsSummary
          selectedRule={selectedRule}
          selectedRuleViolations={selectedRuleViolations}
          updatingViolationKeys={updatingViolationKeys}
          onUpdateViolation={onUpdateViolation}
        />
      </div>
    </div>
  );
}
