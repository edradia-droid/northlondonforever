(function(){
  /*
   * NL4 shared prediction configuration.
   * Competition-specific prediction pages use the same prediction engine
   * and select one of these configurations through ?competition=.
   */
  window.NL4_PREDICTION_CONFIG={
    pl:{
      key:'pl',
      name:'Premier League',
      shortName:'PL',
      squadGlobal:'NL4_FINAL_PL_SQUADS'
    },
    cl:{
      key:'cl',
      name:'Champions League',
      shortName:'CL',
      squadGlobal:'NL4_FINAL_CL_SQUADS'
    },
    fa:{
      key:'fa',
      name:'FA Cup',
      shortName:'FA',
      squadGlobal:'NL4_FINAL_FA_SQUADS'
    },
    carabao:{
      key:'carabao',
      name:'Carabao Cup',
      shortName:'CARABAO',
      squadGlobal:'NL4_FINAL_PL_SQUADS'
    }
  };
})();