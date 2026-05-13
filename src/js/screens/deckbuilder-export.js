// deckbuilder-export.js — Import / Export logic (code + image).

import { CardDatabase, CardMap }        from '../data/cards.js';
import { getCurrentDeck }               from '../core/state.js';
import { saveDecks }                    from '../data/decks.js';
import { showGlobalToast as showToast } from '../core/ui.js';

const COLOR_HEX = {
  blue:      '#336699',
  green:     '#385400',
  red:       '#8A0000',
  black:     '#262B2F',
  colorless: '#A19993',
};

function ensure(deck) {
  if (!deck.territoryCards) deck.territoryCards = [];
  if (!deck.sideboardCards)  deck.sideboardCards = [];
}

// ── Encode / Decode ───────────────────────────────────────────

export function encodeDeck(deck) {
  ensure(deck);
  const countIds = ids => {
    const m = {};
    ids.forEach(id => { m[id] = (m[id] || 0) + 1; });
    return Object.entries(m)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([id, n]) => `${id}:${n}`)
      .join(',');
  };

  const raw = [
    deck.commanderId || '',
    countIds(deck.cards || []),
    countIds(deck.territoryCards || []),
    countIds(deck.sideboardCards || []),
  ].join('|');

  return btoa(unescape(encodeURIComponent(raw)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export function decodeDeck(code) {
  if (code.length > 4096) return null;
  try {
    const padded = code.trim().replace(/-/g, '+').replace(/_/g, '/');
    const rem = padded.length % 4;
    const raw = decodeURIComponent(escape(atob(rem ? padded + '='.repeat(4 - rem) : padded)));
    const [cmdPart = '', mainPart = '', terrPart = '', sidePart = ''] = raw.split('|');

    const expand = part =>
      part ? part.split(',').filter(Boolean).flatMap(e => {
        const [id, n = '1'] = e.split(':');
        return Array(Number(n)).fill(id);
      }) : [];

    return {
      commanderId:    cmdPart || null,
      cards:          expand(mainPart),
      territoryCards: expand(terrPart),
      sideboardCards: expand(sidePart),
    };
  } catch { return null; }
}

// ── Export code ───────────────────────────────────────────────

export function onExportCode() {
  const code = encodeDeck(getCurrentDeck());
  const inp  = document.getElementById('db-exp-code');
  inp.value  = code;
  document.getElementById('db-exp-overlay').classList.remove('hidden');
  inp.select();
}

export function closeExportDialog() {
  document.getElementById('db-exp-overlay').classList.add('hidden');
}

export function copyExportCode() {
  const code = document.getElementById('db-exp-code').value;
  navigator.clipboard?.writeText(code).then(() => {
    showToast('Codice copiato!');
  }).catch(() => {
    document.getElementById('db-exp-code').select();
    document.execCommand('copy');
    showToast('Codice copiato!');
  });
}

// ── Import ────────────────────────────────────────────────────

export function onImport() {
  document.getElementById('db-imp-code').value = '';
  document.getElementById('db-imp-overlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('db-imp-code').focus(), 30);
}

export function closeImportDialog() {
  document.getElementById('db-imp-overlay').classList.add('hidden');
}

export function doImport(renderDeckPanel, renderCardList) {
  const code = document.getElementById('db-imp-code').value.trim();
  if (!code) return;
  const data = decodeDeck(code);
  if (!data) { showToast('Codice non valido.'); return; }

  const allIds = [
    ...(data.commanderId ? [data.commanderId] : []),
    ...data.cards,
    ...data.territoryCards,
    ...data.sideboardCards,
  ];
  const invalid = allIds.filter(id => !CardMap.get(id));
  if (invalid.length) {
    showToast(`Carte non riconosciute: ${[...new Set(invalid)].slice(0, 3).join(', ')}`);
    return;
  }

  const deck = getCurrentDeck();
  ensure(deck);
  deck.commanderId    = data.commanderId;
  deck.cards          = data.cards;
  deck.territoryCards = data.territoryCards;
  deck.sideboardCards = data.sideboardCards;
  closeImportDialog();
  saveDecks();
  renderDeckPanel();
  renderCardList();
  showToast('Mazzo importato!');
}

// ── Export image ──────────────────────────────────────────────

export async function onExportImage() {
  const deck = getCurrentDeck();
  ensure(deck);

  const CARD_W = 140, CARD_H = 194, GAP = 12;
  const PAD = 48, CANVAS_W = 1600;
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
  const mainSections = ['Quest', 'Spell', 'Minion']
    .map(t => ({ label: t.toUpperCase(), ids: Object.keys(mainByType[t]), counts: mainByType[t] }))
    .filter(s => s.ids.length);

  const sideCounts = mkCounts(deck.sideboardCards || []);
  const sideIds    = Object.keys(sideCounts);

  let totalH = 80;
  if (topRowH) totalH += topRowH + SEC_GAP;
  mainSections.forEach(s => {
    totalH += SEC_H + Math.ceil(s.ids.length / MAIN_COLS) * (CARD_H + GAP) + SEC_GAP;
  });
  if (sideIds.length) {
    totalH += SEC_H + Math.ceil(sideIds.length / MAIN_COLS) * (CARD_H + GAP) + SEC_GAP;
  }
  totalH += PAD;

  // Carica immagini con concurrency limitata (max 8 fetch parallele)
  const allIds = [...new Set([
    ...(deck.commanderId ? [deck.commanderId] : []),
    ...terrIds,
    ...mainSections.flatMap(s => s.ids),
    ...sideIds,
  ])];
  const imgMap = {};
  const CONCURRENCY = 8;
  for (let i = 0; i < allIds.length; i += CONCURRENCY) {
    await Promise.all(allIds.slice(i, i + CONCURRENCY).map(id => {
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
  }

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
    const bx = (CANVAS_W - bw) / 2, by = (totalH - bh) / 2;
    ctx.drawImage(cmdImg, ART_SX, ART_SY, ART_SW, ART_SH, bx, by, bw, bh);
    ctx.restore();
    ctx.fillStyle = 'rgba(5, 8, 15, 0.72)';
    ctx.fillRect(0, 0, CANVAS_W, totalH);
  } else {
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, CANVAS_W, totalH);
  }

  ctx.fillStyle = '#e8e8e8';
  ctx.font      = 'bold 54px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(deck.name, CANVAS_W / 2, 52);

  let y = 80;

  if (topRowH) {
    if (cmdCard) {
      ctx.fillStyle = '#aaaaaa';
      ctx.font      = 'bold 12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('COMMANDER', PAD, y + 22);
      _imgDrawCard(ctx, deck.commanderId, cmdCard, imgMap, PAD, y + SEC_H, CMD_W, CMD_H, 0);
    }
    if (terrIds.length) {
      const terrX = PAD + (cmdCard ? CMD_AREA : 0);
      ctx.fillStyle = '#aaaaaa';
      ctx.font      = 'bold 12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`TERRITORY  ${(deck.territoryCards||[]).length}/12`, terrX, y + 22);
      terrIds.forEach((id, i) => {
        const col = i % TERR_COLS, row = Math.floor(i / TERR_COLS);
        _imgDrawCard(ctx, id, CardMap.get(id), imgMap,
          terrX + col * (CARD_W + GAP), y + SEC_H + row * (CARD_H + GAP),
          CARD_W, CARD_H, terrCounts[id]);
      });
    }
    y += topRowH + SEC_GAP;
  }

  mainSections.forEach(sec => {
    _imgDrawSection(ctx, sec, y, PAD, MAIN_COLS, CARD_W, CARD_H, GAP, SEC_H, imgMap);
    y += SEC_H + Math.ceil(sec.ids.length / MAIN_COLS) * (CARD_H + GAP) + SEC_GAP;
  });

  if (sideIds.length) {
    _imgDrawSection(ctx,
      { label: `SIDEBOARD  ${(deck.sideboardCards||[]).length}/10`, ids: sideIds, counts: sideCounts },
      y, PAD, MAIN_COLS, CARD_W, CARD_H, GAP, SEC_H, imgMap);
  }

  try {
    const url = canvas.toDataURL('image/png');
    const a   = document.createElement('a');
    a.download = `${deck.name.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_') || 'deck'}.png`;
    a.href = url;
    a.click();
  } catch {
    showToast('Export immagine non riuscito (CORS sulle immagini).');
  }
}

function _imgDrawSection(ctx, sec, y, PAD, COLS, W, H, GAP, SEC_H, imgMap) {
  ctx.fillStyle = '#aaaaaa';
  ctx.font      = 'bold 12px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(sec.label, PAD, y + 22);
  sec.ids.forEach((id, i) => {
    _imgDrawCard(ctx, id, CardMap.get(id), imgMap,
      PAD + (i % COLS) * (W + GAP),
      y + SEC_H + Math.floor(i / COLS) * (H + GAP),
      W, H, sec.counts[id]);
  });
}

function _imgDrawCard(ctx, id, card, imgMap, x, y, W, H, count) {
  if (imgMap[id]) {
    ctx.drawImage(imgMap[id], x, y, W, H);
  } else {
    ctx.fillStyle = COLOR_HEX[card?.color] ?? '#333333';
    ctx.fillRect(x, y, W, H);
    if (card) {
      ctx.fillStyle = '#ffffff';
      ctx.font      = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(card.name, x + W / 2, y + H / 2);
      ctx.textAlign = 'left';
    }
  }
  if (count > 1) {
    ctx.fillStyle = 'rgba(0,0,0,0.82)';
    ctx.fillRect(x + W - 26, y + 5, 22, 22);
    ctx.fillStyle = '#ffffff';
    ctx.font      = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`×${count}`, x + W - 15, y + 19);
    ctx.textAlign = 'left';
  }
}
