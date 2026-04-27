// ============================================================
// app.js — Entry point. Importa tutto e avvia l'app.
//
// Questo file non esporta nulla: è il punto di ingresso
// caricato da index.html come <script type="module">.
// ============================================================

import { navigateTo, setNavigationHistory, getNavigationHistory } from './router.js';
import { updateGlobalUI }         from './ui.js';
import { getUser, signOut, onAuthChange, ensureProfile } from '../auth/auth.js';
import { onLoginLoadDecks }        from '../data/decks.js';
import { syncCardsFromSupabase }   from '../data/cards.js';
import { AppState }                from './state.js';
import { initSporeCanvas }         from './particles.js';

import { renderHomeScreen }           from '../screens/home.js';
import { renderPlayScreen }           from '../screens/play/play-menu.js';
import { renderDeckBuilderScreen }    from '../screens/deckbuilder.js';
import { renderSettingsScreen }       from '../screens/settings.js';
import { renderAuthScreen }           from '../auth/auth-screen.js';
import { renderAdvancedSearchScreen } from '../screens/advancedsearch/index.js';

function initNavigation() {
  document.querySelectorAll(".nav-btn[data-screen]").forEach(btn => {
    btn.addEventListener("click", () => navigateTo(btn.dataset.screen));
  });

  const authBtn = document.getElementById("authSidebarBtn");
  if (authBtn) {
    authBtn.addEventListener("click", async () => {
      const user = await getUser();
      if (user) {
        try { await signOut(); } catch (e) { console.warn("Logout:", e.message); }
        updateGlobalUI();
        setNavigationHistory(["auth"]);
        navigateTo("auth", false);
      } else {
        navigateTo("auth");
      }
    });
  }
}

function initSidebarToggle() {
  const sidebar     = document.getElementById("sidebar");
  const collapseBtn = document.getElementById("sidebarCollapseBtn");
  const expandBtn   = document.getElementById("sidebarExpandBtn");
  if (!sidebar || !collapseBtn || !expandBtn) return;

  collapseBtn.addEventListener("click", () => {
    sidebar.classList.add("collapsed");
    expandBtn.style.display = "flex";
  });

  expandBtn.addEventListener("click", () => {
    sidebar.classList.remove("collapsed");
    expandBtn.style.display = "none";
  });
}

async function initApp() {
  initNavigation();
  initSidebarToggle();

  try { renderHomeScreen();             } catch (e) { console.error("renderHomeScreen:",           e); }
  try { renderPlayScreen();             } catch (e) { console.error("renderPlayScreen:",           e); }
  try { renderDeckBuilderScreen();      } catch (e) { console.error("renderDeckBuilderScreen:",    e); }
  try { renderSettingsScreen();         } catch (e) { console.error("renderSettingsScreen:",       e); }
  try { renderAuthScreen();             } catch (e) { console.error("renderAuthScreen:",           e); }
renderAdvancedSearchScreen();

  document.body.classList.toggle("theme-light", AppState.settings.theme === "light");
  const label = document.getElementById("player-name-label");
  if (label) label.textContent = `Player: ${AppState.settings.playerName}`;

  setNavigationHistory(["auth"]);
  navigateTo("auth", false);

  onAuthChange(async (event, user) => {
    if (user && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
      await ensureProfile(user);
      await onLoginLoadDecks();
      renderDeckBuilderScreen();
      updateGlobalUI();
      if (getNavigationHistory().at(-1) === "auth") navigateTo("home", false);

    } else if (event === "SIGNED_OUT" || (event === "INITIAL_SESSION" && !user)) {
      updateGlobalUI();
      setNavigationHistory(["auth"]);
      navigateTo("auth", false);
    }
  });

  initSporeCanvas();

  await syncCardsFromSupabase();
  renderDeckBuilderScreen();
}

initApp();
