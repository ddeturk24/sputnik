const express = require("express");
const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");

const app = express();
const PORT = process.env.SPUTNIK_PORT || 3080;
const DATA_DIR = path.join(__dirname, "data");

// --- Security ---
app.disable("x-powered-by");
app.use(express.json({ limit: "10kb" }));

// Input sanitization middleware
function sanitize(str) {
  if (typeof str !== "string") return str;
  return str.replace(/[<>"`]/g, "").slice(0, 500);
}

app.use((req, res, next) => {
  // Reject oversized bodies
  if (req.headers["content-length"] && parseInt(req.headers["content-length"]) > 10240) {
    return res.status(413).json({ error: "Payload too large" });
  }
  next();
});

app.use(express.static(path.join(__dirname, "public"), {
  maxAge: 0,
  etag: true,
  lastModified: true
}));

// --- Helpers ---
function readJSON(file) {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf8"));
  } catch {
    return file === "settings.json" ? {} : [];
  }
}

function writeJSON(file, data) {
  fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2));
}

// --- To-Do API ---
app.get("/api/todos", (req, res) => {
  res.json(readJSON("todos.json"));
});

app.post("/api/todos", (req, res) => {
  const todos = readJSON("todos.json");
  if (todos.length >= 500) return res.status(400).json({ error: "Too many todos" });
  const text = sanitize(req.body.text || "");
  const category = sanitize(req.body.category || "Dustin");
  if (!text) return res.status(400).json({ error: "Text required" });
  const todo = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    text,
    category,
    done: false,
    created: new Date().toISOString()
  };
  todos.push(todo);
  writeJSON("todos.json", todos);
  res.status(201).json(todo);
});

app.patch("/api/todos/:id", (req, res) => {
  const todos = readJSON("todos.json");
  const idx = todos.findIndex(t => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Not found" });
  if (req.body.text !== undefined) todos[idx].text = sanitize(req.body.text);
  if (req.body.category !== undefined) todos[idx].category = sanitize(req.body.category);
  if (req.body.done !== undefined) todos[idx].done = !!req.body.done;
  writeJSON("todos.json", todos);
  res.json(todos[idx]);
});

app.delete("/api/todos/:id", (req, res) => {
  let todos = readJSON("todos.json");
  todos = todos.filter(t => t.id !== req.params.id);
  writeJSON("todos.json", todos);
  res.status(204).end();
});

// --- Grocery API ---
app.get("/api/grocery", (req, res) => {
  res.json(readJSON("grocery.json"));
});

app.post("/api/grocery", (req, res) => {
  const items = readJSON("grocery.json");
  if (items.length >= 500) return res.status(400).json({ error: "Too many items" });
  const text = sanitize(req.body.text || "");
  if (!text) return res.status(400).json({ error: "Text required" });
  const item = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    text,
    done: false,
    created: new Date().toISOString()
  };
  items.push(item);
  writeJSON("grocery.json", items);
  res.status(201).json(item);
});

app.patch("/api/grocery/:id", (req, res) => {
  const items = readJSON("grocery.json");
  const idx = items.findIndex(i => i.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Not found" });
  if (req.body.text !== undefined) items[idx].text = sanitize(req.body.text);
  if (req.body.done !== undefined) items[idx].done = !!req.body.done;
  writeJSON("grocery.json", items);
  res.json(items[idx]);
});

app.delete("/api/grocery/:id", (req, res) => {
  let items = readJSON("grocery.json");
  items = items.filter(i => i.id !== req.params.id);
  writeJSON("grocery.json", items);
  res.status(204).end();
});

// --- Ideas API ---
app.get("/api/ideas", (req, res) => {
  res.json(readJSON("ideas.json"));
});

app.post("/api/ideas", (req, res) => {
  const ideas = readJSON("ideas.json");
  if (ideas.length >= 200) return res.status(400).json({ error: "Too many ideas" });
  const text = sanitize(req.body.text || "");
  if (!text) return res.status(400).json({ error: "Text required" });
  const idea = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    text,
    created: new Date().toISOString()
  };
  ideas.push(idea);
  writeJSON("ideas.json", ideas);
  res.status(201).json(idea);
});

app.delete("/api/ideas/:id", (req, res) => {
  let ideas = readJSON("ideas.json");
  ideas = ideas.filter(i => i.id !== req.params.id);
  writeJSON("ideas.json", ideas);
  res.status(204).end();
});

// --- To-Do Reset Done ---
app.post("/api/todos/reset-done/:category", (req, res) => {
  const todos = readJSON("todos.json");
  for (const t of todos) {
    if (t.category === req.params.category && t.done) t.done = false;
  }
  writeJSON("todos.json", todos);
  res.json(todos);
});

// --- Settings API ---
app.get("/api/settings", (req, res) => {
  res.json(readJSON("settings.json"));
});

app.put("/api/settings", (req, res) => {
  // Only allow known settings keys
  const allowed = ["google_calendar", "weather"];
  const clean = {};
  for (const key of allowed) {
    if (req.body[key]) clean[key] = req.body[key];
  }
  writeJSON("settings.json", clean);
  res.json(clean);
});

// --- Calendar iCal proxy ---
app.get("/api/calendar", async (req, res) => {
  const settings = readJSON("settings.json");
  const icalUrl = settings.google_calendar?.ical_url;
  if (!icalUrl) return res.json({ error: "no_url", events: [] });
  // Validate URL is actually Google Calendar
  if (!icalUrl.startsWith("https://calendar.google.com/")) {
    return res.json({ error: "Invalid calendar URL", events: [] });
  }
  const days = Math.min(30, Math.max(1, parseInt(req.query.days) || 7));
  try {
    const resp = await fetch(icalUrl);
    if (!resp.ok) {
      console.error("Calendar fetch failed: " + resp.status);
      return res.json({ error: "Google returned " + resp.status, events: [] });
    }
    const text = await resp.text();
    const events = parseICal(text, days);
    res.json({ error: null, events });
  } catch (e) {
    console.error("Calendar fetch error:", e.message);
    res.json({ error: e.message, events: [] });
  }
});

function parseICal(text, days) {
  const events = [];
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endWindow = new Date(startOfToday.getTime() + days * 86400000);
  endWindow.setHours(23, 59, 59, 999);
  const blocks = text.split("BEGIN:VEVENT");
  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i].split("END:VEVENT")[0];
    const get = (key) => {
      const re = new RegExp("^" + key + "[^:]*:(.+)$", "m");
      const m = block.match(re);
      return m ? m[1].trim() : null;
    };
    const summary = get("SUMMARY") || "Untitled";
    const dtstart = get("DTSTART");
    if (!dtstart) continue;
    const start = parseICalDate(dtstart);
    if (!start || start >= endWindow || start < startOfToday) continue;
    const dtend = get("DTEND");
    const end = dtend ? parseICalDate(dtend) : null;
    const allDay = dtstart.replace(/[^0-9TZ]/g, "").length === 8;
    const date = start.getFullYear() + "-" +
      String(start.getMonth() + 1).padStart(2, "0") + "-" +
      String(start.getDate()).padStart(2, "0");
    events.push({ summary, start: allDay ? null : start.toISOString(), end: end ? end.toISOString() : null, allDay, date });
  }
  events.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    if (a.allDay && !b.allDay) return -1;
    if (!a.allDay && b.allDay) return 1;
    return new Date(a.start || 0) - new Date(b.start || 0);
  });
  return events.slice(0, 100);
}

function parseICalDate(str) {
  const clean = str.replace(/[^0-9TZ]/g, "");
  if (clean.length >= 15) {
    const y = clean.slice(0, 4), mo = clean.slice(4, 6), d = clean.slice(6, 8);
    const h = clean.slice(9, 11), mi = clean.slice(11, 13), s = clean.slice(13, 15);
    if (clean.endsWith("Z")) return new Date(y + "-" + mo + "-" + d + "T" + h + ":" + mi + ":" + s + "Z");
    return new Date(y + "-" + mo + "-" + d + "T" + h + ":" + mi + ":" + s);
  }
  if (clean.length >= 8) {
    const y = clean.slice(0, 4), mo = clean.slice(4, 6), d = clean.slice(6, 8);
    return new Date(y + "-" + mo + "-" + d + "T00:00:00");
  }
  return null;
}

// --- Status API ---
const STATUS_CHECKS = [
  { id: "echo",   label: "ECHO Terminal",  url: "http://192.168.12.211:8000/" },
  { id: "hestia", label: "HESTIA",         url: "http://192.168.12.211:8000/api/styx/v3/health" },
  { id: "cakes",  label: "Honeybee Cakes", url: "http://192.168.12.240:4322/", insecure: false },
  { id: "sputnik",label: "Sputnik",        url: "http://localhost:3080/" },
  { id: "pve",    label: "Proxmox (PVE)",  url: "https://192.168.12.70:8006/", insecure: true },
  { id: "claude", label: "Claude API",     url: "https://api.anthropic.com/" },
];

let statusCache = null;
let statusCacheTime = 0;
const STATUS_CACHE_TTL = 30000;

function checkService(svc) {
  return new Promise((resolve) => {
    const start = Date.now();
    let u;
    try { u = new URL(svc.url); } catch {
      return resolve({ id: svc.id, label: svc.label, status: "down", ms: 0 });
    }
    const mod = u.protocol === "https:" ? https : http;
    const options = {
      hostname: u.hostname,
      port: u.port || (u.protocol === "https:" ? 443 : 80),
      path: u.pathname || "/",
      method: "HEAD",
      timeout: 4000,
    };
    if (svc.insecure) options.rejectUnauthorized = false;
    const req = mod.request(options, (res) => {
      req.destroy();
      resolve({ id: svc.id, label: svc.label, status: "up", ms: Date.now() - start });
    });
    req.on("timeout", () => {
      req.destroy();
      resolve({ id: svc.id, label: svc.label, status: "down", ms: 4000 });
    });
    req.on("error", () => {
      resolve({ id: svc.id, label: svc.label, status: "down", ms: Date.now() - start });
    });
    req.end();
  });
}

app.get("/api/status", async (req, res) => {
  const now = Date.now();
  if (statusCache && (now - statusCacheTime) < STATUS_CACHE_TTL) {
    return res.json(statusCache);
  }
  const results = await Promise.all(STATUS_CHECKS.map(checkService));
  statusCache = results;
  statusCacheTime = now;
  res.json(results);
});

// --- SPA routes ---
app.get("/settings", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "settings.html"));
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Catch-all 404
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.listen(PORT, () => {
  console.log("SPUTNIK running on port " + PORT);
});
