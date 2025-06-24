import globals from "globals";
import js from "@eslint/js";
import prettierPlugin from "eslint-plugin-prettier";
import eslintConfigPrettier from "eslint-config-prettier";

export default [
  {
    ignores: [
      "node_modules/",
      "coverage/",
      "dist/",
      "build/"
    ]
  },
  js.configs.recommended,
  {
    // Global settings for all JS files (excluding Prettier-specific rules for now)
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node,
        ...globals.jest
      }
    },
    rules: {
      "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
      "no-console": "off"
      // Add any other project-specific rules here
    }
  },
  // Configuration for Prettier
  // 1. Add eslint-plugin-prettier
  // 2. Set the prettier/prettier rule
  // 3. Add eslint-config-prettier to disable conflicting ESLint rules (MUST BE LAST)
  {
    plugins: {
      prettier: prettierPlugin
    },
    rules: {
      "prettier/prettier": "warn" // or "error" if you want ESLint to fail on Prettier issues
    }
  },
  eslintConfigPrettier // Disables ESLint rules that conflict with Prettier. Must be last.
];
