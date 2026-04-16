"use client";

import type {
  BackupViewWorkerRequest,
  BackupViewWorkerResponse,
  BackupViewWorkerState,
} from "./backup-view-contract";
import type { AnalyzerFilters, BackupTableDefinition } from "../types";

let worker: Worker | null = null;
let nextRequestId = 1;

function getWorker() {
  if (!worker) {
    worker = new Worker(new URL("../../workers/backup-view.worker.ts", import.meta.url), {
      type: "module",
    });
  }

  return worker;
}

export function disposeBackupViewWorkerClient() {
  worker?.terminate();
  worker = null;
}

export function hydrateBackupViewTables(tables: BackupTableDefinition[]) {
  const requestId = nextRequestId;
  nextRequestId += 1;

  return new Promise<string[]>((resolve, reject) => {
    const activeWorker = getWorker();

    const onMessage = (event: MessageEvent<BackupViewWorkerResponse>) => {
      const data = event.data;

      if (data.requestId !== requestId) {
        return;
      }

      if (data.type === "compute-failed") {
        activeWorker.removeEventListener("message", onMessage);
        activeWorker.removeEventListener("error", onError);
        reject(new Error(data.error));
        return;
      }

      if (data.type !== "hydrated") {
        return;
      }

      activeWorker.removeEventListener("message", onMessage);
      activeWorker.removeEventListener("error", onError);
      resolve(data.tableKeys);
    };

    const onError = () => {
      activeWorker.removeEventListener("message", onMessage);
      activeWorker.removeEventListener("error", onError);
      reject(new Error("Backup view worker hydration failed."));
    };

    activeWorker.addEventListener("message", onMessage);
    activeWorker.addEventListener("error", onError);
    activeWorker.postMessage({
      type: "hydrate",
      requestId,
      tables,
    } satisfies BackupViewWorkerRequest);
  });
}

export function computeBackupViewInWorker(input: {
  tableKey: string;
  viewKey: string;
  filters: AnalyzerFilters;
  page: number;
  pageSize: number;
}) {
  const requestId = nextRequestId;
  nextRequestId += 1;

  return new Promise<BackupViewWorkerState>((resolve, reject) => {
    const activeWorker = getWorker();

    const onMessage = (event: MessageEvent<BackupViewWorkerResponse>) => {
      const data = event.data;

      if (data.requestId !== requestId) {
        return;
      }

      if (data.type === "compute-failed") {
        activeWorker.removeEventListener("message", onMessage);
        activeWorker.removeEventListener("error", onError);
        reject(new Error(data.error));
        return;
      }

      if (data.type !== "computed") {
        return;
      }

      activeWorker.removeEventListener("message", onMessage);
      activeWorker.removeEventListener("error", onError);
      resolve(data.ready ? data : { ready: false, viewKey: data.viewKey });
    };

    const onError = () => {
      activeWorker.removeEventListener("message", onMessage);
      activeWorker.removeEventListener("error", onError);
      reject(new Error("Backup view worker failed."));
    };

    activeWorker.addEventListener("message", onMessage);
    activeWorker.addEventListener("error", onError);
    activeWorker.postMessage({
      type: "compute",
      requestId,
      viewKey: input.viewKey,
      tableKey: input.tableKey,
      filters: input.filters,
      page: input.page,
      pageSize: input.pageSize,
    } satisfies BackupViewWorkerRequest);
  });
}
