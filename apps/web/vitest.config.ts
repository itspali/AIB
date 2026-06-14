import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "lib/search/__tests__/**/*.test.ts",
      "lib/products/__tests__/**/*.test.ts",
      "lib/categories/__tests__/**/*.test.ts",
      "lib/layout/__tests__/**/*.test.ts",
      "lib/theme/__tests__/**/*.test.ts",
      "lib/list-columns/__tests__/**/*.test.ts",
      "lib/locations/__tests__/**/*.test.ts",
      "lib/inventory/__tests__/**/*.test.ts",
      "lib/procurement/__tests__/**/*.test.ts",
      "lib/documents/__tests__/**/*.test.ts",
      "lib/activity/__tests__/**/*.test.ts",
      "lib/group/__tests__/**/*.test.ts",
      "lib/entity-categories/__tests__/**/*.test.ts",
      "lib/entities/__tests__/**/*.test.ts",
      "lib/notifications/__tests__/**/*.test.ts",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
