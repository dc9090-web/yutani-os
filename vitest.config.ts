import { defineConfig } from "vitest/config";
export default defineConfig({
  test: { environment: "happy-dom", setupFiles: ["./tests/setup.ts"], globals: true, fileParallelism: false },
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },
});
