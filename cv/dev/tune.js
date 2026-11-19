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

    // Untitled (Klim) and Gerstner are trial fonts installed on this Mac only.
    const serifFamilies = {
        geist: ["Geist Serif", '"Geist Serif"'],
        caslon: ["Libre Caslon Condensed", '"Libre Caslon Condensed"'],
        untitled: ["Untitled Serif", '"Test Untitled Serif VF", "Test Untitled Serif"'],
    };
    const sansFamilies = {
        gerstner: ["Gerstner Programm", '"Gerstner Programm"'],
        inter: ["Inter", "InterVariable"],
        untitled: ["Untitled Sans", '"Test Untitled Sans VF", "Test Untitled Sans"'],
    };
    const familyControl = (families, current) => ({
        type: "select",
        options: Object.entries(families).map(([value, [label]]) => ({ value, label })),
        default: Object.keys(families).find((k) => families[k][1] === current) ?? Object.keys(families)[0],
    });
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
            serif: {
                family: familyControl(serifFamilies, read("--serif-font")),
                weight: [num("--serif-weight"), 300, 800, 10],
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
                family: familyControl(sansFamilies, read("--sans-font")),
                weight: [num("--sans-weight"), 300, 700, 10],
                size: [num("--sans-size"), 8, 11, 0.25],
                tracking: [num("--sans-tracking"), -0.03, 0.06, 0.0025],
            },
            lineHeight: [num("--line"), 11, 16, 0.25],
            spacing: Object.fromEntries(
                Object.entries(spacing).map(([key, [name, min, max, step]]) => [key, [num(name), min, max, step]]),
            ),
        },
        {},
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
            dirty = false;
            stylesChanged = false;
            renderStatus("Saved");
        } catch (error) {
            alert("Couldn't save. Is `node cv/dev/save-server.mjs` running?\n\n" + error.message);
        }
    }

    // Unsaved changes block reloads (live-server reloads on any file write).
    let dirty = false; // text edited since last save
    let stylesChanged = false; // sliders moved since last save
    let ready = false; // ignore the subscribe call that applies the initial values
    page.addEventListener("input", () => {
        dirty = true;
        renderStatus();
    });
    window.addEventListener("beforeunload", (event) => {
        if (dirty || stylesChanged) event.preventDefault();
    });

    // Save / Print buttons, top left, outside the DialKit panel (hidden when printing).
    const barStyle = document.createElement("style");
    barStyle.textContent = `
        .cv-dev-bar {
            position: fixed; left: 16px; top: 16px; z-index: 1000;
            display: flex; align-items: center; gap: 8px; padding: 6px 6px 6px 14px;
            background: #fff; border-radius: 12px;
            box-shadow: 0 1px 2px rgb(0 0 0 / .08), 0 8px 24px rgb(0 0 0 / .12);
            font: 500 13px/1 system-ui, sans-serif; letter-spacing: 0; color: #555;
        }
        .cv-dev-bar.unsaved .cv-dev-status { color: #c4320a; }
        .cv-dev-bar button {
            font: inherit; border: 0; border-radius: 8px; padding: 9px 12px;
            background: #f0f0f0; color: #111; cursor: pointer;
        }
        .cv-dev-bar button.primary { background: #111; color: #fff; }
        @media print { .cv-dev-bar { display: none !important; } }`;
    document.head.append(barStyle);
    const bar = document.createElement("div");
    bar.className = "cv-dev-bar";
    bar.innerHTML = `
        <span class="cv-dev-status"></span>
        <button type="button" data-act="print">Print</button>
        <button type="button" data-act="save" class="primary">Save to files</button>`;
    document.body.append(bar);
    const status = bar.querySelector(".cv-dev-status");
    bar.addEventListener("click", (event) => {
        const act = event.target.closest("button")?.dataset.act;
        if (act === "save") save();
        if (act === "print") window.print();
    });
    function renderStatus(message) {
        const unsaved = dirty || stylesChanged;
        bar.classList.toggle("unsaved", unsaved);
        status.textContent = message ?? (unsaved ? "Unsaved changes" : "All saved");
    }
    renderStatus();

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

        set("--serif-font", serifFamilies[serif.family][1]);
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

        set("--sans-font", sansFamilies[sans.family][1]);
        set("--sans-weight", sans.weight);
        set("--sans-size", sans.size + "pt");
        set("--sans-tracking", sans.tracking + "em");
        set("--line", lineHeight + "pt");
        for (const [key, [name]] of Object.entries(spacing)) set(name, space[key] + "pt");

        requestAnimationFrame(checkFit);
        if (ready) {
            stylesChanged = true;
            renderStatus();
        }
        ready = true;
    });
    document.fonts.ready.then(checkFit);
})();
