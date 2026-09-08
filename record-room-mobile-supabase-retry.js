// NL4 Record Room — mobile-safe Supabase hydration retry
(function(){
'use strict';
if(window.__NL4_RR_MOBILE_SUPABASE_RETRY__)return;
window.__NL4_RR_MOBILE_SUPABASE_RETRY__=true;
let attempts=0;
async function tryHydrate(){
  attempts++;
  const authority=window.NL4RecordRoomSupabaseAuthority;
  const supa=window.nl4Supabase||window.supabaseClient||window.supabaseDb;
  const ready=authority&&typeof authority.hydrate==='function'&&supa&&typeof ALL_FIXTURES!=='undefined'&&typeof db!=='undefined';
  if(!ready){if(attempts<60)setTimeout(tryHydrate,250);return;}
  try{
    const result=await authority.hydrate();
    if(result?.ok){
      document.documentElement.dataset.rrSupabaseHydrated='1';
      console.info('[NL4 Record Room] Mobile-safe Supabase hydration confirmed',result.imported);
      return;
    }
  }catch(e){console.warn('[NL4 Record Room] Mobile-safe hydration attempt failed',e);}
  if(attempts<60)setTimeout(tryHydrate,500);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(tryHydrate,0),{once:true});else setTimeout(tryHydrate,0);
})();