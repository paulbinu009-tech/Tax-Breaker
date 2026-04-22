import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import admin from "firebase-admin";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin if Service Account is available
// For this environment, we might not have a service account file, 
// so we'll fallback to a header-based check if needed for demo, 
// but we'll implement the logic properly.
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "paulbinu009@gmail.com").split(",");

const CONFIG_PATH = path.join(__dirname, "tax-config.json");

// Default internal config
const DEFAULT_CONFIG = {
  FY_2024_25: {
    standardDeduction: {
      oldRegime: 50000,
      newRegime: 75000,
    },
    section80C: {
      maxLimit: 150000,
    },
    section80D: {
      under60: 25000,
      over60: 50000,
      parentsUnder60: 25000,
      parentsOver60: 50000,
    },
    section80CCD1B: {
      maxLimit: 50000,
    },
    section24: {
      maxLimit: 200000,
    },
    section87A: {
      oldRegime: {
        rebateMaxAmount: 12500,
        incomeThreshold: 500000,
      },
      newRegime: {
        rebateMaxAmount: 25000,
        incomeThreshold: 700000,
      },
    },
    slabs: {
      oldRegime: [
        { limit: 250000, rate: 0 },
        { limit: 500000, rate: 0.05 },
        { limit: 1000000, rate: 0.20 },
        { limit: Infinity, rate: 0.30 },
      ],
      newRegime: [
        { limit: 300000, rate: 0 },
        { limit: 600000, rate: 0.05 },
        { limit: 1000000, rate: 0.10 },
        { limit: 1200000, rate: 0.15 },
        { limit: 1500000, rate: 0.20 },
        { limit: Infinity, rate: 0.30 },
      ],
    },
    cessRate: 0.04,
  },
  lastUpdated: new Date().toISOString()
};

async function startServer() {
  const app = express();
  app.use(express.json());
  const PORT = 3000;

  // Persistence management
  if (!fs.existsSync(CONFIG_PATH)) {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2));
  }

  // --- API Routes ---

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Fetch Config
  app.get("/api/config", (req, res) => {
    try {
      const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
      res.json(config);
    } catch (error) {
      res.status(500).json({ error: "Failed to read config" });
    }
  });

  // Update Config (Admin only)
  app.post("/api/config", async (req, res) => {
    const authHeader = req.headers.authorization;
    const adminEmail = req.headers["x-admin-email"]; // For demo if token not usable

    // In a real production app, we would verify the Firebase ID Token:
    // const idToken = authHeader?.split("Bearer ")[1];
    // const decodedToken = await admin.auth().verifyIdToken(idToken);
    // const isAuthorized = ADMIN_EMAILS.includes(decodedToken.email);

    const isAuthorized = ADMIN_EMAILS.includes(adminEmail as string);

    if (!isAuthorized) {
      return res.status(403).json({ error: "Access denied. Strategic clearance required." });
    }

    const newConfig = req.body;

    // Basic Validation
    if (!newConfig.FY_2024_25 || !newConfig.FY_2024_25.slabs) {
      return res.status(400).json({ error: "Invalid configuration schema." });
    }

    newConfig.lastUpdated = new Date().toISOString();

    try {
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(newConfig, null, 2));
      res.json({ message: "Configuration localized successfully.", config: newConfig });
    } catch (error) {
      res.status(500).json({ error: "Failed to save configuration." });
    }
  });

  // --- Vite Middleware ---
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
