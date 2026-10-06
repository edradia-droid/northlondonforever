import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.3";
import { corsHeaders } from "npm:@supabase/supabase-js@2.112.3/cors";

const BSD="https://sports.bzzoiro.com/api/v2", LEAGUE_ID=1, DEFAULT_SEASONS=15;
function serverKey(){const raw=Deno.env.get("SUPABASE_SECRET_KEYS");if(raw){try{const p=JSON.parse(raw);if(p?.default)return p.default}catch{}}return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||""}
function json(x:any,s=200){return new Response(JSON.stringify(x),{status:s,headers:{...corsHeaders,"Content-Type":"application/json"}})}
function arr(x:any){return Array.isArray(x)?x:(x?.standings??x?.results??x?.events??x?.seasons??x?.data??[])}
function seasonItems(x:any){if(Array.isArray(x))return x;for(const c of [x?.seasons,x?.results?.seasons,x?.data?.seasons,x?.league?.seasons,x?.data,x?.results])if(Array.isArray(c)&&c.length)return c;return []}
function name(x:any){return typeof x==="string"?x:(x?.name??x?.short_name??x?.season_name??x?.team_name??x?.club_name??x?.team?.name??x?.team?.short_name??x?.club?.name??x?.club?.short_name??null)}
function id(x:any){return x?.id??x?.team_id??x?.event_id??x?.fixture_id??x?.season_id??x?.team?.id??x?.club?.id??null}
function num(x:any){return x==null||x===""?null:Number(x)}
const teamIdCache=new Map<string,number|null>();
async function resolveTeamId(teamName:string,key:string){const k=String(teamName||'').trim().toLowerCase();if(!k)return null;if(teamIdCache.has(k))return teamIdCache.get(k)??null;try{const rows=arr(await bsd('/teams/?name='+encodeURIComponent(teamName)+'&limit=20&offset=0',key));const exact=rows.find((t:any)=>{const n=name(t);return n&&String(n).trim().toLowerCase()===k})??rows.find((t:any)=>name(t));const v=exact?num(id(exact)):null;teamIdCache.set(k,v);return v}catch{teamIdCache.set(k,null);return null}}
async function bsd(path:string,key:string){const r=await fetch(BSD+path,{headers:{Authorization:"Token "+key,Accept:"application/json"}});const txt=await r.text();let body:any;try{body=JSON.parse(txt)}catch{throw new Error("BSD returned non-JSON "+r.status)}if(!r.ok)throw new Error("BSD "+r.status+": "+JSON.stringify(body));return body}
async function sha256Hex(v:string){const h=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v));return [...new Uint8Array(h)].map(b=>b.toString(16).padStart(2,"0")).join("")}
function seasonLabel(s:any){const start=s?.start_year??s?.year??s?.season_year;if(start!=null&&/^20\d{2}$/.test(String(start)))return String(start)+"/"+String(Number(start)+1).slice(-2);const v=name(s);if(v){const m=String(v).match(/(20\d{2})\s*\/\s*(\d{2})/);if(m)return m[1]+"/"+m[2]}return null}
function statusOf(e:any){const r=String(e?.status??e?.event_status??e?.state??"").toLowerCase();if(r.includes("finish")||r==="ft"||r.includes("complete"))return"fulltime";if(r.includes("live")||r.includes("progress"))return"live";if(r.includes("postpon"))return"postponed";if(r.includes("cancel"))return"cancelled";return"scheduled"}
async function syncStandings(db:any,season:any,key:string){
let arsenalPosition:number|null=null;
try{

const standingBody=await bsd(`/leagues/${LEAGUE_ID}/standings/?season_id=${season.id}`,key),rawRows=arr(standingBody);
const rows=rawRows.map((x:any)=>({position:num(x?.position??x?.rank??x?.place),club:name(x?.team??x?.club??x),played:num(x?.played??x?.matches_played??x?.games_played),wins:num(x?.wins??x?.won),draws:num(x?.draws),losses:num(x?.losses??x?.lost),goals_for:num(x?.goals_for??x?.gf??x?.goals_scored),goals_against:num(x?.goals_against??x?.ga??x?.goals_conceded),goal_difference:num(x?.goal_difference??x?.gd),points:num(x?.points??x?.pts)})).filter((x:any)=>x.position!=null&&x.club);
const positions=new Set(rows.map((x:any)=>Number(x.position))),clubs=new Set(rows.map((x:any)=>String(x.club).trim().toLowerCase()));
if(rows.length!==20||positions.size!==20||![...positions].every((n:any)=>n>=1&&n<=20)||clubs.size!==20)throw new Error("BSD standings validation failed: expected 20 unique clubs/positions, got "+rows.length);
const seasonKey=String(season.label),existing=await db.from("premier_league_standings").select("id,season,position,club").eq("season",seasonKey);if(existing.error)throw existing.error;const old=existing.data??[];
for(let i=0;i<old.length;i++){const q=await db.from("premier_league_standings").update({position:-1000000-i}).eq("id",old[i].id);if(q.error)throw q.error}
const byClub=new Map(old.map((x:any)=>[String(x.club).trim().toLowerCase(),x.id])),kept=new Set<string>();
for(const r of rows){const data:any={season:seasonKey,position:Number(r.position),club:String(r.club).trim(),played:r.played??0,wins:r.wins??0,draws:r.draws??0,losses:r.losses??0,goals_for:r.goals_for??0,goals_against:r.goals_against??0,goal_difference:r.goal_difference??0,points:r.points??0,updated_at:new Date().toISOString()},eid=byClub.get(data.club.toLowerCase());if(eid){const q=await db.from("premier_league_standings").update(data).eq("id",eid);if(q.error)throw q.error;kept.add(String(eid))}else{const q=await db.from("premier_league_standings").insert(data).select("id").single();if(q.error)throw q.error;kept.add(String(q.data.id))}}
for(const o of old)if(!kept.has(String(o.id))){const q=await db.from("premier_league_standings").delete().eq("id",o.id);if(q.error)throw q.error}
const ar=rows.find((x:any)=>/^arsenal(?: fc)?$/i.test(String(x.club).trim()));if(!ar)throw new Error("Validated BSD table for "+seasonKey+" does not contain Arsenal");arsenalPosition=ar.position;

}catch(e){throw new Error("BSD standings sync failed for "+String(season.label)+": "+errorText(e))}
return arsenalPosition;
}
function errorText(e:any){if(e instanceof Error)return e.message;try{return JSON.stringify(e)}catch{return String(e)}}

Deno.serve(async(req)=>{if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});if(req.method!=="POST")return json({error:"POST required"},405);try{
const supplied=req.headers.get("x-nl4-internal-token")||"",tokenHash=await sha256Hex(supplied);
const db=createClient(Deno.env.get("SUPABASE_URL")!,serverKey(),{auth:{persistSession:false,autoRefreshToken:false}});
const auth=await db.from("nl4_internal_sync_tokens").select("token_hash").eq("purpose","bsd_pl_history").eq("active",true).eq("token_hash",tokenHash).maybeSingle();
if(auth.error)throw auth.error;if(!auth.data?.token_hash||tokenHash!==auth.data.token_hash)return json({error:"Unauthorized"},401);
const key=Deno.env.get("BSD_API_KEY");if(!key)throw new Error("Missing BSD_API_KEY");
const p=new URL(req.url).searchParams,requested=Math.max(1,Math.min(15,Number(p.get("seasons")||DEFAULT_SEASONS))),seasonStart=Math.max(0,Math.min(15,Number(p.get("start")||0)));
let seasonBody:any=null,seasonError:any=null;
for(const path of [`/leagues/${LEAGUE_ID}/seasons/`,`/leagues/${LEAGUE_ID}/seasons`,`/seasons/?league_id=${LEAGUE_ID}&limit=100&offset=0`,`/competitions/${LEAGUE_ID}/seasons/?limit=100&offset=0`]){try{seasonBody=await bsd(path,key);break}catch(e){seasonError=String(e)}}
if(!seasonBody){try{const lb=await bsd(`/leagues/${LEAGUE_ID}/`,key);const embedded=lb?.seasons??lb?.data?.seasons??lb?.league?.seasons;if(Array.isArray(embedded)&&embedded.length)seasonBody=embedded}catch(e){seasonError=String(e)}}
if(!seasonBody)throw new Error("Could not discover BSD Premier League seasons: "+seasonError);
const rawSeasons=seasonItems(seasonBody),allSeasons=rawSeasons.map((s:any)=>({id:id(s),label:seasonLabel(s),raw:s})).filter((s:any)=>s.id!=null&&s.label).filter((s:any)=>/^20\d{2}\/\d{2}$/.test(String(s.label)));
const unique=new Map<string,any>();for(const s of allSeasons)unique.set(String(s.label),s);
const seasons=[...unique.values()].sort((a,b)=>String(b.label).localeCompare(String(a.label))).slice(seasonStart,seasonStart+requested);
if(!seasons.length)throw new Error("BSD returned no recognizable Premier League seasons; keys="+Object.keys(seasonBody||{}).join(",")+" count="+rawSeasons.length+" sample="+JSON.stringify(rawSeasons.slice(0,3)).slice(0,5000));
const teams=arr(await bsd("/teams/?name=Arsenal&limit=20&offset=0",key)),arsenal=teams.find((t:any)=>name(t)==="Arsenal"||name(t?.team)==="Arsenal")??teams[0],arsenalId=id(arsenal);if(!arsenalId)throw new Error("Could not resolve Arsenal BSD team id");
const synced:any[]=[];
for(const season of seasons){
let arsenalPosition:number|null=null;
const events=arr(await bsd(`/events/?league_id=${LEAGUE_ID}&season_id=${season.id}&team_id=${arsenalId}&limit=200&offset=0`,key));let seasonFixtures=0;
for(const e of events){const eid=String(id(e)||"");if(!eid)continue;const homeObj=e?.home_team??e?.home??e?.teams?.home,awayObj=e?.away_team??e?.away??e?.teams?.away;
const home=name(homeObj),away=name(awayObj),homeId=num(id(homeObj))??await resolveTeamId(home,key),awayId=num(id(awayObj))??await resolveTeamId(away,key);if(!home||!away||(home!=="Arsenal"&&away!=="Arsenal"))continue;const ih=home==="Arsenal",op=ih?away:home,hs=num(e?.home_score??e?.score?.home??e?.scores?.home),as=num(e?.away_score??e?.score?.away??e?.scores?.away),kick=e?.event_date??e?.start_time??e?.kickoff_at??e?.date??null,row:any={opponent:op,competition:"Premier League",kickoff_at:kick,is_home:ih,home_team:home,away_team:away,external_fixture_id:"bsd:"+eid,source:"BSD",season:String(season.label),home_team_id:homeId,away_team_id:awayId,status:statusOf(e),is_published:true,kickoff_confirmed:Boolean(kick),arsenal_score:ih?hs:as,opponent_score:ih?as:hs,home_score:hs,away_score:as,source_updated_at:new Date().toISOString(),updated_at:new Date().toISOString()},ex=await db.from("fixtures").select("id").eq("external_fixture_id","bsd:"+eid).maybeSingle();if(ex.error)throw ex.error;if(ex.data?.id){const q=await db.from("fixtures").update(row).eq("id",ex.data.id);if(q.error)throw q.error}else{const q=await db.from("fixtures").insert(row).select("id").single();if(q.error)throw q.error}seasonFixtures++}
arsenalPosition=await syncStandings(db,season,key);
synced.push({season:String(season.label),bsdSeasonId:season.id,fixtures:seasonFixtures,arsenalPosition});
}
return json({ok:true,source:"BSD",competition:"Premier League",arsenalTeamId:arsenalId,seasons:synced,totalFixtures:synced.reduce((n:any,x:any)=>n+x.fixtures,0),syncedAt:new Date().toISOString()});
}catch(e){console.error("BSD_PL_HISTORY_FAILED",errorText(e));return json({ok:false,error:errorText(e)},500)}});