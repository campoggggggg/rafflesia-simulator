// ============================================================
// router.js — Navigazione tra schermate.
//
// Estratto da app.js per evitare dipendenze circolari:
// le schermate importano navigateTo da qui senza che router.js
// debba importare nulla da esse.
// ============================================================

let navigationHistory = ["auth"];
let currentScreen     = "auth";

export function navigateTo(screenName, addToHistory = true) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));

  const targetScreen = document.getElementById(`screen-${screenName}`);
  if (!targetScreen) return;

  targetScreen.classList.add("active");

  const targetButton = document.querySelector(`.nav-btn[data-screen="${screenName}"]`);
  if (targetButton) targetButton.classList.add("active");

  if (addToHistory && currentScreen !== screenName) {
    navigationHistory.push(screenName);
  }

  currentScreen = screenName;
  updateBackButtons();
}

export function goBack() {
  if (navigationHistory.length <= 1) { navigateTo("home", false); return; }
  navigationHistory.pop();
  navigateTo(navigationHistory[navigationHistory.length - 1] || "home", false);
}

export function goHome() {
  navigationHistory = ["home"];
  navigateTo("home", false);
}

export function updateBackButtons() {
  document.querySelectorAll(".back-btn").forEach(btn => { btn.onclick = goBack; });
  document.querySelectorAll(".home-btn").forEach(btn => { btn.onclick = goHome; });
}

export function getNavigationHistory() { return navigationHistory; }
export function setNavigationHistory(h) { navigationHistory = h; }
export function getCurrentScreen()      { return currentScreen; }
