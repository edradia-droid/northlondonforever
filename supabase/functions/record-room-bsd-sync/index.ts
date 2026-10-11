import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const SEASON = "2026/27";
const LEAGUE_ID = 1;
const SEASON_ID = 1058;
const SOURCE = "BSD Sports API (verified match data)";
const CORS = {
  "Access-Control-Allow-Origin": "https://edradia-droid.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status, headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
function unwrap(value: any): any {
  let x = value;
  for (let i = 0; i < 3 && x && typeof x === "object" && x.data && typeof x.data === "object"; i++) x = x.data;
  return x;
}
function norm(value: unknown): string {
  return String(value ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’‘]/g, "'").replace(/\b(?:a?fc|football club)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}
function teamName(value: any): string | null {
  if (typeof value === "string") return value.trim() || null;
  const v = value?.name ?? value?.team_name ?? value?.short_name ?? value?.display_name;
  return typeof v === "string" && v.trim() ? v.trim() : null;
}
function num(value: any): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "object" ? Number(value.value ?? value.total ?? value.actual ?? value.pct ?? value.count) : Number(value);
  return Number.isFinite(n) ? n : null;
}
function integer(value: any): number | null {
  const n = num(value);
  return n !== null && Number.isInteger(n) ? n : null;
}
function numberAt(side: any, keys: string[]): number | null {
  for (const key of keys) {
    const n = num(side?.[key]);
    if (n !== null) return n;
  }
  return null;
}
function completeStatus(value: any): boolean {
  const key = String(value?.name ?? value?.short_name ?? value ?? "").toLowerCase().replace(/[^a-z]/g, "");
  return ["finished", "finish", "ft", "fulltime", "ended", "complete", "completed"].includes(key) || key.includes("finished");
}
function list(value: any): any[] { return Array.isArray(value) ? value : []; }
function lineupPosition(value: any): string | null {
  const p = String(value ?? "").trim();
  if (!p) return null;
  const k = p.toUpperCase();
  if (["G", "GK", "GOALKEEPER"].includes(k)) return "GK";
  if (["D", "DEF", "DEFENDER"].includes(k)) return "DEF";
  if (["M", "MID", "MIDFIELDER"].includes(k)) return "MID";
  if (["F", "FW", "FWD", "FORWARD", "STRIKER"].includes(k)) return "FWD";
  return p;
}
const BSD_FORMATION_SLOT_ORDERS: Record<string,string[]> = {
  "4-2-3-1":["GK","RB","RCB","LCB","LB","LDM","RDM","RW","CAM","LW","ST"],
  "4-3-3":["GK","RB","RCB","LCB","LB","RCM","CM","LCM","RW","ST","LW"],
  "4-4-2":["GK","RB","RCB","LCB","LB","RM","RCM","LCM","LM","RST","LST"],
  "4-1-4-1":["GK","RB","RCB","LCB","LB","DM","RM","RCM","LCM","LM","ST"],
  "4-5-1":["GK","RB","RCB","LCB","LB","RM","RDM","CAM","LDM","LM","ST"],
  "3-4-3":["GK","RCB","CB","LCB","RWB","RCM","LCM","LWB","RW","ST","LW"],
  "3-5-2":["GK","RCB","CB","LCB","RWB","RCM","CM","LCM","LWB","RST","LST"],
  "3-4-2-1":["GK","RCB","CB","LCB","RWB","LCM","RCM","LWB","LAM","RAM","ST"],
  "3-4-1-2":["GK","RCB","CB","LCB","RWB","RCM","LCM","LWB","CAM","RST","LST"],
  "5-3-2":["GK","RWB","RCB","CB","LCB","LWB","RCM","CM","LCM","RST","LST"],
  "5-4-1":["GK","RWB","RCB","CB","LCB","LWB","RM","RCM","LCM","LM","ST"],
  "5-2-3":["GK","RWB","RCB","CB","LCB","LWB","RDM","LDM","RW","ST","LW"],
  "4-2-2-2":["GK","RB","RCB","LCB","LB","RDM","LDM","RAM","LAM","RST","LST"],
  "4-3-2-1":["GK","RB","RCB","LCB","LB","RCM","CM","LCM","RAM","LAM","ST"],
  "4-1-2-1-2":["GK","RB","RCB","LCB","LB","DM","RCM","LCM","CAM","RST","LST"],
  "4-3-1-2":["GK","RB","RCB","LCB","LB","RCM","CM","LCM","CAM","RST","LST"],
  "4-2-4":["GK","RB","RCB","LCB","LB","RDM","LDM","RW","RST","LST","LW"],
};
function lineupSlot(formation: any, index: number, rawPosition: any): string | null {
  const p = lineupPosition(rawPosition);
  if (p && !["GK","DEF","MID","FWD"].includes(p.toUpperCase())) return p.toUpperCase();
  const order = BSD_FORMATION_SLOT_ORDERS[String(formation ?? "").trim()];
  return order?.[index] ?? p;
}
function snake(value: any): string {
  return String(value ?? "unknown").replace(/([a-z0-9])([A-Z])/g, "$1_$2").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase() || "unknown";
}
function scoreValue(detail: any, side: "home" | "away"): number | null {
  return integer(detail?.[side + "_score"] ?? detail?.score?.[side] ?? detail?.scores?.[side]);
}
function statsFrom(payload: any): Record<string, number | null> {
  const root = unwrap(payload);
  const sides = root?.stats ?? root?.statistics ?? root;
  const home = sides?.home, away = sides?.away;
  if (!home || !away || typeof home !== "object" || typeof away !== "object") throw new Error("BSD team stats have no valid home/away objects.");
  const vals: Record<string, number | null> = {
    home_possession: numberAt(home, ["ball_possession", "possession"]),
    away_possession: numberAt(away, ["ball_possession", "possession"]),
    home_shots: numberAt(home, ["total_shots", "shots"]),
    away_shots: numberAt(away, ["total_shots", "shots"]),
    home_shots_on_target: numberAt(home, ["shots_on_target", "on_target"]),
    away_shots_on_target: numberAt(away, ["shots_on_target", "on_target"]),
    home_corners: numberAt(home, ["corner_kicks", "corners"]),
    away_corners: numberAt(away, ["corner_kicks", "corners"]),
    home_fouls: numberAt(home, ["fouls"]),
    away_fouls: numberAt(away, ["fouls"]),
    home_offsides: numberAt(home, ["offsides", "total_offside"]),
    away_offsides: numberAt(away, ["offsides", "total_offside"]),
    home_saves: numberAt(home, ["goalkeeper_saves", "total_saves", "saves"]),
    away_saves: numberAt(away, ["goalkeeper_saves", "total_saves", "saves"]),
  };
  for (const k of ["home_possession","away_possession","home_shots","away_shots","home_shots_on_target","away_shots_on_target","home_corners","away_corners","home_fouls","away_fouls"]) {
    if (vals[k] === null) throw new Error("BSD archived team stats are missing " + k);
  }
  if (vals.home_possession! < 0 || vals.home_possession! > 100 || vals.away_possession! < 0 || vals.away_possession! > 100 ||
      Math.abs(vals.home_possession! + vals.away_possession! - 100) > 2) throw new Error("BSD possession values are not a valid 100% total.");
  for (const k of ["home_shots","away_shots","home_shots_on_target","away_shots_on_target","home_corners","away_corners","home_fouls","away_fouls","home_offsides","away_offsides","home_saves","away_saves"]) {
    if (vals[k] !== null && (!Number.isInteger(vals[k]) || vals[k]! < 0)) throw new Error("BSD statistic is not a valid non-negative integer: " + k);
  }
  if (vals.home_shots_on_target! > vals.home_shots! || vals.away_shots_on_target! > vals.away_shots!) throw new Error("BSD shots on target exceed total shots.");
  return vals;
}
function getLatest(root: Map<string, any>, eventId: string, resourceType: string): any | null {
  return root.get(eventId + "|" + resourceType) ?? null;
}
async function chunks<T>(items: T[], size: number, fn: (part: T[]) => Promise<void>) {
  for (let i = 0; i < items.length; i += size) await fn(items.slice(i, i + size));
}
function sourcePlayerId(p: any): string | null {
  const v = p?.id ?? p?.player_id;
  return v === null || v === undefined ? null : String(v);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST required" }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ error: "Required server secrets are missing" }, 500);
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "A signed-in NL4 administrator session is required" }, 401);
  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const auth = await db.auth.getUser(token);
  if (auth.error || !auth.data.user) return json({ error: "Invalid or expired session" }, 401);
  const admin = await db.from("admins").select("user_id").eq("user_id", auth.data.user.id).maybeSingle();
  if (admin.error || !admin.data) return json({ error: "Admin access required" }, 403);

  let body: any = {};
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }
  let requestedIds: string[] | null = null;
  if (Array.isArray(body.event_ids)) {
    requestedIds = [...new Set(body.event_ids.map((x: any) => String(x ?? "").trim()).filter((x: string) => /^\d+$/.test(x)))];
    if (!requestedIds.length || requestedIds.length > 100) return json({ error: "event_ids must contain 1–100 numeric BSD event IDs." }, 400);
  } else if (body.mode && body.mode !== "all_completed") {
    return json({ error: "mode must be all_completed, or supply event_ids." }, 400);
  }

  try {
    const pmResult = await db.from("premier_league_matches")
      .select("id,season,matchday,home_team,away_team,home_score,away_score,status,source_fixture_id")
      .eq("season", SEASON).range(0, 499);
    if (pmResult.error) throw new Error("Could not load Premier League match index: " + pmResult.error.message);
    const matches = pmResult.data ?? [];
    const fixtureIds = matches.map((m: any) => m.source_fixture_id).filter(Boolean);
    const fixtureById = new Map<string, any>();
    await chunks(fixtureIds, 80, async (ids) => {
      const r = await db.from("fixtures")
        .select("id,external_fixture_id,home_team,away_team,season,competition,status,home_score,away_score,source_updated_at")
        .in("id", ids);
      if (r.error) throw new Error("Could not load linked fixture records: " + r.error.message);
      for (const f of r.data ?? []) fixtureById.set(f.id, f);
    });
    const matchByEvent = new Map<string, { match: any; fixture: any }>();
    for (const m of matches) {
      const f = m.source_fixture_id ? fixtureById.get(m.source_fixture_id) : null;
      const eventId = String(f?.external_fixture_id ?? "").match(/^bsd:(\d+)$/i)?.[1];
      if (!eventId) continue;
      if (requestedIds && !requestedIds.includes(eventId)) continue;
      if (norm(m.home_team) !== norm(f.home_team) || norm(m.away_team) !== norm(f.away_team)) continue;
      matchByEvent.set(eventId, { match: m, fixture: f });
    }
    const eventIds = [...matchByEvent.keys()];
    if (!eventIds.length) return json({ status: "succeeded", mode: requestedIds ? "selected_archived_events" : "all_completed", completed_matches_found: 0, results_synced: 0, stats_synced: 0, lineups_synced: 0, events_synced: 0, substitutions_synced: 0, note: "No selected events map to the current 2026/27 Premier League match index." });

    const resources = new Map<string, any>();
    await chunks(eventIds, 40, async (ids) => {
      const r = await db.rpc("record_room_bsd_latest_resources", { p_event_ids: ids });
      if (r.error) throw new Error("Could not read latest archived BSD resources: " + r.error.message);
      for (const row of r.data ?? []) {
        const k = row.source_event_id + "|" + row.resource_type;
        resources.set(k, row);
      }
    });

    const report = {
      status: "succeeded", mode: requestedIds ? "selected_archived_events" : "all_completed",
      source: "BSD archive in Supabase only; no BSD provider requests were made.",
      event_ids_requested: requestedIds?.length ?? null,
      completed_matches_found: 0, results_synced: 0, stats_synced: 0,
      lineups_synced: 0, events_synced: 0, substitutions_synced: 0,
      skipped_not_completed: 0, skipped_missing_detail: 0, skipped_invalid_teams: 0,
      skipped_lineups: 0, skipped_events: 0, skipped_stats: 0,
      warnings: [] as any[], match_reports: [] as any[],
    };

    const statsWork: any[] = [], detailsWork: any[] = [], lineupWork: any[] = [], eventWork: any[] = [], substitutionWork: any[] = [];
    const replacementLineupMatchIds: string[] = [], replacementEventMatchIds: string[] = [], replacementSubMatchIds: string[] = [];
    const scoreWork: any[] = [];

    for (const eventId of eventIds) {
      const linked = matchByEvent.get(eventId)!;
      const match = linked.match, fixture = linked.fixture;
      const detailRow = getLatest(resources, eventId, "match_detail");
      if (!detailRow?.raw_payload) { report.skipped_missing_detail++; continue; }
      const detail = unwrap(detailRow.raw_payload);
      const bsdHome = teamName(detail?.home_team ?? detail?.home ?? detail?.teams?.home);
      const bsdAway = teamName(detail?.away_team ?? detail?.away ?? detail?.teams?.away);
      if (!bsdHome || !bsdAway || norm(bsdHome) !== norm(match.home_team) || norm(bsdAway) !== norm(match.away_team)) {
        report.skipped_invalid_teams++;
        report.warnings.push({ event_id: eventId, match: match.home_team + " vs " + match.away_team, reason: "BSD detail team names do not match the linked 2026/27 fixture." });
        continue;
      }
      const statusRaw = detail.status?.name ?? detail.status?.short_name ?? detail.status ?? detail.event_status?.name ?? detail.event_status ?? detail.period;
      if (!completeStatus(statusRaw)) { report.skipped_not_completed++; continue; }
      const homeScore = scoreValue(detail, "home"), awayScore = scoreValue(detail, "away");
      if (homeScore === null || awayScore === null || homeScore < 0 || awayScore < 0) {
        report.skipped_not_completed++;
        report.warnings.push({ event_id: eventId, reason: "BSD detail does not have a complete numeric final score." });
        continue;
      }
      report.completed_matches_found++;
      const now = new Date().toISOString();
      scoreWork.push({ match_id: match.id, fixture_id: fixture.id, event_id: eventId, home_score: homeScore, away_score: awayScore, status: "fulltime", updated_at: now });
      const existingDetailResult = await db.from("record_room_match_details").select("*").eq("match_id", match.id).maybeSingle();
      if (existingDetailResult.error) throw new Error("Could not read existing match detail for " + eventId + ": " + existingDetailResult.error.message);
      const oldDetail = existingDetailResult.data ?? {};
      const htHome = integer(detail.home_score_ht ?? detail.home_score_half_time ?? detail.halftime?.home);
      const htAway = integer(detail.away_score_ht ?? detail.away_score_half_time ?? detail.halftime?.away);
      const attendance = integer(detail.attendance);
      const referee = teamName(detail.referee) ?? (typeof detail.referee === "string" ? detail.referee : null) ?? detail.referee_name ?? oldDetail.referee ?? null;
      const venue = teamName(detail.venue) ?? (typeof detail.venue === "string" ? detail.venue : null) ?? detail.venue_name ?? oldDetail.venue ?? null;
      detailsWork.push({
        ...oldDetail, match_id: match.id,
        ...(htHome !== null ? { halftime_home_score: htHome } : {}),
        ...(htAway !== null ? { halftime_away_score: htAway } : {}),
        ...(attendance !== null && attendance >= 0 ? { attendance } : {}),
        ...(typeof referee === "string" && referee.trim() ? { referee: referee.trim() } : {}),
        ...(typeof venue === "string" && venue.trim() ? { venue: venue.trim() } : {}),
        source: SOURCE, source_match_id: "https://sports.bzzoiro.com/api/v2/events/" + eventId + "/",
        source_updated_at: detailRow.captured_at ?? now, updated_at: now,
      });

      const statsRow = getLatest(resources, eventId, "team_stats");
      if (statsRow?.raw_payload) {
        try {
          const extracted = statsFrom(statsRow.raw_payload);
          const oldStatsResult = await db.from("record_room_match_stats").select("*").eq("match_id", match.id).maybeSingle();
          if (oldStatsResult.error) throw new Error("Could not read previous statistics: " + oldStatsResult.error.message);
          const oldStats = oldStatsResult.data ?? {};
          const cleanStats: Record<string, any> = { ...oldStats, match_id: match.id, updated_at: now };
          for (const [key, value] of Object.entries(extracted)) if (value !== null) cleanStats[key] = value;
          statsWork.push(cleanStats);
        } catch (e) {
          report.skipped_stats++;
          report.warnings.push({ event_id: eventId, reason: e instanceof Error ? e.message : String(e) });
        }
      } else report.skipped_stats++;

      const lineupResource = getLatest(resources, eventId, "lineups");
      const lineupPayload = unwrap(lineupResource?.raw_payload);
      const sides = lineupPayload?.lineups;
      const sideData = [
        { key: "home", team: match.home_team, side: sides?.home },
        { key: "away", team: match.away_team, side: sides?.away },
      ];
      let validLineups = Boolean(sides?.home && sides?.away);
      for (const s of sideData) {
        if (!Array.isArray(s.side?.players) || s.side.players.length !== 11 ||
            !Array.isArray(s.side?.substitutes) || s.side.substitutes.length !== 9 ||
            (s.side?.team_name && norm(s.side.team_name) !== norm(s.team))) validLineups = false;
      }
      if (validLineups) {
        const playerIds = new Map<string, Map<string, string>>();
        const minuteOn = new Map<string, number>(), minuteOff = new Map<string, number>();
        const itemKey = (team: string, player: string) => norm(team) + "|" + norm(player);
        for (const s of sideData) {
          playerIds.set(norm(s.team), new Map<string, string>());
          for (const p of [...list(s.side.players), ...list(s.side.substitutes)]) {
            const pid = sourcePlayerId(p), pname = teamName(p);
            if (pid && pname) playerIds.get(norm(s.team))!.set(pid, pname);
          }
        }
        const incidentResource = getLatest(resources, eventId, "incidents");
        const incidentPayload = unwrap(incidentResource?.raw_payload);
        const incidentList = incidentPayload && Array.isArray(incidentPayload.incidents) ? incidentPayload.incidents : null;
        if (incidentList) {
          for (let i = 0; i < incidentList.length; i++) {
            const inc = incidentList[i];
            if (String(inc?.type ?? "").toLowerCase() !== "substitution") continue;
            const home = inc?.is_home === true ? true : inc?.is_home === false ? false : null;
            if (home === null) continue;
            const team = home ? match.home_team : match.away_team;
            const idMap = playerIds.get(norm(team))!;
            const pin = (inc.player_in_id !== undefined ? idMap.get(String(inc.player_in_id)) : null) ?? String(inc.player_in ?? "").trim();
            const pout = (inc.player_out_id !== undefined ? idMap.get(String(inc.player_out_id)) : null) ?? String(inc.player_out ?? "").trim();
            const m = integer(inc.minute);
            if (m !== null && pin) minuteOn.set(itemKey(team, pin), m);
            if (m !== null && pout) minuteOff.set(itemKey(team, pout), m);
          }
        }
        for (const s of sideData) {
          const formation = s.side.formation ?? null;
          for (const [idx, p] of list(s.side.players).entries()) {
            const pname = teamName(p);
            if (!pname) continue;
            const key = itemKey(s.team, pname);
            const slot = lineupSlot(formation, idx, p.position);
            lineupWork.push({ match_id: match.id, team_name: s.team, player_name: pname,
              position: slot ?? lineupPosition(p.position), is_starter: true, formation,
              pitch_slot: slot, source_order: idx + 1,
              minute_on: minuteOn.get(key) ?? 0, minute_off: minuteOff.get(key) ?? null, updated_at: now });
          }
          for (const [idx, p] of list(s.side.substitutes).entries()) {
            const pname = teamName(p);
            if (!pname) continue;
            const key = itemKey(s.team, pname);
            lineupWork.push({ match_id: match.id, team_name: s.team, player_name: pname,
              position: lineupPosition(p.position), is_starter: false, formation,
              pitch_slot: null, source_order: 12 + idx,
              minute_on: minuteOn.get(key) ?? 0, minute_off: minuteOff.get(key) ?? null, updated_at: now });
          }
        }
        replacementLineupMatchIds.push(match.id);
      } else {
        report.skipped_lineups++;
      }

      const incidentResource = getLatest(resources, eventId, "incidents");
      const incidentPayload = unwrap(incidentResource?.raw_payload);
      if (incidentPayload && Array.isArray(incidentPayload.incidents)) {
        replacementEventMatchIds.push(match.id);
        replacementSubMatchIds.push(match.id);
        const incidents = incidentPayload.incidents as any[];
        const playerIdsForSide = new Map<string, Map<string, string>>();
        if (sides?.home && sides?.away) {
          for (const s of sideData) {
            const m = new Map<string, string>();
            for (const p of [...list(s.side?.players), ...list(s.side?.substitutes)]) {
              const pid = sourcePlayerId(p), pname = teamName(p);
              if (pid && pname) m.set(pid, pname);
            }
            playerIdsForSide.set(norm(s.team), m);
          }
        }
        for (let i = 0; i < incidents.length; i++) {
          const inc = incidents[i];
          const typeRaw = String(inc?.type ?? "").trim();
          const typeKey = typeRaw.toLowerCase();
          if (!typeRaw || ["period", "injurytime", "injury_time"].includes(typeKey.replace(/[^a-z]/g, ""))) continue;
          const isHome = inc?.is_home === true ? true : inc?.is_home === false ? false : null;
          const team = isHome === null ? null : isHome ? match.home_team : match.away_team;
          const eventType = typeKey === "card"
            ? (String(inc.card_type ?? inc.card ?? "").toLowerCase().includes("red") ? "red_card" : "yellow_card")
            : snake(typeRaw);
          const teamPlayerMap = team ? playerIdsForSide.get(norm(team)) : null;
          const resolveId = (id: any, raw: any) => (id !== null && id !== undefined ? teamPlayerMap?.get(String(id)) : null) ?? (typeof raw === "string" ? raw.trim() || null : null);
          const player = resolveId(inc.player_id ?? inc.scorer_id, inc.player ?? inc.player_in ?? inc.player_out ?? inc.name);
          const related = inc.assist ?? inc.related_player_name ?? (typeKey === "substitution" ? inc.player_out : null) ?? null;
          const minute = integer(inc.minute);
          const stoppage = integer(inc.added_time ?? inc.stoppage_minute);
          if (team && player && ["goal", "yellow_card", "red_card"].includes(eventType)) eventWork.push({ match_id: match.id, team_name: team, event_type: eventType,
            player_name: player, related_player_name: typeof related === "string" ? related.trim() || null : null,
            minute, stoppage_minute: stoppage, external_event_id: "bsd:" + eventId + ":" + i, updated_at: now });
          if (typeKey === "substitution") {
            const pin = resolveId(inc.player_in_id, inc.player_in);
            const pout = resolveId(inc.player_out_id, inc.player_out);
            if (team && pin && pout) substitutionWork.push({ match_id: match.id, team_name: team, player_out: pout, player_in: pin,
              minute, stoppage_minute: stoppage, external_event_id: "bsd:" + eventId + ":sub:" + i, updated_at: now });
          }
        }
      } else report.skipped_events++;
      report.match_reports.push({ event_id: eventId, match: match.home_team + " " + homeScore + "-" + awayScore + " " + match.away_team,
        stats: statsRow?.raw_payload ? "available_or_skipped_if_incomplete" : "not_archived",
        lineups: validLineups ? lineupWork.length : "skipped", incidents: incidentPayload && Array.isArray(incidentPayload.incidents) ? incidentPayload.incidents.length : "not_archived" });
    }

    if (!scoreWork.length) return json({ ...report, status: "partial", note: "No complete finished match details were eligible; no match data was replaced." }, 200);

    // Submit the complete validated batch to one database transaction. The RPC
    // suspends per-row mirroring triggers while replacing hundreds of rows, then
    // mirrors the completed lineup batch once, preventing repeated refresh timeouts.
    const payload = {
      scores: scoreWork,
      details: detailsWork,
      stats: statsWork,
      lineups: lineupWork,
      events: eventWork,
      substitutions: substitutionWork,
      replace_lineup_match_ids: [...new Set(replacementLineupMatchIds)],
      replace_event_match_ids: [...new Set(replacementEventMatchIds)],
      replace_substitution_match_ids: [...new Set(replacementSubMatchIds)],
    };
    const applied = await db.rpc("record_room_bsd_apply_sync_batch", { p_payload: payload });
    if (applied.error) throw new Error("The archived BSD batch could not be committed: " + applied.error.message);
    const appliedReport = applied.data && typeof applied.data === "object" ? applied.data : {};
    Object.assign(report, appliedReport);
    report.status = (report.skipped_stats || report.skipped_lineups || report.skipped_events || report.warnings.length)
      ? "partial" : (appliedReport.status || "succeeded");
    if (appliedReport.player_stats_refresh === "failed" || appliedReport.player_stats_refresh === "timed_out") {
      report.warnings.push({ reason: "Match data was saved, but the derived Arsenal player-stat refresh did not finish.", detail: appliedReport.player_stats_refresh_note || null });
    }
    return json({ ...report, note: "Only validated completed 2026/27 Premier League matches were published. Scores, stats, lineups, goals/cards and substitutions came from archived BSD payloads. No BSD provider API calls were made; upcoming fixtures were left untouched." });
  } catch (e) {
    return json({ status: "failed", error: e instanceof Error ? e.message : String(e), note: "A failure may have occurred after some batches were saved. Re-run the same archive sync to reconcile; data is sourced from the existing BSD archive and no provider quota was used." }, 500);
  }
});
