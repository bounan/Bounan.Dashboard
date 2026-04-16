import { applyValidationRules, summarizeRuleViolations } from "./rules/engine";
import {
  collectGroupedRules,
  collectViolationKeysForRow,
  dedupeRuleViolationItems,
  getRuleDescriptionMap,
} from "./backup-domain";
import { buildRuleReadyTablesFromTables } from "./backup-normalizer";
import type {
  BackupIssue,
  LiveCurrentRecordSnapshot,
  BackupRuleDefinition,
  BackupRuleFinding,
  BackupRuleViolationItem,
  BackupRuleViolationSummary,
  BackupTableDefinition,
} from "./types";

export function summarizeRuleViolationsForTables(
  tables: BackupTableDefinition[],
  rules: BackupRuleDefinition[],
): BackupRuleViolationSummary[] {
  return summarizeRuleViolations(tables, getRuleDescriptionMap(rules));
}

export function collectRuleViolationItems(
  tables: BackupTableDefinition[],
  rules: BackupRuleDefinition[],
): BackupRuleViolationItem[] {
  const descriptions = getRuleDescriptionMap(rules);
  const items: BackupRuleViolationItem[] = [];

  for (const table of tables) {
    const rowsByIdentity = new Map(
      table.rows
        .filter(
          (row): row is typeof row & { rowIdentityKey: string } => row.rowIdentityKey !== null,
        )
        .map((row) => [row.rowIdentityKey, row]),
    );
    const rowsById = new Map(table.rows.map((row) => [row.id, row]));
    const effectiveFindings =
      table.ruleFindings.length > 0 ? table.ruleFindings : deriveRuleFindingsFromRows(table);

    for (const finding of effectiveFindings) {
      const row =
        (finding.rowIdentityKey ? rowsByIdentity.get(finding.rowIdentityKey) : undefined) ??
        rowsById.get(finding.rowId);

      if (!row) {
        continue;
      }

      const keys = collectViolationKeysForRow(table, row);
      items.push({
        ruleId: finding.ruleId,
        code: finding.code,
        kind: finding.kind,
        severity: finding.severity,
        description: descriptions.get(finding.ruleId) ?? finding.message,
        tableKey: table.key,
        rowId: row.id,
        rowIdentityKey: finding.rowIdentityKey,
        entity: row.entity,
        isActionable: row.identityState === "schema-backed",
        primaryKey: keys.primaryKey,
        secondaryKey: keys.secondaryKey,
      });
    }
  }

  return dedupeRuleViolationItems(items);
}

function deriveRuleFindingsFromRows(table: BackupTableDefinition): BackupRuleFinding[] {
  const findings: BackupRuleFinding[] = [];

  for (const row of table.rows) {
    const ruleIssues = row.issues.filter((issue) => issue.scope !== "structural");

    for (const issue of ruleIssues) {
      findings.push(toRuleFinding(table, row.id, row.rowIdentityKey, issue));
    }
  }

  return findings;
}

function toRuleFinding(
  table: BackupTableDefinition,
  rowId: string,
  rowIdentityKey: string | null,
  issue: BackupIssue,
): BackupRuleFinding {
  return {
    ruleId: issue.ruleId,
    code: issue.code,
    kind: issue.scope,
    severity: issue.severity,
    message: issue.message,
    tableKey: table.key,
    rowId,
    rowIdentityKey,
    relatedTableKey: issue.relatedTableKey ?? null,
  };
}

export function revalidateTablesWithLiveRecord(input: {
  tables: BackupTableDefinition[];
  tableKey: string;
  rowId: string;
  liveRecord: Record<string, unknown>;
  currentRecord: LiveCurrentRecordSnapshot;
}) {
  const nextTables = input.tables.map((table) => ({
    ...table,
    rows: table.rows.map((row) => {
      if (table.key !== input.tableKey || row.id !== input.rowId) {
        return row;
      }

      if (row.identityState !== "schema-backed") {
        return row;
      }

      return {
        ...row,
        rowSourceState: "live-enriched" as const,
        liveRecord: input.liveRecord,
        currentRecord: input.currentRecord,
      };
    }),
  }));

  return applyValidationRules(buildRuleReadyTablesFromTables(nextTables));
}

export function buildRulesViewModel(
  tables: BackupTableDefinition[],
  rules: BackupRuleDefinition[],
  violations: BackupRuleViolationSummary[],
  selectedRuleId: string | null,
) {
  const groupedRules = collectGroupedRules(rules, violations);
  const violationItems = collectRuleViolationItems(tables, rules);
  const selectedRule = rules.find((rule) => rule.id === selectedRuleId) ?? rules[0] ?? null;
  const selectedRuleViolations = violationItems.filter((item) => item.ruleId === selectedRule?.id);

  return {
    groupedRules,
    selectedRule,
    selectedRuleViolations,
  };
}
