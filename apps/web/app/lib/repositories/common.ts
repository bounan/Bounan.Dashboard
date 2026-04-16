import type { AppError } from "../errors";

export type RepositoryReadResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: AppError; fallback: T };

export type RepositoryWriteResult = { ok: true } | { ok: false; error: AppError };
