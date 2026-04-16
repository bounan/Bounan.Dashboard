import { toAppError } from "../errors";
import { readBackupAnalyzerCache, writeBackupAnalyzerCache } from "../storage";
import type { BackupConfig, BackupSourceResponse } from "../types";
import type { RepositoryReadResult, RepositoryWriteResult } from "./common";

export const snapshotRepository = {
  async read(
    config: Pick<BackupConfig, "githubToken" | "backupRepo">,
  ): Promise<RepositoryReadResult<BackupSourceResponse | null>> {
    try {
      return {
        ok: true,
        value: await readBackupAnalyzerCache(config),
      };
    } catch (error) {
      return {
        ok: false,
        error: toAppError(error, {
          code: "storage-read",
          message: "Failed to read the cached backup snapshot.",
        }),
        fallback: null,
      };
    }
  },
  async write(
    config: Pick<BackupConfig, "githubToken" | "backupRepo">,
    payload: BackupSourceResponse,
  ): Promise<RepositoryWriteResult> {
    try {
      await writeBackupAnalyzerCache(config, payload);
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: toAppError(error, {
          code: "storage-write",
          message: "Failed to persist the backup snapshot.",
        }),
      };
    }
  },
};
