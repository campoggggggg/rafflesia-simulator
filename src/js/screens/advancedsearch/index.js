// ============================================================
// advancedsearch/index.js — Entry point della schermata.
// ============================================================

import { FilterManager, renderTagList, addTag, updateFilterBadge } from './filter-manager.js';
import { CardGrid }        from './card-grid.js';
import { ChartsModule }    from './charts.js';
import { updateBackButtons } from '../../core/router.js';

export function renderAdvancedSearchScreen() {
  const screen = document.getElementById("screen-advancedsearch");
  if (!screen) return;

  screen.innerHTML = `
<div class="as-root">

  <!-- ── LEFT: card grid (2/3) ──────────────────────────────── -->
  <div class="as-left">
    <h2 class="page-title" style="font-size:22px; margin:0 0 2px;">Advanced search</h2>
    <p class="page-subtitle" style="margin:0 0 0; font-size:13px;">Analyze the entire card pool with filters and graphs.</p>
    <div id="as-card-grid" class="as-card-grid">
      <div class="as-state-msg">Set your filters and click <strong>Search</strong>.</div>
    </div>
    <div id="as-pagination" class="as-pagination"></div>
  </div>

  <!-- ── RIGHT: filters + charts (1/3) ─────────────────────── -->
  <div class="as-right">

    <!-- FILTERS -->
    <div class="as-right-section">
      <div class="as-section-title">Filters</div>

      <!-- Name / Text -->
      <div class="as-f-row">
        <div class="db-fg">
          <label class="db-fl">Name <button class="as-rst" data-field="name" title="Reset">↺</button></label>
          <input id="as-name-input" class="db-fi" type="text" placeholder="name...">
        </div>
        <div class="db-fg">
          <label class="db-fl">Card text <button class="as-rst" data-field="text" title="Reset">↺</button></label>
          <input id="as-text-input" class="db-fi" type="text" placeholder="text...">
        </div>
      </div>

      <!-- Type / Subtype -->
      <div class="as-f-row">
        <div class="db-fg">
          <label class="db-fl">Type <button class="as-rst" data-field="types" title="Reset">↺</button></label>
          <div class="db-range" style="gap:4px;">
            <input id="as-type-input" class="db-fi" type="text" placeholder="minion…" list="as-type-dl" style="flex:1; min-width:0;">
            <datalist id="as-type-dl">
              <option value="Minion"><option value="Spell"><option value="Territory"><option value="Quest">
            </datalist>
            <button class="db-btn" id="as-type-add" style="padding:4px 8px; flex-shrink:0;">+</button>
          </div>
          <div class="as-tags-list" id="as-types-tags"></div>
        </div>
        <div class="db-fg">
          <label class="db-fl">Subtype <button class="as-rst" data-field="subtypes" title="Reset">↺</button></label>
          <div class="db-range" style="gap:4px;">
            <input id="as-subtype-input" class="db-fi" type="text" placeholder="warrior…" list="as-subtype-dl" style="flex:1; min-width:0;">
            <datalist id="as-subtype-dl"></datalist>
            <button class="db-btn" id="as-subtype-add" style="padding:4px 8px; flex-shrink:0;">+</button>
          </div>
          <div class="as-tags-list" id="as-subtypes-tags"></div>
        </div>
      </div>

      <!-- Colors -->
      <div class="db-fg">
        <label class="db-fl">Colors <button class="as-rst" data-field="colors" title="Reset">↺</button></label>
        <div class="db-cpills" style="margin-top:3px;">
          <button class="as-color-btn db-cpill" data-color="blue"      style="--pc:#336699" title="Blue"></button>
          <button class="as-color-btn db-cpill" data-color="green"     style="--pc:#385400" title="Green"></button>
          <button class="as-color-btn db-cpill" data-color="red"       style="--pc:#8A0000" title="Red"></button>
          <button class="as-color-btn db-cpill" data-color="black"     style="--pc:#262B2F" title="Black"></button>
          <button class="as-color-btn db-cpill" data-color="colorless" style="--pc:#A19993" title="Colorless"></button>
        </div>
      </div>

      <!-- Neutral cost / Color cost -->
      <div class="as-f-row">
        <div class="db-fg">
          <label class="db-fl">⬜ cost <button class="as-rst" data-field="cost" title="Reset">↺</button></label>
          <div class="as-range-row">
            <span class="as-range-val" id="as-neutral-min-lbl">0</span>
            <input id="as-cost-neutral-min" type="range" min="0" max="20" value="0" step="1">
            <span class="muted" style="font-size:10px;">–</span>
            <input id="as-cost-neutral-max" type="range" min="0" max="20" value="20" step="1">
            <span class="as-range-val" id="as-neutral-max-lbl">20</span>
          </div>
        </div>
        <div class="db-fg">
          <label class="db-fl">🔵 cost</label>
          <div class="as-range-row">
            <span class="as-range-val" id="as-color-min-lbl">0</span>
            <input id="as-cost-color-min" type="range" min="0" max="20" value="0" step="1">
            <span class="muted" style="font-size:10px;">–</span>
            <input id="as-cost-color-max" type="range" min="0" max="20" value="20" step="1">
            <span class="as-range-val" id="as-color-max-lbl">20</span>
          </div>
        </div>
      </div>

      <!-- ATK / DEF -->
      <div class="as-f-row">
        <div class="db-fg">
          <label class="db-fl">ATK <button class="as-rst" data-field="atk" title="Reset">↺</button></label>
          <div class="db-range">
            <input id="as-atk-min" class="db-fi db-mini" type="number" placeholder="min" min="0">
            <span class="db-range-sep">–</span>
            <input id="as-atk-max" class="db-fi db-mini" type="number" placeholder="max" min="0">
          </div>
        </div>
        <div class="db-fg">
          <label class="db-fl">DEF <button class="as-rst" data-field="def" title="Reset">↺</button></label>
          <div class="db-range">
            <input id="as-def-min" class="db-fi db-mini" type="number" placeholder="min" min="0">
            <span class="db-range-sep">–</span>
            <input id="as-def-max" class="db-fi db-mini" type="number" placeholder="max" min="0">
          </div>
        </div>
      </div>

      <!-- Keywords -->
      <div class="db-fg">
        <label class="db-fl">Keywords <button class="as-rst" data-field="keywords" title="Reset">↺</button></label>
        <div class="db-range" style="gap:4px;">
          <input id="as-keyword-input" class="db-fi" type="text" placeholder="stealth…" list="as-keyword-dl" style="flex:1; min-width:0;">
          <datalist id="as-keyword-dl"></datalist>
          <button class="db-btn" id="as-keyword-add" style="padding:4px 8px; flex-shrink:0;">+</button>
        </div>
        <div class="as-tags-list" id="as-keywords-tags"></div>
      </div>

      <!-- Rarity / Set -->
      <div class="as-f-row">
        <div class="db-fg">
          <label class="db-fl">Rarity <button class="as-rst" data-field="rarities" title="Reset">↺</button></label>
          <div class="db-mode" id="as-rarity-btns">
            <button class="db-mbtn as-rarity-btn" data-rarity="Legendary">◆ Leg.</button>
            <button class="db-mbtn as-rarity-btn" data-rarity="Normal">● Com.</button>
          </div>
        </div>
        <div class="db-fg">
          <label class="db-fl">Set <button class="as-rst" data-field="setNum" title="Reset">↺</button></label>
          <select id="as-set-select" class="db-fi"><option value="">All sets</option></select>
        </div>
      </div>

      <!-- Search + Reset -->
      <div style="display:flex; gap:8px; padding-top:10px; border-top:1px solid var(--border);">
        <button class="db-btn db-btn-primary" id="as-search-btn" style="flex:1;">Search</button>
        <button class="db-btn" id="as-reset-all-btn">Reset</button>
      </div>
    </div>

    <!-- CHARTS -->
    <div class="as-right-section as-charts-section">
      <div class="as-f-row">
        <div class="db-fg">
          <label class="db-fl">Graph type</label>
          <select class="db-fi" id="as-chart-type">
            <option value="">— Type —</option>
            <option value="bar">Bar</option>
            <option value="pie">Pie</option>
            <option value="stacked">Stacked</option>
            <option value="scatter">Scatter</option>
          </select>
        </div>
        <div class="db-fg">
          <label class="db-fl">Variable</label>
          <select class="db-fi" id="as-chart-var">
            <option value="">— Variable —</option>
          </select>
        </div>
      </div>
      <div id="chart-container" class="as-chart-container">
        <p class="muted" style="text-align:center; font-size:12px;">Select a graph type to start analyzing.</p>
      </div>
    </div>

  </div>
</div>
  `;

  ChartsModule.init();

  CardGrid.page = 1;

  FilterManager.loadLookups();

  // ── Text inputs ────────────────────────────────────────────────

  const bindText = (id, field) => {
    const el = document.getElementById(id);
    if (el) el.oninput = () => { FilterManager.state[field] = el.value.trim(); updateFilterBadge(); };
  };
  bindText("as-name-input", "name");
  bindText("as-text-input", "text");

  // ── Tag inputs (Type, Subtype, Keywords) ───────────────────────

  const typeAdd = () => addTag("as-type-input", "as-types-tags", "types", FilterManager.allTypes);
  document.getElementById("as-type-add").onclick     = typeAdd;
  document.getElementById("as-type-input").onkeydown = e => { if (e.key === "Enter") typeAdd(); };

  const stAdd = () => addTag("as-subtype-input", "as-subtypes-tags", "subtypes", FilterManager.allSubtypes);
  document.getElementById("as-subtype-add").onclick     = stAdd;
  document.getElementById("as-subtype-input").onkeydown = e => { if (e.key === "Enter") stAdd(); };

  const kwAdd = () => addTag("as-keyword-input", "as-keywords-tags", "keywords", FilterManager.allKeywords);
  document.getElementById("as-keyword-add").onclick     = kwAdd;
  document.getElementById("as-keyword-input").onkeydown = e => { if (e.key === "Enter") kwAdd(); };

  // ── Range sliders ──────────────────────────────────────────────

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

  // ── Number inputs (ATK / DEF) ──────────────────────────────────

  const bindNum = (id, field) => {
    const el = document.getElementById(id);
    if (el) el.oninput = () => { FilterManager.state[field] = el.value; updateFilterBadge(); };
  };
  bindNum("as-atk-min", "atkMin"); bindNum("as-atk-max", "atkMax");
  bindNum("as-def-min", "defMin"); bindNum("as-def-max", "defMax");

  // ── Color buttons ──────────────────────────────────────────────

  document.querySelectorAll(".as-color-btn").forEach(btn => {
    btn.onclick = () => {
      const c = btn.dataset.color, arr = FilterManager.state.colors;
      const i = arr.indexOf(c);
      if (i >= 0) arr.splice(i, 1); else arr.push(c);
      btn.classList.toggle("active", arr.includes(c));
      updateFilterBadge();
    };
  });

  // ── Rarity buttons ─────────────────────────────────────────────

  document.querySelectorAll(".as-rarity-btn").forEach(btn => {
    btn.onclick = () => {
      const r   = btn.dataset.rarity;
      const arr = FilterManager.state.rarities;
      const i   = arr.indexOf(r);
      if (i >= 0) arr.splice(i, 1); else arr.push(r);
      btn.classList.toggle("active", arr.includes(r));
      updateFilterBadge();
    };
  });

  // ── Set select ─────────────────────────────────────────────────

  document.getElementById("as-set-select").onchange = e => {
    FilterManager.state.setNum = e.target.value;
    updateFilterBadge();
  };

  // ── Reset individual fields ────────────────────────────────────

  document.querySelectorAll(".as-rst").forEach(btn => {
    btn.onclick = e => {
      e.stopPropagation();
      FilterManager.resetField(btn.dataset.field);
    };
  });

  // ── Reset all ──────────────────────────────────────────────────

  document.getElementById("as-reset-all-btn").onclick = () => FilterManager.reset();

  // ── Search ─────────────────────────────────────────────────────

  document.getElementById("as-search-btn").onclick = () => {
    CardGrid.page = 1;
    CardGrid.fetchAndRender();
    ChartsModule.notifySearchComplete();
  };

  updateFilterBadge();
  updateBackButtons();
}
