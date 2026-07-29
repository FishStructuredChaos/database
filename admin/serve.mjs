import http from 'http';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const dir = fs.realpathSync(path.join(scriptDir, '..'));
const dataDir = path.join(dir, 'data');
const siteDir = path.join(dir, 'docs');
const PORT = 3456;
const SUBMIT_ENDPOINT = process.env.SUBMIT_ENDPOINT || '';
const GIST_URL = process.env.GIST_URL || 'https://gist.github.com/FishStructuredChaos/7b0971c63dbb689847b81cdf84299c1f#file-database-pending-files-json';
const GIST_TOKEN = process.env.GITHUB_GIST_TOKEN || '';
const GIST_ID = (() => {
  const m = GIST_URL.match(/gist\.github\.com\/[^/]+\/([a-f0-9]+)/i);
  return m ? m[1] : '';
})();
const GIST_FILENAME = (() => {
  const m = GIST_URL.match(/#file-([^?]+)/i);
  if (!m) return 'database-pending.json';
  let name = decodeURIComponent(m[1]).replace(/\.json$/i, '');
  if (name.toLowerCase().endsWith('-json')) name = name.slice(0, -5) + '.json';
  else name += '.json';
  return name;
})();


const APPROVED_GIST_ID = '56babd51194abfdffa87d11a481c3541';
const APPROVED_GIST_FILENAME = 'database-pending-worlds-avatars-groups.json';

async function writeApprovedGist(submission) {
  if (!GIST_TOKEN) return;
  const headers = {
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'User-Agent': 'rose-database',
    Authorization: `Bearer ${GIST_TOKEN}`,
  };
  try {
    const readResp = await fetch(`https://api.github.com/gists/${APPROVED_GIST_ID}`, { headers });
    if (!readResp.ok) return;
    const gist = await readResp.json();
    const existingContent = gist.files?.[APPROVED_GIST_FILENAME]?.content || '[]';
    let entries;
    try { entries = JSON.parse(existingContent); } catch {}
    if (!Array.isArray(entries)) entries = [];
    entries.push(submission);
    await fetch(`https://api.github.com/gists/${APPROVED_GIST_ID}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ files: { [APPROVED_GIST_FILENAME]: { content: JSON.stringify(entries, null, 2) } } }),
    });
  } catch {}
}

function makeSubmissionId() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

function ensurePendingPayload(data) {
  if (!data || typeof data !== 'object') data = {};
  if (!Array.isArray(data.submissions)) data.submissions = [];
  for (const sub of data.submissions) {
    if (!sub.status) sub.status = 'pending';
  }
  data.schemaVersion = data.schemaVersion || 1;
  data.updatedAt = new Date().toISOString();
  return data;
}

async function loadPendingState(opts = {}) {
  let fileName = GIST_FILENAME;
  let parsed = {};
  let gistOk = false;

  if (GIST_ID) {
    try {
      let rawUrl = `https://gist.githubusercontent.com/FishStructuredChaos/${GIST_ID}/raw/${GIST_FILENAME}`;
      if (opts.forceRefresh) rawUrl += '?_=' + Date.now();
      const resp = await fetch(rawUrl, { headers: { 'User-Agent': 'rose-database' } });
      if (resp.ok) {
        const text = await resp.text();
        if (text) parsed = JSON.parse(text);
        gistOk = true;
      }
    } catch {}
  }

  if (!gistOk) {
    try {
      if (fs.existsSync(PENDING_FILE)) {
        const local = JSON.parse(fs.readFileSync(PENDING_FILE, 'utf8'));
        if (local && typeof local === 'object' && Array.isArray(local.submissions) && local.submissions.length > 0) {
          parsed = local;
        }
      }
    } catch {}
  } else {
    try {
      if (fs.existsSync(PENDING_FILE)) {
        const local = JSON.parse(fs.readFileSync(PENDING_FILE, 'utf8'));
        if (local && typeof local === 'object' && Array.isArray(local.submissions)) {
          for (const localSub of local.submissions) {
            const idx = parsed.submissions.findIndex(s => s.id === localSub.id);
            if (idx >= 0) {
              parsed.submissions[idx].status = localSub.status;
              if (localSub.approvedAt) parsed.submissions[idx].approvedAt = localSub.approvedAt;
              if (localSub.rejectedAt) parsed.submissions[idx].rejectedAt = localSub.rejectedAt;
            }
          }
        }
      }
    } catch {}
  }

  return {
    fileName,
    state: ensurePendingPayload(parsed),
  };
}

async function savePendingState(state, fileName) {
  try {
    fs.writeFileSync(PENDING_FILE, JSON.stringify(state, null, 2) + '\n');
  } catch {}

  if (!GIST_TOKEN) return;

  const clean = {
    schemaVersion: state.schemaVersion || 1,
    updatedAt: new Date().toISOString(),
    submissions: (state.submissions || []).map(s => {
      const { status, approvedAt, rejectedAt, ...rest } = s;
      return rest;
    }),
  };

  const headers = {
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'User-Agent': 'rose-database',
    Authorization: `Bearer ${GIST_TOKEN}`,
  };

  const payload = {
    files: {
      [fileName]: {
        content: JSON.stringify(clean, null, 2),
      },
    },
  };

  const resp = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(payload),
  });

  if (!resp.ok) throw new Error(`Gist write failed: ${resp.status}`);
}

async function addPendingSubmission(submission) {
  const { fileName, state } = await loadPendingState();
  state.submissions.push(submission);
  state.updatedAt = new Date().toISOString();
  await savePendingState(state, fileName);
  return { fileName };
}

function build() {
  try {
    execSync('npx @11ty/eleventy', { cwd: dir, stdio: 'pipe' });
  } catch {}
}

function buildAsync() {
  setTimeout(build, 100);
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

const PENDING_FILE = path.join(dataDir, 'pending-state.json');
const skipFiles = ['info.json', 'members.json', 'avatars.json', 'worlds.json', 'gallery.json', 'sounds.json', 'pending-backup.json', 'pending-state.json'];

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
#status.saving { display: block; background: #221100; border: 1px solid #886600; color: #ddcc88; }
.entries { margin-top: 28px; display: none; }
.entries.active { display: block; }
.entries h3 { color: #aa6666; font-size: 0.85rem; margin-bottom: 10px; letter-spacing: 1px; }
.entry { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-bottom: 1px solid #221111; font-size: 0.78rem; cursor: pointer; }
.entry:hover { background: #1a0505; }
.entry .idx { color: #664444; min-width: 24px; font-size: 0.7rem; }
.entry .text { flex: 1; color: #cc9999; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.entry .btn-del { font-family: inherit; font-size: 0.7rem; padding: 2px 8px; background: #330000; border: 1px outset #662222; color: #aa6666; cursor: pointer; }
.entry .btn-del:hover { background: #550000; color: #ff8888; }
.entry { cursor: grab; user-select: none; -webkit-user-select: none; }
.entry:active { cursor: grabbing; }
.entry.dragging { opacity: 0.3; }
.entry.drop-before { border-top: 2px solid #ff8844; }
.entry.drop-after { border-bottom: 2px solid #ff8844; }
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
.btn-upload { font-size: 0.85rem; padding: 6px 10px; margin-left: 4px; background: #222200; border: 2px outset #666600; color: #ddcc88; cursor: pointer; vertical-align: middle; line-height: 1; }
.btn-upload:hover { background: #333300; border-style: inset; }
.btn-upload:disabled { opacity: 0.4; cursor: default; border-style: inset; }
.admin-layout { display: flex; gap: 20px; align-items: flex-start; width: 100%; }
.admin-left { flex: 1; min-width: 0; max-width: 480px; position: sticky; top: 16px; }
.admin-right { flex: 1; min-width: 0; max-height: calc(100vh - 120px); overflow-y: auto; }
@media (max-width: 800px) {
  .admin-layout { flex-direction: column; }
  .admin-left { position: static; max-width: none; }
  .admin-right { max-height: none; }
}
body.admin-page { max-width: 960px; }
.search-box { margin-bottom: 10px; }
.search-box input { font-size: 0.78rem; padding: 6px 8px; background: #0d0000; border: 1px solid #331111; color: #cc9999; width: 100%; }
.search-box input:focus { border-color: #663333; outline: none; }
.entry .thumb { width: 28px; height: 28px; object-fit: cover; border-radius: 2px; border: 1px solid #331111; flex-shrink: 0; background: #0a0000; }
.entry .thumb[src=""] { display: none; }
.entries-header { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.entries-header h3 { margin-bottom: 0; flex-shrink: 0; }
#btnCancelEdit { display: none; }
#btnCancelEdit.visible { display: inline-block; }
</style>
</head>
<body class="admin-page">
<h1>&#x1F339; ROSE DATABASE <span>&#x2699;&#xFE0F; ADMIN</span></h1>

<div class="admin-layout">
<div class="admin-left">
<div class="form-group">
  <label for="fileSelect">&#x1F4C1; FILE <span id="fileLoadStatus" style="color:#886666;font-size:0.7rem"></span></label>
  <select id="fileSelect">
    <option value="">— select a file —</option>
  </select>
  <div id="fileError" style="display:none;margin-top:6px;font-size:0.75rem;color:#cc6666;background:#220000;padding:6px;border:1px solid #660000"></div>
</div>

<div class="fields" id="fields">
  <div id="fieldContainer"></div>
  <div class="btn-row">
    <button class="btn" id="btnAdd">&#x2795; ADD ENTRY</button>
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
    <div class="entries-header">
      <h3>&#x1F4CB; EXISTING ENTRIES</h3>
      <button class="btn btn-sub" id="btnCancelEdit">&#x2716; CANCEL EDIT</button>
    </div>
    <div class="search-box"><input id="searchInput" type="text" placeholder="&#x1F50D; filter entries..."></div>
    <div id="entriesList"></div>
  </div>
</div>
</div>
  <p style="margin-top:20px;color:#664444;font-size:0.7rem;display:flex;gap:12px;align-items:center">
    <a href="/" target="_blank" style="color:#885555">&#x1F339; &#x2190; back to site</a>
    <a href="/review" target="_blank" style="color:#886644;text-decoration:none;border:1px solid #554422;padding:4px 12px;border-radius:2px;background:#1a1100">&#x1F50E; REVIEW</a>
    <a href="https://rosefish-submit.ziver64.workers.dev/admin" target="_blank" style="color:#886644;text-decoration:none;border:1px solid #554422;padding:4px 12px;border-radius:2px;background:#1a1100">&#x2699;&#xFE0F; VRC ADMIN</a>
  </p>
</div>

<script>
const sel = document.getElementById('fileSelect');
const fields = document.getElementById('fields');
const container = document.getElementById('fieldContainer');
const statusEl = document.getElementById('status');
const entriesDiv = document.getElementById('entries');
const entriesList = document.getElementById('entriesList');
const btnAdd = document.getElementById('btnAdd');

let currentFile = '';
let currentHeaders = [];
let editIndex = -1;
let pendingChanges = [];
let suppressingQueue = false;

async function flushPendingUpload() {
  const pu = window._pendingAdminUpload;
  if (!pu) return;
  const resp = await fetch('/api/upload-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: pu.name, data: pu.data })
  });
  const result = await resp.json();
  if (result.url) {
    pu.picInput.value = result.url;
    pu.picInput.dispatchEvent(new Event('input'));
    queueEdit();
  } else {
    throw new Error(result.error || 'upload failed');
  }
  if (pu.label) pu.label.textContent = '';
  if (pu.detachBtn) pu.detachBtn.style.display = 'none';
  window._pendingAdminUpload = null;
}

const FILE_EMOJIS = {
  'models-3d.json': '\u{1F4BE}', 'avatar-prefabs.json': '\u{1F4E6}',
  'world-prefabs.json': '\u{1F4E6}', 'shaders.json': '\u{1F5BC}',
  'tools.json': '\u{1F6E0}', 'luxury-trash.json': '\u{1F4B0}',
  'useful-things.json': '\u{1F497}', 'web-apps.json': '\u{1F310}', 'asset-websites.json': '\u{1F310}',
  'games.json': '\u{1F3AE}', 'sounds.json': '\u{1F50A}', 'gallery.json': '\u{1F5BC}',
};

var FILE_ORDER = [
  'models-3d.json',
  'avatar-prefabs.json',
  'world-prefabs.json',
  'shaders.json',
  'games.json',
  'tools.json',
  'luxury-trash.json',
  'useful-things.json',
  'web-apps.json',
  'asset-websites.json',
];

async function loadFiles() {
  const status = document.getElementById('fileLoadStatus');
  const error = document.getElementById('fileError');
  status.textContent = 'loading...';
  error.style.display = 'none';
  try {
    const r = await fetch('/api/files');
    if (!r.ok) throw new Error('Server returned ' + r.status);
    const files = await r.json();
    files.sort(function (a, b) {
      var ai = FILE_ORDER.indexOf(a);
      var bi = FILE_ORDER.indexOf(b);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
    files.forEach(f => {
      const opt = document.createElement('option');
      opt.value = f;
      const emoji = FILE_EMOJIS[f] || '';
      opt.textContent = (emoji ? emoji + ' ' : '') + f.replace('.json', '').replace(/-/g, ' ').toUpperCase();
      sel.appendChild(opt);
    });
    status.textContent = '(' + files.length + ' files)';
  } catch (e) {
    error.textContent = 'Failed to load files: ' + e.message + '. Make sure the server is running and data/ directory exists.';
    error.style.display = 'block';
    status.textContent = 'error';
  }
}

loadFiles();

let searchFilter = '';

async function loadEntries() {
  const resp = await fetch('/api/rows?file=' + encodeURIComponent(currentFile));
  let rows = await resp.json();
  const reorder = pendingChanges.find(p => p.type === 'reorder' && p.file === currentFile);
  if (reorder) rows = reorder.rows;
  const picIdx = currentHeaders.findIndex(h => /picture|preview|image/i.test(h));
  const nameIdx = 0;
  const filtered = rows.map((r, i) => ({ row: r, origIdx: i })).filter(({ row }) => {
    if (!searchFilter) return true;
    const q = searchFilter.toLowerCase();
    return row.some(cell => cell && cell.toLowerCase().includes(q));
  });
  entriesList.innerHTML = filtered.map(({ row: r, origIdx: i }) => {
    const pending = pendingChanges.find(p => p.type !== 'reorder' && p.file === currentFile && p.index === i);
    const display = pending ? pending.row : r;
    const name = display[nameIdx] || '(unnamed)';
    const hasPic = picIdx >= 0 && display[picIdx] && (display[picIdx].startsWith('http') || display[picIdx].startsWith('/images/') || display[picIdx].startsWith('images/') || display[picIdx].startsWith('/previews/') || display[picIdx].startsWith('previews/'));
    const isEditing = editIndex === i;
    let cls = '';
    if (isEditing) cls = ' editing';
    else if (pending) cls = ' pending';
    const extra = display.slice(0, 4).filter((c, ci) => ci !== nameIdx && ci !== picIdx && c).join(' | ');
    return '<div class="entry' + cls + '" draggable="true" data-index="' + i + '">' +
      '<span class="idx">' + (i + 1) + '</span>' +
      (hasPic ? '<img class="thumb" src="' + escapeHtml(display[picIdx]) + '" alt="" draggable="false" onerror="this.style.display=\\\'none\\\'">' : '') +
      (isEditing ? '<span class="editing-mark">&#x25B6;&#xFE0F;</span>' : '') +
      (pending && !isEditing ? '<span class="pending-mark">&#x270F;&#xFE0F;</span>' : '') +
      '<span class="text"><strong>' + escapeHtml(name) + '</strong>' + (extra ? ' &mdash; ' + escapeHtml(extra).substring(0, 80) : '') + '</span>' +
      '<button class="btn-del" data-index="' + i + '">&#x274C;</button></div>';
  }).join('');
  entriesDiv.classList.add('active');
  initDragDrop();
}

function initDragDrop() {
  var list = entriesList;

  function clearAll() {
    list.querySelectorAll('.entry').forEach(function (e) {
      e.classList.remove('dragging', 'drop-before', 'drop-after');
    });
  }

  list.addEventListener('dragstart', function (ev) {
    var item = ev.target.closest('.entry');
    if (!item) { ev.preventDefault(); return; }
    item.dataset.dragSrc = '1';
    item.classList.add('dragging');
    ev.dataTransfer.effectAllowed = 'move';
    ev.dataTransfer.setData('text/plain', '');
  });

  list.addEventListener('dragover', function (ev) {
    ev.preventDefault();
    var item = ev.target.closest('.entry');
    if (!item || !list.querySelector('[data-drag-src]')) return;
    ev.dataTransfer.dropEffect = 'move';
    var rect = item.getBoundingClientRect();
    clearAll();
    if (ev.clientY < rect.top + rect.height / 2) {
      item.classList.add('drop-before');
    } else {
      item.classList.add('drop-after');
    }
  });

  list.addEventListener('drop', function (ev) {
    ev.preventDefault();
    var srcEl = list.querySelector('[data-drag-src]');
    var targetEl = ev.target.closest('.entry');
    if (!srcEl || !targetEl) { clearAll(); return; }
    if (srcEl === targetEl) { clearAll(); return; }
    var before = targetEl.classList.contains('drop-before');
    var allEntries = Array.from(list.querySelectorAll('.entry'));
    var currentRows = allEntries.map(function (e) { return parseInt(e.dataset.index, 10); });
    var srcIdx = currentRows.indexOf(parseInt(srcEl.dataset.index, 10));
    var toIdx = currentRows.indexOf(parseInt(targetEl.dataset.index, 10));
    clearAll();
    delete srcEl.dataset.dragSrc;
    var existingReorder = pendingChanges.find(function (p) { return p.file === currentFile && p.type === 'reorder'; });
    var rows = existingReorder ? existingReorder.rows.slice() : null;
    function applyReorder(r) {
      var [moved] = r.splice(srcIdx, 1);
      var insertAt = before ? toIdx : toIdx + 1;
      if (insertAt > srcIdx) insertAt--;
      r.splice(insertAt, 0, moved);
      pendingChanges = pendingChanges.filter(function (p) { return p.file !== currentFile || p.type !== 'reorder'; });
      pendingChanges.push({ type: 'reorder', file: currentFile, rows: r });
      editIndex = -1;
      btnAdd.innerHTML = '&#x2795; ADD ENTRY';
      resetForm();
      updatePendingUI();
    }
    if (rows) { applyReorder(rows); return; }
    fetch('/api/rows?file=' + encodeURIComponent(currentFile))
      .then(function (r) { return r.json(); })
      .then(applyReorder);
  });

  list.addEventListener('dragend', function () {
    list.querySelectorAll('.entry').forEach(function (e) { delete e.dataset.dragSrc; });
    clearAll();
  });
}

function escapeHtml(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function getFormFields() {
  return container.querySelectorAll('input:not([type=file]), select, textarea');
}

function fillForm(row) {
  suppressingQueue = true;
  const fields = getFormFields();
  fields.forEach((inp, i) => {
    inp.value = row[i] || '';
    if (inp.dataset && inp.dataset.isPic) {
      const evt = new Event('input');
      inp.dispatchEvent(evt);
    }
  });
  suppressingQueue = false;
}

function getFormRow() {
  return Array.from(getFormFields()).map(inp => inp.value.trim());
}

function resetForm() {
  getFormFields().forEach(inp => inp.value = '');
  document.getElementById('btnCancelEdit').classList.remove('visible');
  container.querySelector('input:not([type=file])')?.focus();
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
  window._pendingAdminUpload = null;
  currentFile = sel.value;
  editIndex = -1;
  btnAdd.innerHTML = '&#x2795; ADD ENTRY';
  document.getElementById('btnCancelEdit').classList.remove('visible');
  document.getElementById('fileLoadStatus').textContent = 'loading...';
  document.getElementById('status').className = '';
  document.getElementById('status').style.display = 'none';
  try {
    const h = await (await fetch('/api/headers?file=' + encodeURIComponent(currentFile))).json();
    if (!Array.isArray(h) || h.length === 0) throw new Error('This file has no fields defined');
    currentHeaders = h;
    container.innerHTML = '';
  const isPic = (h) => /picture|preview|image/i.test(h);
  const isLink = (h) => /link|website|download/i.test(h);
  const isSound = (h) => /sound file|audio/i.test(h);
  const inputs = [];
  h.forEach((header, i) => {
    const div = document.createElement('div');
    div.className = 'field-row' + (isPic(header) ? ' pic-row' : '');
    const label = document.createElement('label');
    label.textContent = header;
    let input;
    if (header.toLowerCase() === 'button') {
      input = document.createElement('select');
      ['DOWNLOAD', 'OPEN'].forEach(opt => {
        const o = document.createElement('option');
        o.value = opt;
        o.textContent = opt;
        input.appendChild(o);
      });
    } else if (header.toLowerCase().startsWith('info')) {
      input = document.createElement('textarea');
      input.placeholder = header;
      input.maxLength = 280;
    } else {
      input = document.createElement('input');
      input.placeholder = header;
      if (isLink(header)) input.maxLength = 100;
      else if (i === 0 || header.toLowerCase() === 'author') input.maxLength = 30;
      else input.maxLength = 280;
    }
    if (header.toLowerCase() !== 'button' && !isLink(header) && !isPic(header) && !isSound(header)) {
      div.style.position = 'relative';
      input.style.paddingBottom = '20px';
      var counter = document.createElement('div');
      counter.style.cssText = 'position:absolute;bottom:4px;right:18px;font-size:0.65rem;color:#886666;pointer-events:none;line-height:1';
      counter.textContent = input.maxLength || '280';
      input.addEventListener('input', function() { counter.textContent = (this.maxLength || 280) - this.value.length; });
      div.appendChild(counter);
    }
    if (isLink(header)) input.dataset.isLink = '1';
    input.addEventListener('input', queueEdit);
    input.addEventListener('change', queueEdit);
    if (isPic(header)) {
      input.dataset.isPic = '1';
      input.placeholder = 'JPG / PNG only, max 10MB';
    }
    if (i === 0) input.autofocus = true;
    div.appendChild(label);
    div.appendChild(input);
    if (isPic(header)) {
      const preview = document.createElement('img');
      preview.className = 'pic-preview';
      preview.alt = 'preview';
      input.addEventListener('input', () => {
        const val = input.value.trim();
        if (val && (val.startsWith('http') || val.startsWith('/images/') || val.startsWith('images/') || val.startsWith('/previews/') || val.startsWith('previews/'))) {
          preview.src = val;
          preview.style.display = 'block';
        } else {
          preview.style.display = 'none';
        }
      });
      preview.addEventListener('error', () => { preview.style.display = 'none'; });
      div.appendChild(preview);

      const btnWrap = document.createElement('div');
      btnWrap.style.cssText = 'display:flex;gap:6px;margin-top:6px';

      const uploadInput = document.createElement('input');
      uploadInput.type = 'file';
      uploadInput.accept = 'image/*';
      uploadInput.style.display = 'none';
      const uploadBtn = document.createElement('button');
      uploadBtn.className = 'btn-upload';
      uploadBtn.innerHTML = '&#x1F4E5; UPLOAD';
      uploadBtn.type = 'button';
      uploadBtn.addEventListener('click', () => uploadInput.click());
      const uploadLabel = document.createElement('span');
      uploadLabel.style.cssText = 'color:#aa6666;font-size:0.75rem;line-height:28px;margin-left:4px';
      const detachBtn = document.createElement('button');
      detachBtn.className = 'btn-fetch';
      detachBtn.innerHTML = '&#x2716;';
      detachBtn.title = 'Remove selected file';
      detachBtn.type = 'button';
      detachBtn.style.cssText = 'display:none;padding:6px 8px;margin-left:2px';
      detachBtn.addEventListener('click', () => {
        window._pendingAdminUpload = null;
        uploadLabel.textContent = '';
        detachBtn.style.display = 'none';
        uploadInput.value = '';
      });
      uploadInput.addEventListener('change', () => {
        const file = uploadInput.files[0];
        if (!file) return;
        input.value = '';
        input.dispatchEvent(new Event('input'));
        const reader = new FileReader();
        reader.onload = (e) => {
          window._pendingAdminUpload = { name: file.name, data: e.target.result, picInput: input, label: uploadLabel, detachBtn: detachBtn };
          uploadLabel.textContent = ' \uD83D\uDCCE ' + file.name;
          detachBtn.style.display = '';
        };
        reader.readAsDataURL(file);
      });
      btnWrap.appendChild(uploadBtn);
      btnWrap.appendChild(uploadLabel);
      btnWrap.appendChild(detachBtn);

      const fetchBtn = document.createElement('button');
      fetchBtn.className = 'btn-fetch';
      fetchBtn.innerHTML = '&#x1F50D; FETCH';
      fetchBtn.title = 'Auto-find a picture from the link field';
      fetchBtn.type = 'button';
      fetchBtn.addEventListener('click', async () => {
        const linkInp = container.querySelector('[data-is-link]');
        const url = linkInp ? linkInp.value.trim() : '';
        if (!url.startsWith('http')) { alert('Enter a URL in the link field first'); return; }
        if (window._pendingAdminUpload) {
          const pu = window._pendingAdminUpload;
          if (pu.label) pu.label.textContent = '';
          if (pu.detachBtn) pu.detachBtn.style.display = 'none';
          window._pendingAdminUpload = null;
        }
        fetchBtn.disabled = true;
        try {
          const r = await fetch('/api/fetch-image?url=' + encodeURIComponent(url));
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
      btnWrap.appendChild(fetchBtn);

      div.appendChild(btnWrap);
    }
    container.appendChild(div);
  });
  fields.classList.add('active');
  statusEl.className = '';
  statusEl.style.display = 'none';
  loadEntries();
  document.getElementById('fileLoadStatus').textContent = '';
  } catch (e) {
    document.getElementById('fileError').textContent = 'Error: ' + e.message;
    document.getElementById('fileError').style.display = 'block';
    document.getElementById('fileLoadStatus').textContent = 'error';
    fields.classList.remove('active');
    entriesDiv.classList.remove('active');
  }
});

document.getElementById('searchInput').addEventListener('input', (e) => {
  searchFilter = e.target.value;
  loadEntries();
});

document.getElementById('btnCancelEdit').addEventListener('click', () => {
  editIndex = -1;
  btnAdd.innerHTML = '&#x2795; ADD ENTRY';
  resetForm();
  document.getElementById('btnCancelEdit').classList.remove('visible');
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
    document.getElementById('btnCancelEdit').classList.add('visible');
    const pending = pendingChanges.find(p => p.file === currentFile && p.index === index);
    fillForm(pending ? pending.row : rows[index]);
    loadEntries();
  }
});

btnAdd.addEventListener('click', async () => {
  if (editIndex >= 0) return;
  try { await flushPendingUpload(); } catch (e) { alert('Upload failed: ' + e.message); return; }
  const row = getFormRow();
  if (!row[0]) { alert('&#x26A0;&#xFE0F; Name is required'); return; }
  const resp = await fetch('/api/add', { method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file: currentFile, row }) });
  const result = await resp.json();
  if (resp.ok) {
    alert('&#x2705; added: ' + result.name);
    resetForm();
    loadEntries();
  } else {
    alert('&#x274C; Error: ' + (result.error || 'unknown'));
  }
});

document.getElementById('btnSaveAll').addEventListener('click', async () => {
  if (pendingChanges.length === 0) return;
  try { await flushPendingUpload(); } catch (e) { alert('Upload failed: ' + e.message); return; }
  const total = pendingChanges.length;
  let ok = 0, fail = 0;
  statusEl.className = 'saving';
  statusEl.textContent = 'Saving 0/' + total + '...';
  statusEl.style.display = 'block';
  document.getElementById('btnSaveAll').disabled = true;
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
    statusEl.textContent = 'Saving ' + (ok + fail) + '/' + total + '...';
  }
  pendingChanges = [];
  updatePendingUI();
  statusEl.className = fail === 0 ? 'ok' : 'err';
  statusEl.textContent = fail === 0 ? '&#x2705; Saved ' + ok + ' change' + (ok > 1 ? 's' : '') : '&#x26A0;&#xFE0F; ' + ok + ' saved, ' + fail + ' failed';
  document.getElementById('btnSaveAll').disabled = false;
  btnAdd.innerHTML = '&#x2795; ADD ENTRY';
  editIndex = -1;
  resetForm();
  loadEntries();
});

document.getElementById('btnDiscard').addEventListener('click', () => {
  if (pendingChanges.length === 0) return;
  if (!confirm('&#x274C; Discard ' + pendingChanges.length + ' pending change' + (pendingChanges.length > 1 ? 's' : '') + '?')) return;
  pendingChanges = [];
  updatePendingUI();
  editIndex = -1;
  btnAdd.innerHTML = '&#x2795; ADD ENTRY';
  resetForm();
  loadEntries();
});

function showStatus(msg, type) {
  statusEl.className = type;
  statusEl.textContent = msg;
}
</script>
</body>
</html>`;

const CONVERTER_HTML = '<div style="margin-top:24px;border-top:1px solid #331111;padding-top:12px">' +
  '<label style="color:#aa6666;font-size:0.8rem;display:block;margin-bottom:6px">GOOGLE DRIVE CONVERTER</label>' +
  '<input id="gdInput" type="text" placeholder="paste sharing URL..." style="width:100%;font-size:0.78rem;margin-bottom:4px">' +
  '<div style="display:flex;gap:4px">' +
  '<button class="btn btn-sub" onclick="convertGDrive()" style="padding:4px 12px;font-size:0.75rem">CONVERT</button>' +
  '<input id="gdOutput" type="text" readonly placeholder="converted link will appear here..." style="flex:1;font-size:0.75rem;color:#88cc88">' +
  '</div></div>' +
  '<script>function convertGDrive(){var a=document.getElementById(\'gdInput\'),b=document.getElementById(\'gdOutput\'),c=a.value.trim(),d=c.match(/\\/d\\/([^/]+)\\//);b.value=d?\'https://drive.google.com/uc?export=download&id=\'+d[1]:\'invalid URL\'}</script>';



const REVIEW_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ROSE DATABASE — REVIEW</title>
<link href="https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&display=swap" rel="stylesheet">
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: 'Courier Prime', 'Courier New', Courier, monospace;
  background: #0a0000;
  color: #ffcccc;
  padding: 24px;
  max-width: 960px;
  margin: 0 auto;
}
h1 { color: #ff8888; font-size: 1.2rem; margin-bottom: 4px; letter-spacing: 1px; }
h1 span { color: #884444; }
.subtitle { color: #aa6666; font-size: 0.78rem; margin-bottom: 16px; }
.controls { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin-bottom: 16px; font-size: 0.78rem; }
.controls label { color: #886666; cursor: pointer; }
.controls input { margin-right: 4px; }
.pending-count { color: #ddcc88; font-size: 0.78rem; }
#status { margin-top: 12px; padding: 10px; font-size: 0.8rem; display: none; }
#status.ok { display: block; background: #002200; border: 1px solid #006600; color: #88cc88; }
#status.err { display: block; background: #220000; border: 1px solid #660000; color: #cc8888; }

.data-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 10px;
}
.data-card {
  background: #1a0505;
  border: 2px ridge #660000;
  display: flex;
  flex-direction: column;
}
.data-card:hover { border-color: #993333; }
.dc-img-wrap {
  width: 100%;
  height: 140px;
  background: #110000;
  border-bottom: 1px solid #442222;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.dc-img-wrap .dc-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.dc-img-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #442222;
  font-size: 2rem;
}
.dc-body {
  padding: 10px 12px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.dc-name {
  font-weight: bold;
  font-size: 0.85rem;
  color: #ffcccc;
  line-height: 1.3;
  margin-bottom: 4px;
  word-break: break-word;
}
.dc-field {
  font-size: 0.78rem;
  color: #cc9999;
  line-height: 1.4;
  word-break: break-word;
  overflow-wrap: break-word;
}
.dc-label {
  color: #886666;
  margin-right: 4px;
}
.dc-field a {
  color: #ff8888;
  word-break: break-all;
}
.dc-link-out {
  margin-top: 0;
  padding-top: 4px;
}
.dc-link-out a {
  display: block;
  text-align: center;
  background: #440000;
  color: #ffcccc;
  border: 2px outset #882222;
  padding: 6px;
  font-size: 0.78rem;
  font-weight: bold;
  text-decoration: none;
  letter-spacing: 1px;
}
.dc-link-out a:hover {
  background: #660000;
  border-style: inset;
}
.dc-actions { margin-top: auto; padding-top: 8px; display: flex; gap: 6px; flex-wrap: wrap; }
.btn-app, .btn-rej, .btn-rev {
  font-family: inherit;
  font-size: 0.75rem;
  font-weight: bold;
  cursor: pointer;
  letter-spacing: 1px;
  padding: 5px 14px;
  border-width: 2px;
  border-style: outset;
}
.btn-app { border-color: #226622; background: #113311; color: #88cc88; }
.btn-app:hover { background: #224422; border-style: inset; }
.btn-rej { border-color: #662222; background: #331111; color: #cc8888; }
.btn-rej:hover { background: #552222; border-style: inset; }
.btn-rev { border-color: #665500; background: #332200; color: #ddcc88; }
.btn-rev:hover { background: #554400; border-style: inset; }
.dc-review-badge {
  display: inline-block;
  padding: 2px 8px;
  font-size: 0.7rem;
  font-weight: bold;
  letter-spacing: 1px;
  vertical-align: middle;
}
.badge-pending { background: #332200; color: #ddcc88; border: 1px solid #665500; }
.badge-approved { background: #003300; color: #88cc88; border: 1px solid #006600; }
.badge-rejected { background: #330000; color: #cc8888; border: 1px solid #660000; }
.dc-meta { font-size: 0.7rem; color: #664444; margin-bottom: 2px; line-height: 1.3; }
.dc-meta span { color: #886666; }
.empty-state { text-align: center; padding: 40px; color: #886666; background: #220000; border: 2px ridge #660000; font-size: 0.85rem; }
.vrc-badge { display: inline-block; font-size: 0.7rem; padding: 2px 8px; font-weight: bold; letter-spacing: 1px; vertical-align: middle; }
.vrc-badge.world { background: #112244; color: #88aaff; border: 1px solid #224488; }
.vrc-badge.avatar { background: #441122; color: #ff88aa; border: 1px solid #882244; }
.vrc-badge.group { background: #224411; color: #aaff88; border: 1px solid #448822; }
</style>
</head>
<body>
<h1>&#x1F339; ROSE DATABASE <span>&#x1F50E; REVIEW</span></h1>
<p class="subtitle">Review and manage pending submissions.</p>

<div class="controls">
  <button class="tab-btn" data-tab="pending" style="font-family:inherit;font-size:0.78rem;font-weight:bold;cursor:pointer;padding:6px 16px;border:2px outset #665500;background:#332200;color:#ddcc88;letter-spacing:1px">PENDING</button>
  <button class="tab-btn" data-tab="approved" style="font-family:inherit;font-size:0.78rem;font-weight:bold;cursor:pointer;padding:6px 16px;border:2px outset #226622;background:#113311;color:#88cc88;letter-spacing:1px">APPROVED</button>
  <button class="tab-btn" data-tab="rejected" style="font-family:inherit;font-size:0.78rem;font-weight:bold;cursor:pointer;padding:6px 16px;border:2px outset #662222;background:#331111;color:#cc8888;letter-spacing:1px">REJECTED</button>
  <span class="pending-count" id="pendingCount" style="margin-left:8px"></span>
  <button id="refreshBtn" style="font-family:inherit;font-size:0.75rem;font-weight:bold;cursor:pointer;letter-spacing:1px;padding:4px 12px;border:2px outset #666600;background:#222200;color:#ddcc88;margin-left:auto">REFRESH</button>
</div>

<div id="status"></div>
<div id="list">Loading...</div>

<script>
var allSubmissions = [];
var headersCache = {};
var currentTab = 'pending';
var FILE_EMOJIS = {
  'models-3d.json': '\u{1F4BE}', 'avatar-prefabs.json': '\u{1F4E6}',
  'world-prefabs.json': '\u{1F4E6}', 'shaders.json': '\u{1F5BC}',
  'tools.json': '\u{1F6E0}', 'luxury-trash.json': '\u{1F4B0}',
  'useful-things.json': '\u{1F497}', 'web-apps.json': '\u{1F310}', 'asset-websites.json': '\u{1F310}',
  'games.json': '\u{1F3AE}', 'sounds.json': '\u{1F50A}', 'gallery.json': '\u{1F5BC}',
};
function imgError(img) {
  var d = document.createElement('div');
  d.className = 'dc-img-placeholder';
  d.textContent = '?';
  img.parentNode.replaceChild(d, img);
}

async function getHeaders(file) {
  if (headersCache[file]) return headersCache[file];
  try {
    var r = await fetch('/api/headers?file=' + encodeURIComponent(file));
    var h = await r.json();
    headersCache[file] = Array.isArray(h) ? h : [];
  } catch(e) { headersCache[file] = []; }
  return headersCache[file];
}

function isPic(h) { return /picture|preview|image/i.test(h); }
function isSound(h) { return /sound file|audio/i.test(h); }
function isLink(h) { return /link|website|download/i.test(h); }

function escapeHtml(s) {
  if (!s) return '';
  var d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

async function loadList() {
  var resp = await fetch('/api/pending');
  var data = await resp.json();
  allSubmissions = (Array.isArray(data.submissions) ? data.submissions : []).filter(function(s) { return !s.type && s.file !== 'gallery.json' && s.file !== 'sounds.json'; });
  await renderList();
}

async function renderList() {
  var list = document.getElementById('list');
  var filtered = allSubmissions.filter(function(s) { return (s.status || 'pending') === currentTab; });
  var pendingCount = allSubmissions.filter(function(s) { return (s.status || 'pending') === 'pending'; }).length;
  document.getElementById('pendingCount').textContent = pendingCount + ' pending';

  if (!filtered.length) {
    list.innerHTML = '<div class="empty-state">No submissions to show.</div>';
    return;
  }

  var html = '<div class="data-card-grid">';
  for (var si = 0; si < filtered.length; si++) {
    var s = filtered[si];
    var actionsHtml;
    if (s.status === 'pending') {
      actionsHtml = '<button class="btn-app" onclick="approve(\\'' + s.id + '\\')">APPROVE</button><button class="btn-rej" onclick="reject(\\'' + s.id + '\\')">REJECT</button>';
    } else {
      actionsHtml = '<button class="btn-rev" onclick="revert(\\'' + s.id + '\\')">REVERT TO PENDING</button>';
    }

    if (s.type) {
      var vrcLabel = s.type.charAt(0).toUpperCase() + s.type.slice(1);
      var vrcBadge = '<span class="vrc-badge ' + s.type + '">' + vrcLabel + '</span>';
      var statusBadge = s.status === 'approved' ? '<span class="dc-review-badge badge-approved">APPROVED</span>'
        : s.status === 'rejected' ? '<span class="dc-review-badge badge-rejected">REJECTED</span>'
        : '<span class="dc-review-badge badge-pending">PENDING</span>';

      html += '<div class="data-card">'
        + '<div class="dc-img-placeholder" style="height:80px;font-size:1.4rem">&#x1F517;</div>'
        + '<div class="dc-body">'
        + '<div class="dc-name">' + vrcBadge + ' ' + statusBadge + '</div>'
        + '<div class="dc-field" style="margin-top:6px;word-break:break-all"><a href="' + escapeHtml(s.url) + '" target="_blank">' + escapeHtml(s.url) + '</a></div>'
        + '<div class="dc-meta" style="margin-top:4px"><span>' + (s.createdAt ? new Date(s.createdAt).toLocaleString() : '') + '</span></div>'
        + '<div class="dc-actions">' + actionsHtml + '</div>'
        + '</div></div>';
    } else {
      var headers = await getHeaders(s.file);
      var row = s.row || [];
      var picIdx = headers.findIndex(isPic);
      var linkIdx = headers.findIndex(isLink);
      var picUrl = picIdx >= 0 ? (row[picIdx] || '') : '';
      var soundIdx = headers.findIndex(isSound);
      var name = row[0] || '(unnamed)';
      if (name.indexOf('http') === 0 && (picIdx === 0 || soundIdx === 0)) name = s.file || 'entry';
      var fullPicUrl = picUrl;
      if (picUrl.indexOf('images/') === 0 || picUrl.indexOf('previews/') === 0) fullPicUrl = 'https://raw.githubusercontent.com/FishStructuredChaos/database/main/' + picUrl;
      var hasPic = fullPicUrl && fullPicUrl.indexOf('http') === 0;

      var statusBadge = s.status === 'approved' ? '<span class="dc-review-badge badge-approved">APPROVED</span>'
        : s.status === 'rejected' ? '<span class="dc-review-badge badge-rejected">REJECTED</span>'
        : '<span class="dc-review-badge badge-pending">PENDING</span>';

      var imgHtml;
      if (hasPic) {
        imgHtml = '<img class="dc-img" src="' + escapeHtml(fullPicUrl) + '" alt="" loading="lazy" onerror="imgError(this)">';
      } else {
        imgHtml = '<div class="dc-img-placeholder">?</div>';
      }

      var audioUrl = soundIdx >= 0 ? (row[soundIdx] || '') : '';
      var fieldsHtml = '';
      for (var i = 1; i < headers.length; i++) {
        if (i === picIdx || i === linkIdx) continue;
        if (i === soundIdx) continue;
        var val = row[i] || '';
        if (!val) continue;
        var label = headers[i];
        var displayVal = escapeHtml(val);
        if (val.indexOf('http') === 0) displayVal = '<a href="' + escapeHtml(val) + '" target="_blank">' + displayVal + '</a>';
        fieldsHtml += '<div class="dc-field"><span class="dc-label">' + escapeHtml(label) + ':</span>' + displayVal + '</div>';
      }

      var linkVal = (linkIdx >= 0) ? (row[linkIdx] || '') : '';
      var btnLabel = 'OPEN';
      if (linkIdx >= 0) {
        var btnCol = headers.findIndex(h => h.toLowerCase() === 'button');
        if (btnCol >= 0) btnLabel = row[btnCol] || 'OPEN';
        else btnLabel = 'OPEN';
      }

      var fileLabel = s.file ? s.file.replace('.json', '').replace(/-/g, ' ').toUpperCase() : 'UNKNOWN';
      html += '<div class="data-card">'
        + '<div style="font-size:0.85rem;padding:8px 12px;background:#0d0000;border-bottom:1px solid #221111;color:#aa6666;letter-spacing:1px;font-weight:bold">' + (FILE_EMOJIS[s.file] || '') + ' ' + escapeHtml(fileLabel) + '</div>'
        + '<div class="dc-img-wrap">' + imgHtml + '</div>'
        + '<div class="dc-body">'
        + (audioUrl ? '<div style="margin-bottom:6px"><audio controls style="width:100%;height:36px"><source src="' + escapeHtml(audioUrl) + '"></audio></div>' : '')
        + '<div class="dc-name">' + escapeHtml(name) + ' ' + statusBadge + '</div>'
        + '<div class="dc-meta">' + (FILE_EMOJIS[s.file] || '') + ' File: <span>' + escapeHtml(s.file || '-') + '</span> &mdash; by <span>' + escapeHtml(s.submittedBy || '-') + (s.createdAt ? '</span> &mdash; <span>' + new Date(s.createdAt).toLocaleString() : '') + '</span></div>'
        + (s.note ? '<div class="dc-meta">Note: <span>' + escapeHtml(s.note) + '</span></div>' : '')
        + fieldsHtml
        + (linkVal ? '<div class="dc-link-out"><a href="' + escapeHtml(linkVal) + '" target="_blank">' + escapeHtml(btnLabel) + '</a></div>' : '')
        + '<div class="dc-actions">' + actionsHtml + '</div>'
        + '</div></div>';
    }
  }
  html += '</div>';
  list.innerHTML = html;
}

document.querySelectorAll('.tab-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.tab-btn').forEach(function(b) { b.style.borderStyle = 'outset'; b.style.opacity = '0.6'; });
    this.style.borderStyle = 'inset'; this.style.opacity = '1';
    currentTab = this.dataset.tab;
    renderList();
  });
});
document.querySelector('.tab-btn[data-tab="pending"]').style.borderStyle = 'inset';
document.querySelector('.tab-btn[data-tab="pending"]').style.opacity = '1';

document.getElementById('refreshBtn').addEventListener('click', async function() {
  var btn = document.getElementById('refreshBtn');
  btn.disabled = true;
  btn.textContent = '...';
  headersCache = {};
  try {
    var resp = await fetch('/api/pending?refresh=1');
    var data = await resp.json();
    allSubmissions = (Array.isArray(data.submissions) ? data.submissions : []).filter(function(s) { return !s.type && s.file !== 'gallery.json' && s.file !== 'sounds.json'; });
    await renderList();
  } catch(e) {}
  btn.disabled = false;
  btn.textContent = 'REFRESH';
});

async function approve(id) {
  var st = document.getElementById('status');
  st.className = ''; st.style.display = 'none';
  var resp = await fetch('/api/approve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: id }) });
  var result = await resp.json();
  if (result.ok) { st.className = 'ok'; st.textContent = result.alreadyApproved ? 'Already approved.' : 'Approved and added to database.'; }
  else { st.className = 'err'; st.textContent = result.error || 'Failed'; }
  st.style.display = 'block';
  loadList();
}

async function reject(id) {
  var st = document.getElementById('status');
  st.className = ''; st.style.display = 'none';
  var resp = await fetch('/api/reject', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: id }) });
  var result = await resp.json();
  if (result.ok) { st.className = 'ok'; st.textContent = 'Rejected.'; }
  else { st.className = 'err'; st.textContent = result.error || 'Failed'; }
  st.style.display = 'block';
  loadList();
}

async function revert(id) {
  var st = document.getElementById('status');
  st.className = ''; st.style.display = 'none';
  var resp = await fetch('/api/revert', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: id }) });
  var result = await resp.json();
  if (result.ok) { st.className = 'ok'; st.textContent = 'Reverted to pending.'; }
  else { st.className = 'err'; st.textContent = result.error || 'Failed'; }
  st.style.display = 'block';
  loadList();
}

loadList();
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
        buildAsync();
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
        buildAsync();
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
        buildAsync();
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
        buildAsync();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ name: row[0] || '(unnamed)' }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  if (pathname === '/api/upload-image' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { name, data } = JSON.parse(body);
        if (!name || !data) { res.writeHead(400); res.end('{"error":"missing data"}'); return; }
        const matches = data.match(/^data:image\/(\w+);base64,(.+)$/);
        if (!matches) { res.writeHead(400); res.end('{"error":"invalid image data"}'); return; }
        let ext = matches[1];
        if (ext === 'jpeg') ext = 'jpg';
        const buffer = Buffer.from(matches[2], 'base64');
        const baseName = name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const filename = Date.now() + '_' + baseName;
        const previewsDir = path.join(dir, 'previews');
        if (!fs.existsSync(previewsDir)) fs.mkdirSync(previewsDir, { recursive: true });
        const imgPath = path.join(previewsDir, filename);
        fs.writeFileSync(imgPath, buffer);
        buildAsync();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ url: 'previews/' + filename }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  if (pathname === '/api/submit' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body);
        const { file, row, submittedBy, note } = payload || {};
        if (!file || !Array.isArray(row) || !submittedBy) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'invalid data' }));
          return;
        }

        if (SUBMIT_ENDPOINT) {
          const resp = await fetch(SUBMIT_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const text = await resp.text();
          res.writeHead(resp.status, { 'Content-Type': 'application/json' });
          res.end(text || JSON.stringify({ ok: resp.ok }));
          return;
        }

        const filePath = path.join(dataDir, file);
        if (!fs.existsSync(filePath)) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'file not found' }));
          return;
        }

        const submission = {
          id: makeSubmissionId(),
          status: 'pending',
          createdAt: new Date().toISOString(),
          submittedBy,
          note: note || '',
          file,
          row,
        };

        await addPendingSubmission(submission);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, id: submission.id }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  if (pathname === '/api/pending') {
    (async () => {
      try {
        const forceRefresh = url.searchParams.get('refresh') === '1';
        const { state } = await loadPendingState({ forceRefresh });
        const submissions = Array.isArray(state.submissions) ? state.submissions : [];
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ submissions }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    })();
    return;
  }

  if (pathname === '/api/approve' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { id } = JSON.parse(body);
        if (!id) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'missing id' }));
          return;
        }

        const { fileName, state } = await loadPendingState();
        const submission = state.submissions.find(s => s.id === id);
        if (!submission) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'submission not found' }));
          return;
        }

        if (submission.status === 'approved') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, alreadyApproved: true }));
          return;
        }

        if (submission.type) {
          submission.status = 'approved';
          submission.approvedAt = new Date().toISOString();
          state.updatedAt = new Date().toISOString();
          await savePendingState(state, fileName);
          writeApprovedGist(submission);
          buildAsync();
        } else {
          const livePath = path.join(dataDir, submission.file);
          if (!fs.existsSync(livePath)) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'target file not found' }));
            return;
          }

          const liveData = JSON.parse(fs.readFileSync(livePath, 'utf8'));
          if (!Array.isArray(liveData.rows)) liveData.rows = [];
          liveData.rows.push(submission.row);
          fs.writeFileSync(livePath, JSON.stringify(liveData, null, 2) + '\n');

          submission.status = 'approved';
          submission.approvedAt = new Date().toISOString();
          state.updatedAt = new Date().toISOString();
          await savePendingState(state, fileName);
          buildAsync();
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  if (pathname === '/api/reject' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { id } = JSON.parse(body);
        if (!id) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'missing id' }));
          return;
        }

        const { fileName, state } = await loadPendingState();
        const submission = state.submissions.find(s => s.id === id);
        if (!submission) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'submission not found' }));
          return;
        }

        submission.status = 'rejected';
        submission.rejectedAt = new Date().toISOString();
        state.updatedAt = new Date().toISOString();
        await savePendingState(state, fileName);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  if (pathname === '/api/revert' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { id } = JSON.parse(body);
        if (!id) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'missing id' }));
          return;
        }

        const { fileName, state } = await loadPendingState();
        const submission = state.submissions.find(s => s.id === id);
        if (!submission) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'submission not found' }));
          return;
        }

        submission.status = 'pending';
        submission.approvedAt = undefined;
        submission.rejectedAt = undefined;
        state.updatedAt = new Date().toISOString();
        await savePendingState(state, fileName);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  if (pathname === '/review') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(REVIEW_HTML);
    return;
  }

  // Admin page
  if (pathname === '/admin' || pathname === '/add') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(ADMIN_HTML.replace('</body>', CONVERTER_HTML + '</body>'));
    return;
  }

  // API: return full JSON data file
  if (pathname === '/api/json-data' && req.method === 'GET') {
    var fileName = url.searchParams.get('file');
    if (!fileName) { res.writeHead(400); res.end('{"error":"missing file"}'); return; }
    var jsonPath = path.join(dataDir, fileName);
    if (!fs.existsSync(jsonPath)) { res.writeHead(404); res.end('{"error":"file not found"}'); return; }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(fs.readFileSync(jsonPath, 'utf8'));
    return;
  }

  // Static files — serve from _site/ or root
  const relPath = pathname === '/' ? 'index.html' : pathname.slice(1);
  let filePath = path.join(siteDir, relPath);
  if (!fs.existsSync(filePath) && (relPath.startsWith('images/') || relPath.startsWith('previews/'))) {
    filePath = path.join(dir, relPath);
  }
  serveFile(res, filePath);
});

console.log('Building site...');
build();
server.listen(PORT, () => {
  console.log(`\n  ROSE DATABASE — http://localhost:${PORT}\n  ADMIN PAGE — http://localhost:${PORT}/admin\n`);
});

