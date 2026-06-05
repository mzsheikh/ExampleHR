import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/backend/**/*.test.js"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      reportsDirectory: "coverage/backend",
      include: ["src/backend/**/*.js"],
      exclude: ["src/backend/main.js", "**/*.test.js"]
    }
  }
});
