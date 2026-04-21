import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import cors from "cors";
import admin from "firebase-admin";
import firebaseConfig from "./firebase-applet-config.json";

dotenv.config();

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const USERS_FILE = path.join(__dirname, "users.json");
const FEEDBACK_FILE = path.join(__dirname, "feedback.json");

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

  app.use(cors({ origin: true, credentials: true })); // Enable CORS
  app.use(express.json());
  app.use(cookieParser());

  const getUsers = () => {
    try {
      if (!fs.existsSync(USERS_FILE)) return [];
      const data = fs.readFileSync(USERS_FILE, "utf-8");
      return JSON.parse(data || "[]");
    } catch (e) {
      console.error("Error reading users:", e);
      return [];
    }
  };

  const saveUsers = (users: any[]) => {
    try {
      fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    } catch (e) {
      console.error("Error saving users:", e);
    }
  };

  const getFeedbacks = () => {
    try {
      if (!fs.existsSync(FEEDBACK_FILE)) return [];
      const data = fs.readFileSync(FEEDBACK_FILE, "utf-8");
      return JSON.parse(data || "[]");
    } catch (e) {
      console.error("Error reading feedback:", e);
      return [];
    }
  };

  const saveFeedbacks = (feedbacks: any[]) => {
    try {
      fs.writeFileSync(FEEDBACK_FILE, JSON.stringify(feedbacks, null, 2));
    } catch (e) {
      console.error("Error saving feedback:", e);
    }
  };

  // Firebase Auth Middleware
  const authenticate = async (req: any, res: any, next: any) => {
    const logPath = path.join(__dirname, "server_logs.txt");
    const token = req.headers.authorization?.split("Bearer ")[1];
    
    if (!token) {
      fs.appendFileSync(logPath, `[${new Date().toISOString()}] AUTH_FAIL: Missing token\n`);
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const decodedToken = await admin.auth().verifyIdToken(token);
      req.user = decodedToken;

      // Auto-track user in users.json
      const users = getUsers();
      const userIndex = users.findIndex((u: any) => u.uid === decodedToken.uid);
      const now = new Date().toISOString();
      
      if (userIndex === -1) {
        const newUser = {
          uid: decodedToken.uid,
          email: decodedToken.email,
          name: decodedToken.name || decodedToken.email?.split('@')[0] || "Unknown",
          favorites: [],
          createdAt: now,
          lastLogin: now
        };
        users.push(newUser);
        saveUsers(users);
        fs.appendFileSync(logPath, `[${now}] NEW_USER_RECORDED: ${decodedToken.email}\n`);
      } else {
        users[userIndex].lastLogin = now;
        if (decodedToken.name && !users[userIndex].name) {
          users[userIndex].name = decodedToken.name;
        }
        saveUsers(users);
        fs.appendFileSync(logPath, `[${now}] USER_CHECKIN: ${decodedToken.email}\n`);
      }

      next();
    } catch (error) {
      fs.appendFileSync(logPath, `[${new Date().toISOString()}] AUTH_ERROR: ${error}\n`);
      console.error("Firebase auth error:", error);
      res.status(401).json({ error: "Invalid session" });
    }
  };

  // --- Auth Endpoints (Deprecated, now handled on client with Firebase) ---
  app.post("/api/auth/logout", (req, res) => {
    res.json({ success: true });
  });

  // --- Data Persistence Endpoints ---

  app.get("/api/favorites", authenticate, (req: any, res: any) => {
    try {
      const uid = req.user.uid;
      const users = getUsers();
      const user = users.find((u: any) => u.uid === uid);
      
      res.json({ favorites: user?.favorites || [] });
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch favorites" });
    }
  });

  app.post("/api/favorites", authenticate, (req: any, res: any) => {
    try {
      const uid = req.user.uid;
      const { favorites } = req.body;
      const users = getUsers();
      let userIndex = users.findIndex((u: any) => u.uid === uid);
      
      if (userIndex === -1) {
        // Create user profile in JSON if it doesn't exist
        const newUser = {
          uid,
          email: req.user.email,
          name: req.user.name || req.user.email,
          favorites: [],
          createdAt: new Date().toISOString()
        };
        users.push(newUser);
        userIndex = users.length - 1;
      }

      users[userIndex].favorites = favorites;
      users[userIndex].updatedAt = new Date().toISOString();
      saveUsers(users);

      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to save favorites" });
    }
  });

  app.post("/api/feedback", authenticate, (req: any, res: any) => {
    try {
      const { rating, message } = req.body;
      const feedbacks = getFeedbacks();
      
      feedbacks.push({
        uid: req.user.uid,
        email: req.user.email,
        rating,
        message,
        timestamp: new Date().toISOString()
      });
      
      saveFeedbacks(feedbacks);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to save feedback" });
    }
  });

  // Health
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // User Ping (Triggers check-in/tracking)
  app.get("/api/auth/ping", authenticate, (req: any, res: any) => {
    res.json({ success: true, user: req.user });
  });

  // Export Users for Admin
  app.get("/api/admin/export-users", authenticate, (req: any, res: any) => {
    // Only allow specific admin email
    if (req.user.email !== "jeevanshevgan13@gmail.com") {
      return res.status(403).json({ error: "Access denied" });
    }
    
    if (fs.existsSync(USERS_FILE)) {
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", "attachment; filename=users.json");
      res.sendFile(USERS_FILE);
    } else {
      res.status(404).send("File not found");
    }
  });

  // Export Feedback for Admin
  app.get("/api/admin/export-feedback", authenticate, (req: any, res: any) => {
    // Only allow specific admin email
    if (req.user.email !== "jeevanshevgan13@gmail.com") {
      return res.status(403).json({ error: "Access denied" });
    }

    if (fs.existsSync(FEEDBACK_FILE)) {
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", "attachment; filename=feedback.json");
      res.sendFile(FEEDBACK_FILE);
    } else {
      res.status(404).send("File not found");
    }
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
