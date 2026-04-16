export const dashboardAuthConfig = {
  stackName: "BounanDashboardAuth",
  userPoolName: "bounan-dashboard-users",
  identityPoolName: "bounanDashboardIdentityPool",
  readerGroupName: "dashboard-readers",
  readerRoleName: "bounan-dashboard-dynamo-reader",
  tablePrefixes: ["Bounan-"],
} as const;
