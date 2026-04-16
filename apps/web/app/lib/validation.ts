import { z } from "zod";
import type { BackupConfig } from "./types";

export const githubTokenSchema = z
  .string()
  .trim()
  .regex(/^(ghp_|github_pat_)[A-Za-z0-9_]{20,}$/, "Invalid GitHub token format");

export const backupRepoSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/, "Repository must look like owner/repo");

export const backupConfigSchema = z.object({
  githubToken: githubTokenSchema,
  backupRepo: backupRepoSchema,
});

export const awsConfigSchema = z.object({
  awsRegion: z.string().trim().min(1, "AWS region is required"),
  cognitoUserPoolId: z.string().trim().min(1, "Cognito User Pool ID is required"),
  cognitoUserPoolClientId: z.string().trim().min(1, "Cognito User Pool Client ID is required"),
  cognitoIdentityPoolId: z.string().trim().min(1, "Cognito Identity Pool ID is required"),
  cognitoUsername: z.string().trim().min(1, "Cognito username is required"),
  cognitoPassword: z.string().trim().min(1, "Cognito password is required"),
});

export interface ValidationCheckResult {
  ok: boolean;
  issue: string | null;
}

export function validateBackupConfig(
  config: Pick<BackupConfig, "githubToken" | "backupRepo">,
): ValidationCheckResult {
  const result = backupConfigSchema.safeParse(config);

  if (result.success) {
    return {
      ok: true,
      issue: null,
    };
  }

  return {
    ok: false,
    issue: result.error.issues[0]?.message ?? "Invalid backup configuration",
  };
}

export function hasAwsConfig(
  config: Pick<
    BackupConfig,
    | "awsRegion"
    | "cognitoUserPoolId"
    | "cognitoUserPoolClientId"
    | "cognitoIdentityPoolId"
    | "cognitoUsername"
    | "cognitoPassword"
  >,
) {
  return (
    config.awsRegion.trim().length > 0 ||
    config.cognitoUserPoolId.trim().length > 0 ||
    config.cognitoUserPoolClientId.trim().length > 0 ||
    config.cognitoIdentityPoolId.trim().length > 0 ||
    config.cognitoUsername.trim().length > 0 ||
    config.cognitoPassword.trim().length > 0
  );
}

export function validateAwsConfig(
  config: Pick<
    BackupConfig,
    | "awsRegion"
    | "cognitoUserPoolId"
    | "cognitoUserPoolClientId"
    | "cognitoIdentityPoolId"
    | "cognitoUsername"
    | "cognitoPassword"
  >,
): ValidationCheckResult {
  const result = awsConfigSchema.safeParse(config);

  if (result.success) {
    return {
      ok: true,
      issue: null,
    };
  }

  return {
    ok: false,
    issue: result.error.issues[0]?.message ?? "Invalid AWS configuration",
  };
}
