import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const dir = fs.realpathSync(path.join(scriptDir, '..'));
const dataDir = path.join(dir, 'data');
const PORT = 3456;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
};

const skipFiles = ['members.json', 'avatars.json', 'worlds.json', 'art-graphics.json', 'sounds.json'];

function serveFile(res, filePath) {
  const ext = path.extname(filePath);
  const mime = MIME[ext] || 'application/octet-stream';
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': mime });
    res.end(content);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
}

const ADMIN_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ROSE DATABASE — ADMIN</title>
<link href="https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&display=swap" rel="stylesheet">
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: 'Courier Prime', 'Courier New', Courier, monospace;
  background: #0a0000;
  color: #ffcccc;
  padding: 24px;
  max-width: 720px;
  margin: 0 auto;
}
h1 { color: #ff8888; font-size: 1.2rem; margin-bottom: 20px; letter-spacing: 1px; }
h1 span { color: #884444; }
.form-group { margin-bottom: 14px; }
label { display: block; color: #aa6666; font-size: 0.8rem; margin-bottom: 3px; }
select, input, textarea {
  font-family: 'Courier Prime', 'Courier New', Courier, monospace;
  width: 100%;
  padding: 8px 10px;
  background: #1a0000;
  border: 2px inset #660000;
  color: #ffcccc;
  font-size: 0.85rem;
}
select { cursor: pointer; }
select option { background: #1a0000; }
textarea { min-height: 60px; resize: vertical; }
.fields { display: none; }
.fields.active { display: block; }
.field-row { margin-bottom: 10px; }
.field-row label { font-size: 0.75rem; color: #886666; }
.field-row input { font-size: 0.8rem; }
.btn-row { margin-top: 20px; display: flex; gap: 10px; flex-wrap: wrap; }
.btn {
  font-family: 'Courier Prime', 'Courier New', Courier, monospace;
  padding: 10px 24px;
  font-size: 0.85rem;
  font-weight: bold;
  cursor: pointer;
  border: 2px outset #882222;
  background: #440000;
  color: #ffcccc;
  letter-spacing: 1px;
}
.btn:hover { background: #660000; border-style: inset; }
.btn:active { border-style: inset; }
.btn-sub { background: #222200; border-color: #666600; }
.btn-sub:hover { background: #333300; }
#status {
  margin-top: 16px;
  padding: 10px;
  font-size: 0.8rem;
  display: none;
}
#status.ok { display: block; background: #002200; border: 1px solid #006600; color: #88cc88; }
#status.err { display: block; background: #220000; border: 1px solid #660000; color: #cc8888; }
.entries { margin-top: 28px; display: none; }
.entries.active { display: block; }
.entries h3 { color: #aa6666; font-size: 0.85rem; margin-bottom: 10px; letter-spacing: 1px; }
.entry { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-bottom: 1px solid #221111; font-size: 0.78rem; cursor: pointer; }
.entry:hover { background: #1a0505; }
.entry .idx { color: #664444; min-width: 24px; font-size: 0.7rem; }
.entry .text { flex: 1; color: #cc9999; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.entry .btn-del { font-family: inherit; font-size: 0.7rem; padding: 2px 8px; background: #330000; border: 1px outset #662222; color: #aa6666; cursor: pointer; }
.entry .btn-del:hover { background: #550000; color: #ff8888; }
</style>
</head>
<body>
<h1>&#x1F339; ROSE DATABASE <span>— ADMIN</span></h1>

<div class="form-group">
  <label for="fileSelect">FILE</label>
  <select id="fileSelect">
    <option value="">— select a file —</option>
  </select>
</div>

<div class="fields" id="fields">
  <div id="fieldContainer"></div>
  <div class="btn-row">
    <button class="btn" id="btnAdd">ADD ENTRY</button>
    <button class="btn btn-sub" id="btnClear">CLEAR</button>
  </div>
  <div id="status"></div>
  <div class="entries" id="entries">
    <h3>EXISTING ENTRIES</h3>
    <div id="entriesList"></div>
  </div>
  <p style="margin-top:20px;color:#664444;font-size:0.7rem"><a href="/" target="_blank" style="color:#885555">&#x2190; back to site</a></p>
</div>

<script>
const sel = document.getElementById('fileSelect');
const fields = document.getElementById('fields');
const container = document.getElementById('fieldContainer');
const statusEl = document.getElementById('status');
const entriesDiv = document.getElementById('entries');
const entriesList = document.getElementById('entriesList');
const btnAdd = document.getElementById('btnAdd');
const btnClear = document.getElementById('btnClear');

let currentFile = '';
let currentHeaders = [];
let editIndex = -1;

fetch('/api/files').then(r => r.json()).then(files => {
  const fragment = document.createDocumentFragment();
  files.forEach(f => {
    const opt = document.createElement('option');
    opt.value = f;
    opt.textContent = f.replace('.json', '');
    fragment.appendChild(opt);
  });
  sel.appendChild(fragment);
});

async function loadEntries() {
  const resp = await fetch('/api/rows?file=' + encodeURIComponent(currentFile));
  const rows = await resp.json();
  entriesList.innerHTML = rows.map((r, i) => {
    const preview = r.slice(0, 3).filter(Boolean).join(' | ');
    return '<div class="entry" data-index="' + i + '">' +
      '<span class="idx">' + (i + 1) + '</span>' +
      '<span class="text">' + escapeHtml(preview || r[0] || '') + '</span>' +
      '<button class="btn-del" data-index="' + i + '">DELETE</button>' +
      '</div>';
  }).join('');
  entriesDiv.classList.add('active');
}

function escapeHtml(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function fillForm(row) {
  const inputs = container.querySelectorAll('input');
  inputs.forEach((inp, i) => { inp.value = row[i] || ''; });
}

sel.addEventListener('change', async () => {
  if (!sel.value) { fields.classList.remove('active'); entriesDiv.classList.remove('active'); return; }
  currentFile = sel.value;
  editIndex = -1;
  btnAdd.textContent = 'ADD ENTRY';
  const resp = await fetch('/api/headers?file=' + encodeURIComponent(currentFile));
  const h = await resp.json();
  currentHeaders = h;
  container.innerHTML = '';
  h.forEach((header, i) => {
    const div = document.createElement('div');
    div.className = 'field-row';
    const label = document.createElement('label');
    label.textContent = header;
    const input = document.createElement('input');
    input.dataset.index = i;
    input.placeholder = header;
    if (i === 0) input.autofocus = true;
    div.appendChild(label);
    div.appendChild(input);
    container.appendChild(div);
  });
  fields.classList.add('active');
  statusEl.className = '';
  statusEl.style.display = 'none';
  loadEntries();
});

entriesList.addEventListener('click', async (e) => {
  const entry = e.target.closest('.entry');
  const delBtn = e.target.closest('.btn-del');
  if (!entry) return;
  const index = parseInt(entry.dataset.index, 10);
  if (delBtn) {
    if (!confirm('Delete entry ' + (index + 1) + '?')) return;
    const resp = await fetch('/api/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file: currentFile, index }),
    });
    if (resp.ok) {
      alert('deleted');
      loadEntries();
    } else {
      const r = await resp.json();
      alert('Error: ' + (r.error || 'unknown'));
    }
    return;
  }
  // Click on entry → pre-fill for editing
  const resp = await fetch('/api/rows?file=' + encodeURIComponent(currentFile));
  const rows = await resp.json();
  if (rows[index]) {
    editIndex = index;
    btnAdd.textContent = 'UPDATE ENTRY';
    fillForm(rows[index]);
  }
});

btnClear.addEventListener('click', () => {
  container.querySelectorAll('input').forEach(inp => inp.value = '');
  container.querySelector('input')?.focus();
  editIndex = -1;
  btnAdd.textContent = 'ADD ENTRY';
});

btnAdd.addEventListener('click', async () => {
  const inputs = container.querySelectorAll('input');
  const row = Array.from(inputs).map(inp => inp.value.trim());
  if (!row[0]) { alert('Name is required'); return; }
  let resp;
  if (editIndex >= 0) {
    resp = await fetch('/api/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file: currentFile, index: editIndex, row }),
    });
  } else {
    resp = await fetch('/api/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file: currentFile, row }),
    });
  }
  const result = await resp.json();
  if (resp.ok) {
    alert('added: ' + result.name);
    inputs.forEach(inp => inp.value = '');
    inputs[0]?.focus();
    editIndex = -1;
    btnAdd.textContent = 'ADD ENTRY';
    loadEntries();
  } else {
    alert('Error: ' + (result.error || 'unknown'));
  }
});

function showStatus(msg, type) {
  statusEl.className = type;
  statusEl.textContent = msg;
}
</script>
</body>
</html>`;

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // API endpoints
  if (pathname === '/api/files') {
    const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json') && !skipFiles.includes(f));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(files));
    return;
  }

  if (pathname === '/api/headers') {
    const file = url.searchParams.get('file');
    if (!file) { res.writeHead(400); res.end('{"error":"missing file"}'); return; }
    const filePath = path.join(dataDir, file);
    if (!fs.existsSync(filePath)) { res.writeHead(404); res.end('{"error":"not found"}'); return; }
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data.headers));
    return;
  }

  if (pathname === '/api/rows') {
    const file = url.searchParams.get('file');
    if (!file) { res.writeHead(400); res.end('{"error":"missing file"}'); return; }
    const filePath = path.join(dataDir, file);
    if (!fs.existsSync(filePath)) { res.writeHead(404); res.end('{"error":"not found"}'); return; }
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data.rows));
    return;
  }

  if (pathname === '/api/add' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { file, row } = JSON.parse(body);
        if (!file || !row) { res.writeHead(400); res.end('{"error":"invalid data"}'); return; }
        const filePath = path.join(dataDir, file);
        if (!fs.existsSync(filePath)) { res.writeHead(404); res.end('{"error":"file not found"}'); return; }
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        data.rows.push(row);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ name: row[0] || '(unnamed)' }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  if (pathname === '/api/delete' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { file, index } = JSON.parse(body);
        if (!file || index === undefined) { res.writeHead(400); res.end('{"error":"invalid data"}'); return; }
        const filePath = path.join(dataDir, file);
        if (!fs.existsSync(filePath)) { res.writeHead(404); res.end('{"error":"file not found"}'); return; }
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (index < 0 || index >= data.rows.length) { res.writeHead(400); res.end('{"error":"invalid index"}'); return; }
        data.rows.splice(index, 1);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  if (pathname === '/api/update' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { file, index, row } = JSON.parse(body);
        if (!file || index === undefined || !row) { res.writeHead(400); res.end('{"error":"invalid data"}'); return; }
        const filePath = path.join(dataDir, file);
        if (!fs.existsSync(filePath)) { res.writeHead(404); res.end('{"error":"file not found"}'); return; }
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (index < 0 || index >= data.rows.length) { res.writeHead(400); res.end('{"error":"invalid index"}'); return; }
        data.rows[index] = row;
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ name: row[0] || '(unnamed)' }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // Admin page
  if (pathname === '/admin' || pathname === '/add') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(ADMIN_HTML);
    return;
  }

  // Static files
  const filePath = path.join(dir, pathname === '/' ? 'index.html' : pathname);
  serveFile(res, filePath);
});

server.listen(PORT, () => {
  console.log(`\n  ROSE DATABASE — http://localhost:${PORT}\n  ADMIN PAGE — http://localhost:${PORT}/admin\n`);
});
