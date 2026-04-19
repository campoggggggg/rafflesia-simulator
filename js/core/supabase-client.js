// ============================================================
// supabase-client.js — Connessione al database Supabase.
//
// Supabase è un backend-as-a-service che offre PostgreSQL,
// autenticazione e real-time. La chiave "anon" è PUBBLICA:
// è sicura nei file browser perché le policy RLS sul DB
// controllano cosa può leggere/scrivere chi non è autenticato.
//
// Per trovare URL e chiave: supabase.com → progetto → Settings → API
// ============================================================

const { createClient } = supabase;

const SUPABASE_URL      = 'https://rxsvogebmhmjlixxdoep.supabase.co'; // ← sostituisci
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4c3ZvZ2VibWhtamxpeHhkb2VwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1ODUyNjUsImV4cCI6MjA5MjE2MTI2NX0.RzFolgynTRoiq4RlYEopr2zpllpsp9NXb6vmyKz3Cu4';         // ← sostituisci

const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
