# Validations

This file describes the validation rules that are currently implemented in the dashboard validation stack.

The validations are grouped into:

- `entry`: row-local field and shape checks
- `cross-entry`: uniqueness and derived-key consistency checks within one table
- `cross-table`: reference and consistency checks across tables

## AniMan Videos

Implemented rules:

### Entry

- Required fields: `primaryKey`, `animeKey`, `myAnimeListId`, `dub`, `episode`, `status`, `createdAt`, `updatedAt`
- `myAnimeListId` must be a positive integer.
- `dub` must be a non-empty string.
- `episode` must be a non-negative integer.
  `0` is allowed.
- `status` must be one of `1`, `3`, or `4`.
- `createdAt` and `updatedAt` must be valid timestamps.
- `updatedAt` must be greater than or equal to `createdAt`.
- `messageId`, when present, must be a positive integer.
- `publishingDetails`, when present, must contain exactly:
  - `threadId`: positive integer
  - `messageId`: positive integer
- `matchingStatus`, when present, must be one of `3`, `4`, or `5`.
- `matchingGroup`, when present, must use the same `${myAnimeListId}#${dub}` format as `animeKey`.
- `matchingStatus` may only appear when the row is not in status `1`.
- `scenes`, when present, may only contain:
  - `opening`
  - `ending`
  - `sceneAfterEnding`
- Each scene segment must contain numeric `start` and `end`.
- Each scene segment must satisfy:
  - `start >= 0`
  - `end >= 0`
  - `start < end`
- If `sceneAfterEnding` exists, `ending` must also exist and `sceneAfterEnding.start >= ending.end`.

### Cross-entry

- `animeKey` must equal `${myAnimeListId}#${dub}`.
- `primaryKey` must equal `${animeKey}#${episode}`.

### Cross-table

- Every AniMan Videos row with `status = 3` must have its `animeKey` present in Bot Library.
- Every video row with `status = 3` must have a matching Publisher row for the same `animeKey`.
- For `status = 3`, `publishingDetails.threadId` should match the Publisher `threadId`.
- For `status = 3`, `publishingDetails.messageId` should match the Publisher episode `messageId` for the same `animeKey` and `episode`.

### Status-specific rules

- If `status = 4`, `messageId`, `publishingDetails`, and `scenes` must be absent.
- If `status = 3`, `messageId` and `publishingDetails` must be present.

## Bot Library

Implemented rules:

### Entry

- Required fields: `myAnimeListId`, `dubs`, `createdAt`, `updatedAt`
- `myAnimeListId` must be a positive integer.
- `dubs` must be a non-empty array of non-empty strings.
- `createdAt` and `updatedAt` must be valid timestamps.
- `updatedAt` must be greater than or equal to `createdAt`.

### Cross-entry

- `myAnimeListId` must be unique across the table.
- Each derived anime key `${myAnimeListId}#${dub}` must be unique across the table.

### Cross-table

- Every derived anime key `${myAnimeListId}#${dub}` must have at least one AniMan Videos row with `status = 3`.
- Published AniMan video anime keys missing from Bot Library are reported as consistency drift.
- In practice, Bot Library should contain all and only animeKey pairs that have at least one `status = 3` AniMan Videos row.

## Bot Subscriptions

Implemented rules:

### Entry

- Required fields: `animeKey`, `createdAt`, `updatedAt`, `oneTimeSubscribers`
- `animeKey` must follow `${myAnimeListId}#${dub}`.
- `createdAt` and `updatedAt` must be valid timestamps.
- `updatedAt` must be greater than or equal to `createdAt`.
- `oneTimeSubscribers` must be a map/object.

### Cross-entry

- There must be at most one subscription row per `animeKey`.

### Cross-table

- Every subscription `animeKey` must exist in Bot Library.
- Every subscription `animeKey` must exist in AniMan Videos.

## Bot Users

Implemented rules:

### Entry

- Required fields: `userId`, `status`, `directRank`, `indirectRank`, `requestedEpisodes`, `createdAt`, `updatedAt`
- `userId` must be a positive integer.
- `status` must currently be `0`.
- `directRank` and `indirectRank` must be integers greater than or equal to `0`.
- `requestedEpisodes` must be a list.
- `createdAt` and `updatedAt` must be valid timestamps.
- `updatedAt` must be greater than or equal to `createdAt`.

### Cross-entry

- `userId` must be unique across the table.

## Ongoing

Implemented rules:

### Entry

- Required fields: `animeKey`, `myAnimeListId`, `dub`, `episodes`, `createdAt`, `updatedAt`
- `animeKey` must follow `${myAnimeListId}#${dub}`.
- `animeKey` must equal `${myAnimeListId}#${dub}`.
- `myAnimeListId` must be a positive integer.
- `dub` must be a non-empty string.
- `episodes` must be a non-empty list of integers.
- `createdAt` and `updatedAt` must be valid timestamps.
- `updatedAt` must be greater than or equal to `createdAt`.
- Episode values may be:
  - `-1` as a sentinel
  - `0` or positive integers as tracked episodes
- Episode values less than `-1` are invalid.
- A row must contain at least one tracked episode (`>= 0`) or the `-1` sentinel.

### Cross-table

- Every tracked episode (`>= 0`) must have a matching AniMan Videos row with primary key `${animeKey}#${episode}`.

## Publisher

Implemented rules:

### Entry

- Required fields: `AnimeKey`, `myAnimeListId`, `dub`, `threadId`, `headerPost`, `episodes`, `updatedAt`
- `AnimeKey` must follow `${myAnimeListId}#${dub}`.
- `AnimeKey` must equal `${myAnimeListId}#${dub}`.
- `myAnimeListId` must be a positive integer.
- `dub` must be a non-empty string.
- `threadId` must be a positive integer.
- `headerPost` must contain:
  - `messageId`: positive integer
  - `hash`: number
- `episodes` must be a non-empty map keyed by episode number as a string.
- Each episode entry must contain:
  - `episode`: integer `>= 0`
  - `messageId`: positive integer
  - `hash`: number
- Each episode map key must equal the nested `episode` value.
- Message ids inside one publisher row must be unique across:
  - `headerPost.messageId`
  - every `episodes[*].messageId`
- `updatedAt` must be a valid timestamp.

### Cross-table

- Every Publisher row must correspond to at least one published AniMan Videos row for the same `AnimeKey`.
- Every Publisher episode should have a published AniMan Videos row for the same `AnimeKey` and episode.

## Notes

Not every earlier suggested rule is implemented yet.

Not implemented in the current stack:

- validation of `requestedEpisodes` item format against a documented schema
- conditional Ongoing exception logic based on `-1` plus absence of any AniMan rows beyond the currently implemented episode coverage rule
- additional Publisher-to-library checks beyond the published-video consistency rules above

This file should be kept aligned with the actual code in:

- [catalog.ts](apps/web/app/lib/rules/catalog.ts)
- [helpers.ts](apps/web/app/lib/rules/helpers.ts)
- [evaluators.ts](apps/web/app/lib/rules/evaluators.ts)
