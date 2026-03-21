// --- SPUTNIK Settings ---

const BASE = '';

async function loadSettings() {
  const res = await fetch(BASE + '/api/settings');
  const s = await res.json();

  document.getElementById('gcal-ical-url').value = s.google_calendar?.ical_url || '';
  document.getElementById('weather-name').value = s.weather?.location_name || '';
  document.getElementById('weather-lat').value = s.weather?.latitude || '';
  document.getElementById('weather-lon').value = s.weather?.longitude || '';
}

async function saveSettings() {
  const data = {
    google_calendar: {
      ical_url: document.getElementById('gcal-ical-url').value.trim()
    },
    weather: {
      location_name: document.getElementById('weather-name').value.trim(),
      latitude: parseFloat(document.getElementById('weather-lat').value) || 41.2586,
      longitude: parseFloat(document.getElementById('weather-lon').value) || -96.0498
    }
  };

  await fetch(BASE + '/api/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  document.getElementById('settings-status').textContent = 'Settings saved.';
  setTimeout(() => {
    document.getElementById('settings-status').textContent = '';
  }, 3000);
}

loadSettings();
