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

  const data = await response.json().catch(() => ({}));

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
