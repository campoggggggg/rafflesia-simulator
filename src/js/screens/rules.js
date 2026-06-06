// screens/rules.js — Regolamento del gioco

import { updateBackButtons, getBasePath } from '../core/router.js';

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function renderRulesScreen() {
  const screen = document.getElementById('screen-rules');
  if (!screen) return;

  screen.innerHTML = `
    <div class="rules-root">
      <h2 class="page-title">Rules</h2>
      <div class="rules-content" id="rulesContent">
        <div class="rules-loading">Loading…</div>
      </div>
    </div>
  `;

  _injectRulesStyles();
  updateBackButtons();

  try {
    const base = getBasePath();
    const res  = await fetch(`${base}/src/rules.txt?v=${Date.now()}`);
    if (!res.ok) throw new Error('not found');
    const text = await res.text();
    const el   = document.getElementById('rulesContent');
    if (el) el.innerHTML = `<pre class="rules-pre">${esc(text)}</pre>`;
  } catch {
    const el = document.getElementById('rulesContent');
    if (el) el.innerHTML = `<div class="rules-placeholder">Rules coming soon.</div>`;
  }
}

function _injectRulesStyles() {
  if (document.getElementById('rules-styles')) return;
  const s = document.createElement('style');
  s.id = 'rules-styles';
  s.textContent = `
    .rules-root {
      max-width: 860px;
      margin: 0 auto;
      padding: calc(58px + 32px) 36px 48px;
    }
    .rules-content {
      margin-top: 24px;
      background: var(--bg-elevated);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 28px 32px;
    }
    .rules-pre {
      font-family: 'Inter', 'Courier New', monospace;
      font-size: 13px;
      line-height: 1.8;
      color: var(--text-primary);
      white-space: pre-wrap;
      word-break: break-word;
      margin: 0;
    }
    .rules-loading, .rules-placeholder {
      color: var(--text-secondary);
      font-size: 14px;
      text-align: center;
      padding: 40px 0;
    }
  `;
  document.head.appendChild(s);
}
