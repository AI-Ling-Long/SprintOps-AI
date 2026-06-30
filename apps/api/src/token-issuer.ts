import { createHash, randomBytes } from "node:crypto";
import type { TokenIssuer } from "@sprintops/domain";

function hash(token: string): string { return createHash("sha256").update(token, "utf8").digest("hex"); }

export const secureInvitationTokenIssuer: TokenIssuer = {
  issue() { const token = randomBytes(32).toString("base64url"); return { token, hash: hash(token) }; },
  issueHash: hash,
};
