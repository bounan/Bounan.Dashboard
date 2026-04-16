import {
  createLookupIdentityKey,
  createLookupKeyFromPrimaryKeys,
  createStableIdentity,
  toScalarLookupSource,
} from "./backup-domain";
import type {
  BackupIdentitySource,
  HeuristicBackupRow,
  BackupIssue,
  BackupRow,
  SchemaBackedBackupRow,
  BackupSeverity,
  BackupSourceResponse,
  BackupTableDefinition,
  CurrentRecordSnapshot,
  LiveCurrentRecordSnapshot,
  ErrorCurrentRecordSnapshot,
  UnavailableCurrentRecordSnapshot,
} from "./types";
import type { RuleReadyTable } from "./rules/engine";

type JsonRecord = Record<string, unknown>;

export function formatBackupTableLabel(name: string) {
  return name
    .replace(/\.jsonl$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function deriveHeuristicRowId(record: JsonRecord, index: number) {
  const candidateKeys = [
    "primaryKey",
    "animeKey",
    "AnimeKey",
    "userId",
    "myAnimeListId",
    "threadId",
    "id",
    "key",
    "name",
  ];

  for (const key of candidateKeys) {
    const value = record[key];

    if ((typeof value === "string" || typeof value === "number") && String(value).trim()) {
      return String(value);
    }
  }

  return `row-${index + 1}`;
}

export function deriveHeuristicEntity(record: JsonRecord, fallbackId: string) {
  const candidateKeys = [
    "primaryKey",
    "animeKey",
    "AnimeKey",
    "name",
    "title",
    "userId",
    "myAnimeListId",
  ];

  for (const key of candidateKeys) {
    const value = record[key];

    if ((typeof value === "string" || typeof value === "number") && String(value).trim()) {
      return String(value);
    }
  }

  return fallbackId;
}

export function deriveCapturedAt(record: JsonRecord) {
  for (const key of ["updatedAt", "createdAt", "timestamp", "date"]) {
    const value = record[key];

    if (typeof value === "string" && !Number.isNaN(Date.parse(value))) {
      return value;
    }
  }

  return null;
}

export function deriveRegion(record: JsonRecord) {
  const value = record.region ?? record.awsRegion ?? record.regionName ?? record.dub;
  return typeof value === "string" && value.trim() ? value : "n/a";
}

export function deriveBackupVersion(record: JsonRecord) {
  const value = record.updatedAt ?? record.createdAt ?? record.version ?? record.schemaVersion;
  return typeof value === "string" && value.trim() ? value : "unversioned";
}

export function createFieldPreview(record: JsonRecord) {
  return Object.entries(record).map(([key, value]) => ({
    key,
    value:
      typeof value === "string"
        ? value
        : typeof value === "number" || typeof value === "boolean"
          ? String(value)
          : JSON.stringify(value),
  }));
}

export function createChecksum(value: unknown) {
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

function createStructuralIssue(
  code: string,
  message: string,
  severity: Exclude<BackupSeverity, "healthy">,
): BackupIssue {
  return {
    code,
    ruleId: code.toLowerCase(),
    scope: "structural",
    severity,
    message,
    fixed: false,
    relatedTableKey: null,
  };
}

export function analyzeStructuralIssues(
  record: JsonRecord,
  duplicateIds: Set<string>,
  rowId: string,
) {
  const issues: BackupIssue[] = [];

  if (duplicateIds.has(rowId)) {
    issues.push(
      createStructuralIssue(
        "DUPLICATE_ID",
        "Another row in this table has the same derived primary key.",
        "critical",
      ),
    );
  }

  if (Object.keys(record).length === 0) {
    issues.push(
      createStructuralIssue(
        "EMPTY_RECORD",
        "The row is empty and cannot be trusted as a usable backup entry.",
        "critical",
      ),
    );
  }

  const nullishFields = Object.entries(record)
    .filter(([, value]) => value === null || value === undefined)
    .map(([key]) => key);

  if (nullishFields.length > 0) {
    issues.push(
      createStructuralIssue(
        "NULLISH_FIELDS",
        `The row has nullish fields: ${nullishFields.join(", ")}.`,
        "warning",
      ),
    );
  }

  return issues;
}

export function severityFromIssues(issues: BackupIssue[]): BackupSeverity {
  if (issues.some((issue) => issue.severity === "critical")) {
    return "critical";
  }

  if (issues.length > 0) {
    return "warning";
  }

  return "healthy";
}

export function createUnavailableCurrentRecord(
  record: JsonRecord,
): UnavailableCurrentRecordSnapshot {
  return {
    status: "unavailable",
    summary: "Live DynamoDB lookup is not configured yet for this dashboard instance.",
    fields: createFieldPreview(record),
  };
}

export function createNormalizedBackupRow(input: {
  record: JsonRecord;
  index: number;
  primaryKeys: string[];
  duplicateIds: Set<string>;
  identitySource?: BackupIdentitySource;
}): BackupRow {
  const id = deriveHeuristicRowId(input.record, input.index);
  const lookupSource = toScalarLookupSource(input.record);
  const issues = analyzeStructuralIssues(input.record, input.duplicateIds, id);
  const identitySource = input.identitySource ?? "heuristic";

  const baseRow = {
    id,
    entity: deriveHeuristicEntity(input.record, id),
    region: deriveRegion(input.record),
    capturedAt: deriveCapturedAt(input.record),
    backupVersion: deriveBackupVersion(input.record),
    checksum: createChecksum(input.record),
    status: severityFromIssues(issues),
    structuralIssues: issues,
    issues,
    lookupKey: createLookupKeyFromPrimaryKeys(input.primaryKeys, lookupSource),
    lookupSource,
    sourceRecord: input.record,
    rowSourceState: "backup-only" as const,
    liveRecord: null,
    currentRecord: createUnavailableCurrentRecord(input.record),
  };

  if (identitySource === "schema") {
    const rowIdentityKey = createLookupIdentityKey(input.primaryKeys, lookupSource);
    const stableIdentity = createStableIdentity(input.primaryKeys, lookupSource, null);

    if (rowIdentityKey && stableIdentity) {
      const row: SchemaBackedBackupRow = {
        ...baseRow,
        rowIdentityKey,
        stableIdentity,
        identitySource: "schema",
        identityState: "schema-backed",
      };
      return row;
    }
  }

  const row: HeuristicBackupRow = {
    ...baseRow,
    rowIdentityKey: null,
    stableIdentity: null,
    identitySource: "heuristic",
    identityState: "heuristic-only",
  };

  return row;
}

export function buildRuleReadyTableFromRecords(input: {
  key: string;
  label: string;
  primaryKeys: string[];
  identitySource?: BackupIdentitySource;
  sourcePath: string;
  records: JsonRecord[];
}): RuleReadyTable {
  const ids = input.records.map((record, index) => deriveHeuristicRowId(record, index));
  const duplicateIds = new Set(ids.filter((id, index) => ids.indexOf(id) !== index));

  return {
    key: input.key,
    label: input.label,
    primaryKeys: input.primaryKeys,
    identitySource: input.identitySource ?? "heuristic",
    identityState: input.identitySource === "schema" ? "schema-backed" : "heuristic-only",
    sourcePath: input.sourcePath,
    rows: input.records.map((record, index) => ({
      row: createNormalizedBackupRow({
        record,
        index,
        primaryKeys: input.primaryKeys,
        duplicateIds,
        identitySource: input.identitySource,
      }),
      record,
    })),
  };
}

export function buildRuleReadyTablesFromTables(tables: BackupTableDefinition[]): RuleReadyTable[] {
  return tables.map((table) => ({
    key: table.key,
    label: table.label,
    primaryKeys: table.primaryKeys,
    identitySource: table.identitySource,
    identityState: table.identityState,
    sourcePath: table.sourcePath,
    rows: table.rows.map((row) => ({
      row,
      record: row.liveRecord ?? row.sourceRecord,
    })),
  }));
}

export function normalizePersistedBackupRow(
  row: Partial<BackupRow> & {
    sourceRecord?: unknown;
    currentRecord?: { fields?: Array<{ key?: unknown; value?: unknown }> };
  },
  primaryKeys: string[],
  identitySource: BackupIdentitySource,
): BackupRow {
  const createLookupSourceFromPreview = () => {
    if (
      row.sourceRecord &&
      typeof row.sourceRecord === "object" &&
      !Array.isArray(row.sourceRecord)
    ) {
      return toScalarLookupSource(row.sourceRecord as JsonRecord);
    }

    const previewFields = Array.isArray(row.currentRecord?.fields) ? row.currentRecord.fields : [];

    return Object.fromEntries(
      previewFields
        .filter(
          (field): field is { key: string; value: string } =>
            typeof field?.key === "string" &&
            field.key.trim().length > 0 &&
            typeof field?.value === "string",
        )
        .map((field) => [field.key, field.value]),
    );
  };

  const lookupSource =
    row.lookupSource && typeof row.lookupSource === "object"
      ? row.lookupSource
      : createLookupSourceFromPreview();
  const id =
    typeof row.id === "string" && row.id.trim().length > 0
      ? row.id
      : deriveHeuristicRowId(lookupSource, 0);
  const sourceRecord =
    row.sourceRecord && typeof row.sourceRecord === "object" && !Array.isArray(row.sourceRecord)
      ? (row.sourceRecord as JsonRecord)
      : lookupSource;
  const currentRecord =
    row.currentRecord &&
    typeof row.currentRecord === "object" &&
    typeof row.currentRecord.status === "string"
      ? (row.currentRecord as CurrentRecordSnapshot)
      : createUnavailableCurrentRecord(sourceRecord);
  const liveRecord =
    row.liveRecord && typeof row.liveRecord === "object" && !Array.isArray(row.liveRecord)
      ? row.liveRecord
      : null;
  const rowSourceState =
    currentRecord.status === "live" && liveRecord
      ? ("live-enriched" as const)
      : ("backup-only" as const);
  const structuralIssues = Array.isArray(row.structuralIssues)
    ? row.structuralIssues
    : Array.isArray(row.issues)
      ? row.issues.filter((issue) => issue.scope === "structural")
      : [];
  const issues = Array.isArray(row.issues) ? row.issues : structuralIssues;

  const rowIdentityKey =
    identitySource === "schema"
      ? typeof row.rowIdentityKey === "string" && row.rowIdentityKey.trim().length > 0
        ? row.rowIdentityKey
        : createLookupIdentityKey(primaryKeys, lookupSource)
      : null;
  const stableIdentity =
    identitySource === "schema" &&
    typeof row.stableIdentity === "string" &&
    row.stableIdentity.trim().length > 0
      ? row.stableIdentity
      : identitySource === "schema"
        ? createStableIdentity(primaryKeys, lookupSource, null)
        : null;
  const baseRow = {
    id,
    entity:
      typeof row.entity === "string" && row.entity.trim().length > 0
        ? row.entity
        : deriveHeuristicEntity(sourceRecord, id),
    region:
      typeof row.region === "string" && row.region.trim().length > 0
        ? row.region
        : deriveRegion(sourceRecord),
    capturedAt:
      typeof row.capturedAt === "string" ? row.capturedAt : deriveCapturedAt(sourceRecord),
    backupVersion:
      typeof row.backupVersion === "string" && row.backupVersion.trim().length > 0
        ? row.backupVersion
        : deriveBackupVersion(sourceRecord),
    checksum:
      typeof row.checksum === "string" && row.checksum.trim().length > 0
        ? row.checksum
        : createChecksum(sourceRecord),
    status: Array.isArray(row.issues)
      ? severityFromIssues(issues)
      : row.status === "healthy" || row.status === "warning" || row.status === "critical"
        ? row.status
        : severityFromIssues(issues),
    structuralIssues,
    issues,
    lookupKey:
      row.lookupKey && typeof row.lookupKey === "object" && Object.keys(row.lookupKey).length > 0
        ? row.lookupKey
        : createLookupKeyFromPrimaryKeys(primaryKeys, lookupSource),
    lookupSource,
    sourceRecord,
  };

  if (identitySource === "schema" && rowIdentityKey && stableIdentity) {
    if (rowSourceState === "live-enriched") {
      const normalizedRow: SchemaBackedBackupRow = {
        ...baseRow,
        rowSourceState: "live-enriched",
        liveRecord: liveRecord!,
        currentRecord: currentRecord as LiveCurrentRecordSnapshot,
        rowIdentityKey,
        stableIdentity,
        identitySource: "schema",
        identityState: "schema-backed",
      };
      return normalizedRow;
    }

    const normalizedRow: SchemaBackedBackupRow = {
      ...baseRow,
      rowSourceState: "backup-only",
      liveRecord: null,
      currentRecord:
        currentRecord.status === "error"
          ? (currentRecord as ErrorCurrentRecordSnapshot)
          : createUnavailableCurrentRecord(sourceRecord),
      rowIdentityKey,
      stableIdentity,
      identitySource: "schema",
      identityState: "schema-backed",
    };
    return normalizedRow;
  }

  const normalizedRow: HeuristicBackupRow = {
    ...baseRow,
    rowSourceState: "backup-only",
    liveRecord: null,
    currentRecord:
      currentRecord.status === "error"
        ? (currentRecord as ErrorCurrentRecordSnapshot)
        : createUnavailableCurrentRecord(sourceRecord),
    rowIdentityKey: null,
    stableIdentity: null,
    identitySource: "heuristic",
    identityState: "heuristic-only",
  };
  return normalizedRow;
}

export function normalizePersistedBackupSourceResponse(
  payload: unknown,
): BackupSourceResponse | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidate = payload as Partial<BackupSourceResponse>;

  if (!candidate.status || typeof candidate.status !== "object") {
    return null;
  }

  return {
    status: candidate.status,
    tables: Array.isArray(candidate.tables)
      ? candidate.tables.map((table) => {
          const partitionKey =
            typeof table.partitionKey === "string" && table.partitionKey.trim().length > 0
              ? table.partitionKey
              : "derived-id";
          const primaryKeys =
            Array.isArray(table.primaryKeys) && table.primaryKeys.length > 0
              ? table.primaryKeys.filter(
                  (item): item is string => typeof item === "string" && item.trim().length > 0,
                )
              : [partitionKey];
          const identitySource = table.identitySource === "schema" ? "schema" : "heuristic";

          return {
            ...table,
            partitionKey,
            primaryKeys,
            identitySource,
            identityState: identitySource === "schema" ? "schema-backed" : "heuristic-only",
            appliedRules: Array.isArray(table.appliedRules) ? table.appliedRules : [],
            ruleFindings: Array.isArray(table.ruleFindings) ? table.ruleFindings : [],
            rows: Array.isArray(table.rows)
              ? table.rows.map((row) =>
                  normalizePersistedBackupRow(row, primaryKeys, identitySource),
                )
              : [],
          };
        })
      : [],
    rules: Array.isArray(candidate.rules) ? candidate.rules : [],
    ruleViolations: Array.isArray(candidate.ruleViolations) ? candidate.ruleViolations : [],
    fetchedAt:
      typeof candidate.fetchedAt === "string" ? candidate.fetchedAt : new Date().toISOString(),
  };
}
