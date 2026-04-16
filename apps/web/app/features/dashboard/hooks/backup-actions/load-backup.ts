"use client";

import { enrichTablesWithDynamoSchema } from "../../../../lib/aws-browser";
import { toUserMessage } from "../../../../lib/error-presenter";
import { refreshJobRepository, snapshotRepository } from "../../../../lib/repositories";
import {
  createBackupLoadFailureMessage,
  createBackupLoadStartingMessage,
  createBackupLoadValidationRequiredMessage,
} from "../../../../lib/status-presenter";
import type {
  BackupConfig,
  BackupRefreshState,
  BackupSourceResponse,
  BackupTableDefinition,
} from "../../../../lib/types";
import { hasAwsConfig, validateBackupConfig } from "../../../../lib/validation";
import { requestBackupSourceData } from "../../../../lib/workers/backup-source-client";
import type { BackupLoadActionResult } from "../action-results";
import {
  toBackupLoadActionResult,
  toBackupSourceResponse,
  toLocalBackupValidationMessage,
} from "../controller-presentation";

export async function executeBackupLoad(input: {
  config: BackupConfig;
  hasValidatedConfig: boolean;
  currentRefreshState: BackupRefreshState;
  onRequireConfig: () => void;
  onLoadBlocked: (message: string) => void;
  onValidationRequired: (message: string) => void;
  onRunningState: (state: BackupRefreshState) => void;
  onLoadError: (message: string | null) => void;
  onHydrate: (payload: BackupSourceResponse) => void;
  onReadyState: (state: BackupRefreshState) => void;
  onFailedState: (state: BackupRefreshState) => void;
  onCacheWarning: (message: string) => void;
  onLoaded: () => void;
  onLoadFailed: (message: string) => void;
}): Promise<BackupLoadActionResult> {
  const localValidation = validateBackupConfig(input.config);

  if (!localValidation.ok) {
    const message = toLocalBackupValidationMessage(localValidation);
    input.onLoadBlocked(message);
    input.onRequireConfig();
    return { ok: false, code: "config-invalid", details: message };
  }

  if (!input.hasValidatedConfig) {
    const message = createBackupLoadValidationRequiredMessage();
    input.onValidationRequired(message);
    input.onRequireConfig();
    return { ok: false, code: "validation-required", details: message };
  }

  const runningState: BackupRefreshState = {
    status: "running",
    method: null,
    message: createBackupLoadStartingMessage(),
    progress: 12,
    updatedAt: new Date().toISOString(),
  };

  input.onRunningState(runningState);
  input.onLoadError(null);
  const runningStateResult = await refreshJobRepository.write(input.config, runningState);

  if (!runningStateResult.ok) {
    input.onCacheWarning(runningStateResult.error.message);
  }

  try {
    const payload = await requestBackupSourceData({
      githubToken: input.config.githubToken,
      backupRepo: input.config.backupRepo,
    });

    const enrichedTables: BackupTableDefinition[] = hasAwsConfig(input.config)
      ? await enrichTablesWithDynamoSchema({
          config: input.config,
          tables: payload.tables,
        }).catch(() => payload.tables)
      : payload.tables;
    const enrichedPayload: BackupSourceResponse = {
      ...toBackupSourceResponse(input.config.backupRepo, payload),
      tables: enrichedTables,
    };

    input.onHydrate(enrichedPayload);
    const snapshotWriteResult = await snapshotRepository.write(input.config, enrichedPayload);
    const nextState: BackupRefreshState = {
      status: enrichedPayload.status.ok ? "ready" : "failed",
      method: "worker-fetch",
      message: enrichedPayload.status.message,
      progress: enrichedPayload.status.ok ? 100 : 0,
      updatedAt: new Date().toISOString(),
    };
    input.onReadyState(nextState);
    const refreshWriteResult = await refreshJobRepository.write(input.config, nextState);

    if (!snapshotWriteResult.ok || !refreshWriteResult.ok) {
      const cacheWarningMessage = !snapshotWriteResult.ok
        ? snapshotWriteResult.error.message
        : !refreshWriteResult.ok
          ? refreshWriteResult.error.message
          : "A storage warning occurred while caching the backup snapshot.";

      input.onCacheWarning(cacheWarningMessage);
    }

    if (enrichedPayload.status.ok) {
      input.onLoaded();
    } else {
      input.onLoadFailed(enrichedPayload.status.message);
    }

    return toBackupLoadActionResult(enrichedPayload);
  } catch (error) {
    const message = toUserMessage(error, {
      code: "worker-failure",
      message: createBackupLoadFailureMessage(),
    });
    const nextState: BackupRefreshState = {
      status: "failed",
      method: input.currentRefreshState.method ?? "worker-fetch",
      message,
      progress: 0,
      updatedAt: new Date().toISOString(),
    };
    input.onFailedState(nextState);
    const failedWriteResult = await refreshJobRepository.write(input.config, nextState);
    input.onLoadError(message);

    if (!failedWriteResult.ok) {
      input.onCacheWarning(failedWriteResult.error.message);
    }

    input.onLoadFailed(message);
    return { ok: false, code: "backup-load-failed", details: message };
  }
}
