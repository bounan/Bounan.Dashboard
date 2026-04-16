"use client";

import { completeNewPasswordChallenge } from "../../../../lib/aws-browser";
import type { BackupConfig } from "../../../../lib/types";

export async function completeAwsPasswordChallenge(input: {
  config: BackupConfig;
  session: string;
  newPassword: string;
}) {
  await completeNewPasswordChallenge({
    config: input.config,
    session: input.session,
    newPassword: input.newPassword,
  });

  return {
    ...input.config,
    cognitoPassword: input.newPassword,
    isValidated: false,
    lastValidatedAt: null,
  } satisfies BackupConfig;
}
