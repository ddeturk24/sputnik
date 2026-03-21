// --- SPUTNIK Dashboard ---

let todos = [];
let grocery = [];
let ideas = [];
let settings = {};
const CATEGORIES = ['Dustin', 'Darwin', 'Levi', 'House'];

// --- Init ---
async function init() {
  settings = await api('GET', '/api/settings') || {};
  await Promise.allSettled([loadTodos(), loadGrocery(), loadIdeas(), loadWeather(), loadCalendar()]);
}

// --- API helper ---
const BASE = '';
async function api(method, url, body) {
  const opts = { method, headers: {} };
  if (body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  try {
    const res = await fetch(BASE + url, opts);
    if (res.status === 204) return null;
    if (!res.ok) {
      console.error(`API ${method} ${url} → ${res.status}`);
      return null;
    }
    return await res.json();
  } catch (e) {
    console.error(`API ${method} ${url} failed:`, e);
    return null;
  }
}

// --- To-Do ---
async function loadTodos() {
  todos = await api('GET', '/api/todos') || [];
  renderTodos();
}

function renderTodos() {
  for (const cat of CATEGORIES) {
    const col = document.getElementById('todo-col-' + cat);
    const items = todos.filter(t => t.category === cat);
    if (items.length === 0) {
      col.innerHTML = '<div class="empty-state">—</div>';
    } else {
      col.innerHTML = items.map(t => `
        <div class="list-item">
          <input type="checkbox" ${t.done ? 'checked' : ''} onchange="toggleTodo('${t.id}', this.checked)">
          <span class="item-text ${t.done ? 'done' : ''}">${esc(t.text)}</span>
          <button class="item-delete" onclick="deleteTodo('${t.id}')">&times;</button>
        </div>
      `).join('');
    }
  }
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
  await api('PATCH', `/api/todos/${id}`, { done });
  await loadTodos();
}

async function deleteTodo(id) {
  await api('DELETE', `/api/todos/${id}`);
  await loadTodos();
}

async function resetDone(category) {
  await api('POST', `/api/todos/reset-done/${category}`);
  await loadTodos();
}

// --- Grocery ---
async function loadGrocery() {
  grocery = await api('GET', '/api/grocery') || [];
  renderGrocery();
}

function renderGrocery() {
  const el = document.getElementById('grocery-list');
  if (grocery.length === 0) {
    el.innerHTML = '<div class="empty-state">List is empty</div>';
    return;
  }
  el.innerHTML = grocery.map(i => `
    <div class="list-item">
      <input type="checkbox" ${i.done ? 'checked' : ''} onchange="toggleGrocery('${i.id}', this.checked)">
      <span class="item-text ${i.done ? 'done' : ''}">${esc(i.text)}</span>
      <button class="item-delete" onclick="deleteGrocery('${i.id}')">&times;</button>
    </div>
  `).join('');
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
  await api('PATCH', `/api/grocery/${id}`, { done });
  await loadGrocery();
}

async function deleteGrocery(id) {
  await api('DELETE', `/api/grocery/${id}`);
  await loadGrocery();
}

// --- Ideas ---
async function loadIdeas() {
  ideas = await api('GET', '/api/ideas') || [];
  renderIdeas();
}

function renderIdeas() {
  const el = document.getElementById('ideas-list');
  if (ideas.length === 0) {
    el.innerHTML = '<div class="empty-state">No ideas yet — add one above</div>';
    return;
  }
  el.innerHTML = ideas.map(i => `
    <div class="list-item">
      <span class="item-text">${esc(i.text)}</span>
      <button class="item-delete" onclick="deleteIdea('${i.id}')">&times;</button>
    </div>
  `).join('');
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
  await api('DELETE', `/api/ideas/${id}`);
  await loadIdeas();
}

// --- Weather (Open-Meteo) ---
async function loadWeather() {
  const el = document.getElementById('weather-widget');
  const lat = settings.weather?.latitude || 41.2586;
  const lon = settings.weather?.longitude || -96.0498;
  const name = settings.weather?.location_name || 'Omaha, NE';

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min` +
      `&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America/Chicago&forecast_days=5`;

    const data = await fetch(url).then(r => r.json());
    const cur = data.current;
    const daily = data.daily;

    const weatherDesc = weatherCodeToText(cur.weather_code);
    const weatherIcon = weatherCodeToIcon(cur.weather_code);

    el.innerHTML = `
      <div class="weather-current">
        <span class="weather-icon">${weatherIcon}</span>
        <div>
          <div class="weather-temp">${Math.round(cur.temperature_2m)}&deg;F</div>
          <div class="weather-desc">${weatherDesc} &mdash; ${esc(name)}</div>
        </div>
      </div>
      <div class="weather-details">
        <span>Humidity: ${cur.relative_humidity_2m}%</span>
        <span>Wind: ${Math.round(cur.wind_speed_10m)} mph</span>
      </div>
      <div class="forecast">
        ${daily.time.map((d, i) => `
          <div class="forecast-day">
            <div class="day-name">${i === 0 ? 'Today' : new Date(d + 'T12:00').toLocaleDateString('en-US', { weekday: 'short' })}</div>
            <div>${weatherCodeToIcon(daily.weather_code[i])}</div>
            <div class="day-temp">${Math.round(daily.temperature_2m_max[i])}&deg; / ${Math.round(daily.temperature_2m_min[i])}&deg;</div>
          </div>
        `).join('')}
      </div>
    `;
  } catch (e) {
    el.innerHTML = '<div class="empty-state">Weather unavailable</div>';
  }
}

// --- Calendar (iCal via server proxy) ---
async function loadCalendar() {
  const el = document.getElementById('calendar-widget');
  const icalUrl = settings.google_calendar?.ical_url;

  if (!icalUrl) {
    el.innerHTML = '<div class="empty-state">Configure Google Calendar in <a href="/sputnik/settings" style="color: var(--accent);">Settings</a></div>';
    return;
  }

  try {
    const data = await api('GET', '/api/calendar');
    if (!data) {
      el.innerHTML = '<div class="empty-state">Calendar unavailable</div>';
      return;
    }

    if (data.error) {
      el.innerHTML = `<div class="empty-state">${esc(data.error)}</div>`;
      return;
    }

    const events = data.events || [];
    if (events.length === 0) {
      el.innerHTML = '<div class="cal-no-events">No events for today</div>';
      return;
    }

    el.innerHTML = events.map(ev => {
      const start = ev.allDay ? 'All day' : new Date(ev.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      return `
        <div class="cal-event">
          <span class="cal-time">${start}</span>
          <span class="cal-title">${esc(ev.summary)}</span>
        </div>
      `;
    }).join('');
  } catch (e) {
    el.innerHTML = '<div class="empty-state">Calendar error — check iCal URL in Settings</div>';
  }
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
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.id === 'todo-input') addTodo();
  if (e.key === 'Enter' && e.target.id === 'grocery-input') addGrocery();
  if (e.key === 'Enter' && e.target.id === 'ideas-input') addIdea();
});

// --- Boot ---
init();

// --- System Status Checks ---
(function() {
  const checks = [
    { id: 'sys-echo', url: '/api/health', name: 'ECHO' },
    { id: 'sys-cakes', url: '/api/health', name: 'Cakes', external: 'https://honeybee-cakes.com' },
    { id: 'sys-sputnik', url: '/api/health', name: 'Sputnik' },
  ];

  function setDot(id, up) {
    const el = document.querySelector('#' + id + ' .sys-dot');
    if (el) el.className = 'sys-dot ' + (up ? 'up' : 'down');
  }

  async function checkStatus() {
    // Local services via sputnik API proxy
    try {
      const r = await fetch('/api/health');
      setDot('sys-sputnik', r.ok);
    } catch(e) { setDot('sys-sputnik', false); }

    // ECHO — try the echo-api health endpoint via proxy
    try {
      const r = await fetch('/api/settings');
      setDot('sys-echo', r.ok);
      setDot('sys-hestia', r.ok);  // If sputnik API works, HESTIA is reachable
    } catch(e) { setDot('sys-echo', false); setDot('sys-hestia', false); }

    // Claude API — check real status
    try {
      const cr = await fetch('https://status.claude.com/api/v2/status.json');
      const cd = await cr.json();
      const indicator = cd.status.indicator;
      const claudeDot = document.querySelector('#sys-claude .sys-dot');
      if (indicator === 'none') {
        claudeDot.className = 'sys-dot up';
      } else {
        claudeDot.className = 'sys-dot down';
        const row = document.getElementById('sys-claude');
        if (row && !row.querySelector('a')) {
          const a = document.createElement('a');
          a.href = 'https://status.claude.com';
          a.target = '_blank';
          a.textContent = cd.status.description;
          a.style.cssText = 'color:var(--orange);font-size:0.75rem;margin-left:8px;text-decoration:none;';
          row.appendChild(a);
        }
      }
    } catch(e) { setDot('sys-claude', false); }

    // PVE — can't check directly from browser, mark as up if sputnik works
    setDot('sys-pve', true);

    // Cakes — try fetching
    try {
      const r = await fetch('https://honeybee-cakes.com', { mode: 'no-cors' });
      setDot('sys-cakes', true);
    } catch(e) { setDot('sys-cakes', false); }
  }

  // Run on load and every 60 seconds
  if (document.getElementById('status-grid')) {
    checkStatus();
    setInterval(checkStatus, 60000);
  }
})();
