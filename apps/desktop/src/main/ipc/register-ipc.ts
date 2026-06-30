import { ipcMain } from "electron";

import {
  IPC_CHANNELS,
  OAuthProviderSchema,
  PasswordCredentialsSchema,
  SignUpCredentialsSchema,
  type RuntimeInfo,
} from "@sprintops/contracts";

import type { AuthController } from "../auth/auth-controller";
import { createValidatedHandler } from "./validated-handler";

export function registerIpcHandlers(auth: AuthController, runtimeInfo: RuntimeInfo): void {
  ipcMain.handle(IPC_CHANNELS.runtimeInfo, async () => runtimeInfo);
  ipcMain.handle(IPC_CHANNELS.authSession, async () => auth.getSession());
  ipcMain.handle(IPC_CHANNELS.authAccessToken, async () => auth.getAccessToken());

  const passwordHandler = createValidatedHandler(PasswordCredentialsSchema, (input) =>
    auth.signInWithPassword(input),
  );
  ipcMain.handle(IPC_CHANNELS.authPassword, (_event, input: unknown) => passwordHandler(input));

  const signUpHandler = createValidatedHandler(SignUpCredentialsSchema, (input) => auth.signUp(input));
  ipcMain.handle(IPC_CHANNELS.authSignUp, (_event, input: unknown) => signUpHandler(input));

  const oauthHandler = createValidatedHandler(OAuthProviderSchema, (input) => auth.signInWithOAuth(input));
  ipcMain.handle(IPC_CHANNELS.authOAuth, (_event, input: unknown) => oauthHandler(input));

  ipcMain.handle(IPC_CHANNELS.authSignOut, async () => auth.signOut());
}
