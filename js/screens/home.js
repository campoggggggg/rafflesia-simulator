// ============================================================
// screens/home.js — Schermata Home.
// ============================================================

import { navigateTo } from '../core/router.js';

export function renderHomeScreen() {
  const screen = document.getElementById("screen-home");

  screen.innerHTML = `
    <h2 class="page-title">Home</h2>
    <p class="page-subtitle">Welcome to Rafflesia! Select where to start your journey</p>

    <div class="grid-2">
      <button class="big-action" id="go-play">
        <h3>Play</h3>
        <p>Work in progress...</p>
      </button>

      <button class="big-action" id="go-deckbuilder">
        <h3>Deck Builder</h3>
        <p>Create, modify and save your decks</p>
      </button>

      <button class="big-action" id="go-settings">
        <h3>Settings</h3>
        <p>Personalyze your name, audio, graphics and other preferences</p>
      </button>

      <div class="card-panel">
        <h3>Project roadmap</h3>
        <p class="muted">V1 nav completed.</p>
        <div class="row">
          <span class="badge">Home</span>
          <span class="badge">Settings</span>
          <span class="badge">Deck Builder</span>
          <span class="badge">Play</span>
        </div>
      </div>
    </div>
  `;

  document.getElementById("go-play").onclick        = () => navigateTo("play");
  document.getElementById("go-deckbuilder").onclick  = () => navigateTo("deckbuilder");
  document.getElementById("go-settings").onclick    = () => navigateTo("settings");
}
