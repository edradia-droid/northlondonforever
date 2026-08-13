// ==========================================
// Arsenal Trophy Collection JavaScript
// Restores the original Treasure Room interactions
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
    // ---------------- Shared Treasure Room sidebar ----------------
    const sidebar = document.getElementById("sidebar");
    const menuBtn = document.getElementById("menuBtn");
    const closeMenu = document.getElementById("closeMenu");
    const overlay = document.getElementById("overlay");

    const openSidebar = () => {
        if (!sidebar) return;
        sidebar.classList.add("open");
        overlay?.classList.add("show");
        menuBtn?.setAttribute("aria-expanded", "true");
    };
    const closeSidebar = () => {
        sidebar?.classList.remove("open");
        overlay?.classList.remove("show");
        menuBtn?.setAttribute("aria-expanded", "false");
    };
    menuBtn?.addEventListener("click", openSidebar);
    closeMenu?.addEventListener("click", closeSidebar);
    overlay?.addEventListener("click", closeSidebar);
    document.querySelectorAll("#sideNav a").forEach(link => link.addEventListener("click", closeSidebar));

    const chest = document.getElementById("chest");
    const openButton = document.getElementById("openChest");
    const coinContainer = document.getElementById("coinContainer");
    const sparkleContainer = document.getElementById("sparkleContainer");
    const chestSound = document.getElementById("chestSound");
    const coinSound = document.getElementById("coinSound");
    const popup = document.getElementById("popup");
    const popupTitle = document.getElementById("popupTitle");
    const popupText = document.getElementById("popupText");
    const closePopup = document.querySelector("#popup .close");
    const trophies = [...document.querySelectorAll(".trophy-card")];

    function ensureTrophyStatus(card) {
        let status = card.querySelector(".trophy-status");

        if (!status) {
            status = document.createElement("span");
            status.className = "trophy-status";
            status.setAttribute("aria-hidden", "true");
            card.appendChild(status);
        }

        const viewed = card.classList.contains("seen");
        status.textContent = viewed ? "✓" : "☐";
        card.setAttribute("aria-label",
            `${card.dataset.title || "Arsenal trophy"} — ${viewed ? "viewed" : "not viewed"}`
        );
    }

    trophies.forEach(ensureTrophyStatus);

    const score = document.getElementById("score");
    const resetTrophyProgress = document.getElementById("resetTrophyProgress");
    const secretDoor = document.querySelector(".secret-door");
    const closeSecretDoor = document.getElementById("closeSecretDoor");
    const closeSecretDoorBtn = document.getElementById("closeSecretDoorBtn");
    const player = document.getElementById("player");

    // ---------------- Trophy information ----------------
    const trophyInfo = {
        "English First Division 1930-1931": "Dominated the league, finishing seven points clear of Aston Villa with 66 points from 42 matches. Arsenal won the title under Herbert Chapman in 1930–31.",
        "English First Division 1932-1933": "Arsenal won the title by four points over Aston Villa, finishing with 58 points from 42 matches under Herbert Chapman in 1932–33.",
        "English First Division 1933-1934": "Arsenal retained the title by four points with 59 points from 42 matches. George Allison completed the campaign after Herbert Chapman's death.",
        "English First Division 1934-1935": "Arsenal completed a third consecutive league championship, winning by six points with 58 points from 42 matches under George Allison.",
        "English First Division 1937-1938": "Arsenal clinched the championship on the final day, finishing with 52 points from 42 matches under George Allison.",
        "English First Division 1947-1948": "Arsenal won their first league title after World War II, collecting 59 points from 42 matches under Tom Whittaker.",
        "English First Division 1952-1953": "Arsenal won the title on goal average after finishing level on points with Preston North End. They collected 54 points from 42 matches under Tom Whittaker.",
        "English First Division 1970-1971": "Arsenal beat Tottenham 1–0 away to secure the league title before completing the famous League and FA Cup Double under Bertie Mee.",
        "English First Division 1988-1989": "Arsenal won the title dramatically at Anfield, beating Liverpool 2–0 with Michael Thomas scoring the decisive late goal under George Graham.",
        "English First Division 1990-1991": "Arsenal lost only one league game all season and won the title with 83 points under George Graham.",

// ---------------- PREMIER LEAGUE SECTION ----------------

        "English premier league 1997-1998": "Arsenal beat Everton 4–0 at Highbury to seal Arsène Wenger's first league title in his first full season, completing the Double shortly afterward.",
        "English premier league 2001–2002": "Sylvain Wiltord's goal at Old Trafford secured a 1–0 win over Manchester United and the league title as Arsenal completed another League and FA Cup Double.",
        "English premier league 2003–04 – The Invincibles": "Arsenal secured the title at White Hart Lane and completed the entire league season unbeaten: 26 wins, 12 draws and 0 defeats.",
        "English premier league 2025-2026": "After 22 long years without a Premier League title, and three consecutive runners-up finishes, Mikel Arteta’s Arsenal finally turned years of rebuilding and heartbreak into glory in the 2025–26 season.",

 // ---------------- FA CUP SECTION ----------------

        "FA cup 1929–1930": "Arsenal won their first-ever FA Cup under Herbert Chapman. Goals from Alex James and Jack Lambert secured victory at Wembley.",
        "FA cup 1935–1936": "Arsenal beat Sheffield United 1–0. Ted Drake scored the only goal as George Allison's side lifted the FA Cup.",
        "FA cup 1949–1950": "Arsenal beat Liverpool 2–0, with Reg Lewis scoring twice, to win the FA Cup under Tom Whittaker.",
        "FA cup 1970–1971": "Arsenal beat Liverpool 2–1 after extra time. Charlie George's winner completed the historic League and FA Cup Double under Bertie Mee.",
        "FA cup 1978–1979": "Arsenal beat Manchester United 3–2 in the famous Five-Minute Final, with Alan Sunderland scoring the dramatic late winner under Terry Neill.",
        "FA cup 1992–1993": "Arsenal beat Sheffield Wednesday 2–1 in the replay after extra time. Andy Linighan's header completed a historic domestic cup double under George Graham.",
        "FA cup 1997–1998": "Arsenal beat Newcastle United 2–0 through goals from Marc Overmars and Nicolas Anelka, completing Arsène Wenger's first League and FA Cup Double.",
        "FA cup 2001–2002": "Arsenal 2–0 Chelsea.	Spectacular goals by Ray Parlour and Freddie Ljungberg sealed victory and another League and FA Cup Double led by Arsène Wenger.",
        "FA cup 2002–2003": "Arsenal 1–0 Southampton.	Robert Pirès scored the only goal as Arsenal successfully defended the FA Cup",
        "FA cup 2004–2005": "Arsenal 0–0 Manchester United (5–4 pens).	After surviving heavy pressure, Arsenal won their first FA Cup on penalties, with Patrick Vieira scoring the decisive kick.)  ",
        "FA cup 2013–2014": "Arsenal 3–2 Hull City (AET).	Arsenal recovered from 2–0 down through Santi Cazorla, Laurent Koscielny, and Aaron Ramsey, ending a nine-year trophy drought, during Arsène Wenger's tenure.",
        "FA cup 2014–2015": "Arsenal produced a dominant display with goals from Theo Walcott, Alexis Sánchez, Per Arsenal 4–0 Aston Villa Mertesacker, and Olivier Giroud)",
        "FA cup 2016–2017": "Arsenal 2–1 Chelsea.	Alexis Sánchez opened the scoring before Aaron Ramsey headed the winner, giving Wenger a record seventh FA Cup as manager)",
        "FA cup 2019–2020": "Arsenal 2–1 Chelsea.	After falling behind early, Pierre-Emerick Aubameyang scored twice to complete the comeback and give Arteta his first trophy as Arsenal manager)",
        
        // ---------------- ENGLISH LEAGUE CUP ----------------

         "English league cup 1986–1987": "Arsenal faced defending league champions Liverpool in the final. Ian Rush put Liverpool ahead, but Charlie Nicholas equalised before half-time. Nicholas struck again late in the second half to complete a 2–1 comeback victory, giving George Graham his first major trophy as Arsenal manager, at the Wembley Stadium, London",
         "English league cup 1992–1993": "Arsenal met Sheffield Wednesday in the final at the Wembley Stadium, London and again had to come from behind. John Harkes gave Wednesday the lead before Paul Merson equalised, and Steve Morrow scored the winning goal as Arsenal won 2–1. Arsenal subsequently won the FA Cup as well, becoming the first English club to complete the FA Cup–League Cup double in the same season.",



         // ---------------- COMMUNITY SHIELD ----------------

         "Community shield 1930": "Arsenal 2–1 Sheffield Wednesday. Arsenal entered as FA Cup holders and defeated the league champions to win their first Charity Shield UNDER Herbert Chapman at the Stamford Bridge, London.",
         "Community shield 1931": "Arsenal 1–0 West Bromwich Albion. Cliff Bastin scored the decisive goal as Arsenal retained the Shield under Herbert Chapman at the Villa Park, Birmingham.",
         "Community shield 1933": "Arsenal 3–0 Everton. Arsenal comfortably defeated the FA Cup holders to collect their third Shield atGoodison Park, Liverpool under Herbert Chapman.",
         "Community shield 1934": "Arsenal 4–0 Manchester City. The Gunners produced a dominant display against the FA Cup winners.	Highbury, London under George Allison.",
         "Community shield 1938": "Arsenal 2–1 Preston North End. The reigning First Division champions defeated the FA Cup holders.	Highbury, London under George Allison.",
         "Community shield 1948": "Arsenal 4–3 Manchester United. Arsenal edged a seven-goal thriller against the FA Cup holders.	Highbury, London under Tom Whittaker.",
         "Community shield 1953": "Arsenal 3–1 Blackpool. The First Division champions defeated the famous FA Cup-winning Blackpool side.	Highbury, London under Tom Whittaker.",
         "Community shield 1991": "Arsenal 0–0 Tottenham Hotspur. With no penalty shootout under the rules of the time, the Shield was shared by the North London rivals.	Wembley Stadium, London under George Graham.",
         "Community shield 1998": "Arsenal 3–0 Manchester United. Goals from Marc Overmars, Christopher Wreh and Nicolas Anelka secured a convincing victory.	Wembley Stadium, London under Arsène Wenger.",
         "Community shield 1999": "Arsenal 2–1 Manchester United. Nwankwo Kanu and Ray Parlour overturned United's lead.	Wembley Stadium, London under Arsène Wenger.",
         "Community shield 2002": "Arsenal 1–0 Liverpool. New signing Gilberto Silva scored the winner on his competitive Arsenal debut.	Millennium Stadium, Cardiff under Arsène Wenger.",
         "Community shield 2004": "Arsenal 3–1 Manchester United. The Invincibles followed their unbeaten league campaign by defeating United to take the Shield.	Millennium Stadium, Cardiff under Arsène Wenger.", 
         "Community shield 2014": "Arsenal 3–0 Manchester City. Santi Cazorla, Aaron Ramsey and Olivier Giroud scored in a dominant Wembley performance.	Wembley Stadium, London under Arsène Wenger.",
         "Community shield 2015": "Arsenal 1–0 Chelsea. Alex Oxlade-Chamberlain scored the only goal as Arsenal successfully defended the Shield.	Wembley Stadium, London under Arsène Wenger.",
         "Community shield 2017": "Arsenal 1–1 Chelsea, winning 4–1 on penalties after Sead Kolašinac's equaliser.	Wembley Stadium, London under Arsène Wenger.", 
         "Community shield 2020": "Arsenal 1–1 Liverpool, winning 5–4 on penalties. Pierre-Emerick Aubameyang scored during the match and converted the decisive penalty.	Wembley Stadium, London under Mikel Arteta.",
         "Community shield 2023": "Arsenal 1–1 Manchester City, winning 4–1 on penalties after Leandro Trossard's dramatic late equaliser. Fábio Vieira converted the winning penalty.	Wembley Stadium, London under Mikel Arteta.",

         // ---------------- EUROPEAN TROPHIS ----------------

         "European trophies 1969–1970": "An Inter-Cities Fairs Cup, Arsenal lost the first leg of the final 3–1 away to Anderlecht but produced a famous comeback at Highbury, winning the second leg 3–0 to take the trophy 4–3 on aggregate. During Bertie Mee's tenure, Arsenal became the first English club to win a European trophy.", 
         "European trophies 1993–1994": "European Cup Winners’ Cup, Arsenal defeated defending champions Parma 1–0 in the final. Alan Smith scored the decisive goal in the 20th minute, while Arsenal's defence protected the lead to secure the trophy. During George Graham's tenure, Arsenal became the first English club to win the European Cup Winners’ Cup twice.",


    };

    // ---------------- Trophy popups + progress ----------------
    const STORAGE_KEY = "arsenal-trophy-collection-seen";
    let seen = new Set();
    try {
        seen = new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"));
    } catch (_) {}

    const TOTAL_TROPHIES = 49;
    let secretVaultDismissed = false;

    function closeSecretVaultPanel() {
        if (!secretDoor) return;
        secretDoor.classList.remove("show");
        secretDoor.setAttribute("aria-hidden", "true");
        secretVaultDismissed = true;
    }

    function updateProgress() {
        const count = Math.min(seen.size, TOTAL_TROPHIES);
        if (score) score.textContent = count;

        trophies.forEach(card => {
            if (seen.has(card.dataset.title)) card.classList.add("seen");
            else card.classList.remove("seen");
        });

        if (count >= TOTAL_TROPHIES && !secretVaultDismissed && secretDoor) {
            secretDoor.classList.add("show");
            secretDoor.setAttribute("aria-hidden", "false");
        }
    }

    trophies.forEach(card => {
        card.setAttribute("tabindex", "0");
        card.setAttribute("role", "button");

        const openCard = () => {
            const title = card.dataset.title || "Arsenal Trophy";
            if (popupTitle) popupTitle.textContent = title;
            if (popupText) popupText.textContent = trophyInfo[title] || "A treasured chapter in Arsenal history.";
            if (popup) popup.style.display = "flex";

            if (!seen.has(title)) {
                seen.add(title);
                try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...seen])); } catch (_) {}
                if (seen.size >= TOTAL_TROPHIES) secretVaultDismissed = false;
                updateProgress();
            }
        };

        card.addEventListener("click", openCard);
        card.addEventListener("keydown", e => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openCard();
            }
        });
    });

    function hidePopup() {
        if (popup) popup.style.display = "none";
    }
    closePopup?.addEventListener("click", hidePopup);
    popup?.addEventListener("click", e => { if (e.target === popup) hidePopup(); });
    document.addEventListener("keydown", e => {
        if (e.key === "Escape") {
            hidePopup();
            closeSecretVaultPanel();
        }
    });
    closeSecretDoor?.addEventListener("click", closeSecretVaultPanel);
    closeSecretDoorBtn?.addEventListener("click", closeSecretVaultPanel);
    resetTrophyProgress?.addEventListener("click", () => {
        const confirmed = window.confirm("Reset all trophy progress back to 0 / 49?");
        if (!confirmed) return;

        seen.clear();
        try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}

        secretVaultDismissed = true;
        if (secretDoor) {
            secretDoor.classList.remove("show");
            secretDoor.setAttribute("aria-hidden", "true");
        }

        trophies.forEach(card => {
            card.classList.remove("seen");
            ensureTrophyStatus(card);
        });
        if (score) score.textContent = "0";
        window.scrollTo({ top: 0, behavior: "smooth" });
    });

    updateProgress();

    // ---------------- Treasure chest ----------------
    if (chest && openButton) {
        let chestOpened = false;
        let coinTimer = null;
        let sparkleTimer = null;

        const safePlay = audio => {
            if (!audio) return;
            try {
                audio.currentTime = 0;
                const p = audio.play();
                if (p?.catch) p.catch(() => {});
            } catch (_) {}
        };

        function createCoins() {
            if (!coinContainer || coinTimer) return;
            let made = 0;
            coinTimer = setInterval(() => {
                if (made++ > 80) {
                    clearInterval(coinTimer);
                    coinTimer = null;
                    return;
                }
                const coin = document.createElement("div");
                coin.className = "coin";
                document.body.appendChild(coin);
                const rect = chest.getBoundingClientRect();
                let x = rect.left + rect.width / 2;
                let y = rect.top + rect.height / 2;
                let vx = Math.random() * 16 - 8;
                let vy = -(Math.random() * 18 + 18);
                let rotation = 0;
                const spin = Math.random() * 20 - 10;
                const gravity = 0.7;
                const floor = window.innerHeight - 35;

                function animate() {
                    x += vx;
                    y += vy;
                    vy += gravity;
                    rotation += spin;
                    if (y > floor) {
                        y = floor;
                        vy *= -0.45;
                        vx *= 0.88;
                        if (Math.abs(vy) < 2) {
                            coin.remove();
                            return;
                        }
                    }
                    coin.style.left = `${x}px`;
                    coin.style.top = `${y}px`;
                    coin.style.transform = `rotate(${rotation}deg)`;
                    requestAnimationFrame(animate);
                }
                animate();
            }, 45);
        }

        function createSparkles() {
            if (!sparkleContainer || sparkleTimer) return;
            let made = 0;
            sparkleTimer = setInterval(() => {
                if (made++ > 75) {
                    clearInterval(sparkleTimer);
                    sparkleTimer = null;
                    return;
                }
                const target = document.querySelector(".first-division14") || chest;
                const rect = target.getBoundingClientRect();
                const sparkle = document.createElement("div");
                sparkle.className = "sparkle";
                sparkle.style.left = `${rect.left + rect.width / 2 + (Math.random() * 260 - 130)}px`;
                sparkle.style.top = `${rect.top + Math.random() * Math.max(40, rect.height * .45)}px`;
                sparkleContainer.appendChild(sparkle);
                setTimeout(() => sparkle.remove(), 6200);
            }, 80);
        }

        function createConfetti() {
            for (let i = 0; i < 150; i++) {
                const piece = document.createElement("div");
                piece.className = "confetti";
                piece.style.left = `${Math.random() * window.innerWidth}px`;
                piece.style.top = "-20px";
                piece.style.animationDuration = `${2.8 + Math.random() * 2.2}s`;
                piece.style.background = ["#d50032", "#ffffff", "#ffd700"][Math.floor(Math.random() * 3)];
                document.body.appendChild(piece);
                setTimeout(() => piece.remove(), 5500);
            }
        }

        function openChest() {
            if (chestOpened) return;
            chestOpened = true;
            chest.classList.add("opened");
            openButton.textContent = "Treasure Opened";
            safePlay(chestSound);
            safePlay(coinSound);
            createCoins();
            createSparkles();
            createConfetti();
        }

        chest.addEventListener("click", openChest);
        openButton.addEventListener("click", openChest);
    }

    // ---------------- Keyboard player ----------------
    if (player) {
        let playerX = 50;
        player.style.left = `${playerX}%`;
        document.addEventListener("keydown", e => {
            if (!["ArrowLeft", "ArrowRight", "a", "d", "A", "D"].includes(e.key)) return;
            const left = e.key === "ArrowLeft" || e.key.toLowerCase() === "a";
            playerX += left ? -2 : 2;
            playerX = Math.max(4, Math.min(96, playerX));
            player.style.left = `${playerX}%`;
            player.classList.add("walking");
            clearTimeout(player._walkTimer);
            player._walkTimer = setTimeout(() => player.classList.remove("walking"), 180);
        });
    }
});

// Collection page shell: same responsive sidebar behavior as trophies.html.
document.addEventListener("DOMContentLoaded", () => {
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("overlay");
    const menuBtn = document.getElementById("menuBtn");
    const closeMenu = document.getElementById("closeMenu");
    if (!sidebar || !overlay || !menuBtn) return;

    const openSidebar = () => {
        sidebar.classList.add("open");
        overlay.classList.add("show");
        menuBtn.setAttribute("aria-expanded", "true");
    };
    const closeSidebar = () => {
        sidebar.classList.remove("open");
        overlay.classList.remove("show");
        menuBtn.setAttribute("aria-expanded", "false");
    };
    menuBtn.addEventListener("click", openSidebar);
    closeMenu?.addEventListener("click", closeSidebar);
    overlay.addEventListener("click", closeSidebar);
    window.addEventListener("keydown", e => { if (e.key === "Escape") closeSidebar(); });
});
