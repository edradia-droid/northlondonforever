(function () {
  const body = document.body;
  const sidebar = document.getElementById('sidebar');
  const toggle = document.getElementById('nl4MenuToggle');
  const overlay = document.getElementById('overlay');

  if (!body || !sidebar || !toggle) return;

  let mobileMode = window.innerWidth <= 900;

  function isOpen() {
    return sidebar.classList.contains('open');
  }

  function applyState(open) {
    sidebar.classList.toggle('open', open);
    body.classList.toggle('sidebar-closed', !open);

    /* Force the visual state so older page CSS cannot override it */
    sidebar.style.setProperty(
      'transform',
      open ? 'translateX(0)' : 'translateX(-105%)',
      'important'
    );
    sidebar.style.setProperty('transition', 'transform .25s ease', 'important');

    if (overlay) {
      const showOverlay = open && window.innerWidth <= 900;
      overlay.classList.toggle('show', showOverlay);

      if (showOverlay) {
        overlay.style.setProperty('display', 'block', 'important');
        overlay.style.setProperty('opacity', '1', 'important');
        overlay.style.setProperty('visibility', 'visible', 'important');
        overlay.style.setProperty('pointer-events', 'auto', 'important');
      } else {
        overlay.style.setProperty('opacity', '0', 'important');
        overlay.style.setProperty('visibility', 'hidden', 'important');
        overlay.style.setProperty('pointer-events', 'none', 'important');

        if (window.innerWidth > 900) {
          overlay.style.setProperty('display', 'none', 'important');
        }
      }
    }

    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.setAttribute(
      'aria-label',
      open ? 'Close navigation' : 'Open navigation'
    );
  }

  /* Make sure the one shared button is available */
  toggle.style.setProperty('display', 'grid', 'important');
  toggle.style.setProperty('place-items', 'center', 'important');
  toggle.style.setProperty('position', 'fixed', 'important');
  toggle.style.setProperty('z-index', '7000', 'important');

  /* Desktop begins open, mobile begins closed */
  applyState(!mobileMode);

  /*
   * Capture phase + stopImmediatePropagation:
   * prevents old inline page handlers from firing after this one.
   */
  toggle.addEventListener('click', function (event) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    applyState(!isOpen());
  }, true);

  if (overlay) {
    overlay.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      applyState(false);
    }, true);
  }

  document.querySelectorAll('#sideNav a').forEach(function (link) {
    link.addEventListener('click', function () {
      if (window.innerWidth <= 900) {
        applyState(false);
      }
    }, true);
  });

  window.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && isOpen()) {
      applyState(false);
    }
  });

  /*
   * Phones fire resize while browser chrome expands/collapses.
   * Only reset the sidebar when crossing the 900px breakpoint.
   */
  window.addEventListener('resize', function () {
    const nowMobile = window.innerWidth <= 900;

    if (nowMobile !== mobileMode) {
      mobileMode = nowMobile;
      applyState(!mobileMode);
    }
  });
})();
