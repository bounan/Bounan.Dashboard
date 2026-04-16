export function createGitHubAccessValidatedMessage() {
  return "Token and repository access validated successfully.";
}

export function createLocalBackupConfigValidationMessage(issue: string | null) {
  return issue ?? "Token and repository format look valid.";
}

export function createGitHubValidationFailedMessage(repo: string, details?: string) {
  return details
    ? `GitHub validation failed for ${repo}: ${details}`
    : `GitHub validation failed for ${repo}.`;
}

export function createBackupLoadValidatedMessage(tableFileCount: number) {
  return tableFileCount > 0
    ? "Backup source validated successfully against the configured repository."
    : "Repository access is valid, but no root-level JSONL files were found.";
}

export function createAwsValidationMessage(tableCount: number) {
  return tableCount === 0
    ? "Cognito authentication succeeded. No backup tables were found to permission-check."
    : `Cognito authentication succeeded and DynamoDB read metadata access was confirmed for ${tableCount} table(s).`;
}

export function createLocalAwsConfigValidationMessage(issue: string | null) {
  return issue ?? "AWS Cognito configuration looks valid.";
}

export function createRowRefetchSuccessMessage(mode: "backup" | "rules") {
  return mode === "rules"
    ? "The item was refreshed and the rule violations list was recalculated."
    : "The current DynamoDB entry was fetched successfully.";
}

export function createRowRefetchBlockedMessage(reason: "row-missing" | "heuristic-row") {
  return reason === "row-missing"
    ? "The selected row is no longer available."
    : "This row is heuristic-only. Load DynamoDB schema metadata before refetching it.";
}

export function createRowRefetchFailureMessage(details?: string) {
  return details ?? "Failed to refetch the current row.";
}

export function createTableRefreshProgressMessage(input: {
  phase: "starting" | "scanning";
  loadedCount?: number;
  estimatedCount?: number | null;
  pageCount?: number;
}) {
  if (input.phase === "starting") {
    return "Starting DynamoDB table scan...";
  }

  const estimatedLabel =
    input.estimatedCount && input.estimatedCount > 0 ? ` of about ${input.estimatedCount}` : "";
  return `Loaded ${input.loadedCount ?? 0}${estimatedLabel} items across ${input.pageCount ?? 0} pages.`;
}

export function createTableRefreshSuccessMessage(loadedCount: number, pageCount: number) {
  return `Table refreshed from AWS. Loaded ${loadedCount} items across ${pageCount} pages.`;
}

export function createTableRefreshFailureMessage(
  reason: "table-missing" | "aws-failure",
  details?: string,
) {
  if (reason === "table-missing") {
    return "The selected table is no longer available.";
  }

  return details ?? "Failed to refresh the table from DynamoDB.";
}

export function createEntryLookupProgressMessage() {
  return "Loading DynamoDB entry by key...";
}

export function createEntryLookupSuccessMessage() {
  return "The entry was loaded from DynamoDB and merged into the current table.";
}

export function createEntryLookupFailureMessage(
  reason: "table-missing" | "aws-failure",
  details?: string,
) {
  if (reason === "table-missing") {
    return "The selected table is no longer available.";
  }

  return details ?? "Failed to load the entry from DynamoDB.";
}

export function createConfigValidationChallengeMessage() {
  return "Cognito requires a permanent password. Set it to finish validation.";
}

export function createConfigValidationFailureMessage(details?: string) {
  return details ?? "Validation failed.";
}

export function createBackupLoadValidationRequiredMessage() {
  return "Run Check on the Config page before loading backup data.";
}

export function createBackupLoadStartingMessage() {
  return "Preparing backup refresh...";
}

export function createBackupLoadFailureMessage(details?: string) {
  return details ?? "Failed to load backup data.";
}

export function createBackupLoadedMessage() {
  return "Backup snapshot and table data are ready.";
}

export function createConfigImportedMessage() {
  return "Configuration imported into the form. Run Check manually when needed.";
}

export function createConfigSavedMessage() {
  return "Configuration saved to local browser storage.";
}

export function createPermanentPasswordRequiredMessage() {
  return "A permanent password is required.";
}

export function createValidationPasswordUpdateRequiredMessage() {
  return "Set a permanent Cognito password to complete AWS validation.";
}

export function createRefetchPasswordUpdateRequiredMessage() {
  return "Set a permanent Cognito password to continue DynamoDB refetch.";
}

export function createTableRefreshPasswordUpdateRequiredMessage() {
  return "Set a permanent Cognito password to continue the table refresh.";
}

export function createEntryLookupPasswordUpdateRequiredMessage() {
  return "Set a permanent Cognito password to continue the entry lookup.";
}

export function createPasswordUpdateFailureMessage(details?: string) {
  return details ?? "Failed to set the permanent password.";
}
