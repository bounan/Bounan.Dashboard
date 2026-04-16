"use client";

import type { GitHubBackupDataResult, GitHubRepoAccessResult } from "../../../lib/github-browser";
import {
  createAwsValidationMessage,
  createBackupLoadValidatedMessage,
  createGitHubAccessValidatedMessage,
  createGitHubValidationFailedMessage,
  createLocalAwsConfigValidationMessage,
  createLocalBackupConfigValidationMessage,
} from "../../../lib/status-presenter";
import type { BackupSourceResponse, BackupSourceStatus } from "../../../lib/types";
import type { ValidationCheckResult } from "../../../lib/validation";
import type { BackupLoadActionResult, ConfigValidationActionResult } from "./action-results";

export function toLocalBackupValidationMessage(result: ValidationCheckResult) {
  return createLocalBackupConfigValidationMessage(result.issue);
}

export function toLocalAwsValidationMessage(result: ValidationCheckResult) {
  return createLocalAwsConfigValidationMessage(result.issue);
}

export function toConfigValidationFailureResult(message: string): ConfigValidationActionResult {
  return {
    ok: false,
    challengeRequired: false,
    code: "validation-failed",
    details: message,
  };
}

export function toGitHubValidationFailureStatus(
  backupRepo: string,
  githubStatus: GitHubRepoAccessResult,
): BackupSourceStatus {
  const message = createGitHubValidationFailedMessage(
    backupRepo,
    githubStatus.errorDetails ?? undefined,
  );

  return {
    ok: false,
    tokenSource: "user",
    repoCount: githubStatus.repoCount,
    tableFileCount: 0,
    message,
    version: null,
    repo: githubStatus.repo,
  };
}

export function toAwsValidationFailureStatus(
  message: string,
  githubStatus: GitHubRepoAccessResult,
): BackupSourceStatus {
  return {
    ok: false,
    tokenSource: "user",
    repoCount: githubStatus.repoCount,
    tableFileCount: 0,
    message,
    version: null,
    repo: githubStatus.repo,
  };
}

export function toSuccessfulConfigValidationStatus(input: {
  githubStatus: GitHubRepoAccessResult;
  checkedAwsTableCount: number | null;
}) {
  const message =
    input.checkedAwsTableCount === null
      ? createGitHubAccessValidatedMessage()
      : `${createGitHubAccessValidatedMessage()} ${createAwsValidationMessage(input.checkedAwsTableCount)}`;

  const status: BackupSourceStatus = {
    ok: true,
    tokenSource: "user",
    repoCount: input.githubStatus.repoCount,
    tableFileCount: 0,
    message,
    version: null,
    repo: input.githubStatus.repo,
  };

  return {
    status,
    result: {
      ok: true,
      challengeRequired: false,
      code: "validated",
    } satisfies ConfigValidationActionResult,
  };
}

export function toBackupSourceResponse(
  backupRepo: string,
  payload: GitHubBackupDataResult,
): BackupSourceResponse {
  return {
    status: {
      ok: payload.ok,
      tokenSource: "user",
      repoCount: payload.repoCount,
      tableFileCount: payload.tableFileCount,
      message: payload.ok
        ? createBackupLoadValidatedMessage(payload.tableFileCount)
        : createGitHubValidationFailedMessage(backupRepo, payload.errorDetails ?? undefined),
      version: payload.version,
      repo: payload.repo,
    },
    tables: payload.tables,
    rules: payload.rules,
    ruleViolations: payload.ruleViolations,
    fetchedAt: payload.fetchedAt,
  };
}

export function toBackupLoadActionResult(payload: BackupSourceResponse): BackupLoadActionResult {
  return payload.status.ok
    ? { ok: true, code: "backup-loaded" }
    : { ok: false, code: "backup-load-failed", details: payload.status.message };
}
