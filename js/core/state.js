// ============================================================
// state.js — Stato globale dell'applicazione.
//
// AppState usa valori di default in memoria.
// I dati vengono caricati dal cloud dopo l'autenticazione:
//   - Mazzi: tabella "decks" su Supabase (data/decks.js)
//   - Impostazioni: user_metadata di Supabase Auth (auth/auth.js)
//
// localStorage non viene più usato per la persistenza principale.
// ============================================================

const AppState = {

  settings: {
    playerName:    "Duelist",
    musicVolume:   50,
    sfxVolume:     50,
    theme:         "dark",
    endTurnConfirm: true
  },

  // Starter deck inizializzato con id=1 per compatibilità con l'IIFE
  // in data/cards.js che cerca AppState.decks.find(d => d.id === 1).
  decks: [
    {
      id:            1,
      name:          "Starter Deck",
      commanderId:   null,
      cards:         [],
      territoryCards: []
    }
  ],

  currentDeckId: 1
};

// Persiste le impostazioni su Supabase user_metadata.
// saveSettingsToCloud è definita in auth/auth.js.
function saveSettings() {
  if (typeof saveSettingsToCloud === "function") {
    saveSettingsToCloud(AppState.settings).catch(() => {});
  }
}

// Persiste il mazzo corrente su Supabase.
// saveDeckToSupabase è definita in data/decks.js.
function saveDecks() {
  if (typeof saveDeckToSupabase === "function") {
    const deck = getCurrentDeck();
    if (deck) saveDeckToSupabase(deck).catch(() => {});
  }
}

function getCurrentDeck() {
  return AppState.decks.find(d => d.id === AppState.currentDeckId)
    || AppState.decks[0]
    || null;
}
