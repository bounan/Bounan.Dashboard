import type {
  BackupRuleDefinition,
  BackupRuleViolationItem,
  BackupRuleViolationSummary,
  BackupTableDefinition,
} from "./types";

export type ScalarLookupValue = string | number | boolean | null;
export type ScalarLookupRecord = Record<string, ScalarLookupValue>;

export function toDisplayValue(value: unknown) {
  if (value === null || value === undefined) {
    return "n/a";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value);
}

export function toScalarLookupSource(record: Record<string, unknown>): ScalarLookupRecord {
  return Object.fromEntries(
    Object.entries(record)
      .filter(
        ([, value]) =>
          value === null ||
          typeof value === "string" ||
          typeof value === "number" ||
          typeof value === "boolean",
      )
      .map(([key, value]) => [key, value as ScalarLookupValue]),
  );
}

export function createLookupKeyFromPrimaryKeys(
  primaryKeys: string[],
  lookupSource: ScalarLookupRecord,
): ScalarLookupRecord {
  return Object.fromEntries(
    primaryKeys.map((key) => [key, lookupSource[key] ?? null]),
  ) as ScalarLookupRecord;
}

export function createStableIdentity(
  primaryKeys: string[],
  lookupSource: ScalarLookupRecord,
  fallbackId: string | null = null,
) {
  if (primaryKeys.length === 0) {
    return fallbackId;
  }

  const parts = primaryKeys.map((key) => {
    const value = lookupSource[key];
    return value === null || value === undefined ? null : `${key}=${toDisplayValue(value)}`;
  });

  if (parts.some((part) => part === null)) {
    return fallbackId;
  }

  return parts.join(" | ");
}

export function createLookupIdentityKey(primaryKeys: string[], lookupKey: ScalarLookupRecord) {
  if (primaryKeys.length === 0) {
    return null;
  }

  const parts = primaryKeys.map((key) => {
    const value = lookupKey[key];
    return value === null || value === undefined ? null : `${key}=${toDisplayValue(value)}`;
  });

  if (parts.some((part) => part === null)) {
    return null;
  }

  return parts.join(" | ");
}

export function getRuleDescriptionMap(rules: BackupRuleDefinition[]) {
  return new Map(rules.map((rule) => [rule.id, rule.description]));
}

export function collectGroupedRules(
  rules: BackupRuleDefinition[],
  violations: BackupRuleViolationSummary[],
) {
  const groups = new Map<string, BackupRuleDefinition[]>();

  for (const rule of rules) {
    const current = groups.get(rule.tablePattern) ?? [];
    current.push(rule);
    groups.set(rule.tablePattern, current);
  }

  return [...groups.entries()].map(([tablePattern, groupRules]) => ({
    tablePattern,
    rules: groupRules,
    violationCount: violations
      .filter((item) => groupRules.some((rule) => rule.id === item.ruleId))
      .reduce((sum, item) => sum + item.violationCount, 0),
  }));
}

export function collectViolationKeysForRow(
  table: BackupTableDefinition,
  row: BackupTableDefinition["rows"][number],
) {
  const primaryKeyName = table.primaryKeys[0] ?? table.partitionKey;
  const secondaryKeyName = table.primaryKeys[1] ?? null;
  const primaryValue = row.lookupSource[primaryKeyName] ?? row.lookupKey[primaryKeyName] ?? row.id;
  const secondaryValue = secondaryKeyName
    ? (row.lookupSource[secondaryKeyName] ?? row.lookupKey[secondaryKeyName] ?? null)
    : null;

  return {
    primaryKey: {
      label: primaryKeyName,
      value: toDisplayValue(primaryValue),
    },
    secondaryKey: secondaryKeyName
      ? {
          label: secondaryKeyName,
          value: toDisplayValue(secondaryValue),
        }
      : null,
  };
}

export function dedupeRuleViolationItems(items: BackupRuleViolationItem[]) {
  const deduped = new Map<string, BackupRuleViolationItem>();

  for (const item of items) {
    const key = `${item.ruleId}::${item.tableKey}::${item.rowIdentityKey ?? item.rowId}`;

    if (!deduped.has(key)) {
      deduped.set(key, item);
    }
  }

  return [...deduped.values()];
}
