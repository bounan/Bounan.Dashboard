export type DashboardView = "config" | "backup-analyzer" | "rules";

export type BackupSeverity = "healthy" | "warning" | "critical";
export type BackupRuleScope = "structural" | "entry" | "cross-entry" | "cross-table";
export type BackupIdentitySource = "heuristic" | "schema";
export type BackupIdentityState = "heuristic-only" | "schema-backed";

export interface BackupConfig {
  githubToken: string;
  backupRepo: string;
  awsRegion: string;
  cognitoUserPoolId: string;
  cognitoUserPoolClientId: string;
  cognitoIdentityPoolId: string;
  cognitoUsername: string;
  cognitoPassword: string;
  isValidated: boolean;
  lastValidatedAt: string | null;
}

export interface BackupSourceStatus {
  ok: boolean;
  tokenSource: "user";
  repoCount: number;
  tableFileCount: number;
  message: string;
  version: {
    id: string;
    label: string;
    updatedAt: string | null;
  } | null;
  repo: {
    name: string;
    fullName: string;
    private: boolean;
    defaultBranch: string;
    url: string;
  } | null;
}

export interface BackupIssue {
  code: string;
  ruleId: string;
  scope: BackupRuleScope;
  severity: Exclude<BackupSeverity, "healthy">;
  message: string;
  fixed: boolean;
  relatedTableKey?: string | null;
  tableKey?: string | null;
  rowId?: string | null;
}

export interface BackupRuleDefinition {
  id: string;
  kind: BackupRuleScope;
  severity: Exclude<BackupSeverity, "healthy">;
  description: string;
  tablePattern: string;
  targetTablePattern?: string | null;
}

export interface BackupRuleViolationSummary {
  ruleId: string;
  code: string;
  kind: BackupRuleScope;
  severity: Exclude<BackupSeverity, "healthy">;
  description: string;
  violationCount: number;
  affectedTables: string[];
}

export interface BackupRuleFinding {
  ruleId: string;
  code: string;
  kind: BackupRuleScope;
  severity: Exclude<BackupSeverity, "healthy">;
  message: string;
  tableKey: string;
  rowId: string;
  rowIdentityKey: string | null;
  relatedTableKey?: string | null;
}

export interface BackupRuleViolationItem {
  ruleId: string;
  code: string;
  kind: BackupRuleScope;
  severity: Exclude<BackupSeverity, "healthy">;
  description: string;
  tableKey: string;
  rowId: string;
  rowIdentityKey: string | null;
  entity: string;
  isActionable: boolean;
  primaryKey: {
    label: string;
    value: string;
  };
  secondaryKey: {
    label: string;
    value: string;
  } | null;
}

interface CurrentRecordSnapshotBase {
  summary: string;
  fields: Array<{
    key: string;
    value: string;
  }>;
}

export interface UnavailableCurrentRecordSnapshot extends CurrentRecordSnapshotBase {
  status: "unavailable";
}

export interface LiveCurrentRecordSnapshot extends CurrentRecordSnapshotBase {
  status: "live";
}

export interface ErrorCurrentRecordSnapshot extends CurrentRecordSnapshotBase {
  status: "error";
}

export type CurrentRecordSnapshot =
  | UnavailableCurrentRecordSnapshot
  | LiveCurrentRecordSnapshot
  | ErrorCurrentRecordSnapshot;

interface BackupRowBase {
  id: string;
  entity: string;
  region: string;
  capturedAt: string | null;
  backupVersion: string;
  checksum: string;
  status: BackupSeverity;
  structuralIssues: BackupIssue[];
  issues: BackupIssue[];
  lookupKey: Record<string, string | number | boolean | null>;
  lookupSource: Record<string, string | number | boolean | null>;
  sourceRecord: Record<string, unknown>;
}

interface BackupOnlyRowState {
  rowSourceState: "backup-only";
  liveRecord: null;
  currentRecord: UnavailableCurrentRecordSnapshot | ErrorCurrentRecordSnapshot;
}

interface LiveEnrichedRowState {
  rowSourceState: "live-enriched";
  liveRecord: Record<string, unknown>;
  currentRecord: LiveCurrentRecordSnapshot;
}

export interface HeuristicBackupRow extends BackupRowBase, BackupOnlyRowState {
  rowIdentityKey: null;
  stableIdentity: null;
  identitySource: "heuristic";
  identityState: "heuristic-only";
}

export type SchemaBackedBackupRow = BackupRowBase &
  (BackupOnlyRowState | LiveEnrichedRowState) & {
    rowIdentityKey: string;
    stableIdentity: string;
    identitySource: "schema";
    identityState: "schema-backed";
  };

export type BackupRow = HeuristicBackupRow | SchemaBackedBackupRow;

export interface BackupTableDefinition {
  key: string;
  label: string;
  description: string;
  partitionKey: string;
  primaryKeys: string[];
  identitySource: BackupIdentitySource;
  identityState: BackupIdentityState;
  sourcePath: string;
  rowCount: number;
  appliedRules: string[];
  ruleFindings: BackupRuleFinding[];
  rows: BackupRow[];
}

export interface AnalyzerFilters {
  query: string;
  issuesOnly: boolean;
  status: "all" | BackupSeverity;
  sortBy: "capturedAt" | "entity" | "status";
  sortDirection: "asc" | "desc";
}

export interface BackupSourceResponse {
  status: BackupSourceStatus;
  tables: BackupTableDefinition[];
  rules: BackupRuleDefinition[];
  ruleViolations: BackupRuleViolationSummary[];
  fetchedAt: string;
}

export interface BackupRefreshState {
  status: "idle" | "running" | "ready" | "failed";
  method: "worker-fetch" | "direct-fetch" | null;
  message: string | null;
  progress: number;
  updatedAt: string | null;
}
