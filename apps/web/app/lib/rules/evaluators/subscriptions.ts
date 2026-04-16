import type { BackupIssue } from "../../types";
import {
  addIssue,
  formatZodIssues,
  getRuleOrThrow,
  isTimestampOrdered,
  subscriptionsSchema,
} from "../helpers";
import type { RuleContext, RuleReadyTable } from "../runtime-types";

export function evaluateSubscriptionsTable(table: RuleReadyTable, context: RuleContext) {
  const issueMap = new Map<string, BackupIssue[]>();
  const schemaRule = getRuleOrThrow("subscriptions-schema", context.ruleDescriptions);
  const uniquenessRule = getRuleOrThrow(
    "subscriptions-anime-key-uniqueness",
    context.ruleDescriptions,
  );
  const libraryRule = getRuleOrThrow("subscriptions-library-reference", context.ruleDescriptions);
  const videoRule = getRuleOrThrow("subscriptions-video-reference", context.ruleDescriptions);
  const animeKeyCounts = new Map<string, number>();
  const videoAnimeKeys = new Set(context.indexes.videos.map((item) => item.parsed.animeKey));

  for (const item of context.indexes.subscriptions) {
    animeKeyCounts.set(item.parsed.animeKey, (animeKeyCounts.get(item.parsed.animeKey) ?? 0) + 1);
  }

  for (const candidate of table.rows) {
    const parsed = subscriptionsSchema.safeParse(candidate.record);

    if (!parsed.success) {
      addIssue(
        issueMap,
        candidate.row.id,
        schemaRule,
        "entry",
        formatZodIssues("Bot Subscription schema violation", parsed.error.issues),
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

    if ((animeKeyCounts.get(row.animeKey) ?? 0) > 1) {
      addIssue(
        issueMap,
        candidate.row.id,
        uniquenessRule,
        "cross-entry",
        `animeKey ${row.animeKey} appears more than once in Bot Subscriptions.`,
      );
    }

    if (!context.indexes.libraryPairs.has(row.animeKey)) {
      addIssue(
        issueMap,
        candidate.row.id,
        libraryRule,
        "cross-table",
        `Subscription animeKey ${row.animeKey} was not found in Bot Library.`,
        "Bounan-Bot-library",
      );
    }

    if (!videoAnimeKeys.has(row.animeKey)) {
      addIssue(
        issueMap,
        candidate.row.id,
        videoRule,
        "cross-table",
        `Subscription animeKey ${row.animeKey} was not found in AniMan Videos.`,
        "Bounan-AniMan-videos",
      );
    }
  }

  return issueMap;
}
