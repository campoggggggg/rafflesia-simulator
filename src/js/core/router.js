// ============================================================
// router.js — Navigazione tra schermate con History API.
//
// Ogni schermata ha un URL reale nel browser. navigateTo()
// aggiorna sia la UI che l'URL (pushState). Il tasto Indietro
// del browser funziona tramite popstate.
// ============================================================

// Mappa schermata → path URL e viceversa
const SCREEN_TO_PATH = {
  home:            "/",
  play:            "/play",
  deckbuilder:     "/builder",
  advancedsearch:  "/search",
  publicdeck:      "/decks",
  settings:        "/settings",
  auth:            "/auth",
  gamedesign:      "/gamedesign",
};

const PATH_TO_SCREEN = Object.fromEntries(
  Object.entries(SCREEN_TO_PATH).map(([s, p]) => [p, s])
);

export function screenFromPath(path) {
  // Rimuove eventuale base path (es. /rafflesia-simulator) e cerca la schermata
  const stripped = path.replace(/^\/[^/]+(?=\/)/, "") || "/";
  return PATH_TO_SCREEN[stripped] || PATH_TO_SCREEN[path] || "home";
}

let navigationHistory = ["auth"];
let currentScreen     = "auth";

function applyScreen(screenName) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));

  const targetScreen = document.getElementById(`screen-${screenName}`);
  if (!targetScreen) return;

  targetScreen.classList.add("active");

  const targetButton = document.querySelector(`.nav-btn[data-screen="${screenName}"]`);
  if (targetButton) targetButton.classList.add("active");

  window.scrollTo(0, 0);
}

export function navigateTo(screenName, addToHistory = true) {
  applyScreen(screenName);

  if (addToHistory && currentScreen !== screenName) {
    navigationHistory.push(screenName);
    const path = SCREEN_TO_PATH[screenName] ?? "/";
    history.pushState({ screen: screenName }, "", path);
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

// Ascolta il tasto Indietro/Avanti del browser
window.addEventListener("popstate", (e) => {
  const screen = e.state?.screen ?? screenFromPath(location.pathname);
  applyScreen(screen);
  currentScreen = screen;
  // Sincronizza la history interna senza ri-pushare
  if (navigationHistory[navigationHistory.length - 1] !== screen) {
    navigationHistory.push(screen);
  }
  updateBackButtons();
});
