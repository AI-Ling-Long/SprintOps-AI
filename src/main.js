const { app, BrowserWindow, ipcMain, shell } = require("electron");
const http = require("http");
const path = require("path");
const { spawn } = require("child_process");
const dotenv = require("dotenv");

const isDev = !app.isPackaged;
let serverProcess = null;
let mainWindow = null;
let supabaseClientPromise = null;

const serverDir = path.join(__dirname, "..", "server");
dotenv.config({ path: path.join(serverDir, ".env") });

const authCallbackPort = Number(process.env.SUPABASE_AUTH_CALLBACK_PORT || 39177);
const authCallbackPath = "/auth/callback";
const authCallbackUrl = `http://127.0.0.1:${authCallbackPort}${authCallbackPath}`;

function createMemoryStorage() {
  const store = new Map();

  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, value),
    removeItem: (key) => store.delete(key),
  };
}

async function getSupabaseClient() {
  if (supabaseClientPromise) return supabaseClientPromise;

  const { SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Add SUPABASE_URL and SUPABASE_ANON_KEY to server/.env.");
  }

  supabaseClientPromise = import("@supabase/supabase-js").then(({ createClient }) =>
    createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        flowType: "pkce",
        detectSessionInUrl: false,
        persistSession: true,
        storage: createMemoryStorage(),
      },
    })
  );

  return supabaseClientPromise;
}

function toPublicSupabaseUser(user, provider) {
  const metadata = user.user_metadata || {};
  const name = metadata.full_name || metadata.name || metadata.user_name || user.email?.split("@")[0] || "Signed-in user";

  return {
    id: user.id,
    name,
    email: user.email,
    avatarUrl: metadata.avatar_url || metadata.picture || null,
    provider,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function sendAuthResponse(res, title, message) {
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);

  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${safeTitle}</title>
    <style>
      body {
        display: grid;
        min-height: 100vh;
        margin: 0;
        place-items: center;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: #111827;
        background: #f8fafc;
      }
      main {
        max-width: 30rem;
        padding: 2rem;
        text-align: center;
      }
      h1 { margin: 0 0 0.5rem; font-size: 1.5rem; }
      p { margin: 0; color: #64748b; }
    </style>
  </head>
  <body>
    <main>
      <h1>${safeTitle}</h1>
      <p>${safeMessage}</p>
    </main>
  </body>
</html>`);
}

function getProviderLabel(provider) {
  return provider === "github" ? "GitHub" : "Google";
}

function getProviderQueryParams(provider) {
  if (provider === "google") {
    return {
      access_type: "offline",
      prompt: "consent",
    };
  }

  return {};
}

function getProviderScopes(provider) {
  if (provider === "github") {
    return "read:user user:email repo";
  }

  return undefined;
}

function startOAuthCallbackServer(supabase, provider) {
  const providerLabel = getProviderLabel(provider);
  let server;
  let timeout;
  let closed = false;

  function closeServer() {
    clearTimeout(timeout);

    if (!closed) {
      closed = true;
      try {
        server.close();
      } catch {
        // The server may fail before it starts listening.
      }
    }
  }

  const callbackPromise = new Promise((resolve, reject) => {
    timeout = setTimeout(() => {
      closeServer();
      reject(new Error(`${providerLabel} sign-in timed out. Try again.`));
    }, 5 * 60 * 1000);

    server = http.createServer(async (req, res) => {
      try {
        const url = new URL(req.url, authCallbackUrl);

        if (url.pathname !== authCallbackPath) {
          res.writeHead(404);
          res.end("Not found");
          return;
        }

        const oauthError = url.searchParams.get("error_description") || url.searchParams.get("error");
        if (oauthError) {
          throw new Error(oauthError);
        }

        const code = url.searchParams.get("code");
        if (!code) {
          throw new Error(`${providerLabel} did not return an auth code.`);
        }

        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) throw error;
        if (!data.user) throw new Error("Supabase did not return a user.");

        sendAuthResponse(res, "You are signed in", "You can return to SprintOps AI now.");
        clearTimeout(timeout);
        closeServer();
        resolve(toPublicSupabaseUser(data.user, provider));
      } catch (error) {
        sendAuthResponse(res, "Sign-in failed", error.message);
        clearTimeout(timeout);
        closeServer();
        reject(error);
      }
    });

    server.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    server.listen(authCallbackPort, "127.0.0.1");
  });

  const readyPromise = new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });

  return {
    callbackPromise,
    readyPromise,
    close: closeServer,
  };
}

async function signInWithProvider(provider) {
  const supabase = await getSupabaseClient();
  const providerLabel = getProviderLabel(provider);
  const callbackServer = startOAuthCallbackServer(supabase, provider);

  try {
    await callbackServer.readyPromise;

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: authCallbackUrl,
        skipBrowserRedirect: true,
        scopes: getProviderScopes(provider),
        queryParams: getProviderQueryParams(provider),
      },
    });

    if (error) throw error;
    if (!data.url) throw new Error(`Supabase did not return a ${providerLabel} sign-in URL.`);

    await shell.openExternal(data.url);
    const user = await callbackServer.callbackPromise;

    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }

    return user;
  } catch (error) {
    callbackServer.callbackPromise.catch(() => {});
    callbackServer.close();
    throw error;
  }
}

function signInWithGoogle() {
  return signInWithProvider("google");
}

function signInWithGitHub() {
  return signInWithProvider("github");
}

async function signOut() {
  if (!supabaseClientPromise) return;

  const supabase = await getSupabaseClient();
  await supabase.auth.signOut();
}

function startServer() {
  const serverPath = path.join(serverDir, "server.js");

  serverProcess = spawn("node", [serverPath], {
    cwd: serverDir,
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

function waitForServer(url, timeoutMs = 10000) {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    function check() {
      const req = http.get(url, (res) => {
        res.resume();

        if (res.statusCode >= 200 && res.statusCode < 500) {
          resolve();
          return;
        }

        retry();
      });

      req.on("error", retry);
      req.setTimeout(1000, () => {
        req.destroy();
        retry();
      });
    }

    function retry() {
      if (Date.now() - startedAt >= timeoutMs) {
        reject(new Error("API server did not become ready in time."));
        return;
      }

      setTimeout(check, 250);
    }

    check();
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
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

app.whenReady().then(async () => {
  ipcMain.handle("auth:google", signInWithGoogle);
  ipcMain.handle("auth:github", signInWithGitHub);
  ipcMain.handle("auth:signout", signOut);
  startServer();

  try {
    await waitForServer("http://127.0.0.1:3000/");
  } catch (error) {
    console.error(error.message);
  }

  createWindow();
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
