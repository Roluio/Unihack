
const DB_NAME = "UniBuddyLibrary";
const STORE_NAME = "items";

let db;
let items = [];
let currentFolder = null;
let currentView = "files";
let listView = false;
let formMode = "create";
let selectedItemId = null;
let activeFile = null;
let previewURL = null;
let previewToken = 0;
let toastTimer;
let aiMessages = [];

const $ = id => document.getElementById(id);

const icon = name => `<i data-lucide="${name}"></i>`;
const refreshIcons = () => window.lucide?.createIcons();

function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, c => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;",
        '"': "&quot;", "'": "&#39;"
    }[c]));
}

function showToast(message) {
    $("toastMessage").textContent = message;
    $("toast").classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        $("toast").classList.add("hidden");
    }, 3000);
}

// ========================================
// DATABASE
// ========================================

function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);

        request.onupgradeneeded = () => {
            const database = request.result;
            if (!database.objectStoreNames.contains(STORE_NAME)) {
                database.createObjectStore(STORE_NAME, {
                    keyPath: "id"
                });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function saveItem(item) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).put(item);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

function removeItems(ids) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);

        ids.forEach(id => store.delete(id));

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
    });
}

function loadItems() {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const request = tx.objectStore(STORE_NAME).getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function refresh() {
    items = await loadItems();
    render();
}

async function seedFolders() {
    if (items.length > 0) return;

    for (const name of [
        "Physics", "Mathematics", "Programming", "Electronics"
    ]) {
        await saveItem({
            id: crypto.randomUUID(),
            name,
            type: "folder",
            parentId: null,
            favorite: false,
            shared: false,
            trashed: false,
            createdAt: Date.now()
        });
    }

    items = await loadItems();
}

// ========================================
// HELPERS
// ========================================

function getItem(id) {
    return items.find(i => i.id === id);
}

function extensionOf(name) {
    return name.split(".").pop().toLowerCase();
}

function fileCategory(name) {
    const ext = extensionOf(name);

    if (ext === "pdf") return "pdf";
    if (["doc", "docx"].includes(ext)) return "word";
    if (["ppt", "pptx"].includes(ext)) return "powerpoint";
    if (["jpg", "jpeg", "jfif", "jiff", "png",
         "gif", "webp", "bmp", "avif"].includes(ext)) return "image";
    if (["mp4", "webm", "mov"].includes(ext)) return "video";
    if (["mp3", "wav", "ogg", "m4a"].includes(ext)) return "audio";
    if (["txt", "md", "js", "json", "html", "css", "xml",
         "java", "py", "c", "cpp", "h", "csv"].includes(ext)) return "text";

    return "other";
}

function fileIcon(type) {
    return {
        pdf: "file-text",
        word: "file-type",
        powerpoint: "presentation",
        image: "image",
        video: "video",
        audio: "music",
        text: "file-code",
        other: "file"
    }[type] || "file";
}

function readableSize(bytes = 0) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
}

function descendantsOf(id) {
    const result = [];
    const queue = [id];
    const visited = new Set([id]);

    while (queue.length) {
        const parentId = queue.shift();

        for (const item of items.filter(i => i.parentId === parentId)) {
            if (visited.has(item.id)) continue;
            visited.add(item.id);
            result.push(item);
            if (item.type === "folder") queue.push(item.id);
        }
    }

    return result;
}

function hasTrashedParent(item) {
    let parent = getItem(item.parentId);
    const visited = new Set();

    while (parent && !visited.has(parent.id)) {
        if (parent.trashed) return true;
        visited.add(parent.id);
        parent = getItem(parent.parentId);
    }

    return false;
}

// ========================================
// NAVIGATION
// ========================================

function navigate(view = "files", folderId = null) {
    if (!["files", "favorites", "shared", "trash"].includes(view)) {
        view = "files";
    }

    const hash = view === "files" && folderId
        ? `#/files/${encodeURIComponent(folderId)}`
        : `#/${view}`;

    if (location.hash === hash) syncNavigation();
    else location.hash = hash;
}

function syncNavigation() {
    const parts = location.hash.replace(/^#\/?/, "").split("/");

    currentView = ["files", "favorites", "shared", "trash"]
        .includes(parts[0]) ? parts[0] : "files";

    currentFolder = null;

    if (currentView === "files" && parts[1]) {
        const folder = getItem(decodeURIComponent(parts[1]));
        if (folder?.type === "folder" && !folder.trashed) {
            currentFolder = folder.id;
        }
    }

    document.querySelectorAll(".nav-item").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.view === currentView);
    });

    closeContextMenu();
    render();
}

function goBack() {
    if (currentView !== "files") return navigate("files");
    if (!currentFolder) return;

    const folder = getItem(currentFolder);
    navigate("files", folder?.parentId || null);
}

function renderBreadcrumb() {
    const container = $("breadcrumb");
    container.replaceChildren();

    if (currentView !== "files") return;

    function addCrumb(text, id) {
        if (container.childNodes.length) {
            const separator = document.createElement("span");
            separator.textContent = " / ";
            container.appendChild(separator);
        }

        const button = document.createElement("button");
        button.textContent = text;
        button.onclick = () => navigate("files", id);
        container.appendChild(button);
    }

    addCrumb("My Files", null);

    const path = [];
    const visited = new Set();
    let folder = getItem(currentFolder);

    while (folder && !visited.has(folder.id)) {
        visited.add(folder.id);
        path.unshift(folder);
        folder = getItem(folder.parentId);
    }

    path.forEach(f => addCrumb(f.name, f.id));
}

// ========================================
// FOLDERS AND UPLOAD
// ========================================

function openForm(mode, item = null) {
    formMode = mode;
    selectedItemId = item?.id || null;
    $("formTitle").textContent =
        mode === "create" ? "New Folder" : "Rename Item";
    $("itemName").value = mode === "create" ? "" : item.name;
    $("formModal").classList.remove("hidden");
    $("newMenu").classList.add("hidden");
    $("itemName").focus();
}

function closeForm() {
    $("formModal").classList.add("hidden");
    $("itemForm").reset();
    selectedItemId = null;
}

async function submitForm(event) {
    event.preventDefault();
    const name = $("itemName").value.trim();
    if (!name) return;

    try {
        if (formMode === "create") {
            await saveItem({
                id: crypto.randomUUID(),
                name,
                type: "folder",
                parentId: currentView === "files" ? currentFolder : null,
                favorite: false,
                shared: false,
                trashed: false,
                createdAt: Date.now()
            });
        } else {
            const item = getItem(selectedItemId);
            if (!item) return;
            await saveItem({ ...item, name });
        }

        closeForm();
        await refresh();
        showToast("Saved successfully!");
    } catch (error) {
        console.error(error);
        showToast("Could not save item.");
    }
}

async function uploadFiles(fileList) {
    if (!fileList.length || currentView === "trash") return;

    const parentId = currentView === "files" ? currentFolder : null;

    try {
        for (const file of fileList) {
            await saveItem({
                id: crypto.randomUUID(),
                name: file.name,
                type: "file",
                parentId,
                favorite: false,
                shared: false,
                trashed: false,
                size: file.size,
                mime: file.type,
                blob: file,
                createdAt: Date.now()
            });
        }

        await refresh();

        if (currentView !== "files") navigate("files", parentId);
        showToast("Files uploaded successfully!");
    } catch (error) {
        console.error(error);
        showToast("Upload failed. Browser storage may be full.");
    }
}

// ========================================
// FILTER AND RENDER
// ========================================

function filteredItems() {
    const query = $("searchInput").value.trim().toLowerCase();

    return items.filter(item => {
        if (currentView === "trash") {
            if (!item.trashed || hasTrashedParent(item)) return false;
        } else {
            if (item.trashed || hasTrashedParent(item)) return false;
            if (currentView === "favorites" && !item.favorite) return false;
            if (currentView === "shared" && !item.shared) return false;

            if (currentView === "files" && !query &&
                item.parentId !== currentFolder) return false;
        }

        return item.name.toLowerCase().includes(query);
    });
}

function renderFolders(folders) {
    $("foldersGrid").innerHTML = folders.map(f => `
        <div class="folder-card" data-folder="${f.id}">
            <div class="folder-icon">${icon("folder")}</div>
            <div class="folder-info">
                <strong title="${escapeHTML(f.name)}">${escapeHTML(f.name)}</strong>
                <small>Folder</small>
            </div>
            ${f.favorite ? `<span class="favorite-indicator">${icon("star")}</span>` : ""}
            <button class="card-menu" data-menu="${f.id}" title="Actions">
                ${icon("ellipsis-vertical")}
            </button>
        </div>
    `).join("");

    $("folderCount").textContent = `${folders.length} folders`;
}

function renderFiles(files) {
    $("filesGrid").classList.toggle("list-view", listView);

    $("filesGrid").innerHTML = files.map(f => {
        const type = fileCategory(f.name);

        return `
            <div class="file-card" data-file="${f.id}">
                <div class="file-preview ${type}">
                    ${icon(fileIcon(type))}
                </div>
                <div class="file-details">
                    <strong title="${escapeHTML(f.name)}">
                        ${escapeHTML(f.name)}
                    </strong>
                    <small>${readableSize(f.size)}</small>
                </div>
                ${f.favorite ? `<span class="favorite-indicator">${icon("star")}</span>` : ""}
                <button class="card-menu" data-menu="${f.id}" title="Actions">
                    ${icon("ellipsis-vertical")}
                </button>
            </div>
        `;
    }).join("");

    $("fileCount").textContent = `${files.length} files`;
}

function render() {
    const headings = {
        files: "My Files",
        favorites: "Favorites",
        shared: "Shared Files",
        trash: "Trash"
    };

    const descriptions = {
        files: "All your study materials in one place.",
        favorites: "Your favorite study materials.",
        shared: "Materials marked for sharing.",
        trash: "Deleted files and folders."
    };

    $("pageTitle").textContent =
        currentView === "files" && currentFolder
            ? getItem(currentFolder)?.name || "My Files"
            : headings[currentView];

    $("pageSubtitle").textContent = descriptions[currentView];

    $("backButton").disabled =
        currentView === "files" && !currentFolder;

    const inTrash = currentView === "trash";
    $("topUpload").classList.toggle("hidden", inTrash);
    $("emptyTrashButton").classList.toggle("hidden", !inTrash);
    $("emptyTrashButton").disabled = !items.some(i => i.trashed);
    $("newButton").disabled = inTrash;

    renderBreadcrumb();

    const visible = filteredItems();
    const folders = visible.filter(i => i.type === "folder");
    const files = visible.filter(i => i.type === "file");

    $("foldersSection").classList.toggle("hidden", folders.length === 0);
    renderFolders(folders);
    renderFiles(files);

    $("emptyState").classList.toggle("hidden", visible.length !== 0);

    $("toggleView").innerHTML = icon(
        listView ? "grid-2x2" : "list"
    );

    refreshIcons();
}

// ========================================
// FILE ACTIONS
// ========================================

async function modifyItem(item, values, message) {
    await saveItem({ ...item, ...values });
    await refresh();
    showToast(message);
}

async function trashItem(item) {
    const targets = [
        item,
        ...(item.type === "folder" ? descendantsOf(item.id) : [])
    ];

    for (const target of targets) {
        await saveItem({ ...target, trashed: true });
    }

    await refresh();

    if (targets.some(i => i.id === currentFolder)) {
        navigate("files");
    }

    showToast("Moved to Trash.");
}

async function restoreItem(item) {
    let parent = getItem(item.parentId);
    const visited = new Set();

    while (parent && !visited.has(parent.id)) {
        visited.add(parent.id);
        await saveItem({ ...parent, trashed: false });
        parent = getItem(parent.parentId);
    }

    const targets = [
        item,
        ...(item.type === "folder" ? descendantsOf(item.id) : [])
    ];

    for (const target of targets) {
        await saveItem({ ...target, trashed: false });
    }

    await refresh();
    showToast("Restored successfully!");
}

async function deletePermanently(item) {
    if (!confirm(`Permanently delete "${item.name}"?`)) return;

    const ids = [
        item.id,
        ...(item.type === "folder"
            ? descendantsOf(item.id).map(i => i.id)
            : [])
    ];

    await removeItems(ids);
    await refresh();
    showToast("Deleted permanently.");
}

async function emptyTrash() {
    const trashed = items.filter(i => i.trashed);
    if (!trashed.length) return;

    if (!confirm(
        `Permanently delete ${trashed.length} items from Trash?`
    )) return;

    const ids = new Set();

    for (const item of trashed) {
        ids.add(item.id);
        if (item.type === "folder") {
            descendantsOf(item.id).forEach(i => ids.add(i.id));
        }
    }

    try {
        await removeItems([...ids]);
        await refresh();
        showToast("Trash emptied!");
    } catch (error) {
        console.error(error);
        showToast("Could not empty Trash.");
    }
}

function downloadFile(item) {
    if (!item.blob) return;

    const url = URL.createObjectURL(item.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = item.name;
    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ========================================
// THREE-DOT MENU
// ========================================

function closeContextMenu() {
    $("contextMenu").classList.add("hidden");
    $("contextMenu").replaceChildren();
}

function openContextMenu(item, trigger) {
    const menu = $("contextMenu");
    menu.replaceChildren();

    const actions = item.trashed
        ? [
            ["Restore", "rotate-ccw", "restore"],
            ["Delete Forever", "trash-2", "delete"]
        ]
        : [
            [item.favorite ? "Remove Favorite" : "Add to Favorites", "star", "favorite"],
            ["Rename", "pencil", "rename"],
            [item.shared ? "Unmark Shared" : "Mark as Shared", "users", "share"],
            ...(item.type === "file"
                ? [["Preview", "eye", "preview"],
                   ["Download", "download", "download"]]
                : []),
            ["Move to Trash", "trash-2", "trash"]
        ];

    for (const [label, iconName, action] of actions) {
        const button = document.createElement("button");
        if (["delete", "trash"].includes(action)) {
            button.classList.add("danger");
        }

        const i = document.createElement("i");
        i.setAttribute("data-lucide", iconName);

        const span = document.createElement("span");
        span.textContent = label;

        button.append(i, span);

        button.onclick = async () => {
            closeContextMenu();

            try {
                switch (action) {
                    case "favorite":
                        await modifyItem(item, {
                            favorite: !item.favorite
                        }, "Favorites updated!");
                        break;
                    case "rename":
                        openForm("rename", item);
                        break;
                    case "share":
                        await modifyItem(item, {
                            shared: !item.shared
                        }, "Shared mark updated (local demo).");
                        break;
                    case "preview":
                        await previewFile(item);
                        break;
                    case "download":
                        downloadFile(item);
                        break;
                    case "trash":
                        await trashItem(item);
                        break;
                    case "restore":
                        await restoreItem(item);
                        break;
                    case "delete":
                        await deletePermanently(item);
                        break;
                }
            } catch (error) {
                console.error(error);
                showToast("Action failed.");
            }
        };

        menu.appendChild(button);
    }

    menu.classList.remove("hidden");

    const rect = trigger.getBoundingClientRect();
    const bounds = menu.getBoundingClientRect();

    menu.style.left = Math.max(8, Math.min(
        rect.right - bounds.width,
        window.innerWidth - bounds.width - 8
    )) + "px";

    menu.style.top = (
        rect.bottom + bounds.height + 8 > window.innerHeight
            ? Math.max(8, rect.top - bounds.height - 5)
            : rect.bottom + 5
    ) + "px";

    refreshIcons();
}

// ========================================
// EXTERNAL DOCX / PPTX LIBRARIES
// ========================================

const loadedLibraries = {};

function loadLibrary(name, url, globalName) {
    if (window[globalName]) return Promise.resolve(window[globalName]);
    if (loadedLibraries[name]) return loadedLibraries[name];

    loadedLibraries[name] = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = url;
        script.onload = () => window[globalName]
            ? resolve(window[globalName])
            : reject(new Error(`${name} unavailable`));
        script.onerror = () => reject(new Error(`Failed to load ${name}`));
        document.head.appendChild(script);
    }).catch(error => {
        delete loadedLibraries[name];
        throw error;
    });

    return loadedLibraries[name];
}

// ========================================
// DOCUMENT PREVIEW
// ========================================

function textPreview(text) {
    const pre = document.createElement("pre");
    pre.textContent = text || "This document is empty.";

    Object.assign(pre.style, {
        width: "100%",
        height: "100%",
        margin: "0",
        padding: "30px",
        overflow: "auto",
        whiteSpace: "pre-wrap",
        overflowWrap: "anywhere",
        fontFamily: "Inter, sans-serif",
        lineHeight: "1.8",
        fontSize: "14px",
        background: "white"
    });

    return pre;
}

function previewMessage(text) {
    const p = document.createElement("p");
    p.textContent = text;
    p.style.cssText =
        "color:#888298;text-align:center;padding:30px;line-height:1.8";
    return p;
}

function setPreview(element, token) {
    if (token === previewToken) {
        $("previewContent").replaceChildren(element);
    }
}

async function docxPreview(blob) {
    const mammoth = await loadLibrary(
        "mammoth",
        "https://unpkg.com/mammoth@1.9.1/mammoth.browser.min.js",
        "mammoth"
    );

    const result = await mammoth.extractRawText({
        arrayBuffer: await blob.arrayBuffer()
    });

    return textPreview(result.value);
}

async function pptxPreview(blob) {
    const JSZip = await loadLibrary(
        "jszip",
        "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js",
        "JSZip"
    );

    const zip = await JSZip.loadAsync(blob);

    const slides = Object.keys(zip.files)
        .filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n))
        .sort((a, b) =>
            Number(a.match(/slide(\d+)/)[1]) -
            Number(b.match(/slide(\d+)/)[1])
        );

    const wrapper = document.createElement("div");
    wrapper.style.cssText =
        "width:100%;height:100%;overflow:auto;padding:24px;";

    for (let i = 0; i < slides.length; i++) {
        const xml = new DOMParser().parseFromString(
            await zip.files[slides[i]].async("string"),
            "application/xml"
        );

        const nodes = xml.getElementsByTagNameNS(
            "http://schemas.openxmlformats.org/drawingml/2006/main",
            "t"
        );

        const slide = document.createElement("div");
        slide.style.cssText =
            "padding:20px;margin-bottom:15px;background:white;border-radius:12px;";

        const title = document.createElement("h3");
        title.textContent = `Slide ${i + 1}`;
        title.style.color = "#54218e";

        const text = Array.from(nodes)
            .map(n => n.textContent)
            .join("\n");

        const pre = textPreview(text);
        pre.style.padding = "0";

        slide.append(title, pre);
        wrapper.appendChild(slide);
    }

    return wrapper.childElementCount
        ? wrapper
        : previewMessage("No slides found.");
}

async function previewFile(item) {
    if (!item.blob) {
        showToast("File content unavailable.");
        return;
    }

    closePreview();

    activeFile = item;
    const token = previewToken;

    $("previewTitle").textContent = item.name;
    $("previewFileSize").textContent = readableSize(item.size);
    $("aiDocumentName").textContent = item.name;

    $("previewModal").classList.remove("hidden");
    $("aiPanel").classList.add("hidden");
    $("toggleAI").classList.remove("active");
    document.body.style.overflow = "hidden";

    $("previewContent").replaceChildren(
        previewMessage("Loading preview...")
    );

    resetAIChat();

    const category = fileCategory(item.name);
    const ext = extensionOf(item.name);

    try {
        if (category === "pdf") {
            const blob = new Blob([item.blob], {
                type: "application/pdf"
            });

            const url = URL.createObjectURL(blob);
            if (token !== previewToken) {
                URL.revokeObjectURL(url);
                return;
            }

            previewURL = url;

            const iframe = document.createElement("iframe");
            iframe.src = url;
            iframe.title = item.name;
            setPreview(iframe, token);
            return;
        }

        if (category === "image") {
            let mime = item.blob.type;

            if (["jpg", "jpeg", "jfif", "jiff"].includes(ext)) {
                mime = "image/jpeg";
            }

            const types = {
                png: "image/png",
                gif: "image/gif",
                webp: "image/webp",
                bmp: "image/bmp",
                avif: "image/avif"
            };

            mime ||= types[ext] || "application/octet-stream";

            const url = URL.createObjectURL(
                new Blob([item.blob], { type: mime })
            );

            if (token !== previewToken) {
                URL.revokeObjectURL(url);
                return;
            }

            previewURL = url;

            const img = document.createElement("img");
            img.alt = item.name;
            img.onload = () => setPreview(img, token);
            img.onerror = () => setPreview(
                previewMessage("Image cannot be displayed."), token
            );
            img.src = url;
            return;
        }

        if (category === "video" || category === "audio") {
            const url = URL.createObjectURL(item.blob);

            if (token !== previewToken) {
                URL.revokeObjectURL(url);
                return;
            }

            previewURL = url;

            const media = document.createElement(
                category === "video" ? "video" : "audio"
            );

            media.src = url;
            media.controls = true;
            media.style.maxWidth = "100%";
            media.style.maxHeight = "100%";
            setPreview(media, token);
            return;
        }

        if (category === "text") {
            setPreview(textPreview(await item.blob.text()), token);
            return;
        }

        if (ext === "docx") {
            setPreview(await docxPreview(item.blob), token);
            return;
        }

        if (ext === "pptx") {
            setPreview(await pptxPreview(item.blob), token);
            return;
        }

        setPreview(previewMessage(
            "Preview unavailable for this format. Download to open."
        ), token);

    } catch (error) {
        console.error(error);
        setPreview(previewMessage(
            "Preview could not be loaded."
        ), token);
    }
}

function closePreview() {
    previewToken++;
    $("previewModal").classList.add("hidden");
    $("previewContent").replaceChildren();

    if (previewURL) URL.revokeObjectURL(previewURL);
    previewURL = null;
    activeFile = null;
    document.body.style.overflow = "";
}

// ========================================
// UNIBUDDY AI PANEL
// ========================================

function toggleAIPanel(force = null) {
    if (!activeFile) return;

    const show = force === null
        ? $("aiPanel").classList.contains("hidden")
        : force;

    $("aiPanel").classList.toggle("hidden", !show);
    $("toggleAI").classList.toggle("active", show);
    $("toggleAI").setAttribute("aria-expanded", String(show));

    if (show) $("aiInput").focus();
}

function resetAIChat() {
    aiMessages = [];
    $("aiMessages").replaceChildren();
    $("aiInput").value = "";

    const welcome = document.createElement("div");
    welcome.className = "ai-welcome";
    welcome.id = "aiWelcome";

    welcome.innerHTML = `
        <div class="ai-welcome-icon">
            ${icon("brain-circuit")}
        </div>
        <h3>Study smarter with UniBuddy</h3>
        <p>Select an action or ask about this document.</p>
        <div class="ai-suggestions">
            <button data-ai-action="summary">
                ${icon("book-open")}
                <span>Summarize document</span>
                ${icon("arrow-up-right")}
            </button>
            <button data-ai-action="quiz">
                ${icon("list-checks")}
                <span>Generate a quiz</span>
                ${icon("arrow-up-right")}
            </button>
            <button data-ai-action="explain">
                ${icon("lightbulb")}
                <span>Explain simply</span>
                ${icon("arrow-up-right")}
            </button>
            <button data-ai-action="notes">
                ${icon("notebook-pen")}
                <span>Create study notes</span>
                ${icon("arrow-up-right")}
            </button>
        </div>
    `;

    $("aiMessages").appendChild(welcome);
    refreshIcons();
}

function addAIMessage(role, text) {
    const message = document.createElement("div");
    message.className = `ai-message ${role}`;
    message.textContent = text;

    $("aiMessages").appendChild(message);
    $("aiMessages").scrollTop = $("aiMessages").scrollHeight;
}

function aiSuggestedPrompt(action) {
    const ro = $("aiLanguage").value === "ro";

    const prompts = {
        summary: ro
            ? "Fă un rezumat al acestui document, cu ideile principale."
            : "Summarize this document and highlight the key ideas.",
        quiz: ro
            ? "Generează 10 întrebări grilă din acest document, cu răspunsuri."
            : "Generate 10 multiple-choice questions based on this document.",
        explain: ro
            ? "Explică-mi conținutul documentului pe înțelesul tuturor."
            : "Explain this document in simple terms.",
        notes: ro
            ? "Creează fișe de învățare din acest document."
            : "Create structured study notes from this document."
    };

    return prompts[action] || "";
}

function sendAIMessage(question) {
    if (!activeFile || !question.trim()) return;

    const welcome = $("aiWelcome");
    if (welcome) welcome.remove();

    addAIMessage("user", question.trim());

    // Frontend-only demonstration.
    // Later: POST /api/ai/chat with materialId, message, language.
    const ro = $("aiLanguage").value === "ro";

    const answer = ro
        ? `Interfața UniBuddy AI este pregătită! 💜

Document selectat: ${activeFile.name}

Pentru un răspuns bazat pe acest fișier, trebuie conectat API-ul AI la backend. Până atunci, acest mesaj este doar o demonstrație.`
        : `UniBuddy AI interface is ready! 💜

Selected document: ${activeFile.name}

To answer questions using this file, the AI backend must be connected. This is a demo message, not an analysis of the document.`;

    addAIMessage("assistant", answer);
    $("aiInput").value = "";
}

// This function will be useful during backend integration.
function buildAIRequest(question) {
    return {
        materialId: activeFile?.id,
        message: question,
        language: $("aiLanguage").value
    };
}

// ========================================
// EVENTS
// ========================================

function setupEvents() {
    $("newButton").onclick = event => {
        event.stopPropagation();
        closeContextMenu();
        $("newMenu").classList.toggle("hidden");
    };

    $("createFolder").onclick = () => openForm("create");

    $("uploadButton").onclick = () => {
        $("fileInput").click();
        $("newMenu").classList.add("hidden");
    };

    $("topUpload").onclick = () => $("fileInput").click();

    $("fileInput").onchange = async event => {
        await uploadFiles(event.target.files);
        event.target.value = "";
    };

    $("searchInput").oninput = render;

    document.querySelectorAll(".nav-item").forEach(btn => {
        btn.onclick = () => {
            $("searchInput").value = "";
            navigate(btn.dataset.view);
        };
    });

    $("backButton").onclick = goBack;
    $("emptyTrashButton").onclick = emptyTrash;

    $("toggleView").onclick = () => {
        listView = !listView;
        render();
    };

    $("itemForm").onsubmit = submitForm;
    $("closeForm").onclick = closeForm;
    $("cancelForm").onclick = closeForm;

    $("closePreview").onclick = closePreview;
    $("previewDownload").onclick = () => {
        if (activeFile) downloadFile(activeFile);
    };

    $("toggleAI").onclick = () => toggleAIPanel();
    $("closeAI").onclick = () => toggleAIPanel(false);

    $("aiForm").onsubmit = event => {
        event.preventDefault();
        sendAIMessage($("aiInput").value);
    };

    $("aiInput").addEventListener("keydown", event => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            $("aiForm").requestSubmit();
        }
    });

    $("aiMessages").addEventListener("click", event => {
        const button = event.target.closest("[data-ai-action]");
        if (!button) return;

        $("aiInput").value =
            aiSuggestedPrompt(button.dataset.aiAction);

        $("aiInput").focus();
    });

    document.addEventListener("click", event => {
        const menuButton = event.target.closest("[data-menu]");

        if (menuButton) {
            event.stopPropagation();
            const item = getItem(menuButton.dataset.menu);
            if (item) openContextMenu(item, menuButton);
            return;
        }

        const folderCard = event.target.closest("[data-folder]");

        if (folderCard && currentView !== "trash") {
            $("searchInput").value = "";
            navigate("files", folderCard.dataset.folder);
            return;
        }

        const fileCard = event.target.closest("[data-file]");

        if (fileCard && currentView !== "trash") {
            const item = getItem(fileCard.dataset.file);
            if (item) previewFile(item);
            return;
        }

        if (!event.target.closest("#contextMenu")) {
            closeContextMenu();
        }

        if (!event.target.closest(".new-wrapper")) {
            $("newMenu").classList.add("hidden");
        }
    });

    $("formModal").onclick = event => {
        if (event.target === $("formModal")) closeForm();
    };

    $("previewModal").onclick = event => {
        if (event.target === $("previewModal")) closePreview();
    };

    document.addEventListener("keydown", event => {
        if (event.key !== "Escape") return;

        if (!$("previewModal").classList.contains("hidden")) {
            closePreview();
        } else {
            closeForm();
            closeContextMenu();
            $("newMenu").classList.add("hidden");
        }
    });

    window.addEventListener("hashchange", syncNavigation);
    window.addEventListener("resize", closeContextMenu);
    window.addEventListener("scroll", closeContextMenu, true);

    document.addEventListener("dragover", event => {
        if (event.dataTransfer?.types.includes("Files")) {
            event.preventDefault();
        }
    });

    document.addEventListener("drop", async event => {
        if (!event.dataTransfer?.files.length) return;
        event.preventDefault();
        await uploadFiles(event.dataTransfer.files);
    });
}

// ========================================
// INITIALIZE
// ========================================

async function initialize() {
    try {
        db = await openDatabase();
        items = await loadItems();

        await seedFolders();
        setupEvents();

        if (!location.hash) {
            history.replaceState(null, "", "#/files");
        }

        syncNavigation();

    } catch (error) {
        console.error(error);
        alert("Could not initialize UniBuddy Library.");
    }
}

initialize();
