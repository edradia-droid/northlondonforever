// ==========================================
// Arsenal Website JavaScript
// Works on every page
// ==========================================

document.addEventListener("DOMContentLoaded", () => {

    // ==========================================
    // Treasure Chest
    // ==========================================

    const chest = document.getElementById("chest");
    const openButton = document.getElementById("openChest");
    const coinContainer = document.getElementById("coinContainer");
    const sparkleContainer = document.getElementById("sparkleContainer");
    const chestSound = document.getElementById("chestSound");
    const coinSound = document.getElementById("coinSound");

    if (chest && openButton) {

        let chestOpened = false;

        function openChest() {

            if (chestOpened) return;

            chestOpened = true;

            chest.classList.add("opened");

            try {
                chestSound?.play();
                coinSound?.play();
            } catch (e) {}

            createCoins();
            createSparkles();
            createConfetti();
        }

        chest.addEventListener("click", openChest);
        openButton.addEventListener("click", openChest);

        // ================= Coins =================

        function createCoins() {

            setInterval(() => {

                const coin = document.createElement("div");
                coin.className = "coin";
                coinContainer.appendChild(coin);

                const rect = chest.getBoundingClientRect();

                let x = rect.left + rect.width / 2;
                let y = rect.top + rect.height / 2;

                let vx = Math.random() * 16 - 8;
                let vy = -(Math.random() * 18 + 18);

                let rotation = 0;
                let spin = Math.random() * 20 - 10;

                const gravity = 0.7;
                const floor = window.innerHeight - 90;

                function animate() {

                    x += vx;
                    y += vy;

                    vy += gravity;

                    rotation += spin;

                    if (y > floor) {

                        y = floor;
                        vy *= -0.45;

                        if (Math.abs(vy) < 2) {
                            coin.remove();
                            return;
                        }

                    }

                    coin.style.left = x + "px";
                    coin.style.top = y + "px";
                    coin.style.transform = `rotate(${rotation}deg)`;

                    requestAnimationFrame(animate);

                }

                animate();

            }, 40);

        }

        // ================= Sparkles =================

        // ================= Falling Sparkles =================

function createSparkles() {

    if (!sparkleContainer) return;

    const trophy = document.querySelector(".first-division14");

    if (!trophy) return;

    setInterval(() => {

        // Get the trophy position every time
        const rect = trophy.getBoundingClientRect();

        const sparkle = document.createElement("div");
        sparkle.className = "sparkle";

        sparkle.style.left =
            window.scrollX +
            rect.left +
            rect.width / 2 +
            (Math.random() * 250 - 125) + "px";

        sparkle.style.top =
            window.scrollY +
            rect.top +
            30 + "px";

        sparkleContainer.appendChild(sparkle);

        setTimeout(() => sparkle.remove(), 6000);

    }, 80);

}
        // ================= Confetti =================

        function createConfetti() {

            for (let i = 0; i < 150; i++) {

                const piece = document.createElement("div");

                piece.className = "confetti";

                piece.style.left = Math.random() * window.innerWidth + "px";

                document.body.appendChild(piece);

                setTimeout(() => piece.remove(), 5000);

            }

        }

    }

    // ==========================================
    // Trophy Popup
    // ==========================================

    const popup = document.getElementById("popup");
    const popupTitle = document.getElementById("popupTitle");
    const popupText = document.getElementById("popupText");
    const closePopup = document.querySelector("#popup .close");

    const trophies = document.querySelectorAll(".trophy-card");

    if (popup && trophies.length) {

        const trophyInfo = {
            "English First Division 1930-1931": "Dominated the league, finishing 7 points clear of Aston Villa, with 66 points haven played 42 matches. Won at Highbury under Herbert Chapman in 1930–31.",   
            "English First Division 1932-1933": "Won the title by 4 points over Aston Villa. with 58 points haven played 42 matches. Won at Highbury under Herbert Chapman in 1932–33.",
            "English First Division 1933-1934": "Retained the title by 4 points. total of 59 points haven played 42 matches. Won at Highbury under George Allison (after Chapman's death) in 1933–34.",
            "English First Division 1934-1935": "Won by a huge 6-point margin. total of 58 points haven played 42 matches. Won at Highbury under George Allison in 1934–35.",
            "English First Division 1937-1938": "Clinched the title on the final day. With a total of 52 points haven played 42 matches. Won at Highbury under George Allison in 1937–38.",
            "English First Division 1947-1948": "First league title after World War II. With a total of 59 points haven played 42 matches. Won at Highbury under Tom Whittaker in 1947–48.",
            "English First Division 1952-1953": "Won the title on goal average, finishing level on points with Preston North End. With a total of 54 points haven played 42 matches. Won at Highbury under Tom Whittaker in 1952-53.",
            "English First Division 1970-1971": "Beat Tottenham 1–0 away to complete the famous League and FA Cup Double. With a total of 65 points haven played 42 matches. Won at White Hart Lane under Tom Bertie Mee in 1970-71.",
            "English First Division 1988-1989": "Won the title in dramatic fashion by beating Liverpool 2–0 at Anfield with Michael Thomas scoring in stoppage time. With a total of 76 points haven played 38 matches. Won at Anfield under George Graham Mee in 1988-89.",
            "English First Division 1990-1991": "Lost only one league game all season and comfortably won the title. With a total of 83 points haven played 38 matches. Won at Highbury under George Graham Mee in 1990-91.",
            "English First Division 1997-1998": "Beat Everton 4–0 after overturning an 11-point deficit to Manchester United in Arsène Wenger's first full season. With two games remaining, a total of 78 points. haven played 36 of 38 matches. Won at Highbury under Arsène Wenger in 1997-98.",
            "English First Division 2001–2002": "Beat Manchester United 1–0 thanks to Sylvain Wiltord's goal to complete the League and FA Cup Double. With one game remaining, a total of 87 points. haven played 37 of 38 matches. Won at Old Trafford  under Arsène Wenger in 2001–02.",
             "English First Division 2003–04 – The Invincibles": "Drew 2–2 with Tottenham to secure the title while remaining unbeaten for the entire season (26 wins, 12 draws, 0 defeats). With four games remaining, a total of 90 points. haven played 34 of 38 matches. Won at White Hart Lane under Arsène Wenger in 2003–04.",
             "English First Division 2025-2026": "Arsenal were crowned champions after Manchester City drew 1–1 with AFC Bournemouth, meaning City could no longer catch Mikel Arteta's side. Arsenal had built an unassailable lead before the final matchday through a strong finish to the season. With one game remaining, a total of 85 points. Won at Vitality Stadium (where AFC Bournemouth hosted Manchester City). Arsenal officially lifted the trophy after their final-day 2–1 win at Selhurst Park against Crystal Palace under Mikel Arteta in 2025-26.",
            // ==========================================
           // FA cup section
          // ==========================================
             "FA cup 1929–1930": "Arsenal won their first-ever FA Cup under Herbert Chapman. Goals from Alex James and Jack Lambert secured a comfortable victory at Wembley.",
             "FA cup 1935–1936": "Arsenal 1–0 Sheffield United. Ted Drake scored the only goal in a tight final, giving Arsenal their second FA Cup despite an inconsistent league season. under George Allison",
             "FA cup 1949–1950": "Arsenal 2–0 Liverpool	Reg Lewis struck twice, giving Arsenal a deserved victory and their third FA Cup with Tom Whittaker as head coach.",
             "FA cup 1970–1971": "Arsenal 2–1 Liverpool (AET)	After Liverpool equalised, Charlie George's famous extra-time winner completed Arsenal's historic League and FA Cup Double under Bertie Mee",
             "FA cup 1978–1979": "Head coach Terry Neill lead Arsenal to a 3–2 win over Manchester United.	The legendary Five-Minute Final saw Arsenal throw away a 2–0 lead before Alan Sunderland scored the dramatic winning goal in the closing seconds.",
             "FA cup 1992–1993": "Arsenal 2–1 Sheffield Wednesday (Replay)	Following a 1–1 draw, Andy Linighan headed the extra-time winner in the replay as Arsenal completed a historic domestic cup double, under head coach George Graham.",
             "FA cup 1997–1998": "Arsenal 2–0 Newcastle United	Goals from Marc Overmars and Nicolas Anelka secured Wenger's first FA Cup and completed another League and Cup Double.",
             "FA cup 1935–1936": "Arsenal 1–0 Sheffield United. Ted Drake scored the only goal in a tight final, giving Arsenal their second FA Cup despite an inconsistent league season. under George Allison",
             "FA cup 1935–1936": "Arsenal 1–0 Sheffield United. Ted Drake scored the only goal in a tight final, giving Arsenal their second FA Cup despite an inconsistent league season. under George Allison",
             "FA cup 1935–1936": "Arsenal 1–0 Sheffield United. Ted Drake scored the only goal in a tight final, giving Arsenal their second FA Cup despite an inconsistent league season. under George Allison",
             "FA cup 1935–1936": "Arsenal 1–0 Sheffield United. Ted Drake scored the only goal in a tight final, giving Arsenal their second FA Cup despite an inconsistent league season. under George Allison",
             "FA cup 1935–1936": "Arsenal 1–0 Sheffield United. Ted Drake scored the only goal in a tight final, giving Arsenal their second FA Cup despite an inconsistent league season. under George Allison",
             "FA cup 1935–1936": "Arsenal 1–0 Sheffield United. Ted Drake scored the only goal in a tight final, giving Arsenal their second FA Cup despite an inconsistent league season. under George Allison",
             "FA cup 1935–1936": "Arsenal 1–0 Sheffield United. Ted Drake scored the only goal in a tight final, giving Arsenal their second FA Cup despite an inconsistent league season. under George Allison",
             "FA cup 1935–1936": "Arsenal 1–0 Sheffield United. Ted Drake scored the only goal in a tight final, giving Arsenal their second FA Cup despite an inconsistent league season. under George Allison",
             "FA cup 1935–1936": "Arsenal 1–0 Sheffield United. Ted Drake scored the only goal in a tight final, giving Arsenal their second FA Cup despite an inconsistent league season. under George Allison",
            
        };

        trophies.forEach(card => {

            card.addEventListener("click", () => {

                const title = card.dataset.title;

                popupTitle.textContent = title;
                popupText.textContent = trophyInfo[title];

                popup.style.display = "flex";

            });

        });

        closePopup.addEventListener("click", () => {

            popup.style.display = "none";

        });

        popup.addEventListener("click", (e) => {

            if (e.target === popup) {

                popup.style.display = "none";

            }

        });

    }

    // ==========================================
    // Keyboard Player
    // ==========================================

    const player = document.getElementById("player");

    if (player) {

        let playerX = window.innerWidth / 2;

        document.addEventListener("keydown", (e) => {

            if (e.key === "ArrowLeft" || e.key === "a")
                playerX -= 20;

            if (e.key === "ArrowRight" || e.key === "d")
                playerX += 20;

            player.style.left = playerX + "px";

        });

    }

    // ==========================================
// Player Stats Popups
// ==========================================

const playerCards = document.querySelectorAll(".cliff");

playerCards.forEach(card => {

    const openBtn = card.querySelector(".openBtn");
    const playerPopup = card.querySelector(".popup");
    const closeBtn = card.querySelector(".close");

    if (!openBtn || !playerPopup || !closeBtn) return;


openBtn.addEventListener("click", (e) => {

    e.stopPropagation();

    playerPopup.style.display = "flex";


    // Automatically close after 3 seconds
    setTimeout(() => {

        playerPopup.style.display = "none";

    }, 3000);

});




closeBtn.addEventListener("click", (e) => {

    e.stopPropagation();

    playerPopup.style.display = "none";

});


playerPopup.addEventListener("click", (e) => {

    if (e.target === playerPopup) {

        playerPopup.style.display = "none";

    }

});


document.addEventListener("keydown", (e) => {

    if (e.key === "Escape") {

        playerPopup.style.display = "none";

    }

});


    // Close with Escape key
       document.addEventListener("keydown", (e) => {

        if (e.key === "Escape") {

            popup.style.display = "none";

        }

    });

}); // closes playerCards.forEach

}); // closes DOMContentLoaded