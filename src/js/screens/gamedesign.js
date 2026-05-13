// ============================================================
// screens/gamedesign.js — Schermata Game Design (solo admin).
// Lista carte + commenti con stelle e flag rework.
// Admin: camposssssss, gyomber, skyness
// ============================================================

import { db }            from '../core/supabase-client.js';
import { CardDatabase }  from '../data/cards.js';
import { getUser }       from '../auth/auth.js';
import { showGlobalToast } from '../core/ui.js';

const ADMIN_USERNAMES = ['camposssssss', 'gyomber', 'skyness'];

// ── Stato ─────────────────────────────────────────────────────
let _selectedCardId  = null;
let _currentUser     = null;
let _allComments     = {};   // cardId → array of comment objects
let _filters = {
  color:        'all',
  rework:       'all',   // 'all' | 'needs' | 'none'
  noComments:   false,
  sortBy:       'name_asc',
};

// ─────────────────────────────────────────────────────────────
// ENTRY POINT
// ─────────────────────────────────────────────────────────────
export async function renderGameDesignScreen() {
  const screen = document.getElementById('screen-gamedesign');
  if (!screen) return;

  _currentUser = await getUser();
  const username = _currentUser?.user_metadata?.username || '';

  if (!_currentUser || !ADMIN_USERNAMES.includes(username)) {
    screen.innerHTML = `<div class="gd-access-denied">
      <p>Accesso riservato agli admin.</p>
    </div>`;
    return;
  }

  screen.innerHTML = buildSkeleton();
  await loadAllComments();
  renderCardList();
  wireFilters();
}

// ─────────────────────────────────────────────────────────────
// SKELETON HTML
// ─────────────────────────────────────────────────────────────
function buildSkeleton() {
  return `
<div class="gd-root">
  <div class="gd-filters" id="gd-filters">
    <span class="gd-filters-label">Filters</span>

    <select class="gd-filter-select" id="gd-filter-color">
      <option value="all">All colors</option>
      <option value="blue">Blue</option>
      <option value="green">Green</option>
      <option value="red">Red</option>
      <option value="black">Black</option>
      <option value="colorless">Colorless</option>
    </select>

    <select class="gd-filter-select" id="gd-filter-rework">
      <option value="all">Any status</option>
      <option value="needs">Needs rework</option>
      <option value="none">No rework</option>
    </select>

    <label class="gd-filter-toggle" id="gd-filter-nocomments-label">
      <input type="checkbox" id="gd-filter-nocomments" />
      <span>No comments</span>
    </label>

    <select class="gd-filter-select" id="gd-filter-sort">
      <option value="name_asc">Name A→Z</option>
      <option value="name_desc">Name Z→A</option>
      <option value="stars_asc">Stars ↑</option>
      <option value="stars_desc">Stars ↓</option>
    </select>
  </div>

  <div class="gd-body">
    <div class="gd-card-list" id="gd-card-list"></div>

    <div class="gd-detail" id="gd-detail">
      <div class="gd-detail-empty">
        <span>Seleziona una carta per vedere i commenti</span>
      </div>
    </div>
  </div>
</div>`;
}

// ─────────────────────────────────────────────────────────────
// CARICAMENTO COMMENTI
// ─────────────────────────────────────────────────────────────
async function refreshSession() {
  const { data, error } = await db.auth.refreshSession();
  if (!error && data?.user) {
    _currentUser = data.user;
  }
}

async function loadAllComments() {
  await refreshSession();
  try {
    const { data, error } = await db
      .from('card_comments')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;

    _allComments = {};
    for (const c of (data || [])) {
      const key = String(c.card_id);
      if (!_allComments[key]) _allComments[key] = [];
      _allComments[key].push(c);
    }
  } catch (err) {
    console.warn('Errore caricamento commenti:', err.message);
    _allComments = {};
  }
}

// ─────────────────────────────────────────────────────────────
// LISTA CARTE (sinistra)
// ─────────────────────────────────────────────────────────────
function getFilteredCards() {
  let cards = [...CardDatabase];

  if (_filters.color !== 'all') {
    cards = cards.filter(c => c.color === _filters.color);
  }

  if (_filters.noComments) {
    cards = cards.filter(c => !(_allComments[String(c.id)]?.length));
  }

  if (_filters.rework === 'needs') {
    cards = cards.filter(c => {
      const comments = _allComments[String(c.id)] || [];
      return comments.some(cm => cm.rework === 'partial' || cm.rework === 'total');
    });
  } else if (_filters.rework === 'none') {
    cards = cards.filter(c => {
      const comments = _allComments[String(c.id)] || [];
      return !comments.some(cm => cm.rework === 'partial' || cm.rework === 'total');
    });
  }

  // Ordinamento
  cards.sort((a, b) => {
    if (_filters.sortBy === 'name_asc')  return a.name.localeCompare(b.name);
    if (_filters.sortBy === 'name_desc') return b.name.localeCompare(a.name);
    if (_filters.sortBy === 'stars_asc' || _filters.sortBy === 'stars_desc') {
      const avgA = avgStars(String(a.id));
      const avgB = avgStars(String(b.id));
      return _filters.sortBy === 'stars_asc' ? avgA - avgB : avgB - avgA;
    }
    return 0;
  });

  return cards;
}

function avgStars(cardId) {
  const comments = _allComments[String(cardId)] || [];
  if (!comments.length) return 0;
  return comments.reduce((s, c) => s + (c.stars || 0), 0) / comments.length;
}

function renderCardList() {
  const list = document.getElementById('gd-card-list');
  if (!list) return;

  const cards = getFilteredCards();

  if (!cards.length) {
    list.innerHTML = `<div class="gd-list-empty">Nessuna carta trovata.</div>`;
    return;
  }

  list.innerHTML = cards.map(card => {
    const cid    = String(card.id);
    const comms  = _allComments[cid] || [];
    const count  = comms.length;
    const avg    = avgStars(cid);
    const rework = comms.find(c => c.rework === 'total')  ? 'total'
                 : comms.find(c => c.rework === 'partial') ? 'partial'
                 : null;

    const reworkBadge = rework
      ? `<span class="gd-rework-badge gd-rework-${rework}">${rework === 'total' ? 'Rework' : 'Partial'}</span>`
      : '';

    const starStr = count ? `<span class="gd-list-stars">${'★'.repeat(Math.round(avg))}${'☆'.repeat(5 - Math.round(avg))}</span>` : '';
    const countBadge = count ? `<span class="gd-list-count">${count}</span>` : '';

    const active = _selectedCardId === cid ? ' gd-card-item--active' : '';

    return `<div class="gd-card-item${active}" data-card-id="${cid}">
  <div class="gd-card-item-color" style="background:${colorHex(card.color)}"></div>
  <div class="gd-card-item-info">
    <span class="gd-card-item-name">${card.name}</span>
    <span class="gd-card-item-type">${card.type || ''}</span>
  </div>
  <div class="gd-card-item-meta">
    ${reworkBadge}
    ${starStr}
    ${countBadge}
  </div>
</div>`;
  }).join('');

  list.querySelectorAll('.gd-card-item').forEach(el => {
    el.addEventListener('click', () => selectCard(el.dataset.cardId));
  });
}

// ─────────────────────────────────────────────────────────────
// DETTAGLIO CARTA (destra)
// ─────────────────────────────────────────────────────────────
function selectCard(cardId) {
  _selectedCardId = cardId;

  // Aggiorna highlight nella lista
  document.querySelectorAll('.gd-card-item').forEach(el => {
    el.classList.toggle('gd-card-item--active', el.dataset.cardId === cardId);
  });

  const card = CardDatabase.find(c => String(c.id) === cardId);
  if (!card) return;

  renderDetail(card);
}

function renderDetail(card) {
  const detail = document.getElementById('gd-detail');
  if (!detail) return;

  const comments = _allComments[String(card.id)] || [];

  detail.innerHTML = `
<div class="gd-detail-inner">
  <div class="gd-detail-image-wrap">
    <img class="gd-detail-image" src="${card.image}" alt="${card.name}" />
  </div>

  <div class="gd-detail-scroll">
    <div class="gd-add-comment-section">
      <h3 class="gd-section-title">Add comment</h3>
      <textarea class="gd-comment-textarea" id="gd-comment-input" placeholder="Scrivi un commento su questa carta…" rows="3"></textarea>

      <div class="gd-comment-meta-row">
        <div class="gd-stars-input" id="gd-stars-input" data-value="0">
          ${[1,2,3,4,5].map(n => `<button class="gd-star-btn" data-star="${n}" title="${n} stelle">☆</button>`).join('')}
        </div>

        <div class="gd-rework-input">
          <button class="gd-rework-btn" data-rework="partial" id="gd-rework-partial">Partial rework</button>
          <button class="gd-rework-btn" data-rework="total"   id="gd-rework-total">Total rework</button>
        </div>
      </div>

      <button class="primary-btn gd-submit-btn" id="gd-submit-comment">Submit comment</button>
    </div>

    <div class="gd-comments-section">
      <h3 class="gd-section-title">Comments <span class="gd-comments-count">${comments.length}</span></h3>
      <div id="gd-comments-list">
        ${renderCommentsList(comments)}
      </div>
    </div>
  </div>
</div>`;

  wireDetailEvents(card);
}

function renderCommentsList(comments) {
  if (!comments.length) {
    return `<div class="gd-no-comments">Nessun commento ancora.</div>`;
  }
  return comments.map(c => {
    const stars  = '★'.repeat(c.stars) + '☆'.repeat(5 - c.stars);
    const rework = c.rework
      ? `<span class="gd-rework-badge gd-rework-${c.rework}">${c.rework === 'total' ? 'Rework' : 'Partial'}</span>`
      : '';
    const date = new Date(c.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
    const canEdit = _currentUser && c.author_user_id === _currentUser.id;

    return `<div class="gd-comment" data-comment-id="${c.id}">
  <div class="gd-comment-header">
    <span class="gd-comment-author">${c.author_username}</span>
    <span class="gd-comment-stars">${stars}</span>
    ${rework}
    <span class="gd-comment-date">${date}</span>
    ${canEdit ? `<button class="gd-edit-btn" data-comment-id="${c.id}" title="Modifica">✎</button>` : ''}
    ${canEdit ? `<button class="gd-delete-btn" data-comment-id="${c.id}" title="Elimina">✕</button>` : ''}
  </div>
  <p class="gd-comment-text">${escapeHtml(c.comment_text)}</p>
</div>`;
  }).join('');
}

// ─────────────────────────────────────────────────────────────
// EVENTI DETTAGLIO
// ─────────────────────────────────────────────────────────────
function wireDetailEvents(card) {
  // Stelle interattive
  let selectedStars  = 0;
  let selectedRework = null;

  const starsInput = document.getElementById('gd-stars-input');
  const starBtns   = starsInput?.querySelectorAll('.gd-star-btn') || [];

  function updateStarUI(hovered) {
    const val = hovered ?? selectedStars;
    starBtns.forEach(btn => {
      const n = Number(btn.dataset.star);
      btn.textContent = n <= val ? '★' : '☆';
      btn.classList.toggle('gd-star-btn--on', n <= val);
    });
  }

  starBtns.forEach(btn => {
    btn.addEventListener('mouseenter', () => updateStarUI(Number(btn.dataset.star)));
    btn.addEventListener('mouseleave', () => updateStarUI(null));
    btn.addEventListener('click', () => {
      selectedStars = Number(btn.dataset.star);
      updateStarUI(null);
    });
  });

  // Rework buttons
  const reworkBtns = document.querySelectorAll('.gd-rework-btn');
  reworkBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const val = btn.dataset.rework;
      if (selectedRework === val) {
        selectedRework = null;
        reworkBtns.forEach(b => b.classList.remove('gd-rework-btn--active'));
      } else {
        selectedRework = val;
        reworkBtns.forEach(b => b.classList.toggle('gd-rework-btn--active', b.dataset.rework === val));
      }
    });
  });

  // Submit
  document.getElementById('gd-submit-comment')?.addEventListener('click', async () => {
    const text = document.getElementById('gd-comment-input')?.value?.trim();
    if (!text)          { showGlobalToast('Scrivi un commento.', 'error'); return; }
    if (!selectedStars) { showGlobalToast('Seleziona almeno una stella.', 'error'); return; }

    await submitComment(card, text, selectedStars, selectedRework);
  });

  // Edit / Delete
  document.getElementById('gd-comments-list')?.addEventListener('click', async e => {
    if (e.target.closest('.gd-delete-btn')) {
      await deleteComment(e.target.closest('.gd-delete-btn').dataset.commentId, card);
      return;
    }
    if (e.target.closest('.gd-edit-btn')) {
      const commentId = e.target.closest('.gd-edit-btn').dataset.commentId;
      const comment   = (_allComments[String(card.id)] || []).find(c => c.id === commentId);
      if (comment) startEditComment(comment, card);
    }
  });
}

// ─────────────────────────────────────────────────────────────
// SUBMIT / DELETE
// ─────────────────────────────────────────────────────────────
async function submitComment(card, text, stars, rework) {
  const btn = document.getElementById('gd-submit-comment');
  if (btn) btn.disabled = true;

  await refreshSession();

  try {
    const username = _currentUser?.user_metadata?.username || '';
    const payload = {
      card_id:        Number(card.id),
      author_user_id: _currentUser.id,
      author_username: username,
      comment_text:   text,
      stars,
      rework:         rework || null,
    };

    const { data, error } = await db
      .from('card_comments')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;

    // Aggiorna cache locale
    const cid = String(card.id);
    if (!_allComments[cid]) _allComments[cid] = [];
    _allComments[cid].unshift(data);

    showGlobalToast('Commento aggiunto.', 'success');
    renderCardList();
    renderDetail(card);
  } catch (err) {
    console.error('Errore submit commento:', err);
    showGlobalToast('Errore nel salvataggio.', 'error');
    if (btn) btn.disabled = false;
  }
}

async function deleteComment(commentId, card) {
  try {
    const { error } = await db
      .from('card_comments')
      .delete()
      .eq('id', commentId);
    if (error) throw error;

    const cid = String(card.id);
    _allComments[cid] = (_allComments[cid] || []).filter(c => c.id !== commentId);

    showGlobalToast('Commento eliminato.', 'success');
    renderCardList();
    renderDetail(card);
  } catch (err) {
    console.error('Errore delete commento:', err);
    showGlobalToast('Errore nell\'eliminazione.', 'error');
  }
}

function startEditComment(comment, card) {
  const el = document.querySelector(`.gd-comment[data-comment-id="${comment.id}"]`);
  if (!el) return;

  const starsHtml = [1,2,3,4,5].map(n =>
    `<button class="gd-star-btn${n <= comment.stars ? ' gd-star-btn--on' : ''}" data-star="${n}">${n <= comment.stars ? '★' : '☆'}</button>`
  ).join('');

  el.innerHTML = `
<div class="gd-comment-edit">
  <textarea class="gd-comment-textarea gd-comment-edit-textarea" rows="3">${escapeHtml(comment.comment_text)}</textarea>
  <div class="gd-comment-meta-row">
    <div class="gd-stars-input" id="gd-edit-stars-${comment.id}">${starsHtml}</div>
    <div class="gd-rework-input">
      <button class="gd-rework-btn${comment.rework === 'partial' ? ' gd-rework-btn--active' : ''}" data-rework="partial">Partial rework</button>
      <button class="gd-rework-btn${comment.rework === 'total'   ? ' gd-rework-btn--active' : ''}" data-rework="total">Total rework</button>
    </div>
  </div>
  <div class="gd-comment-edit-actions">
    <button class="primary-btn gd-save-edit-btn" data-comment-id="${comment.id}">Save</button>
    <button class="secondary-btn gd-cancel-edit-btn" data-comment-id="${comment.id}">Cancel</button>
  </div>
</div>`;

  let editStars  = comment.stars;
  let editRework = comment.rework || null;

  // Stelle
  const starBtns = el.querySelectorAll('.gd-star-btn');
  function updateEditStarUI(hovered) {
    const val = hovered ?? editStars;
    starBtns.forEach(b => {
      const n = Number(b.dataset.star);
      b.textContent = n <= val ? '★' : '☆';
      b.classList.toggle('gd-star-btn--on', n <= val);
    });
  }
  starBtns.forEach(b => {
    b.addEventListener('mouseenter', () => updateEditStarUI(Number(b.dataset.star)));
    b.addEventListener('mouseleave', () => updateEditStarUI(null));
    b.addEventListener('click', () => { editStars = Number(b.dataset.star); updateEditStarUI(null); });
  });

  // Rework
  const reworkBtns = el.querySelectorAll('.gd-rework-btn');
  reworkBtns.forEach(b => {
    b.addEventListener('click', () => {
      const val = b.dataset.rework;
      editRework = editRework === val ? null : val;
      reworkBtns.forEach(rb => rb.classList.toggle('gd-rework-btn--active', rb.dataset.rework === editRework));
    });
  });

  // Save
  el.querySelector('.gd-save-edit-btn').addEventListener('click', async () => {
    const text = el.querySelector('.gd-comment-edit-textarea').value.trim();
    if (!text)       { showGlobalToast('Il commento non può essere vuoto.', 'error'); return; }
    if (!editStars)  { showGlobalToast('Seleziona almeno una stella.', 'error'); return; }
    await saveEditComment(comment, card, text, editStars, editRework);
  });

  // Cancel
  el.querySelector('.gd-cancel-edit-btn').addEventListener('click', () => {
    renderDetail(card);
    // Ripristina scroll position
    document.querySelector('.gd-detail-scroll')?.scrollTo(0, 0);
  });
}

async function saveEditComment(comment, card, text, stars, rework) {
  await refreshSession();
  try {
    const { data, error } = await db
      .from('card_comments')
      .update({ comment_text: text, stars, rework: rework || null })
      .eq('id', comment.id)
      .select()
      .single();
    if (error) throw error;

    const cid = String(card.id);
    const idx = (_allComments[cid] || []).findIndex(c => c.id === comment.id);
    if (idx !== -1) _allComments[cid][idx] = data;

    showGlobalToast('Commento aggiornato.', 'success');
    renderCardList();
    renderDetail(card);
  } catch (err) {
    console.error('Errore update commento:', err);
    showGlobalToast('Errore nel salvataggio.', 'error');
  }
}

// ─────────────────────────────────────────────────────────────
// FILTRI
// ─────────────────────────────────────────────────────────────
function wireFilters() {
  document.getElementById('gd-filter-color')?.addEventListener('change', e => {
    _filters.color = e.target.value;
    renderCardList();
  });

  document.getElementById('gd-filter-rework')?.addEventListener('change', e => {
    _filters.rework = e.target.value;
    renderCardList();
  });

  document.getElementById('gd-filter-nocomments')?.addEventListener('change', e => {
    _filters.noComments = e.target.checked;
    renderCardList();
  });

  document.getElementById('gd-filter-sort')?.addEventListener('change', e => {
    _filters.sortBy = e.target.value;
    renderCardList();
  });
}

// ─────────────────────────────────────────────────────────────
// UTILITY
// ─────────────────────────────────────────────────────────────
const COLOR_HEX = {
  blue:      '#336699',
  green:     '#385400',
  red:       '#8A0000',
  black:     '#262B2F',
  colorless: '#A19993',
};

function colorHex(color) {
  return COLOR_HEX[color] ?? COLOR_HEX.colorless;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
