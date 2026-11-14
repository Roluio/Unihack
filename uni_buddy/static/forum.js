
document.addEventListener("DOMContentLoaded", () => {
    // ==========================================
    // STUDYGRAM FORUM - COMPLETE VERSION
    // ==========================================

    const $ = id => document.getElementById(id);

    const user = window.FORUM_USER || {
        username: "student",
        fullName: "Student"
    };

    const STORAGE_KEY = "UniBuddyForumDemo_" + user.username;
    const LANG_KEY = "UniBuddyForumLanguage";
    const DB_NAME = "UniBuddyForumFiles_" + user.username;

    const MAX_FILES = 3;
    const MAX_FILE_SIZE = 2 * 1024 * 1024;

    let language = localStorage.getItem(LANG_KEY) === "en"
        ? "en" : "ro";

    let posts = [];
    let selectedFiles = [];
    let openComments = new Set();
    let openReplies = new Set();
    let translatedPosts = new Set();
    let objectUrls = [];
    let toastTimer = null;

    // ==========================================
    // ROMANIAN / ENGLISH
    // ==========================================

    const translations = {
        ro: {
            community: "COMUNITATEA STUDENȚILOR",
            title: "Forumul Studenților",
            description: "Împărtășește cunoștințe, pune întrebări și învață împreună cu ceilalți.",
            create: "Creează o postare",
            quick: "La ce te gândești?",
            search: "Caută discuții...",
            subjectSearch: "Caută după materie...",
            recent: "Cele mai recente",
            popular: "Cele mai populare",
            feed: "Discuții din comunitate",
            welcome: "Bine ai venit pe StudyGram!",
            welcomeText: "Un spațiu unde studenții pot discuta, colabora și se pot ajuta reciproc.",
            popularSubjects: "Materii populare",
            noSubjects: "Nu există încă materii.",
            aiTitle: "Ai nevoie de ajutor?",
            aiText: "Folosește Buddy pentru explicații și rezumate.",
            aiOpen: "Deschide Buddy",
            modal: "Creează o postare",
            titleLabel: "Titlu",
            titlePlaceholder: "Despre ce ai vrea să discuți?",
            subjectLabel: "Materie",
            subjectPlaceholder: "Scrie materia...",
            descriptionLabel: "Descriere",
            descriptionPlaceholder: "Scrie întrebarea sau informațiile tale...",
            cancel: "Anulează",
            publish: "Publică",
            likes: "Aprecieri",
            comments: "Comentarii",
            commentPlaceholder: "Scrie un comentariu...",
            replyPlaceholder: "Scrie un răspuns...",
            reply: "Răspunde",
            delete: "Șterge",
            translate: "Tradu postarea",
            original: "Text original",
            noTranslation: "Traducerea postărilor noi necesită API-ul de traducere.",
            postPublished: "Postarea a fost publicată!",
            postDeleted: "Postarea a fost ștearsă.",
            commentPublished: "Comentariul a fost publicat!",
            commentDeleted: "Comentariul a fost șters.",
            deletePost: "Ștergi această postare?",
            deleteComment: "Ștergi comentariul și răspunsurile sale?",
            incomplete: "Completează toate câmpurile.",
            tooManyFiles: "Maximum 3 fișiere.",
            fileTooLarge: "Maximum 2 MB per fișier.",
            fileError: "Fișierul nu poate fi deschis.",
            saveError: "Modificările nu au putut fi salvate.",
            emptyTitle: "Nu am găsit postări",
            emptyText: "Încearcă altă căutare sau creează o postare.",
            post: "postare",
            posts: "postări",
            attach: "Adaugă imagini sau documente",
            attachHint: "Orice extensie • maximum 3 fișiere • 2 MB/fișier",
            previewUnavailable: "Previzualizarea nu este disponibilă pentru acest format.",
            download: "Descarcă"
        },
        en: {
            community: "STUDENT COMMUNITY",
            title: "Student Forum",
            description: "Share knowledge, ask questions and learn together.",
            create: "Create Post",
            quick: "What's on your mind?",
            search: "Search discussions...",
            subjectSearch: "Search by subject...",
            recent: "Most recent",
            popular: "Most popular",
            feed: "Community Feed",
            welcome: "Welcome to StudyGram!",
            welcomeText: "A space for students to discuss, collaborate and help each other.",
            popularSubjects: "Popular Subjects",
            noSubjects: "No subjects yet.",
            aiTitle: "Need extra help?",
            aiText: "Use Buddy for explanations and summaries.",
            aiOpen: "Open Buddy",
            modal: "Create a Post",
            titleLabel: "Title",
            titlePlaceholder: "What would you like to discuss?",
            subjectLabel: "Subject",
            subjectPlaceholder: "Enter a subject...",
            descriptionLabel: "Description",
            descriptionPlaceholder: "Share your question or information...",
            cancel: "Cancel",
            publish: "Publish",
            likes: "Likes",
            comments: "Comments",
            commentPlaceholder: "Write a comment...",
            replyPlaceholder: "Write a reply...",
            reply: "Reply",
            delete: "Delete",
            translate: "Translate post",
            original: "Original text",
            noTranslation: "New posts need a translation API.",
            postPublished: "Post published!",
            postDeleted: "Post deleted.",
            commentPublished: "Comment published!",
            commentDeleted: "Comment deleted.",
            deletePost: "Delete this post?",
            deleteComment: "Delete this comment and its replies?",
            incomplete: "Complete all fields.",
            tooManyFiles: "Maximum 3 files.",
            fileTooLarge: "Maximum 2 MB per file.",
            fileError: "Could not open the file.",
            saveError: "Could not save changes.",
            emptyTitle: "No discussions found",
            emptyText: "Try another search or create a post.",
            post: "post",
            posts: "posts",
            attach: "Attach images or documents",
            attachHint: "Any extension • up to 3 files • 2 MB/file",
            previewUnavailable: "Preview is not available for this format.",
            download: "Download"
        }
    };

    const t = key => translations[language][key] || key;

    const subjectPairs = [
        ["Fizică", "Physics"],
        ["Matematică", "Mathematics"],
        ["Programare", "Programming"],
        ["Electronică", "Electronics"],
        ["Automatică", "Automation"],
        ["Baze De Date", "Databases"],
        ["Rețele De Calculatoare", "Computer Networks"],
        ["Inteligență Artificială", "Artificial Intelligence"],
        ["Prelucrarea Matematică A Semnalelor", "Mathematical Signal Processing"],
        ["Sisteme De Operare", "Operating Systems"],
        ["Electrotehnică", "Electrical Engineering"],
        ["Informatică", "Computer Science"],
        ["Chimie", "Chemistry"],
        ["Biologie", "Biology"]
    ];

    const demoTranslations = {
        "demo-physics": {
            ro: {
                title: "Are cineva cursurile de Fizică?",
                content: "Salut! Mă pregătesc pentru examen și caut notițele de la ultimele două cursuri. Mă poate ajuta cineva?"
            },
            en: {
                title: "Does anyone have the Physics notes?",
                content: "Hi! I'm preparing for the exam and looking for notes from the last two lectures. Can anyone help?"
            }
        },
        "demo-programming": {
            ro: {
                title: "Java OOP — moștenire și polimorfism",
                content: "Poate cineva să explice diferența dintre moștenire și polimorfism în Java?"
            },
            en: {
                title: "Java OOP — inheritance and polymorphism",
                content: "Can someone explain the difference between inheritance and polymorphism in Java?"
            }
        },
        "demo-math": {
            ro: {
                title: "Grup de studiu pentru Matematică",
                content: "Organizăm o sesiune de pregătire pentru examen. Cine dorește să participe?"
            },
            en: {
                title: "Mathematics study group",
                content: "We're organizing a study session for the exam. Who would like to join?"
            }
        }
    };

    const demoPosts = [
        {
            id: "demo-physics",
            userId: "demo-maria",
            author: "Maria Ionescu",
            title: demoTranslations["demo-physics"].ro.title,
            content: demoTranslations["demo-physics"].ro.content,
            category: "Fizică",
            createdAt: Date.now() - 3600000,
            likes: ["demo-andrei"],
            comments: [{
                id: "demo-comment-1",
                userId: "demo-andrei",
                author: "Andrei Matei",
                text: "Am încărcat notițele în Library!",
                parentId: null,
                likes: [],
                createdAt: Date.now() - 2400000
            }],
            attachments: []
        },
        {
            id: "demo-programming",
            userId: "demo-andrei",
            author: "Andrei Matei",
            title: demoTranslations["demo-programming"].ro.title,
            content: demoTranslations["demo-programming"].ro.content,
            category: "Java",
            createdAt: Date.now() - 7200000,
            likes: [],
            comments: [],
            attachments: []
        },
        {
            id: "demo-math",
            userId: "demo-teodora",
            author: "Teodora Marin",
            title: demoTranslations["demo-math"].ro.title,
            content: demoTranslations["demo-math"].ro.content,
            category: "Matematică",
            createdAt: Date.now() - 86400000,
            likes: [],
            comments: [],
            attachments: []
        }
    ];

    // ==========================================
    // HELPERS
    // ==========================================

    function id() {
        return crypto.randomUUID();
    }

    function icon(name) {
        const element = document.createElement("i");
        element.setAttribute("data-lucide", name);
        return element;
    }

    function refreshIcons() {
        window.lucide?.createIcons();
    }

    function el(tag, cls = "", content = null) {
        const element = document.createElement(tag);
        element.className = cls;

        if (content !== null) {
            element.textContent = content;
        }

        return element;
    }

    function initials(name) {
        return String(name || "?")
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map(x => x[0]?.toUpperCase() || "")
            .join("");
    }

    function normalize(text) {
        return String(text || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim()
            .replace(/\s+/g, " ")
            .toLocaleLowerCase("ro-RO");
    }

    function titleCase(text) {
        const special = {
            java: "Java",
            javascript: "JavaScript",
            python: "Python",
            sql: "SQL",
            api: "API",
            oop: "OOP",
            html: "HTML",
            css: "CSS",
            ai: "AI",
            matlab: "MATLAB",
            "c++": "C++"
        };

        return String(text || "")
            .trim()
            .replace(/\s+/g, " ")
            .split(" ")
            .map(word => {
                const key = normalize(word);

                if (special[key]) return special[key];

                return word.charAt(0).toLocaleUpperCase("ro") +
                    word.slice(1).toLocaleLowerCase("ro");
            })
            .join(" ");
    }

    function subjectPair(subject) {
        return subjectPairs.find(pair =>
            pair.some(name => normalize(name) === normalize(subject))
        );
    }

    function subjectKey(subject) {
        const pair = subjectPair(subject);
        return normalize(pair ? pair[0] : subject);
    }

    function subjectLabel(subject) {
        const pair = subjectPair(subject);

        if (pair) {
            return language === "ro" ? pair[0] : pair[1];
        }

        return titleCase(subject);
    }

    function subjectSearch(subject) {
        const pair = subjectPair(subject);

        return normalize(pair
            ? `${pair[0]} ${pair[1]}`
            : subject
        );
    }

    function formatDate(date) {
        return new Date(date).toLocaleString(
            language === "ro" ? "ro-RO" : "en-GB",
            {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit"
            }
        );
    }

    function formatSize(bytes) {
        return bytes >= 1048576
            ? (bytes / 1048576).toFixed(2) + " MB"
            : Math.ceil(bytes / 1024) + " KB";
    }

    function showToast(message) {
        const toast = $("forumToast");
        toast.textContent = message;
        toast.classList.remove("hidden");

        clearTimeout(toastTimer);

        toastTimer = setTimeout(() => {
            toast.classList.add("hidden");
        }, 2800);
    }

    function setText(selector, text) {
        const element = document.querySelector(selector);
        if (!element) return;

        const existingIcon = element.querySelector(
            "svg, i[data-lucide]"
        );

        if (existingIcon) {
            element.replaceChildren(
                existingIcon,
                document.createTextNode(" " + text)
            );
        } else {
            element.textContent = text;
        }
    }

    // ==========================================
    // SUBJECT SUGGESTIONS - IMPORTANT FIX
    // ONLY ONE LANGUAGE AT A TIME
    // ==========================================

    function setupSubjectInputs() {
        const oldSubject = $("postCategory");

        if (oldSubject.tagName === "SELECT") {
            const input = document.createElement("input");

            input.id = "postCategory";
            input.type = "text";
            input.required = true;
            input.maxLength = 80;
            input.setAttribute("list", "subjectSuggestions");

            oldSubject.replaceWith(input);
        }

        $("postCategory").setAttribute(
            "list",
            "subjectSuggestions"
        );

        const oldFilter = $("categoryFilter");

        if (oldFilter.tagName === "SELECT") {
            const input = document.createElement("input");

            input.id = "categoryFilter";
            input.type = "search";
            input.className = "subject-filter-input";

            oldFilter.replaceWith(input);
        }

        // Remove any old lists to prevent duplicates.
        document.querySelectorAll(
            '#subjectSuggestions, #forumSubjectSuggestions'
        ).forEach(list => list.remove());

        const datalist = document.createElement("datalist");
        datalist.id = "subjectSuggestions";

        document.body.appendChild(datalist);

        updateSubjectSuggestions();
    }

    function updateSubjectSuggestions() {
        const datalist = $("subjectSuggestions");
        if (!datalist) return;

        datalist.replaceChildren();

        // ONLY 8 EXAMPLES IN THE SELECTED LANGUAGE.
        const examples = subjectPairs.slice(0, 8);

        examples.forEach(pair => {
            const option = document.createElement("option");

            option.value = language === "ro"
                ? pair[0]
                : pair[1];

            datalist.appendChild(option);
        });

        $("postCategory").placeholder =
            language === "ro"
                ? "Scrie materia (ex: Fizică)"
                : "Enter a subject (e.g. Physics)";
    }

    // ==========================================
    // LOCAL STORAGE
    // ==========================================

    function normalizePost(post) {
        post.likes = Array.isArray(post.likes)
            ? post.likes : [];

        post.comments = Array.isArray(post.comments)
            ? post.comments : [];

        post.attachments = Array.isArray(post.attachments)
            ? post.attachments : [];

        post.comments.forEach(comment => {
            comment.likes = Array.isArray(comment.likes)
                ? comment.likes : [];

            if (comment.parentId === undefined) {
                comment.parentId = null;
            }
        });

        return post;
    }

    function loadPosts() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);

            if (saved !== null) {
                const parsed = JSON.parse(saved);

                if (Array.isArray(parsed)) {
                    posts = parsed.map(normalizePost);
                    return;
                }
            }
        } catch (error) {
            console.error(error);
        }

        posts = structuredClone(demoPosts);
        savePosts();
    }

    function savePosts() {
        try {
            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(posts)
            );

            return true;
        } catch (error) {
            console.error(error);
            showToast(t("saveError"));
            return false;
        }
    }

    // ==========================================
    // TOP 4 MOST POPULAR SUBJECTS
    // ==========================================

    function renderPopularSubjects() {
        const card = document.querySelector(
            ".forum-info-card:nth-child(2)"
        );

        if (!card) return;

        card.querySelectorAll(
            ".subject-shortcut, .popular-empty"
        ).forEach(item => item.remove());

        const counts = new Map();

        posts.forEach(post => {
            if (!post.category?.trim()) return;

            const key = subjectKey(post.category);

            if (!counts.has(key)) {
                counts.set(key, {
                    category: post.category,
                    count: 0
                });
            }

            counts.get(key).count++;
        });

        const popular = [...counts.values()]
            .sort((a, b) =>
                b.count - a.count ||
                subjectLabel(a.category).localeCompare(
                    subjectLabel(b.category),
                    language
                )
            )
            .slice(0, 4);

        if (!popular.length) {
            card.appendChild(el(
                "p",
                "popular-empty",
                t("noSubjects")
            ));
            return;
        }

        popular.forEach(subject => {
            const button = el(
                "button",
                "subject-shortcut"
            );

            button.type = "button";

            button.append(
                icon("book-open"),
                el("span", "", subjectLabel(subject.category))
            );

            const count = el(
                "small",
                "",
                String(subject.count)
            );

            count.style.marginLeft = "auto";
            count.style.color = "#888298";

            button.append(count, icon("chevron-right"));

            button.addEventListener("click", () => {
                $("categoryFilter").value =
                    subjectLabel(subject.category);

                renderPosts();
            });

            card.appendChild(button);
        });
    }

    // ==========================================
    // INDEXEDDB FOR ATTACHMENTS
    // ==========================================

    function openDB() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, 1);

            req.onupgradeneeded = () => {
                if (!req.result.objectStoreNames.contains("files")) {
                    req.result.createObjectStore("files");
                }
            };

            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async function fileOperation(mode, action) {
        const db = await openDB();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction("files", mode);
            const store = transaction.objectStore("files");
            const request = action(store);

            let result;

            if (request) {
                request.onsuccess = () => {
                    result = request.result;
                };
            }

            transaction.oncomplete = () => {
                db.close();
                resolve(result);
            };

            transaction.onerror = () => {
                db.close();
                reject(transaction.error);
            };
        });
    }

    const saveBlob = (key, file) =>
        fileOperation("readwrite", store => store.put(file, key));

    const readBlob = key =>
        fileOperation("readonly", store => store.get(key));

    const deleteBlob = key =>
        fileOperation("readwrite", store => store.delete(key));

    function extension(name) {
        return String(name).split(".").pop().toLowerCase();
    }

    function isImage(file) {
        return [
            "jpg", "jpeg", "jfif", "pjpeg", "pjp",
            "png", "webp", "gif", "bmp", "avif"
        ].includes(extension(file.name));
    }

    function imageBlob(file, name) {
        if (
            ["jfif", "pjpeg", "pjp"].includes(extension(name))
            && !file.type.startsWith("image/")
        ) {
            return new Blob([file], {type: "image/jpeg"});
        }

        return file;
    }

    function clearUrls() {
        objectUrls.forEach(url => URL.revokeObjectURL(url));
        objectUrls = [];
    }

    function openPreview(file, name) {
        const kind = extension(name);
        const url = URL.createObjectURL(
            isImage({name}) ? imageBlob(file, name) : file
        );

        const popup = window.open("", "_blank");

        if (!popup) {
            URL.revokeObjectURL(url);
            showToast(t("fileError"));
            return;
        }

        // Images, PDFs and text can be previewed.
        // Other types are offered as downloads.
        const previewableImage = isImage({name});
        const previewablePDF = kind === "pdf";
        const previewableText = [
            "txt", "md", "csv", "json", "log"
        ].includes(kind);

        const doc = popup.document;
        doc.title = name;
        doc.body.style.fontFamily = "Arial, sans-serif";
        doc.body.style.padding = "20px";
        doc.body.style.textAlign = "center";

        const heading = doc.createElement("h3");
        heading.textContent = name;
        doc.body.appendChild(heading);

        const download = doc.createElement("a");
        download.href = url;
        download.download = name;
        download.textContent = t("download");
        download.style.display = "inline-block";
        download.style.margin = "15px";
        doc.body.appendChild(download);

        if (previewableImage) {
            const img = doc.createElement("img");
            img.src = url;
            img.alt = name;
            img.style.maxWidth = "95%";
            img.style.maxHeight = "80vh";

            img.onerror = () => {
                img.replaceWith(
                    doc.createTextNode(t("previewUnavailable"))
                );
            };

            doc.body.appendChild(img);

        } else if (previewablePDF) {
            const frame = doc.createElement("iframe");
            frame.src = url;
            frame.style.width = "100%";
            frame.style.height = "75vh";
            frame.style.border = "none";
            doc.body.appendChild(frame);

        } else if (previewableText) {
            file.text().then(text => {
                if (popup.closed) return;

                const pre = doc.createElement("pre");
                pre.textContent = text;
                pre.style.whiteSpace = "pre-wrap";
                pre.style.textAlign = "left";
                doc.body.appendChild(pre);
            });

        } else {
            const info = doc.createElement("p");
            info.textContent = t("previewUnavailable");
            doc.body.appendChild(info);
        }

        const cleanup = setInterval(() => {
            if (popup.closed) {
                clearInterval(cleanup);
                URL.revokeObjectURL(url);
            }
        }, 1000);
    }

    async function openAttachment(attachment) {
        // Open before awaiting, so browsers won't block it.
        const popup = window.open("", "_blank");

        if (!popup) {
            showToast(t("fileError"));
            return;
        }

        try {
            const file = await readBlob(attachment.id);
            if (!file) throw new Error("Missing file");

            const name = attachment.name;
            const ext = extension(name);
            const safeBlob = isImage({name})
                ? imageBlob(file, name)
                : file;

            const url = URL.createObjectURL(safeBlob);
            const doc = popup.document;

            doc.title = name;
            doc.body.style.cssText =
                "font-family:Arial;padding:20px;text-align:center";

            const title = doc.createElement("h3");
            title.textContent = name;

            const download = doc.createElement("a");
            download.href = url;
            download.download = name;
            download.textContent = t("download");
            download.style.display = "block";
            download.style.marginBottom = "20px";

            doc.body.append(title, download);

            if (isImage({name})) {
                const img = doc.createElement("img");
                img.src = url;
                img.alt = name;
                img.style.maxWidth = "100%";
                img.style.maxHeight = "75vh";
                doc.body.appendChild(img);
            } else if (ext === "pdf") {
                const iframe = doc.createElement("iframe");
                iframe.src = url;
                iframe.style.width = "100%";
                iframe.style.height = "75vh";
                iframe.style.border = "none";
                doc.body.appendChild(iframe);
            } else if ([
                "txt", "md", "csv", "json", "log"
            ].includes(ext)) {
                const pre = doc.createElement("pre");
                pre.textContent = await file.text();
                pre.style.whiteSpace = "pre-wrap";
                pre.style.textAlign = "left";
                doc.body.appendChild(pre);
            } else {
                const info = doc.createElement("p");
                info.textContent = t("previewUnavailable");
                doc.body.appendChild(info);
            }

            const cleanup = setInterval(() => {
                if (popup.closed) {
                    clearInterval(cleanup);
                    URL.revokeObjectURL(url);
                }
            }, 1000);

        } catch (error) {
            popup.close();
            showToast(t("fileError"));
        }
    }

    // ==========================================
    // UPLOAD - ONLY ONE UPLOAD ZONE
    // ==========================================

    function setupUpload() {
        const form = $("createPostForm");

        // Prevent duplicated upload sections.
        form.querySelectorAll(".forum-upload-zone")
            .forEach(zone => zone.remove());

        const zone = el("div", "forum-upload-zone");

        const label = el("label", "forum-upload-label");
        label.htmlFor = "forumFileInput";

        label.append(
            icon("paperclip"),
            el("span", "", t("attach"))
        );

        const input = document.createElement("input");
        input.type = "file";
        input.multiple = true;
        input.id = "forumFileInput";
        input.className = "forum-upload-input";

        const hint = el("p", "upload-hint", t("attachHint"));

        const files = el("div", "selected-files");
        files.id = "selectedFiles";

        zone.append(label, input, hint, files);

        form.insertBefore(
            zone,
            form.querySelector(".forum-modal-actions")
        );

        input.addEventListener("change", () => {
            Array.from(input.files || []).forEach(file => {
                if (selectedFiles.length >= MAX_FILES) {
                    showToast(t("tooManyFiles"));
                    return;
                }

                if (file.size > MAX_FILE_SIZE) {
                    showToast(t("fileTooLarge"));
                    return;
                }

                selectedFiles.push(file);
            });

            input.value = "";
            renderSelectedFiles();
        });
    }

    function renderSelectedFiles() {
        const container = $("selectedFiles");
        if (!container) return;

        container.replaceChildren();

        selectedFiles.forEach((file, index) => {
            const item = el("div", "selected-file");

            item.append(
                icon("file"),
                el("span", "", `${file.name} · ${formatSize(file.size)}`)
            );

            const remove = el("button");
            remove.type = "button";
            remove.appendChild(icon("x"));

            remove.onclick = () => {
                selectedFiles.splice(index, 1);
                renderSelectedFiles();
            };

            item.appendChild(remove);
            container.appendChild(item);
        });

        refreshIcons();
    }

    // ==========================================
    // CREATE / DELETE POSTS
    // ==========================================

    function openModal() {
        $("postModal").classList.remove("hidden");
        $("postTitle").focus();
    }

    function closeModal() {
        $("postModal").classList.add("hidden");
        $("createPostForm").reset();
        selectedFiles = [];
        renderSelectedFiles();
    }

    async function createPost(event) {
        event.preventDefault();

        const title = $("postTitle").value.trim();
        const content = $("postContent").value.trim();
        const category = $("postCategory").value.trim();

        if (!title || !content || !category || category.length > 80) {
            showToast(t("incomplete"));
            return;
        }

        const submit = $("createPostForm").querySelector(
            'button[type="submit"]'
        );

        submit.disabled = true;

        const attachments = [];
        const saved = [];

        try {
            for (const file of selectedFiles) {
                const key = id();
                await saveBlob(key, file);
                saved.push(key);

                attachments.push({
                    id: key,
                    name: file.name,
                    size: file.size,
                    type: file.type
                });
            }

            const post = {
                id: id(),
                userId: user.username,
                author: user.fullName,
                title,
                content,
                category,
                createdAt: Date.now(),
                likes: [],
                comments: [],
                attachments
            };

            posts.unshift(post);

            if (!savePosts()) {
                posts.shift();
                throw new Error(t("saveError"));
            }

            $("forumSearch").value = "";
            $("categoryFilter").value = "";
            $("sortFilter").value = "recent";

            closeModal();
            renderPosts();
            showToast(t("postPublished"));

        } catch (error) {
            for (const key of saved) {
                await deleteBlob(key).catch(() => {});
            }

            showToast(error.message || t("fileError"));
        } finally {
            submit.disabled = false;
        }
    }

    async function deletePost(postId) {
        const post = posts.find(p => p.id === postId);

        if (!post || post.userId !== user.username) return;
        if (!confirm(t("deletePost"))) return;

        const old = posts;
        posts = posts.filter(p => p.id !== postId);

        if (!savePosts()) {
            posts = old;
            return;
        }

        for (const attachment of post.attachments) {
            await deleteBlob(attachment.id).catch(() => {});
        }

        openComments.delete(postId);
        renderPosts();
        showToast(t("postDeleted"));
    }

    // ==========================================
    // LIKES
    // ==========================================

    function toggleLike(postId, commentId = null) {
        const post = posts.find(p => p.id === postId);
        if (!post) return;

        const target = commentId
            ? post.comments.find(c => c.id === commentId)
            : post;

        if (!target) return;

        const old = [...target.likes];

        if (target.likes.includes(user.username)) {
            target.likes = target.likes.filter(
                x => x !== user.username
            );
        } else {
            target.likes.push(user.username);
        }

        if (!savePosts()) {
            target.likes = old;
            return;
        }

        renderPosts();
    }

    // ==========================================
    // COMMENTS AND REPLIES
    // ==========================================

    function addComment(postId, text, parentId = null) {
        const post = posts.find(p => p.id === postId);
        if (!post) return;

        text = text.trim();

        if (!text || text.length > 1000) return;

        if (parentId && !post.comments.some(c => c.id === parentId)) {
            return;
        }

        const comment = {
            id: id(),
            userId: user.username,
            author: user.fullName,
            text,
            parentId,
            likes: [],
            createdAt: Date.now()
        };

        post.comments.push(comment);

        if (!savePosts()) {
            post.comments.pop();
            return;
        }

        openComments.add(postId);
        if (parentId) openReplies.delete(parentId);

        renderPosts();
        showToast(t("commentPublished"));
    }

    function deleteComment(postId, commentId) {
        const post = posts.find(p => p.id === postId);
        if (!post) return;

        const comment = post.comments.find(c => c.id === commentId);

        if (!comment || comment.userId !== user.username) return;
        if (!confirm(t("deleteComment"))) return;

        const ids = new Set([commentId]);

        let changed = true;

        while (changed) {
            changed = false;

            post.comments.forEach(c => {
                if (ids.has(c.parentId) && !ids.has(c.id)) {
                    ids.add(c.id);
                    changed = true;
                }
            });
        }

        const old = post.comments;

        post.comments = post.comments.filter(c => !ids.has(c.id));

        if (!savePosts()) {
            post.comments = old;
            return;
        }

        renderPosts();
        showToast(t("commentDeleted"));
    }

    function commentForm(postId, parentId = null) {
        const form = el(
            "form",
            parentId ? "reply-form" : "comment-form"
        );

        const input = document.createElement("input");
        input.type = "text";
        input.required = true;
        input.maxLength = 1000;
        input.placeholder = parentId
            ? t("replyPlaceholder")
            : t("commentPlaceholder");

        const submit = el("button");
        submit.type = "submit";
        submit.appendChild(icon("send"));

        form.append(input, submit);

        form.addEventListener("submit", event => {
            event.preventDefault();
            addComment(postId, input.value, parentId);
        });

        return form;
    }

    function buildComment(post, comment, depth = 0, visited = new Set()) {
        const thread = el("div", "comment-thread");

        if (visited.has(comment.id) || depth > 12) return thread;

        const seen = new Set(visited);
        seen.add(comment.id);

        const row = el("div", "comment-item");
        const avatar = el(
            "div",
            "comment-avatar",
            initials(comment.author)
        );

        const content = el("div", "comment-content");
        const meta = el("div", "comment-meta");

        meta.append(
            el("strong", "", comment.author),
            el("small", "", formatDate(comment.createdAt))
        );

        const demoComment = comment.id === "demo-comment-1" ||
            comment.id === "comment-physics";

        const commentText = demoComment
            ? (language === "ro"
                ? "Am încărcat notițele în Library!"
                : "I uploaded the notes to the Library!")
            : comment.text;

        const text = el("p", "comment-text", commentText);
        const actions = el("div", "comment-actions");

        const liked = comment.likes.includes(user.username);

        const likeBtn = el(
            "button",
            "comment-action" + (liked ? " liked" : "")
        );

        likeBtn.type = "button";
        likeBtn.append(
            icon("heart"),
            document.createTextNode(String(comment.likes.length))
        );

        likeBtn.onclick = () => toggleLike(post.id, comment.id);

        const replyBtn = el("button", "comment-action");
        replyBtn.type = "button";

        replyBtn.append(
            icon("reply"),
            document.createTextNode(t("reply"))
        );

        replyBtn.onclick = () => {
            if (openReplies.has(comment.id)) {
                openReplies.delete(comment.id);
            } else {
                openReplies.add(comment.id);
            }

            renderPosts();
        };

        actions.append(likeBtn, replyBtn);

        if (comment.userId === user.username) {
            const remove = el("button", "comment-action danger");
            remove.type = "button";

            remove.append(
                icon("trash-2"),
                document.createTextNode(t("delete"))
            );

            remove.onclick = () => deleteComment(
                post.id,
                comment.id
            );

            actions.appendChild(remove);
        }

        content.append(meta, text, actions);

        if (openReplies.has(comment.id)) {
            content.appendChild(
                commentForm(post.id, comment.id)
            );
        }

        row.append(avatar, content);
        thread.appendChild(row);

        const children = post.comments.filter(
            c => c.parentId === comment.id
        );

        if (children.length) {
            const nested = el("div", "comment-children");

            children.forEach(child => {
                nested.appendChild(
                    buildComment(post, child, depth + 1, seen)
                );
            });

            thread.appendChild(nested);
        }

        return thread;
    }

    function buildComments(post) {
        const panel = el("div", "comments-panel");

        panel.appendChild(el(
            "div",
            "comments-heading",
            `${t("comments")} (${post.comments.length})`
        ));

        post.comments
            .filter(comment => !comment.parentId)
            .forEach(comment => {
                panel.appendChild(buildComment(post, comment));
            });

        panel.appendChild(commentForm(post.id));

        return panel;
    }

    // ==========================================
    // ATTACHMENT CARDS
    // ==========================================

    function buildAttachments(post) {
        const wrapper = el("div", "post-attachments");

        post.attachments.forEach(attachment => {
            if (isImage(attachment)) {
                const button = el("button", "post-image-preview");
                button.type = "button";

                const img = document.createElement("img");
                img.alt = attachment.name;

                button.append(
                    img,
                    el("span", "", attachment.name)
                );

                readBlob(attachment.id).then(file => {
                    if (!file || !button.isConnected) return;

                    const blob = imageBlob(file, attachment.name);
                    const url = URL.createObjectURL(blob);

                    objectUrls.push(url);
                    img.src = url;

                    img.onerror = () => {
                        img.style.display = "none";
                    };
                }).catch(console.error);

                button.onclick = () => openAttachment(attachment);
                wrapper.appendChild(button);

            } else {
                const card = el("div", "post-document");
                const fileIcon = el("div", "post-document-icon");
                fileIcon.appendChild(icon("file-text"));

                const details = el("div", "post-document-details");

                details.append(
                    el("strong", "", attachment.name),
                    el("small", "", formatSize(attachment.size))
                );

                const open = el("button", "post-file-open");
                open.type = "button";
                open.appendChild(icon("external-link"));
                open.onclick = () => openAttachment(attachment);

                card.append(fileIcon, details, open);
                wrapper.appendChild(card);
            }
        });

        return wrapper;
    }

    // ==========================================
    // RENDER POSTS
    // ==========================================

    function displayPost(post) {
        const translation = demoTranslations[post.id];

        if (translation) {
            const lang = translatedPosts.has(post.id)
                ? (language === "ro" ? "en" : "ro")
                : language;

            return translation[lang];
        }

        return {
            title: post.title,
            content: post.content
        };
    }

    function buildPost(post) {
        const displayed = displayPost(post);
        const card = el("article", "forum-post");
        const top = el("div", "post-top");

        const avatar = el(
            "div",
            "forum-avatar",
            initials(post.author)
        );

        const author = el("div", "post-author");

        author.append(
            el("strong", "", post.author),
            el("small", "", formatDate(post.createdAt))
        );

        top.append(
            avatar,
            author,
            el("span", "post-category", subjectLabel(post.category))
        );

        if (post.userId === user.username) {
            const remove = el("button", "post-delete-btn");
            remove.type = "button";
            remove.title = t("delete");
            remove.appendChild(icon("trash-2"));
            remove.onclick = () => deletePost(post.id);

            top.appendChild(remove);
        }

        card.append(
            top,
            el("h3", "", displayed.title),
            el("p", "post-description", displayed.content)
        );

        if (post.attachments.length) {
            card.appendChild(buildAttachments(post));
        }

        const extra = el("div", "post-extra-actions");
        const translate = el("button", "translate-post-btn");

        translate.type = "button";

        translate.append(
            icon("languages"),
            document.createTextNode(
                translatedPosts.has(post.id)
                    ? t("original")
                    : t("translate")
            )
        );

        translate.onclick = () => {
            if (!demoTranslations[post.id]) {
                showToast(t("noTranslation"));
                return;
            }

            if (translatedPosts.has(post.id)) {
                translatedPosts.delete(post.id);
            } else {
                translatedPosts.add(post.id);
            }

            renderPosts();
        };

        extra.appendChild(translate);
        card.appendChild(extra);
        card.appendChild(el("div", "post-divider"));

        const actions = el("div", "post-actions");
        const liked = post.likes.includes(user.username);

        const likeBtn = el(
            "button",
            "post-action" + (liked ? " liked" : "")
        );

        likeBtn.type = "button";
        likeBtn.append(
            icon("heart"),
            document.createTextNode(
                `${post.likes.length} ${t("likes")}`
            )
        );

        likeBtn.onclick = () => toggleLike(post.id);

        const commentsBtn = el("button", "post-action");
        commentsBtn.type = "button";

        commentsBtn.append(
            icon("message-circle"),
            document.createTextNode(
                `${post.comments.length} ${t("comments")}`
            )
        );

        commentsBtn.onclick = () => {
            if (openComments.has(post.id)) {
                openComments.delete(post.id);
            } else {
                openComments.add(post.id);
            }

            renderPosts();
        };

        actions.append(likeBtn, commentsBtn);
        card.appendChild(actions);

        if (openComments.has(post.id)) {
            card.appendChild(buildComments(post));
        }

        return card;
    }

    function renderPosts() {
        clearUrls();

        const container = $("forumPosts");

        const query = normalize($("forumSearch").value);
        const subject = normalize($("categoryFilter").value);

        let filtered = posts.filter(post => {
            const displayed = displayPost(post);

            const combined = normalize([
                post.title,
                post.content,
                displayed.title,
                displayed.content,
                post.author,
                subjectSearch(post.category)
            ].join(" "));

            return combined.includes(query) &&
                subjectSearch(post.category).includes(subject);
        });

        if ($("sortFilter").value === "popular") {
            filtered.sort((a, b) =>
                (b.likes.length + b.comments.length) -
                (a.likes.length + a.comments.length) ||
                b.createdAt - a.createdAt
            );
        } else {
            filtered.sort((a, b) =>
                b.createdAt - a.createdAt
            );
        }

        $("postCount").textContent =
            filtered.length + " " +
            (filtered.length === 1 ? t("post") : t("posts"));

        container.replaceChildren();

        if (!filtered.length) {
            const empty = el("div", "empty-feed");

            empty.append(
                icon("messages-square"),
                el("h3", "", t("emptyTitle")),
                el("p", "", t("emptyText"))
            );

            container.appendChild(empty);
        } else {
            filtered.forEach(post => {
                container.appendChild(buildPost(post));
            });
        }

        renderPopularSubjects();
        refreshIcons();
    }

    // ==========================================
    // INTERFACE TRANSLATION
    // ==========================================

    function translateInterface() {
        setText(".forum-eyebrow", t("community"));
        setText(".forum-header h1", t("title"));
        setText(".forum-header > div > p", t("description"));
        setText("#openPostModal", t("create"));
        setText(".feed-section-heading h2", t("feed"));

        setText(".forum-info-card:first-child h3", t("welcome"));
        setText(".forum-info-card:first-child p", t("welcomeText"));
        setText(".forum-info-card:nth-child(2) h3", t("popularSubjects"));
        setText(".forum-tip h3", t("aiTitle"));
        setText(".forum-tip p", t("aiText"));
        setText(".ai-forum-link", t("aiOpen"));

        setText(".forum-modal-heading h2", t("modal"));
        setText(
            '#createPostForm button[type="submit"]',
            t("publish")
        );

        setText(".forum-upload-label", t("attach"));
        setText(".upload-hint", t("attachHint"));

        setText('label[for="postTitle"]', t("titleLabel"));
        setText('label[for="postCategory"]', t("subjectLabel"));
        setText('label[for="postContent"]', t("descriptionLabel"));

        $("postTitle").placeholder = t("titlePlaceholder");
        $("postContent").placeholder = t("descriptionPlaceholder");
        $("quickPostBtn").textContent = t("quick");
        $("forumSearch").placeholder = t("search");
        $("categoryFilter").placeholder = t("subjectSearch");

        $("sortFilter").options[0].textContent = t("recent");
        $("sortFilter").options[1].textContent = t("popular");

        $("cancelPost").textContent = t("cancel");

        document.querySelectorAll(".lang-option").forEach(btn => {
            btn.classList.toggle(
                "active",
                btn.dataset.lang === language
            );
        });

        document.documentElement.lang = language;

        // Update suggestions every time language changes.
        updateSubjectSuggestions();

        renderSelectedFiles();
        renderPosts();
    }

    function changeLanguage(lang) {
        if (!translations[lang]) return;

        language = lang;
        localStorage.setItem(LANG_KEY, lang);

        translatedPosts.clear();
        translateInterface();
    }

    // ==========================================
    // EVENTS
    // ==========================================

    function setupEvents() {
        $("openPostModal").onclick = openModal;
        $("quickPostBtn").onclick = openModal;
        $("quickPostPlus").onclick = openModal;

        $("closePostModal").onclick = closeModal;
        $("cancelPost").onclick = closeModal;

        $("createPostForm").addEventListener(
            "submit",
            createPost
        );

        $("forumSearch").addEventListener("input", renderPosts);
        $("categoryFilter").addEventListener("input", renderPosts);
        $("sortFilter").addEventListener("change", renderPosts);

        // The existing language menu controls the forum too.
        document.querySelectorAll(".lang-option").forEach(btn => {
            btn.addEventListener("click", () => {
                changeLanguage(btn.dataset.lang);
            });
        });

        $("postModal").addEventListener("click", event => {
            if (event.target === $("postModal")) {
                closeModal();
            }
        });

        document.addEventListener("keydown", event => {
            if (
                event.key === "Escape" &&
                !$("postModal").classList.contains("hidden")
            ) {
                closeModal();
            }
        });
    }

    // ==========================================
    // INITIALIZE
    // ==========================================

    function initialize() {
        if (!document.querySelector(
            'link[href*="forum-upgrades.css"]'
        )) {
            const css = document.createElement("link");
            css.rel = "stylesheet";
            css.href = "/static/forum-upgrades.css";
            document.head.appendChild(css);
        }

        setupSubjectInputs();
        setupUpload();

        loadPosts();
        setupEvents();
        translateInterface();
    }

    initialize();
});
