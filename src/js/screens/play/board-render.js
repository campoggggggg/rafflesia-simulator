// ============================================================
// play/board-render.js — Full board UI rendering.
// Renders both halves, life totals, hand, phase buttons,
// territory deck, card preview, context menus, log and chat.
// ============================================================

import { GameState, getPlayer, getOpponentRole, displayName } from './game-state.js';
import { getContextActions, endDrag,
         setPhase, endTurn, adjustLife,
         drawOne, playTerritory, addDamage,
         addCounter }                              from './card-actions.js';
import { broadcastSnapshot, broadcastChat }        from './networking.js';
import { playSound, toggleMute, isMuted }          from './sound.js';

// ── Context menu state ────────────────────────────────────────
let _ctxMenu    = null;  // { instanceId, zone, x, y }
let _previewCard = null;

// ── Sudden popup state ────────────────────────────────────────
let _suddenPopupRole = null;

// ── Pile popup state ──────────────────────────────────────────
let _pilePopup = null;  // { role, zone, label }

// ── Attack arrow state ────────────────────────────────────────
let _attackState = null; // { attackerId, attackerName, sx, sy }
let _attackListenersAttached = false;

export function closeContextMenu() {
  _ctxMenu    = null;
  _previewCard = null;
  _removeCtxDOM();
}

// ── Entry point ───────────────────────────────────────────────

export function renderBoard() {
  const screen = document.getElementById("screen-play");
  if (!screen || !screen.classList.contains("active")) return;
  document.body.classList.add("sim-active");

  const my   = GameState.myRole;
  const opp  = getOpponentRole(my);
  const myP  = getPlayer(my);
  const oppP = getPlayer(opp);

  screen.innerHTML = `
    <div class="sim-root" id="simRoot">

      <!-- ═══════════════════════════════════════════
           TOPBAR — phase buttons, turn, end turn
           ═══════════════════════════════════════════ -->
      ${_renderTopBar()}

      <!-- ═══════════════════════════════════════════
           ARENA — main play area (left ~75%)
           ═══════════════════════════════════════════ -->
      <div class="sim-arena" id="simArena">

        <!-- ZONA TERRITORIO AVVERSARIO -->
        <div class="sim-territory-row sim-territory-row--opp" data-role="${opp}">
          ${_renderTerritoryRow(oppP, opp, true)}
        </div>

        <!-- CAMPO AVVERSARIO -->
        <div class="sim-half sim-half--opp" id="halfOpp" data-role="${opp}">
          ${_renderHalf(oppP, opp, true)}
        </div>

        <!-- DIVIDER -->
        <div class="sim-divider"></div>

        <!-- CAMPO GIOCATORE -->
        <div class="sim-half sim-half--own" id="halfOwn" data-role="${my}">
          ${_renderHalf(myP, my, false)}
        </div>

        <!-- ZONA TERRITORIO MIA -->
        <div class="sim-territory-row" data-role="${my}">
          ${_renderTerritoryRow(myP, my, false)}
        </div>

      </div>

      <!-- ═══════════════════════════════════════════
           HAND BAR — carte in mano del giocatore
           ═══════════════════════════════════════════ -->
      <div class="sim-handbar">
        ${_renderHandBar(myP, my)}
      </div>

      <!-- ═══════════════════════════════════════════
           PANNELLO LATERALE DESTRO
           Dall'alto: area avversario | log | area mia
           ═══════════════════════════════════════════ -->
      <div class="sim-sidebar" id="simSidebar">
        ${_renderSidebar(myP, my, oppP, opp)}
      </div>

      <!-- Sudden popup -->
      <div class="sim-sudden-popup" id="simSuddenPopup" style="display:none"></div>

      <!-- Pile popup (graveyard / banished) -->
      <div class="sim-pile-popup" id="simPilePopup" style="display:none"></div>

      <!-- Hand reveal popup (mostra la mano dell'avversario quando clicca Show) -->
      <div class="sim-hand-reveal-popup" id="simHandRevealPopup" style="display:none"></div>

      <!-- Confirm show hand popup -->
      <div class="sim-confirm-popup" id="simShowHandConfirm" style="display:none">
        <div class="sim-confirm-text">Do you want to show your hand to your opponent?</div>
        <div class="sim-confirm-btns">
          <button class="sim-confirm-yes" id="simShowHandYes">Yes</button>
          <button class="sim-confirm-no"  id="simShowHandNo">No</button>
        </div>
      </div>

      <!-- SVG overlay per freccia d'attacco -->
      <svg id="simAttackSvg" class="sim-attack-svg" style="display:none"
           xmlns="http://www.w3.org/2000/svg">
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#ef4444"/>
          </marker>
        </defs>
        <line id="simAttackLine" stroke="#ef4444" stroke-width="2.5"
              stroke-dasharray="8 4" marker-end="url(#arrowhead)"
              x1="0" y1="0" x2="0" y2="0"/>
      </svg>

    </div>
  `;

  _attachEvents();
  _renderCtxMenu();
}

// Chiamata quando l'avversario clicca "Show" — apre la finestra con le sue carte
export function openHandReveal(cards) {
  const popup = document.getElementById("simHandRevealPopup");
  if (!popup) return;

  popup.innerHTML = `
    <div class="sim-hand-reveal-header">
      <span class="sim-hand-reveal-title">Opponent's Hand (${cards.length})</span>
      <button class="sim-hand-reveal-close" id="simHandRevealClose">Close</button>
    </div>
    <div class="sim-hand-reveal-cards">
      ${cards.map(c => `
        <div class="sim-hand-reveal-card">
          ${c.image
            ? `<img src="${c.image}" alt="${c.name}" class="sim-card-img" draggable="false">`
            : `<div class="sim-card-back-inner"></div>`}
          <div class="sim-hand-reveal-name">${c.name}</div>
        </div>
      `).join("")}
      ${cards.length === 0 ? `<div class="sim-hand-reveal-empty">No cards in hand</div>` : ""}
    </div>
  `;

  popup.style.display = "flex";

  popup.querySelector("#simHandRevealClose")?.addEventListener("click", () => {
    popup.style.display = "none";
  });
}

export function showDisconnectBanner() {
  const root = document.getElementById("simRoot");
  if (!root) return;
  const ban = document.createElement("div");
  ban.className = "sim-disconnect-banner";
  ban.textContent = "Opponent disconnected.";
  root.prepend(ban);
}

// Chiamata dal peer quando riceve un messaggio chat — lo salva nel log e ri-renderizza
export function appendChatMessage(rawMsg) {
  import('./game-state.js').then(({ log: logFn }) => {
    logFn(rawMsg);
    renderBoard();
  });
}

// ── Log formatting ────────────────────────────────────────────

function _formatLogEntry(raw) {
  const myName  = GameState.username    || (GameState.myRole ? GameState.myRole.toUpperCase() : "P1");
  const oppName = GameState.oppUsername || (GameState.myRole ? getOpponentRole(GameState.myRole).toUpperCase() : "P2");
  const p1Name  = GameState.myRole === "p1" ? myName : oppName;
  const p2Name  = GameState.myRole === "p2" ? myName : oppName;

  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  function colorize(text) {
    // Sostituisce "p1"/"P1" e "p2"/"P2" con i nomi reali colorati
    text = text.replace(/\bp1\b|\bP1\b/g, `<span class="log-p1">${p1Name}</span>`);
    text = text.replace(/\bp2\b|\bP2\b/g, `<span class="log-p2">${p2Name}</span>`);
    // Colora anche il nome diretto se già presente
    if (p1Name && !/p1|P1/.test(p1Name))
      text = text.replace(new RegExp(esc(p1Name), "g"), `<span class="log-p1">${p1Name}</span>`);
    if (p2Name && p2Name !== p1Name && !/p2|P2/.test(p2Name))
      text = text.replace(new RegExp(esc(p2Name), "g"), `<span class="log-p2">${p2Name}</span>`);
    return text;
  }

  // Messaggi chat: "[CHAT] Nome: testo"
  if (raw.includes("[CHAT]")) {
    let text = raw.replace(/^\[LOG\|[^\]]+\]\s*/, "").replace("[CHAT] ", "");
    const colonIdx = text.indexOf(": ");
    if (colonIdx !== -1) {
      const sender = text.slice(0, colonIdx);
      const body   = text.slice(colonIdx + 2);
      const isMe   = sender === myName;
      const cls    = isMe ? "log-p1" : "log-p2";
      return `<span class="${cls}">${sender}</span>: ${body}`;
    }
    return colorize(text);
  }

  // Messaggi log normali: "[LOG|timestamp] testo"
  let text = raw.replace(/^\[LOG\|[^\]]+\]\s*/, "");
  return `<span class="log-tag">[LOG]</span> ${colorize(text)}`;
}

// ── Top bar ───────────────────────────────────────────────────

function _renderTopBar() {
  const my       = GameState.myRole;
  const isMyTurn = GameState.activeRole === my;
  const phase    = GameState.phase;
  const phases   = ["prep","start","play","end"];

  return `
    <div class="sim-topbar">
      <button class="secondary-btn sim-exit-btn" id="simExitBtn">← Exit</button>

      <div class="sim-phase-btns">
        ${phases.map(p => `
          <button class="sim-phase-btn ${phase === p ? "sim-phase-btn--active" : ""}"
                  data-phase="${p}" ${!isMyTurn ? "disabled" : ""}>
            ${p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        `).join("")}
      </div>

      <!-- Bottone mute suoni -->
      <button class="sim-mute-btn" id="simMuteBtn" title="Toggle sound">${isMuted() ? "🔇" : "🔊"}</button>

      <!-- Toolbar utility: dado, moneta, fish counter, token -->
      <div class="sim-utility-bar">
        <button class="sim-utility-btn" id="simRollDice" title="Roll d6">🎲 Dice</button>
        <button class="sim-utility-btn" id="simFlipCoin" title="Flip coin">🪙 Coin</button>
        <!-- Fish counter: draggabile verso carte per aggiungere counter -->
        <div class="sim-fish-token" id="simFishToken"
             draggable="true" title="Drag onto a card to add a counter. Drag counter off a card to remove.">
            ⛃
          <span class="sim-fish-label">Counter</span>
        </div>
        <button class="sim-utility-btn" id="simCreateToken" title="Create token">✦ Token</button>
      </div>

      <div class="sim-turn-indicator ${isMyTurn ? "sim-turn--mine" : "sim-turn--opp"}"
           id="simTurnIndicator">
        ${isMyTurn ? "Your Turn" : "Opponent's Turn"}
      </div>

      <button class="danger-btn sim-endturn-btn" id="simEndTurnBtn" ${!isMyTurn ? "disabled" : ""}>
        End Turn
      </button>

      <button class="sim-utility-btn sim-undo-btn" id="simUndoBtn" title="Undo last action">↩ Undo</button>
    </div>
  `;
}

// ── Mano avversario — contatore esteso con mano e mazzo ──────

function _renderOppHandCards(player, role) {
  const hand = player.hand.length;
  const deck = player.deck.length;
  return `
    <div class="sim-opp-hand-info">
      Your opponent has <strong>${hand}</strong> card${hand !== 1 ? "s" : ""} in hand
      and <strong>${deck}</strong> card${deck !== 1 ? "s" : ""} in the deck.
    </div>
  `;
}

// ── Half board (campo avversario / giocatore) ─────────────────
// Struttura: left (commander + territory deck) | center (field + quest)
// La colonna destra è rimossa: vita/deck/grave/banished → sidebar o territory row

function _renderHalf(player, role, flipped) {
  if (flipped) {
    // Half avversario: commander | field + quest (speculare, NO rotazione 180°)
    return `
      <div class="sim-half-inner sim-half-inner--flipped">
        <div class="sim-col-left">
          ${_renderCommanderZone(player, role)}
        </div>
        <div class="sim-col-center">
          <div class="sim-field-row">
            ${_renderPrimaryZone(player, role)}
            ${_renderTertiaryZone(player, role)}
          </div>
        </div>
      </div>
    `;
  }

  // Half giocatore: commander | quest + field | deck
  return `
    <div class="sim-half-inner">
      <div class="sim-col-left">
        ${_renderCommanderZone(player, role)}
      </div>
      <div class="sim-col-center">
        <div class="sim-field-row">
          ${_renderTertiaryZone(player, role)}
          ${_renderPrimaryZone(player, role)}
        </div>
      </div>
      <!-- Colonna destra: mazzo principale -->
      <div class="sim-col-right-deck">
        ${_renderMainDeckZone(player, role)}
      </div>
    </div>
  `;
}

// ── Zona territorio completa (fascia bassa) ───────────────────
// 75% territory cards | 25% sudden (3 slot) | graveyard | banished

function _renderTerritoryRow(player, role, flipped) {
  return `
    <div class="sim-terr-row-inner">

      <!-- Territory Deck (spostato qui dalla colonna sinistra) -->
      ${_renderTerritoryDeckZone(player, role, flipped)}

      <!-- Carte territorio in gioco (zona centrale, flex:1) -->
      <div class="sim-zone sim-terr-zone-main" data-zone="territoryZone" data-role="${role}">
        <div class="sim-zone-label">Territory Zone</div>
        <div class="sim-zone-cards sim-zone-cards--horiz">
          ${player.territoryZone.map(c => _renderCardEl(c, "territoryZone", role)).join("")}
          ${_renderDropTarget("territoryZone", role)}
          ${player.territoryZone.length === 0
            ? `<div class="sim-zone-empty">No territories in play</div>` : ""}
        </div>
      </div>

      <!-- Face-down: 3 slot fissi -->
      ${_renderSecondaryZone(player, role)}

      <!-- Cimitero -->
      ${_renderPileZone(player.graveyard, "graveyard", role, "Graveyard")}

      <!-- Esilio -->
      ${_renderPileZone(player.banished, "banished", role, "Banished")}

    </div>
  `;
}

// ── Zone renderers ────────────────────────────────────────────

function _renderCommanderZone(player, role) {
  const c = player.commanderCard;
  return `
    <div class="sim-zone sim-zone--commander" data-zone="commanderCard" data-role="${role}">
      <div class="sim-zone-label">Commander</div>
      ${c ? _renderCardEl(c, "commanderCard", role) : `<div class="sim-zone-empty">—</div>`}
    </div>
  `;
}

function _renderTerritoryDeckZone(player, role, isOpp) {
  const count   = player.territoryDeck.length;
  const canPlay = !isOpp && GameState.myRole === role;
  return `
    <div class="sim-zone sim-zone--terrdeckwrap"
         data-zone="territoryDeck" data-role="${role}"
         ${canPlay ? `data-terrplay="${role}" title="Right-click to play territory"` : ""}>
      <div class="sim-zone-label">Territory Deck</div>
      <div class="sim-zone-count">${count}</div>
      ${count > 0 ? `<div class="sim-card sim-card--back sim-card--pile"></div>` : ""}
    </div>
  `;
}

// Mazzo principale nel campo del giocatore (colonna destra del half)
function _renderMainDeckZone(player, role) {
  const count  = player.deck.length;
  const isOwn  = GameState.myRole === role;
  return `
    <div class="sim-zone sim-zone--maindeck" data-zone="deck" data-role="${role}"
         ${isOwn ? `data-maindeck="${role}" title="Right-click to mill"` : `title="Main Deck: ${count} cards"`}>
      <div class="sim-zone-label">Deck</div>
      <div class="sim-zone-count">${count}</div>
      ${count > 0 ? `<div class="sim-card sim-card--back sim-card--pile"></div>` : ""}
    </div>
  `;
}

function _renderPrimaryZone(player, role) {
  return `
    <div class="sim-zone sim-zone--primary" data-zone="primaryZone" data-role="${role}">
      <div class="sim-zone-label">Field</div>
      <div class="sim-zone-cards">
        ${player.primaryZone.map(c => _renderCardEl(c, "primaryZone", role)).join("")}
        ${_renderDropTarget("primaryZone", role)}
      </div>
    </div>
  `;
}

// Sudden zone: fascia territorio, 3 slot face-down
function _renderSecondaryZone(player, role) {
  const cards  = player.secondaryZone;
  const count  = cards.length;
  const isOwn  = GameState.myRole === role;

  // Renderizza 3 slot fissi
  const slots = [0, 1, 2].map(i => {
    const card = cards[i];
    if (card) {
      return `
        <div class="sim-sudden-slot sim-sudden-slot--filled">
          ${isOwn
            ? `<div class="sim-card sim-card--back sim-card--sudden-face sim-sudden-stack"
                    data-instance="${card.instanceId}"
                    data-zone="secondaryZone"
                    data-role="${role}"
                    data-sudden-index="${i}"
                    title="Click to activate or return to hand">
               </div>`
            : `<div class="sim-card sim-card--back"></div>`}
        </div>`;
    }
    return `
      <div class="sim-sudden-slot ${isOwn ? "sim-sudden-slot--empty" : ""}">
        ${isOwn ? _renderDropTarget("secondaryZone", role) : `<div class="sim-card-placeholder"></div>`}
      </div>`;
  }).join("");

  return `
    <div class="sim-zone sim-zone--secondary" data-zone="secondaryZone" data-role="${role}">
      <div class="sim-zone-label">Face-down (${count}/3)</div>
      <div class="sim-sudden-slots">
        ${slots}
      </div>
    </div>
  `;
}

function _renderTertiaryZone(player, role) {
  return `
    <div class="sim-zone sim-zone--tertiary" data-zone="tertiaryZone" data-role="${role}">
      <div class="sim-zone-label">Quests</div>
      <div class="sim-zone-cards">
        ${player.tertiaryZone.map(c => _renderCardEl(c, "tertiaryZone", role)).join("")}
        ${_renderDropTarget("tertiaryZone", role)}
      </div>
    </div>
  `;
}

// Pile zone (graveyard / banished) — mostra carta in cima, cliccabile per popup
function _renderPileZone(pile, zone, role, label) {
  const top = pile.length ? pile[pile.length - 1] : null;
  return `
    <div class="sim-zone sim-zone--pile" data-zone="${zone}" data-role="${role}"
         data-pile-open="${zone}" data-pile-role="${role}" data-pile-label="${label}"
         title="Click to view all ${label} cards" style="cursor:pointer">
      <div class="sim-zone-label">${label} (${pile.length})</div>
      ${top ? _renderCardEl(top, zone, role) : `<div class="sim-zone-empty">empty</div>`}
    </div>
  `;
}

function _renderDropTarget(zone, role) {
  return `<div class="sim-drop-target" data-zone="${zone}" data-role="${role}"></div>`;
}

// ── Pannello laterale destro ──────────────────────────────────
// Struttura: area avversario (deck + vita) | log | area mia (deck + vita)

function _renderSidebar(myP, my, oppP, opp) {
  return `
    <!-- Info avversario: HP + mano/deck compatti -->
    <div class="sim-sidebar-opp-info" id="oppHandZone">
      <div class="sim-opp-life-badge">
        <span class="sim-opp-life-label">HP</span>
        <span class="sim-opp-life-val" id="oppLifeVal">${oppP.life}</span>
      </div>
      <div class="sim-sidebar-opp-counts">
        Hand: <strong>${oppP.hand.length}</strong> &nbsp;|&nbsp; Deck: <strong>${oppP.deck.length}</strong>
      </div>
    </div>

    <!-- Preview carta hoverata -->
    <div class="sim-sidebar-preview" id="simSidebarPreview">
      <div class="sim-sidebar-preview-empty">Hover a card to preview</div>
    </div>

    <!-- Log + chat -->
    <div class="sim-log" id="simLog">
      <div class="sim-log-title">Log</div>
      <div class="sim-log-entries" id="simLogEntries">
        ${GameState.log.map(l => `<div class="sim-log-entry">${_formatLogEntry(l)}</div>`).join("")}
      </div>
      <div class="sim-chat-input-row">
        <input class="sim-chat-input" id="simChatInput" type="text" placeholder="Chat…" maxlength="200">
        <button class="sim-chat-send-btn" id="simChatSendBtn">↵</button>
      </div>
    </div>
  `;
}

// Mazzo principale nella sidebar (con contatore)
function _renderSidebarDeck(player, role) {
  const count = player.deck.length;
  return `
    <div class="sim-zone sim-zone--deck" title="Main Deck: ${count} cards"
         data-zone="deck" data-role="${role}">
      <div class="sim-zone-label">Deck</div>
      <div class="sim-zone-count">${count}</div>
      ${count > 0 ? `<div class="sim-card sim-card--back sim-card--pile"></div>` : ""}
    </div>
  `;
}

// Life box — layout verticale: [+] in alto, valore al centro, [−] in basso
function _renderLifeBox(player, role) {
  const isOwn = GameState.myRole === role;
  const color = role === "p1" ? "blue" : "red";
  return `
    <div class="sim-life-box sim-life-box--${color}">
      ${isOwn ? `<button class="sim-life-btn sim-life-btn--plus" data-role="${role}" data-delta="1">+</button>` : `<div class="sim-life-btn-placeholder"></div>`}
      <div class="sim-life-value" id="lifeVal-${role}">${player.life}</div>
      ${isOwn ? `<button class="sim-life-btn sim-life-btn--minus" data-role="${role}" data-delta="-1">−</button>` : `<div class="sim-life-btn-placeholder"></div>`}
    </div>
  `;
}

// ── Hand bar ──────────────────────────────────────────────────

function _renderHandBar(player, role) {
  const isMyTurn = GameState.activeRole === role;
  return `
    <div class="sim-hand-inner">
      <div class="sim-hand-label-col">
        <div class="sim-hand-label">Hand (${player.hand.length})</div>
        <button class="sim-show-hand-btn" id="simShowHandBtn">Show</button>
      </div>
      <div class="sim-hand-cards" id="simHandCards">
        ${player.hand.map(c => _renderHandCard(c, role)).join("")}
      </div>
      <div class="sim-hand-actions">
        <!-- Widget vita nella handbar -->
        <div class="sim-hand-life">
          <button class="sim-hand-life-btn" id="simLifeMinus" data-role="${role}" data-delta="-1">−</button>
          <div class="sim-hand-life-display">
            <span class="sim-hand-life-label">HP</span>
            <input class="sim-hand-life-input" id="simLifeInput"
                   type="number" min="0" max="999"
                   value="${player.life}" data-role="${role}">
          </div>
          <button class="sim-hand-life-btn" id="simLifePlus" data-role="${role}" data-delta="1">+</button>
        </div>
        <button class="secondary-btn" id="simDrawBtn">Draw</button>
      </div>
    </div>
  `;
}

function _renderHandCard(card, role) {
  return `
    <div class="sim-card sim-card--hand sim-card--${card.type}"
         data-instance="${card.instanceId}"
         data-zone="hand"
         data-role="${role}"
         draggable="true"
         title="${card.name}">
      ${card.image
        ? `<img src="${card.image}" alt="${card.name}" class="sim-card-img" draggable="false">`
        : `<div class="sim-card-back-inner"></div>`}
    </div>
  `;
}

// ── Card element ──────────────────────────────────────────────

function _renderCardEl(card, zone, role, forceShowFace = false) {
  const isOwn    = card.owner === GameState.myRole;
  const showFace = forceShowFace || card.faceUp || isOwn;
  const rotStyle = card.rotation ? `style="transform:rotate(${card.rotation}deg)"` : "";
  const typeClass = `sim-card--${card.type}`;
  const showDamage = zone === "primaryZone" && card.type === "minion";
  const dmg = card.damage || 0;

  return `
    <div class="sim-card-wrap">
      <div class="sim-card ${typeClass} ${!showFace ? "sim-card--back" : ""} ${card.rotation ? "sim-card--rotated" : ""}"
           data-instance="${card.instanceId}"
           data-zone="${zone}"
           data-role="${role}"
           draggable="${isOwn}"
           title="${showFace ? card.name : "Face-down card"}"
           ${rotStyle}>
        ${showFace && card.image
          ? `<img src="${card.image}" alt="${card.name}" class="sim-card-img" draggable="false">`
          : `<div class="sim-card-back-inner"></div>`}
        ${dmg > 0 ? `<div class="sim-damage-counter">${dmg}</div>` : ""}
        ${(card.counters || 0) > 0 ? `
          <div class="sim-fish-counter" data-instance="${card.instanceId}" data-zone="${zone}" data-role="${role}"
               draggable="true" title="Drag off this card to remove a counter">
            ⛃${card.counters > 1 ? `<span class="sim-fish-counter-num">${card.counters}</span>` : ""}
          </div>` : ""}
        ${showDamage && isOwn ? `
          <div class="sim-damage-btns">
            <button class="sim-dmg-btn sim-dmg-btn--minus" data-instance="${card.instanceId}" data-dmg="-1">−</button>
            <button class="sim-dmg-btn sim-dmg-btn--plus"  data-instance="${card.instanceId}" data-dmg="1">+</button>
          </div>
        ` : ""}
      </div>
    </div>
  `;
}

// ── Event wiring ──────────────────────────────────────────────

function _attachEvents() {
  const my = GameState.myRole;

  document.getElementById("simExitBtn")?.addEventListener("click", () => {
    document.body.classList.remove("sim-active");
    import('./play-menu.js').then(m => m.renderPlayScreen());
  });

  document.querySelectorAll(".sim-phase-btn").forEach(btn => {
    btn.addEventListener("click", () => setPhase(btn.dataset.phase));
  });

  document.getElementById("simEndTurnBtn")?.addEventListener("click", () => {
    if (GameState.activeRole === my) endTurn();
  });

  document.getElementById("simDrawBtn")?.addEventListener("click", () => {
    drawOne(my);
  });

  // Bottone mute suoni
  document.getElementById("simMuteBtn")?.addEventListener("click", () => {
    const muted = toggleMute();
    const btn = document.getElementById("simMuteBtn");
    if (btn) btn.textContent = muted ? "🔇" : "🔊";
  });

  // Utility bar: dado, moneta, token
  document.getElementById("simRollDice")?.addEventListener("click", () => {
    playSound("dice-roll");
    const roll = Math.floor(Math.random() * 6) + 1;
    import('./game-state.js').then(({ log: logFn, displayName: dn, GameState: GS }) => {
      logFn(`${dn(GS.myRole)} rolled a d6: ${roll}.`);
      import('./networking.js').then(({ broadcastSnapshot: bs }) => bs());
      renderBoard();
    });
  });
  document.getElementById("simFlipCoin")?.addEventListener("click", () => {
    playSound("coin-flip");
    const result = Math.random() < 0.5 ? "Heads" : "Tails";
    import('./game-state.js').then(({ log: logFn, displayName: dn, GameState: GS }) => {
      logFn(`${dn(GS.myRole)} flipped a coin: ${result}.`);
      import('./networking.js').then(({ broadcastSnapshot: bs }) => bs());
      renderBoard();
    });
  });
  document.getElementById("simCreateToken")?.addEventListener("click", () => {
    // placeholder — funzionalità token da implementare in futuro
  });

  // ── Fish counter drag ─────────────────────────────────────────
  // La fish nella toolbar: dragstart setta tipo "fish-add"
  const fishToken = document.getElementById("simFishToken");
  if (fishToken) {
    fishToken.addEventListener("dragstart", e => {
      e.dataTransfer.setData("text/plain", "fish-add");
      e.dataTransfer.effectAllowed = "copy";
    });
  }

  // I counter già sulla carta: dragstart setta tipo "fish-remove" + instanceId
  document.querySelectorAll(".sim-fish-counter[draggable='true']").forEach(el => {
    el.addEventListener("dragstart", e => {
      e.stopPropagation();
      e.dataTransfer.setData("text/plain", `fish-remove:${el.dataset.instance}`);
      e.dataTransfer.effectAllowed = "move";
    });
  });

  // Le carte nel field: drop zone per fish-add e fish-remove
  document.querySelectorAll(".sim-card[data-zone='primaryZone']").forEach(cardEl => {
    cardEl.addEventListener("dragover", e => {
      if (["fish-add", "fish-remove"].some(k =>
          e.dataTransfer.types.includes("text/plain") || true)) {
        e.preventDefault();
        cardEl.classList.add("sim-fish-drag-over");
      }
    });
    cardEl.addEventListener("dragleave", () => {
      cardEl.classList.remove("sim-fish-drag-over");
    });
    cardEl.addEventListener("drop", e => {
      cardEl.classList.remove("sim-fish-drag-over");
      const raw = e.dataTransfer.getData("text/plain");
      if (raw === "fish-add") {
        e.preventDefault();
        e.stopPropagation();
        const instanceId = cardEl.dataset.instance;
        if (instanceId) { playSound("counter-add"); addCounter(instanceId, 1); }
      }
    });
  });

  // Drop su qualsiasi zona NON-carta rimuove counter (se si trascina una fish dalla carta)
  document.getElementById("simRoot")?.addEventListener("drop", e => {
    const raw = e.dataTransfer.getData("text/plain");
    if (raw && raw.startsWith("fish-remove:")) {
      e.preventDefault();
      const instanceId = raw.split(":")[1];
      if (instanceId) addCounter(instanceId, -1);
    }
  });
  document.getElementById("simRoot")?.addEventListener("dragover", e => {
    const types = e.dataTransfer.types;
    if (types && types.includes && types.includes("text/plain")) e.preventDefault();
  });

  // Bottoni danno sui minion
  document.querySelectorAll(".sim-dmg-btn").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      addDamage(btn.dataset.instance, Number(btn.dataset.dmg));
    });
  });

  // Widget vita nella handbar: + e - applicano il delta, input imposta il valore diretto
  document.getElementById("simLifePlus")?.addEventListener("click", () => {
    adjustLife(my, 1);
  });
  document.getElementById("simLifeMinus")?.addEventListener("click", () => {
    adjustLife(my, -1);
  });
  document.getElementById("simLifeInput")?.addEventListener("change", e => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val >= 0) {
      import('./card-actions.js').then(({ setLifePoints }) => setLifePoints(my, val));
    }
  });

  // Territory deck: tasto destro → context menu "Play territory"
  document.querySelectorAll("[data-terrplay]").forEach(el => {
    el.addEventListener("contextmenu", e => {
      e.preventDefault();
      e.stopPropagation();
      const role = el.dataset.terrplay;
      const player = getPlayer(role);
      if (!player.territoryDeck.length) return;
      _showTerritoryCtxMenu(e.clientX, e.clientY, role);
    });
  });

  // Main deck: tasto destro → context menu "Mill"
  document.querySelectorAll("[data-maindeck]").forEach(el => {
    el.addEventListener("contextmenu", e => {
      e.preventDefault();
      e.stopPropagation();
      _showMainDeckCtxMenu(e.clientX, e.clientY, el.dataset.maindeck);
    });
  });

  // Life +/- buttons
  document.querySelectorAll(".sim-life-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      adjustLife(btn.dataset.role, Number(btn.dataset.delta));
    });
  });

  // Show hand: chiede conferma prima di inviare la mano all'avversario
  document.getElementById("simShowHandBtn")?.addEventListener("click", () => {
    _openShowHandConfirm(my);
  });

  // Sudden slot click (singola carta) → apre popup con opzioni attiva / ritorna in mano
  document.querySelectorAll(".sim-sudden-stack").forEach(el => {
    el.addEventListener("click", e => {
      e.stopPropagation();
      _openSuddenCardPopup(el.dataset.instance, el.dataset.role);
    });
  });

  // Pile zone click → apre popup con tutte le carte
  document.querySelectorAll("[data-pile-open]").forEach(el => {
    el.addEventListener("click", e => {
      if (e.target.closest(".sim-ctx-menu")) return;
      _openPilePopup(el.dataset.pileRole, el.dataset.pileOpen, el.dataset.pileLabel);
    });
  });

  // Card right-click → context menu
  document.querySelectorAll("[data-instance]").forEach(el => {
    el.addEventListener("contextmenu", e => {
      e.preventDefault();
      _ctxMenu = { instanceId: el.dataset.instance, zone: el.dataset.zone,
                   x: e.clientX, y: e.clientY };
      _renderCtxMenu();
    });

    el.addEventListener("mouseenter", () => _showPreview(el.dataset.instance, el.dataset.role));
    el.addEventListener("mouseleave", () => _hidePreview());
  });

  // Global click → close ctx menu + sudden popup + pile popup
  document.getElementById("simRoot")?.addEventListener("click", e => {
    if (!e.target.closest(".sim-ctx-menu")) closeContextMenu();
    if (!e.target.closest(".sim-sudden-popup") && !e.target.closest(".sim-sudden-stack")) {
      _closeSuddenPopup();
    }
    if (!e.target.closest(".sim-pile-popup") && !e.target.closest("[data-pile-open]")) {
      _closePilePopup();
    }
  });

  // Chat send — il messaggio va in GameState.log (sopravvive ai re-render) e viene trasmesso
  const chatInput = document.getElementById("simChatInput");
  const chatBtn   = document.getElementById("simChatSendBtn");
  const sendChat  = () => {
    const msg = chatInput?.value.trim();
    if (!msg) return;
    const name = GameState.username || my.toUpperCase();
    const entry = `[CHAT] ${name}: ${msg}`;
    import('./game-state.js').then(({ log: logFn }) => {
      logFn(entry);
      broadcastChat(entry);
      renderBoard();
    });
    chatInput.value = "";
  };
  chatBtn?.addEventListener("click", sendChat);
  chatInput?.addEventListener("keydown", e => { if (e.key === "Enter") sendChat(); });

  // Undo button
  document.getElementById("simUndoBtn")?.addEventListener("click", () => {
    import('./card-actions.js').then(({ undoLastAction }) => undoLastAction());
  });

  _attachDragDrop();
  _attachAttackMode();
}

// ── Drag & Drop ───────────────────────────────────────────────

function _attachDragDrop() {
  const my = GameState.myRole;

  document.querySelectorAll("[data-instance][draggable='true']").forEach(el => {
    el.addEventListener("dragstart", e => {
      const found = _findCardGlobally(el.dataset.instance);
      if (!found || found.card.owner !== my) { e.preventDefault(); return; }
      e.dataTransfer.setData("text/plain", el.dataset.instance);
      GameState.dragging = {
        card:     found.card,
        fromZone: el.dataset.zone,
        fromRole: el.dataset.role,
      };
    });
    el.addEventListener("dragend", () => { GameState.dragging = null; });
  });

  document.querySelectorAll("[data-zone]").forEach(el => {
    el.addEventListener("dragover",  e  => { e.preventDefault(); el.classList.add("sim-drag-over"); });
    el.addEventListener("dragleave", () => { el.classList.remove("sim-drag-over"); });
    el.addEventListener("drop", e => {
      e.preventDefault();
      el.classList.remove("sim-drag-over");
      const instanceId = e.dataTransfer.getData("text/plain");
      const targetZone = el.dataset.zone;
      const targetRole = el.dataset.role;
      if (!instanceId || !targetZone || !targetRole) return;
      // Drag da mano a territory deck → va in fondo al main deck e si evoca una terra
      if (targetZone === "territoryDeck") {
        import('./card-actions.js').then(({ sendHandToBottomDeckAndPlayTerritory }) => {
          sendHandToBottomDeckAndPlayTerritory(instanceId, el.dataset.role);
        });
        return;
      }
      endDrag(instanceId, targetZone, targetRole);
    });
  });
}

// ── Attack mode (freccia SVG) ─────────────────────────────────

function _attachAttackMode() {
  // Aggiorna il riferimento al line element (il DOM viene ricreato ad ogni render)
  window._startAttackMode = (instanceId, attackerName) => {
    const cardEl = document.querySelector(`[data-instance="${instanceId}"][data-zone="primaryZone"]`);
    if (!cardEl) return;
    const rect = cardEl.getBoundingClientRect();
    const sx = rect.left + rect.width  / 2;
    const sy = rect.top  + rect.height / 2;

    _attackState = { attackerId: instanceId, attackerName, sx, sy };
    const svg  = document.getElementById("simAttackSvg");
    const line = document.getElementById("simAttackLine");
    if (svg)  svg.style.display = "block";
    if (line) {
      line.setAttribute("x1", sx); line.setAttribute("y1", sy);
      line.setAttribute("x2", sx); line.setAttribute("y2", sy);
    }
    document.body.style.cursor = "crosshair";
  };

  // I listener globali vengono aggiunti una sola volta
  if (_attackListenersAttached) return;
  _attackListenersAttached = true;

  document.addEventListener("mousemove", e => {
    if (!_attackState) return;
    const line = document.getElementById("simAttackLine");
    if (line) { line.setAttribute("x2", e.clientX); line.setAttribute("y2", e.clientY); }
  }, { capture: true });

  document.addEventListener("click", e => {
    if (!_attackState) return;

    // Click su HP avversario (span valore, badge intero, o zona hp opp)
    const oppHpZone = document.getElementById("oppHandZone");
    const oppBadge = oppHpZone?.querySelector(".sim-opp-life-badge");
    if (oppBadge && (oppBadge === e.target || oppBadge.contains(e.target))) {
      e.stopPropagation();
      const snap = { ..._attackState };
      _cancelAttackMode();
      import('./card-actions.js').then(({ logAttackOnOpponent }) => {
        logAttackOnOpponent(snap.attackerId, snap.attackerName);
      });
      return;
    }

    // Click su minion avversario
    const targetCard = e.target.closest("[data-instance][data-zone='primaryZone']");
    if (targetCard) {
      const targetRole = targetCard.dataset.role;
      if (targetRole !== GameState.myRole) {
        const snap = { ..._attackState };
        _cancelAttackMode();
        import('./card-actions.js').then(({ logAttackOnMinion }) => {
          logAttackOnMinion(snap.attackerId, snap.attackerName, targetCard.dataset.instance);
        });
        return;
      }
    }

    // Click altrove → annulla
    _cancelAttackMode();
  }, { capture: true });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && _attackState) _cancelAttackMode();
  });
}

function _cancelAttackMode() {
  _attackState = null;
  const svg = document.getElementById("simAttackSvg");
  if (svg) svg.style.display = "none";
  document.body.style.cursor = "";
}

// ── Show hand confirm popup ───────────────────────────────────

function _openShowHandConfirm(role) {
  const popup = document.getElementById("simShowHandConfirm");
  if (!popup) return;
  popup.style.display = "flex";

  document.getElementById("simShowHandYes")?.addEventListener("click", () => {
    popup.style.display = "none";
    import('./networking.js').then(({ broadcastShowHand }) => {
      broadcastShowHand(getPlayer(role).hand);
    });
  }, { once: true });

  document.getElementById("simShowHandNo")?.addEventListener("click", () => {
    popup.style.display = "none";
  }, { once: true });
}

// ── Sudden popup (singola carta) ──────────────────────────────
// Click su una carta sudden specifica → opzioni: Activate / Return to hand

function _openSuddenCardPopup(instanceId, role) {
  const player = getPlayer(role);
  const isOwn  = GameState.myRole === role;
  const card   = player.secondaryZone.find(c => c.instanceId === instanceId);
  if (!card || !isOwn) return;

  const popup = document.getElementById("simSuddenPopup");
  if (!popup) return;

  popup.innerHTML = `
    <div class="sim-sudden-popup-title">Sudden — ${card.name}</div>
    <div class="sim-sudden-popup-cards">
      <div class="sim-sudden-popup-card">
        ${_renderCardEl(card, "secondaryZone", role, true)}
        <button class="sim-sudden-activate-btn" data-instance="${card.instanceId}">Activate</button>
        <button class="sim-sudden-return-btn" data-instance="${card.instanceId}">Return to hand</button>
      </div>
    </div>
    <button class="sim-sudden-popup-close" id="simSuddenClose">Close</button>
  `;

  popup.style.display = "flex";

  popup.querySelector(".sim-sudden-activate-btn")?.addEventListener("click", e => {
    e.stopPropagation();
    import('./card-actions.js').then(({ sendToGraveyard }) => {
      sendToGraveyard(card.instanceId);
      _closeSuddenPopup();
    });
  });

  popup.querySelector(".sim-sudden-return-btn")?.addEventListener("click", e => {
    e.stopPropagation();
    import('./card-actions.js').then(({ returnToHand }) => {
      returnToHand(card.instanceId);
      _closeSuddenPopup();
    });
  });

  popup.querySelector("#simSuddenClose")?.addEventListener("click", e => {
    e.stopPropagation();
    _closeSuddenPopup();
  });
}

function _closeSuddenPopup() {
  _suddenPopupRole = null;
  const popup = document.getElementById("simSuddenPopup");
  if (popup) popup.style.display = "none";
}

// ── Pile popup (graveyard / banished) ────────────────────────
// Mostra tutte le carte nell'ordine in cui sono state aggiunte

function _openPilePopup(role, zone, label) {
  const player = getPlayer(role);
  const pile   = player[zone];
  const popup  = document.getElementById("simPilePopup");
  if (!popup) return;

  popup.innerHTML = `
    <div class="sim-pile-popup-header">
      <span class="sim-pile-popup-title">${label} — ${role.toUpperCase()} (${pile.length})</span>
      <button class="sim-pile-popup-close" id="simPileClose">✕</button>
    </div>
    <div class="sim-pile-popup-cards">
      ${pile.length === 0
        ? `<div class="sim-pile-popup-empty">Empty</div>`
        : pile.map((c, i) => `
            <div class="sim-pile-popup-card">
              <div class="sim-pile-popup-index">${i + 1}</div>
              ${_renderCardEl(c, zone, role, true)}
              <div class="sim-pile-popup-name">${c.name}</div>
            </div>
          `).join("")}
    </div>
  `;

  popup.style.display = "flex";

  popup.querySelector("#simPileClose")?.addEventListener("click", e => {
    e.stopPropagation();
    _closePilePopup();
  });

  // Right-click on cards in pile popup
  popup.querySelectorAll("[data-instance]").forEach(el => {
    el.addEventListener("contextmenu", e => {
      e.preventDefault();
      _ctxMenu = { instanceId: el.dataset.instance, zone: el.dataset.zone,
                   x: e.clientX, y: e.clientY };
      _renderCtxMenu();
    });
    el.addEventListener("mouseenter", () => _showPreview(el.dataset.instance, el.dataset.role));
    el.addEventListener("mouseleave", () => _hidePreview());
  });
}

function _closePilePopup() {
  const popup = document.getElementById("simPilePopup");
  if (popup) popup.style.display = "none";
}

// ── Territory deck context menu ───────────────────────────────

function _showTerritoryCtxMenu(x, y, role) {
  _removeCtxDOM();
  const menu = document.createElement("div");
  menu.className = "sim-ctx-menu";
  menu.style.left = `${x}px`;
  menu.style.top  = `${y}px`;

  const header = document.createElement("div");
  header.className   = "sim-ctx-header";
  header.textContent = "Territory Deck";
  menu.appendChild(header);

  const btnPlay = document.createElement("button");
  btnPlay.className   = "sim-ctx-item";
  btnPlay.textContent = "Play territory";
  btnPlay.addEventListener("click", () => {
    playTerritory(role);
    _removeCtxDOM();
  });
  menu.appendChild(btnPlay);

  const btnMill = document.createElement("button");
  btnMill.className   = "sim-ctx-item";
  btnMill.textContent = "Mill";
  btnMill.addEventListener("click", () => {
    import('./card-actions.js').then(({ millTerritory }) => {
      millTerritory(role);
      _removeCtxDOM();
    });
  });
  menu.appendChild(btnMill);

  document.body.appendChild(menu);
  const rect = menu.getBoundingClientRect();
  if (rect.right  > window.innerWidth)  menu.style.left = `${window.innerWidth  - rect.width  - 8}px`;
  if (rect.bottom > window.innerHeight) menu.style.top  = `${window.innerHeight - rect.height - 8}px`;
}

// ── Main deck context menu ────────────────────────────────────

function _showMainDeckCtxMenu(x, y, role) {
  _removeCtxDOM();
  const menu = document.createElement("div");
  menu.className = "sim-ctx-menu";
  menu.style.left = `${x}px`;
  menu.style.top  = `${y}px`;

  const header = document.createElement("div");
  header.className   = "sim-ctx-header";
  header.textContent = "Main Deck";
  menu.appendChild(header);

  const btnMill = document.createElement("button");
  btnMill.className   = "sim-ctx-item";
  btnMill.textContent = "Mill";
  btnMill.addEventListener("click", () => {
    import('./card-actions.js').then(({ millMainDeck }) => {
      millMainDeck(role);
      _removeCtxDOM();
    });
  });
  menu.appendChild(btnMill);

  document.body.appendChild(menu);
  const rect = menu.getBoundingClientRect();
  if (rect.right  > window.innerWidth)  menu.style.left = `${window.innerWidth  - rect.width  - 8}px`;
  if (rect.bottom > window.innerHeight) menu.style.top  = `${window.innerHeight - rect.height - 8}px`;
}

// ── Context menu DOM ──────────────────────────────────────────

function _renderCtxMenu() {
  _removeCtxDOM();
  if (!_ctxMenu) return;

  const found = _findCardGlobally(_ctxMenu.instanceId);
  if (!found) return;

  const actions = getContextActions(found.card, _ctxMenu.zone);
  if (!actions.length) return;

  const menu = document.createElement("div");
  menu.className = "sim-ctx-menu";
  menu.style.left = `${_ctxMenu.x}px`;
  menu.style.top  = `${_ctxMenu.y}px`;

  const header = document.createElement("div");
  header.className   = "sim-ctx-header";
  header.textContent = found.card.name;
  menu.appendChild(header);

  actions.forEach(({ label, action }) => {
    const btn = document.createElement("button");
    btn.className   = "sim-ctx-item";
    btn.textContent = label;
    btn.addEventListener("click", () => { action(); });
    menu.appendChild(btn);
  });

  document.body.appendChild(menu);

  const rect = menu.getBoundingClientRect();
  if (rect.right  > window.innerWidth)  menu.style.left = `${window.innerWidth  - rect.width  - 8}px`;
  if (rect.bottom > window.innerHeight) menu.style.top  = `${window.innerHeight - rect.height - 8}px`;
}

function _removeCtxDOM() {
  document.querySelectorAll(".sim-ctx-menu").forEach(el => el.remove());
}

// ── Preview (hover) — aggiorna la sidebar, non nasconde mai ──

function _showPreview(instanceId, role) {
  const card = _findCardInPlayer(instanceId, role);
  if (!card) return;

  const isOwn = card.owner === GameState.myRole;
  if (!card.faceUp && !isOwn) return;

  const box = document.getElementById("simSidebarPreview");
  if (!box) return;
  box.innerHTML = card.image
    ? `<img src="${card.image}" alt="${card.name}" class="sim-sidebar-preview-img">`
    : `<div class="sim-sidebar-preview-name">${card.name}</div>`;
}

// Non nasconde — l'ultima carta rimane visibile fino al prossimo hover
function _hidePreview() {}

// ── Utility ───────────────────────────────────────────────────

function _findCardInPlayer(instanceId, role) {
  const p = GameState[role];
  if (!p) return null;
  const zones = ["deck","hand","graveyard","banished","primaryZone","secondaryZone","tertiaryZone","territoryDeck","territoryZone"];
  for (const z of zones) {
    if (!Array.isArray(p[z])) continue;
    const card = p[z].find(c => c.instanceId === instanceId);
    if (card) return card;
  }
  if (p.commanderCard?.instanceId === instanceId) return p.commanderCard;
  return null;
}

function _findCardGlobally(instanceId) {
  for (const role of ["p1","p2"]) {
    const p = GameState[role];
    const zones = ["deck","hand","graveyard","banished","primaryZone","secondaryZone","tertiaryZone","territoryDeck","territoryZone"];
    for (const z of zones) {
      if (!Array.isArray(p[z])) continue;
      const card = p[z].find(c => c.instanceId === instanceId);
      if (card) return { card, player: p, zone: z };
    }
    if (p.commanderCard?.instanceId === instanceId)
      return { card: p.commanderCard, player: p, zone: "commanderCard" };
  }
  return null;
}
