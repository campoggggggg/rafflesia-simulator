// deckbuilder-dialog.js — Dialog generica e publish dialog.

import { AppState, getCurrentDeck }               from '../core/state.js';
import { getUser }                                from '../auth/auth.js';
import { CardDatabase, CardMap }                  from '../data/cards.js';
import { db }                                     from '../core/supabase-client.js';
import { showGlobalToast as showToast }           from '../core/ui.js';

const MAX_MAIN      = 29;
const MAX_TERRITORY = 15;

function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Dialog generica ───────────────────────────────────────────

export function openDialog(msg, inputDefault, onOk) {
  const overlay = document.getElementById('db-overlay');
  const msgEl   = document.getElementById('db-dlg-msg');
  const inp     = document.getElementById('db-dlg-inp');

  msgEl.textContent  = msg;
  inp.style.display  = inputDefault !== null ? 'block' : 'none';
  inp.value          = inputDefault ?? '';
  overlay.classList.remove('hidden');

  document.getElementById('db-dlg-ok').onclick = async () => { closeDialog(); await onOk(inp.value); };
  inp.onkeydown = async e => {
    if (e.key === 'Enter')  { closeDialog(); await onOk(inp.value); }
    if (e.key === 'Escape') closeDialog();
  };
  if (inputDefault !== null) setTimeout(() => { inp.focus(); inp.select(); }, 30);
}

export function closeDialog() {
  document.getElementById('db-overlay')?.classList.add('hidden');
}

// ── Publish dialog ────────────────────────────────────────────

export async function onPublish() {
  const deck = getCurrentDeck();
  const user = await getUser();
  if (!user) { showToast('Devi essere loggato per pubblicare.'); return; }

  if (!deck.territoryCards) deck.territoryCards = [];
  if (!deck.sideboardCards)  deck.sideboardCards = [];

  const totalCards = (deck.commanderId ? 1 : 0) + deck.cards.length + deck.territoryCards.length;
  const totalRequired = 1 + MAX_MAIN + MAX_TERRITORY;
  const isComplete = deck.commanderId && deck.cards.length === MAX_MAIN && deck.territoryCards.length === MAX_TERRITORY;
  if (!isComplete) {
    showToast(`Mazzo incompleto. Servono commander + ${MAX_MAIN} main + ${MAX_TERRITORY} territory (${totalCards}/${totalRequired}).`);
    return;
  }

  const commander = deck.commanderId
    ? CardMap.get(String(deck.commanderId))
    : null;

  _openPublishDialog(deck.name, async ({ tags, description }) => {
    const btn = document.getElementById('db-publish');
    if (btn) { btn.disabled = true; btn.textContent = '…'; }

    try {
      const { error } = await db.from('public_decks').insert({
        name:            deck.name,
        author_username: AppState.username || user.email?.split('@')[0] || 'Anonimo',
        author_user_id:  user.id,
        commander_id:    deck.commanderId   || null,
        commander_color: commander?.color   || 'colorless',
        cards:           deck.cards          || [],
        territory_cards: deck.territoryCards || [],
        sideboard_cards: deck.sideboardCards || [],
        tags,
        description:     description        || null,
      });

      if (error) throw error;
      showToast(`"${deck.name}" pubblicato con successo!`);
    } catch (err) {
      console.error('Errore pubblicazione:', err);
      showToast('Errore durante la pubblicazione.');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '⬆ publish'; }
    }
  });
}

function _openPublishDialog(deckName, onOk) {
  const overlay = document.getElementById('db-overlay');
  const dialog  = overlay.querySelector('.db-dialog');

  const currentTags = [];

  dialog.innerHTML = `
    <p class="db-dlg-msg">Pubblica <strong>${esc(deckName)}</strong> nei mazzi pubblici?</p>
    <div class="db-pub-tag-section">
      <label class="db-fl" style="margin-bottom:6px;display:block;">Tags (max 3 | press Enter to confirm)</label>
      <div class="db-pub-tag-pills" id="db-pub-pills"></div>
      <input class="db-fi db-pub-tag-inp" id="db-pub-tag-inp" type="text"
             placeholder="aggiungi tag…" autocomplete="off" style="margin-top:8px;width:100%;box-sizing:border-box;">
      <div class="db-pub-tag-hint" id="db-pub-tag-hint"></div>
    </div>
    <div class="db-pub-desc-section" style="margin-top:14px;">
      <label class="db-fl" style="margin-bottom:6px;display:block;">Descrizione (opzionale)</label>
      <textarea class="db-fi" id="db-pub-desc-inp" rows="5"
                placeholder="Descrivi la strategia del tuo mazzo…"
                style="width:100%;box-sizing:border-box;resize:vertical;font-family:inherit;font-size:13px;line-height:1.5;"></textarea>
    </div>
    <div class="db-dlg-acts">
      <button class="db-btn" id="db-pub-cancel">Annulla</button>
      <button class="db-btn db-btn-primary" id="db-pub-ok">Pubblica</button>
    </div>`;

  overlay.classList.remove('hidden');

  const pillsEl = dialog.querySelector('#db-pub-pills');
  const inp     = dialog.querySelector('#db-pub-tag-inp');
  const hint    = dialog.querySelector('#db-pub-tag-hint');

  function renderPills() {
    pillsEl.innerHTML = currentTags.map((t, i) =>
      `<span class="db-pub-pill">${esc(t)}<button class="db-pub-pill-rm" data-i="${i}">✕</button></span>`
    ).join('');
    pillsEl.querySelectorAll('.db-pub-pill-rm').forEach(btn =>
      btn.addEventListener('click', () => { currentTags.splice(+btn.dataset.i, 1); renderPills(); })
    );
    hint.textContent = currentTags.length >= 3 ? 'Limite di 3 tag raggiunto.' : '';
    inp.disabled = currentTags.length >= 3;
  }

  function addTag() {
    const raw = inp.value.replace(/[,\s]/g, '').trim().toLowerCase();
    if (!raw) return;
    if (currentTags.length >= 3) return;
    if (currentTags.includes(raw)) { inp.value = ''; return; }
    currentTags.push(raw);
    inp.value = '';
    renderPills();
  }

  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); }
    if (e.key === 'Escape') _closePublishDialog(dialog, overlay);
  });
  inp.addEventListener('input', () => {
    if (inp.value.includes(',')) addTag();
  });

  dialog.querySelector('#db-pub-ok').addEventListener('click', () => {
    addTag();
    const description = dialog.querySelector('#db-pub-desc-inp')?.value.trim() || '';
    _closePublishDialog(dialog, overlay);
    onOk({ tags: currentTags, description });
  });
  dialog.querySelector('#db-pub-cancel').addEventListener('click', () => {
    _closePublishDialog(dialog, overlay);
  });
  overlay.onclick = e => { if (e.target === overlay) _closePublishDialog(dialog, overlay); };

  setTimeout(() => inp.focus(), 30);
}

function _closePublishDialog(dialog, overlay) {
  overlay.classList.add('hidden');
  dialog.innerHTML = `
    <p class="db-dlg-msg" id="db-dlg-msg"></p>
    <input class="db-fi" id="db-dlg-inp" type="text">
    <div class="db-dlg-acts">
      <button class="db-btn" id="db-dlg-cancel">Annulla</button>
      <button class="db-btn db-btn-primary" id="db-dlg-ok">Conferma</button>
    </div>`;
  document.getElementById('db-dlg-cancel').onclick = closeDialog;
}
