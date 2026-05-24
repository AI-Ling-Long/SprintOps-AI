const { contextBridge } = require("electron");

const API_BASE = "http://localhost:3000/api/v1";

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
    getUsers: () => request("/users"),
    getUser: (id) => request(`/users/${id}`),
    createUser: (payload) =>
      request("/users", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    deleteUser: (id) =>
      request(`/users/${id}`, {
        method: "DELETE",
      }),
    login: (payload) =>
      request("/users/login", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
  },
});
