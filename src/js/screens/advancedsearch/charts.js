// ============================================================
// advancedsearch/charts.js
//
// ChartsModule — logica Chart.js per l'analytics panel.
// Chart.js e chartjs-plugin-datalabels sono caricati via CDN
// come globali (window.Chart, window.ChartDataLabels).
// ============================================================

import { FilterManager } from './filter-manager.js';
import { CardDatabase }  from '../../data/cards.js';
import { db }            from '../../core/supabase-client.js';

Chart.register(ChartDataLabels);

// ── Palette ───────────────────────────────────────────────────
const COLOR_HEX = {
  blue:      '#4a90d9',
  green:     '#4a9a5a',
  red:       '#c04040',
  black:     '#0a0a0a',
  colorless: '#7f8c8d',
};

const TYPE_COLORS = {
  Minion:    '#8b5cf6',
  Spell:     '#3b82f6',
  Quest:     '#f59e0b',
  Territory: '#10b981',
};

const RARITY_COLORS = {
  Legendary: '#f59e0b',
  Normal:    '#6b7280',
};

const VIOLET     = '#8b5cf6';
const TEXT_DIM   = '#9c97ba';
const BG_MAIN    = '#0d0d18';
const GRID_COLOR = 'rgba(255,255,255,0.06)';

// ── Helpers DB ────────────────────────────────────────────────

async function _colorCardIds(colorNames) {
  const { data: colorRows } = await db.from("colors").select("id").in("name", colorNames);
  if (!colorRows?.length) return [];
  const colorIdList = colorRows.map(r => r.id);
  const { data } = await db.from("card_to_colors").select("card_id").in("color_id", colorIdList);
  return [...new Set((data ?? []).map(r => r.card_id))];
}

async function _joinCardIds(table, fkColumn, joinTable, names) {
  const { data: rows } = await db.from(table).select("id").in("name", names);
  if (!rows?.length) return [];
  const ids = rows.map(r => r.id);
  const { data: joins } = await db.from(joinTable).select("card_id").in(fkColumn, ids);
  return [...new Set((joins ?? []).map(r => r.card_id))];
}

function _intersect(existing, newSet) {
  if (existing === null) return newSet;
  const s = new Set(newSet);
  return existing.filter(id => s.has(id));
}

// ── Modulo principale ─────────────────────────────────────────

export const ChartsModule = {
  _chart: null,

  _VAR_OPTS: {
    bar:     [{v:"cost",l:"Cost"},{v:"color",l:"Color"},{v:"type",l:"Type"},{v:"atk",l:"ATK (Minion)"},{v:"def",l:"DEF (Minion)"}],
    pie:     [{v:"color",l:"Color"},{v:"type",l:"Type"},{v:"rarity",l:"Rarity"}],
    stacked: [{v:"cost_color",l:"Cost × Color"},{v:"cost_type",l:"Cost × Type"},{v:"type_color",l:"Type × Color"}],
    scatter: [{v:"cost_atk",l:"Cost × ATK (Minion)"},{v:"cost_def",l:"Cost × DEF (Minion)"},{v:"atk_def",l:"ATK × DEF (Minion)"}],
  },

  init() {
    const typeSel = document.getElementById("as-chart-type");
    const varSel  = document.getElementById("as-chart-var");
    if (!typeSel || !varSel) return;

    typeSel.onchange = () => {
      const opts = this._VAR_OPTS[typeSel.value] ?? [];
      varSel.innerHTML = `<option value="">— Variable —</option>` +
        opts.map(o => `<option value="${o.v}">${o.l}</option>`).join("");
      this._showPlaceholder(typeSel.value ? "Select a variable." : "Select a graph type to start analyzing.");
    };

    varSel.onchange = () => this._tryRender();
  },

  notifySearchComplete() {
    const type = document.getElementById("as-chart-type")?.value;
    if (!type) return;
    this._tryRender();
  },

  async _tryRender() {
    const type = document.getElementById("as-chart-type")?.value;
    const xVar = document.getElementById("as-chart-var")?.value;

    if (!type) { this._showPlaceholder("Select a graph type to start analyzing."); return; }
    if (!xVar) { this._showPlaceholder("Select a variable."); return; }

    this._showLoading();
    const cards = await this._fetchAllCards();

    if      (type === "bar")     this._renderBar(cards, xVar);
    else if (type === "pie")     this._renderPie(cards, xVar);
    else if (type === "stacked") this._renderStacked(cards, xVar);
    else if (type === "scatter") this._renderBubble(cards, xVar);
  },

  // ── Fetch ───────────────────────────────────────────────────

  async _fetchAllCards() {
    const s = FilterManager.state;

    return CardDatabase
      .filter(card => {
        if (s.name && !card.name.toLowerCase().includes(s.name.toLowerCase())) return false;
        if (s.text && !String(card.text ?? "").toLowerCase().includes(s.text.toLowerCase())) return false;
        if (s.types.length > 0 && !s.types.includes(card.type)) return false;
        if (s.rarities.length > 0 && !s.rarities.includes(card.rarity)) return false;
        if (s.colors.length > 0 && !s.colors.includes(card.color)) return false;
        if (s.costNeutralMin > 0 && (card.cost_neutral ?? 0) < s.costNeutralMin) return false;
        if (s.costNeutralMax < 20 && (card.cost_neutral ?? 0) > s.costNeutralMax) return false;
        if (s.costColorMin > 0 && (card.cost_color ?? 0) < s.costColorMin) return false;
        if (s.costColorMax < 20 && (card.cost_color ?? 0) > s.costColorMax) return false;
        if (s.atkMin !== "" && (card.atk ?? 0) < Number(s.atkMin)) return false;
        if (s.atkMax !== "" && (card.atk ?? 0) > Number(s.atkMax)) return false;
        if (s.defMin !== "" && (card.def ?? 0) < Number(s.defMin)) return false;
        if (s.defMax !== "" && (card.def ?? 0) > Number(s.defMax)) return false;
        if (s.subtypes.length > 0 && !s.subtypes.includes(card.subtype)) return false;
        if (s.keywords.length > 0) {
          const hasKeyword = s.keywords.some(keyword => (card.keywords ?? []).includes(keyword));
          if (!hasKeyword) return false;
        }
        if (s.setNum && String(card.setNum) !== String(s.setNum)) return false;
        return true;
      })
      .map(card => ({
        color:  card.color,
        type:   card.type,
        rarity: card.rarity,
        cost:   card.cost,
        atk:    card.atk ?? 0,
        def:    card.def ?? 0,
      }));
  },

  // ── Bar ─────────────────────────────────────────────────────

  _renderBar(cards, xVar) {
    const container = document.getElementById("chart-container");
    if (!container) return;

    const { labels, counts, bgColors, total } = this._aggregateBar(cards, xVar);
    const data = labels.map(l => counts[l] ?? 0);

    this._destroyChart();
    container.style.display = "block";
    container.style.padding = "16px 8px 8px";
    container.innerHTML = `<canvas id="as-chart-canvas"></canvas>`;
    const ctx = document.getElementById("as-chart-canvas").getContext("2d");

    this._chart = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: bgColors,
          borderRadius:    4,
          borderSkipped:   false,
        }],
      },
      options: {
        responsive: true,
        layout: { padding: { top: 24 } },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => {
                const val = ctx.parsed.y;
                const pct = total > 0 ? ((val / total) * 100).toFixed(1) : "0.0";
                return `${val} card${val !== 1 ? "s" : ""} (${pct}%)`;
              },
            },
          },
          datalabels: {
            anchor:    "end",
            align:     "top",
            color:     TEXT_DIM,
            font:      { size: 10, weight: "600" },
            formatter: (val) => {
              if (val === 0) return "";
              const pct = total > 0 ? ((val / total) * 100).toFixed(1) : "0.0";
              return `${pct}%`;
            },
          },
        },
        scales: {
          x: {
            grid:  { color: GRID_COLOR },
            ticks: { color: TEXT_DIM, font: { size: 11 } },
          },
          y: {
            grid:        { color: GRID_COLOR },
            ticks:       { color: TEXT_DIM, font: { size: 11 }, stepSize: 1 },
            beginAtZero: true,
          },
        },
      },
    });
  },

  _aggregateBar(cards, xVar) {
    const counts = {};
    let labels, bgColors, total;

    if (xVar === "cost") {
      total = cards.length;
      for (let i = 0; i <= 20; i++) counts[i] = 0;
      cards.forEach(c => { counts[c.cost] = (counts[c.cost] ?? 0) + 1; });
      let max = 20;
      while (max > 0 && !counts[max]) max--;
      labels   = Array.from({ length: max + 1 }, (_, i) => String(i));
      bgColors = labels.map(() => VIOLET);

    } else if (xVar === "color") {
      total = cards.length;
      const ORDER = ["blue", "green", "red", "black", "colorless"];
      ORDER.forEach(c => { counts[c] = 0; });
      cards.forEach(c => { counts[c.color] = (counts[c.color] ?? 0) + 1; });
      labels   = ORDER;
      bgColors = ORDER.map(c => COLOR_HEX[c]);

    } else if (xVar === "type") {
      total = cards.length;
      const ORDER = ["Minion", "Spell", "Quest", "Territory"];
      ORDER.forEach(t => { counts[t] = 0; });
      cards.forEach(c => { counts[c.type] = (counts[c.type] ?? 0) + 1; });
      labels   = ORDER;
      bgColors = ORDER.map(() => VIOLET);

    } else if (xVar === "atk" || xVar === "def") {
      const minions = cards.filter(c => c.type === "Minion");
      total = minions.length;
      const vals = minions.map(c => c[xVar]);
      const maxVal = vals.length ? Math.max(...vals) : 0;
      for (let i = 0; i <= maxVal; i++) counts[i] = 0;
      minions.forEach(c => { counts[c[xVar]] = (counts[c[xVar]] ?? 0) + 1; });
      let max = maxVal;
      while (max > 0 && !counts[max]) max--;
      labels   = Array.from({ length: max + 1 }, (_, i) => String(i));
      bgColors = labels.map(() => VIOLET);
    }

    return { labels, counts, bgColors, total };
  },

  // ── Pie ─────────────────────────────────────────────────────

  _renderPie(cards, xVar) {
    const container = document.getElementById("chart-container");
    if (!container) return;

    const { labels, counts, bgColors, total } = this._aggregatePie(cards, xVar);
    const data = labels.map(l => counts[l] ?? 0);

    this._destroyChart();
    container.style.display = "block";
    container.style.padding = "16px 8px 8px";
    container.innerHTML = `<canvas id="as-chart-canvas"></canvas>`;
    const ctx = document.getElementById("as-chart-canvas").getContext("2d");

    const isSmall = (val) => total > 0 && val / total < 0.05;

    this._chart = new Chart(ctx, {
      type: "pie",
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: bgColors,
          borderColor:     BG_MAIN,
          borderWidth:     2,
        }],
      },
      options: {
        responsive:  true,
        aspectRatio: 2,
        plugins: {
          legend: {
            display:  true,
            position: "right",
            labels: {
              color:    TEXT_DIM,
              font:     { size: 12 },
              padding:  16,
              boxWidth: 14,
              borderRadius: 3,
            },
          },
          tooltip: {
            callbacks: {
              label: ctx => {
                const val = ctx.parsed;
                const pct = total > 0 ? ((val / total) * 100).toFixed(1) : "0.0";
                return `${ctx.label}: ${val} card${val !== 1 ? "s" : ""} (${pct}%)`;
              },
            },
          },
          datalabels: {
            anchor:    ctx => isSmall(ctx.dataset.data[ctx.dataIndex]) ? "end"    : "center",
            align:     ctx => isSmall(ctx.dataset.data[ctx.dataIndex]) ? "end"    : "center",
            color:     ctx => isSmall(ctx.dataset.data[ctx.dataIndex]) ? TEXT_DIM : "#ffffff",
            offset:    ctx => isSmall(ctx.dataset.data[ctx.dataIndex]) ? 8        : 0,
            font:      { size: 11, weight: "600" },
            formatter: (val) => {
              if (val === 0) return null;
              const pct = total > 0 ? ((val / total) * 100).toFixed(1) : "0.0";
              return `${pct}%`;
            },
          },
        },
      },
    });
  },

  _aggregatePie(cards, xVar) {
    const counts = {};
    let labels, bgColors;
    const total = cards.length;

    if (xVar === "color") {
      const ORDER = ["blue", "green", "red", "black", "colorless"];
      ORDER.forEach(c => { counts[c] = 0; });
      cards.forEach(c => { counts[c.color] = (counts[c.color] ?? 0) + 1; });
      labels   = ORDER.filter(c => counts[c] > 0);
      bgColors = labels.map(c => COLOR_HEX[c]);

    } else if (xVar === "type") {
      const ORDER = ["Minion", "Spell", "Quest", "Territory"];
      ORDER.forEach(t => { counts[t] = 0; });
      cards.forEach(c => { counts[c.type] = (counts[c.type] ?? 0) + 1; });
      labels   = ORDER.filter(t => counts[t] > 0);
      bgColors = labels.map(t => TYPE_COLORS[t]);

    } else if (xVar === "rarity") {
      const ORDER = ["Legendary", "Normal"];
      ORDER.forEach(r => { counts[r] = 0; });
      cards.forEach(c => { counts[c.rarity] = (counts[c.rarity] ?? 0) + 1; });
      labels   = ORDER.filter(r => counts[r] > 0);
      bgColors = labels.map(r => RARITY_COLORS[r]);
    }

    return { labels, counts, bgColors, total };
  },

  // ── Scatter / Bubble ─────────────────────────────────────────

  _renderBubble(cards, pair) {
    const container = document.getElementById("chart-container");
    if (!container) return;

    const { data, xLabel, yLabel } = this._aggregateBubble(cards, pair);

    this._destroyChart();
    container.style.display = "block";
    container.style.padding = "16px 8px 8px";
    container.innerHTML = `<canvas id="as-chart-canvas"></canvas>`;
    const ctx = document.getElementById("as-chart-canvas").getContext("2d");

    this._chart = new Chart(ctx, {
      type: "bubble",
      data: {
        datasets: [{
          data,
          backgroundColor: "rgba(139, 92, 246, 0.50)",
          borderColor:     VIOLET,
          borderWidth:     1,
        }],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => `×${ctx.raw.count}`,
            },
          },
          datalabels: { display: false },
        },
        scales: {
          x: {
            title:       { display: true, text: xLabel, color: TEXT_DIM, font: { size: 11 } },
            grid:        { color: GRID_COLOR },
            ticks:       { color: TEXT_DIM, font: { size: 11 }, stepSize: 1 },
            beginAtZero: true,
          },
          y: {
            title:       { display: true, text: yLabel, color: TEXT_DIM, font: { size: 11 } },
            grid:        { color: GRID_COLOR },
            ticks:       { color: TEXT_DIM, font: { size: 11 }, stepSize: 1 },
            beginAtZero: true,
          },
        },
      },
    });
  },

  _aggregateBubble(cards, pair) {
    const minions = cards.filter(c => c.type === "Minion");
    let getX, getY, xLabel, yLabel;

    if (pair === "cost_atk") {
      getX = c => c.cost; getY = c => c.atk;
      xLabel = "Cost"; yLabel = "ATK";
    } else if (pair === "cost_def") {
      getX = c => c.cost; getY = c => c.def;
      xLabel = "Cost"; yLabel = "DEF";
    } else {
      getX = c => c.atk; getY = c => c.def;
      xLabel = "ATK"; yLabel = "DEF";
    }

    const countMap = {};
    minions.forEach(c => {
      const key = `${getX(c)},${getY(c)}`;
      countMap[key] = (countMap[key] ?? 0) + 1;
    });

    const data = Object.entries(countMap).map(([key, count]) => {
      const [x, y] = key.split(",").map(Number);
      return { x, y, r: 5 + count * 3, count };
    });

    return { data, xLabel, yLabel };
  },

  // ── Stacked ──────────────────────────────────────────────────

  _renderStacked(cards, pair) {
    const container = document.getElementById("chart-container");
    if (!container) return;

    const { xLabels, categoryLabels, rawCounts, bgColors } = this._aggregateStacked(cards, pair);

    const totals = xLabels.map((_, xi) =>
      categoryLabels.reduce((sum, _, ci) => sum + rawCounts[ci][xi], 0)
    );

    const datasets = categoryLabels.map((label, ci) => ({
      label,
      data: xLabels.map((_, xi) =>
        totals[xi] > 0 ? parseFloat((rawCounts[ci][xi] / totals[xi] * 100).toFixed(2)) : 0
      ),
      backgroundColor: bgColors[ci],
      borderColor:     BG_MAIN,
      borderWidth:     1,
    }));

    this._destroyChart();
    container.style.display = "block";
    container.style.padding = "16px 8px 8px";
    container.innerHTML = `<canvas id="as-chart-canvas"></canvas>`;
    const ctx = document.getElementById("as-chart-canvas").getContext("2d");

    this._chart = new Chart(ctx, {
      type: "bar",
      data: { labels: xLabels, datasets },
      options: {
        responsive: true,
        layout: { padding: { top: 8 } },
        plugins: {
          legend: {
            display:  true,
            position: "bottom",
            labels: {
              color:    TEXT_DIM,
              font:     { size: 12 },
              padding:  16,
              boxWidth: 14,
              borderRadius: 3,
            },
          },
          tooltip: {
            callbacks: {
              label: ctx => {
                const raw = rawCounts[ctx.datasetIndex][ctx.dataIndex];
                const pct = ctx.parsed.y.toFixed(1);
                return `${ctx.dataset.label}: ${raw} (${pct}%)`;
              },
            },
          },
          datalabels: {
            color:     "#fff",
            font:      { size: 10, weight: "600" },
            formatter: val => val >= 5 ? `${Math.round(val)}%` : null,
            display:   ctx => ctx.dataset.data[ctx.dataIndex] >= 5,
          },
        },
        scales: {
          x: {
            stacked: true,
            grid:    { color: GRID_COLOR },
            ticks:   { color: TEXT_DIM, font: { size: 11 } },
          },
          y: {
            stacked: true,
            min:     0,
            max:     100,
            grid:    { color: GRID_COLOR },
            ticks: {
              color:    TEXT_DIM,
              font:     { size: 11 },
              callback: val => `${val}%`,
            },
          },
        },
      },
    });
  },

  _aggregateStacked(cards, pair) {
    let xKeys, catKeys, getX, getCat, bgColors;

    if (pair === "cost_color") {
      const maxCost = cards.length ? Math.max(...cards.map(c => c.cost)) : 0;
      xKeys    = Array.from({ length: maxCost + 1 }, (_, i) => i);
      catKeys  = ["blue", "green", "red", "black", "colorless"];
      getX     = c => c.cost;
      getCat   = c => c.color;
      bgColors = catKeys.map(k => COLOR_HEX[k]);

    } else if (pair === "cost_type") {
      const maxCost = cards.length ? Math.max(...cards.map(c => c.cost)) : 0;
      xKeys    = Array.from({ length: maxCost + 1 }, (_, i) => i);
      catKeys  = ["Minion", "Spell", "Quest", "Territory"];
      getX     = c => c.cost;
      getCat   = c => c.type;
      bgColors = catKeys.map(k => TYPE_COLORS[k]);

    } else {
      xKeys    = ["Minion", "Spell", "Quest", "Territory"];
      catKeys  = ["blue", "green", "red", "black", "colorless"];
      getX     = c => c.type;
      getCat   = c => c.color;
      bgColors = catKeys.map(k => COLOR_HEX[k]);
    }

    const xIndex   = Object.fromEntries(xKeys.map((k, i) => [String(k), i]));
    const catIndex = Object.fromEntries(catKeys.map((k, i) => [k, i]));
    const rawCounts = catKeys.map(() => new Array(xKeys.length).fill(0));

    cards.forEach(c => {
      const xi = xIndex[String(getX(c))];
      const ci = catIndex[getCat(c)];
      if (xi !== undefined && ci !== undefined) rawCounts[ci][xi]++;
    });

    let xLabels = xKeys.map(String);
    if (pair === "cost_color" || pair === "cost_type") {
      let max = xLabels.length - 1;
      while (max > 0 && rawCounts.every(row => row[max] === 0)) max--;
      xLabels = xLabels.slice(0, max + 1);
      rawCounts.forEach((row, i) => { rawCounts[i] = row.slice(0, max + 1); });
    }

    return { xLabels, categoryLabels: catKeys, rawCounts, bgColors };
  },

  // ── Utilities ────────────────────────────────────────────────

  _showPlaceholder(msg) {
    this._destroyChart();
    const container = document.getElementById("chart-container");
    if (!container) return;
    container.style.display = "flex";
    container.style.padding = "32px";
    container.innerHTML = `<p class="muted" style="text-align:center;">${msg}</p>`;
  },

  _showLoading() {
    const container = document.getElementById("chart-container");
    if (!container) return;
    container.style.display = "flex";
    container.style.padding = "32px";
    container.innerHTML = `<p class="muted" style="text-align:center;">Loading chart…</p>`;
  },

  _destroyChart() {
    if (this._chart) { this._chart.destroy(); this._chart = null; }
  },
};
