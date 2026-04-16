import { describe, expect, it } from "vitest";
import { createLookupKeyFromPrimaryKeys, toScalarLookupSource } from "../backup-domain";
import { parseJsonlDocument, detectPrimaryKeys } from "../github-browser";
import { getRuleDefinitions } from "../rules/catalog";
import { decodeDynamoRecord } from "../rules/dynamo";
import {
  applyValidationRules,
  summarizeRuleViolations,
  type RuleReadyTable,
} from "../rules/engine";
import { representativeBackupFixtureJsonl } from "./backup-fixtures";

function createChecksum(value: unknown) {
  const text = JSON.stringify(value);
  let hash = 2166136261;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return Math.abs(hash >>> 0)
    .toString(16)
    .padStart(8, "0");
}

function toRuleReadyTable(fileName: string, contents: string): RuleReadyTable {
  const decoded = parseJsonlDocument(contents).map((record) => {
    const candidate = record as Record<string, unknown>;
    const item =
      candidate.Item && typeof candidate.Item === "object"
        ? (candidate.Item as Record<string, unknown>)
        : candidate;
    return decodeDynamoRecord(item);
  });
  const primaryKeys = detectPrimaryKeys(decoded);
  const tableKey = fileName.replace(/\.jsonl$/i, "");

  return {
    key: tableKey,
    label: tableKey,
    primaryKeys,
    identitySource: "heuristic",
    sourcePath: fileName,
    rows: decoded.map((record, index) => {
      const lookupSource = toScalarLookupSource(record);
      const id = String(record[primaryKeys[0] ?? "id"] ?? `row-${index + 1}`);

      return {
        row: {
          id,
          rowIdentityKey: null,
          stableIdentity: null,
          identitySource: "heuristic",
          identityState: "heuristic-only",
          rowSourceState: "backup-only",
          entity: id,
          region: "fixture",
          capturedAt: typeof record.updatedAt === "string" ? record.updatedAt : null,
          backupVersion: typeof record.updatedAt === "string" ? record.updatedAt : "fixture",
          checksum: createChecksum(record),
          status: "healthy",
          structuralIssues: [],
          issues: [],
          lookupKey: createLookupKeyFromPrimaryKeys(primaryKeys, lookupSource),
          lookupSource,
          sourceRecord: record,
          liveRecord: null,
          currentRecord: {
            status: "unavailable",
            summary: "fixture",
            fields: [],
          },
        },
        record,
      };
    }),
  };
}

describe("representative backup fixtures", () => {
  it("produce real rule violations across supported table families", () => {
    const tables = applyValidationRules(
      [...representativeBackupFixtureJsonl.entries()].map(([fileName, contents]) =>
        toRuleReadyTable(fileName, contents),
      ),
    );
    const summary = summarizeRuleViolations(
      tables,
      new Map(getRuleDefinitions().map((rule) => [rule.id, rule.description])),
    );

    expect(tables).toHaveLength(4);
    expect(summary.some((item) => item.ruleId === "users-schema")).toBe(true);
    expect(summary.some((item) => item.ruleId === "ongoing-schema")).toBe(true);
    expect(summary.some((item) => item.ruleId === "subscriptions-schema")).toBe(true);
  });
});
