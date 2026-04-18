// ============================================================
// state.js — Stato globale dell'applicazione.
//
// AppState è l'unico posto dove risiedono le impostazioni e i
// mazzi durante l'esecuzione. Viene inizializzato leggendo dal
// localStorage tramite Storage.load (definito in storage.js, che
// il browser ha già caricato prima di questo file).
//
// Pattern: "unica fonte di verità" — tutti gli altri moduli
// leggono e scrivono su AppState invece di avere ognuno il
// proprio stato, così i dati rimangono sempre sincronizzati.
// ============================================================

// Storage.load(chiave, default) → se trova dati salvati li usa,
// altrimenti usa l'oggetto che passiamo come secondo argomento.
const AppState = {

  // Impostazioni del giocatore. Ogni proprietà ha un valore di
  // default usato solo al primo avvio (quando localStorage è vuoto).
  settings: Storage.load("rafflesia_settings", {
    playerName: "Duelist",
    musicVolume: 50,
    sfxVolume: 50,
    theme: "dark",
    endTurnConfirm: true
  }),

  // Array di mazzi. Ogni mazzo è un oggetto con:
  //   id            → numero univoco (usato per trovarlo velocemente)
  //   name          → nome leggibile dall'utente
  //   commanderId   → ID della carta comandante (null se non scelto)
  //   cards         → array di ID carte (main deck, max 29)
  //   territoryCards → array di ID carte territorio (max 12)
  decks: Storage.load("rafflesia_decks", [
    {
      id: 1,
      name: "Starter Deck",
      commanderId: null,
      cards: [],
      territoryCards: []
    }
  ]),

  // Tiene traccia di quale mazzo è selezionato nel Deck Builder e
  // nel menù Play. È un numero (l'id del mazzo).
  currentDeckId: Storage.load("rafflesia_currentDeckId", 1)
};

// Persiste solo le impostazioni. Chiamata dopo ogni modifica
// in settings.js per non perdere i dati al refresh.
function saveSettings() {
  Storage.save("rafflesia_settings", AppState.settings);
}

// Persiste l'array dei mazzi e l'ID del mazzo corrente insieme,
// così al prossimo caricamento entrambi tornano sincronizzati.
function saveDecks() {
  Storage.save("rafflesia_decks", AppState.decks);
  Storage.save("rafflesia_currentDeckId", AppState.currentDeckId);
}

// Cerca nell'array il mazzo con l'ID corrente e lo restituisce.
// .find() scorre l'array e restituisce il primo elemento per cui
// la funzione freccia (d => ...) ritorna true.
// Se non lo trova (ID non valido), cade sul fallback: il primo mazzo.
function getCurrentDeck() {
  return AppState.decks.find(d => d.id === AppState.currentDeckId) || AppState.decks[0];
}
