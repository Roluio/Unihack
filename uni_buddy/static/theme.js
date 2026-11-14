/*
 * StudyGram - light / dark theme
 *
 * - The choice is stored in localStorage ("studygram-theme": "light" | "dark").
 * - It is applied immediately (script lives in <head>) to avoid a flash.
 * - All pages, including the iframes used by Library and Messages, read the
 *   same key, and the "storage" event keeps every open frame/tab in sync.
 */
(function () {
    "use strict";

    var KEY = "studygram-theme";
    var root = document.documentElement;

    function read() {
        try {
            var saved = localStorage.getItem(KEY);
            if (saved === "dark" || saved === "light") return saved;
        } catch (e) { /* storage blocked */ }
        return "light";
    }

    function apply(theme) {
        root.setAttribute("data-theme", theme);
        root.style.colorScheme = theme;

        var button = document.getElementById("sgThemeToggle");
        if (button) {
            button.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
            button.title = theme === "dark" ? "Light mode" : "Dark mode";
            button.setAttribute("aria-label", button.title);
        }
    }

    function set(theme) {
        try { localStorage.setItem(KEY, theme); } catch (e) { /* ignore */ }
        apply(theme);
    }

    function toggle() {
        set(root.getAttribute("data-theme") === "dark" ? "light" : "dark");
    }

    apply(read());

    window.addEventListener("storage", function (event) {
        if (event.key === KEY) apply(read());
    });

    window.StudyGramTheme = { set: set, toggle: toggle, get: read };

    var SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
    var MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';

    function buildButton() {
        var button = document.createElement("button");
        button.type = "button";
        button.id = "sgThemeToggle";
        button.className = "sg-theme-toggle";
        button.innerHTML = '<span class="sg-sun">' + SUN + '</span><span class="sg-moon">' + MOON + '</span>';
        button.addEventListener("click", toggle);
        return button;
    }

    function mount() {
        if (document.getElementById("sgThemeToggle")) return;

        // Pages embedded in an iframe (Library / Messages) use the parent's button.
        if (window.self !== window.top) return;

        var button = buildButton();

        var targets = [
            ".top-actions",        // home, profile, friends, notifications, search
            ".global-header",      // Library / Messages frame
            ".top-bar",            // login
            ".topbar"              // AI page
        ];

        for (var i = 0; i < targets.length; i++) {
            var host = document.querySelector(targets[i]);
            if (!host) continue;

            if (targets[i] === ".top-actions") {
                host.insertBefore(button, host.firstChild);
            } else if (targets[i] === ".global-header") {
                var logout = host.querySelector(".logout-button");
                if (logout && logout.parentNode) logout.parentNode.insertBefore(button, logout);
                else host.appendChild(button);
            } else if (targets[i] === ".top-bar") {
                var lang = host.querySelector(".language-dropdown");
                if (lang) host.insertBefore(button, lang);
                else host.appendChild(button);
            } else {
                var select = host.querySelector("#languageSelect");
                if (select && select.parentNode) select.parentNode.insertBefore(button, select);
                else host.appendChild(button);
            }
            apply(read());
            return;
        }

        // fallback: floating button
        button.classList.add("sg-floating");
        document.body.appendChild(button);
        apply(read());
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", mount);
    } else {
        mount();
    }
})();
