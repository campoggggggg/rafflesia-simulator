// ============================================================
// router.js — Navigazione tra schermate con History API.
//
// Ogni schermata ha un URL reale nel browser. navigateTo()
// aggiorna sia la UI che l'URL (pushState). Il tasto Indietro
// del browser funziona tramite popstate.
// ============================================================

// Base path letto dal meta tag <meta name="app-base-path" content="...">.
// In locale: content="" → stringa vuota → URL normali (/play, /builder …).
// Su GitHub Pages: content="/rafflesia-simulator" → URL con prefisso.
const _basePath = document.querySelector('meta[name="app-base-path"]')?.content ?? "";

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
  profile:         "/profile",
  match:           "/match",
};

const PATH_TO_SCREEN = Object.fromEntries(
  Object.entries(SCREEN_TO_PATH).map(([s, p]) => [p, s])
);

export function screenFromPath(path) {
  // Rimuove il base path e cerca la schermata corrispondente
  const stripped = _basePath ? path.replace(_basePath, "") || "/" : path;
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
    const path = _basePath + (SCREEN_TO_PATH[screenName] ?? "/");
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
export function getBasePath()           { return _basePath; }

// Converte un path relativo in assoluto usando il base path.
// assetPath("src/assets/cards/001.png") →
//   in locale (basePath=""):                 "/src/assets/cards/001.png"  → no, rimane "src/assets/..."
//   su GitHub Pages (basePath="/raf..."):    "/rafflesia-simulator/src/assets/cards/001.png"
// Usare sempre questa funzione per gli asset nei template JS.
export function assetPath(relativePath) {
  return _basePath + "/" + relativePath;
}

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
