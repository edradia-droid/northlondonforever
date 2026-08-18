/* Arsenal Treasure Room — homepage interactions */
document.addEventListener("DOMContentLoaded", () => {

  /* Mobile navigation */
  const toggle = document.getElementById("menuToggle");
  const menu = document.getElementById("siteMenu");

  if (toggle && menu) {
    toggle.addEventListener("click", () => {
      const open = menu.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
    });

    menu.querySelectorAll("a").forEach(link => {
      link.addEventListener("click", () => {
        menu.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* Reveal elements as they enter the screen */
  const revealItems = document.querySelectorAll(".reveal");

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });

    revealItems.forEach(item => observer.observe(item));
  } else {
    revealItems.forEach(item => item.classList.add("visible"));
  }

  /* Timeline modal */
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
      modalTitle.textContent = item.dataset.title || "Arsenal Moment";
      modalText.textContent = item.dataset.text || "";
      modal.classList.add("open");
      modal.setAttribute("aria-hidden", "false");
    });
  });

  modalClose?.addEventListener("click", closeModal);

  modal?.addEventListener("click", event => {
    if (event.target === modal) closeModal();
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeModal();
  });

  /* Did-you-know carousel */
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

    factTitle.style.opacity = "0";
    factText.style.opacity = "0";

    setTimeout(() => {
      factTitle.textContent = fact.title;
      factText.textContent = fact.text;
      factTitle.style.opacity = "1";
      factText.style.opacity = "1";
    }, 160);
  });

  /* Treasure progress.
     Uses the existing trophy-viewing localStorage key if present.
     Falls back gracefully to 0/4 on the homepage. */
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
      /* Keep the safe default of 0/4. */
    }

    progressText.textContent = `${count} / 4`;
    progressFill.style.width = `${(count / 4) * 100}%`;
  }

  updateVaultProgress();

  /* If another page updates the same storage, refresh when returning here. */
  window.addEventListener("storage", updateVaultProgress);
  window.addEventListener("pageshow", updateVaultProgress);
});

const header=document.querySelector(".topbar");const btn=document.getElementById("menuBtn");const nav=document.getElementById("nav");window.addEventListener("scroll",()=>header.classList.toggle("scrolled",scrollY>30));btn?.addEventListener("click",()=>nav.classList.toggle("open"));nav?.querySelectorAll("a").forEach(a=>a.addEventListener("click",()=>nav.classList.remove("open")));

/* HOME DASHBOARD */
const sidebar = document.getElementById("sidebar");
const overlay = document.getElementById("overlay");
const menuBtn = document.getElementById("menuBtn");
const closeMenu = document.getElementById("closeMenu");

function openMenu(){sidebar.classList.add("open");overlay.classList.add("show")}
function closeSidebar(){sidebar.classList.remove("open");overlay.classList.remove("show")}

menuBtn?.addEventListener("click", openMenu);
closeMenu?.addEventListener("click", closeSidebar);
overlay?.addEventListener("click", closeSidebar);

document.querySelectorAll(".nav-link, .treasure-link").forEach(link=>{
  link.addEventListener("click", closeSidebar);
});

const sections = document.querySelectorAll("main section[id]");
const navLinks = document.querySelectorAll(".nav-link");

const observer = new IntersectionObserver(entries=>{
  entries.forEach(entry=>{
    if(entry.isIntersecting){
      navLinks.forEach(link=>link.classList.remove("active"));
      const active=document.querySelector(`.nav-link[href="#${entry.target.id}"]`);
      if(active) active.classList.add("active");
    }
  });
},{rootMargin:"-35% 0px -55% 0px"});

sections.forEach(section=>observer.observe(section));
