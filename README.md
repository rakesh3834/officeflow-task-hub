# OfficeFlow Task Hub

A Jira-style daily office task tracker backed by Google Sheets.

The app gives you:

- Board, list, and daily focus views
- Task create/edit/delete
- Drag-to-move status columns
- Clickable Open, Today, Overdue, Blocked, and Done cards
- Date filters for due, start, assigned, blocked, completed, created, updated, and status-changed dates
- Priority, type, sprint, owner, due date, labels, notes, and progress fields
- Explanatory activity history with field-level changes
- Sheet-confirmed CRUD sync through the included Apps Script API on every create, edit, move, and delete
- Automatic Sheet refresh every 30 seconds while the app is open and connected

## Daily Workflow

1. Open OfficeFlow and click `Load Sheet` if you want the latest Google Sheet records.
2. Add a task with `New task`, set the owner, priority, type, due date, sprint, labels, notes, and progress. Labels are comma-separated tags, such as `finance`, `approval`, or `client-a`, used to group and search related tasks.
3. Work from the `Board`, `List`, or `Focus` view.
4. Move tasks between `Backlog`, `Today`, `In Progress`, `Blocked`, and `Done`.
5. Use the clickable summary cards and date filters to review open, due today, overdue, blocked, completed, assigned, or recently changed tasks.
6. Every create, edit, move, and delete is sent to Apps Script immediately when the Apps Script URL and token are configured. The UI shows `Syncing`, confirms the Sheet response, and restores the previous task if the Sheet write fails.

## Google Sheet

Storage Sheet:
https://docs.google.com/spreadsheets/d/1aju4zHHcERO3jJeUjyKbqLh3reqak-ikdAU9ZHqjZk4

Recommended app URL for daily use:
https://officeflow-task-hub.rakesh-collegedunia.chatgpt.site

Data storage:

- Browser `localStorage`: keeps your local preferences and cached task board on the device. This is what the app calls local-only mode when Sheet sync is not connected.
- Google Sheet `Tasks` tab: the permanent task database.
- Google Sheet `Activity` tab: the permanent activity/audit trail.
- Apps Script property `APP_TOKEN`: the private token used to protect write access.

Local-only mode means the app is usable in your browser, but changes are saved only on that device until you connect the Apps Script Web App URL and token. To make the Google Sheet the permanent database, configure Settings and click `Load Sheet`. Once connected, the app also checks the Sheet every 30 seconds while the browser tab is visible.

Tabs:

- `Tasks`: task records, including assigned/blocked/completed/status-change tracking timestamps
- `Activity`: audit trail for creates, edits, assignments, moves, and deletes
- `Lists`
- `Summary`

## Apps Script Setup

1. Open the Storage Sheet.
2. Go to Extensions -> Apps Script.
3. Paste `apps-script/Code.gs` into the Apps Script editor. If you already deployed an earlier version, replace the old code and redeploy the web app.
4. Open Project Settings and add a Script Property:
   - Property: `APP_TOKEN`
   - Value: use the token generated inside the app Settings panel
5. Click Deploy -> New deployment -> Web app.
6. Set:
   - Execute as: Me
   - Who has access: Anyone with the link
7. Copy the Web app URL.
8. In OfficeFlow, open Settings, paste the Web app URL ending in `/exec` and the same token, then click Load Sheet.

## Troubleshooting

If you see `Unexpected token '<'`, the app received an HTML page instead of the JSON data it expects. This usually means the Apps Script URL field contains the Google Sheet URL, GitHub Pages URL, localhost URL, or an Apps Script editor URL. Use only the deployed Apps Script Web App URL ending in `/exec`.

If you see `Failed to fetch`, `Could not load the Apps Script Web App`, or `Apps Script did not respond`, use the hosted OfficeFlow URL above. It has a same-origin `/api/sheet` proxy that talks to Apps Script from the server side, avoiding browser extension and CORS blocks. GitHub Pages remains available as a static fallback.

## Local Development

```bash
npm install
npm run dev
```

The dev server prints a local URL such as `http://localhost:3000/`.

## Build

```bash
npm run build
```

This project uses the Vinext/Sites starter, so it is best deployed from a GitHub repo into a Cloudflare-compatible worker hosting target. Keep the Apps Script token out of the repository; it is stored locally in the browser and in Apps Script properties.

## GitHub Pages

The repository includes a GitHub Actions workflow at `.github/workflows/pages.yml`.
When GitHub Pages is enabled for the repository, every push to `main` deploys a small redirect page to GitHub Pages.
GitHub Pages may require the repository to be public, depending on the GitHub plan.
The GitHub Pages URL redirects to the worker-backed OfficeFlow app because Sheet sync needs the `/api/sheet` server proxy.

For local verification of the GitHub Pages build:

```bash
npm run build:pages
```

Use the worker-backed OfficeFlow URL for daily work:
https://officeflow-task-hub.rakesh-collegedunia.chatgpt.site

## Files To Know

- `app/page.tsx`: main tracker app
- `app/globals.css`: interface styling
- `apps-script/Code.gs`: Google Sheets backend
- `.github/workflows/pages.yml`: GitHub Pages deployment
- `README.md`: setup notes
