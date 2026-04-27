// ============================================================
// data/decks.js — Sincronizzazione mazzi con Supabase.
// ============================================================

import { db }                      from '../core/supabase-client.js';
import { getUser, loadSettingsFromCloud } from '../auth/auth.js';
import { AppState, getCurrentDeck }       from '../core/state.js';

export async function loadDecksFromSupabase() {
  const user = await getUser();
  if (!user) return null;

  const { data, error } = await db
    .from("decks")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at");

  if (error) { console.warn("Errore caricamento mazzi:", error.message); return null; }

  return data.map(row => ({
    id:             row.id,
    supabase_id:    row.id,
    name:           row.name,
    commanderId:    row.commander_id,
    cards:          row.cards           || [],
    territoryCards: row.territory_cards || []
  }));
}

export async function saveDeckToSupabase(deck) {
  const user = await getUser();
  if (!user) return;

  const payload = {
    user_id:         user.id,
    name:            deck.name,
    commander_id:    deck.commanderId   || null,
    cards:           deck.cards         || [],
    territory_cards: deck.territoryCards || [],
    updated_at:      new Date().toISOString()
  };

  if (deck.supabase_id) {
    const { error } = await db
      .from("decks")
      .update(payload)
      .eq("id",      deck.supabase_id)
      .eq("user_id", user.id);

    if (error) console.warn("Errore aggiornamento mazzo:", error.message);
  } else {
    const { data, error } = await db
      .from("decks")
      .insert(payload)
      .select()
      .single();

    if (error) { console.warn("Errore inserimento mazzo:", error.message); return; }

    deck.supabase_id = data.id;
    deck.id          = data.id;
  }
}

export async function deleteDeckFromSupabase(deck) {
  if (!deck.supabase_id) return;
  const user = await getUser();
  if (!user) return;

  const { error } = await db
    .from("decks")
    .delete()
    .eq("id",      deck.supabase_id)
    .eq("user_id", user.id);

  if (error) console.warn("Errore eliminazione mazzo:", error.message);
}

export async function onLoginLoadDecks() {
  const remote = await loadDecksFromSupabase();

  if (remote && remote.length > 0) {
    AppState.decks         = remote;
    AppState.currentDeckId = remote[0].id;
  } else {
    for (const deck of AppState.decks) {
      await saveDeckToSupabase(deck);
    }
    const uploaded = await loadDecksFromSupabase();
    if (uploaded && uploaded.length > 0) {
      AppState.decks         = uploaded;
      AppState.currentDeckId = uploaded[0].id;
    }
  }

  const cloudSettings = await loadSettingsFromCloud();
  if (cloudSettings) {
    AppState.settings = { ...AppState.settings, ...cloudSettings };
  }
}

// Convenienza: persiste il mazzo corrente su Supabase.
export function saveDecks() {
  const deck = getCurrentDeck();
  if (deck) saveDeckToSupabase(deck).catch(() => {});
}
