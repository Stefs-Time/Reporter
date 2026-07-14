# Project Feedback Tracker

A simple, local project feedback / status tracker. No install required — it runs
entirely in your browser on Windows.

## How to run

1. Copy this folder anywhere on your Windows machine (e.g. `Documents\Reporter`).
2. Double-click `index.html`. It opens in your default browser (Edge, Chrome, etc.).
3. That's it — no server, no Node, no Python needed.

Data is saved automatically in the browser's local storage on that PC. Use
**Export Data** regularly to back up your projects to a `.json` file (and
**Import Data** to restore or move them to another machine).

## Using it

- **+ New Project** — add a project. Fill in:
  - Responsible Owner
  - Project Name
  - Latest Feedback / Status Caption (short one-liner on where things stand)
  - Key Highlights
  - In Progress
  - Risks
  - On Hold
  - Support Requests Opened to IT
  - Open Help Desk Requests with Power BI Department

  For the list-type fields, put one item per line — each line becomes a bullet
  on the printed report.

- **Save** — stores your changes.
- **Print** — prints a clean report for the currently selected project.
- **Print All** — prints a report covering every project, in one go.
- **Search box** — filter the project list by owner or project name.
- **Export Data / Import Data** — back up or restore all projects as a JSON file.

## AI rewrite (optional)

Each field has a **✨ Rewrite** button that sends its current text to the free
[Groq](https://console.groq.com) API and replaces it with a version reworded
for a technical/business status-report tone. It only rewrites — it never
invents facts, ticket numbers, or details that aren't already in the text.

To set it up:

1. Create a free account at [console.groq.com](https://console.groq.com) and
   generate an API key (starts with `gsk_`). Groq's free tier needs no credit card.
2. In the app, click **AI Settings** (top right), paste the key in, pick a model,
   and click **Save**.
3. Click **✨ Rewrite** next to any field.

The key is stored only in this browser's local storage on this PC, and is sent
directly from your browser to Groq's API — it never passes through any other
server. If a rewrite fails (bad key, no internet, rate limit), the button
shows "Failed - retry" and an error message with the reason.

## Notes

- Data lives in the browser you open the file with. If you switch browsers, or
  clear browsing data, use an exported JSON backup to restore your projects.
- Aside from the optional AI rewrite calls to Groq, nothing is sent over the
  network — everything else stays on your machine.
