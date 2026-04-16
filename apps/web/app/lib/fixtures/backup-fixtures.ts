export const representativeBackupFixtureRepo = {
  owner: "fixture-owner",
  name: "fixture-backup",
  fullName: "fixture-owner/fixture-backup",
  branch: "main",
  commitSha: "abc1234def567890abc1234def567890abc12345",
  updatedAt: "2026-04-17T09:15:00.000Z",
} as const;

export const representativeBackupFixtureTables = [
  {
    name: "Bounan-Bot-library.jsonl",
    path: "Bounan-Bot-library.jsonl",
    sha: "library-sha",
    type: "file",
  },
  {
    name: "Bounan-Bot-users.jsonl",
    path: "Bounan-Bot-users.jsonl",
    sha: "users-sha",
    type: "file",
  },
  {
    name: "Bounan-Bot-subscriptions.jsonl",
    path: "Bounan-Bot-subscriptions.jsonl",
    sha: "subscriptions-sha",
    type: "file",
  },
  {
    name: "Bounan-Ongoing-main.jsonl",
    path: "Bounan-Ongoing-main.jsonl",
    sha: "ongoing-sha",
    type: "file",
  },
] as const;

function line(item: Record<string, unknown>) {
  return JSON.stringify({ Item: item });
}

export const representativeBackupFixtureJsonl = new Map<string, string>([
  [
    "Bounan-Bot-library.jsonl",
    [
      line({
        myAnimeListId: { N: "123" },
        dubs: { SS: ["sub", "dub"] },
        createdAt: { S: "2026-04-17T08:55:00.000Z" },
        updatedAt: { S: "2026-04-17T09:00:00.000Z" },
      }),
      line({
        myAnimeListId: { N: "124" },
        dubs: { SS: ["sub"] },
        createdAt: { S: "2026-04-17T08:56:00.000Z" },
        updatedAt: { S: "2026-04-17T09:01:00.000Z" },
      }),
    ].join("\n"),
  ],
  [
    "Bounan-Bot-users.jsonl",
    [
      line({
        userId: { S: "u-1" },
        status: { S: "active" },
        directRank: { N: "1" },
        indirectRank: { N: "2" },
        requestedEpisodes: { L: [{ N: "1" }] },
        updatedAt: { S: "2026-04-17T09:00:00.000Z" },
      }),
      line({
        userId: { S: "broken-user" },
        directRank: { N: "3" },
        indirectRank: { N: "5" },
        requestedEpisodes: { L: [{ N: "2" }] },
        updatedAt: { S: "2026-04-17T09:01:00.000Z" },
      }),
    ].join("\n"),
  ],
  [
    "Bounan-Bot-subscriptions.jsonl",
    [
      line({
        animeKey: { S: "123#sub" },
        oneTimeSubscribers: { SS: ["u-1"] },
        createdAt: { S: "2026-04-17T09:02:00.000Z" },
        updatedAt: { S: "2026-04-17T09:02:00.000Z" },
      }),
      line({
        animeKey: { S: "777#sub" },
        oneTimeSubscribers: { SS: ["broken-user"] },
        createdAt: { S: "2026-04-17T09:03:00.000Z" },
        updatedAt: { S: "2026-04-17T09:03:00.000Z" },
      }),
    ].join("\n"),
  ],
  [
    "Bounan-Ongoing-main.jsonl",
    [
      line({
        animeKey: { S: "123#sub" },
        dub: { S: "sub" },
        episodes: { NS: ["1", "2"] },
        myAnimeListId: { N: "123" },
        updatedAt: { S: "2026-04-17T09:04:00.000Z" },
      }),
      line({
        animeKey: { S: "999#sub" },
        dub: { S: "sub" },
        episodes: { NS: ["1"] },
        myAnimeListId: { N: "999" },
        updatedAt: { S: "2026-04-17T09:05:00.000Z" },
      }),
    ].join("\n"),
  ],
]);
