// ============================================================
// play.js — Menù Play e selezione modalità di gioco.
//
// Contiene solo la schermata di selezione (Vs AI / Multiplayer)
// e la validazione del mazzo prima di avviare la partita.
//
// La logica di gioco vera e propria è in play-board.js.
// ============================================================

// PlayState è condiviso tra questo file e play-board.js.
// Quando non c'è una partita attiva vale null; quando la partita
// inizia (startAIGame) viene rimpiazzato con l'oggetto di stato completo.
let PlayState = null;

// ── Menù Play ─────────────────────────────────────────────────

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

    if (issues.length) {
      box.innerHTML = `
        Il mazzo non è valido:
        <ul style="margin-top:8px; padding-left:18px;">
          ${issues.map(issue => `<li>${issue}</li>`).join("")}
        </ul>
      `;
      return;
    }

    startAIGame(deck);
  };

  document.getElementById("startMpBtn").onclick = () => {
    document.getElementById("mpStatusBox").textContent = "Multiplayer non ancora implementato.";
  };

  updateBackButtons();
}

// Controlla le regole minime per avviare la partita.
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
