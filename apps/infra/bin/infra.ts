import { App } from "aws-cdk-lib";
import { dashboardAuthConfig } from "../lib/config";
import { DashboardAuthStack } from "../lib/dashboard-auth-stack";

const app = new App();

new DashboardAuthStack(app, dashboardAuthConfig.stackName, {
  tablePrefixes: [...dashboardAuthConfig.tablePrefixes],
});
