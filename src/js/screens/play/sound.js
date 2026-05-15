// ============================================================
// play/sound.js — Sound effect playback for the simulator.
// All sounds are optional: missing files fail silently.
// ============================================================

import { assetPath } from '../../core/router.js';
const BASE = assetPath("src/assets/sounds") + "/";

const FILES = {
  "card-play":     "card-play.mp3",      // summon, play territory, set sudden
  "card-draw":     "card-draw.mp3",      // draw a card
  "card-activate": "card-activate.mp3",  // activate spell/quest, send to grave
  "life-change":   "life-change.mp3",    // life +/-
  "coin-flip":     "coin-flip.mp3",      // coin flip result
  "dice-roll":     "dice-roll.mp3",      // dice roll
  "counter-add":   "counter-add.mp3",    // add/remove counter or damage
  "button":        "button.mp3",         // generic UI button (phase, end turn)
};

// Pre-load all sounds into Audio objects
const _cache = {};
for (const [key, file] of Object.entries(FILES)) {
  const audio = new Audio(BASE + file);
  audio.preload = "auto";
  _cache[key] = audio;
}

let _muted = false;

export function playSound(name) {
  if (_muted) return;
  const audio = _cache[name];
  if (!audio) return;
  // Reset and play — allows rapid re-triggering
  const clone = audio.cloneNode();
  clone.volume = 0.55;
  clone.play().catch(() => {});
}

export function toggleMute() {
  _muted = !_muted;
  return _muted;
}

export function isMuted() {
  return _muted;
}
