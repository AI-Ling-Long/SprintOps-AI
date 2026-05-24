import express from "express";
import cors from "cors";
import { isEmail } from "validator";
import { scryptSync, randomBytes, timingSafeEqual } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "./db.js";
import { users } from "./schema.js";

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) return false;

  const candidate = scryptSync(password, salt, 64).toString("hex");
  const hashBuffer = Buffer.from(hash, "hex");
  const candidateBuffer = Buffer.from(candidate, "hex");

  if (hashBuffer.length !== candidateBuffer.length) return false;
  return timingSafeEqual(hashBuffer, candidateBuffer);
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

const router = express.Router();

router.get("/", async (_req, res) => {
  try {
    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users);

    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, String(email).trim().toLowerCase()));

    if (!user || !verifyPassword(String(password), user.passwordHash)) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    res.json(publicUser(user));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Login failed" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "Invalid user id" });
    }

    const [user] = await db.select().from(users).where(eq(users.id, id));
    if (!user) return res.status(404).json({ error: "User not found" });

    res.json(publicUser(user));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch user" });
  }
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

    const [created] = await db
      .insert(users)
      .values({
        name: String(name).trim(),
        email: cleanEmail,
        passwordHash: hashPassword(String(password)),
      })
      .returning();

    res.status(201).json(publicUser(created));
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ error: "Email already exists" });
    }

    console.error(error);
    res.status(500).json({ error: "Failed to create user" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "Invalid user id" });
    }

    const [deleted] = await db.delete(users).where(eq(users.id, id)).returning();
    if (!deleted) return res.status(404).json({ error: "User not found" });

    res.json({ message: "User deleted", user: publicUser(deleted) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

app.get("/", (_req, res) => {
  res.send("Jarvis API is running");
});

app.use("/api/v1/users", router);

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
