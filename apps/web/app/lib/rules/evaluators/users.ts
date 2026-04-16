import type { BackupIssue } from "../../types";
import {
  addIssue,
  formatZodIssues,
  getRuleOrThrow,
  isTimestampOrdered,
  usersSchema,
} from "../helpers";
import type { RuleContext, RuleReadyTable } from "../runtime-types";

export function evaluateUsersTable(table: RuleReadyTable, context: RuleContext) {
  const issueMap = new Map<string, BackupIssue[]>();
  const schemaRule = getRuleOrThrow("users-schema", context.ruleDescriptions);
  const uniquenessRule = getRuleOrThrow("users-id-uniqueness", context.ruleDescriptions);
  const userIdCounts = new Map<number, number>();

  for (const item of context.indexes.users) {
    userIdCounts.set(item.parsed.userId, (userIdCounts.get(item.parsed.userId) ?? 0) + 1);
  }

  for (const candidate of table.rows) {
    const parsed = usersSchema.safeParse(candidate.record);

    if (!parsed.success) {
      addIssue(
        issueMap,
        candidate.row.id,
        schemaRule,
        "entry",
        formatZodIssues("Bot User schema violation", parsed.error.issues),
      );
      continue;
    }

    const row = parsed.data;

    if (!isTimestampOrdered(row.createdAt, row.updatedAt)) {
      addIssue(
        issueMap,
        candidate.row.id,
        schemaRule,
        "entry",
        "updatedAt must be greater than or equal to createdAt.",
      );
    }

    if ((userIdCounts.get(row.userId) ?? 0) > 1) {
      addIssue(
        issueMap,
        candidate.row.id,
        uniquenessRule,
        "cross-entry",
        `userId ${row.userId} appears more than once in Bot Users.`,
      );
    }
  }

  return issueMap;
}
