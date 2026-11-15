/* Profile: personal data, preferences and password. */
(function () {
    "use strict";

    var App = window.App;
    var h = App.h, t = App.t, api = App.api;

    function el(id) { return document.getElementById(id); }

    function drawSummary(user) {
        el("sumName").textContent = ((user.firstName || "") + " " + (user.lastName || "")).trim();
        el("sumFaculty").textContent = user.faculty;
        el("sumYear").textContent = t("common.yearN", { n: user.studyYear });
        el("sumUniversity").textContent = [user.specialization, user.university].filter(Boolean).join(" · ");
        var bio = el("sumBio");
        bio.textContent = user.bio || t("profile.noBio");
        bio.classList.toggle("muted", !user.bio);
        var avatar = el("sumAvatar");
        avatar.style.background = "hsl(" + hueOf(user.username) + " 52% 46%)";
    }

    function hueOf(text) {
        var hash = 0;
        for (var i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
        return hash % 360;
    }

    var current = {
        firstName: el("pFirst").value, lastName: el("pLast").value, university: el("pUniversity").value,
        faculty: el("pFaculty").value, specialization: el("pSpec").value, studyYear: Number(el("pYear").value),
        bio: el("pBio").value, username: App.user.username
    };
    drawSummary(current);

    // ---- save personal data
    el("profileForm").addEventListener("submit", function (event) {
        event.preventDefault();
        var status = el("profileStatus");
        var button = el("saveProfile");
        status.className = "status-line";
        status.textContent = "";
        button.disabled = true;

        api("/api/profile/update", {
            method: "POST",
            body: {
                firstName: el("pFirst").value, lastName: el("pLast").value, university: el("pUniversity").value,
                faculty: el("pFaculty").value, specialization: el("pSpec").value, studyYear: Number(el("pYear").value),
                bio: el("pBio").value
            }
        }).then(function (res) {
            current = res.user;
            drawSummary(current);
            App.toast(t("profile.saved"), "success");
        }).catch(function (e) {
            status.className = "status-line error";
            status.textContent = e.message;
        }).then(function () { button.disabled = false; });
    });

    // ---- password
    el("passwordForm").addEventListener("submit", function (event) {
        event.preventDefault();
        var status = el("passwordStatus");
        status.className = "status-line";
        status.textContent = "";

        if (el("pwNew").value !== el("pwConfirm").value) {
            status.className = "status-line error";
            status.textContent = t("profile.passwordMismatch");
            return;
        }
        var button = el("savePassword");
        button.disabled = true;
        api("/api/profile/password", {
            method: "POST",
            body: { currentPassword: el("pwCurrent").value, newPassword: el("pwNew").value, confirmPassword: el("pwConfirm").value }
        }).then(function () {
            el("passwordForm").reset();
            App.toast(t("profile.passwordChanged"), "success");
        }).catch(function (e) {
            status.className = "status-line error";
            status.textContent = e.message;
        }).then(function () { button.disabled = false; });
    });

    // ---- preferences
    function syncPrefs() {
        el("prefLang").querySelectorAll("button").forEach(function (b) { b.classList.toggle("active", b.dataset.lang === App.getLang()); });
        var theme = document.documentElement.getAttribute("data-theme");
        el("prefTheme").querySelectorAll("button").forEach(function (b) { b.classList.toggle("active", b.dataset.themeChoice === theme); });
    }

    el("prefLang").querySelectorAll("button").forEach(function (b) {
        b.addEventListener("click", function () { App.setLang(b.dataset.lang, true); });
    });
    el("prefTheme").querySelectorAll("button").forEach(function (b) {
        b.addEventListener("click", function () { window.StudyGramTheme.set(b.dataset.themeChoice); syncPrefs(); });
    });
    new MutationObserver(syncPrefs).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    document.addEventListener("langchange", function () { syncPrefs(); drawSummary(current); });
    syncPrefs();

    // ---- suggestions for university / faculty
    fetch("/api/catalog").then(function (r) { return r.json(); }).then(function (catalog) {
        function fill(list, values) {
            values.forEach(function (v) { list.appendChild(h("option", { value: v })); });
        }
        fill(el("universityList"), catalog.universities || []);
        var faculties = (catalog.faculties || []).map(function (f) { return f.faculty; });
        fill(el("facultyList"), faculties.filter(function (f, i) { return faculties.indexOf(f) === i; }));
    }).catch(function () { /* suggestions are optional */ });

    api("/api/friends").then(function (list) { el("statFriends").textContent = String(list.length); }).catch(function () { /* optional */ });
})();