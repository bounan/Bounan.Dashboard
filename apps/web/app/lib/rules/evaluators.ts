import type { BackupIssue } from "../types";
import type { RuleContext, RuleReadyTable } from "./runtime-types";
import { evaluateLibraryTable } from "./evaluators/library";
import { evaluateOngoingTable } from "./evaluators/ongoing";
import { evaluatePublisherTable } from "./evaluators/publisher";
import { evaluateSubscriptionsTable } from "./evaluators/subscriptions";
import { evaluateUsersTable } from "./evaluators/users";
import { evaluateVideosTable } from "./evaluators/videos";

export function evaluateTable(table: RuleReadyTable, context: RuleContext) {
  if (/Bounan-AniMan-videos/i.test(table.key)) {
    return evaluateVideosTable(table, context);
  }

  if (/Bounan-Bot-library/i.test(table.key)) {
    return evaluateLibraryTable(table, context);
  }

  if (/Bounan-Bot-subscriptions/i.test(table.key)) {
    return evaluateSubscriptionsTable(table, context);
  }

  if (/Bounan-Bot-users/i.test(table.key)) {
    return evaluateUsersTable(table, context);
  }

  if (/Bounan-Ongoing-main/i.test(table.key)) {
    return evaluateOngoingTable(table, context);
  }

  if (/Bounan-Publisher-Table/i.test(table.key)) {
    return evaluatePublisherTable(table, context);
  }

  return new Map<string, BackupIssue[]>();
}
