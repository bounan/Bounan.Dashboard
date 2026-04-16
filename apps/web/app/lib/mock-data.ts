import type { BackupIssue, BackupRow, BackupSeverity, BackupTableDefinition } from "./types";

function iso(dayOffset: number, hour: number) {
  const base = new Date("2026-04-16T07:00:00.000Z");
  base.setUTCDate(base.getUTCDate() - dayOffset);
  base.setUTCHours(hour, 12, 0, 0);
  return base.toISOString();
}

function checksum(seed: number) {
  return `sha256-${seed.toString(16).padStart(8, "0")}`;
}

function buildIssues(seed: number, status: BackupSeverity): BackupIssue[] {
  if (status === "healthy") {
    return [];
  }

  const issues: BackupIssue[] = [
    {
      code: `JSON_SHAPE_${seed}`,
      ruleId: `json-shape-${seed}`,
      scope: "structural",
      severity: status === "critical" ? "critical" : "warning",
      message:
        status === "critical"
          ? "Schema drift detected between backup payload and current table shape."
          : "Minor backup drift detected in optional fields.",
      fixed: false,
      relatedTableKey: null,
      tableKey: null,
      rowId: null,
    },
  ];

  if (status === "critical") {
    issues.push({
      code: `DDB_RECOVERY_${seed}`,
      ruleId: `ddb-recovery-${seed}`,
      scope: "structural",
      severity: "critical",
      message: "Current DynamoDB record no longer matches the backup checksum.",
      fixed: false,
      relatedTableKey: null,
      tableKey: null,
      rowId: null,
    });
  }

  return issues;
}

function buildRows(
  prefix: string,
  region: string,
  issueEvery: number,
  keyName: string,
): BackupRow[] {
  return Array.from({ length: 36 }, (_, index) => {
    const seed = index + 1;
    const severity: BackupSeverity =
      seed % issueEvery === 0 ? "critical" : seed % 3 === 0 ? "warning" : "healthy";
    const id = `${prefix}-${seed.toString().padStart(4, "0")}`;

    return {
      id,
      rowIdentityKey: null,
      stableIdentity: null,
      identitySource: "heuristic",
      identityState: "heuristic-only",
      rowSourceState: "backup-only",
      entity: `${prefix.toUpperCase()}_${seed.toString().padStart(4, "0")}`,
      region,
      capturedAt: iso(seed % 9, 7 + (seed % 10)),
      backupVersion: `2026.04.${(seed % 7) + 1}`,
      checksum: checksum(seed * 173),
      status: severity,
      structuralIssues: buildIssues(seed, severity),
      issues: buildIssues(seed, severity),
      lookupKey: { [keyName]: id },
      lookupSource: {
        [keyName]: id,
        region,
      },
      sourceRecord: {
        [keyName]: id,
        entity: `${prefix.toUpperCase()}_${seed.toString().padStart(4, "0")}`,
        region,
      },
      liveRecord: null,
      currentRecord: {
        status: severity === "healthy" ? "unavailable" : "error",
        summary:
          severity === "healthy"
            ? "Live DynamoDB lookup is not configured yet for this dashboard instance."
            : "Current record was fetched from DynamoDB and needs operator review.",
        fields: [
          { key: keyName, value: id },
          { key: "region", value: region },
          { key: "checksum", value: checksum(seed * 173 + 9) },
          { key: "state", value: severity === "healthy" ? "consistent" : "drifted" },
        ],
      },
    };
  });
}

function buildTable(input: {
  key: string;
  label: string;
  description: string;
  partitionKey: string;
  region: string;
  prefix: string;
  issueEvery: number;
}): BackupTableDefinition {
  const rows = buildRows(input.prefix, input.region, input.issueEvery, input.partitionKey);

  return {
    key: input.key,
    label: input.label,
    description: input.description,
    partitionKey: input.partitionKey,
    primaryKeys: [input.partitionKey],
    identitySource: "heuristic",
    identityState: "heuristic-only",
    sourcePath: `${input.key}.jsonl`,
    rowCount: rows.length,
    appliedRules: [],
    ruleFindings: [],
    rows,
  };
}

export const backupTables: BackupTableDefinition[] = [
  buildTable({
    key: "accounts",
    label: "Accounts",
    description: "User identities, tenancy flags, and access state.",
    partitionKey: "accountId",
    region: "eu-central-1",
    prefix: "acct",
    issueEvery: 5,
  }),
  buildTable({
    key: "subscriptions",
    label: "Subscriptions",
    description: "Billing rows with entitlement and trial transitions.",
    partitionKey: "subscriptionId",
    region: "eu-west-1",
    prefix: "sub",
    issueEvery: 4,
  }),
  buildTable({
    key: "audit-log",
    label: "Audit Log",
    description: "Immutable activity ledger with cross-system trace references.",
    partitionKey: "eventId",
    region: "us-east-1",
    prefix: "audit",
    issueEvery: 6,
  }),
];
