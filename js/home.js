// ============================================================
// home.js — Schermata Home.
//
// Contiene una sola funzione che costruisce l'HTML della home
// e attacca i listener ai pulsanti di navigazione.
// ============================================================

function renderHomeScreen() {
  // getElementById cerca nel DOM (la struttura HTML della pagina)
  // l'elemento con id="screen-home" e lo assegna alla variabile.
  const screen = document.getElementById("screen-home");

  // .innerHTML sostituisce il contenuto HTML dell'elemento con la
  // stringa che gli passiamo. Usiamo i template literal (backtick `)
  // che permettono stringhe multi-riga e l'interpolazione ${...}
  // per inserire valori JS direttamente nell'HTML.
  screen.innerHTML = `
    <h2 class="page-title">Home</h2>
    <p class="page-subtitle">Benvenuto in Rafflesia. Scegli dove iniziare.</p>

    <div class="grid-2">
      <button class="big-action" id="go-play">
        <h3>Play</h3>
        <p>Avvia una partita contro AI o prepara la modalità multiplayer.</p>
      </button>

      <button class="big-action" id="go-deckbuilder">
        <h3>Deck Builder</h3>
        <p>Crea, modifica e salva i tuoi mazzi.</p>
      </button>

      <button class="big-action" id="go-settings">
        <h3>Settings</h3>
        <p>Personalizza nome giocatore, audio e preferenze.</p>
      </button>

      <div class="card-panel">
        <h3>Stato progetto</h3>
        <p class="muted">V1 navigabile completata.</p>
        <div class="row">
          <span class="badge">Home</span>
          <span class="badge">Settings</span>
          <span class="badge">Deck Builder</span>
          <span class="badge">Play</span>
        </div>
      </div>
    </div>
  `;

  // .onclick assegna direttamente una funzione al click del bottone.
  // () => navigateTo("play") è una funzione freccia (arrow function):
  // equivalente a function() { navigateTo("play"); } ma più compatta.
  // navigateTo è definita in app.js, già caricato dal browser.
  document.getElementById("go-play").onclick       = () => navigateTo("play");
  document.getElementById("go-deckbuilder").onclick = () => navigateTo("deckbuilder");
  document.getElementById("go-settings").onclick   = () => navigateTo("settings");
}
