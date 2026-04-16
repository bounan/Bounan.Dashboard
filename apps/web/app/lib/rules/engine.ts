import type {
  BackupRuleFinding,
  BackupRuleViolationSummary,
  BackupSeverity,
  BackupTableDefinition,
} from "../types";
import { getRuleDefinitions } from "./catalog";
import { buildIndexes, describeAppliedRules } from "./helpers";
import { evaluateTable } from "./evaluators";
import type { RuleContext, RuleReadyTable } from "./runtime-types";

export type { RuleReadyRow, RuleReadyTable } from "./runtime-types";

function toRuleFindings(
  table: RuleReadyTable,
  issueMap: Map<string, BackupTableDefinition["rows"][number]["issues"]>,
): BackupRuleFinding[] {
  const rowsById = new Map(table.rows.map((candidate) => [candidate.row.id, candidate.row]));
  const findings: BackupRuleFinding[] = [];

  for (const [rowId, issues] of issueMap.entries()) {
    const row = rowsById.get(rowId);

    for (const issue of issues) {
      findings.push({
        ruleId: issue.ruleId,
        code: issue.code,
        kind: issue.scope,
        severity: issue.severity,
        message: issue.message,
        tableKey: table.key,
        rowId,
        rowIdentityKey: row?.rowIdentityKey ?? null,
        relatedTableKey: issue.relatedTableKey ?? null,
      });
    }
  }

  return findings;
}

export function applyValidationRules(tables: RuleReadyTable[]): BackupTableDefinition[] {
  const ruleDefinitions = getRuleDefinitions();
  const context: RuleContext = {
    tables,
    ruleDescriptions: new Map(ruleDefinitions.map((rule) => [rule.id, rule])),
    indexes: buildIndexes(tables),
  };

  return tables.map((table) => {
    const issueMap = evaluateTable(table, context);
    const appliedRules = describeAppliedRules(table.key);

    return {
      key: table.key,
      label: table.label,
      description: `Validated from ${table.sourcePath} using the explicit validation rules from VALIDATIONS.md.`,
      partitionKey: table.primaryKeys[0] ?? "derived-id",
      primaryKeys: table.primaryKeys.length > 0 ? table.primaryKeys : ["derived-id"],
      identitySource: table.identitySource ?? "heuristic",
      identityState:
        table.identityState ??
        (table.identitySource === "schema" ? "schema-backed" : "heuristic-only"),
      sourcePath: table.sourcePath,
      rowCount: table.rows.length,
      appliedRules,
      ruleFindings: toRuleFindings(table, issueMap),
      rows: table.rows.map((candidate) => {
        const issues = [
          ...candidate.row.structuralIssues,
          ...(issueMap.get(candidate.row.id) ?? []),
        ].map((issue) => ({
          ...issue,
          tableKey: table.key,
          rowId: candidate.row.id,
        }));
        const structuralIssues = candidate.row.structuralIssues.map((issue) => ({
          ...issue,
          tableKey: table.key,
          rowId: candidate.row.id,
        }));
        const status: BackupSeverity = issues.some((issue) => issue.severity === "critical")
          ? "critical"
          : issues.length > 0
            ? "warning"
            : "healthy";

        if (candidate.row.identityState === "schema-backed") {
          return {
            ...candidate.row,
            status,
            structuralIssues,
            issues,
          };
        }

        return {
          ...candidate.row,
          rowIdentityKey: null,
          stableIdentity: null,
          identitySource: "heuristic" as const,
          identityState: "heuristic-only" as const,
          status,
          structuralIssues,
          issues,
        };
      }),
    };
  });
}

export function summarizeRuleViolations(
  tables: BackupTableDefinition[],
  descriptions: Map<string, string>,
): BackupRuleViolationSummary[] {
  const summary = new Map<string, BackupRuleViolationSummary>();

  for (const table of tables) {
    for (const finding of table.ruleFindings) {
      const current = summary.get(finding.ruleId);

      if (current) {
        current.violationCount += 1;

        if (!current.affectedTables.includes(table.key)) {
          current.affectedTables.push(table.key);
        }

        continue;
      }

      summary.set(finding.ruleId, {
        ruleId: finding.ruleId,
        code: finding.code,
        kind: finding.kind,
        severity: finding.severity,
        description: descriptions.get(finding.ruleId) ?? finding.message,
        violationCount: 1,
        affectedTables: [table.key],
      });
    }
  }

  return [...summary.values()].sort((left, right) => {
    if (left.severity !== right.severity) {
      return left.severity === "critical" ? -1 : 1;
    }

    return right.violationCount - left.violationCount;
  });
}
