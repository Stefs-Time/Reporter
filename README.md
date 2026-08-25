# Project Feedback Tracker

A simple, local project feedback / status tracker. No install required — it runs
entirely in your browser on Windows.

## How to run

1. Copy this folder anywhere on your Windows machine (e.g. `Documents\Reporter`).
2. Double-click `index.html`. It opens in your default browser (Edge, Chrome, etc.).
3. That's it — no server, no Node, no Python needed.

## One screen, nothing to navigate

Everything lives on a single page:

- **Left side — your data, edited in place.** Projects and items are cards you
  type straight into. There are no separate screens, no lists to click through,
  and no Save buttons — every keystroke is saved instantly to the browser's
  local storage (a "✓ Saved" note in the header confirms it).
- **Right side — the live report.** A preview of the report updates as you
  type, so you always see exactly what **Print Report** / **Copy Report** will
  produce. Each category block has its own **📋 Copy** button.

Tip: to find something in a long list, just use the browser's find (**Ctrl+F**).

The app opens in **dark mode**. The **☀️ / 🌙 button** in the header switches
between dark and light, and your choice is remembered on this PC. The printed
report is always black-on-white regardless of the theme.

### Projects

Each project card has, all on one line: **Owner**, **Project Name**, and an
optional **Shortcode** (like `SDR` — used to reference the project in the AI
chat and CSV files), plus three toggle chips:

- **⭐ Highlight** — feature the project in Key Highlights
- **⚠️ Risk** — move it to the Risks section
- **⏸ Hold** — move it to the On Hold section

Below that is the status update box — write one line per point; each line
becomes its own bullet on the report. The card's left edge is coloured by its
flag (amber = highlight, red = risk, grey = hold) so status is visible at a
glance. The ✕ deletes the project (linked items keep their text but lose the
link).

The Owner box suggests names you've already used, so owners stay consistent.

### Extra items

Below the projects are four small lists — **Extra Risk Items**, **Extra
On-Hold Items**, **IT Support Requests**, **Power BI Help Desk** — for things
that aren't a whole project's status (e.g. a specific data-source issue). Each
row is just a text box, an optional "Link to project…" dropdown, ✨, and ✕.

If a *whole project* is at risk or on hold, don't add an item — just switch on
the chip on its card.

## The report

The report (live on the right, printed via **Print Report**, copied via
**Copy Report**) is grouped by category, then by owner, in this order:

1. **Key Highlights** — every project with the ⭐ chip on
2. **In Progress** — every project with *no* chip on (automatic — switching on
   ⭐, ⚠️, or ⏸ moves the project out of here and into that section instead, so
   nothing is listed twice)
3. **Risks** — projects with the ⚠️ chip, plus Extra Risk Items
4. **On Hold** — projects with the ⏸ chip, plus Extra On-Hold Items
5. **Support Requests Opened to IT**
6. **Open Help Desk Requests - Power BI Department**

Every category renders in the same fixed shape — owner, then project, then the
description as bullet points:

> **Owner**
> - Project
>   - description point
>   - description point

Extra items are grouped under their linked project's name (so a flagged
project and its extra risk items appear as one project with a combined bullet
list); items with no linked project appear as plain bullets under "Unassigned".
The copied plain-text version follows the same structure.

## Backups and CSV (the ⋯ More menu)

Data is saved automatically in the browser's local storage on that PC. The
**⋯ More** menu (top right) holds the transfer tools:

- **Export Backup (JSON)** — back up everything to a `.json` file; use
  **Import Backup (JSON)** to restore it or move to another machine. Export
  regularly.
- **⬇ Export CSV** is context-aware: if the app is empty it downloads a
  ready-to-fill **template** with example rows; if you already have data it
  downloads a **full dump** of everything. Either file is in the same format,
  so a dump can be edited in Excel and re-imported with **⬆ Import CSV**.
  **Importing a CSV replaces all current data** (export a JSON backup first if
  you want to keep it).
- **⚙ AI Settings** — see below.

The CSV is one unified sheet with a **Type** column:

- Rows with `Type = Project` fill in Owner, Project Name, Shortcode, the
  Detail / Description (put multiple points in one cell separated by ` | ` or
  line breaks), and the flag columns Highlight / At Risk / On Hold (`Yes`/`No`).
- Rows with `Type = Risk`, `On Hold`, `IT Support`, or `Power BI` fill in the
  Detail / Description (the item text) and optionally a **Linked Project
  Shortcode** to tie the item to one of the projects in the sheet.

Blank or unrecognised-Type rows are skipped, and items whose linked shortcode
doesn't match any project are imported unlinked — the import shows a summary of
both before you confirm.

## AI rewrite (optional)

Every status box and item row has a **✨** button that sends the text to the
free [Groq](https://console.groq.com) API and replaces it with a reworded
version — a semi-humanized but still corporate voice (like a colleague
talking, not a press release), detailed enough that each point stands on its
own as a meeting-minutes-style talking point. Multi-line updates are rewritten
line-for-line. It never repeats the project/owner name (that's already the
heading), and it only rewrites what's there — it's instructed to use only the
facts, numbers, and details already present, and to stay equally vague rather
than invent specifics when the source is vague.

The **✨ Enhance All** button (top header) runs the rewrite over everything in
one pass — every project name (lightly: spelling/casing only, never renaming),
every status update, and every item. It also fills in a shortcode for any
project that doesn't have one yet, leaving existing shortcodes untouched. It
confirms first, shows live progress, skips blank entries, and keeps going past
individual failures, reporting a summary at the end.

## AI update chat

The **💬 button** (bottom right) opens a chat panel where you can type updates
in plain language and have them applied for you — the fastest way to keep the
tracker current. Reference projects by shortcode or name, e.g.:

> SDR: exec signed off, UAT next week. Log a risk on IFM — data feed delayed.

The AI sees the tracker's current data, merges your new information into the
right project's status points (keeping points that still apply, dropping only
ones your update supersedes), switches chips when you say something is at
risk / on hold / a highlight, adds extra risk/on-hold/IT/Power BI items
(linked to the project you mention), and can create a new project when you
describe one. Every reply ends with a bullet summary of exactly what it
changed. If your message is ambiguous it asks a clarifying question instead of
guessing. Press **Enter** to send (Shift+Enter for a new line).

## AI setup

1. Create a free account at [console.groq.com](https://console.groq.com) and
   generate an API key (starts with `gsk_`). Groq's free tier needs no credit card.
2. In the app, open **⋯ More → AI Settings**, paste the key in, pick a model,
   and click **Save**.
3. Click any **✨** button, **✨ Enhance All**, or **💬** to chat your updates in.

The key is stored only in this browser's local storage on this PC, and is sent
directly from your browser to Groq's API — it never passes through any other
server. If a rewrite fails (bad key, no internet, rate limit), the button
shows "Retry" and an error message with the reason.

## Undoing AI changes

Whenever **Enhance All** or an **AI chat update** changes your data, an
**↩ Undo AI** button appears in the header. Clicking it restores everything to
exactly how it was before that AI change (it confirms first, and tells you
which change it will undo). One level of undo is kept and it survives closing
and reopening the app — and every field stays hand-editable after an enhance,
so you can also just tweak individual results instead of reverting.

## Keyboard shortcuts

- **Esc** — close the More menu, the settings modal, or the chat panel
- **Enter** in the chat — send (Shift+Enter for a new line)
- **Ctrl+F** — the browser's own find, to jump to any project or item

## Notes

- Data lives in the browser you open the file with. If you switch browsers, or
  clear browsing data, use an exported JSON backup to restore your data.
- Aside from the optional AI calls to Groq, nothing is sent over the network —
  everything else stays on your machine.
- Exported files from the previous version of this app (with per-project
  Highlights/Risks/etc. text fields) are not compatible with this version's
  Import — the data model changed to the flag/standalone-item structure above.
