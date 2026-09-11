import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

// no-undef is the gate that matters: esbuild passes undefined identifiers through as
// globals, and only ESLint catches them. eslint-plugin-react closes the JSX-tag gap.
export default [
  { ignores: ["dist", "dev-dist", "node_modules", "supabase/functions/**"] },
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx,mjs}"],
    plugins: { react, "react-hooks": reactHooks },
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.node, ...globals.es2021 },
    },
    settings: { react: { version: "18.3" } },
    rules: {
      "no-undef": "error",
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" }],
      "react/jsx-uses-vars": "error",
      "react/jsx-no-undef": "error",
      "react/jsx-uses-react": "off",
      "react/react-in-jsx-scope": "off",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
];
