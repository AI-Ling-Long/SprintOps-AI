import { useState, type FormEvent } from "react";

import type { AuthSession, OAuthProvider, SprintOpsBridge } from "@sprintops/contracts";

type AuthScreenProps = {
  auth: SprintOpsBridge["auth"];
  authConfigured: boolean;
  onAuthenticated: (session: AuthSession) => void;
};

const SAFE_AUTH_MESSAGES = [
  "Email or password is incorrect.",
  "Confirm your email address before signing in.",
  "An account already exists for this email address.",
  "Too many authentication attempts. Wait and try again.",
  "Authentication failed. Try again.",
  "Sign-in timed out. Try again.",
  "Supabase authentication is not configured. Add the required environment variables and restart SprintOps.",
];

function userFacingAuthError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  return SAFE_AUTH_MESSAGES.find((candidate) => message.includes(candidate)) ?? "SprintOps could not complete authentication. Try again.";
}

export function AuthScreen({ auth, authConfigured, onAuthenticated }: AuthScreenProps) {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const password = String(form.get("password") ?? "");

    setPendingAction(mode);
    try {
      if (mode === "sign-in") {
        onAuthenticated(await auth.signInWithPassword({ email, password }));
        return;
      }

      const name = String(form.get("name") ?? "").trim();
      const result = await auth.signUp({ name, email, password });
      if (result.session) {
        onAuthenticated(result.session);
      } else {
        setMessage({ text: "Account created. Confirm your email address, then sign in.", error: false });
        setMode("sign-in");
      }
    } catch (error) {
      setMessage({ text: userFacingAuthError(error), error: true });
    } finally {
      setPendingAction(null);
    }
  };

  const signInWithOAuth = async (provider: OAuthProvider) => {
    setMessage(null);
    setPendingAction(provider);
    try {
      onAuthenticated(await auth.signInWithOAuth(provider));
    } catch (error) {
      setMessage({ text: userFacingAuthError(error), error: true });
    } finally {
      setPendingAction(null);
    }
  };

  const isPending = pendingAction !== null;

  return (
    <main className="auth-screen">
      <section className="auth-intro" aria-labelledby="auth-product-title">
        <div className="auth-brand"><div className="brand-mark" aria-hidden="true">S</div><span>SprintOps</span></div>
        <div className="auth-intro-copy">
          <h1 id="auth-product-title">Connect local work to sprint commitments.</h1>
          <p>Plan the sprint, connect development activity, and generate evidence-backed progress and risk insights.</p>
        </div>
        <ul className="auth-principles">
          <li><strong>Desktop-native</strong><span>Explicit access to repositories you choose.</span></li>
          <li><strong>Evidence-backed</strong><span>Every AI finding traces to real sprint activity.</span></li>
          <li><strong>Team-ready</strong><span>Personal and organization workspaces share one model.</span></li>
        </ul>
      </section>

      <section className="auth-panel" aria-labelledby="auth-heading">
        <div className="auth-card">
          <header><h2 id="auth-heading">{mode === "sign-in" ? "Sign in to SprintOps" : "Create your account"}</h2><p>{mode === "sign-in" ? "Continue to your development workspace." : "Start with a personal workspace and invite a team later."}</p></header>

          {!authConfigured ? <div className="form-message form-message-error" role="alert">Supabase authentication is not configured. Add the required environment variables and restart SprintOps.</div> : null}
          {message ? <div className={message.error ? "form-message form-message-error" : "form-message form-message-success"} role={message.error ? "alert" : "status"}>{message.text}</div> : null}

          <form onSubmit={submit} className="auth-form">
            {mode === "sign-up" ? <label htmlFor="name">Name<input id="name" name="name" type="text" autoComplete="name" required maxLength={100} disabled={!authConfigured || isPending} /></label> : null}
            <label htmlFor="email">Email<input id="email" name="email" type="email" autoComplete="email" required disabled={!authConfigured || isPending} /></label>
            <label htmlFor="password">Password<input id="password" name="password" type="password" autoComplete={mode === "sign-in" ? "current-password" : "new-password"} required minLength={6} maxLength={128} disabled={!authConfigured || isPending} /></label>
            <button type="submit" className="primary-button" disabled={!authConfigured || isPending}>{pendingAction === mode ? "Please wait…" : mode === "sign-in" ? "Sign in" : "Create account"}</button>
          </form>

          <div className="auth-divider"><span>or continue with</span></div>
          <div className="oauth-actions">
            <button type="button" className="secondary-button" disabled={!authConfigured || isPending} onClick={() => void signInWithOAuth("github")}>{pendingAction === "github" ? "Waiting for GitHub…" : "GitHub"}</button>
            <button type="button" className="secondary-button" disabled={!authConfigured || isPending} onClick={() => void signInWithOAuth("google")}>{pendingAction === "google" ? "Waiting for Google…" : "Google"}</button>
          </div>

          <p className="auth-switch">{mode === "sign-in" ? "New to SprintOps?" : "Already have an account?"}<button type="button" className="text-button" onClick={() => { setMessage(null); setMode(mode === "sign-in" ? "sign-up" : "sign-in"); }} disabled={isPending}>{mode === "sign-in" ? "Create an account" : "Sign in"}</button></p>
        </div>
      </section>
    </main>
  );
}
