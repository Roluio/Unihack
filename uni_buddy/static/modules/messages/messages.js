
const STORAGE_KEY = "UniBuddyMessagesV1";
const CURRENT_USER = "self";

const $ = id => document.getElementById(id);
const refreshIcons = () => window.lucide?.createIcons();

let conversations = [];
let activeConversationId = null;
let createMode = "private";
let toastTimer = null;
let highlightTimer = null;
let addMembersGroupId = null;

// ==========================================
// DEMO DATA
// ==========================================

const demoConversations = [
    {
        id: "group-1",
        name: "Physics Study Group",
        type: "group",
        memberIds: ["self", "maria", "andrei", "teodora"],
        members: 4,
        messages: [
            {
                id: "demo-1",
                sender: "Maria Ionescu",
                text: "Hi! Does anyone have the physics notes?",
                time: Date.now() - 1800000,
                mine: false
            },
            {
                id: "demo-2",
                sender: "Student",
                text: "Yes, I uploaded them to UniBuddy!",
                time: Date.now() - 1200000,
                mine: true
            }
        ]
    },
    {
        id: "group-2",
        name: "Programming Team",
        type: "group",
        memberIds: ["self", "maria", "teodora"],
        members: 3,
        messages: [
            {
                id: "demo-3",
                sender: "Maria Ionescu",
                text: "Don't forget about the Java assignment!",
                time: Date.now() - 7200000,
                mine: false
            }
        ]
    },
    {
        id: "private-2",
        name: "Maria Ionescu",
        type: "private",
        userId: "maria",
        messages: [
            {
                id: "demo-4",
                sender: "Maria Ionescu",
                text: "Thanks for helping me with the project!",
                time: Date.now() - 5400000,
                mine: false
            }
        ]
    },
    {
        id: "private-3",
        name: "Andrei Matei",
        type: "private",
        userId: "andrei",
        messages: [
            {
                id: "demo-5",
                sender: "Andrei Matei",
                text: "Are we meeting tomorrow for physics?",
                time: Date.now() - 4000000,
                mine: false
            }
        ]
    },
    {
        id: "private-4",
        name: "Teodora Marin",
        type: "private",
        userId: "teodora",
        messages: []
    }
];

// ==========================================
// LOCAL STORAGE
// ==========================================

function loadConversations() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);

        if (saved !== null) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) return parsed;
        }
    } catch (error) {
        console.error("Storage error:", error);
    }

    return structuredClone(demoConversations);
}

function saveConversations() {
    try {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(conversations)
        );
        return true;
    } catch (error) {
        console.error(error);
        showToast("Could not save changes.");
        return false;
    }
}

function migrateDemoData() {
    let changed = false;
    const previousLength = conversations.length;

    // Remove the old Alex demo chat.
    conversations = conversations.filter(c =>
        c.id !== "private-1" &&
        !(c.type === "private" &&
          c.name?.toLowerCase() === "alex popescu")
    );

    if (previousLength !== conversations.length) changed = true;

    const knownUsers = {
        "private-2": "maria",
        "private-3": "andrei",
        "private-4": "teodora"
    };

    const knownGroups = {
        "group-1": ["self", "maria", "andrei", "teodora"],
        "group-2": ["self", "maria", "teodora"]
    };

    for (const conversation of conversations) {
        if (!Array.isArray(conversation.messages)) {
            conversation.messages = [];
            changed = true;
        }

        if (
            conversation.type === "private" &&
            !conversation.userId
        ) {
            conversation.userId =
                knownUsers[conversation.id] ||
                `user-${conversation.id}`;

            changed = true;
        }

        if (conversation.type === "group") {
            if (!Array.isArray(conversation.memberIds)) {
                conversation.memberIds =
                    knownGroups[conversation.id] || [CURRENT_USER];

                changed = true;
            }

            // Do not overwrite an existing member list.
            const count = conversation.memberIds.length;

            if (conversation.members !== count) {
                conversation.members = count;
                changed = true;
            }
        }

        for (const message of conversation.messages) {
            if (!message.id) {
                message.id = crypto.randomUUID();
                changed = true;
            }
        }
    }

    if (changed) saveConversations();
}

// ==========================================
// HELPERS
// ==========================================

function getConversation(id) {
    return conversations.find(c => c.id === id);
}

function initials(name) {
    return String(name || "")
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(word => word[0]?.toUpperCase() || "")
        .join("");
}

function formatTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit"
    });
}

function formatDate(timestamp) {
    return new Date(timestamp).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric"
    });
}

function lastMessage(conversation) {
    return conversation.messages.at(-1) || null;
}

function showToast(message) {
    $("toastText").textContent = message;
    $("toast").classList.remove("hidden");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
        $("toast").classList.add("hidden");
    }, 3000);
}

function saveOrRevert(undo) {
    if (saveConversations()) return true;
    undo();
    return false;
}

function getMemberName(memberId) {
    if (memberId === CURRENT_USER) return "You";

    const privateChat = conversations.find(c =>
        c.type === "private" && c.userId === memberId
    );

    const known = {
        maria: "Maria Ionescu",
        andrei: "Andrei Matei",
        teodora: "Teodora Marin"
    };

    return privateChat?.name || known[memberId] || "Student";
}

// ==========================================
// CONVERSATION LIST
// ==========================================

function createConversationCard(conversation) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "conversation-item";

    if (conversation.id === activeConversationId) {
        button.classList.add("active");
    }

    const avatar = document.createElement("div");
    avatar.className = "contact-avatar";

    if (conversation.type === "group") {
        avatar.classList.add("group-avatar");

        const icon = document.createElement("i");
        icon.setAttribute("data-lucide", "users-round");
        avatar.appendChild(icon);
    } else {
        avatar.textContent = initials(conversation.name);
    }

    const details = document.createElement("div");
    details.className = "contact-details";

    const top = document.createElement("div");
    top.className = "contact-top";

    const name = document.createElement("strong");
    name.textContent = conversation.name;

    const time = document.createElement("time");
    const last = lastMessage(conversation);

    if (last) time.textContent = formatTime(last.time);

    top.append(name, time);

    const description = document.createElement("p");

    description.textContent = last
        ? `${last.mine ? "You: " : ""}${last.text}`
        : "Start a conversation...";

    details.append(top, description);
    button.append(avatar, details);

    button.addEventListener("click", () => {
        openConversation(conversation.id);
    });

    // No delete icon in the sidebar.
    return button;
}

function renderConversationLists() {
    const query = $("searchInput").value.toLowerCase().trim();

    const groups = $("groupsList");
    const messages = $("messagesList");

    groups.replaceChildren();
    messages.replaceChildren();

    const filtered = conversations
        .filter(c => c.name.toLowerCase().includes(query))
        .sort((a, b) =>
            (lastMessage(b)?.time || 0) -
            (lastMessage(a)?.time || 0)
        );

    for (const conversation of filtered) {
        const card = createConversationCard(conversation);

        if (conversation.type === "group") {
            groups.appendChild(card);
        } else {
            messages.appendChild(card);
        }
    }

    if (!groups.children.length) {
        const empty = document.createElement("div");
        empty.className = "no-conversations";
        empty.textContent = "No groups found.";
        groups.appendChild(empty);
    }

    if (!messages.children.length) {
        const empty = document.createElement("div");
        empty.className = "no-conversations";
        empty.textContent = "No conversations found.";
        messages.appendChild(empty);
    }

    refreshIcons();
}

// ==========================================
// OPEN CONVERSATION
// ==========================================

function openConversation(id) {
    const conversation = getConversation(id);
    if (!conversation) return;

    activeConversationId = id;

    $("chatName").textContent = conversation.name;

    const avatar = $("chatAvatar");
    avatar.replaceChildren();
    avatar.disabled = false;

    avatar.classList.toggle(
        "group-avatar",
        conversation.type === "group"
    );

    if (conversation.type === "group") {
        const icon = document.createElement("i");
        icon.setAttribute("data-lucide", "users-round");
        avatar.appendChild(icon);

        $("chatStatus").textContent =
            `${conversation.memberIds?.length || 1} members`;
    } else {
        avatar.textContent = initials(conversation.name);
        $("chatStatus").textContent = "Private conversation";
    }

    $("chatComposer").classList.remove("hidden");

    $("searchChatButton").disabled = false;
    $("chatInfoButton").disabled = false;
    $("moreButton").disabled = false;

    $("messageInput").value = "";
    $("messenger").classList.add("chat-open");

    // Group menu differs from private chat menu.
    $("deleteOption").replaceChildren();

    const deleteIcon = document.createElement("i");
    deleteIcon.setAttribute("data-lucide", "trash-2");

    const deleteLabel = document.createElement("span");
    deleteLabel.textContent =
        conversation.type === "group"
            ? "Delete Group"
            : "Delete Conversation";

    $("deleteOption").append(deleteIcon, deleteLabel);

    closeChatSearch();
    closeDropdown();

    renderConversationLists();
    renderMessages();
    refreshIcons();
}

// ==========================================
// MESSAGE RENDERING
// ==========================================

function createWelcomeState(title, description) {
    const welcome = document.createElement("div");
    welcome.className = "welcome-state";

    const iconBox = document.createElement("div");
    iconBox.className = "welcome-icon";

    const icon = document.createElement("i");
    icon.setAttribute("data-lucide", "messages-square");
    iconBox.appendChild(icon);

    const h2 = document.createElement("h2");
    h2.textContent = title;

    const p = document.createElement("p");
    p.textContent = description;

    welcome.append(iconBox, h2, p);
    return welcome;
}

function renderMessages(scrollToBottom = true) {
    const conversation = getConversation(activeConversationId);
    const body = $("chatBody");

    body.replaceChildren();

    if (!conversation) {
        body.appendChild(createWelcomeState(
            "Your conversations start here!",
            "Select a friend or study group to start chatting."
        ));
        refreshIcons();
        return;
    }

    if (!conversation.messages.length) {
        body.appendChild(createWelcomeState(
            "Say hello!",
            "No messages yet. Send the first message!"
        ));
        refreshIcons();
        return;
    }

    let previousDate = null;

    for (const message of conversation.messages) {
        const date = new Date(message.time).toDateString();

        if (date !== previousDate) {
            const divider = document.createElement("div");
            divider.className = "date-divider";

            const span = document.createElement("span");
            span.textContent = formatDate(message.time);

            divider.appendChild(span);
            body.appendChild(divider);

            previousDate = date;
        }

        const row = document.createElement("div");
        row.className = "message-row";
        row.dataset.messageId = message.id;

        if (message.mine) row.classList.add("mine");

        if (!message.mine) {
            const miniAvatar = document.createElement("div");
            miniAvatar.className = "message-mini-avatar";
            miniAvatar.textContent = initials(message.sender);

            row.appendChild(miniAvatar);
        }

        const content = document.createElement("div");
        content.className = "message-content";

        if (conversation.type === "group" && !message.mine) {
            const sender = document.createElement("span");
            sender.className = "sender-name";
            sender.textContent = message.sender;
            content.appendChild(sender);
        }

        const bubble = document.createElement("div");
        bubble.className = "message-bubble";
        bubble.textContent = message.text;

        const meta = document.createElement("div");
        meta.className = "message-meta";

        const time = document.createElement("span");
        time.textContent = formatTime(message.time);
        meta.appendChild(time);

        if (message.mine) {
            const check = document.createElement("i");
            check.setAttribute("data-lucide", "check-check");
            meta.appendChild(check);

            const deleteButton = document.createElement("button");
            deleteButton.type = "button";
            deleteButton.className = "message-delete-btn";
            deleteButton.title = "Delete message";

            const deleteIcon = document.createElement("i");
            deleteIcon.setAttribute("data-lucide", "trash-2");

            deleteButton.appendChild(deleteIcon);

            deleteButton.addEventListener("click", () => {
                deleteMessage(conversation.id, message.id);
            });

            meta.appendChild(deleteButton);
        }

        content.append(bubble, meta);
        row.appendChild(content);
        body.appendChild(row);
    }

    refreshIcons();

    if (scrollToBottom) {
        requestAnimationFrame(() => {
            body.scrollTop = body.scrollHeight;
        });
    }
}

// ==========================================
// SEND / DELETE MESSAGES
// ==========================================

function sendMessage(event) {
    event.preventDefault();

    const conversation = getConversation(activeConversationId);
    const input = $("messageInput");

    if (!conversation) return;

    const text = input.value.trim();
    if (!text) return;

    const message = {
        id: crypto.randomUUID(),
        sender: "Student",
        text,
        time: Date.now(),
        mine: true
    };

    conversation.messages.push(message);

    if (!saveOrRevert(() => conversation.messages.pop())) return;

    input.value = "";
    input.style.height = "";

    renderConversationLists();
    renderMessages();

    if (!$("chatSearchPanel").classList.contains("hidden")) {
        searchInConversation();
    }

    input.focus();
}

function deleteMessage(conversationId, messageId) {
    const conversation = getConversation(conversationId);
    if (!conversation) return;

    const message = conversation.messages.find(m => m.id === messageId);

    if (!message?.mine) {
        showToast("You can only delete your own messages.");
        return;
    }

    if (!confirm("Delete this message?")) return;

    const previous = conversation.messages;

    conversation.messages = previous.filter(m => m.id !== messageId);

    if (!saveOrRevert(() => {
        conversation.messages = previous;
    })) return;

    renderConversationLists();
    renderMessages(false);

    if (!$("chatSearchPanel").classList.contains("hidden")) {
        searchInConversation();
    }

    showToast("Message deleted.");
}

// ==========================================
// SEARCH IN CONVERSATION
// ==========================================

function openChatSearch() {
    if (!activeConversationId) return;

    $("chatSearchPanel").classList.remove("hidden");
    $("chatSearchInput").value = "";
    $("chatSearchResults").replaceChildren();

    $("searchResultsInfo").textContent =
        "Type a word to search this conversation.";

    closeDropdown();
    $("chatSearchInput").focus();
}

function closeChatSearch() {
    $("chatSearchPanel").classList.add("hidden");
    $("chatSearchInput").value = "";
    $("chatSearchResults").replaceChildren();
    $("searchResultsInfo").textContent = "";

    clearHighlights();
}

function clearHighlights() {
    $("chatBody").querySelectorAll(".message-row")
        .forEach(row => row.classList.remove("search-target"));

    const conversation = getConversation(activeConversationId);
    if (!conversation) return;

    for (const row of $("chatBody").querySelectorAll(".message-row")) {
        const message = conversation.messages.find(
            m => m.id === row.dataset.messageId
        );

        const bubble = row.querySelector(".message-bubble");

        if (message && bubble) bubble.textContent = message.text;
    }
}

function appendHighlightedText(container, text, query) {
    const source = String(text);
    const lower = source.toLocaleLowerCase();
    const needle = query.toLocaleLowerCase();

    if (!needle) {
        container.textContent = source;
        return;
    }

    let position = 0;
    let index = lower.indexOf(needle);

    while (index !== -1) {
        container.appendChild(
            document.createTextNode(source.slice(position, index))
        );

        const mark = document.createElement("mark");
        mark.textContent = source.slice(index, index + needle.length);
        container.appendChild(mark);

        position = index + needle.length;
        index = lower.indexOf(needle, position);
    }

    container.appendChild(
        document.createTextNode(source.slice(position))
    );
}

function searchInConversation() {
    const conversation = getConversation(activeConversationId);
    if (!conversation) return;

    const query = $("chatSearchInput").value.trim();
    const container = $("chatSearchResults");

    container.replaceChildren();
    clearHighlights();

    if (!query) {
        $("searchResultsInfo").textContent =
            "Type a word to search this conversation.";
        return;
    }

    const matches = conversation.messages.filter(m =>
        m.text.toLocaleLowerCase().includes(query.toLocaleLowerCase())
    );

    $("searchResultsInfo").textContent =
        `${matches.length} message${matches.length === 1 ? "" : "s"} found`;

    for (const row of $("chatBody").querySelectorAll(".message-row")) {
        const message = conversation.messages.find(
            m => m.id === row.dataset.messageId
        );

        if (!message) continue;

        if (message.text.toLocaleLowerCase()
            .includes(query.toLocaleLowerCase())) {
            const bubble = row.querySelector(".message-bubble");
            bubble.replaceChildren();
            appendHighlightedText(bubble, message.text, query);
        }
    }

    for (const message of [...matches].reverse()) {
        const button = document.createElement("button");
        button.className = "search-result";

        const heading = document.createElement("strong");
        heading.textContent =
            `${message.mine ? "You" : message.sender} · ` +
            formatDate(message.time) + " " + formatTime(message.time);

        const preview = document.createElement("span");
        appendHighlightedText(preview, message.text, query);

        button.append(heading, preview);

        button.addEventListener("click", () => {
            jumpToMessage(message.id);
        });

        container.appendChild(button);
    }
}

function jumpToMessage(messageId) {
    const row = Array.from(
        $("chatBody").querySelectorAll(".message-row")
    ).find(element => element.dataset.messageId === messageId);

    if (!row) return;

    $("chatBody").querySelectorAll(".search-target")
        .forEach(element => element.classList.remove("search-target"));

    row.classList.add("search-target");

    row.scrollIntoView({
        behavior: "smooth",
        block: "center"
    });

    clearTimeout(highlightTimer);

    highlightTimer = setTimeout(() => {
        row.classList.remove("search-target");
    }, 3500);
}

// ==========================================
// COMMON GROUPS / PROFILE
// ==========================================

function getCommonGroups(conversation) {
    if (!conversation || conversation.type !== "private") return [];

    return conversations.filter(group =>
        group.type === "group" &&
        Array.isArray(group.memberIds) &&
        group.memberIds.includes(CURRENT_USER) &&
        group.memberIds.includes(conversation.userId)
    );
}

function setProfileSectionTitle(title) {
    const heading = document.querySelector(".mutual-heading h3");
    heading.replaceChildren();

    const icon = document.createElement("i");
    icon.setAttribute("data-lucide", "users-round");

    heading.append(icon, document.createTextNode(title));
}

function createProfileListItem(name, subtitle, onClick = null) {
    const element = document.createElement(
        onClick ? "button" : "div"
    );

    element.className = "mutual-group-item";

    if (onClick) {
        element.type = "button";
        element.addEventListener("click", onClick);
    }

    const iconBox = document.createElement("div");
    iconBox.className = "mutual-group-icon";

    const icon = document.createElement("i");
    icon.setAttribute(
        "data-lucide",
        onClick ? "users-round" : "user-round"
    );

    iconBox.appendChild(icon);

    const info = document.createElement("div");
    info.className = "mutual-group-name";

    const title = document.createElement("strong");
    title.textContent = name;

    const detail = document.createElement("small");
    detail.textContent = subtitle;

    info.append(title, detail);
    element.append(iconBox, info);

    if (onClick) {
        const arrow = document.createElement("i");
        arrow.setAttribute("data-lucide", "chevron-right");
        element.appendChild(arrow);
    }

    return element;
}

function openProfile() {
    const conversation = getConversation(activeConversationId);
    if (!conversation) return;

    closeDropdown();

    const isGroup = conversation.type === "group";

    $("profileName").textContent = conversation.name;
    $("profileSubtitle").textContent =
        isGroup ? "Study Group" : "UniBuddy Member";

    const avatar = $("profileAvatar");
    avatar.replaceChildren();
    avatar.classList.toggle("group-avatar", isGroup);

    if (isGroup) {
        const icon = document.createElement("i");
        icon.setAttribute("data-lucide", "users-round");
        avatar.appendChild(icon);
    } else {
        avatar.textContent = initials(conversation.name);
    }

    const list = $("mutualGroupsList");
    list.replaceChildren();

    // Remove any previously created Add Members button.
    document.getElementById("addMembersProfileBtn")?.remove();

    if (isGroup) {
        const members = conversation.memberIds || [CURRENT_USER];

        $("profileAbout").textContent =
            "A study group for learning and collaborating with classmates.";

        setProfileSectionTitle("Group Members");
        $("mutualGroupCount").textContent =
            `${members.length} members`;

        for (const memberId of members) {
            const isMe = memberId === CURRENT_USER;

            const row = document.createElement("div");
            row.className = "member-row";

            row.appendChild(createProfileListItem(
                getMemberName(memberId),
                isMe ? "Your account" : "Group member"
            ));

            if (!isMe) {
                const removeButton = document.createElement("button");
                removeButton.type = "button";
                removeButton.className = "remove-member-btn";
                removeButton.title = "Remove member";

                const icon = document.createElement("i");
                icon.setAttribute("data-lucide", "user-round-x");
                removeButton.appendChild(icon);

                removeButton.addEventListener("click", () => {
                    removeGroupMember(conversation.id, memberId);
                });

                row.appendChild(removeButton);
            }

            list.appendChild(row);
        }

        const addButton = document.createElement("button");
        addButton.id = "addMembersProfileBtn";
        addButton.type = "button";
        addButton.className = "add-members-btn";

        const plusIcon = document.createElement("i");
        plusIcon.setAttribute("data-lucide", "user-round-plus");

        addButton.append(
            plusIcon,
            document.createTextNode("Add Members")
        );

        addButton.addEventListener("click", () => {
            openAddMembersModal(conversation.id);
        });

        document.querySelector(".mutual-groups-section")
            .appendChild(addButton);

    } else {
        $("profileAbout").textContent =
            "Student on UniBuddy. Study together, share materials and stay connected.";

        setProfileSectionTitle("Groups in Common");

        const commonGroups = getCommonGroups(conversation);

        $("mutualGroupCount").textContent =
            `${commonGroups.length} group${commonGroups.length === 1 ? "" : "s"}`;

        if (!commonGroups.length) {
            const empty = document.createElement("div");
            empty.className = "no-mutual-groups";
            empty.textContent =
                "You don't have any groups in common yet.";
            list.appendChild(empty);
        }

        for (const group of commonGroups) {
            list.appendChild(createProfileListItem(
                group.name,
                `${group.memberIds.length} members`,
                () => {
                    closeProfile();
                    openConversation(group.id);
                }
            ));
        }
    }

    $("profileModal").classList.remove("hidden");
    refreshIcons();
}

function closeProfile() {
    $("profileModal").classList.add("hidden");
}

// ==========================================
// ADD MEMBERS - MODAL CREATED BY JS
// ==========================================

function initializeMembersModal() {
    if ($("addMembersModal")) return;

    const overlay = document.createElement("div");
    overlay.id = "addMembersModal";
    overlay.className = "modal-overlay hidden";

    overlay.innerHTML = `
        <div class="members-dialog">
            <div class="dialog-header">
                <h2>Add Members</h2>
                <button type="button" class="header-icon"
                        id="closeMembersModal" title="Close">
                    <i data-lucide="x"></i>
                </button>
            </div>

            <p class="members-description">
                Select students from your conversations
                to add to this study group.
            </p>

            <input
                type="search"
                id="memberSearchInput"
                class="members-search"
                placeholder="Search students..."
            >

            <div class="members-options" id="membersOptions"></div>

            <div class="dialog-buttons">
                <button type="button" class="cancel-button"
                        id="cancelAddMembers">Cancel</button>

                <button type="button" class="create-button"
                        id="confirmAddMembers">Add Selected</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    $("closeMembersModal").onclick = closeAddMembersModal;
    $("cancelAddMembers").onclick = closeAddMembersModal;
    $("confirmAddMembers").onclick = confirmAddMembers;

    $("memberSearchInput").addEventListener("input", renderMemberOptions);

    overlay.addEventListener("click", event => {
        if (event.target === overlay) closeAddMembersModal();
    });

    refreshIcons();
}

function openAddMembersModal(groupId) {
    const group = getConversation(groupId);
    if (!group || group.type !== "group") return;

    initializeMembersModal();

    addMembersGroupId = groupId;

    $("memberSearchInput").value = "";
    $("addMembersModal").classList.remove("hidden");

    renderMemberOptions();
    $("memberSearchInput").focus();
}

function closeAddMembersModal() {
    $("addMembersModal")?.classList.add("hidden");
    addMembersGroupId = null;
}

function getAvailableStudents(group) {
    const existingIds = new Set(group.memberIds || []);

    // Demo users come from private conversations.
    return conversations.filter(conversation =>
        conversation.type === "private" &&
        conversation.userId &&
        !existingIds.has(conversation.userId)
    );
}

function renderMemberOptions() {
    const group = getConversation(addMembersGroupId);
    if (!group) return;

    const query = $("memberSearchInput").value.trim().toLowerCase();
    const container = $("membersOptions");

    // Keep selections while filtering.
    const selected = new Set(
        Array.from(container.querySelectorAll(
            'input[type="checkbox"]:checked'
        )).map(input => input.value)
    );

    container.replaceChildren();

    const students = getAvailableStudents(group)
        .filter(student =>
            student.name.toLowerCase().includes(query)
        );

    if (!students.length) {
        const empty = document.createElement("div");
        empty.className = "members-empty";
        empty.textContent =
            "No available students found.";
        container.appendChild(empty);
        return;
    }

    for (const student of students) {
        const label = document.createElement("label");
        label.className = "member-option";

        const avatar = document.createElement("div");
        avatar.className = "member-option-avatar";
        avatar.textContent = initials(student.name);

        const name = document.createElement("span");
        name.className = "member-option-name";
        name.textContent = student.name;

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.value = student.userId;
        checkbox.checked = selected.has(student.userId);

        label.append(avatar, name, checkbox);
        container.appendChild(label);
    }
}

function confirmAddMembers() {
    const group = getConversation(addMembersGroupId);
    if (!group) return;

    const selectedIds = Array.from(
        $("membersOptions").querySelectorAll(
            'input[type="checkbox"]:checked'
        )
    ).map(input => input.value);

    if (!selectedIds.length) {
        showToast("Select at least one student.");
        return;
    }

    const previous = [...(group.memberIds || [CURRENT_USER])];

    group.memberIds = [...new Set([
        ...previous,
        ...selectedIds
    ])];

    group.members = group.memberIds.length;

    if (!saveOrRevert(() => {
        group.memberIds = previous;
        group.members = previous.length;
    })) return;

    closeAddMembersModal();

    renderConversationLists();
    openConversation(group.id);
    openProfile();

    showToast(
        `${selectedIds.length} member${selectedIds.length === 1 ? "" : "s"} added!`
    );
}

function removeGroupMember(groupId, memberId) {
    if (memberId === CURRENT_USER) return;

    const group = getConversation(groupId);
    if (!group || group.type !== "group") return;

    const memberName = getMemberName(memberId);

    if (!confirm(`Remove ${memberName} from ${group.name}?`)) {
        return;
    }

    const previous = [...group.memberIds];

    group.memberIds = group.memberIds.filter(
        id => id !== memberId
    );

    group.members = group.memberIds.length;

    if (!saveOrRevert(() => {
        group.memberIds = previous;
        group.members = previous.length;
    })) return;

    renderConversationLists();
    openConversation(group.id);
    openProfile();

    showToast(`${memberName} removed from group.`);
}

// ==========================================
// DELETE GROUP / CONVERSATION
// ==========================================

function deleteGroup(groupId) {
    const group = getConversation(groupId);
    if (!group || group.type !== "group") return;

    if (!confirm(
        `Delete "${group.name}" and its local messages?\n\n` +
        "This cannot be undone."
    )) return;

    const original = conversations;

    conversations = conversations.filter(c => c.id !== groupId);

    if (!saveOrRevert(() => {
        conversations = original;
    })) return;

    if (activeConversationId === groupId) {
        activeConversationId = null;
        closeChatSearch();
        resetChat();
    }

    closeProfile();
    closeDropdown();
    closeAddMembersModal();

    renderConversationLists();
    showToast("Group deleted.");
}

function deleteConversation() {
    const conversation = getConversation(activeConversationId);
    if (!conversation) return;

    if (conversation.type === "group") {
        deleteGroup(conversation.id);
        return;
    }

    if (!confirm(
        `Delete "${conversation.name}" and its local messages?`
    )) return;

    const original = conversations;

    conversations = conversations.filter(
        c => c.id !== conversation.id
    );

    if (!saveOrRevert(() => {
        conversations = original;
    })) return;

    activeConversationId = null;

    closeDropdown();
    closeChatSearch();
    closeProfile();
    resetChat();
    renderConversationLists();

    showToast("Conversation deleted.");
}

// ==========================================
// THREE-DOT MENU
// ==========================================

function toggleDropdown() {
    if (!activeConversationId) return;

    const dropdown = $("chatDropdown");
    dropdown.classList.toggle("hidden");

    if (!dropdown.classList.contains("hidden")) {
        configureGroupMenu();
    }
}

function closeDropdown() {
    $("chatDropdown").classList.add("hidden");
}

function configureGroupMenu() {
    // Add Members option is inserted by JS, no HTML change needed.
    const existing = document.getElementById("addMembersMenuOption");
    existing?.remove();

    const conversation = getConversation(activeConversationId);

    if (!conversation || conversation.type !== "group") return;

    const option = document.createElement("button");
    option.id = "addMembersMenuOption";
    option.type = "button";

    const icon = document.createElement("i");
    icon.setAttribute("data-lucide", "user-round-plus");

    option.append(icon, document.createTextNode("Add Members"));

    option.addEventListener("click", () => {
        closeDropdown();
        openAddMembersModal(conversation.id);
    });

    // Insert before Delete Group.
    $("chatDropdown").insertBefore(option, $("deleteOption"));
    refreshIcons();
}

// ==========================================
// CREATE GROUP / PRIVATE CHAT
// ==========================================

function openCreateModal(mode) {
    createMode = mode;

    $("dialogTitle").textContent =
        mode === "group" ? "Create Study Group" : "New Conversation";

    $("nameLabel").textContent =
        mode === "group" ? "Group Name" : "Student Name";

    $("conversationName").placeholder =
        mode === "group"
            ? "e.g. Mathematics Study Group"
            : "e.g. Student Name";

    $("conversationName").value = "";
    $("createModal").classList.remove("hidden");
    $("conversationName").focus();
}

function closeCreateModal() {
    $("createModal").classList.add("hidden");
    $("createForm").reset();
}

function createConversation(event) {
    event.preventDefault();

    const name = $("conversationName").value.trim();
    if (!name) return;

    const existing = conversations.find(c =>
        c.type === createMode &&
        c.name.toLowerCase() === name.toLowerCase()
    );

    if (existing) {
        closeCreateModal();
        openConversation(existing.id);
        showToast("Conversation already exists.");
        return;
    }

    const id = crypto.randomUUID();

    const conversation = {
        id,
        name,
        type: createMode,
        userId: createMode === "private"
            ? `user-${id}`
            : undefined,
        memberIds: createMode === "group"
            ? [CURRENT_USER]
            : undefined,
        members: createMode === "group" ? 1 : undefined,
        messages: []
    };

    conversations.unshift(conversation);

    if (!saveOrRevert(() => conversations.shift())) return;

    closeCreateModal();
    $("searchInput").value = "";

    openConversation(conversation.id);

    showToast(
        createMode === "group"
            ? "Study group created!"
            : "Conversation created!"
    );
}

// ==========================================
// RESET CHAT
// ==========================================

function resetChat() {
    $("chatName").textContent = "Your Messages";
    $("chatStatus").textContent =
        "Select a conversation to start chatting";

    $("chatAvatar").classList.remove("group-avatar");
    $("chatAvatar").replaceChildren();

    const icon = document.createElement("i");
    icon.setAttribute("data-lucide", "user-round");

    $("chatAvatar").appendChild(icon);
    $("chatAvatar").disabled = true;

    $("chatComposer").classList.add("hidden");

    $("searchChatButton").disabled = true;
    $("chatInfoButton").disabled = true;
    $("moreButton").disabled = true;

    $("chatBody").replaceChildren(createWelcomeState(
        "Your conversations start here!",
        "Select a friend or study group to start chatting."
    ));

    $("messenger").classList.remove("chat-open");
    refreshIcons();
}

// ==========================================
// EVENTS
// ==========================================

function setupEvents() {
    $("searchInput").addEventListener(
        "input",
        renderConversationLists
    );

    $("newGroupBtn").addEventListener("click", () => {
        openCreateModal("group");
    });

    $("newChatBtn").addEventListener("click", () => {
        openCreateModal("private");
    });

    $("closeModal").addEventListener("click", closeCreateModal);
    $("cancelModal").addEventListener("click", closeCreateModal);
    $("createForm").addEventListener("submit", createConversation);

    $("messageForm").addEventListener("submit", sendMessage);

    $("messageInput").addEventListener("keydown", event => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();

            if ($("messageInput").value.trim()) {
                $("messageForm").requestSubmit();
            }
        }
    });

    $("messageInput").addEventListener("input", event => {
        const input = event.target;
        input.style.height = "auto";
        input.style.height =
            Math.min(input.scrollHeight, 135) + "px";
    });

    $("searchChatButton").addEventListener(
        "click",
        openChatSearch
    );

    $("searchOption").addEventListener("click", openChatSearch);

    $("chatSearchInput").addEventListener(
        "input",
        searchInConversation
    );

    $("closeChatSearch").addEventListener(
        "click",
        closeChatSearch
    );

    $("moreButton").addEventListener("click", event => {
        event.stopPropagation();
        toggleDropdown();
    });

    $("viewProfileOption").addEventListener("click", openProfile);
    $("chatInfoButton").addEventListener("click", openProfile);
    $("chatAvatar").addEventListener("click", openProfile);

    $("deleteOption").addEventListener(
        "click",
        deleteConversation
    );

    $("closeProfile").addEventListener("click", closeProfile);
    $("profileMessageBtn").addEventListener("click", closeProfile);

    $("profileModal").addEventListener("click", event => {
        if (event.target === $("profileModal")) closeProfile();
    });

    $("createModal").addEventListener("click", event => {
        if (event.target === $("createModal")) closeCreateModal();
    });

    $("attachmentBtn").addEventListener("click", () => {
        showToast("File attachments need backend integration.");
    });

    $("mobileBack").addEventListener("click", () => {
        $("messenger").classList.remove("chat-open");
    });

    document.addEventListener("click", event => {
        if (!event.target.closest(".more-wrapper")) {
            closeDropdown();
        }
    });

    document.addEventListener("keydown", event => {
        if (event.key !== "Escape") return;

        if (
            $("addMembersModal") &&
            !$("addMembersModal").classList.contains("hidden")
        ) {
            closeAddMembersModal();
        } else if (!$("profileModal").classList.contains("hidden")) {
            closeProfile();
        } else if (!$("createModal").classList.contains("hidden")) {
            closeCreateModal();
        } else if (!$("chatSearchPanel").classList.contains("hidden")) {
            closeChatSearch();
        } else {
            closeDropdown();
        }
    });
}

// ==========================================
// INITIALIZATION
// ==========================================

function initialize() {
    conversations = loadConversations();

    migrateDemoData();
    initializeMembersModal();
    setupEvents();

    renderConversationLists();
    resetChat();
    refreshIcons();
}

initialize();
