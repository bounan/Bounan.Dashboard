import type { GitHubBackupDataResult } from "../github-browser";

export type BackupSourceWorkerRequest = {
  type: "load-backup";
  requestId: number;
  githubToken: string;
  backupRepo: string;
};

export type BackupSourceWorkerResponse =
  | {
      type: "backup-loaded";
      requestId: number;
      payload: GitHubBackupDataResult;
    }
  | {
      type: "backup-load-failed";
      requestId: number;
      errorCode: "github-browser" | "worker-failure";
      error: string;
    };
