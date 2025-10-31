# PLM Dashboard — DO-117 (Final Build)

This is the final build of the PLM Dashboard (DO‑117 Tag‑Up & Scrum Tool) as delivered in Phase 3. The application is a lightweight, client‑side web app that works entirely in the browser and persists all of your data using IndexedDB. No external build tools are needed; simply host the files on GitHub Pages.

## Features

- **Hash‑based routing** for Dashboard, Daily Tag‑Up, Tasks, RFIs, Risks, TFR Tracker and Settings.
- **Persistent storage** via IndexedDB. All CRUD operations (create, read, update, delete) for tag‑ups, tasks, RFIs, risks and TFR entries are saved locally.
- **Dark / Light mode toggle**. Your preference is saved and restored on reload.
- **DateService** displays current local time (America/Chicago) and ISO‑week number, rolling to the following Monday when you land on a weekend.
- **Copy to Clipboard** action on the Tag‑Up page to quickly copy yesterday’s accomplishments, today’s plans and risks for easy sharing.
- **Initial seed data** loaded from `dashboard‑data.json` on first run. Includes sample team members, tag‑up data, tasks, RFIs, risks and TFR entries.
- **Settings page** provides import and export of your data as JSON.

## Deployment

1. Ensure your repository has the following files at the root:
   - `index.html`
   - `app.js`
   - `styles.css`
   - `dashboard-data.json`
   - `.nojekyll` (empty file to disable Jekyll on GitHub Pages)
   - `README.md`

2. Commit these files to the `main` branch of your repository.

3. Go to **Settings → Pages** in GitHub. Under “Build and deployment” select:
   - **Source**: `Deploy from a branch`
   - **Branch**: `main`
   - **Folder**: `/` (root)

4. Click **Save**. GitHub Pages will build and deploy your site. The site will be available at `https://<your-username>.github.io/<repository-name>/`.

5. Visit your GitHub Pages URL to verify:
   - All navigation links work.
   - Dark mode toggle persists.
   - You can create, edit and delete tasks, RFIs, risks and TFR records.
   - You can create a daily Tag‑Up and copy it to your clipboard.
   - The current time and week number display correctly (week number should roll over after weekends).
   - No errors appear in the console.

Enjoy your PLM dashboard!
