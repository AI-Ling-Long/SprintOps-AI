import http from "node:http";

import type { SupabaseClient } from "@supabase/supabase-js";
import { shell } from "electron";

import type { OAuthProvider } from "@sprintops/contracts";

const CALLBACK_PATH = "/auth/callback";
const OAUTH_TIMEOUT_MS = 5 * 60 * 1_000;

function renderResultPage(title: string, message: string): string {
  const escape = (value: string) =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title><style>body{display:grid;min-height:100vh;margin:0;place-items:center;background:#f6f7fb;color:#101828;font-family:system-ui,sans-serif}main{max-width:32rem;padding:2rem;text-align:center}p{color:#586174;line-height:1.5}</style></head><body><main><h1>${escape(title)}</h1><p>${escape(message)}</p></main></body></html>`;
}

export async function runOAuthFlow(
  supabase: SupabaseClient,
  provider: OAuthProvider,
  callbackPort: number,
) {
  const callbackUrl = `http://127.0.0.1:${callbackPort}${CALLBACK_PATH}`;

  return new Promise<Awaited<ReturnType<typeof supabase.auth.exchangeCodeForSession>>>((resolve, reject) => {
    let settled = false;
    const settle = (
      operation: () => void,
      server: http.Server,
      timeout: NodeJS.Timeout,
    ) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      server.close();
      operation();
    };

    const server = http.createServer(async (request, response) => {
      const url = new URL(request.url ?? "/", callbackUrl);
      if (url.pathname !== CALLBACK_PATH) {
        response.writeHead(404).end("Not found");
        return;
      }

      try {
        const providerError = url.searchParams.get("error_description") ?? url.searchParams.get("error");
        if (providerError) throw new Error("The provider did not complete sign-in.");

        const code = url.searchParams.get("code");
        if (!code) throw new Error("The provider did not return an authorization code.");

        const exchange = await supabase.auth.exchangeCodeForSession(code);
        if (exchange.error) throw exchange.error;
        response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        response.end(renderResultPage("Signed in", "Return to SprintOps to continue."));
        settle(() => resolve(exchange), server, timeout);
      } catch (error) {
        response.writeHead(400, { "content-type": "text/html; charset=utf-8" });
        response.end(renderResultPage("Sign-in failed", "Return to SprintOps and try again."));
        settle(() => reject(error), server, timeout);
      }
    });

    const timeout = setTimeout(() => {
      settle(() => reject(new Error("Sign-in timed out. Try again.")), server, timeout);
    }, OAUTH_TIMEOUT_MS);

    server.once("error", (error) => settle(() => reject(error), server, timeout));
    server.listen(callbackPort, "127.0.0.1", async () => {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: callbackUrl,
          skipBrowserRedirect: true,
          scopes: provider === "github" ? "read:user user:email" : undefined,
        },
      });

      if (error || !data.url) {
        settle(
          () => reject(error ?? new Error("The provider did not return a sign-in URL.")),
          server,
          timeout,
        );
        return;
      }

      try {
        await shell.openExternal(data.url);
      } catch (openError) {
        settle(() => reject(openError), server, timeout);
      }
    });
  });
}
