# OfficeFlow Task Hub

A Jira-style daily office task tracker backed by Supabase.

The app gives you:

- Board, list, and daily focus views
- Task create/edit/delete
- Drag-to-move status columns
- Clickable Open, Today, Overdue, Blocked, and Done cards
- Date filters for due, start, assigned, blocked, completed, created, updated, and status-changed dates
- Priority, type, sprint, owner, due date, labels, notes, and progress fields
- Explanatory activity history with field-level changes
- Supabase-confirmed CRUD sync on every create, edit, move, and delete
- Automatic Supabase refresh every 30 seconds while the app is open

## Daily Workflow

1. Open OfficeFlow. The app loads tasks from Supabase automatically.
2. Add a task with `New task`, set the owner, priority, type, due date, sprint, labels, notes, and progress. Labels are comma-separated tags, such as `finance`, `approval`, or `client-a`, used to group and search related tasks.
3. Work from the `Board`, `List`, or `Focus` view.
4. Move tasks between `Backlog`, `Today`, `In Progress`, `Blocked`, and `Done`.
5. Use the clickable summary cards and date filters to review open, due today, overdue, blocked, completed, assigned, or recently changed tasks.
6. Every create, edit, move, and delete is sent to Supabase immediately. The UI shows `Saving`, confirms the Supabase response, and restores the previous task if the write fails.

## Supabase Storage

Recommended app URL for daily use:
https://officeflow-task-hub.rakesh-collegedunia.chatgpt.site

Data storage:

- Supabase `tasks` table: the permanent task database.
- Supabase `activity` table: the permanent activity/audit trail.
- Browser `localStorage`: only a local cache and preferences for faster display.

The Supabase service key is stored only as a hosted backend environment secret. It is not committed to GitHub and is not sent to the browser.

## Supabase SQL Setup

Run this once in Supabase SQL Editor:

```sql
create table if not exists tasks (
  id text primary key,
  key text unique,
  title text not null,
  description text,
  status text not null default 'Backlog',
  priority text not null default 'Medium',
  type text default 'Task',
  owner text,
  labels text[] default '{}',
  due_date date,
  start_date date,
  estimate numeric default 0,
  progress int default 0,
  sprint text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  completed_at timestamptz,
  assigned_at timestamptz,
  blocked_at timestamptz,
  status_changed_at timestamptz,
  notes text
);

create table if not exists activity (
  id bigint generated always as identity primary key,
  timestamp timestamptz default now(),
  task_id text,
  key text,
  action text,
  field text,
  old_value text,
  new_value text,
  actor text
);
```

## Environment Variables

Hosted runtime variables:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

Keep these in the hosting environment only. Do not put the service key in frontend code, GitHub, or browser settings.

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

This project uses the Vinext/Sites starter and should be deployed to the worker-backed hosting target so `/api/tasks` can securely call Supabase from the backend.

## GitHub Pages

The repository includes a GitHub Actions workflow at `.github/workflows/pages.yml`.
When GitHub Pages is enabled for the repository, every push to `main` deploys a small redirect page to GitHub Pages.
The GitHub Pages URL redirects to the worker-backed OfficeFlow app because Supabase writes need the `/api/tasks` backend.

For local verification of the GitHub Pages build:

```bash
npm run build:pages
```

Use the worker-backed OfficeFlow URL for daily work:
https://officeflow-task-hub.rakesh-collegedunia.chatgpt.site

## Files To Know

- `app/page.tsx`: main tracker app
- `app/globals.css`: interface styling
- `worker/index.ts`: Supabase backend API
- `.github/workflows/pages.yml`: GitHub Pages deployment
- `README.md`: setup notes
