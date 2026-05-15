// ============================================================
// auth/auth-screen.js — Schermata Login / Registrazione.
// ============================================================

import { signIn, signUp, isUsernameAvailable } from './auth.js';
import { assetPath } from '../core/router.js';

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
    <div class="auth-split">

      <div class="auth-left-panel">
        <div class="auth-logo-row">
          <img src="${assetPath('src/assets/rafflesia-logo.png')}" alt="Rafflesia TCG" class="auth-logo-img">
        </div>

        <!-- LOGIN -->
        <div class="auth-form-area" id="authLoginArea">
          <h1 class="auth-welcome-title">Welcome Back to Rafflesia!</h1>
          <p class="auth-welcome-sub">Please log in to your account.</p>

          <div class="auth-field">
            <label for="loginIdentifier">Email or Username</label>
            <input class="input auth-input" type="text" id="loginIdentifier"
              placeholder="email or username" autocomplete="username" />
          </div>

          <div class="auth-field">
            <label for="loginPassword">Password</label>
            <div class="auth-eye-wrap">
              <input class="input auth-input" type="password" id="loginPassword"
                placeholder="••••••••" autocomplete="current-password" />
              <button class="eye-btn" id="loginEyeBtn" tabindex="-1">👁</button>
            </div>
          </div>

          <div class="auth-options-row">
            <label class="auth-remember" for="rememberMe">
              <input type="checkbox" id="rememberMe" />
              Remember me
            </label>
          </div>

          <p class="auth-msg" id="loginMsg" style="min-height:18px; margin-bottom:8px;"></p>
          <button class="auth-btn-primary" id="loginBtn">Login</button>
          <button class="auth-btn-secondary" id="goToRegisterBtn">Create account</button>
        </div>

        <!-- REGISTER -->
        <div class="auth-form-area" id="authRegisterArea" style="display:none;">
          <h1 class="auth-welcome-title">Create Account</h1>
          <p class="auth-welcome-sub">Join Rafflesia TCG and build your deck.</p>

          <div class="auth-field">
            <label for="regUsername">Username</label>
            <input class="input auth-input" type="text" id="regUsername"
              placeholder="Make it memorable" autocomplete="username" />
            <p id="usernameMsg" class="auth-msg" style="margin-top:4px; font-size:12px;"></p>
          </div>

          <div class="auth-field">
            <label for="regEmail">Email</label>
            <input class="input auth-input" type="email" id="regEmail"
              placeholder="email@example.com" autocomplete="email" />
          </div>

          <div class="auth-field">
            <label for="regPassword">Password</label>
            <div class="auth-eye-wrap">
              <input class="input auth-input" type="password" id="regPassword"
                placeholder="Min 8 chars" autocomplete="new-password" />
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

          <div class="auth-field">
            <label for="regPasswordConfirm">Confirm Password</label>
            <div class="auth-eye-wrap">
              <input class="input auth-input" type="password" id="regPasswordConfirm"
                placeholder="Repeat password" autocomplete="new-password" />
              <button class="eye-btn" id="regEyeBtn2" tabindex="-1">👁</button>
            </div>
            <p id="confirmMsg" class="auth-msg" style="margin-top:4px;"></p>
          </div>

          <p class="auth-msg" id="registerMsg" style="min-height:18px; margin-bottom:8px;"></p>
          <button class="auth-btn-primary" id="registerBtn" disabled>Create account</button>
          <button class="auth-btn-secondary" id="backToLoginBtn">Back to Login</button>
        </div>

        <p class="auth-disclaimer">By creating an account you agree to our terms and data policy.</p>
      </div>

      <div class="auth-right-panel">
        <img class="auth-bg-img" src="${assetPath('src/assets/login.jpg')}" alt="" />
        <div class="auth-glass-overlay"></div>
      </div>

    </div>
  `;

  // Panel switch
  document.getElementById("goToRegisterBtn").onclick = () => {
    document.getElementById("authLoginArea").style.display = "none";
    document.getElementById("authRegisterArea").style.display = "flex";
  };
  document.getElementById("backToLoginBtn").onclick = () => {
    document.getElementById("authRegisterArea").style.display = "none";
    document.getElementById("authLoginArea").style.display = "flex";
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

  // Register validation state
  const validity = { username: false, password: false, confirm: false };
  function updateRegisterBtn() {
    document.getElementById("registerBtn").disabled =
      !(validity.username && validity.password && validity.confirm);
  }

  // Username check with debounce 600ms
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

  // Live password validation
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
    const rememberMe = document.getElementById("rememberMe").checked;
    const msg        = document.getElementById("loginMsg");
    const btn        = document.getElementById("loginBtn");

    msg.className   = "auth-msg";
    msg.textContent = "";

    if (!identifier || !password) {
      msg.className   = "auth-msg error";
      msg.textContent = "Enter email/username and password.";
      return;
    }

    btn.disabled    = true;
    btn.textContent = "Logging in…";

    try {
      await signIn(identifier, password, rememberMe);
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
