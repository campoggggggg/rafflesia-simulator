// ============================================================
// supabase-client.js — Connessione al database Supabase.
// ============================================================

const { createClient } = supabase;

const SUPABASE_URL      = 'https://rxsvogebmhmjlixxdoep.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4c3ZvZ2VibWhtamxpeHhkb2VwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1ODUyNjUsImV4cCI6MjA5MjE2MTI2NX0.RzFolgynTRoiq4RlYEopr2zpllpsp9NXb6vmyKz3Cu4';

export const REMEMBER_ME_KEY = 'rafflesia_remember_me';

// Storage ibrido: instrada le chiavi auth di Supabase verso localStorage
// (sopravvive alla chiusura del browser, "remember me" attivo) o sessionStorage
// ("remember me" disattivo, sessione legata alla scheda corrente).
//
// Scriviamo SEMPRE attraverso questo adapter — mai spostando i token a posteriori —
// così il client Supabase non riceve eventi "storage" inattesi (che lo portano a
// credere che la sessione sia stata rimossa da un'altra scheda e a emettere un
// SIGNED_OUT spurio, azzerando lo stato dei mazzi).
const hybridAuthStorage = {
  getItem: (key) => sessionStorage.getItem(key) ?? localStorage.getItem(key),
  setItem: (key, value) => {
    if (localStorage.getItem(REMEMBER_ME_KEY) === 'true') {
      sessionStorage.removeItem(key);
      localStorage.setItem(key, value);
    } else {
      localStorage.removeItem(key);
      sessionStorage.setItem(key, value);
    }
  },
  removeItem: (key) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  },
};

export const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken:  true,
    persistSession:    true,
    detectSessionInUrl: true,
    storage:           hybridAuthStorage,
  },
});