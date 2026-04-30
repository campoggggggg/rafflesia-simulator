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
  log,
} from './game-state.js';

import { broadcastAction, registerAction } from './networking.js';
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

/**
 * Wrap a pure-mutation function so it:
 *   - Registers itself for peer replay via registerAction.
 *   - Returns a public function that also broadcasts + re-renders.
 */
function synced(name, localFn) {
  registerAction(name, (...args) => { localFn(...args); render(); });

  return (...args) => {
    localFn(...args);
    broadcastAction(name, args);
    closeMenu();
    render();
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
  _moveCard(instanceId, ownerOf(instanceId), "graveyard", true);
  log("Spell activated and sent to graveyard.");
});

export const activateQuest = synced("activateQuest", (instanceId) => {
  _moveCard(instanceId, ownerOf(instanceId), "tertiaryZone", true);
});

export const sendToGraveyard = synced("sendToGraveyard", (instanceId) => {
  _moveCard(instanceId, ownerOf(instanceId), "graveyard", true);
});

export const banishCard = synced("banishCard", (instanceId) => {
  _moveCard(instanceId, ownerOf(instanceId), "banished", true);
});

export const topDeck = synced("topDeck", (instanceId) => {
  const found = findAny(instanceId);
  if (!found) return;
  const { card, player, zone } = found;
  removeFromAny(instanceId);
  card.zone   = "deck";
  card.faceUp = false;
  player.deck.unshift(card);
  log(`${card.name} put on top of deck.`);
});

export const bottomDeck = synced("bottomDeck", (instanceId) => {
  const found = findAny(instanceId);
  if (!found) return;
  const { card, player } = found;
  removeFromAny(instanceId);
  card.zone   = "deck";
  card.faceUp = false;
  player.deck.push(card);
  log(`${card.name} put on bottom of deck.`);
});

export const returnToHand = synced("returnToHand", (instanceId) => {
  _moveCard(instanceId, ownerOf(instanceId), "hand", true);
});

export const declareAttack = synced("declareAttack", (instanceId) => {
  const found = findAny(instanceId);
  if (found) log(`${found.card.name} declares an attack!`);
});

export const flipCardFaceUp = synced("flipCardFaceUp", (instanceId) => {
  const found = findAny(instanceId);
  if (found) { found.card.faceUp = true; log(`${found.card.name} flipped face-up.`); }
});

export const rotateCard = synced("rotateCard", (instanceId) => {
  _toggleRotation(instanceId);
});

// ── Territory ─────────────────────────────────────────────────

export const playTerritory = synced("playTerritory", (role) => {
  _playTerritory(role);
});

// ── Draw ──────────────────────────────────────────────────────

export const drawOne = synced("drawOne", (role) => {
  _drawCard(role, true);
});

// ── Turn / Phase ──────────────────────────────────────────────

export const setPhase = synced("setPhase", (phase) => {
  _setPhase(phase);
});

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
    { label: "To grave",    action: () => sendToGraveyard(id) },
    { label: "Banish",      action: () => banishCard(id) },
    { label: "Declare",     action: () => declareAttack(id) },
    { label: "Top deck",    action: () => topDeck(id) },
    { label: "Bottom deck", action: () => bottomDeck(id) },
    { label: "To hand",     action: () => returnToHand(id) },
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
    { label: "Rotate",  action: () => rotateCard(id) },
    { label: "To grave",action: () => sendToGraveyard(id) },
    { label: "Banish",  action: () => banishCard(id) },
  ];

  if (fromZone === "graveyard" || fromZone === "banished") return [
    { label: "To hand",     action: () => returnToHand(id) },
    { label: "Top deck",    action: () => topDeck(id) },
    { label: "Bottom deck", action: () => bottomDeck(id) },
  ];

  return [];
}
