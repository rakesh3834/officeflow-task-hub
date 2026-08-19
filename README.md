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
- Google Sheet sync through the included Apps Script API on every create, edit, move, and delete

## Daily Workflow

1. Open OfficeFlow and click `Load Sheet` if you want the latest Google Sheet records.
2. Add a task with `New task`, set the owner, priority, type, due date, sprint, labels, notes, and progress.
3. Work from the `Board`, `List`, or `Focus` view.
4. Move tasks between `Backlog`, `Today`, `In Progress`, `Blocked`, and `Done`.
5. Use the clickable summary cards and date filters to review open, due today, overdue, blocked, completed, assigned, or recently changed tasks.
6. Every create, edit, move, and delete is written to the Sheet when the Apps Script URL and token are configured.

## Google Sheet

Storage Sheet:
https://docs.google.com/spreadsheets/d/1aju4zHHcERO3jJeUjyKbqLh3reqak-ikdAU9ZHqjZk4

Data storage:

- Browser `localStorage`: keeps your local preferences and cached task board on the device.
- Google Sheet `Tasks` tab: the permanent task database.
- Google Sheet `Activity` tab: the permanent activity/audit trail.
- Apps Script property `APP_TOKEN`: the private token used to protect write access.

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
8. In OfficeFlow, open Settings, paste the Web app URL and the same token, then click Load Sheet.

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
On every push to `main`, GitHub builds the static app and deploys it to GitHub Pages.

For local verification of the GitHub Pages build:

```bash
npm run build:pages
```

The deployed app still saves task data to Google Sheets through the Apps Script URL configured in Settings.

## Files To Know

- `app/page.tsx`: main tracker app
- `app/globals.css`: interface styling
- `apps-script/Code.gs`: Google Sheets backend
- `.github/workflows/pages.yml`: GitHub Pages deployment
- `README.md`: setup notes
