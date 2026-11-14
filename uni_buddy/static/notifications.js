
/*
 * UNIBUDDY - NOTIFICATIONS
 * Frontend prototype
 * Forum + Shared Files
 *
 * Uses:
 * - localStorage: UniBuddyForumDemo_<username>
 * - IndexedDB: UniBuddyLibrary / items
 */

document.addEventListener("DOMContentLoaded", () => {
    const container = document.getElementById(
        "notificationsContainer"
    );

    if (!container) return;

    const username = (
        document.querySelector(".sidebar .profile-info span")
            ?.textContent || "@student"
    ).trim().replace(/^@/, "");

    const STATE_KEY = "UniBuddyNotifications_" + username;
    const FORUM_KEY = "UniBuddyForumDemo_" + username;
    const LIBRARY_DB = "UniBuddyLibrary";

    const $ = id => document.getElementById(id);

    const labels = {
        ro: {
            title: "Activitatea ta",
            subtitle: "Noutăți din Forum și Shared Files",
            all: "Toate",
            unread: "Necitite",
            forum: "Forum",
            shared: "Shared Files",
            markAll: "Marchează toate ca citite",
            clear: "Șterge notificările citite",
            empty: "Nu există notificări",
            emptyInfo: "Activitățile noi vor apărea aici.",
            likePost: "Apreciere nouă la postarea ta",
            likeComment: "Apreciere nouă la comentariul tău",
            comment: "Comentariu nou la postarea ta",
            reply: "Răspuns nou la comentariul tău",
            file: "Material nou într-un folder partajat",
            sharedFile: "Fișier marcat ca partajat",
            sharedFolder: "Folder marcat ca partajat",
            view: "Deschide",
            remove: "Șterge",
            read: "Marchează ca citită",
            unreadAction: "Marchează ca necitită",
            newCount: "necitite",
            local: "Activitate locală"
        },
        en: {
            title: "Your activity",
            subtitle: "Updates from Forum and Shared Files",
            all: "All",
            unread: "Unread",
            forum: "Forum",
            shared: "Shared Files",
            markAll: "Mark all as read",
            clear: "Clear read notifications",
            empty: "No notifications",
            emptyInfo: "New activities will appear here.",
            likePost: "New like on your post",
            likeComment: "New like on your comment",
            comment: "New comment on your post",
            reply: "New reply to your comment",
            file: "New material in a shared folder",
            sharedFile: "File marked as shared",
            sharedFolder: "Folder marked as shared",
            view: "Open",
            remove: "Delete",
            read: "Mark as read",
            unreadAction: "Mark as unread",
            newCount: "unread",
            local: "Local activity"
        }
    };

    let filter = "all";
    let state = loadState();
    let checking = false;
    let firstCheck = true;

    function language() {
        return localStorage.getItem("UniBuddyForumLanguage")
            === "en" ? "en" : "ro";
    }

    function t(key) {
        return labels[language()][key] || key;
    }

    function node(tag, className, text) {
        const el = document.createElement(tag);
        if (className) el.className = className;
        if (text !== undefined) el.textContent = text;
        return el;
    }

    function icon(name) {
        const i = document.createElement("i");
        i.setAttribute("data-lucide", name);
        return i;
    }

    function refreshIcons() {
        window.lucide?.createIcons();
    }

    function readJSON(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            return raw === null ? fallback : JSON.parse(raw);
        } catch {
            return fallback;
        }
    }

    function loadState() {
        const saved = readJSON(STATE_KEY, {});

        return {
            events: Array.isArray(saved.events)
                ? saved.events : [],
            snapshot: saved.snapshot || null,
            dismissed: Array.isArray(saved.dismissed)
                ? saved.dismissed : []
        };
    }

    function saveState() {
        try {
            localStorage.setItem(
                STATE_KEY,
                JSON.stringify(state)
            );
        } catch (err) {
            console.warn("Notifications save failed", err);
        }
    }

    function forumSnapshot() {
        const posts = readJSON(FORUM_KEY, []);

        const result = {};

        if (!Array.isArray(posts)) return result;

        for (const post of posts) {
            if (!post?.id) continue;

            const ownPost = post.userId === username;

            if (ownPost) {
                result["post:" + post.id] = {
                    kind: "post",
                    id: post.id,
                    title: post.title || "",
                    likes: Array.isArray(post.likes)
                        ? post.likes.filter(x => x !== username)
                        : [],
                    comments: Array.isArray(post.comments)
                        ? post.comments
                            .filter(c =>
                                c.userId !== username &&
                                !c.parentId
                            )
                            .map(c => ({
                                id: c.id,
                                author: c.author || "",
                                text: c.text || ""
                            }))
                        : []
                };
            }

            for (const comment of post.comments || []) {
                if (comment.userId !== username) continue;

                result["comment:" + comment.id] = {
                    kind: "comment",
                    id: comment.id,
                    postId: post.id,
                    title: post.title || "",
                    likes: Array.isArray(comment.likes)
                        ? comment.likes.filter(x => x !== username)
                        : [],
                    replies: (post.comments || [])
                        .filter(c =>
                            c.parentId === comment.id &&
                            c.userId !== username
                        )
                        .map(c => ({
                            id: c.id,
                            author: c.author || "",
                            text: c.text || ""
                        }))
                };
            }
        }

        return result;
    }

    async function librarySnapshot() {
        return new Promise(resolve => {
            let request;

            try {
                request = indexedDB.open(LIBRARY_DB);
            } catch {
                resolve({});
                return;
            }

            request.onupgradeneeded = () => {
                // Never create a fake library during notification checks.
                request.transaction?.abort();
            };

            request.onerror = () => resolve({});

            request.onsuccess = () => {
                const db = request.result;

                if (!db.objectStoreNames.contains("items")) {
                    db.close();
                    resolve({});
                    return;
                }

                const tx = db.transaction("items", "readonly");
                const get = tx.objectStore("items").getAll();

                get.onerror = () => {
                    db.close();
                    resolve({});
                };

                get.onsuccess = () => {
                    const items = get.result || [];
                    const byId = new Map(
                        items.map(item => [item.id, item])
                    );

                    function sharedParent(item) {
                        const visited = new Set();
                        let parent = byId.get(item.parentId);

                        while (
                            parent &&
                            !visited.has(parent.id)
                        ) {
                            if (parent.trashed) return null;
                            if (parent.shared) return parent;
                            visited.add(parent.id);
                            parent = byId.get(parent.parentId);
                        }

                        return null;
                    }

                    const result = {};

                    for (const item of items) {
                        if (item.trashed) continue;

                        const parent = sharedParent(item);

                        // Only shared files/folders are relevant.
                        if (!item.shared && !parent) continue;

                        result[item.id] = {
                            id: item.id,
                            name: item.name || "",
                            type: item.type,
                            shared: Boolean(item.shared),
                            parentId: item.parentId,
                            folderId: parent?.id || null,
                            folderName: parent?.name || "",
                            createdAt: item.createdAt || 0
                        };
                    }

                    db.close();
                    resolve(result);
                };
            };
        });
    }

    function addEvent(id, type, detail, target) {
        if (state.dismissed.includes(id)) return;
        if (state.events.some(event => event.id === id)) return;

        state.events.unshift({
            id,
            type,
            category: type.startsWith("shared")
                ? "shared" : "forum",
            detail,
            target,
            date: Date.now(),
            read: false
        });

        // Limit the stored local notification history.
        state.events = state.events.slice(0, 150);
    }

    function compareForum(oldData, newData) {
        for (const [key, current] of Object.entries(newData)) {
            const previous = oldData[key];
            if (!previous) continue;

            const oldLikes = new Set(previous.likes || []);

            for (const actor of current.likes || []) {
                if (!oldLikes.has(actor)) {
                    addEvent(
                        `like:${key}:${actor}`,
                        current.kind === "post"
                            ? "likePost" : "likeComment",
                        current.title,
                        "/home"
                    );
                }
            }

            const oldEntries = new Set(
                (previous.comments || previous.replies || [])
                    .map(c => c.id)
            );

            const entries = current.kind === "post"
                ? current.comments || []
                : current.replies || [];

            for (const entry of entries) {
                if (oldEntries.has(entry.id)) continue;

                addEvent(
                    `response:${key}:${entry.id}`,
                    current.kind === "post"
                        ? "comment" : "reply",
                    entry.author
                        ? `${entry.author}: ${entry.text}`
                        : entry.text,
                    "/home"
                );
            }
        }
    }

    function compareLibrary(oldData, newData) {
        for (const [id, item] of Object.entries(newData)) {
            const previous = oldData[id];

            if (
                previous &&
                previous.shared === item.shared &&
                previous.folderId === item.folderId
            ) {
                continue;
            }

            let type;

            if (!previous && item.folderId && item.type === "file") {
                type = "sharedFileInFolder";
            } else if (item.shared && item.type === "file") {
                type = "sharedFile";
            } else if (item.shared && item.type === "folder") {
                type = "sharedFolder";
            } else {
                continue;
            }

            const detail = item.folderName
                ? `${item.name} · ${item.folderName}`
                : item.name;

            addEvent(
                `library:${id}:${type}`,
                type,
                detail,
                item.folderId
                    ? `/library#/files/${encodeURIComponent(item.folderId)}`
                    : "/library#/shared"
            );
        }
    }

    async function checkActivity() {
        if (checking) return;
        checking = true;

        try {
            const snapshot = {
                forum: forumSnapshot(),
                library: await librarySnapshot()
            };

            // First visit establishes a baseline.
            // Existing demo content does not produce fake new alerts.
            if (state.snapshot) {
                compareForum(
                    state.snapshot.forum || {},
                    snapshot.forum
                );
                compareLibrary(
                    state.snapshot.library || {},
                    snapshot.library
                );
            }

            state.snapshot = snapshot;
            saveState();
            render();
            firstCheck = false;
        } catch (error) {
            console.warn("Notification scan failed:", error);
        } finally {
            checking = false;
        }
    }

    function eventIcon(type) {
        if (type.startsWith("shared")) return "folder-plus";
        if (type.startsWith("like")) return "heart";
        if (type === "reply") return "reply";
        return "message-circle";
    }

    function dateLabel(timestamp) {
        return new Date(timestamp).toLocaleString(
            language() === "ro" ? "ro-RO" : "en-GB",
            {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit"
            }
        );
    }

    function render() {
        container.replaceChildren();
        container.className = "ub-notifications";

        const heading = node("div", "ub-notification-head");

        const headingText = node("div");
        headingText.append(
            node("h2", "", t("title")),
            node("p", "", t("subtitle"))
        );

        const unread = state.events.filter(e => !e.read).length;
        const counter = node(
            "span",
            "ub-notification-counter",
            `${unread} ${t("newCount")}`
        );

        heading.append(headingText, counter);

        const filters = node("div", "ub-notification-filters");

        [
            ["all", "all"],
            ["unread", "unread"],
            ["forum", "forum"],
            ["shared", "shared"]
        ].forEach(([value, textKey]) => {
            const button = node(
                "button",
                "ub-filter" + (filter === value ? " active" : ""),
                t(textKey)
            );

            button.type = "button";
            button.onclick = () => {
                filter = value;
                render();
            };

            filters.appendChild(button);
        });

        const actions = node("div", "ub-notification-actions");

        const markAll = node("button", "", t("markAll"));
        markAll.type = "button";
        markAll.onclick = () => {
            state.events.forEach(e => e.read = true);
            saveState();
            render();
        };

        const clear = node("button", "", t("clear"));
        clear.type = "button";
        clear.onclick = () => {
            const removed = state.events.filter(e => e.read);
            state.dismissed.push(...removed.map(e => e.id));
            state.events = state.events.filter(e => !e.read);
            saveState();
            render();
        };

        actions.append(markAll, clear);

        const list = node("div", "ub-notification-list");

        const displayed = state.events
            .filter(e => {
                if (filter === "unread") return !e.read;
                if (filter === "all") return true;
                return e.category === filter;
            })
            .sort((a, b) => b.date - a.date);

        if (!displayed.length) {
            const empty = node("div", "ub-notification-empty");
            empty.append(
                icon("bell-off"),
                node("h3", "", t("empty")),
                node("p", "", t("emptyInfo"))
            );
            list.appendChild(empty);
        }

        for (const notification of displayed) {
            const card = node(
                "article",
                "ub-notification-item" +
                    (notification.read ? "" : " unread")
            );

            const symbol = node("div", "ub-notification-icon");
            symbol.appendChild(
                icon(eventIcon(notification.type))
            );

            const body = node("div", "ub-notification-body");
            body.append(
                node("strong", "", t(
                    notification.type === "sharedFileInFolder"
                        ? "file"
                        : notification.type
                )),
                node("p", "", notification.detail),
                node(
                    "small",
                    "",
                    dateLabel(notification.date) +
                        " · " +
                        (notification.category === "forum"
                            ? t("forum") : t("shared"))
                )
            );

            const buttons = node("div", "ub-item-actions");

            const open = node("button", "", t("view"));
            open.type = "button";
            open.onclick = () => {
                notification.read = true;
                saveState();
                window.location.href = notification.target;
            };

            const read = node(
                "button",
                "",
                notification.read
                    ? t("unreadAction") : t("read")
            );

            read.type = "button";
            read.onclick = () => {
                notification.read = !notification.read;
                saveState();
                render();
            };

            const remove = node("button", "", t("remove"));
            remove.type = "button";
            remove.onclick = () => {
                state.dismissed.push(notification.id);
                state.events = state.events.filter(
                    e => e.id !== notification.id
                );
                saveState();
                render();
            };

            buttons.append(open, read, remove);
            card.append(symbol, body, buttons);
            list.appendChild(card);
        }

        container.append(heading, filters, actions, list);
        refreshIcons();
    }

    function updateLanguage(event) {
    const selected = event.currentTarget.dataset.lang;
    if (selected === "ro" || selected === "en") {
        localStorage.setItem("UniBuddyForumLanguage", selected);
    }
    render();
}

    document.querySelectorAll(".lang-option").forEach(btn => {
        btn.addEventListener("click", updateLanguage);
    });

    window.addEventListener("storage", event => {
        if (
            event.key === FORUM_KEY ||
            event.key === STATE_KEY
        ) {
            if (event.key === STATE_KEY) {
                state = loadState();
                render();
            } else {
                checkActivity();
            }
        }
    });

    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) checkActivity();
    });

    checkActivity();

    // Refresh while the profile page is open.
    setInterval(() => {
        if (!document.hidden) checkActivity();
    }, 6000);
});

