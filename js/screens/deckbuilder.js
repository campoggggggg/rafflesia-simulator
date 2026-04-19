// ============================================================
// deckbuilder.js — Schermata di costruzione mazzi.
//
// È il modulo più complesso: gestisce la collezione di carte,
// il preview, la lista del mazzo corrente, e la validazione.
//
// Flusso principale:
//   renderDeckBuilderScreen()
//     ├─ populateDeckSelect()       popola il dropdown mazzi
//     ├─ renderFilteredCollection() mostra le carte filtrate
//     ├─ renderCardPreview()        mostra i dettagli della carta selezionata
//     ├─ renderDeckList()           mostra le carte nel mazzo
//     └─ renderDeckValidation()     mostra errori/ok sul mazzo
// ============================================================

// selectedCardId tiene traccia di quale carta è selezionata
// nella griglia collezione. È una variabile di modulo (non globale
// in senso stretto, ma accessibile a tutte le funzioni qui sotto).
// `let` = variabile riassegnabile (a differenza di `const`).
let selectedCardId = null;

// Restituisce quante copie di una carta sono ammesse nel mazzo.
// Infinity è il valore "infinito" di JS: usato per le Basic che
// non hanno limite. Il confronto qty > Infinity è sempre false.
function getMaxCopies(card) {
  if (card.rarity === "Basic")     return Infinity;
  if (card.rarity === "Legendary") return 1;
  return 2;
}

// ── Render principale ─────────────────────────────────────────
function renderDeckBuilderScreen() {
  const screen      = document.getElementById("screen-deckbuilder");
  const currentDeck = getCurrentDeck();

  // Compatibilità: aggiunge proprietà mancanti se il mazzo è stato
  // creato da una versione precedente del codice.
  if (!("commanderId"    in currentDeck)) currentDeck.commanderId    = null;
  if (!("territoryCards" in currentDeck)) currentDeck.territoryCards = [];

  // Seleziona la prima carta come default se niente è ancora selezionato
  if (!selectedCardId && CardDatabase.length > 0) {
    selectedCardId = CardDatabase[0].id;
  }

  // Costruisce tutto l'HTML della schermata con un unico template literal.
  // I sottocomponenti (commander box, contatori, ecc.) vengono iniettati
  // con ${...} inline.
  screen.innerHTML = `
    <div class="row" style="margin-bottom: 16px;">
      <button class="secondary-btn back-btn">← Indietro</button>
      <button class="secondary-btn home-btn">Home</button>
    </div>

    <h2 class="page-title">Deck Builder</h2>
    <p class="page-subtitle">Costruisci il tuo mazzo secondo le regole di Rafflesia.</p>

    <div class="deckbuilder-layout">
      <div class="card-panel collection-panel">
        <div class="collection-toolbar">
          <div class="row-spaced">
            <h3>Collezione</h3>
            <input id="cardSearchInput" class="input" type="text" placeholder="Cerca carta..." />
          </div>

          <div class="row" style="margin-top: 12px;">
            <select id="colorFilter" class="select">
              <option value="all">Tutti i colori</option>
              <option value="Blu">Blu</option>
              <option value="Verde">Verde</option>
              <option value="Black">Black</option>
              <option value="Red">Red</option>
              <option value="Colorless">Colorless</option>
            </select>

            <select id="typeFilter" class="select">
              <option value="all">Tutti i tipi</option>
              <option value="Minion">Minion</option>
              <option value="Sudden Spell">Sudden Spell</option>
              <option value="Conjured Spell">Conjured Spell</option>
              <option value="Territory">Territory</option>
            </select>

            <select id="rarityFilter" class="select">
              <option value="all">Tutte le rarità</option>
              <option value="Legendary">Legendary</option>
              <option value="Normal">Normal</option>
              <option value="Basic">Basic</option>
            </select>
          </div>

          <p class="card-hint">Click: seleziona. Doppio click: aggiungi subito al deck.</p>
        </div>

        <div class="collection-scroll">
          <div id="collectionGrid" class="collection-grid"></div>
        </div>
      </div>

      <div id="cardPreviewBox" class="card-preview-box"></div>

      <div class="card-panel">
        <div class="row-spaced">
          <div>
            <h3>Mazzo corrente</h3>
            <p class="muted" id="currentDeckLabel">${currentDeck.name}</p>
          </div>

          <div class="row">
            <select id="deckSelect" class="select"></select>
            <button id="newDeckBtn" class="secondary-btn">Nuovo mazzo</button>
            <button id="deleteDeckBtn" class="danger-btn">Elimina</button>
          </div>
        </div>

        <div class="row" style="margin: 12px 0 16px;">
          <input id="deckNameInput" class="input" type="text" value="${currentDeck.name}" />
          <button id="renameDeckBtn" class="primary-btn">Rinomina</button>
        </div>

        <div class="card-panel" style="padding: 14px; margin-bottom: 14px;">
          <h4>Comandante</h4>
          <div id="commanderBox">${renderCommanderBox(currentDeck)}</div>
        </div>

        <p><strong>Main Deck:</strong> <span id="deckCount">${currentDeck.cards.length}</span> / 29</p>
        <p><strong>Territory Deck:</strong> <span id="territoryCount">${currentDeck.territoryCards.length}</span> / 12</p>

        <div id="deckValidationBox" class="status-box" style="margin-bottom: 14px;"></div>

        <div id="deckList" class="deck-list"></div>
      </div>
    </div>
  `;

  // Dopo aver scritto l'HTML, colleghiamo i listener ai nuovi elementi.
  // Attenzione: ogni volta che si chiama renderDeckBuilderScreen() l'HTML
  // viene riscritto da zero, quindi i listener devono essere ri-attaccati.
  populateDeckSelect();
  renderFilteredCollection();
  renderCardPreview();
  renderDeckList();
  renderDeckValidation();

  // "input" si attiva a ogni carattere digitato (più reattivo di "change")
  document.getElementById("cardSearchInput").addEventListener("input",  renderFilteredCollection);
  document.getElementById("colorFilter").addEventListener("change",     renderFilteredCollection);
  document.getElementById("typeFilter").addEventListener("change",      renderFilteredCollection);
  document.getElementById("rarityFilter").addEventListener("change",    renderFilteredCollection);

  // Cambio mazzo dal dropdown: aggiorna l'ID corrente e ri-renderizza
  document.getElementById("deckSelect").onchange = (e) => {
    // e.target è l'elemento che ha scatenato l'evento (il <select>).
    // Number() converte il value (stringa) nell'ID numerico del mazzo.
    AppState.currentDeckId = Number(e.target.value);
    saveDecks();
    renderDeckBuilderScreen();
  };

  document.getElementById("newDeckBtn").onclick = () => {
    // Date.now() restituisce i millisecondi dall'epoca Unix (1/1/1970).
    // È usato come ID univoco: due mazzi creati in momenti diversi
    // avranno sempre ID diversi.
    const newDeck = {
      id: Date.now(),
      name: `Nuovo Mazzo ${AppState.decks.length + 1}`,
      commanderId: null,
      cards: [],
      territoryCards: []
    };

    AppState.decks.push(newDeck);       // push aggiunge in fondo all'array
    AppState.currentDeckId = newDeck.id;
    saveDecks();
    renderDeckBuilderScreen();
  };

  document.getElementById("deleteDeckBtn").onclick = () => {
    if (AppState.decks.length === 1) {
      alert("Devi avere almeno un mazzo.");
      return;
    }

    // Salviamo il riferimento PRIMA di filtrare, perché dopo il filter
    // il mazzo non è più in AppState e non potremmo recuperare supabase_id.
    const deletedDeck = AppState.decks.find(d => d.id === AppState.currentDeckId);

    AppState.decks = AppState.decks.filter(d => d.id !== AppState.currentDeckId);
    AppState.currentDeckId = AppState.decks[0].id;
    saveDecks();

    // Elimina da Supabase in background (solo se il mazzo aveva un ID cloud).
    if (deletedDeck && typeof deleteDeckFromSupabase === "function") {
      deleteDeckFromSupabase(deletedDeck).catch(() => {});
    }

    renderDeckBuilderScreen();
  };

  document.getElementById("renameDeckBtn").onclick = () => {
    const deck    = getCurrentDeck();
    const newName = document.getElementById("deckNameInput").value.trim();
    if (!newName) return;

    deck.name = newName;
    saveDecks();
    renderDeckBuilderScreen();
  };

  updateCommanderActions();
  updateBackButtons();
}

// Genera l'HTML del box "Comandante" nella colonna destra.
function renderCommanderBox(deck) {
  if (!deck.commanderId) {
    return `<p class="muted">Nessun comandante selezionato.</p>`;
  }

  // .find() scorre CardDatabase e restituisce il primo oggetto con id corrispondente
  const commander = CardDatabase.find(c => c.id === deck.commanderId);
  if (!commander) {
    return `<p class="muted">Comandante non trovato.</p>`;
  }

  // onerror="this.style.display='none'" nasconde l'img se il PNG non esiste ancora
  return `
    <div class="row" style="align-items: flex-start;">
      <img
        src="${commander.image}"
        alt="${commander.name}"
        style="width: 90px; border-radius: 10px; border: 1px solid #2a3140;"
        onerror="this.style.display='none'"
      >
      <div>
        <p><strong>${commander.name}</strong></p>
        <p>Colore: ${commander.color}</p>
        <p>Tipo: ${commander.type}</p>
        <p>Rarità: ${commander.rarity}</p>
        <button id="removeCommanderBtn" class="danger-btn">Rimuovi comandante</button>
      </div>
    </div>
  `;
}

// Attacca il listener al bottone "Rimuovi comandante" (se presente nel DOM).
// Funzione separata perché il bottone viene generato dinamicamente da
// renderCommanderBox e va ri-collegato ogni volta.
function updateCommanderActions() {
  const btn = document.getElementById("removeCommanderBtn");
  if (!btn) return;

  btn.onclick = () => {
    const deck = getCurrentDeck();
    deck.commanderId = null;
    saveDecks();
    renderDeckBuilderScreen();
  };
}

// ── Filtro collezione ─────────────────────────────────────────
// Legge i valori correnti dei filtri e restituisce solo le carte
// che soddisfano tutti i criteri contemporaneamente.
function getFilteredCards() {
  // ?. (optional chaining): accede alla proprietà solo se l'elemento
  // esiste. Utile perché questa funzione può essere chiamata anche
  // prima che il DOM sia pronto.
  const search       = document.getElementById("cardSearchInput")?.value?.toLowerCase() || "";
  const colorFilter  = document.getElementById("colorFilter")?.value  || "all";
  const typeFilter   = document.getElementById("typeFilter")?.value   || "all";
  const rarityFilter = document.getElementById("rarityFilter")?.value || "all";

  const deck      = getCurrentDeck();
  const commander = deck.commanderId ? CardDatabase.find(c => c.id === deck.commanderId) : null;

  // .filter() mantiene solo le carte per cui tutte le condizioni sono true.
  // Ogni variabile "matches*" è un booleano che rappresenta un singolo criterio.
  return CardDatabase.filter(card => {
    const matchesSearch =
      card.name.toLowerCase().includes(search)  ||
      card.type.toLowerCase().includes(search)  ||
      card.color.toLowerCase().includes(search) ||
      card.rarity.toLowerCase().includes(search);

    const matchesColor  = colorFilter  === "all" || card.color  === colorFilter;
    const matchesType   = typeFilter   === "all" || card.type   === typeFilter;
    const matchesRarity = rarityFilter === "all" || card.rarity === rarityFilter;

    // Regola identità colore del comandante: se c'è un comandante,
    // mostra solo le carte del suo colore, i Territori (neutri)
    // e le Colorless (usabili da tutti).
    const matchesCommanderRules = !commander ||
      card.type === "Territory"         ||
      card.color === commander.color    ||
      card.color === "Colorless";

    return matchesSearch && matchesColor && matchesType && matchesRarity && matchesCommanderRules;
  });
}

function renderFilteredCollection() {
  const filtered = getFilteredCards();
  renderCollection(filtered);
}

// Popola il <select id="deckSelect"> con un'opzione per ogni mazzo salvato.
// L'opzione del mazzo corrente avrà l'attributo "selected".
function populateDeckSelect() {
  const select      = document.getElementById("deckSelect");
  const currentDeck = getCurrentDeck();

  // .map() trasforma ogni elemento dell'array in una stringa HTML,
  // poi .join("") unisce tutte le stringhe in una sola senza separatori.
  select.innerHTML = AppState.decks.map(deck => `
    <option value="${deck.id}" ${deck.id === currentDeck.id ? "selected" : ""}>${deck.name}</option>
  `).join("");
}

// Aggiorna solo la classe CSS "selected" sulle immagini della collezione,
// senza ri-renderizzare tutta la griglia (più efficiente).
function updateSelectedCollectionCard() {
  // querySelectorAll restituisce tutti gli elementi con quella classe CSS.
  // .forEach li scorre uno a uno.
  document.querySelectorAll(".collection-card-image").forEach(img => {
    // classList.toggle(classe, condizione):
    //   se condizione è true  → aggiunge la classe
    //   se condizione è false → la rimuove
    img.classList.toggle("selected", img.dataset.cardId === selectedCardId);
  });
}

// Renderizza la griglia della collezione con le carte passate.
function renderCollection(cards) {
  const grid        = document.getElementById("collectionGrid");
  const currentDeck = getCurrentDeck();

  grid.innerHTML = cards.map(card => {
    const isSelected = selectedCardId === card.id ? "selected" : "";

    // Conta quante copie di questa carta sono già nel mazzo corrente,
    // per mostrare "2x" sopra l'immagine.
    const copies = card.type === "Territory"
      ? (currentDeck.territoryCards || []).filter(id => id === card.id).length
      : currentDeck.cards.filter(id => id === card.id).length;

    // data-card-id è un "data attribute" HTML: permette di memorizzare
    // dati personalizzati su un elemento e recuperarli con .dataset.cardId
    return `
      <div class="image-card">
        <div class="card-image-wrap">
          <img
            class="card-image collection-card-image ${isSelected}"
            src="${card.image}"
            alt="${card.name}"
            title="${card.name}"
            data-card-id="${card.id}"
            onerror="this.style.display='none'"
          >
        </div>
        <div class="card-hint" style="text-align:center;">${copies > 0 ? copies + "x" : ""}</div>
      </div>
    `;
  }).join("");

  // Attacca i listener alle immagini appena inserite nel DOM
  document.querySelectorAll(".collection-card-image").forEach(img => {

    // Click singolo: seleziona la carta e aggiorna il preview
    img.addEventListener("click", () => {
      selectedCardId = img.dataset.cardId;
      updateSelectedCollectionCard();
      renderCardPreview();
    });

    // Doppio click: aggiunge subito la carta al mazzo (shortcut)
    img.addEventListener("dblclick", (event) => {
      // Previene il comportamento di default del browser (es. selezione testo)
      event.preventDefault();

      const card = CardDatabase.find(c => c.id === img.dataset.cardId);
      if (!card) return;

      selectedCardId = card.id;
      updateSelectedCollectionCard();

      const deck = getCurrentDeck();
      if (!canAddCardToDeck(deck, card)) {
        renderCardPreview();
        return;
      }

      if (card.type === "Territory") {
        if (!deck.territoryCards) deck.territoryCards = [];
        deck.territoryCards.push(card.id);
      } else {
        deck.cards.push(card.id);
      }

      saveDecks();
      // Aggiorniamo solo i componenti che cambiano, non tutta la schermata
      renderCollection(getFilteredCards());
      renderCardPreview();
      renderDeckList();
      renderDeckValidation();
    });
  });
}

// Mostra i dettagli della carta selectedCardId nel pannello preview.
function renderCardPreview() {
  const previewBox = document.getElementById("cardPreviewBox");
  if (!previewBox) return;

  const card = CardDatabase.find(c => c.id === selectedCardId);
  const deck = getCurrentDeck();

  if (!card) {
    previewBox.innerHTML = `<p class="card-preview-placeholder">Seleziona una carta.</p>`;
    return;
  }

  const copiesInMainDeck      = deck.cards.filter(id => id === card.id).length;
  const copiesInTerritoryDeck = (deck.territoryCards || []).filter(id => id === card.id).length;
  const copiesShown           = card.type === "Territory" ? copiesInTerritoryDeck : copiesInMainDeck;

  // Solo i Minion Legendary possono essere comandanti
  const isCommanderEligible = card.type === "Minion" && card.rarity === "Legendary";
  const canAddToDeck        = canAddCardToDeck(deck, card);

  previewBox.innerHTML = `
    <h3>Dettagli carta</h3>
    <img class="card-preview-image" src="${card.image}" alt="${card.name}" onerror="this.style.display='none'">

    <h4>${card.name}</h4>
    <p><strong>Colore:</strong> ${card.color}</p>
    <p><strong>Tipo:</strong> ${card.type}</p>
    <p><strong>Rarità:</strong> ${card.rarity}</p>
    <p><strong>Costo:</strong> ${card.cost}</p>
    <p><strong>Copie nel deck:</strong> ${copiesShown}</p>
    <p>${card.text || "Nessun testo effetto inserito."}</p>

    <div class="card-preview-actions">
      <button id="setCommanderBtn" class="secondary-btn" ${isCommanderEligible ? "" : "disabled"}>
        Imposta come comandante
      </button>

      <button id="addSelectedCardBtn" class="primary-btn" ${canAddToDeck ? "" : "disabled"}>
        ${card.type === "Territory" ? "Aggiungi al Territory Deck" : "Aggiungi al Main Deck"}
      </button>
    </div>
  `;

  document.getElementById("setCommanderBtn").onclick = () => {
    if (!isCommanderEligible) return;

    deck.commanderId = card.id;

    // Rimuove dal main deck tutte le carte che non rispettano più
    // l'identità di colore del nuovo comandante.
    // .filter() con negazione: mantiene solo le carte "valide".
    deck.cards = deck.cards.filter(cardId => {
      const deckCard = CardDatabase.find(c => c.id === cardId);
      return (
        deckCard &&
        deckCard.id !== card.id &&             // il comandante non può stare anche nel main
        deckCard.type !== "Territory" &&
        (deckCard.color === card.color || deckCard.color === "Colorless")
      );
    });

    saveDecks();
    renderDeckBuilderScreen();
  };

  document.getElementById("addSelectedCardBtn").onclick = () => {
    if (!canAddCardToDeck(deck, card)) return;

    if (card.type === "Territory") {
      if (!deck.territoryCards) deck.territoryCards = [];
      deck.territoryCards.push(card.id);
    } else {
      deck.cards.push(card.id);
    }

    saveDecks();
    renderCollection(getFilteredCards());
    renderDeckList();
    renderDeckValidation();
    renderCardPreview();
  };
}

// Verifica se la carta `card` può essere aggiunta al `deck`.
// Controlla: limite di slot, identità colore, e numero massimo di copie.
function canAddCardToDeck(deck, card) {
  const commander = deck.commanderId ? CardDatabase.find(c => c.id === deck.commanderId) : null;

  if (card.type === "Territory") {
    const territoryCards = deck.territoryCards || [];
    if (territoryCards.length >= 12) return false;

    const copies    = territoryCards.filter(id => id === card.id).length;
    const maxCopies = getMaxCopies(card);
    return copies < maxCopies;
  }

  // Il comandante non può essere aggiunto anche al main deck
  if (deck.commanderId && card.id === deck.commanderId) return false;

  // Blocca carte fuori dall'identità colore del comandante
  if (commander && card.color !== commander.color && card.color !== "Colorless") return false;

  if (deck.cards.length >= 29) return false;

  const copies    = deck.cards.filter(id => id === card.id).length;
  const maxCopies = getMaxCopies(card);
  return copies < maxCopies;
}

// Aggiorna la lista delle carte nel mazzo (pannello destro) e i contatori.
function renderDeckList() {
  const deck           = getCurrentDeck();
  const deckList       = document.getElementById("deckList");
  const countLabel     = document.getElementById("deckCount");
  const territoryCount = document.getElementById("territoryCount");

  countLabel.textContent     = deck.cards.length;
  territoryCount.textContent = deck.territoryCards?.length || 0;

  // Raggruppiamo le carte per ID per mostrare "2x Highwayman"
  // invece di due righe separate. Il pattern è un oggetto usato
  // come contatore: { "015": 2, "020": 1, ... }
  const groupedMain = {};
  deck.cards.forEach(cardId => {
    groupedMain[cardId] = (groupedMain[cardId] || 0) + 1;
  });

  const groupedTerritory = {};
  (deck.territoryCards || []).forEach(cardId => {
    groupedTerritory[cardId] = (groupedTerritory[cardId] || 0) + 1;
  });

  // Ordiniamo per costo (crescente), poi per nome come secondo criterio.
  // .sort() con comparatore: se ritorna < 0, a viene prima di b.
  const sortedMainIds = Object.keys(groupedMain).sort((a, b) => {
    const cardA = CardDatabase.find(c => c.id === a);
    const cardB = CardDatabase.find(c => c.id === b);
    return (cardA?.cost || 0) - (cardB?.cost || 0) || (cardA?.name || "").localeCompare(cardB?.name || "");
  });

  const sortedTerritoryIds = Object.keys(groupedTerritory).sort((a, b) => {
    const cardA = CardDatabase.find(c => c.id === a);
    const cardB = CardDatabase.find(c => c.id === b);
    return (cardA?.cost || 0) - (cardB?.cost || 0) || (cardA?.name || "").localeCompare(cardB?.name || "");
  });

  let html = "";

  html += `<h4 style="margin-bottom: 10px;">Main Deck</h4>`;

  if (sortedMainIds.length === 0) {
    html += `<p class="muted">Il main deck è vuoto.</p>`;
  } else {
    html += sortedMainIds.map(cardId => {
      const card = CardDatabase.find(c => c.id === cardId);
      const qty  = groupedMain[cardId];
      return `
        <div class="deck-card-row">
          <div class="deck-card-name"><span>${qty}x ${card ? card.name : "Carta sconosciuta"}</span></div>
          <button class="secondary-btn remove-main-card-btn" data-card-id="${cardId}">Rimuovi</button>
        </div>
      `;
    }).join("");
  }

  html += `<h4 style="margin: 18px 0 10px;">Territory Deck</h4>`;

  if (sortedTerritoryIds.length === 0) {
    html += `<p class="muted">Il territory deck è vuoto.</p>`;
  } else {
    html += sortedTerritoryIds.map(cardId => {
      const card = CardDatabase.find(c => c.id === cardId);
      const qty  = groupedTerritory[cardId];
      return `
        <div class="deck-card-row">
          <div class="deck-card-name"><span>${qty}x ${card ? card.name : "Carta sconosciuta"}</span></div>
          <button class="secondary-btn remove-territory-card-btn" data-card-id="${cardId}">Rimuovi</button>
        </div>
      `;
    }).join("");
  }

  deckList.innerHTML = html;

  // Listener per i bottoni "Rimuovi" del main deck.
  // Usiamo .findIndex() per trovare la posizione della prima occorrenza
  // dell'ID, poi .splice(index, 1) per rimuovere SOLO quella copia
  // (non tutte le copie con quello stesso ID).
  document.querySelectorAll(".remove-main-card-btn").forEach(btn => {
    btn.onclick = () => {
      const cardId = btn.dataset.cardId;
      const index  = deck.cards.findIndex(id => id === cardId);

      if (index >= 0) {
        deck.cards.splice(index, 1); // splice(posizione, quantità da rimuovere)
      }

      saveDecks();
      renderCollection(getFilteredCards());
      renderDeckList();
      renderDeckValidation();
      renderCardPreview();
    };
  });

  document.querySelectorAll(".remove-territory-card-btn").forEach(btn => {
    btn.onclick = () => {
      const cardId       = btn.dataset.cardId;
      const territoryCards = deck.territoryCards || [];
      const index        = territoryCards.findIndex(id => id === cardId);

      if (index >= 0) {
        territoryCards.splice(index, 1);
      }

      deck.territoryCards = territoryCards;
      saveDecks();
      renderCollection(getFilteredCards());
      renderDeckList();
      renderDeckValidation();
      renderCardPreview();
    };
  });
}

// Controlla tutte le regole del gioco e mostra gli errori nel box di stato.
function renderDeckValidation() {
  const deck = getCurrentDeck();
  const box  = document.getElementById("deckValidationBox");
  if (!box) return;

  // Raccogliamo tutti i problemi in un array. Se alla fine è vuoto,
  // il mazzo è valido.
  const issues = [];

  if (!deck.commanderId) {
    issues.push("Manca il comandante.");
  } else {
    const commander = CardDatabase.find(c => c.id === deck.commanderId);

    if (!commander) {
      issues.push("Il comandante selezionato non esiste.");
    } else {
      if (!(commander.type === "Minion" && commander.rarity === "Legendary")) {
        issues.push("Il comandante deve essere un Minion Legendary.");
      }

      const commanderCopiesInMainDeck = deck.cards.filter(cardId => cardId === commander.id).length;
      if (commanderCopiesInMainDeck > 0) {
        issues.push("Il comandante non può essere presente anche nel main deck.");
      }

      // Cerca carte nel main deck con colore diverso dal comandante
      const invalidMainDeckColors = deck.cards.filter(cardId => {
        const card = CardDatabase.find(c => c.id === cardId);
        return card && card.color !== commander.color && card.color !== "Colorless";
      });
      if (invalidMainDeckColors.length > 0) {
        issues.push("Il main deck contiene carte fuori dall'identità di colore del comandante.");
      }
    }
  }

  if (deck.cards.length !== 29) {
    issues.push(`Il main deck deve contenere esattamente 29 carte. Attuali: ${deck.cards.length}.`);
  }

  if ((deck.territoryCards || []).length !== 12) {
    issues.push(`Il territory deck deve contenere esattamente 12 carte. Attuali: ${(deck.territoryCards || []).length}.`);
  }

  // Verifica che nessuna carta superi il limite di copie nel main deck.
  // Object.entries restituisce array di coppie [chiave, valore].
  const mainCounts = {};
  deck.cards.forEach(cardId => {
    mainCounts[cardId] = (mainCounts[cardId] || 0) + 1;
  });

  Object.entries(mainCounts).forEach(([cardId, qty]) => {
    const card = CardDatabase.find(c => c.id === cardId);
    if (!card) return;
    const maxCopies = getMaxCopies(card);
    if (maxCopies !== Infinity && qty > maxCopies) {
      issues.push(`${card.name}: massimo ${maxCopies} copie consentite nel main deck.`);
    }
  });

  const territoryCounts = {};
  (deck.territoryCards || []).forEach(cardId => {
    territoryCounts[cardId] = (territoryCounts[cardId] || 0) + 1;
  });

  Object.entries(territoryCounts).forEach(([cardId, qty]) => {
    const card = CardDatabase.find(c => c.id === cardId);
    if (!card) return;
    const maxCopies = getMaxCopies(card);
    if (maxCopies !== Infinity && qty > maxCopies) {
      issues.push(`${card.name}: massimo ${maxCopies} copie consentite nel territory deck.`);
    }
  });

  if (issues.length === 0) {
    box.innerHTML = `<strong>Mazzo valido.</strong> Pronto per il gioco.`;
    return;
  }

  // .map() crea un <li> per ogni problema, .join("") li unisce in HTML
  box.innerHTML = `
    <strong>Mazzo non valido:</strong>
    <ul style="margin-top: 8px; padding-left: 18px;">
      ${issues.map(issue => `<li>${issue}</li>`).join("")}
    </ul>
  `;
}
