"use client";

export {
  completeNewPasswordChallenge,
  getIdToken,
  resolveCompletedPasswordChallengeResult,
  resolveInitiateAuthResult,
} from "./aws/cognito";
export {
  createLookupKeyFromSchema,
  enrichTablesWithDynamoSchema,
  fetchBackupEntryByKey,
  refetchBackupEntry,
  refreshBackupTableFromDynamo,
  resolveLookupKeyValues,
  validateAwsAccess,
} from "./aws/dynamo-access";
export {
  normalizeUnmarshalledDynamoRecord,
  normalizeUnmarshalledDynamoValue,
} from "./aws/dynamo-normalization";
export { applyTableSchemaMetadata } from "./aws/dynamo-schema";
export { CognitoNewPasswordRequiredError } from "./aws/shared";
