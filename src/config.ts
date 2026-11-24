// Öffentliche Verbindungsdaten zu Supabase. Der "publishable key" ist dafür gedacht,
// in der App zu stehen – geschützt werden die Daten durch die Row-Level-Security-Regeln.
// Mitbenutzung des Supabase-Projekts der Lernapp (im kostenlosen Tarif ist kein weiteres Projekt möglich).
// Die Tabellen haben andere Namen, und die Daten sind über Row-Level-Security an den eigenen Login gebunden.
export const SUPABASE_URL = "https://uqefvtxnhtatlvfpclci.supabase.co";
export const SUPABASE_KEY = "sb_publishable_1EVfpRlF4F2de60Xmt2jbw_HFsFneUq";

export const CONFIGURED = !!SUPABASE_URL && !!SUPABASE_KEY;
