/*
 * StudyGram - shared client code: API calls, translations, small UI helpers.
 * Every page script uses window.App.
 */
(function () {
    "use strict";

    var LANG_KEY = "UniBuddyForumLanguage"; // also read by Buddy AI
    var I18N = window.I18N || { ro: {}, en: {} };
    var APP = window.APP || { user: {} };

    // ------------------------------------------------------------------
    // Language
    // ------------------------------------------------------------------

    function readLang() {
        try {
            var saved = localStorage.getItem(LANG_KEY);
            if (saved === "ro" || saved === "en") return saved;
        } catch (e) { /* storage blocked */ }
        return String(APP.user.preferredLanguage || "RO").toLowerCase() === "en" ? "en" : "ro";
    }

    var lang = readLang();

    function t(key, vars) {
        var text = (I18N[lang] && I18N[lang][key]);
        if (text === undefined) text = I18N.ro[key];
        if (text === undefined) text = key;
        if (vars) {
            text = text.replace(/\{(\w+)\}/g, function (m, name) {
                return vars[name] !== undefined ? vars[name] : m;
            });
        }
        return text;
    }

    function applyI18n(root) {
        root = root || document;
        root.querySelectorAll("[data-i18n]").forEach(function (el) { el.textContent = t(el.dataset.i18n); });
        root.querySelectorAll("[data-i18n-placeholder]").forEach(function (el) { el.placeholder = t(el.dataset.i18nPlaceholder); });
        root.querySelectorAll("[data-i18n-title]").forEach(function (el) {
            el.title = t(el.dataset.i18nTitle);
            el.setAttribute("aria-label", el.title);
        });
        document.documentElement.lang = lang;
    }

    function setLang(next, saveToServer) {
        if (next !== "ro" && next !== "en") return;
        lang = next;
        try { localStorage.setItem(LANG_KEY, next); } catch (e) { /* ignore */ }
        applyI18n();
        document.querySelectorAll(".lang-switch button").forEach(function (b) {
            b.classList.toggle("active", b.dataset.lang === next);
        });
        document.dispatchEvent(new CustomEvent("langchange", { detail: next }));
        if (saveToServer) {
            fetch("/api/profile/update", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ preferredLanguage: next.toUpperCase() })
            }).catch(function () { /* the preference is also stored locally */ });
        }
    }

    // ------------------------------------------------------------------
    // API
    // ------------------------------------------------------------------

    function ApiError(message, status, data) {
        this.name = "ApiError";
        this.message = message;
        this.status = status;
        this.data = data;
    }
    ApiError.prototype = Object.create(Error.prototype);

    function api(path, options) {
        options = options || {};
        var init = { method: options.method || "GET", headers: {}, credentials: "same-origin", signal: options.signal };

        if (options.form) {
            init.body = options.form;
        } else if (options.body !== undefined) {
            init.headers["Content-Type"] = "application/json";
            init.body = JSON.stringify(options.body);
        }

        return fetch(path, init).then(function (response) {
            if (response.status === 401) {
                window.location.href = "/";
                throw new ApiError("Unauthorized", 401);
            }
            var type = response.headers.get("Content-Type") || "";
            var parse = type.indexOf("json") !== -1 ? response.json().catch(function () { return null; }) : Promise.resolve(null);
            return parse.then(function (data) {
                if (!response.ok) {
                    var message = data && (data.message || firstValidation(data));
                    if (response.status === 413) message = t("err.tooLarge");
                    throw new ApiError(message || t("err.generic"), response.status, data);
                }
                return data;
            });
        }, function (error) {
            if (error && error.name === "AbortError") throw error;
            throw new ApiError(t("err.network"), 0);
        });
    }

    function firstValidation(data) {
        var errors = data && data.validationErrors;
        if (errors && typeof errors === "object") {
            var keys = Object.keys(errors);
            if (keys.length) return errors[keys[0]];
        }
        return null;
    }

    // ------------------------------------------------------------------
    // DOM helpers
    // ------------------------------------------------------------------

    function h(tag, props) {
        var el = document.createElement(tag);
        props = props || {};
        Object.keys(props).forEach(function (key) {
            var value = props[key];
            if (value === undefined || value === null || value === false) return;
            if (key === "class") el.className = value;
            else if (key === "text") el.textContent = value;
            else if (key === "style" && typeof value === "object") Object.assign(el.style, value);
            else if (key === "dataset") Object.assign(el.dataset, value);
            else if (key.slice(0, 2) === "on" && typeof value === "function") el.addEventListener(key.slice(2).toLowerCase(), value);
            else if (value === true) el.setAttribute(key, "");
            else el.setAttribute(key, value);
        });
        for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
        return el;
    }

    function append(parent, child) {
        if (child === undefined || child === null || child === false) return;
        if (Array.isArray(child)) { child.forEach(function (c) { append(parent, c); }); return; }
        parent.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
    }

    function icon(name, cls) {
        return h("i", { "data-lucide": name, class: cls || "" });
    }

    function refreshIcons() {
        if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
    }

    function clear(el) {
        while (el.firstChild) el.removeChild(el.firstChild);
        return el;
    }

    function hue(text) {
        var hash = 0;
        for (var i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
        return hash % 360;
    }

    function initialsOf(user) {
        var first = (user.firstName || "").trim();
        var last = (user.lastName || "").trim();
        var out = (first.slice(0, 1) + last.slice(0, 1)) || (user.username || "?").slice(0, 1);
        return out.toUpperCase();
    }

    function fullName(user) {
        if (!user) return "";
        return ((user.firstName || "") + " " + (user.lastName || "")).trim() || user.username || "";
    }

    function avatar(user, size) {
        var seed = (user && (user.username || user.id)) || "?";
        return h("span", {
            class: "avatar" + (size ? " " + size : ""),
            style: { background: "hsl(" + hue(String(seed)) + " 52% 46%)" },
            "aria-hidden": "true"
        }, initialsOf(user || {}));
    }

    var URL_PATTERN = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g;

    // Text with clickable links, built from DOM nodes (never innerHTML).
    function richText(text) {
        var fragment = document.createDocumentFragment();
        String(text).split(URL_PATTERN).forEach(function (part, index) {
            if (index % 2 === 1) {
                fragment.appendChild(h("a", { href: part, target: "_blank", rel: "noopener noreferrer nofollow", class: "text-link" }, part));
            } else if (part) {
                fragment.appendChild(document.createTextNode(part));
            }
        });
        return fragment;
    }

    // ------------------------------------------------------------------
    // Time and sizes
    // ------------------------------------------------------------------

    function locale() { return lang === "ro" ? "ro-RO" : "en-GB"; }

    function timeAgo(iso) {
        var date = new Date(iso);
        if (isNaN(date)) return "";
        var seconds = Math.max(0, (Date.now() - date.getTime()) / 1000);
        if (seconds < 45) return t("time.now");
        var minutes = Math.round(seconds / 60);
        if (minutes < 60) return t("time.min", { n: minutes });
        var hours = Math.round(minutes / 60);
        if (hours < 24) return t("time.hour", { n: hours });
        var days = Math.round(hours / 24);
        if (days === 1) return t("time.yesterday");
        if (days < 7) return t("time.days", { n: days });
        var sameYear = date.getFullYear() === new Date().getFullYear();
        return date.toLocaleDateString(locale(), sameYear
            ? { day: "numeric", month: "short" }
            : { day: "numeric", month: "short", year: "numeric" });
    }

    function fullDate(iso) {
        var date = new Date(iso);
        if (isNaN(date)) return "";
        return date.toLocaleString(locale(), { dateStyle: "medium", timeStyle: "short" });
    }

    function clock(iso) {
        var date = new Date(iso);
        return isNaN(date) ? "" : date.toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" });
    }

    function dayLabel(iso) {
        var date = new Date(iso);
        var today = new Date();
        var yesterday = new Date(Date.now() - 86400000);
        if (date.toDateString() === today.toDateString()) return t("time.today");
        if (date.toDateString() === yesterday.toDateString()) return t("time.yesterdayCap");
        return date.toLocaleDateString(locale(), { weekday: "long", day: "numeric", month: "long" });
    }

    function formatSize(bytes) {
        bytes = Number(bytes) || 0;
        if (bytes < 1024) return bytes + " B";
        var units = ["KB", "MB", "GB"];
        var value = bytes / 1024;
        var i = 0;
        while (value >= 1024 && i < units.length - 1) { value /= 1024; i++; }
        return (value >= 10 || i === 0 ? Math.round(value) : value.toFixed(1)) + " " + units[i];
    }

    function debounce(fn, wait) {
        var timer;
        return function () {
            var args = arguments, self = this;
            clearTimeout(timer);
            timer = setTimeout(function () { fn.apply(self, args); }, wait);
        };
    }

    // ------------------------------------------------------------------
    // Toast, modal, menu
    // ------------------------------------------------------------------

    function toast(message, type) {
        var host = document.getElementById("toasts");
        if (!host) return;
        var el = h("div", { class: "toast" + (type ? " " + type : ""), role: "status" }, message);
        host.appendChild(el);
        setTimeout(function () { el.remove(); }, type === "error" ? 5000 : 3200);
    }

    // options: { title, body: Node, actions: [{label, kind, onClick, close}], size, onClose }
    function modal(options) {
        var backdrop = h("div", { class: "modal-backdrop" });
        var closed = false;

        function close() {
            if (closed) return;
            closed = true;
            backdrop.remove();
            document.removeEventListener("keydown", onKey);
            if (options.onClose) options.onClose();
        }

        function onKey(event) {
            if (event.key === "Escape") close();
        }

        var closeButton = h("button", { class: "icon-btn sm", type: "button", "aria-label": t("common.close"), onclick: close }, icon("x"));
        var head = h("div", { class: "modal-head" }, h("h2", {}, options.title || ""), closeButton);
        var body = h("div", { class: "modal-body" }, options.body);
        var box = h("div", { class: "modal" + (options.size ? " " + options.size : ""), role: "dialog", "aria-modal": "true" }, head, body);

        var buttons = {};
        if (options.actions && options.actions.length) {
            var foot = h("div", { class: "modal-foot" });
            options.actions.forEach(function (action, index) {
                var button = h("button", {
                    type: "button",
                    class: "btn " + (action.kind || "btn-secondary"),
                    onclick: function () {
                        var result = action.onClick ? action.onClick(api_) : undefined;
                        if (action.close !== false && result !== false) close();
                    }
                }, action.label);
                buttons[action.id || index] = button;
                foot.appendChild(button);
            });
            box.appendChild(foot);
        }

        var api_ = { close: close, el: box, body: body, buttons: buttons };

        backdrop.appendChild(box);
        backdrop.addEventListener("mousedown", function (event) { if (event.target === backdrop) close(); });
        document.addEventListener("keydown", onKey);
        document.body.appendChild(backdrop);
        refreshIcons();

        var first = box.querySelector("input:not([type=hidden]), textarea, select");
        if (first && options.autofocus !== false) setTimeout(function () { first.focus(); }, 30);
        return api_;
    }

    function confirmDialog(options) {
        return new Promise(function (resolve) {
            var decided = false;
            function done(value) { if (!decided) { decided = true; resolve(value); } }
            modal({
                title: options.title || t("common.confirm"),
                size: "small",
                body: h("p", { class: "muted" }, options.message || ""),
                autofocus: false,
                onClose: function () { done(false); },
                actions: [
                    { label: t("common.cancel"), kind: "btn-secondary", onClick: function () { done(false); } },
                    { label: options.confirmText || t("common.confirm"), kind: options.danger ? "btn-danger" : "btn-primary", onClick: function () { done(true); } }
                ]
            });
        });
    }

    var openMenuEl = null;

    function closeMenu() {
        if (openMenuEl) { openMenuEl.remove(); openMenuEl = null; }
        document.removeEventListener("mousedown", onOutside, true);
        document.removeEventListener("keydown", onMenuKey, true);
        window.removeEventListener("blur", closeMenu);
    }
    function onOutside(event) { if (openMenuEl && !openMenuEl.contains(event.target)) closeMenu(); }
    function onMenuKey(event) { if (event.key === "Escape") closeMenu(); }

    // anchor: a MouseEvent (context menu) or an element. items: [{label, icon, danger, onClick} | "-"]
    function menu(anchor, items) {
        closeMenu();
        var el = h("div", { class: "menu", role: "menu" });
        items.forEach(function (item) {
            if (!item) return;
            if (item === "-") { el.appendChild(h("hr")); return; }
            el.appendChild(h("button", {
                type: "button",
                role: "menuitem",
                class: item.danger ? "danger" : "",
                onclick: function () { closeMenu(); item.onClick(); }
            }, item.icon ? icon(item.icon) : null, item.label));
        });
        document.body.appendChild(el);
        refreshIcons();

        var x, y;
        if (anchor && typeof anchor.clientX === "number") {
            x = anchor.clientX; y = anchor.clientY;
        } else {
            var rect = anchor.getBoundingClientRect();
            x = rect.right - el.offsetWidth; y = rect.bottom + 4;
        }
        x = Math.max(8, Math.min(x, window.innerWidth - el.offsetWidth - 8));
        y = Math.max(8, Math.min(y, window.innerHeight - el.offsetHeight - 8));
        el.style.left = x + "px";
        el.style.top = y + "px";

        openMenuEl = el;
        setTimeout(function () {
            document.addEventListener("mousedown", onOutside, true);
            document.addEventListener("keydown", onMenuKey, true);
            window.addEventListener("blur", closeMenu);
        }, 0);
        return el;
    }

    // ------------------------------------------------------------------
    // Shell: badges, navigation, language, user menu
    // ------------------------------------------------------------------

    function setBadge(id, count) {
        var el = document.getElementById(id);
        if (!el) return;
        el.textContent = count > 99 ? "99+" : String(count);
        el.classList.toggle("hidden", !count);
    }

    var badgeTimer = null;

    function refreshBadges() {
        return fetch("/api/notifications/summary", { credentials: "same-origin" })
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (s) {
                if (!s) return;
                setBadge("badgeMessages", s.unreadMessages);
                setBadge("badgeNotifications", s.unreadNotifications);
                setBadge("badgeFriends", s.pendingRequests);
                document.dispatchEvent(new CustomEvent("badges", { detail: s }));
            })
            .catch(function () { /* offline: keep the old numbers */ });
    }

    function startBadgePolling() {
        refreshBadges();
        clearInterval(badgeTimer);
        badgeTimer = setInterval(function () { if (!document.hidden) refreshBadges(); }, 20000);
        document.addEventListener("visibilitychange", function () { if (!document.hidden) refreshBadges(); });
    }

    function initShell() {
        applyI18n();

        document.querySelectorAll(".lang-switch button").forEach(function (button) {
            button.classList.toggle("active", button.dataset.lang === lang);
            button.addEventListener("click", function () { setLang(button.dataset.lang, true); });
        });

        var app = document.querySelector(".app");
        var menuButton = document.getElementById("menuButton");
        if (app && menuButton) {
            var scrim = h("div", { class: "nav-scrim hidden", onclick: toggleNav });
            document.body.appendChild(scrim);
            function toggleNav() {
                var open = app.classList.toggle("nav-open");
                scrim.classList.toggle("hidden", !open);
            }
            menuButton.addEventListener("click", toggleNav);
            document.querySelectorAll(".sidebar .nav a").forEach(function (a) { a.addEventListener("click", function () { if (app.classList.contains("nav-open")) toggleNav(); }); });
        }

        var chip = document.getElementById("userChip");
        if (chip) {
            var chipAvatar = chip.querySelector(".avatar");
            if (chipAvatar) chipAvatar.style.background = "hsl(" + hue(String(APP.user.username || "?")) + " 52% 46%)";
            chip.addEventListener("click", function () {
                menu(chip, [
                    { label: t("nav.profile"), icon: "user-round", onClick: function () { window.location.href = "/profile"; } },
                    "-",
                    { label: t("nav.logout"), icon: "log-out", danger: true, onClick: function () { window.location.href = "/logout"; } }
                ]);
            });
        }

        var themeButton = document.getElementById("sgThemeToggle");
        if (themeButton && window.StudyGramTheme) {
            themeButton.addEventListener("click", window.StudyGramTheme.toggle);
        }

        refreshIcons();
        startBadgePolling();
    }

    window.App = {
        t: t, api: api, ApiError: ApiError, h: h, icon: icon, refreshIcons: refreshIcons, clear: clear,
        avatar: avatar, fullName: fullName, richText: richText,
        timeAgo: timeAgo, fullDate: fullDate, clock: clock, dayLabel: dayLabel, formatSize: formatSize,
        debounce: debounce, toast: toast, modal: modal, confirm: confirmDialog, menu: menu, closeMenu: closeMenu,
        applyI18n: applyI18n, setLang: setLang, getLang: function () { return lang; },
        refreshBadges: refreshBadges, user: APP.user
    };

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initShell);
    else initShell();
})();
