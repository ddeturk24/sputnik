// --- SPUTNIK Bookmarks ---

let allBookmarks = [];

async function loadBookmarks() {
  const res = await fetch('/api/bookmarks');
  allBookmarks = await res.json() || [];
  renderBookmarks(allBookmarks);
}

function renderBookmarks(bookmarks) {
  const container = document.getElementById('bm-container');

  if (bookmarks.length === 0) {
    container.innerHTML = '<div class="bookmarks-empty">No bookmarks yet. Go to <a href="/settings" style="color: var(--accent);">Settings</a> to import some.</div>';
    return;
  }

  const groups = {};
  for (const bm of bookmarks) {
    const cat = bm.category || 'General';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(bm);
  }

  const sortedCats = Object.keys(groups).sort((a, b) => {
    if (a === 'General') return 1;
    if (b === 'General') return -1;
    return a.localeCompare(b);
  });

  container.innerHTML = sortedCats.map(cat => {
    const cardsHTML = groups[cat].map(bm => {
      const faviconUrl = 'https://www.google.com/s2/favicons?domain=' + encodeURIComponent(bm.url) + '&sz=16';
      return `<div class="bookmark-card">
        <img class="bookmark-favicon" src="${faviconUrl}" onerror="this.style.display='none'" alt="">
        <a href="${escAttr(bm.url)}" target="_blank" rel="noopener" title="${escAttr(bm.url)}">${esc(bm.title)}</a>
        <button class="bookmark-delete" onclick="deleteBookmark('${bm.id}')" title="Remove">&times;</button>
      </div>`;
    }).join('');
    return `<div class="bookmarks-section">
      <div class="bookmarks-section-header">${esc(cat)} <span style="color: var(--text-dim); font-weight: 400;">(${groups[cat].length})</span></div>
      <div class="bookmarks-grid">${cardsHTML}</div>
    </div>`;
  }).join('');
}

function filterBookmarks(query) {
  if (!query.trim()) { renderBookmarks(allBookmarks); return; }
  const q = query.toLowerCase();
  const filtered = allBookmarks.filter(bm =>
    bm.title.toLowerCase().includes(q) ||
    bm.url.toLowerCase().includes(q) ||
    (bm.category || '').toLowerCase().includes(q)
  );
  renderBookmarks(filtered);
}

async function addBookmark() {
  const title = document.getElementById('bm-new-title').value.trim();
  const url = document.getElementById('bm-new-url').value.trim();
  const category = document.getElementById('bm-new-cat').value.trim() || 'General';

  if (!url.startsWith('http')) { alert('Enter a valid URL starting with http.'); return; }

  await fetch('/api/bookmarks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: title || url, url, category })
  });

  document.getElementById('bm-new-title').value = '';
  document.getElementById('bm-new-url').value = '';
  document.getElementById('bm-new-cat').value = '';
  hideAddForm();
  await loadBookmarks();
}

async function deleteBookmark(id) {
  await fetch(`/api/bookmarks/${id}`, { method: 'DELETE' });
  await loadBookmarks();
}

function showAddForm() {
  document.getElementById('bm-add-form').style.display = 'block';
  document.getElementById('bm-new-url').focus();
}

function hideAddForm() {
  document.getElementById('bm-add-form').style.display = 'none';
}

function esc(s) {
  var d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function escAttr(s) {
  return s.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.getElementById('bm-new-url') === document.activeElement) addBookmark();
});

loadBookmarks();
