// ============================================================
// ui.js — Aggiornamento UI globale (sidebar, tema).
//
// Separato da app.js perché viene importato sia da app.js
// che da settings.js, evitando dipendenze circolari.
// ============================================================

import { AppState } from './state.js';
import { getUser }  from '../auth/auth.js';

export function updateGlobalUI() {
  const label = document.getElementById("player-name-label");
  if (label) label.textContent = `Player: ${AppState.settings.playerName}`;

  document.body.classList.toggle("theme-light", AppState.settings.theme === "light");

  getUser().then(user => {
    const btn = document.getElementById("authSidebarBtn");
    if (!btn) return;
    btn.textContent = user ? `${user.email.split("@")[0]} · Esci` : "Accedi";
  });
}
