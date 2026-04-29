// server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");

// Initialiser la DB au démarrage
require("./database");

const app = express();

// ── Middleware ──
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Routes ──
app.use("/api/auth", require("./routes/auth"));
app.use("/api/devis", require("./routes/devis"));
app.use("/api/artisan", require("./routes/artisan"));

// ── Health check ──
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "DevisPro API is running 🚀",
    timestamp: new Date().toISOString(),
  });
});

// ── 404 ──
app.use((req, res) => {
  res.status(404).json({
    error: `Route ${req.method} ${req.path} introuvable.`,
  });
});

// ── Erreurs ──
app.use((err, req, res, next) => {
  console.error("Erreur:", err.message);
  res.status(500).json({ error: "Erreur serveur interne." });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 DevisPro API → http://localhost:${PORT}`);
  console.log(`❤️  Health check → http://localhost:${PORT}/api/health`);
});
