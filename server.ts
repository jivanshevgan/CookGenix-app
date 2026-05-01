import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import cors from "cors";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import firebaseConfig from "./firebase-applet-config.json";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const USERS_FILE = path.join(__dirname, "users.json");
const FEEDBACK_FILE = path.join(__dirname, "feedback.json");

// Firebase Admin Initialization
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

const db = getFirestore(firebaseConfig.firestoreDatabaseId || "(default)");

async function startServer() {
  const logPath = path.join(__dirname, "server_logs.txt");
  fs.appendFileSync(logPath, `[${new Date().toISOString()}] SYSTEM: Server starting...\n`);
  
  const app = express();
  const PORT = 3000;

  app.use(cors({ origin: true, credentials: true })); // Enable CORS
  app.use(express.json());
  app.use(cookieParser());

  // Firebase Auth Middleware
  const authenticate = async (req: any, res: any, next: any) => {
    const token = req.headers.authorization?.split("Bearer ")[1];
    
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }
 
    try {
      const decodedToken = await admin.auth().verifyIdToken(token);
      req.user = decodedToken;
      req.userId = decodedToken.uid;
      next();
    } catch (error) {
      console.error("Firebase auth error:", error);
      res.status(401).json({ error: "Invalid session" });
    }
  };
 
  // --- Auth Endpoints ---
  app.get("/api/auth/ping", authenticate, (req: any, res: any) => {
    res.json({ success: true, user: req.user });
  });
 
  app.post("/api/auth/logout", (req: any, res: any) => {
    res.json({ success: true });
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
    const startMsg = `[${new Date().toISOString()}] SYSTEM: Server listening on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode\n`;
    fs.appendFileSync(logPath, startMsg);
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
