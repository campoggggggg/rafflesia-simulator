// ============================================================
// app.js — Controller principale dell'applicazione.
//
// Gestisce:
//  - La navigazione tra schermate (con cronologia per "indietro")
//  - L'inizializzazione dell'app al caricamento della pagina
//  - L'aggiornamento dell'UI globale (tema, nome giocatore)
//
// Questo file è caricato per ULTIMO in index.html, quindi può
// chiamare liberamente funzioni definite negli altri file.
// ============================================================

// Cronologia di navigazione: array degli schermi visitati.
// Serve per implementare il bottone "← Indietro".
// Inizia con ["home"] perché la home è sempre il punto di partenza.
let navigationHistory = ["home"];
let currentScreen     = "home";

// Mostra la schermata `screenName` e nasconde tutte le altre.
// Il parametro `addToHistory` (default true) controlla se aggiungere
// la navigazione alla cronologia (false per navigazioni "silenziose"
// come goBack o goHome che gestiscono loro stesse la history).
function navigateTo(screenName, addToHistory = true) {
  // querySelectorAll restituisce tutti gli elementi con classe "screen".
  // .forEach li scorre e rimuove la classe "active" da ognuno,
  // rendendo tutte le schermate invisibili (display: none in CSS).
  document.querySelectorAll(".screen").forEach(screen => {
    screen.classList.remove("active");
  });

  // Stessa cosa per i bottoni di navigazione nella sidebar
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.classList.remove("active");
  });

  // Cerca gli elementi specifici della schermata di destinazione
  const targetScreen = document.getElementById(`screen-${screenName}`);
  const targetButton = document.querySelector(`.nav-btn[data-screen="${screenName}"]`);

  // Se uno dei due non esiste (nome schermata errato) non fare nulla
  if (!targetScreen || !targetButton) return;

  // Aggiunge "active": il CSS mostra l'elemento (display: block)
  targetScreen.classList.add("active");
  targetButton.classList.add("active");

  // Aggiunge alla cronologia solo se è una navigazione in avanti
  // e non stiamo già su quella schermata (evita duplicati).
  if (addToHistory && currentScreen !== screenName) {
    navigationHistory.push(screenName);
  }

  currentScreen = screenName;
  updateBackButtons();
}

// Torna alla schermata precedente nella cronologia.
function goBack() {
  if (navigationHistory.length <= 1) {
    // Siamo già alla prima schermata: vai comunque alla home
    navigateTo("home", false);
    return;
  }

  // .pop() rimuove e restituisce l'ULTIMO elemento dell'array.
  // Lo buttiamo via perché è la schermata corrente.
  navigationHistory.pop();

  // Il nuovo ultimo elemento è la schermata precedente.
  // || "home" è il fallback se l'array è diventato vuoto.
  const previousScreen = navigationHistory[navigationHistory.length - 1] || "home";
  navigateTo(previousScreen, false); // false: non aggiungere di nuovo alla history
}

// Svuota la cronologia e torna alla home.
function goHome() {
  navigationHistory = ["home"]; // resetta completamente la history
  navigateTo("home", false);
}

// Attacca i listener ai bottoni "← Indietro" e "Home" presenti
// nella schermata attuale. Viene chiamata dopo ogni navigazione
// perché il DOM viene riscritto e i vecchi listener vengono persi.
function updateBackButtons() {
  document.querySelectorAll(".back-btn").forEach(btn => {
    btn.onclick = goBack;
  });

  document.querySelectorAll(".home-btn").forEach(btn => {
    btn.onclick = goHome;
  });
}

// Applica le impostazioni globali all'UI: nome giocatore nella sidebar
// e colori del tema (dark/light) sul body.
function updateGlobalUI() {
  const label = document.getElementById("player-name-label");
  if (label) {
    label.textContent = `Player: ${AppState.settings.playerName}`;
  }

  // Modifica direttamente lo stile del <body> per cambiare il tema.
  // Le variabili CSS in main.css usano queste come base.
  if (AppState.settings.theme === "light") {
    document.body.style.background = "#e8edf5";
    document.body.style.color      = "#111827";
  } else {
    document.body.style.background = "#0f1117";
    document.body.style.color      = "#f2f4f8";
  }
}

// Attacca i listener ai bottoni della sidebar (.nav-btn).
// Ogni bottone ha un attributo data-screen="play" ecc. che
// specifica quale schermata aprire al click.
function initNavigation() {
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      // btn.dataset.screen legge l'attributo data-screen del bottone
      navigateTo(btn.dataset.screen);
    });
  });
}

// Punto di ingresso dell'applicazione: chiamata quando la pagina
// ha finito di caricarsi. Renderizza tutte le schermate e imposta
// lo stato iniziale.
function initApp() {
  // Costruisce l'HTML di ogni schermata (una sola volta all'avvio)
  renderHomeScreen();
  renderPlayScreen();
  renderDeckBuilderScreen();
  renderSettingsScreen();

  initNavigation();
  updateGlobalUI();

  // Parte sempre dalla home
  navigationHistory = ["home"];
  currentScreen     = "home";
  navigateTo("home", false);
}

// window.onload si attiva quando il browser ha caricato tutti gli
// script e l'HTML. È il modo corretto per partire: se chiamassimo
// initApp() subito, il DOM potrebbe non essere ancora pronto.
window.onload = initApp;
