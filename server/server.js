import express from "express";
import cors from "cors";
import validator from "validator";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") });

const { isEmail } = validator;

const app = express();
const port = process.env.PORT || 3000;
const hasSupabaseAuth = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
const appBaseUrl = process.env.APP_BASE_URL || `http://127.0.0.1:${port}`;
const emailConfirmationHelp =
  "Turn off email confirmation in Supabase Auth during development, wait for the email rate limit to clear, or configure custom SMTP.";
const supabase = hasSupabaseAuth
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

function publicSupabaseUser(user) {
  const metadata = user.user_metadata || {};

  return {
    id: user.id,
    name: metadata.name || metadata.full_name || user.email?.split("@")[0] || "User",
    email: user.email,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  };
}

function isInvalidCredentialsError(error) {
  const message = String(error?.message || "").toLowerCase();
  const code = String(error?.code || "").toLowerCase();

  return (
    code === "invalid_credentials" ||
    code === "invalid_grant" ||
    message.includes("invalid login credentials") ||
    message.includes("invalid email or password")
  );
}

function isEmailNotConfirmedError(error) {
  const message = String(error?.message || "").toLowerCase();
  const code = String(error?.code || "").toLowerCase();

  return (
    code === "email_not_confirmed" ||
    message.includes("email not confirmed") ||
    message.includes("email_not_confirmed")
  );
}

function isConfirmationEmailError(error) {
  const message = String(error?.message || "").toLowerCase();
  const code = String(error?.code || "").toLowerCase();

  return (
    code === "over_email_send_rate_limit" ||
    message.includes("rate limit") ||
    message.includes("error sending confirmation email") ||
    message.includes("error sending email")
  );
}

function publicPendingSupabaseUser({ name, email }) {
  return {
    id: email,
    name: name || email.split("@")[0],
    email,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function renderAuthResultPage({ title, message, status = "success" }) {
  const accent = status === "success" ? "#2563eb" : "#b91c1c";
  const softAccent = status === "success" ? "#dbeafe" : "#fee2e2";
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle} | SprintOps AI</title>
    <style>
      *, *::before, *::after { box-sizing: border-box; }
      body {
        min-height: 100vh;
        margin: 0;
        display: grid;
        place-items: center;
        padding: 24px;
        font-family: "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
        color: #111827;
        background:
          radial-gradient(circle at top left, rgba(37, 99, 235, 0.14), transparent 34rem),
          linear-gradient(135deg, #f8fafc 0%, #ffffff 62%);
      }
      main {
        width: min(100%, 460px);
        padding: 34px;
        border: 1px solid #e2e8f0;
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.94);
        box-shadow: 0 20px 55px rgba(15, 23, 42, 0.1);
        text-align: center;
      }
      .logo {
        width: 52px;
        height: 52px;
        margin: 0 auto 18px;
        display: grid;
        place-items: center;
        border-radius: 16px;
        background: #111827;
        color: #ffffff;
        font-weight: 800;
      }
      .status {
        width: 46px;
        height: 46px;
        margin: 0 auto 18px;
        display: grid;
        place-items: center;
        border-radius: 999px;
        background: ${softAccent};
        color: ${accent};
        font-size: 24px;
        font-weight: 800;
      }
      h1 {
        margin: 0 0 10px;
        font-size: 1.55rem;
      }
      p {
        margin: 0;
        color: #64748b;
        line-height: 1.55;
      }
      .hint {
        margin-top: 18px;
        padding-top: 18px;
        border-top: 1px solid #e2e8f0;
        font-size: 0.9rem;
      }
    </style>
  </head>
  <body>
    <main>
      <div class="logo">S</div>
      <div class="status">${status === "success" ? "OK" : "!"}</div>
      <h1>${safeTitle}</h1>
      <p>${safeMessage}</p>
      <p class="hint">You can close this browser tab and return to SprintOps AI.</p>
    </main>
  </body>
</html>`;
}

const router = express.Router();

router.get("/", async (_req, res) => {
  res.status(501).json({ error: "Account listing is not available with Supabase client auth." });
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const cleanEmail = String(email).trim().toLowerCase();

    if (!hasSupabaseAuth) {
      return res.status(500).json({ error: "Supabase auth is not configured." });
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: String(password),
    });

    if (!error && data.user) {
      return res.json(publicSupabaseUser(data.user));
    }

    if (error && isEmailNotConfirmedError(error)) {
      return res.status(403).json({
        error: "Email not confirmed. Check your inbox for the confirmation link, then log in again.",
      });
    }

    if (error && !isInvalidCredentialsError(error)) {
      return res.status(401).json({ error: error.message });
    }

    if (error || !data.user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Login failed" });
  }
});

router.get("/:id", async (req, res) => {
  res.status(501).json({ error: "Account lookup is not available with Supabase client auth." });
});

router.post("/", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email, and password are required" });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    if (!isEmail(cleanEmail)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    if (!hasSupabaseAuth) {
      return res.status(500).json({ error: "Supabase auth is not configured." });
    }

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password: String(password),
      options: {
        emailRedirectTo: `${appBaseUrl}/auth/confirmed`,
        data: {
          name: String(name).trim(),
        },
      },
    });

    if (error) {
      if (isConfirmationEmailError(error)) {
        return res.status(429).json({
          error: `Supabase could not send the confirmation email. ${emailConfirmationHelp}`,
        });
      }

      const status = /already|registered/i.test(error.message) ? 409 : 400;
      return res.status(status).json({ error: error.message });
    }

    if (!data.user) {
      return res.status(201).json({
        ...publicPendingSupabaseUser({
          name: String(name).trim(),
          email: cleanEmail,
        }),
        requiresEmailConfirmation: true,
      });
    }

    return res.status(201).json({
      ...publicSupabaseUser(data.user),
      requiresEmailConfirmation: !data.session,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create account" });
  }
});

router.delete("/:id", async (req, res) => {
  res.status(501).json({ error: "Account deletion is not available with Supabase client auth." });
});

app.get("/", (_req, res) => {
  res.send("SprintOps AI API is running");
});

app.get("/auth/confirmed", (req, res) => {
  const error = req.query.error_description || req.query.error;

  if (error) {
    return res
      .status(400)
      .send(renderAuthResultPage({
        title: "Confirmation failed",
        message: String(error),
        status: "error",
      }));
  }

  res.send(renderAuthResultPage({
    title: "Email confirmed",
    message: "Your SprintOps AI account is ready. Return to the app and log in with your email and password.",
  }));
});

app.use("/api/v1/accounts", router);

app.listen(port, "127.0.0.1", () => {
  console.log(`Server running on http://127.0.0.1:${port}`);
});
