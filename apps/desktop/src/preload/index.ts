import { contextBridge, ipcRenderer } from "electron";

import {
  AuthSessionSchema,
  IPC_CHANNELS,
  OAuthProviderSchema,
  PasswordCredentialsSchema,
  RuntimeInfoSchema,
  SignUpCredentialsSchema,
  SignUpResultSchema,
  type SprintOpsBridge,
} from "@sprintops/contracts";

const bridge: SprintOpsBridge = {
  app: {
    async getRuntimeInfo() {
      return RuntimeInfoSchema.parse(await ipcRenderer.invoke(IPC_CHANNELS.runtimeInfo));
    },
  },
  auth: {
    async getSession() {
      const value: unknown = await ipcRenderer.invoke(IPC_CHANNELS.authSession);
      return value === null ? null : AuthSessionSchema.parse(value);
    },
    async getAccessToken() {
      const value: unknown = await ipcRenderer.invoke(IPC_CHANNELS.authAccessToken);
      if (value !== null && typeof value !== "string") {
        throw new Error("SprintOps received an invalid access token response.");
      }
      return value;
    },
    async signInWithPassword(credentials) {
      const input = PasswordCredentialsSchema.parse(credentials);
      return AuthSessionSchema.parse(await ipcRenderer.invoke(IPC_CHANNELS.authPassword, input));
    },
    async signUp(credentials) {
      const input = SignUpCredentialsSchema.parse(credentials);
      return SignUpResultSchema.parse(await ipcRenderer.invoke(IPC_CHANNELS.authSignUp, input));
    },
    async signInWithOAuth(provider) {
      const input = OAuthProviderSchema.parse(provider);
      return AuthSessionSchema.parse(await ipcRenderer.invoke(IPC_CHANNELS.authOAuth, input));
    },
    async signOut() {
      await ipcRenderer.invoke(IPC_CHANNELS.authSignOut);
    },
  },
};

contextBridge.exposeInMainWorld("sprintOps", bridge);
