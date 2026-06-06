// ============================================================
// auth/auth.js — Autenticazione via Supabase Auth.
// ============================================================

import { db } from '../core/supabase-client.js';
import { AppState } from '../core/state.js';

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
// Se rememberMe = false, i token vengono spostati in sessionStorage dopo il login
// così non sopravvivono alla chiusura del browser.
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

  const { data, error } = await db.auth.signInWithPassword({ email, password });
  if (error) throw error;

  if (!rememberMe) {
    // Sposta i token Supabase dal localStorage al sessionStorage.
    // Il client continua a funzionare ma la sessione non sopravvive alla chiusura del browser.
    const STORAGE_KEY = 'sb-rxsvogebmhmjlixxdoep-auth-token';
    const token = localStorage.getItem(STORAGE_KEY);
    if (token) {
      sessionStorage.setItem(STORAGE_KEY, token);
      localStorage.removeItem(STORAGE_KEY);
    }
  }

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
  localStorage.removeItem('rafflesia_remember_me');
  const { error } = await db.auth.signOut();
  if (error) throw error;
}

export async function getUser() {
  // getSession() reads the in-memory/local session without a network request.
  // getUser() would validate the JWT server-side and can fail on network issues.
  const { data: { session } } = await db.auth.getSession();
  return session?.user ?? null;
}

export function onAuthChange(callback) {
  const { data: { subscription } } = db.auth.onAuthStateChange(
    (event, session) => callback(event, session?.user ?? null)
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
  const { data: { session } } = await db.auth.getSession();
  if (!session?.user) return null;
  return session.user.user_metadata?.rafflesia_settings ?? null;
}

export function saveSettings() {
  saveSettingsToCloud(AppState.settings).catch(() => {});
}