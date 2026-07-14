# Project Feedback Tracker

A simple, local project feedback / status tracker. No install required — it runs
entirely in your browser on Windows.

## How to run

1. Copy this folder anywhere on your Windows machine (e.g. `Documents\Reporter`).
2. Double-click `index.html`. It opens in your default browser (Edge, Chrome, etc.).
3. That's it — no server, no Node, no Python needed.

Data is saved automatically in the browser's local storage on that PC. Use
**Export Data** regularly to back up your data to a `.json` file (and
**Import Data** to restore or move it to another machine).

## How it's organised

The sidebar has five sections:

- **Projects** — the master list of tracked projects. Each project is just:
  - Responsible Owner
  - Project Name
  - Latest Feedback / Status Caption (short one-liner on where things stand)
  - Three flags: **Feature in Key Highlights**, **Flag as At Risk**, **Flag as On Hold**

- **Risks**, **On Hold**, **IT Support Requests**, **Power BI Help Desk** — standalone
  lists of items. Each item is free text with an optional dropdown to link it to
  one of your projects (for extra risks/holds/requests that aren't just "the whole
  project is at risk", e.g. a specific data-source issue tied to a project).

## The printed report

Click **Print Report** to generate one consolidated report, in this order:

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

## AI rewrite (optional)

The Latest Feedback caption on a project, and the description on any standalone
item, have a **✨ Rewrite** button that sends the current text to the free
[Groq](https://console.groq.com) API and replaces it with a version reworded
for a technical/business status-report tone. It only rewrites — it never
invents facts, ticket numbers, or details that aren't already in the text.

To set it up:

1. Create a free account at [console.groq.com](https://console.groq.com) and
   generate an API key (starts with `gsk_`). Groq's free tier needs no credit card.
2. In the app, click **AI Settings** (top right), paste the key in, pick a model,
   and click **Save**.
3. Click **✨ Rewrite** next to the field you want reworded.

The key is stored only in this browser's local storage on this PC, and is sent
directly from your browser to Groq's API — it never passes through any other
server. If a rewrite fails (bad key, no internet, rate limit), the button
shows "Failed - retry" and an error message with the reason.

## Notes

- Data lives in the browser you open the file with. If you switch browsers, or
  clear browsing data, use an exported JSON backup to restore your data.
- Aside from the optional AI rewrite calls to Groq, nothing is sent over the
  network — everything else stays on your machine.
- Exported files from the previous version of this app (with per-project
  Highlights/Risks/etc. text fields) are not compatible with this version's
  Import — the data model changed to the flag/standalone-item structure above.
