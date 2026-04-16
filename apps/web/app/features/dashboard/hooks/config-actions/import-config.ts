"use client";

import type { BackupConfig } from "../../../../lib/types";

type ImportPayload = Partial<BackupConfig> & { DashboardWebConfig?: string };

export function applyImportedConfig(current: BackupConfig, raw: string): BackupConfig {
  const parsed = JSON.parse(raw) as ImportPayload;
  const dashboardWebConfig =
    typeof parsed.DashboardWebConfig === "string"
      ? (JSON.parse(parsed.DashboardWebConfig) as Partial<BackupConfig>)
      : null;

  return {
    ...current,
    githubToken: typeof parsed.githubToken === "string" ? parsed.githubToken : current.githubToken,
    backupRepo: typeof parsed.backupRepo === "string" ? parsed.backupRepo : current.backupRepo,
    cognitoUserPoolId:
      typeof parsed.cognitoUserPoolId === "string"
        ? parsed.cognitoUserPoolId
        : typeof dashboardWebConfig?.cognitoUserPoolId === "string"
          ? dashboardWebConfig.cognitoUserPoolId
          : current.cognitoUserPoolId,
    cognitoUserPoolClientId:
      typeof parsed.cognitoUserPoolClientId === "string"
        ? parsed.cognitoUserPoolClientId
        : typeof dashboardWebConfig?.cognitoUserPoolClientId === "string"
          ? dashboardWebConfig.cognitoUserPoolClientId
          : current.cognitoUserPoolClientId,
    cognitoIdentityPoolId:
      typeof parsed.cognitoIdentityPoolId === "string"
        ? parsed.cognitoIdentityPoolId
        : typeof dashboardWebConfig?.cognitoIdentityPoolId === "string"
          ? dashboardWebConfig.cognitoIdentityPoolId
          : current.cognitoIdentityPoolId,
    cognitoUsername:
      typeof parsed.cognitoUsername === "string"
        ? parsed.cognitoUsername
        : typeof dashboardWebConfig?.cognitoUsername === "string"
          ? dashboardWebConfig.cognitoUsername
          : current.cognitoUsername,
    cognitoPassword:
      typeof parsed.cognitoPassword === "string" ? parsed.cognitoPassword : current.cognitoPassword,
    awsRegion:
      typeof parsed.awsRegion === "string"
        ? parsed.awsRegion
        : typeof dashboardWebConfig?.awsRegion === "string"
          ? dashboardWebConfig.awsRegion
          : current.awsRegion,
    isValidated: false,
    lastValidatedAt: null,
  };
}
