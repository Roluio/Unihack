/*
 * Buddy - student memory
 *
 * The student's files live in the browser (IndexedDB / localStorage), so this
 * module scans them and builds a catalog the AI can reason about:
 *
 *   - Library files            (IndexedDB "UniBuddyLibrary" / items)
 *   - Files attached to posts  (IndexedDB "UniBuddyForumFiles_<user>" / files)
 *   - The student's own forum posts, as text (localStorage)
 *
 * Only names and metadata go to the router step; the actual file bytes are
 * uploaded only for the few files the AI decides it needs (or the student pins).
 */
(function () {
    "use strict";

    var LIBRARY_DB = "UniBuddyLibrary";
    var LIBRARY_STORE = "items";

    var TEXT_EXT = [
        "txt", "md", "csv", "html", "htm", "py", "js", "ts", "java", "c", "h",
        "cpp", "hpp", "cs", "go", "rs", "php", "rb", "sql", "sh", "json", "xml",
        "yml", "yaml", "css", "tex", "log", "ino", "kt", "swift", "r"
    ];
    var MIME_BY_EXT = {
        pdf: "application/pdf", png: "image/png", jpg: "image/jpeg",
        jpeg: "image/jpeg", webp: "image/webp"
    };

    var MAX_FILE_BYTES = 15 * 1024 * 1024;

    function ext(name) {
        var parts = String(name || "").split(".");
        return parts.length > 1 ? parts.pop().toLowerCase() : "";
    }

    function mimeFor(name, declared) {
        var e = ext(name);
        if (MIME_BY_EXT[e]) return MIME_BY_EXT[e];
        if (TEXT_EXT.indexOf(e) !== -1) return "text/plain";
        return declared || "application/octet-stream";
    }

    function isSupported(name, size) {
        var e = ext(name);
        var okType = !!MIME_BY_EXT[e] || TEXT_EXT.indexOf(e) !== -1;
        return okType && (size || 0) <= MAX_FILE_BYTES;
    }

    function databaseExists(name) {
        if (!indexedDB.databases) return Promise.resolve(true);
        return indexedDB.databases().then(function (list) {
            return list.some(function (db) { return db.name === name; });
        }).catch(function () { return true; });
    }

    function openDb(name, store) {
        return databaseExists(name).then(function (exists) {
            if (!exists) return null;
            return new Promise(function (resolve) {
                var request = indexedDB.open(name);
                request.onsuccess = function () {
                    var db = request.result;
                    if (!db.objectStoreNames.contains(store)) {
                        db.close();
                        resolve(null);
                    } else {
                        resolve(db);
                    }
                };
                request.onerror = function () { resolve(null); };
            });
        });
    }

    function readAll(db, store) {
        return new Promise(function (resolve) {
            var request = db.transaction(store, "readonly").objectStore(store).getAll();
            request.onsuccess = function () { resolve(request.result || []); };
            request.onerror = function () { resolve([]); };
        });
    }

    function readOne(db, store, key) {
        return new Promise(function (resolve) {
            var request = db.transaction(store, "readonly").objectStore(store).get(key);
            request.onsuccess = function () { resolve(request.result || null); };
            request.onerror = function () { resolve(null); };
        });
    }

    // ------------------------------------------------------------------
    // Catalog
    // ------------------------------------------------------------------

    function scanLibrary() {
        return openDb(LIBRARY_DB, LIBRARY_STORE).then(function (db) {
            if (!db) return [];
            return readAll(db, LIBRARY_STORE).then(function (items) {
                db.close();

                var folders = {};
                items.forEach(function (item) {
                    if (item.type === "folder") folders[item.id] = item.name;
                });

                return items
                    .filter(function (item) {
                        return item.type === "file" && !item.trashed && item.blob;
                    })
                    .map(function (item) {
                        return {
                            key: "lib:" + item.id,
                            source: "library",
                            id: item.id,
                            name: item.name,
                            mime: mimeFor(item.name, item.mime),
                            size: item.size || item.blob.size || 0,
                            folder: item.parentId ? (folders[item.parentId] || "") : "",
                            createdAt: item.createdAt || 0,
                            supported: isSupported(item.name, item.size || item.blob.size)
                        };
                    });
            });
        });
    }

    function loadPosts(username) {
        try {
            var raw = localStorage.getItem("UniBuddyForumDemo_" + username);
            var posts = raw ? JSON.parse(raw) : [];
            return Array.isArray(posts) ? posts : [];
        } catch (e) {
            return [];
        }
    }

    function scanForum(username) {
        var mine = loadPosts(username).filter(function (post) {
            return post && post.userId === username;
        });

        var entries = [];

        mine.forEach(function (post) {
            var text = [post.title, post.content].filter(Boolean).join("\n\n");
            if (text.trim()) {
                entries.push({
                    key: "post:" + post.id,
                    source: "forum",
                    id: post.id,
                    name: "Postare: " + String(post.title || "fără titlu").slice(0, 80),
                    mime: "text/plain",
                    size: text.length,
                    folder: post.category || "Forum",
                    createdAt: post.createdAt || 0,
                    supported: true,
                    _text: text
                });
            }

            (post.attachments || []).forEach(function (attachment) {
                entries.push({
                    key: "att:" + attachment.id,
                    source: "forum",
                    id: attachment.id,
                    name: attachment.name,
                    mime: mimeFor(attachment.name, attachment.type),
                    size: attachment.size || 0,
                    folder: "Forum: " + String(post.title || "").slice(0, 40),
                    createdAt: post.createdAt || 0,
                    supported: isSupported(attachment.name, attachment.size)
                });
            });
        });

        return entries;
    }

    var cache = [];

    function scan(username) {
        return Promise.all([scanLibrary(), Promise.resolve(scanForum(username))])
            .then(function (groups) {
                cache = groups[0].concat(groups[1]).sort(function (a, b) {
                    return (b.createdAt || 0) - (a.createdAt || 0);
                });
                return cache;
            })
            .catch(function () {
                cache = [];
                return cache;
            });
    }

    // What the server receives: metadata only (no bytes, no private text).
    function catalog() {
        return cache.map(function (item) {
            return {
                key: item.key, source: item.source, name: item.name,
                mime: item.mime, folder: item.folder, supported: item.supported
            };
        });
    }

    // ------------------------------------------------------------------
    // Reading file bytes
    // ------------------------------------------------------------------

    function getBlob(item, username) {
        if (item._text !== undefined) {
            return Promise.resolve(new File([item._text], item.name + ".txt", { type: "text/plain" }));
        }

        if (item.source === "library") {
            return openDb(LIBRARY_DB, LIBRARY_STORE).then(function (db) {
                if (!db) return null;
                return readOne(db, LIBRARY_STORE, item.id).then(function (record) {
                    db.close();
                    if (!record || !record.blob) return null;
                    return new File([record.blob], item.name, { type: item.mime });
                });
            });
        }

        var dbName = "UniBuddyForumFiles_" + username;
        return openDb(dbName, "files").then(function (db) {
            if (!db) return null;
            return readOne(db, "files", item.id).then(function (blob) {
                db.close();
                if (!blob) return null;
                return new File([blob], item.name, { type: item.mime });
            });
        });
    }

    function byKey(key) {
        for (var i = 0; i < cache.length; i++) if (cache[i].key === key) return cache[i];
        return null;
    }

    // keys -> [File] (skips unsupported / missing files, keeps total under limit)
    function filesFor(keys, username) {
        var budget = 20 * 1024 * 1024;

        return keys.reduce(function (chain, key) {
            return chain.then(function (acc) {
                var item = byKey(key);
                if (!item || !item.supported || acc.length >= 4) return acc;

                return getBlob(item, username).then(function (file) {
                    if (file && file.size <= budget) {
                        budget -= file.size;
                        acc.push(file);
                    }
                    return acc;
                });
            });
        }, Promise.resolve([]));
    }

    window.StudyGramMemory = {
        scan: scan,
        catalog: catalog,
        items: function () { return cache.slice(); },
        byKey: byKey,
        filesFor: filesFor
    };
})();
