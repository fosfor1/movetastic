// Vitest projects. `integration` talks to a running local Supabase (and app server) over the network;
// it never imports application code, so no Astro/Vite config is loaded here.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          globalSetup: ["tests/integration/setup/global-setup.ts"],
          testTimeout: 30_000,
          hookTimeout: 30_000,
          // Test files share one database; run them one after another.
          fileParallelism: false,
        },
      },
      {
        // Proof for the Claude Code hooks in .claude/hooks/; runs the scripts in throwaway git repos.
        test: {
          name: "hooks",
          environment: "node",
          include: ["tests/hooks/**/*.test.ts"],
          testTimeout: 30_000,
        },
      },
    ],
  },
});
