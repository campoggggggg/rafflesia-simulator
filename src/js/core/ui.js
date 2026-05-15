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

  const signInBtn   = document.getElementById("signInBtn");
  const registerBtn = document.getElementById("registerBtn");
  const profileBtn  = document.getElementById("profileNavBtn");

  if (user) {
    if (signInBtn)   signInBtn.textContent    = `${AppState.username} · Sign Out`;
    if (registerBtn) registerBtn.style.display = "none";
    if (profileBtn)  profileBtn.style.display  = "";
  } else {
    if (signInBtn)   signInBtn.textContent    = "Sign In";
    if (registerBtn) registerBtn.style.display = "";
    if (profileBtn)  profileBtn.style.display  = "none";
  }
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
