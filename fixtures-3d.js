
(function(){
  const card = document.getElementById('nextMatchCard');
  if (!card) return;

  const finePointer = window.matchMedia('(pointer:fine)').matches;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion:reduce)').matches;

  if (!finePointer || reduceMotion) return;

  card.addEventListener('mousemove', function(event){
    const rect = card.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;

    const rotateY = (x - 0.5) * 7;
    const rotateX = (0.5 - y) * 5;

    card.style.setProperty('--rx', rotateX.toFixed(2) + 'deg');
    card.style.setProperty('--ry', rotateY.toFixed(2) + 'deg');
  });

  card.addEventListener('mouseleave', function(){
    card.style.setProperty('--rx', '0deg');
    card.style.setProperty('--ry', '0deg');
  });
})();


(function(){
  const cards = document.querySelectorAll('[data-tilt-card]');
  if (!cards.length) return;

  const finePointer = window.matchMedia('(pointer:fine)').matches;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  if (!finePointer || reduceMotion) return;

  cards.forEach(function(card){
    card.addEventListener('mousemove', function(event){
      const rect = card.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;

      const ry = (x - 0.5) * 6;
      const rx = (0.5 - y) * 4;

      card.style.setProperty('--mini-rx', rx.toFixed(2) + 'deg');
      card.style.setProperty('--mini-ry', ry.toFixed(2) + 'deg');
    });

    card.addEventListener('mouseleave', function(){
      card.style.setProperty('--mini-rx', '0deg');
      card.style.setProperty('--mini-ry', '0deg');
    });
  });
})();
