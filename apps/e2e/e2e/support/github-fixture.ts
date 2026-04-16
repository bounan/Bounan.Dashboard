import type { Page } from "@playwright/test";
import {
  representativeBackupFixtureJsonl,
  representativeBackupFixtureRepo,
  representativeBackupFixtureTables,
} from "../../../web/app/lib/fixtures/backup-fixtures";

const repo = representativeBackupFixtureRepo.fullName;
const branch = representativeBackupFixtureRepo.branch;
const commitSha = representativeBackupFixtureRepo.commitSha;
const updatedAt = representativeBackupFixtureRepo.updatedAt;
const tableFiles = representativeBackupFixtureTables;
const rawFiles = representativeBackupFixtureJsonl;

export const fixtureBackupConfig = {
  githubToken: "github_pat_fixture_token_abcdefghijklmnopqrstuvwxyz",
  backupRepo: repo,
};

export async function installGitHubFixture(page: Page) {
  await page.context().route("https://api.github.com/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    if (path === `/repos/${repo}`) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          name: "fixture-backup",
          full_name: repo,
          private: true,
          default_branch: branch,
          html_url: `https://github.com/${repo}`,
        }),
      });
      return;
    }

    if (path === `/repos/${repo}/contents`) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(tableFiles),
      });
      return;
    }

    if (path === `/repos/${repo}/commits/${branch}`) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          sha: commitSha,
          commit: {
            author: {
              date: updatedAt,
            },
          },
        }),
      });
      return;
    }

    const contentPrefix = `/repos/${repo}/contents/`;

    if (path.startsWith(contentPrefix)) {
      const fileName = decodeURIComponent(path.slice(contentPrefix.length));
      const body = rawFiles.get(fileName);

      if (!body) {
        await route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ message: "Not Found" }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "text/plain",
        body,
      });
      return;
    }

    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ message: "Unhandled fixture route" }),
    });
  });
}
