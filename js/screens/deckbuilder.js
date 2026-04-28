// deckbuilder.js — riscritto da zero

import { AppState, getCurrentDeck }          from '../core/state.js';
import { saveDecks, deleteDeckFromSupabase } from '../data/decks.js';
import { CardDatabase }                      from '../data/cards.js';

// ── Stato modulo ──────────────────────────────────────────────
let addMode  = 'main'; // 'main' | 'side'
let orderBy  = 'name-asc';
let filters  = {
  name: '', text: '', type: '', subtype: '',
  colors: [], rarities: [],
  neutralMin: '', neutralMax: '', colorMin: '', colorMax: '',
};

const MAX_MAIN      = 29;
const MAX_TERRITORY = 12;
const MAX_SIDE      = 10;
const ALL_COLORS    = ['blue', 'green', 'red', 'black', 'colorless'];
const COLOR_HEX     = {
  blue:      '#60a5fa',
  green:     '#4ade80',
  red:       '#f87171',
  black:     '#94a3b8',
  colorless: '#6b7280',
};

// ── Utility ───────────────────────────────────────────────────
function esc(s)          { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function getMaxCopies(c) { return c.rarity === 'Legendary' ? 1 : 2; }
function ensure(deck)    { if (!deck.territoryCards) deck.territoryCards=[]; if (!deck.sideboardCards) deck.sideboardCards=[]; }

// Persistent listeners — evita duplicati su re-render
let _docClickFn  = null;
let _mmAttached  = false;

// ─────────────────────────────────────────────────────────────
// RENDER PRINCIPALE
// ─────────────────────────────────────────────────────────────
export function renderDeckBuilderScreen() {
  const screen = document.getElementById('screen-deckbuilder');
  const deck   = getCurrentDeck();
  ensure(deck);

  screen.innerHTML = buildSkeleton(deck);
  restoreFilters();
  wireEvents();
  renderDeckPanel();
  renderCardList();
  populateDropdown();
}

// ─────────────────────────────────────────────────────────────
// HTML SKELETON
// ─────────────────────────────────────────────────────────────
function buildSkeleton(deck) {
  return `
<div class="db-root">

  <!-- TOP BAR -->
  <div class="db-topbar">
    <div class="db-tb-brand">
      <span class="db-brand-name">RAFFLESIA</span>
      <img class="db-brand-logo" src="assets/rafflesia-logo.png" alt="">
    </div>

    <div class="db-tb-actions">
      <button class="db-btn" id="db-save">save</button>
      <button class="db-btn" id="db-rename">rename</button>
      <div class="db-tb-sep"></div>
      <button class="db-btn" id="db-new">+ new</button>
      <button class="db-btn db-btn-danger" id="db-delete">− delete</button>
      <div class="db-sel-wrap" id="db-sel-wrap">
        <button class="db-sel-btn" id="db-sel-btn">
          <span id="db-sel-label">${esc(deck.name)}</span>
          <span class="db-sel-arrow">▼</span>
        </button>
        <div class="db-sel-drop hidden" id="db-sel-drop"></div>
      </div>
    </div>
  </div>

  <!-- BODY -->
  <div class="db-body">

    <!-- DECK PANEL (2/3) -->
    <div class="db-deck-panel" id="db-deck-panel"></div>

    <!-- RIGHT PANEL (1/3): filtri + lista carte + order by -->
    <div class="db-right-panel">

      <div class="db-filters">
        <div class="db-f-row">
          <div class="db-fg">
            <label class="db-fl">Name</label>
            <input class="db-fi" id="df-name" type="text" placeholder="nome...">
          </div>
          <div class="db-fg">
            <label class="db-fl">Card text</label>
            <input class="db-fi" id="df-text" type="text" placeholder="testo...">
          </div>
          <div class="db-fg">
            <label class="db-fl">Type</label>
            <select class="db-fi" id="df-type">
              <option value="">Tutti</option>
              <option value="Minion">Minion</option>
              <option value="Spell">Spell</option>
              <option value="Quest">Quest</option>
              <option value="Territory">Territory</option>
            </select>
          </div>
        </div>

        <div class="db-f-row">
          <div class="db-fg">
            <label class="db-fl">Subtype</label>
            <select class="db-fi" id="df-subtype">
              <option value="">Tutti</option>
              ${[...new Set(CardDatabase.map(c => c.subtype).filter(Boolean))].sort()
                .map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join('')}
            </select>
          </div>
          <div class="db-fg">
            <label class="db-fl">Colors</label>
            <div class="db-cpills" id="db-cpills">
              ${ALL_COLORS.map(c => `<button class="db-cpill" data-color="${c}" style="--pc:${COLOR_HEX[c]}" title="${c}"></button>`).join('')}
            </div>
          </div>
          <div class="db-fg">
            <label class="db-fl">⬜ cost</label>
            <div class="db-range">
              <input class="db-fi db-mini" id="df-nm" type="number" min="0" placeholder="min">
              <span class="db-range-sep">–</span>
              <input class="db-fi db-mini" id="df-nx" type="number" min="0" placeholder="max">
            </div>
          </div>
        </div>

        <div class="db-f-row">
          <div class="db-fg">
            <label class="db-fl">🔵 cost</label>
            <div class="db-range">
              <input class="db-fi db-mini" id="df-cm" type="number" min="0" placeholder="min">
              <span class="db-range-sep">–</span>
              <input class="db-fi db-mini" id="df-cx" type="number" min="0" placeholder="max">
            </div>
          </div>
          <div class="db-fg">
            <label class="db-fl">Aggiunta a</label>
            <div class="db-mode" id="db-mode">
              <button class="db-mbtn" data-mode="main">MAIN</button>
              <button class="db-mbtn" data-mode="side">SIDE</button>
            </div>
          </div>
          <div class="db-fg">
            <label class="db-fl">Rarità</label>
            <div class="db-mode" id="db-rarity">
              <button class="db-mbtn" data-rarity="Legendary">◆ Leg.</button>
              <button class="db-mbtn" data-rarity="Normal">● Com.</button>
            </div>
          </div>
        </div>
      </div>

      <div class="db-list-wrap">
        <div class="db-card-list" id="db-card-list"></div>
      </div>

      <div class="db-orderby">
        <span class="db-ob-lbl">ORDER BY:</span>
        <select class="db-fi db-ob-sel" id="db-ob">
          <option value="name-asc">Name A→Z</option>
          <option value="name-desc">Name Z→A</option>
          <option value="cost-asc">Total cost ↑</option>
          <option value="cost-desc">Total cost ↓</option>
        </select>
      </div>
    </div>
  </div>
</div>

<!-- Tooltip hover carta -->
<div class="db-tooltip hidden" id="db-tooltip">
  <img id="db-tt-img" src="" alt="">
</div>

<!-- Dialog modale -->
<div class="db-overlay hidden" id="db-overlay">
  <div class="db-dialog">
    <p class="db-dlg-msg" id="db-dlg-msg"></p>
    <input class="db-fi" id="db-dlg-inp" type="text">
    <div class="db-dlg-acts">
      <button class="db-btn" id="db-dlg-cancel">Annulla</button>
      <button class="db-btn db-btn-primary" id="db-dlg-ok">Conferma</button>
    </div>
  </div>
</div>
`;
}

// ─────────────────────────────────────────────────────────────
// RIPRISTINO FILTRI (dopo re-render)
// ─────────────────────────────────────────────────────────────
function restoreFilters() {
  document.getElementById('df-name').value    = filters.name;
  document.getElementById('df-text').value    = filters.text;
  document.getElementById('df-type').value    = filters.type;
  document.getElementById('df-subtype').value = filters.subtype;
  document.getElementById('df-nm').value      = filters.neutralMin;
  document.getElementById('df-nx').value      = filters.neutralMax;
  document.getElementById('df-cm').value      = filters.colorMin;
  document.getElementById('df-cx').value      = filters.colorMax;
  document.getElementById('db-ob').value      = orderBy;

  document.querySelectorAll('#db-cpills .db-cpill').forEach(b =>
    b.classList.toggle('active', filters.colors.includes(b.dataset.color))
  );
  document.querySelectorAll('#db-mode .db-mbtn').forEach(b =>
    b.classList.toggle('active', b.dataset.mode === addMode)
  );
  document.querySelectorAll('#db-rarity .db-mbtn').forEach(b =>
    b.classList.toggle('active', filters.rarities.includes(b.dataset.rarity))
  );
}

// ─────────────────────────────────────────────────────────────
// WIRE EVENTS
// ─────────────────────────────────────────────────────────────
function wireEvents() {
  // Topbar
  document.getElementById('db-new').onclick    = onNew;
  document.getElementById('db-delete').onclick = onDelete;
  document.getElementById('db-save').onclick   = () => { saveDecks(); showToast('Mazzo salvato!'); };
  document.getElementById('db-rename').onclick = onRename;

  // Deck selector dropdown
  document.getElementById('db-sel-btn').onclick = (e) => {
    e.stopPropagation();
    document.getElementById('db-sel-drop').classList.toggle('hidden');
  };
  if (_docClickFn) document.removeEventListener('click', _docClickFn);
  _docClickFn = () => document.getElementById('db-sel-drop')?.classList.add('hidden');
  document.addEventListener('click', _docClickFn);

  // Filtri testo
  [['df-name','name'],['df-text','text']].forEach(([id, key]) =>
    document.getElementById(id).addEventListener('input', e => { filters[key] = e.target.value; renderCardList(); })
  );
  document.getElementById('df-subtype').addEventListener('change', e => { filters.subtype = e.target.value; renderCardList(); });
  document.getElementById('df-type').addEventListener('change', e => { filters.type = e.target.value; renderCardList(); });

  // Range costi
  [['df-nm','neutralMin'],['df-nx','neutralMax'],['df-cm','colorMin'],['df-cx','colorMax']].forEach(([id, key]) =>
    document.getElementById(id).addEventListener('input', e => { filters[key] = e.target.value; renderCardList(); })
  );

  // Color pills
  document.querySelectorAll('#db-cpills .db-cpill').forEach(b =>
    b.addEventListener('click', () => {
      const c = b.dataset.color;
      filters.colors = filters.colors.includes(c)
        ? filters.colors.filter(x => x !== c)
        : [...filters.colors, c];
      b.classList.toggle('active');
      renderCardList();
    })
  );

  // Mode toggle
  document.querySelectorAll('#db-mode .db-mbtn').forEach(b =>
    b.addEventListener('click', () => {
      addMode = b.dataset.mode;
      document.querySelectorAll('#db-mode .db-mbtn').forEach(x =>
        x.classList.toggle('active', x.dataset.mode === addMode)
      );
    })
  );

  // Rarity toggle
  document.querySelectorAll('#db-rarity .db-mbtn').forEach(b =>
    b.addEventListener('click', () => {
      const r = b.dataset.rarity;
      filters.rarities = filters.rarities.includes(r)
        ? filters.rarities.filter(x => x !== r)
        : [...filters.rarities, r];
      b.classList.toggle('active');
      renderCardList();
    })
  );

  // Order by
  document.getElementById('db-ob').onchange = e => { orderBy = e.target.value; renderCardList(); };

  // Tooltip mouse tracking (si attacca una sola volta sull'elemento stabile)
  if (!_mmAttached) {
    document.getElementById('screen-deckbuilder').addEventListener('mousemove', e => {
      const tt = document.getElementById('db-tooltip');
      if (!tt || tt.classList.contains('hidden')) return;
      let x = e.clientX + 18;
      let y = e.clientY - 100;
      if (x + 269 > window.innerWidth)  x = e.clientX - 278;
      if (y + 380 > window.innerHeight) y = window.innerHeight - 445;
      if (y < 0) y = 0;
      tt.style.left = x + 'px';
      tt.style.top  = y + 'px';
    });
    _mmAttached = true;
  }

  // Dialog
  document.getElementById('db-dlg-cancel').onclick = closeDialog;
  document.getElementById('db-overlay').addEventListener('click', e => {
    if (e.target.id === 'db-overlay') closeDialog();
  });
}

// ─────────────────────────────────────────────────────────────
// DECK PANEL
// ─────────────────────────────────────────────────────────────
function renderDeckPanel() {
  const panel = document.getElementById('db-deck-panel');
  if (!panel) return;
  const deck = getCurrentDeck();
  ensure(deck);

  // Raggruppa carte main per tipo
  const groups = { Quest: {}, Spell: {}, Minion: {} };
  deck.cards.forEach(id => {
    const c = CardDatabase.find(x => x.id === id);
    if (!c) return;
    if (!groups[c.type]) groups[c.type] = {};
    groups[c.type][id] = (groups[c.type][id] || 0) + 1;
  });

  const territory = {};
  deck.territoryCards.forEach(id => { territory[id] = (territory[id] || 0) + 1; });

  const side = {};
  deck.sideboardCards.forEach(id => { side[id] = (side[id] || 0) + 1; });

  panel.innerHTML = `
    <div class="db-deck-cols">
      <div class="db-dc">
        ${mkSection('COMMANDER', commanderRow(deck))}
        ${mkSection('QUEST', cardGroup(groups.Quest || {}, 'main'))}
        ${mkSection('SPELL', cardGroup(groups.Spell || {}, 'main'))}
        ${mkSection(`TERRITORY <span class="db-cnt">${deck.territoryCards.length}/${MAX_TERRITORY}</span>`, cardGroup(territory, 'territory'))}
      </div>
      <div class="db-dc db-dc-right">
        ${mkSection(`MINION <span class="db-cnt">${deck.cards.filter(id => { const c=CardDatabase.find(x=>x.id===id); return c&&c.type==='Minion'; }).length}</span>`, cardGroup(groups.Minion || {}, 'main'))}
        ${mkSection(`SIDEBOARD <span class="db-cnt">${deck.sideboardCards.length}/${MAX_SIDE}</span>`, cardGroup(side, 'side'))}
      </div>
    </div>
  `;

  panel.querySelectorAll('.db-dr').forEach(row => {
    const c = CardDatabase.find(x => x.id === row.dataset.id);
    row.addEventListener('click',      () => removeCard(row.dataset.id, row.dataset.slot));
    if (c) {
      row.addEventListener('mouseenter', () => showTooltip(c));
      row.addEventListener('mouseleave', hideTooltip);
    }
  });
}

function mkSection(title, content) {
  return `
    <div class="db-section">
      <div class="db-sh">${title}</div>
      <div class="db-sec-list">${content}</div>
    </div>
  `;
}

function commanderRow(deck) {
  if (!deck.commanderId) return `<div class="db-empty">— nessuno —</div>`;
  const c = CardDatabase.find(x => x.id === deck.commanderId);
  if (!c) return `<div class="db-empty">— carta non trovata —</div>`;
  return `
    <div class="db-dr db-dr-commander" data-id="${c.id}" data-slot="commander" title="Click per rimuovere">
      <span class="db-dn">★ ${esc(c.name)}</span>
      ${makePips(c)}
    </div>
  `;
}

function cardGroup(group, slot) {
  const ids = Object.keys(group);
  if (!ids.length) return `<div class="db-empty">—</div>`;
  return ids.map(id => {
    const c = CardDatabase.find(x => x.id === id);
    if (!c) return '';
    const qty = group[id];
    return `
      <div class="db-dr" data-id="${id}" data-slot="${slot}" title="Click per rimuovere">
        <span class="db-dn">${qty > 1 ? qty + '× ' : ''}${esc(c.name)}</span>
        ${makePips(c)}
      </div>
    `;
  }).join('');
}

function makePips(card) {
  const nc  = card.cost_neutral ?? 0;
  const cc  = card.cost_color   ?? 0;
  const col = COLOR_HEX[card.color] ?? COLOR_HEX.colorless;
  const gem = card.rarity === 'Legendary' ? `<span class="db-leg-gem">◆</span>` : '';
  return `<div class="db-pips">
    ${gem}
    <span class="db-pip db-pip-n">${nc}</span>
    ${cc > 0 ? `<span class="db-pip db-pip-c" style="--pip-c:${col}">${cc}</span>` : ''}
  </div>`;
}

function removeCard(id, slot) {
  hideTooltip();
  const deck = getCurrentDeck();
  ensure(deck);
  let arr;
  if      (slot === 'commander') { deck.commanderId = null; }
  else if (slot === 'main')      { arr = deck.cards; }
  else if (slot === 'territory') { arr = deck.territoryCards; }
  else if (slot === 'side')      { arr = deck.sideboardCards; }

  if (arr) {
    const i = arr.indexOf(id);
    if (i >= 0) arr.splice(i, 1);
  }
  saveDecks();
  renderDeckPanel();
  renderCardList();
}

// ─────────────────────────────────────────────────────────────
// CARD LIST
// ─────────────────────────────────────────────────────────────
function getFiltered() {
  const f = filters;
  return CardDatabase.filter(c => {
    if (f.name       && !c.name.toLowerCase().includes(f.name.toLowerCase()))               return false;
    if (f.text       && !(c.text    || '').toLowerCase().includes(f.text.toLowerCase()))    return false;
    if (f.type       && c.type !== f.type)                                                   return false;
    if (f.subtype    && c.subtype !== f.subtype)                                              return false;
    if (f.colors.length  && !f.colors.includes(c.color))                                     return false;
    if (f.rarities.length && !f.rarities.includes(c.rarity))                                return false;
    if (f.neutralMin !== '' && (c.cost_neutral ?? 0) < +f.neutralMin)                       return false;
    if (f.neutralMax !== '' && (c.cost_neutral ?? 0) > +f.neutralMax)                       return false;
    if (f.colorMin   !== '' && (c.cost_color   ?? 0) < +f.colorMin)                         return false;
    if (f.colorMax   !== '' && (c.cost_color   ?? 0) > +f.colorMax)                         return false;
    return true;
  });
}

function getSorted(cards) {
  return [...cards].sort((a, b) => {
    if (orderBy === 'name-desc') return b.name.localeCompare(a.name);
    if (orderBy === 'cost-asc')  return (a.cost_neutral + a.cost_color) - (b.cost_neutral + b.cost_color);
    if (orderBy === 'cost-desc') return (b.cost_neutral + b.cost_color) - (a.cost_neutral + a.cost_color);
    return a.name.localeCompare(b.name);
  });
}

function renderCardList() {
  const list = document.getElementById('db-card-list');
  if (!list) return;
  const deck  = getCurrentDeck();
  ensure(deck);
  const cards = getSorted(getFiltered());

  if (!cards.length) {
    list.innerHTML = `<div class="db-lempty">Nessuna carta trovata.</div>`;
    return;
  }

  list.innerHTML = cards.map(c => {
    const cnt = deck.cards.filter(id => id === c.id).length
              + deck.territoryCards.filter(id => id === c.id).length
              + deck.sideboardCards.filter(id => id === c.id).length
              + (deck.commanderId === c.id ? 1 : 0);
    const isLeg    = c.rarity === 'Legendary';
    const countBadge = (!isLeg && cnt > 0) ? ` <span class="db-lc">(${cnt}×)</span>` : '';
    return `
      <div class="db-lr" data-id="${c.id}">
        <span class="db-ln">${esc(c.name)}${countBadge}</span>
        ${makePips(c)}
      </div>
    `;
  }).join('');

  list.querySelectorAll('.db-lr').forEach(row => {
    const c = CardDatabase.find(x => x.id === row.dataset.id);
    if (!c) return;
    row.addEventListener('click',      () => addCard(c));
    row.addEventListener('mouseenter', () => showTooltip(c));
    row.addEventListener('mouseleave', hideTooltip);
  });
}

// ─────────────────────────────────────────────────────────────
// LOGICA AGGIUNTA CARTA
// ─────────────────────────────────────────────────────────────
function addCard(card) {
  const deck      = getCurrentDeck();
  ensure(deck);
  const commander = deck.commanderId ? CardDatabase.find(c => c.id === deck.commanderId) : null;

  // 1. Nessun commander → la prima carta legendary (non territory) diventa commander
  if (!deck.commanderId) {
    if (card.rarity === 'Legendary' && card.type !== 'Territory') {
      deck.commanderId = card.id;
      saveDecks(); renderDeckPanel(); renderCardList(); return;
    }
    showToast('Aggiungi prima un Legendary (non Territory) come commander.');
    return;
  }

  // 2. Territory → territorio (nessun limite per carta, solo totale 12)
  if (card.type === 'Territory') {
    if (deck.territoryCards.length >= MAX_TERRITORY) { showToast('Territory pieno (12/12).'); return; }
    deck.territoryCards.push(card.id);
    saveDecks(); renderDeckPanel(); renderCardList(); return;
  }

  // 3. Non puoi aggiungere il commander nel mazzo
  if (card.id === deck.commanderId) { showToast('Il commander non può essere nel mazzo.'); return; }

  // 4. Regola colore
  if (commander && card.color !== commander.color && card.color !== 'colorless') {
    showToast(`"${card.name}" non è nel colore del commander.`); return;
  }

  // 5. MAIN o SIDE
  if (addMode === 'main') {
    if (deck.cards.length >= MAX_MAIN) { showToast(`Main deck pieno (${MAX_MAIN}/29).`); return; }
    if (deck.cards.filter(id => id === card.id).length >= getMaxCopies(card)) {
      showToast(`Max ${getMaxCopies(card)} cop. di "${card.name}".`); return;
    }
    deck.cards.push(card.id);
  } else {
    if (deck.sideboardCards.length >= MAX_SIDE) { showToast(`Sideboard pieno (${MAX_SIDE}/10).`); return; }
    if (deck.sideboardCards.filter(id => id === card.id).length >= getMaxCopies(card)) {
      showToast(`Max ${getMaxCopies(card)} cop. di "${card.name}".`); return;
    }
    deck.sideboardCards.push(card.id);
  }

  saveDecks(); renderDeckPanel(); renderCardList();
}

// ─────────────────────────────────────────────────────────────
// TOOLTIP
// ─────────────────────────────────────────────────────────────
function showTooltip(card) {
  const tt  = document.getElementById('db-tooltip');
  const img = document.getElementById('db-tt-img');
  if (!tt || !img) return;
  img.src = card.image;
  tt.classList.remove('hidden');
}

function hideTooltip() {
  document.getElementById('db-tooltip')?.classList.add('hidden');
}

// ─────────────────────────────────────────────────────────────
// DECK SELECTOR DROPDOWN
// ─────────────────────────────────────────────────────────────
function populateDropdown() {
  const drop = document.getElementById('db-sel-drop');
  if (!drop) return;
  const cur = getCurrentDeck();
  drop.innerHTML = AppState.decks.map(d => `
    <button class="db-drop-item ${String(d.id) === String(cur.id) ? 'active' : ''}" data-id="${d.id}">
      ${esc(d.name)}
    </button>
  `).join('');
  drop.querySelectorAll('.db-drop-item').forEach(btn =>
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const target = AppState.decks.find(d => String(d.id) === btn.dataset.id);
      if (target) AppState.currentDeckId = target.id;
      drop.classList.add('hidden');
      renderDeckBuilderScreen();
    })
  );
}

// ─────────────────────────────────────────────────────────────
// AZIONI TOPBAR
// ─────────────────────────────────────────────────────────────
function onNew() {
  openDialog('Nome del nuovo mazzo:', '', name => {
    if (!name.trim()) return;
    const d = {
      id: Date.now(), name: name.trim(),
      commanderId: null, cards: [], territoryCards: [], sideboardCards: [],
    };
    AppState.decks.push(d);
    AppState.currentDeckId = d.id;
    saveDecks();
    renderDeckBuilderScreen();
  });
}

function onDelete() {
  const deck = getCurrentDeck();
  openDialog(`Eliminare il mazzo "${esc(deck.name)}"?`, null, () => {
    if (AppState.decks.length <= 1) { showToast('Devi avere almeno un mazzo.'); return; }
    const deleted = AppState.decks.find(d => d.id === AppState.currentDeckId);
    AppState.decks         = AppState.decks.filter(d => d.id !== AppState.currentDeckId);
    AppState.currentDeckId = AppState.decks[0].id;
    saveDecks();
    if (deleted) deleteDeckFromSupabase(deleted).catch(() => {});
    renderDeckBuilderScreen();
  });
}

function onRename() {
  const deck = getCurrentDeck();
  openDialog('Rinomina mazzo:', deck.name, name => {
    if (!name.trim()) return;
    deck.name = name.trim();
    saveDecks();
    const lbl = document.getElementById('db-sel-label');
    if (lbl) lbl.textContent = deck.name;
  });
}

// ─────────────────────────────────────────────────────────────
// DIALOG
// ─────────────────────────────────────────────────────────────
function openDialog(msg, inputDefault, onOk) {
  const overlay = document.getElementById('db-overlay');
  const msgEl   = document.getElementById('db-dlg-msg');
  const inp     = document.getElementById('db-dlg-inp');

  msgEl.textContent  = msg;
  inp.style.display  = inputDefault !== null ? 'block' : 'none';
  inp.value          = inputDefault ?? '';
  overlay.classList.remove('hidden');

  document.getElementById('db-dlg-ok').onclick = () => { closeDialog(); onOk(inp.value); };
  inp.onkeydown = e => {
    if (e.key === 'Enter')  { closeDialog(); onOk(inp.value); }
    if (e.key === 'Escape') closeDialog();
  };
  if (inputDefault !== null) setTimeout(() => { inp.focus(); inp.select(); }, 30);
}

function closeDialog() {
  document.getElementById('db-overlay')?.classList.add('hidden');
}

// ─────────────────────────────────────────────────────────────
// TOAST
// ─────────────────────────────────────────────────────────────
let _toastTimer = null;
function showToast(msg) {
  let el = document.getElementById('db-toast');
  if (!el) {
    el = Object.assign(document.createElement('div'), { id: 'db-toast', className: 'db-toast' });
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('visible');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('visible'), 2600);
}
