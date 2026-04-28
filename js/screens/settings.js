// ============================================================
// screens/settings.js — Schermata Impostazioni.
// ============================================================

import { AppState }        from '../core/state.js';
import { saveSettings }    from '../auth/auth.js';
import { updateGlobalUI }  from '../core/ui.js';
import { updateBackButtons } from '../core/router.js';

export function renderSettingsScreen() {
  const screen = document.getElementById("screen-settings");

  screen.innerHTML = `
    <h2 class="page-title">Settings</h2>
    <p class="page-subtitle">Configura il tuo profilo e le preferenze di gioco.</p>

    <div class="card-panel">
      <div class="setting-row">
        <label for="musicVolumeInput">Volume musica</label>
        <input id="musicVolumeInput" type="range" min="0" max="100"
               value="${AppState.settings.musicVolume}" />
      </div>

      <div class="setting-row">
        <label for="sfxVolumeInput">Volume effetti</label>
        <input id="sfxVolumeInput" type="range" min="0" max="100"
               value="${AppState.settings.sfxVolume}" />
      </div>

      <div class="setting-row">
        <label for="themeSelect">Tema</label>
        <select id="themeSelect" class="select">
          <option value="dark"  ${AppState.settings.theme === "dark"  ? "selected" : ""}>Dark</option>
          <option value="light" ${AppState.settings.theme === "light" ? "selected" : ""}>Light</option>
        </select>
      </div>

      <div class="setting-row">
        <label for="endTurnConfirmInput">Conferma fine turno</label>
        <input id="endTurnConfirmInput" type="checkbox"
               ${AppState.settings.endTurnConfirm ? "checked" : ""} />
      </div>

      <div class="row" style="margin-top: 20px; align-items: center; gap: 16px;">
        <button type="button" id="saveSettingsBtn" class="primary-btn">Salva impostazioni</button>
        <button type="button" id="resetSettingsBtn" class="secondary-btn">Ripristina default</button>
        <span id="settingsSaveMsg" class="auth-msg" style="margin-left: 4px;"></span>
      </div>
    </div>
  `;

  const saveBtn  = document.getElementById("saveSettingsBtn");
  const resetBtn = document.getElementById("resetSettingsBtn");
  const saveMsg  = document.getElementById("settingsSaveMsg");

  saveBtn.addEventListener("click", () => {
    AppState.settings.musicVolume    = Number(document.getElementById("musicVolumeInput").value);
    AppState.settings.sfxVolume      = Number(document.getElementById("sfxVolumeInput").value);
    AppState.settings.theme          = document.getElementById("themeSelect").value;
    AppState.settings.endTurnConfirm = document.getElementById("endTurnConfirmInput").checked;

    saveSettings();
    updateGlobalUI();

    saveMsg.className   = "auth-msg success";
    saveMsg.textContent = "✓ Salvato";
    setTimeout(() => { saveMsg.textContent = ""; }, 2500);
  });

  resetBtn.addEventListener("click", () => {
    AppState.settings = {
      playerName:     "Duelist",
      musicVolume:    50,
      sfxVolume:      50,
      theme:          "dark",
      endTurnConfirm: true
    };
    saveSettings();
    updateGlobalUI();
    renderSettingsScreen();
  });

  updateBackButtons();
}
