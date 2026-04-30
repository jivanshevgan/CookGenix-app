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
    const logPath = path.join(__dirname, "server_logs.txt");
    const token = req.headers.authorization?.split("Bearer ")[1];
    
    if (!token) {
      console.log(`[${new Date().toISOString()}] AUTH_FAIL: Missing token`);
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const decodedToken = await admin.auth().verifyIdToken(token);
      req.user = decodedToken;

      const now = new Date().toISOString();
      const userEmail = decodedToken.email || "no-email";
      const uid = decodedToken.uid;
      
      const userRef = db.collection("users").doc(uid);
      const userDoc = await userRef.get();
      
      if (!userDoc.exists) {
        const newUser = {
          user_id: uid, // Explicit user_id
          uid: uid,
          email: userEmail,
          name: decodedToken.name || userEmail.split('@')[0] || "Unknown",
          createdAt: now,
          lastLogin: now,
          updatedAt: now
        };
        await userRef.set(newUser);
        fs.appendFileSync(logPath, `[now] DATABASE_WRITE: New User Created in Firestore (${userEmail})\n`);
      } else {
        const updateData: any = {
          lastLogin: now,
          email: userEmail,
          updatedAt: now
        };
        if (decodedToken.name) updateData.name = decodedToken.name;
        await userRef.update(updateData);
        fs.appendFileSync(logPath, `[now] DATABASE_WRITE: User Session Updated in Firestore (${userEmail})\n`);
      }

      req.userId = uid; // Set userId for later use
      req.user = decodedToken;
      next();
    } catch (error) {
      fs.appendFileSync(logPath, `[${new Date().toISOString()}] AUTH_ERROR: ${error instanceof Error ? error.message : error}\n`);
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

  // --- Data Persistence Endpoints ---

  app.get("/api/favorites", authenticate, async (req: any, res: any) => {
    try {
      const userId = req.userId;
      const snapshot = await db.collection("recipes")
        .where("user_id", "==", userId)
        .get();
      
      const favorites = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      res.json({ favorites });
    } catch (e) {
      console.error("Fetch favorites error:", e);
      res.status(500).json({ error: "Failed to fetch favorites" });
    }
  });

  app.post("/api/favorites", authenticate, async (req: any, res: any) => {
    try {
      const userId = req.userId;
      const { favorites } = req.body;
      
      // For simplicity in this demo, we replace the entire collection for this user
      // In a real app, you would add/remove individual recipes
      const batch = db.batch();
      
      // Delete old ones
      const oldSnap = await db.collection("recipes").where("user_id", "==", userId).get();
      oldSnap.docs.forEach(doc => batch.delete(doc.ref));
      
      // Add new ones
      favorites.forEach((recipe: any) => {
        const ref = db.collection("recipes").doc();
        batch.set(ref, {
          ...recipe,
          user_id: userId,
          updatedAt: new Date().toISOString()
        });
      });
      
      await batch.commit();

      res.json({ success: true });
    } catch (e) {
      console.error("Save favorites error:", e);
      res.status(500).json({ error: "Failed to save favorites" });
    }
  });

  app.post("/api/feedback", authenticate, async (req: any, res: any) => {
    try {
      const { rating, message } = req.body;
      
      await db.collection("feedback").add({
        user_id: req.userId,
        email: req.user.email,
        rating,
        message,
        timestamp: new Date().toISOString()
      });
      
      res.json({ success: true });
    } catch (e) {
      console.error("Save feedback error:", e);
      res.status(500).json({ error: "Failed to save feedback" });
    }
  });

  // Health
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Export Users for Admin
  app.get("/api/admin/export-users", authenticate, async (req: any, res: any) => {
    // Only allow specific admin email
    if (req.user.email !== "jeevanshevgan13@gmail.com") {
      return res.status(403).json({ error: "Access denied" });
    }
    
    try {
      const snapshot = await db.collection("users").get();
      const users = snapshot.docs.map(doc => doc.data());
      res.json(users);
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // Export Feedback for Admin
  app.get("/api/admin/export-feedback", authenticate, async (req: any, res: any) => {
    // Only allow specific admin email
    if (req.user.email !== "jeevanshevgan13@gmail.com") {
      return res.status(403).json({ error: "Access denied" });
    }

    try {
      const snapshot = await db.collection("feedback").get();
      const feedbacks = snapshot.docs.map(doc => doc.data());
      res.json(feedbacks);
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch feedback" });
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
    const startMsg = `[${new Date().toISOString()}] SYSTEM: Server listening on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode\n`;
    fs.appendFileSync(logPath, startMsg);
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
