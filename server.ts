import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import fs from "fs/promises";
import dotenv from "dotenv";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-for-dev";
const DB_PATH = path.join(process.cwd(), "users.json");

// Helper to interact with JSON "database"
async function getDB() {
  try {
    const data = await fs.readFile(DB_PATH, "utf-8");
    return JSON.parse(data);
  } catch (err: any) {
    if (err.code === "ENOENT") {
      // Create fresh DB if file doesn't exist
      const initialDB = { users: [] };
      await fs.writeFile(DB_PATH, JSON.stringify(initialDB, null, 2));
      return initialDB;
    }
    throw err;
  }
}

async function saveDB(data: any) {
  await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2));
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(cookieParser());
  app.use(cors());

  // --- API ROUTES ---

  // Register
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const { name, email, password, phoneNumber } = req.body;

      if (!name || !email || !password) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const db = await getDB();
      
      // Check if user exists
      const existing = db.users.find((u: any) => u.email === email);
      if (existing) {
        return res.status(400).json({ error: "Email already exists" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const userId = Math.random().toString(36).substring(2, 15);

      const newUser = {
        id: userId,
        name,
        email,
        password: hashedPassword,
        phoneNumber,
        photoURL: null,
        createdAt: new Date().toISOString()
      };

      db.users.push(newUser);
      await saveDB(db);

      const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: "7d" });
      res.cookie("token", token, { httpOnly: true, secure: true, sameSite: "strict" });
      
      const { password: _, ...userWithoutPass } = newUser;
      res.json({ user: userWithoutPass, token });
    } catch (err: any) {
      console.error("Signup error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Login
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      const db = await getDB();
      const user = db.users.find((u: any) => u.email === email);

      if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });
      res.cookie("token", token, { httpOnly: true, secure: true, sameSite: "strict" });

      const { password: _, ...userWithoutPass } = user;
      res.json({ user: userWithoutPass, token });
    } catch (err: any) {
      console.error("Login error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Me (Verify token)
  app.get("/api/auth/me", async (req, res) => {
    try {
      const token = req.cookies.token || req.headers.authorization?.split(" ")[1];
      if (!token) return res.status(401).json({ error: "No token" });

      const decoded: any = jwt.verify(token, JWT_SECRET);
      const db = await getDB();
      const user = db.users.find((u: any) => u.id === decoded.userId);

      if (!user) return res.status(401).json({ error: "User not found" });
      
      const { password: _, ...userWithoutPass } = user;
      res.json({ user: userWithoutPass });
    } catch (err) {
      res.status(401).json({ error: "Invalid token" });
    }
  });

  // Social Login Sync (Google/Phone)
  app.post("/api/auth/social-sync", async (req, res) => {
    try {
      const { id, email, name, phoneNumber, photoURL } = req.body;
      if (!id) return res.status(400).json({ error: "Missing ID" });

      const db = await getDB();
      let user = db.users.find((u: any) => u.id === id);

      if (!user) {
        // Create user if they don't exist in our JSON DB
        user = {
          id,
          email,
          name: name || "User",
          password: "SOCIAL_LOGIN_NO_PASSWORD",
          phoneNumber: phoneNumber || null,
          photoURL: photoURL || null,
          createdAt: new Date().toISOString()
        };
        db.users.push(user);
        await saveDB(db);
      }

      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });
      res.cookie("token", token, { httpOnly: true, secure: true, sameSite: "strict" });

      const { password: _, ...userWithoutPass } = user;
      res.json({ user: userWithoutPass, token });
    } catch (err: any) {
      console.error("Social sync error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Logout
  app.post("/api/auth/logout", (req, res) => {
    res.clearCookie("token");
    res.json({ success: true });
  });

  // 2. Vite Middleware Setup
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
