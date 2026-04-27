// ============================================================
// advancedsearch/filter-manager.js
// ============================================================

import { db } from '../../core/supabase-client.js';

// ── Utility ──────────────────────────────────────────────────

export function updateFilterBadge() {
  const badge = document.getElementById("as-filter-badge");
  if (!badge) return;
  const n = FilterManager.countActive();
  badge.textContent   = n > 0 ? n : "";
  badge.style.display = n > 0 ? "inline-block" : "none";
}

export function renderTagList(containerId, tags, listKey) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = tags.map(tag => `
    <span class="as-tag">
      ${tag}
      <button class="as-tag-remove" data-list="${listKey}" data-value="${tag}" title="Rimuovi">×</button>
    </span>
  `).join("");
  el.querySelectorAll(".as-tag-remove").forEach(btn => {
    btn.onclick = () => {
      FilterManager.state[btn.dataset.list] =
        FilterManager.state[btn.dataset.list].filter(v => v !== btn.dataset.value);
      renderTagList(containerId, FilterManager.state[btn.dataset.list], listKey);
      updateFilterBadge();
    };
  });
}

export function addTag(inputId, containerId, listKey, allValues) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const raw     = input.value.trim();
  if (!raw) return;
  const matched = allValues.find(v => v.toLowerCase() === raw.toLowerCase()) || raw;
  const list    = FilterManager.state[listKey];
  if (!list.includes(matched)) {
    list.push(matched);
    renderTagList(containerId, list, listKey);
    updateFilterBadge();
  }
  input.value = "";
  input.focus();
}

// ── FilterManager ─────────────────────────────────────────────

export const FilterManager = {
  state: {
    name:           "",
    text:           "",
    colors:         [],
    types:          [],
    rarities:       [],
    costNeutralMin: 0,
    costNeutralMax: 20,
    costColorMin:   0,
    costColorMax:   20,
    atkMin:         "",
    atkMax:         "",
    defMin:         "",
    defMax:         "",
    keywords:       [],
    subtypes:       [],
    setNum:         "",
  },

  allTypes:    ["Minion", "Spell", "Quest", "Territory"],
  allKeywords: [],
  allSubtypes: [],
  allSets:     [],

  _defaults() {
    return {
      name: "", text: "", colors: [], types: [],
      rarities: [],
      costNeutralMin: 0, costNeutralMax: 20,
      costColorMin:   0, costColorMax:   20,
      atkMin: "", atkMax: "",
      defMin: "", defMax: "",
      keywords: [], subtypes: [],
      setNum: "",
    };
  },

  countActive() {
    const s = this.state, d = this._defaults();
    let n = 0;
    if (s.name)                                                                         n++;
    if (s.text)                                                                         n++;
    if (s.colors.length)                                                                n++;
    if (s.types.length)                                                                 n++;
    if (s.rarities.length)                                                              n++;
    if (s.costNeutralMin !== d.costNeutralMin || s.costNeutralMax !== d.costNeutralMax) n++;
    if (s.costColorMin   !== d.costColorMin   || s.costColorMax   !== d.costColorMax)   n++;
    if (s.atkMin !== "" || s.atkMax !== "")                                             n++;
    if (s.defMin !== "" || s.defMax !== "")                                             n++;
    if (s.keywords.length)                                                              n++;
    if (s.subtypes.length)                                                              n++;
    if (s.setNum)                                                                       n++;
    return n;
  },

  buildQueryParams() {
    const s = this.state;
    const p = new URLSearchParams();
    if (s.name)         p.append("name",      `ilike.*${s.name}*`);
    if (s.text)         p.append("card_text", `ilike.*${s.text}*`);
    if (s.types.length) p.append("type_line", `in.(${s.types.join(",")})`);
    if (s.rarities.length === 1) p.append("rarity", `eq.${s.rarities[0]}`);
    else if (s.rarities.length > 1) p.append("rarity", `in.(${s.rarities.join(",")})`);
    if (s.costNeutralMin > 0)  p.append("cost_neutral", `gte.${s.costNeutralMin}`);
    if (s.costNeutralMax < 20) p.append("cost_neutral", `lte.${s.costNeutralMax}`);
    if (s.costColorMin   > 0)  p.append("cost_color",   `gte.${s.costColorMin}`);
    if (s.costColorMax   < 20) p.append("cost_color",   `lte.${s.costColorMax}`);
    if (s.atkMin !== "")       p.append("atk", `gte.${s.atkMin}`);
    if (s.atkMax !== "")       p.append("atk", `lte.${s.atkMax}`);
    if (s.defMin !== "")       p.append("def", `gte.${s.defMin}`);
    if (s.defMax !== "")       p.append("def", `lte.${s.defMax}`);
    if (s.setNum)              p.append("set_num", `eq.${s.setNum}`);
    return p.toString();
  },

  reset() {
    Object.assign(this.state, this._defaults());
    this.syncUI();
  },

  resetField(field) {
    const d = this._defaults();
    if      (field === "colors")   { this.state.colors   = []; }
    else if (field === "types")    { this.state.types    = []; }
    else if (field === "subtypes") { this.state.subtypes = []; }
    else if (field === "cost")     {
      this.state.costNeutralMin = d.costNeutralMin; this.state.costNeutralMax = d.costNeutralMax;
      this.state.costColorMin   = d.costColorMin;   this.state.costColorMax   = d.costColorMax;
    }
    else if (field === "atk")      { this.state.atkMin = ""; this.state.atkMax = ""; }
    else if (field === "def")      { this.state.defMin = ""; this.state.defMax = ""; }
    else if (field === "keywords") { this.state.keywords = []; }
    else if (field in d)           { this.state[field] = d[field]; }
    this.syncUI();
  },

  syncUI() {
    const s = this.state;
    const v = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    v("as-name-input",       s.name);
    v("as-text-input",       s.text);
    v("as-cost-neutral-min", s.costNeutralMin);
    v("as-cost-neutral-max", s.costNeutralMax);
    v("as-cost-color-min",   s.costColorMin);
    v("as-cost-color-max",   s.costColorMax);
    v("as-atk-min",          s.atkMin);
    v("as-atk-max",          s.atkMax);
    v("as-def-min",          s.defMin);
    v("as-def-max",          s.defMax);
    v("as-set-select",       s.setNum);

    const lbl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    lbl("as-neutral-min-lbl", s.costNeutralMin);
    lbl("as-neutral-max-lbl", s.costNeutralMax);
    lbl("as-color-min-lbl",   s.costColorMin);
    lbl("as-color-max-lbl",   s.costColorMax);

    document.querySelectorAll(".as-color-btn").forEach(b =>
      b.classList.toggle("active", s.colors.includes(b.dataset.color)));
    document.querySelectorAll(".as-rarity-check").forEach(cb =>
      { cb.checked = s.rarities.includes(cb.value); });

    renderTagList("as-types-tags",    s.types,    "types");
    renderTagList("as-subtypes-tags", s.subtypes, "subtypes");
    renderTagList("as-keywords-tags", s.keywords, "keywords");
    updateFilterBadge();
  },

  async loadLookups() {
    try {
      const [kwRes, stRes, setRes] = await Promise.all([
        db.from("keywords").select("name").order("name"),
        db.from("subtypes").select("name").order("name"),
        db.from("card_sets").select("id, name").order("name"),
      ]);
      this.allKeywords = (kwRes.data  || []).map(r => r.name);
      this.allSubtypes = (stRes.data  || []).map(r => r.name);
      this.allSets     =  setRes.data || [];

      const kwDl = document.getElementById("as-keyword-dl");
      if (kwDl) this.allKeywords.forEach(kw => {
        const o = document.createElement("option"); o.value = kw; kwDl.appendChild(o);
      });

      const stDl = document.getElementById("as-subtype-dl");
      if (stDl) this.allSubtypes.forEach(st => {
        const o = document.createElement("option"); o.value = st; stDl.appendChild(o);
      });

      const setSelect = document.getElementById("as-set-select");
      if (setSelect) this.allSets.forEach(set => {
        const opt = document.createElement("option");
        opt.value = set.id; opt.textContent = set.name;
        setSelect.appendChild(opt);
      });
    } catch (err) {
      console.warn("AdvancedSearch: lookup fallita:", err.message);
    }
  },
};
