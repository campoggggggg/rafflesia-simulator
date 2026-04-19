// ============================================================
// auth/auth-screen.js — Schermata Login / Registrazione.
//
// Due tab: "Accedi" e "Registrati". Il tab attivo mostra il form
// corrispondente. Tutti gli errori vengono mostrati inline sotto
// il bottone, senza alert().
//
// Dipende da: auth/auth.js (signIn, signUp), app.js (navigateTo)
// ============================================================

function renderAuthScreen() {
  const screen = document.getElementById("screen-auth");

  screen.innerHTML = `
    <h2 class="page-title">Account</h2>
    <p class="page-subtitle">Accedi per salvare i mazzi nel cloud e giocare online con gli amici.</p>

    <div class="auth-tabs">
      <button class="auth-tab active" id="loginTab">Accedi</button>
      <button class="auth-tab"        id="registerTab">Registrati</button>
    </div>

    <!-- Form login -->
    <div class="card-panel" id="loginForm">
      <div class="setting-row">
        <label for="loginEmail">Email</label>
        <input class="input" type="email" id="loginEmail" placeholder="email@esempio.com" />
      </div>
      <div class="setting-row">
        <label for="loginPassword">Password</label>
        <input class="input" type="password" id="loginPassword" placeholder="••••••••" />
      </div>
      <div class="row" style="margin-top: 20px;">
        <button class="primary-btn" id="loginBtn">Accedi</button>
        <p id="loginMsg" class="auth-msg"></p>
      </div>
    </div>

    <!-- Form registrazione (nascosto di default) -->
    <div class="card-panel" id="registerForm" style="display: none;">
      <div class="setting-row">
        <label for="regUsername">Username</label>
        <input class="input" type="text" id="regUsername" placeholder="Il tuo nome" />
      </div>
      <div class="setting-row">
        <label for="regEmail">Email</label>
        <input class="input" type="email" id="regEmail" placeholder="email@esempio.com" />
      </div>
      <div class="setting-row">
        <label for="regPassword">Password</label>
        <input class="input" type="password" id="regPassword" placeholder="Minimo 6 caratteri" />
      </div>
      <div class="row" style="margin-top: 20px;">
        <button class="primary-btn" id="registerBtn">Crea account</button>
        <p id="registerMsg" class="auth-msg"></p>
      </div>
    </div>

    <p class="muted" style="margin-top: 16px; font-size: 13px;">
      Puoi usare l'app anche senza account: i mazzi verranno salvati solo su questo dispositivo.
    </p>
  `;

  // ── Switching tra tab ──────────────────────────────────────
  document.getElementById("loginTab").onclick = () => {
    document.getElementById("loginForm").style.display    = "";
    document.getElementById("registerForm").style.display = "none";
    document.getElementById("loginTab").classList.add("active");
    document.getElementById("registerTab").classList.remove("active");
  };

  document.getElementById("registerTab").onclick = () => {
    document.getElementById("loginForm").style.display    = "none";
    document.getElementById("registerForm").style.display = "";
    document.getElementById("registerTab").classList.add("active");
    document.getElementById("loginTab").classList.remove("active");
  };

  // ── Login ──────────────────────────────────────────────────
  document.getElementById("loginBtn").onclick = async () => {
    const email    = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;
    const msg      = document.getElementById("loginMsg");
    const btn      = document.getElementById("loginBtn");

    msg.className   = "auth-msg";
    msg.textContent = "";
    btn.disabled    = true;

    try {
      await signIn(email, password);
      // onAuthChange in app.js rileva il login e reindirizza alla home.
    } catch (err) {
      msg.className   = "auth-msg error";
      msg.textContent = err.message;
      btn.disabled    = false;
    }
  };

  // ── Registrazione ──────────────────────────────────────────
  document.getElementById("registerBtn").onclick = async () => {
    const username = document.getElementById("regUsername").value.trim();
    const email    = document.getElementById("regEmail").value.trim();
    const password = document.getElementById("regPassword").value;
    const msg      = document.getElementById("registerMsg");
    const btn      = document.getElementById("registerBtn");

    msg.className   = "auth-msg";
    msg.textContent = "";

    if (!username) {
      msg.className   = "auth-msg error";
      msg.textContent = "Inserisci un username.";
      return;
    }

    btn.disabled = true;

    try {
      await signUp(email, password, username);
      msg.className   = "auth-msg success";
      msg.textContent = "Account creato! Controlla la tua email per confermare.";
    } catch (err) {
      msg.className   = "auth-msg error";
      msg.textContent = err.message;
      btn.disabled    = false;
    }
  };
}
