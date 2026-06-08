// ============================================================
// auth/auth.js — Autenticazione via Supabase Auth.
// ============================================================

import { db, REMEMBER_ME_KEY } from '../core/supabase-client.js';
import { AppState } from '../core/state.js';

// Utente corrente — aggiornato da onAuthChange che è sempre il primo
// ad essere notificato da Supabase. Questo rende getUser() affidabile
// indipendentemente da dove Supabase ha salvato i token (localStorage vs sessionStorage).
let _currentUser = undefined; // undefined = non ancora inizializzato

// Controlla se uno username è già preso (query pubblica su profiles).
// Restituisce true se disponibile, false se già usato.
export async function isUsernameAvailable(username) {
  const { data, error } = await db
    .from("profiles")
    .select("id")
    .ilike("username", username)   // case-insensitive: "Gab" == "gab"
    .maybeSingle();

  if (error) throw error;
  return data === null; // null = nessun risultato = username libero
}

export async function signUp(email, password, username) {
  const { data, error } = await db.auth.signUp({
    email,
    password,
    options: {
      data: { username },
      emailRedirectTo: window.location.origin,
    },
  });
  if (error) throw error;
  return data;
}


// Login con email oppure username.
// Se l'input non contiene "@" lo trattiamo come username
// e cerchiamo l'email nella colonna `email` di profiles (salvata alla signup).
// rememberMe decide DOVE il client Supabase salverà i token (vedi hybridAuthStorage
// in supabase-client.js): localStorage (sopravvive alla chiusura) o sessionStorage
// (solo per la scheda corrente). Il flag va impostato PRIMA del login così
// l'adapter scrive subito nel posto giusto, senza spostare token a posteriori
// (operazione che generava SIGNED_OUT spuri e svuotava i mazzi caricati).
export async function signIn(emailOrUsername, password, rememberMe = false) {
  let email = emailOrUsername.trim();

  if (!email.includes("@")) {
    const { data, error } = await db.rpc("get_email_by_username", { p_username: email });

    if (error) throw error;

    if (!data) {
      throw new Error("No account found with that username.");
    }

    email = data;
  }

  localStorage.setItem(REMEMBER_ME_KEY, rememberMe ? 'true' : 'false');

  const { data, error } = await db.auth.signInWithPassword({ email, password });
  if (error) throw error;

  return data;
}

// Crea il profilo al primo SIGNED_IN confermato, se non esiste già.
// Salva anche l'email per consentire il login via username senza RPC privilegiata.
export async function ensureProfile(user) {
  const username = user.user_metadata?.username;
  if (!username) return;

  const { data: existing, error: selErr } = await db
    .from("profiles").select("id").eq("id", user.id).maybeSingle();

  if (selErr) { console.warn("ensureProfile select:", selErr.message); return; }

  if (!existing) {
    const { error: insErr } = await db.from("profiles").insert({
      id: user.id,
      username,
      email: user.email,
    });
    if (insErr) console.warn("ensureProfile insert:", insErr.message);
  }
}

export async function signOut() {
  localStorage.removeItem(REMEMBER_ME_KEY);
  const { error } = await db.auth.signOut();
  if (error) throw error;
}

export async function getUser() {
  // Se onAuthChange ha già sparato almeno una volta, ritorna il valore in cache.
  // Questo è sempre in sync con lo stato UI (che usa lo stesso callback).
  if (_currentUser !== undefined) return _currentUser;
  // Fallback solo per chiamate prima che onAuthChange abbia inizializzato il cache.
  const { data: { session } } = await db.auth.getSession();
  return session?.user ?? null;
}

export function onAuthChange(callback) {
  const { data: { subscription } } = db.auth.onAuthStateChange(
    (event, session) => {
      _currentUser = session?.user ?? null;
      callback(event, _currentUser);
    }
  );
  return () => subscription.unsubscribe();
}

export async function saveSettingsToCloud(settings) {
  const { error } = await db.auth.updateUser({
    data: { rafflesia_settings: settings }
  });
  if (error) console.warn("Error:", error.message);
}

export async function loadSettingsFromCloud() {
  const user = await getUser();
  if (!user) return null;
  return user.user_metadata?.rafflesia_settings ?? null;
}

export function saveSettings() {
  saveSettingsToCloud(AppState.settings).catch(() => {});
}