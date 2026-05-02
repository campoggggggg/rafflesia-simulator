// ============================================================
// play/game-state.js — Central game state for the simulator.
// All mutations go through exported functions so networking.js
// can intercept and broadcast them to the peer.
// ============================================================

import { CardDatabase } from '../../data/cards.js';

// ── Card factory ──────────────────────────────────────────────
let _nextInstanceId = 1;
function nextId() { return String(_nextInstanceId++); }

/**
 * Create a game-card instance from a card-database id.
 * @param {string} cardDbId
 * @param {string} owner  "p1" | "p2"
 * @param {string} zone   starting zone string
 * @param {boolean} faceUp
 */
export function makeCard(cardDbId, owner, zone, faceUp = false) {
  const db = CardDatabase.find(c => String(c.id) === String(cardDbId));
  return {
    instanceId: nextId(),
    id:         String(cardDbId),
    name:       db?.name    ?? "Unknown",
    type:       normaliseType(db?.type ?? ""),
    image:      db?.image   ?? "",
    owner,
    zone,
    faceUp,
    rotation:   0,   // 0 | 90
  };
}

function normaliseType(raw) {
  const t = raw.toLowerCase();
  if (t.includes("territory")) return "territory";
  if (t.includes("minion"))    return "minion";
  if (t.includes("spell"))     return "spell";
  if (t.includes("quest"))     return "quest";
  if (t.includes("commander")) return "commander";
  return "minion";
}

// ── Shuffle ───────────────────────────────────────────────────
export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Empty player state ─────────────────────────────────────────
function emptyPlayer(role) {
  return {
    role,                // "p1" | "p2"
    life:             25,
    deck:             [],   // array of card instanceIds (face-down, ordered)
    hand:             [],
    graveyard:        [],
    banished:         [],
    commanderCard:    null, // single card object
    // board zones: arrays of card objects
    primaryZone:      [],   // unlimited minions
    secondaryZone:    [],   // max 3 face-down
    tertiaryZone:     [],   // unlimited quests
    territoryDeck:    [],   // 12 territory cards face-down
    territoryZone:    [],   // territory cards in play
  };
}

// ── Master game state ─────────────────────────────────────────
export const GameState = {
  // Set by networking on connect
  myRole:       null,   // "p1" | "p2"
  roomKey:      null,

  phase:        "prep",   // "prep"|"start"|"play"|"end"
  activeRole:   "p1",     // whose turn it is

  p1: emptyPlayer("p1"),
  p2: emptyPlayer("p2"),

  log:          [],
  // Drag-drop tracking (client-only, not synced)
  dragging:     null,     // { card, fromZone, fromRole }
  // Show-hand flag: set by local player, read by opponent renderer
  handShown:    false,    // local player is showing their hand to opponent
  showOppHand:  false,    // opponent is showing their hand to us
};

// ── Lookup helpers ────────────────────────────────────────────
export function getPlayer(role) {
  return role === "p1" ? GameState.p1 : GameState.p2;
}

export function getOpponentRole(role) {
  return role === "p1" ? "p2" : "p1";
}

export function findCardInstance(instanceId) {
  for (const role of ["p1", "p2"]) {
    const p = getPlayer(role);
    for (const zone of ["deck","hand","graveyard","banished","primaryZone","secondaryZone","tertiaryZone","territoryDeck","territoryZone"]) {
      if (Array.isArray(p[zone])) {
        const found = p[zone].find(c => c.instanceId === instanceId);
        if (found) return { card: found, player: p, zone };
      }
    }
    if (p.commanderCard?.instanceId === instanceId) {
      return { card: p.commanderCard, player: p, zone: "commanderCard" };
    }
  }
  return null;
}

// ── State mutation helpers ────────────────────────────────────
// Each returns a "patch" object that networking.js broadcasts.

export function removeFromZone(player, zone, instanceId) {
  if (zone === "commanderCard") { player.commanderCard = null; return; }
  player[zone] = player[zone].filter(c => c.instanceId !== instanceId);
}

export function addToZone(player, zone, card) {
  if (zone === "commanderCard") { player.commanderCard = card; return; }
  player[zone].push(card);
}

export function log(msg) {
  GameState.log.unshift(`[${new Date().toLocaleTimeString("en", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}] ${msg}`);
  if (GameState.log.length > 40) GameState.log.length = 40;
}

// ── Game setup ────────────────────────────────────────────────
/**
 * Called once both players have the deck. Initialises the player's own side.
 * @param {string}   role        "p1"|"p2"
 * @param {string}   commanderId card db id of commander
 * @param {string[]} deckIds     29 card db ids
 * @param {string[]} terrIds     12 territory card db ids
 */
export function setupPlayer(role, commanderId, deckIds, terrIds) {
  const p = getPlayer(role);

  // Reset player state (non azzerare _nextInstanceId: i due giocatori devono avere ID unici)
  Object.assign(p, emptyPlayer(role));

  // Commander — face up
  p.commanderCard = makeCard(commanderId, role, "commanderCard", true);

  // Main deck — shuffled, face down
  p.deck = shuffle(deckIds).map(id => makeCard(id, role, "deck", false));

  // Territory deck — shuffled, face down
  p.territoryDeck = shuffle(terrIds).map(id => makeCard(id, role, "territoryDeck", false));

  // Draw 6
  for (let i = 0; i < 6; i++) drawCard(role, false);

  log(`${role.toUpperCase()} is ready.`);
}

// ── In-game actions ───────────────────────────────────────────

export function drawCard(role, doLog = true) {
  const p = getPlayer(role);
  if (!p.deck.length) { if (doLog) log(`${role}: deck empty!`); return null; }
  if (p.hand.length >= 12) { if (doLog) log(`${role}: hand full (max 12).`); return null; }
  const card = p.deck.shift();
  card.zone  = "hand";
  card.faceUp = true;
  p.hand.push(card);
  if (doLog) log(`${role} draws a card.`);
  return card;
}

export function playTerritoryCard(role) {
  const p = getPlayer(role);
  if (!p.territoryDeck.length) { log(`${role}: territory deck empty!`); return null; }
  const card = p.territoryDeck.shift();
  card.zone   = "territoryZone";
  card.faceUp = true;
  p.territoryZone.push(card);
  log(`${role} plays a territory card.`);
  return card;
}

export function moveCard(instanceId, targetRole, targetZone, faceUp = null) {
  const found = findCardInstance(instanceId);
  if (!found) return;
  const { card, player: srcPlayer, zone: srcZone } = found;
  const tgtPlayer = getPlayer(targetRole);

  // Secondary zone cap
  if (targetZone === "secondaryZone" && tgtPlayer.secondaryZone.length >= 3) {
    log("Secondary zone is full (max 3).");
    return;
  }

  removeFromZone(srcPlayer, srcZone, instanceId);
  card.zone   = targetZone;
  card.owner  = targetRole;
  if (faceUp !== null) card.faceUp = faceUp;
  addToZone(tgtPlayer, targetZone, card);

  log(`${card.name} moved to ${targetRole}:${targetZone}.`);
  return card;
}

export function toggleRotation(instanceId) {
  const found = findCardInstance(instanceId);
  if (!found) return;
  const { card } = found;
  card.rotation = card.rotation === 0 ? 90 : 0;
  return card;
}

export function setPhase(phase) {
  GameState.phase = phase;
  log(`Phase: ${phase.toUpperCase()}`);
}

export function toggleTurn() {
  GameState.activeRole = GameState.activeRole === "p1" ? "p2" : "p1";
  GameState.phase      = "prep";
  log(`Turn passed to ${GameState.activeRole.toUpperCase()}.`);
}

export function changeLife(role, delta) {
  const p = getPlayer(role);
  p.life = Math.max(0, p.life + delta);
  log(`${role} life → ${p.life}`);
}

export function setLife(role, value) {
  const p     = getPlayer(role);
  p.life      = Math.max(0, Number(value) || 0);
  log(`${role} life set to ${p.life}`);
}

// ── Full state snapshot (for initial sync) ────────────────────
export function getStateSnapshot() {
  return JSON.parse(JSON.stringify({
    phase:      GameState.phase,
    activeRole: GameState.activeRole,
    p1:         GameState.p1,
    p2:         GameState.p2,
    log:        GameState.log,
    handShown:  GameState.handShown,  // local player's show-hand flag
  }));
}

export function applyStateSnapshot(snap) {
  GameState.phase       = snap.phase;
  GameState.activeRole  = snap.activeRole;
  GameState.p1          = snap.p1;
  GameState.p2          = snap.p2;
  GameState.log         = snap.log;
  // The sender's handShown becomes our showOppHand
  GameState.showOppHand = !!snap.handShown;
}
