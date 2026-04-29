// routes/devis.js
const express = require("express");
const router = express.Router();
const db = require("../database");
const { requireAuth } = require("../middleware/auth");

router.use(requireAuth);

// ── Générer un numéro unique ──
function generateNumber(lang) {
  const prefix = lang === "fr" ? "DEV" : lang === "en" ? "QUO" : "ANG";
  const year = new Date().getFullYear();
  const rand = String(Math.floor(Math.random() * 9000) + 1000);
  return `${prefix}-${year}-${rand}`;
}

// ── Calculer les totaux ──
function calcTotaux(lignes, tvaRate) {
  const totalHT = lignes.reduce((s, l) => s + l.quantity * l.unit_price, 0);
  const totalTVA = totalHT * (tvaRate / 100);
  const totalTTC = totalHT + totalTVA;
  return { totalHT, totalTVA, totalTTC };
}

// ── GET /api/devis ── Liste tous les devis
router.get("/", (req, res) => {
  const { status, limit = 50, offset = 0 } = req.query;

  let query = "SELECT * FROM devis WHERE artisan_id = ?";
  const params = [req.artisan.id];

  if (status) {
    query += " AND status = ?";
    params.push(status);
  }

  query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
  params.push(Number(limit), Number(offset));

  const devisList = db.prepare(query).all(...params);
  const total = db
    .prepare("SELECT COUNT(*) as count FROM devis WHERE artisan_id = ?")
    .get(req.artisan.id).count;

  res.json({ devis: devisList, total });
});

// ── GET /api/devis/stats/summary ── Statistiques
router.get("/stats/summary", (req, res) => {
  const id = req.artisan.id;
  const stats = {
    total: db
      .prepare("SELECT COUNT(*) as c FROM devis WHERE artisan_id = ?")
      .get(id).c,
    draft: db
      .prepare(
        "SELECT COUNT(*) as c FROM devis WHERE artisan_id = ? AND status='draft'",
      )
      .get(id).c,
    sent: db
      .prepare(
        "SELECT COUNT(*) as c FROM devis WHERE artisan_id = ? AND status='sent'",
      )
      .get(id).c,
    accepted: db
      .prepare(
        "SELECT COUNT(*) as c FROM devis WHERE artisan_id = ? AND status='accepted'",
      )
      .get(id).c,
    revenue: db
      .prepare(
        "SELECT COALESCE(SUM(total_ttc),0) as s FROM devis WHERE artisan_id = ? AND status='accepted'",
      )
      .get(id).s,
  };
  res.json({ stats });
});

// ── GET /api/devis/:id ── Un devis avec ses lignes
router.get("/:id", (req, res) => {
  const devis = db
    .prepare("SELECT * FROM devis WHERE id = ? AND artisan_id = ?")
    .get(req.params.id, req.artisan.id);

  if (!devis) return res.status(404).json({ error: "Devis introuvable." });

  const lignes = db
    .prepare("SELECT * FROM devis_lignes WHERE devis_id = ? ORDER BY position")
    .all(devis.id);

  res.json({ devis, lignes });
});

// ── POST /api/devis ── Créer un devis
router.post("/", (req, res) => {
  const {
    client_name,
    client_email,
    client_phone,
    client_address,
    description,
    tva_rate = 19,
    lang = "de",
    lignes = [],
  } = req.body;

  const numero = generateNumber(lang);
  const validUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];
  const { totalHT, totalTVA, totalTTC } = calcTotaux(lignes, tva_rate);

  const insertLigne = db.prepare(`
    INSERT INTO devis_lignes (devis_id, position, description, quantity, unit_price, total)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction(() => {
    const result = db
      .prepare(
        `
      INSERT INTO devis (
        artisan_id, numero, lang, client_name, client_email,
        client_phone, client_address, description, tva_rate,
        total_ht, total_tva, total_ttc, valid_until
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .run(
        req.artisan.id,
        numero,
        lang,
        client_name,
        client_email,
        client_phone,
        client_address,
        description,
        tva_rate,
        totalHT,
        totalTVA,
        totalTTC,
        validUntil,
      );

    lignes.forEach((l, i) => {
      insertLigne.run(
        result.lastInsertRowid,
        i,
        l.description,
        l.quantity,
        l.unit_price,
        l.quantity * l.unit_price,
      );
    });

    return result.lastInsertRowid;
  });

  try {
    const devisId = transaction();
    const created = db.prepare("SELECT * FROM devis WHERE id = ?").get(devisId);
    const createdLignes = db
      .prepare(
        "SELECT * FROM devis_lignes WHERE devis_id = ? ORDER BY position",
      )
      .all(devisId);
    res.status(201).json({ devis: created, lignes: createdLignes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur lors de la création." });
  }
});

// ── PUT /api/devis/:id ── Modifier un devis
router.put("/:id", (req, res) => {
  const devis = db
    .prepare("SELECT * FROM devis WHERE id = ? AND artisan_id = ?")
    .get(req.params.id, req.artisan.id);

  if (!devis) return res.status(404).json({ error: "Devis introuvable." });
  if (devis.status === "accepted")
    return res.status(400).json({
      error: "Un devis accepté ne peut plus être modifié.",
    });

  const {
    client_name,
    client_email,
    client_phone,
    client_address,
    description,
    tva_rate,
    status,
    lignes,
  } = req.body;

  const newTvaRate = tva_rate ?? devis.tva_rate;
  const allLignes =
    lignes ||
    db.prepare("SELECT * FROM devis_lignes WHERE devis_id = ?").all(devis.id);
  const { totalHT, totalTVA, totalTTC } = calcTotaux(allLignes, newTvaRate);

  const transaction = db.transaction(() => {
    db.prepare(
      `
      UPDATE devis SET
        client_name = ?, client_email = ?, client_phone = ?,
        client_address = ?, description = ?, tva_rate = ?,
        total_ht = ?, total_tva = ?, total_ttc = ?,
        status = ?, updated_at = datetime('now')
      WHERE id = ?
    `,
    ).run(
      client_name ?? devis.client_name,
      client_email ?? devis.client_email,
      client_phone ?? devis.client_phone,
      client_address ?? devis.client_address,
      description ?? devis.description,
      newTvaRate,
      totalHT,
      totalTVA,
      totalTTC,
      status ?? devis.status,
      devis.id,
    );

    if (lignes) {
      db.prepare("DELETE FROM devis_lignes WHERE devis_id = ?").run(devis.id);
      const insertLigne = db.prepare(`
        INSERT INTO devis_lignes (devis_id, position, description, quantity, unit_price, total)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      lignes.forEach((l, i) => {
        insertLigne.run(
          devis.id,
          i,
          l.description,
          l.quantity,
          l.unit_price,
          l.quantity * l.unit_price,
        );
      });
    }
  });

  try {
    transaction();
    const updated = db
      .prepare("SELECT * FROM devis WHERE id = ?")
      .get(devis.id);
    const updatedLignes = db
      .prepare(
        "SELECT * FROM devis_lignes WHERE devis_id = ? ORDER BY position",
      )
      .all(devis.id);
    res.json({ devis: updated, lignes: updatedLignes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur lors de la mise à jour." });
  }
});

// ── PATCH /api/devis/:id/status ── Changer le statut
router.patch("/:id/status", (req, res) => {
  const { status } = req.body;
  const allowed = ["draft", "sent", "accepted", "declined"];

  if (!allowed.includes(status)) {
    return res.status(400).json({
      error: `Statut invalide. Valeurs acceptées: ${allowed.join(", ")}`,
    });
  }

  const devis = db
    .prepare("SELECT * FROM devis WHERE id = ? AND artisan_id = ?")
    .get(req.params.id, req.artisan.id);

  if (!devis) return res.status(404).json({ error: "Devis introuvable." });

  db.prepare(
    `
    UPDATE devis SET 
      status = ?, 
      updated_at = datetime('now')
    WHERE id = ?
  `,
  ).run(status, devis.id);

  res.json({ message: `Statut mis à jour : ${status}` });
});

// ── DELETE /api/devis/:id ── Supprimer
router.delete("/:id", (req, res) => {
  const devis = db
    .prepare("SELECT * FROM devis WHERE id = ? AND artisan_id = ?")
    .get(req.params.id, req.artisan.id);

  if (!devis) return res.status(404).json({ error: "Devis introuvable." });

  db.prepare("DELETE FROM devis WHERE id = ?").run(devis.id);
  res.json({ message: "Devis supprimé." });
});

module.exports = router;
