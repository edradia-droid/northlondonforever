(() => {
  "use strict";
  const slug = document.body?.dataset?.currentPlayerSlug;
  if (!slug) return;

  const flatten = (row) => {
    const c = row?.content || {};
    const flat = {...c};
    (c.facts || []).forEach((x,i) => {
      flat[`fact_${i+1}_label`] = x?.label ?? "";
      flat[`fact_${i+1}_value`] = x?.value ?? "";
    });
    (c.stories || []).forEach((x,i) => {
      flat[`story_${i+1}_title`] = x?.title ?? "";
      flat[`story_${i+1}_body`] = x?.body ?? "";
    });
    return flat;
  };

  async function loadProfile(){
    const db = window.nl4Supabase;
    if (!db) return; // Existing HTML remains as a safe fallback.
    try{
      const {data,error} = await db
        .from("nl4_current_player_profiles")
        .select("slug,image_url,content,is_published")
        .eq("slug",slug)
        .eq("is_published",true)
        .maybeSingle();
      if(error) throw error;
      if(!data) return;

      const flat = flatten(data);
      document.querySelectorAll("[data-profile-field]").forEach(el => {
        const key = el.dataset.profileField;
        if(Object.prototype.hasOwnProperty.call(flat,key) && flat[key] !== null){
          el.textContent = String(flat[key]);
        }
      });

      if(data.image_url){
        document.querySelectorAll('[data-profile-image-target="portrait"]').forEach(img => {
          img.src = data.image_url;
        });
        document.querySelectorAll('[data-profile-image-target="hero"]').forEach(el => {
          el.style.setProperty("--hero", `url("${String(data.image_url).replace(/"/g,"%22")}")`);
        });
      }
    }catch(err){
      console.warn("NL4 current player profile fallback active:", err?.message || err);
    }
  }
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded",loadProfile);
  else loadProfile();
})();