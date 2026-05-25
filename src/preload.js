const { contextBridge, ipcRenderer } = require("electron");

const API_BASE = "http://127.0.0.1:3000/api/v1";
const ACCOUNTS_PATH = "/accounts";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const raw = await response.text();
  let data = {};

  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error(
        response.ok
          ? "Unexpected response from server"
          : raw.slice(0, 120) || `Request failed (${response.status})`
      );
    }
  }

  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }

  return data;
}

contextBridge.exposeInMainWorld("jarvis", {
  platform: process.platform,
  api: {
    getUsers: () => request(ACCOUNTS_PATH),
    getUser: (id) => request(`${ACCOUNTS_PATH}/${id}`),
    createUser: (payload) =>
      request(ACCOUNTS_PATH, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    deleteUser: (id) =>
      request(`${ACCOUNTS_PATH}/${id}`, {
        method: "DELETE",
      }),
    login: (payload) =>
      request(`${ACCOUNTS_PATH}/login`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    signInWithGoogle: () => ipcRenderer.invoke("auth:google"),
    signInWithGitHub: () => ipcRenderer.invoke("auth:github"),
    signOut: () => ipcRenderer.invoke("auth:signout"),
  },
});
