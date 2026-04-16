import type { BackupIssue } from "../../types";
import { addIssue, formatZodIssues, getRuleOrThrow, publisherSchema } from "../helpers";
import type { RuleContext, RuleReadyTable } from "../runtime-types";

export function evaluatePublisherTable(table: RuleReadyTable, context: RuleContext) {
  const issueMap = new Map<string, BackupIssue[]>();
  const schemaRule = getRuleOrThrow("publisher-schema", context.ruleDescriptions);
  const animeRule = getRuleOrThrow(
    "publisher-video-published-anime-reference",
    context.ruleDescriptions,
  );
  const episodeRule = getRuleOrThrow(
    "publisher-video-published-episode-reference",
    context.ruleDescriptions,
  );

  for (const candidate of table.rows) {
    const parsed = publisherSchema.safeParse(candidate.record);

    if (!parsed.success) {
      addIssue(
        issueMap,
        candidate.row.id,
        schemaRule,
        "entry",
        formatZodIssues("Publisher schema violation", parsed.error.issues),
      );
      continue;
    }

    const row = parsed.data;

    if (row.AnimeKey !== `${row.myAnimeListId}#${row.dub}`) {
      addIssue(
        issueMap,
        candidate.row.id,
        schemaRule,
        "entry",
        `AnimeKey must equal \`${row.myAnimeListId}#${row.dub}\`.`,
      );
    }

    const messageIds = new Set<number>([row.headerPost.messageId]);

    for (const [episodeKey, episode] of Object.entries(row.episodes)) {
      if (String(episode.episode) !== episodeKey) {
        addIssue(
          issueMap,
          candidate.row.id,
          schemaRule,
          "entry",
          `Publisher episode map key ${episodeKey} must equal nested episode value ${episode.episode}.`,
        );
      }

      if (messageIds.has(episode.messageId)) {
        addIssue(
          issueMap,
          candidate.row.id,
          schemaRule,
          "entry",
          `Message id ${episode.messageId} is duplicated inside one Publisher row.`,
        );
      }

      messageIds.add(episode.messageId);
    }

    if ((context.indexes.publishedVideosByAnimeKey.get(row.AnimeKey)?.length ?? 0) === 0) {
      addIssue(
        issueMap,
        candidate.row.id,
        animeRule,
        "cross-table",
        `No published AniMan video rows were found for Publisher AnimeKey ${row.AnimeKey}.`,
        "Bounan-AniMan-videos",
      );
    }

    for (const episode of Object.values(row.episodes)) {
      if (
        !context.indexes.publishedVideosByAnimeEpisode.has(`${row.AnimeKey}#${episode.episode}`)
      ) {
        addIssue(
          issueMap,
          candidate.row.id,
          episodeRule,
          "cross-table",
          `Publisher episode ${episode.episode} is missing a published AniMan video row for ${row.AnimeKey}.`,
          "Bounan-AniMan-videos",
        );
      }
    }
  }

  return issueMap;
}
