// ============================================================
// deckbuilder.js — Schermata di costruzione mazzi.
// ============================================================

import { AppState, getCurrentDeck }                   from '../core/state.js';
import { saveDecks, deleteDeckFromSupabase }           from '../data/decks.js';
import { CardDatabase }                                from '../data/cards.js';
import { updateBackButtons }                           from '../core/router.js';

let selectedCardId = null;

function getMaxCopies(card) {
  if (card.type === "Territory")   return Infinity;
  if (card.rarity === "Legendary") return 1;
  return 2;
}

// ── Render principale ─────────────────────────────────────────
export function renderDeckBuilderScreen() {
  const screen      = document.getElementById("screen-deckbuilder");
  const currentDeck = getCurrentDeck();

  if (!("commanderId"    in currentDeck)) currentDeck.commanderId    = null;
  if (!("territoryCards" in currentDeck)) currentDeck.territoryCards = [];

  if (!selectedCardId && CardDatabase.length > 0) {
    selectedCardId = CardDatabase[0].id;
  }

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
              <option value="blue">Blue</option>
              <option value="green">Green</option>
              <option value="red">Red</option>
              <option value="black">Black</option>
              <option value="colorless">Colorless</option>
            </select>

            <select id="typeFilter" class="select">
              <option value="all">Tutti i tipi</option>
              <option value="Minion">Minion</option>
              <option value="Spell">Spell</option>
              <option value="Quest">Quest</option>
              <option value="Territory">Territory</option>
            </select>

            <select id="rarityFilter" class="select">
              <option value="all">Tutte le rarità</option>
              <option value="Legendary">Legendary</option>
              <option value="Normal">Normal</option>
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

  populateDeckSelect();
  renderFilteredCollection();
  renderCardPreview();
  renderDeckList();
  renderDeckValidation();

  document.getElementById("cardSearchInput").addEventListener("input",  renderFilteredCollection);
  document.getElementById("colorFilter").addEventListener("change",     renderFilteredCollection);
  document.getElementById("typeFilter").addEventListener("change",      renderFilteredCollection);
  document.getElementById("rarityFilter").addEventListener("change",    renderFilteredCollection);

  document.getElementById("deckSelect").onchange = (e) => {
    AppState.currentDeckId = Number(e.target.value);
    saveDecks();
    renderDeckBuilderScreen();
  };

  document.getElementById("newDeckBtn").onclick = () => {
    const newDeck = {
      id: Date.now(),
      name: `Nuovo Mazzo ${AppState.decks.length + 1}`,
      commanderId: null,
      cards: [],
      territoryCards: []
    };
    AppState.decks.push(newDeck);
    AppState.currentDeckId = newDeck.id;
    saveDecks();
    renderDeckBuilderScreen();
  };

  document.getElementById("deleteDeckBtn").onclick = () => {
    if (AppState.decks.length === 1) {
      alert("Devi avere almeno un mazzo.");
      return;
    }
    const deletedDeck = AppState.decks.find(d => d.id === AppState.currentDeckId);
    AppState.decks = AppState.decks.filter(d => d.id !== AppState.currentDeckId);
    AppState.currentDeckId = AppState.decks[0].id;
    saveDecks();
    if (deletedDeck) deleteDeckFromSupabase(deletedDeck).catch(() => {});
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

function renderCommanderBox(deck) {
  if (!deck.commanderId) {
    return `<p class="muted">Nessun comandante selezionato.</p>`;
  }
  const commander = CardDatabase.find(c => c.id === deck.commanderId);
  if (!commander) {
    return `<p class="muted">Comandante non trovato.</p>`;
  }
  return `
    <div class="row" style="align-items: flex-start;">
      <img src="${commander.image}" alt="${commander.name}"
           style="width: 90px; border-radius: 10px; border: 1px solid #2a3140;"
           onerror="this.style.display='none'">
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

function getFilteredCards() {
  const search       = document.getElementById("cardSearchInput")?.value?.toLowerCase() || "";
  const colorFilter  = document.getElementById("colorFilter")?.value  || "all";
  const typeFilter   = document.getElementById("typeFilter")?.value   || "all";
  const rarityFilter = document.getElementById("rarityFilter")?.value || "all";

  const deck      = getCurrentDeck();
  const commander = deck.commanderId ? CardDatabase.find(c => c.id === deck.commanderId) : null;

  return CardDatabase.filter(card => {
    const matchesSearch =
      card.name.toLowerCase().includes(search)  ||
      card.type.toLowerCase().includes(search)  ||
      card.color.toLowerCase().includes(search) ||
      card.rarity.toLowerCase().includes(search);

    const matchesColor  = colorFilter  === "all" || card.color  === colorFilter;
    const matchesType   = typeFilter   === "all" || card.type   === typeFilter;
    const matchesRarity = rarityFilter === "all" || card.rarity === rarityFilter;

    const matchesCommanderRules = !commander ||
      card.type === "Territory"         ||
      card.color === commander.color    ||
      card.color === "colorless";

    return matchesSearch && matchesColor && matchesType && matchesRarity && matchesCommanderRules;
  });
}

function renderFilteredCollection() {
  renderCollection(getFilteredCards());
}

function populateDeckSelect() {
  const select      = document.getElementById("deckSelect");
  const currentDeck = getCurrentDeck();
  select.innerHTML = AppState.decks.map(deck => `
    <option value="${deck.id}" ${deck.id === currentDeck.id ? "selected" : ""}>${deck.name}</option>
  `).join("");
}

function updateSelectedCollectionCard() {
  document.querySelectorAll(".collection-card-image").forEach(img => {
    img.classList.toggle("selected", img.dataset.cardId === selectedCardId);
  });
}

function renderCollection(cards) {
  const grid        = document.getElementById("collectionGrid");
  const currentDeck = getCurrentDeck();

  grid.innerHTML = cards.map(card => {
    const isSelected = selectedCardId === card.id ? "selected" : "";
    const copies = card.type === "Territory"
      ? (currentDeck.territoryCards || []).filter(id => id === card.id).length
      : currentDeck.cards.filter(id => id === card.id).length;

    return `
      <div class="image-card">
        <div class="card-image-wrap">
          <img class="card-image collection-card-image ${isSelected}"
               src="${card.image}" alt="${card.name}" title="${card.name}"
               data-card-id="${card.id}" onerror="this.style.display='none'">
        </div>
        <div class="card-hint" style="text-align:center;">${copies > 0 ? copies + "x" : ""}</div>
      </div>
    `;
  }).join("");

  document.querySelectorAll(".collection-card-image").forEach(img => {
    img.addEventListener("click", () => {
      selectedCardId = img.dataset.cardId;
      updateSelectedCollectionCard();
      renderCardPreview();
    });

    img.addEventListener("dblclick", (event) => {
      event.preventDefault();
      const card = CardDatabase.find(c => c.id === img.dataset.cardId);
      if (!card) return;
      selectedCardId = card.id;
      updateSelectedCollectionCard();
      const deck = getCurrentDeck();
      if (!canAddCardToDeck(deck, card)) { renderCardPreview(); return; }
      if (card.type === "Territory") {
        if (!deck.territoryCards) deck.territoryCards = [];
        deck.territoryCards.push(card.id);
      } else {
        deck.cards.push(card.id);
      }
      saveDecks();
      renderCollection(getFilteredCards());
      renderCardPreview();
      renderDeckList();
      renderDeckValidation();
    });
  });
}

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
  const isCommanderEligible   = card.type === "Minion" && card.rarity === "Legendary";
  const canAddToDeck          = canAddCardToDeck(deck, card);

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
    deck.cards = deck.cards.filter(cardId => {
      const deckCard = CardDatabase.find(c => c.id === cardId);
      return (
        deckCard &&
        deckCard.id !== card.id &&
        deckCard.type !== "Territory" &&
        (deckCard.color === card.color || deckCard.color === "colorless")
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

function canAddCardToDeck(deck, card) {
  const commander = deck.commanderId ? CardDatabase.find(c => c.id === deck.commanderId) : null;

  if (card.type === "Territory") {
    const territoryCards = deck.territoryCards || [];
    if (territoryCards.length >= 12) return false;
    return territoryCards.filter(id => id === card.id).length < getMaxCopies(card);
  }

  if (deck.commanderId && card.id === deck.commanderId) return false;
  if (commander && card.color !== commander.color && card.color !== "colorless") return false;
  if (deck.cards.length >= 29) return false;

  return deck.cards.filter(id => id === card.id).length < getMaxCopies(card);
}

function renderDeckList() {
  const deck           = getCurrentDeck();
  const deckList       = document.getElementById("deckList");
  const countLabel     = document.getElementById("deckCount");
  const territoryCount = document.getElementById("territoryCount");

  countLabel.textContent     = deck.cards.length;
  territoryCount.textContent = deck.territoryCards?.length || 0;

  const groupedMain = {};
  deck.cards.forEach(cardId => { groupedMain[cardId] = (groupedMain[cardId] || 0) + 1; });

  const groupedTerritory = {};
  (deck.territoryCards || []).forEach(cardId => { groupedTerritory[cardId] = (groupedTerritory[cardId] || 0) + 1; });

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

  let html = `<h4 style="margin-bottom: 10px;">Main Deck</h4>`;

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

  document.querySelectorAll(".remove-main-card-btn").forEach(btn => {
    btn.onclick = () => {
      const cardId = btn.dataset.cardId;
      const index  = deck.cards.findIndex(id => id === cardId);
      if (index >= 0) deck.cards.splice(index, 1);
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
      if (index >= 0) territoryCards.splice(index, 1);
      deck.territoryCards = territoryCards;
      saveDecks();
      renderCollection(getFilteredCards());
      renderDeckList();
      renderDeckValidation();
      renderCardPreview();
    };
  });
}

function renderDeckValidation() {
  const deck = getCurrentDeck();
  const box  = document.getElementById("deckValidationBox");
  if (!box) return;

  const issues = [];

  if (!deck.commanderId) {
    issues.push("Manca il comandante.");
  } else {
    const commander = CardDatabase.find(c => c.id === deck.commanderId);
    if (!commander) {
      issues.push("Il comandante selezionato non esiste.");
    } else {
      if (!(commander.type === "Minion" && commander.rarity === "Legendary"))
        issues.push("Il comandante deve essere un Minion Legendary.");

      if (deck.cards.filter(cardId => cardId === commander.id).length > 0)
        issues.push("Il comandante non può essere presente anche nel main deck.");

      const invalidColors = deck.cards.filter(cardId => {
        const card = CardDatabase.find(c => c.id === cardId);
        return card && card.color !== commander.color && card.color !== "colorless";
      });
      if (invalidColors.length > 0)
        issues.push("Il main deck contiene carte fuori dall'identità di colore del comandante.");
    }
  }

  if (deck.cards.length !== 29)
    issues.push(`Il main deck deve contenere esattamente 29 carte. Attuali: ${deck.cards.length}.`);

  if ((deck.territoryCards || []).length !== 12)
    issues.push(`Il territory deck deve contenere esattamente 12 carte. Attuali: ${(deck.territoryCards || []).length}.`);

  const mainCounts = {};
  deck.cards.forEach(cardId => { mainCounts[cardId] = (mainCounts[cardId] || 0) + 1; });
  Object.entries(mainCounts).forEach(([cardId, qty]) => {
    const card = CardDatabase.find(c => c.id === cardId);
    if (!card) return;
    const max = getMaxCopies(card);
    if (max !== Infinity && qty > max)
      issues.push(`${card.name}: massimo ${max} copie consentite nel main deck.`);
  });

  const territoryCounts = {};
  (deck.territoryCards || []).forEach(cardId => { territoryCounts[cardId] = (territoryCounts[cardId] || 0) + 1; });
  Object.entries(territoryCounts).forEach(([cardId, qty]) => {
    const card = CardDatabase.find(c => c.id === cardId);
    if (!card) return;
    const max = getMaxCopies(card);
    if (max !== Infinity && qty > max)
      issues.push(`${card.name}: massimo ${max} copie consentite nel territory deck.`);
  });

  if (issues.length === 0) {
    box.innerHTML = `<strong>Mazzo valido.</strong> Pronto per il gioco.`;
    return;
  }

  box.innerHTML = `
    <strong>Mazzo non valido:</strong>
    <ul style="margin-top: 8px; padding-left: 18px;">
      ${issues.map(issue => `<li>${issue}</li>`).join("")}
    </ul>
  `;
}
