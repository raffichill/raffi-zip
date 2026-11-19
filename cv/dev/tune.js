// Localhost-only DialKit panel for tuning /cv typography and spacing.
// Loaded by cv/index.html only on localhost; cv/dev/ is in .vercelignore.
//
// style.css is the source of truth: the panel starts from the CSS variables in
// :root, and "Save" writes the current values back into style.css (and the
// edited text into index.html) through cv/dev/save-server.mjs.
(function () {
    const root = document.documentElement;
    const css = getComputedStyle(root);
    const read = (name) => css.getPropertyValue(name).trim();
    const num = (name) => parseFloat(read(name));

    // Every CSS variable the panel controls, and the value it currently has.
    const applied = {};
    const set = (name, value) => {
        applied[name] = String(value);
        root.style.setProperty(name, value);
    };

    const families = {
        geist: '"Geist Serif"',
        caslon: '"Libre Caslon Condensed"',
    };
    const shapes = { round: 0, square: 25, triangle: 50, heart: 100 };
    const numeric = read("--serif-numeric");
    const features = read("--serif-features");

    const spacing = {
        margin: ["--margin", 18, 54, 1],
        datesColumn: ["--side", 70, 160, 1],
        datesToContent: ["--gap", 0, 40, 1],
        headerToRule: ["--header-pad", 0, 30, 1],
        ruleToFirstRole: ["--header-gap", 0, 40, 1],
        contactGap: ["--contact-gap", 4, 32, 1],
        roleGap: ["--role-gap", 4, 40, 1],
        titleToText: ["--title-gap", 0, 12, 0.5],
        introToItems: ["--lede-gap", 0, 20, 0.5],
        itemGap: ["--item-gap", 0, 12, 0.5],
        labelToText: ["--label-gap", 0, 16, 0.5],
    };

    DialKit.createDialRoot();
    const kit = DialKit.createDialKit(
        "Type",
        {
            editText: false,
            save: { type: "action", label: "Save text + styles to files" },
            print: { type: "action", label: "Print / save as PDF" },
            serif: {
                family: {
                    type: "select",
                    options: [
                        { value: "geist", label: "Geist Serif" },
                        { value: "caslon", label: "Libre Caslon Condensed" },
                    ],
                    default: read("--serif-font").includes("Caslon") ? "caslon" : "geist",
                },
                weight: [num("--serif-weight"), 400, 700, 10],
                size: [num("--size"), 7.5, 11, 0.25],
                tracking: [num("--serif-tracking"), -0.03, 0.06, 0.0025],
                dots: {
                    type: "select",
                    options: Object.keys(shapes),
                    default: Object.keys(shapes).find((k) => shapes[k] === num("--serif-shape")) ?? "round",
                },
                numerals: {
                    type: "select",
                    options: ["lining", "oldstyle"],
                    default: numeric.includes("oldstyle") ? "oldstyle" : "lining",
                },
                figures: {
                    type: "select",
                    options: ["tabular", "proportional"],
                    default: numeric.includes("proportional") ? "proportional" : "tabular",
                },
                altAKR: features.includes("ss01"),
                roundLetters: features.includes("ss05"),
            },
            sans: {
                size: [num("--sans-size"), 8, 11, 0.25],
                tracking: [num("--sans-tracking"), -0.03, 0.06, 0.0025],
            },
            lineHeight: [num("--line"), 11, 16, 0.25],
            spacing: Object.fromEntries(
                Object.entries(spacing).map(([key, [name, min, max, step]]) => [key, [num(name), min, max, step]]),
            ),
        },
        {
            onAction: (action) => {
                if (action === "save") save();
                if (action === "print") window.print();
            },
        },
    );

    // Outline the page in red whenever content runs past the bottom margin.
    const page = document.querySelector(".page");
    const checkFit = () => {
        const last = page.querySelector("section:last-of-type");
        const limit = page.getBoundingClientRect().bottom - parseFloat(getComputedStyle(page).paddingBottom);
        page.classList.toggle("overflowing", last.getBoundingClientRect().bottom > limit + 0.5);
    };

    async function save() {
        const html = page.innerHTML.replace(/ contenteditable="[^"]*"/g, "");
        try {
            const res = await fetch("http://127.0.0.1:5051/save", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ html, vars: applied }),
            });
            if (!res.ok) throw new Error(await res.text());
        } catch (error) {
            alert("Couldn't save. Is `node cv/dev/save-server.mjs` running?\n\n" + error.message);
        }
    }

    // Edit mode: type directly on the page. Pastes come in as plain text.
    page.addEventListener("paste", (event) => {
        if (!page.isContentEditable) return;
        event.preventDefault();
        document.execCommand("insertText", false, event.clipboardData.getData("text/plain"));
    });
    document.addEventListener("keydown", (event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === "s") {
            event.preventDefault();
            save();
        }
    });

    kit.subscribe(({ editText, serif, sans, lineHeight, spacing: space }) => {
        page.contentEditable = editText ? "true" : "false";
        page.classList.toggle("editing", editText);

        set("--serif-font", families[serif.family]);
        set("--serif-weight", serif.weight);
        set("--size", serif.size + "pt");
        set("--serif-tracking", serif.tracking + "em");
        set("--serif-shape", shapes[serif.dots] ?? 0);
        set(
            "--serif-numeric",
            `${serif.numerals === "oldstyle" ? "oldstyle-nums" : "lining-nums"} ${
                serif.figures === "proportional" ? "proportional-nums" : "tabular-nums"
            }`,
        );
        const on = [serif.altAKR && '"ss01"', serif.roundLetters && '"ss05"'].filter(Boolean);
        set("--serif-features", on.length ? on.join(", ") : "normal");

        set("--sans-size", sans.size + "pt");
        set("--sans-tracking", sans.tracking + "em");
        set("--line", lineHeight + "pt");
        for (const [key, [name]] of Object.entries(spacing)) set(name, space[key] + "pt");

        requestAnimationFrame(checkFit);
    });
    document.fonts.ready.then(checkFit);
})();
