/* Messages: private chats and groups between friends (server-side, polled). */
(function () {
    "use strict";

    var App = window.App;
    var h = App.h, t = App.t, api = App.api, icon = App.icon;

    var LIST_POLL = 6000;
    var CHAT_POLL = 3000;

    var state = { convs: [], activeId: null, active: null, messages: [], signature: "", filter: "" };
    var msgsEl = document.getElementById("msgs");
    var listEl = document.getElementById("convList");
    var bodyEl = document.getElementById("chatBody");
    var inputEl = document.getElementById("msgInput");
    var chatTimer = null;
    var listTimer = null;

    // ------------------------------------------------------------------
    // Conversation list
    // ------------------------------------------------------------------

    function loadList() {
        return api("/api/conversations").then(function (list) {
            state.convs = list;
            renderList();
        }).catch(function () { /* keep the old list when offline */ });
    }

    function convAvatar(conv) {
        if (conv.type === "GROUP") return h("span", { class: "group-avatar" }, icon("users-round"));
        return App.avatar(conv.other || { username: conv.name, firstName: conv.name });
    }

    function renderList() {
        App.clear(listEl);
        var q = state.filter.toLowerCase();
        var shown = state.convs.filter(function (c) { return !q || c.name.toLowerCase().indexOf(q) !== -1; });

        if (!shown.length) {
            listEl.appendChild(h("div", { class: "empty" },
                h("p", {}, state.convs.length ? t("msg.noMatch") : t("msg.noConversations")),
                state.convs.length ? null : h("button", { type: "button", class: "btn btn-primary btn-sm", onclick: newConversation }, t("msg.new"))));
            return;
        }

        shown.forEach(function (conv) {
            var last = conv.lastMessage;
            var previewText = last ? (last.mine ? t("msg.you") + ": " : (conv.type === "GROUP" ? last.sender.firstName + ": " : "")) + last.content : t("msg.startChat");
            var row = h("button", {
                type: "button",
                class: "conv-item" + (conv.id === state.activeId ? " active" : "") + (conv.unread ? " unread" : ""),
                onclick: function () { openConversation(conv.id); }
            },
                convAvatar(conv),
                h("div", { class: "info" },
                    h("div", { class: "top" }, h("strong", {}, conv.name), last ? h("time", {}, App.timeAgo(last.createdAt)) : null),
                    h("div", { class: "preview" }, h("span", {}, previewText), conv.unread ? h("span", { class: "badge" }, String(conv.unread)) : null)));
            listEl.appendChild(row);
        });
        App.refreshIcons();
    }

    // ------------------------------------------------------------------
    // Open a conversation
    // ------------------------------------------------------------------

    function openConversation(id) {
        state.activeId = id;
        state.messages = [];
        state.signature = "";
        history.replaceState(null, "", "#" + id);
        msgsEl.classList.add("chat-open");
        document.getElementById("chatEmpty").classList.add("hidden");
        document.getElementById("chat").classList.remove("hidden");
        renderList();

        App.clear(bodyEl);
        bodyEl.appendChild(h("div", { class: "spinner" }));

        api("/api/conversations/" + id).then(function (details) {
            if (state.activeId !== id) return;
            state.active = details;
            renderHeader();
            return loadMessages(true);
        }).catch(function (e) {
            App.toast(e.message, "error");
            closeChat();
        });
        schedule();
        inputEl.focus();
    }

    function closeChat() {
        state.activeId = null;
        state.active = null;
        msgsEl.classList.remove("chat-open");
        document.getElementById("chatEmpty").classList.remove("hidden");
        document.getElementById("chat").classList.add("hidden");
        history.replaceState(null, "", location.pathname);
        renderList();
    }

    function renderHeader() {
        var conv = state.active;
        if (!conv) return;
        var slot = document.getElementById("chatAvatar");
        App.clear(slot);
        slot.appendChild(convAvatar(conv));
        document.getElementById("chatName").textContent = conv.name;
        document.getElementById("chatSub").textContent = conv.type === "GROUP"
            ? t("msg.members", { n: conv.memberCount })
            : (conv.other ? "@" + conv.other.username + (conv.other.faculty ? " · " + conv.other.faculty : "") : "");
        App.refreshIcons();
    }

    // ------------------------------------------------------------------
    // Messages
    // ------------------------------------------------------------------

    function loadMessages(forceScroll) {
        var id = state.activeId;
        if (!id) return Promise.resolve();
        return api("/api/conversations/" + id + "/messages").then(function (list) {
            if (id !== state.activeId) return;
            var signature = list.map(function (m) { return m.id; }).join(",");
            if (signature === state.signature && !forceScroll) return;
            state.signature = signature;
            state.messages = list;
            renderMessages(forceScroll);
        }).catch(function (e) {
            if (e.status === 404) { App.toast(t("msg.gone"), "error"); closeChat(); loadList(); }
        });
    }

    function renderMessages(forceScroll) {
        var nearBottom = bodyEl.scrollHeight - bodyEl.scrollTop - bodyEl.clientHeight < 120;
        App.clear(bodyEl);

        var isGroup = state.active && state.active.type === "GROUP";
        var lastDay = "", lastSender = null, lastTime = 0;

        if (!state.messages.length) {
            bodyEl.appendChild(h("div", { class: "empty" }, h("p", {}, t("msg.emptyChat"))));
        }

        state.messages.forEach(function (m) {
            var day = new Date(m.createdAt).toDateString();
            if (day !== lastDay) {
                lastDay = day;
                lastSender = null;
                bodyEl.appendChild(h("div", { class: "day-divider" }, App.dayLabel(m.createdAt)));
            }
            var time = Date.parse(m.createdAt);
            var startsGroup = lastSender !== m.sender.id || time - lastTime > 5 * 60 * 1000;
            lastSender = m.sender.id;
            lastTime = time;

            var stack = h("div", { class: "stack" });
            if (isGroup && !m.mine && startsGroup) stack.appendChild(h("span", { class: "sender" }, App.fullName(m.sender)));
            stack.appendChild(h("div", { class: "bubble", title: App.fullDate(m.createdAt) }, App.richText(m.content), h("time", {}, App.clock(m.createdAt))));

            var row = h("div", { class: "msg" + (m.mine ? " mine" : ""), dataset: { id: m.id } });
            if (isGroup && !m.mine) row.appendChild(h("div", { class: "avatar-slot" }, startsGroup ? App.avatar(m.sender, "sm") : null));
            row.appendChild(stack);
            if (m.mine) {
                row.appendChild(h("button", {
                    type: "button", class: "icon-btn sm msg-del", "aria-label": t("msg.deleteMessage"), title: t("msg.deleteMessage"),
                    onclick: function () { deleteMessage(m); }
                }, icon("trash-2")));
            }
            bodyEl.appendChild(row);
        });

        App.refreshIcons();
        if (forceScroll || nearBottom) bodyEl.scrollTop = bodyEl.scrollHeight;
    }

    function deleteMessage(m) {
        App.confirm({ title: t("msg.deleteMessage"), message: t("msg.deleteMessageText"), confirmText: t("feed.delete"), danger: true }).then(function (ok) {
            if (!ok) return;
            api("/api/conversations/" + state.activeId + "/messages/" + m.id, { method: "DELETE" })
                .then(function () { return loadMessages(false); })
                .then(loadList)
                .catch(function (e) { App.toast(e.message, "error"); });
        });
    }

    document.getElementById("msgForm").addEventListener("submit", function (event) {
        event.preventDefault();
        var text = inputEl.value.trim();
        if (!text || !state.activeId) return;
        var button = document.getElementById("sendBtn");
        button.disabled = true;
        api("/api/conversations/" + state.activeId + "/messages", { method: "POST", body: { content: text } }).then(function () {
            inputEl.value = "";
            inputEl.style.height = "42px";
            return loadMessages(true);
        }).then(loadList).catch(function (e) { App.toast(e.message, "error"); })
            .then(function () { button.disabled = false; inputEl.focus(); });
    });

    inputEl.addEventListener("input", function () {
        inputEl.style.height = "42px";
        inputEl.style.height = Math.min(inputEl.scrollHeight, 140) + "px";
    });
    inputEl.addEventListener("keydown", function (event) {
        if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
            event.preventDefault();
            document.getElementById("msgForm").requestSubmit();
        }
    });

    // ------------------------------------------------------------------
    // Polling (pauses while the tab is hidden)
    // ------------------------------------------------------------------

    function schedule() {
        clearTimeout(chatTimer);
        chatTimer = setTimeout(function tick() {
            var next = function () { chatTimer = setTimeout(tick, CHAT_POLL); };
            if (!document.hidden && state.activeId) loadMessages(false).then(next, next);
            else next();
        }, CHAT_POLL);
    }

    function scheduleList() {
        clearTimeout(listTimer);
        listTimer = setTimeout(function tick() {
            var next = function () { listTimer = setTimeout(tick, LIST_POLL); };
            if (!document.hidden) loadList().then(next, next); else next();
        }, LIST_POLL);
    }

    document.addEventListener("visibilitychange", function () {
        if (!document.hidden) { loadList(); loadMessages(false); }
    });

    // ------------------------------------------------------------------
    // New conversation / group, members, menu
    // ------------------------------------------------------------------

    function friendRow(friend, checkbox) {
        var row = h(checkbox ? "label" : "button", { class: "pick-row", type: checkbox ? null : "button" },
            App.avatar(friend),
            h("span", { class: "who" }, h("strong", {}, App.fullName(friend)), h("small", {}, "@" + friend.username + (friend.faculty ? " · " + friend.faculty : ""))));
        if (checkbox) row.appendChild(h("input", { type: "checkbox", value: friend.id }));
        return row;
    }

    function noFriends() {
        return h("div", { class: "empty" },
            h("div", { class: "empty-icon" }, icon("users-round")),
            h("h3", {}, t("msg.noFriends")),
            h("p", {}, t("msg.noFriendsText")),
            h("a", { class: "btn btn-primary", href: "/friends#find" }, t("friends.find")));
    }

    function newConversation() {
        var mode = "private";
        var holder = h("div");
        var tabs = h("div", { class: "tabs" },
            h("button", { type: "button", class: "active", onclick: function () { setMode("private"); } }, icon("user"), t("msg.tabPrivate")),
            h("button", { type: "button", onclick: function () { setMode("group"); } }, icon("users-round"), t("msg.tabGroup")));
        var dialog = App.modal({
            title: t("msg.new"), body: h("div", {}, tabs, holder), autofocus: false,
            actions: [{ label: t("common.cancel"), kind: "btn-secondary", id: "cancel" }, { id: "create", label: t("msg.createGroup"), kind: "btn-primary hidden", close: false, onClick: createGroup }]
        });
        var friends = null;
        var groupName = h("input", { class: "input", maxlength: "100", placeholder: t("msg.groupName") });

        function setMode(next) {
            mode = next;
            tabs.querySelectorAll("button").forEach(function (b, i) { b.classList.toggle("active", (i === 0) === (mode === "private")); });
            dialog.buttons.create.classList.toggle("hidden", mode !== "group");
            draw();
        }

        function draw() {
            App.clear(holder);
            if (friends === null) { holder.appendChild(h("div", { class: "spinner" })); return; }
            if (!friends.length) { holder.appendChild(noFriends()); App.refreshIcons(); return; }
            if (mode === "group") holder.appendChild(h("div", { class: "field", style: { marginTop: "12px", marginBottom: "0" } }, groupName));
            var list = h("div", { class: "pick-list" });
            friends.forEach(function (friend) {
                if (mode === "private") {
                    var row = friendRow(friend, false);
                    row.addEventListener("click", function () {
                        api("/api/conversations/private", { method: "POST", body: { userId: friend.id } }).then(function (conv) {
                            dialog.close();
                            return loadList().then(function () { openConversation(conv.id); });
                        }).catch(function (e) { App.toast(e.message, "error"); });
                    });
                    list.appendChild(row);
                } else {
                    list.appendChild(friendRow(friend, true));
                }
            });
            holder.appendChild(list);
            App.refreshIcons();
        }

        function createGroup() {
            var ids = Array.prototype.map.call(holder.querySelectorAll("input[type=checkbox]:checked"), function (i) { return i.value; });
            var name = groupName.value.trim();
            if (!name) { App.toast(t("msg.groupNameRequired"), "error"); groupName.focus(); return false; }
            if (!ids.length) { App.toast(t("msg.pickFriends"), "error"); return false; }
            api("/api/conversations/group", { method: "POST", body: { name: name, memberIds: ids } }).then(function (conv) {
                dialog.close();
                return loadList().then(function () { openConversation(conv.id); });
            }).catch(function (e) { App.toast(e.message, "error"); });
            return false;
        }

        draw();
        api("/api/friends").then(function (list) { friends = list; draw(); }).catch(function (e) { friends = []; draw(); App.toast(e.message, "error"); });
    }

    function showMembers() {
        var conv = state.active;
        var list = h("div", { class: "pick-list" }, conv.members.map(function (m) {
            return h("div", { class: "pick-row" }, App.avatar(m),
                h("span", { class: "who" }, h("strong", {}, App.fullName(m) + (m.id === App.user.id ? " (" + t("msg.you") + ")" : "")), h("small", {}, "@" + m.username)));
        }));
        App.modal({
            title: conv.name, body: h("div", {}, h("p", { class: "muted" }, t("msg.members", { n: conv.memberCount })), list), autofocus: false,
            actions: [
                { label: t("msg.addMembers"), kind: "btn-secondary", onClick: addMembers },
                { label: t("common.close"), kind: "btn-primary" }
            ]
        });
    }

    function addMembers() {
        var conv = state.active;
        var existing = {};
        conv.members.forEach(function (m) { existing[m.id] = true; });
        var holder = h("div", {}, h("div", { class: "spinner" }));
        var dialog = App.modal({
            title: t("msg.addMembers"), body: holder, autofocus: false,
            actions: [
                { label: t("common.cancel"), kind: "btn-secondary" },
                {
                    label: t("msg.add"), kind: "btn-primary", close: false,
                    onClick: function () {
                        var ids = Array.prototype.map.call(holder.querySelectorAll("input:checked"), function (i) { return i.value; });
                        if (!ids.length) { App.toast(t("msg.pickFriends"), "error"); return false; }
                        api("/api/conversations/" + conv.id + "/members", { method: "POST", body: { userIds: ids } }).then(function (details) {
                            state.active = details;
                            renderHeader();
                            dialog.close();
                            App.toast(t("msg.membersAdded"), "success");
                            loadList();
                        }).catch(function (e) { App.toast(e.message, "error"); });
                        return false;
                    }
                }
            ]
        });
        api("/api/friends").then(function (friends) {
            var available = friends.filter(function (f) { return !existing[f.id]; });
            App.clear(holder);
            if (!available.length) { holder.appendChild(h("p", { class: "muted" }, t("msg.nobodyToAdd"))); return; }
            holder.appendChild(h("div", { class: "pick-list" }, available.map(function (f) { return friendRow(f, true); })));
            App.refreshIcons();
        });
    }

    function leaveConversation() {
        var group = state.active.type === "GROUP";
        App.confirm({
            title: group ? t("msg.leaveGroup") : t("msg.deleteChat"),
            message: group ? t("msg.leaveGroupText") : t("msg.deleteChatText"),
            confirmText: group ? t("msg.leave") : t("feed.delete"), danger: true
        }).then(function (ok) {
            if (!ok) return;
            api("/api/conversations/" + state.activeId, { method: "DELETE" }).then(function () {
                closeChat();
                return loadList();
            }).catch(function (e) { App.toast(e.message, "error"); });
        });
    }

    document.getElementById("chatMenu").addEventListener("click", function (event) {
        if (!state.active) return;
        var group = state.active.type === "GROUP";
        App.menu(event.currentTarget, [
            group ? { label: t("msg.groupInfo"), icon: "users-round", onClick: showMembers } : null,
            group ? { label: t("msg.addMembers"), icon: "user-plus", onClick: addMembers } : null,
            group ? "-" : null,
            { label: group ? t("msg.leaveGroup") : t("msg.deleteChat"), icon: group ? "log-out" : "trash-2", danger: true, onClick: leaveConversation }
        ]);
    });

    document.getElementById("chatBack").addEventListener("click", closeChat);
    document.getElementById("newChat").addEventListener("click", newConversation);
    document.getElementById("newChat2").addEventListener("click", newConversation);
    document.getElementById("convSearch").addEventListener("input", function (e) { state.filter = e.target.value.trim(); renderList(); });

    document.addEventListener("langchange", function () { renderList(); renderHeader(); if (state.messages.length) renderMessages(false); });

    // ------------------------------------------------------------------
    // Start: #<conversationId> or ?with=<friendId>
    // ------------------------------------------------------------------

    var params = new URLSearchParams(location.search);
    var withUser = params.get("with");
    var hashId = location.hash.replace("#", "");

    loadList().then(function () {
        if (withUser) {
            history.replaceState(null, "", location.pathname);
            return api("/api/conversations/private", { method: "POST", body: { userId: withUser } })
                .then(function (conv) { return loadList().then(function () { openConversation(conv.id); }); })
                .catch(function (e) { App.toast(e.message, "error"); });
        }
        if (/^[0-9a-f-]{36}$/i.test(hashId)) openConversation(hashId);
    });
    scheduleList();
})();
