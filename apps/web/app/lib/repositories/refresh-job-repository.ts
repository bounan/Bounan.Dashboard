import { toAppError } from "../errors";
import {
  emptyBackupRefreshState,
  readBackupRefreshState,
  writeBackupRefreshState,
} from "../storage";
import type { BackupConfig, BackupRefreshState } from "../types";
import type { RepositoryReadResult, RepositoryWriteResult } from "./common";

export const refreshJobRepository = {
  emptyState: emptyBackupRefreshState,
  async read(
    config: Pick<BackupConfig, "githubToken" | "backupRepo">,
  ): Promise<RepositoryReadResult<BackupRefreshState>> {
    try {
      return {
        ok: true,
        value: await readBackupRefreshState(config),
      };
    } catch (error) {
      return {
        ok: false,
        error: toAppError(error, {
          code: "storage-read",
          message: "Failed to read the cached refresh state.",
        }),
        fallback: emptyBackupRefreshState,
      };
    }
  },
  async write(
    config: Pick<BackupConfig, "githubToken" | "backupRepo">,
    state: BackupRefreshState,
  ): Promise<RepositoryWriteResult> {
    try {
      await writeBackupRefreshState(config, state);
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: toAppError(error, {
          code: "storage-write",
          message: "Failed to persist the refresh state.",
        }),
      };
    }
  },
};
