// ============================================================
// screens/home.js — Schermata Home rinnovata.
// ============================================================

import { navigateTo } from '../core/router.js';

export function renderHomeScreen() {
  const screen = document.getElementById("screen-home");

  screen.innerHTML = `
    <div class="home-root">

      <!-- ══════════════════ HERO ══════════════════ -->
      <section class="home-section hero-section">
        <img src="src/assets/rafflesia-logo.png" alt="Rafflesia Logo" class="hero-logo">
        <h1 class="hero-title">RAFFLESIA</h1>
      </section>

      <!-- ══════════════════ ROADMAP ══════════════════ -->
      <section class="home-section roadmap-section">
        <div class="section-eyebrow">Sviluppo del progetto</div>
        <h2 class="section-title">Roadmap</h2>

        <div class="roadmap-track">

          <div class="rm-item rm-done">
            <div class="rm-dot"><span class="rm-check">✓</span></div>
            <div class="rm-body">
              <div class="rm-label">Completato</div>
              <div class="rm-name">Navigazione & Layout</div>
              <div class="rm-desc">Sidebar, routing tra schermate, tema violet storm, canvas di spore.</div>
            </div>
          </div>

          <div class="rm-item rm-done">
            <div class="rm-dot"><span class="rm-check">✓</span></div>
            <div class="rm-body">
              <div class="rm-label">Completato</div>
              <div class="rm-name">Deck Builder</div>
              <div class="rm-desc">Costruzione mazzi con Commander, Main (29), Territory (12), Sideboard (10). Filtri avanzati e tooltip carta.</div>
            </div>
          </div>

          <div class="rm-item rm-wip">
            <div class="rm-dot"><span class="rm-spinner"></span></div>
            <div class="rm-body">
              <div class="rm-label">In corso</div>
              <div class="rm-name">Autenticazione & Profili</div>
              <div class="rm-desc">Login / registrazione via Supabase, nome giocatore, mazzi salvati online.</div>
            </div>
          </div>

          <div class="rm-item rm-done">
            <div class="rm-dot"><span class="rm-check">✓</span></div>
            <div class="rm-body">
              <div class="rm-label">Completato</div>
              <div class="rm-name">Ricerca Avanzata</div>
              <div class="rm-desc">Filtri per nome, testo, colore, tipo, rarità, costo, ATK/DEF, keyword, sottotipo e set.</div>
            </div>
          </div>

          <div class="rm-item rm-done">
            <div class="rm-dot"><span class="rm-check">✓</span></div>
            <div class="rm-body">
              <div class="rm-label">Completato</div>
              <div class="rm-name">Board di Gioco (Alpha)</div>
              <div class="rm-desc">Prototipo funzionante con field, sudden zone, territory, stack, graveyard e turni AI basilare.</div>
            </div>
          </div>

          <div class="rm-item rm-wip">
            <div class="rm-dot"><span class="rm-spinner"></span></div>
            <div class="rm-body">
              <div class="rm-label">In corso</div>
              <div class="rm-name">Motore di Combattimento</div>
              <div class="rm-desc">Risoluzione attacchi, calcolo danni, keyword attive (Stealth, Sudden, Sap…).</div>
            </div>
          </div>

          <div class="rm-item rm-wip">
            <div class="rm-dot"><span class="rm-spinner"></span></div>
            <div class="rm-body">
              <div class="rm-label">In corso</div>
              <div class="rm-name">Creazione Tornei & Raccolta Statistiche</div>
              <div class="rm-desc">Sistema di tornei tra giocatori, bracket automatico e raccolta di statistiche per partita.</div>
            </div>
          </div>

          <div class="rm-item rm-todo">
            <div class="rm-dot"></div>
            <div class="rm-body">
              <div class="rm-label">Da fare</div>
              <div class="rm-name">AI Avanzata</div>
              <div class="rm-desc">Decision tree per l'IA: gestione stack, uso spell, priorità target.</div>
            </div>
          </div>

          <div class="rm-item rm-todo">
            <div class="rm-dot"></div>
            <div class="rm-body">
              <div class="rm-label">Da fare</div>
              <div class="rm-name">Multiplayer Online</div>
              <div class="rm-desc">Match in real-time tramite Supabase Realtime o WebSocket.</div>
            </div>
          </div>

          <div class="rm-item rm-todo">
            <div class="rm-dot"></div>
            <div class="rm-body">
              <div class="rm-label">Da fare</div>
              <div class="rm-name">Draft & Sealed</div>
              <div class="rm-desc">Modalità di costruzione mazzo alternativa ispirata al booster draft.</div>
            </div>
          </div>

        </div>
      </section>

      <!-- ══════════════════ PRESENTAZIONE ══════════════════ -->
      <section class="home-section about-section">
        <div class="section-eyebrow">Il gioco</div>
        <h2 class="section-title">Cos'è Rafflesia?</h2>

        <div class="about-grid">
          <div class="about-text">
            <p class="about-lead">
              Rafflesia è un <em>Trading Card Game</em> artigianale nato dalla passione per i giochi di carte strategici di *tizio* e *caio*.
              Prende in prestito le fondamenta da altri grandi classici del genere — mana, spell, minion, quest e... una forte interazione tra giocatori. 
              Non mancano le idee originali a rendere il gioco unico nel suo genere: la meccanica del 'recycle', ossia di mettere in fondo al mazzo, è fondamentale. Il mazzo di sole 29 carte,
               l'assenza di effetti che mischiano/guardano il mazzo, e un gameplay prolungato rendono viva la possibilità
                di ripescare carte in precedenza riciclate.
            </p>
            <p>
              L'estetica dark fantasy la fa da padrone.
              Ogni carta racconta un frammento di un mondo che non ti viene mai spiegato del tutto.
            </p>
            <p>
              Il nome viene dalla <em>Rafflesia arnoldii</em> — il fiore più grande del mondo,
              privo di foglie e clorofilla, che vive come parassita e profuma di carne in decomposizione.
              Un simbolo perfetto per un gioco che celebra la bellezza oscura.
            </p>
          </div>

          <div class="about-img-wrap">
            <img src="src/assets/about-bg.jpg" class="about-bg-img" alt="">
            <span class="about-img-quote">"Non era un'alba. Era una sentenza."</span>
          </div>
        </div>
      </section>

      <!-- ══════════════════ REGOLE ══════════════════ -->
      <section class="home-section rules-section">
        <div class="section-eyebrow">Come si gioca</div>
        <h2 class="section-title">Regole di Gioco</h2>

        <div class="rules-list">

          <!-- 1 — Costruzione mazzo | testo sx, immagine dx -->
          <div class="rule-panel rule-odd">
            <div class="rule-content">
              <h3 class="rule-title">Costruzione del Mazzo</h3>
              <p>Ogni mazzo è composto da:</p>
              <ul class="rule-list">
                <li><strong>1 Commander</strong> — una carta Legendary (minion, spell o quest) che definisce il colore del mazzo. Ad inizio partita è fuori dal main deck, nella zona Commander e puo essere giocata, secondo le regole standard, pagandone il costo.</li>
                <li><strong>Main deck - 29</strong> — Minion, Spell, Quest del colore del commander o inoclore. Max 2 copie di ogni carta, 1 per le Legendary.</li>
                <li><strong>Territories - 12</strong> — la fonte di mana. Nessun limite per territorio base.</li>
                <li><strong>Sideboard - 10</strong> — carte intercambiabili tra una partita e l'altra.</li>
              </ul>
            </div>
            <div class="rule-img-wrap">
              <img src="src/assets/rules-bg1.jpg" class="rule-bg-img" alt="">
              <span class="rule-img-quote">"Non chiedo ai morti di tornare. Chiedo alla terra di restituire ciò che ha preso."</span>
            </div>
          </div>

          <!-- 2 — Inizio partita | immagine sx, testo dx -->
          <div class="rule-panel rule-even">
            <div class="rule-img-wrap">
              <img src="src/assets/rules-bg2.jpg" class="rule-bg-img" alt="">
              <span class="rule-img-quote">"KA-KAAWW!!"</span>
            </div>
            <div class="rule-content">
              <h3 class="rule-title">Inizio Partita</h3>
              <p>Entrambi i giocatori partono con <strong>25 punti vita</strong> e pescano <strong>5 carte</strong> dalla mano iniziale. È possibile <i>riciclare</i> un qualsiasi
              numero di carte dalla mano e pescare lo stesso numero di carte dal Main deck </p>
              <p>Dopo il mulligan, il Commander entra in gioco nella propria zona dedicata. I Territori vengono messi in un mazzo separato, e se ne gioca uno per turno, riciclando una carta <i>non-leggendaria</i> dalla mano.</p>
            </div>
          </div>

          <!-- 3 — Struttura turno | testo sx, immagine dx -->
          <div class="rule-panel rule-odd">
            <div class="rule-content">
              <h3 class="rule-title">Struttura del Turno</h3>
              <ol class="rule-list rule-ol">
                <li><strong>Draw</strong> — Pesca 1 carta dal mazzo principale.</li>
                <li><strong>Territory</strong> — Una volta per turno, riciclando una carta non-leggendaria dalla mano, puoi mettere in gioco la carta in cima al tuo Territory deck, nella zona dei Territori.</li>
                <li><strong>Main Phase</strong> — Gioca carte dalla mano, minion, spell e/o quest. Le spell possono essere messe coperte (max. 3) per essere giocate nel turno dell'avversario, se <i>sudden</i>.</li>
                <li><strong>Combat</strong> — Attacca con i tuoi Minion. L'avversario sceglie come e chi bloccare.</li>
                <li><strong>End Turn</strong> — Passa il turno.</li>
              </ol>
            </div>
            <div class="rule-img-wrap">
              <img src="src/assets/rules-bg3.jpg" class="rule-bg-img" alt="">
              <span class="rule-img-quote">"Il ciclo non perdona, ma almeno ricomincia."</span>
            </div>
          </div>

          <!-- 4 — Zone di gioco | immagine sx, testo dx -->
          <div class="rule-panel rule-even">
            <div class="rule-img-wrap">
              <img src="src/assets/rules-bg4.jpg" class="rule-bg-img" alt="">
              <span class="rule-img-quote">“Per vincere qualsiasi battaglia, devi combattere come se fossi già morto.”</span>
            </div>
            <div class="rule-content">
              <h3 class="rule-title">Zone di Gioco</h3>
              <ul class="rule-list">
                <li><strong>Field</strong> — dove vivono i Minion in gioco. Slot limitati.</li>
                <li><strong>Sudden Zone</strong> — carte set a faccia in giù. Vengono rivelate in risposta a eventi (simile alle Trap di Yu-Gi-Oh).</li>
                <li><strong>Stack</strong> — zona condivisa per la risoluzione di effetti in risposta, LIFO (ultimo entrato, primo risolto).</li>
                <li><strong>Territory Zone</strong> — i tuoi Territory attivi, fonte di mana colorato e neutro.</li>
                <li><strong>Graveyard</strong> — carte distrutte o usate. Alcune abilità interagiscono col numero di carte al cimitero.</li>
              </ul>
            </div>
          </div>

          <!-- 5 — Costo & Mana | testo sx, immagine dx -->
          <div class="rule-panel rule-odd">
            <div class="rule-content">
              <h3 class="rule-title">Costo & Mana</h3>
              <p>Ogni carta ha due costi visibili in basso a sinistra:</p>
              <ul class="rule-list">
                <li><strong>Mana Neutro</strong> — cerchio grigio. Pagabile con qualsiasi Territory.</li>
                <li><strong>Mana Colorato</strong> — cerchio colorato. Richiede Territory del tuo colore.</li>
              </ul>
              <p>I Territory si <em>tappano</em> (si girano) per produrre mana e si rizzano all'inizio del tuo turno.</p>
            </div>
            <div class="rule-img-wrap">
              <img src="src/assets/rules-bg5.jpg" class="rule-bg-img" alt="">
              <span class="rule-img-quote">"Il sangue non mente mai."</span>
            </div>
          </div>

          <!-- 6 — Keyword | immagine sx, testo dx -->
          <div class="rule-panel rule-even">
            <div class="rule-img-wrap">
              <img src="src/assets/rules-bg6.jpg" class="rule-bg-img" alt="">
              <span class="rule-img-quote">"Sorgo dal fuoco, danzando nell'aria."</span>
            </div>
            <div class="rule-content">
              <h3 class="rule-title">Keyword Principali</h3>
              <ul class="rule-list">
                <li><strong>Sudden</strong> — può essere usata dalla Sudden Zone, in risposta a eventi avversari.</li>
                <li><strong>Stealth</strong> — non può essere bersaglio di effetti avversari.</li>
                <li><strong>Un-targetable</strong> — non può essere bersaglio di nessun effetto.</li>
                <li><strong>Sap</strong> — il minion viene esaurito (non può attaccare o bloccare questo turno).</li>
                <li><strong>Grave N</strong> — si attiva quando il numero di carte al cimitero raggiunge esattamente N.</li>
              </ul>
            </div>
          </div>

        </div>

      </section>

    </div>
  `;

  // ── CSS ────────────────────────────────────────────────────
  if (!document.getElementById('home-styles')) {
    const style = document.createElement('style');
    style.id = 'home-styles';
    style.textContent = `

/* ═══ ROOT ══════════════════════════════════════════════════ */
.home-root {
  max-width: 960px;
  margin: 0 auto;
  padding: 0 20px 60px;
  display: flex;
  flex-direction: column;
  gap: 0;
}

/* ═══ SECTION BASE ══════════════════════════════════════════ */
.home-section {
  padding: 48px 0 52px;
  border-bottom: 1px solid var(--border);
}
.home-section:last-child { border-bottom: none; }

.section-eyebrow {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--violet);
  margin-bottom: 10px;
}

.section-title {
  font-family: 'Cinzel Decorative', serif;
  font-size: 22px;
  color: var(--text-primary);
  margin: 0 0 36px;
  letter-spacing: 0.03em;
}

/* ═══ HERO ═══════════════════════════════════════════════════ */
.hero-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 52px 0 48px;
  gap: 16px;
}

.hero-logo {
  width: 96px;
  height: 96px;
  object-fit: contain;
  filter: drop-shadow(0 0 20px rgba(139,92,246,0.5));
}

.hero-title {
  font-family: 'Cinzel Decorative', serif;
  font-size: 52px;
  font-weight: 700;
  letter-spacing: 0.2em;
  color: var(--text-primary);
  margin: 0;
  text-shadow: 0 0 40px rgba(139,92,246,0.45), 0 2px 8px rgba(0,0,0,0.7);
}

/* ═══ ROADMAP ════════════════════════════════════════════════ */
.roadmap-section {
  position: relative;
  background-image: url('src/assets/roadmap-bg.jpg');
  background-size: cover;
  background-position: center top;
  border-radius: 12px;
  overflow: hidden;
  margin: 0 -20px;
  padding-left: 20px;
  padding-right: 20px;
}

.roadmap-section::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to bottom,
    rgba(10,8,18,0.80) 0%,
    rgba(10,8,18,0.72) 50%,
    rgba(10,8,18,0.88) 100%
  );
  pointer-events: none;
  z-index: 0;
}

.roadmap-section > * {
  position: relative;
  z-index: 1;
}

.roadmap-track {
  display: flex;
  flex-direction: column;
  gap: 0;
  position: relative;
  padding-left: 28px;
}

.roadmap-track::before {
  content: '';
  position: absolute;
  left: 9px;
  top: 0; bottom: 0;
  width: 2px;
  background: linear-gradient(to bottom,
    var(--violet) 0%,
    rgba(139,92,246,0.3) 60%,
    transparent 100%
  );
}

.rm-item {
  display: flex;
  gap: 20px;
  align-items: flex-start;
  padding: 16px 0;
  position: relative;
}

.rm-dot {
  position: absolute;
  left: -28px;
  top: 20px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 700;
  z-index: 1;
}

.rm-done .rm-dot {
  background: var(--violet);
  box-shadow: 0 0 12px rgba(139,92,246,0.55);
  color: white;
}

.rm-wip .rm-dot {
  background: rgba(139,92,246,0.15);
  border: 2px solid var(--violet);
  animation: rm-pulse 1.8s ease-in-out infinite;
}

.rm-todo .rm-dot {
  background: var(--bg-surface);
  border: 2px solid var(--border);
}

@keyframes rm-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(139,92,246,0.4); }
  50%       { box-shadow: 0 0 0 6px rgba(139,92,246,0); }
}

.rm-spinner {
  display: block;
  width: 8px; height: 8px;
  border-radius: 50%;
  background: var(--violet);
  margin: auto;
}

.rm-body { flex: 1; }

.rm-label {
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  margin-bottom: 3px;
}
.rm-done .rm-label  { color: var(--violet); }
.rm-wip  .rm-label  { color: var(--violet-bright); }
.rm-todo .rm-label  { color: var(--text-secondary); }

.rm-name {
  font-family: 'Cinzel', serif;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
}
.rm-todo .rm-name { color: var(--text-secondary); }

.rm-desc {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
}

/* ═══ ABOUT ══════════════════════════════════════════════════ */
.about-grid {
  display: flex;
  align-items: stretch;
  min-height: 320px;
  gap: 0;
}

.about-text {
  flex: 1.4;
  min-width: 0;
  padding-right: 40px;
}

.about-lead {
  font-size: 15px;
  line-height: 1.7;
  color: var(--text-primary);
  margin-bottom: 16px;
}

.about-text p {
  font-size: 14px;
  line-height: 1.7;
  color: var(--text-secondary);
  margin-bottom: 12px;
}

.about-text em  { color: var(--violet-bright); font-style: italic; }
.about-text strong { color: var(--text-primary); }

.about-quote {
  border-left: 3px solid var(--violet);
  margin: 24px 0 0;
  padding: 12px 16px;
  background: var(--violet-subtle);
  border-radius: 0 8px 8px 0;
  font-style: italic;
  font-family: 'Cormorant Garamond', serif;
  font-size: 15px;
  color: var(--violet-bright);
}
.about-quote cite {
  display: block;
  margin-top: 6px;
  font-size: 12px;
  font-style: normal;
  color: var(--text-secondary);
  letter-spacing: 0.05em;
}

.about-img-wrap {
  flex: 1;
  position: relative;
  overflow: hidden;
  border-radius: 0 10px 10px 0;
  -webkit-mask-image: linear-gradient(to right, transparent 0%, black 45%);
  mask-image: linear-gradient(to right, transparent 0%, black 45%);
}

.about-bg-img {
  position: absolute;
  top: 0; left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: 0;
}


.about-img-quote {
  position: absolute;
  z-index: 2;
  bottom: 12px;
  right: 14px;
  text-align: right;
  font-family: 'Cormorant Garamond', serif;
  font-size: 11px;
  font-style: italic;
  color: rgba(255,255,255,0.9);
  letter-spacing: 0.04em;
  line-height: 1.4;
  text-shadow: 0 0 6px #000, 0 0 6px #000, 0 1px 3px #000, 1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000;
}

/* ═══ RULES ══════════════════════════════════════════════════ */
.rules-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 24px;
}

.rule-panel {
  display: flex;
  min-height: 260px;
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
  background: var(--bg-surface);
  transition: border-color 0.2s, box-shadow 0.2s;
}
.rule-panel:hover {
  border-color: var(--border-gold);
  box-shadow: 0 4px 24px rgba(139,92,246,0.10);
}

.rule-content {
  flex: 1;
  padding: 28px 28px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
}

.rule-img-wrap {
  position: relative;
  width: 42%;
  flex-shrink: 0;
  overflow: hidden;
}

.rule-bg-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Odd: immagine destra → sfuma il bordo sinistro dell'immagine */
.rule-odd .rule-img-wrap::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(to right, var(--bg-surface) 0%, transparent 55%);
  z-index: 1;
}

/* Even: immagine sinistra → sfuma il bordo destro dell'immagine */
.rule-even .rule-img-wrap::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(to left, var(--bg-surface) 0%, transparent 55%);
  z-index: 1;
}

.rule-img-quote {
  position: absolute;
  z-index: 2;
  font-family: 'Cormorant Garamond', serif;
  font-size: 11px;
  font-style: italic;
  color: rgba(255,255,255,0.9);
  letter-spacing: 0.04em;
  line-height: 1.4;
  text-shadow: 0 0 6px #000, 0 0 6px #000, 0 1px 3px #000, 1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000;
}
.rule-odd  .rule-img-quote { bottom: 10px; right: 12px; text-align: right; }
.rule-even .rule-img-quote { bottom: 10px; left: 12px;  text-align: left; }

.rule-icon {
  font-size: 20px;
  margin-bottom: 12px;
  line-height: 1;
}

.rule-title {
  font-family: 'Cinzel', serif;
  font-size: 14px;
  font-weight: 600;
  color: var(--violet-bright);
  margin: 0 0 12px;
}

.rule-content p {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
  margin: 0 0 8px;
}

.rule-list {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.65;
  padding-left: 16px;
  margin: 0;
}
.rule-list.rule-ol { list-style-type: decimal; }
.rule-list li { margin-bottom: 5px; }
.rule-list strong { color: var(--text-primary); }

.win-condition {
  display: flex;
  align-items: center;
  gap: 20px;
  background: linear-gradient(135deg, rgba(127,29,29,0.18) 0%, rgba(68,8,8,0.08) 100%);
  border: 1px solid rgba(239,68,68,0.25);
  border-radius: 12px;
  padding: 22px 24px;
}

.win-icon {
  font-size: 28px;
  flex-shrink: 0;
  filter: drop-shadow(0 0 8px rgba(239,68,68,0.4));
}

.win-text h3 {
  font-family: 'Cinzel', serif;
  font-size: 14px;
  font-weight: 600;
  color: #fca5a5;
  margin: 0 0 6px;
}

.win-text p {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.6;
}
.win-text strong { color: var(--text-primary); }

/* ═══ RESPONSIVE ═════════════════════════════════════════════ */
@media (max-width: 720px) {
  .hero-title      { font-size: 32px; }
  .about-grid      { flex-direction: column; }
  .about-text      { padding-right: 0; }
  .about-img-wrap  { height: 220px; }
  .rule-panel  { flex-direction: column !important; min-height: auto; }
  .rule-even   { flex-direction: column-reverse !important; }
  .rule-img-wrap { width: 100%; height: 180px; position: relative; }
  .rule-odd  .rule-img-wrap::before { background: linear-gradient(to bottom, transparent 40%, var(--bg-surface) 100%); }
  .rule-even .rule-img-wrap::before { background: linear-gradient(to bottom, transparent 40%, var(--bg-surface) 100%); }
  .rule-odd  .rule-img-quote { right: 12px; }
  .rule-even .rule-img-quote { left: 12px; }
}

    `;
    document.head.appendChild(style);
  }
}
