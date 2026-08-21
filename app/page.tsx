"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  CircleDot,
  Cloud,
  CloudOff,
  Columns3,
  ExternalLink,
  FileSpreadsheet,
  GripVertical,
  Kanban,
  ListChecks,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings2,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";

type Status = "Backlog" | "Today" | "In Progress" | "Blocked" | "Done";
type Priority = "Urgent" | "High" | "Medium" | "Low";
type TaskType = "Task" | "Issue" | "Follow-up" | "Report" | "Meeting" | "Idea";
type ViewMode = "board" | "list" | "focus";
type QuickFilter = "all" | "open" | "today" | "overdue" | "blocked" | "done";
type DateField =
  | "dueDate"
  | "startDate"
  | "assignedAt"
  | "blockedAt"
  | "completedAt"
  | "createdAt"
  | "updatedAt"
  | "statusChangedAt";

type Task = {
  id: string;
  key: string;
  title: string;
  description: string;
  status: Status;
  priority: Priority;
  type: TaskType;
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

type Settings = {
  scriptUrl: string;
  token: string;
  actor: string;
  sheetUrl: string;
};

const STATUSES: Status[] = ["Backlog", "Today", "In Progress", "Blocked", "Done"];
const PRIORITIES: Priority[] = ["Urgent", "High", "Medium", "Low"];
const TYPES: TaskType[] = ["Task", "Issue", "Follow-up", "Report", "Meeting", "Idea"];
const SPRINTS = ["This Week", "Next Week", "Later"];
const DATE_FILTERS: Array<{ label: string; value: DateField }> = [
  { label: "Due date", value: "dueDate" },
  { label: "Start date", value: "startDate" },
  { label: "Assigned at", value: "assignedAt" },
  { label: "Blocked at", value: "blockedAt" },
  { label: "Completed at", value: "completedAt" },
  { label: "Created at", value: "createdAt" },
  { label: "Updated at", value: "updatedAt" },
  { label: "Status changed", value: "statusChangedAt" },
];
const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1aju4zHHcERO3jJeUjyKbqLh3reqak-ikdAU9ZHqjZk4";
const TASKS_KEY = "officeflow.tasks";
const ACTIVITY_KEY = "officeflow.activity";
const SETTINGS_KEY = "officeflow.settings";
const OFFICE_LOCALE = "en-GB";
const OFFICE_TIME_ZONE = "Asia/Kolkata";
const APPS_SCRIPT_URL_PATTERN = /^https:\/\/script\.google\.com\/macros\/s\/.+\/exec(?:\?.*)?$/i;
const DATE_KEY_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  timeZone: OFFICE_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const DATE_FORMATTER = new Intl.DateTimeFormat(OFFICE_LOCALE, {
  timeZone: OFFICE_TIME_ZONE,
  month: "short",
  day: "numeric",
});
const DATE_TIME_FORMATTER = new Intl.DateTimeFormat(OFFICE_LOCALE, {
  timeZone: OFFICE_TIME_ZONE,
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const TIME_FORMATTER = new Intl.DateTimeFormat(OFFICE_LOCALE, {
  timeZone: OFFICE_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const DEFAULT_SETTINGS: Settings = {
  scriptUrl: "",
  token: "",
  actor: "Rakesh",
  sheetUrl: SHEET_URL,
};

function dateKeyFromDate(date: Date) {
  const parts = DATE_KEY_FORMATTER.formatToParts(date).reduce<Record<string, string>>((result, part) => {
    result[part.type] = part.value;
    return result;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

const todayKey = () => dateKeyFromDate(new Date());
const nowIso = () => new Date().toISOString();

function isAppsScriptUrl(value: string) {
  return APPS_SCRIPT_URL_PATTERN.test(value.trim());
}

function canSyncToSheet(settings: Settings) {
  return isAppsScriptUrl(settings.scriptUrl) && Boolean(settings.token.trim());
}

function localSyncMessage(settings: Settings) {
  if (!isAppsScriptUrl(settings.scriptUrl)) return "Local only - add Apps Script URL";
  if (!settings.token.trim()) return "Local only - add app token";
  return "Local only - Sheet sync not connected";
}

function shiftDate(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return dateKeyFromDate(date);
}

function seedDateTime(days = 0, time = "09:00:00") {
  return `${shiftDate(days)}T${time}+05:30`;
}

const emptyTask = (): Task => ({
  id: "",
  key: "",
  title: "",
  description: "",
  status: "Today",
  priority: "Medium",
  type: "Task",
  owner: "Rakesh",
  labels: [],
  dueDate: todayKey(),
  startDate: todayKey(),
  estimate: 1,
  progress: 0,
  sprint: "This Week",
  createdAt: nowIso(),
  updatedAt: nowIso(),
  completedAt: "",
  assignedAt: nowIso(),
  blockedAt: "",
  statusChangedAt: nowIso(),
  notes: "",
});

const seedTasks: Task[] = [
  {
    ...emptyTask(),
    id: "task_1001",
    key: "OFF-1",
    title: "Plan today's priority work",
    description: "Review meetings, deadlines, and urgent requests before starting execution.",
    status: "Today",
    priority: "High",
    type: "Task",
    labels: ["planning", "daily"],
    progress: 20,
    notes: "Seed row. Edit or delete from the app.",
    createdAt: seedDateTime(0),
    updatedAt: seedDateTime(0),
    assignedAt: seedDateTime(0),
    statusChangedAt: seedDateTime(0),
  },
  {
    ...emptyTask(),
    id: "task_1002",
    key: "OFF-2",
    title: "Follow up on pending approvals",
    description: "Collect updates from stakeholders and move blocked items forward.",
    status: "In Progress",
    priority: "Medium",
    type: "Follow-up",
    labels: ["office", "approval"],
    dueDate: shiftDate(1),
    estimate: 2,
    progress: 45,
    createdAt: seedDateTime(0),
    updatedAt: seedDateTime(0),
    assignedAt: seedDateTime(0),
    statusChangedAt: seedDateTime(0),
  },
  {
    ...emptyTask(),
    id: "task_1003",
    key: "OFF-3",
    title: "Prepare weekly status summary",
    description: "Write a short update covering completed work, risks, and next actions.",
    status: "Backlog",
    priority: "Medium",
    type: "Report",
    labels: ["weekly", "status"],
    dueDate: shiftDate(3),
    startDate: shiftDate(2),
    estimate: 3,
    createdAt: seedDateTime(0),
    updatedAt: seedDateTime(0),
    assignedAt: seedDateTime(0),
    statusChangedAt: seedDateTime(0),
  },
  {
    ...emptyTask(),
    id: "task_1004",
    key: "OFF-4",
    title: "Resolve vendor invoice query",
    description: "Check invoice details, clarify mismatch, and update finance once resolved.",
    status: "Blocked",
    priority: "Urgent",
    type: "Issue",
    labels: ["finance", "vendor"],
    dueDate: shiftDate(-1),
    startDate: shiftDate(-3),
    estimate: 2,
    progress: 35,
    createdAt: seedDateTime(-3),
    updatedAt: seedDateTime(-1, "10:30:00"),
    assignedAt: seedDateTime(-3),
    blockedAt: seedDateTime(-1, "10:30:00"),
    statusChangedAt: seedDateTime(-1, "10:30:00"),
    notes: "Waiting on vendor confirmation.",
  },
  {
    ...emptyTask(),
    id: "task_1005",
    key: "OFF-5",
    title: "Archive completed desk tasks",
    description: "Move closed office admin items into monthly archive notes.",
    status: "Done",
    priority: "Low",
    labels: ["admin"],
    dueDate: shiftDate(-2),
    startDate: shiftDate(-2),
    createdAt: seedDateTime(-2),
    updatedAt: seedDateTime(-1, "17:00:00"),
    assignedAt: seedDateTime(-2),
    completedAt: seedDateTime(-1, "17:00:00"),
    statusChangedAt: seedDateTime(-1, "17:00:00"),
    progress: 100,
  },
];

const seedActivity: Activity[] = [
  {
    timestamp: seedDateTime(0, "09:05:00"),
    taskId: "task_1001",
    key: "OFF-1",
    action: "Created",
    field: "Status",
    oldValue: "",
    newValue: "Today",
    actor: "Rakesh",
  },
];

function loadJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function normalizeTask(task: Partial<Task>): Task {
  const base = emptyTask();
  const rawLabels = (task as { labels?: string[] | string }).labels;
  const labels =
    Array.isArray(rawLabels)
      ? rawLabels
      : typeof rawLabels === "string"
        ? rawLabels
            .split(",")
            .map((item: string) => item.trim())
            .filter(Boolean)
        : [];
  return {
    ...base,
    ...task,
    id: task.id || crypto.randomUUID(),
    key: task.key || "OFF-new",
    title: task.title || "Untitled task",
    labels,
    estimate: Number(task.estimate ?? 0),
    progress: Math.max(0, Math.min(100, Number(task.progress ?? 0))),
    status: STATUSES.includes(task.status as Status) ? (task.status as Status) : "Backlog",
    priority: PRIORITIES.includes(task.priority as Priority) ? (task.priority as Priority) : "Medium",
    type: TYPES.includes(task.type as TaskType) ? (task.type as TaskType) : "Task",
    assignedAt: task.assignedAt || task.createdAt || base.assignedAt,
    blockedAt: task.blockedAt || (task.status === "Blocked" ? task.updatedAt || base.updatedAt : ""),
    completedAt: task.status === "Done" ? task.completedAt || task.updatedAt || base.updatedAt : task.completedAt || "",
    statusChangedAt: task.statusChangedAt || task.updatedAt || base.statusChangedAt,
  };
}

function isOverdue(task: Task) {
  if (!task.dueDate || task.status === "Done") return false;
  return task.dueDate < todayKey();
}

function isDueToday(task: Task) {
  return task.dueDate === todayKey() && task.status !== "Done";
}

function priorityRank(priority: Priority) {
  return { Urgent: 0, High: 1, Medium: 2, Low: 3 }[priority];
}

function formatDate(value: string) {
  if (!value) return "No date";
  const date = parseDisplayDate(value);
  if (Number.isNaN(date.getTime())) return value;
  return DATE_FORMATTER.format(date);
}

function formatDateTime(value: string) {
  if (!value) return "Not tracked yet";
  const date = parseDisplayDate(value);
  if (Number.isNaN(date.getTime())) return value;
  return DATE_TIME_FORMATTER.format(date);
}

function parseDisplayDate(value: string) {
  return new Date(value.length === 10 ? `${value}T00:00:00+05:30` : value);
}

function toDateKey(value: string) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : dateKeyFromDate(date);
}

function matchesDateRange(task: Task, field: DateField, from: string, to: string) {
  if (!from && !to) return true;
  const value = toDateKey(task[field]);
  if (!value) return false;
  if (from && value < from) return false;
  if (to && value > to) return false;
  return true;
}

function applyQuickFilter(task: Task, filter: QuickFilter) {
  switch (filter) {
    case "open":
      return task.status !== "Done";
    case "today":
      return isDueToday(task) || task.status === "Today";
    case "overdue":
      return isOverdue(task);
    case "blocked":
      return task.status === "Blocked";
    case "done":
      return task.status === "Done";
    default:
      return true;
  }
}

function stampTaskWorkflow(task: Task, previous?: Task) {
  const now = nowIso();
  const statusChanged = previous ? previous.status !== task.status : true;
  const ownerChanged = previous ? previous.owner !== task.owner : true;
  return normalizeTask({
    ...task,
    createdAt: previous?.createdAt || task.createdAt || now,
    updatedAt: now,
    assignedAt: ownerChanged ? now : previous?.assignedAt || task.assignedAt || now,
    blockedAt: task.status === "Blocked" && (!previous || previous.status !== "Blocked") ? now : previous?.blockedAt || task.blockedAt || "",
    completedAt: task.status === "Done" ? (previous?.status === "Done" ? previous.completedAt || task.completedAt || now : now) : "",
    statusChangedAt: statusChanged ? now : previous?.statusChangedAt || task.statusChangedAt || now,
  });
}

function buildActivityEntries(previous: Task | undefined, task: Task, action: "create" | "update", actor: string): Activity[] {
  const timestamp = nowIso();
  if (!previous || action === "create") {
    return [{ timestamp, taskId: task.id, key: task.key, action: "Created", field: "Task", oldValue: "", newValue: task.status, actor }];
  }

  const changes: Activity[] = [];
  const push = (entryAction: string, field: string, oldValue: string, newValue: string) => {
    changes.push({ timestamp, taskId: task.id, key: task.key, action: entryAction, field, oldValue, newValue, actor });
  };

  if (previous.status !== task.status) push("Status changed", "Status", previous.status, task.status);
  if (previous.owner !== task.owner) push("Assigned", "Owner", previous.owner || "Unassigned", task.owner || "Unassigned");
  if (previous.priority !== task.priority) push("Priority changed", "Priority", previous.priority, task.priority);
  if (previous.dueDate !== task.dueDate) push("Due date changed", "Due Date", previous.dueDate || "No date", task.dueDate || "No date");
  if (previous.progress !== task.progress) push("Progress updated", "Progress", `${previous.progress}%`, `${task.progress}%`);

  if (!changes.length) push("Updated", "Task", previous.updatedAt || "", task.updatedAt);
  return changes;
}

function describeActivity(item: Activity) {
  const actor = item.actor || "Someone";
  const key = item.key || "a task";
  if (item.action === "Created") return `${actor} created ${key} and placed it in ${item.newValue || "the board"}.`;
  if (item.action === "Deleted") return `${actor} deleted ${key}${item.oldValue ? ` (${item.oldValue})` : ""}.`;
  if (item.field === "Status") return `${actor} moved ${key} from ${item.oldValue || "none"} to ${item.newValue || "none"}.`;
  if (item.field === "Owner") return `${actor} reassigned ${key} from ${item.oldValue || "unassigned"} to ${item.newValue || "unassigned"}.`;
  if (item.field === "Due Date") return `${actor} changed ${key}'s due date from ${formatDate(item.oldValue)} to ${formatDate(item.newValue)}.`;
  if (item.field === "Progress") return `${actor} updated ${key}'s progress from ${item.oldValue} to ${item.newValue}.`;
  if (item.field === "Priority") return `${actor} changed ${key}'s priority from ${item.oldValue} to ${item.newValue}.`;
  return `${actor} updated ${key}.`;
}

function nextKey(tasks: Task[]) {
  const max = tasks.reduce((highest, task) => {
    const match = task.key.match(/OFF-(\d+)/i);
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0);
  return `OFF-${max + 1}`;
}

function upsertTask(tasks: Task[], task: Task) {
  const exists = tasks.some((item) => item.id === task.id);
  return exists ? tasks.map((item) => (item.id === task.id ? task : item)) : [task, ...tasks];
}

function activitySignature(item: Activity) {
  return [item.timestamp, item.taskId, item.action, item.field, item.oldValue, item.newValue].join("|");
}

function removeActivityEntries(activity: Activity[], entries: Activity[]) {
  const signatures = new Set(entries.map(activitySignature));
  return activity.filter((item) => !signatures.has(activitySignature(item)));
}

type SheetResponse<T> = {
  ok?: boolean;
  error?: string;
  data?: T;
};

type SheetMessage<T> = {
  source?: string;
  requestId?: string;
  result?: SheetResponse<T>;
};

async function sheetRequest<T>(
  settings: Settings,
  action: string,
  payload: Record<string, unknown> = {},
): Promise<T> {
  const scriptUrl = settings.scriptUrl.trim();
  if (!scriptUrl) {
    throw new Error("Apps Script URL is missing.");
  }
  if (!isAppsScriptUrl(scriptUrl)) {
    throw new Error("Paste the Apps Script Web App URL ending in /exec. The Sheet URL, GitHub Pages URL, and localhost URL cannot sync data.");
  }
  const token = settings.token.trim();
  if (!token) {
    throw new Error("App token is missing. Add the same token in OfficeFlow Settings and Apps Script APP_TOKEN.");
  }
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("Sheet sync runs in the browser.");
  }

  const url = buildSheetRequestUrl(scriptUrl, token, settings.actor || "User", action, payload);
  let result: SheetResponse<T>;
  try {
    result = await requestSheetViaJsonp<T>(url);
  } catch {
    result = await requestSheetViaFrame<T>(url);
  }
  if (!result?.ok) {
    throw new Error(result?.error || "Sheet request failed.");
  }
  return result.data as T;
}

function buildSheetRequestUrl(
  scriptUrl: string,
  token: string,
  actor: string,
  action: string,
  payload: Record<string, unknown>,
) {
  const url = new URL(scriptUrl);
  url.searchParams.set("action", action);
  url.searchParams.set("token", token);
  url.searchParams.set("actor", actor);
  if (Object.keys(payload).length) {
    url.searchParams.set("payload", JSON.stringify(payload));
  }
  return url;
}

function requestSheetViaJsonp<T>(baseUrl: URL) {
  return new Promise<SheetResponse<T>>((resolve, reject) => {
    const callbackName = `__officeflowSheet_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const callbacks = window as Window & Record<string, (result: SheetResponse<T>) => void>;
    const script = document.createElement("script");
    const timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error("Apps Script did not respond. Confirm the Web App URL ends in /exec, the deployment access is Anyone, and the latest Code.gs is redeployed."));
    }, 15000);

    function cleanup() {
      window.clearTimeout(timeoutId);
      delete callbacks[callbackName];
      script.remove();
    }

    callbacks[callbackName] = (result) => {
      cleanup();
      resolve(result);
    };

    const url = new URL(baseUrl);
    url.searchParams.set("callback", callbackName);

    script.onerror = () => {
      cleanup();
      reject(new Error("Could not load the Apps Script Web App. Paste the deployed /exec URL and redeploy Apps Script as Anyone with the link."));
    };
    script.async = true;
    script.src = url.toString();
    document.body.appendChild(script);
  });
}

function requestSheetViaFrame<T>(baseUrl: URL) {
  return new Promise<SheetResponse<T>>((resolve, reject) => {
    const requestId = `officeflowFrame_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const frame = document.createElement("iframe");
    const timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error("Apps Script did not respond. Confirm the /exec URL, deployment access, and APP_TOKEN."));
    }, 15000);

    function cleanup() {
      window.clearTimeout(timeoutId);
      window.removeEventListener("message", handleMessage);
      frame.remove();
    }

    function handleMessage(event: MessageEvent<SheetMessage<T>>) {
      const message = event.data;
      if (message?.source !== "officeflow-sheet" || message.requestId !== requestId) return;
      cleanup();
      resolve(message.result || { ok: false, error: "Apps Script returned an empty response." });
    }

    const url = new URL(baseUrl);
    url.searchParams.set("transport", "frame");
    url.searchParams.set("requestId", requestId);

    frame.hidden = true;
    frame.title = "OfficeFlow Sheet sync";
    window.addEventListener("message", handleMessage);
    frame.src = url.toString();
    document.body.appendChild(frame);
  });
}

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>(() => seedTasks.map(normalizeTask));
  const [activity, setActivity] = useState<Activity[]>(seedActivity);
  const [settings, setSettings] = useState<Settings>(() => ({ ...DEFAULT_SETTINGS }));
  const [storageReady, setStorageReady] = useState(false);
  const [view, setView] = useState<ViewMode>("board");
  const [query, setQuery] = useState("");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [statusFilter, setStatusFilter] = useState<Status | "All">("All");
  const [priorityFilter, setPriorityFilter] = useState<Priority | "All">("All");
  const [dateField, setDateField] = useState<DateField>("dueDate");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [syncState, setSyncState] = useState<"local" | "syncing" | "synced" | "error">("local");
  const [syncMessage, setSyncMessage] = useState("Local only - Sheet sync not connected");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [pendingTaskIds, setPendingTaskIds] = useState<string[]>([]);

  useEffect(() => {
    let mounted = true;
    queueMicrotask(() => {
      if (!mounted) return;
      setTasks(loadJson(TASKS_KEY, seedTasks).map(normalizeTask));
      setActivity(loadJson(ACTIVITY_KEY, seedActivity));
      setSettings(loadJson(SETTINGS_KEY, DEFAULT_SETTINGS));
      setStorageReady(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (storageReady) saveJson(TASKS_KEY, tasks);
  }, [storageReady, tasks]);

  useEffect(() => {
    if (storageReady) saveJson(ACTIVITY_KEY, activity);
  }, [activity, storageReady]);

  useEffect(() => {
    if (storageReady) saveJson(SETTINGS_KEY, settings);
  }, [settings, storageReady]);

  const filteredTasks = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return tasks
      .filter((task) => applyQuickFilter(task, quickFilter))
      .filter((task) => (statusFilter === "All" ? true : task.status === statusFilter))
      .filter((task) => (priorityFilter === "All" ? true : task.priority === priorityFilter))
      .filter((task) => matchesDateRange(task, dateField, dateFrom, dateTo))
      .filter((task) => {
        if (!needle) return true;
        return [
          task.key,
          task.title,
          task.description,
          task.owner,
          task.type,
          task.sprint,
          task.notes,
          task.labels.join(" "),
        ]
          .join(" ")
          .toLowerCase()
          .includes(needle);
      })
      .sort((a, b) => {
        if (a.status === "Done" && b.status !== "Done") return 1;
        if (a.status !== "Done" && b.status === "Done") return -1;
        if (isOverdue(a) !== isOverdue(b)) return isOverdue(a) ? -1 : 1;
        return priorityRank(a.priority) - priorityRank(b.priority);
      });
  }, [dateField, dateFrom, dateTo, priorityFilter, query, quickFilter, statusFilter, tasks]);

  const metrics = useMemo(() => {
    const open = tasks.filter((task) => task.status !== "Done").length;
    return {
      open,
      today: tasks.filter(isDueToday).length,
      overdue: tasks.filter(isOverdue).length,
      blocked: tasks.filter((task) => task.status === "Blocked").length,
      done: tasks.filter((task) => task.status === "Done").length,
    };
  }, [tasks]);

  const syncEnabled = canSyncToSheet(settings);
  const pendingTaskIdSet = useMemo(() => new Set(pendingTaskIds), [pendingTaskIds]);
  const hasPendingWrites = pendingTaskIds.length > 0;
  const currentLocalSyncMessage = useMemo(() => localSyncMessage(settings), [settings]);
  const visibleSyncState = syncEnabled ? syncState : "local";
  const visibleSyncMessage = syncEnabled ? syncMessage : currentLocalSyncMessage;

  const markTaskPending = useCallback((taskId: string, pending: boolean) => {
    setPendingTaskIds((current) => {
      if (pending) return current.includes(taskId) ? current : [...current, taskId];
      return current.filter((id) => id !== taskId);
    });
  }, []);

  const loadFromSheet = useCallback(
    async (options: { silent?: boolean } = {}) => {
      if (!syncEnabled) {
        setSyncState("local");
        setSyncMessage(currentLocalSyncMessage);
        return;
      }
      if (!options.silent) {
        setSyncState("syncing");
        setSyncMessage("Syncing from Sheet");
      }
      try {
        const data = await sheetRequest<{ tasks?: Task[]; activity?: Activity[] }>(settings, "list");
        setTasks((data.tasks || []).map(normalizeTask));
        setActivity(data.activity || []);
        setSyncState("synced");
        setSyncMessage(`${options.silent ? "Auto-synced" : "Synced"} ${TIME_FORMATTER.format(new Date())}`);
      } catch (error) {
        setSyncState("error");
        setSyncMessage(error instanceof Error ? error.message : "Sync failed");
      }
    },
    [currentLocalSyncMessage, settings, syncEnabled],
  );

  useEffect(() => {
    if (!storageReady || !syncEnabled || hasPendingWrites) return;
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadFromSheet({ silent: true });
    }, 30000);
    return () => window.clearInterval(intervalId);
  }, [hasPendingWrites, loadFromSheet, storageReady, syncEnabled]);

  function chooseQuickFilter(filter: QuickFilter) {
    setQuickFilter((current) => (current === filter ? "all" : filter));
    setStatusFilter("All");
  }

  function clearFilters() {
    setQuickFilter("all");
    setStatusFilter("All");
    setPriorityFilter("All");
    setDateField("dueDate");
    setDateFrom("");
    setDateTo("");
    setQuery("");
  }

  async function persistTask(task: Task, action: "create" | "update" = "update") {
    const previousTask = tasks.find((item) => item.id === task.id);
    const savedTask = stampTaskWorkflow(task, action === "create" ? undefined : previousTask);
    const entries = buildActivityEntries(action === "create" ? undefined : previousTask, savedTask, action, settings.actor || "User");
    setTasks((current) => upsertTask(current, savedTask));
    setActivity((current) => [...entries, ...current].slice(0, 80));

    if (!syncEnabled) {
      setSyncState("local");
      setSyncMessage(currentLocalSyncMessage);
      return;
    }

    markTaskPending(savedTask.id, true);
    setSyncState("syncing");
    setSyncMessage("Saving to Sheet");
    try {
      const data = await sheetRequest<{ task?: Task }>(settings, "saveTask", { task: savedTask, activities: entries });
      const confirmedTask = normalizeTask(data.task || savedTask);
      setTasks((current) => upsertTask(current, confirmedTask));
      setSyncState("synced");
      setSyncMessage(`Saved to Sheet ${TIME_FORMATTER.format(new Date())}`);
    } catch (error) {
      setTasks((current) => {
        if (previousTask) return current.map((item) => (item.id === savedTask.id ? previousTask : item));
        return current.filter((item) => item.id !== savedTask.id);
      });
      setActivity((current) => removeActivityEntries(current, entries));
      setSyncState("error");
      setSyncMessage(error instanceof Error ? error.message : "Save failed");
    } finally {
      markTaskPending(savedTask.id, false);
    }
  }

  async function moveTask(taskId: string, status: Status) {
    const task = tasks.find((item) => item.id === taskId);
    if (!task || task.status === status) return;
    await persistTask({ ...task, status, progress: status === "Done" ? 100 : task.progress }, "update");
  }

  async function deleteTask(task: Task) {
    setTasks((current) => current.filter((item) => item.id !== task.id));
    const entry: Activity = {
      timestamp: nowIso(),
      taskId: task.id,
      key: task.key,
      action: "Deleted",
      field: "Task",
      oldValue: task.title,
      newValue: "",
      actor: settings.actor || "User",
    };
    setActivity((current) => [entry, ...current].slice(0, 80));
    if (!syncEnabled) {
      setSyncState("local");
      setSyncMessage(currentLocalSyncMessage);
      return;
    }

    markTaskPending(task.id, true);
    setSyncState("syncing");
    setSyncMessage("Deleting from Sheet");
    try {
      await sheetRequest(settings, "deleteTask", { id: task.id, activities: [entry] });
      setSyncState("synced");
      setSyncMessage(`Deleted from Sheet ${TIME_FORMATTER.format(new Date())}`);
    } catch (error) {
      setTasks((current) => (current.some((item) => item.id === task.id) ? current : [task, ...current]));
      setActivity((current) => removeActivityEntries(current, [entry]));
      setSyncState("error");
      setSyncMessage(error instanceof Error ? error.message : "Delete failed");
    } finally {
      markTaskPending(task.id, false);
    }
  }

  function newTask() {
    setEditingTask({
      ...emptyTask(),
      id: crypto.randomUUID(),
      key: nextKey(tasks),
      createdAt: "",
      updatedAt: "",
    });
  }

  function generateToken() {
    setSettings((current) => ({
      ...current,
      token: crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, ""),
    }));
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <div className="brand-mark" aria-hidden="true">
            <Kanban size={20} />
          </div>
          <div>
            <p className="eyebrow">OfficeFlow</p>
            <h1>Daily Task Hub</h1>
          </div>
        </div>
        <div className="topbar-actions">
          <a className="sheet-link" href={settings.sheetUrl || SHEET_URL} target="_blank" rel="noreferrer">
            <FileSpreadsheet size={17} />
            Sheet
            <ExternalLink size={14} />
          </a>
          <SyncPill state={visibleSyncState} message={visibleSyncMessage} local={!syncEnabled} />
          <button className="icon-button" type="button" aria-label="Refresh from Sheet" title="Refresh from Sheet" onClick={() => void loadFromSheet()}>
            {visibleSyncState === "syncing" ? <Loader2 className="spin" size={18} /> : <RefreshCw size={18} />}
          </button>
          <button className="icon-button" type="button" aria-label="Settings" title="Settings" onClick={() => setShowSettings(true)}>
            <Settings2 size={18} />
          </button>
          <button className="primary-button" type="button" onClick={newTask}>
            <Plus size={18} />
            New task
          </button>
        </div>
      </header>

      <section className="metrics-strip" aria-label="Task summary">
        <Metric label="Open" value={metrics.open} tone="blue" active={quickFilter === "open"} icon={<CircleDot size={18} />} onClick={() => chooseQuickFilter("open")} />
        <Metric label="Today" value={metrics.today} tone="green" active={quickFilter === "today"} icon={<CalendarClock size={18} />} onClick={() => chooseQuickFilter("today")} />
        <Metric label="Overdue" value={metrics.overdue} tone="red" active={quickFilter === "overdue"} icon={<AlertTriangle size={18} />} onClick={() => chooseQuickFilter("overdue")} />
        <Metric label="Blocked" value={metrics.blocked} tone="amber" active={quickFilter === "blocked"} icon={<SlidersHorizontal size={18} />} onClick={() => chooseQuickFilter("blocked")} />
        <Metric label="Done" value={metrics.done} tone="gray" active={quickFilter === "done"} icon={<CheckCircle2 size={18} />} onClick={() => chooseQuickFilter("done")} />
      </section>

      <section className="workspace-toolbar" aria-label="Workspace controls">
        <div className="view-switch" role="tablist" aria-label="Views">
          <button className={view === "board" ? "active" : ""} type="button" onClick={() => setView("board")}>
            <Columns3 size={16} />
            Board
          </button>
          <button className={view === "list" ? "active" : ""} type="button" onClick={() => setView("list")}>
            <ListChecks size={16} />
            List
          </button>
          <button className={view === "focus" ? "active" : ""} type="button" onClick={() => setView("focus")}>
            <CalendarClock size={16} />
            Focus
          </button>
        </div>
        <label className="search-box">
          <Search size={17} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tasks, labels, notes" />
        </label>
        <label className="select-control">
          Status
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as Status | "All")}>
            <option>All</option>
            {STATUSES.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </label>
        <label className="select-control">
          Priority
          <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value as Priority | "All")}>
            <option>All</option>
            {PRIORITIES.map((priority) => (
              <option key={priority}>{priority}</option>
            ))}
          </select>
        </label>
      </section>

      <section className="filter-bar" aria-label="Date filters">
        <label className="select-control date-field-control">
          Date
          <select value={dateField} onChange={(event) => setDateField(event.target.value as DateField)}>
            {DATE_FILTERS.map((filter) => (
              <option key={filter.value} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </select>
        </label>
        <label className="date-control">
          From
          <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
        </label>
        <label className="date-control">
          To
          <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
        </label>
        <button className="ghost-button" type="button" onClick={clearFilters}>
          Clear filters
        </button>
        <span className="filter-count">{filteredTasks.length} matching tasks</span>
      </section>

      {view === "board" && (
        <section className="board" aria-label="Task board">
          {STATUSES.map((status) => {
            const laneTasks = filteredTasks.filter((task) => task.status === status);
            return (
              <section
                className="lane"
                key={status}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (draggedId) void moveTask(draggedId, status);
                  setDraggedId(null);
                }}
              >
                <div className="lane-header">
                  <h2>{status}</h2>
                  <span>{laneTasks.length}</span>
                </div>
                <div className="lane-stack">
                  {laneTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onEdit={() => setEditingTask(task)}
                      onDelete={() => void deleteTask(task)}
                      onMove={(nextStatus) => void moveTask(task.id, nextStatus)}
                      onDragStart={() => setDraggedId(task.id)}
                      pending={pendingTaskIdSet.has(task.id)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </section>
      )}

      {view === "list" && (
        <TaskTable
          tasks={filteredTasks}
          onEdit={setEditingTask}
          onDelete={(task) => void deleteTask(task)}
          onMove={(task, status) => void moveTask(task.id, status)}
          pendingTaskIds={pendingTaskIdSet}
        />
      )}

      {view === "focus" && (
        <FocusView tasks={filteredTasks} onEdit={setEditingTask} onMove={(task, status) => void moveTask(task.id, status)} pendingTaskIds={pendingTaskIdSet} />
      )}

      <section className="activity-panel" aria-label="Recent activity">
        <div className="section-heading">
          <h2>Recent Activity</h2>
          <span>{activity.length}</span>
        </div>
        <div className="activity-list">
          {activity.slice(0, 8).map((item, index) => (
            <div className="activity-row" key={item.timestamp + item.taskId + index}>
              <span>{formatDateTime(item.timestamp)}</span>
              <strong>{item.action}</strong>
              <p>{describeActivity(item)}</p>
              <em>{item.field}{item.oldValue || item.newValue ? `: ${item.oldValue || "none"} -> ${item.newValue || "none"}` : ""}</em>
            </div>
          ))}
        </div>
      </section>

      {editingTask && (
        <TaskDialog
          task={editingTask}
          onClose={() => setEditingTask(null)}
          onSave={(task, isNew) => {
            void persistTask(task, isNew ? "create" : "update");
            setEditingTask(null);
          }}
        />
      )}

      {showSettings && (
        <SettingsDialog
          settings={settings}
          onChange={setSettings}
          onClose={() => setShowSettings(false)}
          onLoad={() => void loadFromSheet()}
          onGenerateToken={generateToken}
          syncState={visibleSyncState}
          syncMessage={visibleSyncMessage}
        />
      )}
    </main>
  );
}

function SyncPill({ state, message, local }: { state: string; message: string; local: boolean }) {
  const Icon = local || state === "error" ? CloudOff : Cloud;
  return (
    <span className={`sync-pill ${state}`}>
      <Icon size={15} />
      {message}
    </span>
  );
}

function Metric(props: {
  label: string;
  value: number;
  tone: string;
  icon: ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  const { label, value, tone, icon, active, onClick } = props;
  return (
    <button className={`metric-card ${tone} ${active ? "active" : ""}`} type="button" onClick={onClick} aria-pressed={active}>
      <div>{icon}</div>
      <p>{label}</p>
      <strong>{value}</strong>
    </button>
  );
}

function TaskCard({
  task,
  onEdit,
  onDelete,
  onMove,
  onDragStart,
  pending,
}: {
  task: Task;
  onEdit: () => void;
  onDelete: () => void;
  onMove: (status: Status) => void;
  onDragStart: () => void;
  pending: boolean;
}) {
  return (
    <article className={`task-card priority-${task.priority.toLowerCase()} ${pending ? "sync-pending" : ""}`} draggable={!pending} onDragStart={onDragStart}>
      <div className="task-card-top">
        <span className="drag-handle" aria-hidden="true">
          <GripVertical size={15} />
        </span>
        <span className="task-key">{task.key}</span>
        <span className={`priority-chip ${task.priority.toLowerCase()}`}>{task.priority}</span>
        {pending && (
          <span className="sync-chip">
            <Loader2 className="spin" size={13} />
            Syncing
          </span>
        )}
        <button className="tiny-button" type="button" aria-label={`Edit ${task.key}`} title="Edit" onClick={onEdit} disabled={pending}>
          <Pencil size={15} />
        </button>
        <button className="tiny-button danger" type="button" aria-label={`Delete ${task.key}`} title="Delete" onClick={onDelete} disabled={pending}>
          <Trash2 size={15} />
        </button>
      </div>
      <h3>{task.title}</h3>
      <p>{task.description}</p>
      <div className="label-row">
        {task.labels.slice(0, 3).map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <div className="task-meta">
        <span className={isOverdue(task) ? "overdue" : ""}>
          <CalendarClock size={14} />
          {formatDate(task.dueDate)}
        </span>
        <span>{task.type}</span>
        <span>{task.progress}%</span>
      </div>
      <div className="timeline-strip">
        <span>Assigned {formatDate(task.assignedAt)}</span>
        {task.blockedAt && <span>Blocked {formatDate(task.blockedAt)}</span>}
        {task.completedAt && <span>Done {formatDate(task.completedAt)}</span>}
      </div>
      <div className="progress-track" aria-label={`${task.progress}% complete`}>
        <span style={{ width: `${task.progress}%` }} />
      </div>
      <select className="status-select" value={task.status} onChange={(event) => onMove(event.target.value as Status)} disabled={pending}>
        {STATUSES.map((status) => (
          <option key={status}>{status}</option>
        ))}
      </select>
    </article>
  );
}

function TaskTable({
  tasks,
  onEdit,
  onDelete,
  onMove,
  pendingTaskIds,
}: {
  tasks: Task[];
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onMove: (task: Task, status: Status) => void;
  pendingTaskIds: Set<string>;
}) {
  return (
    <section className="table-panel" aria-label="Task list">
      <table>
        <thead>
          <tr>
            <th>Key</th>
            <th>Task</th>
            <th>Status</th>
            <th>Priority</th>
            <th>Due</th>
            <th>Assigned</th>
            <th>Blocked/Done</th>
            <th>Progress</th>
            <th>Owner</th>
            <th aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => {
            const pending = pendingTaskIds.has(task.id);
            return (
              <tr className={pending ? "sync-pending-row" : ""} key={task.id}>
                <td>{task.key}</td>
                <td>
                  <strong>{task.title}</strong>
                  <span>{task.description}</span>
                </td>
                <td>
                  <select value={task.status} onChange={(event) => onMove(task, event.target.value as Status)} disabled={pending}>
                    {STATUSES.map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <span className={`priority-chip ${task.priority.toLowerCase()}`}>{task.priority}</span>
                </td>
                <td className={isOverdue(task) ? "overdue" : ""}>{formatDate(task.dueDate)}</td>
                <td>{formatDate(task.assignedAt)}</td>
                <td>{task.blockedAt ? `Blocked ${formatDate(task.blockedAt)}` : task.completedAt ? `Done ${formatDate(task.completedAt)}` : "-"}</td>
                <td>{task.progress}%</td>
                <td>{task.owner}</td>
                <td>
                  {pending && <span className="row-sync">Syncing</span>}
                  <button className="tiny-button" type="button" aria-label={`Edit ${task.key}`} onClick={() => onEdit(task)} disabled={pending}>
                    <Pencil size={15} />
                  </button>
                  <button className="tiny-button danger" type="button" aria-label={`Delete ${task.key}`} onClick={() => onDelete(task)} disabled={pending}>
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

function FocusView({
  tasks,
  onEdit,
  onMove,
  pendingTaskIds,
}: {
  tasks: Task[];
  onEdit: (task: Task) => void;
  onMove: (task: Task, status: Status) => void;
  pendingTaskIds: Set<string>;
}) {
  const focus = tasks.filter((task) => task.status !== "Done" && (isDueToday(task) || isOverdue(task) || task.status === "Today"));
  const upcoming = tasks
    .filter((task) => task.status !== "Done" && !focus.includes(task))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 6);
  return (
    <section className="focus-grid" aria-label="Daily focus">
      <div className="focus-main">
        <div className="section-heading">
          <h2>Daily Focus</h2>
          <span>{focus.length}</span>
        </div>
        <div className="focus-stack">
          {focus.map((task) => {
            const pending = pendingTaskIds.has(task.id);
            return (
              <article className={`focus-row ${pending ? "sync-pending-row" : ""}`} key={task.id}>
                <span className={`priority-dot ${task.priority.toLowerCase()}`} />
                <button type="button" className="focus-title" onClick={() => onEdit(task)} disabled={pending}>
                  <strong>{task.title}</strong>
                  <em>{pending ? `${task.key} syncing` : task.key}</em>
                </button>
                <span className={isOverdue(task) ? "overdue" : ""}>{formatDate(task.dueDate)}</span>
                <select value={task.status} onChange={(event) => onMove(task, event.target.value as Status)} disabled={pending}>
                  {STATUSES.map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </article>
            );
          })}
        </div>
      </div>
      <aside className="upcoming-panel">
        <div className="section-heading">
          <h2>Next Up</h2>
          <span>{upcoming.length}</span>
        </div>
        {upcoming.map((task) => (
          <button className="upcoming-row" type="button" key={task.id} onClick={() => onEdit(task)}>
            <strong>{task.key}</strong>
            <span>{task.title}</span>
            <em>{formatDate(task.dueDate)}</em>
          </button>
        ))}
      </aside>
    </section>
  );
}

function TaskDialog({
  task,
  onSave,
  onClose,
}: {
  task: Task;
  onSave: (task: Task, isNew: boolean) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Task>(normalizeTask(task));
  const isNew = !task.createdAt;
  const setField = <K extends keyof Task>(key: K, value: Task[K]) => setDraft((current) => ({ ...current, [key]: value }));

  function submit(event: FormEvent) {
    event.preventDefault();
    onSave(
      normalizeTask({
        ...draft,
        createdAt: draft.createdAt || nowIso(),
        updatedAt: nowIso(),
      }),
      isNew,
    );
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <form className="task-dialog" onSubmit={submit}>
        <div className="dialog-header">
          <div>
            <p className="eyebrow">{draft.key}</p>
            <h2>{draft.title || "New task"}</h2>
          </div>
          <button className="icon-button" type="button" aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <label className="field wide">
          Title
          <input value={draft.title} required onChange={(event) => setField("title", event.target.value)} />
        </label>
        <label className="field wide">
          Description
          <textarea value={draft.description} rows={4} onChange={(event) => setField("description", event.target.value)} />
        </label>

        <div className="form-grid">
          <label className="field">
            Status
            <select value={draft.status} onChange={(event) => setField("status", event.target.value as Status)}>
              {STATUSES.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Priority
            <select value={draft.priority} onChange={(event) => setField("priority", event.target.value as Priority)}>
              {PRIORITIES.map((priority) => (
                <option key={priority}>{priority}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Type
            <select value={draft.type} onChange={(event) => setField("type", event.target.value as TaskType)}>
              {TYPES.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Sprint
            <select value={draft.sprint} onChange={(event) => setField("sprint", event.target.value)}>
              {SPRINTS.map((sprint) => (
                <option key={sprint}>{sprint}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Due date
            <input type="date" value={draft.dueDate} onChange={(event) => setField("dueDate", event.target.value)} />
          </label>
          <label className="field">
            Owner
            <input value={draft.owner} onChange={(event) => setField("owner", event.target.value)} />
          </label>
          <label className="field">
            Estimate
            <input type="number" min="0" step="0.5" value={draft.estimate} onChange={(event) => setField("estimate", Number(event.target.value))} />
          </label>
          <label className="field">
            Progress
            <input type="range" min="0" max="100" value={draft.progress} onChange={(event) => setField("progress", Number(event.target.value))} />
            <span>{draft.progress}%</span>
          </label>
        </div>

        <label className="field wide label-field">
          Labels (tags)
          <input
            value={draft.labels.join(", ")}
            placeholder="finance, approval, client-a"
            onChange={(event) => setField("labels", event.target.value.split(",").map((item) => item.trim()).filter(Boolean))}
          />
          <span className="field-help">Use labels to group related tasks. Add comma-separated tags for departments, projects, clients, or work types.</span>
        </label>
        <div className="task-timeline" aria-label="Task workflow timestamps">
          <div>
            <span>Assigned</span>
            <strong>{formatDateTime(draft.assignedAt)}</strong>
          </div>
          <div>
            <span>Blocked</span>
            <strong>{formatDateTime(draft.blockedAt)}</strong>
          </div>
          <div>
            <span>Completed</span>
            <strong>{formatDateTime(draft.completedAt)}</strong>
          </div>
          <div>
            <span>Status changed</span>
            <strong>{formatDateTime(draft.statusChangedAt)}</strong>
          </div>
        </div>
        <label className="field wide">
          Notes
          <textarea value={draft.notes} rows={3} onChange={(event) => setField("notes", event.target.value)} />
        </label>

        <div className="dialog-actions">
          <button className="ghost-button" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-button" type="submit">
            <Save size={18} />
            Save task
          </button>
        </div>
      </form>
    </div>
  );
}

function SettingsDialog({
  settings,
  onChange,
  onClose,
  onLoad,
  onGenerateToken,
  syncState,
  syncMessage,
}: {
  settings: Settings;
  onChange: (settings: Settings) => void;
  onClose: () => void;
  onLoad: () => void;
  onGenerateToken: () => void;
  syncState: string;
  syncMessage: string;
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="settings-dialog" role="dialog" aria-modal="true" aria-label="Settings">
        <div className="dialog-header">
          <div>
            <p className="eyebrow">Connection</p>
            <h2>Google Sheet Sync</h2>
          </div>
          <button className="icon-button" type="button" aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <label className="field wide">
          Apps Script Web App URL
          <input
            value={settings.scriptUrl}
            placeholder="https://script.google.com/macros/s/.../exec"
            onChange={(event) => onChange({ ...settings, scriptUrl: event.target.value })}
          />
          <span className="field-help">Required for Sheet sync. Paste the deployed Apps Script Web App URL ending in /exec.</span>
        </label>
        <label className="field wide">
          App token
          <div className="inline-field">
            <input value={settings.token} onChange={(event) => onChange({ ...settings, token: event.target.value })} />
            <button className="ghost-button" type="button" onClick={onGenerateToken}>
              Generate
            </button>
          </div>
          <span className="field-help">This must match the APP_TOKEN saved in Apps Script project settings.</span>
        </label>
        <label className="field wide">
          Actor
          <input value={settings.actor} onChange={(event) => onChange({ ...settings, actor: event.target.value })} />
        </label>
        <label className="field wide">
          Sheet URL
          <input value={settings.sheetUrl} onChange={(event) => onChange({ ...settings, sheetUrl: event.target.value })} />
          <span className="field-help">This is only the storage Sheet link shown in the header. It is not the sync API URL.</span>
        </label>
        <div className="settings-status">
          <SyncPill state={syncState} message={syncMessage} local={!canSyncToSheet(settings)} />
          <button className="primary-button" type="button" onClick={onLoad}>
            <RefreshCw size={18} />
            Load Sheet
          </button>
        </div>
      </section>
    </div>
  );
}
