/* Login and sign-up. */
(function () {
    "use strict";

    var LANG_KEY = "UniBuddyForumLanguage";
    var I18N = window.I18N;
    var lang = "ro";

    try {
        var saved = localStorage.getItem(LANG_KEY);
        if (saved === "ro" || saved === "en") lang = saved;
        else if ((navigator.language || "").toLowerCase().indexOf("ro") !== 0) lang = "en";
    } catch (e) { /* storage blocked */ }

    function t(key) { return (I18N[lang] && I18N[lang][key]) || I18N.ro[key] || key; }

    function $(id) { return document.getElementById(id); }

    function applyLanguage(next) {
        lang = next;
        try { localStorage.setItem(LANG_KEY, next); } catch (e) { /* ignore */ }
        document.documentElement.lang = next;
        document.querySelectorAll("[data-i18n]").forEach(function (el) { el.textContent = t(el.dataset.i18n); });
        document.querySelectorAll("[data-i18n-title]").forEach(function (el) { el.title = t(el.dataset.i18nTitle); });
        document.querySelectorAll(".lang-switch button").forEach(function (b) { b.classList.toggle("active", b.dataset.lang === next); });
        $("loginStatus").textContent = "";
        $("signupStatus").textContent = "";
    }

    document.querySelectorAll(".lang-switch button").forEach(function (b) {
        b.addEventListener("click", function () { applyLanguage(b.dataset.lang); });
    });
    var themeButton = $("sgThemeToggle");
    if (window.StudyGramTheme) themeButton.addEventListener("click", window.StudyGramTheme.toggle);

    // ---- tabs
    function showForm(which) {
        var login = which === "login";
        $("loginForm").classList.toggle("hidden", !login);
        $("signupForm").classList.toggle("hidden", login);
        $("tabLogin").classList.toggle("active", login);
        $("tabSignup").classList.toggle("active", !login);
        history.replaceState(null, "", login ? location.pathname : "#signup");
    }
    $("tabLogin").addEventListener("click", function () { showForm("login"); });
    $("tabSignup").addEventListener("click", function () { showForm("signup"); });
    $("toSignup").addEventListener("click", function () { showForm("signup"); });
    $("toLogin").addEventListener("click", function () { showForm("login"); });

    document.querySelectorAll(".pw-toggle").forEach(function (button) {
        button.addEventListener("click", function () {
            var input = $(button.dataset.target);
            input.type = input.type === "password" ? "text" : "password";
        });
    });

    function setStatus(el, message, ok) {
        el.textContent = message || "";
        el.className = "status-line" + (message ? (ok ? " ok" : " error") : "");
    }

    function post(url, payload) {
        return fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        }).then(function (response) {
            return response.json().catch(function () { return {}; }).then(function (body) {
                return { ok: response.ok, body: body };
            });
        });
    }

    // ---- login
    $("loginForm").addEventListener("submit", function (event) {
        event.preventDefault();
        var button = $("loginBtn");
        setStatus($("loginStatus"), "");
        if (!$("loginEmail").value.trim() || !$("loginPassword").value) {
            setStatus($("loginStatus"), t("auth.fillAll"));
            return;
        }
        button.disabled = true;
        post("/api/login", { username: $("loginEmail").value.trim(), password: $("loginPassword").value }).then(function (res) {
            if (res.ok && res.body.success) {
                if (res.body.language) { try { localStorage.setItem(LANG_KEY, res.body.language); } catch (e) { /* ignore */ } }
                window.location.href = res.body.redirect || "/home";
                return;
            }
            setStatus($("loginStatus"), res.body.message || t("auth.loginFailed"));
            button.disabled = false;
        }).catch(function () {
            setStatus($("loginStatus"), t("err.network"));
            button.disabled = false;
        });
    });

    // ---- sign-up
    $("signupForm").addEventListener("submit", function (event) {
        event.preventDefault();
        var status = $("signupStatus");
        setStatus(status, "");

        var payload = {
            firstName: $("suFirst").value, lastName: $("suLast").value, username: $("suUsername").value.trim(),
            email: $("suEmail").value.trim(), university: $("suUniversity").value, faculty: $("suFaculty").value,
            specialization: $("suSpec").value, studyYear: Number($("suYear").value),
            password: $("suPassword").value, confirmPassword: $("suConfirm").value
        };

        var missing = ["firstName", "lastName", "username", "email", "university", "faculty", "specialization", "password", "confirmPassword"]
            .some(function (key) { return !String(payload[key]).trim(); });
        if (missing) { setStatus(status, t("auth.fillAll")); return; }
        if (payload.password !== payload.confirmPassword) { setStatus(status, t("auth.passwordsDiffer")); return; }
        if (payload.password.length < 8) { setStatus(status, t("auth.passwordShort")); return; }
        if (!/^[A-Za-z0-9._-]{3,50}$/.test(payload.username)) { setStatus(status, t("auth.usernameRule")); return; }

        var button = $("signupBtn");
        button.disabled = true;
        post("/api/signup", payload).then(function (res) {
            if (res.ok && res.body.success) {
                window.location.href = res.body.redirect || "/home";
                return;
            }
            setStatus(status, res.body.message || t("err.generic"));
            button.disabled = false;
        }).catch(function () {
            setStatus(status, t("err.network"));
            button.disabled = false;
        });
    });

    // ---- suggestions: faculties already used by other students
    var faculties = [];
    function option(value) { var o = document.createElement("option"); o.value = value; return o; }

    function fillFaculties() {
        var list = $("facultyList");
        while (list.firstChild) list.removeChild(list.firstChild);
        var university = $("suUniversity").value.trim().toLowerCase();
        var seen = {};
        faculties.forEach(function (f) {
            if (university && f.university.toLowerCase() !== university) return;
            if (seen[f.faculty.toLowerCase()]) return;
            seen[f.faculty.toLowerCase()] = true;
            list.appendChild(option(f.faculty));
        });
    }

    fetch("/api/catalog").then(function (r) { return r.json(); }).then(function (catalog) {
        faculties = catalog.faculties || [];
        (catalog.universities || []).forEach(function (u) { $("universityList").appendChild(option(u)); });
        fillFaculties();
    }).catch(function () { /* suggestions are optional */ });
    $("suUniversity").addEventListener("input", fillFaculties);

    applyLanguage(lang);
    showForm(location.hash === "#signup" ? "signup" : "login");
    if (window.lucide) window.lucide.createIcons();
})();