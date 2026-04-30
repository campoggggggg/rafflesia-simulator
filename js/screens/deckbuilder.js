// deckbuilder.js — riscritto da zero

import { AppState, getCurrentDeck }          from '../core/state.js';
import { getUser }                           from '../auth/auth.js';
import { navigateTo }                        from '../core/router.js';
import { saveDecks, deleteDeckFromSupabase, saveDeckToSupabase } from '../data/decks.js';
import { CardDatabase }                      from '../data/cards.js';
import { db }                                from '../core/supabase-client.js';

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
  blue:      '#336699',
  green:     '#385400',
  red:       '#8A0000',
  black:     '#595959',
  colorless: '#A19993',
};
const HOVER_HEX     = {
  blue:      '#5599cc',
  green:     '#7ab800',
  red:       '#cc3333',
  black:     '#aaaaaa',
  colorless: '#c5beb8',
};

// ── Utility ───────────────────────────────────────────────────
function esc(s)          { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function getMaxCopies(c) { return c.rarity === 'Legendary' ? 1 : 2; }
function ensure(deck)    { if (!deck.territoryCards) deck.territoryCards=[]; if (!deck.sideboardCards) deck.sideboardCards=[]; }
function imageVar(card)  {
  return `--row-color:${COLOR_HEX[card.color] ?? COLOR_HEX.colorless}`;
}
function getCardTotalCount(deck, cardId) {
  return deck.cards.filter(id => id === cardId).length
    + deck.territoryCards.filter(id => id === cardId).length
    + deck.sideboardCards.filter(id => id === cardId).length
    + (deck.commanderId === cardId ? 1 : 0);
}
function getIndicatorSlots(card, count) {
  const base = card.type === 'Territory' ? MAX_TERRITORY : getMaxCopies(card);
  return Math.max(base, count);
}
function renderCopyDots(filled, total) {
  return `<span class="db-copy-dots">${
    Array.from({ length: total }, (_, i) =>
      `<span class="db-copy-dot${i < filled ? ' active' : ''}"></span>`
    ).join('')
  }</span>`;
}
function renderCountBadge(qty) {
  return `<span class="db-count-badge">${qty}</span>`;
}

// Persistent listeners — evita duplicati su re-render
let _docClickFn  = null;
let _mmAttached  = false;

// ─────────────────────────────────────────────────────────────
// RENDER PRINCIPALE
// ─────────────────────────────────────────────────────────────
export async function renderDeckBuilderScreen() {
  const screen = document.getElementById('screen-deckbuilder');
  const user   = await getUser();
  if (!screen) return;

  if (!user) {
    screen.innerHTML = `
      <div class="card-panel" style="max-width: 560px; margin: 48px auto;">
        <h2 class="page-title">Deck builder</h2>
        <p class="page-subtitle">Accedi per creare, salvare e modificare i tuoi mazzi.</p>
        <div class="row" style="margin-top: 20px;">
          <button class="primary-btn" id="deckbuilderLoginBtn">Vai al login</button>
        </div>
      </div>
    `;

    document.getElementById('deckbuilderLoginBtn')?.addEventListener('click', () => {
      navigateTo('auth');
    });
    return;
  }

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
      <span class="db-brand-name">DECK BUILDER</span>
      <img class="db-brand-logo" src="assets/rafflesia-logo.png" alt="">
      <span class="db-main-counter" id="db-main-counter">MAIN 0/29</span>
    </div>

    <div class="db-tb-actions">
      <button class="db-btn" id="db-save">save</button>
      <button class="db-btn" id="db-rename">rename</button>
      <div class="db-tb-sep"></div>
      <button class="db-btn" id="db-import">import</button>
      <button class="db-btn" id="db-export-code">export code</button>
      <button class="db-btn" id="db-export-img">export img</button>
      <div class="db-tb-sep"></div>
      <button class="db-btn db-btn-publish" id="db-publish">⬆ publish</button>
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

<!-- Export code dialog -->
<div class="db-overlay hidden" id="db-exp-overlay">
  <div class="db-dialog db-exp-dialog">
    <p class="db-dlg-msg">Codice mazzo — copia e condividi:</p>
    <div class="db-exp-row">
      <input class="db-fi db-exp-code-inp" id="db-exp-code" type="text" readonly>
      <button class="db-btn db-btn-primary" id="db-exp-copy">Copia</button>
    </div>
    <div class="db-dlg-acts">
      <button class="db-btn" id="db-exp-close">Chiudi</button>
    </div>
  </div>
</div>

<!-- Import dialog -->
<div class="db-overlay hidden" id="db-imp-overlay">
  <div class="db-dialog db-imp-dialog">
    <p class="db-dlg-msg">Incolla il codice del mazzo:</p>
    <textarea class="db-fi db-imp-ta" id="db-imp-code" placeholder="Incolla il codice qui..."></textarea>
    <div class="db-dlg-acts">
      <button class="db-btn" id="db-imp-cancel">Annulla</button>
      <button class="db-btn db-btn-primary" id="db-imp-ok">Importa</button>
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
  document.getElementById('db-new').onclick     = onNew;
  document.getElementById('db-delete').onclick  = onDelete;
  document.getElementById('db-save').onclick    = () => { saveDecks(); showToast('Mazzo salvato!'); };
  document.getElementById('db-rename').onclick  = onRename;
  document.getElementById('db-publish').onclick = onPublish;

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

  // Dialog principale
  document.getElementById('db-dlg-cancel').onclick = closeDialog;
  document.getElementById('db-overlay').addEventListener('click', e => {
    if (e.target.id === 'db-overlay') closeDialog();
  });

  // Import / Export
  document.getElementById('db-export-code').onclick = onExportCode;
  document.getElementById('db-export-img').onclick  = onExportImage;
  document.getElementById('db-import').onclick      = onImport;

  document.getElementById('db-exp-copy').onclick  = copyExportCode;
  document.getElementById('db-exp-close').onclick = closeExportDialog;
  document.getElementById('db-exp-overlay').addEventListener('click', e => {
    if (e.target.id === 'db-exp-overlay') closeExportDialog();
  });

  document.getElementById('db-imp-cancel').onclick = closeImportDialog;
  document.getElementById('db-imp-ok').onclick     = doImport;
  document.getElementById('db-imp-overlay').addEventListener('click', e => {
    if (e.target.id === 'db-imp-overlay') closeImportDialog();
  });
  document.getElementById('db-imp-code').addEventListener('keydown', e => {
    if (e.key === 'Escape') closeImportDialog();
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

  const counterEl = document.getElementById('db-main-counter');
  if (counterEl) {
    const n = deck.cards.length;
    counterEl.textContent = `MAIN ${n}/${MAX_MAIN}`;
    counterEl.classList.toggle('db-main-counter--full', n >= MAX_MAIN);
  }

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

  const cmdCard    = deck.commanderId ? CardDatabase.find(x => x.id === deck.commanderId) : null;
  const hoverColor = cmdCard ? (HOVER_HEX[cmdCard.color] ?? HOVER_HEX.colorless) : null;
  const cmdStyle   = [
    cmdCard?.image  ? `--commander-bg:url('${String(cmdCard.image).replace(/'/g, '%27')}')` : '',
    hoverColor      ? `--hover-color:${hoverColor}` : '',
  ].filter(Boolean).join(';');
  const cmdBg = cmdStyle ? `style="${cmdStyle}"` : '';

  panel.innerHTML = `
    <div class="db-deck-cols" ${cmdBg}>
      <div class="db-dc">
        ${mkSection('COMMANDER', commanderRow(deck))}
        ${mkSection('QUEST', cardGroup(groups.Quest || {}, 'main'))}
        ${mkSection('SPELL', cardGroup(groups.Spell || {}, 'main'))}
        ${mkSection(`TERRITORY <span class="db-cnt">${deck.territoryCards.length}/${MAX_TERRITORY}</span>`, cardGroup(territory, 'territory'))}
        ${mkSection('MANA CURVE', renderManaCurve(deck), 'db-section-chart')}
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
      row.addEventListener('mousemove', e => {
        const r = row.getBoundingClientRect();
        (e.clientX - r.left) / r.width <= 0.6 ? showTooltip(c) : hideTooltip();
      });
      row.addEventListener('mouseleave', hideTooltip);
    }
  });
}

function mkSection(title, content, className = '') {
  return `
    <div class="db-section ${className}">
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
    <div class="db-dr db-dr-commander db-dr-art" data-id="${c.id}" data-slot="commander" title="Click per rimuovere" style="${imageVar(c)}">
      <span class="db-dn"><span class="db-cmd-p">P</span> · ${esc(c.name)}</span>
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
      <div class="db-dr db-dr-art" data-id="${id}" data-slot="${slot}" title="Click per rimuovere" style="${imageVar(c)}">
        <span class="db-count-sq">${qty}</span>
        <span class="db-dn">${esc(c.name)}</span>
        ${makePips(c)}
      </div>
    `;
  }).join('');
}

function renderManaCurve(deck) {
  const counts = {};
  const allIds = [...deck.cards, ...(deck.commanderId ? [deck.commanderId] : [])];
  allIds.forEach(id => {
    const card = CardDatabase.find(c => c.id === id);
    if (!card || card.type === 'Territory') return;
    counts[card.cost] = (counts[card.cost] || 0) + 1;
  });

  const maxCost = Math.max(0, ...Object.keys(counts).map(Number));
  const labels = Array.from({ length: maxCost + 1 }, (_, i) => i);
  const maxCount = Math.max(1, ...labels.map(label => counts[label] || 0));

  return `
    <div class="db-mini-curve">
      <div class="db-mini-curve-bars">
        ${labels.map(label => {
          const value = counts[label] || 0;
          const height = Math.max(value > 0 ? 14 : 4, Math.round((value / maxCount) * 64));
          return `
            <div class="db-mini-curve-col">
              <span class="db-mini-curve-val">${value || ''}</span>
              <span class="db-mini-curve-bar" style="height:${height}px"></span>
              <span class="db-mini-curve-x">${label}</span>
            </div>
          `;
        }).join('')}
      </div>
      <div class="db-mini-curve-axis">cost</div>
    </div>
  `;
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
    const cnt = getCardTotalCount(deck, c.id);
    const slots = getIndicatorSlots(c, cnt);
    return `
      <div class="db-lr" data-id="${c.id}">
        <div class="db-lmain">
          <span class="db-ln">${esc(c.name)}</span>
          ${renderCopyDots(cnt, slots)}
        </div>
        ${makePips(c)}
      </div>
    `;
  }).join('');

  list.querySelectorAll('.db-lr').forEach(row => {
    const c = CardDatabase.find(x => x.id === row.dataset.id);
    if (!c) return;
    row.addEventListener('click', () => addCard(c));
    row.addEventListener('mousemove', e => {
      const r = row.getBoundingClientRect();
      (e.clientX - r.left) / r.width <= 0.6 ? showTooltip(c) : hideTooltip();
    });
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
  openDialog('Nome del nuovo mazzo:', '', async name => {
    if (!name.trim()) return;
    const d = {
      id: Date.now(), name: name.trim(),
      commanderId: null, cards: [], territoryCards: [], sideboardCards: [],
    };
    AppState.decks.push(d);
    AppState.currentDeckId = d.id;
    await saveDeckToSupabase(d);   // Supabase aggiorna d.id con l'UUID reale
    AppState.currentDeckId = d.id; // sincronizza dopo che d.id è cambiato
    await renderDeckBuilderScreen();
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

async function onPublish() {
  const deck = getCurrentDeck();
  const user = await getUser();
  if (!user) { showToast('Devi essere loggato per pubblicare.'); return; }

  ensure(deck);
  const totalCards = (deck.commanderId ? 1 : 0) + deck.cards.length + deck.territoryCards.length;
  const isComplete = deck.commanderId && deck.cards.length === MAX_MAIN && deck.territoryCards.length === MAX_TERRITORY;
  if (!isComplete) {
    showToast(`Mazzo incompleto. Servono commander + ${MAX_MAIN} main + ${MAX_TERRITORY} territory (${totalCards}/42).`);
    return;
  }

  const commander = deck.commanderId
    ? CardDatabase.find(c => String(c.id) === String(deck.commanderId))
    : null;

  openPublishDialog(deck.name, async tags => {
    const btn = document.getElementById('db-publish');
    if (btn) { btn.disabled = true; btn.textContent = '…'; }

    try {
      const { error } = await db.from('public_decks').insert({
        name:            deck.name,
        author_username: AppState.username || user.email?.split('@')[0] || 'Anonimo',
        author_user_id:  user.id,
        commander_id:    deck.commanderId   || null,
        commander_color: commander?.color   || 'colorless',
        cards:           deck.cards          || [],
        territory_cards: deck.territoryCards || [],
        sideboard_cards: deck.sideboardCards || [],
        tags,
      });

      if (error) throw error;
      showToast(`"${deck.name}" pubblicato con successo!`);
    } catch (err) {
      console.error('Errore pubblicazione:', err);
      showToast('Errore durante la pubblicazione.');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '⬆ publish'; }
    }
  });
}

// Dialog dedicato alla pubblicazione con tag editor
function openPublishDialog(deckName, onOk) {
  // Usa l'overlay principale ma inietta contenuto custom
  const overlay = document.getElementById('db-overlay');
  const dialog  = overlay.querySelector('.db-dialog');

  const currentTags = [];

  dialog.innerHTML = `
    <p class="db-dlg-msg">Pubblica <strong>${esc(deckName)}</strong> nei mazzi pubblici?</p>
    <div class="db-pub-tag-section">
      <label class="db-fl" style="margin-bottom:6px;display:block;">Tags (max 3 | press Enter to confirm)</label>
      <div class="db-pub-tag-pills" id="db-pub-pills"></div>
      <input class="db-fi db-pub-tag-inp" id="db-pub-tag-inp" type="text"
             placeholder="aggiungi tag…" autocomplete="off" style="margin-top:8px;width:100%;box-sizing:border-box;">
      <div class="db-pub-tag-hint" id="db-pub-tag-hint"></div>
    </div>
    <div class="db-dlg-acts">
      <button class="db-btn" id="db-pub-cancel">Annulla</button>
      <button class="db-btn db-btn-primary" id="db-pub-ok">Pubblica</button>
    </div>`;

  overlay.classList.remove('hidden');

  const pillsEl = dialog.querySelector('#db-pub-pills');
  const inp     = dialog.querySelector('#db-pub-tag-inp');
  const hint    = dialog.querySelector('#db-pub-tag-hint');

  function renderPills() {
    pillsEl.innerHTML = currentTags.map((t, i) =>
      `<span class="db-pub-pill">${esc(t)}<button class="db-pub-pill-rm" data-i="${i}">✕</button></span>`
    ).join('');
    pillsEl.querySelectorAll('.db-pub-pill-rm').forEach(btn =>
      btn.addEventListener('click', () => { currentTags.splice(+btn.dataset.i, 1); renderPills(); })
    );
    hint.textContent = currentTags.length >= 3 ? 'Limite di 3 tag raggiunto.' : '';
    inp.disabled = currentTags.length >= 3;
  }

  function addTag() {
    const raw = inp.value.replace(/[,\s]/g, '').trim().toLowerCase();
    if (!raw) return;
    if (currentTags.length >= 3) return;
    if (currentTags.includes(raw)) { inp.value = ''; return; }
    currentTags.push(raw);
    inp.value = '';
    renderPills();
  }

  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); }
    if (e.key === 'Escape') closePublishDialog(dialog, overlay);
  });
  inp.addEventListener('input', () => {
    if (inp.value.includes(',')) addTag();
  });

  dialog.querySelector('#db-pub-ok').addEventListener('click', () => {
    addTag(); // cattura tag in sospeso nell'input
    closePublishDialog(dialog, overlay);
    onOk(currentTags);
  });
  dialog.querySelector('#db-pub-cancel').addEventListener('click', () => {
    closePublishDialog(dialog, overlay);
  });
  overlay.onclick = e => { if (e.target === overlay) closePublishDialog(dialog, overlay); };

  setTimeout(() => inp.focus(), 30);
}

function closePublishDialog(dialog, overlay) {
  overlay.classList.add('hidden');
  // Ripristina il contenuto originale del dialog principale
  dialog.innerHTML = `
    <p class="db-dlg-msg" id="db-dlg-msg"></p>
    <input class="db-fi" id="db-dlg-inp" type="text">
    <div class="db-dlg-acts">
      <button class="db-btn" id="db-dlg-cancel">Annulla</button>
      <button class="db-btn db-btn-primary" id="db-dlg-ok">Conferma</button>
    </div>`;
  document.getElementById('db-dlg-cancel').onclick = closeDialog;
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

// ─────────────────────────────────────────────────────────────
// IMPORT / EXPORT
// ─────────────────────────────────────────────────────────────

function encodeDeck(deck) {
  ensure(deck);
  const countIds = ids => {
    const m = {};
    ids.forEach(id => { m[id] = (m[id] || 0) + 1; });
    return Object.entries(m)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([id, n]) => `${id}:${n}`)
      .join(',');
  };
  const sortIds = ids =>
    [...new Set(ids)].sort((a, b) => Number(a) - Number(b)).join(',');

  const raw = [
    deck.commanderId || '',
    countIds(deck.cards || []),
    sortIds(deck.territoryCards || []),
    countIds(deck.sideboardCards || []),
  ].join('|');

  return btoa(unescape(encodeURIComponent(raw)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function decodeDeck(code) {
  try {
    const padded = code.trim().replace(/-/g, '+').replace(/_/g, '/');
    const rem = padded.length % 4;
    const raw = decodeURIComponent(escape(atob(rem ? padded + '='.repeat(4 - rem) : padded)));
    const [cmdPart = '', mainPart = '', terrPart = '', sidePart = ''] = raw.split('|');

    const expand = part =>
      part ? part.split(',').filter(Boolean).flatMap(e => {
        const [id, n = '1'] = e.split(':');
        return Array(Number(n)).fill(id);
      }) : [];

    return {
      commanderId:    cmdPart || null,
      cards:          expand(mainPart),
      territoryCards: terrPart ? terrPart.split(',').filter(Boolean) : [],
      sideboardCards: expand(sidePart),
    };
  } catch { return null; }
}

// ── Export code ───────────────────────────────────────────────

function onExportCode() {
  const code = encodeDeck(getCurrentDeck());
  const inp  = document.getElementById('db-exp-code');
  inp.value  = code;
  document.getElementById('db-exp-overlay').classList.remove('hidden');
  inp.select();
}

function closeExportDialog() {
  document.getElementById('db-exp-overlay').classList.add('hidden');
}

function copyExportCode() {
  const code = document.getElementById('db-exp-code').value;
  navigator.clipboard?.writeText(code).then(() => {
    showToast('Codice copiato!');
  }).catch(() => {
    document.getElementById('db-exp-code').select();
    document.execCommand('copy');
    showToast('Codice copiato!');
  });
}

// ── Import ────────────────────────────────────────────────────

function onImport() {
  document.getElementById('db-imp-code').value = '';
  document.getElementById('db-imp-overlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('db-imp-code').focus(), 30);
}

function closeImportDialog() {
  document.getElementById('db-imp-overlay').classList.add('hidden');
}

function doImport() {
  const code = document.getElementById('db-imp-code').value.trim();
  if (!code) return;
  const data = decodeDeck(code);
  if (!data) { showToast('Codice non valido.'); return; }

  const allIds = [
    ...(data.commanderId ? [data.commanderId] : []),
    ...data.cards,
    ...data.territoryCards,
    ...data.sideboardCards,
  ];
  const invalid = allIds.filter(id => !CardDatabase.find(c => c.id === id));
  if (invalid.length) {
    showToast(`Carte non riconosciute: ${[...new Set(invalid)].slice(0, 3).join(', ')}`);
    return;
  }

  const deck = getCurrentDeck();
  ensure(deck);
  deck.commanderId    = data.commanderId;
  deck.cards          = data.cards;
  deck.territoryCards = data.territoryCards;
  deck.sideboardCards = data.sideboardCards;
  closeImportDialog();
  saveDecks();
  renderDeckPanel();
  renderCardList();
  showToast('Mazzo importato!');
}

// ── Export image ──────────────────────────────────────────────

async function onExportImage() {
  const deck = getCurrentDeck();
  ensure(deck);

  const CARD_W = 140, CARD_H = 194, GAP = 12;
  const PAD = 48, CANVAS_W = 1600;
  const SEC_H = 32, SEC_GAP = 30;

  const mkCounts = ids => {
    const m = {};
    ids.forEach(id => { m[id] = (m[id] || 0) + 1; });
    return m;
  };

  const cmdCard   = deck.commanderId ? CardDatabase.find(c => c.id === deck.commanderId) : null;
  const CMD_W     = Math.round(CARD_W * 1.2);   // 165
  const CMD_H     = Math.round(CARD_H * 1.2);   // 231
  const CMD_AREA  = CMD_W + GAP * 3;             // left column width

  // Territory
  const terrCounts  = mkCounts(deck.territoryCards || []);
  const terrIds     = Object.keys(terrCounts);
  const terrAvailW  = CANVAS_W - PAD * 2 - CMD_AREA;
  const TERR_COLS   = Math.max(1, Math.floor((terrAvailW + GAP) / (CARD_W + GAP)));
  const terrRows    = terrIds.length ? Math.ceil(terrIds.length / TERR_COLS) : 0;

  // Top row height: whichever of commander or territory is taller
  const topRowH = Math.max(
    cmdCard ? SEC_H + CMD_H : 0,
    terrIds.length ? SEC_H + terrRows * (CARD_H + GAP) : 0,
  );

  // Main deck split by type (skip empty types)
  const MAIN_COLS = Math.max(1, Math.floor((CANVAS_W - PAD * 2 + GAP) / (CARD_W + GAP)));
  const mainByType = { Quest: {}, Spell: {}, Minion: {} };
  (deck.cards || []).forEach(id => {
    const card = CardDatabase.find(c => c.id === id);
    const type = (card && mainByType[card.type]) ? card.type : 'Minion';
    mainByType[type][id] = (mainByType[type][id] || 0) + 1;
  });
  const mainSections = ['Quest', 'Spell', 'Minion']
    .map(t => ({ label: t.toUpperCase(), ids: Object.keys(mainByType[t]), counts: mainByType[t] }))
    .filter(s => s.ids.length);

  // Sideboard
  const sideCounts = mkCounts(deck.sideboardCards || []);
  const sideIds    = Object.keys(sideCounts);

  // Canvas height
  let totalH = 80; // header
  if (topRowH) totalH += topRowH + SEC_GAP;
  mainSections.forEach(s => {
    totalH += SEC_H + Math.ceil(s.ids.length / MAIN_COLS) * (CARD_H + GAP) + SEC_GAP;
  });
  if (sideIds.length) {
    totalH += SEC_H + Math.ceil(sideIds.length / MAIN_COLS) * (CARD_H + GAP) + SEC_GAP;
  }
  totalH += PAD;

  // Carica tutte le immagini
  const allIds = [...new Set([
    ...(deck.commanderId ? [deck.commanderId] : []),
    ...terrIds,
    ...mainSections.flatMap(s => s.ids),
    ...sideIds,
  ])];
  const imgMap = {};
  await Promise.all(allIds.map(id => {
    const card = CardDatabase.find(c => c.id === id);
    if (!card?.image) return Promise.resolve();
    return new Promise(resolve => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload  = () => { imgMap[id] = img; resolve(); };
      img.onerror = resolve;
      img.src = card.image;
    });
  }));

  const canvas = document.createElement('canvas');
  canvas.width  = CANVAS_W;
  canvas.height = totalH;
  const ctx = canvas.getContext('2d');

  // ── Sfondo: artwork del commander ritagliato e sfocato ──
  // Crop dell'artwork sulla carta: offset (67,67), dimensioni 1070×800
  const ART_SX = 67, ART_SY = 67, ART_SW = 1070, ART_SH = 800;
  const cmdImg = deck.commanderId ? imgMap[deck.commanderId] : null;
  if (cmdImg) {
    ctx.save();
    ctx.filter = 'blur(18px)';
    const scale = Math.max(CANVAS_W / ART_SW, totalH / ART_SH);
    const bw = ART_SW * scale, bh = ART_SH * scale;
    const bx = (CANVAS_W - bw) / 2, by = (totalH - bh) / 2;
    ctx.drawImage(cmdImg, ART_SX, ART_SY, ART_SW, ART_SH, bx, by, bw, bh);
    ctx.restore();
    ctx.fillStyle = 'rgba(5, 8, 15, 0.72)';
    ctx.fillRect(0, 0, CANVAS_W, totalH);
  } else {
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, CANVAS_W, totalH);
  }

  // ── Titolo mazzo ──
  ctx.fillStyle = '#e8e8e8';
  ctx.font      = 'bold 54px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(deck.name, CANVAS_W / 2, 52);

  let y = 80;

  // ── Riga superiore: Commander (sx) + Territory (dx) ──
  if (topRowH) {
    if (cmdCard) {
      ctx.fillStyle = '#aaaaaa';
      ctx.font      = 'bold 12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('COMMANDER', PAD, y + 22);
      _imgDrawCard(ctx, deck.commanderId, cmdCard, imgMap, PAD, y + SEC_H, CMD_W, CMD_H, 0);
    }

    if (terrIds.length) {
      const terrX = PAD + (cmdCard ? CMD_AREA : 0);
      ctx.fillStyle = '#aaaaaa';
      ctx.font      = 'bold 12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`TERRITORY  ${(deck.territoryCards||[]).length}/12`, terrX, y + 22);
      terrIds.forEach((id, i) => {
        const col = i % TERR_COLS, row = Math.floor(i / TERR_COLS);
        _imgDrawCard(ctx, id, CardDatabase.find(c => c.id === id), imgMap,
          terrX + col * (CARD_W + GAP), y + SEC_H + row * (CARD_H + GAP),
          CARD_W, CARD_H, terrCounts[id]);
      });
    }

    y += topRowH + SEC_GAP;
  }

  // ── Sezioni main (Quest / Spell / Minion) ──
  mainSections.forEach(sec => {
    _imgDrawSection(ctx, sec, y, PAD, MAIN_COLS, CARD_W, CARD_H, GAP, SEC_H, imgMap);
    y += SEC_H + Math.ceil(sec.ids.length / MAIN_COLS) * (CARD_H + GAP) + SEC_GAP;
  });

  // ── Sideboard ──
  if (sideIds.length) {
    _imgDrawSection(ctx,
      { label: `SIDEBOARD  ${(deck.sideboardCards||[]).length}/10`, ids: sideIds, counts: sideCounts },
      y, PAD, MAIN_COLS, CARD_W, CARD_H, GAP, SEC_H, imgMap);
  }

  try {
    const url = canvas.toDataURL('image/png');
    const a   = document.createElement('a');
    a.download = `${deck.name.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_') || 'deck'}.png`;
    a.href = url;
    a.click();
  } catch {
    showToast('Export immagine non riuscito (CORS sulle immagini).');
  }
}

function _imgDrawSection(ctx, sec, y, PAD, COLS, W, H, GAP, SEC_H, imgMap) {
  ctx.fillStyle = '#aaaaaa';
  ctx.font      = 'bold 12px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(sec.label, PAD, y + 22);
  sec.ids.forEach((id, i) => {
    _imgDrawCard(ctx, id, CardDatabase.find(c => c.id === id), imgMap,
      PAD + (i % COLS) * (W + GAP),
      y + SEC_H + Math.floor(i / COLS) * (H + GAP),
      W, H, sec.counts[id]);
  });
}

function _imgDrawCard(ctx, id, card, imgMap, x, y, W, H, count) {
  if (imgMap[id]) {
    ctx.drawImage(imgMap[id], x, y, W, H);
  } else {
    ctx.fillStyle = COLOR_HEX[card?.color] ?? '#333333';
    ctx.fillRect(x, y, W, H);
    if (card) {
      ctx.fillStyle = '#ffffff';
      ctx.font      = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(card.name, x + W / 2, y + H / 2);
      ctx.textAlign = 'left';
    }
  }
  if (count > 1) {
    ctx.fillStyle = 'rgba(0,0,0,0.82)';
    ctx.fillRect(x + W - 26, y + 5, 22, 22);
    ctx.fillStyle = '#ffffff';
    ctx.font      = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`×${count}`, x + W - 15, y + 19);
    ctx.textAlign = 'left';
  }
}
