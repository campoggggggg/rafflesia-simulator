// ============================================================
// app.js — Entry point. Importa tutto e avvia l'app.
//
// Questo file non esporta nulla: è il punto di ingresso
// caricato da index.html come <script type="module">.
// ============================================================

import { navigateTo, setNavigationHistory } from './router.js';
import { showGlobalToast, updateGlobalUI } from './ui.js';
import { signOut, onAuthChange, ensureProfile } from '../auth/auth.js';
import { onLoginLoadDecks } from '../data/decks.js';
import { syncCardsFromSupabase } from '../data/cards.js';
import { AppState } from './state.js';
import { initSporeCanvas } from './particles.js';

import { renderHomeScreen } from '../screens/home.js';
import { renderPlayScreen } from '../screens/play/play-menu.js';
import { renderDeckBuilderScreen, populateSubtypeDropdown } from '../screens/deckbuilder.js';
import { renderSettingsScreen } from '../screens/settings.js';
import { renderAuthScreen } from '../auth/auth-screen.js';
import { renderAdvancedSearchScreen } from '../screens/advancedsearch/index.js';
import { renderPublicDeckScreen }     from '../screens/publicdeck.js';

async function goToAuthScreen() {
  setNavigationHistory(["auth"]);
  renderAuthScreen();
  navigateTo("auth", false);
}

function goToDeckBuilder() {
  navigateTo("deckbuilder");
}

function initNavigation() {
  document.querySelectorAll('.nav-btn[data-screen]').forEach(btn => {
    btn.addEventListener("click", async () => {
      if (btn.dataset.screen === "deckbuilder") {
        goToDeckBuilder();
        return;
      }

      if (btn.dataset.screen === "publicdeck") {
        navigateTo("publicdeck");
        await renderPublicDeckScreen();
        return;
      }

      navigateTo(btn.dataset.screen);
    });
  });

  const authBtn = document.getElementById("authSidebarBtn");
  if (authBtn) {
    authBtn.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (AppState.username) {
        try { await signOut(); } catch (e) { console.warn("Logout:", e.message); }
      } else {
        await goToAuthScreen();
      }
    });
  }
}

function initSidebarToggle() {
  const sidebar = document.getElementById("sidebar");
  const collapseBtn = document.getElementById("sidebarCollapseBtn");
  const expandBtn = document.getElementById("sidebarExpandBtn");
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

  try { renderHomeScreen(); } catch (e) { console.error("renderHomeScreen:", e); }
  try { renderPlayScreen(); } catch (e) { console.error("renderPlayScreen:", e); }
  try { renderDeckBuilderScreen(); } catch (e) { console.error("renderDeckBuilderScreen:", e); }
  try { renderSettingsScreen(); } catch (e) { console.error("renderSettingsScreen:", e); }
  try { renderAuthScreen(); } catch (e) { console.error("renderAuthScreen:", e); }
  try { renderAdvancedSearchScreen(); } catch (e) { console.error("renderAdvancedSearchScreen:", e); }
  try { await renderPublicDeckScreen(); } catch (e) { console.error("renderPublicDeckScreen:", e); }

  document.body.classList.toggle("theme-light", AppState.settings.theme === "light");

  setNavigationHistory(["home"]);
  navigateTo("home", false);

  let _initialAuthHandled = false;

  onAuthChange(async (event, user) => {
    if (user && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
      AppState.username = user.user_metadata?.username || user.email?.split("@")[0] || "";
      await ensureProfile(user);
      await onLoginLoadDecks();
      await renderDeckBuilderScreen();
      renderPlayScreen();
      updateGlobalUI(user);
      if (event === "SIGNED_IN" && _initialAuthHandled) {
        showGlobalToast(`Welcome back to Rafflesia, ${AppState.username}.`, "success");
        navigateTo("home");
      }
      _initialAuthHandled = true;
    } else if (event === "SIGNED_OUT" || (event === "INITIAL_SESSION" && !user)) {
      _initialAuthHandled = true;
      AppState.username = "";
      updateGlobalUI(null);
    }
  });

  initSporeCanvas();

  await syncCardsFromSupabase();
  populateSubtypeDropdown();
}

initApp();
