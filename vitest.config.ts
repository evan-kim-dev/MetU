import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: {
    jsx: "automatic",
  },
  test: {
    environment: "node",
    include: [
      "lib/**/*.test.ts",
      "lib/**/*.test.tsx",
      "tests/**/*.test.ts",
      "components/**/*.test.tsx",
      "app/**/*.test.ts",
      "app/**/*.test.tsx",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
      "server-only": path.resolve(__dirname, "vitest-server-only-stub.ts"),
    },
  },
});
