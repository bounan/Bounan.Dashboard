"use client";

import { AppError } from "../errors";

export const retryableAwsErrorNames = new Set([
  "ProvisionedThroughputExceededException",
  "ThrottlingException",
  "RequestLimitExceeded",
  "ResourceExceededException",
]);

export function requireValue(value: string, label: string) {
  if (!value.trim()) {
    throw new AppError("aws-auth", `${label} is required.`);
  }

  return value.trim();
}

export class CognitoNewPasswordRequiredError extends Error {
  session: string;

  constructor(session: string) {
    super("Cognito requires a permanent password before this action can continue.");
    this.name = "CognitoNewPasswordRequiredError";
    this.session = session;
  }
}

function delay(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export async function sendWithRetry<T>(task: () => Promise<T>, attempt = 0): Promise<T> {
  try {
    return await task();
  } catch (error) {
    const name = error instanceof Error ? error.name : "";

    if (!retryableAwsErrorNames.has(name) || attempt >= 5) {
      throw error;
    }

    await delay(Math.min(250 * 2 ** attempt, 2500));
    return sendWithRetry(task, attempt + 1);
  }
}
