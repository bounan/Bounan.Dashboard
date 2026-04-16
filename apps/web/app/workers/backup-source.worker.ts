import { getBackupSourceDataFromGitHub } from "../lib/github-browser";
import type {
  BackupSourceWorkerRequest,
  BackupSourceWorkerResponse,
} from "../lib/workers/backup-source-contract";

self.onmessage = (event: MessageEvent<BackupSourceWorkerRequest>) => {
  if (event.data.type !== "load-backup") {
    return;
  }

  void getBackupSourceDataFromGitHub({
    githubToken: event.data.githubToken,
    backupRepo: event.data.backupRepo,
  })
    .then((payload) => {
      const response: BackupSourceWorkerResponse = {
        type: "backup-loaded",
        requestId: event.data.requestId,
        payload,
      };
      self.postMessage(response);
    })
    .catch((error: unknown) => {
      const response: BackupSourceWorkerResponse = {
        type: "backup-load-failed",
        requestId: event.data.requestId,
        errorCode: "github-browser",
        error: error instanceof Error ? error.message : "Failed to load backup data.",
      };
      self.postMessage(response);
    });
};

export {};
