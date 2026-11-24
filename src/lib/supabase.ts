import { createClient } from "@supabase/supabase-js";
import { CONFIGURED, SUPABASE_KEY, SUPABASE_URL } from "../config";

// Ohne Verbindungsdaten eine Platzhalter-Adresse, damit die App die Einrichtungs-Hinweise zeigen kann.
export const supabase = createClient(CONFIGURED ? SUPABASE_URL : "https://nicht-eingerichtet.supabase.co", CONFIGURED ? SUPABASE_KEY : "x", {
  // Eigener Speicherplatz für die Anmeldung: Lernapp und Gesundheit laufen unter derselben Adresse
  // (martschwz.github.io) und demselben Supabase-Projekt und würden sich sonst gegenseitig abmelden.
  auth: { storageKey: "gesundheit-auth", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
