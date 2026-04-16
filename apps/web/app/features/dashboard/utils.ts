"use client";

import type { AnalyzerFilters, BackupRow } from "../../lib/types";
import { getTableHealth } from "../../lib/analyzer";

export const defaultFilters: AnalyzerFilters = {
  query: "",
  issuesOnly: true,
  status: "all",
  sortBy: "capturedAt",
  sortDirection: "desc",
};

export const pageSize = 150;

export function formatDate(value: string | null) {
  if (!value) {
    return "n/a";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function toneForStatus(status: BackupRow["status"] | "neutral") {
  if (status === "critical") {
    return "red";
  }

  if (status === "warning") {
    return "yellow";
  }

  if (status === "healthy") {
    return "green";
  }

  return "gray";
}

export function toneForHealth(status: ReturnType<typeof getTableHealth>) {
  if (status === "critical") {
    return "red";
  }

  if (status === "warning") {
    return "yellow";
  }

  return "green";
}
