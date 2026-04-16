"use client";

import { CognitoNewPasswordRequiredError, validateAwsAccess } from "../../../../lib/aws-browser";
import { toUserMessage } from "../../../../lib/error-presenter";
import {
  listRootJsonlTableNamesFromGitHub,
  validateBackupSourceAccessFromGitHub,
} from "../../../../lib/github-browser";
import {
  createConfigValidationChallengeMessage as createValidationChallengeMessage,
  createConfigValidationFailureMessage as createValidationFailureMessage,
} from "../../../../lib/status-presenter";
import type { BackupConfig, BackupSourceStatus } from "../../../../lib/types";
import { hasAwsConfig, validateAwsConfig, validateBackupConfig } from "../../../../lib/validation";
import type { ConfigValidationActionResult } from "../action-results";
import {
  toAwsValidationFailureStatus,
  toConfigValidationFailureResult,
  toGitHubValidationFailureStatus,
  toLocalAwsValidationMessage,
  toLocalBackupValidationMessage,
  toSuccessfulConfigValidationStatus,
} from "../controller-presentation";
import type { ConfigValidationState } from "../config-validation-state";

type ValidationOutcome = {
  actionResult: ConfigValidationActionResult;
  validationStatus: BackupSourceStatus | null;
  validationState: ConfigValidationState;
  validationMessage: string;
  nextConfig: BackupConfig | null;
  pendingPasswordSession: string | null;
};

export async function executeConfigValidation(
  targetConfig: BackupConfig,
): Promise<ValidationOutcome> {
  const localValidation = validateBackupConfig(targetConfig);

  if (!localValidation.ok) {
    const message = toLocalBackupValidationMessage(localValidation);
    return {
      actionResult: toConfigValidationFailureResult(message),
      validationStatus: null,
      validationState: { kind: "invalid", message },
      validationMessage: message,
      nextConfig: null,
      pendingPasswordSession: null,
    };
  }

  try {
    const githubStatus = await validateBackupSourceAccessFromGitHub({
      githubToken: targetConfig.githubToken,
      backupRepo: targetConfig.backupRepo,
    });

    if (!githubStatus.ok) {
      const failureStatus = toGitHubValidationFailureStatus(targetConfig.backupRepo, githubStatus);
      return {
        actionResult: {
          ok: false,
          challengeRequired: false,
          code: "github-invalid",
          details: failureStatus.message,
        },
        validationStatus: failureStatus,
        validationState: { kind: "invalid", message: failureStatus.message },
        validationMessage: failureStatus.message,
        nextConfig: null,
        pendingPasswordSession: null,
      };
    }

    let checkedAwsTableCount: number | null = null;

    if (hasAwsConfig(targetConfig)) {
      const awsLocalValidation = validateAwsConfig(targetConfig);

      if (!awsLocalValidation.ok) {
        const failureMessage = toLocalAwsValidationMessage(awsLocalValidation);
        const failureStatus = toAwsValidationFailureStatus(failureMessage, githubStatus);
        return {
          actionResult: {
            ok: false,
            challengeRequired: false,
            code: "aws-invalid",
            details: failureStatus.message,
          },
          validationStatus: failureStatus,
          validationState: { kind: "invalid", message: failureStatus.message },
          validationMessage: failureStatus.message,
          nextConfig: null,
          pendingPasswordSession: null,
        };
      }

      const tableNames = await listRootJsonlTableNamesFromGitHub({
        githubToken: targetConfig.githubToken,
        backupRepo: targetConfig.backupRepo,
      });
      await validateAwsAccess({
        config: targetConfig,
        tableNames,
      });
      checkedAwsTableCount = tableNames.length;
    }

    const finalStatus = toSuccessfulConfigValidationStatus({
      githubStatus,
      checkedAwsTableCount,
    });

    return {
      actionResult: finalStatus.result,
      validationStatus: finalStatus.status,
      validationState: { kind: "valid", message: finalStatus.status.message },
      validationMessage: finalStatus.status.message,
      nextConfig: {
        ...targetConfig,
        isValidated: true,
        lastValidatedAt: new Date().toISOString(),
      },
      pendingPasswordSession: null,
    };
  } catch (error) {
    if (error instanceof CognitoNewPasswordRequiredError) {
      const message = createValidationChallengeMessage();
      return {
        actionResult: {
          ok: false,
          challengeRequired: true,
          code: "password-required",
        },
        validationStatus: null,
        validationState: { kind: "invalid", message },
        validationMessage: message,
        nextConfig: null,
        pendingPasswordSession: error.session,
      };
    }

    const message = toUserMessage(error, {
      code: "github-request",
      message: createValidationFailureMessage(),
    });
    return {
      actionResult: {
        ok: false,
        challengeRequired: false,
        code: "validation-failed",
        details: message,
      },
      validationStatus: null,
      validationState: { kind: "invalid", message },
      validationMessage: message,
      nextConfig: null,
      pendingPasswordSession: null,
    };
  }
}
