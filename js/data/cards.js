// ============================================================
// cards.js — Carte caricate da Supabase.
//
// CardDatabase viene popolato da syncCardsFromSupabase() all'avvio.
// Struttura tabella "cards" su Supabase:
//   id, name, type_line, rarity, cost_neutral, cost_color,
//   atk, def, set_num, card_text, generates_card_id
// Join:
//   card_to_colors(colors(name))  → colori della carta
// ============================================================

let CardDatabase = [];

// Genera un'immagine SVG inline per le carte Territorio
// (non hanno un PNG associato).
function makeTerritorySvg(title, subtitle) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="240" height="336" viewBox="0 0 240 336">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#2f4f4f"/>
          <stop offset="100%" stop-color="#11161f"/>
        </linearGradient>
      </defs>
      <rect width="240" height="336" rx="18" fill="url(#bg)"/>
      <rect x="12" y="12" width="216" height="312" rx="14" fill="none" stroke="#9fb3c8" stroke-width="2"/>
      <text x="120" y="70" text-anchor="middle" font-family="Arial" font-size="22" fill="#f2f4f8">Territory</text>
      <text x="120" y="160" text-anchor="middle" font-family="Arial" font-size="20" fill="#d7deea">${title}</text>
      <text x="120" y="200" text-anchor="middle" font-family="Arial" font-size="14" fill="#9aa4b2">${subtitle}</text>
    </svg>
  `;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// Costruisce un oggetto carta normalizzato da una riga Supabase.
// L'id viene convertito a stringa per compatibilità con i data-attribute
// HTML e con gli array deck.cards (che contengono stringhe).
function buildCardObject(row) {
  const colors = (row.card_to_colors ?? []).map(r => r.colors?.name).filter(Boolean);
  const color  = colors[0] ?? "colorless";
  const cost   = (row.cost_neutral ?? 0) + (row.cost_color ?? 0);

  let image = `assets/cards/${row.id}.png`;
  if (row.type_line === "Territory") image = makeTerritorySvg(row.name, row.rarity);

  return {
    id:           String(row.id),
    name:         row.name,
    color,
    colors,
    type:         row.type_line,
    rarity:       row.rarity,
    cost,
    cost_neutral: row.cost_neutral ?? 0,
    cost_color:   row.cost_color   ?? 0,
    atk:          row.atk  ?? null,
    def:          row.def  ?? null,
    text:         row.card_text ?? "",
    image
  };
}

// Carica le carte da Supabase e popola CardDatabase.
// Se fallisce (RLS, offline, errore) CardDatabase rimane vuoto
// e le schermate mostreranno "collezione vuota".
async function syncCardsFromSupabase() {
  try {
    const { data, error } = await db
      .from("cards")
      .select("*, card_to_colors(colors(name))")
      .order("id");

    if (error) throw error;
    CardDatabase = data.map(buildCardObject);
  } catch (err) {
    console.warn("Impossibile caricare le carte da Supabase:", err.message);
  }
}
