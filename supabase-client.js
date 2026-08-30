// NL4 Supabase browser client
// Safe for frontend use: this is the low-privilege publishable key.
// Never place a Supabase secret/service_role key in browser files.

const NL4_SUPABASE_URL = "https://vrjxejuyiynllygiozhs.supabase.co";
const NL4_SUPABASE_PUBLISHABLE_KEY = "sb_publishable__esNlSYCC7dc4Cbn1yFZ4w_ttag7wqw";

if (!window.supabase) {
  throw new Error("Supabase JS library was not loaded.");
}

window.nl4Supabase = window.supabase.createClient(
  NL4_SUPABASE_URL,
  NL4_SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);

// Record Room is an authenticated admin-only page. Load its dedicated database
// adapter/bridge only there so no public page or Arsenal model code is affected.
if (/\brecord-room\.html$/i.test(location.pathname)) {
  const loadScript = (src) => new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`Could not load ${src}`));
    document.head.appendChild(s);
  });

  loadScript('record-room-supabase.js')
    .then(() => loadScript('record-room-supabase-bridge.js'))
    .catch(error => console.warn('[NL4 Record Room] Supabase bridge unavailable; local fallback remains active.', error));
}
