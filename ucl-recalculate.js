(function(){
'use strict';
const SEASON='2026/27';
async function recalculateUclStats(client=window.nl4Supabase,fixture=null){
 if(!client)throw new Error('Supabase is unavailable.');
 const externalId=String(fixture?.external_fixture_id||fixture?.provider_event_id||fixture?.source_fixture_id||'').trim();
 const bsdEventId=/^bsd:/i.test(externalId)?externalId.replace(/^bsd:/i,'').trim():'';
 const body={source:'ucl-admin-recalculate'};
 if(bsdEventId)body.event_ids=[bsdEventId];
 const {data,error}=await client.functions.invoke('sync-ucl-football',{body});
 if(error)throw error;
 const {data:fixtures,error:fixtureError}=await client.from('fixtures').select('id').eq('season',SEASON).eq('competition','UEFA Champions League').eq('source','BSD').in('status',['fulltime','finished','ft','aet','pen']);
 if(fixtureError)throw fixtureError;
 return {matches:(fixtures||[]).length,players:Number(data?.playerStats||0),teams:Number(data?.teams||0)};
}
window.recalculateUclStats=recalculateUclStats;
})();