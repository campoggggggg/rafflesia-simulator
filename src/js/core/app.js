// ============================================================
// app.js — Entry point. Importa tutto e avvia l'app.
//
// Questo file non esporta nulla: è il punto di ingresso
// caricato da index.html come <script type="module">.
// ============================================================

import { navigateTo, setNavigationHistory, screenFromPath, getBasePath } from './router.js';
import { showGlobalToast, updateGlobalUI } from './ui.js';
import { signOut, onAuthChange, ensureProfile } from '../auth/auth.js';
import { onLoginLoadDecks, resetDecksState } from '../data/decks.js';
import { syncCardsFromSupabase } from '../data/cards.js';
import { AppState } from './state.js';
import { initSporeCanvas } from './particles.js';

import { renderHomeScreen, cleanupHomeParallax } from '../screens/home.js';
import { renderPlayScreen } from '../screens/play/play-menu.js';
import { renderDeckBuilderScreen, populateSubtypeDropdown } from '../screens/deckbuilder.js';
import { renderSettingsScreen } from '../screens/settings.js';
import { renderAuthScreen } from '../auth/auth-screen.js';
import { renderAdvancedSearchScreen } from '../screens/advancedsearch/index.js';
import { renderPublicDeckScreen }     from '../screens/publicdeck.js';
import { renderGameDesignScreen }    from '../screens/gamedesign.js';
import { renderProfileScreen }       from '../screens/profile.js';
import { renderMatchScreen }         from '../screens/match.js';

async function goToAuthScreen() {
  setNavigationHistory(["auth"]);
  renderAuthScreen();
  navigateTo("auth", false);
}

function goToDeckBuilder() {
  navigateTo("deckbuilder");
}

function initNavigation() {
  document.querySelectorAll('[data-screen]').forEach(btn => {
    btn.addEventListener("click", async () => {
      // se si sta lasciando la home, ferma il parallax
      if (btn.dataset.screen !== "home") cleanupHomeParallax();

      if (btn.dataset.screen === "deckbuilder") {
        goToDeckBuilder();
        return;
      }

      if (btn.dataset.screen === "publicdeck") {
        navigateTo("publicdeck");
        await renderPublicDeckScreen();
        return;
      }

      if (btn.dataset.screen === "auth") {
        if (btn.id === "signInBtn" && AppState.username) {
          try { await signOut(); } catch (e) { console.warn("Logout:", e.message); }
          return;
        }
        await goToAuthScreen();
        return;
      }

      if (btn.dataset.screen === "gamedesign") {
        navigateTo("gamedesign");
        await renderGameDesignScreen();
        return;
      }

      if (btn.dataset.screen === "profile") {
        navigateTo("profile");
        await renderProfileScreen();
        return;
      }

      if (btn.dataset.screen === "match") {
        navigateTo("match");
        await renderMatchScreen();
        return;
      }

      navigateTo(btn.dataset.screen);
    });
  });
}

const ADMIN_USERNAMES = ['camposssssss', 'gyomber', 'skyness'];

function updateGameDesignNavVisibility(username) {
  const btn = document.getElementById('gameDesignBtn');
  if (!btn) return;
  btn.style.display = username && ADMIN_USERNAMES.includes(username) ? '' : 'none';
}

function initTopbar() {
  const exploreToggle = document.getElementById("exploreToggle");
  const exploreMenu   = document.getElementById("exploreMenu");
  if (exploreToggle && exploreMenu) {
    exploreToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      exploreMenu.classList.toggle("open");
    });
    document.addEventListener("click", () => exploreMenu.classList.remove("open"));
  }

  document.getElementById("darkModeBtn")?.addEventListener("click", () => {
    document.body.classList.toggle("theme-light");
  });
}

async function initApp() {
  initNavigation();
  initTopbar();

  try { renderHomeScreen(); } catch (e) { console.error("renderHomeScreen:", e); }
  try { renderPlayScreen(); } catch (e) { console.error("renderPlayScreen:", e); }
  try { renderDeckBuilderScreen(); } catch (e) { console.error("renderDeckBuilderScreen:", e); }
  try { renderSettingsScreen(); } catch (e) { console.error("renderSettingsScreen:", e); }
  try { renderAuthScreen(); } catch (e) { console.error("renderAuthScreen:", e); }
  try { renderAdvancedSearchScreen(); } catch (e) { console.error("renderAdvancedSearchScreen:", e); }
  try { await renderPublicDeckScreen(); } catch (e) { console.error("renderPublicDeckScreen:", e); }
  try { renderGameDesignScreen(); } catch (e) { console.error("renderGameDesignScreen:", e); }
  try { await renderProfileScreen(); } catch (e) { console.error("renderProfileScreen:", e); }
  try { await renderMatchScreen(); } catch (e) { console.error("renderMatchScreen:", e); }

  document.body.classList.toggle("theme-light", AppState.settings.theme === "light");

  // Gestisce il redirect del 404.html di GitHub Pages (?p=/play)
  const _redirectPath = new URLSearchParams(location.search).get("p");
  if (_redirectPath) {
    const cleanUrl = getBasePath() + _redirectPath;
    history.replaceState(null, "", cleanUrl);
  }

  // Determina la schermata iniziale dall'URL corrente
  const initialScreen = screenFromPath(_redirectPath || location.pathname);
  const isProtected = ["settings", "deckbuilder"].includes(initialScreen);
  const startScreen = isProtected ? "home" : initialScreen;

  setNavigationHistory([startScreen]);
  history.replaceState({ screen: startScreen }, "", location.pathname);
  navigateTo(startScreen, false);

  let _initialAuthHandled = false;

  onAuthChange(async (event, user) => {
    if (user && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
      AppState.username = user.user_metadata?.username || user.email?.split("@")[0] || "";
      await ensureProfile(user);
      await onLoginLoadDecks();
      await renderDeckBuilderScreen();
      renderPlayScreen();
      await renderGameDesignScreen();
      updateGameDesignNavVisibility(AppState.username);
      updateGlobalUI(user);
      if (event === "SIGNED_IN" && _initialAuthHandled) {
        showGlobalToast(`Welcome back to Rafflesia, ${AppState.username}.`, "success");
        navigateTo("home");
      }
      _initialAuthHandled = true;
    } else if (event === "SIGNED_OUT" || (event === "INITIAL_SESSION" && !user)) {
      _initialAuthHandled = true;
      AppState.username = "";
      resetDecksState();
      await renderDeckBuilderScreen();
      updateGameDesignNavVisibility("");
      updateGlobalUI(null);
    }
  });

  initSporeCanvas();

  await syncCardsFromSupabase();
  populateSubtypeDropdown();
}

initApp();
