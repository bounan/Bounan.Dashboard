"use client";

import { useEffect } from "react";
import type { BackupTableDefinition, DashboardView } from "../../../lib/types";

export function useAnalyzerRouteSync(input: {
  view: DashboardView;
  tableKey: string | null;
  tables: BackupTableDefinition[];
  pathname: string;
  searchParamsString: string;
  replace: (url: string) => void;
}) {
  const { pathname, replace, searchParamsString, tableKey, tables, view } = input;

  useEffect(() => {
    if (view !== "backup-analyzer" || tables.length === 0) {
      return;
    }

    if (!tableKey || !tables.some((table) => table.key === tableKey)) {
      const next = new URLSearchParams(searchParamsString);
      next.set("table", tables[0]!.key);
      replace(`${pathname}?${next.toString()}`);
    }
  }, [pathname, replace, searchParamsString, tableKey, tables, view]);
}
