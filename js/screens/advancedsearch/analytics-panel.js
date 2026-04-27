// ============================================================
// advancedsearch/analytics-panel.js
//
// AnalyticsPanel — shell UI del pannello grafici.
// La logica Chart.js è in charts.js (ChartsModule).
// ============================================================

export const AnalyticsPanel = {
  render() {
    return `
      <div class="card-panel">
        <div class="row-spaced" style="margin-bottom: 16px;">
          <h3 style="margin:0; font-family:'Cinzel Decorative',serif; color:var(--gold);">Filtered pool analysis</h3>
          <div style="display:flex; gap:8px; align-items:center;">
            <select class="select" id="as-chart-type">
              <option value="">— Select graph —</option>
              <option value="bar">Bar</option>
              <option value="pie">Pie</option>
              <option value="stacked">Stacked</option>
              <option value="scatter">Scatter</option>
            </select>
            <select class="select" id="as-bar-x" style="display:none;">
              <option value="">— X axis —</option>
              <option value="cost">Cost</option>
              <option value="color">Color</option>
              <option value="type">Type</option>
              <option value="atk">ATK (Minion only)</option>
              <option value="def">DEF (Minion only)</option>
            </select>
            <select class="select" id="as-pie-var" style="display:none;">
              <option value="">— Variable —</option>
              <option value="color">Color</option>
              <option value="type">Type</option>
              <option value="rarity">Rarity</option>
            </select>
            <select class="select" id="as-stacked-pair" style="display:none;">
              <option value="">— Pair —</option>
              <option value="cost_color">Cost × Color</option>
              <option value="cost_type">Cost × Type</option>
              <option value="type_color">Type × Color</option>
            </select>
            <select class="select" id="as-scatter-pair" style="display:none;">
              <option value="">— Pair —</option>
              <option value="cost_atk">Cost × ATK (Minion only)</option>
              <option value="cost_def">Cost × DEF (Minion only)</option>
              <option value="atk_def">ATK × DEF (Minion only)</option>
            </select>
          </div>
        </div>
        <div id="chart-container" style="
          min-height: 200px;
          display: flex; align-items: center; justify-content: center;
          border: 1px dashed var(--border-gold);
          border-radius: 6px;
          padding: 32px;
        ">
          <p class="muted" style="text-align:center;">
            Select a type of graph to start analyzing...
          </p>
        </div>
      </div>
    `;
  },

  init() {
    // Delegato a ChartsModule.init() in index.js
  },
};
