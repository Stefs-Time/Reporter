# Project Feedback Tracker

A simple, local project feedback / status tracker. No install required — it runs
entirely in your browser on Windows.

## How to run

1. Copy this folder anywhere on your Windows machine (e.g. `Documents\Reporter`).
2. Double-click `index.html`. It opens in your default browser (Edge, Chrome, etc.).
3. That's it — no server, no Node, no Python needed.

Data is saved automatically in the browser's local storage on that PC. Use
**Export Data** regularly to back up your data to a `.json` file (and
**Import Data** to restore or move it to another machine). To move data through a
spreadsheet instead, use **Export CSV** / **Import CSV** (see below).

## How it's organised

The sidebar has five sections:

- **Projects** — the master list of tracked projects. Each project is just:
  - Responsible Owner
  - Project Name
  - Shortcode (optional short code like `SDR`, shown as a `[SDR]` prefix everywhere
    the project name appears — lists, the report, and the project-link dropdown)
  - Latest Feedback / Status Caption — one line for a short status, or multiple
    lines to break it into separate highlight points (each line renders as its
    own bullet under the project on the report)
  - Three flags: **Feature in Key Highlights**, **Flag as At Risk**, **Flag as On Hold**

- **Risks**, **On Hold**, **IT Support Requests**, **Power BI Help Desk** — standalone
  lists of items. Each item is free text with an optional dropdown to link it to
  one of your projects (for extra risks/holds/requests that aren't just "the whole
  project is at risk", e.g. a specific data-source issue tied to a project).

## The report

Click the **Report** section in the sidebar to preview a consolidated report on
screen before printing, grouped by category first and then by owner within
each category, in this order:

1. **Key Highlights** — every project flagged "Feature in Key Highlights"
2. **In Progress** — every project *not* flagged At Risk or On Hold (automatic —
   flag a project either way and it moves out of this section)
3. **Risks** — projects flagged At Risk, plus any standalone Risk items (shows the
   linked project name if one was set)
4. **On Hold** — same pattern as Risks, using the On Hold flag and standalone items
5. **Support Requests Opened to IT** — standalone IT Support Request items
6. **Open Help Desk Requests - Power BI Department** — standalone Power BI items

Deleting a project doesn't delete risk/on-hold/request items that were linked to
it — they keep their text and just lose the link.

Each category block in the Report view has its own **📋 Copy** button (copies
just that category, across all owners, as plain text) plus a **📋 Copy Full
Report** button in the header for the whole thing — handy for pasting into an
email, Teams, or Slack. **Print Report** prints the same layout without the
copy buttons.

## CSV export / import

**⬇ Export CSV** is context-aware: if the app is empty it downloads a
ready-to-fill **template** with example rows; if you already have data it
downloads a **full dump** of everything currently in the app. Either file is in
the same format, so a dump can be edited in Excel and re-imported. Then use
**⬆ Import CSV** to load a file back in. **Importing a CSV replaces all current
data** (export a JSON backup first if you want to keep it).

The CSV is one unified sheet with a **Type** column:

- Rows with `Type = Project` fill in Owner, Project Name, Shortcode, the
  Detail / Description (put multiple highlight points in one cell separated by
  ` | ` or line breaks), and the flag columns Highlight / At Risk / On Hold
  (`Yes`/`No`).
- Rows with `Type = Risk`, `On Hold`, `IT Support`, or `Power BI` fill in the
  Detail / Description (the item text) and optionally a **Linked Project
  Shortcode** to tie the item to one of the projects in the sheet.

Blank or unrecognised-Type rows are skipped, and items whose linked shortcode
doesn't match any project are imported unlinked — the import shows a summary of
both before you confirm.

## AI rewrite (optional)

The Project Name, Shortcode, and Latest Feedback caption on a project, and the
description on any standalone item, each have a **✨ Rewrite** button that sends
the current text to the free [Groq](https://console.groq.com) API and replaces
it with a reworded version. Project Name gets a lighter touch — tidied wording,
casing, and grammar only, without changing the subject or inventing a
different name. The Shortcode ✨ generates a short uppercase code (2–5
characters) derived from the project name. Everything else is reworded in a
semi-humanized but still corporate voice (like a colleague talking, not a
press release), detailed enough that the point stands on its own as a
meeting-minutes-style talking point — and if the caption has multiple lines,
each line is treated as its own point and rewritten one-for-one. It's also told
never to repeat the project/owner name inside the rewritten text, since that's
already shown as the heading. In every case it only rewrites what's there —
it's instructed to use only the facts, numbers, and details already present in
the source text, and to keep things equally vague rather than invent specifics
when the source is vague.

There's also an **✨ AI Enhance All** button (top header) that runs the same
rewrite over every project (name and caption) and every standalone item in one
pass — useful before printing/copying the report. It also fills in a shortcode
for any project that doesn't have one yet, but leaves existing shortcodes
untouched (use the Shortcode ✨ button if you want to regenerate one). It
confirms first (since it touches everything at once), shows live progress,
skips blank entries, and keeps going past individual failures, reporting a
summary at the end.

## AI update chat

The **💬 button** (bottom right) opens a chat panel where you can type updates
in plain language and have them applied for you — the fastest way to keep the
tracker current. Reference projects by shortcode or name, e.g.:

> SDR: exec signed off, UAT next week. Log a risk on IFM — data feed delayed.

The AI sees the tracker's current data, merges your new information into the
right project's status points (keeping points that still apply, dropping only
ones your update supersedes), sets flags when you say something is at risk /
on hold / a highlight, adds standalone risk/on-hold/IT/Power BI items (linked
to the project you mention), and can create a new project when you describe
one. Every reply ends with a bullet summary of exactly what it changed, and it
follows the same "use only what you said, don't invent details" rule as the
rewrite buttons. If your message is ambiguous it asks a clarifying question
instead of guessing. Press **Enter** to send (Shift+Enter for a new line).

## Keyboard shortcuts

- **Ctrl+S** (Cmd+S on Mac) — save the project or item form you're editing
- **Esc** — close the settings modal or the chat panel
- **Enter** in the chat — send (Shift+Enter for a new line)

## AI setup

1. Create a free account at [console.groq.com](https://console.groq.com) and
   generate an API key (starts with `gsk_`). Groq's free tier needs no credit card.
2. In the app, click **AI Settings** (top right), paste the key in, pick a model,
   and click **Save**.
3. Click **✨ Rewrite** next to the field you want reworded, **✨ AI Enhance
   All** to rewrite everything at once, or **💬** to chat your updates in.

The key is stored only in this browser's local storage on this PC, and is sent
directly from your browser to Groq's API — it never passes through any other
server. If a rewrite fails (bad key, no internet, rate limit), the button
shows "Failed - retry" and an error message with the reason. Since Enhance All
overwrites everything, export a backup first if you want to be able to revert.

## Notes

- Data lives in the browser you open the file with. If you switch browsers, or
  clear browsing data, use an exported JSON backup to restore your data.
- Aside from the optional AI rewrite calls to Groq, nothing is sent over the
  network — everything else stays on your machine.
- Exported files from the previous version of this app (with per-project
  Highlights/Risks/etc. text fields) are not compatible with this version's
  Import — the data model changed to the flag/standalone-item structure above.
