import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { addPoints, transaction } from './db.js';
import { MEDIA, MEDIA_CDN } from './media.js';
import {
  EARN_PRESETS,
  INSTAGRAM_HANDLE,
  INSTAGRAM_URL,
  RANKS,
  REPOST_COOLDOWN_HOURS,
  REPOST_POINTS,
  SESSION_DAYS,
  WELCOME_POINTS,
  rankFor,
} from './config.js';

const PUBLIC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const USERNAME_RE = /^[a-zA-Z0-9._-]{3,20}$/;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

function redemptionCode() {
  const bytes = crypto.randomBytes(6);
  let code = '';
  for (const b of bytes) code += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return `SK-${code}`;
}

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    points: user.points,
    lifetimePoints: user.lifetime_points,
    createdAt: user.created_at,
    rank: rankFor(user.lifetime_points),
  };
}

function toInt(value, field) {
  const n = Number(value);
  if (!Number.isInteger(n)) throw new HttpError(400, `${field} muss eine ganze Zahl sein.`);
  return n;
}

function cleanText(value, max) {
  return String(value ?? '').trim().slice(0, max);
}

// Einfache Begrenzung von Login-Versuchen pro IP und Benutzername.
function createLoginLimiter({ max = 10, windowMs = 15 * 60 * 1000 } = {}) {
  const attempts = new Map();
  return {
    check(key) {
      const now = Date.now();
      const entry = attempts.get(key);
      if (!entry || entry.reset < now) return true;
      return entry.count < max;
    },
    fail(key) {
      const now = Date.now();
      const entry = attempts.get(key);
      if (!entry || entry.reset < now) attempts.set(key, { count: 1, reset: now + windowMs });
      else entry.count += 1;
    },
    clear(key) {
      attempts.delete(key);
    },
  };
}

export function ensureAdmin(db, { username = 'admin', password } = {}) {
  const existing = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get();
  if (existing) return null;
  const pw = password || crypto.randomBytes(9).toString('base64url');
  db.prepare("INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'admin')")
    .run(username, bcrypt.hashSync(pw, 10));
  return { username, password: pw, generated: !password };
}

export function createApp({ db, secureCookies = false }) {
  const app = express();
  const limiter = createLoginLimiter();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use((req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Content-Security-Policy': [
        "default-src 'self'",
        `img-src 'self' data: ${MEDIA_CDN}`,
        `media-src 'self' ${MEDIA_CDN}`,
        "style-src 'self' https://fonts.googleapis.com",
        "style-src-attr 'unsafe-inline'",
        "font-src https://fonts.gstatic.com",
        "script-src 'self'",
        "connect-src 'self'",
        "frame-ancestors 'none'",
      ].join('; '),
    });
    next();
  });

  app.use(express.static(PUBLIC_DIR, { maxAge: '1h', index: false }));

  // Noch nicht heruntergeladene Medien direkt von der CDN laden.
  app.get(Object.keys(MEDIA), (req, res) => res.redirect(302, MEDIA[req.path]));

  const api = express.Router();
  api.use(express.json({ limit: '20kb' }));

  // Schreibende Anfragen nur als JSON: Cross-Site-Formulare können so keine Aktionen auslösen.
  api.use((req, res, next) => {
    if (req.method !== 'GET' && !req.is('application/json')) {
      return next(new HttpError(415, 'Erwarte JSON.'));
    }
    next();
  });

  // Sitzung aus dem Cookie laden.
  api.use((req, res, next) => {
    const token = parseCookie(req.headers.cookie, 'sid');
    if (token) {
      const row = db.prepare(`
        SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ? AND s.expires_at > datetime('now')
      `).get(sha256(token));
      if (row) req.user = row;
    }
    next();
  });

  const requireUser = (req, res, next) => (req.user ? next() : next(new HttpError(401, 'Bitte melde dich an.')));
  const requireAdmin = (req, res, next) =>
    req.user?.role === 'admin' ? next() : next(new HttpError(403, 'Nur für das Studio.'));

  function startSession(res, userId) {
    const token = crypto.randomBytes(32).toString('base64url');
    db.prepare(`INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, datetime('now', ?))`)
      .run(sha256(token), userId, `+${SESSION_DAYS} days`);
    db.prepare("DELETE FROM sessions WHERE expires_at <= datetime('now')").run();
    res.cookie('sid', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: secureCookies,
      maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
      path: '/',
    });
  }

  // ---------- Auth ----------

  api.post('/register', (req, res) => {
    const username = cleanText(req.body?.username, 40);
    const password = String(req.body?.password ?? '');
    if (!USERNAME_RE.test(username)) {
      throw new HttpError(400, 'Benutzername: 3–20 Zeichen, nur Buchstaben, Zahlen, Punkt, Unterstrich oder Bindestrich.');
    }
    if (password.length < 6 || password.length > 200) {
      throw new HttpError(400, 'Das Passwort braucht mindestens 6 Zeichen.');
    }
    if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(username)) {
      throw new HttpError(409, 'Dieser Benutzername ist schon vergeben.');
    }
    const hash = bcrypt.hashSync(password, 10);
    const userId = transaction(db, () => {
      const { lastInsertRowid } = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, hash);
      const id = Number(lastInsertRowid);
      if (WELCOME_POINTS > 0) addPoints(db, id, WELCOME_POINTS, 'Willkommensbonus');
      return id;
    });
    startSession(res, userId);
    res.status(201).json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(userId)) });
  });

  api.post('/login', (req, res) => {
    const username = cleanText(req.body?.username, 40);
    const password = String(req.body?.password ?? '');
    const key = `${req.ip}|${username.toLowerCase()}`;
    if (!limiter.check(key)) throw new HttpError(429, 'Zu viele Versuche. Bitte warte ein paar Minuten.');
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      limiter.fail(key);
      throw new HttpError(401, 'Benutzername oder Passwort ist falsch.');
    }
    limiter.clear(key);
    startSession(res, user.id);
    res.json({ user: publicUser(user) });
  });

  api.post('/logout', (req, res) => {
    const token = parseCookie(req.headers.cookie, 'sid');
    if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
    res.clearCookie('sid', { path: '/' });
    res.json({ ok: true });
  });

  // ---------- Kunde ----------

  api.get('/config', (req, res) => {
    res.json({
      instagramUrl: INSTAGRAM_URL,
      instagramHandle: INSTAGRAM_HANDLE,
      repostPoints: REPOST_POINTS,
      repostCooldownHours: REPOST_COOLDOWN_HOURS,
      welcomePoints: WELCOME_POINTS,
      ranks: RANKS,
    });
  });

  api.get('/me', requireUser, (req, res) => {
    res.json({ user: publicUser(req.user), repost: repostStatus(req.user.id) });
  });

  api.post('/me/password', requireUser, (req, res) => {
    const current = String(req.body?.current ?? '');
    const next = String(req.body?.next ?? '');
    if (!bcrypt.compareSync(current, req.user.password_hash)) throw new HttpError(400, 'Aktuelles Passwort ist falsch.');
    if (next.length < 6 || next.length > 200) throw new HttpError(400, 'Das neue Passwort braucht mindestens 6 Zeichen.');
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(next, 10), req.user.id);
    res.json({ ok: true });
  });

  api.get('/me/activity', requireUser, (req, res) => {
    const transactions = db.prepare(
      'SELECT id, delta, reason, created_at AS createdAt FROM transactions WHERE user_id = ? ORDER BY id DESC LIMIT 50',
    ).all(req.user.id);
    const redemptions = db.prepare(`
      SELECT id, reward_title AS title, cost, code, status, created_at AS createdAt, handled_at AS handledAt
      FROM redemptions WHERE user_id = ? ORDER BY id DESC LIMIT 50
    `).all(req.user.id);
    res.json({ transactions, redemptions });
  });

  api.get('/rewards', requireUser, (req, res) => {
    const rewards = db.prepare(`
      SELECT id, title, description, category, cost, image, original_image AS originalImage, video
      FROM rewards WHERE active = 1 ORDER BY sort, cost
    `).all();
    res.json({ rewards });
  });

  api.post('/rewards/:id/redeem', requireUser, (req, res) => {
    const rewardId = toInt(req.params.id, 'id');
    const result = transaction(db, () => {
      const reward = db.prepare('SELECT * FROM rewards WHERE id = ? AND active = 1').get(rewardId);
      if (!reward) throw new HttpError(404, 'Diese Prämie gibt es nicht mehr.');
      const user = db.prepare('SELECT points FROM users WHERE id = ?').get(req.user.id);
      if (user.points < reward.cost) throw new HttpError(400, 'Dafür hast du noch nicht genug Punkte.');
      let code = redemptionCode();
      while (db.prepare('SELECT 1 FROM redemptions WHERE code = ?').get(code)) code = redemptionCode();
      addPoints(db, req.user.id, -reward.cost, `Eingelöst: ${reward.title}`);
      const { lastInsertRowid } = db.prepare(
        'INSERT INTO redemptions (user_id, reward_id, reward_title, cost, code) VALUES (?, ?, ?, ?, ?)',
      ).run(req.user.id, reward.id, reward.title, reward.cost, code);
      return { id: Number(lastInsertRowid), code, title: reward.title, cost: reward.cost };
    });
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    res.status(201).json({ redemption: result, user: publicUser(user) });
  });

  function repostStatus(userId) {
    const last = db.prepare(`
      SELECT id, status, created_at AS createdAt,
        CAST((julianday(created_at, '+${REPOST_COOLDOWN_HOURS} hours') - julianday('now')) * 86400 AS INTEGER) AS waitSeconds
      FROM repost_claims WHERE user_id = ? ORDER BY id DESC LIMIT 1
    `).get(userId);
    if (!last) return { canClaim: true, pending: false, waitSeconds: 0, last: null };
    const pending = last.status === 'pending';
    const waitSeconds = Math.max(0, last.waitSeconds);
    return { canClaim: !pending && waitSeconds === 0, pending, waitSeconds, last: { status: last.status, createdAt: last.createdAt } };
  }

  api.post('/reposts', requireUser, (req, res) => {
    const instagramName = cleanText(req.body?.instagramName, 40).replace(/^@/, '');
    const link = cleanText(req.body?.link, 300);
    if (!/^[a-zA-Z0-9._]{1,30}$/.test(instagramName)) throw new HttpError(400, 'Bitte gib deinen Instagram-Namen an.');
    if (link && !/^https:\/\/(www\.)?instagram\.com\//i.test(link)) {
      throw new HttpError(400, 'Der Link muss mit https://instagram.com/ beginnen.');
    }
    const status = repostStatus(req.user.id);
    if (status.pending) throw new HttpError(409, 'Deine letzte Anfrage wird gerade geprüft.');
    if (!status.canClaim) throw new HttpError(429, 'Du kannst nur einmal pro Tag einen Repost melden.');
    db.prepare('INSERT INTO repost_claims (user_id, instagram_name, link) VALUES (?, ?, ?)').run(req.user.id, instagramName, link);
    res.status(201).json({ repost: repostStatus(req.user.id) });
  });

  api.get('/leaderboard', requireUser, (req, res) => {
    const rows = db.prepare(`
      SELECT username, lifetime_points AS lifetimePoints FROM users
      WHERE role = 'customer' ORDER BY lifetime_points DESC, id ASC LIMIT 10
    `).all();
    res.json({ leaders: rows.map((r) => ({ ...r, rank: rankFor(r.lifetimePoints).id })) });
  });

  // ---------- Admin ----------

  const admin = express.Router();
  admin.use(requireUser, requireAdmin);

  admin.get('/overview', (req, res) => {
    const count = (sql) => db.prepare(sql).get().n;
    res.json({
      customers: count("SELECT COUNT(*) AS n FROM users WHERE role = 'customer'"),
      pendingReposts: count("SELECT COUNT(*) AS n FROM repost_claims WHERE status = 'pending'"),
      openRedemptions: count("SELECT COUNT(*) AS n FROM redemptions WHERE status = 'open'"),
      pointsIssued: count('SELECT COALESCE(SUM(delta), 0) AS n FROM transactions WHERE delta > 0'),
      presets: EARN_PRESETS,
    });
  });

  admin.get('/users', (req, res) => {
    const q = cleanText(req.query.q, 40);
    const users = db.prepare(`
      SELECT * FROM users WHERE role = 'customer' AND username LIKE ? ESCAPE '\\'
      ORDER BY username COLLATE NOCASE LIMIT 50
    `).all(`%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`);
    res.json({ users: users.map(publicUser) });
  });

  admin.post('/users/:id/points', (req, res) => {
    const userId = toInt(req.params.id, 'id');
    const delta = toInt(req.body?.delta, 'Punkte');
    const reason = cleanText(req.body?.reason, 80) || (delta > 0 ? 'Besuch im Studio' : 'Korrektur');
    if (delta === 0 || Math.abs(delta) > 10000) throw new HttpError(400, 'Ungültige Punktzahl.');
    const user = transaction(db, () => {
      const target = db.prepare("SELECT * FROM users WHERE id = ? AND role = 'customer'").get(userId);
      if (!target) throw new HttpError(404, 'Kunde nicht gefunden.');
      if (target.points + delta < 0) throw new HttpError(400, 'Der Kontostand darf nicht negativ werden.');
      addPoints(db, userId, delta, reason, req.user.id);
      return db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    });
    res.json({ user: publicUser(user) });
  });

  admin.get('/reposts', (req, res) => {
    const status = ['pending', 'approved', 'rejected'].includes(req.query.status) ? req.query.status : 'pending';
    const claims = db.prepare(`
      SELECT c.id, c.instagram_name AS instagramName, c.link, c.status, c.points, c.created_at AS createdAt,
        u.username, u.id AS userId
      FROM repost_claims c JOIN users u ON u.id = c.user_id
      WHERE c.status = ? ORDER BY c.id DESC LIMIT 100
    `).all(status);
    res.json({ claims });
  });

  admin.post('/reposts/:id', (req, res) => {
    const id = toInt(req.params.id, 'id');
    const action = req.body?.action;
    if (!['approve', 'reject'].includes(action)) throw new HttpError(400, 'Unbekannte Aktion.');
    transaction(db, () => {
      const claim = db.prepare("SELECT * FROM repost_claims WHERE id = ? AND status = 'pending'").get(id);
      if (!claim) throw new HttpError(404, 'Anfrage wurde schon bearbeitet.');
      const points = action === 'approve' ? REPOST_POINTS : 0;
      db.prepare("UPDATE repost_claims SET status = ?, points = ?, handled_at = datetime('now') WHERE id = ?")
        .run(action === 'approve' ? 'approved' : 'rejected', points, id);
      if (points) addPoints(db, claim.user_id, points, 'Instagram-Repost', req.user.id);
    });
    res.json({ ok: true });
  });

  admin.get('/redemptions', (req, res) => {
    const code = cleanText(req.query.code, 20).toUpperCase();
    const status = ['open', 'done', 'cancelled'].includes(req.query.status) ? req.query.status : 'open';
    const base = `
      SELECT r.id, r.reward_title AS title, r.cost, r.code, r.status, r.created_at AS createdAt,
        r.handled_at AS handledAt, u.username
      FROM redemptions r JOIN users u ON u.id = r.user_id`;
    const redemptions = code
      ? db.prepare(`${base} WHERE r.code LIKE ? ORDER BY r.id DESC LIMIT 20`).all(`%${code.replace(/[%_]/g, '')}%`)
      : db.prepare(`${base} WHERE r.status = ? ORDER BY r.id DESC LIMIT 100`).all(status);
    res.json({ redemptions });
  });

  admin.post('/redemptions/:id', (req, res) => {
    const id = toInt(req.params.id, 'id');
    const action = req.body?.action;
    if (!['done', 'cancel'].includes(action)) throw new HttpError(400, 'Unbekannte Aktion.');
    transaction(db, () => {
      const r = db.prepare("SELECT * FROM redemptions WHERE id = ? AND status = 'open'").get(id);
      if (!r) throw new HttpError(404, 'Einlösung wurde schon bearbeitet.');
      db.prepare("UPDATE redemptions SET status = ?, handled_at = datetime('now') WHERE id = ?")
        .run(action === 'done' ? 'done' : 'cancelled', id);
      if (action === 'cancel') {
        addPoints(db, r.user_id, r.cost, `Erstattet: ${r.reward_title}`, req.user.id, { countsForRank: false });
      }
    });
    res.json({ ok: true });
  });

  admin.get('/rewards', (req, res) => {
    const rewards = db.prepare(`
      SELECT id, title, description, category, cost, image, original_image AS originalImage, video, active
      FROM rewards ORDER BY sort, cost
    `).all();
    res.json({ rewards });
  });

  function rewardFields(body, partial) {
    const out = {};
    if (!partial || body.title !== undefined) {
      out.title = cleanText(body.title, 80);
      if (!out.title) throw new HttpError(400, 'Titel fehlt.');
    }
    if (body.description !== undefined) out.description = cleanText(body.description, 300);
    if (!partial || body.cost !== undefined) {
      out.cost = toInt(body.cost, 'Preis');
      if (out.cost <= 0 || out.cost > 100000) throw new HttpError(400, 'Ungültiger Punktepreis.');
    }
    if (body.category !== undefined) {
      if (!['product', 'service', 'other'].includes(body.category)) throw new HttpError(400, 'Ungültige Kategorie.');
      out.category = body.category;
    }
    for (const key of ['image', 'video']) {
      if (body[key] !== undefined) {
        const v = cleanText(body[key], 300);
        if (v && !/^\/[a-zA-Z0-9/_.-]+$/.test(v)) throw new HttpError(400, `${key}: nur Pfade wie /img/… erlaubt.`);
        out[key] = v || null;
      }
    }
    if (body.active !== undefined) out.active = body.active ? 1 : 0;
    return out;
  }

  admin.post('/rewards', (req, res) => {
    const f = rewardFields(req.body ?? {}, false);
    const { lastInsertRowid } = db.prepare(`
      INSERT INTO rewards (title, description, category, cost, image, video, sort)
      VALUES (?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(sort), 0) + 1 FROM rewards))
    `).run(f.title, f.description ?? '', f.category ?? 'other', f.cost, f.image ?? null, f.video ?? null);
    res.status(201).json({ id: Number(lastInsertRowid) });
  });

  admin.patch('/rewards/:id', (req, res) => {
    const id = toInt(req.params.id, 'id');
    const f = rewardFields(req.body ?? {}, true);
    const keys = Object.keys(f);
    if (!keys.length) throw new HttpError(400, 'Keine Änderungen.');
    const { changes } = db.prepare(`UPDATE rewards SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`)
      .run(...keys.map((k) => f[k]), id);
    if (!changes) throw new HttpError(404, 'Prämie nicht gefunden.');
    res.json({ ok: true });
  });

  api.use('/admin', admin);

  api.use((req, res, next) => next(new HttpError(404, 'Nicht gefunden.')));

  api.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') err = new HttpError(400, 'Ungültige Anfrage.');
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    res.status(status).json({ error: status >= 500 ? 'Serverfehler. Bitte versuche es erneut.' : err.message });
  });

  app.use('/api', api);

  // Single-Page-App: alle anderen GET-Routen liefern index.html.
  app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));

  return app;
}

function parseCookie(header, name) {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}
