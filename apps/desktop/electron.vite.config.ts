import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: ["@sprintops/contracts"] })],
  },
  preload: {
    // Sandboxed preloads may only require Electron and a limited set of Node built-ins.
    // Bundle runtime validation dependencies into the preload instead of requiring them at runtime.
    plugins: [externalizeDepsPlugin({ exclude: ["@sprintops/contracts", "zod"] })],
  },
  renderer: {
    root: resolve("src/renderer"),
    plugins: [react()],
  },
});
