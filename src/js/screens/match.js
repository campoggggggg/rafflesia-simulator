// ============================================================
// screens/match.js — Schermata registrazione partita.
// ============================================================

import { db }              from '../core/supabase-client.js';
import { CardDatabase }    from '../data/cards.js';
import { AppState }        from '../core/state.js';
import { showGlobalToast } from '../core/ui.js';
import { getUser }         from '../auth/auth.js';
import { navigateTo }      from '../core/router.js';

// ─────────────────────────────────────────────────────────────
// STATO LOCALE
// ─────────────────────────────────────────────────────────────
let _publicDecks   = [];
let _deckA         = null;
let _deckB         = null;
let _mvpCardIds    = [];

// ─────────────────────────────────────────────────────────────
// RENDER PRINCIPALE
// ─────────────────────────────────────────────────────────────
export async function renderMatchScreen() {
  const screen = document.getElementById('screen-match');
  if (!screen) return;

  injectStyles();

  _deckA = null;
  _deckB = null;
  _mvpCardIds = [];

  screen.innerHTML = `<div class="match-root"><div class="match-loading">Caricamento mazzi pubblici…</div></div>`;

  await loadPublicDecks();
  screen.innerHTML = buildSkeleton();
  wireEvents();
}

// ─────────────────────────────────────────────────────────────
// CARICAMENTO MAZZI PUBBLICI
// ─────────────────────────────────────────────────────────────
async function loadPublicDecks() {
  try {
    const { data, error } = await db
      .from('public_decks')
      .select('id, name, author_username, commander_color')
      .order('name', { ascending: true });
    if (error) throw error;
    _publicDecks = data || [];
  } catch (err) {
    console.warn('loadPublicDecks:', err.message);
    _publicDecks = [];
  }
}

// ─────────────────────────────────────────────────────────────
// HTML SKELETON
// ─────────────────────────────────────────────────────────────
const COLOR_HEX = {
  blue: '#336699', green: '#385400', red: '#8A0000',
  black: '#262B2F', colorless: '#A19993',
};

function buildSkeleton() {
  return `
<div class="match-root">
  <div class="match-title">Registra Partita</div>

  <!-- MAZZI ─────────────────────────────────────────────── -->
  <div class="match-decks-row">

    <div class="match-deck-col">
      <div class="match-col-label">Mazzo A</div>
      <div class="match-deck-search-wrap">
        <input class="match-input" id="match-search-a" type="text" placeholder="Cerca mazzo…" autocomplete="off">
        <div class="match-deck-dropdown" id="match-dropdown-a"></div>
      </div>
      <div class="match-deck-selected" id="match-selected-a">—</div>
    </div>

    <div class="match-vs">VS</div>

    <div class="match-deck-col">
      <div class="match-col-label">Mazzo B</div>
      <div class="match-deck-search-wrap">
        <input class="match-input" id="match-search-b" type="text" placeholder="Cerca mazzo…" autocomplete="off">
        <div class="match-deck-dropdown" id="match-dropdown-b"></div>
      </div>
      <div class="match-deck-selected" id="match-selected-b">—</div>
    </div>

  </div>

  <!-- VINCITORE ─────────────────────────────────────────── -->
  <div class="match-section">
    <div class="match-section-label">Vincitore</div>
    <div class="match-winner-row">
      <button class="match-winner-btn" id="match-win-a" data-side="a">Vince A</button>
      <button class="match-winner-btn" id="match-win-b" data-side="b">Vince B</button>
      <button class="match-winner-btn" id="match-win-draw" data-side="draw">Pareggio</button>
    </div>
  </div>

  <!-- CAMPI OPZIONALI ───────────────────────────────────── -->
  <details class="match-optional" id="match-optional">
    <summary class="match-optional-summary">Informazioni opzionali</summary>
    <div class="match-optional-body">

      <div class="match-optional-grid">

        <div class="match-field">
          <label class="match-label">Giocatore A</label>
          <input class="match-input" id="match-player-a" type="text" placeholder="Nome giocatore A" maxlength="60">
        </div>

        <div class="match-field">
          <label class="match-label">Giocatore B</label>
          <input class="match-input" id="match-player-b" type="text" placeholder="Nome giocatore B" maxlength="60">
        </div>

        <div class="match-field">
          <label class="match-label">Turni</label>
          <input class="match-input match-input-sm" id="match-turns" type="number" min="1" placeholder="es. 8">
        </div>

      </div>

      <!-- MVP cards -->
      <div class="match-field">
        <label class="match-label">Carte MVP</label>
        <div class="match-mvp-search-wrap">
          <input class="match-input" id="match-mvp-search" type="text" placeholder="Cerca carta…" autocomplete="off">
          <div class="match-mvp-dropdown" id="match-mvp-dropdown"></div>
        </div>
        <div class="match-mvp-chips" id="match-mvp-chips"></div>
      </div>

      <!-- Note -->
      <div class="match-field">
        <label class="match-label">Note libere</label>
        <textarea class="match-textarea" id="match-notes" maxlength="600" placeholder="Commenti, strategie, situazioni particolari…"></textarea>
      </div>

    </div>
  </details>

  <!-- SALVA ─────────────────────────────────────────────── -->
  <div class="match-actions">
    <button class="match-btn match-btn-primary" id="match-save">Salva partita</button>
    <button class="match-btn" id="match-reset">Azzera</button>
  </div>

  <!-- STORICO ───────────────────────────────────────────── -->
  <div class="match-history-wrap">
    <div class="match-section-label" style="margin-bottom:14px">Partite recenti</div>
    <div id="match-history-list"><div class="match-history-empty">Caricamento…</div></div>
  </div>

</div>`;
}

// ─────────────────────────────────────────────────────────────
// EVENTI
// ─────────────────────────────────────────────────────────────
let _winner = null;

function wireEvents() {
  _winner = null;

  wireDeckSearch('a');
  wireDeckSearch('b');
  wireMvpSearch();
  wireWinnerButtons();
  wireReset();

  document.getElementById('match-save')?.addEventListener('click', saveMatch);

  loadHistory();
}

function wireDeckSearch(side) {
  const input    = document.getElementById(`match-search-${side}`);
  const dropdown = document.getElementById(`match-dropdown-${side}`);
  const selected = document.getElementById(`match-selected-${side}`);

  input?.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    if (!q) { dropdown.innerHTML = ''; dropdown.classList.remove('open'); return; }
    const results = _publicDecks
      .filter(d => d.name.toLowerCase().includes(q) || (d.author_username || '').toLowerCase().includes(q))
      .slice(0, 10);
    if (!results.length) { dropdown.innerHTML = ''; dropdown.classList.remove('open'); return; }
    dropdown.innerHTML = results.map(d => {
      const color = COLOR_HEX[d.commander_color] || COLOR_HEX.colorless;
      return `<div class="match-dd-item" data-id="${esc(d.id)}" style="border-left-color:${color}">
        <span class="match-dd-name">${esc(d.name)}</span>
        <span class="match-dd-author">${esc(d.author_username || '')}</span>
      </div>`;
    }).join('');
    dropdown.classList.add('open');
    dropdown.querySelectorAll('.match-dd-item').forEach(item => {
      item.addEventListener('click', () => {
        const deck = _publicDecks.find(d => String(d.id) === item.dataset.id);
        if (!deck) return;
        if (side === 'a') _deckA = deck; else _deckB = deck;
        input.value = deck.name;
        dropdown.innerHTML = '';
        dropdown.classList.remove('open');
        const color = COLOR_HEX[deck.commander_color] || COLOR_HEX.colorless;
        selected.innerHTML = `<span class="match-deck-badge" style="border-left-color:${color}">${esc(deck.name)} <span class="match-deck-author">— ${esc(deck.author_username || '')}</span></span>`;
        // Aggiorna label pulsanti vincitore
        updateWinnerLabels();
      });
    });
  });

  document.addEventListener('click', e => {
    if (!input?.contains(e.target) && !dropdown?.contains(e.target)) {
      dropdown?.classList.remove('open');
    }
  }, { capture: true });
}

function updateWinnerLabels() {
  const btnA    = document.getElementById('match-win-a');
  const btnB    = document.getElementById('match-win-b');
  if (btnA) btnA.textContent = _deckA ? `Vince "${_deckA.name}"` : 'Vince A';
  if (btnB) btnB.textContent = _deckB ? `Vince "${_deckB.name}"` : 'Vince B';
}

function wireWinnerButtons() {
  ['a', 'b', 'draw'].forEach(side => {
    document.getElementById(`match-win-${side}`)?.addEventListener('click', () => {
      _winner = side;
      document.querySelectorAll('.match-winner-btn').forEach(b => b.classList.remove('active'));
      document.getElementById(`match-win-${side}`)?.classList.add('active');
    });
  });
}

function wireMvpSearch() {
  const input    = document.getElementById('match-mvp-search');
  const dropdown = document.getElementById('match-mvp-dropdown');
  const chips    = document.getElementById('match-mvp-chips');

  input?.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    if (!q) { dropdown.innerHTML = ''; dropdown.classList.remove('open'); return; }
    const results = CardDatabase.filter(c => c.name.toLowerCase().includes(q)).slice(0, 8);
    if (!results.length) { dropdown.innerHTML = ''; dropdown.classList.remove('open'); return; }
    dropdown.innerHTML = results.map(c =>
      `<div class="match-mvp-item" data-id="${esc(c.id)}">${esc(c.name)}</div>`
    ).join('');
    dropdown.classList.add('open');
    dropdown.querySelectorAll('.match-mvp-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.dataset.id;
        if (!_mvpCardIds.includes(id)) {
          _mvpCardIds.push(id);
          renderMvpChips(chips);
        }
        input.value = '';
        dropdown.innerHTML = '';
        dropdown.classList.remove('open');
      });
    });
  });

  document.addEventListener('click', e => {
    if (!input?.contains(e.target) && !dropdown?.contains(e.target)) {
      dropdown?.classList.remove('open');
    }
  }, { capture: true });
}

function renderMvpChips(chips) {
  chips.innerHTML = _mvpCardIds.map(id => {
    const card = CardDatabase.find(c => c.id === id);
    return `<span class="match-mvp-chip" data-id="${esc(id)}">${esc(card?.name || id)} <button class="match-chip-remove" data-id="${esc(id)}">✕</button></span>`;
  }).join('');
  chips.querySelectorAll('.match-chip-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      _mvpCardIds = _mvpCardIds.filter(id => id !== btn.dataset.id);
      renderMvpChips(chips);
    });
  });
}

function wireReset() {
  document.getElementById('match-reset')?.addEventListener('click', () => {
    _deckA = null; _deckB = null; _winner = null; _mvpCardIds = [];
    ['a','b'].forEach(s => {
      const inp = document.getElementById(`match-search-${s}`);
      const sel = document.getElementById(`match-selected-${s}`);
      if (inp) inp.value = '';
      if (sel) sel.innerHTML = '—';
    });
    document.querySelectorAll('.match-winner-btn').forEach(b => b.classList.remove('active'));
    ['match-player-a','match-player-b','match-turns','match-notes','match-mvp-search'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    const chips = document.getElementById('match-mvp-chips');
    if (chips) chips.innerHTML = '';
    updateWinnerLabels();
  });
}

// ─────────────────────────────────────────────────────────────
// SALVA PARTITA
// ─────────────────────────────────────────────────────────────
async function saveMatch() {
  if (!_deckA || !_deckB) {
    showGlobalToast('Seleziona entrambi i mazzi.', 'error'); return;
  }
  if (!_winner) {
    showGlobalToast('Indica il vincitore.', 'error'); return;
  }

  const user = await getUser();

  const payload = {
    deck_a_id:    _deckA.id,
    deck_a_name:  _deckA.name,
    deck_b_id:    _deckB.id,
    deck_b_name:  _deckB.name,
    winner:       _winner,
    player_a:     document.getElementById('match-player-a')?.value.trim() || null,
    player_b:     document.getElementById('match-player-b')?.value.trim() || null,
    turns:        parseInt(document.getElementById('match-turns')?.value) || null,
    notes:        document.getElementById('match-notes')?.value.trim() || null,
    mvp_card_ids: _mvpCardIds.length ? _mvpCardIds.map(Number) : null,
    recorded_by:  user?.id || null,
    recorded_by_username: AppState.username || null,
  };

  const { error } = await db.from('matches').insert(payload);
  if (error) {
    showGlobalToast('Errore salvataggio partita.', 'error');
    console.warn('saveMatch:', error.message);
    return;
  }

  showGlobalToast('Partita salvata!', 'success');

  // Reset e ricarica storico
  document.getElementById('match-reset')?.click();
  await loadHistory();
}

// ─────────────────────────────────────────────────────────────
// STORICO
// ─────────────────────────────────────────────────────────────
async function loadHistory() {
  const list = document.getElementById('match-history-list');
  if (!list) return;

  list.innerHTML = '<div class="match-history-empty">Caricamento…</div>';

  const { data, error } = await db
    .from('matches')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error || !data?.length) {
    list.innerHTML = '<div class="match-history-empty">Nessuna partita registrata.</div>';
    return;
  }

  list.innerHTML = data.map(m => buildHistoryRow(m)).join('');
}

function buildHistoryRow(m) {
  const winnerLabel = m.winner === 'a'
    ? `<span class="match-h-win">Vince: ${esc(m.deck_a_name)}</span>`
    : m.winner === 'b'
    ? `<span class="match-h-win">Vince: ${esc(m.deck_b_name)}</span>`
    : `<span class="match-h-draw">Pareggio</span>`;

  const date = m.created_at ? new Date(m.created_at).toLocaleDateString('it-IT') : '—';

  const optional = [];
  if (m.player_a || m.player_b) optional.push(`${esc(m.player_a || '?')} vs ${esc(m.player_b || '?')}`);
  if (m.turns)                  optional.push(`${m.turns} turni`);
  if (m.recorded_by_username)   optional.push(`Registrata da ${esc(m.recorded_by_username)}`);

  const mvpHtml = (m.mvp_card_ids || []).length
    ? `<div class="match-h-mvp">MVP: ${m.mvp_card_ids.map(id => {
        const card = CardDatabase.find(c => c.id === String(id));
        return `<span class="match-h-mvp-chip">${esc(card?.name || String(id))}</span>`;
      }).join('')}</div>`
    : '';

  return `
<div class="match-h-row">
  <div class="match-h-main">
    <span class="match-h-decks">${esc(m.deck_a_name)} <span class="match-h-vs">vs</span> ${esc(m.deck_b_name)}</span>
    ${winnerLabel}
  </div>
  ${optional.length ? `<div class="match-h-meta">${optional.join(' · ')}</div>` : ''}
  ${mvpHtml}
  ${m.notes ? `<div class="match-h-notes">${esc(m.notes)}</div>` : ''}
  <div class="match-h-date">${date}</div>
</div>`;
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
  if (document.getElementById('match-styles')) return;
  const s = document.createElement('style');
  s.id = 'match-styles';
  s.textContent = `

/* ══ ROOT ════════════════════════════════════════════════════ */
.match-root {
  max-width: 860px;
  margin: 0 auto;
  padding: 48px 28px 72px;
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.match-loading {
  text-align: center;
  color: var(--text-secondary);
  padding: 80px 0;
  font-size: 15px;
}

.match-title {
  font-family: 'Cinzel', serif;
  font-size: 26px;
  font-weight: 700;
  color: var(--text-primary);
}

/* ══ SEZIONE ═════════════════════════════════════════════════ */
.match-section { display: flex; flex-direction: column; gap: 10px; }
.match-section-label {
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-secondary);
}

/* ══ MAZZI ═══════════════════════════════════════════════════ */
.match-decks-row {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 20px;
  align-items: start;
}

.match-deck-col {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.match-col-label {
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-secondary);
}

.match-vs {
  font-family: 'Cinzel', serif;
  font-size: 18px;
  font-weight: 700;
  color: var(--text-secondary);
  padding-top: 28px;
  text-align: center;
}

.match-deck-search-wrap { position: relative; }

.match-deck-dropdown, .match-mvp-dropdown {
  display: none;
  position: absolute;
  top: calc(100% + 4px);
  left: 0; right: 0;
  background: rgba(11,11,22,0.98);
  border: 1px solid var(--border-gold);
  border-radius: 8px;
  z-index: 300;
  max-height: 240px;
  overflow-y: auto;
  box-shadow: 0 8px 24px rgba(0,0,0,0.6);
}
.match-deck-dropdown.open, .match-mvp-dropdown.open { display: block; }

.match-dd-item, .match-mvp-item {
  padding: 9px 14px 9px 18px;
  font-size: 13px;
  color: var(--text-primary);
  cursor: pointer;
  display: flex;
  align-items: baseline;
  gap: 8px;
  border-left: 3px solid transparent;
  transition: background 0.12s;
}
.match-dd-item:hover, .match-mvp-item:hover { background: rgba(255,255,255,0.07); }

.match-dd-name { font-weight: 500; }
.match-dd-author { font-size: 11px; color: var(--text-secondary); }

.match-deck-selected {
  font-size: 14px;
  color: var(--text-primary);
  min-height: 24px;
}

.match-deck-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px 4px 14px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-left: 4px solid;
  border-radius: 6px;
  font-size: 13px;
}
.match-deck-author { font-size: 11px; color: var(--text-secondary); }

/* ══ VINCITORE ═══════════════════════════════════════════════ */
.match-winner-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.match-winner-btn {
  padding: 9px 20px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 13px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.match-winner-btn:hover { border-color: var(--violet); }
.match-winner-btn.active {
  background: var(--violet);
  border-color: var(--violet);
  color: #fff;
}

/* ══ OPZIONALI ═══════════════════════════════════════════════ */
.match-optional {
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--bg-elevated);
  overflow: hidden;
}

.match-optional-summary {
  padding: 13px 18px;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  list-style: none;
  display: flex;
  align-items: center;
  gap: 8px;
  user-select: none;
}
.match-optional-summary::-webkit-details-marker { display: none; }
.match-optional-summary::before {
  content: '▸';
  font-size: 11px;
  transition: transform 0.15s;
}
.match-optional[open] .match-optional-summary::before { transform: rotate(90deg); }

.match-optional-body {
  padding: 0 18px 18px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  border-top: 1px solid var(--border);
}

.match-optional-grid {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 14px;
  align-items: end;
}

.match-field { display: flex; flex-direction: column; gap: 7px; }
.match-label {
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-secondary);
}

/* ══ INPUTS ══════════════════════════════════════════════════ */
.match-input {
  background: var(--bg-surface, var(--bg-elevated));
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
.match-input:focus { border-color: var(--violet); }
.match-input-sm { max-width: 90px; }

.match-textarea {
  background: var(--bg-surface, var(--bg-elevated));
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
  min-height: 80px;
  font-family: inherit;
  line-height: 1.5;
}
.match-textarea:focus { border-color: var(--violet); }

/* ══ MVP CHIPS ═══════════════════════════════════════════════ */
.match-mvp-search-wrap { position: relative; }

.match-mvp-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}

.match-mvp-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 8px 4px 12px;
  background: rgba(155,143,160,0.15);
  border: 1px solid rgba(197,187,208,0.3);
  border-radius: 20px;
  font-size: 12px;
  color: var(--text-primary);
}

.match-chip-remove {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 10px;
  padding: 0;
  line-height: 1;
  transition: color 0.12s;
}
.match-chip-remove:hover { color: var(--error, #e05555); }

/* ══ ACTIONS ═════════════════════════════════════════════════ */
.match-actions { display: flex; gap: 10px; }

.match-btn {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 14px;
  padding: 10px 24px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.match-btn:hover { border-color: var(--violet); }

.match-btn-primary {
  background: var(--violet);
  border-color: var(--violet);
  color: #fff;
}
.match-btn-primary:hover { background: var(--violet-bright); border-color: var(--violet-bright); }

/* ══ STORICO ═════════════════════════════════════════════════ */
.match-history-wrap {
  border-top: 1px solid var(--border);
  padding-top: 28px;
}

.match-history-empty {
  color: var(--text-secondary);
  font-size: 13px;
}

.match-h-row {
  padding: 14px 0;
  border-bottom: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.match-h-main {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}

.match-h-decks {
  font-size: 14px;
  color: var(--text-primary);
  font-weight: 500;
}

.match-h-vs {
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 400;
  margin: 0 4px;
}

.match-h-win {
  font-size: 12px;
  color: #7ecba0;
  padding: 2px 8px;
  background: rgba(80,180,100,0.12);
  border-radius: 4px;
}

.match-h-draw {
  font-size: 12px;
  color: var(--text-secondary);
  padding: 2px 8px;
  background: rgba(160,160,160,0.12);
  border-radius: 4px;
}

.match-h-meta {
  font-size: 12px;
  color: var(--text-secondary);
}

.match-h-mvp {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  align-items: center;
  font-size: 12px;
  color: var(--text-secondary);
}

.match-h-mvp-chip {
  padding: 1px 7px;
  background: rgba(155,143,160,0.15);
  border: 1px solid rgba(197,187,208,0.25);
  border-radius: 4px;
  font-size: 11px;
  color: var(--text-primary);
}

.match-h-notes {
  font-size: 12px;
  color: var(--text-secondary);
  font-style: italic;
  white-space: pre-wrap;
}

.match-h-date {
  font-size: 11px;
  color: var(--text-secondary);
  opacity: 0.6;
}

/* ══ RESPONSIVE ══════════════════════════════════════════════ */
@media (max-width: 640px) {
  .match-decks-row { grid-template-columns: 1fr; }
  .match-vs { padding-top: 0; }
  .match-optional-grid { grid-template-columns: 1fr; }
}
  `;
  document.head.appendChild(s);
}
