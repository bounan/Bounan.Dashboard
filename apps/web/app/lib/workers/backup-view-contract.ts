import type { AnalyzerFilters, BackupRow, BackupTableDefinition, BackupSeverity } from "../types";
import type {
  WorkerFailureEnvelope,
  WorkerRequestEnvelope,
  WorkerSuccessEnvelope,
} from "./worker-envelope";

export interface BackupViewWorkerReadyState {
  ready: true;
  viewKey: string;
  tableKey: string;
  health: BackupSeverity;
  counts: {
    total: number;
    healthy: number;
    warning: number;
    critical: number;
  };
  page: number;
  totalPages: number;
  totalRows: number;
  pageRows: BackupRow[];
}

export interface BackupViewWorkerPendingState {
  ready: false;
  viewKey?: string;
}

export type BackupViewWorkerState = BackupViewWorkerReadyState | BackupViewWorkerPendingState;

export type BackupViewWorkerRequest =
  | (WorkerRequestEnvelope & {
      type: "hydrate";
      tables: BackupTableDefinition[];
    })
  | (WorkerRequestEnvelope & {
      type: "compute";
      viewKey: string;
      tableKey: string;
      filters: AnalyzerFilters;
      page: number;
      pageSize: number;
    });

export type BackupViewWorkerResponse =
  | (WorkerSuccessEnvelope & {
      type: "hydrated";
      tableKeys: string[];
    })
  | (WorkerSuccessEnvelope & {
      type: "computed";
    } & BackupViewWorkerState)
  | ({ type: "compute-failed" } & WorkerFailureEnvelope<"missing-table" | "worker-failure">);
