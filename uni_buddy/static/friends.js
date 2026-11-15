/* Friends: list, requests and finding students. */
(function () {
    "use strict";

    var App = window.App;
    var h = App.h, t = App.t, api = App.api, icon = App.icon;

    var TABS = ["friends", "requests", "find"];
    var tab = "friends";

    function el(id) { return document.getElementById(id); }

    function personCard(user, actions, extra) {
        var meta = [user.faculty, user.studyYear ? t("common.yearN", { n: user.studyYear }) : null].filter(Boolean).join(" · ");
        return h("div", { class: "card person" },
            App.avatar(user, "lg"),
            h("div", { class: "person-info" },
                h("strong", { class: "truncate" }, App.fullName(user)),
                h("span", { class: "muted truncate" }, "@" + user.username),
                h("span", { class: "muted truncate small" }, meta),
                extra || null),
            h("div", { class: "person-actions" }, actions));
    }

    function btn(label, kind, onClick, iconName) {
        return h("button", { type: "button", class: "btn btn-sm " + kind, onclick: function (event) { onClick(event.currentTarget); } },
            iconName ? icon(iconName) : null, label);
    }

    function fail(error) { App.toast(error.message, "error"); }

    function emptyBox(iconName, title, text, action) {
        return h("div", { class: "empty" }, h("div", { class: "empty-icon" }, icon(iconName)), h("h3", {}, title), h("p", {}, text), action || null);
    }

    // ------------------------------------------------------------------
    // Tabs
    // ------------------------------------------------------------------

    function showTab(name) {
        if (TABS.indexOf(name) === -1) name = "friends";
        tab = name;
        document.querySelectorAll("#friendTabs button").forEach(function (b) { b.classList.toggle("active", b.dataset.tab === name); });
        TABS.forEach(function (n) { el("tab-" + n).classList.toggle("hidden", n !== name); });
        history.replaceState(null, "", name === "friends" ? location.pathname : "#" + name);
        if (name === "friends") loadFriends();
        if (name === "requests") loadRequests();
        if (name === "find") { loadFind(); el("findInput").focus(); }
    }

    document.querySelectorAll("#friendTabs button").forEach(function (b) {
        b.addEventListener("click", function () { showTab(b.dataset.tab); });
    });

    // ------------------------------------------------------------------
    // My friends
    // ------------------------------------------------------------------

    function loadFriends() {
        var box = el("tab-friends");
        App.clear(box);
        box.appendChild(h("div", { class: "spinner" }));
        api("/api/friends").then(function (friends) {
            el("friendCount").textContent = String(friends.length);
            App.clear(box);
            if (!friends.length) {
                box.appendChild(emptyBox("users-round", t("friends.emptyTitle"), t("friends.emptyText"),
                    h("button", { type: "button", class: "btn btn-primary", onclick: function () { showTab("find"); } }, icon("search"), t("friends.find"))));
                App.refreshIcons();
                return;
            }
            var grid = h("div", { class: "people-grid" });
            friends.forEach(function (friend) {
                var card = personCard(friend, [
                    h("a", { class: "btn btn-sm btn-primary", href: "/messages?with=" + friend.id }, icon("message-circle"), t("friends.message")),
                    h("button", {
                        type: "button", class: "icon-btn sm", "aria-label": t("common.more"),
                        onclick: function (event) {
                            App.menu(event.currentTarget, [
                                { label: t("friends.remove"), icon: "user-minus", danger: true, onClick: function () { removeFriend(friend); } }
                            ]);
                        }
                    }, icon("ellipsis-vertical"))
                ]);
                grid.appendChild(card);
            });
            box.appendChild(grid);
            App.refreshIcons();
        }).catch(function (e) { App.clear(box); box.appendChild(emptyBox("triangle-alert", t("err.title"), e.message)); App.refreshIcons(); });
    }

    function removeFriend(friend) {
        App.confirm({ title: t("friends.remove"), message: t("friends.removeText", { name: App.fullName(friend) }), confirmText: t("friends.remove"), danger: true }).then(function (ok) {
            if (!ok) return;
            api("/api/friends/" + friend.id, { method: "DELETE" }).then(function () {
                App.toast(t("friends.removed"), "success");
                loadFriends();
            }).catch(fail);
        });
    }

    // ------------------------------------------------------------------
    // Requests
    // ------------------------------------------------------------------

    function loadRequests() {
        var box = el("tab-requests");
        App.clear(box);
        box.appendChild(h("div", { class: "spinner" }));

        Promise.all([api("/api/friends/requests/received"), api("/api/friends/requests/sent")]).then(function (result) {
            var received = result[0], sent = result[1];
            setRequestBadge(received.length);
            App.clear(box);

            box.appendChild(h("h2", { class: "section-h" }, t("friends.received") + " (" + received.length + ")"));
            if (!received.length) box.appendChild(h("p", { class: "muted pad" }, t("friends.noReceived")));
            var grid1 = h("div", { class: "people-grid" });
            received.forEach(function (r) {
                grid1.appendChild(personCard(r.user, [
                    btn(t("friends.accept"), "btn-primary", function (b) { answer(r, "accept", b); }, "check"),
                    btn(t("friends.reject"), "btn-secondary", function (b) { answer(r, "reject", b); })
                ], h("span", { class: "faint small" }, App.timeAgo(r.createdAt))));
            });
            box.appendChild(grid1);

            box.appendChild(h("h2", { class: "section-h" }, t("friends.sent") + " (" + sent.length + ")"));
            if (!sent.length) box.appendChild(h("p", { class: "muted pad" }, t("friends.noSent")));
            var grid2 = h("div", { class: "people-grid" });
            sent.forEach(function (r) {
                grid2.appendChild(personCard(r.user, [
                    btn(t("friends.cancel"), "btn-secondary", function (b) { cancel(r.requestId, b); })
                ], h("span", { class: "faint small" }, App.timeAgo(r.createdAt))));
            });
            box.appendChild(grid2);
            App.refreshIcons();
        }).catch(function (e) { App.clear(box); box.appendChild(emptyBox("triangle-alert", t("err.title"), e.message)); App.refreshIcons(); });
    }

    function setRequestBadge(count) {
        var badge = el("requestCount");
        badge.textContent = String(count);
        badge.classList.toggle("hidden", !count);
    }

    function answer(request, action, button) {
        button.disabled = true;
        api("/api/friends/" + action + "/" + request.requestId, { method: "POST" }).then(function () {
            App.toast(action === "accept" ? t("friends.nowFriends", { name: App.fullName(request.user) }) : t("friends.rejected"), "success");
            App.refreshBadges();
            if (tab === "requests") loadRequests(); else loadFind();
        }).catch(function (e) { fail(e); button.disabled = false; });
    }

    function cancel(requestId, button) {
        button.disabled = true;
        api("/api/friends/request/" + requestId, { method: "DELETE" }).then(function () {
            App.toast(t("friends.cancelled"), "success");
            if (tab === "requests") loadRequests(); else loadFind();
        }).catch(function (e) { fail(e); button.disabled = false; });
    }

    // ------------------------------------------------------------------
    // Find students
    // ------------------------------------------------------------------

    var findToken = 0;

    function loadFind() {
        var query = el("findInput").value.trim();
        var token = ++findToken;
        var box = el("findResults");
        el("findTitle").textContent = query ? t("friends.results") : t("friends.classmates");
        if (!box.firstChild) box.appendChild(h("div", { class: "spinner" }));

        api("/api/friends/discover?query=" + encodeURIComponent(query)).then(function (results) {
            if (token !== findToken) return;
            App.clear(box);
            if (!results.length) {
                box.appendChild(emptyBox("search-x", t("friends.noResults"), query ? t("friends.noResultsText") : t("friends.noClassmates")));
                App.refreshIcons();
                return;
            }
            results.forEach(function (r) { box.appendChild(personCard(r.user, relationActions(r))); });
            App.refreshIcons();
        }).catch(function (e) { if (token === findToken) { App.clear(box); box.appendChild(emptyBox("triangle-alert", t("err.title"), e.message)); App.refreshIcons(); } });
    }

    function relationActions(r) {
        if (r.relation === "FRIEND") {
            return [h("a", { class: "btn btn-sm btn-primary", href: "/messages?with=" + r.user.id }, icon("message-circle"), t("friends.message"))];
        }
        if (r.relation === "REQUEST_SENT") {
            return [btn(t("friends.cancel"), "btn-secondary", function (b) { cancel(r.requestId, b); })];
        }
        if (r.relation === "REQUEST_RECEIVED") {
            return [
                btn(t("friends.accept"), "btn-primary", function (b) { answer({ requestId: r.requestId, user: r.user }, "accept", b); }, "check"),
                btn(t("friends.reject"), "btn-secondary", function (b) { answer({ requestId: r.requestId, user: r.user }, "reject", b); })
            ];
        }
        return [btn(t("friends.add"), "btn-primary", function (b) {
            b.disabled = true;
            api("/api/friends/request/" + r.user.id, { method: "POST" }).then(function () {
                App.toast(t("friends.requestSentToast"), "success");
                loadFind();
            }).catch(function (e) { fail(e); b.disabled = false; });
        }, "user-plus")];
    }

    el("findInput").addEventListener("input", App.debounce(loadFind, 300));
    document.addEventListener("langchange", function () { showTab(tab); });
    document.addEventListener("badges", function (e) { if (tab !== "requests") setRequestBadge(e.detail.pendingRequests); });

    // the friend count is shown on the tab even when another tab is open
    api("/api/friends").then(function (list) { el("friendCount").textContent = String(list.length); }).catch(function () { /* optional */ });

    showTab(location.hash.replace("#", "") || "friends");
})();
