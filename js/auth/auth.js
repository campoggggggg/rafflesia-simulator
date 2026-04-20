// ============================================================
// auth/auth.js — Funzioni di autenticazione via Supabase Auth.
// ============================================================

async function signUp(email, password, username) {
  const { data, error } = await db.auth.signUp({ email, password });
  if (error) throw error;

  if (data.user) {
    await db.from("profiles").insert({ id: data.user.id, username });
  }
  return data;
}

async function signIn(email, password) {
  const { data, error } = await db.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

async function signOut() {
  const { error } = await db.auth.signOut();
  if (error) throw error;
}

async function getUser() {
  const { data: { user } } = await db.auth.getUser();
  return user;
}

function onAuthChange(callback) {
  const { data: { subscription } } = db.auth.onAuthStateChange(
    (event, session) => callback(event, session?.user ?? null)
  );
  return () => subscription.unsubscribe();
}

// Salva le impostazioni nel profilo Supabase (user_metadata).
// Questo sostituisce il salvataggio in localStorage.
async function saveSettingsToCloud(settings) {
  const { error } = await db.auth.updateUser({
    data: { rafflesia_settings: settings }
  });
  if (error) console.warn("Errore salvataggio impostazioni:", error.message);
}

// Legge le impostazioni da user_metadata.
// Restituisce null se l'utente non è loggato o non ha impostazioni salvate.
async function loadSettingsFromCloud() {
  const { data: { user } } = await db.auth.getUser();
  if (!user) return null;
  return user.user_metadata?.rafflesia_settings ?? null;
}
