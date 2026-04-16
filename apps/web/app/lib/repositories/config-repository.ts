import { toAppError } from "../errors";
import { emptyBackupConfig, readBackupConfig, writeBackupConfig } from "../storage";
import type { BackupConfig } from "../types";
import type { RepositoryReadResult, RepositoryWriteResult } from "./common";

export const configRepository = {
  read(): RepositoryReadResult<BackupConfig> {
    try {
      return {
        ok: true,
        value: readBackupConfig(),
      };
    } catch (error) {
      return {
        ok: false,
        error: toAppError(error, {
          code: "storage-read",
          message: "Failed to read the stored dashboard config.",
        }),
        fallback: emptyBackupConfig,
      };
    }
  },
  write(config: BackupConfig): RepositoryWriteResult {
    try {
      writeBackupConfig(config);
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: toAppError(error, {
          code: "storage-write",
          message: "Failed to persist the dashboard config.",
        }),
      };
    }
  },
};
