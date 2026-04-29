// routes/artisan.js
const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const db = require("../database");
const { requireAuth } = require("../middleware/auth");

router.use(requireAuth);

// ── GET /api/artisan/profile ──
router.get("/profile", (req, res) => {
  const artisan = db
    .prepare(
      `
    SELECT id, email, company, tax_number, address, city, phone, website, lang, plan, created_at
    FROM artisans WHERE id = ?
  `,
    )
    .get(req.artisan.id);

  if (!artisan) return res.status(404).json({ error: "Profil introuvable." });
  res.json({ artisan });
});

// ── PUT /api/artisan/profile ──
router.put("/profile", (req, res) => {
  const { company, tax_number, address, city, phone, website, lang } = req.body;

  db.prepare(
    `
    UPDATE artisans SET
      company    = COALESCE(?, company),
      tax_number = COALESCE(?, tax_number),
      address    = COALESCE(?, address),
      city       = COALESCE(?, city),
      phone      = COALESCE(?, phone),
      website    = COALESCE(?, website),
      lang       = COALESCE(?, lang),
      updated_at = datetime('now')
    WHERE id = ?
  `,
  ).run(
    company,
    tax_number,
    address,
    city,
    phone,
    website,
    lang,
    req.artisan.id,
  );

  res.json({ message: "Profil mis à jour." });
});

module.exports = router;
