"use client";

import type { Dispatch, SetStateAction } from "react";
import type {
  BackupLoadActionResult,
  ConfigValidationActionResult,
  EntryLookupActionResult,
  RowRefetchActionResult,
  TableRefreshActionResult,
} from "./hooks/action-results";
import type {
  AnalyzerFilters,
  BackupConfig,
  BackupRefreshState,
  BackupRuleDefinition,
  BackupRuleViolationSummary,
  BackupSourceStatus,
  BackupTableDefinition,
} from "../../lib/types";
import type { ConfigValidationState } from "./hooks/config-validation-state";

export interface ConfigControllerViewModel {
  config: BackupConfig;
  validationStatus: BackupSourceStatus | null;
  validationState: ConfigValidationState;
  validationMessage: string | null;
  saveMessage: string | null;
  updateConfig: (
    field: keyof Pick<
      BackupConfig,
      | "githubToken"
      | "backupRepo"
      | "awsRegion"
      | "cognitoUserPoolId"
      | "cognitoUserPoolClientId"
      | "cognitoIdentityPoolId"
      | "cognitoUsername"
      | "cognitoPassword"
    >,
    value: string,
  ) => void;
  importConfig: (file: File) => Promise<void>;
  exportConfig: () => void;
  saveConfig: () => void;
  validateConfigWithTarget: (targetConfig: BackupConfig) => Promise<ConfigValidationActionResult>;
}

export interface BackupControllerViewModel {
  source: BackupSourceStatus | null;
  tables: BackupTableDefinition[];
  rules: BackupRuleDefinition[];
  ruleViolations: BackupRuleViolationSummary[];
  filters: AnalyzerFilters;
  selectedRowId: string | null;
  refreshState: BackupRefreshState;
  loadError: string | null;
  setFilters: Dispatch<SetStateAction<AnalyzerFilters>>;
  setSelectedRowId: (value: string | null) => void;
  loadBackupData: () => Promise<BackupLoadActionResult>;
}

export interface AwsRefetchControllerViewModel {
  isRefetchingRow: boolean;
  isRefreshingTable: boolean;
  isLookingUpEntry: boolean;
  refreshingTableKey: string | null;
  tableRefreshMessage: string | null;
  updatingRuleViolationKeys: Set<string>;
  refetchSelectedRow: (tableKey: string, rowId: string) => Promise<RowRefetchActionResult>;
  refetchRuleViolation: (tableKey: string, rowId: string) => Promise<RowRefetchActionResult>;
  refreshTable: (tableKey: string) => Promise<TableRefreshActionResult>;
  loadEntryByKey: (
    tableKey: string,
    lookupValues: Record<string, string>,
  ) => Promise<EntryLookupActionResult>;
}

export interface BackupVersionStateViewModel {
  hasUpdateAvailable: boolean;
  isCheckingVersion: boolean;
}
