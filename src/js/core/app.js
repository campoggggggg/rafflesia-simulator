// ============================================================
// app.js — Entry point. Importa tutto e avvia l'app.
//
// Questo file non esporta nulla: è il punto di ingresso
// caricato da index.html come <script type="module">.
// ============================================================

import { navigateTo, setNavigationHistory, screenFromPath, getBasePath, getCurrentScreen } from './router.js';
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

// Guard globale contro render concorrenti — previene il freeze da doppio click
let _navigating = false;
let _navTimeout = null;

function _setNavigating(on) {
  _navigating = on;
  clearTimeout(_navTimeout);
  if (on) _navTimeout = setTimeout(() => { _navigating = false; }, 5000);
}

function initNavigation() {
  document.querySelectorAll('[data-screen]').forEach(btn => {
    btn.addEventListener("click", async () => {
      if (_navigating) return;

      if (btn.dataset.screen !== "home") cleanupHomeParallax();

      if (btn.dataset.screen === "deckbuilder") {
        goToDeckBuilder();
        return;
      }

      if (btn.dataset.screen === "auth") {
        if (btn.id === "signInBtn" && AppState.username) {
          _setNavigating(true);
          try { await signOut(); } catch (e) { console.warn("Logout:", e.message); }
          finally { _setNavigating(false); }
          return;
        }
        await goToAuthScreen();
        return;
      }

      // Schermate con render asincrono — navigateTo prima, poi render
      const asyncScreens = { publicdeck: renderPublicDeckScreen, gamedesign: renderGameDesignScreen, profile: renderProfileScreen, match: renderMatchScreen };
      if (asyncScreens[btn.dataset.screen]) {
        _setNavigating(true);
        navigateTo(btn.dataset.screen);
        try { await asyncScreens[btn.dataset.screen](); }
        catch (e) { console.error(`render ${btn.dataset.screen}:`, e); }
        finally { _setNavigating(false); }
        return;
      }

      navigateTo(btn.dataset.screen);
    });
  });
}

const ADMIN_USERNAMES = ['camposssssss', 'gyomber', 'skyness', 'skypeness'];

function updateAdminNavVisibility(username) {
  const isAdmin = username && ADMIN_USERNAMES.includes(username.toLowerCase());
  const gameDesignBtn = document.getElementById('gameDesignBtn');
  const matchBtn      = document.getElementById('matchNavBtn');
  if (gameDesignBtn) gameDesignBtn.style.display = isAdmin ? '' : 'none';
  if (matchBtn)      matchBtn.style.display      = isAdmin ? '' : 'none';
}

// alias per compatibilità con chiamate esistenti
const updateGameDesignNavVisibility = updateAdminNavVisibility;

function initButtonPressEffect() {
  document.addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (!btn) return;
    btn.classList.remove('btn-pressed');
    // forza reflow per riavviare l'animazione se cliccato di nuovo
    void btn.offsetWidth;
    btn.classList.add('btn-pressed');
    btn.addEventListener('animationend', () => btn.classList.remove('btn-pressed'), { once: true });
  }, { passive: true });
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
  initButtonPressEffect();

  // Screen leggeri: renderizzati subito
  try { renderHomeScreen(); } catch (e) { console.error("renderHomeScreen:", e); }
  try { renderPlayScreen(); } catch (e) { console.error("renderPlayScreen:", e); }
  try { renderDeckBuilderScreen(); } catch (e) { console.error("renderDeckBuilderScreen:", e); }
  try { renderSettingsScreen(); } catch (e) { console.error("renderSettingsScreen:", e); }
  try { renderAuthScreen(); } catch (e) { console.error("renderAuthScreen:", e); }
  try { renderAdvancedSearchScreen(); } catch (e) { console.error("renderAdvancedSearchScreen:", e); }
  // publicdeck, gamedesign, profile, match: renderizzati la prima volta che l'utente ci naviga

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

  // Se l'utente arriva direttamente su uno screen lazy (es. /profile via URL),
  // lo renderizziamo subito senza aspettare la navigazione manuale.
  const _lazyRenders = {
    publicdeck: renderPublicDeckScreen,
    gamedesign: renderGameDesignScreen,
    profile:    renderProfileScreen,
    match:      renderMatchScreen,
  };
  if (_lazyRenders[startScreen]) {
    try { await _lazyRenders[startScreen](); } catch (e) { console.error(`render initial ${startScreen}:`, e); }
  }

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
      // aggiorna subito la UI topbar prima di tutto il resto
      updateGlobalUI(null);
      updateAdminNavVisibility("");
      await renderDeckBuilderScreen();
      // re-render profilo in modo che mostri "Accedi" se si torna sulla schermata
      try { await renderProfileScreen(); } catch (_) {}
      // se ero su una schermata protetta, torna alla home
      if (['profile', 'deckbuilder', 'settings'].includes(getCurrentScreen())) {
        navigateTo("home");
      }
    }
  });

  initSporeCanvas();

  await syncCardsFromSupabase();
  populateSubtypeDropdown();
}

initApp();
