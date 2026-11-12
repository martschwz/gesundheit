// Öffentliche Verbindungsdaten zu Supabase. Der "publishable key" ist dafür gedacht,
// in der App zu stehen – geschützt werden die Daten durch die Row-Level-Security-Regeln.
// Zu finden in Supabase unter Project Settings → API Keys / Data API.
export const SUPABASE_URL = "";
export const SUPABASE_KEY = "";

export const CONFIGURED = !!SUPABASE_URL && !!SUPABASE_KEY;
