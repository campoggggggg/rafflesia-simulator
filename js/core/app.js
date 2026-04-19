// ============================================================
// app.js — Controller principale: navigazione e avvio app.
// ============================================================

let navigationHistory = ["auth"];
let currentScreen     = "auth";

function navigateTo(screenName, addToHistory = true) {
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

function goBack() {
  if (navigationHistory.length <= 1) { navigateTo("home", false); return; }
  navigationHistory.pop();
  navigateTo(navigationHistory[navigationHistory.length - 1] || "home", false);
}

function goHome() {
  navigationHistory = ["home"];
  navigateTo("home", false);
}

function updateBackButtons() {
  document.querySelectorAll(".back-btn").forEach(btn => { btn.onclick = goBack; });
  document.querySelectorAll(".home-btn").forEach(btn => { btn.onclick = goHome; });
}

// Aggiorna tema (via classe CSS) e nome giocatore nella sidebar.
// NON tocca più l'onclick del bottone auth — quello è gestito in initNavigation().
function updateGlobalUI() {
  const label = document.getElementById("player-name-label");
  if (label) label.textContent = `Player: ${AppState.settings.playerName}`;

  // Tema gestito tramite classe CSS per aggiornare tutte le variabili colore.
  document.body.classList.toggle("theme-light", AppState.settings.theme === "light");

  // Aggiorna solo il testo del bottone auth, non l'onclick.
  if (typeof getUser === "function") {
    getUser().then(user => {
      const btn = document.getElementById("authSidebarBtn");
      if (!btn) return;
      btn.textContent = user ? `${user.email.split("@")[0]} · Esci` : "Accedi";
    });
  }
}

function initNavigation() {
  // BUG FIX: seleziona solo i bottoni con data-screen.
  // In precedenza ".nav-btn" includeva anche #authSidebarBtn (senza data-screen),
  // causando navigateTo(undefined) che rimuoveva .active da tutti gli screen
  // e non lo riaggungeva a nessuno → pagina bianca.
  document.querySelectorAll(".nav-btn[data-screen]").forEach(btn => {
    btn.addEventListener("click", () => navigateTo(btn.dataset.screen));
  });

  // Il bottone auth viene gestito qui con un click listener dedicato,
  // in modo sincrono: controlla getUser() al momento del click
  // invece di affidarsi all'onclick assegnato in modo asincrono da updateGlobalUI().
  const authBtn = document.getElementById("authSidebarBtn");
  if (authBtn) {
    authBtn.addEventListener("click", async () => {
      if (typeof getUser !== "function") return;
      const user = await getUser();
      if (user) {
        try { await signOut(); } catch (e) { console.warn("Logout:", e.message); }
      } else {
        navigateTo("auth");
      }
    });
  }
}

async function initApp() {
  loadCardsFromRawData();

  renderHomeScreen();
  renderPlayScreen();
  renderDeckBuilderScreen();
  renderSettingsScreen();
  renderAuthScreen();

  initNavigation();

  // Applica tema dai default (sarà sovrascritto dopo INITIAL_SESSION).
  document.body.classList.toggle("theme-light", AppState.settings.theme === "light");
  const label = document.getElementById("player-name-label");
  if (label) label.textContent = `Player: ${AppState.settings.playerName}`;

  // Parti sulla schermata auth: si resterà qui se non c'è sessione,
  // oppure onAuthChange(INITIAL_SESSION) reindirizzerà alla home.
  navigationHistory = ["auth"];
  navigateTo("auth", false);

  if (typeof onAuthChange === "function") {
    onAuthChange(async (event, user) => {
      if (user && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
        await onLoginLoadDecks();
        renderDeckBuilderScreen();
        updateGlobalUI();
        if (currentScreen === "auth") navigateTo("home", false);

      } else if (event === "SIGNED_OUT" || (event === "INITIAL_SESSION" && !user)) {
        // Dopo logout o sessione assente: torna alla schermata di login.
        updateGlobalUI();
        navigationHistory = ["auth"];
        navigateTo("auth", false);
      }
    });
  }

  if (typeof initSporeCanvas === "function") initSporeCanvas();

  syncCardsFromSupabase();
}

window.onload = initApp;
