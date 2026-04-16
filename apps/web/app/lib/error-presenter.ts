import { AppError, type AppErrorCode, toAppError } from "./errors";

const ERROR_MESSAGES: Record<AppErrorCode, string> = {
  "github-auth": "GitHub rejected the token. Verify that the token is correct and still active.",
  "github-rate-limit": "GitHub API rate limit exceeded. Wait for reset or use a different token.",
  "github-forbidden": "GitHub denied access to this repository or API resource.",
  "github-not-found":
    "The configured GitHub repository was not found or is not visible to this token.",
  "github-request": "GitHub request failed.",
  "jsonl-parse": "One of the backup JSONL files could not be parsed.",
  "storage-read": "Failed to read persisted dashboard data from browser storage.",
  "storage-write": "Failed to write dashboard data to browser storage.",
  "worker-failure": "A background worker failed while preparing backup data.",
  "aws-auth": "AWS authentication failed.",
  "aws-permission": "AWS permissions are insufficient for the requested action.",
};

export function toUserMessage(error: unknown, fallback: { code: AppErrorCode; message: string }) {
  const appError = toAppError(error, fallback);
  const baseMessage = ERROR_MESSAGES[appError.code] ?? fallback.message;

  if (appError instanceof AppError && appError.message && appError.message !== baseMessage) {
    return `${baseMessage} ${appError.message}`;
  }

  return baseMessage;
}
