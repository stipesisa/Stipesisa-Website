import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../src/db.js';
import { createApp, ensureAdmin } from '../src/app.js';
import { REPOST_POINTS, WELCOME_POINTS } from '../src/config.js';

let server;
let base;
let db;

before(async () => {
  db = openDatabase(':memory:');
  ensureAdmin(db, { username: 'chef', password: 'chefpass' });
  server = createApp({ db }).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

function client() {
  let cookie = '';
  return async (path, { method = 'GET', body, json = true } = {}) => {
    const res = await fetch(base + path, {
      method,
      headers: { ...(json && method !== 'GET' ? { 'Content-Type': 'application/json' } : {}), cookie },
      body: method === 'GET' ? undefined : json ? JSON.stringify(body ?? {}) : String(body ?? ''),
      redirect: 'manual',
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    const data = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
    return { status: res.status, data, res };
  };
}

test('Registrierung gibt Willkommenspunkte und meldet direkt an', async () => {
  const c = client();
  const r = await c('/api/register', { method: 'POST', body: { username: 'max', password: 'geheim1' } });
  assert.equal(r.status, 201);
  assert.equal(r.data.user.points, WELCOME_POINTS);
  assert.equal(r.data.user.rank.id, 'rookie');
  const me = await c('/api/me');
  assert.equal(me.data.user.username, 'max');
});

test('Benutzername ist eindeutig (ohne Groß/Klein) und wird validiert', async () => {
  const c = client();
  assert.equal((await c('/api/register', { method: 'POST', body: { username: 'MAX', password: 'geheim1' } })).status, 409);
  assert.equal((await c('/api/register', { method: 'POST', body: { username: 'a b', password: 'geheim1' } })).status, 400);
  assert.equal((await c('/api/register', { method: 'POST', body: { username: 'neu', password: '123' } })).status, 400);
});

test('Login nur mit Benutzername und Passwort', async () => {
  const c = client();
  assert.equal((await c('/api/login', { method: 'POST', body: { username: 'max', password: 'falsch' } })).status, 401);
  const ok = await c('/api/login', { method: 'POST', body: { username: 'Max', password: 'geheim1' } });
  assert.equal(ok.status, 200);
  await c('/api/logout', { method: 'POST' });
  assert.equal((await c('/api/me')).status, 401);
});

test('Nicht-JSON-Anfragen werden abgelehnt (CSRF-Schutz)', async () => {
  const c = client();
  const r = await c('/api/login', { method: 'POST', body: 'username=max&password=geheim1', json: false });
  assert.equal(r.status, 415);
});

test('Kunden haben keinen Zugriff auf den Studio-Bereich', async () => {
  const c = client();
  await c('/api/login', { method: 'POST', body: { username: 'max', password: 'geheim1' } });
  assert.equal((await c('/api/admin/overview')).status, 403);
});

test('Punkte sammeln, Rang steigt, Einlösen und Stornieren', async () => {
  const admin = client();
  await admin('/api/login', { method: 'POST', body: { username: 'chef', password: 'chefpass' } });
  const { data: { users } } = await admin('/api/admin/users?q=max');
  const max = users[0];

  const add = await admin(`/api/admin/users/${max.id}/points`, { method: 'POST', body: { delta: 400, reason: 'Haarschnitt' } });
  assert.equal(add.data.user.points, WELCOME_POINTS + 400);
  assert.equal(add.data.user.rank.id, 'silver');

  const c = client();
  await c('/api/login', { method: 'POST', body: { username: 'max', password: 'geheim1' } });
  const { data: { rewards } } = await c('/api/rewards');
  const clay = rewards.find((r) => r.title.includes('Sculpting Clay'));
  const cut = rewards.find((r) => r.title === 'Haarschnitt gratis');

  assert.equal((await c(`/api/rewards/${cut.id}/redeem`, { method: 'POST' })).status, 400);

  const red = await c(`/api/rewards/${clay.id}/redeem`, { method: 'POST' });
  assert.equal(red.status, 201);
  assert.match(red.data.redemption.code, /^SK-[A-Z0-9]{6}$/);
  assert.equal(red.data.user.points, WELCOME_POINTS + 400 - clay.cost);
  assert.equal(red.data.user.rank.id, 'silver', 'Einlösen senkt den Rang nicht');

  const found = await admin(`/api/admin/redemptions?code=${red.data.redemption.code}`);
  assert.equal(found.data.redemptions.length, 1);
  await admin(`/api/admin/redemptions/${red.data.redemption.id}`, { method: 'POST', body: { action: 'cancel' } });
  const me = await c('/api/me');
  assert.equal(me.data.user.points, WELCOME_POINTS + 400);
  assert.equal(me.data.user.lifetimePoints, WELCOME_POINTS + 400, 'Erstattung zählt nicht für den Rang');

  assert.equal((await admin(`/api/admin/redemptions/${red.data.redemption.id}`, { method: 'POST', body: { action: 'done' } })).status, 404);
});

test('Kontostand kann nicht negativ gebucht werden', async () => {
  const admin = client();
  await admin('/api/login', { method: 'POST', body: { username: 'chef', password: 'chefpass' } });
  const { data: { users } } = await admin('/api/admin/users?q=max');
  const r = await admin(`/api/admin/users/${users[0].id}/points`, { method: 'POST', body: { delta: -99999 } });
  assert.equal(r.status, 400);
});

test('Instagram-Repost: melden, Sperre, bestätigen', async () => {
  const c = client();
  await c('/api/register', { method: 'POST', body: { username: 'lena', password: 'geheim2' } });
  assert.equal((await c('/api/reposts', { method: 'POST', body: { instagramName: '' } })).status, 400);
  assert.equal((await c('/api/reposts', { method: 'POST', body: { instagramName: 'lena', link: 'https://evil.com' } })).status, 400);

  const claim = await c('/api/reposts', { method: 'POST', body: { instagramName: '@lena.cuts', link: 'https://www.instagram.com/stories/lena.cuts/1' } });
  assert.equal(claim.status, 201);
  assert.equal(claim.data.repost.pending, true);
  assert.equal((await c('/api/reposts', { method: 'POST', body: { instagramName: 'lena' } })).status, 409);

  const admin = client();
  await admin('/api/login', { method: 'POST', body: { username: 'chef', password: 'chefpass' } });
  const { data: { claims } } = await admin('/api/admin/reposts');
  const mine = claims.find((x) => x.username === 'lena');
  assert.equal(mine.instagramName, 'lena.cuts');
  await admin(`/api/admin/reposts/${mine.id}`, { method: 'POST', body: { action: 'approve' } });
  assert.equal((await admin(`/api/admin/reposts/${mine.id}`, { method: 'POST', body: { action: 'approve' } })).status, 404);

  const me = await c('/api/me');
  assert.equal(me.data.user.points, WELCOME_POINTS + REPOST_POINTS);
  assert.equal(me.data.repost.canClaim, false, 'Nur ein Repost pro Tag');
  assert.equal((await c('/api/reposts', { method: 'POST', body: { instagramName: 'lena' } })).status, 429);
});

test('Rangliste zeigt nur Kunden', async () => {
  const c = client();
  await c('/api/login', { method: 'POST', body: { username: 'max', password: 'geheim1' } });
  const { data } = await c('/api/leaderboard');
  assert.ok(data.leaders.every((l) => l.username !== 'chef'));
  assert.equal(data.leaders[0].username, 'max');
});

test('Admin kann Prämien anlegen und deaktivieren', async () => {
  const admin = client();
  await admin('/api/login', { method: 'POST', body: { username: 'chef', password: 'chefpass' } });
  const created = await admin('/api/admin/rewards', { method: 'POST', body: { title: '10 € Rabatt', cost: 200, category: 'other' } });
  assert.equal(created.status, 201);
  assert.equal((await admin('/api/admin/rewards', { method: 'POST', body: { title: 'x', cost: 5, image: 'javascript:alert(1)' } })).status, 400);
  await admin(`/api/admin/rewards/${created.data.id}`, { method: 'PATCH', body: { active: false } });
  const { data } = await admin('/api/rewards');
  assert.ok(!data.rewards.some((r) => r.id === created.data.id));
});

test('Generierte Medien leiten auf die CDN um, SPA-Routen liefern index.html', async () => {
  const c = client();
  const media = await c('/video/hero.mp4');
  assert.equal(media.status, 302);
  assert.match(media.res.headers.get('location'), /cloudfront\.net/);
  const page = await c('/praemien');
  assert.equal(page.status, 200);
  assert.match(await page.res.text(), /StipezCutz Rewards/);
  assert.equal((await c('/api/unbekannt')).status, 404);
});
