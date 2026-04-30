// ============================================================
// ui.js - Aggiornamento UI globale (sidebar, tema).
//
// Separato da app.js per evitare dipendenze circolari.
// ============================================================

import { AppState } from './state.js';
import { getUser }  from '../auth/auth.js';

let globalToastTimer = null;
let authUiRequestId = 0;

function applyUserToUI(user) {
  AppState.username = user
    ? (user.user_metadata?.username || user.email?.split("@")[0] || "")
    : "";

  const btn = document.getElementById("authSidebarBtn");
  if (!btn) return;
  btn.textContent = user ? `${AppState.username} · Esci` : "Accedi";
}

export function updateGlobalUI(userOverride) {
  document.body.classList.toggle("theme-light", AppState.settings.theme === "light");

  if (userOverride !== undefined) {
    authUiRequestId++;
    applyUserToUI(userOverride);
    return;
  }

  const requestId = ++authUiRequestId;
  getUser().then(user => {
    if (requestId !== authUiRequestId) return;
    applyUserToUI(user);
  });
}

export function showGlobalToast(message, variant = "default") {
  let el = document.getElementById("global-toast");
  if (!el) {
    el = Object.assign(document.createElement("div"), {
      id: "global-toast",
      className: "db-toast global-toast"
    });
    document.body.appendChild(el);
  }

  el.textContent = message;
  const variantClass = variant === "error"
    ? "toast-error"
    : variant === "success"
      ? "toast-success"
      : "";
  el.className = `db-toast global-toast ${variantClass}`.trim();
  el.classList.add("visible");

  clearTimeout(globalToastTimer);
  globalToastTimer = setTimeout(() => el.classList.remove("visible"), 2600);
}
