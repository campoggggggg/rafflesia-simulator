// ============================================================
// data/cards.js — Carte caricate da Supabase.
//
// CardDatabase è un live binding: tutti i moduli che lo
// importano vedono automaticamente il valore aggiornato
// dopo syncCardsFromSupabase().
// ============================================================

import { db } from '../core/supabase-client.js';

export let CardDatabase = [];

export function buildCardObject(row) {
  const colors = (row.card_to_colors ?? []).map(r => r.colors?.name).filter(Boolean);
  const color  = colors[0] ?? "colorless";
  const cost   = (row.cost_neutral ?? 0) + (row.cost_color ?? 0);

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
    atk:          row.atk  ?? 0,
    def:          row.def  ?? 0,
    text:         row.card_text ?? "",
    image:        `assets/cards/${row.id}.png`
  };
}

export async function syncCardsFromSupabase() {
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
