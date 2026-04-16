import {
  CfnOutput,
  RemovalPolicy,
  Stack,
  type StackProps,
  aws_cognito as cognito,
  aws_iam as iam,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import { dashboardAuthConfig } from "./config";

interface DashboardAuthStackProps extends StackProps {
  tablePrefixes: string[];
}

export class DashboardAuthStack extends Stack {
  constructor(scope: Construct, id: string, props: DashboardAuthStackProps) {
    super(scope, id, props);

    const userPool = new cognito.UserPool(this, "DashboardUserPool", {
      userPoolName: dashboardAuthConfig.userPoolName,
      selfSignUpEnabled: false,
      signInAliases: {
        username: true,
      },
      removalPolicy: RemovalPolicy.RETAIN,
      passwordPolicy: {
        minLength: 12,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
    });

    const userPoolClient = new cognito.UserPoolClient(this, "DashboardUserPoolClient", {
      userPool,
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      preventUserExistenceErrors: true,
    });

    const identityPool = new cognito.CfnIdentityPool(this, "DashboardIdentityPool", {
      identityPoolName: dashboardAuthConfig.identityPoolName,
      allowUnauthenticatedIdentities: false,
      cognitoIdentityProviders: [
        {
          clientId: userPoolClient.userPoolClientId,
          providerName: userPool.userPoolProviderName,
        },
      ],
    });

    const dynamoReaderRole = new iam.Role(this, "DashboardDynamoReaderRole", {
      roleName: dashboardAuthConfig.readerRoleName,
      assumedBy: new iam.FederatedPrincipal(
        "cognito-identity.amazonaws.com",
        {
          StringEquals: {
            "cognito-identity.amazonaws.com:aud": identityPool.ref,
          },
          "ForAnyValue:StringLike": {
            "cognito-identity.amazonaws.com:amr": "authenticated",
          },
        },
        "sts:AssumeRoleWithWebIdentity",
      ),
      description: "Authenticated dashboard users can read Bounan DynamoDB tables.",
    });

    for (const prefix of props.tablePrefixes) {
      dynamoReaderRole.addToPolicy(
        new iam.PolicyStatement({
          actions: [
            "dynamodb:BatchGetItem",
            "dynamodb:DescribeTable",
            "dynamodb:GetItem",
            "dynamodb:Query",
            "dynamodb:Scan",
          ],
          resources: [
            this.formatArn({
              service: "dynamodb",
              resource: "table",
              resourceName: `${prefix}*`,
            }),
            this.formatArn({
              service: "dynamodb",
              resource: "table",
              resourceName: `${prefix}*/index/*`,
            }),
          ],
        }),
      );
    }

    new cognito.CfnUserPoolGroup(this, "DashboardReadersGroup", {
      groupName: dashboardAuthConfig.readerGroupName,
      userPoolId: userPool.userPoolId,
      roleArn: dynamoReaderRole.roleArn,
      precedence: 1,
    });

    new cognito.CfnIdentityPoolRoleAttachment(this, "DashboardIdentityPoolRoles", {
      identityPoolId: identityPool.ref,
      roles: {
        authenticated: dynamoReaderRole.roleArn,
      },
      roleMappings: {
        dashboardReaders: {
          type: "Token",
          ambiguousRoleResolution: "AuthenticatedRole",
          identityProvider: `${userPool.userPoolProviderName}:${userPoolClient.userPoolClientId}`,
        },
      },
    });

    new CfnOutput(this, "AwsRegion", {
      value: this.region,
    });
    new CfnOutput(this, "CognitoUserPoolId", {
      value: userPool.userPoolId,
    });
    new CfnOutput(this, "CognitoUserPoolClientId", {
      value: userPoolClient.userPoolClientId,
    });
    new CfnOutput(this, "CognitoIdentityPoolId", {
      value: identityPool.ref,
    });
    new CfnOutput(this, "ReaderGroupName", {
      value: dashboardAuthConfig.readerGroupName,
    });
    new CfnOutput(this, "DashboardWebConfig", {
      value: JSON.stringify({
        awsRegion: this.region,
        cognitoUserPoolId: userPool.userPoolId,
        cognitoUserPoolClientId: userPoolClient.userPoolClientId,
        cognitoIdentityPoolId: identityPool.ref,
      }),
    });
  }
}
