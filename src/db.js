import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_REWARDS } from './config.js';

export function openDatabase(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
      points INTEGER NOT NULL DEFAULT 0,
      lifetime_points INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rewards (
      id INTEGER PRIMARY KEY,
      slug TEXT UNIQUE,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT 'product' CHECK (category IN ('product', 'service', 'other')),
      cost INTEGER NOT NULL CHECK (cost > 0),
      image TEXT,
      original_image TEXT,
      video TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      sort INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      delta INTEGER NOT NULL,
      reason TEXT NOT NULL,
      created_by INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS redemptions (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reward_id INTEGER NOT NULL REFERENCES rewards(id),
      reward_title TEXT NOT NULL,
      cost INTEGER NOT NULL,
      code TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done', 'cancelled')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      handled_at TEXT
    );

    CREATE TABLE IF NOT EXISTS repost_claims (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      instagram_name TEXT NOT NULL,
      link TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
      points INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      handled_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_tx_user ON transactions(user_id, id DESC);
    CREATE INDEX IF NOT EXISTS idx_red_user ON redemptions(user_id, id DESC);
    CREATE INDEX IF NOT EXISTS idx_claim_user ON repost_claims(user_id, id DESC);
  `);

  const insertReward = db.prepare(`
    INSERT OR IGNORE INTO rewards (slug, title, description, category, cost, image, original_image, video, sort)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  DEFAULT_REWARDS.forEach((r, i) => {
    insertReward.run(r.slug, r.title, r.description, r.category, r.cost, r.image ?? null, r.original_image ?? null, r.video ?? null, i);
  });

  return db;
}

// Führt fn in einer Transaktion aus und rollt bei Fehlern zurück.
export function transaction(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

// Bucht Punkte und schreibt den Verlauf. Gesammelte Punkte zählen auch für den Rang,
// Rückerstattungen (countsForRank = false) nicht.
export function addPoints(db, userId, delta, reason, createdBy = null, { countsForRank = true } = {}) {
  const rankDelta = countsForRank && delta > 0 ? delta : 0;
  db.prepare(`
    UPDATE users
    SET points = points + ?, lifetime_points = lifetime_points + ?
    WHERE id = ?
  `).run(delta, rankDelta, userId);
  db.prepare('INSERT INTO transactions (user_id, delta, reason, created_by) VALUES (?, ?, ?, ?)')
    .run(userId, delta, reason, createdBy);
}
