// ============================================================
// play/card-actions.js — Every card action the local player
// can take.
//
// Each exported function:
//   1. Mutates GameState directly via game-state helpers.
//   2. Broadcasts to peer via networking.
//   3. Re-renders the board.
//
// Circular-dependency note:
//   board-render  → card-actions (for action callbacks)
//   card-actions  → board-render (to re-render after mutation)
// Both files import each other — JS handles ESM circular refs
// fine as long as we don't call across the boundary at
// module-evaluation time (only inside functions). ✓
// ============================================================

import {
  GameState,
  getPlayer,
  drawCard          as _drawCard,
  moveCard          as _moveCard,
  toggleRotation    as _toggleRotation,
  changeLife        as _changeLife,
  setLife           as _setLife,
  setPhase          as _setPhase,
  toggleTurn        as _toggleTurn,
  playTerritoryCard as _playTerritory,
  displayName,
  log,
  getStateSnapshot,
  applyStateSnapshot,
} from './game-state.js';

import { broadcastAction, registerAction } from './networking.js';
import { playSound }                       from './sound.js';
// board-render is imported lazily inside functions to break the
// circular-at-eval-time issue.

// ── Sync wrapper ──────────────────────────────────────────────

function render() {
  // Deferred import — safe because board-render.js is already
  // loaded by the time any action fires.
  import('./board-render.js').then(m => m.renderBoard());
}

function closeMenu() {
  import('./board-render.js').then(m => m.closeContextMenu());
}

// Mappa azione → suono (solo le azioni locali, non il replay del peer)
const ACTION_SOUNDS = {
  summonCard:          "card-play",
  setCardSecondary:    "card-play",
  activateSpell:       "card-activate",
  activateQuest:       "card-play",
  sendToGraveyard:     "card-activate",
  banishCard:          "card-activate",
  topDeck:             "card-play",
  bottomDeck:          "card-play",
  returnToHand:        "card-draw",
  declareAttack:              "button",
  millTerritory:              "card-activate",
  millMainDeck:               "card-activate",
  sendHandToBottomDeckAndPlayTerritory: "card-play",
  logAttackOnMinion:          "button",
  logAttackOnOpponent:        "button",
  flipCardFaceUp:      "card-activate",
  sapCard:             "button",
  sapMinion:           "button",
  unsapMinion:         "button",
  dblClickSap:         "button",
  addDamage:           "counter-add",
  addCounter:          "counter-add",
  playTerritory:       "card-play",
  sapAllTerritories:   "button",
  unsapAllTerritories: "button",
  drawOne:             "card-draw",
  setPhase:            "button",
  notifyEndTurn:       "button",
  endTurn:             "button",
  adjustLife:          "life-change",
  setLifePoints:       "life-change",
  setTopCardToSudden:  "card-play",
};

// ── Undo stack ────────────────────────────────────────────────
// Salva snapshot dello stato prima di ogni azione locale (max 20)
const _undoStack = [];
const UNDO_MAX = 20;

function _pushUndo() {
  _undoStack.push(getStateSnapshot());
  if (_undoStack.length > UNDO_MAX) _undoStack.shift();
}

export function undoLastAction() {
  if (!_undoStack.length) { log("Nothing to undo."); render(); return; }
  const snap = _undoStack.pop();
  applyStateSnapshot(snap);
  log("Action undone.");
  render();
}

/**
 * Wrap a pure-mutation function so it:
 *   - Registers itself for peer replay via registerAction.
 *   - Returns a public function that also broadcasts + re-renders.
 */
function synced(name, localFn) {
  registerAction(name, (...args) => { localFn(...args); render(); });

  return (...args) => {
    _pushUndo();
    localFn(...args);
    broadcastAction(name, args);
    closeMenu();
    render();
    // Suono solo per chi esegue l'azione (non il peer replay)
    const sfx = ACTION_SOUNDS[name];
    if (sfx) playSound(sfx);
  };
}

// ── Internal helpers ──────────────────────────────────────────

function ownerOf(instanceId) {
  return findAny(instanceId)?.card.owner ?? GameState.myRole;
}

function findAny(instanceId) {
  for (const role of ["p1", "p2"]) {
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

function removeFromAny(instanceId) {
  for (const role of ["p1", "p2"]) {
    const p = GameState[role];
    const zones = ["deck","hand","graveyard","banished","primaryZone","secondaryZone","tertiaryZone","territoryDeck","territoryZone"];
    for (const z of zones) {
      if (!Array.isArray(p[z])) continue;
      const idx = p[z].findIndex(c => c.instanceId === instanceId);
      if (idx !== -1) { p[z].splice(idx, 1); return; }
    }
  }
}

// ── Card movement actions ─────────────────────────────────────

export const summonCard = synced("summonCard", (instanceId) => {
  _moveCard(instanceId, ownerOf(instanceId), "primaryZone", true);
});

export const setCardSecondary = synced("setCardSecondary", (instanceId) => {
  _moveCard(instanceId, ownerOf(instanceId), "secondaryZone", false);
});

export const activateSpell = synced("activateSpell", (instanceId) => {
  _shakeCard(instanceId);
  _moveCard(instanceId, ownerOf(instanceId), "graveyard", true);
  log("Spell activated and sent to graveyard.");
});

export const activateQuest = synced("activateQuest", (instanceId) => {
  _shakeCard(instanceId);
  _moveCard(instanceId, ownerOf(instanceId), "tertiaryZone", true);
});

export const sendToGraveyard = synced("sendToGraveyard", (instanceId) => {
  _shakeCard(instanceId);
  _moveCard(instanceId, ownerOf(instanceId), "graveyard", true);
});

export const banishCard = synced("banishCard", (instanceId) => {
  _moveCard(instanceId, ownerOf(instanceId), "banished", true);
});

export const topDeck = synced("topDeck", (instanceId) => {
  const found = findAny(instanceId);
  if (!found) return;
  const { card, player } = found;
  // Se la carta è un territorio, va in cima al territory deck
  if (card.type === "territory") {
    removeFromAny(instanceId);
    card.zone   = "territoryDeck";
    card.faceUp = false;
    player.territoryDeck.unshift(card);
    log(`${card.name} put on top of territory deck.`);
  } else {
    removeFromAny(instanceId);
    card.zone   = "deck";
    card.faceUp = false;
    player.deck.unshift(card);
    log(`${card.name} put on top of deck.`);
  }
});

export const bottomDeck = synced("bottomDeck", (instanceId) => {
  const found = findAny(instanceId);
  if (!found) return;
  const { card, player } = found;
  // Se la carta è un territorio, va in fondo al territory deck
  if (card.type === "territory") {
    removeFromAny(instanceId);
    card.zone   = "territoryDeck";
    card.faceUp = false;
    player.territoryDeck.push(card);
    log(`${card.name} put on bottom of territory deck.`);
  } else {
    removeFromAny(instanceId);
    card.zone   = "deck";
    card.faceUp = false;
    player.deck.push(card);
    log(`${card.name} put on bottom of deck.`);
  }
});

export const returnToHand = synced("returnToHand", (instanceId) => {
  _moveCard(instanceId, ownerOf(instanceId), "hand", true);
});

export const declareAttack = synced("declareAttack", (instanceId) => {
  const found = findAny(instanceId);
  if (found) {
    _shakeCard(instanceId);
    log(`${found.card.name} declares an attack!`);
  }
});

export const flipCardFaceUp = synced("flipCardFaceUp", (instanceId) => {
  const found = findAny(instanceId);
  if (found) { found.card.faceUp = true; log(`${found.card.name} flipped face-up.`); }
});

// Sap (ex rotate) — per qualsiasi carta
export const sapCard = synced("sapCard", (instanceId) => {
  _toggleRotation(instanceId);
  const found = findAny(instanceId);
  if (found) log(`${displayName(found.card.owner)} sapped ${found.card.name}.`);
});

// Sap minion
export const sapMinion = synced("sapMinion", (instanceId) => {
  const found = findAny(instanceId);
  if (!found) return;
  found.card.rotation = 90;
  log(`${displayName(found.card.owner)} sapped ${found.card.name}.`);
});

// Unsap minion
export const unsapMinion = synced("unsapMinion", (instanceId) => {
  const found = findAny(instanceId);
  if (!found) return;
  found.card.rotation = 0;
  log(`${displayName(found.card.owner)} unsapped ${found.card.name}.`);
});

// Sap via doppio click — toggle 0° ↔ 180°
export const dblClickSap = synced("dblClickSap", (instanceId) => {
  const found = findAny(instanceId);
  if (!found) return;
  found.card.rotation = found.card.rotation !== 0 ? 0 : 180;
  const state = found.card.rotation === 0 ? "unsapped" : "sapped";
  log(`${displayName(found.card.owner)} ${state} ${found.card.name}.`);
});

// Mette la prima carta del mazzo principale nella zona face-down (sudden)
export const setTopCardToSudden = synced("setTopCardToSudden", (role) => {
  const p = GameState[role];
  if (!p.deck.length) { log(`${displayName(role)}: deck empty!`); return; }
  if (p.secondaryZone.length >= 3) { log(`${displayName(role)}: face-down zone full (max 3)!`); return; }
  const card = p.deck.shift();
  card.zone   = "secondaryZone";
  card.faceUp = false;
  card.rotation = 0;
  p.secondaryZone.push(card);
  log(`${displayName(role)} set top card face-down.`);
});

// ── Damage on minions ─────────────────────────────────────────

export const addDamage = synced("addDamage", (instanceId, amount) => {
  const found = findAny(instanceId);
  if (!found) return;
  found.card.damage = Math.max(0, (found.card.damage || 0) + amount);
  log(`${displayName(found.card.owner)}: ${found.card.name} has ${found.card.damage} damage.`);
});

export const addCounter = synced("addCounter", (instanceId, amount) => {
  const found = findAny(instanceId);
  if (!found) return;
  found.card.counters = Math.max(0, (found.card.counters || 0) + amount);
  if (amount > 0)
    log(`${displayName(found.card.owner)} added a counter to ${found.card.name} (${found.card.counters}).`);
  else if (found.card.counters === 0)
    log(`${displayName(found.card.owner)} removed all counters from ${found.card.name}.`);
  else
    log(`${displayName(found.card.owner)} removed a counter from ${found.card.name} (${found.card.counters}).`);
});

// ── Territory ─────────────────────────────────────────────────

export const playTerritory = synced("playTerritory", (role) => {
  _playTerritory(role);
});

// Sap all territories
export const sapAllTerritories = synced("sapAllTerritories", (role) => {
  const p = GameState[role];
  p.territoryZone.forEach(c => { if (c.rotation === 0) c.rotation = 90; });
  log(`${displayName(role)} sapped all territories.`);
});

// Unsap all territories
export const unsapAllTerritories = synced("unsapAllTerritories", (role) => {
  const p = GameState[role];
  p.territoryZone.forEach(c => { if (c.rotation !== 0) c.rotation = 0; });
  log(`${displayName(role)} unsapped all territories.`);
});

// Mill: manda la prima carta del main deck al graveyard
export const millMainDeck = synced("millMainDeck", (role) => {
  const p = GameState[role];
  if (!p.deck.length) { log(`${displayName(role)}: main deck empty!`); return; }
  const card = p.deck.shift();
  card.zone   = "graveyard";
  card.faceUp = true;
  p.graveyard.push(card);
  log(`${displayName(role)} milled ${card.name} from main deck.`);
});

// Mill: manda la prima carta del territory deck al graveyard
export const millTerritory = synced("millTerritory", (role) => {
  const p = GameState[role];
  if (!p.territoryDeck.length) { log(`${displayName(role)}: territory deck empty!`); return; }
  const card = p.territoryDeck.shift();
  card.zone   = "graveyard";
  card.faceUp = true;
  p.graveyard.push(card);
  log(`${displayName(role)} milled ${card.name} from territory deck.`);
});

// ── Draw ──────────────────────────────────────────────────────

export const drawOne = synced("drawOne", (role) => {
  _drawCard(role, true);
});

// ── Turn / Phase ──────────────────────────────────────────────

export const setPhase = synced("setPhase", (phase) => {
  _setPhase(phase);
});

// Chiede la fine del turno: mette il flag awaitingTurnStart senza cambiare il turno attivo
export const notifyEndTurn = synced("notifyEndTurn", () => {
  GameState.awaitingTurnStart = true;
});

// Conferma l'inizio del turno: esegue il vero toggle (unsap, cambia role, pesca)
export const endTurn = synced("endTurn", () => {
  _toggleTurn();
});

// ── Life points ───────────────────────────────────────────────

export const adjustLife = synced("adjustLife", (role, delta) => {
  _changeLife(role, delta);
});

export const setLifePoints = synced("setLifePoints", (role, value) => {
  _setLife(role, value);
});

// ── Shake visual feedback ─────────────────────────────────────

function _shakeCard(instanceId) {
  // Eseguito prima del re-render: cerca l'elemento DOM e aggiunge la classe shake
  requestAnimationFrame(() => {
    const el = document.querySelector(`[data-instance="${instanceId}"]`);
    if (!el) return;
    el.classList.remove("sim-card--shake");
    void el.offsetWidth; // force reflow
    el.classList.add("sim-card--shake");
    el.addEventListener("animationend", () => el.classList.remove("sim-card--shake"), { once: true });
  });
}

// ── Drag & drop ───────────────────────────────────────────────

const _moveCardRaw = synced("moveCardRaw", (instanceId, targetRole, targetZone, faceUp) => {
  _moveCard(instanceId, targetRole, targetZone, faceUp);
});

export function startDrag(card, fromZone, fromRole) {
  GameState.dragging = { card, fromZone, fromRole };
}

export function endDrag(instanceId, targetZone, targetRole) {
  GameState.dragging = null;
  const faceUp = targetZone !== "secondaryZone";
  _moveCardRaw(instanceId, targetRole, targetZone, faceUp);
}

// ── Drag mano → territory deck: carta va in fondo al main deck e si evoca una terra ──

const _sendHandToBottomAndPlayTerritory = synced("sendHandToBottomDeckAndPlayTerritory", (instanceId, role) => {
  const found = findAny(instanceId);
  if (!found || found.zone !== "hand") return;
  const { card, player } = found;
  // Rimuovi dalla mano e metti in fondo al deck principale
  removeFromAny(instanceId);
  card.zone   = "deck";
  card.faceUp = false;
  player.deck.push(card);
  log(`${displayName(role)}: ${card.name} placed on bottom of deck.`);
  // Evoca automaticamente una terra dal territory deck
  if (player.territoryDeck.length) {
    const terrCard = player.territoryDeck.shift();
    terrCard.zone   = "territoryZone";
    terrCard.faceUp = true;
    player.territoryZone.push(terrCard);
    log(`${displayName(role)} played territory: ${terrCard.name}.`);
  } else {
    log(`${displayName(role)}: territory deck empty, no territory played.`);
  }
});

export function sendHandToBottomDeckAndPlayTerritory(instanceId, role) {
  _sendHandToBottomAndPlayTerritory(instanceId, role);
}

// ── Attack with arrow (no synced — solo log) ──────────────────

export function startAttackMode(instanceId) {
  const found = findAny(instanceId);
  if (!found) return;
  closeMenu();
  if (typeof window._startAttackMode === "function") {
    window._startAttackMode(instanceId, found.card.name);
  }
}

export const logAttackOnMinion = synced("logAttackOnMinion", (attackerId, attackerName, targetId) => {
  const target = findAny(targetId);
  const tName = target?.card.name ?? "minion";
  log(`${displayName(GameState.myRole)}: ${attackerName} attacks ${tName}!`);
  _animateAttackCard(attackerId);
  const attacker = findAny(attackerId);
  if (attacker) attacker.card.rotation = 90;
});

export const logAttackOnOpponent = synced("logAttackOnOpponent", (attackerId, attackerName) => {
  log(`${displayName(GameState.myRole)}: ${attackerName} attacked opponent HP!`);
  _animateAttackCard(attackerId);
  const attacker = findAny(attackerId);
  if (attacker) attacker.card.rotation = 90;
});

function _animateAttackCard(instanceId) {
  requestAnimationFrame(() => {
    const el = document.querySelector(`[data-instance="${instanceId}"][data-zone="primaryZone"]`);
    if (!el) return;
    el.classList.remove("sim-card--attack");
    void el.offsetWidth;
    el.classList.add("sim-card--attack");
    el.addEventListener("animationend", () => el.classList.remove("sim-card--attack"), { once: true });
  });
}

// ── Context menu definitions ──────────────────────────────────

export function getContextActions(card, fromZone) {
  if (card.owner !== GameState.myRole) return [];
  const id = card.instanceId;

  if (fromZone === "hand") {
    if (card.type === "minion") return [
      { label: "Summon",            action: () => summonCard(id) },
      { label: "Send to graveyard", action: () => sendToGraveyard(id) },
      { label: "Banish",            action: () => banishCard(id) },
      { label: "Top deck",          action: () => topDeck(id) },
      { label: "Bottom deck",       action: () => bottomDeck(id) },
    ];
    if (card.type === "spell") return [
      { label: "Activate",          action: () => activateSpell(id) },
      { label: "Set",               action: () => setCardSecondary(id) },
      { label: "Send to graveyard", action: () => sendToGraveyard(id) },
      { label: "Banish",            action: () => banishCard(id) },
      { label: "Top deck",          action: () => topDeck(id) },
      { label: "Bottom deck",       action: () => bottomDeck(id) },
    ];
    if (card.type === "quest") return [
      { label: "Activate",          action: () => activateQuest(id) },
      { label: "Send to graveyard", action: () => sendToGraveyard(id) },
      { label: "Banish",            action: () => banishCard(id) },
      { label: "Top deck",          action: () => topDeck(id) },
      { label: "Bottom deck",       action: () => bottomDeck(id) },
    ];
    return [
      { label: "Send to graveyard", action: () => sendToGraveyard(id) },
      { label: "Banish",            action: () => banishCard(id) },
    ];
  }

  if (fromZone === "primaryZone") return [
    { label: "Attack",       action: () => startAttackMode(id) },
    { label: "Sap",          action: () => sapMinion(id) },
    { label: "Unsap",        action: () => unsapMinion(id) },
    { label: "To grave",     action: () => sendToGraveyard(id) },
    { label: "Banish",       action: () => banishCard(id) },
    { label: "Declare",      action: () => declareAttack(id) },
    { label: "Top deck",     action: () => topDeck(id) },
    { label: "Bottom deck",  action: () => bottomDeck(id) },
    { label: "To hand",      action: () => returnToHand(id) },
  ];

  if (fromZone === "secondaryZone") return [
    { label: "Flip face-up", action: () => flipCardFaceUp(id) },
    { label: "To grave",     action: () => sendToGraveyard(id) },
    { label: "Banish",       action: () => banishCard(id) },
    { label: "To hand",      action: () => returnToHand(id) },
  ];

  if (fromZone === "tertiaryZone") return [
    { label: "To grave",    action: () => sendToGraveyard(id) },
    { label: "Banish",      action: () => banishCard(id) },
    { label: "To hand",     action: () => returnToHand(id) },
  ];

  if (fromZone === "territoryZone") return [
    { label: "Sap",          action: () => sapCard(id) },
    { label: "To grave",     action: () => sendToGraveyard(id) },
    { label: "Banish",       action: () => banishCard(id) },
    { label: "Top deck",     action: () => topDeck(id) },
    { label: "Bottom deck",  action: () => bottomDeck(id) },
    { label: "Sap all",      action: () => sapAllTerritories(card.owner) },
    { label: "Unsap all",    action: () => unsapAllTerritories(card.owner) },
  ];

  if (fromZone === "graveyard" || fromZone === "banished") return [
    { label: "To hand",     action: () => returnToHand(id) },
    { label: "Top deck",    action: () => topDeck(id) },
    { label: "Bottom deck", action: () => bottomDeck(id) },
  ];

  return [];
}
