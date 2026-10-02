(function(){
'use strict';
const SEASON='2026/27';
async function recalculateUclStats(client=window.nl4Supabase){
 if(!client)throw new Error('Supabase is unavailable.');
 const {data,error}=await client.rpc('rebuild_ucl_player_stats');
 if(error)throw error;
 const {data:fixtures,error:fixtureError}=await client.from('fixtures').select('id').eq('season',SEASON).eq('competition','UEFA Champions League').eq('source','BSD').in('status',['fulltime','finished','ft','aet','pen']);
 if(fixtureError)throw fixtureError;
 return {matches:(fixtures||[]).length,players:Number(data)||0,teams:0};
}
window.recalculateUclStats=recalculateUclStats;
})();