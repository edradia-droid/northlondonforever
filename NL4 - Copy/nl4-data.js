// Public data helpers for your existing NL4 pages.
// Load supabase-js + supabase-client.js first, then this file.

const nl4DB = window.nl4Supabase;

window.NL4Data = {
  async players(era = null) {
    let q = nl4DB.from("players").select("*").eq("is_published", true).order("sort_order", { ascending: true });
    if (era) q = q.eq("era", era);
    const { data, error } = await q;
    if (error) throw error;
    return data;
  },

  async news(limit = 12) {
    const { data, error } = await nl4DB.from("news")
      .select("*")
      .eq("is_published", true)
      .order("published_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data;
  },

  async fixtures(limit = 20) {
    const { data, error } = await nl4DB.from("fixtures")
      .select("*")
      .eq("is_published", true)
      .order("kickoff_at", { ascending: true })
      .limit(limit);
    if (error) throw error;
    return data;
  },

  async trophies() {
    const { data, error } = await nl4DB.from("trophies")
      .select("*")
      .eq("is_published", true)
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return data;
  }
};
