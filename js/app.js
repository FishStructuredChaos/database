const GIST = {
  TEXT: 'https://gist.githubusercontent.com/TheZiver/9b85c8b8b6c1b4caa17dda8d37dc18ac/raw',
  JSON: 'https://gist.githubusercontent.com/TheZiver/bb99f9facb8d14fd607dbb79e9a99d83/raw',
};

const STATIC_DATA = [
  'asset-websites', 'models-3d', 'sounds', 'avatar-prefabs',
  'world-prefabs', 'shaders', 'tools', 'luxury-trash',
  'useful-things', 'art-graphics',
];

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

function $(sel) {
  return document.querySelector(sel);
}

function $$(sel) {
  return document.querySelectorAll(sel);
}

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
    content.innerHTML = '<div class="loader">Loading...</div>';
    tab.render(content);
  }
}

async function renderInformation(el) {
  const info = {
    title: 'ROSE \uff1c\uff1e\uff1c DATABASE',
    description: 'Content creation community that makes content for \uff1c\uff1e\uff1c',
    perks: [
      'SECRET COOL PLACES IN WORLDS',
      'Participate in votes for upcoming ROSE FISH members',
      'Name placement on the ROSE FISH CONTRIBUTIONS boards in VRChat worlds and database',
      'Ability to share your public avatars at ROSE \uff1c\uff1e\uff1c AVATARS WORLD',
      'Ability to share stuff at ROSE FISH DATABASE',
      'Access to the #\ud83c\udf19rose-chat at \uff1c\uff1e\uff1c discord server',
    ],
    groupLink: 'https://vrc.group/ROSE.6063',
    moreInfo: 'theziver.com discord server',
    guidelines: [
      'AVATAR CONTEXT: Avatar context matters, avatars designed with the intention of being sexual, offensive, or malicious are not allowed.',
      'CLOTHING: Avatars can wear skimpy clothing, but it must be used in a non-sexual manner.',
      'GORE: Avatars that show realistic violence or gore are not allowed.',
      'PARODY COMEDY: Avatars that are loud, disruptive, or malicious are allowed if they\u2019re created for comedic purposes. This includes avatars with bright colors, flashing images, and performance-heavy shaders.',
      'COPYRIGHT RESPONSIBILITY: By submitting an avatar, users accept the risk of a DMCA strike if they violate intellectual property rights.',
    ],
  };

  let html = `
    <div class="info-section">
      <h2>${info.title}</h2>
      <p>${info.description}</p>
      <p style="margin-top:12px">When someone joins ROSE FISH, they get access to exclusive things like:</p>
      <ul>
        ${info.perks.map(p => `<li>${p}</li>`).join('')}
      </ul>
      <p style="margin-top:12px">If you become a ROSE FISH member you also get invited to the ROSE FISH VRChat group: <a href="${info.groupLink}" target="_blank">${info.groupLink}</a></p>
      <p>more info at: ${info.moreInfo}</p>
    </div>

    <div class="info-section">
      <h2>ROSE FISH AVATAR GUIDELINES \uff1c\uff1e\uff1c</h2>
      <ul>
        ${info.guidelines.map(g => `<li>${g}</li>`).join('')}
      </ul>
    </div>

    <div class="info-section">
      <h2>ROSE FISH CONTRIBUTIONS</h2>
      <div class="contributions-list" id="contributions-list">
        <div class="loader">Loading contributions...</div>
      </div>
    </div>
  `;

  el.innerHTML = html;

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
          members.push({ name: nameClean || 'N/A', contribution: contributionClean || 'N/A' });
        }
        i++;
      }
    }

    const listEl = $('#contributions-list');
    if (members.length === 0) {
      listEl.innerHTML = '<p style="color:#666">No contributions data available.</p>';
    } else {
      listEl.innerHTML = members.map(m => `
        <div class="member">
          <div class="name">${escapeHtml(m.name)}</div>
          <div class="contribution">${escapeHtml(m.contribution)}</div>
        </div>
      `).join('');
    }
  } catch (e) {
    $('#contributions-list').innerHTML = '<p style="color:#ff6b9d">Failed to load contributions.</p>';
  }
}

async function renderAvatarsCards(el) {
  await renderCardsFromGist(el, 'community_avatars', 'avatars', (item) => ({
    name: item.avatar_name,
    author: item.author,
    image: item.avatar_image_url,
    link: item.avatar_link,
    isRose: item.tags && item.tags.includes('ROSE_FISH'),
  }));
}

async function renderWorldsCards(el) {
  await renderCardsFromGist(el, 'community_worlds', 'worlds', (item) => ({
    name: item.world_name,
    author: item.author,
    image: item.world_image_url,
    link: item.world_link,
    isRose: item.tags && item.tags.includes('ROSE_FISH'),
  }));
}

async function renderCardsFromGist(el, arrayKey, type, mapper) {
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
    el.innerHTML = `
      <div class="search-bar">
        <input type="text" placeholder="Search ${type}..." oninput="filterCards(this, 'card-grid-${type}')">
      </div>
      <div class="card-grid" id="card-grid-${type}">
        ${cards.map(c => `
          <div class="card${c.isRose ? '' : ' dimmed'}">
            <div class="card-img-wrap">
              ${c.image
                ? `<img class="card-img" src="${escapeHtml(c.image)}" alt="${escapeHtml(c.name)}" loading="lazy">`
                : `<div class="card-img-placeholder">\ud83d\udcf7</div>`
              }
            </div>
            <div class="card-body">
              <h3>${escapeHtml(c.name)}</h3>
              <div class="author">${escapeHtml(c.author)}</div>
              ${c.link ? `<a class="card-link" href="${escapeHtml(c.link)}" target="_blank">Open in VRChat</a>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;

    el.querySelectorAll('.card-img').forEach(img => {
      img.addEventListener('error', function() {
        this.parentElement.innerHTML = '<div class="card-img-placeholder">\ud83d\udcf7</div>';
      });
    });
  } catch (e) {
    el.innerHTML = '<div class="empty-state">Failed to load data. Check console for details.</div>';
  }
}

function filterCards(input, gridId) {
  const q = input.value.toLowerCase();
  const cards = document.querySelectorAll(`#${gridId} .card`);
  cards.forEach(card => {
    const text = card.textContent.toLowerCase();
    card.style.display = text.includes(q) ? '' : 'none';
  });
}

async function renderTable(el) {
  const tabId = el.id.replace('tab-', '');
  try {
    const resp = await fetch(`data/${tabId}.json`);
    const data = await resp.json();

    if (!data.rows || data.rows.length === 0) {
      if (data.notes) {
        el.innerHTML = `
          <div class="external-link-card">
            <p style="margin-bottom:16px;color:#aaa">${escapeHtml(data.notes)}</p>
          </div>
        `;
      } else {
        el.innerHTML = '<div class="empty-state">No entries yet.</div>';
      }
      return;
    }

    let extraHtml = '';
    if (data.worldLink) {
      extraHtml = `<a class="world-badge" href="${escapeHtml(data.worldLink)}" target="_blank">\ud83c\udf0d View in VRChat: LUXURY TRASH WORLD</a>`;
    }

    const searchable = data.headers.length > 0;
    el.innerHTML = `
      ${extraHtml}
      ${searchable ? `<div class="search-bar"><input type="text" placeholder="Search..." oninput="filterTable(this, 'table-${tabId}')"></div>` : ''}
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
                  const isLinkCol = header.toLowerCase().includes('link') || header.toLowerCase().includes('website');
                  const isImageCol = header.toLowerCase().includes('picture') || header.toLowerCase().includes('preview') || header.toLowerCase().includes('image');
                  const isPriceCol = header.toLowerCase().includes('price');

                  if (cell && isLinkCol && cell.startsWith('http')) {
                    return `<td><a href="${escapeHtml(cell)}" target="_blank">${escapeHtml(truncate(cell, 60))}</a></td>`;
                  }
                  if (cell && isImageCol) {
                    return `<td>${cell.startsWith('http') ? `<img src="${escapeHtml(cell)}" style="width:60px;height:60px;object-fit:cover;border-radius:4px;background:#1a1a2e" onerror="this.style.display='none'">` : ''}</td>`;
                  }
                  if (cell && isPriceCol) {
                    const isFree = cell.toLowerCase() === 'free';
                    return `<td class="price ${isFree ? 'free' : ''}">${escapeHtml(cell)}</td>`;
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
  rows.forEach(row => {
    row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
}

function renderSimpleExternal(el) {
  const tabId = el.id.replace('tab-', '');
  fetch(`data/${tabId}.json`)
    .then(r => r.json())
    .then(data => {
      if (data.notes) {
        const match = data.notes.match(/(https?:\/\/[^\s]+)/);
        const url = match ? match[1] : '#';
        const label = data.title || 'Open';
        el.innerHTML = `
          <div class="external-link-card">
            <a href="${escapeHtml(url)}" target="_blank">${escapeHtml(label)}</a>
            <p style="margin-top:12px;color:#666;font-size:0.85rem">${escapeHtml(data.notes)}</p>
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
  if (str === null || str === undefined) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function truncate(str, len) {
  if (str.length <= len) return str;
  return str.substring(0, len) + '...';
}

document.addEventListener('DOMContentLoaded', init);
