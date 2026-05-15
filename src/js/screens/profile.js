// ============================================================
// screens/profile.js — Schermata profilo utente.
// ============================================================

import { db }              from '../core/supabase-client.js';
import { getUser }         from '../auth/auth.js';
import { AppState }        from '../core/state.js';
import { CardDatabase, CardMap } from '../data/cards.js';
import { showGlobalToast } from '../core/ui.js';
import { navigateTo }      from '../core/router.js';

// ─────────────────────────────────────────────────────────────
// RENDER PRINCIPALE (profilo proprio — modificabile)
// ─────────────────────────────────────────────────────────────
export async function renderProfileScreen() {
  const screen = document.getElementById('screen-profile');
  if (!screen) return;

  injectStyles();

  const user = await getUser();
  if (!user) {
    screen.innerHTML = `
      <div class="prof-root">
        <div class="prof-empty">
          <p>Accedi per vedere il tuo profilo.</p>
          <button class="prof-btn prof-btn-primary" id="prof-go-auth">Accedi</button>
        </div>
      </div>`;
    document.getElementById('prof-go-auth')?.addEventListener('click', () => navigateTo('auth'));
    return;
  }

  screen.innerHTML = `<div class="prof-root"><div class="prof-loading">Caricamento profilo…</div></div>`;

  const [profile, publishedDecks] = await Promise.all([
    fetchProfile(user.id),
    fetchPublishedDecks(user.id),
  ]);

  screen.innerHTML = buildSkeleton(profile, publishedDecks, true);
  wireEvents(user, profile, publishedDecks);
}

// ─────────────────────────────────────────────────────────────
// RENDER PROFILO PUBBLICO (sola lettura)
// ─────────────────────────────────────────────────────────────
export async function openPublicProfile(userId) {
  injectStyles();

  const [profile, publishedDecks] = await Promise.all([
    fetchProfile(userId),
    fetchPublishedDecks(userId),
  ]);

  const overlay = document.createElement('div');
  overlay.className = 'prof-pub-overlay';
  overlay.innerHTML = `
    <div class="prof-pub-modal">
      <button class="prof-pub-close" id="prof-pub-close">✕</button>
      ${buildSkeleton(profile, publishedDecks, false)}
    </div>`;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.getElementById('prof-pub-close').addEventListener('click', close);

  // published decks cliccabili anche nel profilo pubblico
  wirePublishedDecks(overlay, publishedDecks);
}

// ─────────────────────────────────────────────────────────────
// FETCH
// ─────────────────────────────────────────────────────────────
async function fetchProfile(userId) {
  const { data, error } = await db
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) console.warn('fetchProfile:', error.message);
  return data || {};
}

async function fetchPublishedDecks(userId) {
  const { data, error } = await db
    .from('public_decks')
    .select('*')
    .eq('author_user_id', userId)
    .order('created_at', { ascending: false });
  if (error) console.warn('fetchPublishedDecks:', error.message);
  return data || [];
}

// ─────────────────────────────────────────────────────────────
// SOCIAL PLATFORMS CATALOG
// ─────────────────────────────────────────────────────────────
const SOCIAL_PLATFORMS = [
  { id: 'instagram', label: 'Instagram', color: '#E1306C', svg: `<svg viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>` },
  { id: 'facebook',  label: 'Facebook',  color: '#1877F2', svg: `<svg viewBox="0 0 24 24"><path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/></svg>` },
  { id: 'discord',   label: 'Discord',   color: '#5865F2', svg: `<svg viewBox="0 0 24 24"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>` },
  { id: 'github',    label: 'GitHub',    color: '#fff',    svg: `<svg viewBox="0 0 24 24"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>` },
  { id: 'twitter',   label: 'X / Twitter', color: '#fff', svg: `<svg viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.912-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>` },
  { id: 'youtube',   label: 'YouTube',   color: '#FF0000', svg: `<svg viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>` },
  { id: 'tiktok',    label: 'TikTok',    color: '#fff',    svg: `<svg viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>` },
  { id: 'twitch',    label: 'Twitch',    color: '#9146FF', svg: `<svg viewBox="0 0 24 24"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/></svg>` },
  { id: 'reddit',    label: 'Reddit',    color: '#FF4500', svg: `<svg viewBox="0 0 24 24"><path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/></svg>` },
  { id: 'linkedin',  label: 'LinkedIn',  color: '#0A66C2', svg: `<svg viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>` },
];

// ─────────────────────────────────────────────────────────────
// HTML SKELETON
// ─────────────────────────────────────────────────────────────
const COLOR_HEX = {
  blue: '#336699', green: '#385400', red: '#8A0000',
  black: '#262B2F', colorless: '#A19993',
};

function buildSkeleton(profile, decks, editable) {
  const avatarUrl  = profile.avatar_url || '';
  const bio        = profile.bio || '';
  const username   = profile.username || AppState.username || '?';

  // 3 carte preferite — stored as favorite_card_ids (array) o fallback su favorite_card_id
  const favIds = profile.favorite_card_ids
    ? (Array.isArray(profile.favorite_card_ids) ? profile.favorite_card_ids : []).slice(0, 3).map(String)
    : (profile.favorite_card_id ? [String(profile.favorite_card_id)] : []);

  // social links — stored as social_links (array di {platform, url}) o fallback legacy
  let socials = [];
  if (Array.isArray(profile.social_links) && profile.social_links.length) {
    // migra vecchio formato {label,url} → {platform,url} se necessario
    socials = profile.social_links.map(s => {
      if (s.platform) return s;
      // prova a trovare la piattaforma dal label
      const p = SOCIAL_PLATFORMS.find(pl =>
        pl.label.toLowerCase() === (s.label || '').toLowerCase() ||
        pl.id === (s.label || '').toLowerCase()
      );
      return { platform: p ? p.id : '', url: s.url || '' };
    });
  } else if (profile.social_label && profile.social_url) {
    const p = SOCIAL_PLATFORMS.find(pl =>
      pl.label.toLowerCase() === profile.social_label.toLowerCase() ||
      pl.id === profile.social_label.toLowerCase()
    );
    socials = [{ platform: p ? p.id : '', url: profile.social_url }];
  }

  // 3 slot carte preferite
  const favSlotsHtml = [0, 1, 2].map(i => {
    const card = favIds[i] ? CardDatabase.find(c => c.id === favIds[i]) : null;
    return `
      <div class="prof-fav-slot${card ? '' : ' prof-fav-slot-empty'}" data-slot="${i}">
        ${card
          ? `<img src="${card.image}" alt="${esc(card.name)}" class="prof-fav-slot-img" title="${esc(card.name)}">`
          : `<span class="prof-fav-slot-plus">${editable ? '+' : '—'}</span>`}
        ${editable ? `<button class="prof-fav-slot-rm${card ? '' : ' hidden'}" data-slot="${i}" title="Rimuovi">✕</button>` : ''}
      </div>`;
  }).join('');

  // social display: icone cliccabili
  const socialsIconsHtml = socials.filter(s => s.url).map(s => {
    const platform = SOCIAL_PLATFORMS.find(p => p.id === s.platform) || null;
    if (!platform) return '';
    return `<a class="prof-social-icon" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer" title="${esc(platform.label)}" style="--social-c:${platform.color}">${platform.svg}</a>`;
  }).join('');

  // social editor (solo se editable)
  const socialsEditorHtml = editable ? `
    <div class="prof-socials-list" id="prof-socials-list">
      ${socials.map((s, i) => socialRowHtml(i, s.platform || '', s.url || '')).join('')}
    </div>
    <button class="prof-btn prof-btn-sm" id="prof-add-social">+ Add</button>
  ` : '';

  // published decks
  const decksHtml = decks.length
    ? decks.map(d => {
        const color = COLOR_HEX[d.commander_color] || COLOR_HEX.colorless;
        return `<button class="prof-deck-chip" data-deck-id="${esc(d.id)}" style="border-left-color:${color}">${esc(d.name)}</button>`;
      }).join('')
    : `<div class="prof-deck-empty">No published decks.</div>`;

  return `
<div class="prof-root">
  <div class="prof-header">
    <div class="prof-avatar-wrap">
      <div class="prof-avatar" id="prof-avatar-display">
        ${avatarUrl
          ? `<img src="${esc(avatarUrl)}" alt="avatar" class="prof-avatar-img">`
          : `<div class="prof-avatar-placeholder">${username[0].toUpperCase()}</div>`}
      </div>
      ${editable ? `
        <button class="prof-avatar-edit-btn" id="prof-avatar-btn" title="Cambia foto">
          <svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm17.71-10.21a1 1 0 0 0 0-1.42l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.82z"/></svg>
        </button>
        <input type="file" id="prof-avatar-input" accept="image/*" style="display:none">
      ` : ''}
    </div>
    <div class="prof-header-info">
      <div class="prof-username">${esc(username)}</div>
      ${socialsIconsHtml ? `<div class="prof-social-icons">${socialsIconsHtml}</div>` : ''}
    </div>
  </div>

  <div class="prof-body">

    <!-- Bio -->
    <div class="prof-section">
      <div class="prof-section-label">Bio</div>
      ${editable
        ? `<textarea class="prof-textarea" id="prof-bio" maxlength="300" placeholder="Scrivi qualcosa su di te…">${esc(bio)}</textarea>
           <div class="prof-char-count"><span id="prof-bio-count">${bio.length}</span>/300</div>`
        : (bio ? `<p class="prof-bio-readonly">${esc(bio)}</p>` : `<p class="prof-bio-readonly prof-empty-text">—</p>`)}
    </div>

    <!-- Carte preferite -->
    <div class="prof-section">
      <div class="prof-section-label">My favourite Rafflesia TCG's cards</div>
      <div class="prof-fav-slots" id="prof-fav-slots">${favSlotsHtml}</div>
      ${editable ? `
        <div class="prof-fav-search-wrap" id="prof-fav-search-wrap" style="display:none">
          <input class="prof-input" id="prof-fav-search" type="text" placeholder="Cerca carta…" autocomplete="off">
          <div class="prof-fav-dropdown" id="prof-fav-dropdown"></div>
        </div>
      ` : ''}
    </div>

    ${editable ? `
    <!-- Social editor -->
    <div class="prof-section">
      <div class="prof-section-label">Social links</div>
      ${socialsEditorHtml}
    </div>
    ` : ''}

    <!-- Published decks -->
    <div class="prof-section">
      <div class="prof-section-label">Published decks</div>
      <div class="prof-decks-grid" id="prof-decks-grid">${decksHtml}</div>
    </div>

    ${editable ? `
    <!-- Salva -->
    <div class="prof-actions">
      <button class="prof-btn prof-btn-primary" id="prof-save">Save profile</button>
    </div>
    ` : ''}

  </div>
</div>`;
}

function socialRowHtml(i, platformId, url) {
  const platform = SOCIAL_PLATFORMS.find(p => p.id === platformId);
  const displayName = platform ? platform.label : (platformId || '');
  const iconHtml = platform
    ? `<span class="prof-social-row-icon" style="color:${platform.color}">${platform.svg}</span>`
    : `<span class="prof-social-row-icon prof-social-row-icon-empty">?</span>`;
  return `
    <div class="prof-social-row" data-social-idx="${i}" data-platform="${esc(platformId)}">
      <div class="prof-social-platform-wrap">
        ${iconHtml}
        <div class="prof-social-search-wrap">
          <input class="prof-input prof-social-platform-inp" type="text"
            placeholder="Platform…" autocomplete="off"
            value="${esc(displayName)}" data-platform-id="${esc(platformId)}">
          <div class="prof-social-platform-drop"></div>
        </div>
      </div>
      <input class="prof-input prof-social-url-inp" type="url" placeholder="https://…" value="${esc(url)}">
      <button class="prof-btn prof-btn-sm prof-btn-danger-sm" data-rm-social="${i}" title="Remove">✕</button>
    </div>`;
}

// ─────────────────────────────────────────────────────────────
// EVENTI (solo profilo proprio)
// ─────────────────────────────────────────────────────────────
let _favIds = [null, null, null]; // slot 0-2
let _editingSlot = null;

function wireEvents(user, profile, publishedDecks) {
  // ripristina stato fav ids
  const storedIds = profile.favorite_card_ids
    ? (Array.isArray(profile.favorite_card_ids) ? profile.favorite_card_ids : []).slice(0, 3).map(String)
    : (profile.favorite_card_id ? [String(profile.favorite_card_id)] : []);
  _favIds = [storedIds[0] || null, storedIds[1] || null, storedIds[2] || null];

  // Bio char count
  const bioTA    = document.getElementById('prof-bio');
  const bioCount = document.getElementById('prof-bio-count');
  bioTA?.addEventListener('input', () => { if (bioCount) bioCount.textContent = bioTA.value.length; });

  // Avatar
  const avatarBtn   = document.getElementById('prof-avatar-btn');
  const avatarInput = document.getElementById('prof-avatar-input');
  avatarBtn?.addEventListener('click', () => avatarInput?.click());
  avatarInput?.addEventListener('change', async () => {
    const file = avatarInput.files?.[0];
    if (!file) return;
    await uploadAvatar(user, file);
  });

  // Slot carte preferite — click per aprire ricerca
  document.querySelectorAll('.prof-fav-slot').forEach(slot => {
    slot.addEventListener('click', e => {
      if (e.target.closest('.prof-fav-slot-rm')) return; // gestito sotto
      _editingSlot = Number(slot.dataset.slot);
      const wrap = document.getElementById('prof-fav-search-wrap');
      if (wrap) {
        wrap.style.display = 'block';
        document.getElementById('prof-fav-search')?.focus();
      }
    });
  });

  // Rimuovi carta da slot
  document.querySelectorAll('.prof-fav-slot-rm').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const i = Number(btn.dataset.slot);
      _favIds[i] = null;
      refreshFavSlots();
    });
  });

  // Ricerca carta
  const favSearch   = document.getElementById('prof-fav-search');
  const favDropdown = document.getElementById('prof-fav-dropdown');
  favSearch?.addEventListener('input', () => {
    const q = favSearch.value.trim().toLowerCase();
    if (!q) { favDropdown.innerHTML = ''; favDropdown.classList.remove('open'); return; }
    const results = CardDatabase.filter(c => c.name.toLowerCase().includes(q)).slice(0, 8);
    if (!results.length) { favDropdown.innerHTML = ''; favDropdown.classList.remove('open'); return; }
    favDropdown.innerHTML = results.map(c =>
      `<div class="prof-fav-item" data-id="${esc(c.id)}">${esc(c.name)}</div>`
    ).join('');
    favDropdown.classList.add('open');
    favDropdown.querySelectorAll('.prof-fav-item').forEach(item => {
      item.addEventListener('click', () => {
        if (_editingSlot !== null) {
          _favIds[_editingSlot] = item.dataset.id;
          refreshFavSlots();
        }
        favSearch.value = '';
        favDropdown.innerHTML = '';
        favDropdown.classList.remove('open');
        const wrap = document.getElementById('prof-fav-search-wrap');
        if (wrap) wrap.style.display = 'none';
        _editingSlot = null;
      });
    });
  });

  document.addEventListener('click', e => {
    if (!favSearch?.contains(e.target) && !favDropdown?.contains(e.target)) {
      favDropdown?.classList.remove('open');
    }
  }, { capture: true });

  // Social: wire autocomplete e rimozione su righe esistenti
  document.querySelectorAll('.prof-social-row').forEach(row => wireSocialRow(row));

  // Social: aggiungi riga
  let _socialCount = document.querySelectorAll('.prof-social-row').length;
  document.getElementById('prof-add-social')?.addEventListener('click', () => {
    const list = document.getElementById('prof-socials-list');
    if (!list || _socialCount >= 6) return;
    const tmp = document.createElement('div');
    tmp.innerHTML = socialRowHtml(_socialCount, '', '');
    const newRow = tmp.firstElementChild;
    list.appendChild(newRow);
    wireSocialRow(newRow);
    _socialCount++;
  });

  // Salva
  document.getElementById('prof-save')?.addEventListener('click', () => saveProfile(user));

  // Published decks cliccabili
  wirePublishedDecks(document, publishedDecks);
}

function wireSocialRow(row) {
  if (!row) return;

  // Rimozione
  row.querySelector('[data-rm-social]')?.addEventListener('click', () => row.remove());

  // Autocomplete piattaforma
  const inp  = row.querySelector('.prof-social-platform-inp');
  const drop = row.querySelector('.prof-social-platform-drop');
  if (!inp || !drop) return;

  const setIcon = (platform) => {
    const iconWrap = row.querySelector('.prof-social-row-icon');
    if (!iconWrap) return;
    if (platform) {
      iconWrap.innerHTML  = platform.svg;
      iconWrap.style.color = platform.color;
      iconWrap.classList.remove('prof-social-row-icon-empty');
    } else {
      iconWrap.innerHTML  = '?';
      iconWrap.style.color = '';
      iconWrap.classList.add('prof-social-row-icon-empty');
    }
    row.dataset.platform = platform ? platform.id : '';
  };

  inp.addEventListener('input', () => {
    const q = inp.value.trim().toLowerCase();
    const matches = q
      ? SOCIAL_PLATFORMS.filter(p => p.label.toLowerCase().includes(q) || p.id.includes(q))
      : SOCIAL_PLATFORMS;
    drop.innerHTML = matches.map(p => `
      <div class="prof-sp-item" data-id="${p.id}" style="--sp-c:${p.color}">
        <span class="prof-sp-icon">${p.svg}</span>
        <span>${p.label}</span>
      </div>`).join('');
    drop.classList.toggle('open', matches.length > 0);
  });

  inp.addEventListener('focus', () => {
    const q = inp.value.trim().toLowerCase();
    const matches = q
      ? SOCIAL_PLATFORMS.filter(p => p.label.toLowerCase().includes(q) || p.id.includes(q))
      : SOCIAL_PLATFORMS;
    drop.innerHTML = matches.map(p => `
      <div class="prof-sp-item" data-id="${p.id}" style="--sp-c:${p.color}">
        <span class="prof-sp-icon">${p.svg}</span>
        <span>${p.label}</span>
      </div>`).join('');
    drop.classList.toggle('open', matches.length > 0);
  });

  drop.addEventListener('click', e => {
    const item = e.target.closest('.prof-sp-item');
    if (!item) return;
    const platform = SOCIAL_PLATFORMS.find(p => p.id === item.dataset.id);
    if (!platform) return;
    inp.value = platform.label;
    inp.dataset.platformId = platform.id;
    drop.classList.remove('open');
    drop.innerHTML = '';
    setIcon(platform);
  });

  document.addEventListener('click', e => {
    if (!row.contains(e.target)) drop.classList.remove('open');
  }, { capture: true });
}

function refreshFavSlots() {
  const container = document.getElementById('prof-fav-slots');
  if (!container) return;
  container.innerHTML = [0, 1, 2].map(i => {
    const card = _favIds[i] ? CardDatabase.find(c => c.id === _favIds[i]) : null;
    return `
      <div class="prof-fav-slot${card ? '' : ' prof-fav-slot-empty'}" data-slot="${i}">
        ${card
          ? `<img src="${card.image}" alt="${esc(card.name)}" class="prof-fav-slot-img" title="${esc(card.name)}">`
          : `<span class="prof-fav-slot-plus">+</span>`}
        <button class="prof-fav-slot-rm${card ? '' : ' hidden'}" data-slot="${i}" title="Rimuovi">✕</button>
      </div>`;
  }).join('');

  // re-wire slot events
  container.querySelectorAll('.prof-fav-slot').forEach(slot => {
    slot.addEventListener('click', e => {
      if (e.target.closest('.prof-fav-slot-rm')) return;
      _editingSlot = Number(slot.dataset.slot);
      const wrap = document.getElementById('prof-fav-search-wrap');
      if (wrap) { wrap.style.display = 'block'; document.getElementById('prof-fav-search')?.focus(); }
    });
  });
  container.querySelectorAll('.prof-fav-slot-rm').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      _favIds[Number(btn.dataset.slot)] = null;
      refreshFavSlots();
    });
  });
}

// Published decks cliccabili → modale (funziona sia sul profilo proprio che pubblico)
function wirePublishedDecks(root, decks) {
  root.querySelectorAll('.prof-deck-chip[data-deck-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const deck = decks.find(d => String(d.id) === btn.dataset.deckId);
      if (deck) openDeckModal(deck);
    });
  });
}

// ─────────────────────────────────────────────────────────────
// MODALE DETTAGLIO MAZZO (replica stile publicdeck)
// ─────────────────────────────────────────────────────────────
function openDeckModal(deck) {
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
      const dot = card ? `<span class="pdm-dot" style="background:${COLOR_HEX[card.color]||COLOR_HEX.colorless}"></span>` : '';
      return `<div class="pdm-row" data-card-id="${id}">${dot}<span class="pdm-name">${name}</span>${qtyStr}</div>`;
    }).join('');
    return `<div class="pdm-section"><div class="pdm-sec-label">${label}</div>${rows}</div>`;
  };

  const cmdSection = commander ? `
    <div class="pdm-section">
      <div class="pdm-sec-label">COMMANDER</div>
      <div class="pdm-row pdm-row-cmd" data-card-id="${esc(deck.commander_id)}">
        <span class="pdm-dot" style="background:${colorHex}"></span>
        <span class="pdm-name">${esc(commander.name)}</span>
      </div>
    </div>` : '';

  const overlay = document.createElement('div');
  overlay.className = 'pdm-overlay';
  overlay.innerHTML = `
    <div class="pdm-modal">
      <div class="pdm-header" style="--pdm-color:${colorHex}">
        <div class="pdm-header-bg" ${commander?.image ? `style="background-image:url('${commander.image}')"` : ''}></div>
        <div class="pdm-header-overlay"></div>
        <div class="pdm-header-content">
          <div class="pdm-title">${esc(deck.name)}</div>
        </div>
        <button class="pdm-close" id="pdm-prof-close">✕</button>
      </div>
      <div class="pdm-body">
        <div class="pdm-list">
          ${cmdSection}
          ${buildSection('MAIN DECK', deck.cards)}
          ${buildSection('TERRITORY', deck.territory_cards)}
          ${buildSection('SIDEBOARD', deck.sideboard_cards)}
        </div>
        <div class="pdm-actions">
          <button class="pdm-btn" id="pdm-prof-exp-code">Export code</button>
          <button class="pdm-btn" id="pdm-prof-exp-img">Export img</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  // card hover preview
  const tt = document.createElement('div');
  tt.className = 'pdm-card-tt';
  tt.setAttribute('aria-hidden', 'true');
  tt.innerHTML = `<img class="pdm-card-tt-img" src="" alt="">`;
  document.body.appendChild(tt);
  const ttImg = tt.querySelector('.pdm-card-tt-img');
  const moveTT = e => {
    const w = 220, m = 10;
    let x = e.clientX + 16, y = e.clientY - 110;
    if (x + w + m > window.innerWidth)  x = e.clientX - w - 10;
    if (x < m) x = m;
    if (y + 308 + m > window.innerHeight) y = window.innerHeight - 308 - m;
    if (y < m) y = m;
    tt.style.left = x + 'px'; tt.style.top = y + 'px';
  };
  overlay.querySelectorAll('.pdm-row[data-card-id]').forEach(row => {
    const card = CardMap.get(row.dataset.cardId);
    if (!card) return;
    row.addEventListener('mouseenter', e => { ttImg.src = card.image; tt.removeAttribute('aria-hidden'); moveTT(e); });
    row.addEventListener('mousemove', moveTT);
    row.addEventListener('mouseleave', () => tt.setAttribute('aria-hidden', 'true'));
  });

  const close = () => { overlay.remove(); tt.remove(); };
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.getElementById('pdm-prof-close').addEventListener('click', close);

  // export code
  document.getElementById('pdm-prof-exp-code').addEventListener('click', () => {
    const code = encodeDeck(deck);
    const el = document.createElement('div');
    el.className = 'pdm-overlay';
    el.innerHTML = `<div class="pdm-modal pdm-modal-sm">
      <div class="pdm-exp-title">Deck code — copy and share:</div>
      <div class="pdm-exp-row">
        <input class="pdm-exp-inp" id="pdm-exp-inp2" type="text" readonly value="${esc(code)}">
        <button class="pdm-btn pdm-btn-primary" id="pdm-exp-copy2">Copy</button>
      </div>
      <button class="pdm-btn" id="pdm-exp-close2" style="margin-top:12px">Close</button>
    </div>`;
    document.body.appendChild(el);
    el.addEventListener('click', e => { if (e.target === el) el.remove(); });
    document.getElementById('pdm-exp-close2').addEventListener('click', () => el.remove());
    document.getElementById('pdm-exp-copy2').addEventListener('click', () => {
      navigator.clipboard?.writeText(code).catch(() => {});
      showGlobalToast('Code copied!', 'success');
    });
  });

  // export img
  document.getElementById('pdm-prof-exp-img').addEventListener('click', () => {
    exportDeckImageSimple(deck);
  });
}

function encodeDeck(deck) {
  const countIds = ids => {
    const m = {};
    ids.forEach(id => { m[id] = (m[id] || 0) + 1; });
    return Object.entries(m).sort(([a],[b]) => Number(a)-Number(b)).map(([id,n]) => `${id}:${n}`).join(',');
  };
  const sortIds = ids => [...new Set(ids)].sort((a,b) => Number(a)-Number(b)).join(',');
  const raw = [
    deck.commander_id || '',
    countIds(deck.cards || []),
    sortIds(deck.territory_cards || []),
    countIds(deck.sideboard_cards || []),
  ].join('|');
  return btoa(unescape(encodeURIComponent(raw))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
}

async function exportDeckImageSimple(deck) {
  const CARD_W = 140, CARD_H = 194, GAP = 12, PAD = 48, CANVAS_W = 1600;
  const allIds = [...new Set([
    ...(deck.commander_id ? [String(deck.commander_id)] : []),
    ...(deck.cards || []).map(String),
    ...(deck.territory_cards || []).map(String),
    ...(deck.sideboard_cards || []).map(String),
  ])];
  const imgMap = {};
  await Promise.all(allIds.map(id => {
    const card = CardMap.get(id);
    if (!card?.image) return Promise.resolve();
    return new Promise(resolve => {
      const img = new Image(); img.crossOrigin = 'anonymous';
      img.onload = () => { imgMap[id] = img; resolve(); };
      img.onerror = resolve;
      img.src = card.image;
    });
  }));

  const MAIN_COLS = Math.max(1, Math.floor((CANVAS_W - PAD*2 + GAP) / (CARD_W + GAP)));
  const sections = [
    { label: 'COMMANDER', ids: deck.commander_id ? [String(deck.commander_id)] : [], counts: {} },
    ...['MAIN DECK','TERRITORY','SIDEBOARD'].map((l, i) => {
      const raw = [deck.cards, deck.territory_cards, deck.sideboard_cards][i] || [];
      const counts = {}; raw.forEach(id => { counts[id] = (counts[id]||0)+1; });
      return { label: l, ids: [...new Set(raw.map(String))], counts };
    }),
  ].filter(s => s.ids.length);

  let totalH = 80;
  sections.forEach(s => { totalH += 32 + Math.ceil(s.ids.length/MAIN_COLS)*(CARD_H+GAP) + 30; });
  totalH += PAD;

  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_W; canvas.height = totalH;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0d1117'; ctx.fillRect(0, 0, CANVAS_W, totalH);
  ctx.fillStyle = '#e8e8e8'; ctx.font = 'bold 54px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(deck.name, CANVAS_W/2, 52);

  let y = 80;
  sections.forEach(s => {
    ctx.fillStyle = '#aaaaaa'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(s.label, PAD, y + 22);
    s.ids.forEach((id, i) => {
      const card = CardMap.get(id);
      const x = PAD + (i % MAIN_COLS) * (CARD_W + GAP);
      const cy = y + 32 + Math.floor(i/MAIN_COLS)*(CARD_H+GAP);
      if (imgMap[id]) {
        ctx.drawImage(imgMap[id], x, cy, CARD_W, CARD_H);
      } else {
        ctx.fillStyle = '#333'; ctx.fillRect(x, cy, CARD_W, CARD_H);
        if (card) { ctx.fillStyle = '#fff'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(card.name, x+CARD_W/2, cy+CARD_H/2); ctx.textAlign = 'left'; }
      }
      const qty = s.counts[id] || 1;
      if (qty > 1) {
        ctx.fillStyle = 'rgba(0,0,0,0.82)'; ctx.fillRect(x+CARD_W-26, cy+5, 22, 22);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(`×${qty}`, x+CARD_W-15, cy+19); ctx.textAlign = 'left';
      }
    });
    y += 32 + Math.ceil(s.ids.length/MAIN_COLS)*(CARD_H+GAP) + 30;
  });

  try {
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.download = `${(deck.name||'deck').replace(/[^\w\s-]/g,'').replace(/\s+/g,'_')}.png`;
    a.href = url; a.click();
  } catch { showGlobalToast('Export failed (CORS).', 'error'); }
}

// ─────────────────────────────────────────────────────────────
// UPLOAD AVATAR
// ─────────────────────────────────────────────────────────────
async function uploadAvatar(user, file) {
  const ext  = file.type === 'image/png' ? 'png' : 'jpg';
  const path = `avatars/${user.id}.${ext}`;

  const { error: upErr } = await db.storage.from('avatars').upload(path, file, {
    upsert: true, contentType: file.type,
  });
  if (upErr) { showGlobalToast(`Upload error: ${upErr.message}`, 'error'); return; }

  const { data: urlData } = db.storage.from('avatars').getPublicUrl(path);
  const publicUrl = urlData?.publicUrl;
  if (!publicUrl) { showGlobalToast('Avatar URL unavailable.', 'error'); return; }

  const { error: updErr } = await db.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id);
  if (updErr) { showGlobalToast('Error updating profile.', 'error'); return; }

  const display = document.getElementById('prof-avatar-display');
  if (display) display.innerHTML = `<img src="${publicUrl}?t=${Date.now()}" alt="avatar" class="prof-avatar-img">`;
  showGlobalToast('Photo updated.', 'success');
}

// ─────────────────────────────────────────────────────────────
// SALVA PROFILO
// ─────────────────────────────────────────────────────────────
async function saveProfile(user) {
  const bio = document.getElementById('prof-bio')?.value.trim() || '';

  // social links: legge piattaforma (id) e url da ogni riga
  const socialLinks = [];
  document.querySelectorAll('#prof-socials-list .prof-social-row').forEach(row => {
    const platformInp = row.querySelector('.prof-social-platform-inp');
    const platformId  = platformInp?.dataset.platformId || row.dataset.platform || '';
    const url         = row.querySelector('.prof-social-url-inp')?.value.trim() || '';
    if (platformId && url) socialLinks.push({ platform: platformId, url });
  });

  // fav ids puliti (max 3, senza null)
  const favIds = _favIds.filter(Boolean);

  // Colonne legacy che esistono sicuramente nel DB
  const firstPlatform = SOCIAL_PLATFORMS.find(p => p.id === socialLinks[0]?.platform);
  const payload = {
    bio,
    social_label: firstPlatform?.label || socialLinks[0]?.platform || '',
    social_url:   socialLinks[0]?.url   || '',
    favorite_card_id: favIds[0] ? Number(favIds[0]) : null,
  };

  // Tenta di aggiungere le colonne nuove (potrebbero non esistere ancora)
  // Se non esistono nel DB, Supabase restituirà un errore che gestiamo
  const payloadFull = {
    ...payload,
    social_links:      socialLinks,
    favorite_card_ids: favIds,
  };

  let { error } = await db.from('profiles').update(payloadFull).eq('id', user.id);

  // Se fallisce per colonne mancanti, riprova con solo le colonne legacy
  if (error) {
    console.warn('saveProfile (full):', error.message);
    const fallback = await db.from('profiles').update(payload).eq('id', user.id);
    error = fallback.error;
  }

  if (error) {
    showGlobalToast(`Error: ${error.message}`, 'error');
    console.warn('saveProfile:', error.message);
    return;
  }
  showGlobalToast('Saved!', 'success');
}

// ─────────────────────────────────────────────────────────────
// UTILITY
// ─────────────────────────────────────────────────────────────
function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─────────────────────────────────────────────────────────────
// CSS
// ─────────────────────────────────────────────────────────────
function injectStyles() {
  if (document.getElementById('prof-styles')) return;
  const s = document.createElement('style');
  s.id = 'prof-styles';
  s.textContent = `

/* ══ ROOT ════════════════════════════════════════════════════ */
.prof-root {
  max-width: 720px;
  margin: 0 auto;
  padding: 48px 28px 72px;
}
.prof-loading, .prof-empty {
  text-align: center; color: var(--text-secondary); padding: 80px 0;
  font-size: 15px; display: flex; flex-direction: column; align-items: center; gap: 18px;
}

/* ══ HEADER ══════════════════════════════════════════════════ */
.prof-header {
  display: flex; align-items: center; gap: 28px;
  margin-bottom: 40px; padding-bottom: 28px; border-bottom: 1px solid var(--border);
}
.prof-avatar-wrap { position: relative; flex-shrink: 0; }
.prof-avatar {
  width: 90px; height: 90px; border-radius: 50%; overflow: hidden;
  background: var(--bg-elevated); border: 2px solid var(--border);
  display: flex; align-items: center; justify-content: center;
}
.prof-avatar-img { width: 100%; height: 100%; object-fit: cover; }
.prof-avatar-placeholder {
  font-family: 'Cinzel', serif; font-size: 36px; font-weight: 700; color: var(--text-secondary);
}
.prof-avatar-edit-btn {
  position: absolute; bottom: 0; right: 0; width: 28px; height: 28px;
  border-radius: 50%; border: 1px solid var(--border); background: var(--bg-elevated);
  color: var(--text-primary); cursor: pointer; display: flex; align-items: center;
  justify-content: center; transition: background 0.15s;
}
.prof-avatar-edit-btn:hover { background: var(--violet); border-color: var(--violet); }
.prof-avatar-edit-btn svg { width: 14px; height: 14px; fill: currentColor; }
.prof-header-info { display: flex; flex-direction: column; gap: 6px; }
.prof-username { font-family: 'Cinzel', serif; font-size: 26px; font-weight: 700; color: var(--text-primary); }

/* ══ BODY ════════════════════════════════════════════════════ */
.prof-body { display: flex; flex-direction: column; gap: 32px; }
.prof-section { display: flex; flex-direction: column; gap: 10px; }
.prof-section-label { font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--text-secondary); }
.prof-bio-readonly { font-size: 14px; color: var(--text-secondary); line-height: 1.6; margin: 0; }
.prof-empty-text { opacity: 0.4; }

/* ══ INPUTS ══════════════════════════════════════════════════ */
.prof-input {
  background: var(--bg-elevated); border: 1px solid var(--border); border-radius: 8px;
  color: var(--text-primary); font-size: 14px; padding: 9px 13px; outline: none;
  transition: border-color 0.15s; width: 100%; box-sizing: border-box;
}
.prof-input:focus { border-color: var(--violet); }
.prof-textarea {
  background: var(--bg-elevated); border: 1px solid var(--border); border-radius: 8px;
  color: var(--text-primary); font-size: 14px; padding: 10px 13px; outline: none;
  transition: border-color 0.15s; width: 100%; box-sizing: border-box;
  resize: vertical; min-height: 90px; font-family: inherit; line-height: 1.5;
}
.prof-textarea:focus { border-color: var(--violet); }
.prof-char-count { font-size: 11px; color: var(--text-secondary); text-align: right; }

/* ══ SOCIAL ROWS ═════════════════════════════════════════════ */
#prof-socials-list { display: flex; flex-direction: column; gap: 8px; }
.prof-social-row { display: flex; gap: 8px; align-items: center; }
.prof-social-label-inp { flex: 1; }
.prof-social-url-inp   { flex: 2; }

/* ══ CARTE PREFERITE ════════════════════════════════════════ */
.prof-fav-slots { display: flex; gap: 14px; flex-wrap: wrap; }
.prof-fav-slot {
  position: relative; width: 90px; height: 126px; border-radius: 8px;
  border: 1.5px solid var(--border); background: var(--bg-elevated);
  overflow: hidden; cursor: pointer; transition: border-color 0.15s;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.prof-fav-slot:hover { border-color: var(--violet); }
.prof-fav-slot-empty { border-style: dashed; }
.prof-fav-slot-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.prof-fav-slot-plus { font-size: 28px; color: var(--text-secondary); opacity: 0.4; line-height: 1; }
.prof-fav-slot-rm {
  position: absolute; top: 4px; right: 4px; width: 18px; height: 18px;
  border-radius: 50%; background: rgba(0,0,0,0.65); border: none;
  color: #fff; font-size: 9px; cursor: pointer; display: flex;
  align-items: center; justify-content: center; line-height: 1;
  opacity: 0; transition: opacity 0.12s; padding: 0;
}
.prof-fav-slot:hover .prof-fav-slot-rm { opacity: 1; }
.prof-fav-slot-rm.hidden { display: none; }

.prof-fav-search-wrap { position: relative; max-width: 320px; margin-top: 6px; }
.prof-fav-dropdown {
  display: none; position: absolute; top: calc(100% + 4px); left: 0; right: 0;
  background: rgba(11,11,22,0.98); border: 1px solid var(--border-gold);
  border-radius: 8px; z-index: 200; max-height: 220px; overflow-y: auto;
  box-shadow: 0 8px 24px rgba(0,0,0,0.6);
}
.prof-fav-dropdown.open { display: block; }
.prof-fav-item { padding: 9px 14px; font-size: 13px; color: var(--text-primary); cursor: pointer; transition: background 0.12s; }
.prof-fav-item:hover { background: rgba(255,255,255,0.07); }

/* ══ PUBLISHED DECKS ════════════════════════════════════════ */
.prof-decks-grid { display: flex; flex-wrap: wrap; gap: 8px; }
.prof-deck-chip {
  padding: 6px 14px; background: var(--bg-elevated); border: 1px solid var(--border);
  border-left: 4px solid; border-radius: 6px; font-size: 13px; color: var(--text-primary);
  cursor: pointer; transition: border-color 0.15s, background 0.15s; text-align: left;
}
.prof-deck-chip:hover { background: var(--bg-surface); border-color: var(--border-gold); }
.prof-deck-empty { font-size: 13px; color: var(--text-secondary); }

/* ══ ACTIONS ═════════════════════════════════════════════════ */
.prof-actions { display: flex; justify-content: flex-end; }
.prof-btn {
  background: var(--bg-elevated); border: 1px solid var(--border); border-radius: 8px;
  color: var(--text-primary); font-size: 14px; padding: 10px 24px; cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.prof-btn:hover { border-color: var(--violet); }
.prof-btn-primary { background: var(--violet); border-color: var(--violet); color: #fff; }
.prof-btn-primary:hover { background: var(--violet-bright); border-color: var(--violet-bright); }
.prof-btn-sm { padding: 6px 14px; font-size: 12px; border-radius: 6px; white-space: nowrap; flex-shrink: 0; }
.prof-btn-danger-sm { color: var(--error); border-color: var(--error); background: transparent; }
.prof-btn-danger-sm:hover { background: rgba(200,112,112,0.12); }

/* ══ PROFILO PUBBLICO OVERLAY ════════════════════════════════ */
.prof-pub-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.72); z-index: 1000;
  display: flex; align-items: center; justify-content: center; padding: 20px;
}
.prof-pub-modal {
  background: var(--bg-elevated); border: 1px solid var(--border); border-radius: 14px;
  width: 100%; max-width: 600px; max-height: 90vh; overflow-y: auto;
  box-shadow: 0 24px 64px rgba(0,0,0,0.8); position: relative;
}
.prof-pub-close {
  position: absolute; top: 12px; right: 14px; z-index: 2;
  background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.15);
  border-radius: 50%; color: #fff; width: 28px; height: 28px; cursor: pointer;
  font-size: 13px; display: flex; align-items: center; justify-content: center;
  transition: background 0.15s;
}
.prof-pub-close:hover { background: rgba(255,255,255,0.15); }

/* ══ SOCIAL ICONS (display) ══════════════════════════════════ */
.prof-social-icons {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
  margin-top: 2px;
}
.prof-social-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.10);
  color: var(--social-c, var(--text-secondary));
  transition: background 0.15s, transform 0.12s;
  text-decoration: none;
  flex-shrink: 0;
}
.prof-social-icon:hover {
  background: rgba(255,255,255,0.13);
  transform: translateY(-1px);
}
.prof-social-icon svg {
  width: 15px;
  height: 15px;
  fill: currentColor;
  display: block;
}

/* ══ SOCIAL EDITOR (platform picker) ════════════════════════ */
#prof-socials-list { display: flex; flex-direction: column; gap: 8px; }

.prof-social-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.prof-social-platform-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
  position: relative;
}

.prof-social-row-icon {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
}
.prof-social-row-icon svg {
  width: 20px;
  height: 20px;
  fill: currentColor;
  display: block;
}
.prof-social-row-icon-empty { color: var(--text-secondary); }

.prof-social-search-wrap {
  position: relative;
  flex: 1;
  min-width: 0;
}

.prof-social-platform-inp { width: 100%; }

.prof-social-platform-drop {
  display: none;
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  min-width: 180px;
  background: var(--bg-surface);
  border: 1px solid var(--border-gold);
  border-radius: 8px;
  z-index: 300;
  max-height: 240px;
  overflow-y: auto;
  box-shadow: 0 8px 24px rgba(0,0,0,0.6);
}
.prof-social-platform-drop.open { display: block; }

.prof-sp-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  cursor: pointer;
  transition: background 0.1s;
  font-size: 13px;
  color: var(--text-primary);
}
.prof-sp-item:hover { background: var(--bg-elevated); }

.prof-sp-icon {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--sp-c, var(--text-secondary));
  flex-shrink: 0;
}
.prof-sp-icon svg {
  width: 16px;
  height: 16px;
  fill: currentColor;
  display: block;
}

.prof-social-url-inp { flex: 2; }

/* ══ RESPONSIVE ══════════════════════════════════════════════ */
@media (max-width: 600px) {
  .prof-header { flex-direction: column; align-items: flex-start; }
  .prof-social-row { flex-wrap: wrap; }
  .prof-fav-slots { gap: 10px; }
  .prof-fav-slot { width: 76px; height: 106px; }
}
  `;
  document.head.appendChild(s);
}
