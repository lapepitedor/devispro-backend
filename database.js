// database.js
const Database = require("better-sqlite3");
require("dotenv").config();

const dbPath = process.env.DB_PATH || "./devispro.db";
const db = new Database(dbPath);

// Performance
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Créer les tables
db.exec(`
  CREATE TABLE IF NOT EXISTS artisans (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    email       TEXT    NOT NULL UNIQUE,
    password    TEXT    NOT NULL,
    company     TEXT    NOT NULL,
    siret       TEXT,
    address     TEXT,
    city        TEXT,
    phone       TEXT,
    website     TEXT,
    lang        TEXT    DEFAULT 'de',
    plan        TEXT    DEFAULT 'free',
    created_at  TEXT    DEFAULT (datetime('now')),
    updated_at  TEXT    DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS devis (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    artisan_id      INTEGER NOT NULL,
    numero          TEXT    NOT NULL,
    status          TEXT    DEFAULT 'draft',
    lang            TEXT    DEFAULT 'de',
    client_name     TEXT,
    client_email    TEXT,
    client_phone    TEXT,
    client_address  TEXT,
    description     TEXT,
    tva_rate        REAL    DEFAULT 19,
    total_ht        REAL    DEFAULT 0,
    total_tva       REAL    DEFAULT 0,
    total_ttc       REAL    DEFAULT 0,
    created_at      TEXT    DEFAULT (datetime('now')),
    updated_at      TEXT    DEFAULT (datetime('now')),
    sent_at         TEXT,
    valid_until     TEXT,
    FOREIGN KEY (artisan_id) REFERENCES artisans(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS devis_lignes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    devis_id    INTEGER NOT NULL,
    position    INTEGER DEFAULT 0,
    description TEXT,
    quantity    REAL    DEFAULT 1,
    unit_price  REAL    DEFAULT 0,
    total       REAL    DEFAULT 0,
    FOREIGN KEY (devis_id) REFERENCES devis(id) ON DELETE CASCADE
  );
`);

console.log("✅ Database connected:", dbPath);

module.exports = db;
