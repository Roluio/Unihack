/* Notifications: friend requests, likes and comments on my posts. */
(function () {
    "use strict";

    var App = window.App;
    var h = App.h, t = App.t, api = App.api, icon = App.icon;

    var listEl = document.getElementById("notifList");
    var items = [];
    var seenTimer = null;

    var ICONS = {
        FRIEND_REQUEST: "user-plus", FRIEND_ACCEPTED: "user-check", POST_LIKE: "heart",
        POST_COMMENT: "message-circle", COMMENT_REPLY: "corner-down-right", COMMENT_LIKE: "heart"
    };

    // "{name} liked {title}" -> nodes with the name and title in bold.
    function sentence(item) {
        var template = t("notif." + item.type);
        var out = [];
        template.split(/(\{name\}|\{title\})/).forEach(function (part) {
            if (part === "{name}") out.push(h("strong", {}, App.fullName(item.actor)));
            else if (part === "{title}") out.push(h("strong", {}, "“" + (item.postTitle || "") + "”"));
            else if (part) out.push(part);
        });
        return out;
    }

    function load() {
        return api("/api/notifications").then(function (data) {
            items = data.items;
            render(data.unreadCount);
            // opening the page counts as reading; the highlight stays until the next visit
            clearTimeout(seenTimer);
            seenTimer = setTimeout(markSeen, 2500);
        }).catch(function (e) {
            App.clear(listEl);
            listEl.appendChild(h("div", { class: "empty" }, h("h3", {}, t("err.title")), h("p", {}, e.message)));
        });
    }

    function render(unreadCount) {
        App.clear(listEl);
        document.getElementById("markSeen").classList.toggle("hidden", !unreadCount);

        if (!items.length) {
            listEl.appendChild(h("div", { class: "empty" },
                h("div", { class: "empty-icon" }, icon("bell")),
                h("h3", {}, t("notif.emptyTitle")),
                h("p", {}, t("notif.emptyText"))));
            App.refreshIcons();
            return;
        }

        items.forEach(function (item) {
            var row = h("div", { class: "notif" + (item.unread ? " unread" : "") },
                h("div", { class: "notif-ico t-" + item.type.toLowerCase() }, icon(ICONS[item.type] || "bell")),
                App.avatar(item.actor),
                h("div", { class: "notif-text" },
                    h("div", {}, sentence(item)),
                    h("small", { class: "muted", title: App.fullDate(item.createdAt) }, App.timeAgo(item.createdAt))));

            if (item.type === "FRIEND_REQUEST") {
                row.appendChild(h("div", { class: "notif-actions" },
                    h("button", { type: "button", class: "btn btn-sm btn-primary", onclick: function (e) { answer(item, "accept", e.currentTarget); } }, t("friends.accept")),
                    h("button", { type: "button", class: "btn btn-sm btn-secondary", onclick: function (e) { answer(item, "reject", e.currentTarget); } }, t("friends.reject"))));
            } else {
                var target = item.type === "FRIEND_ACCEPTED" ? "/friends" : "/home";
                row.classList.add("clickable");
                row.addEventListener("click", function () { window.location.href = target; });
            }
            listEl.appendChild(row);
        });
        App.refreshIcons();
    }

    function answer(item, action, button) {
        button.disabled = true;
        api("/api/friends/" + action + "/" + item.requestId, { method: "POST" }).then(function () {
            App.toast(action === "accept" ? t("friends.nowFriends", { name: App.fullName(item.actor) }) : t("friends.rejected"), "success");
            App.refreshBadges();
            load();
        }).catch(function (e) { App.toast(e.message, "error"); button.disabled = false; });
    }

    function markSeen() {
        api("/api/notifications/seen", { method: "POST" }).then(function () {
            App.refreshBadges();
            document.getElementById("markSeen").classList.add("hidden");
        }).catch(function () { /* not critical */ });
    }

    document.getElementById("markSeen").addEventListener("click", function () {
        items.forEach(function (i) { i.unread = false; });
        render(0);
        markSeen();
    });

    document.addEventListener("langchange", function () { render(items.filter(function (i) { return i.unread; }).length); });
    load();
})();