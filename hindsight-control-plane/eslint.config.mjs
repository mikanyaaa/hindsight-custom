import js from "@eslint/js";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  js.configs.recommended,
  ...nextVitals,
  ...nextTs,
  {
    // ESLint 9 requires the plugin on the same config object as the rules.
    // next's shared config registers it for its own objects only.
    plugins: { "react-hooks": reactHooks },
    rules: {
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "no-case-declarations": "off",
      // React Compiler rules from react-hooks v7. The app does not run the
      // compiler, so these are advice for now: warn until the existing hits
      // are refactored, then promote to error.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/refs": "warn",
    },
  },
  {
    // The published CLI launcher is plain CommonJS run by node.
    files: ["bin/**/*.js"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  {
    ignores: [".next*/", "out/", "build/", "standalone/", "coverage/", "next-env.d.ts"],
  },
];
