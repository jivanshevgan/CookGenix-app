import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const USERS_FILE = path.join(__dirname, "users.json");
const FEEDBACK_FILE = path.join(__dirname, "feedback.json");
const JWT_SECRET = process.env.JWT_SECRET || "cookgenix-secret-key-2026";

// Initialize files
if (!fs.existsSync(USERS_FILE)) {
  fs.writeFileSync(USERS_FILE, JSON.stringify([]));
}
if (!fs.existsSync(FEEDBACK_FILE)) {
  fs.writeFileSync(FEEDBACK_FILE, JSON.stringify([]));
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(cookieParser());

  const getUsers = () => {
    try {
      const data = fs.readFileSync(USERS_FILE, "utf-8");
      return JSON.parse(data);
    } catch (e) {
      return [];
    }
  };

  const saveUsers = (users: any[]) => {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  };

  // --- Auth Endpoints ---

  app.post("/api/auth/signup", async (req: any, res: any) => {
    try {
      const { name, email, password } = req.body;

      if (!name || !email || !password) {
        return res.status(400).json({ error: "Please fill all fields" });
      }

      const users = getUsers();
      if (users.find((u: any) => u.email === email)) {
        return res.status(400).json({ error: "Email already in use" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = {
        uid: Math.random().toString(36).substring(2, 15),
        name,
        email,
        password: hashedPassword,
        createdAt: new Date().toISOString()
      };

      users.push(newUser);
      saveUsers(users);

      if (!JWT_SECRET) {
        console.error("JWT_SECRET is missing!");
        return res.status(500).json({ error: "Server configuration error" });
      }

      const token = jwt.sign({ uid: newUser.uid, email: newUser.email }, JWT_SECRET, { expiresIn: "7d" });
      res.cookie("auth_token", token, { 
        httpOnly: true, 
        secure: true, // Use secure on mobile for cross-site cookies
        sameSite: "none", // Allow cross-site for preview environments
        maxAge: 7 * 24 * 60 * 60 * 1000 
      });

      const { password: _, ...userWithoutPassword } = newUser;
      res.json({ user: userWithoutPassword, token });
    } catch (error) {
      console.error("Signup error:", error);
      res.status(500).json({ error: "An unexpected error occurred during signup" });
    }
  });

  app.post("/api/auth/login", async (req: any, res: any) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }

      const users = getUsers();
      const user = users.find((u: any) => u.email === email);

      if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      if (!JWT_SECRET) {
        console.error("JWT_SECRET is missing!");
        return res.status(500).json({ error: "Server configuration error" });
      }

      const token = jwt.sign({ uid: user.uid, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
      res.cookie("auth_token", token, { 
        httpOnly: true, 
        secure: true, 
        sameSite: "none",
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      const { password: _, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword, token });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "An unexpected error occurred during login" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    res.clearCookie("auth_token");
    res.json({ success: true });
  });

  app.get("/api/auth/me", (req: any, res: any) => {
    const token = req.cookies.auth_token || req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      const users = getUsers();
      const user = users.find((u: any) => u.uid === decoded.uid);
      
      if (!user) return res.status(404).json({ error: "User not found" });

      const { password: _, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword });
    } catch (e) {
      res.status(401).json({ error: "Invalid session" });
    }
  });

  // --- Data Persistence Endpoints ---

  app.get("/api/favorites", (req: any, res: any) => {
    const token = req.cookies.auth_token || req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      const users = getUsers();
      const user = users.find((u: any) => u.uid === decoded.uid);
      
      if (!user) return res.status(404).json({ error: "User not found" });

      res.json({ favorites: user.favorites || [] });
    } catch (e) {
      res.status(401).json({ error: "Invalid session" });
    }
  });

  app.post("/api/favorites", (req: any, res: any) => {
    const token = req.cookies.auth_token || req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      const { favorites } = req.body;
      const users = getUsers();
      const userIndex = users.findIndex((u: any) => u.uid === decoded.uid);
      
      if (userIndex === -1) return res.status(404).json({ error: "User not found" });

      users[userIndex].favorites = favorites;
      users[userIndex].updatedAt = new Date().toISOString();
      saveUsers(users);

      res.json({ success: true });
    } catch (e) {
      res.status(401).json({ error: "Invalid session" });
    }
  });

  app.post("/api/feedback", (req: any, res: any) => {
    const token = req.cookies.auth_token || req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      const { rating, message } = req.body;
      
      const rawFeedback = fs.readFileSync(FEEDBACK_FILE, "utf-8");
      const feedbacks = JSON.parse(rawFeedback);
      
      feedbacks.push({
        uid: decoded.uid,
        email: decoded.email,
        rating,
        message,
        timestamp: new Date().toISOString()
      });
      
      fs.writeFileSync(FEEDBACK_FILE, JSON.stringify(feedbacks, null, 2));
      res.json({ success: true });
    } catch (e) {
      res.status(401).json({ error: "Invalid session" });
    }
  });

  // Health
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
