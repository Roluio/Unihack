
// ==========================================
// STUDYGRAM - LUCIDE NAVIGATION ICONS
// Home + Profile
// ==========================================

document.addEventListener("DOMContentLoaded", () => {

    const icons = {
        home: "house",
        profile: "user-round",
        posts: "folder-open",
        messages: "message-circle",
        notifications: "bell",
        search: "search",
        friends: "users-round"
    };

    function getSection(element) {
        const tab = element.dataset.tab;

        if (tab && icons[tab]) {
            return tab;
        }

        const href = element.getAttribute("href");

        if (!href) return null;

        const url = new URL(href, window.location.href);
        const path = url.pathname;
        const hash = url.hash.replace("#", "");

        if (path === "/home") return "home";
        if (path === "/library") return "posts";
        if (path === "/messages") return "messages";
        if (path === "/notifications") return "notifications";
        if (path === "/search") return "search";
        if (path === "/friends") return "friends";

        if (path === "/profile") {
            if (hash && icons[hash]) return hash;
            return "profile";
        }

        return null;
    }

    function applyIcons() {
        const navigationItems = document.querySelectorAll(
            ".navigation .nav-item"
        );

        navigationItems.forEach(item => {
            const section = getSection(item);
            if (!section) return;

            const iconContainer = item.querySelector(".nav-icon");
            if (!iconContainer) return;

            iconContainer.replaceChildren();

            const icon = document.createElement("i");
            icon.setAttribute("data-lucide", icons[section]);

            iconContainer.appendChild(icon);
        });

        // Consistent icon spacing and dimensions.
        const style = document.createElement("style");

        style.textContent = `
            .navigation .nav-icon {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 22px;
                height: 22px;
                flex-shrink: 0;
            }

            .navigation .nav-icon svg {
                width: 20px;
                height: 20px;
                stroke-width: 1.9;
            }

            .navigation .nav-item {
                display: flex;
                align-items: center;
                gap: 14px;
            }
        `;

        document.head.appendChild(style);

        window.lucide.createIcons();
    }

    // Load Lucide automatically if it isn't loaded.
    if (window.lucide) {
        applyIcons();
    } else {
        const script = document.createElement("script");
        script.src =
            "https://unpkg.com/lucide@0.468.0/dist/umd/lucide.min.js";

        script.onload = applyIcons;

        script.onerror = () => {
            console.error("Could not load Lucide Icons.");
        };

        document.head.appendChild(script);
    }

});
