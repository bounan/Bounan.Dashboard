"use client";

import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  type InitiateAuthCommandOutput,
  RespondToAuthChallengeCommand,
  type RespondToAuthChallengeCommandOutput,
} from "@aws-sdk/client-cognito-identity-provider";
import { AppError } from "../errors";
import type { BackupConfig } from "../types";
import { CognitoNewPasswordRequiredError, requireValue } from "./shared";

function createCognitoClient(region: string) {
  return new CognitoIdentityProviderClient({ region });
}

export function resolveInitiateAuthResult(input: {
  response: Pick<InitiateAuthCommandOutput, "ChallengeName" | "Session" | "AuthenticationResult">;
  region: string;
  userPoolId: string;
}) {
  if (input.response.ChallengeName === "NEW_PASSWORD_REQUIRED" && input.response.Session) {
    throw new CognitoNewPasswordRequiredError(input.response.Session);
  }

  const idToken = input.response.AuthenticationResult?.IdToken;

  if (!idToken) {
    throw new AppError("aws-auth", "Cognito authentication did not return an ID token.");
  }

  return {
    idToken,
    providerKey: `cognito-idp.${input.region}.amazonaws.com/${input.userPoolId}`,
  };
}

export async function getIdToken(config: BackupConfig) {
  const region = requireValue(config.awsRegion, "AWS region");
  const userPoolId = requireValue(config.cognitoUserPoolId, "Cognito User Pool ID");
  const userPoolClientId = requireValue(
    config.cognitoUserPoolClientId,
    "Cognito User Pool Client ID",
  );
  const username = requireValue(config.cognitoUsername, "Cognito username");
  const password = requireValue(config.cognitoPassword, "Cognito password");
  const cognito = createCognitoClient(region);
  const response = await cognito.send(
    new InitiateAuthCommand({
      ClientId: userPoolClientId,
      AuthFlow: "USER_PASSWORD_AUTH",
      AuthParameters: {
        USERNAME: username,
        PASSWORD: password,
      },
    }),
  );

  return resolveInitiateAuthResult({
    response,
    region,
    userPoolId,
  });
}

export function resolveCompletedPasswordChallengeResult(
  response: Pick<RespondToAuthChallengeCommandOutput, "AuthenticationResult">,
) {
  if (!response.AuthenticationResult?.IdToken) {
    throw new AppError(
      "aws-auth",
      "Cognito accepted the new password, but no session token was returned.",
    );
  }

  return response.AuthenticationResult.IdToken;
}

export async function completeNewPasswordChallenge(input: {
  config: BackupConfig;
  session: string;
  newPassword: string;
}) {
  const region = requireValue(input.config.awsRegion, "AWS region");
  const userPoolClientId = requireValue(
    input.config.cognitoUserPoolClientId,
    "Cognito User Pool Client ID",
  );
  const username = requireValue(input.config.cognitoUsername, "Cognito username");
  const newPassword = requireValue(input.newPassword, "New Cognito password");
  const cognito = createCognitoClient(region);
  const response = await cognito.send(
    new RespondToAuthChallengeCommand({
      ClientId: userPoolClientId,
      ChallengeName: "NEW_PASSWORD_REQUIRED",
      Session: input.session,
      ChallengeResponses: {
        USERNAME: username,
        NEW_PASSWORD: newPassword,
      },
    }),
  );

  return resolveCompletedPasswordChallengeResult(response);
}
