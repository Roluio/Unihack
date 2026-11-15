/* Home feed: posts of friends first, then students of the same faculty. */
(function () {
    "use strict";

    var App = window.App;
    var h = App.h, t = App.t, api = App.api, icon = App.icon;

    var MAX_FILES = 3;
    var maxBytes = 25 * 1024 * 1024;   // replaced by the server limit as soon as it is known
    var PAGE_SIZE = 15;

    var state = { q: "", subject: "", sort: "recent", page: 0, hasMore: true, loading: false, token: 0, lastTier: null, count: 0 };
    var feedEl = document.getElementById("feed");
    var sentinel = document.getElementById("feedSentinel");
    var me = App.user;
    var subjectsCache = [];

    // ------------------------------------------------------------------
    // Loading
    // ------------------------------------------------------------------

    function skeleton() {
        var box = h("div", { class: "card post", "aria-hidden": "true" });
        box.appendChild(h("div", { class: "skeleton", style: { height: "18px", width: "40%", marginBottom: "14px" } }));
        box.appendChild(h("div", { class: "skeleton", style: { height: "14px", width: "90%", marginBottom: "8px" } }));
        box.appendChild(h("div", { class: "skeleton", style: { height: "14px", width: "70%" } }));
        return box;
    }

    function reset() {
        state.page = 0;
        state.hasMore = true;
        state.lastTier = null;
        state.count = 0;
        state.token++;
        App.clear(feedEl);
        feedEl.appendChild(skeleton());
        loadMore(true);
    }

    function loadMore(first) {
        if (state.loading || !state.hasMore) return;
        state.loading = true;
        var token = state.token;
        var query = "?page=" + state.page + "&size=" + PAGE_SIZE + "&sort=" + state.sort +
            "&q=" + encodeURIComponent(state.q) + "&subject=" + encodeURIComponent(state.subject);

        api("/api/posts" + query).then(function (data) {
            if (token !== state.token) return;
            if (first) App.clear(feedEl);
            data.posts.forEach(addPost);
            state.hasMore = data.hasMore;
            state.page++;
            state.count += data.posts.length;
            renderEnd();
        }).catch(function (error) {
            if (token !== state.token) return;
            if (first) App.clear(feedEl);
            feedEl.appendChild(emptyBox("triangle-alert", t("err.title"), error.message));
            App.refreshIcons();
            state.hasMore = false;
        }).then(function () {
            state.loading = false;
            // The sentinel may still be visible after a short page: keep filling.
            if (state.hasMore && sentinelVisible()) loadMore(false);
        });
    }

    function sentinelVisible() {
        var rect = sentinel.getBoundingClientRect();
        return rect.top < window.innerHeight + 300;
    }

    function renderEnd() {
        var old = document.getElementById("feedEnd");
        if (old) old.remove();

        if (state.count === 0) {
            var filtered = state.q || state.subject;
            feedEl.appendChild(h("div", { id: "feedEnd" }, filtered
                ? emptyBox("search-x", t("feed.noResults"), t("feed.noResultsText"))
                : emptyBox("messages-square", t("feed.emptyTitle"), t("feed.emptyText"),
                    h("button", { class: "btn btn-primary", type: "button", onclick: openComposer }, t("feed.newPost")))));
        } else if (!state.hasMore) {
            feedEl.appendChild(h("div", { id: "feedEnd", class: "feed-end" }, t("feed.end")));
        }
        App.refreshIcons();
    }

    function emptyBox(iconName, title, text, action) {
        return h("div", { class: "empty" },
            h("div", { class: "empty-icon" }, icon(iconName)),
            h("h3", {}, title),
            h("p", {}, text),
            action || null);
    }

    function addPost(post) {
        var tier = post.relation === "FACULTY" ? 1 : 0;
        if (state.lastTier !== tier) {
            state.lastTier = tier;
            feedEl.appendChild(h("div", { class: "feed-heading" },
                icon(tier === 0 ? "users-round" : "graduation-cap"),
                tier === 0 ? t("feed.fromFriends") : t("feed.fromFaculty")));
        }
        feedEl.appendChild(renderPost(post));
    }

    // ------------------------------------------------------------------
    // One post
    // ------------------------------------------------------------------

    function relationChip(post) {
        if (post.relation === "FRIEND") return h("span", { class: "chip primary" }, icon("user-check"), t("feed.friend"));
        if (post.relation === "ME") return h("span", { class: "chip" }, t("feed.you"));
        return null;
    }

    function renderPost(post) {
        var author = post.author;
        var isMine = post.relation === "ME";
        var card = h("article", { class: "card post", dataset: { id: post.id } });

        var nameLink = h("button", { type: "button", class: "author-link", onclick: function () { showProfile(author); } },
            App.fullName(author));
        var meta = [("@" + author.username)];
        if (author.faculty) meta.push(author.faculty);
        if (author.studyYear) meta.push(t("common.yearN", { n: author.studyYear }));

        var head = h("header", { class: "post-head" },
            h("button", { type: "button", "aria-label": App.fullName(author), onclick: function () { showProfile(author); } }, App.avatar(author)),
            h("div", { class: "who" },
                h("div", {}, nameLink, " ", relationChip(post)),
                h("div", { class: "post-meta truncate" }, meta.join(" · "))),
            h("time", { class: "post-time", datetime: post.createdAt, title: App.fullDate(post.createdAt), dataset: { iso: post.createdAt } }, App.timeAgo(post.createdAt)));

        if (isMine) {
            head.appendChild(h("button", {
                type: "button", class: "icon-btn sm", "aria-label": t("common.more"),
                onclick: function (event) {
                    App.menu(event.currentTarget, [
                        { label: t("feed.delete"), icon: "trash-2", danger: true, onClick: function () { removePost(post, card); } }
                    ]);
                }
            }, icon("ellipsis")));
        }
        card.appendChild(head);

        var body = h("div", { class: "post-body" });
        body.appendChild(h("span", { class: "chip primary" }, post.subject));
        body.appendChild(h("h3", {}, post.title));
        var text = h("p", { class: "post-text" }, App.richText(post.content));
        body.appendChild(text);
        if (post.content.length > 360 || post.content.split("\n").length > 6) {
            text.classList.add("clamped");
            var more = h("button", { type: "button", class: "link-btn" }, t("feed.more"));
            more.addEventListener("click", function () {
                var collapsed = text.classList.toggle("clamped");
                more.textContent = collapsed ? t("feed.more") : t("feed.less");
            });
            body.appendChild(more);
        }
        card.appendChild(body);

        if (post.attachments.length) card.appendChild(renderAttachments(post.attachments));

        // actions
        var likeCount = h("span", {}, String(post.likeCount));
        var likeBtn = h("button", { type: "button", class: "action-btn" + (post.likedByMe ? " liked" : ""), "aria-pressed": String(post.likedByMe) },
            icon("heart"), likeCount);
        likeBtn.addEventListener("click", function () {
            likeBtn.disabled = true;
            api("/api/posts/" + post.id + "/like", { method: "POST" }).then(function (res) {
                post.likedByMe = res.liked;
                likeBtn.classList.toggle("liked", res.liked);
                likeBtn.setAttribute("aria-pressed", String(res.liked));
                likeCount.textContent = String(res.likeCount);
            }).catch(function (e) { App.toast(e.message, "error"); })
                .then(function () { likeBtn.disabled = false; });
        });

        var commentCount = h("span", {}, String(post.commentCount));
        var commentsBox = h("section", { class: "comments hidden" });
        var commentBtn = h("button", { type: "button", class: "action-btn" }, icon("message-circle"), commentCount);
        var loaded = false;

        function reloadComments() {
            return api("/api/posts/" + post.id + "/comments").then(function (list) {
                commentCount.textContent = String(list.length);
                post.commentCount = list.length;
                renderComments(commentsBox, post, list, reloadComments);
            }).catch(function (e) { App.toast(e.message, "error"); });
        }

        commentBtn.addEventListener("click", function () {
            var open = commentsBox.classList.toggle("hidden") === false;
            if (open && !loaded) {
                loaded = true;
                commentsBox.appendChild(h("div", { class: "spinner" }));
                reloadComments();
            }
        });

        card.appendChild(h("footer", { class: "post-actions" }, likeBtn, commentBtn));
        card.appendChild(commentsBox);
        return card;
    }

    function attachmentUrl(a, download) {
        return "/api/posts/attachments/" + a.id + (download ? "?download=true" : "");
    }

    function renderAttachments(list) {
        var box = h("div", { class: "attachments" });
        list.forEach(function (a) {
            if (/^image\/(png|jpe?g|gif|webp)$/i.test(a.mimeType)) {
                box.appendChild(h("button", {
                    type: "button", class: "thumb", title: a.fileName,
                    onclick: function () { lightbox(a); }
                }, h("img", { src: attachmentUrl(a), alt: a.fileName, loading: "lazy" })));
            } else {
                box.appendChild(h("a", { class: "file-chip", href: attachmentUrl(a), target: "_blank", rel: "noopener", title: a.fileName },
                    h("span", { class: "file-ico" }, icon("file-text")),
                    h("span", {}, h("span", { class: "name truncate", style: { display: "block", maxWidth: "170px" } }, a.fileName),
                        h("small", {}, App.formatSize(a.sizeBytes)))));
            }
        });
        return box;
    }

    function lightbox(a) {
        App.modal({
            title: a.fileName,
            size: "wide",
            autofocus: false,
            body: h("img", { class: "lightbox", src: attachmentUrl(a), alt: a.fileName }),
            actions: [
                { label: t("common.download"), kind: "btn-secondary", close: false, onClick: function () { window.location.href = attachmentUrl(a, true); } },
                { label: t("common.close"), kind: "btn-primary" }
            ]
        });
    }

    function removePost(post, card) {
        App.confirm({ title: t("feed.deleteTitle"), message: t("feed.deleteText"), confirmText: t("feed.delete"), danger: true }).then(function (ok) {
            if (!ok) return;
            api("/api/posts/" + post.id, { method: "DELETE" }).then(function () {
                card.remove();
                App.toast(t("feed.deleted"), "success");
                state.count--;
                if (state.count <= 0) reset();
            }).catch(function (e) { App.toast(e.message, "error"); });
        });
    }

    // ------------------------------------------------------------------
    // Comments
    // ------------------------------------------------------------------

    function renderComments(box, post, list, reload) {
        App.clear(box);

        var byParent = {};
        list.forEach(function (c) {
            var key = c.parentId || "root";
            (byParent[key] = byParent[key] || []).push(c);
        });

        function build(parentKey, depth) {
            var wrapper = h("div", { class: depth ? "comment-children" : "" });
            (byParent[parentKey] || []).forEach(function (c) {
                wrapper.appendChild(renderComment(c, post, reload));
                // deeper replies stay at the third level so the thread does not run off the card
                var childDepth = Math.min(depth + 1, 3);
                if (byParent[c.id]) wrapper.lastChild.querySelector(".comment-main").appendChild(build(c.id, childDepth));
            });
            return wrapper;
        }

        box.appendChild(build("root", 0));
        if (!list.length) box.appendChild(h("p", { class: "muted", style: { padding: "4px 0 6px" } }, t("feed.noComments")));
        box.appendChild(commentForm(post, null, reload));
        App.refreshIcons();
    }

    function renderComment(c, post, reload) {
        var mineOrModerator = c.author.id === me.id || post.relation === "ME";
        var likeBtn = h("button", { type: "button", class: c.likedByMe ? "liked" : "" },
            t("feed.like") + (c.likeCount ? " · " + c.likeCount : ""));
        likeBtn.addEventListener("click", function () {
            api("/api/posts/comments/" + c.id + "/like", { method: "POST" }).then(function (res) {
                c.likedByMe = res.liked;
                c.likeCount = res.likeCount;
                likeBtn.classList.toggle("liked", res.liked);
                likeBtn.textContent = t("feed.like") + (res.likeCount ? " · " + res.likeCount : "");
            }).catch(function (e) { App.toast(e.message, "error"); });
        });

        var replyHolder = h("div");
        var replyBtn = h("button", { type: "button" }, t("feed.reply"));
        replyBtn.addEventListener("click", function () {
            if (replyHolder.firstChild) { App.clear(replyHolder); return; }
            replyHolder.appendChild(commentForm(post, c.id, reload, true));
            var input = replyHolder.querySelector("textarea");
            if (input) input.focus();
        });

        var actions = h("div", { class: "comment-actions" }, likeBtn, replyBtn);
        if (mineOrModerator) {
            actions.appendChild(h("button", {
                type: "button",
                onclick: function () {
                    App.confirm({ title: t("feed.deleteComment"), message: t("feed.deleteCommentText"), confirmText: t("feed.delete"), danger: true }).then(function (ok) {
                        if (!ok) return;
                        api("/api/posts/comments/" + c.id, { method: "DELETE" }).then(reload).catch(function (e) { App.toast(e.message, "error"); });
                    });
                }
            }, t("feed.delete")));
        }

        return h("div", { class: "comment" },
            App.avatar(c.author, "sm"),
            h("div", { class: "comment-main" },
                h("div", { class: "comment-bubble" },
                    h("strong", {}, App.fullName(c.author)),
                    h("time", { class: "time", title: App.fullDate(c.createdAt), dataset: { iso: c.createdAt } }, App.timeAgo(c.createdAt)),
                    h("div", { class: "comment-text" }, App.richText(c.content))),
                actions,
                replyHolder));
    }

    function commentForm(post, parentId, reload, isReply) {
        var input = h("textarea", { class: "textarea", rows: "1", maxlength: "2000", placeholder: isReply ? t("feed.replyPlaceholder") : t("feed.commentPlaceholder") });
        var send = h("button", { type: "submit", class: "btn btn-primary btn-sm", "aria-label": t("common.send") }, icon("send"));
        var form = h("form", { class: "comment-form" }, App.avatar(me, "sm"), input, send);

        input.addEventListener("input", function () {
            input.style.height = "40px";
            input.style.height = Math.min(input.scrollHeight, 140) + "px";
        });
        input.addEventListener("keydown", function (event) {
            if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); form.requestSubmit(); }
        });
        form.addEventListener("submit", function (event) {
            event.preventDefault();
            var text = input.value.trim();
            if (!text) return;
            send.disabled = true;
            api("/api/posts/" + post.id + "/comments", { method: "POST", body: { content: text, parentId: parentId } })
                .then(reload)
                .catch(function (e) { App.toast(e.message, "error"); send.disabled = false; });
        });
        return form;
    }

    // ------------------------------------------------------------------
    // Author profile
    // ------------------------------------------------------------------

    function showProfile(author) {
        var body = h("div", { class: "profile-modal" }, h("div", { class: "spinner" }));
        var dialog = App.modal({ title: "", body: body, autofocus: false });

        Promise.all([
            api("/api/users/" + author.id),
            author.id === me.id ? Promise.resolve([]) : api("/api/friends/discover?query=" + encodeURIComponent(author.username))
        ]).then(function (result) {
            var user = result[0];
            var match = result[1].filter(function (r) { return r.user.id === user.id; })[0];
            App.clear(body);
            body.appendChild(App.avatar(user, "xl"));
            body.appendChild(h("h3", {}, App.fullName(user)));
            body.appendChild(h("div", { class: "muted" }, "@" + user.username));
            body.appendChild(h("div", { class: "muted" }, [user.specialization, user.faculty].filter(Boolean).join(" · ")));
            body.appendChild(h("div", { class: "muted" }, [user.university, t("common.yearN", { n: user.studyYear })].filter(Boolean).join(" · ")));
            if (user.bio) body.appendChild(h("p", { class: "bio" }, user.bio));

            var actions = h("div", { class: "actions" });
            if (user.id === me.id) {
                actions.appendChild(h("a", { class: "btn btn-primary", href: "/profile" }, t("nav.profile")));
            } else if (match && match.relation === "FRIEND") {
                actions.appendChild(h("a", { class: "btn btn-primary", href: "/messages?with=" + user.id }, icon("message-circle"), t("friends.message")));
            } else if (match && match.relation === "REQUEST_SENT") {
                actions.appendChild(h("button", { class: "btn btn-secondary", disabled: true, type: "button" }, t("friends.requestSent")));
            } else if (match && match.relation === "REQUEST_RECEIVED") {
                actions.appendChild(h("a", { class: "btn btn-primary", href: "/friends#requests" }, t("friends.answerRequest")));
            } else {
                var add = h("button", { class: "btn btn-primary", type: "button" }, icon("user-plus"), t("friends.add"));
                add.addEventListener("click", function () {
                    add.disabled = true;
                    api("/api/friends/request/" + user.id, { method: "POST" }).then(function () {
                        add.textContent = t("friends.requestSent");
                        App.toast(t("friends.requestSentToast"), "success");
                    }).catch(function (e) { App.toast(e.message, "error"); add.disabled = false; });
                });
                actions.appendChild(add);
            }
            body.appendChild(actions);
            App.refreshIcons();
        }).catch(function (e) {
            dialog.close();
            App.toast(e.message, "error");
        });
    }

    // ------------------------------------------------------------------
    // Composer
    // ------------------------------------------------------------------

    function openComposer() {
        var files = [];
        var title = h("input", { class: "input", maxlength: "200", required: true, placeholder: t("feed.titlePlaceholder") });
        var subject = h("input", { class: "input", maxlength: "60", list: "subjectOptions", placeholder: t("feed.subjectPlaceholder") });
        var options = h("datalist", { id: "subjectOptions" }, subjectsCache.map(function (s) { return h("option", { value: s.subject }); }));
        var content = h("textarea", { class: "textarea", rows: "5", maxlength: "10000", required: true, placeholder: t("feed.contentPlaceholder") });
        var picker = h("input", { type: "file", multiple: true, class: "hidden" });
        var list = h("div", { class: "picked-files" });
        var status = h("p", { class: "status-line error" });

        var zone = h("div", { class: "drop-zone", tabindex: "0", role: "button" },
            icon("paperclip"), " ", t("feed.attach"), h("div", { class: "hint" }, t("feed.attachHint", { n: MAX_FILES, mb: Math.round(maxBytes / 1048576) })));

        function drawFiles() {
            App.clear(list);
            files.forEach(function (file, index) {
                list.appendChild(h("div", { class: "picked-file" },
                    icon("file"),
                    h("span", { class: "truncate" }, file.name),
                    h("small", { class: "muted" }, App.formatSize(file.size)),
                    h("button", { type: "button", class: "icon-btn sm", "aria-label": t("common.remove"), onclick: function () { files.splice(index, 1); drawFiles(); } }, icon("x"))));
            });
            App.refreshIcons();
        }

        function addFiles(incoming) {
            status.textContent = "";
            Array.prototype.forEach.call(incoming, function (file) {
                if (files.length >= MAX_FILES) { status.textContent = t("feed.tooManyFiles", { n: MAX_FILES }); return; }
                if (file.size > maxBytes) { status.textContent = t("feed.fileTooBig", { name: file.name, mb: Math.round(maxBytes / 1048576) }); return; }
                files.push(file);
            });
            drawFiles();
        }

        zone.addEventListener("click", function () { picker.click(); });
        zone.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); picker.click(); } });
        picker.addEventListener("change", function () { addFiles(picker.files); picker.value = ""; });
        ["dragenter", "dragover"].forEach(function (name) { zone.addEventListener(name, function (e) { e.preventDefault(); zone.classList.add("over"); }); });
        ["dragleave", "drop"].forEach(function (name) { zone.addEventListener(name, function (e) { e.preventDefault(); zone.classList.remove("over"); }); });
        zone.addEventListener("drop", function (e) { addFiles(e.dataTransfer.files); });

        var form = h("form", {},
            h("div", { class: "field" }, h("label", {}, t("feed.titleLabel")), title),
            h("div", { class: "field" }, h("label", {}, t("feed.subjectLabel")), subject, options),
            h("div", { class: "field" }, h("label", {}, t("feed.contentLabel")), content),
            h("div", { class: "field" }, zone, picker, list),
            status);

        var dialog = App.modal({
            title: t("feed.newPost"),
            body: form,
            actions: [
                { label: t("common.cancel"), kind: "btn-secondary" },
                {
                    id: "publish", label: t("feed.publish"), kind: "btn-primary", close: false,
                    onClick: function (d) { form.requestSubmit(); return false; }
                }
            ]
        });

        form.addEventListener("submit", function (event) {
            event.preventDefault();
            status.textContent = "";
            var data = new FormData();
            data.append("title", title.value.trim());
            data.append("subject", subject.value.trim());
            data.append("content", content.value.trim());
            files.forEach(function (file) { data.append("files", file, file.name); });

            var button = dialog.buttons.publish;
            button.disabled = true;
            button.textContent = t("feed.publishing");

            api("/api/posts", { method: "POST", form: data }).then(function () {
                dialog.close();
                App.toast(t("feed.published"), "success");
                loadSubjects();
                reset();
            }).catch(function (error) {
                status.textContent = error.message;
                button.disabled = false;
                button.textContent = t("feed.publish");
            });
        });
    }

    // ------------------------------------------------------------------
    // Sidebar subjects, filters, init
    // ------------------------------------------------------------------

    function loadSubjects() {
        api("/api/posts/subjects").then(function (list) {
            subjectsCache = list;
            drawSubjects();
        }).catch(function () { /* optional widget */ });
    }

    function drawSubjects() {
        var box = document.getElementById("subjectList");
        App.clear(box);
        if (!subjectsCache.length) {
            box.appendChild(h("p", { class: "muted" }, t("feed.noSubjects")));
            return;
        }
        subjectsCache.forEach(function (s) {
            box.appendChild(h("button", {
                type: "button", class: state.subject.toLowerCase() === s.subject.toLowerCase() ? "active" : "",
                onclick: function () { setSubject(state.subject.toLowerCase() === s.subject.toLowerCase() ? "" : s.subject); }
            }, h("span", { class: "truncate" }, s.subject), h("small", {}, String(s.count))));
        });
    }

    function setSubject(subject) {
        state.subject = subject;
        var holder = document.getElementById("activeFilter");
        App.clear(holder);
        holder.classList.toggle("hidden", !subject);
        if (subject) {
            holder.appendChild(h("button", { type: "button", class: "chip primary", onclick: function () { setSubject(""); } },
                subject, icon("x")));
            App.refreshIcons();
        }
        drawSubjects();
        reset();
    }

    document.getElementById("openComposer").addEventListener("click", openComposer);
    document.getElementById("openComposerBtn").addEventListener("click", openComposer);

    document.getElementById("feedSearch").addEventListener("input", App.debounce(function (event) {
        state.q = event.target.value.trim();
        reset();
    }, 350));

    document.querySelectorAll(".segmented button").forEach(function (button) {
        button.addEventListener("click", function () {
            document.querySelectorAll(".segmented button").forEach(function (b) { b.classList.toggle("active", b === button); });
            state.sort = button.dataset.sort;
            reset();
        });
    });

    var scroller = document.querySelector(".content");
    if ("IntersectionObserver" in window) {
        new IntersectionObserver(function (entries) {
            if (entries[0].isIntersecting) loadMore(false);
        }, { root: scroller, rootMargin: "400px" }).observe(sentinel);
    }

    // keep "5 min ago" labels fresh
    setInterval(function () {
        document.querySelectorAll("time[data-iso]").forEach(function (el) { el.textContent = App.timeAgo(el.dataset.iso); });
    }, 60000);

    // next exams and classes from the calendar
    var TYPE_CLASS = { EXAM: "ev-exam", CLASS: "ev-class", LAB: "ev-lab", OTHER: "ev-other" };

    function loadUpcoming() {
        api("/api/calendar/upcoming?limit=4").then(function (list) {
            var box = document.getElementById("upcomingList");
            App.clear(box);
            if (!list.length) { box.appendChild(h("p", { class: "muted", style: { marginBottom: "12px" } }, t("cal.widgetEmpty"))); return; }
            list.forEach(function (e) {
                var start = new Date(e.startsAt);
                box.appendChild(h("a", { href: "/calendar", class: "up-item " + (TYPE_CLASS[e.type] || "ev-other") },
                    h("span", { class: "up-date" }, h("b", {}, String(start.getDate())), h("small", {}, start.toLocaleDateString(App.getLang() === "ro" ? "ro-RO" : "en-GB", { month: "short" }))),
                    h("span", { class: "up-info" }, h("strong", {}, e.title),
                        h("small", {}, (e.allDay ? t("cal.allDay") : App.clock(e.startsAt)) + (e.location ? " · " + e.location : "")))));
            });
        }).catch(function () { /* optional widget */ });
    }

    document.addEventListener("langchange", function () { drawSubjects(); loadUpcoming(); reset(); });

    loadUpcoming();

    api("/api/drive/usage").then(function (u) { maxBytes = u.maxFileBytes; }).catch(function () { /* keeps the default */ });

    loadSubjects();
    reset();
})();
