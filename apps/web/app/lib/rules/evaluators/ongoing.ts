import type { BackupIssue } from "../../types";
import {
  addIssue,
  formatZodIssues,
  getRuleOrThrow,
  isTimestampOrdered,
  ongoingSchema,
} from "../helpers";
import type { RuleContext, RuleReadyTable } from "../runtime-types";

export function evaluateOngoingTable(table: RuleReadyTable, context: RuleContext) {
  const issueMap = new Map<string, BackupIssue[]>();
  const schemaRule = getRuleOrThrow("ongoing-schema", context.ruleDescriptions);
  const coverageRule = getRuleOrThrow("ongoing-video-episode-coverage", context.ruleDescriptions);

  for (const candidate of table.rows) {
    const parsed = ongoingSchema.safeParse(candidate.record);

    if (!parsed.success) {
      addIssue(
        issueMap,
        candidate.row.id,
        schemaRule,
        "entry",
        formatZodIssues("Ongoing schema violation", parsed.error.issues),
      );
      continue;
    }

    const row = parsed.data;

    if (row.animeKey !== `${row.myAnimeListId}#${row.dub}`) {
      addIssue(
        issueMap,
        candidate.row.id,
        schemaRule,
        "entry",
        `animeKey must equal \`${row.myAnimeListId}#${row.dub}\`.`,
      );
    }

    if (!isTimestampOrdered(row.createdAt, row.updatedAt)) {
      addIssue(
        issueMap,
        candidate.row.id,
        schemaRule,
        "entry",
        "updatedAt must be greater than or equal to createdAt.",
      );
    }

    const trackedEpisodes = row.episodes.filter((episode) => episode >= 0);
    const hasSentinel = row.episodes.includes(-1);

    if (row.episodes.some((episode) => episode < -1)) {
      addIssue(
        issueMap,
        candidate.row.id,
        schemaRule,
        "entry",
        "episodes may only contain positive integers or the -1 sentinel.",
      );
    }

    if (trackedEpisodes.length === 0 && !hasSentinel) {
      addIssue(
        issueMap,
        candidate.row.id,
        schemaRule,
        "entry",
        "Ongoing rows must contain at least one positive episode or the -1 sentinel.",
      );
    }

    for (const episode of trackedEpisodes) {
      const primaryKey = `${row.animeKey}#${episode}`;

      if (!context.indexes.videosByPrimaryKey.has(primaryKey)) {
        addIssue(
          issueMap,
          candidate.row.id,
          coverageRule,
          "cross-table",
          `Positive ongoing episode ${episode} is missing AniMan video row ${primaryKey}.`,
          "Bounan-AniMan-videos",
        );
      }
    }
  }

  return issueMap;
}
