// routes/auth.js
const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../database");

// ── POST /api/auth/register ──
router.post("/register", (req, res) => {
  const { email, password, company, lang } = req.body;

  if (!email || !password || !company) {
    return res.status(400).json({
      error: "Email, mot de passe et nom d'entreprise requis.",
    });
  }

  if (password.length < 8) {
    return res.status(400).json({
      error: "Le mot de passe doit faire au moins 8 caractères.",
    });
  }

  const existing = db
    .prepare("SELECT id FROM artisans WHERE email = ?")
    .get(email);

  if (existing) {
    return res.status(409).json({
      error: "Cet email est déjà utilisé.",
    });
  }

  const hash = bcrypt.hashSync(password, 12);

  const result = db
    .prepare(
      `
    INSERT INTO artisans (email, password, company, lang)
    VALUES (?, ?, ?, ?)
  `,
    )
    .run(email, hash, company, lang || "de");

  const artisan = {
    id: result.lastInsertRowid,
    email,
    company,
  };

  const token = jwt.sign(artisan, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

  res.status(201).json({ message: "Compte créé.", token, artisan });
});

// ── POST /api/auth/login ──
router.post("/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      error: "Email et mot de passe requis.",
    });
  }

  const artisan = db
    .prepare("SELECT * FROM artisans WHERE email = ?")
    .get(email);

  if (!artisan || !bcrypt.compareSync(password, artisan.password)) {
    return res.status(401).json({
      error: "Email ou mot de passe incorrect.",
    });
  }

  const payload = {
    id: artisan.id,
    email: artisan.email,
    company: artisan.company,
  };

  const token = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

  res.json({ message: "Connexion réussie.", token, artisan: payload });
});

// ── GET /api/auth/me ──
router.get("/me", require("../middleware/auth").requireAuth, (req, res) => {
  const artisan = db
    .prepare(
      `
      SELECT id, email, company, tax_number, address, city, phone, lang, plan, created_at 
      FROM artisans WHERE id = ?
    `,
    )
    .get(req.artisan.id);

  res.json({ artisan });
});

module.exports = router;
