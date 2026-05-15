// ============================================================
// screens/profile.js — Schermata profilo utente.
// ============================================================

import { db }              from '../core/supabase-client.js';
import { getUser }         from '../auth/auth.js';
import { AppState }        from '../core/state.js';
import { CardDatabase, CardMap } from '../data/cards.js';
import { showGlobalToast } from '../core/ui.js';
import { navigateTo }      from '../core/router.js';

// ─────────────────────────────────────────────────────────────
// RENDER PRINCIPALE (profilo proprio — modificabile)
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

  screen.innerHTML = buildSkeleton(profile, publishedDecks, true);
  wireEvents(user, profile, publishedDecks);
}

// ─────────────────────────────────────────────────────────────
// RENDER PROFILO PUBBLICO (sola lettura)
// ─────────────────────────────────────────────────────────────
export async function openPublicProfile(userId) {
  injectStyles();

  const [profile, publishedDecks] = await Promise.all([
    fetchProfile(userId),
    fetchPublishedDecks(userId),
  ]);

  const overlay = document.createElement('div');
  overlay.className = 'prof-pub-overlay';
  overlay.innerHTML = `
    <div class="prof-pub-modal">
      <button class="prof-pub-close" id="prof-pub-close">✕</button>
      ${buildSkeleton(profile, publishedDecks, false)}
    </div>`;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.getElementById('prof-pub-close').addEventListener('click', close);

  // published decks cliccabili anche nel profilo pubblico
  wirePublishedDecks(overlay, publishedDecks);
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
    .select('*')
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

function buildSkeleton(profile, decks, editable) {
  const avatarUrl  = profile.avatar_url || '';
  const bio        = profile.bio || '';
  const username   = profile.username || AppState.username || '?';

  // 3 carte preferite — stored as favorite_card_ids (array) o fallback su favorite_card_id
  const favIds = profile.favorite_card_ids
    ? (Array.isArray(profile.favorite_card_ids) ? profile.favorite_card_ids : []).slice(0, 3).map(String)
    : (profile.favorite_card_id ? [String(profile.favorite_card_id)] : []);

  // social links — stored as social_links (array di {label, url}) o fallback legacy
  const socials = profile.social_links
    ? (Array.isArray(profile.social_links) ? profile.social_links : [])
    : (profile.social_label && profile.social_url
        ? [{ label: profile.social_label, url: profile.social_url }]
        : []);

  // 3 slot carte preferite
  const favSlotsHtml = [0, 1, 2].map(i => {
    const card = favIds[i] ? CardDatabase.find(c => c.id === favIds[i]) : null;
    return `
      <div class="prof-fav-slot${card ? '' : ' prof-fav-slot-empty'}" data-slot="${i}">
        ${card
          ? `<img src="${card.image}" alt="${esc(card.name)}" class="prof-fav-slot-img" title="${esc(card.name)}">`
          : `<span class="prof-fav-slot-plus">${editable ? '+' : '—'}</span>`}
        ${editable ? `<button class="prof-fav-slot-rm${card ? '' : ' hidden'}" data-slot="${i}" title="Rimuovi">✕</button>` : ''}
      </div>`;
  }).join('');

  // social links html (display)
  const socialsDisplayHtml = socials.length
    ? socials.map(s => s.url
        ? `<a class="prof-social-link" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.label || s.url)}</a>`
        : '').join('')
    : '';

  // social editor (solo se editable)
  const socialsEditorHtml = editable ? `
    <div class="prof-socials-list" id="prof-socials-list">
      ${socials.map((s, i) => socialRowHtml(i, s.label || '', s.url || '')).join('')}
    </div>
    <button class="prof-btn prof-btn-sm" id="prof-add-social">+ Add link</button>
  ` : socialsDisplayHtml;

  // published decks
  const decksHtml = decks.length
    ? decks.map(d => {
        const color = COLOR_HEX[d.commander_color] || COLOR_HEX.colorless;
        return `<button class="prof-deck-chip" data-deck-id="${esc(d.id)}" style="border-left-color:${color}">${esc(d.name)}</button>`;
      }).join('')
    : `<div class="prof-deck-empty">No published decks.</div>`;

  return `
<div class="prof-root">
  <div class="prof-header">
    <div class="prof-avatar-wrap">
      <div class="prof-avatar" id="prof-avatar-display">
        ${avatarUrl
          ? `<img src="${esc(avatarUrl)}" alt="avatar" class="prof-avatar-img">`
          : `<div class="prof-avatar-placeholder">${username[0].toUpperCase()}</div>`}
      </div>
      ${editable ? `
        <button class="prof-avatar-edit-btn" id="prof-avatar-btn" title="Cambia foto">
          <svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm17.71-10.21a1 1 0 0 0 0-1.42l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.82z"/></svg>
        </button>
        <input type="file" id="prof-avatar-input" accept="image/*" style="display:none">
      ` : ''}
    </div>
    <div class="prof-header-info">
      <div class="prof-username">${esc(username)}</div>
      ${!editable ? socialsDisplayHtml : ''}
    </div>
  </div>

  <div class="prof-body">

    <!-- Bio -->
    <div class="prof-section">
      <div class="prof-section-label">Bio</div>
      ${editable
        ? `<textarea class="prof-textarea" id="prof-bio" maxlength="300" placeholder="Scrivi qualcosa su di te…">${esc(bio)}</textarea>
           <div class="prof-char-count"><span id="prof-bio-count">${bio.length}</span>/300</div>`
        : (bio ? `<p class="prof-bio-readonly">${esc(bio)}</p>` : `<p class="prof-bio-readonly prof-empty-text">—</p>`)}
    </div>

    <!-- Carte preferite -->
    <div class="prof-section">
      <div class="prof-section-label">My favourite Rafflesia TCG's cards</div>
      <div class="prof-fav-slots" id="prof-fav-slots">${favSlotsHtml}</div>
      ${editable ? `
        <div class="prof-fav-search-wrap" id="prof-fav-search-wrap" style="display:none">
          <input class="prof-input" id="prof-fav-search" type="text" placeholder="Cerca carta…" autocomplete="off">
          <div class="prof-fav-dropdown" id="prof-fav-dropdown"></div>
        </div>
      ` : ''}
    </div>

    <!-- Social -->
    <div class="prof-section">
      <div class="prof-section-label">Social / Links</div>
      ${socialsEditorHtml}
    </div>

    <!-- Published decks -->
    <div class="prof-section">
      <div class="prof-section-label">Published decks</div>
      <div class="prof-decks-grid" id="prof-decks-grid">${decksHtml}</div>
    </div>

    ${editable ? `
    <!-- Salva -->
    <div class="prof-actions">
      <button class="prof-btn prof-btn-primary" id="prof-save">Save profile</button>
    </div>
    ` : ''}

  </div>
</div>`;
}

function socialRowHtml(i, label, url) {
  return `
    <div class="prof-social-row" data-social-idx="${i}">
      <input class="prof-input prof-social-label-inp" type="text" placeholder="Name (e.g. Instagram)" maxlength="40" value="${esc(label)}">
      <input class="prof-input prof-social-url-inp" type="url" placeholder="https://…" value="${esc(url)}">
      <button class="prof-btn prof-btn-sm prof-btn-danger-sm" data-rm-social="${i}" title="Remove">✕</button>
    </div>`;
}

// ─────────────────────────────────────────────────────────────
// EVENTI (solo profilo proprio)
// ─────────────────────────────────────────────────────────────
let _favIds = [null, null, null]; // slot 0-2
let _editingSlot = null;

function wireEvents(user, profile, publishedDecks) {
  // ripristina stato fav ids
  const storedIds = profile.favorite_card_ids
    ? (Array.isArray(profile.favorite_card_ids) ? profile.favorite_card_ids : []).slice(0, 3).map(String)
    : (profile.favorite_card_id ? [String(profile.favorite_card_id)] : []);
  _favIds = [storedIds[0] || null, storedIds[1] || null, storedIds[2] || null];

  // Bio char count
  const bioTA    = document.getElementById('prof-bio');
  const bioCount = document.getElementById('prof-bio-count');
  bioTA?.addEventListener('input', () => { if (bioCount) bioCount.textContent = bioTA.value.length; });

  // Avatar
  const avatarBtn   = document.getElementById('prof-avatar-btn');
  const avatarInput = document.getElementById('prof-avatar-input');
  avatarBtn?.addEventListener('click', () => avatarInput?.click());
  avatarInput?.addEventListener('change', async () => {
    const file = avatarInput.files?.[0];
    if (!file) return;
    await uploadAvatar(user, file);
  });

  // Slot carte preferite — click per aprire ricerca
  document.querySelectorAll('.prof-fav-slot').forEach(slot => {
    slot.addEventListener('click', e => {
      if (e.target.closest('.prof-fav-slot-rm')) return; // gestito sotto
      _editingSlot = Number(slot.dataset.slot);
      const wrap = document.getElementById('prof-fav-search-wrap');
      if (wrap) {
        wrap.style.display = 'block';
        document.getElementById('prof-fav-search')?.focus();
      }
    });
  });

  // Rimuovi carta da slot
  document.querySelectorAll('.prof-fav-slot-rm').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const i = Number(btn.dataset.slot);
      _favIds[i] = null;
      refreshFavSlots();
    });
  });

  // Ricerca carta
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
        if (_editingSlot !== null) {
          _favIds[_editingSlot] = item.dataset.id;
          refreshFavSlots();
        }
        favSearch.value = '';
        favDropdown.innerHTML = '';
        favDropdown.classList.remove('open');
        const wrap = document.getElementById('prof-fav-search-wrap');
        if (wrap) wrap.style.display = 'none';
        _editingSlot = null;
      });
    });
  });

  document.addEventListener('click', e => {
    if (!favSearch?.contains(e.target) && !favDropdown?.contains(e.target)) {
      favDropdown?.classList.remove('open');
    }
  }, { capture: true });

  // Social: aggiungi riga
  let _socialCount = document.querySelectorAll('.prof-social-row').length;
  document.getElementById('prof-add-social')?.addEventListener('click', () => {
    const list = document.getElementById('prof-socials-list');
    if (!list || _socialCount >= 6) return;
    const row = document.createElement('div');
    row.innerHTML = socialRowHtml(_socialCount, '', '');
    list.appendChild(row.firstElementChild);
    wireRemoveSocialBtn(list.lastElementChild);
    _socialCount++;
  });

  // Social: rimuovi riga esistenti
  document.querySelectorAll('[data-rm-social]').forEach(btn => wireRemoveSocialBtn(btn.closest('.prof-social-row')));

  // Salva
  document.getElementById('prof-save')?.addEventListener('click', () => saveProfile(user));

  // Published decks cliccabili
  wirePublishedDecks(document, publishedDecks);
}

function wireRemoveSocialBtn(row) {
  if (!row) return;
  row.querySelector('[data-rm-social]')?.addEventListener('click', () => row.remove());
}

function refreshFavSlots() {
  const container = document.getElementById('prof-fav-slots');
  if (!container) return;
  container.innerHTML = [0, 1, 2].map(i => {
    const card = _favIds[i] ? CardDatabase.find(c => c.id === _favIds[i]) : null;
    return `
      <div class="prof-fav-slot${card ? '' : ' prof-fav-slot-empty'}" data-slot="${i}">
        ${card
          ? `<img src="${card.image}" alt="${esc(card.name)}" class="prof-fav-slot-img" title="${esc(card.name)}">`
          : `<span class="prof-fav-slot-plus">+</span>`}
        <button class="prof-fav-slot-rm${card ? '' : ' hidden'}" data-slot="${i}" title="Rimuovi">✕</button>
      </div>`;
  }).join('');

  // re-wire slot events
  container.querySelectorAll('.prof-fav-slot').forEach(slot => {
    slot.addEventListener('click', e => {
      if (e.target.closest('.prof-fav-slot-rm')) return;
      _editingSlot = Number(slot.dataset.slot);
      const wrap = document.getElementById('prof-fav-search-wrap');
      if (wrap) { wrap.style.display = 'block'; document.getElementById('prof-fav-search')?.focus(); }
    });
  });
  container.querySelectorAll('.prof-fav-slot-rm').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      _favIds[Number(btn.dataset.slot)] = null;
      refreshFavSlots();
    });
  });
}

// Published decks cliccabili → modale (funziona sia sul profilo proprio che pubblico)
function wirePublishedDecks(root, decks) {
  root.querySelectorAll('.prof-deck-chip[data-deck-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const deck = decks.find(d => String(d.id) === btn.dataset.deckId);
      if (deck) openDeckModal(deck);
    });
  });
}

// ─────────────────────────────────────────────────────────────
// MODALE DETTAGLIO MAZZO (replica stile publicdeck)
// ─────────────────────────────────────────────────────────────
function openDeckModal(deck) {
  const commander = CardMap.get(String(deck.commander_id));
  const colorHex  = COLOR_HEX[deck.commander_color] || COLOR_HEX.colorless;

  const buildSection = (label, ids) => {
    if (!ids || !ids.length) return '';
    const counts = {};
    ids.forEach(id => { counts[id] = (counts[id] || 0) + 1; });
    const rows = Object.entries(counts).map(([id, qty]) => {
      const card = CardMap.get(String(id));
      const name = card ? esc(card.name) : `#${id}`;
      const qtyStr = qty > 1 ? `<span class="pdm-qty">×${qty}</span>` : '';
      const dot = card ? `<span class="pdm-dot" style="background:${COLOR_HEX[card.color]||COLOR_HEX.colorless}"></span>` : '';
      return `<div class="pdm-row" data-card-id="${id}">${dot}<span class="pdm-name">${name}</span>${qtyStr}</div>`;
    }).join('');
    return `<div class="pdm-section"><div class="pdm-sec-label">${label}</div>${rows}</div>`;
  };

  const cmdSection = commander ? `
    <div class="pdm-section">
      <div class="pdm-sec-label">COMMANDER</div>
      <div class="pdm-row pdm-row-cmd" data-card-id="${esc(deck.commander_id)}">
        <span class="pdm-dot" style="background:${colorHex}"></span>
        <span class="pdm-name">${esc(commander.name)}</span>
      </div>
    </div>` : '';

  const overlay = document.createElement('div');
  overlay.className = 'pdm-overlay';
  overlay.innerHTML = `
    <div class="pdm-modal">
      <div class="pdm-header" style="--pdm-color:${colorHex}">
        <div class="pdm-header-bg" ${commander?.image ? `style="background-image:url('${commander.image}')"` : ''}></div>
        <div class="pdm-header-overlay"></div>
        <div class="pdm-header-content">
          <div class="pdm-title">${esc(deck.name)}</div>
        </div>
        <button class="pdm-close" id="pdm-prof-close">✕</button>
      </div>
      <div class="pdm-body">
        <div class="pdm-list">
          ${cmdSection}
          ${buildSection('MAIN DECK', deck.cards)}
          ${buildSection('TERRITORY', deck.territory_cards)}
          ${buildSection('SIDEBOARD', deck.sideboard_cards)}
        </div>
        <div class="pdm-actions">
          <button class="pdm-btn" id="pdm-prof-exp-code">Export code</button>
          <button class="pdm-btn" id="pdm-prof-exp-img">Export img</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  // card hover preview
  const tt = document.createElement('div');
  tt.className = 'pdm-card-tt';
  tt.setAttribute('aria-hidden', 'true');
  tt.innerHTML = `<img class="pdm-card-tt-img" src="" alt="">`;
  document.body.appendChild(tt);
  const ttImg = tt.querySelector('.pdm-card-tt-img');
  const moveTT = e => {
    const w = 220, m = 10;
    let x = e.clientX + 16, y = e.clientY - 110;
    if (x + w + m > window.innerWidth)  x = e.clientX - w - 10;
    if (x < m) x = m;
    if (y + 308 + m > window.innerHeight) y = window.innerHeight - 308 - m;
    if (y < m) y = m;
    tt.style.left = x + 'px'; tt.style.top = y + 'px';
  };
  overlay.querySelectorAll('.pdm-row[data-card-id]').forEach(row => {
    const card = CardMap.get(row.dataset.cardId);
    if (!card) return;
    row.addEventListener('mouseenter', e => { ttImg.src = card.image; tt.removeAttribute('aria-hidden'); moveTT(e); });
    row.addEventListener('mousemove', moveTT);
    row.addEventListener('mouseleave', () => tt.setAttribute('aria-hidden', 'true'));
  });

  const close = () => { overlay.remove(); tt.remove(); };
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.getElementById('pdm-prof-close').addEventListener('click', close);

  // export code
  document.getElementById('pdm-prof-exp-code').addEventListener('click', () => {
    const code = encodeDeck(deck);
    const el = document.createElement('div');
    el.className = 'pdm-overlay';
    el.innerHTML = `<div class="pdm-modal pdm-modal-sm">
      <div class="pdm-exp-title">Deck code — copy and share:</div>
      <div class="pdm-exp-row">
        <input class="pdm-exp-inp" id="pdm-exp-inp2" type="text" readonly value="${esc(code)}">
        <button class="pdm-btn pdm-btn-primary" id="pdm-exp-copy2">Copy</button>
      </div>
      <button class="pdm-btn" id="pdm-exp-close2" style="margin-top:12px">Close</button>
    </div>`;
    document.body.appendChild(el);
    el.addEventListener('click', e => { if (e.target === el) el.remove(); });
    document.getElementById('pdm-exp-close2').addEventListener('click', () => el.remove());
    document.getElementById('pdm-exp-copy2').addEventListener('click', () => {
      navigator.clipboard?.writeText(code).catch(() => {});
      showGlobalToast('Code copied!', 'success');
    });
  });

  // export img
  document.getElementById('pdm-prof-exp-img').addEventListener('click', () => {
    exportDeckImageSimple(deck);
  });
}

function encodeDeck(deck) {
  const countIds = ids => {
    const m = {};
    ids.forEach(id => { m[id] = (m[id] || 0) + 1; });
    return Object.entries(m).sort(([a],[b]) => Number(a)-Number(b)).map(([id,n]) => `${id}:${n}`).join(',');
  };
  const sortIds = ids => [...new Set(ids)].sort((a,b) => Number(a)-Number(b)).join(',');
  const raw = [
    deck.commander_id || '',
    countIds(deck.cards || []),
    sortIds(deck.territory_cards || []),
    countIds(deck.sideboard_cards || []),
  ].join('|');
  return btoa(unescape(encodeURIComponent(raw))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
}

async function exportDeckImageSimple(deck) {
  const CARD_W = 140, CARD_H = 194, GAP = 12, PAD = 48, CANVAS_W = 1600;
  const allIds = [...new Set([
    ...(deck.commander_id ? [String(deck.commander_id)] : []),
    ...(deck.cards || []).map(String),
    ...(deck.territory_cards || []).map(String),
    ...(deck.sideboard_cards || []).map(String),
  ])];
  const imgMap = {};
  await Promise.all(allIds.map(id => {
    const card = CardMap.get(id);
    if (!card?.image) return Promise.resolve();
    return new Promise(resolve => {
      const img = new Image(); img.crossOrigin = 'anonymous';
      img.onload = () => { imgMap[id] = img; resolve(); };
      img.onerror = resolve;
      img.src = card.image;
    });
  }));

  const MAIN_COLS = Math.max(1, Math.floor((CANVAS_W - PAD*2 + GAP) / (CARD_W + GAP)));
  const sections = [
    { label: 'COMMANDER', ids: deck.commander_id ? [String(deck.commander_id)] : [], counts: {} },
    ...['MAIN DECK','TERRITORY','SIDEBOARD'].map((l, i) => {
      const raw = [deck.cards, deck.territory_cards, deck.sideboard_cards][i] || [];
      const counts = {}; raw.forEach(id => { counts[id] = (counts[id]||0)+1; });
      return { label: l, ids: [...new Set(raw.map(String))], counts };
    }),
  ].filter(s => s.ids.length);

  let totalH = 80;
  sections.forEach(s => { totalH += 32 + Math.ceil(s.ids.length/MAIN_COLS)*(CARD_H+GAP) + 30; });
  totalH += PAD;

  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_W; canvas.height = totalH;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0d1117'; ctx.fillRect(0, 0, CANVAS_W, totalH);
  ctx.fillStyle = '#e8e8e8'; ctx.font = 'bold 54px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(deck.name, CANVAS_W/2, 52);

  let y = 80;
  sections.forEach(s => {
    ctx.fillStyle = '#aaaaaa'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(s.label, PAD, y + 22);
    s.ids.forEach((id, i) => {
      const card = CardMap.get(id);
      const x = PAD + (i % MAIN_COLS) * (CARD_W + GAP);
      const cy = y + 32 + Math.floor(i/MAIN_COLS)*(CARD_H+GAP);
      if (imgMap[id]) {
        ctx.drawImage(imgMap[id], x, cy, CARD_W, CARD_H);
      } else {
        ctx.fillStyle = '#333'; ctx.fillRect(x, cy, CARD_W, CARD_H);
        if (card) { ctx.fillStyle = '#fff'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(card.name, x+CARD_W/2, cy+CARD_H/2); ctx.textAlign = 'left'; }
      }
      const qty = s.counts[id] || 1;
      if (qty > 1) {
        ctx.fillStyle = 'rgba(0,0,0,0.82)'; ctx.fillRect(x+CARD_W-26, cy+5, 22, 22);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(`×${qty}`, x+CARD_W-15, cy+19); ctx.textAlign = 'left';
      }
    });
    y += 32 + Math.ceil(s.ids.length/MAIN_COLS)*(CARD_H+GAP) + 30;
  });

  try {
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.download = `${(deck.name||'deck').replace(/[^\w\s-]/g,'').replace(/\s+/g,'_')}.png`;
    a.href = url; a.click();
  } catch { showGlobalToast('Export failed (CORS).', 'error'); }
}

// ─────────────────────────────────────────────────────────────
// UPLOAD AVATAR
// ─────────────────────────────────────────────────────────────
async function uploadAvatar(user, file) {
  const ext  = file.type === 'image/png' ? 'png' : 'jpg';
  const path = `avatars/${user.id}.${ext}`;

  const { error: upErr } = await db.storage.from('avatars').upload(path, file, {
    upsert: true, contentType: file.type,
  });
  if (upErr) { showGlobalToast(`Upload error: ${upErr.message}`, 'error'); return; }

  const { data: urlData } = db.storage.from('avatars').getPublicUrl(path);
  const publicUrl = urlData?.publicUrl;
  if (!publicUrl) { showGlobalToast('Avatar URL unavailable.', 'error'); return; }

  const { error: updErr } = await db.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id);
  if (updErr) { showGlobalToast('Error updating profile.', 'error'); return; }

  const display = document.getElementById('prof-avatar-display');
  if (display) display.innerHTML = `<img src="${publicUrl}?t=${Date.now()}" alt="avatar" class="prof-avatar-img">`;
  showGlobalToast('Photo updated.', 'success');
}

// ─────────────────────────────────────────────────────────────
// SALVA PROFILO
// ─────────────────────────────────────────────────────────────
async function saveProfile(user) {
  const bio = document.getElementById('prof-bio')?.value.trim() || '';

  // social links: legge tutte le righe presenti
  const socialLinks = [];
  document.querySelectorAll('#prof-socials-list .prof-social-row').forEach(row => {
    const label = row.querySelector('.prof-social-label-inp')?.value.trim() || '';
    const url   = row.querySelector('.prof-social-url-inp')?.value.trim()   || '';
    if (label || url) socialLinks.push({ label, url });
  });

  // fav ids puliti (max 3, senza null)
  const favIds = _favIds.filter(Boolean).map(Number);

  const payload = {
    bio,
    social_links:        socialLinks,
    favorite_card_ids:   _favIds.filter(Boolean),
    // mantieni retrocompatibilità con vecchio campo singolo
    favorite_card_id:    favIds[0] || null,
    social_label:        socialLinks[0]?.label || '',
    social_url:          socialLinks[0]?.url   || '',
  };

  const { error } = await db.from('profiles').update(payload).eq('id', user.id);
  if (error) {
    showGlobalToast('Error saving profile.', 'error');
    console.warn('saveProfile:', error.message);
    return;
  }
  showGlobalToast('Saved!', 'success');
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
  text-align: center; color: var(--text-secondary); padding: 80px 0;
  font-size: 15px; display: flex; flex-direction: column; align-items: center; gap: 18px;
}

/* ══ HEADER ══════════════════════════════════════════════════ */
.prof-header {
  display: flex; align-items: center; gap: 28px;
  margin-bottom: 40px; padding-bottom: 28px; border-bottom: 1px solid var(--border);
}
.prof-avatar-wrap { position: relative; flex-shrink: 0; }
.prof-avatar {
  width: 90px; height: 90px; border-radius: 50%; overflow: hidden;
  background: var(--bg-elevated); border: 2px solid var(--border);
  display: flex; align-items: center; justify-content: center;
}
.prof-avatar-img { width: 100%; height: 100%; object-fit: cover; }
.prof-avatar-placeholder {
  font-family: 'Cinzel', serif; font-size: 36px; font-weight: 700; color: var(--text-secondary);
}
.prof-avatar-edit-btn {
  position: absolute; bottom: 0; right: 0; width: 28px; height: 28px;
  border-radius: 50%; border: 1px solid var(--border); background: var(--bg-elevated);
  color: var(--text-primary); cursor: pointer; display: flex; align-items: center;
  justify-content: center; transition: background 0.15s;
}
.prof-avatar-edit-btn:hover { background: var(--violet); border-color: var(--violet); }
.prof-avatar-edit-btn svg { width: 14px; height: 14px; fill: currentColor; }
.prof-header-info { display: flex; flex-direction: column; gap: 6px; }
.prof-username { font-family: 'Cinzel', serif; font-size: 26px; font-weight: 700; color: var(--text-primary); }
.prof-social-link { font-size: 13px; color: var(--violet-bright, #c5bbd0); text-decoration: none; transition: color 0.15s; }
.prof-social-link:hover { color: #fff; }

/* ══ BODY ════════════════════════════════════════════════════ */
.prof-body { display: flex; flex-direction: column; gap: 32px; }
.prof-section { display: flex; flex-direction: column; gap: 10px; }
.prof-section-label { font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--text-secondary); }
.prof-bio-readonly { font-size: 14px; color: var(--text-secondary); line-height: 1.6; margin: 0; }
.prof-empty-text { opacity: 0.4; }

/* ══ INPUTS ══════════════════════════════════════════════════ */
.prof-input {
  background: var(--bg-elevated); border: 1px solid var(--border); border-radius: 8px;
  color: var(--text-primary); font-size: 14px; padding: 9px 13px; outline: none;
  transition: border-color 0.15s; width: 100%; box-sizing: border-box;
}
.prof-input:focus { border-color: var(--violet); }
.prof-textarea {
  background: var(--bg-elevated); border: 1px solid var(--border); border-radius: 8px;
  color: var(--text-primary); font-size: 14px; padding: 10px 13px; outline: none;
  transition: border-color 0.15s; width: 100%; box-sizing: border-box;
  resize: vertical; min-height: 90px; font-family: inherit; line-height: 1.5;
}
.prof-textarea:focus { border-color: var(--violet); }
.prof-char-count { font-size: 11px; color: var(--text-secondary); text-align: right; }

/* ══ SOCIAL ROWS ═════════════════════════════════════════════ */
#prof-socials-list { display: flex; flex-direction: column; gap: 8px; }
.prof-social-row { display: flex; gap: 8px; align-items: center; }
.prof-social-label-inp { flex: 1; }
.prof-social-url-inp   { flex: 2; }

/* ══ CARTE PREFERITE ════════════════════════════════════════ */
.prof-fav-slots { display: flex; gap: 14px; flex-wrap: wrap; }
.prof-fav-slot {
  position: relative; width: 90px; height: 126px; border-radius: 8px;
  border: 1.5px solid var(--border); background: var(--bg-elevated);
  overflow: hidden; cursor: pointer; transition: border-color 0.15s;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.prof-fav-slot:hover { border-color: var(--violet); }
.prof-fav-slot-empty { border-style: dashed; }
.prof-fav-slot-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.prof-fav-slot-plus { font-size: 28px; color: var(--text-secondary); opacity: 0.4; line-height: 1; }
.prof-fav-slot-rm {
  position: absolute; top: 4px; right: 4px; width: 18px; height: 18px;
  border-radius: 50%; background: rgba(0,0,0,0.65); border: none;
  color: #fff; font-size: 9px; cursor: pointer; display: flex;
  align-items: center; justify-content: center; line-height: 1;
  opacity: 0; transition: opacity 0.12s; padding: 0;
}
.prof-fav-slot:hover .prof-fav-slot-rm { opacity: 1; }
.prof-fav-slot-rm.hidden { display: none; }

.prof-fav-search-wrap { position: relative; max-width: 320px; margin-top: 6px; }
.prof-fav-dropdown {
  display: none; position: absolute; top: calc(100% + 4px); left: 0; right: 0;
  background: rgba(11,11,22,0.98); border: 1px solid var(--border-gold);
  border-radius: 8px; z-index: 200; max-height: 220px; overflow-y: auto;
  box-shadow: 0 8px 24px rgba(0,0,0,0.6);
}
.prof-fav-dropdown.open { display: block; }
.prof-fav-item { padding: 9px 14px; font-size: 13px; color: var(--text-primary); cursor: pointer; transition: background 0.12s; }
.prof-fav-item:hover { background: rgba(255,255,255,0.07); }

/* ══ PUBLISHED DECKS ════════════════════════════════════════ */
.prof-decks-grid { display: flex; flex-wrap: wrap; gap: 8px; }
.prof-deck-chip {
  padding: 6px 14px; background: var(--bg-elevated); border: 1px solid var(--border);
  border-left: 4px solid; border-radius: 6px; font-size: 13px; color: var(--text-primary);
  cursor: pointer; transition: border-color 0.15s, background 0.15s; text-align: left;
}
.prof-deck-chip:hover { background: var(--bg-surface); border-color: var(--border-gold); }
.prof-deck-empty { font-size: 13px; color: var(--text-secondary); }

/* ══ ACTIONS ═════════════════════════════════════════════════ */
.prof-actions { display: flex; justify-content: flex-end; }
.prof-btn {
  background: var(--bg-elevated); border: 1px solid var(--border); border-radius: 8px;
  color: var(--text-primary); font-size: 14px; padding: 10px 24px; cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.prof-btn:hover { border-color: var(--violet); }
.prof-btn-primary { background: var(--violet); border-color: var(--violet); color: #fff; }
.prof-btn-primary:hover { background: var(--violet-bright); border-color: var(--violet-bright); }
.prof-btn-sm { padding: 6px 14px; font-size: 12px; border-radius: 6px; white-space: nowrap; flex-shrink: 0; }
.prof-btn-danger-sm { color: var(--error); border-color: var(--error); background: transparent; }
.prof-btn-danger-sm:hover { background: rgba(200,112,112,0.12); }

/* ══ PROFILO PUBBLICO OVERLAY ════════════════════════════════ */
.prof-pub-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.72); z-index: 1000;
  display: flex; align-items: center; justify-content: center; padding: 20px;
}
.prof-pub-modal {
  background: var(--bg-elevated); border: 1px solid var(--border); border-radius: 14px;
  width: 100%; max-width: 600px; max-height: 90vh; overflow-y: auto;
  box-shadow: 0 24px 64px rgba(0,0,0,0.8); position: relative;
}
.prof-pub-close {
  position: absolute; top: 12px; right: 14px; z-index: 2;
  background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.15);
  border-radius: 50%; color: #fff; width: 28px; height: 28px; cursor: pointer;
  font-size: 13px; display: flex; align-items: center; justify-content: center;
  transition: background 0.15s;
}
.prof-pub-close:hover { background: rgba(255,255,255,0.15); }

/* ══ RESPONSIVE ══════════════════════════════════════════════ */
@media (max-width: 600px) {
  .prof-header { flex-direction: column; align-items: flex-start; }
  .prof-social-row { flex-wrap: wrap; }
  .prof-fav-slots { gap: 10px; }
  .prof-fav-slot { width: 76px; height: 106px; }
}
  `;
  document.head.appendChild(s);
}
