// ============================================================
// ui.js — Aggiornamento UI globale (sidebar, tema).
//
// Separato da app.js perché viene importato sia da app.js
// che da settings.js, evitando dipendenze circolari.
// ============================================================

import { AppState } from './state.js';
import { getUser }  from '../auth/auth.js';

export function updateGlobalUI() {
  document.body.classList.toggle("theme-light", AppState.settings.theme === "light");

  getUser().then(user => {
    const btn = document.getElementById("authSidebarBtn");
    if (!btn) return;
    const displayName = user
      ? (user.user_metadata?.username || user.email.split("@")[0])
      : null;
    btn.textContent = user ? `${displayName} · Esci` : "Accedi";
  });
}
