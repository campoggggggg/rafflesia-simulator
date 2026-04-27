// ============================================================
// advancedsearch/card-grid.js
//
// CardGrid — fetch paginato da Supabase e render griglia carte.
// ============================================================

import { db }             from '../../core/supabase-client.js';
import { FilterManager }  from './filter-manager.js';
import { buildCardObject } from '../../data/cards.js';

const AS_PER_PAGE = 24;

export const CardGrid = {
  page:    1,
  perPage: AS_PER_PAGE,
  total:   0,
  cards:   [],

  async fetchAndRender() {
    const grid  = document.getElementById("as-card-grid");
    const pager = document.getElementById("as-pagination");
    if (!grid) return;

    grid.innerHTML = `<div class="as-state-msg">Ricerca in corso…</div>`;
    if (pager) pager.innerHTML = "";

    try {
      let mustIds    = null;
      let excludeIds = null;

      const { colors, colorMode, keywords, subtypes } = FilterManager.state;

      if (colors.length > 0) {
        if (colorMode === "exclude") {
          excludeIds = await this._colorCardIds(colors);
        } else {
          const ids = await this._colorCardIds(colors, colorMode === "exact");
          mustIds   = this._intersect(mustIds, ids);
        }
      }

      if (keywords.length > 0) {
        const ids = await this._joinCardIds("keywords", "keyword_id", "card_to_keywords", keywords);
        mustIds   = this._intersect(mustIds, ids);
      }
      if (subtypes.length > 0) {
        const ids = await this._joinCardIds("subtypes", "subtype_id", "card_to_subtypes", subtypes);
        mustIds   = this._intersect(mustIds, ids);
      }

      if (mustIds !== null && mustIds.length === 0) {
        this._renderEmpty(); return;
      }

      const { count, data, error } = await this._mainQuery(mustIds, excludeIds);
      if (error) throw error;

      this.total = count || 0;
      this.cards = (data || []).map(buildCardObject);
      this._renderGrid();
      this._renderPagination();

    } catch (err) {
      console.error("AdvancedSearch:", err);
      grid.innerHTML = `<div class="as-state-msg as-state-error">Errore: ${err.message}</div>`;
    }
  },

  _mainQuery(mustIds, excludeIds) {
    const s      = FilterManager.state;
    const offset = (this.page - 1) * this.perPage;

    let q = db.from("cards")
      .select("*, card_to_colors(colors(name))", { count: "exact" });

    if (s.name)            q = q.ilike("name",      `%${s.name}%`);
    if (s.text)            q = q.ilike("card_text", `%${s.text}%`);
    if (s.types.length > 0) q = q.in("type_line",  s.types);
    if (s.rarities.length > 0) q = q.in("rarity",  s.rarities);
    if (s.costNeutralMin > 0)  q = q.gte("cost_neutral", s.costNeutralMin);
    if (s.costNeutralMax < 20) q = q.lte("cost_neutral", s.costNeutralMax);
    if (s.costColorMin   > 0)  q = q.gte("cost_color",   s.costColorMin);
    if (s.costColorMax   < 20) q = q.lte("cost_color",   s.costColorMax);
    if (s.atkMin !== "") q = q.gte("atk", Number(s.atkMin));
    if (s.atkMax !== "") q = q.lte("atk", Number(s.atkMax));
    if (s.defMin !== "") q = q.gte("def", Number(s.defMin));
    if (s.defMax !== "") q = q.lte("def", Number(s.defMax));
    if (s.setNum)        q = q.eq("set_num", s.setNum);

    if (mustIds    !== null && mustIds.length    > 0) q = q.in("id", mustIds);
    if (excludeIds !== null && excludeIds.length > 0) q = q.not("id", "in", `(${excludeIds.join(",")})`);

    return q.order("name").range(offset, offset + this.perPage - 1);
  },

  async _colorCardIds(colorNames, exactMode = false) {
    const { data: colorRows } = await db
      .from("colors").select("id").in("name", colorNames);
    if (!colorRows || colorRows.length === 0) return [];

    const colorIdList = colorRows.map(r => r.id);

    if (!exactMode) {
      const { data } = await db
        .from("card_to_colors").select("card_id").in("color_id", colorIdList);
      return [...new Set((data || []).map(r => r.card_id))];
    }

    const sets = await Promise.all(colorIdList.map(async cid => {
      const { data } = await db
        .from("card_to_colors").select("card_id").eq("color_id", cid);
      return new Set((data || []).map(r => r.card_id));
    }));
    let intersection = sets[0] ? [...sets[0]] : [];
    for (let i = 1; i < sets.length; i++) {
      intersection = intersection.filter(id => sets[i].has(id));
    }
    if (intersection.length === 0) return [];

    const { data: allColors } = await db
      .from("card_to_colors").select("card_id, color_id").in("card_id", intersection);
    const selected   = new Set(colorIdList);
    const cardColors = {};
    (allColors || []).forEach(r => {
      (cardColors[r.card_id] = cardColors[r.card_id] || new Set()).add(r.color_id);
    });
    return intersection.filter(id => {
      for (const cid of (cardColors[id] || [])) {
        if (!selected.has(cid)) return false;
      }
      return true;
    });
  },

  async _joinCardIds(table, fkColumn, joinTable, names) {
    const { data: rows } = await db.from(table).select("id").in("name", names);
    if (!rows || rows.length === 0) return [];
    const ids = rows.map(r => r.id);
    const { data: joins } = await db.from(joinTable).select("card_id").in(fkColumn, ids);
    return [...new Set((joins || []).map(r => r.card_id))];
  },

  _intersect(existing, newSet) {
    if (existing === null) return newSet;
    const s = new Set(newSet);
    return existing.filter(id => s.has(id));
  },

  _renderGrid() {
    const grid = document.getElementById("as-card-grid");
    if (!grid) return;
    if (this.cards.length === 0) { this._renderEmpty(); return; }

    grid.innerHTML = this.cards.map(card => `
      <div class="as-card-item" title="${card.name}">
        <div class="as-card-img-placeholder">
          <img src="${card.image}" alt="${card.name}" class="as-card-img"
               onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
          <div class="as-card-img-fallback" style="display:none;">${card.name}</div>
        </div>
        <div class="as-card-meta">
          <span class="as-card-name">${card.name}</span>
          <span class="as-card-rarity as-rarity-${(card.rarity || "").toLowerCase()}">${card.rarity || "—"}</span>
          <span class="as-card-cost">${card.cost}</span>
        </div>
      </div>
    `).join("");
  },

  _renderEmpty() {
    const grid = document.getElementById("as-card-grid");
    if (grid)  grid.innerHTML = `<div class="as-state-msg">Nessuna carta trovata.</div>`;
    const pager = document.getElementById("as-pagination");
    if (pager) pager.innerHTML = "";
  },

  _renderPagination() {
    const pager = document.getElementById("as-pagination");
    if (!pager) return;
    const totalPages = Math.max(1, Math.ceil(this.total / this.perPage));

    pager.innerHTML = `
      <button class="secondary-btn" id="as-prev-btn" ${this.page <= 1 ? "disabled" : ""}>← Prev</button>
      <span class="as-pager-info">
        Pagina ${this.page} di ${totalPages}
        <span class="muted">(${this.total} carte totali)</span>
      </span>
      <button class="secondary-btn" id="as-next-btn" ${this.page >= totalPages ? "disabled" : ""}>Next →</button>
    `;
    document.getElementById("as-prev-btn").onclick = () => {
      if (this.page > 1) { this.page--; this.fetchAndRender(); }
    };
    document.getElementById("as-next-btn").onclick = () => {
      if (this.page < totalPages) { this.page++; this.fetchAndRender(); }
    };
  },
};
