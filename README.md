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

## Notes

- Data lives in the browser you open the file with. If you switch browsers, or
  clear browsing data, use an exported JSON backup to restore your projects.
- Nothing is sent over the network — everything stays on your machine.
