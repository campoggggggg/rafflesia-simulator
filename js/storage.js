// ============================================================
// storage.js — Wrapper per il localStorage del browser.
//
// Il localStorage è uno spazio di memoria permanente offerto dal
// browser: i dati salvati qui sopravvivono alla chiusura della
// pagina e al riavvio del browser.
//
// Il problema: localStorage accetta SOLO stringhe di testo.
// La soluzione: convertiamo ogni valore in JSON prima di salvare
// (JSON.stringify) e lo riconvertiamo in oggetto quando lo leggiamo
// (JSON.parse).
// ============================================================

// `const` dichiara una variabile che non può essere riassegnata.
// Qui usiamo un oggetto letterale come "namespace" per raggruppare
// due funzioni correlate: save e load.
const Storage = {

  // Salva `value` nel localStorage con la chiave `key`.
  // JSON.stringify trasforma qualsiasi valore (oggetto, array, numero...)
  // in una stringa di testo, es: {a:1} → '{"a":1}'
  save(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },

  // Legge la stringa salvata sotto `key` e la ri-trasforma in valore JS.
  // Se la chiave non esiste o il JSON è corrotto, restituisce `fallback`
  // invece di mandare in crash l'app.
  load(key, fallback) {
    const raw = localStorage.getItem(key);

    // Se non c'è nulla salvato (primo avvio), usa direttamente il default.
    if (!raw) return fallback;

    // try/catch intercetta gli errori: se JSON.parse fallisce (dati
    // corrotti o formato cambiato), il catch restituisce il fallback
    // invece di far crashare tutto.
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }
};
