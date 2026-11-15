/* Calendar: exams and weekly timetable (month, week and agenda views). */
(function () {
    "use strict";

    var App = window.App;
    var h = App.h, t = App.t, api = App.api, icon = App.icon;

    var HOUR = 48;                  // px per hour in the week view
    var AGENDA_DAYS = 60;
    var TYPES = ["EXAM", "CLASS", "LAB", "OTHER"];
    var CLASS_OF = { EXAM: "ev-exam", CLASS: "ev-class", LAB: "ev-lab", OTHER: "ev-other" };
    var ZONE = (Intl.DateTimeFormat().resolvedOptions().timeZone) || "UTC";

    var state = { view: "month", cursor: today(), events: [], token: 0 };
    var body = document.getElementById("calBody");

    // ------------------------------------------------------------------
    // Dates
    // ------------------------------------------------------------------

    function today() { var d = new Date(); d.setHours(0, 0, 0, 0); return d; }
    function startOfDay(d) { var x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
    function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
    function startOfWeek(d) { var x = startOfDay(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; } // Monday
    function sameDay(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
    function locale() { return App.getLang() === "ro" ? "ro-RO" : "en-GB"; }
    function pad(n) { return (n < 10 ? "0" : "") + n; }
    function dateValue(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
    function timeValue(d) { return pad(d.getHours()) + ":" + pad(d.getMinutes()); }
    function parseDate(value) { var p = value.split("-"); return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2])); }
    function fmt(d, options) { return d.toLocaleDateString(locale(), options); }

    function cap(text) { return text.charAt(0).toUpperCase() + text.slice(1); }

    function hydrate(e) {
        e.start = new Date(e.startsAt);
        e.end = new Date(e.endsAt);
        e.cls = CLASS_OF[e.type] || "ev-other";
        return e;
    }

    // days an occurrence touches (all-day and midnight ends are exclusive)
    function daysOf(e) {
        var days = [];
        var last = e.end > e.start ? new Date(e.end.getTime() - 1) : e.start;
        for (var d = startOfDay(e.start); d <= last; d = addDays(d, 1)) days.push(d);
        return days;
    }

    function eventsOn(day) {
        return state.events.filter(function (e) { return daysOf(e).some(function (d) { return sameDay(d, day); }); })
            .sort(function (a, b) { return (b.allDay - a.allDay) || (a.start - b.start); });
    }

    function timeLabel(e) {
        return e.allDay ? t("cal.allDay") : App.clock(e.startsAt) + " – " + App.clock(e.endsAt);
    }

    // ------------------------------------------------------------------
    // Loading
    // ------------------------------------------------------------------

    function range() {
        var c = state.cursor, from, to;
        if (state.view === "month") {
            from = startOfWeek(new Date(c.getFullYear(), c.getMonth(), 1));
            to = addDays(from, 42);
        } else if (state.view === "week") {
            from = startOfWeek(c);
            to = addDays(from, 7);
        } else {
            from = startOfDay(c);
            to = addDays(from, AGENDA_DAYS);
        }
        return { from: from, to: to };
    }

    function title() {
        var c = state.cursor;
        if (state.view === "month") return cap(fmt(c, { month: "long", year: "numeric" }));
        if (state.view === "agenda") return t("cal.nextDays", { n: AGENDA_DAYS });
        var a = startOfWeek(c), b = addDays(a, 6);
        var sameMonth = a.getMonth() === b.getMonth();
        return a.getDate() + (sameMonth ? "" : " " + fmt(a, { month: "short" })) + " – " + b.getDate() + " " + fmt(b, { month: "short", year: "numeric" });
    }

    function load() {
        var token = ++state.token;
        var r = range();
        document.getElementById("calTitle").textContent = title();
        api("/api/calendar/events?from=" + encodeURIComponent(r.from.toISOString()) + "&to=" + encodeURIComponent(r.to.toISOString())).then(function (list) {
            if (token !== state.token) return;
            state.events = list.map(hydrate);
            render();
        }).catch(function (e) {
            App.clear(body);
            body.appendChild(h("div", { class: "empty" }, h("h3", {}, t("err.title")), h("p", {}, e.message)));
        });
    }

    function loadExams() {
        api("/api/calendar/upcoming?type=EXAM&limit=5").then(function (list) {
            var box = document.getElementById("examList");
            App.clear(box);
            if (!list.length) { box.appendChild(h("p", { class: "muted" }, t("cal.noExams"))); return; }
            list.map(hydrate).forEach(function (e) {
                var days = Math.round((startOfDay(e.start) - today()) / 86400000);
                var label = days <= 0 ? t("cal.todayShort") : days === 1 ? t("cal.tomorrow") : t("cal.inDays", { n: days });
                box.appendChild(h("button", { type: "button", class: "exam " + e.cls, onclick: function () { editEvent(e); } },
                    h("span", { class: "when" }, h("b", {}, days <= 0 ? "!" : String(days)), h("small", {}, days <= 0 ? t("cal.todayShort") : t("cal.daysUnit"))),
                    h("span", { class: "what" }, h("strong", {}, e.title),
                        h("small", {}, fmt(e.start, { weekday: "short", day: "numeric", month: "short" }) + (e.allDay ? "" : " · " + App.clock(e.startsAt)) + " · " + label))));
            });
        }).catch(function () { /* optional widget */ });
    }

    function reload() { load(); loadExams(); }

    // ------------------------------------------------------------------
    // Rendering
    // ------------------------------------------------------------------

    function render() {
        App.clear(body);
        if (state.view === "month") renderMonth();
        else if (state.view === "week") renderWeek();
        else renderAgenda();
        App.refreshIcons();
    }

    function chip(e) {
        return h("button", { type: "button", class: "chip-ev " + e.cls, title: e.title + " · " + timeLabel(e), onclick: function (ev) { ev.stopPropagation(); editEvent(e); } },
            e.allDay ? null : h("span", { class: "t" }, App.clock(e.startsAt)), h("span", {}, e.title));
    }

    function renderMonth() {
        var c = state.cursor;
        var first = startOfWeek(new Date(c.getFullYear(), c.getMonth(), 1));
        var grid = h("div", { class: "month" });

        for (var i = 0; i < 7; i++) grid.appendChild(h("div", { class: "wd" }, fmt(addDays(first, i), { weekday: "short" })));

        for (var n = 0; n < 42; n++) {
            var day = addDays(first, n);
            var list = eventsOn(day);
            var cell = h("div", { class: "day" + (day.getMonth() !== c.getMonth() ? " other" : "") + (sameDay(day, today()) ? " today" : "") });
            cell.appendChild(h("span", { class: "num" }, String(day.getDate())));
            list.slice(0, 3).forEach(function (e) { cell.appendChild(chip(e)); });
            if (list.length > 3) {
                (function (d, all) {
                    cell.appendChild(h("button", { type: "button", class: "more-ev", onclick: function (ev) { ev.stopPropagation(); showDay(d, all); } }, t("cal.more", { n: all.length - 3 })));
                })(day, list);
            }
            (function (d) { cell.addEventListener("click", function () { newEvent({ date: d }); }); })(day);
            grid.appendChild(cell);
        }
        body.appendChild(grid);
    }

    function showDay(day, list) {
        var box = h("div", { class: "day-list" }, list.map(function (e) {
            return agendaRow(e, function () { dialog.close(); editEvent(e); });
        }));
        var dialog = App.modal({
            title: cap(fmt(day, { weekday: "long", day: "numeric", month: "long" })), body: box, autofocus: false,
            actions: [
                { label: t("cal.add"), kind: "btn-secondary", onClick: function () { newEvent({ date: day }); } },
                { label: t("common.close"), kind: "btn-primary" }
            ]
        });
    }

    function renderWeek() {
        var first = startOfWeek(state.cursor);
        var days = [0, 1, 2, 3, 4, 5, 6].map(function (i) { return addDays(first, i); });
        var wrap = h("div", { class: "week" });

        var head = h("div", { class: "week-head" }, h("div"));
        days.forEach(function (d) {
            head.appendChild(h("div", { class: "h" + (sameDay(d, today()) ? " today" : "") }, h("small", {}, fmt(d, { weekday: "short" })), h("b", {}, String(d.getDate()))));
        });
        wrap.appendChild(head);

        var allDay = h("div", { class: "allday-row" }, h("div", { class: "lbl" }, t("cal.allDay")));
        days.forEach(function (d) {
            allDay.appendChild(h("div", {}, eventsOn(d).filter(function (e) { return e.allDay; }).map(chip)));
        });
        wrap.appendChild(allDay);

        var hours = h("div", { class: "hours" });
        for (var hr = 0; hr < 24; hr++) hours.appendChild(h("div", {}, hr === 0 ? "" : pad(hr) + ":00"));
        var grid = h("div", { class: "grid-wrap" }, hours);

        days.forEach(function (d) {
            var col = h("div", { class: "col" + (sameDay(d, today()) ? " today" : "") });
            layout(eventsOn(d).filter(function (e) { return !e.allDay; }), d).forEach(function (b) { col.appendChild(block(b)); });
            col.addEventListener("click", function (event) {
                if (event.target !== col) return;
                var minutes = Math.floor((event.offsetY / HOUR) * 60 / 30) * 30;
                var start = new Date(d); start.setMinutes(minutes);
                newEvent({ date: d, start: start });
            });
            if (sameDay(d, today())) {
                var now = new Date();
                col.appendChild(h("div", { class: "now-line", style: { top: ((now.getHours() * 60 + now.getMinutes()) / 60 * HOUR) + "px" } }));
            }
            grid.appendChild(col);
        });
        wrap.appendChild(grid);
        body.appendChild(wrap);

        if (!body.dataset.scrolled || body.dataset.scrolled !== String(first.getTime())) {
            body.scrollTop = 7 * HOUR - 8;
            body.dataset.scrolled = String(first.getTime());
        }
    }

    // places overlapping events side by side
    function layout(list, day) {
        var dayStart = startOfDay(day).getTime(), dayEnd = dayStart + 86400000;
        var items = list.map(function (e) {
            var s = Math.max(e.start.getTime(), dayStart), f = Math.min(e.end.getTime(), dayEnd);
            return { e: e, s: s, f: Math.max(f, s + 20 * 60000), lane: 0, lanes: 1 };
        }).sort(function (a, b) { return a.s - b.s || a.f - b.f; });

        var group = [], groupEnd = 0;
        function close() { group.forEach(function (it) { it.lanes = Math.max.apply(null, group.map(function (g) { return g.lane; })) + 1; }); group = []; }

        items.forEach(function (it) {
            if (group.length && it.s >= groupEnd) { close(); groupEnd = 0; }
            var used = group.filter(function (g) { return g.f > it.s; }).map(function (g) { return g.lane; });
            while (used.indexOf(it.lane) !== -1) it.lane++;
            group.push(it);
            groupEnd = Math.max(groupEnd, it.f);
        });
        close();
        items.forEach(function (it) { it.dayStart = dayStart; });
        return items;
    }

    function block(it) {
        var e = it.e;
        var top = (it.s - it.dayStart) / 3600000 * HOUR;
        var height = Math.max(20, (it.f - it.s) / 3600000 * HOUR - 2);
        var el = h("button", {
            type: "button", class: "blk " + e.cls, title: e.title + " · " + timeLabel(e),
            style: { top: top + "px", height: height + "px", left: "calc(" + (it.lane / it.lanes * 100) + "% + 2px)", width: "calc(" + (100 / it.lanes) + "% - 4px)" },
            onclick: function (ev) { ev.stopPropagation(); editEvent(e); }
        }, h("b", {}, e.title), height > 34 ? h("small", {}, App.clock(e.startsAt) + " – " + App.clock(e.endsAt)) : null,
            height > 52 && e.location ? h("small", {}, e.location) : null);
        return el;
    }

    function agendaRow(e, onClick) {
        return h("button", { type: "button", class: "agenda-row " + e.cls, onclick: onClick || function () { editEvent(e); } },
            h("span", { class: "time" }, timeLabel(e)),
            h("span", { class: "info" }, h("strong", {}, e.title),
                h("small", {}, [e.subject, e.location].filter(Boolean).join(" · "))),
            h("span", { class: "tag" }, t("cal.type." + e.type)));
    }

    function renderAgenda() {
        var wrap = h("div", { class: "agenda" });
        var r = range(), any = false;
        for (var d = r.from; d < r.to; d = addDays(d, 1)) {
            var list = eventsOn(d);
            if (!list.length) continue;
            any = true;
            wrap.appendChild(h("div", { class: "agenda-day" },
                h("h3", {}, cap(fmt(d, { weekday: "long", day: "numeric", month: "long" })), sameDay(d, today()) ? h("span", { class: "chip primary" }, t("cal.today")) : null),
                list.map(function (e) { return agendaRow(e); })));
        }
        if (!any) {
            wrap.appendChild(h("div", { class: "empty" }, h("div", { class: "empty-icon" }, icon("calendar-days")),
                h("h3", {}, t("cal.emptyTitle")), h("p", {}, t("cal.emptyText")),
                h("button", { type: "button", class: "btn btn-primary", onclick: function () { newEvent({}); } }, icon("plus"), t("cal.add"))));
        }
        body.appendChild(wrap);
    }

    // ------------------------------------------------------------------
    // Create / edit
    // ------------------------------------------------------------------

    function newEvent(options) {
        var date = options.date || today();
        var start = options.start;
        if (!start) { start = new Date(date); var now = new Date(); start.setHours(sameDay(date, now) ? Math.min(now.getHours() + 1, 22) : 9, 0, 0, 0); }
        var type = options.type || "CLASS";
        var length = type === "EXAM" ? 120 : 60;
        openForm({ type: type, startsAt: start.toISOString(), endsAt: new Date(start.getTime() + length * 60000).toISOString(), allDay: false, recurrence: "NONE" }, null);
    }

    function editEvent(e) {
        openForm({
            title: e.title, type: e.type, subject: e.subject, location: e.location, notes: e.notes, allDay: e.allDay,
            startsAt: e.seriesStartsAt, endsAt: e.seriesEndsAt, recurrence: e.recurrence, recurrenceUntil: e.recurrenceUntil
        }, e.id);
    }

    function openForm(ev, id) {
        var start = new Date(ev.startsAt), end = new Date(ev.endsAt);

        var titleInput = h("input", { class: "input", maxlength: "150", required: true, value: ev.title || "", placeholder: t("cal.titlePlaceholder") });
        var subject = h("input", { class: "input", maxlength: "100", value: ev.subject || "", placeholder: t("cal.subjectPlaceholder") });
        var location = h("input", { class: "input", maxlength: "150", value: ev.location || "", placeholder: t("cal.locationPlaceholder") });
        var notes = h("textarea", { class: "textarea", rows: "3", maxlength: "2000", placeholder: t("cal.notesPlaceholder") }, ev.notes || "");
        var date = h("input", { class: "input", type: "date", required: true, value: dateValue(start) });
        var from = h("input", { class: "input", type: "time", value: timeValue(start) });
        var to = h("input", { class: "input", type: "time", value: timeValue(end) });
        var allDay = h("input", { type: "checkbox" });
        allDay.checked = !!ev.allDay;
        var repeat = h("select", { class: "select" },
            h("option", { value: "NONE" }, t("cal.noRepeat")), h("option", { value: "WEEKLY" }, t("cal.weekly")));
        repeat.value = ev.recurrence || "NONE";
        var until = h("input", { class: "input", type: "date", value: ev.recurrenceUntil || dateValue(addDays(start, 13 * 7)) });
        var status = h("p", { class: "status-line error" });

        var typeValue = ev.type;
        var picks = h("div", { class: "type-pick" }, TYPES.map(function (type) {
            var input = h("input", { type: "radio", name: "evType", value: type });
            input.checked = type === typeValue;
            input.addEventListener("change", function () { typeValue = type; sync(); });
            return h("label", { class: CLASS_OF[type] }, input, h("span", {}, h("span", { class: "dot " + CLASS_OF[type] }), t("cal.type." + type)));
        }));

        var timeRow = h("div", { class: "field-row" },
            h("div", { class: "field" }, h("label", {}, t("cal.from")), from),
            h("div", { class: "field" }, h("label", {}, t("cal.to")), to));
        var repeatRow = h("div", { class: "field-row" },
            h("div", { class: "field" }, h("label", {}, t("cal.repeat")), repeat),
            h("div", { class: "field untilField" }, h("label", {}, t("cal.until")), until));

        function sync() {
            timeRow.classList.toggle("hidden", allDay.checked);
            var canRepeat = typeValue !== "EXAM";
            repeatRow.classList.toggle("hidden", !canRepeat);
            if (!canRepeat) repeat.value = "NONE";
            repeatRow.querySelector(".untilField").classList.toggle("hidden", repeat.value !== "WEEKLY");
        }
        allDay.addEventListener("change", sync);
        repeat.addEventListener("change", sync);

        var form = h("form", {},
            h("div", { class: "field" }, h("label", {}, t("cal.titleLabel")), titleInput),
            h("div", { class: "field" }, h("label", {}, t("cal.typeLabel")), picks),
            h("div", { class: "field-row" },
                h("div", { class: "field" }, h("label", {}, t("cal.subject")), subject),
                h("div", { class: "field" }, h("label", {}, t("cal.location")), location)),
            h("div", { class: "field" }, h("label", {}, t("cal.date")), date),
            h("label", { class: "check-row" }, allDay, t("cal.allDay")),
            timeRow, repeatRow,
            id && ev.recurrence === "WEEKLY" ? h("p", { class: "hint", style: { marginBottom: "12px" } }, t("cal.editSeries")) : null,
            h("div", { class: "field" }, h("label", {}, t("cal.notes")), notes),
            status);
        sync();

        var actions = [
            { label: t("common.cancel"), kind: "btn-secondary" },
            { id: "save", label: t("cal.save"), kind: "btn-primary", close: false, onClick: function () { form.requestSubmit(); return false; } }
        ];
        var dialog = App.modal({ title: id ? t("cal.edit") : t("cal.new"), body: form, actions: actions });

        if (id) {
            var del = h("button", { type: "button", class: "btn btn-ghost-danger foot-left" }, icon("trash-2"), t("feed.delete"));
            del.addEventListener("click", function () {
                App.confirm({ title: t("cal.deleteTitle"), message: ev.recurrence === "WEEKLY" ? t("cal.deleteSeries") : t("cal.deleteText"), confirmText: t("feed.delete"), danger: true }).then(function (ok) {
                    if (!ok) return;
                    api("/api/calendar/events/" + id, { method: "DELETE" }).then(function () {
                        dialog.close();
                        App.toast(t("cal.deleted"), "success");
                        reload();
                    }).catch(function (e) { App.toast(e.message, "error"); });
                });
            });
            dialog.el.querySelector(".modal-foot").insertBefore(del, dialog.el.querySelector(".modal-foot").firstChild);
            App.refreshIcons();
        }

        form.addEventListener("submit", function (event) {
            event.preventDefault();
            status.textContent = "";
            if (!titleInput.value.trim()) { status.textContent = t("cal.titleRequired"); return; }
            if (!date.value) { status.textContent = t("cal.dateRequired"); return; }

            var day = parseDate(date.value), s, e;
            if (allDay.checked) {
                s = day; e = addDays(day, 1);
            } else {
                var a = from.value.split(":"), b = to.value.split(":");
                s = new Date(day); s.setHours(Number(a[0]), Number(a[1]), 0, 0);
                e = new Date(day); e.setHours(Number(b[0]), Number(b[1]), 0, 0);
                if (e <= s) { status.textContent = t("cal.endBeforeStart"); return; }
            }
            var weekly = repeat.value === "WEEKLY" && typeValue !== "EXAM";
            if (weekly && (!until.value || parseDate(until.value) < day)) { status.textContent = t("cal.untilInvalid"); return; }

            var payload = {
                title: titleInput.value.trim(), type: typeValue, subject: subject.value.trim(), location: location.value.trim(),
                notes: notes.value.trim(), startsAt: s.toISOString(), endsAt: e.toISOString(), allDay: allDay.checked,
                recurrence: weekly ? "WEEKLY" : "NONE", recurrenceUntil: weekly ? until.value : null, zone: ZONE
            };

            var button = dialog.buttons.save;
            button.disabled = true;
            api(id ? "/api/calendar/events/" + id : "/api/calendar/events", { method: id ? "PUT" : "POST", body: payload }).then(function () {
                dialog.close();
                App.toast(t("cal.saved"), "success");
                state.cursor = new Date(s);
                reload();
            }).catch(function (error) {
                status.textContent = error.message;
                button.disabled = false;
            });
        });
    }

    // ------------------------------------------------------------------
    // Wiring
    // ------------------------------------------------------------------

    function move(direction) {
        var c = state.cursor;
        if (state.view === "month") state.cursor = new Date(c.getFullYear(), c.getMonth() + direction, 1);
        else if (state.view === "week") state.cursor = addDays(c, 7 * direction);
        else state.cursor = addDays(c, AGENDA_DAYS * direction);
        load();
    }

    document.getElementById("calPrev").addEventListener("click", function () { move(-1); });
    document.getElementById("calNext").addEventListener("click", function () { move(1); });
    document.getElementById("calToday").addEventListener("click", function () { state.cursor = today(); load(); });
    document.getElementById("addEvent").addEventListener("click", function () { newEvent({}); });
    document.getElementById("addExam").addEventListener("click", function () { newEvent({ type: "EXAM" }); });

    document.querySelectorAll("#calViews button").forEach(function (button) {
        button.addEventListener("click", function () {
            document.querySelectorAll("#calViews button").forEach(function (b) { b.classList.toggle("active", b === button); });
            state.view = button.dataset.view;
            try { localStorage.setItem("studygram-calendar-view", state.view); } catch (e) { /* ignore */ }
            load();
        });
    });

    document.addEventListener("langchange", function () { load(); loadExams(); });

    // small screens open on the agenda, which fits them best
    var saved = null;
    try { saved = localStorage.getItem("studygram-calendar-view"); } catch (e) { /* ignore */ }
    var initial = ["month", "week", "agenda"].indexOf(saved) !== -1 ? saved : (window.innerWidth < 700 ? "agenda" : "month");
    state.view = initial;
    document.querySelectorAll("#calViews button").forEach(function (b) { b.classList.toggle("active", b.dataset.view === initial); });

    reload();
    if (location.hash === "#new") { history.replaceState(null, "", location.pathname); newEvent({}); }
    if (location.hash === "#exam") { history.replaceState(null, "", location.pathname); newEvent({ type: "EXAM" }); }
})();
