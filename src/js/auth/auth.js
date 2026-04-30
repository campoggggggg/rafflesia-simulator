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
// e cerchiamo l'email corrispondente in profiles.
export async function signIn(emailOrUsername, password, rememberMe = false) {
  if (rememberMe) {
    localStorage.setItem('rafflesia_remember_me', 'true');
  } else {
    localStorage.removeItem('rafflesia_remember_me');
  }

  let email = emailOrUsername.trim();

  if (!email.includes("@")) {
    // È uno username: cerca l'email associata
    const { data, error } = await db
      .from("profiles")
      .select("id")
      .ilike("username", email)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      throw new Error("No account found with that username.");
    }

    // Recupera l'email dall'auth tramite una funzione RPC,
    // oppure la leggiamo da user_metadata se la salviamo.
    // Strategia più semplice: aggiungiamo email a profiles.
    // Per ora usiamo una RPC che restituisce l'email dato l'id.
    const { data: emailData, error: rpcErr } = await db
      .rpc("get_email_by_id", { user_id: data.id });

    if (rpcErr || !emailData) {
      throw new Error("Could not resolve username to email. Try logging in with your email.");
    }

    email = emailData;
  }

  const { data, error } = await db.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

// Crea il profilo al primo SIGNED_IN confermato, se non esiste già.
export async function ensureProfile(user) {
  const username = user.user_metadata?.username;
  if (!username) return;

  const { data: existing, error: selErr } = await db
    .from("profiles").select("id").eq("id", user.id).maybeSingle();

  if (selErr) { console.warn("ensureProfile select:", selErr.message); return; }

  if (!existing) {
    const { error: insErr } = await db.from("profiles").insert({ id: user.id, username });
    if (insErr) console.warn("ensureProfile insert:", insErr.message);
  }
}

export async function signOut() {
  localStorage.removeItem('rafflesia_remember_me');
  const { error } = await db.auth.signOut();
  if (error) throw error;
}

export async function getUser() {
  const { data: { user } } = await db.auth.getUser();
  return user;
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
  const { data: { user } } = await db.auth.getUser();
  if (!user) return null;
  return user.user_metadata?.rafflesia_settings ?? null;
}

export function saveSettings() {
  saveSettingsToCloud(AppState.settings).catch(() => {});
}