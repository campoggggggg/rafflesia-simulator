// ============================================================
// play/networking.js — PeerJS WebRTC room management.
//
// Protocol:
//   Every message is { type, payload }.
//
//   "hello"       → sent by joiner to host after connecting
//   "welcome"     → sent by host: { role:"p2", snapshot }
//   "deck"        → each player sends their deck data after welcome
//   "action"      → any in-game mutation: { fn, args }
//   "snapshot"    → full state resync (fallback)
//   "chat"        → chat message: { text }
// ============================================================

import {
  GameState,
  applyStateSnapshot,
  getStateSnapshot,
  setupPlayer,
} from './game-state.js';

// board-render imported lazily inside handlers to avoid
// circular evaluation (board-render → card-actions → networking → board-render).
function _renderBoard() {
  import('./board-render.js').then(m => m.renderBoard());
}

let _peer     = null;
let _conn     = null;
let _onReady  = null;   // () => void — called when both decks received
let _myDeck   = null;   // stored until peer shares theirs

// Action registry: name → function reference
// Populated by card-actions.js calling registerAction().
const _actions = {};

export function registerAction(name, fn) {
  _actions[name] = fn;
}

// ── Public API ────────────────────────────────────────────────

/**
 * Create a room as host (P1). Returns the room key (= Peer ID).
 * @param {Function} onReady  called when game is ready to start
 * @param {Function} onStatus called with status string updates
 */
export function createRoom(onReady, onStatus) {
  _onReady = onReady;
  _peer    = new Peer();   // PeerJS generates a random ID

  _peer.on("open", id => {
    GameState.roomKey  = id;
    GameState.myRole   = "p1";
    onStatus(`Room created. Share key: ${id}`, id);
  });

  _peer.on("connection", conn => {
    _conn = conn;
    _setupConn();
    onStatus("Opponent connected!", null);
  });

  _peer.on("error", err => onStatus(`PeerJS error: ${err.type}`));
}

/**
 * Join an existing room as guest (P2).
 * @param {string}   roomKey  the host's Peer ID
 * @param {Function} onReady
 * @param {Function} onStatus
 */
export function joinRoom(roomKey, onReady, onStatus) {
  _onReady         = onReady;
  _peer            = new Peer();
  GameState.myRole = "p2";

  _peer.on("open", () => {
    onStatus("Connecting to host…");
    _conn = _peer.connect(roomKey, { reliable: true });
    _setupConn();

    _conn.on("open", () => {
      onStatus("Connected! Waiting for host…");
      send({ type: "hello" });
    });
  });

  _peer.on("error", err => onStatus(`PeerJS error: ${err.type}`));
}

/**
 * Send the local deck to the peer (called after setupPlayer on local side).
 * @param {Object} deckData  { commanderId, deckIds, terrIds }
 */
export function sendDeck(deckData) {
  _myDeck = deckData;
  send({ type: "deck", payload: { ...deckData, username: GameState.username } });
}

/** Broadcast an action so the peer mirrors it. */
export function broadcastAction(name, args) {
  send({ type: "action", payload: { fn: name, args } });
}

/** Broadcast the full state (resync). */
export function broadcastSnapshot() {
  send({ type: "snapshot", payload: getStateSnapshot() });
}

/** Broadcast a chat message to the peer. */
export function broadcastChat(text) {
  send({ type: "chat", payload: { text } });
}

/** Broadcast the local hand to show opponent — sends card data (name + image). */
export function broadcastShowHand(cards) {
  send({ type: "showhand", payload: { cards } });
}

export function isConnected() { return _conn && _conn.open; }

export function destroyPeer() {
  if (_conn)  _conn.close();
  if (_peer)  _peer.destroy();
  _conn = null;
  _peer = null;
  GameState.roomKey = null;
  GameState.myRole  = null;
}

// ── Internal ──────────────────────────────────────────────────

function send(msg) {
  if (_conn && _conn.open) {
    _conn.send(JSON.stringify(msg));
  }
}

// Peer deck buffer — we only start when both sides ready
let _peerDeck = null;

function _setupConn() {
  _conn.on("data", raw => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    _handle(msg);
  });

  _conn.on("close", () => {
    import('./board-render.js').then(({ showDisconnectBanner }) => showDisconnectBanner());
  });
}

function _handle(msg) {
  switch (msg.type) {

    case "hello": {
      // Host receives hello → send welcome with state + own deck (so p2 can start immediately)
      send({
        type:    "welcome",
        payload: {
          role:     "p2",
          snapshot: getStateSnapshot(),
          hostDeck: _myDeck,   // may be null if host hasn't set up yet — p2 will wait for "deck" msg
        },
      });
      break;
    }

    case "welcome": {
      GameState.myRole = msg.payload.role;
      applyStateSnapshot(msg.payload.snapshot);
      if (msg.payload.hostDeck) {
        _peerDeck = msg.payload.hostDeck;
        if (_peerDeck.username) GameState.oppUsername = _peerDeck.username;
        _tryStartGame();
      }
      break;
    }

    case "deck": {
      _peerDeck = msg.payload;
      // Salva lo username dell'avversario se incluso
      if (msg.payload.username) GameState.oppUsername = msg.payload.username;
      _tryStartGame();
      break;
    }

    case "action": {
      const { fn, args } = msg.payload;
      if (_actions[fn]) {
        _actions[fn](...args);
        // renderBoard is called inside each registered action already
      }
      break;
    }

    case "snapshot": {
      applyStateSnapshot(msg.payload);
      _renderBoard();
      break;
    }

    case "chat": {
      import('./board-render.js').then(({ appendChatMessage }) => {
        appendChatMessage(msg.payload.text);
      });
      break;
    }

    case "showhand": {
      import('./board-render.js').then(({ openHandReveal }) => {
        openHandReveal(msg.payload.cards);
      });
      break;
    }
  }
}

function _tryStartGame() {
  // We also need our own deck sent
  if (!_myDeck || !_peerDeck) return;

  const peerRole = getOpponentRole(GameState.myRole);

  // Setup peer's side locally
  setupPlayer(peerRole, _peerDeck.commanderId, _peerDeck.deckIds, _peerDeck.terrIds);

  if (_onReady) _onReady();
}

function getOpponentRole(role) {
  return role === "p1" ? "p2" : "p1";
}
