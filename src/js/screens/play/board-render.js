// ============================================================
// play/board-render.js — Full board UI rendering.
// Renders both halves, life totals, hand, phase buttons,
// territory deck, card preview, context menus, and log.
// ============================================================

import { GameState, getPlayer, getOpponentRole } from './game-state.js';
import { getContextActions, endDrag,
         setPhase, endTurn, adjustLife, setLifePoints,
         drawOne, playTerritory }                 from './card-actions.js';
import { broadcastSnapshot }                     from './networking.js';

// ── Context menu state ────────────────────────────────────────
let _ctxMenu   = null;  // { instanceId, x, y }
let _previewCard = null;

export function closeContextMenu() {
  _ctxMenu = null;
  _previewCard = null;
  _removeCtxDOM();
}

// ── Entry point ───────────────────────────────────────────────

export function renderBoard() {
  const screen = document.getElementById("screen-play");
  if (!screen || !screen.classList.contains("active")) return;

  const my   = GameState.myRole;
  const opp  = getOpponentRole(my);
  const myP  = getPlayer(my);
  const oppP = getPlayer(opp);

  // Orientation: my half is always at bottom, opponent at top.
  screen.innerHTML = `
    <div class="sim-root" id="simRoot">

      ${_renderTopBar()}

      <div class="sim-arena" id="simArena">

        <!-- Opponent half (top, flipped) -->
        <div class="sim-half sim-half--opp" id="halfOpp" data-role="${opp}">
          ${_renderHalf(oppP, opp, true)}
        </div>

        <!-- Divider line -->
        <div class="sim-divider"></div>

        <!-- My half (bottom) -->
        <div class="sim-half sim-half--own" id="halfOwn" data-role="${my}">
          ${_renderHalf(myP, my, false)}
        </div>

      </div>

      <!-- Hand bar at bottom -->
      <div class="sim-handbar">
        ${_renderHandBar(myP, my)}
      </div>

      <!-- Log panel -->
      <div class="sim-log" id="simLog">
        <div class="sim-log-title">Log</div>
        <div class="sim-log-entries">
          ${GameState.log.map(l => `<div class="sim-log-entry">${l}</div>`).join("")}
        </div>
      </div>

      <!-- Card preview -->
      <div class="sim-preview" id="simPreview" style="display:none"></div>

    </div>
  `;

  _attachEvents();
  _renderCtxMenu();
}

export function showDisconnectBanner() {
  const root = document.getElementById("simRoot");
  if (!root) return;
  const ban  = document.createElement("div");
  ban.className = "sim-disconnect-banner";
  ban.textContent = "Opponent disconnected.";
  root.prepend(ban);
}

// ── Top bar ───────────────────────────────────────────────────

function _renderTopBar() {
  const my       = GameState.myRole;
  const isMyTurn = GameState.activeRole === my;
  const phase    = GameState.phase;

  const phases = ["prep","start","play","end"];

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

      <div class="sim-turn-indicator ${isMyTurn ? "sim-turn--mine" : "sim-turn--opp"}"
           id="simTurnIndicator" title="Click to pass turn" style="cursor:pointer">
        ${isMyTurn ? "Your Turn" : "Opponent's Turn"}
      </div>

      <button class="danger-btn sim-endturn-btn" id="simEndTurnBtn" ${!isMyTurn ? "disabled" : ""}>
        End Turn
      </button>
    </div>
  `;
}

// ── Half board ────────────────────────────────────────────────

function _renderHalf(player, role, flipped) {
  const isOpp = flipped;
  return `
    <div class="sim-half-inner ${flipped ? "sim-half-inner--flipped" : ""}">

      <!-- Left column: deck, commander, territory deck -->
      <div class="sim-col-left">
        ${_renderDeckZone(player, role)}
        ${_renderCommanderZone(player, role)}
        ${_renderTerritoryDeckZone(player, role, isOpp)}
      </div>

      <!-- Centre: primary, secondary, tertiary zones -->
      <div class="sim-col-center">
        ${_renderPrimaryZone(player, role)}
        ${_renderSecondaryZone(player, role)}
        ${_renderTertiaryZone(player, role)}
      </div>

      <!-- Right column: life, graveyard, banished -->
      <div class="sim-col-right">
        ${_renderLifeBox(player, role)}
        ${_renderPileZone(player.graveyard, "graveyard", role, "Graveyard")}
        ${_renderPileZone(player.banished,  "banished",  role, "Banished")}
        ${isOpp ? _renderOppHandCount(player) : ""}
      </div>

    </div>

    <!-- Territory zone: full width strip below half -->
    <div class="sim-territory-strip" data-zone="territoryZone" data-role="${role}">
      ${_renderTerritoryZone(player, role)}
    </div>
  `;
}

// ── Zone renderers ────────────────────────────────────────────

function _renderDeckZone(player, role) {
  const count = player.deck.length;
  return `
    <div class="sim-zone sim-zone--deck" title="Main Deck: ${count} cards"
         data-zone="deck" data-role="${role}">
      <div class="sim-zone-label">Deck</div>
      <div class="sim-zone-count">${count}</div>
      ${count > 0 ? `<div class="sim-card sim-card--back"></div>` : ""}
    </div>
  `;
}

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
  const count = player.territoryDeck.length;
  const canPlay = !isOpp && GameState.myRole === role;
  return `
    <div class="sim-zone sim-zone--terrdeckwrap" data-zone="territoryDeck" data-role="${role}">
      <div class="sim-zone-label">Territory Deck</div>
      <div class="sim-zone-count">${count}</div>
      ${count > 0 ? `<div class="sim-card sim-card--back sim-card--terr"></div>` : ""}
      ${canPlay && count > 0 ? `
        <button class="sim-play-terr-btn" data-role="${role}">Play territory</button>
      ` : ""}
    </div>
  `;
}

function _renderLifeBox(player, role) {
  const isOwn = GameState.myRole === role;
  const color = role === "p1" ? "blue" : "red";
  return `
    <div class="sim-life-box sim-life-box--${color}">
      <div class="sim-life-name">${role.toUpperCase()}</div>
      <div class="sim-life-value" id="lifeVal-${role}">${player.life}</div>
      ${isOwn ? `
        <div class="sim-life-controls">
          <button class="sim-life-btn" data-role="${role}" data-delta="-1">−</button>
          <input  class="sim-life-input" type="number" value="${player.life}"
                  data-role="${role}" min="0" max="999">
          <button class="sim-life-btn" data-role="${role}" data-delta="1">+</button>
        </div>
      ` : ""}
    </div>
  `;
}

function _renderOppHandCount(player) {
  return `
    <div class="sim-zone sim-zone--handcount">
      <div class="sim-zone-label">Hand</div>
      <div class="sim-zone-count">${player.hand.length}</div>
      <div class="sim-opp-hand">
        ${player.hand.map(() => `<div class="sim-card sim-card--back sim-card--sm"></div>`).join("")}
      </div>
    </div>
  `;
}

function _renderPileZone(pile, zone, role, label) {
  const top = pile.length ? pile[pile.length - 1] : null;
  return `
    <div class="sim-zone sim-zone--pile" data-zone="${zone}" data-role="${role}">
      <div class="sim-zone-label">${label} (${pile.length})</div>
      ${top ? _renderCardEl(top, zone, role) : `<div class="sim-zone-empty">empty</div>`}
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

function _renderSecondaryZone(player, role) {
  const slots = 3;
  const filled = player.secondaryZone.slice(0, slots);
  return `
    <div class="sim-zone sim-zone--secondary" data-zone="secondaryZone" data-role="${role}">
      <div class="sim-zone-label">Sudden Zone (max 3)</div>
      <div class="sim-zone-cards">
        ${filled.map(c => _renderCardEl(c, "secondaryZone", role)).join("")}
        ${filled.length < slots ? _renderDropTarget("secondaryZone", role) : ""}
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

function _renderTerritoryZone(player, role) {
  if (!player.territoryZone.length) {
    return `<div class="sim-territory-empty">No territories in play</div>`;
  }
  return player.territoryZone.map(c => _renderCardEl(c, "territoryZone", role)).join("");
}

function _renderDropTarget(zone, role) {
  return `<div class="sim-drop-target" data-zone="${zone}" data-role="${role}"></div>`;
}

// ── Card element ──────────────────────────────────────────────

function _renderCardEl(card, zone, role) {
  const isOwn    = card.owner === GameState.myRole;
  const showFace = card.faceUp || isOwn;
  const rotStyle = card.rotation ? `style="transform:rotate(${card.rotation}deg)"` : "";
  const typeClass = `sim-card--${card.type}`;

  return `
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
    </div>
  `;
}

// ── Hand bar ──────────────────────────────────────────────────

function _renderHandBar(player, role) {
  const isMyTurn = GameState.activeRole === role;
  return `
    <div class="sim-hand-inner">
      <div class="sim-hand-label">Hand (${player.hand.length})</div>
      <div class="sim-hand-cards" id="simHandCards">
        ${player.hand.map(c => _renderHandCard(c, role)).join("")}
      </div>
      <div class="sim-hand-actions">
        <button class="secondary-btn" id="simDrawBtn" ${!isMyTurn ? "disabled" : ""}>Draw</button>
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

// ── Event wiring ──────────────────────────────────────────────

function _attachEvents() {
  const my = GameState.myRole;

  // Exit
  document.getElementById("simExitBtn")?.addEventListener("click", () => {
    import('./play-menu.js').then(m => m.renderPlayScreen());
  });

  // Phase buttons
  document.querySelectorAll(".sim-phase-btn").forEach(btn => {
    btn.addEventListener("click", () => setPhase(btn.dataset.phase));
  });

  // Turn indicator / end turn
  document.getElementById("simTurnIndicator")?.addEventListener("click", () => {
    if (GameState.activeRole === my) endTurn();
  });
  document.getElementById("simEndTurnBtn")?.addEventListener("click", () => {
    if (GameState.activeRole === my) endTurn();
  });

  // Draw
  document.getElementById("simDrawBtn")?.addEventListener("click", () => {
    if (GameState.activeRole === my) drawOne(my);
  });

  // Territory play buttons
  document.querySelectorAll(".sim-play-terr-btn").forEach(btn => {
    btn.addEventListener("click", () => playTerritory(btn.dataset.role));
  });

  // Life buttons
  document.querySelectorAll(".sim-life-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      adjustLife(btn.dataset.role, Number(btn.dataset.delta));
    });
  });

  // Life direct input
  document.querySelectorAll(".sim-life-input").forEach(input => {
    input.addEventListener("change", () => {
      setLifePoints(input.dataset.role, Number(input.value));
    });
  });

  // Card right-click → context menu
  document.querySelectorAll("[data-instance]").forEach(el => {
    el.addEventListener("contextmenu", e => {
      e.preventDefault();
      const instanceId = el.dataset.instance;
      const zone       = el.dataset.zone;
      _ctxMenu = { instanceId, zone, x: e.clientX, y: e.clientY };
      _renderCtxMenu();
    });

    // Hover preview
    el.addEventListener("mouseenter", e => {
      const instanceId = el.dataset.instance;
      _showPreview(instanceId, e);
    });
    el.addEventListener("mouseleave", () => _hidePreview());
  });

  // Global click → close ctx menu
  document.getElementById("simRoot")?.addEventListener("click", e => {
    if (!e.target.closest(".sim-ctx-menu")) {
      closeContextMenu();
    }
  });

  // Drag & drop
  _attachDragDrop();
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

  // Drop targets: zone containers
  document.querySelectorAll("[data-zone]").forEach(el => {
    el.addEventListener("dragover", e => { e.preventDefault(); el.classList.add("sim-drag-over"); });
    el.addEventListener("dragleave",() => { el.classList.remove("sim-drag-over"); });
    el.addEventListener("drop", e => {
      e.preventDefault();
      el.classList.remove("sim-drag-over");
      const instanceId = e.dataTransfer.getData("text/plain");
      const targetZone = el.dataset.zone;
      const targetRole = el.dataset.role;
      if (!instanceId || !targetZone || !targetRole) return;
      endDrag(instanceId, targetZone, targetRole);
    });
  });
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

  // Card name header
  const header = document.createElement("div");
  header.className = "sim-ctx-header";
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

  // Keep inside viewport
  const rect = menu.getBoundingClientRect();
  if (rect.right > window.innerWidth)  menu.style.left = `${window.innerWidth - rect.width - 8}px`;
  if (rect.bottom > window.innerHeight) menu.style.top = `${window.innerHeight - rect.height - 8}px`;
}

function _removeCtxDOM() {
  document.querySelectorAll(".sim-ctx-menu").forEach(el => el.remove());
}

// ── Preview ───────────────────────────────────────────────────

function _showPreview(instanceId, e) {
  const found = _findCardGlobally(instanceId);
  if (!found) return;
  const card = found.card;
  if (!card.faceUp && card.owner !== GameState.myRole) return;

  const box = document.getElementById("simPreview");
  if (!box) return;
  box.style.display = "block";
  box.innerHTML = card.image
    ? `<img src="${card.image}" alt="${card.name}">`
    : `<div class="sim-preview-name">${card.name}</div>`;
}

function _hidePreview() {
  const box = document.getElementById("simPreview");
  if (box) box.style.display = "none";
}

// ── Utility ───────────────────────────────────────────────────

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
