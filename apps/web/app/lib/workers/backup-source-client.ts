"use client";

import type { GitHubBackupDataResult } from "../github-browser";
import type { BackupSourceWorkerResponse } from "./backup-source-contract";

let nextBackupSourceRequestId = 1;

export function requestBackupSourceData(input: {
  githubToken: string;
  backupRepo: string;
}): Promise<GitHubBackupDataResult> {
  const requestId = nextBackupSourceRequestId;
  nextBackupSourceRequestId += 1;

  return new Promise<GitHubBackupDataResult>((resolve, reject) => {
    const worker = new Worker(new URL("../../workers/backup-source.worker.ts", import.meta.url), {
      type: "module",
    });

    worker.onmessage = (event: MessageEvent<BackupSourceWorkerResponse>) => {
      const data = event.data;

      if (data.requestId !== requestId) {
        return;
      }

      worker.terminate();

      if (data.type === "backup-loaded") {
        resolve(data.payload);
        return;
      }

      reject(new Error(data.error ?? "Failed to load backup data."));
    };

    worker.onerror = () => {
      worker.terminate();
      reject(new Error("Backup worker failed."));
    };

    worker.postMessage({
      type: "load-backup",
      requestId,
      githubToken: input.githubToken,
      backupRepo: input.backupRepo,
    });
  });
}
