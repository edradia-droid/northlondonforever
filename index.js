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
