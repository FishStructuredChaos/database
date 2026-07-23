const GIST = {
  TEXT: 'https://gist.githubusercontent.com/TheZiver/9b85c8b8b6c1b4caa17dda8d37dc18ac/raw',
  JSON: 'https://gist.githubusercontent.com/TheZiver/bb99f9facb8d14fd607dbb79e9a99d83/raw',
};

const ALLOWED_TAGS = ['ROSE_FISH', 'FISH'];

const tabs = [
  { id: 'information', label: '\u2753INFORMATION', render: renderInformation },
  { id: 'public-avatars', label: '\ud83c\udf39PUBLIC-AVATARS', render: renderAvatarsCards },
  { id: 'worlds', label: '\ud83c\udf0eWORLDS', render: renderWorldsCards },
  { id: 'art-graphics', label: '\ud83c\udfb4ART-GRAPHICS', render: renderSimpleExternal },
  { id: 'models-3d', label: '\ud83d\udcbe3D-MODELS', render: renderTable },
  { id: 'sounds', label: '\ud83d\udd0aSOUNDS', render: renderSimpleExternal },
  { id: 'avatar-prefabs', label: '\ud83d\udce6AVATAR-PREFABS', render: renderTable },
  { id: 'world-prefabs', label: '\ud83d\udce6WORLD-PREFABS', render: renderTable },
  { id: 'shaders', label: '\ud83d\uddbc\ufe0fSHADERS', render: renderTable },
  { id: 'tools', label: '\ud83d\udee0\ufe0fTOOLS', render: renderTable },
  { id: 'luxury-trash', label: '\ud83d\udcb0LUXURY TRASH', render: renderTable },
  { id: 'useful-things', label: '\ud83d\udc96USEFUL-THINGS', render: renderTable },
  { id: 'asset-websites', label: '\ud83c\udf10ASSET-WEBSITES', render: renderTable },
];

function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }

async function init() {
  const tabNav = $('#tab-nav');
  const tabContainer = $('#tab-container');

  tabs.forEach(t => {
    const btn = document.createElement('button');
    btn.className = 'tab-btn';
    btn.textContent = t.label;
    btn.dataset.tab = t.id;
    btn.addEventListener('click', () => switchTab(t.id));
    tabNav.appendChild(btn);
  });

  tabs.forEach(t => {
    const div = document.createElement('div');
    div.id = `tab-${t.id}`;
    div.className = 'tab-content';
    tabContainer.appendChild(div);
  });

  switchTab('information');
}

function switchTab(id) {
  $$('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === id));
  $$('.tab-content').forEach(c => c.classList.remove('active'));

  const content = $(`#tab-${id}`);
  content.classList.add('active');

  const tab = tabs.find(t => t.id === id);
  if (tab && tab.render) {
    content.innerHTML = '<div class="loader">loading...</div>';
    tab.render(content);
  }
}

async function renderInformation(el) {
  const info = {
    perks: [
      'Secret cool places in worlds',
      'Participate in votes for upcoming ROSE FISH members',
      'Name placement on the ROSE FISH CONTRIBUTIONS boards in VRChat worlds and database',
      'Ability to share your public avatars at ROSE <>< AVATARS WORLD',
      'Ability to share stuff at ROSE FISH DATABASE',
      'Access to the #rose-chat at <>< discord server',
    ],
    groupLink: 'https://vrc.group/ROSE.6063',
    guidelines: [
      'Avatar context matters — avatars designed with the intention of being sexual, offensive, or malicious are not allowed.',
      'Avatars can wear skimpy clothing, but it must be used in a non-sexual manner.',
      'Avatars that show realistic violence or gore are not allowed.',
      'Avatars that are loud, disruptive, or malicious are allowed if created for comedic purposes. This includes avatars with bright colors, flashing images, and performance-heavy shaders.',
      'By submitting an avatar, users accept the risk of a DMCA strike if they violate intellectual property rights.',
    ],
  };

  el.innerHTML = `
    <div class="info-section welcome-section">
      <img src="images/ROSE_FISH_SPIN.gif" alt="ROSE FISH" class="welcome-fish">
      <h2>WELCOME</h2>
      <p>Content creation community that makes content for <><</p>
      <p style="margin-top:10px"><strong>When someone joins ROSE FISH, they get access to:</strong></p>
      <ul class="perks-list">
        ${info.perks.map(p => `<li>${p}</li>`).join('')}
      </ul>
      <div class="welcome-links">
        ROSE FISH VRChat group: <a href="${info.groupLink}" target="_blank">${info.groupLink}</a><br>
        More info at: theziver.com discord server
      </div>
    </div>

    <div class="info-section">
      <h2>AVATAR GUIDELINES</h2>
      <ul>
        ${info.guidelines.map(g => `<li>${g}</li>`).join('')}
      </ul>
    </div>

    <div class="info-section">
      <h2>CONTRIBUTIONS <span class="count" id="contrib-count"></span></h2>
      <div class="contributions-list" id="contributions-list">
        <div class="loader">loading contributions...</div>
      </div>
    </div>
  `;

  try {
    const resp = await fetch(GIST.TEXT);
    const rawText = await resp.text();
    const lines = rawText.split('\n');
    const members = [];

    for (let i = 0; i < lines.length - 1; i++) {
      const line1 = lines[i].trim();
      const line2 = lines[i + 1].trim();
      if (line1.startsWith('<size=20>') && line1.endsWith('</size>') &&
          line2.startsWith('<size=10>') && line2.endsWith('</size>')) {
        const nameRaw = line1.substring(9, line1.length - 7).trim();
        const contributionRaw = line2.substring(9, line2.length - 7).trim();
        const nameClean = nameRaw.replace(/<[^>]+>/g, '').trim();
        const contributionClean = contributionRaw.replace(/<[^>]+>/g, '').trim();
        if (nameClean || contributionClean) {
          members.push({ name: nameClean, contribution: contributionClean });
        }
        i++;
      }
    }

    const listEl = $('#contributions-list');
    const countEl = $('#contrib-count');
    if (members.length === 0) {
      listEl.innerHTML = '<p class="empty-note">No contributions data available.</p>';
    } else {
      countEl.textContent = `(${members.length})`;
      listEl.innerHTML = members.map(m => `
        <div class="member">
          <div class="member-name">${escapeHtml(m.name)}</div>
          <div class="member-desc">${escapeHtml(m.contribution)}</div>
        </div>
      `).join('');
    }
  } catch (e) {
    $('#contributions-list').innerHTML = '<p class="empty-note">Failed to load contributions.</p>';
  }
}

async function renderAvatarsCards(el) {
  await renderCardsFromGist(el, 'community_avatars', (item) => ({
    name: item.avatar_name,
    author: item.author,
    image: item.avatar_image_url,
    link: item.avatar_link,
    tags: item.tags || [],
  }));
}

async function renderWorldsCards(el) {
  await renderCardsFromGist(el, 'community_worlds', (item) => ({
    name: item.world_name,
    author: item.author,
    image: item.world_image_url,
    link: item.world_link,
    tags: item.tags || [],
  }));
}

async function renderCardsFromGist(el, arrayKey, mapper) {
  try {
    const resp = await fetch(GIST.JSON);
    const json = await resp.json();
    const items = (json[arrayKey] || [])
      .filter(item => item && item.tags && Array.isArray(item.tags) && item.tags.some(t => ALLOWED_TAGS.includes(t)))
      .sort((a, b) => {
        const aRose = a.tags.includes('ROSE_FISH');
        const bRose = b.tags.includes('ROSE_FISH');
        if (aRose && !bRose) return -1;
        if (!aRose && bRose) return 1;
        return 0;
      });

    if (items.length === 0) {
      el.innerHTML = '<div class="empty-state">No items found.</div>';
      return;
    }

    const cards = items.map(mapper);
    const roseCount = cards.filter(c => c.tags.includes('ROSE_FISH')).length;
    const fishCount = cards.filter(c => !c.tags.includes('ROSE_FISH') && c.tags.includes('FISH')).length;

    el.innerHTML = `
      <div class="section-info">
        <span class="count">${items.length} items</span>
        <span class="tag-rose">rose_fish: ${roseCount}</span>
        <span class="tag-fish">fish: ${fishCount}</span>
      </div>
      <div class="search-bar">
        <input type="text" placeholder="search..." oninput="filterCards(this, 'card-grid-${arrayKey}')">
      </div>
      <div class="card-grid" id="card-grid-${arrayKey}">
        ${cards.map(c => {
          const link = c.link ? escapeHtml(c.link) : null;
          const isRose = c.tags.includes('ROSE_FISH');
          const tagLabels = c.tags.filter(t => t !== 'ROSE_FISH' && t !== 'FISH').map(t => escapeHtml(t));
          return `
          <div class="card">
            ${link ? `<a href="${link}" target="_blank" class="card-link-wrap">` : '<div class="card-link-wrap">'}
              <div class="card-img-wrap">
                ${c.image
                  ? `<img class="card-img" src="${escapeHtml(c.image)}" alt="${escapeHtml(c.name)}" loading="lazy">`
                  : `<div class="card-img-placeholder">?</div>`
                }
                <div class="card-tags">
                  <span class="tag${isRose ? ' tag-r' : ' tag-f'}">${isRose ? 'rose_fish' : 'fish'}</span>
                  ${tagLabels.slice(0, 2).map(t => `<span class="tag tag-o">${t}</span>`).join('')}
                </div>
              </div>
              <div class="card-body">
                <div class="card-name">${escapeHtml(c.name)}</div>
                <div class="card-author">by ${escapeHtml(c.author)}</div>
              </div>
            ${link ? `</a>` : '</div>'}
          </div>`;
        }).join('')}
      </div>
    `;

    el.querySelectorAll('.card-img').forEach(img => {
      img.addEventListener('error', function() {
        this.parentElement.innerHTML = '<div class="card-img-placeholder">?</div>';
      });
    });
  } catch (e) {
    el.innerHTML = '<div class="empty-state">Failed to load data.</div>';
  }
}

function filterCards(input, gridId) {
  const q = input.value.toLowerCase();
  const cards = document.querySelectorAll(`#${gridId} .card`);
  let count = 0;
  cards.forEach(card => {
    const match = card.textContent.toLowerCase().includes(q);
    card.style.display = match ? '' : 'none';
    if (match) count++;
  });
  const info = input.parentElement.previousElementSibling;
  if (info && info.classList.contains('section-info')) {
    const countEl = info.querySelector('.count');
    if (countEl) countEl.textContent = `${count} items`;
  }
}

async function renderTable(el) {
  const tabId = el.id.replace('tab-', '');
  try {
    const resp = await fetch(`data/${tabId}.json`);
    const data = await resp.json();

    if (!data.rows || data.rows.length === 0) {
      if (data.notes) {
        const match = data.notes.match(/(https?:\/\/[^\s]+)/);
        const url = match ? match[1] : '#';
        el.innerHTML = `
          <div class="external-link-card">
            <a href="${escapeHtml(url)}" target="_blank">${escapeHtml(data.title || 'Open')}</a>
            <p style="margin-top:12px">${escapeHtml(data.notes)}</p>
          </div>
        `;
      } else {
        el.innerHTML = '<div class="empty-state">No entries yet.</div>';
      }
      return;
    }

    let extraHtml = '';
    if (data.worldLink) {
      extraHtml = `<a class="world-badge" href="${escapeHtml(data.worldLink)}" target="_blank">view world: luxury trash</a>`;
    }

    el.innerHTML = `
      ${extraHtml}
      <div class="section-info">
        <span class="count">${data.rows.length} items</span>
      </div>
      <div class="search-bar">
        <input type="text" placeholder="search..." oninput="filterTable(this, 'table-${tabId}')">
      </div>
      <div class="table-container">
        <table id="table-${tabId}">
          <thead>
            <tr>${data.headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${data.rows.map(row => `
              <tr>
                ${row.map((cell, ci) => {
                  const header = data.headers[ci] || '';
                  const isLink = header.match(/link|website|download/i);
                  const isImage = header.match(/picture|preview|image/i);
                  const isPrice = header.match(/price/i);

                  if (cell && isLink && cell.startsWith('http')) {
                    return `<td><a href="${escapeHtml(cell)}" target="_blank">${escapeHtml(cell)}</a></td>`;
                  }
                  if (cell && isImage && cell.startsWith('http')) {
                    return `<td><img src="${escapeHtml(cell)}" class="table-img" loading="lazy"></td>`;
                  }
                  if (cell && isPrice) {
                    return `<td class="price${cell.toLowerCase() === 'free' ? ' free' : ''}">${escapeHtml(cell)}</td>`;
                  }
                  return `<td>${escapeHtml(cell || '')}</td>`;
                }).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (e) {
    el.innerHTML = '<div class="empty-state">Failed to load data.</div>';
  }
}

function filterTable(input, tableId) {
  const q = input.value.toLowerCase();
  const rows = document.querySelectorAll(`#${tableId} tbody tr`);
  let count = 0;
  rows.forEach(row => {
    const match = row.textContent.toLowerCase().includes(q);
    row.style.display = match ? '' : 'none';
    if (match) count++;
  });
  const info = input.parentElement.previousElementSibling;
  if (info && info.classList.contains('section-info')) {
    const countEl = info.querySelector('.count');
    if (countEl) countEl.textContent = `${count} items`;
  }
}

function renderSimpleExternal(el) {
  const tabId = el.id.replace('tab-', '');
  fetch(`data/${tabId}.json`)
    .then(r => r.json())
    .then(data => {
      if (data.notes) {
        const match = data.notes.match(/(https?:\/\/[^\s]+)/);
        const url = match ? match[1] : '#';
        el.innerHTML = `
          <div class="external-link-card">
            <a href="${escapeHtml(url)}" target="_blank">${escapeHtml(data.title || 'Open')}</a>
            <p>${escapeHtml(data.notes)}</p>
          </div>
        `;
      } else {
        el.innerHTML = '<div class="empty-state">No data available.</div>';
      }
    })
    .catch(() => {
      el.innerHTML = '<div class="empty-state">No data available.</div>';
    });
}

function escapeHtml(str) {
  if (str == null) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

document.addEventListener('DOMContentLoaded', init);
