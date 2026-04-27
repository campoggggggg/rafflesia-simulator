// ============================================================
// auth/auth.js — Autenticazione via Supabase Auth.
// ============================================================

import { db }       from '../core/supabase-client.js';
import { AppState } from '../core/state.js';

export async function signUp(email, password, username) {
  const { data, error } = await db.auth.signUp({
    email,
    password,
    options: {
      data: { username },                           // salvato in user_metadata, non nel DB
      emailRedirectTo: window.location.origin,      // dove Supabase rimanda dopo il click
    },
  });
  if (error) throw error;
  // Il profilo viene creato in app.js solo dopo la conferma email (SIGNED_IN).
  return data;
}

// Crea il profilo al primo SIGNED_IN confermato, se non esiste gia'.
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

export async function signIn(email, password) {
  const { data, error } = await db.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
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

// Convenienza: persiste le impostazioni correnti di AppState.
export function saveSettings() {
  saveSettingsToCloud(AppState.settings).catch(() => {});
}


