const SPREADSHEET_ID = "1aju4zHHcERO3jJeUjyKbqLh3reqak-ikdAU9ZHqjZk4";
const TASKS_SHEET = "Tasks";
const ACTIVITY_SHEET = "Activity";
const LISTS_SHEET = "Lists";

const TASK_HEADERS = [
  "ID",
  "Key",
  "Title",
  "Description",
  "Status",
  "Priority",
  "Type",
  "Owner",
  "Labels",
  "Due Date",
  "Start Date",
  "Estimate",
  "Progress",
  "Sprint",
  "Created At",
  "Updated At",
  "Completed At",
  "Assigned At",
  "Blocked At",
  "Status Changed At",
  "Notes",
];

const ACTIVITY_HEADERS = [
  "Timestamp",
  "Task ID",
  "Key",
  "Action",
  "Field",
  "Old Value",
  "New Value",
  "Actor",
];

function doGet(e) {
  const params = (e && e.parameter) || {};
  if (params.transport === "frame") {
    let result;
    try {
      result = handleRequest(getPayloadFromParams(params));
    } catch (error) {
      result = { ok: false, error: error.message || String(error) };
    }
    return frameResponse(params.requestId, result);
  }

  if (params.callback) {
    let result;
    try {
      result = handleRequest(getPayloadFromParams(params));
    } catch (error) {
      result = { ok: false, error: error.message || String(error) };
    }
    return jsonpResponse(params.callback, result);
  }

  return jsonResponse({
    ok: true,
    data: {
      service: "OfficeFlow Task Hub",
      spreadsheetId: SPREADSHEET_ID,
    },
  });
}

function doPost(e) {
  try {
    const payload = JSON.parse((e.postData && e.postData.contents) || "{}");
    return jsonResponse(handleRequest(payload));
  } catch (error) {
    return jsonResponse({ ok: false, error: error.message || String(error) });
  }
}

function getPayloadFromParams(params) {
  const payload = params.payload ? JSON.parse(params.payload) : {};
  payload.action = params.action || payload.action;
  payload.token = params.token || payload.token;
  payload.actor = params.actor || payload.actor;
  return payload;
}

function handleRequest(payload) {
  payload = payload || {};
  verifyToken(payload.token);

  switch (payload.action) {
    case "list":
      return {
        ok: true,
        data: {
          tasks: listTasks(),
          activity: listActivity(),
          options: listOptions(),
        },
      };
    case "saveTask":
      return { ok: true, data: saveTask(payload.task, payload.activities || payload.activity) };
    case "deleteTask":
      return { ok: true, data: deleteTask(payload.id, payload.activities || payload.activity) };
    case "ping":
      return { ok: true, data: { message: "Connected" } };
    default:
      throw new Error("Unknown action: " + payload.action);
  }
}

function verifyToken(token) {
  const expected = PropertiesService.getScriptProperties().getProperty("APP_TOKEN");
  if (!expected) {
    throw new Error("APP_TOKEN script property is not set.");
  }
  if (token !== expected) {
    throw new Error("Invalid app token.");
  }
}

function getBook() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function getSheet(name, headers) {
  const book = getBook();
  let sheet = book.getSheetByName(name);
  if (!sheet) sheet = book.insertSheet(name);
  if (name === TASKS_SHEET) {
    ensureTaskSchema(sheet);
    return sheet;
  }
  const width = headers.length;
  const existing = sheet.getRange(1, 1, 1, width).getValues()[0];
  const needsHeaders = headers.some((header, index) => existing[index] !== header);
  if (needsHeaders) {
    sheet.getRange(1, 1, 1, width).setValues([headers]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function ensureTaskSchema(sheet) {
  const existing = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), TASK_HEADERS.length)).getValues()[0];
  const notesIndex = existing.indexOf("Notes");
  const hasAssignedAt = existing.indexOf("Assigned At") >= 0;
  if (!hasAssignedAt && notesIndex >= 0) {
    sheet.insertColumnsBefore(notesIndex + 1, 3);
  }
  sheet.getRange(1, 1, 1, TASK_HEADERS.length).setValues([TASK_HEADERS]);
  sheet.setFrozenRows(1);
}

function listTasks() {
  const sheet = getSheet(TASKS_SHEET, TASK_HEADERS);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  return sheet
    .getRange(2, 1, lastRow - 1, TASK_HEADERS.length)
    .getValues()
    .filter((row) => row[0] || row[2])
    .map(rowToTask);
}

function listActivity() {
  const sheet = getSheet(ACTIVITY_SHEET, ACTIVITY_HEADERS);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  return sheet
    .getRange(2, 1, lastRow - 1, ACTIVITY_HEADERS.length)
    .getValues()
    .filter((row) => row[0] || row[2])
    .map(rowToActivity)
    .reverse();
}

function listOptions() {
  const sheet = getBook().getSheetByName(LISTS_SHEET);
  if (!sheet) return {};
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return {};
  const headers = values[0];
  return headers.reduce((options, header, columnIndex) => {
    options[header] = values
      .slice(1)
      .map((row) => row[columnIndex])
      .filter(Boolean);
    return options;
  }, {});
}

function saveTask(rawTask, activity) {
  const sheet = getSheet(TASKS_SHEET, TASK_HEADERS);
  const row = findTaskRow(sheet, rawTask && rawTask.id);
  const previous = row > 0 ? rowToTask(sheet.getRange(row, 1, 1, TASK_HEADERS.length).getValues()[0]) : null;
  const task = normalizeTask(rawTask, previous);
  const values = [taskToRow(task)];
  if (row > 0) {
    sheet.getRange(row, 1, 1, TASK_HEADERS.length).setValues(values);
  } else {
    sheet.appendRow(values[0]);
  }
  appendActivities(activity || {
    timestamp: new Date().toISOString(),
    taskId: task.id,
    key: task.key,
    action: "Saved",
    field: "Task",
    oldValue: "",
    newValue: task.status,
    actor: "User",
  });
  return { task: task };
}

function deleteTask(id, activity) {
  const sheet = getSheet(TASKS_SHEET, TASK_HEADERS);
  const row = findTaskRow(sheet, id);
  if (row > 0) {
    sheet.deleteRow(row);
  }
  appendActivities(activity || {
    timestamp: new Date().toISOString(),
    taskId: id,
    key: "",
    action: "Deleted",
    field: "Task",
    oldValue: "",
    newValue: "",
    actor: "User",
  });
  return { deleted: row > 0 };
}

function findTaskRow(sheet, id) {
  if (!id || sheet.getLastRow() < 2) return -1;
  const ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  for (let index = 0; index < ids.length; index += 1) {
    if (ids[index][0] === id) return index + 2;
  }
  return -1;
}

function appendActivities(activity) {
  const sheet = getSheet(ACTIVITY_SHEET, ACTIVITY_HEADERS);
  const items = Array.isArray(activity) ? activity : [activity];
  if (!items.length) return;
  sheet.getRange(sheet.getLastRow() + 1, 1, items.length, ACTIVITY_HEADERS.length).setValues(
    items.map(activityToRow),
  );
}

function normalizeTask(task, previous) {
  const now = new Date().toISOString();
  task = task || {};
  const status = pickValue(task, previous, "status", "Backlog");
  const owner = pickValue(task, previous, "owner", "User");
  const statusChanged = previous ? previous.status !== status : true;
  const ownerChanged = previous ? previous.owner !== owner : true;
  const labels = Object.prototype.hasOwnProperty.call(task, "labels")
    ? task.labels
    : previous && previous.labels;
  return {
    id: pickValue(task, previous, "id", Utilities.getUuid()),
    key: pickValue(task, previous, "key", "OFF-new"),
    title: pickValue(task, previous, "title", "Untitled task"),
    description: pickValue(task, previous, "description", ""),
    status: status,
    priority: pickValue(task, previous, "priority", "Medium"),
    type: pickValue(task, previous, "type", "Task"),
    owner: owner,
    labels: Array.isArray(labels) ? labels : splitLabels(labels),
    dueDate: toDateOnly(pickValue(task, previous, "dueDate", "")),
    startDate: toDateOnly(pickValue(task, previous, "startDate", "")),
    estimate: Number(pickValue(task, previous, "estimate", 0)),
    progress: Math.max(0, Math.min(100, Number(pickValue(task, previous, "progress", 0)))),
    sprint: pickValue(task, previous, "sprint", "This Week"),
    createdAt: pickValue(task, previous, "createdAt", now),
    updatedAt: now,
    completedAt: status === "Done" ? pickValue(task, previous, "completedAt", now) || now : "",
    assignedAt: ownerChanged ? now : pickValue(task, previous, "assignedAt", now),
    blockedAt: status === "Blocked" && (!previous || previous.status !== "Blocked") ? now : pickValue(task, previous, "blockedAt", ""),
    statusChangedAt: statusChanged ? now : pickValue(task, previous, "statusChangedAt", now),
    notes: pickValue(task, previous, "notes", ""),
  };
}

function pickValue(source, previous, key, fallback) {
  if (source && Object.prototype.hasOwnProperty.call(source, key)) return source[key];
  if (previous && Object.prototype.hasOwnProperty.call(previous, key)) return previous[key];
  return fallback;
}

function rowToTask(row) {
  return {
    id: row[0] || "",
    key: row[1] || "",
    title: row[2] || "",
    description: row[3] || "",
    status: row[4] || "Backlog",
    priority: row[5] || "Medium",
    type: row[6] || "Task",
    owner: row[7] || "",
    labels: splitLabels(row[8]),
    dueDate: toDateOnly(row[9]),
    startDate: toDateOnly(row[10]),
    estimate: Number(row[11] || 0),
    progress: Number(row[12] || 0),
    sprint: row[13] || "",
    createdAt: toIso(row[14]),
    updatedAt: toIso(row[15]),
    completedAt: toIso(row[16]),
    assignedAt: toIso(row[17]),
    blockedAt: toIso(row[18]),
    statusChangedAt: toIso(row[19]),
    notes: row[20] || "",
  };
}

function taskToRow(task) {
  return [
    task.id,
    task.key,
    task.title,
    task.description,
    task.status,
    task.priority,
    task.type,
    task.owner,
    (task.labels || []).join(","),
    toSheetDate(task.dueDate),
    toSheetDate(task.startDate),
    Number(task.estimate || 0),
    Number(task.progress || 0),
    task.sprint,
    toSheetDateTime(task.createdAt),
    toSheetDateTime(task.updatedAt),
    toSheetDateTime(task.completedAt),
    toSheetDateTime(task.assignedAt),
    toSheetDateTime(task.blockedAt),
    toSheetDateTime(task.statusChangedAt),
    task.notes,
  ];
}

function rowToActivity(row) {
  return {
    timestamp: toIso(row[0]),
    taskId: row[1] || "",
    key: row[2] || "",
    action: row[3] || "",
    field: row[4] || "",
    oldValue: row[5] || "",
    newValue: row[6] || "",
    actor: row[7] || "",
  };
}

function activityToRow(activity) {
  const item = activity || {};
  return [
    toSheetDateTime(item.timestamp || new Date().toISOString()),
    item.taskId || "",
    item.key || "",
    item.action || "",
    item.field || "",
    item.oldValue || "",
    item.newValue || "",
    item.actor || "User",
  ];
}

function splitLabels(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return String(value)
    .split(",")
    .map((label) => label.trim())
    .filter(Boolean);
}

function toDateOnly(value) {
  if (!value) return "";
  if (Object.prototype.toString.call(value) === "[object Date]") {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  return String(value).slice(0, 10);
}

function toIso(value) {
  if (!value) return "";
  if (Object.prototype.toString.call(value) === "[object Date]") {
    return value.toISOString();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

function toSheetDate(value) {
  if (!value) return "";
  if (Object.prototype.toString.call(value) === "[object Date]") return value;
  const parsed = new Date(String(value).slice(0, 10) + "T00:00:00");
  return Number.isNaN(parsed.getTime()) ? value : parsed;
}

function toSheetDateTime(value) {
  if (!value) return "";
  if (Object.prototype.toString.call(value) === "[object Date]") return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed;
}

function jsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

function jsonpResponse(callback, payload) {
  if (!/^[A-Za-z_$][0-9A-Za-z_$]*(\.[A-Za-z_$][0-9A-Za-z_$]*)*$/.test(callback)) {
    return ContentService.createTextOutput("/* Invalid callback */").setMimeType(
      ContentService.MimeType.JAVASCRIPT,
    );
  }
  return ContentService.createTextOutput(callback + "(" + JSON.stringify(payload) + ");").setMimeType(
    ContentService.MimeType.JAVASCRIPT,
  );
}

function frameResponse(requestId, payload) {
  const message = {
    source: "officeflow-sheet",
    requestId: String(requestId || ""),
    result: payload,
  };
  const html =
    '<!doctype html><meta charset="utf-8"><script>parent.postMessage(' +
    JSON.stringify(message).replace(/</g, "\\u003c") +
    ', "*");</script>';
  return HtmlService.createHtmlOutput(html).setXFrameOptionsMode(
    HtmlService.XFrameOptionsMode.ALLOWALL,
  );
}
