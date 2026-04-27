// ============================================================
// advancedsearch/index.js — Entry point della schermata.
// ============================================================

import { FilterManager, renderTagList, addTag, updateFilterBadge } from './filter-manager.js';
import { CardGrid }        from './card-grid.js';
import { AnalyticsPanel }  from './analytics-panel.js';
import { ChartsModule }    from './charts.js';
import { updateBackButtons } from '../../core/router.js';

export function renderAdvancedSearchScreen() {
  const screen = document.getElementById("screen-advancedsearch");
  if (!screen) return;

  screen.innerHTML = `
    <h2 class="page-title">Advanced search</h2>
    <p class="page-subtitle">Analyze the entire pool of cards with filter and cool graphs.</p>

    <div class="card-panel">
      <button class="as-filters-toggle" id="as-filters-toggle">
        <span id="as-toggle-label">▾ Filter</span>
        <span class="as-filter-badge badge" id="as-filter-badge"></span>
      </button>

      <div class="as-filters-body" id="as-filters-body">

        <!-- Riga 1: Nome / Testo -->
        <div class="as-filter-row">
          <div class="as-filter-group" style="flex:1; min-width:200px;">
            <div class="as-filter-header">
              <span>Name</span>
              <button class="as-reset-field" data-field="name" title="Reset">↺</button>
            </div>
            <input id="as-name-input" class="input" type="text" placeholder="Es: Edwin..." />
          </div>
          <div class="as-filter-group" style="flex:1; min-width:200px;">
            <div class="as-filter-header">
              <span>Card text</span>
              <button class="as-reset-field" data-field="text" title="Reset">↺</button>
            </div>
            <input id="as-text-input" class="input" type="text" placeholder="Es: as an additional cost recycle 3 minion cards" />
          </div>
        </div>

        <!-- Riga 2: Tipo / Sottotipo (tag-input) -->
        <div class="as-filter-row">
          <div class="as-filter-group" style="flex:1; min-width:220px;">
            <div class="as-filter-header">
              <span>Type</span>
              <button class="as-reset-field" data-field="types" title="Reset">↺</button>
            </div>
            <div class="as-tag-row">
              <input id="as-type-input" class="input" type="text"
                     placeholder="Es: minion, spell…" list="as-type-dl" style="flex:1;">
              <datalist id="as-type-dl">
                <option value="Minion">
                <option value="Spell">
                <option value="Territory">
                <option value="Quest">
              </datalist>
              <button class="secondary-btn" id="as-type-add">+ Add</button>
            </div>
            <div class="as-tags-list" id="as-types-tags"></div>
          </div>
          <div class="as-filter-group" style="flex:1; min-width:220px;">
            <div class="as-filter-header">
              <span>Subtype</span>
              <button class="as-reset-field" data-field="subtypes" title="Reset">↺</button>
            </div>
            <div class="as-tag-row">
              <input id="as-subtype-input" class="input" type="text"
                     placeholder="Es: warrior, vampire…" list="as-subtype-dl" style="flex:1;">
              <datalist id="as-subtype-dl"></datalist>
              <button class="secondary-btn" id="as-subtype-add">+ Add</button>
            </div>
            <div class="as-tags-list" id="as-subtypes-tags"></div>
          </div>
        </div>

        <!-- Riga 3: Costo neutro / Costo colore -->
        <div class="as-filter-row">
          <div class="as-filter-group" style="min-width:230px;">
            <div class="as-filter-header">
              <span>Neutral cost</span>
              <button class="as-reset-field" data-field="cost" title="Reset">↺</button>
            </div>
            <div class="as-range-row">
              <span class="as-range-val" id="as-neutral-min-lbl">0</span>
              <input id="as-cost-neutral-min" type="range" min="0" max="20" value="0" step="1">
              <span class="muted" style="font-size:11px;">–</span>
              <input id="as-cost-neutral-max" type="range" min="0" max="20" value="20" step="1">
              <span class="as-range-val" id="as-neutral-max-lbl">20</span>
            </div>
          </div>
          <div class="as-filter-group" style="min-width:230px;">
            <div class="as-filter-header"><span>Color cost</span></div>
            <div class="as-range-row">
              <span class="as-range-val" id="as-color-min-lbl">0</span>
              <input id="as-cost-color-min" type="range" min="0" max="20" value="0" step="1">
              <span class="muted" style="font-size:11px;">–</span>
              <input id="as-cost-color-max" type="range" min="0" max="20" value="20" step="1">
              <span class="as-range-val" id="as-color-max-lbl">20</span>
            </div>
          </div>
        </div>

        <!-- Riga 4: ATK / DEF / Keywords -->
        <div class="as-filter-row">
          <div class="as-filter-group">
            <div class="as-filter-header">
              <span>ATK</span>
              <button class="as-reset-field" data-field="atk" title="Reset">↺</button>
            </div>
            <div class="row" style="gap:6px;">
              <input id="as-atk-min" class="input" type="number" placeholder="Min" min="0" style="width:72px;">
              <span class="muted">–</span>
              <input id="as-atk-max" class="input" type="number" placeholder="Max" min="0" style="width:72px;">
            </div>
          </div>
          <div class="as-filter-group">
            <div class="as-filter-header">
              <span>DEF</span>
              <button class="as-reset-field" data-field="def" title="Reset">↺</button>
            </div>
            <div class="row" style="gap:6px;">
              <input id="as-def-min" class="input" type="number" placeholder="Min" min="0" style="width:72px;">
              <span class="muted">–</span>
              <input id="as-def-max" class="input" type="number" placeholder="Max" min="0" style="width:72px;">
            </div>
          </div>
          <div class="as-filter-group" style="flex:1; min-width:220px;">
            <div class="as-filter-header">
              <span>Keywords</span>
              <button class="as-reset-field" data-field="keywords" title="Reset">↺</button>
            </div>
            <div class="as-tag-row">
              <input id="as-keyword-input" class="input" type="text"
                     placeholder="Es: stealth, protector…" list="as-keyword-dl" style="flex:1;">
              <datalist id="as-keyword-dl"></datalist>
              <button class="secondary-btn" id="as-keyword-add">+ Aggiungi</button>
            </div>
            <div class="as-tags-list" id="as-keywords-tags"></div>
          </div>
        </div>

        <!-- Riga 5 (fondo): Colori / Rarità / Set -->
        <div class="as-filter-row">
          <div class="as-filter-group" style="min-width:220px;">
            <div class="as-filter-header">
              <span>Colors</span>
              <button class="as-reset-field" data-field="colors" title="Reset">↺</button>
            </div>
            <div class="row" style="gap:6px; flex-wrap:wrap;">
              <button class="as-color-btn" data-color="blue"      title="Blue">Blue</button>
              <button class="as-color-btn" data-color="green"     title="Green">Green</button>
              <button class="as-color-btn" data-color="red"       title="Red">Red</button>
              <button class="as-color-btn" data-color="black"     title="Black">Black</button>
              <button class="as-color-btn" data-color="colorless" title="Colorless">∅</button>
            </div>
          </div>
          <div class="as-filter-group">
            <div class="as-filter-header">
              <span>Rarity</span>
              <button class="as-reset-field" data-field="rarities" title="Reset">↺</button>
            </div>
            <label class="as-rarity-check-label">
              <input class="as-rarity-check" type="checkbox" value="Legendary"> Legendary
            </label>
            <label class="as-rarity-check-label">
              <input class="as-rarity-check" type="checkbox" value="Normal"> Normal
            </label>
          </div>
          <div class="as-filter-group" style="min-width:160px;">
            <div class="as-filter-header">
              <span>Set</span>
              <button class="as-reset-field" data-field="setNum" title="Reset">↺</button>
            </div>
            <select id="as-set-select" class="select"><option value="">Tutti i set</option></select>
          </div>
        </div>

        <!-- Barra azioni -->
        <div class="as-search-bar">
          <button class="primary-btn" id="as-search-btn">Search</button>
          <button class="secondary-btn" id="as-reset-all-btn">Reset</button>
          <span class="as-query-debug" id="as-query-debug"></span>
        </div>
      </div>
    </div>

    <!-- Griglia carte -->
    <div style="margin-top:20px;">
      <h3 style="margin:0 0 4px; font-family:'Cinzel Decorative',serif; font-size:15px; color:var(--parchment);">
        Results
      </h3>
      <div id="as-card-grid" class="as-card-grid">
        <div class="as-state-msg">Set your filter and click on <strong>Search</strong>.</div>
      </div>
      <div id="as-pagination" class="as-pagination"></div>
    </div>

    <!-- Analytics -->
    <div id="as-analytics-container" style="margin-top:28px;"></div>
  `;

  document.getElementById("as-analytics-container").innerHTML = AnalyticsPanel.render();
  ChartsModule.init();

  CardGrid.page = 1;

  FilterManager.loadLookups();

  // ── Listeners ─────────────────────────────────────────────

  document.getElementById("as-filters-toggle").onclick = () => {
    const body = document.getElementById("as-filters-body");
    const open = body.classList.toggle("collapsed") === false;
    document.getElementById("as-toggle-label").textContent = open ? "▾ Close filters" : "▸ Open filters";
  };

  const bindText = (id, field) => {
    const el = document.getElementById(id);
    if (el) el.oninput = () => { FilterManager.state[field] = el.value.trim(); updateFilterBadge(); };
  };
  bindText("as-name-input", "name");
  bindText("as-text-input", "text");

  // Tipo (tag-input)
  const typeAdd = () => addTag("as-type-input", "as-types-tags", "types", FilterManager.allTypes);
  document.getElementById("as-type-add").onclick    = typeAdd;
  document.getElementById("as-type-input").onkeydown = e => { if (e.key === "Enter") typeAdd(); };

  // Sottotipo (tag-input)
  const stAdd = () => addTag("as-subtype-input", "as-subtypes-tags", "subtypes", FilterManager.allSubtypes);
  document.getElementById("as-subtype-add").onclick    = stAdd;
  document.getElementById("as-subtype-input").onkeydown = e => { if (e.key === "Enter") stAdd(); };

  // Range costi
  const makeRangeSync = (minId, maxId, minLblId, maxLblId, minKey, maxKey) => {
    const minEl = document.getElementById(minId);
    const maxEl = document.getElementById(maxId);
    const minLb = document.getElementById(minLblId);
    const maxLb = document.getElementById(maxLblId);
    const sync  = () => {
      let mn = parseInt(minEl.value), mx = parseInt(maxEl.value);
      if (mn > mx) { [mn, mx] = [mx, mn]; minEl.value = mn; maxEl.value = mx; }
      if (minLb) minLb.textContent = mn;
      if (maxLb) maxLb.textContent = mx;
      FilterManager.state[minKey] = mn;
      FilterManager.state[maxKey] = mx;
      updateFilterBadge();
    };
    if (minEl) minEl.oninput = sync;
    if (maxEl) maxEl.oninput = sync;
  };
  makeRangeSync("as-cost-neutral-min","as-cost-neutral-max","as-neutral-min-lbl","as-neutral-max-lbl","costNeutralMin","costNeutralMax");
  makeRangeSync("as-cost-color-min",  "as-cost-color-max",  "as-color-min-lbl",  "as-color-max-lbl",  "costColorMin",  "costColorMax");

  const bindNum = (id, field) => {
    const el = document.getElementById(id);
    if (el) el.oninput = () => { FilterManager.state[field] = el.value; updateFilterBadge(); };
  };
  bindNum("as-atk-min", "atkMin"); bindNum("as-atk-max", "atkMax");
  bindNum("as-def-min", "defMin"); bindNum("as-def-max", "defMax");

  // Keywords (tag-input)
  const kwAdd = () => addTag("as-keyword-input", "as-keywords-tags", "keywords", FilterManager.allKeywords);
  document.getElementById("as-keyword-add").onclick    = kwAdd;
  document.getElementById("as-keyword-input").onkeydown = e => { if (e.key === "Enter") kwAdd(); };

  // Colori
  document.querySelectorAll(".as-color-btn").forEach(btn => {
    btn.onclick = () => {
      const c = btn.dataset.color, arr = FilterManager.state.colors;
      const i = arr.indexOf(c);
      if (i >= 0) arr.splice(i, 1); else arr.push(c);
      btn.classList.toggle("active", arr.includes(c));
      updateFilterBadge();
    };
  });

  // Rarità
  document.querySelectorAll(".as-rarity-check").forEach(cb => {
    cb.onchange = () => {
      const arr = FilterManager.state.rarities;
      if (cb.checked) { if (!arr.includes(cb.value)) arr.push(cb.value); }
      else { const i = arr.indexOf(cb.value); if (i >= 0) arr.splice(i, 1); }
      updateFilterBadge();
    };
  });

  // Set
  document.getElementById("as-set-select").onchange = e => {
    FilterManager.state.setNum = e.target.value;
    updateFilterBadge();
  };

  // Reset singoli campi
  document.querySelectorAll(".as-reset-field").forEach(btn => {
    btn.onclick = e => {
      e.stopPropagation();
      FilterManager.resetField(btn.dataset.field);
    };
  });

  // Reset tutto
  document.getElementById("as-reset-all-btn").onclick = () => {
    FilterManager.reset();
    document.getElementById("as-query-debug").textContent = "";
  };

  // Cerca
  document.getElementById("as-search-btn").onclick = () => {
    CardGrid.page = 1;
    const dbg = document.getElementById("as-query-debug");
    if (dbg) dbg.textContent = FilterManager.buildQueryParams() || "";
    CardGrid.fetchAndRender();
    ChartsModule.notifySearchComplete();
  };

  updateFilterBadge();
  updateBackButtons();
}
