// ============================================================
// data/decks.js — Sincronizzazione mazzi con Supabase.
//
// Supabase è la fonte di verità per gli utenti autenticati.
// localStorage non viene più usato.
//
// Struttura tabella "decks" su Supabase:
//   id               SERIAL PRIMARY KEY
//   user_id          UUID  → riferimento a auth.users
//   name             TEXT
//   commander_id     TEXT
//   cards            TEXT[]
//   territory_cards  TEXT[]
//   updated_at       TIMESTAMPTZ
// ============================================================

async function loadDecksFromSupabase() {
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

async function saveDeckToSupabase(deck) {
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

    // Aggiorna l'ID in memoria (non più su localStorage).
    deck.supabase_id = data.id;
    deck.id          = data.id;
  }
}

async function deleteDeckFromSupabase(deck) {
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

// Chiamata dopo il login: carica mazzi e impostazioni dal cloud.
// Se il cloud è vuoto (primo accesso), carica lo starter deck locale.
async function onLoginLoadDecks() {
  const remote = await loadDecksFromSupabase();

  if (remote && remote.length > 0) {
    // Il cloud è fonte di verità.
    AppState.decks         = remote;
    AppState.currentDeckId = remote[0].id;
  } else {
    // Primo accesso: sincronizza lo starter deck locale su Supabase.
    for (const deck of AppState.decks) {
      await saveDeckToSupabase(deck);
    }
    const uploaded = await loadDecksFromSupabase();
    if (uploaded && uploaded.length > 0) {
      AppState.decks         = uploaded;
      AppState.currentDeckId = uploaded[0].id;
    }
  }

  // Carica le impostazioni salvate nel profilo cloud.
  if (typeof loadSettingsFromCloud === "function") {
    const cloudSettings = await loadSettingsFromCloud();
    if (cloudSettings) {
      AppState.settings = { ...AppState.settings, ...cloudSettings };
    }
  }
}
