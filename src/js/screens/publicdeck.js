// ============================================================
// screens/publicdeck.js — Schermata mazzi pubblici.
// ============================================================

import { db }           from '../core/supabase-client.js';
import { CardDatabase, CardMap } from '../data/cards.js';
import { getUser }      from '../auth/auth.js';
import { showGlobalToast }    from '../core/ui.js';
import { openPublicProfile }  from './profile.js';

// ── Costanti colore commander (stesse del deckbuilder) ────────
const COLOR_HEX = {
  blue:      '#336699',
  green:     '#385400',
  red:       '#8A0000',
  black:     '#262B2F',
  colorless: '#A19993',
};

// ── Stato filtri ──────────────────────────────────────────────
let _filters = { name: '', colors: [], tags: '' };
let _orderBy = 'date';
let _orderDir = 'desc';
let _decks = [];
let _avatarMap = {}; // userId → avatar_url

// ─────────────────────────────────────────────────────────────
// RENDER PRINCIPALE
// ─────────────────────────────────────────────────────────────
export async function renderPublicDeckScreen() {
  const screen = document.getElementById('screen-publicdeck');
  if (!screen) return;

  screen.innerHTML = buildSkeleton();
  injectStyles();
  wireFilters();
  await loadAndRender();
}

// ─────────────────────────────────────────────────────────────
// CARICAMENTO DATI
// ─────────────────────────────────────────────────────────────
async function loadAndRender() {
  const grid = document.getElementById('pd-grid');
  if (!grid) return;

  grid.innerHTML = `<div class="pd-loading">Caricamento mazzi…</div>`;

  try {
    let query = db
      .from('public_decks')
      .select('*');

    if (_orderBy === 'name') {
      query = query.order('name', { ascending: _orderDir === 'asc' });
    } else {
      query = query.order('created_at', { ascending: _orderDir === 'asc' });
    }

    const { data, error } = await query;
    if (error) throw error;

    _decks = data || [];

    // fetch avatar degli autori in batch
    const authorIds = [...new Set(_decks.map(d => d.author_user_id).filter(Boolean))];
    if (authorIds.length) {
      const { data: profiles } = await db
        .from('profiles')
        .select('id, avatar_url')
        .in('id', authorIds);
      _avatarMap = {};
      (profiles || []).forEach(p => { if (p.avatar_url) _avatarMap[p.id] = p.avatar_url; });
    }

    renderGrid(_applyClientFilters(_decks));
  } catch (err) {
    console.warn('Errore caricamento public decks:', err.message);
    grid.innerHTML = `<div class="pd-loading pd-error">Impossibile caricare i mazzi. Riprova.</div>`;
  }
}

function _applyClientFilters(decks) {
  return decks.filter(d => {
    if (_filters.name && !d.name.toLowerCase().includes(_filters.name.toLowerCase())) return false;
    if (_filters.colors.length > 0 && !_filters.colors.includes(d.commander_color)) return false;
    if (_filters.tags && !(d.tags || []).some(t => t.toLowerCase().includes(_filters.tags.toLowerCase()))) return false;
    return true;
  });
}

// ─────────────────────────────────────────────────────────────
// RENDER GRIGLIA
// ─────────────────────────────────────────────────────────────
function renderGrid(decks) {
  const grid = document.getElementById('pd-grid');
  if (!grid) return;

  if (decks.length === 0) {
    grid.innerHTML = `<div class="pd-loading">Nessun mazzo trovato.</div>`;
    return;
  }

  grid.innerHTML = decks.map(d => buildCard(d)).join('');

  grid.querySelectorAll('.pd-card').forEach(el => {
    // ignora click su elementi che hanno una loro azione
    el.addEventListener('click', e => {
      if (e.target.closest('.pd-author-zone')) return;
      onCardClick(el.dataset.deckId);
    });
    wireTilt(el);
  });

  // username + avatar cliccabili → profilo pubblico
  grid.querySelectorAll('.pd-author-zone').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation();
      const userId = el.dataset.userId;
      if (userId) openPublicProfile(userId);
    });
  });
}

/* 3D tilt su hover — CSS transform, nessuna libreria */
function wireTilt(el) {
  el.addEventListener('mousemove', e => {
    const r   = el.getBoundingClientRect();
    const cx  = r.left + r.width  / 2;
    const cy  = r.top  + r.height / 2;
    const dx  = (e.clientX - cx) / (r.width  / 2);   // -1..1
    const dy  = (e.clientY - cy) / (r.height / 2);   // -1..1
    el.style.transform = `perspective(700px) rotateY(${dx * 6}deg) rotateX(${-dy * 4}deg) translateY(-4px)`;
  });
  el.addEventListener('mouseleave', () => {
    el.style.transform = '';
  });
}

function buildCard(d) {
  const commander  = CardMap.get(String(d.commander_id));
  const colorHex   = COLOR_HEX[d.commander_color] || COLOR_HEX.colorless;
  const imgSrc     = commander ? commander.image : '';
  const dateStr    = d.created_at ? timeAgo(new Date(d.created_at)) : '—';
  const tags       = (d.tags || []).filter(Boolean);
  const cmdName    = commander ? commander.name : '—';
  const authorName = d.author_username || 'Anonimo';
  const avatarUrl  = d.author_user_id ? (_avatarMap[d.author_user_id] || '') : '';

  const blurStyle = imgSrc
    ? `background-image: url('${imgSrc}'); background-size: 140%; background-position: center 5%;`
    : `background: ${colorHex};`;

  const tagsHtml = tags.length
    ? `<div class="pd-card-tags">${tags.map(t => `<span class="pd-tag">${esc(t)}</span>`).join('')}</div>`
    : '';

  const uid = esc(d.author_user_id || '');
  const avatarInner = avatarUrl
    ? `<img class="pd-author-avatar" src="${esc(avatarUrl)}" alt="">`
    : `<span class="pd-author-avatar pd-author-avatar-ph">${authorName[0].toUpperCase()}</span>`;

  return `
    <div class="pd-card" data-deck-id="${esc(d.id)}" style="--pd-cmd-color:${colorHex}">
      <div class="pd-card-img">
        <div class="pd-card-img-blur" style="${blurStyle}"></div>
        <div class="pd-card-img-overlay"></div>
        <div class="pd-card-rune-border"></div>
        <div class="pd-card-color-bar" style="background: ${colorHex};"></div>
        ${tagsHtml}
        <div class="pd-card-info">
          <div class="pd-card-name">${esc(d.name)}</div>
          <div class="pd-card-cmd">◆ ${esc(cmdName)}</div>
          <div class="pd-card-meta">
            <span class="pd-author-zone" data-user-id="${uid}">${avatarInner}<span class="pd-author-name">${esc(authorName)}</span></span>
            <span class="pd-card-dot">·</span> ${dateStr}
          </div>
        </div>
      </div>
    </div>`;
}

// ─────────────────────────────────────────────────────────────
// CLICK SU SCHEDA → apre modal dettaglio mazzo
// ─────────────────────────────────────────────────────────────
async function onCardClick(deckId) {
  const publicDeck = _decks.find(d => String(d.id) === String(deckId));
  if (!publicDeck) return;

  const user = await getUser();
  openDeckModal(publicDeck, user);
}

// ─────────────────────────────────────────────────────────────
// MODAL DETTAGLIO MAZZO
// ─────────────────────────────────────────────────────────────
function openDeckModal(deck, user) {
  const isOwner = user && String(user.id) === String(deck.author_user_id);

  const commander = CardMap.get(String(deck.commander_id));
  const colorHex  = COLOR_HEX[deck.commander_color] || COLOR_HEX.colorless;

  const buildSection = (label, ids) => {
    if (!ids || !ids.length) return '';
    const counts = {};
    ids.forEach(id => { counts[id] = (counts[id] || 0) + 1; });
    const rows = Object.entries(counts).map(([id, qty]) => {
      const card = CardMap.get(String(id));
      const name = card ? esc(card.name) : `#${id}`;
      const qtyStr = qty > 1 ? `<span class="pdm-qty">×${qty}</span>` : '';
      const colorDot = card ? `<span class="pdm-dot" style="background:${COLOR_HEX[card.color] || COLOR_HEX.colorless}"></span>` : '';
      return `<div class="pdm-row" data-card-id="${id}">${colorDot}<span class="pdm-name">${name}</span>${qtyStr}</div>`;
    }).join('');
    return `<div class="pdm-section"><div class="pdm-sec-label">${label}</div>${rows}</div>`;
  };

  const cmdSection = commander
    ? `<div class="pdm-section">
         <div class="pdm-sec-label">COMMANDER</div>
         <div class="pdm-row pdm-row-cmd" data-card-id="${esc(deck.commander_id)}">
           <span class="pdm-dot" style="background:${colorHex}"></span>
           <span class="pdm-name">${esc(commander.name)}</span>
         </div>
       </div>`
    : '';

  const tags = (deck.tags || []).filter(Boolean);
  const tagsHtml = tags.length
    ? `<div class="pdm-tags">${tags.map(t => `<span class="pdm-tag">${esc(t)}</span>`).join('')}</div>`
    : '';

  const deleteBtn = isOwner
    ? `<button class="pdm-btn pdm-btn-danger" id="pdm-delete">Rimuovi pubblicazione</button>`
    : '';

  const renameBtn = isOwner
    ? `<button class="pdm-btn" id="pdm-rename">Modifica nome</button>`
    : '';

  const overlay = document.createElement('div');
  overlay.className = 'pdm-overlay';
  overlay.id = 'pdm-overlay';
  overlay.innerHTML = `
    <div class="pdm-modal ${deck.description ? 'pdm-modal--with-desc' : ''}"
      <div class="pdm-header" style="--pdm-color:${colorHex}">
        <div class="pdm-header-bg" ${commander?.image ? `style="background-image:url('${commander.image}')"` : ''}></div>
        <div class="pdm-header-overlay"></div>
        <div class="pdm-header-content">
          <div class="pdm-title">${esc(deck.name)}</div>
          <div class="pdm-author">${esc(deck.author_username || 'Anonimo')} · ${deck.created_at ? timeAgo(new Date(deck.created_at)) : '—'}</div>
          ${tagsHtml}
        </div>
        <button class="pdm-close" id="pdm-close">✕</button>
      </div>
      <div class="pdm-body">
        <div class="pdm-body-inner">
          <div class="pdm-list">
            ${cmdSection}
            ${buildSection('MAIN DECK', deck.cards)}
            ${buildSection('TERRITORY', deck.territory_cards)}
            ${buildSection('SIDEBOARD', deck.sideboard_cards)}
          </div>
          ${deck.description ? `<div class="pdm-desc"><div class="pdm-desc-label">DESCRIZIONE</div><div class="pdm-desc-text">${esc(deck.description)}</div></div>` : ''}
        </div>
        <div class="pdm-actions">
          <button class="pdm-btn" id="pdm-export-code">Export code</button>
          <button class="pdm-btn" id="pdm-export-img">Export img</button>
          ${renameBtn}
          ${deleteBtn}
        </div>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  // hover preview tooltip per le carte in lista
  const tt = document.createElement('div');
  tt.className = 'pdm-card-tt';
  tt.setAttribute('aria-hidden', 'true');
  tt.innerHTML = `<img class="pdm-card-tt-img" src="" alt="">`;
  document.body.appendChild(tt);
  const ttImg = tt.querySelector('.pdm-card-tt-img');

  const showTT = (card, e) => {
    if (!card?.image) return;
    ttImg.src = card.image;
    tt.removeAttribute('aria-hidden');
    moveTT(e);
  };
  const hideTT = () => tt.setAttribute('aria-hidden', 'true');
  const moveTT = e => {
    const w = 220, margin = 10;
    let x = e.clientX + 16;
    let y = e.clientY - 110;
    if (x + w + margin > window.innerWidth) x = e.clientX - w - 10;
    if (x < margin) x = margin;
    if (y + 308 + margin > window.innerHeight) y = window.innerHeight - 308 - margin;
    if (y < margin) y = margin;
    tt.style.left = x + 'px';
    tt.style.top  = y + 'px';
  };

  overlay.querySelectorAll('.pdm-row[data-card-id]').forEach(row => {
    const card = CardMap.get(row.dataset.cardId);
    if (!card) return;
    row.addEventListener('mouseenter', e => showTT(card, e));
    row.addEventListener('mousemove',  moveTT);
    row.addEventListener('mouseleave', hideTT);
  });

  const close = () => { overlay.remove(); tt.remove(); };
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.getElementById('pdm-close').addEventListener('click', close);

  document.getElementById('pdm-rename')?.addEventListener('click', async () => {
    const newName = prompt('Nuovo nome del mazzo:', deck.name);
    if (!newName || newName.trim() === '' || newName.trim() === deck.name) return;
    const trimmed = newName.trim();
    const { error } = await db.from('public_decks').update({ name: trimmed }).eq('id', deck.id);
    if (error) {
      showGlobalToast('Errore durante la rinomina.', 'error');
    } else {
      deck.name = trimmed;
      const titleEl = overlay.querySelector('.pdm-title');
      if (titleEl) titleEl.textContent = trimmed;
      const local = _decks.find(d => String(d.id) === String(deck.id));
      if (local) local.name = trimmed;
      showGlobalToast(`Mazzo rinominato in "${trimmed}".`, 'success');
    }
  });

  document.getElementById('pdm-export-code').addEventListener('click', () => {
    openExportCodeModal({
      commanderId:    deck.commander_id   || null,
      cards:          deck.cards           || [],
      territoryCards: deck.territory_cards || [],
      sideboardCards: deck.sideboard_cards || [],
    }, deck.name);
  });

  document.getElementById('pdm-export-img').addEventListener('click', () => {
    exportDeckImage({
      name:           deck.name,
      commanderId:    deck.commander_id   || null,
      cards:          deck.cards           || [],
      territoryCards: deck.territory_cards || [],
      sideboardCards: deck.sideboard_cards || [],
    });
  });

  if (isOwner) {
    document.getElementById('pdm-delete').addEventListener('click', async () => {
      if (!confirm(`Rimuovere "${deck.name}" dai mazzi pubblici?`)) return;
      const { error } = await db.from('public_decks').delete().eq('id', deck.id);
      if (error) {
        showGlobalToast('Errore durante la rimozione.', 'error');
      } else {
        showGlobalToast(`"${deck.name}" rimosso dai mazzi pubblici.`, 'success');
        _decks = _decks.filter(d => String(d.id) !== String(deck.id));
        renderGrid(_applyClientFilters(_decks));
        close();
      }
    });
  }
}

// ── Export code (modal standalone) ───────────────────────────
function encodeDeck(deck) {
  const countIds = ids => {
    const m = {};
    ids.forEach(id => { m[id] = (m[id] || 0) + 1; });
    return Object.entries(m).sort(([a],[b]) => Number(a)-Number(b)).map(([id,n]) => `${id}:${n}`).join(',');
  };
  const sortIds = ids => [...new Set(ids)].sort((a,b) => Number(a)-Number(b)).join(',');
  const raw = [
    deck.commanderId || '',
    countIds(deck.cards || []),
    sortIds(deck.territoryCards || []),
    countIds(deck.sideboardCards || []),
  ].join('|');
  return btoa(unescape(encodeURIComponent(raw))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
}

function openExportCodeModal(deck, deckName) {
  const code = encodeDeck(deck);
  const el = document.createElement('div');
  el.className = 'pdm-overlay';
  el.innerHTML = `
    <div class="pdm-modal pdm-modal-sm">
      <div class="pdm-exp-title">Codice mazzo — copia e condividi:</div>
      <div class="pdm-exp-row">
        <input class="pdm-exp-inp" id="pdm-exp-inp" type="text" readonly value="${esc(code)}">
        <button class="pdm-btn pdm-btn-primary" id="pdm-exp-copy">Copia</button>
      </div>
      <button class="pdm-btn" id="pdm-exp-close" style="margin-top:12px">Chiudi</button>
    </div>`;
  document.body.appendChild(el);
  el.addEventListener('click', e => { if (e.target === el) el.remove(); });
  document.getElementById('pdm-exp-close').addEventListener('click', () => el.remove());
  document.getElementById('pdm-exp-copy').addEventListener('click', () => {
    navigator.clipboard?.writeText(code).catch(() => {});
    showGlobalToast('Codice copiato!', 'success');
  });
  document.getElementById('pdm-exp-inp').select();
}

// ── Export image (riusa la stessa logica del deckbuilder) ─────
async function exportDeckImage(deck) {
  const CARD_W = 140, CARD_H = 194, GAP = 12, PAD = 48, CANVAS_W = 1600;
  const SEC_H = 32, SEC_GAP = 30;

  const mkCounts = ids => {
    const m = {};
    ids.forEach(id => { m[id] = (m[id] || 0) + 1; });
    return m;
  };

  const cmdCard  = deck.commanderId ? CardMap.get(deck.commanderId) : null;
  const CMD_W    = Math.round(CARD_W * 1.2);
  const CMD_H    = Math.round(CARD_H * 1.2);
  const CMD_AREA = CMD_W + GAP * 3;

  const terrCounts = mkCounts(deck.territoryCards || []);
  const terrIds    = Object.keys(terrCounts);
  const terrAvailW = CANVAS_W - PAD * 2 - CMD_AREA;
  const TERR_COLS  = Math.max(1, Math.floor((terrAvailW + GAP) / (CARD_W + GAP)));
  const terrRows   = terrIds.length ? Math.ceil(terrIds.length / TERR_COLS) : 0;

  const topRowH = Math.max(
    cmdCard ? SEC_H + CMD_H : 0,
    terrIds.length ? SEC_H + terrRows * (CARD_H + GAP) : 0,
  );

  const MAIN_COLS = Math.max(1, Math.floor((CANVAS_W - PAD * 2 + GAP) / (CARD_W + GAP)));
  const mainByType = { Quest: {}, Spell: {}, Minion: {} };
  (deck.cards || []).forEach(id => {
    const card = CardMap.get(id);
    const type = (card && mainByType[card.type]) ? card.type : 'Minion';
    mainByType[type][id] = (mainByType[type][id] || 0) + 1;
  });
  const mainSections = ['Quest','Spell','Minion']
    .map(t => ({ label: t.toUpperCase(), ids: Object.keys(mainByType[t]), counts: mainByType[t] }))
    .filter(s => s.ids.length);

  const sideCounts = mkCounts(deck.sideboardCards || []);
  const sideIds    = Object.keys(sideCounts);

  let totalH = 80;
  if (topRowH) totalH += topRowH + SEC_GAP;
  mainSections.forEach(s => { totalH += SEC_H + Math.ceil(s.ids.length / MAIN_COLS) * (CARD_H + GAP) + SEC_GAP; });
  if (sideIds.length) totalH += SEC_H + Math.ceil(sideIds.length / MAIN_COLS) * (CARD_H + GAP) + SEC_GAP;
  totalH += PAD;

  const allIds = [...new Set([
    ...(deck.commanderId ? [deck.commanderId] : []),
    ...terrIds,
    ...mainSections.flatMap(s => s.ids),
    ...sideIds,
  ])];
  const imgMap = {};
  await Promise.all(allIds.map(id => {
    const card = CardMap.get(id);
    if (!card?.image) return Promise.resolve();
    return new Promise(resolve => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload  = () => { imgMap[id] = img; resolve(); };
      img.onerror = resolve;
      img.src = card.image;
    });
  }));

  const canvas = document.createElement('canvas');
  canvas.width  = CANVAS_W;
  canvas.height = totalH;
  const ctx = canvas.getContext('2d');

  const ART_SX = 67, ART_SY = 67, ART_SW = 1070, ART_SH = 800;
  const cmdImg = deck.commanderId ? imgMap[deck.commanderId] : null;
  if (cmdImg) {
    ctx.save();
    ctx.filter = 'blur(18px)';
    const scale = Math.max(CANVAS_W / ART_SW, totalH / ART_SH);
    const bw = ART_SW * scale, bh = ART_SH * scale;
    ctx.drawImage(cmdImg, ART_SX, ART_SY, ART_SW, ART_SH, (CANVAS_W-bw)/2, (totalH-bh)/2, bw, bh);
    ctx.restore();
    ctx.fillStyle = 'rgba(5,8,15,0.72)';
    ctx.fillRect(0, 0, CANVAS_W, totalH);
  } else {
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, CANVAS_W, totalH);
  }

  ctx.fillStyle = '#e8e8e8';
  ctx.font      = 'bold 54px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(deck.name, CANVAS_W / 2, 52);

  const COLOR_HEX_LOCAL = { blue:'#336699', green:'#385400', red:'#8A0000', black:'#262B2F', colorless:'#A19993' };

  const drawCard = (id, card, x, y, W, H, count) => {
    if (imgMap[id]) {
      ctx.drawImage(imgMap[id], x, y, W, H);
    } else {
      ctx.fillStyle = COLOR_HEX_LOCAL[card?.color] ?? '#333333';
      ctx.fillRect(x, y, W, H);
      if (card) {
        ctx.fillStyle = '#ffffff'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(card.name, x + W/2, y + H/2); ctx.textAlign = 'left';
      }
    }
    if (count > 1) {
      ctx.fillStyle = 'rgba(0,0,0,0.82)'; ctx.fillRect(x+W-26, y+5, 22, 22);
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(`×${count}`, x+W-15, y+19); ctx.textAlign = 'left';
    }
  };

  const drawSection = (sec, y) => {
    ctx.fillStyle = '#aaaaaa'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(sec.label, PAD, y + 22);
    sec.ids.forEach((id, i) => {
      drawCard(id, CardMap.get(id),
        PAD + (i % MAIN_COLS) * (CARD_W + GAP),
        y + SEC_H + Math.floor(i / MAIN_COLS) * (CARD_H + GAP),
        CARD_W, CARD_H, sec.counts[id]);
    });
  };

  let y = 80;
  if (topRowH) {
    if (cmdCard) {
      ctx.fillStyle = '#aaaaaa'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'left';
      ctx.fillText('COMMANDER', PAD, y + 22);
      drawCard(deck.commanderId, cmdCard, PAD, y + SEC_H, CMD_W, CMD_H, 0);
    }
    if (terrIds.length) {
      const terrX = PAD + (cmdCard ? CMD_AREA : 0);
      ctx.fillStyle = '#aaaaaa'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'left';
      ctx.fillText(`TERRITORY  ${(deck.territoryCards||[]).length}/12`, terrX, y + 22);
      terrIds.forEach((id, i) => {
        const col = i % TERR_COLS, row = Math.floor(i / TERR_COLS);
        drawCard(id, CardMap.get(id), terrX + col*(CARD_W+GAP), y+SEC_H+row*(CARD_H+GAP), CARD_W, CARD_H, terrCounts[id]);
      });
    }
    y += topRowH + SEC_GAP;
  }

  mainSections.forEach(sec => {
    drawSection(sec, y);
    y += SEC_H + Math.ceil(sec.ids.length / MAIN_COLS) * (CARD_H + GAP) + SEC_GAP;
  });

  if (sideIds.length) {
    drawSection({ label: `SIDEBOARD  ${(deck.sideboardCards||[]).length}/10`, ids: sideIds, counts: sideCounts }, y);
  }

  try {
    const url = canvas.toDataURL('image/png');
    const a   = document.createElement('a');
    a.download = `${deck.name.replace(/[^\w\s-]/g,'').replace(/\s+/g,'_') || 'deck'}.png`;
    a.href = url;
    a.click();
  } catch {
    showGlobalToast('Export immagine non riuscito (CORS).', 'error');
  }
}

// ─────────────────────────────────────────────────────────────
// EVENTI FILTRI
// ─────────────────────────────────────────────────────────────
function wireFilters() {
  document.getElementById('pd-filter-name')?.addEventListener('input', e => {
    _filters.name = e.target.value;
    renderGrid(_applyClientFilters(_decks));
  });

  document.getElementById('pd-filter-tags')?.addEventListener('input', e => {
    _filters.tags = e.target.value;
    renderGrid(_applyClientFilters(_decks));
  });

  document.getElementById('pd-order-by')?.addEventListener('change', e => {
    _orderBy = e.target.value;
    loadAndRender();
  });

  document.getElementById('pd-order-dir')?.addEventListener('change', e => {
    _orderDir = e.target.value;
    loadAndRender();
  });

  document.querySelectorAll('.pd-color-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const color = btn.dataset.color;
      btn.classList.toggle('active');
      if (_filters.colors.includes(color)) {
        _filters.colors = _filters.colors.filter(c => c !== color);
      } else {
        _filters.colors.push(color);
      }
      renderGrid(_applyClientFilters(_decks));
    });
  });
}

// ─────────────────────────────────────────────────────────────
// HTML SKELETON
// ─────────────────────────────────────────────────────────────
function buildSkeleton() {
  const colorButtons = ['blue', 'green', 'red', 'black', 'colorless'].map(c => `
    <button class="pd-color-btn" data-color="${c}" title="${c}" style="background:${COLOR_HEX[c]};"></button>
  `).join('');

  return `
<div class="pd-root">

  <!-- TOOLBAR FILTRI -->
  <div class="pd-toolbar">
    <div class="pd-toolbar-left">
      <div class="pd-fg">
        <label class="pd-fl">Nome mazzo</label>
        <input class="pd-fi" id="pd-filter-name" type="text" placeholder="cerca nome…">
      </div>
      <div class="pd-fg">
        <label class="pd-fl">Colore</label>
        <div class="pd-color-row">${colorButtons}</div>
      </div>
      <div class="pd-fg">
        <label class="pd-fl">Tag</label>
        <input class="pd-fi" id="pd-filter-tags" type="text" placeholder="cerca tag…">
      </div>
    </div>
    <div class="pd-toolbar-right">
      <div class="pd-fg">
        <label class="pd-fl">Ordina per</label>
        <select class="pd-fi" id="pd-order-by">
          <option value="date">Data</option>
          <option value="name">A–Z</option>
        </select>
      </div>
      <div class="pd-fg">
        <label class="pd-fl">Direzione</label>
        <select class="pd-fi" id="pd-order-dir">
          <option value="desc">DESC</option>
          <option value="asc">ASC</option>
        </select>
      </div>
    </div>
  </div>

  <!-- GRIGLIA -->
  <div class="pd-grid" id="pd-grid"></div>

</div>`;
}

// ─────────────────────────────────────────────────────────────
// UTILITY
// ─────────────────────────────────────────────────────────────
function timeAgo(date) {
  const mins  = Math.floor((Date.now() - date) / 60000);
  if (mins < 2)   return 'just now';
  if (mins < 60)  return `${mins} minutes ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  const days  = Math.floor(hours / 24);
  if (days < 7)   return `${days} day${days > 1 ? 's' : ''} ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4)  return `about ${weeks} week${weeks > 1 ? 's' : ''} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `about ${months} month${months > 1 ? 's' : ''} ago`;
  const years = Math.floor(days / 365);
  return `over ${years} year${years > 1 ? 's' : ''} ago`;
}

function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─────────────────────────────────────────────────────────────
// CSS (iniettato una sola volta)
// ─────────────────────────────────────────────────────────────
function injectStyles() {
  if (document.getElementById('pd-styles')) return;
  const style = document.createElement('style');
  style.id = 'pd-styles';
  style.textContent = `

/* ═══ ROOT ══════════════════════════════════════════════════ */
.pd-root {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 24px 28px 48px;
  max-width: 1300px;
  margin: 0 auto;
}

/* ═══ TOOLBAR ════════════════════════════════════════════════ */
.pd-toolbar {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 24px;
}

.pd-toolbar-left  { display: flex; align-items: flex-end; gap: 16px; flex-wrap: wrap; }
.pd-toolbar-right { display: flex; align-items: flex-end; gap: 16px; flex-wrap: wrap; }

.pd-fg { display: flex; flex-direction: column; gap: 5px; }
.pd-fl { font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--text-secondary); }

.pd-fi {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 13px;
  padding: 6px 10px;
  outline: none;
  transition: border-color 0.15s;
}
.pd-fi:focus { border-color: var(--violet); }

.pd-color-row { display: flex; gap: 6px; align-items: center; }

.pd-color-btn {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: border-color 0.15s, transform 0.1s;
  flex-shrink: 0;
}
.pd-color-btn:hover  { transform: scale(1.15); }
.pd-color-btn.active { border-color: var(--violet-bright); box-shadow: 0 0 6px rgba(197,187,208,0.5); }

/* ═══ GRIGLIA ════════════════════════════════════════════════ */
.pd-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
}

.pd-loading {
  grid-column: 1 / -1;
  text-align: center;
  color: var(--text-secondary);
  padding: 60px 0;
  font-size: 14px;
}
.pd-error { color: var(--error); }

/* ═══ SCHEDA ═════════════════════════════════════════════════ */
.pd-card {
  position: relative;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  cursor: pointer;
  /* tilt via JS — transition only on leave */
  transition: transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease;
  transform-style: preserve-3d;
  will-change: transform;
}
/* Il colore di hover e glow viene da --pd-cmd-color impostato inline via JS */
.pd-card:hover {
  box-shadow: 0 14px 36px rgba(0,0,0,0.70), 0 0 0 1px color-mix(in srgb, var(--pd-cmd-color, #555) 50%, transparent);
  border-color: color-mix(in srgb, var(--pd-cmd-color, #555) 60%, transparent);
}

/* contenitore immagine — altezza fissa rettangolare */
.pd-card-img {
  position: relative;
  width: 100%;
  height: 220px;
  background-size: cover;
  background-position: center center;
  background-color: var(--bg-elevated);
  overflow: hidden;
}

/* layer blur separato così non sfoca i figli */
.pd-card-img-blur {
  position: absolute;
  inset: -6px;          /* compensa il bleeding del blur */
  filter: blur(3px);
  z-index: 0;
}

/* gradient overlay sopra il blur */
.pd-card-img-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to bottom,
    rgba(0,0,0,0.08) 0%,
    rgba(0,0,0,0.45) 55%,
    rgba(0,0,0,0.82) 100%
  );
  z-index: 1;
}

/* barra colore */
.pd-card-color-bar {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 3px;
  z-index: 3;
}

/* info testo sovrapposta in basso */
.pd-card-info {
  position: absolute;
  bottom: 3px; left: 0; right: 0;
  padding: 12px 14px 14px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  z-index: 2;
}

.pd-card-name {
  font-family: 'Cinzel', serif;
  font-size: 17px;
  font-weight: 600;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-shadow: 0 1px 8px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,1);
}

.pd-card-meta {
  font-size: 13px;
  color: rgba(255,255,255,0.75);
  text-shadow: 0 1px 4px rgba(0,0,0,0.9);
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

/* zona autore cliccabile (avatar + nome) */
.pd-author-zone {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
  flex-shrink: 0;
  border-radius: 20px;
  padding: 1px 6px 1px 1px;
  transition: background 0.15s;
}
.pd-author-zone:hover {
  background: rgba(255,255,255,0.12);
}

/* avatar autore — piccolo cerchio */
.pd-author-avatar {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  border: 1px solid rgba(255,255,255,0.30);
  display: block;
}
.pd-author-avatar-ph {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: rgba(47,58,52,0.8);
  border: 1px solid rgba(255,255,255,0.25);
  font-size: 9px;
  font-weight: 700;
  color: rgba(255,255,255,0.85);
  flex-shrink: 0;
}

.pd-author-name {
  color: rgba(255,255,255,0.90);
  font-size: 13px;
  text-shadow: 0 1px 4px rgba(0,0,0,0.9);
}

.pd-card-dot {
  color: rgba(255,255,255,0.4);
  margin: 0 3px;
}

/* tag */
.pd-card-tags {
  position: absolute;
  top: 10px;
  right: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
  justify-content: flex-end;
  z-index: 2;
  max-width: 70%;
}

.pd-tag-icon {
  font-size: 10px;
  line-height: 1;
}

.pd-tag {
  font-size: 10px;
  background: rgba(155,143,160,0.25);
  border: 1px solid rgba(197,187,208,0.35);
  border-radius: 4px;
  padding: 1px 6px;
  color: rgba(255,255,255,0.85);
  white-space: nowrap;
  text-shadow: 0 1px 3px rgba(0,0,0,0.8);
}

/* ═══ RESPONSIVE ═════════════════════════════════════════════ */
@media (max-width: 680px) {
  .pd-toolbar { flex-direction: column; align-items: flex-start; }
  .pd-grid    { grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
}

/* ═══ MODAL DETTAGLIO MAZZO ══════════════════════════════════ */
.pdm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.72);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.pdm-modal {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 14px;
  width: 100%;
  max-width: 540px;
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 24px 64px rgba(0,0,0,0.8);
}

.pdm-modal-sm {
  max-width: 420px;
  padding: 24px;
  gap: 12px;
}

.pdm-header {
  position: relative;
  min-height: 110px;
  flex-shrink: 0;
  overflow: hidden;
  border-bottom: 3px solid var(--pdm-color, #555);
}

.pdm-header-bg {
  position: absolute;
  inset: -6px;
  background-size: 150%;
  background-position: center 15%;
  filter: blur(4px);
}

.pdm-header-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.75) 100%);
}

.pdm-header-content {
  position: relative;
  z-index: 1;
  padding: 18px 48px 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.pdm-title {
  font-family: 'Cinzel', serif;
  font-size: 22px;
  font-weight: 700;
  color: #fff;
  text-shadow: 0 1px 8px rgba(0,0,0,0.9);
}

.pdm-author {
  font-size: 13px;
  color: rgba(255,255,255,0.7);
  text-shadow: 0 1px 4px rgba(0,0,0,0.9);
}

.pdm-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
}

.pdm-tag {
  font-size: 10px;
  background: rgba(155,143,160,0.25);
  border: 1px solid rgba(197,187,208,0.35);
  border-radius: 4px;
  padding: 1px 6px;
  color: rgba(255,255,255,0.85);
}

.pdm-close {
  position: absolute;
  top: 10px; right: 12px;
  z-index: 2;
  background: rgba(0,0,0,0.5);
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 50%;
  color: #fff;
  width: 28px; height: 28px;
  cursor: pointer;
  font-size: 13px;
  display: flex; align-items: center; justify-content: center;
  transition: background 0.15s;
}
.pdm-close:hover { background: rgba(255,255,255,0.15); }

.pdm-modal--with-desc {
  max-width: 820px;
}

.pdm-body {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  flex: 1;
}

.pdm-body-inner {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.pdm-list {
  flex: 0 0 280px;
  overflow-y: auto;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  border-right: 1px solid var(--border);
}

.pdm-modal:not(.pdm-modal--with-desc) .pdm-list {
  flex: 1;
  border-right: none;
}

.pdm-desc {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pdm-desc-label {
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.pdm-desc-text {
  font-size: 13px;
  line-height: 1.75;
  color: var(--text-primary);
  white-space: pre-wrap;
  word-break: break-word;
}

.pdm-section {}

.pdm-sec-label {
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.pdm-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  border-bottom: 1px solid var(--border);
  font-size: 13px;
  color: var(--text-primary);
}

.pdm-row-cmd { font-weight: 600; }

.pdm-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.pdm-name { flex: 1; }

.pdm-qty {
  font-size: 12px;
  color: var(--text-secondary);
}

.pdm-actions {
  padding: 14px 20px;
  border-top: 1px solid var(--border);
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.pdm-btn {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 12px;
  padding: 7px 14px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.pdm-btn:hover { border-color: var(--violet); }

.pdm-btn-primary {
  background: var(--violet);
  border-color: var(--violet);
  color: #fff;
}
.pdm-btn-primary:hover { background: var(--violet-bright); border-color: var(--violet-bright); }

.pdm-btn-danger {
  border-color: var(--error);
  color: var(--error);
}
.pdm-btn-danger:hover { background: rgba(var(--error-rgb, 180,40,40), 0.12); }

.pdm-exp-title {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 10px;
}

.pdm-exp-row {
  display: flex;
  gap: 8px;
}

.pdm-exp-inp {
  flex: 1;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 12px;
  padding: 6px 10px;
  outline: none;
}

/* ═══ RUNE BORDER — bordo del colore del commander al hover ═ */
.pd-card-rune-border {
  position: absolute;
  inset: 0;
  border-radius: 12px;
  pointer-events: none;
  z-index: 4;
  opacity: 0;
  transition: opacity 0.22s ease, box-shadow 0.22s ease;
}
.pd-card:hover .pd-card-rune-border {
  opacity: 1;
  box-shadow:
    inset 0 0 0 1.5px color-mix(in srgb, var(--pd-cmd-color, #555) 55%, transparent),
    0 0 18px color-mix(in srgb, var(--pd-cmd-color, #555) 20%, transparent);
}

/* ═══ COMMANDER NAME sotto il titolo ════════════════════════ */
.pd-card-cmd {
  font-size: 11px;
  color: rgba(255,255,255,0.60);
  text-shadow: 0 1px 4px rgba(0,0,0,0.9);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: 0.02em;
}

/* ═══ HOVER CARD PREVIEW (modal) ════════════════════════════ */
.pdm-card-tt {
  position: fixed;
  z-index: 2000;
  pointer-events: none;
  border-radius: 4px;
  overflow: hidden;
  border: 0.5px solid rgba(47,58,52,0.8);
  background: #0E1210;
  width: 220px;
  opacity: 1;
  transition: opacity 0.15s;
}
.pdm-card-tt[aria-hidden="true"] { opacity: 0; }
.pdm-card-tt-img { display: block; width: 100%; height: auto; }

/* ═══ HOVER cursor su righe carta nel modal ══════════════════ */
.pdm-row[data-card-id] { cursor: default; }
.pdm-row[data-card-id]:hover { background: var(--bg-elevated); }

  `;
  document.head.appendChild(style);
}
