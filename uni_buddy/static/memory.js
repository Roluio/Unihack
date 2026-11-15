/*
 * StudyGram - Buddy "memory" of the student's files.
 *
 * The files live in the student's Library (stored on the server). This module
 * lists them for Buddy and downloads only the few files the AI decides it needs.
 * Only names and metadata go to the router step; file bytes are uploaded only
 * for the files that are actually used.
 */
(function () {
    "use strict";

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

    var cache = [];

    // Reads the catalog from the server (all non-trashed files of the student).
    function scan() {
        return fetch("/api/drive/items?view=all")
            .then(function (response) { return response.ok ? response.json() : []; })
            .then(function (items) {
                cache = (Array.isArray(items) ? items : []).map(function (item) {
                    return {
                        key: "lib:" + item.id,
                        source: "library",
                        id: item.id,
                        name: item.name,
                        mime: mimeFor(item.name, item.mimeType),
                        size: item.sizeBytes || 0,
                        folder: item.parentName || "",
                        createdAt: Date.parse(item.createdAt) || 0,
                        supported: isSupported(item.name, item.sizeBytes)
                    };
                }).sort(function (a, b) { return b.createdAt - a.createdAt; });
                return cache;
            })
            .catch(function () {
                cache = [];
                return cache;
            });
    }

    // What the AI router receives: metadata only (no bytes).
    function catalog() {
        return cache.map(function (item) {
            return {
                key: item.key, source: item.source, name: item.name,
                mime: item.mime, folder: item.folder, supported: item.supported
            };
        });
    }

    function getBlob(item) {
        return fetch("/api/drive/files/" + encodeURIComponent(item.id) + "/content?download=true")
            .then(function (response) { return response.ok ? response.blob() : null; })
            .then(function (blob) {
                return blob ? new File([blob], item.name, { type: item.mime }) : null;
            })
            .catch(function () { return null; });
    }

    function byKey(key) {
        for (var i = 0; i < cache.length; i++) if (cache[i].key === key) return cache[i];
        return null;
    }

    // keys -> [File] (skips unsupported / missing files, keeps the total under the limit)
    function filesFor(keys) {
        var budget = 20 * 1024 * 1024;

        return keys.reduce(function (chain, key) {
            return chain.then(function (acc) {
                var item = byKey(key);
                if (!item || !item.supported || acc.length >= 4) return acc;

                return getBlob(item).then(function (file) {
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
