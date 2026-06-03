// deckbuilder.js

import { AppState, getCurrentDeck }          from '../core/state.js';
import { saveDecks, deleteDeckFromSupabase, saveDeckToSupabase } from '../data/decks.js';
import { CardDatabase, CardMap }             from '../data/cards.js';
import { db }                                from '../core/supabase-client.js';
import { showGlobalToast as showToast }      from '../core/ui.js';
import {
  onExportCode, closeExportDialog, copyExportCode,
  onImport, closeImportDialog, doImport,
  onExportImage,
} from './deckbuilder-export.js';
import { openDialog, closeDialog, onPublish } from './deckbuilder-dialog.js';

// ── Stato modulo ──────────────────────────────────────────────
let addMode  = 'main'; // 'main' | 'side'
let orderBy  = 'name-asc';
let filters  = {
  name: '', text: '', type: '', subtype: '',
  colors: [], rarities: [],
  costMin: '', costMax: '',
};

const MAX_MAIN      = 29;
const MAX_TERRITORY = 12;
const MAX_SIDE      = 10;
const ALL_COLORS    = ['blue', 'green', 'red', 'black', 'colorless'];
const COLOR_HEX     = {
  blue:      '#336699',
  green:     '#385400',
  red:       '#8A0000',
  black:     '#262B2F',
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
function debounce(fn, ms) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}
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
  if (!screen) return;

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
    <div class="db-tb-brand"></div>

    <div class="db-tb-actions">
      <div class="db-tb-group db-tb-group-left">
        <button class="db-btn db-btn-io" id="db-import">↓ import</button>
        <button class="db-btn db-btn-io" id="db-export-code">↑ export code</button>
        <button class="db-btn db-btn-io" id="db-export-img">↑ export img</button>
      </div>
      <div class="db-tb-sep"></div>
      <div class="db-tb-group db-tb-group-right">
        <button class="db-btn" id="db-save">save</button>
        <button class="db-btn" id="db-rename">rename</button>
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
            </select>
          </div>
          <div class="db-fg">
            <label class="db-fl">Colors</label>
            <div class="db-cpills" id="db-cpills">
              ${ALL_COLORS.map(c => `<button class="db-cpill" data-color="${c}" style="--pc:${COLOR_HEX[c]}" title="${c}"></button>`).join('')}
            </div>
          </div>
          <div class="db-fg">
            <label class="db-fl">Total cost</label>
            <div class="db-range">
              <input class="db-fi db-mini" id="df-cm" type="number" min="0" placeholder="min">
              <span class="db-range-sep">–</span>
              <input class="db-fi db-mini" id="df-cx" type="number" min="0" placeholder="max">
            </div>
          </div>
        </div>

        <div class="db-f-row">
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
  document.getElementById('df-cm').value      = filters.costMin;
  document.getElementById('df-cx').value      = filters.costMax;
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

  // Filtri testo — debounce 250ms per evitare re-render ad ogni tasto
  [['df-name','name'],['df-text','text']].forEach(([id, key]) =>
    document.getElementById(id).addEventListener('input', debounce(e => { filters[key] = e.target.value; renderCardList(); }, 250))
  );
  document.getElementById('df-subtype').addEventListener('change', e => { filters.subtype = e.target.value; renderCardList(); });
  document.getElementById('df-type').addEventListener('change', e => { filters.type = e.target.value; renderCardList(); });

  // Range costo totale
  document.getElementById('df-cm').addEventListener('input', e => { filters.costMin = e.target.value; renderCardList(); });
  document.getElementById('df-cx').addEventListener('input', e => { filters.costMax = e.target.value; renderCardList(); });

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
      const rect = tt.getBoundingClientRect();
      const w = rect.width  || 344;
      const h = rect.height || 480;
      const margin = 8;
      let x = e.clientX + 18;
      let y = e.clientY - Math.round(h / 2);
      if (x + w + margin > window.innerWidth)  x = e.clientX - w - 10;
      if (x < margin) x = margin;
      if (y + h + margin > window.innerHeight) y = window.innerHeight - h - margin;
      if (y < margin) y = margin;
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
  document.getElementById('db-imp-ok').onclick     = () => doImport(renderDeckPanel, renderCardList);
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
function countLegendary(ids) {
  return ids.filter(id => CardMap.get(id)?.rarity === 'Legendary').length;
}

function renderDeckPanel() {
  const panel = document.getElementById('db-deck-panel');
  if (!panel) return;
  const deck = getCurrentDeck();
  ensure(deck);

  const mainN = deck.cards.length;
  const terrN = deck.territoryCards.length;
  const sideN = deck.sideboardCards.length;
  const hasCmd = !!deck.commanderId;


  // Raggruppa carte main per tipo
  const groups = { Quest: {}, Spell: {}, Minion: {} };
  deck.cards.forEach(id => {
    const c = CardMap.get(id);
    if (!c) return;
    if (!groups[c.type]) groups[c.type] = {};
    groups[c.type][id] = (groups[c.type][id] || 0) + 1;
  });

  const territory = {};
  deck.territoryCards.forEach(id => { territory[id] = (territory[id] || 0) + 1; });

  const side = {};
  deck.sideboardCards.forEach(id => { side[id] = (side[id] || 0) + 1; });

  const cmdCard    = deck.commanderId ? CardMap.get(deck.commanderId) : null;
  const hoverColor = cmdCard ? (HOVER_HEX[cmdCard.color] ?? HOVER_HEX.colorless) : null;
  const cmdStyle   = [
    hoverColor ? `--hover-color:${hoverColor}` : '',
  ].filter(Boolean).join(';');
  const cmdBg = cmdStyle ? `style="${cmdStyle}"` : '';

  const legMain = countLegendary(deck.cards);
  const legSide = countLegendary(deck.sideboardCards);

  panel.innerHTML = `
    <div class="db-deck-cols" ${cmdBg}>
      <div class="db-dc">
        ${mkSection('COMMANDER', commanderRow(deck))}
        ${mkSection(`QUEST <span class="db-cnt">${deck.cards.filter(id => { const c=CardMap.get(id); return c&&c.type==='Quest'; }).length}</span>`, cardGroup(groups.Quest || {}, 'main'))}
        ${mkSection(`SPELL <span class="db-cnt">${deck.cards.filter(id => { const c=CardMap.get(id); return c&&c.type==='Spell'; }).length}</span>`, cardGroup(groups.Spell || {}, 'main'))}
        ${mkSection(`TERRITORY <span class="db-cnt">${deck.territoryCards.length}/${MAX_TERRITORY}</span>${mkAutofillBtn(!!deck.commanderId)}`, cardGroup(territory, 'territory'))}
        ${mkSection('MANA CURVE', renderManaCurve(deck), 'db-section-chart')}
      </div>
      <div class="db-dc db-dc-right">
        ${mkSection(`MINION <span class="db-cnt">${deck.cards.filter(id => { const c=CardMap.get(id); return c&&c.type==='Minion'; }).length}</span>`, cardGroup(groups.Minion || {}, 'main'))}
        ${mkSection(`SIDEBOARD <span class="db-cnt">${deck.sideboardCards.length}/${MAX_SIDE}</span>`, cardGroup(side, 'side'))}
        <div class="db-leg-badge-row">
          <span class="db-main-count-badge" title="Carte nel main deck">
            <span class="db-leg-n">main</span> ${deck.cards.length}<span class="db-leg-n">/${MAX_MAIN}</span>
          </span>
          <span class="db-leg-badge" title="Legendary nel main deck">◆ <span class="db-leg-n">leg main</span> ${legMain}</span>
          <span class="db-leg-badge" title="Legendary nella sideboard">◆ <span class="db-leg-n">leg side</span> ${legSide}</span>
        </div>
      </div>
    </div>
  `;

  panel.querySelectorAll('.db-dr').forEach(row => {
    const c = CardMap.get(row.dataset.id);
    row.addEventListener('click',      () => removeCard(row.dataset.id, row.dataset.slot));
    if (c) {
      row.addEventListener('mousemove', e => {
        const r = row.getBoundingClientRect();
        (e.clientX - r.left) / r.width <= 0.6 ? showTooltip(c) : hideTooltip();
      });
      row.addEventListener('mouseleave', hideTooltip);
    }
  });

  document.getElementById('db-autofill-btn')?.addEventListener('click', e => {
    e.stopPropagation();
    doAutofill();
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

function mkAutofillBtn(hasCommander) {
  return ` <button class="db-autofill-btn${hasCommander ? '' : ' db-autofill-btn--off'}" id="db-autofill-btn" title="${hasCommander ? 'Riempi i territory mancanti con il colore del commander' : 'Serve un commander per usare autofill'}">autofill</button>`;
}

function doAutofill() {
  const deck = getCurrentDeck();
  ensure(deck);
  if (!deck.commanderId) {
    showToast('Aggiungi prima un commander per usare autofill.');
    return;
  }
  const commander = CardMap.get(deck.commanderId);
  if (!commander) return;

  const missing = MAX_TERRITORY - deck.territoryCards.length;
  if (missing <= 0) { showToast('Territory già pieno.'); return; }

  const candidates = CardDatabase.filter(c =>
    c.type === 'Territory' && c.color === commander.color
  );
  if (!candidates.length) {
    showToast(`Nessun territory di colore ${commander.color} disponibile.`);
    return;
  }

  for (let i = 0; i < missing; i++) {
    const pick = candidates[i % candidates.length];
    deck.territoryCards.push(pick.id);
  }
  saveDecks(); renderDeckPanel(); renderCardList();
}

function commanderRow(deck) {
  if (!deck.commanderId) return `<div class="db-empty">— nessuno —</div>`;
  const c = CardMap.get(deck.commanderId);
  if (!c) return `<div class="db-empty">— carta non trovata —</div>`;
  return `
    <div class="db-dr db-dr-commander db-dr-art" data-id="${c.id}" data-slot="commander" title="Click per rimuovere" style="${imageVar(c)}">
      <span class="db-dn"><span class="db-cmd-p">P</span> · ${esc(c.name)}</span>
      ${makePips(c)}
    </div>
  `;
}

function cardGroup(group, slot) {
  const ids = Object.keys(group).sort((a, b) => {
    const ca = CardMap.get(a), cb = CardMap.get(b);
    const costA = ((ca?.cost_neutral ?? 0) + (ca?.cost_color ?? 0));
    const costB = ((cb?.cost_neutral ?? 0) + (cb?.cost_color ?? 0));
    return costA - costB;
  });
  if (!ids.length) return `<div class="db-empty">—</div>`;
  return ids.map(id => {
    const c = CardMap.get(id);
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
    const card = CardMap.get(id);
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
  if (card.type === 'Territory') {
    return `<div class="db-pips">
      ${gem}
      <span class="db-pip-territory" style="--terr-c:${col}" title="${card.color}">◆</span>
    </div>`;
  }
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
    const totalCost = (c.cost_neutral ?? 0) + (c.cost_color ?? 0);
    if (f.costMin !== '' && totalCost < +f.costMin)                                          return false;
    if (f.costMax !== '' && totalCost > +f.costMax)                                          return false;
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

export function renderCardList() {
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
    const c = CardMap.get(row.dataset.id);
    if (!c) return;
    row.addEventListener('click', () => addCard(c));
    row.addEventListener('mousemove', e => {
      const r = row.getBoundingClientRect();
      (e.clientX - r.left) / r.width <= 0.6 ? showTooltip(c) : hideTooltip();
    });
    row.addEventListener('mouseleave', hideTooltip);
  });

  // Preload immagini delle carte visibili in background.
  // setTimeout(0) lascia completare il repaint del DOM prima di avviare i download.
  setTimeout(() => {
    cards.forEach(c => { new Image().src = c.image; });
  }, 0);
}

// ─────────────────────────────────────────────────────────────
// LOGICA AGGIUNTA CARTA
// ─────────────────────────────────────────────────────────────
function addCard(card) {
  const deck      = getCurrentDeck();
  ensure(deck);
  const commander = deck.commanderId ? CardMap.get(deck.commanderId) : null;

  // 1. Nessun commander → la prima carta legendary diventa commander
  if (!deck.commanderId) {
    if (card.rarity === 'Legendary' && card.type !== 'Territory') {
      deck.commanderId = card.id;
      saveDecks(); renderDeckPanel(); renderCardList(); return;
    }
    showToast('Aggiungi prima un Legendary come commander.');
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

  // 5. MAIN o SIDE — il limite di copie è condiviso tra i due
  const copieMain = deck.cards.filter(id => id === card.id).length;
  const copieSide = deck.sideboardCards.filter(id => id === card.id).length;
  const copieTotal = copieMain + copieSide;
  if (copieTotal >= getMaxCopies(card)) {
    showToast(`Max ${getMaxCopies(card)} cop. di "${card.name}" tra main e side.`); return;
  }
  if (addMode === 'main') {
    if (deck.cards.length >= MAX_MAIN) { showToast(`Main deck pieno (${MAX_MAIN}/29).`); return; }
    deck.cards.push(card.id);
  } else {
    if (deck.sideboardCards.length >= MAX_SIDE) { showToast(`Sideboard pieno (${MAX_SIDE}/10).`); return; }
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

  populateSubtypeDropdown();
}

export async function populateSubtypeDropdown() {
  const subtypeSel = document.getElementById('df-subtype');
  if (!subtypeSel) return;
  try {
    const { data, error } = await db.from('subtypes').select('name').order('name');
    if (error) throw error;
    const subtypes = (data || []).map(r => r.name);
    subtypeSel.innerHTML = `<option value="">Tutti</option>` +
      subtypes.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join('');
  } catch {
    // fallback: ricava subtypes dalle carte locali
    const subtypes = [...new Set(CardDatabase.map(c => c.subtype).filter(Boolean))].sort();
    subtypeSel.innerHTML = `<option value="">Tutti</option>` +
      subtypes.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join('');
  }
  subtypeSel.value = filters.subtype;
}

// ─────────────────────────────────────────────────────────────
// AZIONI TOPBAR
// ─────────────────────────────────────────────────────────────
function onNew() {
  openDialog('Nome del nuovo mazzo:', '', async name => {
    if (!name.trim()) return;
    const btn = document.getElementById('db-new');
    if (btn) { btn.disabled = true; btn.textContent = '…'; }
    try {
      const d = {
        id: Date.now(), name: name.trim(),
        commanderId: null, cards: [], territoryCards: [], sideboardCards: [],
      };
      AppState.decks.push(d);
      AppState.currentDeckId = d.id;
      await saveDeckToSupabase(d);   // Supabase aggiorna d.id con l'UUID reale
      AppState.currentDeckId = d.id; // sincronizza dopo che d.id è cambiato
      await renderDeckBuilderScreen();
    } catch (e) {
      console.error('onNew:', e);
      showToast('Errore nella creazione del mazzo.');
      if (btn) { btn.disabled = false; btn.textContent = '+ new'; }
    }
  });
}

function onDelete() {
  if (AppState.decks.length <= 1) {
    showToast('Non puoi eliminare l\'unico mazzo.');
    return;
  }
  const deck = getCurrentDeck();
  openDialog(`Eliminare il mazzo "${esc(deck.name)}"?`, null, async () => {
    const deleted  = AppState.decks.find(d => String(d.id) === String(AppState.currentDeckId));
    const remaining = AppState.decks.filter(d => String(d.id) !== String(AppState.currentDeckId));
    AppState.decks         = remaining;
    AppState.currentDeckId = remaining[0].id;
    try {
      if (deleted) await deleteDeckFromSupabase(deleted);
    } catch (e) {
      console.warn('deleteDeck:', e);
    }
    await renderDeckBuilderScreen();
  });
}

function onRename() {
  const deck = getCurrentDeck();
  openDialog('Rinomina mazzo:', deck.name, async name => {
    if (!name.trim()) return;
    deck.name = name.trim();
    const lbl = document.getElementById('db-sel-label');
    if (lbl) lbl.textContent = deck.name;
    saveDecks();
  });
}

