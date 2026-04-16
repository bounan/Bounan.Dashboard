import { computeBackupView } from "../lib/workers/backup-view-runtime";
import type {
  BackupViewWorkerRequest,
  BackupViewWorkerResponse,
} from "../lib/workers/backup-view-contract";
import type { BackupTableDefinition } from "../lib/types";

const tablesByKey = new Map<string, BackupTableDefinition>();

self.onmessage = (event: MessageEvent<BackupViewWorkerRequest>) => {
  const message = event.data;

  if (message.type === "hydrate") {
    tablesByKey.clear();

    for (const table of message.tables) {
      tablesByKey.set(table.key, table);
    }

    const response: BackupViewWorkerResponse = {
      type: "hydrated",
      requestId: message.requestId,
      tableKeys: message.tables.map((table) => table.key),
    };
    self.postMessage(response);
    return;
  }

  if (message.type !== "compute") {
    return;
  }

  const table = tablesByKey.get(message.tableKey);

  if (!table) {
    const response: BackupViewWorkerResponse = {
      type: "compute-failed",
      requestId: message.requestId,
      errorCode: "missing-table",
      error: `Table ${message.tableKey} is not available in the worker cache.`,
    };
    self.postMessage(response);
    return;
  }

  const response: BackupViewWorkerResponse = {
    type: "computed",
    requestId: message.requestId,
    ...computeBackupView({
      table,
      filters: message.filters,
      page: message.page,
      pageSize: message.pageSize,
      viewKey: message.viewKey,
    }),
  };
  self.postMessage(response);
};

export {};
