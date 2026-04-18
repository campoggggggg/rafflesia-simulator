// ============================================================
// play.js — Simulatore di partita (vs AI).
//
// Struttura del file:
//  1. Menù Play     → renderPlayScreen(), validazione mazzo
//  2. Utility       → shuffle, log, avatar, costruzione deck AI
//  3. Setup partita → startAIGame(), emptyPlayerState()
//  4. Azioni gioco  → draw, play, sudden, stack, risoluzione, AI
//  5. Rendering     → renderGameBoard() e tutte le sotto-funzioni
//
// Quando non c'è una partita attiva, PlayState è null.
// Quando la partita inizia, PlayState diventa un oggetto con tutto
// lo stato corrente della sessione di gioco.
// ============================================================

// `let` permette la riassegnazione. PlayState inizia null e viene
// rimpiazzato con un oggetto completo quando si avvia una partita.
let PlayState = null;

// ── Menù Play ─────────────────────────────────────────────────
// Mostra il menù di selezione modalità (Vs AI o Multiplayer).
function renderPlayScreen() {
  const screen      = document.getElementById("screen-play");
  const currentDeck = getCurrentDeck();

  screen.innerHTML = `
    <div class="row" style="margin-bottom: 16px;">
      <button class="secondary-btn back-btn">← Indietro</button>
      <button class="secondary-btn home-btn">Home</button>
    </div>

    <h2 class="page-title">Play</h2>
    <p class="page-subtitle">Scegli come giocare.</p>

    <div class="play-menu-grid">
      <div class="play-mode-box">
        <h3>Vs AI</h3>
        <p class="muted">Board stile Arena con label piccoli.</p>
        <p><strong>Mazzo selezionato:</strong> ${currentDeck.name}</p>
        <p><strong>Main Deck:</strong> ${currentDeck.cards.length} / 29</p>
        <p><strong>Territory Deck:</strong> ${(currentDeck.territoryCards || []).length} / 12</p>
        <button id="startAiBtn" class="primary-btn">Avvia Vs AI</button>
        <div class="status-box" id="aiStatusBox">Board orizzontale compatta.</div>
      </div>

      <div class="play-mode-box">
        <h3>Multiplayer</h3>
        <p class="muted">Non ancora disponibile.</p>
        <button id="startMpBtn" class="secondary-btn">Apri Multiplayer</button>
        <div class="status-box" id="mpStatusBox">Multiplayer in sviluppo.</div>
      </div>
    </div>
  `;

  document.getElementById("startAiBtn").onclick = () => {
    const deck   = getCurrentDeck();
    const issues = getDeckValidationIssuesForPlay(deck);
    const box    = document.getElementById("aiStatusBox");

    // Se il mazzo ha problemi, mostriamo gli errori nell'apposito box
    // invece di avviare la partita
    if (issues.length) {
      box.innerHTML = `
        Il mazzo non è valido:
        <ul style="margin-top:8px; padding-left:18px;">
          ${issues.map(issue => `<li>${issue}</li>`).join("")}
        </ul>
      `;
      return; // `return` interrompe l'esecuzione della funzione qui
    }

    startAIGame(deck);
  };

  document.getElementById("startMpBtn").onclick = () => {
    document.getElementById("mpStatusBox").textContent = "Multiplayer non ancora implementato.";
  };

  updateBackButtons();
}

// Verifica le regole minime per avviare la partita.
// Restituisce un array di stringhe di errore (vuoto se tutto ok).
function getDeckValidationIssuesForPlay(deck) {
  const issues = [];
  if (!deck.commanderId) issues.push("Manca il comandante.");
  if (deck.cards.length !== 29) issues.push(`Il main deck deve contenere 29 carte. Attuali: ${deck.cards.length}.`);
  if ((deck.territoryCards || []).length !== 12) {
    issues.push(`Il territory deck deve contenere 12 carte. Attuali: ${(deck.territoryCards || []).length}.`);
  }
  return issues;
}

// ── Utility ───────────────────────────────────────────────────

// Algoritmo di Fisher-Yates per mescolare un array in modo casuale.
// Parte dall'ultimo elemento e lo scambia con uno a caso tra quelli
// precedenti, poi ripete per tutti gli elementi.
// [...array] crea una COPIA dell'array (spread operator) così
// l'originale non viene modificato.
function shuffleArray(array) {
  const arr = [...(array || [])];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    // Destructuring swap: scambia arr[i] e arr[j] in una sola riga,
    // senza variabile temporanea. Equivalente a:
    //   const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Cerca una carta nel CardDatabase per ID. Restituisce null se non trovata.
function getCardById(cardId) {
  return CardDatabase.find(card => card.id === cardId) || null;
}

// Aggiunge un messaggio al log della partita.
// .unshift() aggiunge in TESTA all'array (messaggio più recente prima).
// .slice(0, 24) mantiene solo gli ultimi 24 messaggi (evita liste infinite).
function addPlayLog(text) {
  if (!PlayState) return;
  PlayState.log.unshift(text);
  PlayState.log = PlayState.log.slice(0, 24);
}

// URL placeholder per gli avatar finché non ci sono immagini reali
function getDefaultAvatar(side) {
  return side === "player"
    ? "https://via.placeholder.com/72x72?text=You"
    : "https://via.placeholder.com/72x72?text=AI";
}

// Sceglie un comandante per l'AI: cerca un Legendary Minion dello stesso
// colore del giocatore (o Colorless), diverso dal comandante del giocatore.
// Se non trova nessun candidato, usa lo stesso comandante del giocatore.
function createAICommander(playerCommander) {
  const candidates = CardDatabase.filter(card =>
    card.type   === "Minion"     &&
    card.rarity === "Legendary"  &&
    card.id     !== playerCommander.id &&
    (card.color === playerCommander.color || card.color === "Colorless")
  );

  return candidates[0] || playerCommander;
}

// Costruisce automaticamente un mazzo da 29 carte per l'AI,
// usando tutte le carte del colore del suo comandante rispettando
// i limiti di copie per rarità.
function buildAIMainDeck(commander) {
  const pool = CardDatabase.filter(card =>
    card.type !== "Territory" &&
    card.id   !== commander.id &&
    (card.color === commander.color || card.color === "Colorless")
  );

  const result = [];
  for (const card of pool) {
    const maxCopies = card.rarity === "Legendary" ? 1 : (card.rarity === "Basic" ? 99 : 2);
    for (let i = 0; i < maxCopies; i++) {
      if (result.length >= 29) break;
      result.push(card.id);
    }
    if (result.length >= 29) break;
  }

  return result.slice(0, 29);
}

// Crea lo stato iniziale di un giocatore (sia umano che AI).
// Il mazzo viene mescolato qui tramite shuffleArray.
function emptyPlayerState(name, avatar, commanderId, library, territoryLibrary) {
  return {
    name,
    avatar,
    life:             20,
    commanderId,
    library:          shuffleArray(library),          // mazzo principale mescolato
    territoryLibrary: shuffleArray(territoryLibrary), // mazzo territori mescolato
    hand:             [],
    graveyard:        [],
    removed:          [],   // zona "esilio"
    field:            [null, null, null, null, null],   // 5 slot field
    suddenZone:       [null, null, null],               // 3 slot sudden
    territoryZone:    [null, null, null, null, null, null] // 6 slot territorio
  };
}

// ── Avvio partita ─────────────────────────────────────────────
// Inizializza PlayState con i dati completi di entrambi i giocatori,
// poi pesca 5 carte per ciascuno e renderizza il campo di gioco.
function startAIGame(deck) {
  const playerCommander = getCardById(deck.commanderId);
  const aiCommander     = createAICommander(playerCommander);

  PlayState = {
    turn:              1,
    activePlayer:      "player",    // chi può agire ora
    selectedHandIndex: null,        // indice della carta selezionata in mano
    log:               [],
    globalStack:       [],          // stack degli spell (risolti dall'alto)
    player: emptyPlayerState(
      AppState.settings.playerName || "Duelist",
      getDefaultAvatar("player"),
      deck.commanderId,
      deck.cards,
      deck.territoryCards || []
    ),
    ai: emptyPlayerState(
      "AI Opponent",
      getDefaultAvatar("ai"),
      aiCommander.id,
      buildAIMainDeck(aiCommander),
      []   // l'AI non ha territorio inizialmente
    )
  };

  addPlayLog("Partita iniziata.");
  addPlayLog(`Il tuo comandante è ${playerCommander.name}.`);
  addPlayLog(`Il comandante avversario è ${aiCommander.name}.`);

  // Pesca iniziale: 5 carte per ciascuno. Il secondo parametro `false`
  // sopprime il messaggio nel log (la pesca iniziale è silenziosa).
  for (let i = 0; i < 5; i++) {
    drawCardFor("player", false);
    drawCardFor("ai",     false);
  }

  renderGameBoard();
}

// ── Azioni di gioco ───────────────────────────────────────────

// Pesca la prima carta dalla library e la aggiunge alla mano.
// .shift() rimuove e restituisce il PRIMO elemento dell'array
// (la cima del mazzo), simulando il pescaggio.
function drawCardFor(side, logIt = true) {
  const actor = PlayState[side];
  if (!actor || actor.library.length === 0) return;

  const cardId = actor.library.shift();
  actor.hand.push(cardId);

  if (logIt) {
    addPlayLog(side === "player" ? "Hai pescato una carta." : "L'AI ha pescato una carta.");
  }
}

// Pesca dal territorio deck e la posiziona nel primo slot libero
// della territoryZone. .findIndex() restituisce l'indice del primo
// elemento null (-1 se non ce ne sono).
function drawTerritoryFor(side, logIt = true) {
  const actor = PlayState[side];
  if (!actor || actor.territoryLibrary.length === 0) return;

  const slotIndex = actor.territoryZone.findIndex(slot => slot === null);
  if (slotIndex === -1) return; // tutti gli slot sono occupati

  const cardId = actor.territoryLibrary.shift();
  actor.territoryZone[slotIndex] = cardId;

  if (logIt) {
    addPlayLog(side === "player" ? "Hai messo un Territory in gioco." : "L'AI ha messo un Territory in gioco.");
  }
}

// Controlla se qualcuno ha 0 o meno vite e termina la partita.
// Restituisce true se la partita è finita, false altrimenti.
// Questo valore è usato da changeLife per sapere se renderizzare.
function loseIfNeeded() {
  if (PlayState.player.life <= 0) {
    alert("Hai perso la partita.");
    PlayState = null;
    renderPlayScreen();
    return true;
  }

  if (PlayState.ai.life <= 0) {
    alert("Hai vinto la partita.");
    PlayState = null;
    renderPlayScreen();
    return true;
  }

  return false;
}

// Modifica le vite di un giocatore e aggiorna il log.
// `amount` può essere positivo (+1) o negativo (-1).
function changeLife(side, amount) {
  const actor = PlayState[side];
  actor.life += amount;
  addPlayLog(`${actor.name} ora è a ${actor.life} vite.`);

  if (!loseIfNeeded()) {
    renderGameBoard();
  }
}

// Gioca la carta selezionata dalla mano nel primo slot field disponibile.
function playSelectedToField() {
  if (PlayState.activePlayer  !== "player") return;
  if (PlayState.selectedHandIndex === null) return;

  const slotIndex = PlayState.player.field.findIndex(slot => slot === null);
  if (slotIndex === -1) {
    addPlayLog("Non hai slot liberi nel field.");
    renderGameBoard();
    return;
  }

  const cardId = PlayState.player.hand[PlayState.selectedHandIndex];
  const card   = getCardById(cardId);

  // .splice(indice, 1) rimuove 1 elemento alla posizione data
  PlayState.player.hand.splice(PlayState.selectedHandIndex, 1);
  PlayState.player.field[slotIndex] = cardId;
  PlayState.selectedHandIndex = null;

  addPlayLog(`Hai giocato ${card?.name || "una carta"} nel field.`);
  renderGameBoard();
}

// Posiziona la carta nella Sudden Zone coperta (face-down).
// Le carte sudden sono nascoste all'avversario finché non vengono attivate.
function playSelectedToSudden() {
  if (PlayState.activePlayer  !== "player") return;
  if (PlayState.selectedHandIndex === null) return;

  const slotIndex = PlayState.player.suddenZone.findIndex(slot => slot === null);
  if (slotIndex === -1) {
    addPlayLog("La sudden zone è piena.");
    renderGameBoard();
    return;
  }

  const cardId = PlayState.player.hand[PlayState.selectedHandIndex];
  PlayState.player.hand.splice(PlayState.selectedHandIndex, 1);

  // L'oggetto { cardId, facedown: true } memorizza sia l'ID che lo stato
  // "coperto" della carta in zona sudden.
  PlayState.player.suddenZone[slotIndex] = { cardId, facedown: true };
  PlayState.selectedHandIndex = null;

  addPlayLog("Hai settato una carta nella sudden zone.");
  renderGameBoard();
}

// Aggiunge la carta allo stack globale degli spell.
// Lo stack funziona LIFO (Last In, First Out): l'ultima carta aggiunta
// è la prima a risolversi. .unshift() la inserisce in testa all'array.
function sendSelectedToStack() {
  if (PlayState.activePlayer  !== "player") return;
  if (PlayState.selectedHandIndex === null) return;

  const cardId = PlayState.player.hand[PlayState.selectedHandIndex];
  const card   = getCardById(cardId);

  PlayState.player.hand.splice(PlayState.selectedHandIndex, 1);
  PlayState.globalStack.unshift({ owner: "player", cardId }); // in cima allo stack
  PlayState.selectedHandIndex = null;

  addPlayLog(`${card?.name || "Una carta"} è stata messa nello stack.`);
  renderGameBoard();
}

// Risolve la carta in cima allo stack e la manda nel cimitero.
// .shift() rimuove e restituisce il primo elemento (la cima dello stack).
function resolveTopOfStack() {
  if (!PlayState.globalStack.length) return;

  const top   = PlayState.globalStack.shift();
  const actor = PlayState[top.owner];
  actor.graveyard.push(top.cardId);

  const card = getCardById(top.cardId);
  addPlayLog(`${card?.name || "Una carta"} si è risolta ed è andata nel graveyard.`);
  renderGameBoard();
}

// ── Turno AI ──────────────────────────────────────────────────
// Logica semplice: l'AI pesca, gioca un territorio, poi gioca il
// primo minion dalla mano nel primo slot libero.
function aiTakeTurn() {
  drawCardFor("ai",       true);
  drawTerritoryFor("ai",  true);

  const slotIndex = PlayState.ai.field.findIndex(slot => slot === null);
  if (slotIndex !== -1 && PlayState.ai.hand.length > 0) {
    const cardId = PlayState.ai.hand.shift(); // prende la prima carta dalla mano AI
    PlayState.ai.field[slotIndex] = cardId;
    const card = getCardById(cardId);
    addPlayLog(`L'AI ha giocato ${card?.name || "una carta"} nel field.`);
  }

  PlayState.turn        += 1;
  PlayState.activePlayer = "player";
  drawCardFor("player", true); // il giocatore pesca all'inizio del suo turno
  renderGameBoard();
}

// Termina il turno del giocatore e avvia quello dell'AI dopo 500ms.
// window.setTimeout(funzione, millisecondi) esegue la funzione dopo
// il ritardo specificato, senza bloccare il browser nel frattempo.
// I 500ms servono per dare un breve feedback visivo prima che l'AI agisca.
function endTurn() {
  if (PlayState.activePlayer !== "player") return;

  PlayState.activePlayer     = "ai";
  PlayState.selectedHandIndex = null;
  renderGameBoard(); // aggiorna subito l'UI (bottoni disabilitati)

  window.setTimeout(() => {
    aiTakeTurn();
  }, 500);
}

// ── Rendering ─────────────────────────────────────────────────
// Le seguenti funzioni costruiscono pezzi di HTML per il campo di gioco.
// Ogni funzione restituisce una stringa HTML da inserire nel parent.

// Genera l'HTML di una carta "mini" (versione piccola usata nel field).
// Se hidden=true mostra il retro (carta coperta).
function renderMiniCard(cardId, hidden = false) {
  if (!cardId) return "";
  const card = getCardById(cardId);
  if (!card) return "";

  if (hidden) {
    return `<div class="face-down-card"></div>`;
  }

  return `<img class="mini-card" src="${card.image}" alt="${card.name}" title="${card.name}" onerror="this.style.display='none'">`;
}

// Mostra un'anteprima della cima di uno stack di carte (es. graveyard)
// con il conteggio totale.
function renderSimpleZone(cards) {
  if (!cards.length) {
    return `<div class="zone-count">0</div>`;
  }

  const top = getCardById(cards[cards.length - 1]); // ultima carta (cima)
  return `
    ${top ? `<img class="zone-card-preview" src="${top.image}" alt="${top.name}" onerror="this.style.display='none'">` : ""}
    <div class="zone-count">${cards.length}</div>
  `;
}

// Trasforma l'array field (5 elementi, null o cardId) in HTML.
// .map() restituisce un array di stringhe, .join("") le unisce.
function renderField(field) {
  return field.map(cardId => {
    if (!cardId) return `<div class="field-slot empty"></div>`;
    return `<div class="field-slot">${renderMiniCard(cardId)}</div>`;
  }).join("");
}

// Renderizza la Sudden Zone. Ogni entry è { cardId, facedown } o null.
function renderSuddenZone(zone) {
  return zone.map(entry => {
    if (!entry) return `<div class="sudden-slot empty"></div>`;
    return `<div class="sudden-slot">${renderMiniCard(entry.cardId, entry.facedown)}</div>`;
  }).join("");
}

function renderTerritoryZone(zone) {
  return zone.map(cardId => {
    if (!cardId) return `<div class="territory-slot empty"></div>`;
    return `<div class="territory-slot">${renderMiniCard(cardId)}</div>`;
  }).join("");
}

// Genera la barra della mano del giocatore.
// La carta selezionata ottiene la classe CSS "selected" per evidenziarla.
function renderHand() {
  if (!PlayState.player.hand.length) {
    return `<p class="muted">La tua mano è vuota.</p>`;
  }

  // .map() con il secondo parametro `index` fornisce la posizione
  // dell'elemento nell'array. Serve per identificare quale carta
  // è stata cliccata tramite data-hand-index.
  return PlayState.player.hand.map((cardId, index) => {
    const card     = getCardById(cardId);
    const selected = PlayState.selectedHandIndex === index ? "selected" : "";
    return `
      <img
        class="hand-card ${selected}"
        src="${card?.image || ""}"
        alt="${card?.name || "Card"}"
        title="${card?.name || "Card"}"
        data-hand-index="${index}"
        onerror="this.style.display='none'"
      >
    `;
  }).join("");
}

// Mostra il contenuto dello stack (le carte in attesa di risoluzione).
function renderStack() {
  if (!PlayState.globalStack.length) {
    return `<div class="stack-entry">Stack vuoto.</div>`;
  }

  return PlayState.globalStack.map(entry => {
    const card = getCardById(entry.cardId);
    return `
      <div class="stack-entry">
        <strong>${entry.owner === "player" ? PlayState.player.name : PlayState.ai.name}</strong><br>
        ${card?.name || "Carta sconosciuta"}
      </div>
    `;
  }).join("");
}

function renderLog() {
  if (!PlayState.log.length) {
    return `<div class="log-entry">Nessun evento.</div>`;
  }

  return PlayState.log.map(item => `<div class="log-entry">${item}</div>`).join("");
}

// Genera la strip con avatar, nome e contatore vite di un giocatore.
function renderPlayerStrip(side) {
  const actor = PlayState[side];

  return `
    <div class="player-strip">
      <div class="player-meta">
        <img class="player-avatar" src="${actor.avatar}" alt="${actor.name}">
        <div class="player-text">
          <h3>${actor.name}</h3>
          <p>${side === "player" ? "You" : "Opponent"}</p>
        </div>
      </div>

      <div class="life-box">
        <button class="secondary-btn life-minus-btn" data-side="${side}">-</button>
        <div class="life-value">${actor.life}</div>
        <button class="secondary-btn life-plus-btn" data-side="${side}">+</button>
      </div>
    </div>
  `;
}

// Genera le zone laterali (Commander, Deck, Territory Deck a sinistra;
// Graveyard e Removed a destra).
function renderSideZones(side, alignment) {
  const actor     = PlayState[side];
  const commander = getCardById(actor.commanderId);

  if (alignment === "left") {
    return `
      <div class="side-zones left">
        <div class="zone-box">
          <div class="zone-label">Commander</div>
          ${commander
            ? `<img class="zone-card-preview" src="${commander.image}" alt="${commander.name}" onerror="this.style.display='none'">`
            : `<div class="zone-count">0</div>`}
        </div>
        <div class="zone-box">
          <div class="zone-label">Main Deck</div>
          <div class="zone-count">${actor.library.length}</div>
        </div>
        <div class="zone-box">
          <div class="zone-label">Territory Deck</div>
          <div class="zone-count">${actor.territoryLibrary.length}</div>
        </div>
      </div>
    `;
  }

  return `
    <div class="side-zones right">
      <div class="zone-box">
        <div class="zone-label">Graveyard</div>
        ${renderSimpleZone(actor.graveyard)}
      </div>
      <div class="zone-box">
        <div class="zone-label">Removed</div>
        ${renderSimpleZone(actor.removed)}
      </div>
    </div>
  `;
}

// Renderizza la metà campo di un giocatore (top=AI, bottom=player).
function renderHalf(side) {
  const actor     = PlayState[side];
  const sideClass = side === "player" ? "bottom" : "top";

  return `
    <div class="arena-half ${sideClass}">
      ${renderSideZones(side, "left")}
      ${renderSideZones(side, "right")}
      ${renderPlayerStrip(side)}

      <div class="field-zone">
        <div class="zone-strip">
          <div class="zone-strip-label">Field</div>
          <div class="field-grid">${renderField(actor.field)}</div>
        </div>
      </div>

      <div class="sudden-zone">
        <div class="zone-strip">
          <div class="zone-strip-label">Sudden Zone</div>
          <div class="sudden-grid">${renderSuddenZone(actor.suddenZone)}</div>
        </div>
      </div>

      <div class="territory-zone">
        <div class="zone-strip">
          <div class="zone-strip-label">Territory Zone</div>
          <div class="territory-grid">${renderTerritoryZone(actor.territoryZone)}</div>
        </div>
      </div>
    </div>
  `;
}

// ── Render principale del campo di gioco ─────────────────────
// Viene chiamata ogni volta che lo stato cambia: ridisegna
// completamente il campo (approccio "re-render totale").
// Pro: semplice, nessun bug di sincronizzazione.
// Contro: meno performante per schermate molto complesse.
function renderGameBoard() {
  const screen      = document.getElementById("screen-play");
  const canAct      = PlayState.activePlayer === "player"; // è il turno del giocatore?
  const hasSelection = PlayState.selectedHandIndex !== null; // ha selezionato una carta?

  screen.innerHTML = `
    <div class="play-board-root">
      <div class="play-topbar">
        <button class="secondary-btn" id="leaveGameBtn">← Esci dalla partita</button>
        <div class="play-status-pill"><strong>Turno:</strong> ${PlayState.turn}</div>
        <div class="play-status-pill"><strong>Attivo:</strong> ${PlayState.activePlayer === "player" ? PlayState.player.name : PlayState.ai.name}</div>
      </div>

      <div class="arena-surface">
        ${renderHalf("ai")}
        ${renderHalf("player")}

        <div class="center-stack">
          <h3>Stack Zone</h3>
          <div class="stack-list">${renderStack()}</div>
          <div style="margin-top:8px; display:flex; justify-content:center;">
            <button class="secondary-btn" id="resolveStackBtn" ${PlayState.globalStack.length ? "" : "disabled"}>Resolve Top</button>
          </div>
        </div>

        <div class="board-log">
          <h3>Log</h3>
          <div class="log-list">${renderLog()}</div>
        </div>
      </div>

      <div class="play-hand-bar">
        <div class="hand-left">
          <h3>Hand</h3>
          <div class="hand-row">${renderHand()}</div>
        </div>

        <div class="hand-actions">
          <button class="primary-btn"   id="playFieldBtn"   ${canAct && hasSelection ? "" : "disabled"}>To Field</button>
          <button class="secondary-btn" id="setSuddenBtn"   ${canAct && hasSelection ? "" : "disabled"}>Set Sudden</button>
          <button class="secondary-btn" id="sendStackBtn"   ${canAct && hasSelection ? "" : "disabled"}>To Stack</button>
          <button class="secondary-btn" id="drawBtn"        ${canAct ? "" : "disabled"}>Draw</button>
          <button class="secondary-btn" id="drawTerritoryBtn" ${canAct ? "" : "disabled"}>Play Territory</button>
          <button class="danger-btn"    id="endTurnBtn"     ${canAct ? "" : "disabled"}>End Turn</button>
        </div>
      </div>
    </div>
  `;

  // Uscita dalla partita: azzera PlayState e torna al menù
  document.getElementById("leaveGameBtn").onclick = () => {
    PlayState = null;
    renderPlayScreen();
  };

  // Selezione carta dalla mano: click la seleziona, click di nuovo
  // sulla stessa la deseleziona (toggle).
  document.querySelectorAll(".hand-card").forEach(el => {
    el.onclick = () => {
      if (PlayState.activePlayer !== "player") return;
      const index = Number(el.dataset.handIndex);
      // Se clicco la carta già selezionata → deseleziona (null)
      // Altrimenti → seleziona quella nuova
      PlayState.selectedHandIndex = PlayState.selectedHandIndex === index ? null : index;
      renderGameBoard();
    };
  });

  // I bottoni +/- vite usano data-side="player" o "ai" per sapere
  // di chi modificare le vite senza bisogno di due listener separati.
  document.querySelectorAll(".life-minus-btn").forEach(btn => {
    btn.onclick = () => changeLife(btn.dataset.side, -1);
  });

  document.querySelectorAll(".life-plus-btn").forEach(btn => {
    btn.onclick = () => changeLife(btn.dataset.side, +1);
  });

  document.getElementById("playFieldBtn").onclick   = playSelectedToField;
  document.getElementById("setSuddenBtn").onclick   = playSelectedToSudden;
  document.getElementById("sendStackBtn").onclick   = sendSelectedToStack;

  document.getElementById("drawBtn").onclick = () => {
    if (!canAct) return;
    drawCardFor("player", true);
    renderGameBoard();
  };

  document.getElementById("drawTerritoryBtn").onclick = () => {
    if (!canAct) return;
    drawTerritoryFor("player", true);
    renderGameBoard();
  };

  document.getElementById("endTurnBtn").onclick     = endTurn;
  document.getElementById("resolveStackBtn").onclick = resolveTopOfStack;
}
