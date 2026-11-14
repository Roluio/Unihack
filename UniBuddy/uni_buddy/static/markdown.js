// ------------------------------------------------------------
// Safe Markdown renderer (escape first, then format)
// ------------------------------------------------------------

function escapeHtml(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function inlineMarkdown(text) {
    return escapeHtml(text)
        .replace(/`([^`]+)`/g, "<code>$1</code>")
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");
}

function renderMarkdown(source) {
    const lines = String(source).replace(/\r/g, "").split("\n");
    const out = [];
    let list = null;      // "ul" | "ol"
    let inCode = false;
    let code = [];
    let table = [];

    const closeList = () => {
        if (list) { out.push(`</${list}>`); list = null; }
    };

    const flushTable = () => {
        if (!table.length) return;
        const rows = table
            .filter(r => !/^\s*\|?[\s:|-]+\|?\s*$/.test(r))
            .map(r => r.trim().replace(/^\||\|$/g, "").split("|").map(c => c.trim()));
        if (rows.length) {
            let html = "<div class=\"md-table-wrap\"><table>";
            rows.forEach((cells, i) => {
                const tag = i === 0 ? "th" : "td";
                html += "<tr>" + cells.map(c => `<${tag}>${inlineMarkdown(c)}</${tag}>`).join("") + "</tr>";
            });
            out.push(html + "</table></div>");
        }
        table = [];
    };

    for (const line of lines) {
        if (line.trim().startsWith("```")) {
            if (inCode) {
                out.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
                code = [];
                inCode = false;
            } else {
                closeList(); flushTable();
                inCode = true;
            }
            continue;
        }

        if (inCode) { code.push(line); continue; }

        if (/^\s*\|.*\|\s*$/.test(line)) { closeList(); table.push(line); continue; }
        flushTable();

        let m;
        if ((m = line.match(/^(#{1,4})\s+(.*)$/))) {
            closeList();
            const level = Math.min(m[1].length + 2, 6);
            out.push(`<h${level}>${inlineMarkdown(m[2])}</h${level}>`);
        } else if ((m = line.match(/^\s*[-*•]\s+(.*)$/))) {
            if (list !== "ul") { closeList(); out.push("<ul>"); list = "ul"; }
            out.push(`<li>${inlineMarkdown(m[1])}</li>`);
        } else if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) {
            if (list !== "ol") { closeList(); out.push("<ol>"); list = "ol"; }
            out.push(`<li>${inlineMarkdown(m[1])}</li>`);
        } else if (!line.trim()) {
            closeList();
        } else {
            closeList();
            out.push(`<p>${inlineMarkdown(line)}</p>`);
        }
    }

    if (inCode) out.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
    closeList();
    flushTable();
    return out.join("");
}

