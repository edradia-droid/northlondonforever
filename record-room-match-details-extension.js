/* NL4 Record Room • extended match details
 * DOM-only admin extension: deliberately does not depend on Record Room's
 * script-scoped data variables, so it works with the standalone page safely.
 */
(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  function inject(){
    const box=$('fixtureDetail');
    if(!box || !box.classList.contains('open') || $('rrExtendedDetails')) return;
    const scoreBox=box.querySelector('.detail-box');
    if(!scoreBox) return;
    scoreBox.insertAdjacentHTML('afterend',`<div class="detail-box" id="rrExtendedDetails" style="margin-top:15px">
      <h4>Match details</h4>
      <div class="admin-grid" style="margin-top:10px">
        <div class="field"><label>REFEREE</label><input id="rrReferee" placeholder="Referee"></div>
        <div class="field"><label>VENUE</label><input id="rrVenue" placeholder="Stadium / venue"></div>
        <div class="field"><label>ATTENDANCE</label><input id="rrAttendance" type="number" min="0" placeholder="Attendance"></div>
        <div class="field"><label>HALF-TIME • HOME</label><input id="rrHalfHome" type="number" min="0" placeholder="HT home"></div>
        <div class="field"><label>HALF-TIME • AWAY</label><input id="rrHalfAway" type="number" min="0" placeholder="HT away"></div>
        <div class="field"><label>ADDED TIME</label><input id="rrAddedTime" type="number" min="0" max="30" value="0" placeholder="Minutes"></div>
      </div>
    </div>`);
  }
  function start(){
    inject();
    const box=$('fixtureDetail');
    if(box) new MutationObserver(inject).observe(box,{childList:true});
    setInterval(inject,300);
    console.log('[NL4 Record Room] Match-detail fields ready');
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start); else start();
})();
