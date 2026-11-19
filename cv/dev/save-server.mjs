// Localhost-only helper for the /cv DialKit panel. Writes edited text back into
// cv/index.html and tuned CSS variables back into cv/style.css.
// Run alongside live-server: `node cv/dev/save-server.mjs` (listens on 127.0.0.1:5051).
import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const HTML = fileURLToPath(new URL("../index.html", import.meta.url));
const CSS = fileURLToPath(new URL("../style.css", import.meta.url));
const OPEN = '<main class="page">';
const CLOSE = "</main>";
const ALLOWED = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const VAR_NAME = /^--[a-z0-9-]+$/;
const SAFE_VALUE = /^[\w\s".,%+-]+$/; // numbers, units, quoted family names, keyword lists

async function saveHtml(html) {
    const source = await readFile(HTML, "utf8");
    const start = source.indexOf(OPEN) + OPEN.length;
    const end = source.lastIndexOf(CLOSE);
    if (start < OPEN.length || end < start) throw new Error("page markers not found in index.html");
    await writeFile(HTML, source.slice(0, start) + html + source.slice(end));
}

// Replace each variable's value inside the :root block, keeping trailing comments.
async function saveVars(vars) {
    let source = await readFile(CSS, "utf8");
    const rootStart = source.indexOf(":root {");
    const rootEnd = source.indexOf("\n}", rootStart);
    if (rootStart < 0 || rootEnd < 0) throw new Error(":root block not found in style.css");
    let block = source.slice(rootStart, rootEnd);
    for (const [name, value] of Object.entries(vars)) {
        if (!VAR_NAME.test(name) || !SAFE_VALUE.test(value)) throw new Error(`refusing ${name}: ${value}`);
        const line = new RegExp(`(\\n\\s*${name}:)[^;]*;`);
        if (!line.test(block)) throw new Error(`${name} not declared in :root`);
        block = block.replace(line, `$1 ${value};`);
    }
    await writeFile(CSS, source.slice(0, rootStart) + block + source.slice(rootEnd));
}

createServer(async (req, res) => {
    const origin = req.headers.origin ?? "";
    if (ALLOWED.test(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    }
    if (req.method === "OPTIONS") return res.end();
    if (req.method !== "POST" || req.url !== "/save" || !ALLOWED.test(origin)) {
        res.statusCode = 404;
        return res.end();
    }
    let body = "";
    for await (const chunk of req) body += chunk;
    try {
        const { html, vars } = JSON.parse(body);
        // Styles first: a CSS write is hot-swapped, the HTML write triggers the reload.
        if (vars) await saveVars(vars);
        if (typeof html === "string") await saveHtml(html);
        res.end("ok");
    } catch (error) {
        res.statusCode = 500;
        res.end(String(error));
    }
}).listen(5051, "127.0.0.1", () => console.log("cv save server on http://127.0.0.1:5051"));
