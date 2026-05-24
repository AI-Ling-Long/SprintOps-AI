const { app, BrowserWindow } = require("electron");
const path = require("path");
const { spawn } = require("child_process");

const isDev = !app.isPackaged;
let serverProcess = null;

function startServer() {
  const serverPath = path.join(__dirname, "..", "server", "server.js");

  serverProcess = spawn("node", [serverPath], {
    cwd: path.join(__dirname, "..", "server"),
    env: { ...process.env },
    stdio: "inherit",
    windowsHide: true,
  });

  serverProcess.on("error", (error) => {
    console.error("Failed to start API server:", error);
  });

  serverProcess.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      console.error(
        `API server exited with code ${code}. If port 3000 is already in use, stop the old server and restart the app.`
      );
    }
  });
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 820,
    minHeight: 600,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }
}

app.whenReady().then(() => {
  startServer();
  setTimeout(createWindow, 500);
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("will-quit", () => {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill();
  }
});
