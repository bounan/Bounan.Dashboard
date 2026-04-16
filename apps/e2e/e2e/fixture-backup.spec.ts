import { expect, test, type Page } from "@playwright/test";
import { fixtureBackupConfig, installGitHubFixture } from "./support/github-fixture";

test.describe("fixture dashboard flow", () => {
  test.beforeEach(async ({ page }) => {
    await installGitHubFixture(page);
    await page.goto("/?view=config");
    await page.evaluate(async () => {
      window.localStorage.clear();
      await new Promise<void>((resolve) => {
        const request = window.indexedDB.deleteDatabase("bounan-dashboard");
        request.onsuccess = () => resolve();
        request.onerror = () => resolve();
        request.onblocked = () => resolve();
      });
    });
    await page.reload();
  });

  async function fillConfig(page: Page) {
    await page.getByLabel("GitHub token").fill(fixtureBackupConfig.githubToken);
    await page.getByLabel("Backup repo").fill(fixtureBackupConfig.backupRepo);
  }

  async function validateConfig(page: Page) {
    await fillConfig(page);
    await page.getByRole("button", { name: "Check", exact: true }).click();
    await expect(page.getByText("GitHub access verified").first()).toBeVisible();
  }

  async function loadBackup(page: Page) {
    await page.getByTestId("nav-backup-analyzer").click();
    await page.getByRole("button", { name: /Load backup|Update backup|Reload backup/i }).click();
    await expect(page.getByText(/tables online/i)).toBeVisible();
  }

  test("imports JSON config into fields without auto-validating", async ({ page }) => {
    const input = page.locator('input[type="file"]');
    await input.setInputFiles({
      name: "dashboard-config.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({
          githubToken: fixtureBackupConfig.githubToken,
          backupRepo: fixtureBackupConfig.backupRepo,
          awsRegion: "eu-central-1",
        }),
      ),
    });

    await expect(page.getByLabel("GitHub token")).toHaveValue(fixtureBackupConfig.githubToken);
    await expect(page.getByLabel("Backup repo")).toHaveValue(fixtureBackupConfig.backupRepo);
    await expect(page.getByLabel("AWS region")).toHaveValue("eu-central-1");
    await expect(page.getByText("Import complete")).toBeVisible();
    await expect(page.getByText("not checked")).toBeVisible();
    await expect(page.getByText("GitHub access verified")).toHaveCount(0);
  });

  test("saves config and restores it after reload", async ({ page }) => {
    await fillConfig(page);
    await page.getByRole("button", { name: "Save config" }).click();

    await expect(page.getByText("Configuration saved to local browser storage.")).toBeVisible();
    await page.reload();

    await expect(page.getByLabel("GitHub token")).toHaveValue(fixtureBackupConfig.githubToken);
    await expect(page.getByLabel("Backup repo")).toHaveValue(fixtureBackupConfig.backupRepo);
  });

  test("validates config without loading backup data implicitly", async ({ page }) => {
    await validateConfig(page);

    await page.getByTestId("nav-backup-analyzer").click();
    await expect(page.getByText("Ready to load backup")).toBeVisible();
    await expect(page.getByRole("button", { name: "Load backup" })).toBeVisible();
    await expect(page.getByText(/Rows scanned/i)).toHaveCount(0);
  });

  test("loads backup, filters rows, and updates the row inspector", async ({ page }) => {
    await validateConfig(page);
    await loadBackup(page);

    await page.getByRole("tab", { name: "Bot Users" }).click();
    await expect(page.getByText("Bot Users")).toBeVisible();

    await expect(page.getByText(/matching rows/i)).toBeVisible();
    const issueOnlyCount = Number(
      ((await page.getByText(/matching rows/i).textContent()) ?? "").match(/\d+/)?.[0] ?? "0",
    );
    expect(issueOnlyCount).toBeGreaterThan(0);

    await page.getByRole("switch").click();
    await expect(page.getByText(/matching rows/i)).toBeVisible();
    const allRowsCount = Number(
      ((await page.getByText(/matching rows/i).textContent()) ?? "").match(/\d+/)?.[0] ?? "0",
    );
    expect(allRowsCount).toBeGreaterThanOrEqual(issueOnlyCount);

    await page.getByRole("switch").click();
    await expect(page.locator("tbody tr")).toHaveCount(issueOnlyCount);
    await page.locator("tbody tr").first().click();

    await expect(page.getByText("Row inspector")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Validation issues" })).toBeVisible();
    await expect(page.getByText(/Bot User schema violation userId/i)).toBeVisible();
    await expect(page.getByText("Backup payload preview")).toBeVisible();
  });

  test("supports table switching and status filtering on the Backup page", async ({ page }) => {
    await validateConfig(page);
    await loadBackup(page);

    await page.getByRole("tab", { name: "Bot Library" }).click();
    await expect(page.getByRole("heading", { name: "Bounan Bot Library" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Load entry by key" })).toBeVisible();
    await expect(page.getByText(/Primary keys:/i).first()).toBeVisible();

    await page.getByRole("switch").click();
    await page.getByLabel("Status").selectOption("healthy");
    await expect(page.locator("tbody tr")).toHaveCount(0);

    await page.getByLabel("Status").selectOption("critical");
    await expect(page.locator("tbody tr")).toHaveCount(2);
  });

  test("shows populated and empty violation states on the Rules page", async ({ page }) => {
    await validateConfig(page);
    await loadBackup(page);

    await page.getByTestId("nav-rules").click();
    await expect(page.getByText("Structured validation catalog and live violations")).toBeVisible();

    await page.getByRole("button", { name: /users-schema/i }).click();
    await expect(page.getByRole("heading", { name: "Violation summary" })).toBeVisible();
    await expect(page.getByText(/users-schema · entry/i)).toBeVisible();
    await expect(page.getByText(/Table: Bounan-Bot-users/i).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Update" }).first()).toBeVisible();

    await page.getByRole("button", { name: /library-mal-uniqueness/i }).click();
    await expect(page.getByText(/library-mal-uniqueness · cross-entry/i)).toBeVisible();
    await expect(page.getByText("No visible violations")).toBeVisible();
  });

  test("keeps loaded backup data available across navigation and reload", async ({ page }) => {
    await validateConfig(page);
    await loadBackup(page);
    await page.getByRole("tab", { name: "Bot Users" }).click();
    await page.locator("tbody tr").first().click();
    await expect(page.getByText("Row inspector")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Validation issues" })).toBeVisible();

    await page.getByTestId("nav-rules").click();
    await expect(page.getByRole("heading", { name: "Violation summary" })).toBeVisible();
    await page.getByTestId("nav-backup-analyzer").click();
    await expect(page.getByText("Row inspector")).toBeVisible();
    await expect(page.getByText(/matching rows/i)).toBeVisible();

    await page.reload();
    await expect(page.getByText(/tables online/i)).toBeVisible();
    await expect(page.getByText(/matching rows/i)).toBeVisible();
  });
});
