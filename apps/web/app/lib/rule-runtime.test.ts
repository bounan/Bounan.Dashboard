import { describe, expect, it } from "vitest";
import {
  buildRulesViewModel,
  collectRuleViolationItems,
  revalidateTablesWithLiveRecord,
  summarizeRuleViolationsForTables,
} from "./rule-runtime";
import type {
  BackupRuleDefinition,
  BackupRuleViolationSummary,
  BackupTableDefinition,
} from "./types";

const rules: BackupRuleDefinition[] = [
  {
    id: "users-schema",
    kind: "entry",
    severity: "critical",
    description: "User rows must expose valid schema fields.",
    tablePattern: "Bounan-Bot-users",
    targetTablePattern: null,
  },
];

function createTable(): BackupTableDefinition[] {
  return [
    {
      key: "Bounan-Bot-users",
      label: "Users",
      description: "Test table",
      partitionKey: "userId",
      primaryKeys: ["userId"],
      identitySource: "heuristic",
      identityState: "heuristic-only",
      sourcePath: "Bounan-Bot-users.jsonl",
      rowCount: 1,
      appliedRules: ["users-schema"],
      ruleFindings: [
        {
          ruleId: "users-schema",
          code: "USERS_SCHEMA",
          kind: "entry",
          severity: "critical",
          message: "Missing status",
          tableKey: "Bounan-Bot-users",
          rowId: "u-1",
          rowIdentityKey: null,
          relatedTableKey: null,
        },
        {
          ruleId: "users-schema",
          code: "USERS_SCHEMA",
          kind: "entry",
          severity: "critical",
          message: "Missing status again",
          tableKey: "Bounan-Bot-users",
          rowId: "u-1",
          rowIdentityKey: null,
          relatedTableKey: null,
        },
      ],
      rows: [
        {
          id: "u-1",
          rowIdentityKey: null,
          stableIdentity: null,
          identitySource: "heuristic",
          identityState: "heuristic-only",
          rowSourceState: "backup-only",
          entity: "u-1",
          region: "eu",
          capturedAt: null,
          backupVersion: "v1",
          checksum: "abc",
          status: "critical",
          structuralIssues: [],
          issues: [
            {
              code: "USERS_SCHEMA",
              ruleId: "users-schema",
              scope: "entry",
              severity: "critical",
              message: "Missing status",
              fixed: false,
              tableKey: "Bounan-Bot-users",
              rowId: "u-1",
              relatedTableKey: null,
            },
            {
              code: "USERS_SCHEMA",
              ruleId: "users-schema",
              scope: "entry",
              severity: "critical",
              message: "Missing status again",
              fixed: false,
              tableKey: "Bounan-Bot-users",
              rowId: "u-1",
              relatedTableKey: null,
            },
          ],
          lookupKey: { userId: "u-1" },
          lookupSource: { userId: "u-1" },
          sourceRecord: { userId: "u-1" },
          liveRecord: null,
          currentRecord: {
            status: "unavailable",
            summary: "No live record",
            fields: [{ key: "userId", value: "u-1" }],
          },
        },
      ],
    },
  ];
}

describe("rule-runtime", () => {
  it("deduplicates violation items per rule and row", () => {
    const items = collectRuleViolationItems(createTable(), rules);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      ruleId: "users-schema",
      tableKey: "Bounan-Bot-users",
      rowId: "u-1",
      rowIdentityKey: null,
      isActionable: false,
      primaryKey: {
        label: "userId",
        value: "u-1",
      },
    });
  });

  it("recomputes violation summaries from live records", () => {
    const liveReadyTables = createTable().map((table) => ({
      ...table,
      identitySource: "schema" as const,
      identityState: "schema-backed" as const,
      rows: table.rows.map((row) => ({
        ...row,
        rowIdentityKey: "userId=u-1",
        stableIdentity: "userId=u-1",
        identitySource: "schema" as const,
        identityState: "schema-backed" as const,
      })),
    }));

    const revalidated = revalidateTablesWithLiveRecord({
      tables: liveReadyTables,
      tableKey: "Bounan-Bot-users",
      rowId: "u-1",
      liveRecord: {
        userId: 1,
        status: 0,
        directRank: 1,
        indirectRank: 2,
        requestedEpisodes: [1],
        createdAt: "2026-04-17T09:00:00.000Z",
        updatedAt: "2026-04-17T10:00:00.000Z",
      },
      currentRecord: {
        status: "live",
        summary: "Fetched live row",
        fields: [
          { key: "userId", value: "1" },
          { key: "status", value: "0" },
        ],
      },
    });
    const summary = summarizeRuleViolationsForTables(revalidated, rules);

    expect(summary).toHaveLength(0);
    expect(revalidated[0]?.rows[0]?.liveRecord).toEqual({
      userId: 1,
      status: 0,
      directRank: 1,
      indirectRank: 2,
      requestedEpisodes: [1],
      createdAt: "2026-04-17T09:00:00.000Z",
      updatedAt: "2026-04-17T10:00:00.000Z",
    });
  });

  it("builds a stable rules view model from tables and summaries", () => {
    const tables = createTable();
    const violations = summarizeRuleViolationsForTables(tables, rules);
    const view = buildRulesViewModel(tables, rules, violations, null);

    expect(view.groupedRules).toHaveLength(1);
    expect(view.selectedRule?.id).toBe("users-schema");
    expect(view.selectedRuleViolations).toHaveLength(1);
    expect(view.selectedRuleViolations[0]?.primaryKey).toEqual({
      label: "userId",
      value: "u-1",
    });
  });

  it("falls back to row issues when rule summaries exist but ruleFindings are missing", () => {
    const tables = createTable().map((table) => ({
      ...table,
      ruleFindings: [],
    }));
    const violations: BackupRuleViolationSummary[] = [
      {
        ruleId: "users-schema",
        code: "USERS_SCHEMA",
        kind: "entry",
        severity: "critical",
        description: "User rows must expose valid schema fields.",
        violationCount: 2,
        affectedTables: ["Bounan-Bot-users"],
      },
    ];

    const view = buildRulesViewModel(tables, rules, violations, "users-schema");

    expect(view.selectedRule?.id).toBe("users-schema");
    expect(view.selectedRuleViolations).toHaveLength(1);
    expect(view.selectedRuleViolations[0]?.rowId).toBe("u-1");
  });

  it("uses rowId when cached ruleFindings carry a stale rowIdentityKey", () => {
    const tables = createTable().map((table) => ({
      ...table,
      ruleFindings: table.ruleFindings.map((finding) => ({
        ...finding,
        rowIdentityKey: "userId=stale-u-1",
      })),
    }));

    const items = collectRuleViolationItems(tables, rules);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      ruleId: "users-schema",
      rowId: "u-1",
      primaryKey: {
        label: "userId",
        value: "u-1",
      },
    });
  });
});
