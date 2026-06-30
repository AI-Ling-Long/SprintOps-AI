import { join } from "node:path";

import { app, BrowserWindow, shell } from "electron";

import { RuntimeInfoSchema } from "@sprintops/contracts";

import { createAuthController } from "./auth/auth-controller";
import { createDiskAuthStorage } from "./auth/disk-auth-storage";
import { createSupabaseAuthProvider, createUnavailableAuthProvider } from "./auth/supabase-auth-provider";
import { loadRuntimeConfig } from "./config";
import { registerIpcHandlers } from "./ipc/register-ipc";

let mainWindow: BrowserWindow | null = null;

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#f6f7fb",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    const parsed = new URL(url);
    if (parsed.protocol === "https:") void shell.openExternal(url);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, url) => {
    if (url !== window.webContents.getURL()) event.preventDefault();
  });
  window.once("ready-to-show", () => window.show());
  window.on("closed", () => {
    if (mainWindow === window) mainWindow = null;
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void window.loadFile(join(__dirname, "../renderer/index.html"));
  }

  return window;
}

app.whenReady().then(() => {
  const config = loadRuntimeConfig();
  const provider = config.supabase
    ? createSupabaseAuthProvider({
        ...config.supabase,
        callbackPort: config.callbackPort,
        storage: createDiskAuthStorage(),
      })
    : createUnavailableAuthProvider();

  registerIpcHandlers(
    createAuthController(provider),
    RuntimeInfoSchema.parse({
      platform: process.platform,
      version: app.getVersion(),
      apiBaseUrl: config.apiBaseUrl,
      authConfigured: Boolean(config.supabase),
    }),
  );
  mainWindow = createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
