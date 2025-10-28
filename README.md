# PLM Dashboard — DO-117 (Phase 1)

Date-aware, vanilla-JS dashboard for NAWCTSD PLM daily tag-ups and project tracking.

## Features (Phase 1)
- **DateService** locked to **America/Chicago**
- Status line: `Local time: [hh:mm] CT | Week [##]`
- Pages: **Dashboard**, **Daily Tag-Up**, **Task Manager**
- Weekend smart handling for Yesterday
- Task suggestions (due today) on Tag-Up
- Copy to Clipboard (one click)
- Keyboard-friendly, all buttons/links clickable
- Works in **Microsoft Edge**

---

## File structure
```
plm-dashboard/
├─ index.html
├─ styles.css
├─ app.js
├─ dashboard-data.json
├─ README.md
└─ .nojekyll          # optional but recommended for GitHub Pages
```

---

## Local dev (recommended)
Serve the folder so `dashboard-data.json` can be fetched.

```bash
# Python 3
python -m http.server 8080
# visit
http://localhost:8080
```

> Tip: Edit `dashboard-data.json` "lastTagUpISO" to **yesterday** to test the rollover.

---

## Deploy to GitHub Pages (one-time setup)
1. Push these files to a **public** repo (e.g., `plm-dashboard`).
2. In the repo: **Settings → Pages**
3. **Source:** “Deploy from a branch”
4. **Branch:** `main` • **Folder:** `/root`
5. **Save**. Your site will publish at  
   `https://<your-username>.github.io/plm-dashboard/`

> Hash routing is used, so `#/dashboard`, `#/tagup`, `#/tasks` won’t 404.

---

## Update data
Phase 1 stores edits **in memory only**. To change sample content:
- Edit `dashboard-data.json` and commit.
- Phase 2 will add SharePoint/Access/SQL sync and real persistence.

---

## Troubleshooting
- **White page / JSON 404:** Ensure `dashboard-data.json` is in repo root and published.
- **Clipboard denied:** Must be triggered by a click; use the “Copy to Clipboard” button.
- **Old version showing:** Hard refresh or append `?v=1` to the URL. Pages can cache.
- **Wrong timezone:** Browser formatting is *forced* to America/Chicago via `Intl`.

---

## Roadmap (Phase 2, after confirmation)
- SharePoint JSON sync or Access/SQL backend
- TFR site tracker & building tables
- RFI and Risk logs with filters
- Dark Mode toggle
- Simple auth (optional)

---

## License
MIT. Ship it.
