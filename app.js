let navigationHistory = ["home"];
let currentScreen = "home";

function navigateTo(screenName, addToHistory = true) {
  document.querySelectorAll(".screen").forEach(screen => {
    screen.classList.remove("active");
  });

  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.classList.remove("active");
  });

  const targetScreen = document.getElementById(`screen-${screenName}`);
  const targetButton = document.querySelector(`.nav-btn[data-screen="${screenName}"]`);

  if (!targetScreen || !targetButton) return;

  targetScreen.classList.add("active");
  targetButton.classList.add("active");

  if (addToHistory && currentScreen !== screenName) {
    navigationHistory.push(screenName);
  }

  currentScreen = screenName;
  updateBackButtons();
}

function goBack() {
  if (navigationHistory.length <= 1) {
    navigateTo("home", false);
    return;
  }

  navigationHistory.pop();
  const previousScreen = navigationHistory[navigationHistory.length - 1] || "home";
  navigateTo(previousScreen, false);
}

function goHome() {
  navigationHistory = ["home"];
  navigateTo("home", false);
}

function updateBackButtons() {
  document.querySelectorAll(".back-btn").forEach(btn => {
    btn.onclick = goBack;
  });

  document.querySelectorAll(".home-btn").forEach(btn => {
    btn.onclick = goHome;
  });
}

function updateGlobalUI() {
  const label = document.getElementById("player-name-label");
  if (label) {
    label.textContent = `Player: ${AppState.settings.playerName}`;
  }

  if (AppState.settings.theme === "light") {
    document.body.style.background = "#e8edf5";
    document.body.style.color = "#111827";
  } else {
    document.body.style.background = "#0f1117";
    document.body.style.color = "#f2f4f8";
  }
}

function initNavigation() {
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      navigateTo(btn.dataset.screen);
    });
  });
}

function initApp() {
  renderHomeScreen();
  renderPlayScreen();
  renderDeckBuilderScreen();
  renderSettingsScreen();

  initNavigation();
  updateGlobalUI();

  navigationHistory = ["home"];
  currentScreen = "home";
  navigateTo("home", false);
}

window.onload = initApp;