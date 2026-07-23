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
.entry { cursor: grab; }
.entry:active { cursor: grabbing; }
.entry.drag-over { border-top: 2px solid #ff8844; }
.entry.dragging { opacity: 0.4; }
.entry.pending { background: #221100; border-left: 3px solid #ccaa44; }
.entry.pending .text { color: #ddcc88; }
.entry.editing { background: #330000; border-left: 3px solid #ff6666; }
.entry.editing .text { color: #ffcccc; font-weight: bold; }
.pending-mark { color: #ccaa44; margin-right: 4px; font-size: 0.7rem; }
.editing-mark { color: #ff6666; margin-right: 4px; font-size: 0.7rem; }
.pending-bar { margin-top: 16px; display: none; gap: 10px; align-items: center; flex-wrap: wrap; }
.pending-bar.active { display: flex; }
.pending-count { font-size: 0.75rem; color: #ccaa44; }
.btn-save { background: #224400; border-color: #448800; }
.btn-save:hover { background: #336600; }
.btn-disc { background: #442200; border-color: #885500; }
.btn-disc:hover { background: #663300; }
.pic-preview { display: none; margin-top: 4px; max-width: 120px; max-height: 90px; border: 1px solid #442222; background: #0a0000; object-fit: contain; border-radius: 2px; }
.field-row.pic-row { background: #110505; padding: 8px; border: 1px dashed #442222; border-radius: 3px; }
.btn-fetch { font-size: 0.85rem; padding: 6px 10px; margin-left: 4px; background: #222200; border: 2px outset #666600; color: #ddcc88; cursor: pointer; vertical-align: middle; line-height: 1; }
.btn-fetch:hover { background: #333300; border-style: inset; }
.btn-fetch:disabled { opacity: 0.4; cursor: default; border-style: inset; }
.admin-layout { display: flex; gap: 20px; align-items: flex-start; width: 100%; }
.admin-left { flex: 1; min-width: 0; max-width: 480px; position: sticky; top: 16px; }
.admin-right { flex: 1; min-width: 0; max-height: calc(100vh - 120px); overflow-y: auto; }
@media (max-width: 800px) {
  .admin-layout { flex-direction: column; }
  .admin-left { position: static; max-width: none; }
  .admin-right { max-height: none; }
}
body.admin-page { max-width: 960px; }
</style>
</head>
<body class="admin-page">
<h1>&#x1F339; ROSE DATABASE <span>&#x2699;&#xFE0F; ADMIN</span></h1>

<div class="admin-layout">
<div class="admin-left">
<div class="form-group">
  <label for="fileSelect">&#x1F4C1; FILE</label>
  <select id="fileSelect">
    <option value="">— select a file —</option>
  </select>
</div>

<div class="fields" id="fields">
  <div id="fieldContainer"></div>
  <div class="btn-row">
    <button class="btn" id="btnAdd">&#x2795; ADD ENTRY</button>
    <button class="btn btn-sub" id="btnClear">&#x1F5D1;&#xFE0F; CLEAR</button>
  </div>
  <div class="pending-bar" id="pendingBar">
    <span class="pending-count" id="pendingCount"></span>
    <button class="btn btn-save" id="btnSaveAll">&#x1F4BE; SAVE ALL</button>
    <button class="btn btn-disc" id="btnDiscard">&#x1F5D1;&#xFE0F; DISCARD</button>
  </div>
  <div id="status"></div>
</div>
</div>
<div class="admin-right">
  <div class="entries" id="entries">
    <h3>&#x1F4CB; EXISTING ENTRIES</h3>
    <div id="entriesList"></div>
  </div>
</div>
</div>
  <p style="margin-top:20px;color:#664444;font-size:0.7rem"><a href="/" target="_blank" style="color:#885555">&#x1F339; &#x2190; back to site</a></p>
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
let pendingChanges = [];
let suppressingQueue = false;

const FILE_EMOJIS = {
  'models-3d.json': '\ud83d\udcbe', 'avatar-prefabs.json': '\ud83d\udce6',
  'world-prefabs.json': '\ud83d\udce6', 'shaders.json': '\ud83d\uddbc\ufe0f',
  'tools.json': '\ud83d\udee0\ufe0f', 'luxury-trash.json': '\ud83d\udcb0',
  'useful-things.json': '\ud83d\udc96', 'asset-websites.json': '\ud83c\udf10',
};

fetch('/api/files').then(r => r.json()).then(files => {
  files.forEach(f => {
    const opt = document.createElement('option');
    opt.value = f;
    const emoji = FILE_EMOJIS[f] || '';
    opt.textContent = (emoji ? emoji + ' ' : '') + f.replace('.json', '').replace(/-/g, ' ').toUpperCase();
    sel.appendChild(opt);
  });
});

async function loadEntries() {
  const resp = await fetch('/api/rows?file=' + encodeURIComponent(currentFile));
  let rows = await resp.json();
  // apply reorder if pending
  const reorder = pendingChanges.find(p => p.type === 'reorder' && p.file === currentFile);
  if (reorder) rows = reorder.rows;
  entriesList.innerHTML = rows.map((r, i) => {
    const pending = pendingChanges.find(p => p.type !== 'reorder' && p.file === currentFile && p.index === i);
    const display = pending ? pending.row : r;
    const preview = display.slice(0, 3).filter(Boolean).join(' | ');
    const isEditing = editIndex === i;
    let cls = '';
    if (isEditing) cls = ' editing';
    else if (pending) cls = ' pending';
    return '<div class="entry' + cls + '" draggable="true" data-index="' + i + '">' +
      '<span class="idx">' + (i + 1) + '</span>' +
      (isEditing ? '<span class="editing-mark">&#x25B6;&#xFE0F;</span>' : '') +
      (pending && !isEditing ? '<span class="pending-mark">&#x270F;&#xFE0F;</span>' : '') +
      '<span class="text">' + escapeHtml(preview || '') + '</span>' +
      '<button class="btn-del" data-index="' + i + '">&#x274C;</button></div>';
  }).join('');
  entriesDiv.classList.add('active');

  // drag and drop
  let dragSrcIdx = null;
  entriesList.querySelectorAll('.entry').forEach(e => {
    e.addEventListener('dragstart', (ev) => {
      dragSrcIdx = parseInt(e.dataset.index, 10);
      e.classList.add('dragging');
      ev.dataTransfer.effectAllowed = 'move';
    });
    e.addEventListener('dragend', () => { e.classList.remove('dragging'); dragSrcIdx = null; });
    e.addEventListener('dragover', (ev) => {
      ev.preventDefault();
      ev.dataTransfer.dropEffect = 'move';
      entriesList.querySelectorAll('.entry').forEach(x => x.classList.remove('drag-over'));
      e.classList.add('drag-over');
    });
    e.addEventListener('dragleave', () => { e.classList.remove('drag-over'); });
    e.addEventListener('drop', async (ev) => {
      ev.preventDefault();
      entriesList.querySelectorAll('.entry').forEach(x => x.classList.remove('drag-over', 'dragging'));
      if (dragSrcIdx === null || dragSrcIdx === parseInt(e.dataset.index, 10)) return;
      const toIdx = parseInt(e.dataset.index, 10);
      // fetch current rows, reorder, store as pending reorder
      const resp = await fetch('/api/rows?file=' + encodeURIComponent(currentFile));
      const allRows = await resp.json();
      const [moved] = allRows.splice(dragSrcIdx, 1);
      allRows.splice(toIdx, 0, moved);
      // queue reorder as pending: shift all indexes
      const file = currentFile;
      // remove any existing pending edits for this file (they'll be stale after reorder)
      pendingChanges = pendingChanges.filter(p => p.file !== file);
      // store the full reordered rows
      pendingChanges.push({ type: 'reorder', file, rows: allRows });
      // reset edit mode
      editIndex = -1;
      btnAdd.innerHTML = '&#x2795; ADD ENTRY';
      container.querySelectorAll('input').forEach(inp => inp.value = '');
      updatePendingUI();
    });
  });
}

function escapeHtml(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function fillForm(row) {
  suppressingQueue = true;
  container.querySelectorAll('input').forEach((inp, i) => {
    inp.value = row[i] || '';
    if (inp.dataset.isPic) {
      const evt = new Event('input');
      inp.dispatchEvent(evt);
    }
  });
  suppressingQueue = false;
}

function getFormRow() {
  return Array.from(container.querySelectorAll('input')).map(inp => inp.value.trim());
}

function queueEdit() {
  if (suppressingQueue || editIndex < 0) return;
  const row = getFormRow();
  if (!row[0]) return;
  const idx = pendingChanges.findIndex(p => p.file === currentFile && p.index === editIndex);
  const change = { file: currentFile, index: editIndex, row, name: row[0] };
  if (idx >= 0) pendingChanges[idx] = change;
  else pendingChanges.push(change);
  updatePendingUI();
}

function updatePendingUI() {
  const n = pendingChanges.length;
  document.getElementById('pendingBar').classList.toggle('active', n > 0);
  document.getElementById('pendingCount').innerHTML = '&#x270F;&#xFE0F; ' + n + ' pending change' + (n > 1 ? 's' : '');
  loadEntries();
}

sel.addEventListener('change', async () => {
  if (!sel.value) { fields.classList.remove('active'); entriesDiv.classList.remove('active'); return; }
  currentFile = sel.value;
  editIndex = -1;
  btnAdd.innerHTML = '&#x2795; ADD ENTRY';
  const h = await (await fetch('/api/headers?file=' + encodeURIComponent(currentFile))).json();
  currentHeaders = h;
  container.innerHTML = '';
  const isPic = (h) => /picture|preview|image/i.test(h);
  const isLink = (h) => /link|website|download/i.test(h);
  const inputs = [];
  h.forEach((header, i) => {
    const div = document.createElement('div');
    div.className = 'field-row' + (isPic(header) ? ' pic-row' : '');
    const label = document.createElement('label');
    label.textContent = header;
    const input = document.createElement('input');
    input.placeholder = header;
    input.addEventListener('input', queueEdit);
    if (isPic(header)) {
      input.dataset.isPic = '1';
      input.style.marginBottom = '4px';
      const preview = document.createElement('img');
      preview.className = 'pic-preview';
      preview.alt = 'preview';
      input.addEventListener('input', () => {
        const val = input.value.trim();
        if (val.startsWith('http')) {
          preview.src = val;
          preview.style.display = 'block';
        } else {
          preview.style.display = 'none';
        }
      });
      preview.addEventListener('error', () => { preview.style.display = 'none'; });
      div.appendChild(preview);
    }
    if (isLink(header)) {
      const fetchBtn = document.createElement('button');
      fetchBtn.className = 'btn-fetch';
      fetchBtn.innerHTML = '&#x1F50D;';
      fetchBtn.title = 'Fetch og:image from this URL';
      fetchBtn.type = 'button';
      fetchBtn.addEventListener('click', async () => {
        const val = input.value.trim();
        if (!val.startsWith('http')) { alert('Enter a URL first'); return; }
        fetchBtn.disabled = true;
        try {
          const r = await fetch('/api/fetch-image?url=' + encodeURIComponent(val));
          const d = await r.json();
          if (d.image) {
            const picInp = container.querySelector('[data-is-pic]');
            if (picInp) {
              picInp.value = d.image;
              picInp.dispatchEvent(new Event('input'));
              queueEdit();
            }
          } else {
            alert('No image found at that URL');
          }
        } catch {
          alert('Failed to fetch');
        }
        fetchBtn.disabled = false;
      });
      div.appendChild(fetchBtn);
      // inline style to put button next to input
      input.style.width = 'calc(100% - 40px)';
      input.style.display = 'inline-block';
      input.style.verticalAlign = 'middle';
    }
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
    if (!confirm('&#x274C; Delete entry ' + (index + 1) + '?')) return;
    pendingChanges = pendingChanges.filter(p => !(p.file === currentFile && p.index === index));
    const resp = await fetch('/api/delete', { method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file: currentFile, index }) });
    if (resp.ok) { alert('&#x2705; deleted'); updatePendingUI(); }
    else { const r = await resp.json(); alert('&#x274C; Error: ' + (r.error || 'unknown')); }
    return;
  }
  const rows = await (await fetch('/api/rows?file=' + encodeURIComponent(currentFile))).json();
  if (rows[index]) {
    editIndex = index;
    btnAdd.innerHTML = '&#x270F;&#xFE0F; EDITING...';
    const pending = pendingChanges.find(p => p.file === currentFile && p.index === index);
    fillForm(pending ? pending.row : rows[index]);
    loadEntries();
  }
});

btnClear.addEventListener('click', () => {
  container.querySelectorAll('input').forEach(inp => inp.value = '');
  container.querySelector('input')?.focus();
  editIndex = -1;
  btnAdd.innerHTML = '&#x2795; ADD ENTRY';
  loadEntries();
});

btnAdd.addEventListener('click', async () => {
  if (editIndex >= 0) return;
  const row = getFormRow();
  if (!row[0]) { alert('&#x26A0;&#xFE0F; Name is required'); return; }
  const resp = await fetch('/api/add', { method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file: currentFile, row }) });
  const result = await resp.json();
  if (resp.ok) {
    alert('&#x2705; added: ' + result.name);
    container.querySelectorAll('input').forEach(inp => inp.value = '');
    loadEntries();
  } else {
    alert('&#x274C; Error: ' + (result.error || 'unknown'));
  }
});

document.getElementById('btnSaveAll').addEventListener('click', async () => {
  if (pendingChanges.length === 0) return;
  let ok = 0, fail = 0;
  // apply reorders first, then edits
  for (const p of pendingChanges) {
    try {
      if (p.type === 'reorder') {
        const resp = await fetch('/api/reorder', { method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file: p.file, rows: p.rows }) });
        if (resp.ok) ok++; else fail++;
      } else {
        const resp = await fetch('/api/update', { method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file: p.file, index: p.index, row: p.row }) });
        if (resp.ok) ok++; else fail++;
      }
    } catch { fail++; }
  }
  pendingChanges = [];
  updatePendingUI();
  alert(fail === 0 ? '&#x2705; Saved ' + ok + ' change' + (ok > 1 ? 's' : '') : '&#x26A0;&#xFE0F; ' + ok + ' saved, ' + fail + ' failed');
  btnAdd.innerHTML = '&#x2795; ADD ENTRY';
  editIndex = -1;
  container.querySelectorAll('input').forEach(inp => inp.value = '');
  loadEntries();
});

document.getElementById('btnDiscard').addEventListener('click', () => {
  if (pendingChanges.length === 0) return;
  if (!confirm('&#x274C; Discard ' + pendingChanges.length + ' pending change' + (pendingChanges.length > 1 ? 's' : '') + '?')) return;
  pendingChanges = [];
  updatePendingUI();
  editIndex = -1;
  btnAdd.innerHTML = '&#x2795; ADD ENTRY';
  container.querySelectorAll('input').forEach(inp => inp.value = '');
  loadEntries();
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

  // API: fetch og:image from a URL
  if (pathname === '/api/fetch-image') {
    const targetUrl = url.searchParams.get('url');
    if (!targetUrl) { res.writeHead(400); res.end('{"error":"missing url"}'); return; }
    const base = new URL(targetUrl).origin;
    const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    fetch(targetUrl, { signal: AbortSignal.timeout(8000), headers: { 'User-Agent': UA } })
      .then(r => r.text())
      .then(async (html) => {
        // og:image
        let img = (html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/)
          || html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/))?.[1];
        if (img) { resolveImg(); return; }
        // apple-touch-icon (PNG)
        const apple = html.match(/<link[^>]+rel="apple-touch-icon"[^>]+href="([^"]+)"/);
        if (apple) { img = apple[1]; resolveImg(); return; }
        // favicon - prefer .png
        const icons = [...html.matchAll(/<link[^>]+rel="(?:shortcut )?icon"[^>]+href="([^"]+)"/g)];
        const pngIcon = icons.find(i => i[1].includes('.png'));
        if (pngIcon) { img = pngIcon[1]; resolveImg(); return; }
        if (icons.length) { img = icons[0][1]; resolveImg(); return; }
        // last resort: Google favicon service or /favicon.ico
        try {
          const ico = base + '/favicon.ico';
          const icoresp = await fetch(ico, { method: 'HEAD', signal: AbortSignal.timeout(3000), headers: { 'User-Agent': UA } });
          if (icoresp.ok) { const ct = icoresp.headers.get('content-type') || ''; if (ct.includes('image')) img = ico; }
        } catch {}
        if (!img) img = 'https://www.google.com/s2/favicons?domain=' + base.replace(/https?:\/\//, '') + '&sz=64';
        resolveImg();

        function resolveImg() {
          if (img && !img.startsWith('http')) img = new URL(img, base).href;
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ image: img || '' }));
        }
      })
      .catch(() => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ image: '' }));
      });
    return;
  }

  if (pathname === '/api/reorder' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { file, rows } = JSON.parse(body);
        if (!file || !rows) { res.writeHead(400); res.end('{"error":"invalid data"}'); return; }
        const filePath = path.join(dataDir, file);
        if (!fs.existsSync(filePath)) { res.writeHead(404); res.end('{"error":"file not found"}'); return; }
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        data.rows = rows;
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
