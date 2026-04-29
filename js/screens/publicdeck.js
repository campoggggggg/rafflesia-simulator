// ============================================================
// screens/publicdeck.js — Schermata mazzi pubblici.
// ============================================================

import { db }           from '../core/supabase-client.js';
import { CardDatabase } from '../data/cards.js';
import { AppState }     from '../core/state.js';
import { getUser }      from '../auth/auth.js';
import { navigateTo }   from '../core/router.js';
import { saveDeckToSupabase } from '../data/decks.js';
import { showGlobalToast }    from '../core/ui.js';

// ── Costanti colore commander (stesse del deckbuilder) ────────
const COLOR_HEX = {
  blue:      '#336699',
  green:     '#385400',
  red:       '#8A0000',
  black:     '#595959',
  colorless: '#A19993',
};

// ── Stato filtri ──────────────────────────────────────────────
let _filters = { name: '', colors: [], tags: '' };
let _orderBy = 'date';
let _orderDir = 'desc';
let _decks = [];

// ─────────────────────────────────────────────────────────────
// RENDER PRINCIPALE
// ─────────────────────────────────────────────────────────────
export async function renderPublicDeckScreen() {
  const screen = document.getElementById('screen-publicdeck');
  if (!screen) return;

  screen.innerHTML = buildSkeleton();
  injectStyles();
  wireFilters();
  await loadAndRender();
}

// ─────────────────────────────────────────────────────────────
// CARICAMENTO DATI
// ─────────────────────────────────────────────────────────────
async function loadAndRender() {
  const grid = document.getElementById('pd-grid');
  if (!grid) return;

  grid.innerHTML = `<div class="pd-loading">Caricamento mazzi…</div>`;

  try {
    let query = db
      .from('public_decks')
      .select('*');

    if (_orderBy === 'name') {
      query = query.order('name', { ascending: _orderDir === 'asc' });
    } else {
      query = query.order('created_at', { ascending: _orderDir === 'asc' });
    }

    const { data, error } = await query;
    if (error) throw error;

    _decks = data || [];
    renderGrid(_applyClientFilters(_decks));
  } catch (err) {
    console.warn('Errore caricamento public decks:', err.message);
    grid.innerHTML = `<div class="pd-loading pd-error">Impossibile caricare i mazzi. Riprova.</div>`;
  }
}

function _applyClientFilters(decks) {
  return decks.filter(d => {
    if (_filters.name && !d.name.toLowerCase().includes(_filters.name.toLowerCase())) return false;
    if (_filters.colors.length > 0 && !_filters.colors.includes(d.commander_color)) return false;
    if (_filters.tags && !(d.tags || []).some(t => t.toLowerCase().includes(_filters.tags.toLowerCase()))) return false;
    return true;
  });
}

// ─────────────────────────────────────────────────────────────
// RENDER GRIGLIA
// ─────────────────────────────────────────────────────────────
function renderGrid(decks) {
  const grid = document.getElementById('pd-grid');
  if (!grid) return;

  if (decks.length === 0) {
    grid.innerHTML = `<div class="pd-loading">Nessun mazzo trovato.</div>`;
    return;
  }

  grid.innerHTML = decks.map(d => buildCard(d)).join('');

  grid.querySelectorAll('.pd-card').forEach(el => {
    el.addEventListener('click', () => onCardClick(el.dataset.deckId));
  });
}

function buildCard(d) {
  const commander = CardDatabase.find(c => String(c.id) === String(d.commander_id));
  const colorHex  = COLOR_HEX[d.commander_color] || COLOR_HEX.colorless;
  const imgSrc    = commander ? commander.image : '';
  const dateStr   = d.created_at ? new Date(d.created_at).toLocaleDateString('it-IT') : '—';
  const tags      = (d.tags || []).filter(Boolean);

  // Immagine: centrata su 1070×800, offset 67×67
  const bgStyle = imgSrc
    ? `background-image: url('${imgSrc}');
       background-size: 1070px 800px;
       background-position: -67px -67px;`
    : `background: ${colorHex};`;

  const tagsHtml = tags.length
    ? `<div class="pd-card-tags">
         <span class="pd-tag-icon">🏷</span>
         ${tags.map(t => `<span class="pd-tag">${esc(t)}</span>`).join('')}
       </div>`
    : '';

  return `
    <div class="pd-card" data-deck-id="${esc(d.id)}">
      <div class="pd-card-img" style="${bgStyle}">
        <div class="pd-card-img-overlay"></div>
      </div>
      <div class="pd-card-color-bar" style="background: ${colorHex};"></div>
      <div class="pd-card-info">
        <div class="pd-card-name">${esc(d.name)}</div>
        <div class="pd-card-meta">${esc(d.author_username || 'Anonimo')}</div>
        <div class="pd-card-meta pd-card-date">${dateStr}</div>
        ${tagsHtml}
      </div>
    </div>`;
}

// ─────────────────────────────────────────────────────────────
// CLICK SU SCHEDA → crea mazzo e apre deckbuilder
// ─────────────────────────────────────────────────────────────
async function onCardClick(deckId) {
  const publicDeck = _decks.find(d => String(d.id) === String(deckId));
  if (!publicDeck) return;

  const user = await getUser();
  if (!user) {
    showGlobalToast('Accedi per importare un mazzo nel tuo deck builder.', 'error');
    navigateTo('auth');
    return;
  }

  const newDeck = {
    name:           publicDeck.name,
    commanderId:    publicDeck.commander_id || null,
    cards:          publicDeck.cards          || [],
    territoryCards: publicDeck.territory_cards || [],
    sideboardCards: publicDeck.sideboard_cards || [],
  };

  await saveDeckToSupabase(newDeck);

  AppState.decks.push(newDeck);
  AppState.currentDeckId = newDeck.id;

  showGlobalToast(`"${publicDeck.name}" importato nel tuo deck builder.`, 'success');
  navigateTo('deckbuilder');
}

// ─────────────────────────────────────────────────────────────
// EVENTI FILTRI
// ─────────────────────────────────────────────────────────────
function wireFilters() {
  document.getElementById('pd-filter-name')?.addEventListener('input', e => {
    _filters.name = e.target.value;
    renderGrid(_applyClientFilters(_decks));
  });

  document.getElementById('pd-filter-tags')?.addEventListener('input', e => {
    _filters.tags = e.target.value;
    renderGrid(_applyClientFilters(_decks));
  });

  document.getElementById('pd-order-by')?.addEventListener('change', e => {
    _orderBy = e.target.value;
    loadAndRender();
  });

  document.getElementById('pd-order-dir')?.addEventListener('change', e => {
    _orderDir = e.target.value;
    loadAndRender();
  });

  document.querySelectorAll('.pd-color-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const color = btn.dataset.color;
      btn.classList.toggle('active');
      if (_filters.colors.includes(color)) {
        _filters.colors = _filters.colors.filter(c => c !== color);
      } else {
        _filters.colors.push(color);
      }
      renderGrid(_applyClientFilters(_decks));
    });
  });
}

// ─────────────────────────────────────────────────────────────
// HTML SKELETON
// ─────────────────────────────────────────────────────────────
function buildSkeleton() {
  const colorButtons = ['blue', 'green', 'red', 'black', 'colorless'].map(c => `
    <button class="pd-color-btn" data-color="${c}" title="${c}" style="background:${COLOR_HEX[c]};"></button>
  `).join('');

  return `
<div class="pd-root">

  <!-- TOOLBAR FILTRI -->
  <div class="pd-toolbar">
    <div class="pd-toolbar-left">
      <div class="pd-fg">
        <label class="pd-fl">Nome mazzo</label>
        <input class="pd-fi" id="pd-filter-name" type="text" placeholder="cerca nome…">
      </div>
      <div class="pd-fg">
        <label class="pd-fl">Colore</label>
        <div class="pd-color-row">${colorButtons}</div>
      </div>
      <div class="pd-fg">
        <label class="pd-fl">Tag</label>
        <input class="pd-fi" id="pd-filter-tags" type="text" placeholder="cerca tag…">
      </div>
    </div>
    <div class="pd-toolbar-right">
      <div class="pd-fg">
        <label class="pd-fl">Ordina per</label>
        <select class="pd-fi" id="pd-order-by">
          <option value="date">Data</option>
          <option value="name">A–Z</option>
        </select>
      </div>
      <div class="pd-fg">
        <label class="pd-fl">Direzione</label>
        <select class="pd-fi" id="pd-order-dir">
          <option value="desc">DESC</option>
          <option value="asc">ASC</option>
        </select>
      </div>
    </div>
  </div>

  <!-- GRIGLIA -->
  <div class="pd-grid" id="pd-grid"></div>

</div>`;
}

// ─────────────────────────────────────────────────────────────
// UTILITY
// ─────────────────────────────────────────────────────────────
function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─────────────────────────────────────────────────────────────
// CSS (iniettato una sola volta)
// ─────────────────────────────────────────────────────────────
function injectStyles() {
  if (document.getElementById('pd-styles')) return;
  const style = document.createElement('style');
  style.id = 'pd-styles';
  style.textContent = `

/* ═══ ROOT ══════════════════════════════════════════════════ */
.pd-root {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 24px 28px 48px;
  max-width: 1300px;
  margin: 0 auto;
}

/* ═══ TOOLBAR ════════════════════════════════════════════════ */
.pd-toolbar {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 24px;
}

.pd-toolbar-left  { display: flex; align-items: flex-end; gap: 16px; flex-wrap: wrap; }
.pd-toolbar-right { display: flex; align-items: flex-end; gap: 16px; flex-wrap: wrap; }

.pd-fg { display: flex; flex-direction: column; gap: 5px; }
.pd-fl { font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--text-secondary); }

.pd-fi {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 13px;
  padding: 6px 10px;
  outline: none;
  transition: border-color 0.15s;
}
.pd-fi:focus { border-color: var(--violet); }

.pd-color-row { display: flex; gap: 6px; align-items: center; }

.pd-color-btn {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: border-color 0.15s, transform 0.1s;
  flex-shrink: 0;
}
.pd-color-btn:hover  { transform: scale(1.15); }
.pd-color-btn.active { border-color: var(--violet-bright); box-shadow: 0 0 6px rgba(197,187,208,0.5); }

/* ═══ GRIGLIA ════════════════════════════════════════════════ */
.pd-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 20px;
}

.pd-loading {
  grid-column: 1 / -1;
  text-align: center;
  color: var(--text-secondary);
  padding: 60px 0;
  font-size: 14px;
}
.pd-error { color: var(--error); }

/* ═══ SCHEDA ═════════════════════════════════════════════════ */
.pd-card {
  position: relative;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--border);
  background: var(--bg-surface);
  cursor: pointer;
  transition: transform 0.18s, box-shadow 0.18s, border-color 0.18s;
  display: flex;
  flex-direction: column;
}
.pd-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 32px rgba(0,0,0,0.55);
  border-color: var(--border-gold);
}

/* immagine commander */
.pd-card-img {
  position: relative;
  width: 100%;
  padding-top: 68%;
  background-size: 1070px 800px;
  background-position: -67px -67px;
  background-color: var(--bg-elevated);
  flex-shrink: 0;
}

.pd-card-img-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.72) 100%);
}

/* barra colore */
.pd-card-color-bar {
  height: 4px;
  width: 100%;
  flex-shrink: 0;
}

/* info testo */
.pd-card-info {
  padding: 10px 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex: 1;
}

.pd-card-name {
  font-family: 'Cinzel', serif;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pd-card-meta {
  font-size: 11px;
  color: var(--text-secondary);
}
.pd-card-date { color: var(--text-faint); font-size: 10px; }

/* tag */
.pd-card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
  margin-top: 6px;
}

.pd-tag-icon {
  font-size: 11px;
  line-height: 1;
}

.pd-tag {
  font-size: 10px;
  background: var(--violet-subtle);
  border: 1px solid rgba(155,143,160,0.25);
  border-radius: 4px;
  padding: 1px 6px;
  color: var(--violet-bright);
  white-space: nowrap;
}

/* ═══ RESPONSIVE ═════════════════════════════════════════════ */
@media (max-width: 680px) {
  .pd-toolbar { flex-direction: column; align-items: flex-start; }
  .pd-grid    { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
}

  `;
  document.head.appendChild(style);
}
