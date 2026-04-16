"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { DashboardView } from "../../../lib/types";

export function useDashboardNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const view = (searchParams.get("view") as DashboardView | null) ?? "config";
  const tableKey = searchParams.get("table");

  function navigate(nextView: DashboardView, nextTable?: string | null) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("view", nextView);

    if (nextView !== "backup-analyzer") {
      next.delete("table");
    } else if (nextTable) {
      next.set("table", nextTable);
    }

    router.push(`${pathname}?${next.toString()}`);
  }

  return {
    view,
    tableKey,
    pathname,
    searchParams,
    replace: router.replace,
    navigate,
  };
}
