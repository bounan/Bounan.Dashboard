import { describe, expect, it, vi } from "vitest";
import { completeAwsPasswordChallenge } from "./complete-password-challenge";
import { AppError } from "../../../../lib/errors";

vi.mock("../../../../lib/aws-browser", async () => {
  const actual = await vi.importActual<object>("../../../../lib/aws-browser");

  return {
    ...actual,
    completeNewPasswordChallenge: vi.fn(),
  };
});

const awsBrowser = await import("../../../../lib/aws-browser");

describe("completeAwsPasswordChallenge", () => {
  it("returns the updated config after a successful password change", async () => {
    vi.mocked(awsBrowser.completeNewPasswordChallenge).mockResolvedValue("token");

    const nextConfig = await completeAwsPasswordChallenge({
      config: {
        githubToken: "gh",
        backupRepo: "owner/repo",
        awsRegion: "eu-central-1",
        cognitoUserPoolId: "pool",
        cognitoUserPoolClientId: "client",
        cognitoIdentityPoolId: "identity",
        cognitoUsername: "user",
        cognitoPassword: "old",
        isValidated: true,
        lastValidatedAt: "2026-04-18T00:00:00.000Z",
      },
      session: "session-token",
      newPassword: "new-password",
    });

    expect(nextConfig.cognitoPassword).toBe("new-password");
    expect(nextConfig.isValidated).toBe(false);
    expect(nextConfig.lastValidatedAt).toBeNull();
  });

  it("preserves challenge completion failures for controller-level presentation", async () => {
    vi.mocked(awsBrowser.completeNewPasswordChallenge).mockRejectedValue(
      new AppError("aws-auth", "Challenge failed."),
    );

    await expect(
      completeAwsPasswordChallenge({
        config: {
          githubToken: "gh",
          backupRepo: "owner/repo",
          awsRegion: "eu-central-1",
          cognitoUserPoolId: "pool",
          cognitoUserPoolClientId: "client",
          cognitoIdentityPoolId: "identity",
          cognitoUsername: "user",
          cognitoPassword: "old",
          isValidated: true,
          lastValidatedAt: "2026-04-18T00:00:00.000Z",
        },
        session: "session-token",
        newPassword: "new-password",
      }),
    ).rejects.toThrow("Challenge failed.");
  });
});
