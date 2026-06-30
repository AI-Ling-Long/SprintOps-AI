import { spawn } from "node:child_process";

import { createElectronEnvironment } from "./electron-environment.mjs";

const command = process.platform === "win32" ? "electron-vite.cmd" : "electron-vite";
const child = spawn(command, process.argv.slice(2), {
  env: createElectronEnvironment(process.env),
  stdio: "inherit",
});

child.on("error", (error) => {
  console.error(`Unable to start electron-vite: ${error.message}`);
  process.exitCode = 1;
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exitCode = code ?? 1;
});
