
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
        noKey: "Cheia API nu este configurată pe server."
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
        noKey: "The server API key is not configured."
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
    $("messageInput").placeholder = dict.placeholder;

    const actions = ["explain", "summary", "quiz", "plan"];

    document.querySelectorAll(".action-card").forEach((card, index) => {
        card.querySelector("strong").textContent = dict[actions[index]];
    });
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

    // textContent prevents injected HTML from executing.
    bubble.textContent = message.text;

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
                await navigator.clipboard.writeText(message.text);
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

async function sendMessage(event) {
    if (event) event.preventDefault();
    if (isLoading) return;

    const input = $("messageInput");
    const messageText = input.value.trim();

    if (!messageText) return;

    if (!activeChatId) createChat();

    const chat = currentChat();
    const chatId = chat.id;

    const history = chat.messages
        .slice(-12)
        .map(message => ({
            role: message.role,
            content: message.text
        }));

    const notes = $("courseNotes").value.trim();
    const language = getLanguage();

    chat.messages.push({
        role: "user",
        text: messageText
    });

    if (chat.title === "New Chat") {
        chat.title = messageText.slice(0, 38);
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

    try {
        const response = await fetch("/api/ai/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                message: messageText,
                language,
                notes,
                history
            })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(
                data.message || translations[language].error
            );
        }

        thinkingRow.remove();

        const targetChat = chats.find(c => c.id === chatId);

        if (targetChat) {
            targetChat.messages.push({
                role: "assistant",
                text: data.reply
            });
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

    const prompts = {
        ro: {
            explain: "Explică-mi pe înțelesul unui student următorul subiect: ",
            summary: "Fă un rezumat structurat al notițelor pe care le-am adăugat. Dacă nu am adăugat notițe, cere-mi să le introduc.",
            quiz: "Creează un test cu 5 întrebări grilă din notițele mele și pune răspunsurile corecte la final. Dacă nu am notițe, întreabă-mă ce materie vreau să exersez.",
            plan: "Ajută-mă să fac un plan de învățare. Întreabă-mă ce examen am și câte zile mai am."
        },
        en: {
            explain: "Explain this topic in simple student-friendly terms: ",
            summary: "Create a structured summary of my course notes. If no notes are provided, ask me to add them.",
            quiz: "Create a 5-question multiple-choice quiz from my notes, with answers at the end. If I have no notes, ask which subject I want to practice.",
            plan: "Help me create a study plan. Ask which exam I have and how many days remain."
        }
    };

    $("messageInput").value = prompts[lang][action];
    $("messageInput").focus();

    if (action === "summary" || action === "quiz") {
        $("contextPanel").classList.remove("hidden");
    }
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

    $("languageSelect").addEventListener("change", updateLanguage);

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
    renderHistory();
    renderChat();
    iconRefresh();
}

initialize();
