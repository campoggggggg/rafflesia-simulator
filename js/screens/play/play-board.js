// ============================================================
// play/play-board.js — Engine di gioco e rendering del campo.
// ============================================================

import { AppState }      from '../../core/state.js';
import { CardDatabase }  from '../../data/cards.js';

let PlayState   = null;
let _onExitGame = null;
function setPlayState(s) { PlayState = s; }

// ── Utility ───────────────────────────────────────────────────

function shuffleArray(array) {
  const arr = [...(array || [])];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function getCardById(cardId) {
  return CardDatabase.find(card => card.id === cardId) || null;
}

function addPlayLog(text) {
  if (!PlayState) return;
  PlayState.log.unshift(text);
  PlayState.log = PlayState.log.slice(0, 24);
}

function getDefaultAvatar(side) {
  return side === "player"
    ? "https://via.placeholder.com/72x72?text=You"
    : "https://via.placeholder.com/72x72?text=AI";
}

function createAICommander(playerCommander) {
  const candidates = CardDatabase.filter(card =>
    card.type   === "Minion"    &&
    card.rarity === "Legendary" &&
    card.id     !== playerCommander.id &&
    (card.color === playerCommander.color || card.color === "Colorless")
  );
  return candidates[0] || playerCommander;
}

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

// ── Setup partita ─────────────────────────────────────────────

function emptyPlayerState(name, avatar, commanderId, library, territoryLibrary) {
  return {
    name,
    avatar,
    life:             20,
    commanderId,
    library:          shuffleArray(library),
    territoryLibrary: shuffleArray(territoryLibrary),
    hand:             [],
    graveyard:        [],
    removed:          [],
    field:            [null, null, null, null, null],
    suddenZone:       [null, null, null],
    territoryZone:    [null, null, null, null, null, null]
  };
}

export function startAIGame(deck, onExit) {
  _onExitGame = onExit ?? null;
  const playerCommander = getCardById(deck.commanderId);
  const aiCommander     = createAICommander(playerCommander);

  setPlayState({
    turn:               1,
    activePlayer:       "player",
    selectedHandIndex:  null,
    log:                [],
    globalStack:        [],
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
      []
    )
  });

  addPlayLog("Partita iniziata.");
  addPlayLog(`Il tuo comandante è ${playerCommander.name}.`);
  addPlayLog(`Il comandante avversario è ${aiCommander.name}.`);

  for (let i = 0; i < 5; i++) {
    drawCardFor("player", false);
    drawCardFor("ai",     false);
  }

  renderGameBoard();
}

// ── Azioni di gioco ───────────────────────────────────────────

function drawCardFor(side, logIt = true) {
  const actor = PlayState[side];
  if (!actor || actor.library.length === 0) return;
  const cardId = actor.library.shift();
  actor.hand.push(cardId);
  if (logIt) {
    addPlayLog(side === "player" ? "Hai pescato una carta." : "L'AI ha pescato una carta.");
  }
}

function drawTerritoryFor(side, logIt = true) {
  const actor = PlayState[side];
  if (!actor || actor.territoryLibrary.length === 0) return;
  const slotIndex = actor.territoryZone.findIndex(slot => slot === null);
  if (slotIndex === -1) return;
  const cardId = actor.territoryLibrary.shift();
  actor.territoryZone[slotIndex] = cardId;
  if (logIt) {
    addPlayLog(side === "player" ? "Hai messo un Territory in gioco." : "L'AI ha messo un Territory in gioco.");
  }
}

function loseIfNeeded() {
  if (PlayState.player.life <= 0) {
    alert("Hai perso la partita.");
    setPlayState(null);
    if (_onExitGame) _onExitGame();
    return true;
  }
  if (PlayState.ai.life <= 0) {
    alert("Hai vinto la partita.");
    setPlayState(null);
    if (_onExitGame) _onExitGame();
    return true;
  }
  return false;
}

function changeLife(side, amount) {
  const actor = PlayState[side];
  actor.life += amount;
  addPlayLog(`${actor.name} ora è a ${actor.life} vite.`);
  if (!loseIfNeeded()) renderGameBoard();
}

function playSelectedToField() {
  if (PlayState.activePlayer     !== "player") return;
  if (PlayState.selectedHandIndex === null)     return;
  const slotIndex = PlayState.player.field.findIndex(slot => slot === null);
  if (slotIndex === -1) { addPlayLog("Non hai slot liberi nel field."); renderGameBoard(); return; }
  const cardId = PlayState.player.hand[PlayState.selectedHandIndex];
  const card   = getCardById(cardId);
  PlayState.player.hand.splice(PlayState.selectedHandIndex, 1);
  PlayState.player.field[slotIndex] = cardId;
  PlayState.selectedHandIndex       = null;
  addPlayLog(`Hai giocato ${card?.name || "una carta"} nel field.`);
  renderGameBoard();
}

function playSelectedToSudden() {
  if (PlayState.activePlayer     !== "player") return;
  if (PlayState.selectedHandIndex === null)     return;
  const slotIndex = PlayState.player.suddenZone.findIndex(slot => slot === null);
  if (slotIndex === -1) { addPlayLog("La sudden zone è piena."); renderGameBoard(); return; }
  const cardId = PlayState.player.hand[PlayState.selectedHandIndex];
  PlayState.player.hand.splice(PlayState.selectedHandIndex, 1);
  PlayState.player.suddenZone[slotIndex] = { cardId, facedown: true };
  PlayState.selectedHandIndex            = null;
  addPlayLog("Hai settato una carta nella sudden zone.");
  renderGameBoard();
}

function sendSelectedToStack() {
  if (PlayState.activePlayer     !== "player") return;
  if (PlayState.selectedHandIndex === null)     return;
  const cardId = PlayState.player.hand[PlayState.selectedHandIndex];
  const card   = getCardById(cardId);
  PlayState.player.hand.splice(PlayState.selectedHandIndex, 1);
  PlayState.globalStack.unshift({ owner: "player", cardId });
  PlayState.selectedHandIndex = null;
  addPlayLog(`${card?.name || "Una carta"} è stata messa nello stack.`);
  renderGameBoard();
}

function resolveTopOfStack() {
  if (!PlayState.globalStack.length) return;
  const top   = PlayState.globalStack.shift();
  const actor = PlayState[top.owner];
  actor.graveyard.push(top.cardId);
  const card = getCardById(top.cardId);
  addPlayLog(`${card?.name || "Una carta"} si è risolta ed è andata nel graveyard.`);
  renderGameBoard();
}

function aiTakeTurn() {
  drawCardFor("ai",      true);
  drawTerritoryFor("ai", true);
  const slotIndex = PlayState.ai.field.findIndex(slot => slot === null);
  if (slotIndex !== -1 && PlayState.ai.hand.length > 0) {
    const cardId = PlayState.ai.hand.shift();
    PlayState.ai.field[slotIndex] = cardId;
    const card = getCardById(cardId);
    addPlayLog(`L'AI ha giocato ${card?.name || "una carta"} nel field.`);
  }
  PlayState.turn        += 1;
  PlayState.activePlayer = "player";
  drawCardFor("player", true);
  renderGameBoard();
}

function endTurn() {
  if (PlayState.activePlayer !== "player") return;
  PlayState.activePlayer      = "ai";
  PlayState.selectedHandIndex = null;
  renderGameBoard();
  window.setTimeout(() => { aiTakeTurn(); }, 500);
}

// ── Rendering ─────────────────────────────────────────────────

function renderMiniCard(cardId, hidden = false) {
  if (!cardId) return "";
  const card = getCardById(cardId);
  if (!card)   return "";
  if (hidden) return `<div class="face-down-card"></div>`;
  return `<img class="mini-card" src="${card.image}" alt="${card.name}" title="${card.name}" onerror="this.style.display='none'">`;
}

function renderSimpleZone(cards) {
  if (!cards.length) return `<div class="zone-count">0</div>`;
  const top = getCardById(cards[cards.length - 1]);
  return `
    ${top ? `<img class="zone-card-preview" src="${top.image}" alt="${top.name}" onerror="this.style.display='none'">` : ""}
    <div class="zone-count">${cards.length}</div>
  `;
}

function renderField(field) {
  return field.map(cardId =>
    cardId
      ? `<div class="field-slot">${renderMiniCard(cardId)}</div>`
      : `<div class="field-slot empty"></div>`
  ).join("");
}

function renderSuddenZone(zone) {
  return zone.map(entry =>
    entry
      ? `<div class="sudden-slot">${renderMiniCard(entry.cardId, entry.facedown)}</div>`
      : `<div class="sudden-slot empty"></div>`
  ).join("");
}

function renderTerritoryZone(zone) {
  return zone.map(cardId =>
    cardId
      ? `<div class="territory-slot">${renderMiniCard(cardId)}</div>`
      : `<div class="territory-slot empty"></div>`
  ).join("");
}

function renderHand() {
  if (!PlayState.player.hand.length) return `<p class="muted">La tua mano è vuota.</p>`;
  return PlayState.player.hand.map((cardId, index) => {
    const card     = getCardById(cardId);
    const selected = PlayState.selectedHandIndex === index ? "selected" : "";
    return `
      <img class="hand-card ${selected}"
           src="${card?.image || ""}" alt="${card?.name || "Card"}" title="${card?.name || "Card"}"
           data-hand-index="${index}" onerror="this.style.display='none'">
    `;
  }).join("");
}

function renderStack() {
  if (!PlayState.globalStack.length) return `<div class="stack-entry">Stack vuoto.</div>`;
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
  if (!PlayState.log.length) return `<div class="log-entry">Nessun evento.</div>`;
  return PlayState.log.map(item => `<div class="log-entry">${item}</div>`).join("");
}

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

function renderGameBoard() {
  const screen      = document.getElementById("screen-play");
  const canAct      = PlayState.activePlayer === "player";
  const hasSelection = PlayState.selectedHandIndex !== null;

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
          <button class="primary-btn"   id="playFieldBtn"      ${canAct && hasSelection ? "" : "disabled"}>To Field</button>
          <button class="secondary-btn" id="setSuddenBtn"      ${canAct && hasSelection ? "" : "disabled"}>Set Sudden</button>
          <button class="secondary-btn" id="sendStackBtn"      ${canAct && hasSelection ? "" : "disabled"}>To Stack</button>
          <button class="secondary-btn" id="drawBtn"           ${canAct ? "" : "disabled"}>Draw</button>
          <button class="secondary-btn" id="drawTerritoryBtn"  ${canAct ? "" : "disabled"}>Play Territory</button>
          <button class="danger-btn"    id="endTurnBtn"        ${canAct ? "" : "disabled"}>End Turn</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById("leaveGameBtn").onclick = () => {
    setPlayState(null);
    if (_onExitGame) _onExitGame();
  };

  document.querySelectorAll(".hand-card").forEach(el => {
    el.onclick = () => {
      if (PlayState.activePlayer !== "player") return;
      const index = Number(el.dataset.handIndex);
      PlayState.selectedHandIndex = PlayState.selectedHandIndex === index ? null : index;
      renderGameBoard();
    };
  });

  document.querySelectorAll(".life-minus-btn").forEach(btn => {
    btn.onclick = () => changeLife(btn.dataset.side, -1);
  });
  document.querySelectorAll(".life-plus-btn").forEach(btn => {
    btn.onclick = () => changeLife(btn.dataset.side, +1);
  });

  document.getElementById("playFieldBtn").onclick    = playSelectedToField;
  document.getElementById("setSuddenBtn").onclick    = playSelectedToSudden;
  document.getElementById("sendStackBtn").onclick    = sendSelectedToStack;
  document.getElementById("resolveStackBtn").onclick = resolveTopOfStack;
  document.getElementById("endTurnBtn").onclick      = endTurn;

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
}
