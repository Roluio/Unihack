
// ==========================================
// UNIBUDDY AI - FRONTEND
// ==========================================

const $ = id => document.getElementById(id);
const iconRefresh = () => window.lucide?.createIcons();

const username = window.UNIBUDDY_USERNAME || "student";
const STORAGE_KEY = `UniBuddyAI_${username}`;

let chats = [];
let activeChatId = null;
let isLoading = false;
let mode = "chat";
let docFile = null;

const translations = {
    ro: {
        title: "Cu ce te pot ajuta să înveți?",
        description: "Întreabă orice, înțelege concepte dificile, rezumă notițe sau pregătește-te pentru examene.",
        placeholder: "Întreabă UniBuddy AI...",
        explain: "Explică un subiect",
        summary: "Rezumă notițe",
        quiz: "Generează un test",
        plan: "Plan de învățare",
        thinking: "UniBuddy AI se gândește...",
        error: "Nu am putut obține un răspuns.",
        noKey: "Cheia API nu este configurată pe server.",
        topicPlaceholder: "Despre ce temă? (sau folosește notițe / fișier)",
        goalPlaceholder: "Pentru ce examen sau obiectiv?",
        summaryPlaceholder: "Opțional: ce să accentuez? (folosește notițe sau fișier)",
        needInput: "Scrie ceva, adaugă notițe sau atașează un fișier."
    },
    en: {
        title: "How can I help you study?",
        description: "Ask anything, understand difficult topics, summarize notes or prepare for exams.",
        placeholder: "Ask UniBuddy AI anything...",
        explain: "Explain a topic",
        summary: "Summarize notes",
        quiz: "Generate a quiz",
        plan: "Study plan",
        thinking: "UniBuddy AI is thinking...",
        error: "Could not get an AI response.",
        noKey: "The server API key is not configured.",
        topicPlaceholder: "What topic? (or use notes / a file)",
        goalPlaceholder: "Which exam or goal?",
        summaryPlaceholder: "Optional: what to focus on? (use notes or a file)",
        needInput: "Type something, add notes or attach a file."
    }
};

function getLanguage() {
    return $("languageSelect").value;
}

function createId() {
    return crypto.randomUUID();
}

function loadChats() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));

        if (Array.isArray(saved)) {
            chats = saved;
            return;
        }
    } catch (error) {
        console.error("Chat history error:", error);
    }

    chats = [];
}

function saveChats() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
    } catch (error) {
        console.warn("Chat history could not be saved.", error);
    }
}

function currentChat() {
    return chats.find(chat => chat.id === activeChatId);
}

function createChat() {
    const chat = {
        id: createId(),
        title: "New Chat",
        messages: [],
        createdAt: Date.now()
    };

    chats.unshift(chat);
    activeChatId = chat.id;

    saveChats();
    renderHistory();
    renderChat();
}

function selectChat(id) {
    activeChatId = id;
    renderHistory();
    renderChat();
}

function deleteChat(id) {
    if (isLoading) return;

    if (!confirm("Delete this conversation?")) return;

    chats = chats.filter(chat => chat.id !== id);

    if (activeChatId === id) {
        activeChatId = chats[0]?.id || null;
    }

    saveChats();
    renderHistory();
    renderChat();
}

function renderHistory() {
    const container = $("chatHistory");
    container.replaceChildren();

    for (const chat of chats) {
        const row = document.createElement("div");
        row.className = "history-item";

        if (chat.id === activeChatId) {
            row.classList.add("active");
        }

        const icon = document.createElement("i");
        icon.setAttribute("data-lucide", "message-square");

        const title = document.createElement("span");
        title.textContent = chat.title;

        const remove = document.createElement("button");
        remove.className = "history-delete";
        remove.title = "Delete chat";
        remove.setAttribute("aria-label", "Delete chat");

        const trash = document.createElement("i");
        trash.setAttribute("data-lucide", "trash-2");

        remove.appendChild(trash);

        remove.addEventListener("click", event => {
            event.stopPropagation();
            deleteChat(chat.id);
        });

        row.append(icon, title, remove);

        row.addEventListener("click", () => {
            if (!isLoading) selectChat(chat.id);
        });

        container.appendChild(row);
    }

    iconRefresh();
}

function updateLanguage() {
    const dict = translations[getLanguage()];

    $("welcomeTitle").textContent = dict.title;
    $("welcomeDescription").textContent = dict.description;

    const actions = ["explain", "summary", "quiz", "plan"];

    document.querySelectorAll(".action-card").forEach((card, index) => {
        card.querySelector("strong").textContent = dict[actions[index]];
    });
}

// ------------------------------------------------------------
// Interactive quiz
// ------------------------------------------------------------

function buildQuiz(data, message) {
    const wrap = document.createElement("div");
    wrap.className = "quiz";

    const title = document.createElement("h4");
    title.textContent = data.title;
    wrap.appendChild(title);

    const state = message.quizState || (message.quizState = {});
    const score = document.createElement("div");
    score.className = "quiz-score";

    const updateScore = () => {
        const answered = Object.keys(state).length;
        const correct = data.questions.filter((q, i) => state[i] === q.answer_index).length;
        score.textContent = answered === data.questions.length
            ? `Score: ${correct} / ${data.questions.length}`
            : `${answered} / ${data.questions.length}`;
    };

    data.questions.forEach((q, qi) => {
        const card = document.createElement("div");
        card.className = "quiz-q";

        const text = document.createElement("p");
        text.className = "quiz-question";
        text.textContent = `${qi + 1}. ${q.question}`;
        card.appendChild(text);

        const explain = document.createElement("div");
        explain.className = "quiz-explain hidden";
        explain.textContent = q.explanation;

        const buttons = [];

        const reveal = chosen => {
            buttons.forEach((b, i) => {
                b.disabled = true;
                if (i === q.answer_index) b.classList.add("correct");
                else if (i === chosen) b.classList.add("wrong");
            });
            explain.classList.remove("hidden");
        };

        q.options.forEach((option, oi) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "quiz-option";
            btn.textContent = option;
            btn.addEventListener("click", () => {
                state[qi] = oi;
                reveal(oi);
                updateScore();
                saveChats();
            });
            buttons.push(btn);
            card.appendChild(btn);
        });

        card.appendChild(explain);
        wrap.appendChild(card);

        if (state[qi] !== undefined) reveal(state[qi]);
    });

    updateScore();
    wrap.appendChild(score);
    return wrap;
}

// ------------------------------------------------------------
// Flashcards (flip cards)
// ------------------------------------------------------------

function buildFlashcards(data) {
    const wrap = document.createElement("div");
    wrap.className = "flashcards";

    const title = document.createElement("h4");
    title.textContent = `${data.title} · ${data.cards.length}`;
    wrap.appendChild(title);

    const grid = document.createElement("div");
    grid.className = "flash-grid";

    data.cards.forEach(card => {
        const el = document.createElement("button");
        el.type = "button";
        el.className = "flash-card";
        el.title = "Click to flip";

        const front = document.createElement("div");
        front.className = "flash-face front";
        front.textContent = card.front;

        const back = document.createElement("div");
        back.className = "flash-face back";
        back.textContent = card.back;

        el.append(front, back);
        el.addEventListener("click", () => el.classList.toggle("flipped"));
        grid.appendChild(el);
    });

    wrap.appendChild(grid);
    return wrap;
}

function messagePlainText(message) {
    if (message.kind === "quiz") {
        return message.data.questions
            .map((q, i) => `${i + 1}. ${q.question}\n` +
                q.options.map((o, j) => `   ${"ABCD"[j]}) ${o}`).join("\n") +
                `\n   Answer: ${"ABCD"[q.answer_index]}`)
            .join("\n\n");
    }
    if (message.kind === "flashcards") {
        return message.data.cards.map(c => `${c.front} — ${c.back}`).join("\n");
    }
    return message.text;
}

function addMessageElement(message) {
    const container = $("messagesContainer");

    const row = document.createElement("div");
    row.className = `message ${message.role === "user" ? "user" : "assistant"}`;

    const content = document.createElement("div");
    content.className = "message-content";

    const name = document.createElement("div");
    name.className = "message-name";
    name.textContent = message.role === "user" ? "You" : "UniBuddy AI";

    const bubble = document.createElement("div");
    bubble.className = "message-bubble";

    if (message.role === "user") {
        // textContent prevents injected HTML from executing.
        bubble.textContent = message.text;
    } else if (message.kind === "quiz") {
        bubble.classList.add("rich");
        bubble.appendChild(buildQuiz(message.data, message));
    } else if (message.kind === "flashcards") {
        bubble.classList.add("rich");
        bubble.appendChild(buildFlashcards(message.data));
    } else {
        bubble.classList.add("md");
        // renderMarkdown escapes all HTML before formatting.
        bubble.innerHTML = renderMarkdown(message.text);
    }

    content.append(name, bubble);

    if (message.role === "assistant") {
        const avatar = document.createElement("div");
        avatar.className = "message-avatar";

        const icon = document.createElement("i");
        icon.setAttribute("data-lucide", "sparkles");
        avatar.appendChild(icon);

        row.appendChild(avatar);
    }

    row.appendChild(content);

    if (message.role === "assistant") {
        const actions = document.createElement("div");
        actions.className = "message-actions";

        const copyBtn = document.createElement("button");
        copyBtn.className = "copy-btn";

        const icon = document.createElement("i");
        icon.setAttribute("data-lucide", "copy");

        copyBtn.append(icon, document.createTextNode("Copy"));

        copyBtn.addEventListener("click", async () => {
            try {
                await navigator.clipboard.writeText(messagePlainText(message));
                copyBtn.textContent = "Copied!";
            } catch {
                copyBtn.textContent = "Copy failed";
            }
        });

        actions.appendChild(copyBtn);
        content.appendChild(actions);
    }

    container.appendChild(row);
    iconRefresh();

    $("chatArea").scrollTop = $("chatArea").scrollHeight;
}

function renderChat() {
    const chat = currentChat();
    const messagesContainer = $("messagesContainer");

    messagesContainer.replaceChildren();

    if (!chat || !chat.messages.length) {
        $("welcomeScreen").classList.remove("hidden");
        messagesContainer.classList.add("hidden");
        return;
    }

    $("welcomeScreen").classList.add("hidden");
    messagesContainer.classList.remove("hidden");

    for (const message of chat.messages) {
        addMessageElement(message);
    }

    iconRefresh();
}

function setLoading(value) {
    isLoading = value;
    $("sendBtn").disabled = value;
    $("newChatBtn").disabled = value;
    $("messageInput").disabled = value;
}

function showTemporaryMessage(text, isError = false) {
    $("welcomeScreen").classList.add("hidden");
    $("messagesContainer").classList.remove("hidden");

    const row = document.createElement("div");
    row.className = "message assistant";

    if (isError) {
        row.classList.add("message-error");
    }

    const avatar = document.createElement("div");
    avatar.className = "message-avatar";

    const icon = document.createElement("i");
    icon.setAttribute("data-lucide", "sparkles");
    avatar.appendChild(icon);

    const content = document.createElement("div");
    content.className = "message-content";

    const bubble = document.createElement("div");
    bubble.className = "message-bubble";

    if (!isError) bubble.classList.add("thinking");

    bubble.textContent = text;
    content.appendChild(bubble);
    row.append(avatar, content);

    $("messagesContainer").appendChild(row);

    $("chatArea").scrollTop = $("chatArea").scrollHeight;
    iconRefresh();

    return row;
}

const MODE_ENDPOINTS = {
    chat: "/api/ai/chat",
    summary: "/api/ai/summarize",
    quiz: "/api/ai/quiz",
    flashcards: "/api/ai/flashcards",
    plan: "/api/ai/plan"
};

const MODE_LABELS = {
    ro: { chat: "Chat", summary: "Rezumat", quiz: "Test", flashcards: "Flashcards", plan: "Plan de studiu" },
    en: { chat: "Chat", summary: "Summary", quiz: "Quiz", flashcards: "Flashcards", plan: "Study plan" }
};

function optionValue(id, fallback) {
    const el = $(id);
    return el ? el.value : fallback;
}

function buildToolOptions() {
    const box = $("toolOptions");
    box.replaceChildren();

    const field = (label, id, html) => {
        const wrap = document.createElement("label");
        wrap.className = "opt";
        const span = document.createElement("span");
        span.textContent = label;
        wrap.appendChild(span);
        wrap.insertAdjacentHTML("beforeend", html);
        wrap.querySelector("select,input").id = id;
        box.appendChild(wrap);
    };

    if (mode === "summary") {
        field("Style", "optStyle",
            '<select><option value="detailed">Detailed</option><option value="short">Short</option>' +
            '<option value="paper">Research paper</option><option value="eli5">Explain simply</option></select>');
    } else if (mode === "quiz") {
        field("Questions", "optCount",
            '<select><option>5</option><option>8</option><option>10</option><option>15</option></select>');
        field("Difficulty", "optDifficulty",
            '<select><option value="easy">Easy</option><option value="medium" selected>Medium</option>' +
            '<option value="hard">Hard</option></select>');
    } else if (mode === "flashcards") {
        field("Cards", "optCount",
            '<select><option>8</option><option selected>10</option><option>15</option><option>20</option></select>');
    } else if (mode === "plan") {
        field("Days", "optDays", '<input type="number" min="1" max="60" value="7">');
        field("Hours / day", "optHours", '<input type="number" min="0.5" max="12" step="0.5" value="2">');
    }

    box.classList.toggle("hidden", mode === "chat");
}

function setMode(next) {
    mode = next;

    document.querySelectorAll(".tool-tab").forEach(tab => {
        tab.classList.toggle("active", tab.dataset.mode === mode);
    });

    buildToolOptions();

    const dict = translations[getLanguage()];
    const placeholders = {
        chat: dict.placeholder,
        summary: dict.summaryPlaceholder,
        quiz: dict.topicPlaceholder,
        flashcards: dict.topicPlaceholder,
        plan: dict.goalPlaceholder
    };
    $("messageInput").placeholder = placeholders[mode];

    // tools that work from material open the notes/file panel
    if (mode === "summary") {
        $("contextPanel").classList.remove("hidden");
    }

    iconRefresh();
}

function describeRequest(text, notes) {
    const label = MODE_LABELS[getLanguage()][mode];
    const bits = [];
    if (docFile) bits.push(`📎 ${docFile.name}`);
    else if (notes) bits.push("📝 notes");
    const extra = bits.length ? ` (${bits.join(", ")})` : "";
    return mode === "chat" ? text : `[${label}] ${text || "—"}${extra}`;
}

async function sendMessage(event) {
    if (event) event.preventDefault();
    if (isLoading) return;

    const input = $("messageInput");
    const messageText = input.value.trim();
    const notes = $("courseNotes").value.trim();
    const language = getLanguage();

    // chat always needs a message; the other tools can work from notes/file/topic
    if (!messageText && (mode === "chat" || mode === "plan" ||
        (!notes && !docFile))) {
        showTemporaryMessage(translations[language].needInput, true);
        return;
    }

    if (!activeChatId) createChat();

    const chat = currentChat();
    const chatId = chat.id;

    const history = chat.messages
        .slice(-12)
        .map(message => ({
            role: message.role,
            content: messagePlainText(message)
        }));

    const requestMode = mode;
    const shownText = describeRequest(messageText, notes);

    chat.messages.push({ role: "user", text: shownText });

    if (chat.title === "New Chat") {
        chat.title = (messageText || shownText).slice(0, 38);
    }

    input.value = "";
    input.style.height = "auto";

    saveChats();
    renderHistory();
    renderChat();
    setLoading(true);

    const thinkingRow = showTemporaryMessage(
        translations[language].thinking
    );

    // Build request: multipart when a file is attached, JSON otherwise.
    const fields = { language, notes };

    if (requestMode === "chat") {
        fields.message = messageText;
        fields.history = history;
    } else if (requestMode === "summary") {
        fields.text = [notes, messageText].filter(Boolean).join("\n\n");
        fields.style = optionValue("optStyle", "detailed");
    } else if (requestMode === "quiz") {
        fields.topic = messageText;
        fields.text = notes;
        fields.count = optionValue("optCount", 5);
        fields.difficulty = optionValue("optDifficulty", "medium");
    } else if (requestMode === "flashcards") {
        fields.topic = messageText;
        fields.text = notes;
        fields.count = optionValue("optCount", 10);
    } else if (requestMode === "plan") {
        fields.goal = messageText;
        fields.text = notes;
        fields.days = optionValue("optDays", 7);
        fields.hours = optionValue("optHours", 2);
    }

    let fetchOptions;

    if (docFile) {
        const form = new FormData();
        for (const [key, value] of Object.entries(fields)) {
            form.append(key, typeof value === "object" ? JSON.stringify(value) : value);
        }
        form.append("file", docFile);
        fetchOptions = { method: "POST", body: form };
    } else {
        fetchOptions = {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(fields)
        };
    }

    try {
        const response = await fetch(MODE_ENDPOINTS[requestMode], fetchOptions);

        let data = {};
        try { data = await response.json(); } catch { /* non-JSON error */ }

        if (!response.ok || !data.success) {
            throw new Error(data.message || translations[language].error);
        }

        thinkingRow.remove();

        const targetChat = chats.find(c => c.id === chatId);

        if (targetChat) {
            if (requestMode === "quiz") {
                targetChat.messages.push({ role: "assistant", kind: "quiz", data: data.quiz });
            } else if (requestMode === "flashcards") {
                targetChat.messages.push({ role: "assistant", kind: "flashcards", data: data.flashcards });
            } else {
                targetChat.messages.push({ role: "assistant", text: data.reply });
            }
        }

        saveChats();
        renderHistory();
        renderChat();

    } catch (error) {
        thinkingRow.remove();
        showTemporaryMessage(error.message, true);
        console.error("AI request:", error);
    } finally {
        setLoading(false);
        input.focus();
    }
}

function useQuickAction(action) {
    const lang = getLanguage();

    if (action === "explain") {
        setMode("chat");
        $("messageInput").value = lang === "ro"
            ? "Explică-mi pe înțelesul unui student următorul subiect: "
            : "Explain this topic in simple student-friendly terms: ";
        $("messageInput").focus();
        return;
    }

    setMode(action);   // summary | quiz | plan
    $("messageInput").focus();
}

function setupEvents() {
    $("newChatBtn").addEventListener("click", createChat);

    $("clearChatBtn").addEventListener("click", () => {
        if (!activeChatId) return;
        deleteChat(activeChatId);
    });

    $("chatForm").addEventListener("submit", sendMessage);

    $("messageInput").addEventListener("keydown", event => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            sendMessage();
        }
    });

    $("messageInput").addEventListener("input", event => {
        const input = event.target;
        input.style.height = "auto";
        input.style.height = Math.min(
            input.scrollHeight, 150
        ) + "px";
    });

    $("notesBtn").addEventListener("click", () => {
        $("contextPanel").classList.toggle("hidden");
    });

    $("closeContextBtn").addEventListener("click", () => {
        $("contextPanel").classList.add("hidden");
    });

    $("languageSelect").addEventListener("change", () => {
        updateLanguage();
        setMode(mode);
    });

    document.querySelectorAll(".tool-tab").forEach(tab => {
        tab.addEventListener("click", () => setMode(tab.dataset.mode));
    });

    $("docFile").addEventListener("change", event => {
        const file = event.target.files[0];
        if (!file) return;

        if (file.size > 15 * 1024 * 1024) {
            alert("File too large (max 15 MB).");
            event.target.value = "";
            return;
        }

        docFile = file;
        $("docLabel").textContent = file.name;
        $("docClear").classList.remove("hidden");
        $("contextPanel").classList.remove("hidden");
    });

    $("docClear").addEventListener("click", () => {
        docFile = null;
        $("docFile").value = "";
        $("docLabel").textContent = "Attach PDF / image / TXT (max 15 MB)";
        $("docClear").classList.add("hidden");
    });

    document.querySelectorAll(".action-card").forEach(card => {
        card.addEventListener("click", () => {
            useQuickAction(card.dataset.action);
        });
    });
}

function initialize() {
    loadChats();

    if (chats.length) {
        activeChatId = chats[0].id;
    }

    $("languageSelect").value = "ro";

    setupEvents();
    updateLanguage();
    setMode("chat");
    renderHistory();
    renderChat();
    iconRefresh();
    checkStatus();
}

async function checkStatus() {
    try {
        const response = await fetch("/api/ai/status");
        const data = await response.json();

        if (data.success && !data.configured) {
            $("aiBanner").classList.remove("hidden");
        }
    } catch { /* offline: ignore */ }
}

initialize();
