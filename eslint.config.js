import globals from "globals";
import js from "@eslint/js";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";

export default [
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node,
        ...globals.jest,
        // Add browser or other specific globals if needed, e.g. ...globals.browser
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: "warn",
    },
  },
  js.configs.recommended,
  eslintPluginPrettierRecommended,
  {
    // Custom rules or overrides can go here
    // For example, to apply to all JS/MJS files:
    files: ["**/*.js", "**/*.mjs"],
    rules: {
      // "no-unused-vars": "warn", // Example: if you want to override prettier/recommended
    },
  },
  {
    // If you have specific test file patterns, you can configure them separately
    files: ["**/*.test.js", "**/*.spec.js"],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
    rules: {
      // Test-specific rules
    },
  },
  {
    // Ignores configuration
    // Ensure this is the last object if it's a global ignore,
    // or place it appropriately if it's part of a more specific config block.
    ignores: [
      "node_modules/",
      "dist/",
      "build/",
      // Add other directories or files to ignore
      // e.g., "coverage/", "*.log"
    ],
  },
];
