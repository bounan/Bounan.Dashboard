"use client";

import { useState } from "react";
import { toUserMessage } from "../../../lib/error-presenter";
import { summarizeRuleViolationsForTables } from "../../../lib/rule-runtime";
import {
  createEntryLookupFailureMessage,
  createEntryLookupPasswordUpdateRequiredMessage,
  createEntryLookupProgressMessage,
  createEntryLookupSuccessMessage,
  createPasswordUpdateFailureMessage,
  createPermanentPasswordRequiredMessage,
  createRowRefetchBlockedMessage,
  createRefetchPasswordUpdateRequiredMessage,
  createRowRefetchFailureMessage,
  createRowRefetchSuccessMessage,
  createTableRefreshFailureMessage,
  createTableRefreshPasswordUpdateRequiredMessage,
  createTableRefreshProgressMessage,
  createTableRefreshSuccessMessage,
} from "../../../lib/status-presenter";
import type { BackupConfig, BackupSourceStatus, BackupTableDefinition } from "../../../lib/types";
import type {
  EntryLookupActionResult,
  RowRefetchActionResult,
  TableRefreshActionResult,
} from "./action-results";
import { completeAwsPasswordChallenge } from "./aws-actions/complete-password-challenge";
import { executeEntryLookup } from "./aws-actions/load-entry-by-key";
import { executeTableRefresh } from "./aws-actions/refresh-table";
import { executeRowRefetch } from "./aws-actions/refetch-row";
import { resumeAwsActionAfterPasswordChallenge } from "./aws-actions/resume-after-password";
import { persistAwsTables } from "./aws-actions/shared";
import type { AwsActionTarget } from "./aws-actions/types";
import { useDashboardNotifier } from "./use-dashboard-notifier";

type PendingPasswordChallenge = {
  session: string;
  target: AwsActionTarget;
} | null;

export function useAwsRefetch(input: {
  config: BackupConfig;
  setConfig: (value: BackupConfig) => void;
  source: BackupSourceStatus | null;
  tables: BackupTableDefinition[];
  rules: Parameters<typeof summarizeRuleViolationsForTables>[1];
  onApplyTables: (tables: BackupTableDefinition[]) => void;
  onSetTables: (updater: (current: BackupTableDefinition[]) => BackupTableDefinition[]) => void;
}) {
  const [isRefetchingRow, setIsRefetchingRow] = useState(false);
  const [isRefreshingTable, setIsRefreshingTable] = useState(false);
  const [isLookingUpEntry, setIsLookingUpEntry] = useState(false);
  const [refreshingTableKey, setRefreshingTableKey] = useState<string | null>(null);
  const [tableRefreshMessage, setTableRefreshMessage] = useState<string | null>(null);
  const [updatingRuleViolationKeys, setUpdatingRuleViolationKeys] = useState<Set<string>>(
    new Set(),
  );
  const [pendingPasswordChallenge, setPendingPasswordChallenge] =
    useState<PendingPasswordChallenge>(null);
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordError, setNewPasswordError] = useState<string | null>(null);
  const [isCompletingPasswordChallenge, setIsCompletingPasswordChallenge] = useState(false);
  const notifier = useDashboardNotifier();

  async function persistTables(nextTables: BackupTableDefinition[]) {
    await persistAwsTables({
      config: input.config,
      source: input.source,
      rules: input.rules,
      tables: nextTables,
    });
  }

  async function refetchRowWithTarget(
    target: { tableKey: string; rowId: string },
    mode: "backup" | "rules",
  ): Promise<RowRefetchActionResult> {
    if (mode === "backup") {
      setIsRefetchingRow(true);
    } else {
      setUpdatingRuleViolationKeys((current) => {
        const next = new Set(current);
        next.add(`${target.tableKey}::${target.rowId}`);
        return next;
      });
    }

    try {
      return await executeRowRefetch({
        config: input.config,
        tables: input.tables,
        tableKey: target.tableKey,
        rowId: target.rowId,
        mode,
        onApplyTables: input.onApplyTables,
        onSetTables: input.onSetTables,
        onPasswordChallenge: (session) => {
          setPendingPasswordChallenge({
            session,
            target: {
              tableKey: target.tableKey,
              rowId: target.rowId,
              mode,
            },
          });
          setNewPassword("");
          setNewPasswordError(null);
          notifier.passwordUpdateRequired(createRefetchPasswordUpdateRequiredMessage());
        },
        onSuccess: (nextTables) => {
          void persistTables(nextTables);
          notifier.liveRowLoaded(createRowRefetchSuccessMessage(mode));
        },
        onFailure: (details) => {
          notifier.refetchFailed(createRowRefetchFailureMessage(details));
        },
        onBlocked: (reason) => {
          notifier.refetchBlocked(createRowRefetchBlockedMessage(reason));
        },
      });
    } finally {
      if (mode === "backup") {
        setIsRefetchingRow(false);
      } else {
        setUpdatingRuleViolationKeys((current) => {
          const next = new Set(current);
          next.delete(`${target.tableKey}::${target.rowId}`);
          return next;
        });
      }
    }
  }

  async function refreshTable(tableKey: string): Promise<TableRefreshActionResult> {
    setIsRefreshingTable(true);
    setRefreshingTableKey(tableKey);

    try {
      return await executeTableRefresh({
        config: input.config,
        tables: input.tables,
        tableKey,
        onProgress: (progress) => {
          setTableRefreshMessage(createTableRefreshProgressMessage(progress));
        },
        onApplyTables: input.onApplyTables,
        onPasswordChallenge: (session) => {
          setPendingPasswordChallenge({
            session,
            target: {
              tableKey,
              mode: "table-refresh",
            },
          });
          setNewPassword("");
          setNewPasswordError(null);
          notifier.passwordUpdateRequired(createTableRefreshPasswordUpdateRequiredMessage());
        },
        onSuccess: async ({ loadedCount, pageCount }, nextTables) => {
          await persistTables(nextTables);
          const message = createTableRefreshSuccessMessage(loadedCount, pageCount);
          setTableRefreshMessage(message);
          notifier.tableRefreshed(message);
        },
        onFailure: (details) => {
          const message = createTableRefreshFailureMessage("aws-failure", details);
          setTableRefreshMessage(message);
          notifier.tableRefreshFailed(message);
        },
      });
    } finally {
      setIsRefreshingTable(false);
      setRefreshingTableKey(null);
    }
  }

  async function loadEntryByKey(
    tableKey: string,
    lookupValues: Record<string, string>,
  ): Promise<EntryLookupActionResult> {
    setIsLookingUpEntry(true);
    setRefreshingTableKey(tableKey);

    try {
      return await executeEntryLookup({
        config: input.config,
        tables: input.tables,
        tableKey,
        lookupValues,
        onProgress: () => {
          setTableRefreshMessage(createEntryLookupProgressMessage());
        },
        onApplyTables: input.onApplyTables,
        onPasswordChallenge: (session) => {
          setPendingPasswordChallenge({
            session,
            target: {
              tableKey,
              lookupValues,
              mode: "entry-lookup",
            },
          });
          setNewPassword("");
          setNewPasswordError(null);
          notifier.passwordUpdateRequired(createEntryLookupPasswordUpdateRequiredMessage());
        },
        onSuccess: async (nextTables) => {
          await persistTables(nextTables);
          const message = createEntryLookupSuccessMessage();
          setTableRefreshMessage(message);
          notifier.entryLoaded(message);
        },
        onFailure: (details) => {
          const message = createEntryLookupFailureMessage("aws-failure", details);
          setTableRefreshMessage(message);
          notifier.entryLookupFailed(message);
        },
      });
    } finally {
      setIsLookingUpEntry(false);
      setRefreshingTableKey(null);
    }
  }

  async function completePasswordChallenge() {
    if (!pendingPasswordChallenge) {
      return false;
    }

    const trimmedPassword = newPassword.trim();

    if (!trimmedPassword) {
      setNewPasswordError(createPermanentPasswordRequiredMessage());
      return false;
    }

    setIsCompletingPasswordChallenge(true);
    setNewPasswordError(null);

    try {
      const nextConfig = await completeAwsPasswordChallenge({
        config: input.config,
        session: pendingPasswordChallenge.session,
        newPassword: trimmedPassword,
      });

      input.setConfig(nextConfig);
      const target = pendingPasswordChallenge.target;
      setPendingPasswordChallenge(null);
      setNewPassword("");
      notifier.passwordUpdated();
      await resumeAwsActionAfterPasswordChallenge({
        target,
        onRefreshTable: refreshTable,
        onLoadEntryByKey: loadEntryByKey,
        onRefetchRow: refetchRowWithTarget,
      });
      return true;
    } catch (error) {
      setNewPasswordError(
        toUserMessage(error, {
          code: "aws-auth",
          message: createPasswordUpdateFailureMessage(),
        }),
      );
      return false;
    } finally {
      setIsCompletingPasswordChallenge(false);
    }
  }

  return {
    isRefetchingRow,
    isRefreshingTable,
    isLookingUpEntry,
    refreshingTableKey,
    tableRefreshMessage,
    updatingRuleViolationKeys,
    pendingPasswordChallenge,
    newPassword,
    newPasswordError,
    isCompletingPasswordChallenge,
    setNewPassword,
    clearPasswordChallenge() {
      if (isCompletingPasswordChallenge) {
        return;
      }

      setPendingPasswordChallenge(null);
      setNewPassword("");
      setNewPasswordError(null);
    },
    completePasswordChallenge,
    refetchSelectedRow(tableKey: string, rowId: string) {
      return refetchRowWithTarget({ tableKey, rowId }, "backup");
    },
    refetchRuleViolation(tableKey: string, rowId: string) {
      return refetchRowWithTarget({ tableKey, rowId }, "rules");
    },
    refreshTable,
    loadEntryByKey,
  };
}
