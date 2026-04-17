const AppState = {
  settings: Storage.load("rafflesia_settings", {
    playerName: "Duelist",
    musicVolume: 50,
    sfxVolume: 50,
    theme: "dark",
    endTurnConfirm: true
  }),

  decks: Storage.load("rafflesia_decks", [
    {
      id: 1,
      name: "Starter Deck",
      commanderId: null,
      cards: [],
      territoryCards: []
    }
  ]),

  currentDeckId: Storage.load("rafflesia_currentDeckId", 1)
};

function saveSettings() {
  Storage.save("rafflesia_settings", AppState.settings);
}

function saveDecks() {
  Storage.save("rafflesia_decks", AppState.decks);
  Storage.save("rafflesia_currentDeckId", AppState.currentDeckId);
}

function getCurrentDeck() {
  return AppState.decks.find(d => d.id === AppState.currentDeckId) || AppState.decks[0];
}