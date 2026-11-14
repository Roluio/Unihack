
/*
=============================================
STUDYGRAM - MESSAGES LAYOUT FIX

1. Remove duplicate StudyGram logo
2. Keep the main StudyGram logo in top navbar
3. One scrollbar for groups and private chats
4. Keep search and user profile outside scroll
5. Preserve all existing chat functionality
=============================================
*/

(function () {
    "use strict";

    function initialize() {
        const groupsList = document.getElementById("groupsList");
        const messagesList = document.getElementById("messagesList");

        if (!groupsList || !messagesList) {
            console.warn(
                "StudyGram: Conversation lists not found."
            );
            return;
        }

        if (document.getElementById("ubConversationScroll")) {
            return;
        }

        // -------------------------------------
        // ADD LAYOUT CSS
        // -------------------------------------

        const style = document.createElement("style");
        style.id = "ubMessagesLayoutStyles";

        style.textContent = `
            /*
             * Sidebar layout
             */

            .ub-messages-sidebar {
                display: flex !important;
                flex-direction: column !important;

                height: 100% !important;
                min-height: 0 !important;

                overflow: hidden !important;
                box-sizing: border-box;
            }

            /*
             * Remove second StudyGram logo
             */

            .ub-messages-sidebar > .logo,
            .ub-messages-sidebar > .sidebar-logo,
            .ub-messages-sidebar > .sidebar-brand,
            .ub-messages-sidebar > .brand,
            .ub-messages-sidebar > .logo-container,
            .ub-messages-sidebar > .sidebar-header > .logo,
            .ub-messages-sidebar > .sidebar-header > .brand {
                display: none !important;
            }

            /*
             * Shared scroll for all conversations
             */

            #ubConversationScroll {
                flex: 1 1 auto !important;
                min-height: 0 !important;

                overflow-y: auto !important;
                overflow-x: hidden !important;

                overscroll-behavior: contain;

                scrollbar-width: thin;
                scrollbar-color:
                    #8350ce transparent;
            }

            #ubConversationScroll::-webkit-scrollbar {
                width: 7px;
            }

            #ubConversationScroll::-webkit-scrollbar-track {
                background: transparent;
            }

            #ubConversationScroll::-webkit-scrollbar-thumb {
                background: #8350ce;
                border-radius: 10px;
            }

            #ubConversationScroll::-webkit-scrollbar-thumb:hover {
                background: #54218e;
            }

            /*
             * Disable separate list scrollbars
             */

            #groupsList,
            #messagesList {
                height: auto !important;
                max-height: none !important;
                min-height: 0 !important;

                overflow: visible !important;
                scrollbar-width: none !important;
            }

            #groupsList::-webkit-scrollbar,
            #messagesList::-webkit-scrollbar {
                display: none !important;
            }

            /*
             * Keep chat cards readable
             */

            #ubConversationScroll .conversation-item {
                flex-shrink: 0;
            }

            /*
             * Prevent nested containers
             * from cutting off conversations
             */

            .ub-scroll-content {
                height: auto !important;
                max-height: none !important;
                overflow: visible !important;
                min-height: 0 !important;
            }

            /*
             * Maintain sidebar bottom
             */

            .ub-messages-sidebar > .sidebar-bottom,
            .ub-messages-sidebar > .sidebar-footer {
                flex-shrink: 0 !important;
                margin-top: auto;
            }
        `;

        document.head.appendChild(style);

        // -------------------------------------
        // FIND THE MESSAGES SIDEBAR
        // -------------------------------------

        const sidebar =
            groupsList.closest(".sidebar") ||
            groupsList.closest(".messages-sidebar") ||
            groupsList.closest(".messenger-sidebar") ||
            groupsList.closest("aside");

        if (!sidebar || !sidebar.contains(messagesList)) {
            console.warn(
                "StudyGram: Common messages sidebar not found."
            );
            return;
        }

        sidebar.classList.add("ub-messages-sidebar");

        // -------------------------------------
        // REMOVE ONLY THE SECOND LOGO
        // -------------------------------------

        const duplicateLogo = Array.from(
            sidebar.querySelectorAll(
                ".logo, .sidebar-logo, " +
                ".sidebar-brand, .brand, " +
                ".logo-container"
            )
        ).find(element =>
            element.textContent.includes("StudyGram")
        );

        if (duplicateLogo) {
            duplicateLogo.remove();
        }

        // -------------------------------------
        // FIND COMMON PARENT FOR BOTH LISTS
        // -------------------------------------

        function commonAncestor(first, second) {
            let current = first;

            while (current) {
                if (current.contains(second)) {
                    return current;
                }

                current = current.parentElement;
            }

            return null;
        }

        const common = commonAncestor(
            groupsList,
            messagesList
        );

        if (!common) return;

        function childUnder(parent, element) {
            let current = element;

            while (
                current.parentElement &&
                current.parentElement !== parent
            ) {
                current = current.parentElement;
            }

            return current;
        }

        // -------------------------------------
        // CREATE ONE SCROLLABLE REGION
        // -------------------------------------

        const scroll = document.createElement("div");

        scroll.id = "ubConversationScroll";
        scroll.setAttribute(
            "aria-label",
            "Groups and private conversations"
        );

        const firstSection = childUnder(
            common,
            groupsList
        );

        const lastSection = childUnder(
            common,
            messagesList
        );

        if (
            firstSection === lastSection &&
            common !== sidebar
        ) {
            // Both lists are already grouped under
            // the same container. Make it scrollable.

            scroll.classList.add("ub-scroll-content");

            const parent = firstSection.parentElement;

            parent.insertBefore(scroll, firstSection);
            scroll.appendChild(firstSection);

        } else if (firstSection !== lastSection) {
            // Move complete groups and messages sections
            // into a single scroll area.
            // Their original buttons/listeners are preserved.

            const siblings = Array.from(common.children);

            const firstIndex = siblings.indexOf(firstSection);
            const lastIndex = siblings.indexOf(lastSection);

            if (
                firstIndex >= 0 &&
                lastIndex >= firstIndex
            ) {
                common.insertBefore(
                    scroll,
                    firstSection
                );

                const moving = siblings.slice(
                    firstIndex,
                    lastIndex + 1
                );

                moving.forEach(element => {
                    scroll.appendChild(element);
                });
            } else {
                console.warn(
                    "StudyGram: Unexpected conversation order."
                );
                scroll.remove();
                return;
            }

        } else {
            // Fallback for unusual HTML structure.
            common.insertBefore(scroll, firstSection);
            scroll.appendChild(firstSection);
        }

        // -------------------------------------
        // FIX FLEX HEIGHTS
        // -------------------------------------

        let ancestor = scroll.parentElement;

        while (ancestor && ancestor !== sidebar.parentElement) {
            ancestor.style.minHeight = "0";

            if (
                ancestor !== sidebar &&
                getComputedStyle(ancestor).display.includes("flex")
            ) {
                ancestor.style.flexDirection = "column";
            }

            ancestor = ancestor.parentElement;
        }

        // -------------------------------------
        // REMOVE EXISTING NESTED SCROLLBARS
        // -------------------------------------

        [groupsList, messagesList].forEach(list => {
            let parent = list.parentElement;

            while (parent && parent !== scroll) {
                parent.classList.add("ub-scroll-content");
                parent.style.maxHeight = "none";
                parent.style.overflowY = "visible";

                parent = parent.parentElement;
            }
        });

        // -------------------------------------
        // SET SIDEBAR HEIGHT CORRECTLY
        // -------------------------------------

        function updateHeight() {
            const rect = sidebar.getBoundingClientRect();

            // The sidebar may already be inside an iframe.
            // Use its own viewport, not the parent page.
            const available = Math.max(
                300,
                window.innerHeight - Math.max(0, rect.top)
            );

            sidebar.style.height = available + "px";
            sidebar.style.maxHeight = available + "px";
        }

        updateHeight();

        window.addEventListener(
            "resize",
            updateHeight
        );

        // -------------------------------------
        // SCROLL TO ACTIVE CONVERSATION
        // -------------------------------------

        scroll.addEventListener("click", event => {
            const conversation = event.target.closest(
                ".conversation-item"
            );

            if (!conversation) return;

            requestAnimationFrame(() => {
                conversation.scrollIntoView({
                    behavior: "smooth",
                    block: "nearest"
                });
            });
        });

        window.lucide?.createIcons();

        console.log(
            "StudyGram Messages: single conversation scrollbar enabled."
        );
    }

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            initialize
        );
    } else {
        initialize();
    }
})();
