# PLM Dashboard — DO-117 Scrum + Tag‑Up (Phase 3 Final)

Final single‑page app for GitHub Pages. **No backend** — data persists in **IndexedDB**; theme in **localStorage**.

## Features
- Hash router: `#/dashboard`, `#/tagup`, `#/tasks`, `#/rfis`, `#/risks`, `#/tfr`, `#/settings` (default `#/dashboard`).
- CRUD with persistence for Tasks, RFIs, Risks, TFR items, Tag‑Ups.
- Copy‑to‑Clipboard on Tag‑Up.
- DateService shows ISO week number, weekend label, and friendly date.
- Dark/Light mode toggle.
- Edge‑friendly (no build tools, no frameworks).

## Files
- `index.html` — root entry (required by GitHub Pages).
- `app.js` — all app logic (router + IndexedDB + views).
- `styles.css` — minimalist Bowhead‑ish theme.
- `dashboard-data.json` — starter dataset (optional import by you).
- `.nojekyll` — prevents Jekyll processing on Pages.
- `README.md` — this file.

## Quick Start (Local)
Open `index.html` in a modern browser. All data is stored locally on your machine.

## Deploy on GitHub Pages
1. Create a repo (or use existing): `braggw22/plm-dashboard`.
2. Upload all files at repo root: `index.html`, `app.js`, `styles.css`, `dashboard-data.json`, `.nojekyll`, `README.md`.
3. In GitHub: **Settings → Pages → Source = Deploy from a branch**. Pick `main` and `/root` (or `/`).
4. Save. Wait for the green check, then open your Pages URL: `https://braggw22.github.io/plm-dashboard/`.

### Verify
- Navigates to all routes with no console errors (Edge).
- Add/edit items in Tasks/RFIs/Risks/TFR; refresh page — data persists.
- Create a Tag‑Up and click **Copy to Clipboard** — paste into a note to confirm.
- Toggle theme; reload — preference persists.
- Footer shows `Week N` and friendly date; shows `(Weekend)` on Sat/Sun.

## Import/Export
- **Export**: Settings → *Export JSON* downloads `plm-dashboard-export.json`.
- **Import**: (Manual) open the JSON and add items via the UI as needed.

## Notes
- If you want to reset everything: Settings → *Wipe All Data*.
- IndexedDB name: `plm_dashboard_v3`. Object stores: `tasks, rfis, risks, tfrs, tagups, settings`.
