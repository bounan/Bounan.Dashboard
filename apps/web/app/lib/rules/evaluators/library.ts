import type { BackupIssue } from "../../types";
import {
  addIssue,
  formatZodIssues,
  getRuleOrThrow,
  isTimestampOrdered,
  librarySchema,
} from "../helpers";
import type { RuleContext, RuleReadyTable } from "../runtime-types";

export function evaluateLibraryTable(table: RuleReadyTable, context: RuleContext) {
  const issueMap = new Map<string, BackupIssue[]>();
  const schemaRule = getRuleOrThrow("library-schema", context.ruleDescriptions);
  const uniquenessRule = getRuleOrThrow("library-mal-uniqueness", context.ruleDescriptions);
  const coverageRule = getRuleOrThrow("library-video-pair-coverage", context.ruleDescriptions);
  const consistencyRule = getRuleOrThrow(
    "library-video-pair-consistency",
    context.ruleDescriptions,
  );
  const malIdCounts = new Map<number, number>();
  const animeKeyCounts = new Map<string, number>();
  const publishedVideoAnimeKeys = new Set(
    context.indexes.videos
      .filter((item) => item.parsed.status === 3)
      .map((item) => item.parsed.animeKey),
  );

  for (const item of context.indexes.library) {
    malIdCounts.set(
      item.parsed.myAnimeListId,
      (malIdCounts.get(item.parsed.myAnimeListId) ?? 0) + 1,
    );

    for (const dub of item.parsed.dubs) {
      const animeKey = `${item.parsed.myAnimeListId}#${dub}`;
      animeKeyCounts.set(animeKey, (animeKeyCounts.get(animeKey) ?? 0) + 1);
    }
  }

  for (const candidate of table.rows) {
    const parsed = librarySchema.safeParse(candidate.record);

    if (!parsed.success) {
      addIssue(
        issueMap,
        candidate.row.id,
        schemaRule,
        "entry",
        formatZodIssues("Bot Library schema violation", parsed.error.issues),
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

    if ((malIdCounts.get(row.myAnimeListId) ?? 0) > 1) {
      addIssue(
        issueMap,
        candidate.row.id,
        uniquenessRule,
        "cross-entry",
        `myAnimeListId ${row.myAnimeListId} appears more than once in Bot Library.`,
      );
    }

    for (const dub of row.dubs) {
      const animeKey = `${row.myAnimeListId}#${dub}`;

      if ((animeKeyCounts.get(animeKey) ?? 0) > 1) {
        addIssue(
          issueMap,
          candidate.row.id,
          uniquenessRule,
          "cross-entry",
          `Derived animeKey ${animeKey} appears more than once in Bot Library.`,
        );
      }

      if (!publishedVideoAnimeKeys.has(animeKey)) {
        addIssue(
          issueMap,
          candidate.row.id,
          coverageRule,
          "cross-table",
          `Derived animeKey ${animeKey} does not have any published AniMan video rows.`,
          "Bounan-AniMan-videos",
        );
      }
    }
  }

  for (const video of context.indexes.videos) {
    if (video.parsed.status !== 3) {
      continue;
    }

    if (!context.indexes.libraryPairs.has(video.parsed.animeKey)) {
      addIssue(
        issueMap,
        table.rows[0]?.row.id ?? video.rowId,
        consistencyRule,
        "cross-table",
        `Published AniMan animeKey ${video.parsed.animeKey} exists without a matching Bot Library row.`,
        "Bounan-AniMan-videos",
      );
    }
  }

  return issueMap;
}
