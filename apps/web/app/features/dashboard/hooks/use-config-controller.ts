"use client";

import { useState } from "react";
import { toUserMessage } from "../../../lib/error-presenter";
import {
  createConfigImportedMessage,
  createConfigSavedMessage,
  createPasswordUpdateFailureMessage,
  createPermanentPasswordRequiredMessage,
  createValidationPasswordUpdateRequiredMessage,
} from "../../../lib/status-presenter";
import type { BackupConfig, BackupSourceStatus } from "../../../lib/types";
import { useDashboardConfigState } from "./use-dashboard-config-state";
import type { ConfigValidationActionResult } from "./action-results";
import {
  type ConfigValidationState,
  uncheckedConfigValidationState,
} from "./config-validation-state";
import { exportDashboardConfig } from "./config-actions/export-config";
import { applyImportedConfig } from "./config-actions/import-config";
import { completeConfigPasswordChallenge } from "./config-actions/complete-password-challenge";
import { saveDashboardConfig } from "./config-actions/save-config";
import { executeConfigValidation } from "./config-actions/validate-config";
import { useDashboardNotifier } from "./use-dashboard-notifier";

export function useConfigController(input: {
  defaultConfig: Pick<BackupConfig, "backupRepo">;
  onConfigMutated: (nextConfig: Pick<BackupConfig, "githubToken" | "backupRepo">) => void;
}) {
  const { config, setConfig } = useDashboardConfigState(input.defaultConfig);
  const [validationStatus, setValidationStatus] = useState<BackupSourceStatus | null>(null);
  const [validationState, setValidationState] = useState<ConfigValidationState>(
    uncheckedConfigValidationState,
  );
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [pendingPasswordSession, setPendingPasswordSession] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordError, setNewPasswordError] = useState<string | null>(null);
  const [isCompletingPasswordChallenge, setIsCompletingPasswordChallenge] = useState(false);
  const notifier = useDashboardNotifier();

  function updateConfig(
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
  ) {
    setConfig((current) => {
      const nextConfig = {
        ...current,
        [field]: value,
        isValidated: false,
        lastValidatedAt: null,
      };
      input.onConfigMutated({
        githubToken: nextConfig.githubToken,
        backupRepo: nextConfig.backupRepo,
      });
      return nextConfig;
    });
    setValidationStatus(null);
    setValidationState(uncheckedConfigValidationState);
    setValidationMessage(null);
    setSaveMessage(null);
  }

  async function importConfig(file: File) {
    try {
      const raw = await file.text();

      setConfig((current) => {
        const nextConfig = applyImportedConfig(current, raw);
        input.onConfigMutated({
          githubToken: nextConfig.githubToken,
          backupRepo: nextConfig.backupRepo,
        });
        return nextConfig;
      });

      setValidationStatus(null);
      const message = createConfigImportedMessage();
      setValidationState({
        kind: "info",
        message,
      });
      setValidationMessage(message);
      setSaveMessage(null);
      notifier.configImported();
    } catch {
      notifier.configImportFailed();
    }
  }

  function exportConfig() {
    exportDashboardConfig(config);
  }

  function saveConfig() {
    const result = saveDashboardConfig(config);

    if (!result.ok) {
      setSaveMessage(result.error.message);
      notifier.configSaveFailed(result.error.message);
      return;
    }

    setSaveMessage(createConfigSavedMessage());
    notifier.configSaved();
  }

  async function validateConfigWithTarget(
    targetConfig: BackupConfig,
  ): Promise<ConfigValidationActionResult> {
    setSaveMessage(null);
    const outcome = await executeConfigValidation(targetConfig);

    setValidationStatus(outcome.validationStatus);
    setValidationMessage(outcome.validationMessage);
    setValidationState(outcome.validationState);

    if (outcome.pendingPasswordSession) {
      notifier.passwordUpdateRequired(createValidationPasswordUpdateRequiredMessage());
      setPendingPasswordSession(outcome.pendingPasswordSession);
    }

    if (outcome.nextConfig) {
      setConfig(outcome.nextConfig);
      notifier.accessValidated(outcome.validationMessage);
    } else if (!outcome.actionResult.ok) {
      notifier.validationFailed(outcome.validationMessage);
    }

    return outcome.actionResult;
  }

  return {
    config,
    setConfig,
    validationStatus,
    validationState,
    validationMessage,
    saveMessage,
    updateConfig,
    importConfig,
    exportConfig,
    saveConfig,
    validateConfigWithTarget,
    pendingPasswordSession,
    newPassword,
    newPasswordError,
    isCompletingPasswordChallenge,
    setNewPassword,
    clearPasswordChallenge() {
      if (isCompletingPasswordChallenge) {
        return;
      }

      setPendingPasswordSession(null);
      setNewPassword("");
      setNewPasswordError(null);
    },
    async completePasswordChallenge() {
      if (!pendingPasswordSession) {
        return false;
      }

      const trimmedPassword = newPassword.trim();

      if (!trimmedPassword) {
        setNewPasswordError(createPermanentPasswordRequiredMessage());
        return false;
      }

      setIsCompletingPasswordChallenge(true);
      setNewPasswordError(null);

      try {
        const nextConfig = await completeConfigPasswordChallenge({
          config,
          session: pendingPasswordSession,
          newPassword: trimmedPassword,
        });

        setConfig(nextConfig);
        setPendingPasswordSession(null);
        setNewPassword("");
        notifier.passwordUpdated();
        await validateConfigWithTarget(nextConfig);
        return true;
      } catch (error) {
        setNewPasswordError(
          toUserMessage(error, {
            code: "aws-auth",
            message: createPasswordUpdateFailureMessage(),
          }),
        );
        return false;
      } finally {
        setIsCompletingPasswordChallenge(false);
      }
    },
  };
}
