// ============================================================
// screens/gamedesign.js — Schermata Game Design (solo admin).
// Tab "Cards": lista carte + commenti con stelle e flag rework.
// Tab "Colors": commenti sull'identità di ogni colore.
// Admin: camposssssss, gyomber, skyness
// ============================================================

import { db }            from '../core/supabase-client.js';
import { CardDatabase }  from '../data/cards.js';
import { getUser }       from '../auth/auth.js';
import { showGlobalToast } from '../core/ui.js';

const ADMIN_USERNAMES = ['camposssssss', 'gyomber', 'skyness'];

const COLORS = [
  { key: 'blue',      label: 'Blue',      hex: '#336699' },
  { key: 'green',     label: 'Green',     hex: '#385400' },
  { key: 'red',       label: 'Red',       hex: '#8A0000' },
  { key: 'black',     label: 'Black',     hex: '#262B2F' },
  { key: 'colorless', label: 'Colorless', hex: '#A19993' },
];

// ── Stato ─────────────────────────────────────────────────────
let _activeTab       = 'cards';   // 'cards' | 'colors'
let _selectedCardId  = null;
let _selectedColor   = null;
let _currentUser     = null;
let _allComments     = {};        // cardId → array
let _colorComments   = {};        // colorKey → array
let _filters = {
  color:      'all',
  rework:     'all',
  noComments: false,
  sortBy:     'name_asc',
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
    screen.innerHTML = `<div class="gd-access-denied"><p>Accesso riservato agli admin.</p></div>`;
    return;
  }

  screen.innerHTML = buildSkeleton();
  await Promise.all([loadAllComments(), loadAllColorComments()]);
  renderCardList();
  wireFilters();
  wireTabs();
}

// ─────────────────────────────────────────────────────────────
// SKELETON
// ─────────────────────────────────────────────────────────────
function buildSkeleton() {
  return `
<div class="gd-root">

  <div class="gd-tabs-bar">
    <button class="gd-tab gd-tab--active" data-tab="cards">Cards</button>
    <button class="gd-tab" data-tab="colors">Colors</button>
  </div>

  <!-- TAB: CARDS -->
  <div class="gd-tab-panel" id="gd-panel-cards">
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
      <label class="gd-filter-toggle">
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
        <div class="gd-detail-empty"><span>Seleziona una carta per vedere i commenti</span></div>
      </div>
    </div>
  </div>

  <!-- TAB: COLORS -->
  <div class="gd-tab-panel gd-tab-panel--hidden" id="gd-panel-colors">
    <div class="gd-body">
      <div class="gd-color-list" id="gd-color-list">
        ${COLORS.map(c => `
        <div class="gd-color-item" data-color="${c.key}">
          <div class="gd-color-item-dot" style="background:${c.hex}"></div>
          <span class="gd-color-item-name">${c.label}</span>
          <span class="gd-color-item-count" id="gd-color-count-${c.key}">0</span>
        </div>`).join('')}
      </div>
      <div class="gd-detail" id="gd-color-detail">
        <div class="gd-detail-empty"><span>Seleziona un colore per vedere i commenti</span></div>
      </div>
    </div>
  </div>

</div>`;
}

// ─────────────────────────────────────────────────────────────
// TABS
// ─────────────────────────────────────────────────────────────
function wireTabs() {
  document.querySelectorAll('.gd-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      _activeTab = btn.dataset.tab;
      document.querySelectorAll('.gd-tab').forEach(b => b.classList.toggle('gd-tab--active', b === btn));
      document.getElementById('gd-panel-cards').classList.toggle('gd-tab-panel--hidden', _activeTab !== 'cards');
      document.getElementById('gd-panel-colors').classList.toggle('gd-tab-panel--hidden', _activeTab !== 'colors');
    });
  });

  // Click su colori
  document.getElementById('gd-color-list')?.addEventListener('click', e => {
    const item = e.target.closest('.gd-color-item');
    if (!item) return;
    _selectedColor = item.dataset.color;
    document.querySelectorAll('.gd-color-item').forEach(el =>
      el.classList.toggle('gd-color-item--active', el.dataset.color === _selectedColor));
    renderColorDetail(_selectedColor);
  });

  updateColorCounts();
}

function updateColorCounts() {
  COLORS.forEach(c => {
    const el = document.getElementById(`gd-color-count-${c.key}`);
    if (el) el.textContent = (_colorComments[c.key] || []).length;
  });
}

// ─────────────────────────────────────────────────────────────
// CARICAMENTO DATI
// ─────────────────────────────────────────────────────────────
async function refreshSession() {
  const { data, error } = await db.auth.refreshSession();
  if (!error && data?.user) _currentUser = data.user;
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
    console.warn('Errore caricamento commenti carta:', err.message);
    _allComments = {};
  }
}

async function loadAllColorComments() {
  try {
    const { data, error } = await db
      .from('color_comments')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    _colorComments = {};
    for (const c of (data || [])) {
      if (!_colorComments[c.color]) _colorComments[c.color] = [];
      _colorComments[c.color].push(c);
    }
  } catch (err) {
    console.warn('Errore caricamento commenti colore:', err.message);
    _colorComments = {};
  }
}

// ─────────────────────────────────────────────────────────────
// LISTA CARTE
// ─────────────────────────────────────────────────────────────
function getFilteredCards() {
  let cards = [...CardDatabase];
  if (_filters.color !== 'all')  cards = cards.filter(c => c.color === _filters.color);
  if (_filters.noComments)       cards = cards.filter(c => !(_allComments[String(c.id)]?.length));
  if (_filters.rework === 'needs') {
    cards = cards.filter(c => (_allComments[String(c.id)] || []).some(cm => cm.rework));
  } else if (_filters.rework === 'none') {
    cards = cards.filter(c => !(_allComments[String(c.id)] || []).some(cm => cm.rework));
  }
  cards.sort((a, b) => {
    if (_filters.sortBy === 'name_asc')   return a.name.localeCompare(b.name);
    if (_filters.sortBy === 'name_desc')  return b.name.localeCompare(a.name);
    const avgA = avgStars(_allComments[String(a.id)] || []);
    const avgB = avgStars(_allComments[String(b.id)] || []);
    return _filters.sortBy === 'stars_asc' ? avgA - avgB : avgB - avgA;
  });
  return cards;
}

function avgStars(comments) {
  if (!comments.length) return 0;
  return comments.reduce((s, c) => s + (c.stars || 0), 0) / comments.length;
}

function renderCardList() {
  const list = document.getElementById('gd-card-list');
  if (!list) return;
  const cards = getFilteredCards();
  if (!cards.length) { list.innerHTML = `<div class="gd-list-empty">Nessuna carta trovata.</div>`; return; }

  list.innerHTML = cards.map(card => {
    const cid    = String(card.id);
    const comms  = _allComments[cid] || [];
    const avg    = avgStars(comms);
    const rework = comms.find(c => c.rework === 'total') ? 'total'
                 : comms.find(c => c.rework === 'partial') ? 'partial' : null;
    const reworkBadge = rework
      ? `<span class="gd-rework-badge gd-rework-${rework}">${rework === 'total' ? 'Rework' : 'Partial'}</span>` : '';
    const starStr    = comms.length ? `<span class="gd-list-stars">${'★'.repeat(Math.round(avg))}${'☆'.repeat(5 - Math.round(avg))}</span>` : '';
    const countBadge = comms.length ? `<span class="gd-list-count">${comms.length}</span>` : '';
    const active     = _selectedCardId === cid ? ' gd-card-item--active' : '';

    return `<div class="gd-card-item${active}" data-card-id="${cid}">
  <div class="gd-card-item-color" style="background:${colorHex(card.color)}"></div>
  <div class="gd-card-item-info">
    <span class="gd-card-item-name">${card.name}</span>
    <span class="gd-card-item-type">${card.type || ''}</span>
  </div>
  <div class="gd-card-item-meta">${reworkBadge}${starStr}${countBadge}</div>
</div>`;
  }).join('');

  list.querySelectorAll('.gd-card-item').forEach(el =>
    el.addEventListener('click', () => selectCard(el.dataset.cardId)));
}

// ─────────────────────────────────────────────────────────────
// DETTAGLIO CARTA
// ─────────────────────────────────────────────────────────────
function selectCard(cardId) {
  _selectedCardId = cardId;
  document.querySelectorAll('.gd-card-item').forEach(el =>
    el.classList.toggle('gd-card-item--active', el.dataset.cardId === cardId));
  const card = CardDatabase.find(c => String(c.id) === cardId);
  if (card) renderDetail(card);
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
    ${buildCommentForm('gd-card')}
    <div class="gd-comments-section">
      <h3 class="gd-section-title">Comments <span class="gd-comments-count">${comments.length}</span></h3>
      <div id="gd-card-comments-list">${renderCommentsList(comments)}</div>
    </div>
  </div>
</div>`;

  wireCommentForm({
    prefix:      'gd-card',
    listId:      'gd-card-comments-list',
    onSubmit:    (text, stars, rework) => submitComment(card, text, stars, rework),
    onEditStart: (commentId) => {
      const comment = (_allComments[String(card.id)] || []).find(c => c.id === commentId);
      if (comment) startEditComment(comment, card, 'card');
    },
    onDelete:    (commentId) => deleteComment(commentId, card),
  });
}

// ─────────────────────────────────────────────────────────────
// DETTAGLIO COLORE
// ─────────────────────────────────────────────────────────────
function renderColorDetail(colorKey) {
  const detail = document.getElementById('gd-color-detail');
  if (!detail) return;
  const color    = COLORS.find(c => c.key === colorKey);
  const comments = _colorComments[colorKey] || [];

  detail.innerHTML = `
<div class="gd-detail-inner">
  <div class="gd-detail-image-wrap gd-color-hero" style="--color-hex:${color.hex}">
    <div class="gd-color-swatch" style="background:${color.hex}"></div>
    <span class="gd-color-hero-label">${color.label}</span>
  </div>
  <div class="gd-detail-scroll">
    ${buildCommentForm('gd-color')}
    <div class="gd-comments-section">
      <h3 class="gd-section-title">Comments <span class="gd-comments-count">${comments.length}</span></h3>
      <div id="gd-color-comments-list">${renderCommentsList(comments)}</div>
    </div>
  </div>
</div>`;

  wireCommentForm({
    prefix:      'gd-color',
    listId:      'gd-color-comments-list',
    onSubmit:    (text, stars, rework) => submitColorComment(colorKey, text, stars, rework),
    onEditStart: (commentId) => {
      const comment = (_colorComments[colorKey] || []).find(c => c.id === commentId);
      if (comment) startEditComment(comment, colorKey, 'color');
    },
    onDelete:    (commentId) => deleteColorComment(commentId, colorKey),
  });
}

// ─────────────────────────────────────────────────────────────
// SHARED: form HTML + wiring
// ─────────────────────────────────────────────────────────────
function buildCommentForm(prefix) {
  return `
<div class="gd-add-comment-section" id="${prefix}-form">
  <h3 class="gd-section-title">Add comment</h3>
  <textarea class="gd-comment-textarea" id="${prefix}-input" placeholder="Scrivi un commento…" rows="3"></textarea>
  <div class="gd-comment-meta-row">
    <div class="gd-stars-input" id="${prefix}-stars">
      ${[1,2,3,4,5].map(n => `<button class="gd-star-btn" data-star="${n}">☆</button>`).join('')}
    </div>
    <div class="gd-rework-input" id="${prefix}-rework">
      <button class="gd-rework-btn" data-rework="partial">Partial rework</button>
      <button class="gd-rework-btn" data-rework="total">Total rework</button>
    </div>
  </div>
  <button class="primary-btn gd-submit-btn" id="${prefix}-submit">Submit comment</button>
</div>`;
}

function wireCommentForm({ prefix, onSubmit, onEditStart, onDelete, listId }) {
  let selectedStars  = 0;
  let selectedRework = null;

  const starBtns = document.querySelectorAll(`#${prefix}-stars .gd-star-btn`);
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
    btn.addEventListener('click', () => { selectedStars = Number(btn.dataset.star); updateStarUI(null); });
  });

  const reworkBtns = document.querySelectorAll(`#${prefix}-rework .gd-rework-btn`);
  reworkBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const val = btn.dataset.rework;
      selectedRework = selectedRework === val ? null : val;
      reworkBtns.forEach(b => b.classList.toggle('gd-rework-btn--active', b.dataset.rework === selectedRework));
    });
  });

  document.getElementById(`${prefix}-submit`)?.addEventListener('click', async () => {
    const text = document.getElementById(`${prefix}-input`)?.value?.trim();
    if (!text)          { showGlobalToast('Scrivi un commento.', 'error'); return; }
    if (!selectedStars) { showGlobalToast('Seleziona almeno una stella.', 'error'); return; }
    await onSubmit(text, selectedStars, selectedRework);
  });

  document.getElementById(listId)?.addEventListener('click', async e => {
    if (e.target.closest('.gd-delete-btn')) {
      await onDelete(e.target.closest('.gd-delete-btn').dataset.commentId);
      return;
    }
    if (e.target.closest('.gd-edit-btn')) {
      onEditStart(e.target.closest('.gd-edit-btn').dataset.commentId);
    }
  });
}

// ─────────────────────────────────────────────────────────────
// COMMENTI LISTA (shared)
// ─────────────────────────────────────────────────────────────
function renderCommentsList(comments) {
  if (!comments.length) return `<div class="gd-no-comments">Nessun commento ancora.</div>`;
  return comments.map(c => {
    const stars    = '★'.repeat(c.stars) + '☆'.repeat(5 - c.stars);
    const rework   = c.rework
      ? `<span class="gd-rework-badge gd-rework-${c.rework}">${c.rework === 'total' ? 'Rework' : 'Partial'}</span>` : '';
    const date     = new Date(c.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
    const canEdit  = _currentUser && c.author_user_id === _currentUser.id;
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
// SUBMIT CARTE
// ─────────────────────────────────────────────────────────────
async function submitComment(card, text, stars, rework) {
  await refreshSession();
  try {
    const username = _currentUser?.user_metadata?.username || '';
    const { data, error } = await db.from('card_comments')
      .insert({ card_id: Number(card.id), author_user_id: _currentUser.id, author_username: username, comment_text: text, stars, rework: rework || null })
      .select().single();
    if (error) throw error;
    const cid = String(card.id);
    if (!_allComments[cid]) _allComments[cid] = [];
    _allComments[cid].unshift(data);
    showGlobalToast('Commento aggiunto.', 'success');
    renderCardList();
    renderDetail(card);
  } catch (err) {
    console.error('Errore submit commento carta:', err);
    showGlobalToast('Errore nel salvataggio.', 'error');
  }
}

async function deleteComment(commentId, card) {
  try {
    const { error } = await db.from('card_comments').delete().eq('id', commentId);
    if (error) throw error;
    const cid = String(card.id);
    _allComments[cid] = (_allComments[cid] || []).filter(c => c.id !== commentId);
    showGlobalToast('Commento eliminato.', 'success');
    renderCardList();
    renderDetail(card);
  } catch (err) {
    console.error('Errore delete commento carta:', err);
    showGlobalToast('Errore nell\'eliminazione.', 'error');
  }
}

// ─────────────────────────────────────────────────────────────
// SUBMIT COLORI
// ─────────────────────────────────────────────────────────────
async function submitColorComment(colorKey, text, stars, rework) {
  await refreshSession();
  try {
    const username = _currentUser?.user_metadata?.username || '';
    const { data, error } = await db.from('color_comments')
      .insert({ color: colorKey, author_user_id: _currentUser.id, author_username: username, comment_text: text, stars, rework: rework || null })
      .select().single();
    if (error) throw error;
    if (!_colorComments[colorKey]) _colorComments[colorKey] = [];
    _colorComments[colorKey].unshift(data);
    showGlobalToast('Commento aggiunto.', 'success');
    updateColorCounts();
    renderColorDetail(colorKey);
  } catch (err) {
    console.error('Errore submit commento colore:', err);
    showGlobalToast('Errore nel salvataggio.', 'error');
  }
}

async function deleteColorComment(commentId, colorKey) {
  try {
    const { error } = await db.from('color_comments').delete().eq('id', commentId);
    if (error) throw error;
    _colorComments[colorKey] = (_colorComments[colorKey] || []).filter(c => c.id !== commentId);
    showGlobalToast('Commento eliminato.', 'success');
    updateColorCounts();
    renderColorDetail(colorKey);
  } catch (err) {
    console.error('Errore delete commento colore:', err);
    showGlobalToast('Errore nell\'eliminazione.', 'error');
  }
}

// ─────────────────────────────────────────────────────────────
// EDIT INLINE (shared per carte e colori)
// ─────────────────────────────────────────────────────────────
function startEditComment(comment, target, type) {
  const el = document.querySelector(`.gd-comment[data-comment-id="${comment.id}"]`);
  if (!el) return;

  const starsHtml = [1,2,3,4,5].map(n =>
    `<button class="gd-star-btn${n <= comment.stars ? ' gd-star-btn--on' : ''}" data-star="${n}">${n <= comment.stars ? '★' : '☆'}</button>`
  ).join('');

  el.innerHTML = `
<div class="gd-comment-edit">
  <textarea class="gd-comment-textarea gd-comment-edit-textarea" rows="3">${escapeHtml(comment.comment_text)}</textarea>
  <div class="gd-comment-meta-row">
    <div class="gd-stars-input">${starsHtml}</div>
    <div class="gd-rework-input">
      <button class="gd-rework-btn${comment.rework === 'partial' ? ' gd-rework-btn--active' : ''}" data-rework="partial">Partial rework</button>
      <button class="gd-rework-btn${comment.rework === 'total'   ? ' gd-rework-btn--active' : ''}" data-rework="total">Total rework</button>
    </div>
  </div>
  <div class="gd-comment-edit-actions">
    <button class="primary-btn gd-save-edit-btn">Save</button>
    <button class="secondary-btn gd-cancel-edit-btn">Cancel</button>
  </div>
</div>`;

  let editStars  = comment.stars;
  let editRework = comment.rework || null;

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

  const reworkBtns = el.querySelectorAll('.gd-rework-btn');
  reworkBtns.forEach(b => {
    b.addEventListener('click', () => {
      const val = b.dataset.rework;
      editRework = editRework === val ? null : val;
      reworkBtns.forEach(rb => rb.classList.toggle('gd-rework-btn--active', rb.dataset.rework === editRework));
    });
  });

  el.querySelector('.gd-save-edit-btn').addEventListener('click', async () => {
    const text = el.querySelector('.gd-comment-edit-textarea').value.trim();
    if (!text)      { showGlobalToast('Il commento non può essere vuoto.', 'error'); return; }
    if (!editStars) { showGlobalToast('Seleziona almeno una stella.', 'error'); return; }
    await saveEditComment(comment, target, type, text, editStars, editRework);
  });

  el.querySelector('.gd-cancel-edit-btn').addEventListener('click', () => {
    if (type === 'card') renderDetail(target);
    else renderColorDetail(target);
  });
}

async function saveEditComment(comment, target, type, text, stars, rework) {
  await refreshSession();
  const table = type === 'card' ? 'card_comments' : 'color_comments';
  try {
    const { data, error } = await db.from(table)
      .update({ comment_text: text, stars, rework: rework || null })
      .eq('id', comment.id)
      .select().single();
    if (error) throw error;

    if (type === 'card') {
      const cid = String(target.id);
      const idx = (_allComments[cid] || []).findIndex(c => c.id === comment.id);
      if (idx !== -1) _allComments[cid][idx] = data;
      showGlobalToast('Commento aggiornato.', 'success');
      renderCardList();
      renderDetail(target);
    } else {
      const idx = (_colorComments[target] || []).findIndex(c => c.id === comment.id);
      if (idx !== -1) _colorComments[target][idx] = data;
      showGlobalToast('Commento aggiornato.', 'success');
      updateColorCounts();
      renderColorDetail(target);
    }
  } catch (err) {
    console.error('Errore update commento:', err);
    showGlobalToast('Errore nel salvataggio.', 'error');
  }
}

// ─────────────────────────────────────────────────────────────
// FILTRI CARTE
// ─────────────────────────────────────────────────────────────
function wireFilters() {
  document.getElementById('gd-filter-color')?.addEventListener('change', e => { _filters.color = e.target.value; renderCardList(); });
  document.getElementById('gd-filter-rework')?.addEventListener('change', e => { _filters.rework = e.target.value; renderCardList(); });
  document.getElementById('gd-filter-nocomments')?.addEventListener('change', e => { _filters.noComments = e.target.checked; renderCardList(); });
  document.getElementById('gd-filter-sort')?.addEventListener('change', e => { _filters.sortBy = e.target.value; renderCardList(); });
}

// ─────────────────────────────────────────────────────────────
// UTILITY
// ─────────────────────────────────────────────────────────────
const COLOR_HEX = { blue: '#336699', green: '#385400', red: '#8A0000', black: '#262B2F', colorless: '#A19993' };

function colorHex(color) { return COLOR_HEX[color] ?? COLOR_HEX.colorless; }

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
