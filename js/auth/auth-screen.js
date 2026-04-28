// ============================================================
// auth/auth-screen.js — Schermata Login / Registrazione.
// ============================================================

import { signIn, signUp, isUsernameAvailable } from './auth.js';

const PASSWORD_RULES = [
  { test: (p) => p.length >= 8,          label: "At least 8 characters" },
  { test: (p) => /[A-Z]/.test(p),        label: "One uppercase letter"  },
  { test: (p) => /[0-9]/.test(p),        label: "One number"            },
  { test: (p) => /[^A-Za-z0-9]/.test(p), label: "One symbol (!@#$...)" },
];

function validatePassword(password) {
  return PASSWORD_RULES.filter(r => !r.test(password));
}

export function renderAuthScreen() {
  const screen = document.getElementById("screen-auth");

  screen.innerHTML = `
    <h2 class="page-title">Account</h2>
    <p class="page-subtitle">Login to register your decks and play with friends (wip).</p>

    <div class="auth-tabs">
      <button class="auth-tab active" id="loginTab">Login</button>
      <button class="auth-tab"        id="registerTab">Register</button>
    </div>

    <!-- LOGIN -->
    <div class="card-panel" id="loginForm">
      <div class="setting-row">
        <label for="loginIdentifier">Username or Email</label>
        <input class="input" type="text" id="loginIdentifier" placeholder="username or email@example.com" autocomplete="username" />
      </div>
      <div class="setting-row">
        <label for="loginPassword">Password</label>
        <div class="input-eye-wrap">
          <input class="input" type="password" id="loginPassword" placeholder="••••••••" autocomplete="current-password" />
          <button class="eye-btn" id="loginEyeBtn" tabindex="-1">👁</button>
        </div>
      </div>
      <div class="row" style="margin-top: 20px;">
        <button class="primary-btn" id="loginBtn">Login</button>
        <p id="loginMsg" class="auth-msg"></p>
      </div>
    </div>

    <!-- REGISTER -->
    <div class="card-panel" id="registerForm" style="display: none;">
      <div class="setting-row">
        <label for="regUsername">Username</label>
        <div style="display:flex; flex-direction:column; flex:1; min-width:160px; gap:4px;">
          <input class="input" type="text" id="regUsername" placeholder="Make it memorable" autocomplete="username" />
          <p id="usernameMsg" class="auth-msg" style="margin:0; font-size:12px;"></p>
        </div>
      </div>
      <div class="setting-row">
        <label for="regEmail">Email</label>
        <input class="input" type="email" id="regEmail" placeholder="email@example.com" autocomplete="email" />
      </div>
      <div class="setting-row">
        <label for="regPassword">Password</label>
        <div class="input-eye-wrap">
          <input class="input" type="password" id="regPassword" placeholder="Min 8 chars" autocomplete="new-password" />
          <button class="eye-btn" id="regEyeBtn" tabindex="-1">👁</button>
        </div>
      </div>

      <ul class="password-rules" id="passwordRules">
        ${PASSWORD_RULES.map((r, i) => `
          <li class="rule-item" id="rule-${i}">
            <span class="rule-icon">✗</span> ${r.label}
          </li>
        `).join("")}
      </ul>

      <div class="setting-row">
        <label for="regPasswordConfirm">Confirm password</label>
        <div class="input-eye-wrap">
          <input class="input" type="password" id="regPasswordConfirm" placeholder="Repeat password" autocomplete="new-password" />
          <button class="eye-btn" id="regEyeBtn2" tabindex="-1">👁</button>
        </div>
      </div>
      <p id="confirmMsg" class="auth-msg" style="margin-top:4px;"></p>

      <div class="row" style="margin-top: 20px;">
        <button class="primary-btn" id="registerBtn" disabled>Create account</button>
        <p id="registerMsg" class="auth-msg"></p>
      </div>
    </div>

    <style>
      .input-eye-wrap {
        position: relative; display: flex; align-items: center;
        flex: 1; min-width: 160px;
      }
      .input-eye-wrap .input { width: 100%; padding-right: 42px; box-sizing: border-box; }
      .eye-btn {
        position: absolute; right: 10px; background: transparent; border: none;
        cursor: pointer; font-size: 16px; padding: 0; opacity: 0.5;
        transition: opacity 0.18s; line-height: 1;
      }
      .eye-btn:hover { opacity: 1; }
      .password-rules {
        list-style: none; padding: 10px 0 6px; margin: 0;
        display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px;
      }
      .rule-item {
        font-size: 12px; color: var(--text-secondary);
        display: flex; align-items: center; gap: 5px; transition: color 0.18s;
      }
      .rule-item.ok { color: var(--success, #4ade80); }
      .rule-icon {
        font-style: normal; font-weight: 700; font-size: 13px;
        color: var(--error, #ef4444); width: 14px; text-align: center;
      }
      .rule-item.ok .rule-icon { color: var(--success, #4ade80); }
    </style>
  `;

  // Tab switch
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

  // Eye toggle
  function toggleEye(inputId, btn) {
    const input = document.getElementById(inputId);
    const show  = input.type === "password";
    input.type  = show ? "text" : "password";
    btn.textContent = show ? "🙈" : "👁";
  }
  document.getElementById("loginEyeBtn").onclick  = (e) => { e.preventDefault(); toggleEye("loginPassword",      document.getElementById("loginEyeBtn")); };
  document.getElementById("regEyeBtn").onclick    = (e) => { e.preventDefault(); toggleEye("regPassword",        document.getElementById("regEyeBtn")); };
  document.getElementById("regEyeBtn2").onclick   = (e) => { e.preventDefault(); toggleEye("regPasswordConfirm", document.getElementById("regEyeBtn2")); };

  // Stato validazione
  const validity = { username: false, password: false, confirm: false };
  function updateRegisterBtn() {
    document.getElementById("registerBtn").disabled =
      !(validity.username && validity.password && validity.confirm);
  }

  // Controllo username con debounce 600ms
  let usernameTimer = null;
  document.getElementById("regUsername").oninput = () => {
    const msg      = document.getElementById("usernameMsg");
    const username = document.getElementById("regUsername").value.trim();
    clearTimeout(usernameTimer);
    validity.username = false;
    updateRegisterBtn();

    if (username.length < 3) {
      msg.className   = "auth-msg" + (username.length > 0 ? " error" : "");
      msg.textContent = username.length > 0 ? "At least 3 characters." : "";
      return;
    }

    msg.className   = "auth-msg";
    msg.textContent = "Checking…";

    usernameTimer = setTimeout(async () => {
      try {
        const available = await isUsernameAvailable(username);
        if (available) {
          msg.className   = "auth-msg success";
          msg.textContent = "✓ Username available";
          validity.username = true;
        } else {
          msg.className   = "auth-msg error";
          msg.textContent = "✗ Username already taken";
          validity.username = false;
        }
      } catch {
        msg.className   = "auth-msg error";
        msg.textContent = "Could not check username.";
        validity.username = false;
      }
      updateRegisterBtn();
    }, 600);
  };

  // Validazione password live
  function checkPasswordFields() {
    const password = document.getElementById("regPassword").value;
    const confirm  = document.getElementById("regPasswordConfirm").value;
    const failed   = validatePassword(password);

    PASSWORD_RULES.forEach((_, i) => {
      const li   = document.getElementById(`rule-${i}`);
      const icon = li.querySelector(".rule-icon");
      const ok   = PASSWORD_RULES[i].test(password);
      li.classList.toggle("ok", ok);
      icon.textContent = ok ? "✓" : "✗";
    });

    validity.password = failed.length === 0;

    const confirmMsg = document.getElementById("confirmMsg");
    if (confirm.length > 0) {
      if (password === confirm) {
        confirmMsg.className   = "auth-msg success";
        confirmMsg.textContent = "Passwords match ✓";
        validity.confirm = true;
      } else {
        confirmMsg.className   = "auth-msg error";
        confirmMsg.textContent = "Passwords do not match";
        validity.confirm = false;
      }
    } else {
      confirmMsg.textContent = "";
      validity.confirm = false;
    }
    updateRegisterBtn();
  }

  document.getElementById("regPassword").oninput        = checkPasswordFields;
  document.getElementById("regPasswordConfirm").oninput = checkPasswordFields;

  // LOGIN
  document.getElementById("loginBtn").onclick = async () => {
    const identifier = document.getElementById("loginIdentifier").value.trim();
    const password   = document.getElementById("loginPassword").value;
    const msg        = document.getElementById("loginMsg");
    const btn        = document.getElementById("loginBtn");

    msg.className = "auth-msg";
    msg.textContent = "";

    if (!identifier || !password) {
      msg.className   = "auth-msg error";
      msg.textContent = "Enter username/email and password.";
      return;
    }

    btn.disabled    = true;
    btn.textContent = "Logging in…";

    try {
      await signIn(identifier, password);
    } catch (err) {
      msg.className   = "auth-msg error";
      msg.textContent = err.message;
      btn.disabled    = false;
      btn.textContent = "Login";
    }
  };

  // REGISTER
  document.getElementById("registerBtn").onclick = async () => {
    const username = document.getElementById("regUsername").value.trim();
    const email    = document.getElementById("regEmail").value.trim();
    const password = document.getElementById("regPassword").value;
    const msg      = document.getElementById("registerMsg");
    const btn      = document.getElementById("registerBtn");

    msg.className   = "auth-msg";
    msg.textContent = "";
    btn.disabled    = true;
    btn.textContent = "Creating account…";

    try {
      // Doppio controllo race condition
      const available = await isUsernameAvailable(username);
      if (!available) {
        msg.className   = "auth-msg error";
        msg.textContent = "Username was just taken. Choose another.";
        btn.disabled    = false;
        btn.textContent = "Create account";
        return;
      }

      await signUp(email, password, username);
      msg.className   = "auth-msg success";
      msg.textContent = "Account created! Check your email to confirm.";
    } catch (err) {
      msg.className   = "auth-msg error";
      msg.textContent = err.message;
      btn.disabled    = false;
      btn.textContent = "Create account";
    }
  };
}