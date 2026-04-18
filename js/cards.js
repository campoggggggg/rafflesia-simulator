// ============================================================
// cards.js — Database delle carte e inizializzazione del mazzo
//            di partenza (Starter Deck).
//
// Struttura del file:
//  1. rawData       → dizionario grezzo con i dati di ogni carta
//  2. Getter        → funzioni per leggere le proprietà di una carta
//  3. makeTerritorySvg → genera un'immagine SVG per i territori
//  4. CardDatabase  → array elaborato, pronto all'uso nel gioco
//  5. IIFE          → popola lo Starter Deck al primo avvio
// ============================================================

// rawData è un oggetto JS usato come dizionario (mappa chiave→valore).
// Ogni chiave è l'ID della carta (es. "000", "T02") e il valore è
// un oggetto con le sue proprietà.
// Tipi possibili: "Minion", "Sudden Spell", "Conjured Spell", "Territory"
// Rarità: "Legendary" (max 1 copia), "Normal" (max 2), "Basic" (illimitata)
const rawData = {
  "000": { nome: "Edwin, Legendary Thief", colore: "Blu", tipo: "Minion", icona: "Legendary", costo: 4 },
  "001": { nome: "Faust, Crazed Creator", colore: "Blu", tipo: "Minion", icona: "Legendary", costo: 6 },
  "002": { nome: "Maelis, Plague Doctor", colore: "Blu", tipo: "Minion", icona: "Legendary", costo: 4 },
  "003": { nome: "The Debt Collector", colore: "Blu", tipo: "Minion", icona: "Legendary", costo: 7 },
  "004": { nome: "Nikola, Disgraced Genius", colore: "Blu", tipo: "Minion", icona: "Legendary", costo: 5 },
  "005": { nome: "Arya, Decaying Muse", colore: "Blu", tipo: "Minion", icona: "Legendary", costo: 5 },
  "006": { nome: "Sadu, False Prophet", colore: "Blu", tipo: "Minion", icona: "Legendary", costo: 3 },
  "007": { nome: "Francus, Pope of Demise", colore: "Blu", tipo: "Minion", icona: "Legendary", costo: 2 },
  "008": { nome: "Fried, Lightning Blade", colore: "Blu", tipo: "Minion", icona: "Legendary", costo: 6 },
  "009": { nome: "Submit to Will", colore: "Blu", tipo: "Sudden Spell", icona: "Legendary", costo: 5 },
  "010": { nome: "Lightning Bolt in a Bottle", colore: "Blu", tipo: "Sudden Spell", icona: "Legendary", costo: 1 },
  "011": { nome: "Unnatural Disaster", colore: "Blu", tipo: "Sudden Spell", icona: "Legendary", costo: 1 },
  "012": { nome: "Disgraced Disciple", colore: "Blu", tipo: "Minion", icona: "Normal", costo: 1 },
  "013": { nome: "Pray For Demise", colore: "Blu", tipo: "Sudden Spell", icona: "Normal", costo: 3 },
  "014": { nome: "Abominable Barrier", colore: "Blu", tipo: "Sudden Spell", icona: "Normal", costo: 1 },
  "015": { nome: "Highwayman", colore: "Blu", tipo: "Minion", icona: "Normal", costo: 3 },
  "016": { nome: "Cruel Ritual", colore: "Blu", tipo: "Sudden Spell", icona: "Normal", costo: 4 },
  "017": { nome: "Forced Conversion", colore: "Blu", tipo: "Conjured Spell", icona: "Normal", costo: 4 },
  "018": { nome: "Burn the Heretics", colore: "Blu", tipo: "Conjured Spell", icona: "Normal", costo: 4 },
  "019": { nome: "Request Tribute", colore: "Blu", tipo: "Sudden Spell", icona: "Normal", costo: 3 },
  "020": { nome: "Forsaken Mind", colore: "Blu", tipo: "Minion", icona: "Normal", costo: 1 },
  "021": { nome: "Burning Knowledge", colore: "Blu", tipo: "Conjured Spell", icona: "Normal", costo: 4 },
  "022": { nome: "Ancient Cloud", colore: "Blu", tipo: "Sudden Spell", icona: "Normal", costo: 2 },
  "023": { nome: "Disgraceful Spark", colore: "Blu", tipo: "Sudden Spell", icona: "Normal", costo: 1 },
  "024": { nome: "Faithless Saint", colore: "Blu", tipo: "Minion", icona: "Normal", costo: 4 },
  "025": { nome: "Over Passionate Scholar", colore: "Blu", tipo: "Minion", icona: "Normal", costo: 2 },
  "026": { nome: "Experiment #1", colore: "Blu", tipo: "Minion", icona: "Normal", costo: 1 },
  "027": { nome: "Experiment #2", colore: "Blu", tipo: "Minion", icona: "Normal", costo: 2 },
  "028": { nome: "Experiment #3", colore: "Blu", tipo: "Minion", icona: "Normal", costo: 3 },
  "029": { nome: "Experiment #4", colore: "Blu", tipo: "Minion", icona: "Normal", costo: 4 },
  "030": { nome: "Back Alley Assassin", colore: "Blu", tipo: "Minion", icona: "Normal", costo: 2 },
  "031": { nome: "Renowed Undertaker", colore: "Blu", tipo: "Minion", icona: "Normal", costo: 3 },
  "032": { nome: "Grinning Merchant", colore: "Blu", tipo: "Minion", icona: "Normal", costo: 1 },
  "033": { nome: "Stormcaller Mage", colore: "Blu", tipo: "Minion", icona: "Normal", costo: 2 },
  "034": { nome: "Troublesome Companion", colore: "Blu", tipo: "Minion", icona: "Normal", costo: 2 },
  "035": { nome: "Endless Research", colore: "Blu", tipo: "Sudden Spell", icona: "Normal", costo: 1 },

  "036": { nome: "Braum,The Defiant", colore: "Verde", tipo: "Minion", icona: "Legendary", costo: 4 },
  "037": { nome: "Krokus, Curator of The Wilds", colore: "Verde", tipo: "Minion", icona: "Legendary", costo: 4 },
  "038": { nome: "Birke, Protector of Life", colore: "Verde", tipo: "Minion", icona: "Legendary", costo: 4 },
  "039": { nome: "Disflora, Apex Hunter", colore: "Verde", tipo: "Minion", icona: "Legendary", costo: 6 },
  "040": { nome: "Taxus, The Rotten", colore: "Verde", tipo: "Minion", icona: "Legendary", costo: 3 },
  "041": { nome: "Vanessa, Beloved Creation", colore: "Verde", tipo: "Minion", icona: "Legendary", costo: 8 },
  "042": { nome: "Rapid Decay", colore: "Verde", tipo: "Sudden Spell", icona: "Legendary", costo: 2 },
  "043": { nome: "Rag, Forsaken King", colore: "Verde", tipo: "Minion", icona: "Legendary", costo: 8 },
  "044": { nome: "Birthed From Soil", colore: "Verde", tipo: "Conjured Spell", icona: "Legendary", costo: 6 },
  "045": { nome: "Awaken The Elders", colore: "Verde", tipo: "Sudden Spell", icona: "Legendary", costo: 1 },
  "046": { nome: "Migration Of The Forsaken", colore: "Verde", tipo: "Sudden Spell", icona: "Normal", costo: 1 },
  "047": { nome: "Forced Metamorphosis", colore: "Verde", tipo: "Sudden Spell", icona: "Normal", costo: 1 },
  "048": { nome: "Benevolent Oak", colore: "Verde", tipo: "Minion", icona: "Normal", costo: 3 },
  "049": { nome: "Keeper Of The Grove", colore: "Verde", tipo: "Minion", icona: "Normal", costo: 4 },
  "050": { nome: "Cycle Of Life", colore: "Verde", tipo: "Conjured Spell", icona: "Normal", costo: 3 },
  "051": { nome: "Wild Scavenger", colore: "Verde", tipo: "Minion", icona: "Normal", costo: 2 },
  "052": { nome: "Overgrown Croaker", colore: "Verde", tipo: "Minion", icona: "Normal", costo: 1 },
  "053": { nome: "Commune With The Wilds", colore: "Verde", tipo: "Conjured Spell", icona: "Normal", costo: 3 },
  "054": { nome: "Ravager", colore: "Verde", tipo: "Minion", icona: "Normal", costo: 2 },
  "055": { nome: "Seek Asylum", colore: "Verde", tipo: "Conjured Spell", icona: "Normal", costo: 2 },
  "056": { nome: "Haunting Woods", colore: "Verde", tipo: "Minion", icona: "Normal", costo: 1 },
  "057": { nome: "Cruel Salvation", colore: "Verde", tipo: "Sudden Spell", icona: "Normal", costo: 1 },
  "058": { nome: "Aimless One", colore: "Verde", tipo: "Minion", icona: "Normal", costo: 1 },
  "059": { nome: "Venomenous Critter", colore: "Verde", tipo: "Minion", icona: "Normal", costo: 2 },
  "060": { nome: "Ancient Guardian", colore: "Verde", tipo: "Minion", icona: "Normal", costo: 2 },
  "061": { nome: "Winged Horror", colore: "Verde", tipo: "Minion", icona: "Normal", costo: 3 },
  "062": { nome: "Pray To The Elders", colore: "Verde", tipo: "Sudden Spell", icona: "Normal", costo: 1 },
  "063": { nome: "Reborn Wanderer", colore: "Verde", tipo: "Minion", icona: "Normal", costo: 3 },
  "064": { nome: "Painful Choice", colore: "Verde", tipo: "Conjured Spell", icona: "Normal", costo: 4 },
  "065": { nome: "Roaming Vendigo", colore: "Verde", tipo: "Minion", icona: "Normal", costo: 5 },
  "066": { nome: "Dryad Of The Grove", colore: "Verde", tipo: "Minion", icona: "Normal", costo: 1 },
  "067": { nome: "Territorial Bjorn", colore: "Verde", tipo: "Minion", icona: "Normal", costo: 4 },
  "068": { nome: "Feral Shaman", colore: "Verde", tipo: "Minion", icona: "Normal", costo: 2 },
  "069": { nome: "Giant Cocoon", colore: "Verde", tipo: "Sudden Spell", icona: "Normal", costo: 2 },
  "070": { nome: "Outrage", colore: "Verde", tipo: "Conjured Spell", icona: "Legendary", costo: 4 },
  "071": { nome: "Mahogan, Wooden Giant", colore: "Verde", tipo: "Minion", icona: "Legendary", costo: 10 },

  // Le carte Territorio non appartengono a nessun colore e hanno
  // costo 0: entrano in gioco attraverso il territorio deck separato.
  "T00": { nome: "Basic Territory", colore: "None", tipo: "Territory", icona: "Basic", costo: 0 },
  "T01": { nome: "Forgotten Crossroad", colore: "None", tipo: "Territory", icona: "Basic", costo: 0 },
  "T02": { nome: "Ancient Sanctuary", colore: "None", tipo: "Territory", icona: "Basic", costo: 0 },
  "T03": { nome: "Wild Frontier", colore: "None", tipo: "Territory", icona: "Basic", costo: 0 },
  "T04": { nome: "Ruined Bastion", colore: "None", tipo: "Territory", icona: "Basic", costo: 0 }
};

// ── Getter ────────────────────────────────────────────────────
// Queste funzioni usano l'optional chaining (?.) per accedere
// alle proprietà in modo sicuro: se rawData[id] non esiste,
// invece di lanciare un errore restituisce undefined, e il || fornisce
// un valore di default.
function getCardName(id)   { return rawData[id]?.nome   || "Unknown"; }
function getCardColor(id)  { return rawData[id]?.colore || "None"; }
function getCardType(id)   { return rawData[id]?.tipo   || "Unknown"; }
function getCardRarity(id) { return rawData[id]?.icona  || "Normal"; }
function getCardCost(id)   { return rawData[id]?.costo  || 0; }

// ── SVG per i Territori ──────────────────────────────────────
// I territori non hanno immagini PNG, quindi ne generiamo una al
// volo in SVG (formato vettoriale, disegnato con codice XML).
// Il risultato è una Data URL: un'immagine inline codificata come
// stringa di testo — nessun file da scaricare.
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
  // encodeURIComponent converte caratteri speciali (spazi, virgolette...)
  // in sequenze sicure per usare la stringa come URL.
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// ── CardDatabase ──────────────────────────────────────────────
// Trasformiamo il dizionario rawData in un array di oggetti uniformi,
// più comodi da filtrare e usare nel resto dell'app.
//
// Object.keys(rawData) → ["000", "001", ..., "T04"]   (array di ID)
// .map(id => {...})    → per ogni ID crea un oggetto arricchito
const CardDatabase = Object.keys(rawData).map(id => {
  const type = getCardType(id);

  // Per default l'immagine è un file PNG in assets/cards/.
  // I Territori non hanno PNG, quindi usiamo l'SVG generato sopra.
  let image = `assets/cards/${id}.png`;
  if (type === "Territory") {
    image = makeTerritorySvg(getCardName(id), getCardRarity(id));
  }

  return {
    id,
    name:   getCardName(id),
    color:  getCardColor(id),
    type,
    rarity: getCardRarity(id),
    cost:   getCardCost(id),
    text:   "",   // testo effetto: da riempire in futuro
    image
  };
});

// ── IIFE: Inizializzazione Starter Deck ───────────────────────
// IIFE = Immediately Invoked Function Expression: una funzione
// definita e chiamata subito, usata per isolare il codice di
// setup in un proprio scope senza inquinare lo scope globale.
// Sintassi: (function nomeFunzione() { ... })()
//
// Viene eseguita UNA SOLA VOLTA al caricamento della pagina.
// Serve a garantire che il Starter Deck (id=1) sia sempre valido,
// anche se l'utente lo ha lasciato incompleto in sessioni precedenti.
(function initializeStarterDeck() {
  const starter = AppState.decks.find(d => d.id === 1);
  if (!starter) return;

  // Aggiunge le proprietà mancanti se il deck è stato salvato con
  // una versione precedente del codice che non le aveva ancora.
  if (!("commanderId"    in starter)) starter.commanderId    = null;
  if (!("cards"          in starter)) starter.cards          = [];
  if (!("territoryCards" in starter)) starter.territoryCards = [];

  // Imposta Edwin come comandante di default
  if (!starter.commanderId) {
    starter.commanderId = "000";
  }

  // Popola il main deck solo se è completamente vuoto
  if (starter.cards.length === 0) {
    // .slice(0, 29) assicura di non superare il limite anche se
    // l'array qui sotto venisse accidentalmente allungato.
    starter.cards = [
      "012", "015", "020", "023", "025", "030", "033",
      "013", "014", "016", "017", "018",
      "021", "022", "024", "026", "027", "028",
      "029", "031", "032", "034", "035",
      "009", "010", "011", "019", "004", "006"
    ].slice(0, 29);
  }

  // 12 copie di Basic Territory come territorio di default
  if (starter.territoryCards.length === 0) {
    starter.territoryCards = [
      "T00", "T00", "T00", "T00", "T00", "T00",
      "T00", "T00", "T00", "T00", "T00", "T00"
    ];
  }

  saveDecks();
})();
