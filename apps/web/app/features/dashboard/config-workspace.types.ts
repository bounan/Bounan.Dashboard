"use client";

import type { BackupConfig, BackupSourceStatus } from "../../lib/types";
import type { ConfigValidationState } from "./hooks/config-validation-state";

export interface ConfigWorkspaceProps {
  config: BackupConfig;
  source: BackupSourceStatus | null;
  validationState: ConfigValidationState;
  validationMessage: string | null;
  saveMessage: string | null;
  onChange: (
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
  onImport: (file: File) => Promise<void>;
  onExport: () => void;
  onValidate: () => Promise<void>;
  onSave: () => void;
}
