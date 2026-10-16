import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: "node",
    // CUSTOM-HOOK: brain-test-discovery begin
    // Keep the isolated geometry tests discoverable by npm test and knip's Vitest plugin.
    include: [
      "tests/**/*.test.ts",
      "tests/**/*.test.tsx",
      "src/custom/brain/__tests__/**/*.test.ts",
    ],
    // CUSTOM-HOOK: brain-test-discovery end
  },
});
