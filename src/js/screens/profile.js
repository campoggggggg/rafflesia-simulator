// ============================================================
// screens/profile.js — Schermata profilo utente.
// ============================================================

import { db }             from '../core/supabase-client.js';
import { getUser }        from '../auth/auth.js';
import { AppState }       from '../core/state.js';
import { CardDatabase }   from '../data/cards.js';
import { showGlobalToast } from '../core/ui.js';
import { navigateTo }     from '../core/router.js';

// ─────────────────────────────────────────────────────────────
// RENDER PRINCIPALE
// ─────────────────────────────────────────────────────────────
export async function renderProfileScreen() {
  const screen = document.getElementById('screen-profile');
  if (!screen) return;

  injectStyles();

  const user = await getUser();
  if (!user) {
    screen.innerHTML = `
      <div class="prof-root">
        <div class="prof-empty">
          <p>Accedi per vedere il tuo profilo.</p>
          <button class="prof-btn prof-btn-primary" id="prof-go-auth">Accedi</button>
        </div>
      </div>`;
    document.getElementById('prof-go-auth')?.addEventListener('click', () => navigateTo('auth'));
    return;
  }

  screen.innerHTML = `<div class="prof-root"><div class="prof-loading">Caricamento profilo…</div></div>`;

  const [profile, publishedDecks] = await Promise.all([
    fetchProfile(user.id),
    fetchPublishedDecks(user.id),
  ]);

  screen.innerHTML = buildSkeleton(profile, publishedDecks);
  wireEvents(user, profile);
}

// ─────────────────────────────────────────────────────────────
// FETCH
// ─────────────────────────────────────────────────────────────
async function fetchProfile(userId) {
  const { data, error } = await db
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) console.warn('fetchProfile:', error.message);
  return data || {};
}

async function fetchPublishedDecks(userId) {
  const { data, error } = await db
    .from('public_decks')
    .select('id, name, commander_color, created_at')
    .eq('author_user_id', userId)
    .order('created_at', { ascending: false });
  if (error) console.warn('fetchPublishedDecks:', error.message);
  return data || [];
}

// ─────────────────────────────────────────────────────────────
// HTML SKELETON
// ─────────────────────────────────────────────────────────────
const COLOR_HEX = {
  blue: '#336699', green: '#385400', red: '#8A0000',
  black: '#262B2F', colorless: '#A19993',
};

function buildSkeleton(profile, decks) {
  const avatarUrl = profile.avatar_url || '';
  const bio       = profile.bio || '';
  const socialLabel = profile.social_label || '';
  const socialUrl   = profile.social_url   || '';
  const favCardId   = profile.favorite_card_id ? String(profile.favorite_card_id) : '';

  const favCard = favCardId ? CardDatabase.find(c => c.id === favCardId) : null;

  const favCardHtml = favCard
    ? `<div class="prof-fav-card">
         <img src="${favCard.image}" alt="${esc(favCard.name)}" class="prof-fav-img" onerror="this.style.display='none'">
         <span class="prof-fav-name">${esc(favCard.name)}</span>
       </div>`
    : `<div class="prof-fav-card prof-fav-empty">Nessuna carta preferita</div>`;

  const decksHtml = decks.length
    ? decks.map(d => {
        const color = COLOR_HEX[d.commander_color] || COLOR_HEX.colorless;
        return `<div class="prof-deck-chip" style="border-left-color:${color}">${esc(d.name)}</div>`;
      }).join('')
    : `<div class="prof-deck-empty">Nessun mazzo pubblicato.</div>`;

  const socialHtml = socialLabel && socialUrl
    ? `<a class="prof-social-link" href="${esc(socialUrl)}" target="_blank" rel="noopener noreferrer">${esc(socialLabel)}</a>`
    : '';

  return `
<div class="prof-root">
  <div class="prof-header">
    <div class="prof-avatar-wrap">
      <div class="prof-avatar" id="prof-avatar-display">
        ${avatarUrl
          ? `<img src="${esc(avatarUrl)}" alt="avatar" class="prof-avatar-img" id="prof-avatar-img">`
          : `<div class="prof-avatar-placeholder" id="prof-avatar-placeholder">${(AppState.username || '?')[0].toUpperCase()}</div>`}
      </div>
      <button class="prof-avatar-edit-btn" id="prof-avatar-btn" title="Cambia foto">
        <svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm17.71-10.21a1 1 0 0 0 0-1.42l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.82z"/></svg>
      </button>
      <input type="file" id="prof-avatar-input" accept="image/*" style="display:none">
    </div>
    <div class="prof-header-info">
      <div class="prof-username">${esc(AppState.username)}</div>
      ${socialHtml}
    </div>
  </div>

  <div class="prof-body">

    <!-- Bio -->
    <div class="prof-section">
      <div class="prof-section-label">Bio</div>
      <textarea class="prof-textarea" id="prof-bio" maxlength="300" placeholder="Scrivi qualcosa su di te…">${esc(bio)}</textarea>
      <div class="prof-char-count"><span id="prof-bio-count">${bio.length}</span>/300</div>
    </div>

    <!-- Carta preferita -->
    <div class="prof-section">
      <div class="prof-section-label">Carta preferita</div>
      <div class="prof-fav-row">
        ${favCardHtml}
        <div class="prof-fav-search-wrap">
          <input class="prof-input" id="prof-fav-search" type="text" placeholder="Cerca carta…" autocomplete="off" value="${favCard ? esc(favCard.name) : ''}">
          <div class="prof-fav-dropdown" id="prof-fav-dropdown"></div>
        </div>
      </div>
    </div>

    <!-- Social -->
    <div class="prof-section">
      <div class="prof-section-label">Social / Link</div>
      <div class="prof-social-row">
        <input class="prof-input" id="prof-social-label" type="text" placeholder="Nome (es. Instagram)" maxlength="40" value="${esc(socialLabel)}">
        <input class="prof-input prof-input-url" id="prof-social-url" type="url" placeholder="https://…" value="${esc(socialUrl)}">
      </div>
    </div>

    <!-- Mazzi pubblicati -->
    <div class="prof-section">
      <div class="prof-section-label">Mazzi pubblicati</div>
      <div class="prof-decks-grid" id="prof-decks-grid">${decksHtml}</div>
    </div>

    <!-- Salva -->
    <div class="prof-actions">
      <button class="prof-btn prof-btn-primary" id="prof-save">Salva profilo</button>
    </div>

  </div>
</div>`;
}

// ─────────────────────────────────────────────────────────────
// EVENTI
// ─────────────────────────────────────────────────────────────
let _selectedFavCardId = null;

function wireEvents(user, profile) {
  _selectedFavCardId = profile.favorite_card_id ? String(profile.favorite_card_id) : null;

  // Bio char count
  const bioTA = document.getElementById('prof-bio');
  const bioCount = document.getElementById('prof-bio-count');
  bioTA?.addEventListener('input', () => {
    if (bioCount) bioCount.textContent = bioTA.value.length;
  });

  // Avatar upload
  const avatarBtn   = document.getElementById('prof-avatar-btn');
  const avatarInput = document.getElementById('prof-avatar-input');
  avatarBtn?.addEventListener('click', () => avatarInput?.click());
  avatarInput?.addEventListener('change', async () => {
    const file = avatarInput.files?.[0];
    if (!file) return;
    await uploadAvatar(user, file);
  });

  // Ricerca carta preferita
  const favSearch   = document.getElementById('prof-fav-search');
  const favDropdown = document.getElementById('prof-fav-dropdown');
  favSearch?.addEventListener('input', () => {
    const q = favSearch.value.trim().toLowerCase();
    if (!q) { favDropdown.innerHTML = ''; favDropdown.classList.remove('open'); return; }
    const results = CardDatabase.filter(c => c.name.toLowerCase().includes(q)).slice(0, 8);
    if (!results.length) { favDropdown.innerHTML = ''; favDropdown.classList.remove('open'); return; }
    favDropdown.innerHTML = results.map(c =>
      `<div class="prof-fav-item" data-id="${esc(c.id)}">${esc(c.name)}</div>`
    ).join('');
    favDropdown.classList.add('open');
    favDropdown.querySelectorAll('.prof-fav-item').forEach(item => {
      item.addEventListener('click', () => {
        const card = CardDatabase.find(c => c.id === item.dataset.id);
        if (!card) return;
        _selectedFavCardId = card.id;
        favSearch.value = card.name;
        favDropdown.innerHTML = '';
        favDropdown.classList.remove('open');
        // Aggiorna anteprima
        const wrap = document.querySelector('.prof-fav-card');
        if (wrap) {
          wrap.innerHTML = `<img src="${card.image}" alt="${esc(card.name)}" class="prof-fav-img"><span class="prof-fav-name">${esc(card.name)}</span>`;
          wrap.classList.remove('prof-fav-empty');
        }
      });
    });
  });

  document.addEventListener('click', (e) => {
    if (!favSearch?.contains(e.target) && !favDropdown?.contains(e.target)) {
      favDropdown?.classList.remove('open');
    }
  }, { capture: true });

  // Salva
  document.getElementById('prof-save')?.addEventListener('click', () => saveProfile(user));
}

// ─────────────────────────────────────────────────────────────
// UPLOAD AVATAR
// ─────────────────────────────────────────────────────────────
async function uploadAvatar(user, file) {
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `avatars/${user.id}.${ext}`;

  const { error: upErr } = await db.storage.from('avatars').upload(path, file, { upsert: true });
  if (upErr) { showGlobalToast('Errore upload avatar.', 'error'); return; }

  const { data: urlData } = db.storage.from('avatars').getPublicUrl(path);
  const publicUrl = urlData?.publicUrl;
  if (!publicUrl) return;

  const { error: updErr } = await db.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id);
  if (updErr) { showGlobalToast('Errore aggiornamento avatar.', 'error'); return; }

  // Aggiorna UI
  const display = document.getElementById('prof-avatar-display');
  if (display) {
    display.innerHTML = `<img src="${publicUrl}?t=${Date.now()}" alt="avatar" class="prof-avatar-img">`;
  }
  showGlobalToast('Foto aggiornata.', 'success');
}

// ─────────────────────────────────────────────────────────────
// SALVA PROFILO
// ─────────────────────────────────────────────────────────────
async function saveProfile(user) {
  const bio         = document.getElementById('prof-bio')?.value.trim() || '';
  const socialLabel = document.getElementById('prof-social-label')?.value.trim() || '';
  const socialUrl   = document.getElementById('prof-social-url')?.value.trim()   || '';

  const payload = {
    bio,
    social_label:     socialLabel,
    social_url:       socialUrl,
    favorite_card_id: _selectedFavCardId ? Number(_selectedFavCardId) : null,
  };

  const { error } = await db.from('profiles').update(payload).eq('id', user.id);
  if (error) {
    showGlobalToast('Errore salvataggio profilo.', 'error');
    console.warn('saveProfile:', error.message);
    return;
  }
  showGlobalToast('Profilo salvato.', 'success');

  // Aggiorna social link visibile nell'header
  const socialEl = document.querySelector('.prof-social-link');
  if (socialEl && socialLabel && socialUrl) {
    socialEl.textContent = socialLabel;
    socialEl.href = socialUrl;
  } else if (!socialEl && socialLabel && socialUrl) {
    const headerInfo = document.querySelector('.prof-header-info');
    if (headerInfo) {
      const a = document.createElement('a');
      a.className = 'prof-social-link';
      a.href = socialUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = socialLabel;
      headerInfo.appendChild(a);
    }
  }
}

// ─────────────────────────────────────────────────────────────
// UTILITY
// ─────────────────────────────────────────────────────────────
function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─────────────────────────────────────────────────────────────
// CSS
// ─────────────────────────────────────────────────────────────
function injectStyles() {
  if (document.getElementById('prof-styles')) return;
  const s = document.createElement('style');
  s.id = 'prof-styles';
  s.textContent = `

/* ══ ROOT ════════════════════════════════════════════════════ */
.prof-root {
  max-width: 720px;
  margin: 0 auto;
  padding: 48px 28px 72px;
}

.prof-loading, .prof-empty {
  text-align: center;
  color: var(--text-secondary);
  padding: 80px 0;
  font-size: 15px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
}

/* ══ HEADER ══════════════════════════════════════════════════ */
.prof-header {
  display: flex;
  align-items: center;
  gap: 28px;
  margin-bottom: 40px;
  padding-bottom: 28px;
  border-bottom: 1px solid var(--border);
}

.prof-avatar-wrap {
  position: relative;
  flex-shrink: 0;
}

.prof-avatar {
  width: 90px;
  height: 90px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--bg-elevated);
  border: 2px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
}

.prof-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.prof-avatar-placeholder {
  font-family: 'Cinzel', serif;
  font-size: 36px;
  font-weight: 700;
  color: var(--text-secondary);
}

.prof-avatar-edit-btn {
  position: absolute;
  bottom: 0; right: 0;
  width: 28px; height: 28px;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--text-primary);
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: background 0.15s;
}
.prof-avatar-edit-btn:hover { background: var(--violet); border-color: var(--violet); }
.prof-avatar-edit-btn svg { width: 14px; height: 14px; fill: currentColor; }

.prof-header-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.prof-username {
  font-family: 'Cinzel', serif;
  font-size: 26px;
  font-weight: 700;
  color: var(--text-primary);
}

.prof-social-link {
  font-size: 13px;
  color: var(--violet-bright, #c5bbd0);
  text-decoration: none;
  transition: color 0.15s;
}
.prof-social-link:hover { color: #fff; }

/* ══ BODY ════════════════════════════════════════════════════ */
.prof-body {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.prof-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.prof-section-label {
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-secondary);
}

/* ══ INPUTS ══════════════════════════════════════════════════ */
.prof-input {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 14px;
  padding: 9px 13px;
  outline: none;
  transition: border-color 0.15s;
  width: 100%;
  box-sizing: border-box;
}
.prof-input:focus { border-color: var(--violet); }

.prof-textarea {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 14px;
  padding: 10px 13px;
  outline: none;
  transition: border-color 0.15s;
  width: 100%;
  box-sizing: border-box;
  resize: vertical;
  min-height: 90px;
  font-family: inherit;
  line-height: 1.5;
}
.prof-textarea:focus { border-color: var(--violet); }

.prof-char-count {
  font-size: 11px;
  color: var(--text-secondary);
  text-align: right;
}

/* ══ SOCIAL ROW ══════════════════════════════════════════════ */
.prof-social-row {
  display: flex;
  gap: 10px;
}
.prof-input-url { flex: 2; }
.prof-social-row .prof-input:first-child { flex: 1; }

/* ══ CARTA PREFERITA ═════════════════════════════════════════ */
.prof-fav-row {
  display: flex;
  align-items: center;
  gap: 20px;
  flex-wrap: wrap;
}

.prof-fav-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 12px 6px 6px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 10px;
  flex-shrink: 0;
}

.prof-fav-empty {
  color: var(--text-secondary);
  font-size: 13px;
  padding: 10px 14px;
}

.prof-fav-img {
  width: 44px;
  height: 62px;
  object-fit: cover;
  border-radius: 5px;
  flex-shrink: 0;
}

.prof-fav-name {
  font-size: 13px;
  color: var(--text-primary);
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.prof-fav-search-wrap {
  position: relative;
  flex: 1;
  min-width: 180px;
}

.prof-fav-dropdown {
  display: none;
  position: absolute;
  top: calc(100% + 4px);
  left: 0; right: 0;
  background: rgba(11,11,22,0.98);
  border: 1px solid var(--border-gold);
  border-radius: 8px;
  z-index: 200;
  max-height: 220px;
  overflow-y: auto;
  box-shadow: 0 8px 24px rgba(0,0,0,0.6);
}
.prof-fav-dropdown.open { display: block; }

.prof-fav-item {
  padding: 9px 14px;
  font-size: 13px;
  color: var(--text-primary);
  cursor: pointer;
  transition: background 0.12s;
}
.prof-fav-item:hover { background: rgba(255,255,255,0.07); }

/* ══ MAZZI PUBBLICATI ════════════════════════════════════════ */
.prof-decks-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.prof-deck-chip {
  padding: 6px 14px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-left: 4px solid;
  border-radius: 6px;
  font-size: 13px;
  color: var(--text-primary);
}

.prof-deck-empty {
  font-size: 13px;
  color: var(--text-secondary);
}

/* ══ ACTIONS ═════════════════════════════════════════════════ */
.prof-actions {
  display: flex;
  justify-content: flex-end;
}

.prof-btn {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 14px;
  padding: 10px 24px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.prof-btn:hover { border-color: var(--violet); }

.prof-btn-primary {
  background: var(--violet);
  border-color: var(--violet);
  color: #fff;
}
.prof-btn-primary:hover { background: var(--violet-bright); border-color: var(--violet-bright); }

/* ══ RESPONSIVE ══════════════════════════════════════════════ */
@media (max-width: 600px) {
  .prof-header { flex-direction: column; align-items: flex-start; }
  .prof-social-row { flex-direction: column; }
  .prof-fav-row { flex-direction: column; align-items: flex-start; }
}
  `;
  document.head.appendChild(s);
}
