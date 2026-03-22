// --- SPUTNIK Dashboard ---

let todos = [];
let grocery = [];
let ideas = [];
let settings = {};
let calendarEvents = null;
let calendarDays = 7;
const CATEGORIES = ['Dustin', 'Darwin', 'Levi', 'House'];

async function init() {
  settings = await api('GET', '/api/settings');
  await Promise.all([loadTodos(), loadGrocery(), loadIdeas(), loadWeather(), loadCalendar(), loadStatus(false)]);
  updateRefreshTime();
}

const BASE = '';
async function api(method, url, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(BASE + url, opts);
  if (res.status === 204) return null;
  return res.json();
}

// --- To-Do ---
async function loadTodos() {
  todos = await api('GET', '/api/todos');
  renderTodos();
}

function renderTodos() {
  for (const cat of CATEGORIES) {
    const col = document.getElementById('todo-col-' + cat);
    const items = todos.filter(t => t.category === cat);
    if (items.length === 0) {
      col.innerHTML = '<div class="empty-state">\u2014</div>';
    } else {
      col.innerHTML = items.map(t => {
        const urgent = t.text.startsWith('!!');
        const urgentClass = urgent ? ' urgent' : '';
        const doneClass = t.done ? ' done' : '';
        return '<div class="list-item' + urgentClass + '">' +
          '<input type="checkbox"' + (t.done ? ' checked' : '') + ' onchange="toggleTodo(\'' + t.id + '\', this.checked)">' +
          '<span class="item-text' + doneClass + '">' + esc(t.text) + '</span>' +
          '<button class="item-delete" onclick="deleteTodo(\'' + t.id + '\')">&times;</button>' +
          '</div>';
      }).join('');
    }
  }
  if (calendarEvents !== null) renderCalendar();
}

async function addTodo() {
  const input = document.getElementById('todo-input');
  const cat = document.getElementById('todo-category').value;
  const text = input.value.trim();
  if (!text) return;
  await api('POST', '/api/todos', { text, category: cat });
  input.value = '';
  await loadTodos();
}

async function toggleTodo(id, done) {
  await api('PATCH', '/api/todos/' + id, { done });
  await loadTodos();
}

async function deleteTodo(id) {
  await api('DELETE', '/api/todos/' + id);
  await loadTodos();
}

async function resetDone(category) {
  await api('POST', '/api/todos/reset-done/' + category);
  await loadTodos();
}

// --- Grocery ---
async function loadGrocery() {
  grocery = await api('GET', '/api/grocery');
  renderGrocery();
}

function renderGrocery() {
  const el = document.getElementById('grocery-list');
  if (grocery.length === 0) {
    el.innerHTML = '<div class="empty-state">List is empty</div>';
    return;
  }
  el.innerHTML = grocery.map(i =>
    '<div class="list-item">' +
    '<input type="checkbox"' + (i.done ? ' checked' : '') + ' onchange="toggleGrocery(\'' + i.id + '\', this.checked)">' +
    '<span class="item-text' + (i.done ? ' done' : '') + '">' + esc(i.text) + '</span>' +
    '<button class="item-delete" onclick="deleteGrocery(\'' + i.id + '\')">&times;</button>' +
    '</div>'
  ).join('');
}

async function addGrocery() {
  const input = document.getElementById('grocery-input');
  const text = input.value.trim();
  if (!text) return;
  await api('POST', '/api/grocery', { text });
  input.value = '';
  await loadGrocery();
}

async function toggleGrocery(id, done) {
  await api('PATCH', '/api/grocery/' + id, { done });
  await loadGrocery();
}

async function deleteGrocery(id) {
  await api('DELETE', '/api/grocery/' + id);
  await loadGrocery();
}

// --- Ideas ---
async function loadIdeas() {
  ideas = await api('GET', '/api/ideas');
  renderIdeas();
}

function renderIdeas() {
  const el = document.getElementById('ideas-list');
  if (ideas.length === 0) {
    el.innerHTML = '<div class="empty-state">No ideas yet \u2014 add one above</div>';
    return;
  }
  el.innerHTML = ideas.map(i =>
    '<div class="list-item">' +
    '<span class="item-text">' + esc(i.text) + '</span>' +
    '<button class="item-delete" onclick="deleteIdea(\'' + i.id + '\')">&times;</button>' +
    '</div>'
  ).join('');
}

async function addIdea() {
  const input = document.getElementById('ideas-input');
  const text = input.value.trim();
  if (!text) return;
  await api('POST', '/api/ideas', { text });
  input.value = '';
  await loadIdeas();
}

async function deleteIdea(id) {
  await api('DELETE', '/api/ideas/' + id);
  await loadIdeas();
}

// --- Weather (Open-Meteo) ---
async function loadWeather() {
  const el = document.getElementById('weather-widget');
  const lat = settings.weather && settings.weather.latitude ? settings.weather.latitude : 41.2586;
  const lon = settings.weather && settings.weather.longitude ? settings.weather.longitude : -96.0498;
  const name = settings.weather && settings.weather.location_name ? settings.weather.location_name : 'Omaha, NE';

  try {
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon +
      '&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code' +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min' +
      '&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America/Chicago&forecast_days=5';

    const data = await fetch(url).then(r => r.json());
    const cur = data.current;
    const daily = data.daily;

    const weatherDesc = weatherCodeToText(cur.weather_code);
    const weatherIcon = weatherCodeToIcon(cur.weather_code);

    el.innerHTML =
      '<div class="weather-current">' +
        '<span class="weather-icon">' + weatherIcon + '</span>' +
        '<div>' +
          '<div class="weather-temp">' + Math.round(cur.temperature_2m) + '&deg;F</div>' +
          '<div class="weather-desc">' + weatherDesc + ' &mdash; ' + esc(name) + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="weather-details">' +
        '<span>Humidity: ' + cur.relative_humidity_2m + '%</span>' +
        '<span>Wind: ' + Math.round(cur.wind_speed_10m) + ' mph</span>' +
      '</div>' +
      '<div class="forecast">' +
        daily.time.map(function(d, i) {
          return '<div class="forecast-day">' +
            '<div class="day-name">' + (i === 0 ? 'Today' : new Date(d + 'T12:00').toLocaleDateString('en-US', { weekday: 'short' })) + '</div>' +
            '<div>' + weatherCodeToIcon(daily.weather_code[i]) + '</div>' +
            '<div class="day-temp">' + Math.round(daily.temperature_2m_max[i]) + '&deg; / ' + Math.round(daily.temperature_2m_min[i]) + '&deg;</div>' +
            '</div>';
        }).join('') +
      '</div>';
  } catch (e) {
    el.innerHTML = '<div class="empty-state">Weather unavailable</div>';
  }
}

// --- Calendar (iCal via server proxy) ---
function toggleCalendarView() {
  calendarDays = calendarDays === 7 ? 30 : 7;
  const btn = document.getElementById('cal-view-btn');
  if (btn) btn.textContent = calendarDays === 7 ? '30d' : '7d';
  loadCalendar();
}

async function loadCalendar() {
  const el = document.getElementById('calendar-widget');
  const icalUrl = settings.google_calendar && settings.google_calendar.ical_url;

  if (!icalUrl) {
    calendarEvents = [];
    renderCalendar();
    return;
  }

  try {
    const result = await api('GET', '/api/calendar?days=' + calendarDays);
    calendarEvents = (result && result.events) ? result.events : (Array.isArray(result) ? result : []);
    renderCalendar();
  } catch (e) {
    el.innerHTML = '<div class="empty-state">Calendar error \u2014 check iCal URL in Settings</div>';
  }
}

function renderCalendar() {
  const el = document.getElementById('calendar-widget');
  if (!el) return;

  const icalUrl = settings.google_calendar && settings.google_calendar.ical_url;

  // Urgent todos: !! prefix, not done — pinned at top
  const urgentTodos = todos.filter(function(t) { return t.text.startsWith('!!') && !t.done; });

  let urgentHtml = '';
  if (urgentTodos.length > 0) {
    urgentHtml = '<div class="cal-urgent-header">!! Priority</div>' +
      urgentTodos.map(function(t) {
        return '<div class="cal-event cal-urgent">' +
          '<span class="cal-time">!!</span>' +
          '<span class="cal-title">' + esc(t.text.replace(/^!!/, '').trim()) + '</span>' +
          '</div>';
      }).join('');
  }

  if (!icalUrl && urgentTodos.length === 0) {
    el.innerHTML = '<div class="empty-state">Configure Google Calendar in <a href="/sputnik/settings" style="color: var(--accent);">Settings</a></div>';
    return;
  }

  const events = calendarEvents || [];
  let eventsHtml = '';
  if (events.length > 0) {
    // Group by date
    const byDate = {};
    for (const ev of events) {
      const key = ev.date || (ev.start ? ev.start.slice(0, 10) : 'unknown');
      if (!byDate[key]) byDate[key] = [];
      byDate[key].push(ev);
    }
    const today = new Date();
    const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    eventsHtml = Object.keys(byDate).sort().map(function(dateKey) {
      const d = new Date(dateKey + 'T12:00:00');
      const dayLabel = dateKey === todayStr ? 'Today' :
        d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      const evHtml = byDate[dateKey].map(function(ev) {
        const time = ev.allDay ? 'All day' : new Date(ev.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        return '<div class="cal-event">' +
          '<span class="cal-time">' + time + '</span>' +
          '<span class="cal-title">' + esc(ev.summary) + '</span>' +
          '</div>';
      }).join('');
      return '<div class="cal-day-header">' + dayLabel + '</div>' + evHtml;
    }).join('');
  } else if (urgentTodos.length === 0) {
    eventsHtml = '<div class="cal-no-events">No events in the next ' + calendarDays + ' days</div>';
  }

  el.innerHTML = urgentHtml + eventsHtml;
}

// --- System Status ---
async function loadStatus(forceRefresh) {
  const el = document.getElementById('status-widget');
  if (!el) return;
  const url = forceRefresh ? '/api/status?bust=' + Date.now() : '/api/status';
  try {
    const results = await api('GET', url);
    renderStatus(results);
  } catch (e) {
    el.innerHTML = '<div class="empty-state">Status unavailable</div>';
  }
}

function renderStatus(results) {
  const el = document.getElementById('status-widget');
  if (!el || !Array.isArray(results)) return;
  el.innerHTML = '<div class="status-grid">' +
    results.map(function(svc) {
      const dot = svc.status === 'up' ? 'up' : 'down';
      const ms = svc.status === 'up' ? '<span class="status-ms">' + svc.ms + 'ms</span>' : '<span class="status-ms status-ms-down">down</span>';
      return '<div class="status-item">' +
        '<span class="status-dot ' + dot + '"></span>' +
        '<span class="status-label">' + esc(svc.label) + '</span>' +
        ms +
        '</div>';
    }).join('') +
    '</div>';
}

// --- Helpers ---
function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function weatherCodeToText(code) {
  const map = {
    0: 'Clear', 1: 'Mostly Clear', 2: 'Partly Cloudy', 3: 'Overcast',
    45: 'Fog', 48: 'Freezing Fog',
    51: 'Light Drizzle', 53: 'Drizzle', 55: 'Heavy Drizzle',
    61: 'Light Rain', 63: 'Rain', 65: 'Heavy Rain',
    71: 'Light Snow', 73: 'Snow', 75: 'Heavy Snow',
    77: 'Snow Grains', 80: 'Light Showers', 81: 'Showers', 82: 'Heavy Showers',
    85: 'Light Snow Showers', 86: 'Snow Showers',
    95: 'Thunderstorm', 96: 'Thunderstorm + Hail', 99: 'Heavy Thunderstorm + Hail'
  };
  return map[code] || 'Unknown';
}

function weatherCodeToIcon(code) {
  if (code === 0) return '\u2600\uFE0F';
  if (code <= 2) return '\u26C5';
  if (code === 3) return '\u2601\uFE0F';
  if (code <= 48) return '\uD83C\uDF2B\uFE0F';
  if (code <= 55) return '\uD83C\uDF26\uFE0F';
  if (code <= 65) return '\uD83C\uDF27\uFE0F';
  if (code <= 77) return '\u2744\uFE0F';
  if (code <= 82) return '\uD83C\uDF26\uFE0F';
  if (code <= 86) return '\uD83C\uDF28\uFE0F';
  return '\u26A1';
}

// --- Enter key support ---
document.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && e.target.id === 'todo-input') addTodo();
  if (e.key === 'Enter' && e.target.id === 'grocery-input') addGrocery();
  if (e.key === 'Enter' && e.target.id === 'ideas-input') addIdea();
});

function updateRefreshTime() {
  const el = document.getElementById('last-refresh');
  if (!el) return;
  const now = new Date();
  el.textContent = 'Last refresh: ' + now.toLocaleTimeString('en-US', {hour:'numeric', minute:'2-digit', hour12:true});
}

// --- Boot ---
init();
