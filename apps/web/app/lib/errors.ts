export type AppErrorCode =
  | "github-auth"
  | "github-rate-limit"
  | "github-forbidden"
  | "github-not-found"
  | "github-request"
  | "jsonl-parse"
  | "storage-read"
  | "storage-write"
  | "worker-failure"
  | "aws-auth"
  | "aws-permission";

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly cause?: unknown;

  constructor(code: AppErrorCode, message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.cause = options?.cause;
  }
}

export function toAppError(
  error: unknown,
  fallback: { code: AppErrorCode; message: string },
): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Error) {
    return new AppError(fallback.code, error.message, { cause: error });
  }

  return new AppError(fallback.code, fallback.message, { cause: error });
}
