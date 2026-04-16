import { config as baseConfig } from "@repo/eslint-config/base";

export default [
  {
    ignores: ["cdk.out/**", "dist/**"],
  },
  ...baseConfig,
];
