"use client";

export type AwsActionTarget =
  | {
      mode: "backup" | "rules";
      tableKey: string;
      rowId: string;
    }
  | {
      mode: "table-refresh";
      tableKey: string;
    }
  | {
      mode: "entry-lookup";
      tableKey: string;
      lookupValues: Record<string, string>;
    };
