// ==========================================
// BUDDY - MEMORY
//
// Lets the AI see the files the user has posted
// (Library + forum post attachments) and work on them.
//
// - The list of files is sent with every message,
//   so the AI always knows what exists.
// - Files pinned in the Memory panel are sent with
//   their content on every message.
// - A file named in the message is attached
//   automatically.
//
// Files live in the browser (IndexedDB), so text is
// extracted here and sent to /api/ai/chat.
// ==========================================

(function () {
    "use strict";

    const username = window.STUDYGRAM_USERNAME || "student";

    const PIN_KEY = "StudyGramAIMemory_" + username;

    // Storage names used by Library and Forum (unchanged on purpose,
    // renaming them would hide the files already uploaded).
    const LIBRARY_DB = "UniBuddyLibrary";
    const LIBRARY_STORE = "items";
    const FORUM_KEY = "UniBuddyForumDemo_" + username;
    const FORUM_DB = "UniBuddyForumFiles_" + username;
    const FORUM_STORE = "files";

    const MAX_FILES = 5;
    const MAX_TEXT_PER_FILE = 60000;
    const MAX_TEXT_TOTAL = 150000;
    const MAX_BINARY_PER_FILE = 8 * 1024 * 1024;
    const MAX_BINARY_TOTAL = 14 * 1024 * 1024;

    const TEXT_EXTENSIONS = new Set([
        "txt", "md", "markdown", "csv", "tsv", "json", "xml", "yml", "yaml",
        "html", "htm", "css", "js", "ts", "jsx", "tsx", "py", "java", "c",
        "h", "cpp", "hpp", "cs", "go", "rs", "rb", "php", "sql", "sh", "bat",
        "ps1", "tex", "log", "ini", "cfg", "toml", "r", "m", "kt", "swift",
        "asm", "vhd", "vhdl", "v", "ipynb"
    ]);

    const IMAGE_TYPES = {
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        jfif: "image/jpeg",
        webp: "image/webp"
    };

    const texts = {
        ro: {
            memory: "Memorie",
            memoryTitle: "Memoria lui Buddy",
            memoryIntro: "Buddy vede automat lista fișierelor tale. Bifează fișierele pe care vrei să le țină minte (conținutul lor se trimite la fiecare mesaj) sau scrie numele unui fișier în mesaj.",
            search: "Caută fișier...",
            all: "Bifează tot",
            clear: "Șterge selecția",
            done: "Gata",
            empty: "Nu ai încă fișiere în Library sau în postările tale.",
            noMatch: "Niciun fișier găsit.",
            library: "Library",
            post: "Postare",
            unreadable: "nu poate fi citit",
            tooLarge: "prea mare",
            limit: `Poți fixa cel mult ${MAX_FILES} fișiere.`,
            pinned: n => n === 1 ? "1 fișier în memorie" : `${n} fișiere în memorie`,
            remove: "Scoate din memorie",
            loading: "Se încarcă fișierele...",
            loadError: "Fișierele nu au putut fi citite.",
            skipped: name => `Fișierul „${name}” nu a putut fi citit și a fost ignorat.`,
            budget: name => `Fișierul „${name}” a fost ignorat (prea mult conținut).`,
            usedFiles: "Fișiere folosite"
        },
        en: {
            memory: "Memory",
            memoryTitle: "Buddy's memory",
            memoryIntro: "Buddy automatically sees the list of your files. Tick the files you want it to remember (their content is sent with every message) or write a file name in your message.",
            search: "Search files...",
            all: "Select all",
            clear: "Clear selection",
            done: "Done",
            empty: "You have no files in the Library or in your posts yet.",
            noMatch: "No file found.",
            library: "Library",
            post: "Post",
            unreadable: "cannot be read",
            tooLarge: "too large",
            limit: `You can pin at most ${MAX_FILES} files.`,
            pinned: n => n === 1 ? "1 file in memory" : `${n} files in memory`,
            remove: "Remove from memory",
            loading: "Loading files...",
            loadError: "Files could not be read.",
            skipped: name => `"${name}" could not be read and was skipped.`,
            budget: name => `"${name}" was skipped (too much content).`,
            usedFiles: "Files used"
        }
    };

    const cache = new Map();
    let knownFiles = [];

    function lang() {
        const select = document.getElementById("languageSelect");
        return select && select.value === "en" ? "en" : "ro";
    }

    const t = () => texts[lang()];

    // ------------------------------------------
    // IndexedDB helpers
    // ------------------------------------------
    // The stores are created with the same schema as the pages that own
    // them, so opening a database that does not exist yet is harmless.

    function openDatabase(name, store, keyPath) {
        return new Promise((resolve, reject) => {
            if (!window.indexedDB) {
                reject(new Error("IndexedDB is not available."));
                return;
            }

            const request = indexedDB.open(name, 1);

            request.onupgradeneeded = () => {
                if (!request.result.objectStoreNames.contains(store)) {
                    request.result.createObjectStore(
                        store,
                        keyPath ? { keyPath } : undefined
                    );
                }
            };

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    function request(db, store, action) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(store, "readonly");
            const req = action(tx.objectStore(store));

            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    // ------------------------------------------
    // File list
    // ------------------------------------------

    function extensionOf(name) {
        const parts = String(name).split(".");
        return parts.length > 1 ? parts.pop().toLowerCase() : "";
    }

    function kindOf(name) {
        const ext = extensionOf(name);

        if (TEXT_EXTENSIONS.has(ext)) return "text";
        if (ext === "docx") return "docx";
        if (ext === "pptx") return "pptx";
        if (ext === "pdf") return "pdf";
        if (IMAGE_TYPES[ext]) return "image";

        return "unsupported";
    }

    async function listLibraryFiles() {
        const db = await openDatabase(LIBRARY_DB, LIBRARY_STORE, "id");

        let items;

        try {
            items = await request(db, LIBRARY_STORE, store => store.getAll());
        } finally {
            db.close();
        }

        const byId = new Map(items.map(item => [item.id, item]));

        function ancestors(item) {
            const chain = [];
            let parentId = item.parentId;
            let guard = 0;

            while (parentId && guard++ < 30) {
                const parent = byId.get(parentId);
                if (!parent) break;

                chain.unshift(parent);
                parentId = parent.parentId;
            }

            return chain;
        }

        return items
            .filter(item => item.type === "file" && !item.trashed)
            .filter(item => !ancestors(item).some(folder => folder.trashed))
            .map(item => ({
                key: "library:" + item.id,
                source: "library",
                id: item.id,
                name: item.name,
                folder: ancestors(item).map(folder => folder.name).join(" / "),
                size: item.size || 0,
                createdAt: item.createdAt || 0
            }));
    }

    function listForumFiles() {
        let posts = [];

        try {
            posts = JSON.parse(localStorage.getItem(FORUM_KEY) || "[]");
        } catch (error) {
            return [];
        }

        if (!Array.isArray(posts)) return [];

        const files = [];

        for (const post of posts) {
            if (!post || post.userId !== username) continue;
            if (!Array.isArray(post.attachments)) continue;

            for (const attachment of post.attachments) {
                if (!attachment || !attachment.id || !attachment.name) continue;

                files.push({
                    key: "forum:" + attachment.id,
                    source: "forum",
                    id: attachment.id,
                    name: attachment.name,
                    folder: post.title || "",
                    size: attachment.size || 0,
                    createdAt: post.createdAt || 0
                });
            }
        }

        return files;
    }

    async function listFiles() {
        const files = [];

        try {
            files.push(...await listLibraryFiles());
        } catch (error) {
            console.warn("Memory: Library unavailable.", error);
        }

        files.push(...listForumFiles());

        files.sort((a, b) =>
            a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
        );

        knownFiles = files;
        return files;
    }

    // ------------------------------------------
    // Pinned files
    // ------------------------------------------

    function getPins() {
        try {
            const saved = JSON.parse(localStorage.getItem(PIN_KEY) || "[]");
            return Array.isArray(saved)
                ? saved.filter(key => typeof key === "string")
                : [];
        } catch (error) {
            return [];
        }
    }

    function setPins(keys) {
        try {
            localStorage.setItem(PIN_KEY, JSON.stringify(keys));
        } catch (error) {
            console.warn("Memory could not be saved.", error);
        }
    }

    // ------------------------------------------
    // Reading file content
    // ------------------------------------------

    async function loadBlob(entry) {
        if (entry.source === "library") {
            const db = await openDatabase(LIBRARY_DB, LIBRARY_STORE, "id");

            try {
                const item = await request(db, LIBRARY_STORE, store => store.get(entry.id));
                return item && item.blob ? item.blob : null;
            } finally {
                db.close();
            }
        }

        const db = await openDatabase(FORUM_DB, FORUM_STORE);

        try {
            return await request(db, FORUM_STORE, store => store.get(entry.id)) || null;
        } finally {
            db.close();
        }
    }

    function loadScript(url, globalName) {
        if (window[globalName]) return Promise.resolve(window[globalName]);

        return new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = url;
            script.onload = () => resolve(window[globalName]);
            script.onerror = () => reject(new Error("Could not load " + url));
            document.head.appendChild(script);
        });
    }

    function toBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = () => {
                const result = String(reader.result || "");
                resolve(result.slice(result.indexOf(",") + 1));
            };

            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(blob);
        });
    }

    function limitText(text) {
        const clean = String(text || "").replace(/\u0000/g, "").trim();

        return clean.length > MAX_TEXT_PER_FILE
            ? clean.slice(0, MAX_TEXT_PER_FILE) + "\n[...content truncated]"
            : clean;
    }

    async function pptxText(blob) {
        const JSZip = await loadScript(
            "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js",
            "JSZip"
        );

        const zip = await JSZip.loadAsync(blob);

        const slides = Object.keys(zip.files)
            .filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name))
            .sort((a, b) =>
                Number(a.match(/slide(\d+)/)[1]) - Number(b.match(/slide(\d+)/)[1])
            );

        const parts = [];

        for (let i = 0; i < slides.length; i++) {
            const xml = new DOMParser().parseFromString(
                await zip.files[slides[i]].async("string"),
                "application/xml"
            );

            const nodes = xml.getElementsByTagNameNS(
                "http://schemas.openxmlformats.org/drawingml/2006/main",
                "t"
            );

            parts.push(
                `--- Slide ${i + 1} ---\n` +
                Array.from(nodes).map(node => node.textContent).join("\n")
            );
        }

        return parts.join("\n\n");
    }

    // Returns { name, source, text | data+mime } or { error }.
    async function extract(entry) {
        if (cache.has(entry.key)) return cache.get(entry.key);

        const kind = kindOf(entry.name);
        let result;

        try {
            if (kind === "unsupported") {
                result = { error: "unreadable" };
            } else {
                const blob = await loadBlob(entry);

                if (!blob) {
                    result = { error: "unreadable" };
                } else if (kind === "text") {
                    result = { text: limitText(await blob.text()) };
                } else if (kind === "docx") {
                    const mammoth = await loadScript(
                        "https://unpkg.com/mammoth@1.9.1/mammoth.browser.min.js",
                        "mammoth"
                    );

                    const output = await mammoth.extractRawText({
                        arrayBuffer: await blob.arrayBuffer()
                    });

                    result = { text: limitText(output.value) };
                } else if (kind === "pptx") {
                    result = { text: limitText(await pptxText(blob)) };
                } else if (blob.size > MAX_BINARY_PER_FILE) {
                    result = { error: "tooLarge" };
                } else if (kind === "pdf") {
                    result = {
                        data: await toBase64(blob),
                        mime: "application/pdf",
                        bytes: blob.size
                    };
                } else {
                    result = {
                        data: await toBase64(blob),
                        mime: IMAGE_TYPES[extensionOf(entry.name)],
                        bytes: blob.size
                    };
                }

                if (result.text !== undefined && !result.text) {
                    result = { error: "unreadable" };
                }
            }
        } catch (error) {
            console.warn("Memory: could not read", entry.name, error);
            result = { error: "unreadable" };
        }

        if (!result.error) {
            result.name = entry.name;
            result.source = entry.source;
            cache.set(entry.key, result);
        }

        return result;
    }

    // ------------------------------------------
    // Used by ai.js for every message
    // ------------------------------------------

    function mentions(message, file) {
        const name = file.name.toLowerCase();

        if (message.includes(name)) return true;

        const base = name.replace(/\.[^.]+$/, "");
        return base.length >= 4 && message.includes(base);
    }

    async function collect(message) {
        const result = { files: [], index: [], used: [], warnings: [] };

        let files;

        try {
            files = await listFiles();
        } catch (error) {
            console.warn("Memory: file list failed.", error);
            return result;
        }

        result.index = files.map(file => ({
            name: file.name,
            folder: file.folder,
            source: file.source,
            size: file.size
        }));

        // Forget pins whose file no longer exists.
        const existing = new Set(files.map(file => file.key));
        const pins = getPins().filter(key => existing.has(key));

        if (pins.length !== getPins().length) {
            setPins(pins);
            renderChips();
        }

        const chosen = [];

        for (const key of pins) {
            const file = files.find(item => item.key === key);
            if (file) chosen.push(file);
        }

        const lower = message.toLowerCase();

        for (const file of files) {
            if (!chosen.includes(file) && mentions(lower, file)) {
                chosen.push(file);
            }
        }

        let textTotal = 0;
        let binaryTotal = 0;

        for (const file of chosen.slice(0, MAX_FILES)) {
            const data = await extract(file);

            if (data.error) {
                result.warnings.push(t().skipped(file.name));
                continue;
            }

            if (data.text !== undefined) {
                if (textTotal + data.text.length > MAX_TEXT_TOTAL) {
                    result.warnings.push(t().budget(file.name));
                    continue;
                }

                textTotal += data.text.length;
            } else {
                if (binaryTotal + data.bytes > MAX_BINARY_TOTAL) {
                    result.warnings.push(t().budget(file.name));
                    continue;
                }

                binaryTotal += data.bytes;
            }

            const payload = { name: data.name, source: data.source };

            if (data.text !== undefined) {
                payload.text = data.text;
            } else {
                payload.data = data.data;
                payload.mime = data.mime;
            }

            result.files.push(payload);
            result.used.push(data.name);
        }

        return result;
    }

    // ------------------------------------------
    // User interface
    // ------------------------------------------

    const icon = name => {
        const element = document.createElement("i");
        element.setAttribute("data-lucide", name);
        return element;
    };

    const refreshIcons = () => window.lucide && window.lucide.createIcons();

    function readableSize(bytes) {
        if (!bytes) return "";
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + " KB";
        return (bytes / 1024 / 1024).toFixed(1) + " MB";
    }

    function iconFor(name) {
        switch (kindOf(name)) {
            case "pdf": return "file-text";
            case "docx": return "file-type";
            case "pptx": return "presentation";
            case "image": return "image";
            case "text": return "file-code";
            default: return "file";
        }
    }

    function renderChips() {
        const bar = document.getElementById("memoryBar");
        const badge = document.getElementById("memoryBadge");
        const pins = getPins();

        if (badge) {
            badge.textContent = String(pins.length);
            badge.classList.toggle("hidden", pins.length === 0);
        }

        if (!bar) return;

        bar.replaceChildren();
        bar.classList.toggle("hidden", pins.length === 0);

        if (!pins.length) return;

        const label = document.createElement("span");
        label.className = "memory-bar-label";
        label.append(icon("brain"), document.createTextNode(t().pinned(pins.length)));
        bar.appendChild(label);

        for (const key of pins) {
            const file = knownFiles.find(item => item.key === key);

            const chip = document.createElement("span");
            chip.className = "memory-chip";

            const name = document.createElement("span");
            name.textContent = file ? file.name : "…";
            name.title = file ? file.name : "";

            const remove = document.createElement("button");
            remove.type = "button";
            remove.title = t().remove;
            remove.setAttribute("aria-label", t().remove);
            remove.appendChild(icon("x"));

            remove.addEventListener("click", () => {
                setPins(getPins().filter(pin => pin !== key));
                renderChips();
                if (modal) renderList();
            });

            chip.append(name, remove);
            bar.appendChild(chip);
        }

        refreshIcons();
    }

    // ----- modal -----

    let modal = null;
    let listBox = null;
    let searchInput = null;
    let hint = null;
    let titleEl = null;
    let introEl = null;
    let allBtn = null;
    let clearBtn = null;
    let doneBtn = null;

    function buildModal() {
        modal = document.createElement("div");
        modal.className = "memory-modal hidden";
        modal.setAttribute("role", "dialog");
        modal.setAttribute("aria-modal", "true");

        const box = document.createElement("div");
        box.className = "memory-box";

        const header = document.createElement("div");
        header.className = "memory-header";

        titleEl = document.createElement("h2");

        const close = document.createElement("button");
        close.type = "button";
        close.className = "memory-close";
        close.appendChild(icon("x"));
        close.addEventListener("click", closeModal);

        header.append(titleEl, close);

        introEl = document.createElement("p");
        introEl.className = "memory-intro";

        searchInput = document.createElement("input");
        searchInput.type = "search";
        searchInput.className = "memory-search";
        searchInput.autocomplete = "off";
        searchInput.addEventListener("input", renderList);

        hint = document.createElement("p");
        hint.className = "memory-hint hidden";

        listBox = document.createElement("div");
        listBox.className = "memory-list";

        const footer = document.createElement("div");
        footer.className = "memory-footer";

        allBtn = document.createElement("button");
        allBtn.type = "button";
        allBtn.className = "memory-link";

        clearBtn = document.createElement("button");
        clearBtn.type = "button";
        clearBtn.className = "memory-link";

        doneBtn = document.createElement("button");
        doneBtn.type = "button";
        doneBtn.className = "memory-done";

        allBtn.addEventListener("click", () => {
            const readable = knownFiles
                .filter(file => kindOf(file.name) !== "unsupported")
                .slice(0, MAX_FILES)
                .map(file => file.key);

            setPins(readable);
            renderList();
            renderChips();
        });

        clearBtn.addEventListener("click", () => {
            setPins([]);
            renderList();
            renderChips();
        });

        doneBtn.addEventListener("click", closeModal);

        const left = document.createElement("div");
        left.className = "memory-footer-left";
        left.append(allBtn, clearBtn);

        footer.append(left, doneBtn);

        box.append(header, introEl, searchInput, hint, listBox, footer);
        modal.appendChild(box);
        document.body.appendChild(modal);

        modal.addEventListener("click", event => {
            if (event.target === modal) closeModal();
        });

        document.addEventListener("keydown", event => {
            if (event.key === "Escape" && !modal.classList.contains("hidden")) {
                closeModal();
            }
        });
    }

    function applyTexts() {
        if (!modal) return;

        titleEl.textContent = t().memoryTitle;
        introEl.textContent = t().memoryIntro;
        searchInput.placeholder = t().search;
        allBtn.textContent = t().all;
        clearBtn.textContent = t().clear;
        doneBtn.textContent = t().done;
    }

    function renderList() {
        const pins = new Set(getPins());
        const query = searchInput.value.trim().toLowerCase();

        listBox.replaceChildren();
        hint.classList.add("hidden");

        const visible = knownFiles.filter(file =>
            !query ||
            file.name.toLowerCase().includes(query) ||
            file.folder.toLowerCase().includes(query)
        );

        if (!visible.length) {
            const empty = document.createElement("p");
            empty.className = "memory-empty";
            empty.textContent = knownFiles.length ? t().noMatch : t().empty;
            listBox.appendChild(empty);
            return;
        }

        for (const file of visible) {
            const kind = kindOf(file.name);
            const readable = kind !== "unsupported";
            const tooLarge =
                (kind === "pdf" || kind === "image") &&
                file.size > MAX_BINARY_PER_FILE;

            const row = document.createElement("label");
            row.className = "memory-row";

            if (!readable || tooLarge) row.classList.add("disabled");

            const check = document.createElement("input");
            check.type = "checkbox";
            check.checked = pins.has(file.key);
            check.disabled = !readable || tooLarge;

            check.addEventListener("change", () => {
                const current = getPins().filter(key => key !== file.key);

                if (check.checked) {
                    if (current.length >= MAX_FILES) {
                        check.checked = false;
                        hint.textContent = t().limit;
                        hint.classList.remove("hidden");
                        return;
                    }

                    current.push(file.key);
                }

                hint.classList.add("hidden");
                setPins(current);
                renderChips();
            });

            const fileIcon = document.createElement("span");
            fileIcon.className = "memory-file-icon";
            fileIcon.appendChild(icon(iconFor(file.name)));

            const info = document.createElement("span");
            info.className = "memory-file-info";

            const name = document.createElement("strong");
            name.textContent = file.name;
            name.title = file.name;

            const where = document.createElement("small");
            const origin = file.source === "forum" ? t().post : t().library;
            const parts = [origin];

            if (file.folder) parts.push(file.folder);
            if (file.size) parts.push(readableSize(file.size));
            if (!readable) parts.push(t().unreadable);
            else if (tooLarge) parts.push(t().tooLarge);

            where.textContent = parts.join(" · ");

            info.append(name, where);
            row.append(check, fileIcon, info);
            listBox.appendChild(row);
        }

        refreshIcons();
    }

    async function openModal() {
        if (!modal) buildModal();

        applyTexts();
        searchInput.value = "";
        modal.classList.remove("hidden");

        listBox.replaceChildren();
        const loading = document.createElement("p");
        loading.className = "memory-empty";
        loading.textContent = t().loading;
        listBox.appendChild(loading);

        try {
            await listFiles();
        } catch (error) {
            loading.textContent = t().loadError;
            return;
        }

        // Drop pins for files that were deleted.
        const existing = new Set(knownFiles.map(file => file.key));
        setPins(getPins().filter(key => existing.has(key)));

        renderList();
        renderChips();
        refreshIcons();
        searchInput.focus();
    }

    function closeModal() {
        if (modal) modal.classList.add("hidden");
    }

    function applyButtonTexts() {
        const button = document.getElementById("memoryBtn");

        if (button) {
            button.title = t().memory;
            button.setAttribute("aria-label", t().memory);
        }

        applyTexts();
        renderChips();
    }

    async function initialize() {
        const button = document.getElementById("memoryBtn");

        if (button) button.addEventListener("click", openModal);

        const select = document.getElementById("languageSelect");

        if (select) select.addEventListener("change", applyButtonTexts);

        applyButtonTexts();

        // Show the names of pinned files in the chips.
        try {
            await listFiles();
        } catch (error) {
            console.warn("Memory: initial file list failed.", error);
        }

        renderChips();
    }

    window.StudyGramMemory = {
        collect,
        listFiles,
        usedFilesLabel: () => t().usedFiles
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initialize);
    } else {
        initialize();
    }
})();
