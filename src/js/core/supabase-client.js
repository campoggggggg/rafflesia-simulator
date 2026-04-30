// ============================================================
// supabase-client.js — Connessione al database Supabase.
// ============================================================

const { createClient } = supabase;

const SUPABASE_URL      = 'https://rxsvogebmhmjlixxdoep.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4c3ZvZ2VibWhtamxpeHhkb2VwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1ODUyNjUsImV4cCI6MjA5MjE2MTI2NX0.RzFolgynTRoiq4RlYEopr2zpllpsp9NXb6vmyKz3Cu4';

export const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);