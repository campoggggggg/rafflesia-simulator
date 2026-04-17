function renderHomeScreen() {
  const screen = document.getElementById("screen-home");

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

  document.getElementById("go-play").onclick = () => navigateTo("play");
  document.getElementById("go-deckbuilder").onclick = () => navigateTo("deckbuilder");
  document.getElementById("go-settings").onclick = () => navigateTo("settings");
}