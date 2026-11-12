import { createClient } from "@supabase/supabase-js";
import { CONFIGURED, SUPABASE_KEY, SUPABASE_URL } from "../config";

// Ohne Verbindungsdaten eine Platzhalter-Adresse, damit die App die Einrichtungs-Hinweise zeigen kann.
export const supabase = createClient(CONFIGURED ? SUPABASE_URL : "https://nicht-eingerichtet.supabase.co", CONFIGURED ? SUPABASE_KEY : "x", {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
