// ============================================================
// state.js — Stato globale dell'applicazione (solo dati).
//
// saveSettings e saveDecks sono stati spostati nei moduli che
// li gestiscono: auth.js e decks.js rispettivamente.
// ============================================================

export const AppState = {

  settings: {
    playerName:    "Duelist",
    musicVolume:   50,
    sfxVolume:     50,
    theme:         "dark",
    endTurnConfirm: true
  },

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

export function getCurrentDeck() {
  return AppState.decks.find(d => d.id === AppState.currentDeckId)
    || AppState.decks[0]
    || null;
}
