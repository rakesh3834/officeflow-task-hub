/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

type Task = {
  id: string;
  key: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  type: string;
  owner: string;
  labels: string[];
  dueDate: string;
  startDate: string;
  estimate: number;
  progress: number;
  sprint: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string;
  assignedAt: string;
  blockedAt: string;
  statusChangedAt: string;
  notes: string;
};

type Activity = {
  timestamp: string;
  taskId: string;
  key: string;
  action: string;
  field: string;
  oldValue: string;
  newValue: string;
  actor: string;
};

type TaskRow = {
  id: string;
  key: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  type: string | null;
  owner: string | null;
  labels: string[] | null;
  due_date: string | null;
  start_date: string | null;
  estimate: number | null;
  progress: number | null;
  sprint: string | null;
  created_at: string | null;
  updated_at: string | null;
  completed_at: string | null;
  assigned_at: string | null;
  blocked_at: string | null;
  status_changed_at: string | null;
  notes: string | null;
};

type ActivityRow = {
  timestamp: string | null;
  task_id: string | null;
  key: string | null;
  action: string | null;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  actor: string | null;
};

type TaskApiBody = {
  action?: string;
  task?: Task;
  activities?: Activity[] | Activity;
  activity?: Activity[] | Activity;
  id?: string;
};

type SupabaseError = {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
};

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/tasks") {
      return handleTasksApi(request, env);
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;

async function handleTasksApi(request: Request, env: Env): Promise<Response> {
  if (request.method === "OPTIONS") return jsonResponse({ ok: true });

  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse({ ok: false, error: "Supabase environment variables are not configured." }, 500);
  }

  try {
    if (request.method === "GET") return jsonResponse({ ok: true, data: await listData(env) });
    if (request.method !== "POST") return jsonResponse({ ok: false, error: "Use POST for task changes." }, 405);

    const body = (await request.json()) as TaskApiBody;
    switch (body.action) {
      case "list":
        return jsonResponse({ ok: true, data: await listData(env) });
      case "saveTask":
        return jsonResponse({ ok: true, data: await saveTask(env, body.task, body.activities || body.activity) });
      case "deleteTask":
        return jsonResponse({ ok: true, data: await deleteTask(env, body.id, body.activities || body.activity) });
      default:
        return jsonResponse({ ok: false, error: "Unknown task action." }, 400);
    }
  } catch (error) {
    return jsonResponse({ ok: false, error: error instanceof Error ? error.message : "Supabase request failed." }, 502);
  }
}

async function listData(env: Env) {
  const [taskRows, activityRows] = await Promise.all([
    supabaseRequest<TaskRow[]>(env, "tasks?select=*&order=updated_at.desc"),
    supabaseRequest<ActivityRow[]>(env, "activity?select=*&order=timestamp.desc&limit=80"),
  ]);
  return {
    tasks: taskRows.map(rowToTask),
    activity: activityRows.map(rowToActivity),
  };
}

async function saveTask(env: Env, task: Task | undefined, activity: TaskApiBody["activity"]) {
  if (!task?.id || !task.title) throw new Error("Task title is required.");
  const rows = await supabaseRequest<TaskRow[]>(env, "tasks?on_conflict=id", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify([taskToRow(task)]),
  });
  await appendActivities(env, activity);
  return { task: rowToTask(rows[0]) };
}

async function deleteTask(env: Env, id: string | undefined, activity: TaskApiBody["activity"]) {
  if (!id) throw new Error("Task id is required.");
  const rows = await supabaseRequest<TaskRow[]>(env, `tasks?id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Prefer: "return=representation" },
  });
  await appendActivities(env, activity);
  return { deleted: rows.length > 0 };
}

async function appendActivities(env: Env, activity: TaskApiBody["activity"]) {
  if (!activity) return;
  const items = Array.isArray(activity) ? activity : [activity];
  if (!items.length) return;
  await supabaseRequest(env, "activity", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(items.map(activityToRow)),
  });
}

async function supabaseRequest<T>(env: Env, path: string, init: RequestInit = {}): Promise<T> {
  const baseUrl = String(env.SUPABASE_URL || "").replace(/\/$/, "");
  const key = String(env.SUPABASE_SERVICE_ROLE_KEY || "");
  const response = await fetch(`${baseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(readableSupabaseError(text));
  if (!text) return null as T;
  return JSON.parse(text) as T;
}

function readableSupabaseError(text: string) {
  let message = text || "Supabase request failed.";
  try {
    const parsed = JSON.parse(text) as SupabaseError;
    message = parsed.message || parsed.details || parsed.hint || message;
  } catch {
    // Keep the raw response text.
  }
  if (/relation .* does not exist|Could not find the table|schema cache/i.test(message)) {
    return "Supabase tables are missing. Run the SQL setup for tasks and activity.";
  }
  return message;
}

function rowToTask(row: TaskRow): Task {
  return {
    id: row.id || "",
    key: row.key || "",
    title: row.title || "",
    description: row.description || "",
    status: row.status || "Backlog",
    priority: row.priority || "Medium",
    type: row.type || "Task",
    owner: row.owner || "",
    labels: row.labels || [],
    dueDate: row.due_date || "",
    startDate: row.start_date || "",
    estimate: Number(row.estimate || 0),
    progress: Number(row.progress || 0),
    sprint: row.sprint || "",
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || "",
    completedAt: row.completed_at || "",
    assignedAt: row.assigned_at || "",
    blockedAt: row.blocked_at || "",
    statusChangedAt: row.status_changed_at || "",
    notes: row.notes || "",
  };
}

function taskToRow(task: Task): TaskRow {
  return {
    id: task.id,
    key: task.key,
    title: task.title,
    description: task.description || null,
    status: task.status,
    priority: task.priority,
    type: task.type || null,
    owner: task.owner || null,
    labels: task.labels || [],
    due_date: task.dueDate || null,
    start_date: task.startDate || null,
    estimate: Number(task.estimate || 0),
    progress: Number(task.progress || 0),
    sprint: task.sprint || null,
    created_at: task.createdAt || new Date().toISOString(),
    updated_at: task.updatedAt || new Date().toISOString(),
    completed_at: task.completedAt || null,
    assigned_at: task.assignedAt || null,
    blocked_at: task.blockedAt || null,
    status_changed_at: task.statusChangedAt || null,
    notes: task.notes || null,
  };
}

function rowToActivity(row: ActivityRow): Activity {
  return {
    timestamp: row.timestamp || "",
    taskId: row.task_id || "",
    key: row.key || "",
    action: row.action || "",
    field: row.field || "",
    oldValue: row.old_value || "",
    newValue: row.new_value || "",
    actor: row.actor || "",
  };
}

function activityToRow(activity: Activity): ActivityRow {
  return {
    timestamp: activity.timestamp || new Date().toISOString(),
    task_id: activity.taskId || null,
    key: activity.key || null,
    action: activity.action || null,
    field: activity.field || null,
    old_value: activity.oldValue || null,
    new_value: activity.newValue || null,
    actor: activity.actor || null,
  };
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
