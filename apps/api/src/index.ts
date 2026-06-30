import { createDatabase, createPostgresWorkspaceRepository } from "@sprintops/db";
import { createWorkspaceService } from "@sprintops/domain";

import { createApiApp } from "./app.js";
import { loadApiConfig } from "./config.js";
import { createSupabaseAuthVerifier } from "./supabase-auth-verifier.js";
import { secureInvitationTokenIssuer } from "./token-issuer.js";

const config = loadApiConfig();
const { database, pool } = createDatabase(config.databaseUrl);
const workspaceService = createWorkspaceService({ repository: createPostgresWorkspaceRepository(database), tokenIssuer: secureInvitationTokenIssuer });
const app = createApiApp({
  workspaceService,
  authVerifier: createSupabaseAuthVerifier(config.supabaseUrl, config.supabasePublishableKey),
  invitationBaseUrl: config.invitationBaseUrl,
  corsOrigin: config.corsOrigin,
});
app.get("/health", (_request, response) => response.status(200).json({ ok: true }));

const server = app.listen(config.port, config.host, () => console.log(`SprintOps API listening on http://${config.host}:${config.port}`));

async function shutdown() {
  server.close();
  await pool.end();
}
process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
