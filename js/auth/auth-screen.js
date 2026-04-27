// ============================================================
// auth/auth-screen.js — Schermata Login / Registrazione.
// ============================================================

import { signIn, signUp } from './auth.js';

export function renderAuthScreen() {
  const screen = document.getElementById("screen-auth");

  screen.innerHTML = `
    <h2 class="page-title">Account</h2>
    <p class="page-subtitle">Login to register your decks and play with friends (wip).</p>

    <div class="auth-tabs">
      <button class="auth-tab active" id="loginTab">Login</button>
      <button class="auth-tab"        id="registerTab">Register</button>
    </div>

    <div class="card-panel" id="loginForm">
      <div class="setting-row">
        <label for="loginEmail">Email</label>
        <input class="input" type="email" id="loginEmail" placeholder="email@example.com" />
      </div>
      <div class="setting-row">
        <label for="loginPassword">Password</label>
        <input class="input" type="password" id="loginPassword" placeholder="••••••••" />
      </div>
      <div class="row" style="margin-top: 20px;">
        <button class="primary-btn" id="loginBtn">Login</button>
        <p id="loginMsg" class="auth-msg"></p>
      </div>
    </div>

    <div class="card-panel" id="registerForm" style="display: none;">
      <div class="setting-row">
        <label for="regUsername">Username</label>
        <input class="input" type="text" id="regUsername" placeholder="Make it memorable" />
      </div>
      <div class="setting-row">
        <label for="regEmail">Email</label>
        <input class="input" type="email" id="regEmail" placeholder="email@example.com" />
      </div>
      <div class="setting-row">
        <label for="regPassword">Password</label>
        <input class="input" type="password" id="regPassword" placeholder="At least 6 characters" />
      </div>
      <div class="row" style="margin-top: 20px;">
        <button class="primary-btn" id="registerBtn">Create account</button>
        <p id="registerMsg" class="auth-msg"></p>
      </div>
    </div>
  `;

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
    } catch (err) {
      msg.className   = "auth-msg error";
      msg.textContent = err.message;
    } finally {
      btn.disabled = false;
    }
  };

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
      msg.textContent = "Enter username.";
      return;
    }

    btn.disabled = true;

    try {
      await signUp(email, password, username);
      msg.className   = "auth-msg success";
      msg.textContent = "Account created! Check your email to confirm.";
    } catch (err) {
      msg.className   = "auth-msg error";
      msg.textContent = err.message;
      btn.disabled    = false;
    }
  };
}
