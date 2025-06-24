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
  // Configuration from eslint-plugin-prettier (runs Prettier as an ESLint rule)
  prettierPlugin.configs.recommended,
  // THIS MUST BE THE LAST CONFIGURATION IN THE ARRAY
  // Configuration from eslint-config-prettier (disables ESLint rules that conflict with Prettier)
  eslintConfigPrettier,
  // Re-apply prettier/prettier: "warn" if desired, after eslintConfigPrettier might have set it to error via plugin's recommended
  {
    rules: {
      "prettier/prettier": "warn"
    }
  }
];
