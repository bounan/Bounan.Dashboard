import type { BackupIssue } from "../../types";
import {
  addIssue,
  formatZodIssues,
  getRuleOrThrow,
  hasValue,
  isTimestampOrdered,
  videoSchema,
} from "../helpers";
import type { RuleContext, RuleReadyTable } from "../runtime-types";

export function evaluateVideosTable(table: RuleReadyTable, context: RuleContext) {
  const issueMap = new Map<string, BackupIssue[]>();
  const schemaRule = getRuleOrThrow("videos-schema", context.ruleDescriptions);
  const identityRule = getRuleOrThrow("videos-identity-shape", context.ruleDescriptions);
  const publishRule = getRuleOrThrow("videos-status-publish-fields", context.ruleDescriptions);
  const scenesRule = getRuleOrThrow("videos-scenes-shape", context.ruleDescriptions);
  const libraryRule = getRuleOrThrow("videos-library-reference", context.ruleDescriptions);
  const publisherRule = getRuleOrThrow("videos-publisher-reference", context.ruleDescriptions);
  const threadRule = getRuleOrThrow(
    "videos-publisher-thread-consistency",
    context.ruleDescriptions,
  );
  const messageRule = getRuleOrThrow(
    "videos-publisher-message-consistency",
    context.ruleDescriptions,
  );

  for (const candidate of table.rows) {
    const parsed = videoSchema.safeParse(candidate.record);

    if (!parsed.success) {
      addIssue(
        issueMap,
        candidate.row.id,
        schemaRule,
        "entry",
        formatZodIssues("AniMan video schema violation", parsed.error.issues),
      );
      continue;
    }

    const row = parsed.data;

    if (row.primaryKey !== `${row.animeKey}#${row.episode}`) {
      addIssue(
        issueMap,
        candidate.row.id,
        identityRule,
        "cross-entry",
        `primaryKey must equal \`${row.animeKey}#${row.episode}\`.`,
      );
    }

    if (row.animeKey !== `${row.myAnimeListId}#${row.dub}`) {
      addIssue(
        issueMap,
        candidate.row.id,
        identityRule,
        "cross-entry",
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

    if (row.matchingGroup && row.matchingGroup !== `${row.myAnimeListId}#${row.dub}`) {
      addIssue(
        issueMap,
        candidate.row.id,
        identityRule,
        "cross-entry",
        "matchingGroup must use the same `${myAnimeListId}#${dub}` format as animeKey.",
      );
    }

    if (row.matchingStatus !== undefined && row.status === 1) {
      addIssue(
        issueMap,
        candidate.row.id,
        schemaRule,
        "entry",
        "matchingStatus may only appear for published or matched AniMan video rows.",
      );
    }

    if (
      row.status === 4 &&
      (hasValue(row.messageId) || hasValue(row.publishingDetails) || hasValue(row.scenes))
    ) {
      addIssue(
        issueMap,
        candidate.row.id,
        publishRule,
        "entry",
        "status=4 rows must not include messageId, publishingDetails, or scenes.",
      );
    }

    if (row.status === 3 && (!hasValue(row.messageId) || !hasValue(row.publishingDetails))) {
      addIssue(
        issueMap,
        candidate.row.id,
        publishRule,
        "entry",
        "status=3 rows must include messageId and publishingDetails.",
      );
    }

    if (row.scenes) {
      const allowedSceneKeys = new Set(["opening", "ending", "sceneAfterEnding"]);
      const sceneKeys = Object.keys(row.scenes);

      if (sceneKeys.some((key) => !allowedSceneKeys.has(key))) {
        addIssue(
          issueMap,
          candidate.row.id,
          scenesRule,
          "entry",
          "scenes may only contain opening, ending, and sceneAfterEnding.",
        );
      }

      if (
        row.scenes.sceneAfterEnding &&
        (!row.scenes.ending || row.scenes.sceneAfterEnding.start < row.scenes.ending.end)
      ) {
        addIssue(
          issueMap,
          candidate.row.id,
          scenesRule,
          "entry",
          "sceneAfterEnding.start must be greater than or equal to ending.end.",
        );
      }
    }

    if (row.status === 3 && !context.indexes.libraryPairs.has(row.animeKey)) {
      addIssue(
        issueMap,
        candidate.row.id,
        libraryRule,
        "cross-table",
        `AniMan animeKey ${row.animeKey} was not found in Bot Library.`,
        "Bounan-Bot-library",
      );
    }

    if (row.status !== 3) {
      continue;
    }

    const publisherRow = context.indexes.publisherByAnimeKey.get(row.animeKey);

    if (!publisherRow) {
      addIssue(
        issueMap,
        candidate.row.id,
        publisherRule,
        "cross-table",
        `No Publisher row exists for published animeKey ${row.animeKey}.`,
        "Bounan-Publisher-Table",
      );
      continue;
    }

    if (row.publishingDetails && row.publishingDetails.threadId !== publisherRow.parsed.threadId) {
      addIssue(
        issueMap,
        candidate.row.id,
        threadRule,
        "cross-table",
        `publishingDetails.threadId=${row.publishingDetails.threadId} does not match Publisher threadId=${publisherRow.parsed.threadId}.`,
        publisherRow.tableKey,
      );
    }

    const publisherEpisode = context.indexes.publisherEpisodeByAnimeEpisode.get(row.primaryKey);

    if (!publisherEpisode) {
      addIssue(
        issueMap,
        candidate.row.id,
        messageRule,
        "cross-table",
        `No Publisher episode entry exists for ${row.primaryKey}.`,
        publisherRow.tableKey,
      );
      continue;
    }

    if (row.publishingDetails && row.publishingDetails.messageId !== publisherEpisode.messageId) {
      addIssue(
        issueMap,
        candidate.row.id,
        messageRule,
        "cross-table",
        `publishingDetails.messageId=${row.publishingDetails.messageId} does not match Publisher episode messageId=${publisherEpisode.messageId}.`,
        publisherEpisode.tableKey,
      );
    }
  }

  return issueMap;
}
