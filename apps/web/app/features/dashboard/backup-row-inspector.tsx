import type { BackupRow } from "../../lib/types";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { ScrollArea } from "../ui/scroll-area";
import { backupTone } from "./backup-shared";

export function BackupRowInspector({
  selectedRow,
  isRefetchingRow,
  onRefetchRow,
}: {
  selectedRow: BackupRow | null;
  isRefetchingRow: boolean;
  onRefetchRow: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Row inspector</CardTitle>
        <CardDescription>
          The old screen mixed severity and payload state. This panel separates validation issues
          from payload details.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!selectedRow ? (
          <Alert>
            <AlertTitle>No row selected</AlertTitle>
            <AlertDescription>
              Select a row from the table to inspect validation issues and payload details.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <h3 className="font-semibold text-white">{selectedRow.entity}</h3>
                  <p className="text-sm text-slate-500">{selectedRow.id}</p>
                  <p className="text-sm text-slate-500">
                    Identity: {selectedRow.stableIdentity ?? "not schema-backed yet"} ·{" "}
                    {selectedRow.identityState}
                  </p>
                </div>
                <Badge variant={backupTone(selectedRow.status)}>{selectedRow.status}</Badge>
              </div>
              <Button
                variant="secondary"
                disabled={selectedRow.identityState !== "schema-backed" || isRefetchingRow}
                onClick={onRefetchRow}
              >
                {isRefetchingRow ? "Refetching..." : "Refetch from DynamoDB"}
              </Button>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                Validation issues
              </h4>
              {selectedRow.issues.length === 0 ? (
                <Alert variant="success">
                  <AlertTitle>No issues</AlertTitle>
                  <AlertDescription>
                    No validation issues were detected for this row.
                  </AlertDescription>
                </Alert>
              ) : (
                selectedRow.issues.map((issue) => (
                  <Alert
                    key={`${issue.ruleId}-${issue.code}-${issue.rowId ?? selectedRow.id}`}
                    variant={
                      issue.fixed
                        ? "success"
                        : issue.severity === "critical"
                          ? "destructive"
                          : "warning"
                    }
                  >
                    <AlertTitle>
                      {issue.code} · {issue.scope}
                    </AlertTitle>
                    <AlertDescription>{issue.message}</AlertDescription>
                  </Alert>
                ))
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                  {selectedRow.currentRecord.status === "live"
                    ? "Live DynamoDB payload"
                    : selectedRow.currentRecord.status === "error"
                      ? "Lookup error details"
                      : "Backup payload preview"}
                </h4>
                <Badge variant="secondary">{selectedRow.currentRecord.status}</Badge>
              </div>
              <p className="text-sm text-slate-400">{selectedRow.currentRecord.summary}</p>
              <ScrollArea className="h-72 rounded-xl border border-slate-900">
                <div className="space-y-2 p-4">
                  {selectedRow.currentRecord.fields.map((field) => (
                    <div
                      key={field.key}
                      className="flex items-start justify-between gap-4 border-b border-slate-900 pb-2 text-sm"
                    >
                      <span className="text-slate-500">{field.key}</span>
                      <span className="max-w-[14rem] break-all text-right font-mono text-slate-200">
                        {field.value}
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
