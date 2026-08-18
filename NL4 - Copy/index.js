document.addEventListener("DOMContentLoaded", () => {
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("overlay");
  const menuBtn = document.getElementById("menuBtn");
  const closeMenu = document.getElementById("closeMenu");
  const sideNav = document.getElementById("sideNav");
  const header = document.querySelector(".topbar");

  // Mobile sidebar
  function openMenu() {
    sidebar?.classList.add("open");
    overlay?.classList.add("show");
    document.body.classList.add("menu-open");
    menuBtn?.setAttribute("aria-expanded", "true");
    menuBtn?.setAttribute("aria-label", "Close menu");
  }

  function closeSidebar() {
    sidebar?.classList.remove("open");
    overlay?.classList.remove("show");
    document.body.classList.remove("menu-open");
    menuBtn?.setAttribute("aria-expanded", "false");
    menuBtn?.setAttribute("aria-label", "Open menu");
  }

  menuBtn?.addEventListener("click", () => {
    if (sidebar?.classList.contains("open")) closeSidebar();
    else openMenu();
  });

  closeMenu?.addEventListener("click", closeSidebar);
  overlay?.addEventListener("click", closeSidebar);

  // Close sidebar after selecting a mobile navigation link.
  sideNav?.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", closeSidebar);
  });

  // Close with Escape.
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeSidebar();
  });

  // If the screen becomes desktop-sized, remove mobile-open state.
  window.addEventListener("resize", () => {
    if (window.innerWidth > 900) closeSidebar();
  });

  // Header scroll effect.
  window.addEventListener("scroll", () => {
    header?.classList.toggle("scrolled", window.scrollY > 30);
  });

  // Active sidebar link.
  const sections = document.querySelectorAll("main section[id]");
  const navLinks = document.querySelectorAll(".nav-link");

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;

        navLinks.forEach(link => link.classList.remove("active"));
        const active = document.querySelector(
          `.nav-link[href="#${entry.target.id}"]`
        );
        active?.classList.add("active");
      });
    }, { rootMargin: "-35% 0px -55% 0px" });

    sections.forEach(section => observer.observe(section));
  }

  // Reveal elements.
  const revealItems = document.querySelectorAll(".reveal");

  if ("IntersectionObserver" in window) {
    const revealObserver = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });

    revealItems.forEach(item => revealObserver.observe(item));
  } else {
    revealItems.forEach(item => item.classList.add("visible"));
  }

  // Timeline modal — works if the elements exist on another page using this JS.
  const modal = document.getElementById("homeModal");
  const modalTitle = document.getElementById("modalTitle");
  const modalText = document.getElementById("modalText");
  const modalClose = document.getElementById("modalClose");

  function closeModal() {
    if (!modal) return;
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
  }

  document.querySelectorAll(".timeline-item").forEach(item => {
    item.addEventListener("click", () => {
      if (!modal) return;
      if (modalTitle) modalTitle.textContent = item.dataset.title || "Arsenal Moment";
      if (modalText) modalText.textContent = item.dataset.text || "";
      modal.classList.add("open");
      modal.setAttribute("aria-hidden", "false");
    });
  });

  modalClose?.addEventListener("click", closeModal);
  modal?.addEventListener("click", event => {
    if (event.target === modal) closeModal();
  });

  // Did-you-know carousel.
  const facts = [
    {
      title: "An unbeaten season became a piece of Arsenal folklore.",
      text: "In 2003–04, Arsenal finished the league season with 26 wins, 12 draws and 0 defeats."
    },
    {
      title: "Arsenal's 1988–89 title was decided at Anfield.",
      text: "Arsenal beat Liverpool 2–0 at Anfield to win the title in dramatic fashion."
    },
    {
      title: "1970–71 delivered a historic Double.",
      text: "Arsenal completed the League and FA Cup Double in the 1970–71 season."
    },
    {
      title: "The 1997–98 Double came in Arsène Wenger's first full season.",
      text: "Arsenal won both the league and FA Cup in Wenger's first full season in charge."
    }
  ];

  const factTitle = document.getElementById("factTitle");
  const factText = document.getElementById("factText");
  const nextFact = document.getElementById("nextFact");
  let factIndex = 0;

  nextFact?.addEventListener("click", () => {
    factIndex = (factIndex + 1) % facts.length;
    const fact = facts[factIndex];

    if (factTitle) factTitle.style.opacity = "0";
    if (factText) factText.style.opacity = "0";

    setTimeout(() => {
      if (factTitle) {
        factTitle.textContent = fact.title;
        factTitle.style.opacity = "1";
      }
      if (factText) {
        factText.textContent = fact.text;
        factText.style.opacity = "1";
      }
    }, 160);
  });

  // Treasure progress.
  const progressText = document.getElementById("vaultProgress");
  const progressFill = document.getElementById("progressFill");

  function updateVaultProgress() {
    if (!progressText || !progressFill) return;

    let count = 0;

    try {
      const possibleKeys = [
        "trophiesViewed",
        "viewedTrophies",
        "treasuresViewed",
        "arsenalTrophiesViewed"
      ];

      for (const key of possibleKeys) {
        const value = localStorage.getItem(key);
        if (!value) continue;

        const parsed = JSON.parse(value);

        if (Array.isArray(parsed)) {
          count = Math.min(parsed.length, 4);
          break;
        }

        if (typeof parsed === "number") {
          count = Math.min(parsed, 4);
          break;
        }
      }
    } catch (_) {
      // Keep safe default of 0/4.
    }

    progressText.textContent = `${count} / 4`;
    progressFill.style.width = `${(count / 4) * 100}%`;
  }

  updateVaultProgress();
  window.addEventListener("storage", updateVaultProgress);
  window.addEventListener("pageshow", updateVaultProgress);
});

document.addEventListener("DOMContentLoaded", () => {
  const menuBtn = document.getElementById("menuBtn");
  const nav = document.getElementById("nav");

  if (menuBtn && nav) {
    const setMenu = (open) => {
      nav.classList.toggle("open", open);
      menuBtn.setAttribute("aria-expanded", String(open));
      menuBtn.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
      document.body.classList.toggle("menu-open", open);
    };

    menuBtn.addEventListener("click", () => setMenu(!nav.classList.contains("open")));
    nav.querySelectorAll("a").forEach(a => a.addEventListener("click", () => setMenu(false)));
    document.addEventListener("keydown", e => { if (e.key === "Escape") setMenu(false); });
    window.addEventListener("resize", () => { if (window.innerWidth > 820) setMenu(false); });
  }

  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("overlay");
  const closeMenu = document.getElementById("closeMenu");

  if (sidebar && overlay) {
    const closeSidebar = () => {
      sidebar.classList.remove("open");
      overlay.classList.remove("show");
      document.body.classList.remove("menu-open");
    };
    document.getElementById("menuBtn")?.addEventListener("click", () => {
      sidebar.classList.add("open");
      overlay.classList.add("show");
      document.body.classList.add("menu-open");
    });
    closeMenu?.addEventListener("click", closeSidebar);
    overlay.addEventListener("click", closeSidebar);
    document.querySelectorAll(".nav-link, .treasure-link").forEach(a =>
      a.addEventListener("click", closeSidebar)
    );
  }
});


document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.openBtn').forEach(btn => {
    const popup = btn.parentElement.querySelector('.popup');
    if (!popup) return;
    btn.addEventListener('click', () => popup.classList.add('show'));
    popup.querySelector('.close')?.addEventListener('click', () => popup.classList.remove('show'));
    popup.addEventListener('click', e => { if (e.target === popup) popup.classList.remove('show'); });
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') document.querySelectorAll('.popup.show').forEach(p => p.classList.remove('show'));
  });
});

document.addEventListener("DOMContentLoaded", function () {


const menuBtn = document.getElementById("menuBtn");
const mainNav = document.getElementById("mainNav");

if (!menuBtn || !mainNav) {
    return;
}

menuBtn.addEventListener("click", function () {

    const isOpen = mainNav.classList.toggle("open");

    menuBtn.setAttribute(
        "aria-expanded",
        isOpen ? "true" : "false"
    );

    menuBtn.textContent = isOpen ? "✕" : "☰";

});


/* Close menu when a link is clicked */

const navLinks = mainNav.querySelectorAll("a");

navLinks.forEach(function (link) {

    link.addEventListener("click", function () {

        mainNav.classList.remove("open");

        menuBtn.setAttribute(
            "aria-expanded",
            "false"
        );

        menuBtn.textContent = "☰";

    });

});


});

// =====================================================
// NL4 SUPABASE DATA HOOKS
// Requires these scripts to load before index.js:
// 1. @supabase/supabase-js
// 2. supabase-client.js
// 3. nl4-data.js
// =====================================================

document.addEventListener("DOMContentLoaded", () => {
  if (!window.NL4Data) {
    console.warn("NL4Data is not available. Load supabase-client.js and nl4-data.js before index.js.");
    return;
  }

  function getSupabasePlayerGrid() {
    // 1) Prefer an explicit container if the HTML provides one.
    const explicit = document.getElementById("supabasePlayers")
      || document.querySelector("[data-supabase-players]");
    if (explicit) return explicit;

    // 2) Look for the Current Generation heading and a nearby grid.
    const headings = [...document.querySelectorAll("h1, h2, h3")];
    const heading = headings.find(el =>
      el.textContent.trim().toLowerCase().includes("current generation")
    );

    if (heading) {
      const section = heading.closest("section, .player-era, .ph1, main") || heading.parentElement;

      // Prefer a grid inside the nearest logical section.
      const localGrids = section
        ? [...section.querySelectorAll(".players, .player-cards, .players-grid, .player-grid")]
        : [];

      if (localGrids.length) {
        // If there are several, choose the one appearing after the Current Generation heading.
        const afterHeading = localGrids.find(grid =>
          Boolean(heading.compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_FOLLOWING)
        );
        if (afterHeading) return afterHeading;
        return localGrids[localGrids.length - 1];
      }

      // Search immediate siblings after the heading.
      let next = heading.nextElementSibling;
      while (next) {
        if (next.matches?.(".players, .player-cards, .players-grid, .player-grid")) return next;
        const nested = next.querySelector?.(".players, .player-cards, .players-grid, .player-grid");
        if (nested) return nested;
        if (/^H[1-3]$/.test(next.tagName)) break;
        next = next.nextElementSibling;
      }
    }

    // 3) If this looks like a player archive page, use the last player grid.
    const allGrids = [...document.querySelectorAll(
      ".players, .player-cards, .players-grid, .player-grid"
    )];
    if (allGrids.length) return allGrids[allGrids.length - 1];

    // 4) Guaranteed fallback: create a visible Supabase section.
    const host = document.querySelector("main") || document.body;
    const section = document.createElement("section");
    section.className = "player-era supabase-player-section";
    section.innerHTML = `
      <div class="section-head standalone-head era-heading">
        <div>
          <p class="eyebrow">ADMIN DATABASE</p>
          <h2>Admin Added Players</h2>
        </div>
      </div>
      <div class="players" id="supabasePlayers" data-supabase-players></div>
    `;
    host.appendChild(section);
    return section.querySelector("#supabasePlayers");
  }

  function renderSupabasePlayers(players) {
    if (!Array.isArray(players) || !players.length) return;

    const grid = getSupabasePlayerGrid();
    if (!grid) {
      console.warn("NL4: Current Generation player grid was not found, so Supabase players were not rendered.");
      return;
    }

    const existingNames = new Set(
      [...grid.querySelectorAll(".player-card h3, .player-card figcaption, .player-card > a:not(.more-details), .player-info h3")]
        .map(el => el.textContent.trim().toLowerCase())
        .filter(Boolean)
    );

    if (!document.getElementById("nl4SupabasePlayerFallbackStyles")) {
      const style = document.createElement("style");
      style.id = "nl4SupabasePlayerFallbackStyles";
      style.textContent = `
        .supabase-player-section{padding:28px 0}
        .supabase-player-section .players{
          display:grid;
          grid-template-columns:repeat(auto-fit,minmax(210px,1fr));
          gap:18px;
        }
        .supabase-player-card{
          min-width:0;
        }
        .supabase-player-card .player-image-placeholder{
          width:100%;
          min-height:150px;
          display:grid;
          place-items:center;
          background:#171717;
          color:#fff;
          font-weight:900;
          letter-spacing:.12em;
        }
        .supabase-player-card .player-position{
          display:block;
          margin:6px 0 10px;
          font-size:.8rem;
          opacity:.75;
        }
      `;
      document.head.appendChild(style);
    }

    players.forEach(player => {
      const name = (player.name || "").trim();
      if (!name || existingNames.has(name.toLowerCase())) return;

      const profileUrl = player.profile_url || "#";
      const imageUrl = player.image_url || "";
      const tag = (player.era || "CURRENT GENERATION").replace(/[-_]/g, " ").toUpperCase();

      // Use the newer styled card structure when the page already uses it.
      const usesStyledCards = Boolean(grid.querySelector(".player-media, .player-info"));

      let card;
      if (usesStyledCards) {
        card = document.createElement("article");
        card.className = "player-card supabase-player-card";
        card.dataset.supabaseId = player.id || "";
        card.innerHTML = `
          <div class="player-media">
            <a href="${profileUrl}">
              ${imageUrl
                ? `<img src="${imageUrl}" alt="${name}" loading="lazy">`
                : `<div class="player-image-placeholder" aria-label="${name}">NL4</div>`}
            </a>
            <div class="player-badge">ARSENAL</div>
          </div>
          <div class="player-info">
            <span class="player-tag">${tag}</span>
            <h3>${name}</h3>
            ${player.position ? `<p class="player-position">${player.position}${player.shirt_number ? ` • #${player.shirt_number}` : ""}</p>` : ""}
            <a class="more-details" href="${profileUrl}">More Details</a>
          </div>
        `;
      } else {
        // Compatible with the older .cliff.player-card layout used on your archive pages.
        card = document.createElement("div");
        card.className = "cliff player-card supabase-player-card";
        card.dataset.supabaseId = player.id || "";
        card.innerHTML = `
          <a href="${profileUrl}">
            ${imageUrl
              ? `<img src="${imageUrl}" alt="${name}" width="200" height="150" loading="lazy">`
              : `<div class="player-image-placeholder" aria-label="${name}">NL4</div>`}
          </a>
          <a href="${profileUrl}">${name}</a>
          ${player.position ? `<span class="player-position">${player.position}${player.shirt_number ? ` • #${player.shirt_number}` : ""}</span>` : ""}
          <a class="more-details" href="${profileUrl}" aria-label="More details about ${name}">More Details</a>
        `;
      }

      grid.appendChild(card);
      existingNames.add(name.toLowerCase());
    });
  }

  async function loadNL4Players() {
    try {
      const players = await window.NL4Data.players();
      window.nl4Players = players;
      console.log("NL4 players loaded from Supabase:", players);

      renderSupabasePlayers(players);

      document.dispatchEvent(new CustomEvent("nl4:players-loaded", { detail: players }));
    } catch (error) {
      console.error("Could not load NL4 players from Supabase:", error);
    }
  }

  async function loadNL4News() {
    try {
      const stories = await window.NL4Data.news(6);
      window.nl4Stories = stories;
      console.log("NL4 news loaded from Supabase:", stories);
      document.dispatchEvent(new CustomEvent("nl4:news-loaded", { detail: stories }));
    } catch (error) {
      console.error("Could not load NL4 news from Supabase:", error);
    }
  }

  async function loadNL4Fixtures() {
    try {
      const fixtures = await window.NL4Data.fixtures();
      window.nl4Fixtures = fixtures;
      console.log("NL4 fixtures loaded from Supabase:", fixtures);
      document.dispatchEvent(new CustomEvent("nl4:fixtures-loaded", { detail: fixtures }));
    } catch (error) {
      console.error("Could not load NL4 fixtures from Supabase:", error);
    }
  }

  // Load only when the page appears to contain the relevant section.
  // This avoids unnecessary database requests on unrelated pages.
  const path = window.location.pathname.toLowerCase();
  const hasPlayersArea = document.querySelector("#players, .players-grid, .player-grid, .player-card") || path.includes("player");
  const hasNewsArea = document.querySelector("#news, .news-grid, .news-card") || path.includes("news") || path.endsWith("/") || path.includes("index.html");
  const hasFixturesArea = document.querySelector("#fixtures, .fixtures, .fixture-card") || path.includes("fixture");

  if (hasPlayersArea) loadNL4Players();
  if (hasNewsArea) loadNL4News();
  if (hasFixturesArea) loadNL4Fixtures();

  // Make loaders available if another page/script wants to refresh data manually.
  window.loadNL4Players = loadNL4Players;
  window.loadNL4News = loadNL4News;
  window.loadNL4Fixtures = loadNL4Fixtures;
});

