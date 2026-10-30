const fs = require('node:fs');
const path = require('node:path');
// SQLite embutido no Node (22.13+): não precisa instalar nem compilar nada.
const { DatabaseSync } = require('node:sqlite');

/**
 * Abre (e cria, se preciso) o banco SQLite.
 * Use ':memory:' nos testes para um banco descartável.
 *
 * Valores em dinheiro ficam em CENTAVOS (inteiros) para evitar erros de
 * arredondamento com decimais. A API converte de/para reais.
 */
function openDb(file) {
  if (file !== ':memory:') {
    fs.mkdirSync(path.dirname(file), { recursive: true });
  }
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      unique_id       TEXT    NOT NULL UNIQUE COLLATE NOCASE,
      name            TEXT    NOT NULL,
      description     TEXT    NOT NULL DEFAULT '',
      quantity        INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
      purchase_cents  INTEGER NOT NULL DEFAULT 0 CHECK (purchase_cents >= 0),
      sale_cents      INTEGER NOT NULL DEFAULT 0 CHECK (sale_cents >= 0),
      image           TEXT    NOT NULL DEFAULT '',
      created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
  `);
  return db;
}

module.exports = { openDb };
