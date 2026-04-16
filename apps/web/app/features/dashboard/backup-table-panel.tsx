import { RefreshCw } from "lucide-react";
import type { BackupRefreshState, BackupTableDefinition } from "../../lib/types";
import { formatDate } from "./utils";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { ScrollArea } from "../ui/scroll-area";
import { Skeleton } from "../ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { backupTone } from "./backup-shared";

export function BackupTablePanel({
  activeTable,
  health,
  pageRows,
  selectedRowId,
  isPreparingView,
  isRefreshingTable,
  isLookingUpEntry,
  refreshingTableKey,
  tableRefreshMessage,
  refreshState,
  activeWorkerState,
  lookupValues,
  onLookupValueChange,
  onSelectRow,
  onRefreshTable,
  onLoadEntryByKey,
  onPageChange,
}: {
  activeTable: BackupTableDefinition;
  health: "healthy" | "warning" | "critical";
  pageRows: BackupTableDefinition["rows"];
  selectedRowId: string | null;
  isPreparingView: boolean;
  isRefreshingTable: boolean;
  isLookingUpEntry: boolean;
  refreshingTableKey: string | null;
  tableRefreshMessage: string | null;
  refreshState: BackupRefreshState;
  activeWorkerState: {
    totalRows: number;
    page: number;
    totalPages: number;
  } | null;
  lookupValues: Record<string, string>;
  onLookupValueChange: (key: string, value: string) => void;
  onSelectRow: (rowId: string) => void;
  onRefreshTable: () => void;
  onLoadEntryByKey: () => void;
  onPageChange: (page: number) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <CardTitle>{activeTable.label}</CardTitle>
            <CardDescription>{activeTable.description}</CardDescription>
            <p className="text-sm text-slate-400">
              Primary keys: {activeTable.primaryKeys.join(", ")} · Identity:{" "}
              {activeTable.identityState}
            </p>
          </div>
          <div className="flex flex-col items-start gap-3 lg:items-end">
            <Badge variant={backupTone(health)}>{health}</Badge>
            <Button
              variant="secondary"
              disabled={isRefreshingTable && refreshingTableKey === activeTable.key}
              onClick={onRefreshTable}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              {isRefreshingTable && refreshingTableKey === activeTable.key
                ? "Updating..."
                : "Update from AWS"}
            </Button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {activeTable.primaryKeys.map((key) => (
            <div key={key} className="space-y-2">
              <Label htmlFor={`lookup-${key}`}>{key}</Label>
              <Input
                id={`lookup-${key}`}
                value={lookupValues[key] ?? ""}
                placeholder={`Enter ${key}`}
                onChange={(event) => onLookupValueChange(key, event.currentTarget.value)}
              />
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            variant="secondary"
            disabled={isLookingUpEntry && refreshingTableKey === activeTable.key}
            onClick={onLoadEntryByKey}
          >
            {isLookingUpEntry && refreshingTableKey === activeTable.key
              ? "Loading..."
              : "Load entry by key"}
          </Button>
          {tableRefreshMessage ? (
            <p className="text-sm text-slate-400">{tableRefreshMessage}</p>
          ) : null}
        </div>
      </CardHeader>

      <CardContent>
        {refreshState.message ? (
          <Alert
            variant={refreshState.status === "failed" ? "destructive" : "default"}
            className="mb-4"
          >
            <AlertTitle>
              {refreshState.status === "failed"
                ? "Backup refresh failed"
                : refreshState.status === "running"
                  ? "Backup refresh in progress"
                  : "Snapshot state"}
            </AlertTitle>
            <AlertDescription>{refreshState.message}</AlertDescription>
          </Alert>
        ) : null}

        <Skeleton className={isPreparingView ? "h-[38rem] w-full" : "hidden"} />
        {!isPreparingView ? (
          <>
            <ScrollArea className="h-[38rem] rounded-xl border border-slate-900">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Entity</TableHead>
                    <TableHead>Captured</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Checksum</TableHead>
                    <TableHead>Region</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageRows.map((row) => {
                    const issueCount = row.issues.filter((issue) => !issue.fixed).length;

                    return (
                      <TableRow
                        key={row.id}
                        className={
                          selectedRowId === row.id
                            ? "bg-slate-900"
                            : issueCount > 0
                              ? "bg-red-950/20"
                              : ""
                        }
                        onClick={() => onSelectRow(row.id)}
                      >
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-medium text-white">{row.entity}</p>
                            <p className="text-xs text-slate-500">{row.id}</p>
                          </div>
                        </TableCell>
                        <TableCell>{formatDate(row.capturedAt)}</TableCell>
                        <TableCell>
                          <Badge variant={backupTone(row.status)}>{row.status}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-slate-400">
                          {row.checksum}
                        </TableCell>
                        <TableCell>{row.region}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>

            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-slate-500">
                {activeWorkerState
                  ? `${activeWorkerState.totalRows} matching rows`
                  : "Rows not ready yet"}
              </p>
              <div className="flex items-center gap-3">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!activeWorkerState || activeWorkerState.page <= 1}
                  onClick={() => onPageChange((activeWorkerState?.page ?? 1) - 1)}
                >
                  Previous
                </Button>
                <span className="text-sm text-slate-400">
                  Page {activeWorkerState?.page ?? 1} / {activeWorkerState?.totalPages ?? 1}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={
                    !activeWorkerState ||
                    (activeWorkerState?.page ?? 1) >= (activeWorkerState?.totalPages ?? 1)
                  }
                  onClick={() => onPageChange((activeWorkerState?.page ?? 1) + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
