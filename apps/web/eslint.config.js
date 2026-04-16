import { nextJsConfig } from "@repo/eslint-config/next-js";

/** @type {import("eslint").Linter.Config[]} */
export default [
  {
    ignores: ["out/**", "test-results/**"],
  },
  {
    files: ["app/**/*.ts", "app/**/*.tsx"],
    rules: {
      "max-lines": ["error", { max: 650, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    files: ["app/**/*.ts", "app/**/*.tsx"],
    ignores: ["app/lib/repositories/**/*.ts", "app/lib/storage.ts", "app/lib/storage.test.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "**/lib/storage",
                "./storage",
                "../storage",
                "../../storage",
                "../../../storage",
              ],
              message: "Use repository modules instead of importing storage directly.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["app/**/*.ts", "app/**/*.tsx"],
    ignores: ["app/layout.tsx", "app/features/dashboard/hooks/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "sonner",
              message: "Use toast notifications only in controller hooks or layout wiring.",
            },
          ],
        },
      ],
    },
  },
  ...nextJsConfig,
];
