// ============================================================
// play/play-menu.js — Room creation / join lobby.
// Replaces the old play-menu entirely. Handles:
//   1. Deck validation
//   2. Host (create room) flow
//   3. Guest (join room) flow
//   4. Transition into the game board once both ready
// ============================================================

import { getCurrentDeck, AppState } from '../../core/state.js';
import { updateBackButtons }        from '../../core/router.js';
import { GameState, setupPlayer, resetGameState } from './game-state.js';
import { renderBoard }             from './board-render.js';
import {
  createRoom,
  joinRoom,
  sendDeck,
  destroyPeer,
} from './networking.js';

// ── Public entry ──────────────────────────────────────────────

export function renderPlayScreen() {
  destroyPeer();
  resetGameState();

  const screen      = document.getElementById("screen-play");
  const currentDeck = getCurrentDeck();
  const issues      = validateDeck(currentDeck);

  const deckOptions = AppState.decks.map(d =>
    `<option value="${d.id}" ${String(d.id) === String(AppState.currentDeckId) ? "selected" : ""}>${_esc(d.name)}</option>`
  ).join("");

  screen.innerHTML = `
    <div class="play-lobby">
      <h2 class="page-title">Play — Multiplayer</h2>
      <p class="page-subtitle">Create or join a room with a shared key.</p>

      <div class="play-deck-select-row">
        <label for="playDeckSelect">Deck:</label>
        <select id="playDeckSelect" class="play-deck-select">
          ${deckOptions}
        </select>
      </div>

      <div class="play-deck-select-row">
        <label for="playUsernameInput">Username:</label>
        <input id="playUsernameInput" class="play-key-input" type="text"
               placeholder="Enter your name…" maxlength="24"
               value="${_esc(GameState.username || '')}">
      </div>

      ${issues.length ? `
        <div class="play-deck-warning">
          <strong>Deck not ready:</strong>
          <ul>${issues.map(i => `<li>${i}</li>`).join("")}</ul>
          <p>Go to the Deck Builder and fix the issues before playing.</p>
        </div>
      ` : `
        <div class="play-deck-ok">
          <strong>${currentDeck.name}</strong>
          — Commander: ${currentDeck.commanderId ?? "none"}
          &nbsp;| Main: ${currentDeck.cards.length}/29
          &nbsp;| Territory: ${(currentDeck.territoryCards ?? []).length}/12
        </div>
      `}

      <div class="play-lobby-grid">

        <!-- Host -->
        <div class="play-mode-box">
          <h3>Host a Room</h3>
          <p class="muted">Create a new room and share the key with your opponent.</p>
          <button class="primary-btn" id="createRoomBtn" ${issues.length ? "disabled" : ""}>
            Create Room
          </button>
          <div class="play-status-msg" id="hostStatus"></div>
          <div class="play-room-key" id="hostRoomKey" style="display:none">
            <label>Room Key</label>
            <div class="play-key-row">
              <input type="text" class="play-key-input" id="hostKeyDisplay" readonly>
              <button class="secondary-btn" id="hostCopyBtn">Copy</button>
            </div>
            <p class="muted" style="margin-top:8px">Waiting for opponent to join…</p>
          </div>
        </div>

        <!-- Join -->
        <div class="play-mode-box">
          <h3>Join a Room</h3>
          <p class="muted">Enter the key shared by your opponent.</p>
          <div class="play-key-row">
            <input type="text" class="play-key-input" id="joinKeyInput" placeholder="Paste room key…">
            <button class="primary-btn" id="joinRoomBtn" ${issues.length ? "disabled" : ""}>
              Join
            </button>
          </div>
          <div class="play-status-msg" id="joinStatus"></div>
        </div>

      </div>
    </div>
  `;

  updateBackButtons();

  const deckSelect = document.getElementById("playDeckSelect");
  deckSelect?.addEventListener("mousedown", () => {
    const sel = document.getElementById("playDeckSelect");
    if (!sel) return;
    const currentVal = sel.value;
    sel.innerHTML = AppState.decks.map(d =>
      `<option value="${d.id}" ${String(d.id) === String(AppState.currentDeckId) ? "selected" : ""}>${_esc(d.name)}</option>`
    ).join("");
    sel.value = currentVal;
  });
  deckSelect?.addEventListener("change", e => {
    AppState.currentDeckId = e.target.value;
    renderPlayScreen();
  });

  _attachLobbyEvents(currentDeck);
}

// ── Lobby event handlers ──────────────────────────────────────

function _attachLobbyEvents(deck) {

  // Salva username ogni volta che cambia
  document.getElementById("playUsernameInput")?.addEventListener("input", e => {
    GameState.username = e.target.value.trim() || null;
  });
  // Inizializza subito dal valore attuale del campo
  const usernameVal = document.getElementById("playUsernameInput")?.value.trim();
  if (usernameVal) GameState.username = usernameVal;

  // HOST
  document.getElementById("createRoomBtn")?.addEventListener("click", () => {
    document.getElementById("createRoomBtn").disabled = true;
    _setStatus("hostStatus", "Connecting to PeerJS…");

    createRoom(
      // onReady: both decks exchanged → mostra coin flip per l'host
      () => _showCoinFlipScreen(),
      // onStatus
      (msg, roomKey) => {
        _setStatus("hostStatus", msg);

        if (roomKey) {
          const keyBox = document.getElementById("hostRoomKey");
          const keyIn  = document.getElementById("hostKeyDisplay");
          if (keyBox && keyIn) {
            keyBox.style.display = "block";
            keyIn.value          = roomKey;
          }
        }

        if (msg.startsWith("Opponent")) {
          _prepareAndSendDeck(deck, "p1");
        }
      }
    );
  });

  document.getElementById("hostCopyBtn")?.addEventListener("click", (e) => {
    const val = document.getElementById("hostKeyDisplay")?.value;
    if (!val) return;
    navigator.clipboard.writeText(val).catch(() => {});
    _showCopiedToast(e.currentTarget);
  });

  // JOIN
  document.getElementById("joinRoomBtn")?.addEventListener("click", () => {
    const key = document.getElementById("joinKeyInput")?.value.trim();
    if (!key) { _setStatus("joinStatus", "Please enter a room key."); return; }

    document.getElementById("joinRoomBtn").disabled = true;
    _setStatus("joinStatus", "Connecting…");

    joinRoom(
      key,
      () => _showMulliganScreen(() => renderBoard()),
      // onStatus
      msg => {
        _setStatus("joinStatus", msg);
        // "Connected!" → setup and send our deck
        if (msg.startsWith("Connected")) {
          _prepareAndSendDeck(deck, "p2");
        }
      }
    );
  });
}

// ── Transition to board ───────────────────────────────────────

// _sendLocalDeck: called as soon as the connection is established
// (host: when opponent connects; guest: when host confirms).
// We setup our local side and broadcast our deck.
// The board only renders once networking fires _onReady (both decks received).
function _prepareAndSendDeck(deck, myRole) {
  GameState.myRole = myRole;
  setupPlayer(myRole, deck.commanderId, deck.cards, deck.territoryCards ?? []);

  sendDeck({
    commanderId: deck.commanderId,
    deckIds:     deck.cards,
    terrIds:     deck.territoryCards ?? [],
  });
}

// ── Helpers ───────────────────────────────────────────────────

function _setStatus(id, msg) {
  const el = document.getElementById(id);
  if (el) el.textContent = msg;
}

// ── Coin flip (solo host) ─────────────────────────────────────

function _showCoinFlipScreen() {
  const screen = document.getElementById("screen-play");
  screen.innerHTML = `
    <div class="play-coinflip">
      <h2 class="play-coinflip-title">Coin Flip</h2>
      <p class="play-coinflip-sub">You created the room. Call the coin!</p>
      <div class="play-coinflip-choices">
        <button class="play-coinflip-btn" id="cfHeads">Heads</button>
        <button class="play-coinflip-btn" id="cfTails">Tails</button>
      </div>
      <div class="play-coinflip-result" id="cfResult" style="display:none"></div>
    </div>
  `;

  document.getElementById("cfHeads")?.addEventListener("click", () => _flipCoin("Heads"));
  document.getElementById("cfTails")?.addEventListener("click", () => _flipCoin("Tails"));
}

function _flipCoin(choice) {
  const result = Math.random() < 0.5 ? "Heads" : "Tails";
  const won    = result === choice;

  document.getElementById("cfHeads").disabled = true;
  document.getElementById("cfTails").disabled = true;

  const resultEl = document.getElementById("cfResult");
  resultEl.style.display = "block";
  resultEl.innerHTML = `
    <div class="play-coinflip-outcome ${won ? "play-coinflip-win" : "play-coinflip-lose"}">
      The coin landed on <strong>${result}</strong> — you ${won ? "won!" : "lost!"}
    </div>
    <p class="play-coinflip-sub">${won ? "You called it!" : "Your opponent lost the flip."} Do you want to go first or second?</p>
    <div class="play-coinflip-choices">
      <button class="play-coinflip-btn" id="cfFirst">Go First</button>
      <button class="play-coinflip-btn" id="cfSecond">Go Second</button>
    </div>
  `;

  const _startGame = (firstRole) => {
    import('./game-state.js').then(({ GameState: GS }) => { GS.activeRole = firstRole; });
    _showMulliganScreen(() => {
      import('./networking.js').then(({ broadcastSnapshot }) => broadcastSnapshot());
      renderBoard();
    });
  };

  if (won) {
    document.getElementById("cfFirst")?.addEventListener("click",  () => _startGame("p1"));
    document.getElementById("cfSecond")?.addEventListener("click", () => _startGame("p2"));
  } else {
    document.getElementById("cfFirst")?.addEventListener("click",  () => _startGame("p1"));
    document.getElementById("cfSecond")?.addEventListener("click", () => _startGame("p2"));
  }
}

function _showCopiedToast(anchor) {
  const existing = document.getElementById("_copiedToast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.id = "_copiedToast";
  toast.textContent = "Copied!";
  toast.style.cssText = `
    position:fixed; z-index:99999; background:rgba(47,58,52,0.95);
    color:#c8d5c8; font-size:13px; font-family:'Inter',sans-serif;
    padding:5px 14px; border-radius:6px; border:0.5px solid rgba(95,139,111,0.50);
    box-shadow:0 4px 16px rgba(0,0,0,0.60); pointer-events:none;
    animation: _fadeInOut 1.6s ease forwards;
  `;

  // Posiziona sopra il bottone
  const rect = anchor.getBoundingClientRect();
  toast.style.left = `${rect.left + rect.width / 2}px`;
  toast.style.top  = `${rect.top - 36}px`;
  toast.style.transform = "translateX(-50%)";

  // Keyframe inline
  if (!document.getElementById("_copiedToastStyle")) {
    const style = document.createElement("style");
    style.id = "_copiedToastStyle";
    style.textContent = `
      @keyframes _fadeInOut {
        0%   { opacity:0; transform:translateX(-50%) translateY(4px); }
        15%  { opacity:1; transform:translateX(-50%) translateY(0); }
        70%  { opacity:1; }
        100% { opacity:0; transform:translateX(-50%) translateY(-4px); }
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 1650);
}

function _esc(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ── Mulligan screen ───────────────────────────────────────────

function _injectMulliganStyles() {
  if (document.getElementById('mulligan-styles')) return;
  const s = document.createElement('style');
  s.id = 'mulligan-styles';
  s.textContent = `
    .play-mulligan {
      display: flex; flex-direction: column; align-items: center;
      gap: 28px; padding: 48px 24px; min-height: 100vh;
      background: var(--bg-base, #0d1117);
    }
    .play-mulligan-box {
      background: var(--bg-elevated); border: 1px solid var(--border);
      border-radius: 10px; padding: 18px 36px; text-align: center;
    }
    .play-mulligan-title {
      font-family: 'Cinzel', serif; font-size: 20px; font-weight: 700;
      color: var(--text-primary);
    }
    .play-mulligan-sub {
      font-size: 13px; color: var(--text-secondary); margin-top: 6px;
    }
    .play-mulligan-hand {
      display: flex; flex-wrap: wrap; gap: 14px;
      justify-content: center; max-width: 960px;
    }
    .play-mulligan-card {
      position: relative; width: 110px; height: 154px;
      border-radius: 7px; overflow: hidden; cursor: pointer;
      border: 2px solid transparent;
      transition: border-color 0.15s, transform 0.12s, box-shadow 0.15s;
      background: #1a2020;
    }
    .play-mulligan-card:hover { transform: translateY(-5px); }
    .play-mulligan-card img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .play-mulligan-card--selected {
      border-color: var(--violet, #7c6f8a);
      box-shadow: 0 0 14px rgba(155,143,160,0.5);
    }
    .play-mulligan-num {
      position: absolute; top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      background: var(--violet, #7c6f8a); color: #fff;
      font-size: 30px; font-weight: 900;
      width: 48px; height: 48px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 2px 10px rgba(0,0,0,0.7);
      pointer-events: none;
    }
    .play-mulligan-card-back {
      width: 100%; height: 100%;
      background: repeating-linear-gradient(
        45deg, #1a2020, #1a2020 8px, #111818 8px, #111818 16px
      );
    }
    .play-mulligan-confirm { font-size: 15px; padding: 11px 44px; }
  `;
  document.head.appendChild(s);
}

function _showMulliganScreen(onConfirm) {
  _injectMulliganStyles();
  const screen  = document.getElementById("screen-play");
  const my      = GameState.myRole;
  const myP     = GameState[my];
  let selected  = []; // instanceIds in mulligan order

  const render = () => {
    screen.innerHTML = `
      <div class="play-mulligan">
        <div class="play-mulligan-box">
          <div class="play-mulligan-title">Choose cards to mulligan</div>
          <div class="play-mulligan-sub">(if zero, just confirm)</div>
        </div>
        <div class="play-mulligan-hand">
          ${myP.hand.map(c => {
            const idx = selected.indexOf(c.instanceId);
            const sel = idx !== -1;
            return `
              <div class="play-mulligan-card ${sel ? 'play-mulligan-card--selected' : ''}"
                   data-instance="${c.instanceId}">
                ${c.image
                  ? `<img src="${c.image}" alt="${_esc(c.name)}" draggable="false">`
                  : `<div class="play-mulligan-card-back"></div>`}
                ${sel ? `<div class="play-mulligan-num">${idx + 1}</div>` : ''}
              </div>`;
          }).join('')}
        </div>
        <button class="primary-btn play-mulligan-confirm" id="mulliganConfirmBtn">Confirm</button>
      </div>
    `;

    document.querySelectorAll('.play-mulligan-card').forEach(el => {
      el.addEventListener('click', () => {
        const id  = el.dataset.instance;
        const pos = selected.indexOf(id);
        if (pos === -1) selected.push(id);
        else selected.splice(pos, 1);
        render();
      });
    });

    document.getElementById('mulliganConfirmBtn')?.addEventListener('click', () => {
      const count = selected.length;
      // Remove selected cards from hand in order → bottom of deck
      selected.forEach(instanceId => {
        const idx = myP.hand.findIndex(c => c.instanceId === instanceId);
        if (idx === -1) return;
        const [card] = myP.hand.splice(idx, 1);
        card.zone   = 'deck';
        card.faceUp = false;
        myP.deck.push(card);
      });
      // Draw replacement cards
      for (let i = 0; i < count; i++) {
        if (!myP.deck.length) break;
        const card  = myP.deck.shift();
        card.zone   = 'hand';
        card.faceUp = true;
        myP.hand.push(card);
      }
      onConfirm();
    });
  };

  render();
}

function validateDeck(deck) {
  const issues = [];
  if (!deck)                                issues.push("No deck selected.");
  if (deck && !deck.commanderId)            issues.push("Missing commander.");
  if (deck && deck.cards.length !== 29)     issues.push(`Main deck must have exactly 29 cards (has ${deck?.cards?.length ?? 0}).`);
  if (deck && (deck.territoryCards ?? []).length !== 12)
    issues.push(`Territory deck must have exactly 12 cards (has ${(deck?.territoryCards ?? []).length}).`);
  return issues;
}
