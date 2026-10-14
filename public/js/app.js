// StipezCutz Rewards – Single-Page-App ohne Build-Schritt.

const state = { user: null, config: null, repost: null, rewards: null, filter: 'all' };
const app = document.getElementById('app');

// ---------- Helpers ----------

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fmt = (n) => new Intl.NumberFormat('de-DE').format(n);
const date = (s) => new Date(s.replace(' ', 'T') + 'Z').toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
const badge = (rankId) => `/img/ranks/${rankId}.png`;
const rankById = (id) => state.config.ranks.find((r) => r.id === id);

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body !== undefined || method !== 'GET' ? { 'Content-Type': 'application/json' } : {},
    body: method !== 'GET' ? JSON.stringify(body ?? {}) : undefined,
    credentials: 'same-origin',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Etwas ist schiefgelaufen.');
    err.status = res.status;
    throw err;
  }
  return data;
}

function toast(message, type = 'ok') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  document.getElementById('toasts').append(el);
  setTimeout(() => el.remove(), 3200);
}

const icons = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg>',
  gift: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5"/></svg>',
  crown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m3 7 4.5 4L12 4l4.5 7L21 7l-2 12H5z"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/></svg>',
  ig: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4v16l13-8z"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5L20 7"/></svg>',
};

// ---------- Router ----------

const routes = {
  '/': renderHome,
  '/praemien': renderRewards,
  '/raenge': renderRanks,
  '/profil': renderProfile,
  '/studio': renderAdmin,
};

function navigate(path, replace = false) {
  if (replace) history.replaceState(null, '', path);
  else history.pushState(null, '', path);
  render();
}

window.addEventListener('popstate', render);
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-link]');
  if (!a || e.metaKey || e.ctrlKey) return;
  e.preventDefault();
  navigate(a.getAttribute('href'));
});

async function render() {
  if (!state.user) return renderAuth();
  let path = location.pathname;
  if (!routes[path] || (path === '/studio' && state.user.role !== 'admin')) {
    path = '/';
    history.replaceState(null, '', '/');
  }
  renderShell(path);
  const main = document.getElementById('main');
  main.innerHTML = '<div class="spinner"></div>';
  try {
    await routes[path](main);
  } catch (err) {
    if (err.status === 401) return logoutLocal();
    main.innerHTML = `<div class="empty">${esc(err.message)}</div>`;
  }
  window.scrollTo({ top: 0 });
}

// ---------- Auth ----------

function renderAuth(mode = 'login') {
  const ranks = state.config.ranks.map((r) => `<img src="${badge(r.id)}" alt="${esc(r.name)}">`).join('');
  app.innerHTML = `
    <section class="auth">
      <div class="auth-media" aria-hidden="true">
        <video src="/video/hero.mp4" poster="/img/hero.png" autoplay muted loop playsinline></video>
      </div>
      <div class="auth-inner">
        <img class="auth-logo" src="/img/logo-gold.png" alt="StipezCutz">
        <div>
          <p class="eyebrow">StipezCutz Rewards</p>
          <h1>Sammle Punkte.<br>Gönn dir was.</h1>
          <p class="muted">Bei jedem Besuch und für jeden Repost Punkte sammeln – und gegen Produkte oder Services einlösen.</p>
        </div>
        <div class="auth-card">
          <div class="tabs" role="tablist">
            <button role="tab" aria-selected="${mode === 'login'}" data-mode="login">Anmelden</button>
            <button role="tab" aria-selected="${mode === 'register'}" data-mode="register">Registrieren</button>
          </div>
          <form class="form" id="auth-form" autocomplete="on">
            <div class="field">
              <label for="username">Benutzername</label>
              <input class="input" id="username" name="username" required minlength="3" maxlength="20"
                autocomplete="username" autocapitalize="none" spellcheck="false">
            </div>
            <div class="field">
              <label for="password">Passwort</label>
              <input class="input" id="password" name="password" type="password" required minlength="6"
                autocomplete="${mode === 'login' ? 'current-password' : 'new-password'}">
            </div>
            <p class="form-error" id="auth-error"></p>
            <button class="btn btn-gold btn-block" type="submit">${mode === 'login' ? 'Anmelden' : `Konto erstellen · +${state.config.welcomePoints} Punkte`}</button>
          </form>
        </div>
        <div class="auth-ranks">${ranks}</div>
      </div>
    </section>`;

  app.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => renderAuth(b.dataset.mode)));
  app.querySelector('#auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      const data = await api(mode === 'login' ? '/login' : '/register', {
        method: 'POST',
        body: { username: form.username.value.trim(), password: form.password.value },
      });
      state.user = data.user;
      if (mode === 'register') toast(`Willkommen! +${state.config.welcomePoints} Punkte gutgeschrieben.`);
      navigate('/', true);
    } catch (err) {
      form.querySelector('#auth-error').textContent = err.message;
      btn.disabled = false;
    }
  });
}

function logoutLocal() {
  state.user = null;
  state.rewards = null;
  history.replaceState(null, '', '/');
  renderAuth();
}

// ---------- Shell ----------

function renderShell(path) {
  const u = state.user;
  const items = [
    ['/', 'Start', icons.home],
    ['/praemien', 'Prämien', icons.gift],
    ['/raenge', 'Ränge', icons.crown],
    ['/profil', 'Profil', icons.user],
  ];
  if (u.role === 'admin') items.push(['/studio', 'Studio', icons.shield]);
  const link = ([href, label, icon], withIcon) =>
    `<a href="${href}" data-link class="${href === path ? 'active' : ''}">${withIcon ? icon : ''}${label}</a>`;

  app.innerHTML = `
    <header class="topbar">
      <a class="brand" href="/" data-link><img src="/img/logo-gold.png" alt=""><span>StipezCutz</span></a>
      <nav class="topnav">${items.map((i) => link(i, false)).join('')}</nav>
      ${u.role === 'admin' ? '' : `<a class="points-pill" href="/raenge" data-link title="${esc(u.rank.name)}">
        <img src="${badge(u.rank.id)}" alt="${esc(u.rank.name)}">
        <span><strong class="num" id="pill-points">${fmt(u.points)}</strong> <small>Punkte</small></span>
      </a>`}
    </header>
    <main id="main"></main>
    <nav class="bottomnav">${items.map((i) => link(i, true)).join('')}</nav>`;
}

function updatePoints(user) {
  state.user = user;
  const pill = document.getElementById('pill-points');
  if (pill) pill.textContent = fmt(user.points);
}

// ---------- Start ----------

function statusCard(u) {
  const r = u.rank;
  const toNext = r.next ? r.next.min - u.lifetimePoints : 0;
  return `
    <section class="status" style="--rank:${r.color}">
      <img class="status-badge" src="${badge(r.id)}" alt="Rang ${esc(r.name)}">
      <div>
        <p class="eyebrow">Hey ${esc(u.username)}</p>
        <div class="status-rank">${esc(r.name)}</div>
        <div class="status-points num">${fmt(u.points)} <small>Punkte verfügbar</small></div>
      </div>
      <div class="progress">
        <div class="bar"><span data-width="${Math.round(r.progress * 100)}%"></span></div>
        <div class="progress-meta">
          <span>${fmt(u.lifetimePoints)} gesammelt</span>
          <span>${r.next ? `noch ${fmt(toNext)} bis ${esc(r.next.name)}` : 'Höchster Rang erreicht'}</span>
        </div>
      </div>
    </section>`;
}

function animateBars(root) {
  requestAnimationFrame(() => root.querySelectorAll('.bar span[data-width]').forEach((s) => { s.style.width = s.dataset.width; }));
}

function instagramCard() {
  const c = state.config;
  const r = state.repost;
  let status = '';
  if (r?.pending) status = '<div class="notice warn">⏳ Dein Repost wird gerade vom Studio geprüft.</div>';
  else if (r && !r.canClaim) {
    const h = Math.ceil(r.waitSeconds / 3600);
    const ok = r.last?.status === 'approved';
    status = `<div class="notice ${ok ? 'ok' : 'warn'}">${ok ? `✓ +${c.repostPoints} Punkte für deinen letzten Repost.` : 'Deine letzte Anfrage wurde abgelehnt.'} Nächster Repost in ca. ${h} Std.</div>`;
  } else if (r?.last?.status === 'approved') {
    status = `<div class="notice ok">✓ Letzter Repost bestätigt – du kannst wieder punkten.</div>`;
  }
  return `
    <section class="ig">
      <div class="ig-head">
        <div class="ig-icon">${icons.ig}</div>
        <div>
          <h3>Repost = +${c.repostPoints} Punkte</h3>
          <p class="muted small">Folge ${esc(c.instagramHandle)} und teile einen Beitrag in deiner Story.</p>
        </div>
      </div>
      <ol class="ig-steps">
        <li>Öffne unsere Instagram-Seite per Knopfdruck.</li>
        <li>Teile einen Beitrag oder Reel in deiner Story und markiere ${esc(c.instagramHandle)}.</li>
        <li>Melde den Repost hier – nach Prüfung bekommst du die Punkte.</li>
      </ol>
      ${status}
      <div class="ig-actions">
        <a class="btn btn-ig" href="${esc(c.instagramUrl)}" target="_blank" rel="noopener">${icons.ig.replace('<svg', '<svg width="18" height="18"')} Zu ${esc(c.instagramHandle)}</a>
        <button class="btn" id="claim-btn" ${r && !r.canClaim ? 'disabled' : ''}>Repost melden</button>
      </div>
    </section>`;
}

function openRepostDialog(onDone) {
  const modal = openModal(`
    <div class="sheet-body" style="grid-column:1/-1">
      <p class="eyebrow">Instagram-Repost melden</p>
      <h2>Fast geschafft</h2>
      <p class="muted">Gib deinen Instagram-Namen an, damit das Studio deinen Repost finden kann.</p>
      <form class="form" id="repost-form">
        <div class="field">
          <label for="ig-name">Dein Instagram-Name</label>
          <input class="input" id="ig-name" name="instagramName" placeholder="@deinname" required maxlength="31" autocapitalize="none" spellcheck="false">
        </div>
        <div class="field">
          <label for="ig-link">Link zur Story / zum Beitrag (optional)</label>
          <input class="input" id="ig-link" name="link" type="url" placeholder="https://instagram.com/…" maxlength="300">
        </div>
        <p class="form-error" id="repost-error"></p>
        <button class="btn btn-gold btn-block" type="submit">Absenden</button>
      </form>
    </div>`, { compact: true });
  modal.querySelector('#repost-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    try {
      const data = await api('/reposts', { method: 'POST', body: { instagramName: f.instagramName.value, link: f.link.value.trim() } });
      state.repost = data.repost;
      closeModal();
      toast('Danke! Wir prüfen deinen Repost.');
      onDone?.();
    } catch (err) {
      f.querySelector('#repost-error').textContent = err.message;
    }
  });
}

async function renderHome(main) {
  const [me, rewards] = await Promise.all([api('/me'), loadRewards()]);
  updatePoints(me.user);
  state.repost = me.repost;
  const u = state.user;
  const featured = rewards.slice(0, 3);

  main.innerHTML = `
    <div class="page">
      ${statusCard(u)}
      <div class="grid-2">
        <div id="ig-slot">${instagramCard()}</div>
        <section class="card">
          <p class="eyebrow">So sammelst du</p>
          <ul class="earn-list" style="margin-top:8px">
            <li><span>Haarschnitt</span><b>+100</b></li>
            <li><span>Bartpflege</span><b>+50</b></li>
            <li><span>Produktkauf</span><b>+30</b></li>
            <li><span>Instagram-Repost</span><b>+${state.config.repostPoints}</b></li>
          </ul>
          <p class="muted small" style="margin:10px 0 0">Nenne beim Bezahlen einfach deinen Benutzernamen.</p>
        </section>
      </div>
      <div class="section-head">
        <div><p class="eyebrow">Prämien</p><h2>Für dich ausgewählt</h2></div>
        <a href="/praemien" data-link>Alle ansehen →</a>
      </div>
      <div class="rewards">${featured.map(rewardCard).join('')}</div>
    </div>`;

  animateBars(main);
  bindRewardCards(main);
  const bindClaim = () => main.querySelector('#claim-btn')?.addEventListener('click', () =>
    openRepostDialog(() => { main.querySelector('#ig-slot').innerHTML = instagramCard(); bindClaim(); }));
  bindClaim();
}

// ---------- Prämien ----------

async function loadRewards() {
  if (!state.rewards) state.rewards = (await api('/rewards')).rewards;
  return state.rewards;
}

const categoryLabel = { product: 'Produkt', service: 'Service', other: 'Extra' };

function rewardCard(r) {
  const missing = r.cost - state.user.points;
  return `
    <button class="reward" data-reward="${r.id}">
      <div class="reward-media">
        <span class="reward-tag">${categoryLabel[r.category] || 'Extra'}</span>
        ${r.image ? `<img src="${esc(r.image)}" alt="" loading="lazy">` : ''}
        ${r.video ? `<video data-src="${esc(r.video)}" muted loop playsinline preload="none"></video><span class="reward-play">${icons.play}</span>` : ''}
      </div>
      <div class="reward-body">
        <div>
          <h3>${esc(r.title)}</h3>
          <p class="muted small" style="margin:6px 0 0">${esc(r.description)}</p>
        </div>
        <div class="reward-foot">
          <span class="cost num">${fmt(r.cost)} <small>Punkte</small></span>
          ${missing > 0 ? `<span class="lock">noch ${fmt(missing)}</span>` : '<span class="lock" style="color:var(--ok)">Einlösbar</span>'}
        </div>
      </div>
    </button>`;
}

function bindRewardCards(root) {
  root.querySelectorAll('.reward').forEach((card) => {
    const video = card.querySelector('video');
    if (video && matchMedia('(hover: hover)').matches) {
      card.addEventListener('mouseenter', () => {
        if (!video.src) {
          video.src = video.dataset.src;
          video.addEventListener('canplay', () => video.classList.add('ready'), { once: true });
        }
        video.play().catch(() => {});
      });
      card.addEventListener('mouseleave', () => video.pause());
    }
    card.addEventListener('click', () => openReward(Number(card.dataset.reward)));
  });
}

async function renderRewards(main) {
  const rewards = await loadRewards();
  const filters = [['all', 'Alle'], ['product', 'Produkte'], ['service', 'Services'], ['affordable', 'Einlösbar']];
  const draw = () => {
    const list = rewards.filter((r) =>
      state.filter === 'all' ? true : state.filter === 'affordable' ? r.cost <= state.user.points : r.category === state.filter);
    main.innerHTML = `
      <div class="page">
        <div>
          <p class="eyebrow">Prämien</p>
          <h1>Deine Punkte, deine Wahl.</h1>
          <p class="muted">Du hast <b class="num" style="color:var(--gold-2)">${fmt(state.user.points)} Punkte</b>. Tippe auf eine Prämie für Details und Video.</p>
        </div>
        <div class="chips">${filters.map(([k, l]) => `<button data-filter="${k}" aria-pressed="${state.filter === k}">${l}</button>`).join('')}</div>
        <div class="rewards">${list.map(rewardCard).join('') || '<div class="empty">Noch nichts einlösbar – sammle weiter!</div>'}</div>
      </div>`;
    main.querySelectorAll('[data-filter]').forEach((b) => b.addEventListener('click', () => { state.filter = b.dataset.filter; draw(); }));
    bindRewardCards(main);
  };
  draw();
}

let modalEl = null;
function openModal(inner, { compact = false } = {}) {
  closeModal();
  modalEl = document.createElement('div');
  modalEl.className = 'modal';
  modalEl.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" ${compact ? 'style="grid-template-columns:1fr;width:min(480px,100%)"' : ''}>
    <button class="sheet-close" aria-label="Schließen">${icons.close}</button>${inner}</div>`;
  modalEl.addEventListener('click', (e) => { if (e.target === modalEl || e.target.closest('.sheet-close')) closeModal(); });
  document.body.append(modalEl);
  document.body.style.overflow = 'hidden';
  modalEl.querySelector('input, button:not(.sheet-close)')?.focus({ preventScroll: true });
  return modalEl;
}
function closeModal() {
  modalEl?.remove();
  modalEl = null;
  document.body.style.overflow = '';
}
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

function openReward(id) {
  const r = state.rewards.find((x) => x.id === id);
  if (!r) return;
  const missing = r.cost - state.user.points;
  const media = r.video
    ? `<video src="${esc(r.video)}" poster="${esc(r.image || '')}" autoplay muted loop playsinline controls></video>`
    : r.image ? `<img src="${esc(r.image)}" alt="">` : '';
  const modal = openModal(`
    <div class="sheet-media">${media}</div>
    <div class="sheet-body">
      <p class="eyebrow">${categoryLabel[r.category] || 'Extra'}</p>
      <h2>${esc(r.title)}</h2>
      <p class="muted" style="margin:0">${esc(r.description)}</p>
      ${r.originalImage ? `<div class="original"><img src="${esc(r.originalImage)}" alt="Originalverpackung"><span>Originalprodukt im Studio erhältlich</span></div>` : ''}
      <div class="reward-foot">
        <span class="cost num" style="font-size:26px">${fmt(r.cost)} <small>Punkte</small></span>
        <span class="muted small">Du hast ${fmt(state.user.points)}</span>
      </div>
      <button class="btn btn-gold btn-block" id="redeem-btn" ${missing > 0 ? 'disabled' : ''}>
        ${missing > 0 ? `Noch ${fmt(missing)} Punkte sammeln` : 'Jetzt einlösen'}
      </button>
      <p class="muted small center" style="margin:0">Du bekommst einen Code, den du im Studio vorzeigst.</p>
    </div>`);

  const btn = modal.querySelector('#redeem-btn');
  let confirming = false;
  btn.addEventListener('click', async () => {
    if (!confirming) {
      confirming = true;
      btn.textContent = `Sicher? ${fmt(r.cost)} Punkte einlösen`;
      return;
    }
    btn.disabled = true;
    try {
      const data = await api(`/rewards/${r.id}/redeem`, { method: 'POST' });
      updatePoints(data.user);
      showRedeemed(data.redemption);
    } catch (err) {
      toast(err.message, 'error');
      btn.disabled = false;
    }
  });
}

function showRedeemed(red) {
  openModal(`
    <div class="sheet-body center" style="grid-column:1/-1;padding-top:40px">
      <div class="success-badge">${icons.check}</div>
      <h2>Eingelöst!</h2>
      <p class="muted" style="margin:0">${esc(red.title)} – zeig diesen Code bei deinem nächsten Besuch im Studio.</p>
      <div class="code">${esc(red.code)}</div>
      <a class="btn btn-block" href="/profil" data-link id="to-profile">Meine Codes ansehen</a>
    </div>`, { compact: true });
  modalEl.querySelector('#to-profile').addEventListener('click', closeModal);
  if (location.pathname !== '/profil') render();
}

// ---------- Ränge ----------

async function renderRanks(main) {
  const [me, lb] = await Promise.all([api('/me'), api('/leaderboard')]);
  updatePoints(me.user);
  const u = state.user;
  const ranks = state.config.ranks;
  main.innerHTML = `
    <div class="page">
      ${statusCard(u)}
      <div class="grid-2">
        <section>
          <div class="section-head" style="margin-bottom:12px"><div><p class="eyebrow">Rangsystem</p><h2>Steig auf</h2></div></div>
          <p class="muted small" style="margin:0 0 14px">Dein Rang richtet sich nach allen jemals gesammelten Punkten – Einlösen senkt ihn nicht.</p>
          <div class="ladder">
            ${[...ranks].reverse().map((r) => {
              const idx = ranks.indexOf(r);
              const cls = idx === u.rank.index ? 'current' : idx > u.rank.index ? 'locked' : '';
              return `
                <div class="tier ${cls}" style="--tier:${r.color}">
                  <img src="${badge(r.id)}" alt="">
                  <div>
                    <h3>${esc(r.name)}${idx === u.rank.index ? '<span class="pill">Du</span>' : ''}</h3>
                    <p class="muted small" style="margin:2px 0 0">${esc(r.perk)}</p>
                  </div>
                  <div class="req num">${fmt(r.min)}<small>Punkte</small></div>
                </div>`;
            }).join('')}
          </div>
        </section>
        <section class="card">
          <p class="eyebrow">Top 10</p>
          <h3 style="margin:4px 0 8px">Stammkunden-Rangliste</h3>
          ${lb.leaders.length ? `<ol class="leaders">${lb.leaders.map((l, i) => `
            <li class="${l.username === u.username ? 'me' : ''}">
              <span class="pos">${i + 1}</span>
              <img src="${badge(l.rank)}" alt="${esc(rankById(l.rank)?.name)}">
              <span>${esc(l.username)}</span>
              <b class="num">${fmt(l.lifetimePoints)}</b>
            </li>`).join('')}</ol>` : '<div class="empty">Noch keine Einträge.</div>'}
        </section>
      </div>
    </div>`;
  animateBars(main);
}

// ---------- Profil ----------

async function renderProfile(main) {
  const [me, activity] = await Promise.all([api('/me'), api('/me/activity')]);
  updatePoints(me.user);
  const u = state.user;
  const open = activity.redemptions.filter((r) => r.status === 'open');
  const past = activity.redemptions.filter((r) => r.status !== 'open');
  const statusText = { open: 'Offen', done: 'Eingelöst', cancelled: 'Storniert' };

  main.innerHTML = `
    <div class="page">
      <div class="customer-head">
        <img src="${badge(u.rank.id)}" alt="" style="width:64px">
        <div class="grow">
          <p class="eyebrow">${esc(u.rank.name)}</p>
          <h1 style="font-size:40px">${esc(u.username)}</h1>
          <p class="muted small" style="margin:0">Mitglied seit ${date(u.createdAt)}</p>
        </div>
      </div>
      <div class="grid-2">
        <section class="card">
          <p class="eyebrow">Meine Codes</p>
          <h3 style="margin:4px 0 6px">Im Studio vorzeigen</h3>
          ${open.length ? `<ul class="list">${open.map((r) => `
            <li><div><div>${esc(r.title)}</div><span class="ticket-code">${esc(r.code)}</span></div><span class="status-tag open">Offen</span></li>`).join('')}</ul>`
            : '<div class="empty">Keine offenen Codes. Löse eine Prämie ein!</div>'}
          ${past.length ? `<details style="margin-top:10px"><summary class="muted small" style="cursor:pointer">Frühere Einlösungen (${past.length})</summary>
            <ul class="list">${past.map((r) => `<li><div><div>${esc(r.title)}</div><span class="muted small">${date(r.createdAt)} · ${esc(r.code)}</span></div>
            <span class="status-tag ${r.status}">${statusText[r.status]}</span></li>`).join('')}</ul></details>` : ''}
        </section>
        <section class="card">
          <p class="eyebrow">Verlauf</p>
          <h3 style="margin:4px 0 6px">Punkte-Historie</h3>
          ${activity.transactions.length ? `<ul class="list">${activity.transactions.map((t) => `
            <li><div><div>${esc(t.reason)}</div><span class="muted small">${date(t.createdAt)}</span></div>
            <span class="delta num ${t.delta > 0 ? 'plus' : 'minus'}">${t.delta > 0 ? '+' : ''}${fmt(t.delta)}</span></li>`).join('')}</ul>`
            : '<div class="empty">Noch keine Buchungen.</div>'}
        </section>
      </div>
      <section class="card">
        <p class="eyebrow">Sicherheit</p>
        <h3 style="margin:4px 0 14px">Passwort ändern</h3>
        <form class="form" id="pw-form" style="max-width:420px">
          <input type="text" name="username" value="${esc(u.username)}" autocomplete="username" hidden>
          <input class="input" type="password" name="current" placeholder="Aktuelles Passwort" autocomplete="current-password" required>
          <input class="input" type="password" name="next" placeholder="Neues Passwort (min. 6 Zeichen)" autocomplete="new-password" minlength="6" required>
          <div class="row"><button class="btn" type="submit">Speichern</button></div>
        </form>
      </section>
      <button class="btn btn-ghost btn-danger" id="logout">Abmelden</button>
    </div>`;

  main.querySelector('#pw-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    try {
      await api('/me/password', { method: 'POST', body: { current: f.current.value, next: f.next.value } });
      f.reset();
      toast('Passwort geändert.');
    } catch (err) {
      toast(err.message, 'error');
    }
  });
  main.querySelector('#logout').addEventListener('click', async () => {
    await api('/logout', { method: 'POST' }).catch(() => {});
    logoutLocal();
  });
}

// ---------- Studio (Admin) ----------

const adminState = { tab: 'customers', q: '', claimStatus: 'pending', redStatus: 'open', code: '' };

async function renderAdmin(main) {
  const overview = await api('/admin/overview');
  const tabs = [
    ['customers', 'Kunden'],
    ['reposts', `Reposts${overview.pendingReposts ? ` (${overview.pendingReposts})` : ''}`],
    ['redemptions', `Einlösungen${overview.openRedemptions ? ` (${overview.openRedemptions})` : ''}`],
    ['rewards', 'Prämien'],
  ];
  main.innerHTML = `
    <div class="page">
      <div><p class="eyebrow">Studio</p><h1>Verwaltung</h1></div>
      <div class="stats">
        <div class="stat"><b class="num">${fmt(overview.customers)}</b><span>Kunden</span></div>
        <div class="stat"><b class="num">${fmt(overview.pendingReposts)}</b><span>Reposts zu prüfen</span></div>
        <div class="stat"><b class="num">${fmt(overview.openRedemptions)}</b><span>Offene Einlösungen</span></div>
        <div class="stat"><b class="num">${fmt(overview.pointsIssued)}</b><span>Punkte vergeben</span></div>
      </div>
      <div class="chips admin-tabs">${tabs.map(([k, l]) => `<button data-tab="${k}" aria-pressed="${adminState.tab === k}">${l}</button>`).join('')}</div>
      <section class="card" id="admin-panel"><div class="spinner"></div></section>
    </div>`;
  main.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { adminState.tab = b.dataset.tab; renderAdmin(main); }));
  const panel = main.querySelector('#admin-panel');
  const panels = { customers: adminCustomers, reposts: adminReposts, redemptions: adminRedemptions, rewards: adminRewards };
  await panels[adminState.tab](panel, overview, () => renderAdmin(main));
}

async function adminCustomers(panel, overview) {
  panel.innerHTML = `
    <div class="row"><input class="input" id="q" placeholder="Kunde suchen (Benutzername)" value="${esc(adminState.q)}" autocapitalize="none"></div>
    <div id="customers"><div class="spinner"></div></div>`;
  const input = panel.querySelector('#q');
  let timer;
  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { adminState.q = input.value; load(); }, 250); });

  async function load() {
    const { users } = await api(`/admin/users?q=${encodeURIComponent(adminState.q)}`);
    const list = panel.querySelector('#customers');
    list.innerHTML = users.length ? users.map((u) => `
      <div class="customer" data-user="${u.id}">
        <div class="customer-head">
          <img src="${badge(u.rank.id)}" alt="">
          <div class="grow"><b>${esc(u.username)}</b><div class="muted small" data-meta>${esc(u.rank.name)} · ${fmt(u.lifetimePoints)} gesammelt</div></div>
          <b class="num" style="color:var(--gold-2)" data-points>${fmt(u.points)}</b>
        </div>
        <div class="presets">
          ${overview.presets.map((p) => `<button class="btn btn-sm" data-add="${p.points}" data-reason="${esc(p.label)}">${esc(p.label)} +${p.points}</button>`).join('')}
        </div>
        <form class="row" data-custom>
          <input class="input" name="delta" type="number" step="1" placeholder="± Punkte" required style="max-width:120px">
          <input class="input" name="reason" placeholder="Grund (optional)" maxlength="80">
          <button class="btn btn-sm" type="submit">Buchen</button>
        </form>
      </div>`).join('') : '<div class="empty">Keine Kunden gefunden.</div>';

    list.querySelectorAll('.customer').forEach((row) => {
      const id = row.dataset.user;
      const book = async (delta, reason) => {
        try {
          const { user } = await api(`/admin/users/${id}/points`, { method: 'POST', body: { delta, reason } });
          row.querySelector('[data-points]').textContent = fmt(user.points);
          row.querySelector('[data-meta]').textContent = `${user.rank.name} · ${fmt(user.lifetimePoints)} gesammelt`;
          row.querySelector('.customer-head img').src = badge(user.rank.id);
          toast(`${user.username}: ${delta > 0 ? '+' : ''}${delta} Punkte`);
        } catch (err) {
          toast(err.message, 'error');
        }
      };
      row.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => book(Number(b.dataset.add), b.dataset.reason)));
      row.querySelector('[data-custom]').addEventListener('submit', (e) => {
        e.preventDefault();
        const f = e.currentTarget;
        book(Number(f.delta.value), f.reason.value).then(() => f.reset());
      });
    });
  }
  await load();
}

async function adminReposts(panel, overview, refresh) {
  const { claims } = await api(`/admin/reposts?status=${adminState.claimStatus}`);
  const statuses = [['pending', 'Offen'], ['approved', 'Bestätigt'], ['rejected', 'Abgelehnt']];
  panel.innerHTML = `
    <div class="chips" style="margin-bottom:8px">${statuses.map(([k, l]) => `<button data-s="${k}" aria-pressed="${adminState.claimStatus === k}">${l}</button>`).join('')}</div>
    <p class="muted small">Prüfe auf Instagram, ob der Kunde ${esc(state.config.instagramHandle)} geteilt hat. Bestätigen bucht +${state.config.repostPoints} Punkte.</p>
    ${claims.length ? `<ul class="list">${claims.map((c) => `
      <li>
        <div>
          <b>${esc(c.username)}</b> · <a href="https://www.instagram.com/${encodeURIComponent(c.instagramName)}/" target="_blank" rel="noopener">@${esc(c.instagramName)}</a>
          ${c.link ? ` · <a href="${esc(c.link)}" target="_blank" rel="noopener">Link</a>` : ''}
          <div class="muted small">${date(c.createdAt)}</div>
        </div>
        ${c.status === 'pending' ? `<div class="row">
          <button class="btn btn-sm btn-ok" data-claim="${c.id}" data-action="approve">Bestätigen</button>
          <button class="btn btn-sm btn-danger" data-claim="${c.id}" data-action="reject">Ablehnen</button>
        </div>` : `<span class="status-tag ${c.status}">${c.status === 'approved' ? `+${c.points}` : 'Abgelehnt'}</span>`}
      </li>`).join('')}</ul>` : '<div class="empty">Keine Anfragen.</div>'}`;
  panel.querySelectorAll('[data-s]').forEach((b) => b.addEventListener('click', () => { adminState.claimStatus = b.dataset.s; adminReposts(panel, overview, refresh); }));
  panel.querySelectorAll('[data-claim]').forEach((b) => b.addEventListener('click', async () => {
    try {
      await api(`/admin/reposts/${b.dataset.claim}`, { method: 'POST', body: { action: b.dataset.action } });
      toast(b.dataset.action === 'approve' ? 'Punkte gutgeschrieben.' : 'Anfrage abgelehnt.');
      refresh();
    } catch (err) {
      toast(err.message, 'error');
    }
  }));
}

async function adminRedemptions(panel, overview, refresh) {
  const q = adminState.code ? `code=${encodeURIComponent(adminState.code)}` : `status=${adminState.redStatus}`;
  const { redemptions } = await api(`/admin/redemptions?${q}`);
  const statuses = [['open', 'Offen'], ['done', 'Erledigt'], ['cancelled', 'Storniert']];
  panel.innerHTML = `
    <form class="row" id="code-form" style="margin-bottom:12px">
      <input class="input" name="code" placeholder="Code suchen, z. B. SK-AB12CD" value="${esc(adminState.code)}" autocapitalize="characters">
      <button class="btn btn-sm" type="submit">Suchen</button>
    </form>
    <div class="chips">${statuses.map(([k, l]) => `<button data-s="${k}" aria-pressed="${!adminState.code && adminState.redStatus === k}">${l}</button>`).join('')}</div>
    ${redemptions.length ? `<ul class="list">${redemptions.map((r) => `
      <li>
        <div>
          <span class="ticket-code">${esc(r.code)}</span> · <b>${esc(r.title)}</b>
          <div class="muted small">${esc(r.username)} · ${fmt(r.cost)} Punkte · ${date(r.createdAt)}</div>
        </div>
        ${r.status === 'open' ? `<div class="row">
          <button class="btn btn-sm btn-ok" data-red="${r.id}" data-action="done">Ausgegeben</button>
          <button class="btn btn-sm btn-danger" data-red="${r.id}" data-action="cancel">Stornieren</button>
        </div>` : `<span class="status-tag ${r.status}">${r.status === 'done' ? 'Erledigt' : 'Storniert'}</span>`}
      </li>`).join('')}</ul>` : '<div class="empty">Keine Einlösungen.</div>'}`;
  panel.querySelector('#code-form').addEventListener('submit', (e) => {
    e.preventDefault();
    adminState.code = e.currentTarget.code.value.trim();
    adminRedemptions(panel, overview, refresh);
  });
  panel.querySelectorAll('[data-s]').forEach((b) => b.addEventListener('click', () => {
    adminState.code = '';
    adminState.redStatus = b.dataset.s;
    adminRedemptions(panel, overview, refresh);
  }));
  panel.querySelectorAll('[data-red]').forEach((b) => b.addEventListener('click', async () => {
    if (b.dataset.action === 'cancel' && !confirm('Einlösung stornieren? Der Kunde bekommt die Punkte zurück.')) return;
    try {
      await api(`/admin/redemptions/${b.dataset.red}`, { method: 'POST', body: { action: b.dataset.action } });
      toast(b.dataset.action === 'done' ? 'Als ausgegeben markiert.' : 'Storniert, Punkte erstattet.');
      refresh();
    } catch (err) {
      toast(err.message, 'error');
    }
  }));
}

async function adminRewards(panel, overview, refresh) {
  const { rewards } = await api('/admin/rewards');
  panel.innerHTML = `
    ${rewards.map((r) => `
      <form class="admin-reward" data-id="${r.id}">
        ${r.image ? `<img src="${esc(r.image)}" alt="">` : '<img alt="">'}
        <div style="display:grid;gap:8px">
          <div class="badge-inline"><b>${esc(r.title)}</b>${r.active ? '' : '<span class="status-tag cancelled">Inaktiv</span>'}</div>
          <div class="row">
            <input class="input num" name="cost" type="number" min="1" value="${r.cost}" aria-label="Punktepreis">
            <button class="btn btn-sm" type="submit">Preis speichern</button>
            <button class="btn btn-sm btn-ghost" type="button" data-toggle="${r.active ? 0 : 1}">${r.active ? 'Deaktivieren' : 'Aktivieren'}</button>
          </div>
        </div>
      </form>`).join('')}
    <h3 style="margin:22px 0 12px">Neue Prämie</h3>
    <form class="form" id="new-reward">
      <input class="input" name="title" placeholder="Titel, z. B. 10 € Rabatt" required maxlength="80">
      <textarea class="input" name="description" placeholder="Beschreibung" maxlength="300"></textarea>
      <div class="row">
        <input class="input" name="cost" type="number" min="1" placeholder="Punkte" required>
        <select class="input" name="category"><option value="service">Service</option><option value="product">Produkt</option><option value="other">Extra</option></select>
      </div>
      <input class="input" name="image" placeholder="Bildpfad (optional), z. B. /img/rewards/vip.png">
      <div class="row"><button class="btn btn-gold" type="submit">Prämie anlegen</button></div>
    </form>`;

  const save = async (id, body, msg) => {
    try {
      await api(`/admin/rewards/${id}`, { method: 'PATCH', body });
      state.rewards = null;
      toast(msg);
      refresh();
    } catch (err) {
      toast(err.message, 'error');
    }
  };
  panel.querySelectorAll('.admin-reward').forEach((f) => {
    f.addEventListener('submit', (e) => { e.preventDefault(); save(f.dataset.id, { cost: Number(f.cost.value) }, 'Preis gespeichert.'); });
    f.querySelector('[data-toggle]').addEventListener('click', (e) => save(f.dataset.id, { active: e.currentTarget.dataset.toggle === '1' }, 'Gespeichert.'));
  });
  panel.querySelector('#new-reward').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    try {
      await api('/admin/rewards', {
        method: 'POST',
        body: {
          title: f.elements.title.value,
          description: f.elements.description.value,
          cost: Number(f.elements.cost.value),
          category: f.elements.category.value,
          image: f.elements.image.value.trim(),
        },
      });
      state.rewards = null;
      toast('Prämie angelegt.');
      refresh();
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}

// ---------- Start ----------

(async function boot() {
  state.config = await api('/config');
  try {
    const me = await api('/me');
    state.user = me.user;
    state.repost = me.repost;
  } catch {
    state.user = null;
  }
  render();
})();
