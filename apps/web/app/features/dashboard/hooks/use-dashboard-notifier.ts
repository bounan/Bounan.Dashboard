"use client";

import { toast } from "sonner";

type NotificationTone = "error" | "success" | "warning" | "info";

function notify(title: string, message: string, tone: NotificationTone) {
  const fn =
    tone === "error"
      ? toast.error
      : tone === "success"
        ? toast.success
        : tone === "warning"
          ? toast.warning
          : toast;

  fn(title, {
    description: message,
  });
}

export function useDashboardNotifier() {
  return {
    validationFailed(message: string) {
      notify("Validation failed", message, "error");
    },
    accessValidated(message: string) {
      notify("Access validated", message, "success");
    },
    configImported() {
      notify(
        "Config imported",
        "Fields were populated from JSON. No validation or backup fetch was executed.",
        "info",
      );
    },
    configImportFailed() {
      notify("Import failed", "The selected file is not valid JSON.", "error");
    },
    configSaved() {
      notify("Config saved", "All fields were written to local browser storage.", "success");
    },
    configSaveFailed(message: string) {
      notify("Config save failed", message, "error");
    },
    passwordUpdateRequired(message: string) {
      notify("Password update required", message, "warning");
    },
    passwordUpdated() {
      notify("Password updated", "The Cognito password was changed successfully.", "success");
    },
    loadBlocked(message: string) {
      notify("Load blocked", message, "error");
    },
    validationRequired(message: string) {
      notify("Validation required", message, "warning");
    },
    cacheWarning(message: string) {
      notify("Cache warning", message, "warning");
    },
    backupLoaded() {
      notify("Backup loaded", "Backup snapshot and table data are ready.", "success");
    },
    backupLoadFailed(message: string) {
      notify("Backup load failed", message, "error");
    },
    refetchBlocked(message: string) {
      notify("Refetch blocked", message, "warning");
    },
    liveRowLoaded(message: string) {
      notify("Live row loaded", message, "success");
    },
    refetchFailed(message: string) {
      notify("Refetch failed", message, "error");
    },
    tableRefreshed(message: string) {
      notify("Table refreshed", message, "success");
    },
    tableRefreshFailed(message: string) {
      notify("Table refresh failed", message, "error");
    },
    entryLoaded(message: string) {
      notify("Entry loaded", message, "success");
    },
    entryLookupFailed(message: string) {
      notify("Entry lookup failed", message, "error");
    },
  };
}
