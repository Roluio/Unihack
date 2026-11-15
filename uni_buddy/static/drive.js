/* Library: file manager with folders, preview, trash, drag and drop. */
(function () {
    "use strict";

    var App = window.App;
    var h = App.h, t = App.t, api = App.api, icon = App.icon;

    var maxBytes = 0;           // set by the server (/api/drive/usage); 0 until it answers
    var MODE_KEY = "studygram-library-mode";

    var state = {
        view: "files",      // files | recent | starred | trash
        folderId: null,
        query: "",
        mode: localStorage.getItem(MODE_KEY) === "list" ? "list" : "grid",
        sort: { key: "name", dir: 1 },
        items: [],
        selected: null,
        token: 0
    };
    var dragged = null;

    var content = document.getElementById("driveContent");
    var crumbs = document.getElementById("crumbs");
    var coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;

    // ------------------------------------------------------------------
    // File types
    // ------------------------------------------------------------------

    function extOf(name) {
        var i = String(name).lastIndexOf(".");
        return i > 0 ? name.slice(i + 1).toLowerCase() : "";
    }

    var CODE_EXT = ["txt", "md", "csv", "json", "xml", "yml", "yaml", "html", "css", "js", "ts", "py", "java", "c", "h", "cpp", "cs", "go", "rs", "php", "rb", "sql", "sh", "log", "tex", "ino", "kt", "swift", "r"];

    function kindOf(item) {
        var mime = (item.mimeType || "").toLowerCase();
        var ext = extOf(item.name);
        if (mime === "application/pdf" || ext === "pdf") return { cls: "t-pdf", ico: "file-text", preview: "pdf" };
        if (/^image\/(png|jpe?g|gif|webp)$/.test(mime)) return { cls: "t-image", ico: "image", preview: "image" };
        if (mime.indexOf("image/") === 0) return { cls: "t-image", ico: "image", preview: null };
        if (mime.indexOf("video/") === 0) return { cls: "t-video", ico: "video", preview: "video" };
        if (mime.indexOf("audio/") === 0) return { cls: "t-audio", ico: "music", preview: "audio" };
        if (["doc", "docx", "odt", "rtf"].indexOf(ext) !== -1) return { cls: "t-doc", ico: "file-text", preview: null };
        if (["xls", "xlsx", "ods"].indexOf(ext) !== -1) return { cls: "t-sheet", ico: "table", preview: null };
        if (["ppt", "pptx", "odp"].indexOf(ext) !== -1) return { cls: "t-slide", ico: "presentation", preview: null };
        if (["zip", "rar", "7z", "tar", "gz"].indexOf(ext) !== -1) return { cls: "t-archive", ico: "archive", preview: null };
        if (mime === "text/plain" || CODE_EXT.indexOf(ext) !== -1) return { cls: "t-code", ico: "file-code", preview: "text" };
        return { cls: "t-file", ico: "file", preview: null };
    }

    function contentUrl(item, download) {
        return "/api/drive/files/" + item.id + "/content" + (download ? "?download=true" : "");
    }

    // ------------------------------------------------------------------
    // Routing: #/files, #/folder/<id>, #/recent, #/starred, #/trash
    // ------------------------------------------------------------------

    function parseHash() {
        var parts = (location.hash || "#/files").replace(/^#\/?/, "").split("/");
        var view = parts[0] || "files";
        if (view === "folder" && parts[1]) return { view: "files", folderId: parts[1] };
        if (["recent", "starred", "trash"].indexOf(view) !== -1) return { view: view, folderId: null };
        return { view: "files", folderId: null };
    }

    function go(view, folderId) {
        var hash = view === "files" ? (folderId ? "#/folder/" + folderId : "#/files") : "#/" + view;
        if (location.hash === hash) load(); else location.hash = hash;
    }

    window.addEventListener("hashchange", function () {
        document.getElementById("driveSearch").value = "";
        state.query = "";
        applyRoute();
    });

    function applyRoute() {
        var route = parseHash();
        state.view = route.view;
        state.folderId = route.folderId;
        state.selected = null;
        document.querySelectorAll("#driveNav a").forEach(function (a) { a.classList.toggle("active", a.dataset.view === state.view); });
        load();
    }

    // ------------------------------------------------------------------
    // Loading
    // ------------------------------------------------------------------

    function load() {
        var token = ++state.token;
        var url;
        if (state.query) url = "/api/drive/items?q=" + encodeURIComponent(state.query);
        else if (state.view === "files") url = "/api/drive/items?view=files" + (state.folderId ? "&parent=" + state.folderId : "");
        else url = "/api/drive/items?view=" + state.view;

        var requests = [api(url)];
        if (state.view === "files" && state.folderId && !state.query) requests.push(api("/api/drive/items/" + state.folderId));

        document.getElementById("emptyTrashBtn").classList.toggle("hidden", state.view !== "trash" || !!state.query);
        if (!state.items.length) { App.clear(content); content.appendChild(h("div", { class: "spinner" })); }

        Promise.all(requests).then(function (result) {
            if (token !== state.token) return;
            state.items = result[0];
            drawCrumbs(result[1] || null);
            render();
        }).catch(function (error) {
            if (token !== state.token) return;
            if (error.status === 404 && state.folderId) { go("files", null); return; }
            App.clear(content);
            content.appendChild(h("div", { class: "empty" }, h("div", { class: "empty-icon" }, icon("triangle-alert")), h("h3", {}, t("err.title")), h("p", {}, error.message)));
            App.refreshIcons();
        });
    }

    function loadUsage() {
        api("/api/drive/usage").then(function (u) {
            maxBytes = u.maxFileBytes;
            var pct = Math.min(100, Math.round(u.usedBytes / u.quotaBytes * 100));
            document.getElementById("storageFill").style.width = Math.max(pct, u.usedBytes ? 2 : 0) + "%";
            document.getElementById("storageText").textContent = t("lib.storage", { used: App.formatSize(u.usedBytes), total: App.formatSize(u.quotaBytes) });
        }).catch(function () { /* optional */ });
    }

    function refresh() { loadUsage(); load(); }

    // ------------------------------------------------------------------
    // Breadcrumbs
    // ------------------------------------------------------------------

    function drawCrumbs(details) {
        App.clear(crumbs);
        function sep() { return icon("chevron-right"); }

        function crumb(label, folderId, current) {
            var btn = h("button", { type: "button", class: current ? "current" : "" }, label);
            if (!current) btn.addEventListener("click", function () { go("files", folderId); });
            attachDrop(btn, folderId, "drop");
            return btn;
        }

        if (state.query) {
            crumbs.appendChild(h("button", { type: "button", class: "current" }, t("lib.searchResults", { q: state.query })));
        } else if (state.view !== "files") {
            var titles = { recent: "lib.recent", starred: "lib.starred", trash: "lib.trash" };
            crumbs.appendChild(h("button", { type: "button", class: "current" }, t(titles[state.view])));
        } else if (!details) {
            crumbs.appendChild(crumb(t("lib.myLibrary"), null, true));
        } else {
            crumbs.appendChild(crumb(t("lib.myLibrary"), null, false));
            details.path.forEach(function (p) { crumbs.appendChild(sep()); crumbs.appendChild(crumb(p.name, p.id, false)); });
            crumbs.appendChild(sep());
            crumbs.appendChild(crumb(details.item.name, details.item.id, true));
        }
        App.refreshIcons();
    }

    // ------------------------------------------------------------------
    // Rendering
    // ------------------------------------------------------------------

    function sorted(list) {
        var key = state.sort.key, dir = state.sort.dir;
        var keepServerOrder = state.view === "recent" || state.view === "trash" || !!state.query;
        if (keepServerOrder) return list.slice();
        return list.slice().sort(function (a, b) {
            if (a.type !== b.type) return a.type === "FOLDER" ? -1 : 1;
            var x, y;
            if (key === "size") { x = a.sizeBytes; y = b.sizeBytes; }
            else if (key === "updatedAt") { x = Date.parse(a.updatedAt); y = Date.parse(b.updatedAt); }
            else { x = a.name.toLowerCase(); y = b.name.toLowerCase(); }
            return (x < y ? -1 : x > y ? 1 : 0) * dir;
        });
    }

    function render() {
        App.clear(content);
        document.getElementById("gridBtn").classList.toggle("active", state.mode === "grid");
        document.getElementById("listBtn").classList.toggle("active", state.mode === "list");

        if (!state.items.length) { content.appendChild(emptyState()); App.refreshIcons(); return; }

        var list = sorted(state.items);
        if (state.mode === "list") content.appendChild(renderList(list));
        else content.appendChild(renderGrid(list));
        App.refreshIcons();
    }

    function emptyState() {
        var info;
        if (state.query) info = ["search-x", t("lib.noResults"), t("lib.noResultsText")];
        else if (state.view === "trash") info = ["trash-2", t("lib.trashEmpty"), t("lib.trashEmptyText")];
        else if (state.view === "starred") info = ["star", t("lib.starredEmpty"), t("lib.starredEmptyText")];
        else if (state.view === "recent") info = ["clock", t("lib.recentEmpty"), t("lib.recentEmptyText")];
        else info = ["folder-open", t("lib.empty"), t("lib.emptyText")];

        var box = h("div", { class: "empty" }, h("div", { class: "empty-icon" }, icon(info[0])), h("h3", {}, info[1]), h("p", {}, info[2]));
        if (state.view === "files" && !state.query) {
            box.appendChild(h("div", { class: "row" },
                h("button", { type: "button", class: "btn btn-primary", onclick: pickFiles }, icon("upload"), t("lib.upload")),
                h("button", { type: "button", class: "btn btn-outline", onclick: newFolder }, icon("folder-plus"), t("lib.newFolder"))));
        }
        return box;
    }

    function renderGrid(list) {
        var wrap = h("div");
        var folders = list.filter(function (i) { return i.type === "FOLDER"; });
        var files = list.filter(function (i) { return i.type === "FILE"; });

        if (folders.length) {
            wrap.appendChild(h("div", { class: "section-title" }, t("lib.folders")));
            wrap.appendChild(h("div", { class: "grid" }, folders.map(folderCard)));
        }
        if (files.length) {
            wrap.appendChild(h("div", { class: "section-title" }, t("lib.files")));
            wrap.appendChild(h("div", { class: "grid" }, files.map(fileCard)));
        }
        return wrap;
    }

    function moreButton(item) {
        return h("button", {
            type: "button", class: "icon-btn sm more-btn", "aria-label": t("common.more"),
            onclick: function (event) { event.stopPropagation(); select(item.id); openItemMenu(item, event.currentTarget); }
        }, icon("ellipsis-vertical"));
    }

    function bindItem(el, item) {
        el.dataset.id = item.id;
        el.tabIndex = 0;
        el.addEventListener("click", function () { if (coarse) openItem(item); else select(item.id); });
        el.addEventListener("dblclick", function () { openItem(item); });
        el.addEventListener("keydown", function (e) { if (e.key === "Enter") openItem(item); });
        el.addEventListener("contextmenu", function (e) { e.preventDefault(); select(item.id); openItemMenu(item, e); });

        if (state.view !== "trash") {
            el.draggable = true;
            el.addEventListener("dragstart", function (e) {
                dragged = item;
                el.classList.add("dragging");
                e.dataTransfer.setData("text/plain", item.name);
                e.dataTransfer.effectAllowed = "move";
            });
            el.addEventListener("dragend", function () { dragged = null; el.classList.remove("dragging"); });
        }
        if (item.type === "FOLDER" && state.view !== "trash") attachDrop(el, item.id, "drop");
    }

    function folderCard(item) {
        var card = h("div", { class: "folder-card" + (state.selected === item.id ? " selected" : "") },
            icon("folder", "folder-ico"),
            h("span", { class: "name", title: item.name }, item.name),
            item.starred ? icon("star", "star-mark") : null,
            moreButton(item));
        bindItem(card, item);
        return card;
    }

    function fileCard(item) {
        var kind = kindOf(item);
        var preview = h("div", { class: "preview" });
        if (kind.preview === "image" && state.view !== "trash") {
            preview.appendChild(h("img", { src: contentUrl(item), alt: "", loading: "lazy" }));
        } else {
            preview.appendChild(h("span", { class: "type-ico " + kind.cls }, icon(kind.ico)));
        }
        var card = h("div", { class: "file-card" + (state.selected === item.id ? " selected" : "") },
            preview,
            h("div", { class: "foot" },
                h("span", { class: "mini-ico " + kind.cls }, icon(kind.ico)),
                h("span", { class: "name", title: item.name }, item.name),
                item.starred ? icon("star", "star-mark") : null,
                moreButton(item)));
        bindItem(card, item);
        return card;
    }

    function renderList(list) {
        function th(label, key, cls) {
            var arrow = state.sort.key === key ? (state.sort.dir === 1 ? " ↑" : " ↓") : "";
            var cell = h("th", { class: (key ? "" : "noclick ") + (cls || "") }, label + arrow);
            if (key) cell.addEventListener("click", function () {
                state.sort = { key: key, dir: state.sort.key === key ? -state.sort.dir : 1 };
                render();
            });
            return cell;
        }

        var trash = state.view === "trash";
        var head = h("tr", {}, th(t("lib.colName"), "name"),
            state.view === "files" && !state.query ? null : th(t("lib.colLocation"), null, "hide-sm"),
            th(trash ? t("lib.colDeleted") : t("lib.colModified"), "updatedAt", "hide-sm"),
            th(t("lib.colSize"), "size", "hide-sm"), th("", null));
        var body = h("tbody");

        list.forEach(function (item) {
            var isFolder = item.type === "FOLDER";
            var kind = isFolder ? { cls: "t-archive", ico: "folder" } : kindOf(item);
            var row = h("tr", { class: state.selected === item.id ? "selected" : "" },
                h("td", { class: "name-cell" }, h("div", {},
                    h("span", { class: "mini-ico " + (isFolder ? "" : kind.cls), style: isFolder ? { color: "var(--primary)" } : null }, icon(kind.ico)),
                    h("span", { class: "nm", title: item.name }, item.name),
                    item.starred ? icon("star", "star-mark") : null)),
                state.view === "files" && !state.query ? null : h("td", { class: "hide-sm" }, item.parentName || t("lib.myLibrary")),
                h("td", { class: "hide-sm" }, App.fullDate(trash && item.trashedAt ? item.trashedAt : item.updatedAt)),
                h("td", { class: "hide-sm" }, isFolder ? "—" : App.formatSize(item.sizeBytes)),
                h("td", {}, moreButton(item)));
            bindItem(row, item);
            body.appendChild(row);
        });
        return h("table", { class: "list" }, h("thead", {}, head), body);
    }

    function select(id) {
        state.selected = id;
        content.querySelectorAll("[data-id]").forEach(function (el) { el.classList.toggle("selected", el.dataset.id === id); });
    }

    function findItem(id) {
        return state.items.filter(function (i) { return i.id === id; })[0];
    }

    // ------------------------------------------------------------------
    // Actions
    // ------------------------------------------------------------------

    function openItem(item) {
        if (state.view === "trash") { App.toast(t("lib.restoreFirst")); return; }
        if (item.type === "FOLDER") { go("files", item.id); return; }
        preview(item);
    }

    function openItemMenu(item, anchor) {
        var isFolder = item.type === "FOLDER";
        var entries;
        if (state.view === "trash") {
            entries = [
                { label: t("lib.restore"), icon: "undo-2", onClick: function () { restore(item); } },
                { label: t("lib.deleteForever"), icon: "trash-2", danger: true, onClick: function () { deleteForever(item); } }
            ];
        } else {
            entries = [
                { label: isFolder ? t("lib.open") : t("lib.preview"), icon: isFolder ? "folder-open" : "eye", onClick: function () { openItem(item); } },
                isFolder ? null : { label: t("common.download"), icon: "download", onClick: function () { window.location.href = contentUrl(item, true); } },
                "-",
                { label: t("lib.rename"), icon: "pencil", onClick: function () { rename(item); } },
                { label: t("lib.move"), icon: "folder-input", onClick: function () { moveDialog(item); } },
                { label: item.starred ? t("lib.unstar") : t("lib.star"), icon: "star", onClick: function () { toggleStar(item); } },
                "-",
                { label: t("lib.toTrash"), icon: "trash-2", danger: true, onClick: function () { trash(item); } }
            ];
        }
        App.menu(anchor, entries);
    }

    function toggleStar(item) {
        api("/api/drive/items/" + item.id, { method: "PATCH", body: { starred: !item.starred } })
            .then(load).catch(function (e) { App.toast(e.message, "error"); });
    }

    function trash(item) {
        api("/api/drive/items/" + item.id + "/trash", { method: "POST" }).then(function () {
            App.toast(t("lib.trashed", { name: item.name }), "success");
            refresh();
        }).catch(function (e) { App.toast(e.message, "error"); });
    }

    function restore(item) {
        api("/api/drive/items/" + item.id + "/restore", { method: "POST" }).then(function () {
            App.toast(t("lib.restored", { name: item.name }), "success");
            refresh();
        }).catch(function (e) { App.toast(e.message, "error"); });
    }

    function deleteForever(item) {
        App.confirm({ title: t("lib.deleteForever"), message: t("lib.deleteForeverText", { name: item.name }), confirmText: t("lib.deleteForever"), danger: true }).then(function (ok) {
            if (!ok) return;
            api("/api/drive/items/" + item.id, { method: "DELETE" }).then(function () {
                App.toast(t("lib.deleted"), "success");
                refresh();
            }).catch(function (e) { App.toast(e.message, "error"); });
        });
    }

    function textDialog(title, label, initial, confirmLabel, onSubmit) {
        var input = h("input", { class: "input", maxlength: "255", value: initial || "", required: true });
        var status = h("p", { class: "status-line error" });
        var form = h("form", {}, h("div", { class: "field" }, h("label", {}, label), input), status);
        var dialog = App.modal({
            title: title, size: "small", body: form,
            actions: [
                { label: t("common.cancel"), kind: "btn-secondary" },
                { id: "ok", label: confirmLabel, kind: "btn-primary", close: false, onClick: function () { form.requestSubmit(); return false; } }
            ]
        });
        form.addEventListener("submit", function (event) {
            event.preventDefault();
            var value = input.value.trim();
            if (!value) return;
            dialog.buttons.ok.disabled = true;
            onSubmit(value).then(function () { dialog.close(); }).catch(function (e) {
                status.textContent = e.message;
                dialog.buttons.ok.disabled = false;
            });
        });
        if (initial) {
            var dot = initial.lastIndexOf(".");
            setTimeout(function () { input.focus(); input.setSelectionRange(0, dot > 0 ? dot : initial.length); }, 40);
        }
    }

    function newFolder() {
        textDialog(t("lib.newFolder"), t("lib.folderName"), "", t("lib.create"), function (name) {
            return api("/api/drive/folders", { method: "POST", body: { name: name, parentId: state.view === "files" ? state.folderId : null } })
                .then(function () { App.toast(t("lib.folderCreated"), "success"); refresh(); });
        });
    }

    function rename(item) {
        textDialog(t("lib.rename"), t("lib.newName"), item.name, t("lib.save"), function (name) {
            return api("/api/drive/items/" + item.id, { method: "PATCH", body: { name: name } }).then(load);
        });
    }

    // folder picker used by "Move to..."
    function moveDialog(item) {
        var stack = [];          // [{id, name}]
        var list = h("div", { class: "picker-list" });
        var pathEl = h("div", { class: "picker-path" });
        var body = h("div", {}, pathEl, list);
        var dialog = App.modal({
            title: t("lib.moveTitle", { name: item.name }), body: body, autofocus: false,
            actions: [
                { label: t("common.cancel"), kind: "btn-secondary" },
                {
                    id: "here", label: t("lib.moveHere"), kind: "btn-primary", close: false,
                    onClick: function () {
                        var target = stack.length ? stack[stack.length - 1].id : null;
                        api("/api/drive/items/" + item.id + "/move", { method: "POST", body: { parentId: target } }).then(function () {
                            dialog.close();
                            App.toast(t("lib.moved"), "success");
                            refresh();
                        }).catch(function (e) { App.toast(e.message, "error"); });
                        return false;
                    }
                }
            ]
        });

        function show() {
            var parent = stack.length ? stack[stack.length - 1].id : null;
            App.clear(pathEl);
            if (stack.length) {
                pathEl.appendChild(h("button", { type: "button", class: "icon-btn sm", "aria-label": t("common.back"), onclick: function () { stack.pop(); show(); } }, icon("arrow-left")));
            }
            pathEl.appendChild(h("span", {}, stack.length ? stack[stack.length - 1].name : t("lib.myLibrary")));
            App.clear(list);
            list.appendChild(h("div", { class: "spinner" }));
            var sameParent = (item.parentId || null) === parent;
            dialog.buttons.here.disabled = sameParent;
            api("/api/drive/items?view=files" + (parent ? "&parent=" + parent : "")).then(function (items) {
                App.clear(list);
                var folders = items.filter(function (i) { return i.type === "FOLDER"; });
                if (!folders.length) list.appendChild(h("p", { class: "muted", style: { padding: "10px" } }, t("lib.noSubfolders")));
                folders.forEach(function (f) {
                    var self = f.id === item.id;
                    list.appendChild(h("button", {
                        type: "button", disabled: self,
                        onclick: function () { stack.push({ id: f.id, name: f.name }); show(); }
                    }, icon("folder"), h("span", { class: "truncate" }, f.name)));
                });
                App.refreshIcons();
            });
            App.refreshIcons();
        }
        show();
    }

    // ------------------------------------------------------------------
    // Drag and drop (moving items)
    // ------------------------------------------------------------------

    function attachDrop(el, folderId, cls) {
        el.addEventListener("dragover", function (e) {
            if (!dragged || dragged.id === folderId) return;
            e.preventDefault();
            el.classList.add(cls);
        });
        el.addEventListener("dragleave", function () { el.classList.remove(cls); });
        el.addEventListener("drop", function (e) {
            el.classList.remove(cls);
            if (!dragged || dragged.id === folderId) return;
            e.preventDefault();
            e.stopPropagation();
            var item = dragged;
            dragged = null;
            if ((item.parentId || null) === (folderId || null)) return;
            api("/api/drive/items/" + item.id + "/move", { method: "POST", body: { parentId: folderId } })
                .then(function () { App.toast(t("lib.moved"), "success"); refresh(); })
                .catch(function (err) { App.toast(err.message, "error"); });
        });
    }

    // ------------------------------------------------------------------
    // Upload
    // ------------------------------------------------------------------

    var queue = [];
    var uploading = false;
    var panel = document.getElementById("uploadPanel");
    var uploadList = document.getElementById("uploadList");

    function pickFiles() { document.getElementById("filePicker").click(); }

    function enqueue(files) {
        var parentId = state.view === "files" ? state.folderId : null;
        Array.prototype.forEach.call(files, function (file) {
            var row = h("div", { class: "upload-item" },
                h("div", { class: "row" }, h("span", { class: "truncate" }, file.name), h("small", { class: "muted" }, App.formatSize(file.size))),
                h("div", { class: "bar" }, h("div")));
            uploadList.appendChild(row);
            var entry = { file: file, parentId: parentId, row: row };
            if (maxBytes && file.size > maxBytes) {
                fail(entry, t("lib.tooBig", { mb: Math.round(maxBytes / 1048576) }));
            } else {
                queue.push(entry);
            }
        });
        panel.classList.remove("hidden");
        updateUploadTitle();
        next();
    }

    function fail(entry, message) {
        entry.row.classList.add("error");
        entry.row.appendChild(h("small", { class: "err" }, message));
    }

    function updateUploadTitle() {
        var total = uploadList.children.length;
        var done = uploadList.querySelectorAll(".done, .error").length;
        document.getElementById("uploadTitle").textContent = done >= total ? t("lib.uploadDone") : t("lib.uploading", { done: done, total: total });
    }

    function next() {
        if (uploading || !queue.length) return;
        var entry = queue.shift();
        uploading = true;

        var data = new FormData();
        data.append("files", entry.file, entry.file.name);
        if (entry.parentId) data.append("parentId", entry.parentId);

        var xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/drive/files");
        xhr.upload.onprogress = function (e) {
            if (e.lengthComputable) entry.row.querySelector(".bar div").style.width = Math.round(e.loaded / e.total * 100) + "%";
        };
        xhr.onload = function () {
            if (xhr.status === 401) { window.location.href = "/"; return; }
            if (xhr.status >= 200 && xhr.status < 300) {
                entry.row.classList.add("done");
                entry.row.querySelector(".bar div").style.width = "100%";
            } else {
                var message = t("err.generic");
                try { message = JSON.parse(xhr.responseText).message || message; } catch (e) { /* not JSON */ }
                if (xhr.status === 413) message = t("err.tooLarge");
                fail(entry, message);
            }
            finishOne();
        };
        xhr.onerror = function () { fail(entry, t("err.network")); finishOne(); };
        xhr.send(data);
    }

    function finishOne() {
        uploading = false;
        updateUploadTitle();
        if (queue.length) { next(); return; }
        refresh();
    }

    // ------------------------------------------------------------------
    // Preview
    // ------------------------------------------------------------------

    function preview(item) {
        var files = sorted(state.items).filter(function (i) { return i.type === "FILE"; });
        var index = files.indexOf(item);
        var stage = h("div", { class: "preview-stage" });
        var dialog;
        var keyHandler;

        function show(i) {
            index = i;
            var current = files[index];
            App.clear(stage);
            if (dialog) dialog.el.querySelector("h2").textContent = current.name;
            var kind = kindOf(current);

            if (kind.preview === "image") stage.appendChild(h("img", { src: contentUrl(current), alt: current.name }));
            else if (kind.preview === "pdf") stage.appendChild(h("iframe", { src: contentUrl(current), title: current.name }));
            else if (kind.preview === "video") stage.appendChild(h("video", { src: contentUrl(current), controls: true }));
            else if (kind.preview === "audio") stage.appendChild(h("audio", { src: contentUrl(current), controls: true }));
            else if (kind.preview === "text" && current.sizeBytes <= 1024 * 1024) {
                var pre = h("pre", {}, t("common.loading"));
                stage.appendChild(pre);
                fetch(contentUrl(current)).then(function (r) { return r.text(); }).then(function (text) { if (files[index] === current) pre.textContent = text; });
            } else {
                stage.appendChild(h("div", { class: "preview-none" },
                    h("span", { class: "type-ico mini-ico " + kind.cls, style: { width: "64px", height: "64px" } }, icon(kind.ico)),
                    h("strong", {}, current.name),
                    h("span", {}, t("lib.noPreview")),
                    h("a", { class: "btn btn-primary", href: contentUrl(current, true) }, icon("download"), t("common.download"))));
            }

            if (files.length > 1) {
                stage.appendChild(h("button", { type: "button", class: "icon-btn preview-nav prev", "aria-label": t("common.previous"), onclick: function () { show((index - 1 + files.length) % files.length); } }, icon("chevron-left")));
                stage.appendChild(h("button", { type: "button", class: "icon-btn preview-nav next", "aria-label": t("common.next"), onclick: function () { show((index + 1) % files.length); } }, icon("chevron-right")));
            }
            App.refreshIcons();
        }

        dialog = App.modal({
            title: item.name, size: "wide", body: stage, autofocus: false,
            onClose: function () { document.removeEventListener("keydown", keyHandler); },
            actions: [
                { label: t("common.download"), kind: "btn-secondary", close: false, onClick: function () { window.location.href = contentUrl(files[index], true); } },
                { label: t("common.close"), kind: "btn-primary" }
            ]
        });
        keyHandler = function (e) {
            if (files.length < 2) return;
            if (e.key === "ArrowLeft") show((index - 1 + files.length) % files.length);
            if (e.key === "ArrowRight") show((index + 1) % files.length);
        };
        document.addEventListener("keydown", keyHandler);
        show(index);
    }

    // ------------------------------------------------------------------
    // Wiring
    // ------------------------------------------------------------------

    document.getElementById("newBtn").addEventListener("click", function (event) {
        App.menu(event.currentTarget, [
            { label: t("lib.newFolder"), icon: "folder-plus", onClick: newFolder },
            { label: t("lib.upload"), icon: "upload", onClick: pickFiles }
        ]);
    });

    document.getElementById("filePicker").addEventListener("change", function (event) {
        enqueue(event.target.files);
        event.target.value = "";
    });

    document.getElementById("emptyTrashBtn").addEventListener("click", function () {
        App.confirm({ title: t("lib.emptyTrash"), message: t("lib.emptyTrashText"), confirmText: t("lib.emptyTrash"), danger: true }).then(function (ok) {
            if (!ok) return;
            api("/api/drive/trash", { method: "DELETE" }).then(function () { App.toast(t("lib.trashEmptied"), "success"); refresh(); })
                .catch(function (e) { App.toast(e.message, "error"); });
        });
    });

    document.getElementById("uploadClose").addEventListener("click", function () {
        panel.classList.add("hidden");
        App.clear(uploadList);
    });

    document.querySelectorAll(".segmented button[data-mode]").forEach(function (button) {
        button.addEventListener("click", function () {
            state.mode = button.dataset.mode;
            try { localStorage.setItem(MODE_KEY, state.mode); } catch (e) { /* ignore */ }
            render();
        });
    });

    document.getElementById("driveSearch").addEventListener("input", App.debounce(function (event) {
        state.query = event.target.value.trim();
        load();
    }, 300));

    // clicking empty space clears the selection
    document.getElementById("driveScroll").addEventListener("click", function (event) {
        if (event.target.closest("[data-id]")) return;
        state.selected = null;
        content.querySelectorAll(".selected").forEach(function (el) { el.classList.remove("selected"); });
    });

    // dropping files from the computer anywhere on the page uploads them
    var overlay = document.getElementById("dropOverlay");
    var dragDepth = 0;
    function hasFiles(e) { return e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], "Files") !== -1; }
    document.addEventListener("dragenter", function (e) { if (hasFiles(e)) { dragDepth++; overlay.classList.remove("hidden"); } });
    document.addEventListener("dragleave", function (e) { if (hasFiles(e)) { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) overlay.classList.add("hidden"); } });
    document.addEventListener("dragover", function (e) { if (hasFiles(e)) e.preventDefault(); });
    document.addEventListener("drop", function (e) {
        if (!hasFiles(e)) return;
        e.preventDefault();
        dragDepth = 0;
        overlay.classList.add("hidden");
        if (e.dataTransfer.files.length) enqueue(e.dataTransfer.files);
    });

    document.addEventListener("langchange", function () { applyRoute(); loadUsage(); updateUploadTitle(); });

    applyRoute();
    loadUsage();
})();
