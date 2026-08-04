(function () {
  const ALLOWED_TAGS = ['ROSE_FISH', 'FISH'];

  // Shared constants: gist raw URLs (by name, always latest), repo/worker
  // bases, and the repeated UI strings.
  const GIST_FISH_CONTRIB_URL = 'https://gist.githubusercontent.com/TheZiver/9b85c8b8b6c1b4caa17dda8d37dc18ac/raw';
  const GIST_AVATARS_ECO_URL = 'https://gist.githubusercontent.com/TheZiver/bb99f9facb8d14fd607dbb79e9a99d83/raw';
  const GIST_VRC_QUEUE_URL = 'https://gist.githubusercontent.com/FishStructuredChaos/56babd51194abfdffa87d11a481c3541/raw/database-pending-worlds-avatars-groups.json';
  const GIST_PENDING_FILES_URL = 'https://gist.githubusercontent.com/FishStructuredChaos/7b0971c63dbb689847b81cdf84299c1f/raw/database-pending-files.json';
  const GIST_GROUPS_ECO_URL = 'https://gist.githubusercontent.com/TheZiver/9fdd3f8c495098ffa0beceece373d382/raw/structured_chaos_community_ecosystem_groups.json';
  const GIST_MEMBERS_URL = 'https://gist.githubusercontent.com/TheZiver/def41cbeb9b2e8eb071015f58bf8eb54/raw/48b6c7290489157d85e01f23d51915e4105c78dd/fish_community_members.txt';
  const WORKER_BASE = 'https://data.theziver.com';
  const REPO_BASE = 'https://raw.githubusercontent.com/FishStructuredChaos/database/main/';
  const DEFAULT_GROUP_ICON = 'https://assets.vrchat.com/www/groups/default_icon.png';
  const MSG_EMPTY = 'Nothing archived here yet \u2014 be the first!';
  const MSG_ERROR = 'Couldn\u2019t reach the archive \u2014 try again in a bit.';

  function esc(str) {
    if (str == null) return '';
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  document.addEventListener('DOMContentLoaded', function () {
    initTabs();
    loadContributions();
    loadGistTabs();
    loadDataTabs();
    loadGroups();
    loadMembers();
    loadWhatsNew();
    initGlobalSearch();
    initBackTop();
  });

  function initBackTop() {
    var btn = document.getElementById('backTop');
    if (!btn) return;
    window.addEventListener('scroll', function () {
      btn.style.display = window.scrollY > 400 ? 'block' : 'none';
    }, { passive: true });
    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  function initTabs() {
    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        switchTab(this.dataset.tab);
      });
    });

    if (buttons.length > 0) {
      switchTab(buttons[0].dataset.tab);
    }
  }

  function switchTab(id) {
    document.querySelectorAll('.tab-btn').forEach(function (b) {
      b.classList.toggle('active', b.dataset.tab === id);
    });
    document.querySelectorAll('.tab-content').forEach(function (c) {
      c.classList.toggle('active', c.id === 'tab-' + id);
    });
  }

  function loadContributions() {
    var listEl = document.getElementById('rosefish-members-list');
    if (!listEl) return;

    fetch(GIST_FISH_CONTRIB_URL)
      .then(function (r) { return r.text(); })
      .then(function (rawText) {
        var lines = rawText.split('\n');
        var members = [];
        for (var i = 0; i < lines.length - 1; i++) {
          var line1 = lines[i].trim();
          var line2 = lines[i + 1].trim();
          if (line1.indexOf('<size=20>') === 0 && line1.indexOf('</size>') === line1.length - 7 &&
              line2.indexOf('<size=10>') === 0 && line2.indexOf('</size>') === line2.length - 7) {
            var nameRaw = line1.substring(9, line1.length - 7).trim();
            var contribRaw = line2.substring(9, line2.length - 7).trim();
            var nameClean = nameRaw.replace(/<[^>]+>/g, '').trim();
            var contribClean = contribRaw.replace(/<[^>]+>/g, '').trim();
            if (nameClean || contribClean) {
              members.push({ name: nameClean, contribution: contribClean });
            }
            i++;
          }
        }
        if (members.length === 0) {
          listEl.innerHTML = '<p class="empty-note">' + MSG_EMPTY + '</p>';
        } else {
          listEl.innerHTML = members.map(function (m) {
            return '<div class="member"><div class="member-name">' + esc(m.name) + '</div><div class="member-desc">' + esc(m.contribution) + '</div></div>';
          }).join('');
        }
      })
      .catch(function () {
        listEl.innerHTML = '<p class="empty-note">' + MSG_ERROR + '</p>';
      });
  }

  function loadGistTabs() {
    var grids = document.querySelectorAll('.card-grid[data-gist-key]');
    if (grids.length === 0) return;

    fetch(GIST_AVATARS_ECO_URL)
      .then(function (r) { return r.json(); })
      .then(function (json) {
        grids.forEach(function (grid) {
          var key = grid.dataset.gistKey;
          var items = (json[key] || []).filter(function (item) {
            return item && item.tags && Array.isArray(item.tags) &&
              item.tags.some(function (t) { return ALLOWED_TAGS.indexOf(t) >= 0; });
          });
          items.sort(function (a, b) {
            var aRose = a.tags.indexOf('ROSE_FISH') >= 0;
            var bRose = b.tags.indexOf('ROSE_FISH') >= 0;
            if (aRose && !bRose) return -1;
            if (!aRose && bRose) return 1;
            return 0;
          });

          var label = items.length + ' ' + key.replace('community_', '');
          var countEl = document.getElementById('count-' + (key === 'community_avatars' ? 'public-avatars' : 'worlds'));
          if (countEl) countEl.textContent = label;

          if (items.length === 0) {
            grid.innerHTML = '<div class="empty-state">' + MSG_EMPTY + '</div>';
            return;
          }

          grid.innerHTML = items.map(function (item) {
            var name = item.avatar_name || item.world_name || '';
            var author = item.author || '';
            var image = item.avatar_image_url || item.world_image_url || '';
            var link = item.avatar_link || item.world_link || '';
            var tags = item.tags || [];
            var otherTag = tags.filter(function (t) { return t !== 'ROSE_FISH' && t !== 'FISH'; })[0];
            var hasFish = tags.indexOf('FISH') >= 0;
            var hasRose = tags.indexOf('ROSE_FISH') >= 0;

            var displayTag, tagClass;
            if (otherTag) {
              displayTag = otherTag;
              tagClass = 'tag-o';
            } else if (hasFish) {
              displayTag = 'fish';
              tagClass = 'tag-f';
            } else if (hasRose) {
              displayTag = 'rose_fish';
              tagClass = 'tag-r';
            }

            var card = '<div class="card">';
            if (link) {
              card += '<a href="' + esc(link) + '" target="_blank" class="card-link-wrap">';
            } else {
              card += '<div class="card-link-wrap">';
            }
            card += '<div class="card-img-wrap">';
            if (image) {
              card += '<img class="card-img" src="' + esc(image) + '" alt="' + esc(name) + '" loading="lazy" decoding="async">';
            } else {
              card += '<div class="card-img-placeholder">?</div>';
            }
            card += '<div class="card-tags">';
            if (displayTag) {
              card += '<span class="tag ' + tagClass + '">' + esc(displayTag) + '</span>';
            }
            card += '</div></div>';
            card += '<div class="card-body">';
            card += '<div class="card-name">' + esc(name) + '</div>';
            card += '<div class="card-author">by ' + esc(author) + '</div>';
            card += '</div>';
            card += link ? '</a>' : '</div>';
            card += '</div>';
            return card;
          }).join('');

          grid.querySelectorAll('.card-img').forEach(function (img) {
            img.addEventListener('error', function () {
              // Replace only the image, not the whole wrapper: innerHTML on the
              // wrapper would wipe the tag badges sitting next to the image.
              this.outerHTML = '<div class="card-img-placeholder">?</div>';
            });
          });
        });
      })
      .catch(function () {
        grids.forEach(function (grid) {
          grid.innerHTML = '<div class="empty-state">' + MSG_ERROR + '</div>';
        });
      });
  }

  function loadDataTabs() {
    var grids = document.querySelectorAll('.data-card-grid[data-file]');
    if (grids.length === 0) return;

    var downloadTabs = new Set(['models-3d', 'avatar-prefabs', 'shaders']);
    var noButtonTabs = new Set(['asset-websites', 'useful-things', 'luxury-trash', 'tools', 'web-apps', 'websites']);

    function findCol(headers, pattern) {
      var re = new RegExp(pattern, 'i');
      for (var i = 0; i < headers.length; i++) {
        if (re.test(headers[i])) return i;
      }
      return -1;
    }

    grids.forEach(function (grid) {
      var fileId = grid.dataset.file;
      var url = REPO_BASE + 'data/' + fileId + '.json';

      fetch(url)
        .then(function (r) { return r.json(); })
        .then(function (d) {
          var rows = d.rows || [];
          var headers = d.headers || [];
          var countEl = document.getElementById('count-' + fileId);
          if (countEl) countEl.textContent = rows.length + ' items';

          if (rows.length === 0) {
            grid.innerHTML = '<div class="empty-state">' + MSG_EMPTY + '</div>';
            return;
          }

          var picIdx = findCol(headers, 'picture|preview|image');
          var linkIdx = findCol(headers, 'link|website|download');
          var priceIdx = findCol(headers, 'price');
          var btnIdx = findCol(headers, 'button');
          var isNoBtn = noButtonTabs.has(fileId);
          var defaultLabel = downloadTabs.has(fileId) ? 'DOWNLOAD' : 'OPEN';

          var html = '';
          for (var ri = 0; ri < rows.length; ri++) {
            var row = rows[ri];
            var name = row[0] || '';
            var img = picIdx >= 0 ? (row[picIdx] || '') : '';
            var link = linkIdx >= 0 ? (row[linkIdx] || '') : '';
            var rowLabel = (btnIdx >= 0 && row[btnIdx]) ? row[btnIdx] : defaultLabel;

            if (isNoBtn && link) {
              html += '<a href="' + esc(link.indexOf('/r2/') === 0 ? WORKER_BASE + link : link) + '" target="_blank" class="data-card-link">';
            }
            html += '<div class="data-card">';
            if (img) {
              html += '<div class="dc-img-wrap"><img class="table-img" src="' + esc(resolveImg(img)) + '" alt="' + esc(name) + '" loading="lazy" decoding="async"></div>';
            }
            html += '<div class="dc-body">';
            html += '<div class="dc-name">' + esc(name) + '</div>';
            for (var ci = 1; ci < headers.length; ci++) {
              if (ci === picIdx || ci === linkIdx || ci === btnIdx) continue;
              var cell = row[ci];
              if (!cell) continue;
              var headerText = headers[ci];
              var isInfo = headerText.toLowerCase().indexOf('info about') === 0;
              html += '<div class="dc-field">' + (isInfo ? '' : '<span class="dc-label">' + esc(headerText) + ':</span>');
              if (ci === priceIdx) {
                var priceClass = String(cell).toLowerCase() === 'free' ? ' price free' : ' price';
                html += '<span class="dc-value' + priceClass + '">' + esc(cell) + '</span>';
              } else {
                html += '<span class="dc-value">' + esc(cell) + '</span>';
              }
              html += '</div>';
            }
            if (!isNoBtn && link) {
              html += '<div class="dc-link-out"><a href="' + esc(link.indexOf('/r2/') === 0 ? WORKER_BASE + link : link) + '" target="_blank">' + esc(rowLabel) + '</a></div>';
            }
            html += '</div></div>';
            if (isNoBtn && link) {
              html += '</a>';
            }
          }
          grid.innerHTML = html;
        })
        .catch(function () {
          grid.innerHTML = '<div class="empty-state">' + MSG_ERROR + '</div>';
        });
    });
  }

  // WHAT'S NEW: the 5 most recently approved entries from the review gist,
  // shown on the INFORMATION tab. Thumbnails are matched from the ecosystem
  // gists by URL (emoji fallback when there's no image). Hidden quietly if the
  // gist is unreachable.
  // Shared "locate + mark" helpers for WHAT IS NEW cards and search results.
  var wnArrowTimer = null;
  function markTarget(card) {
    document.querySelectorAll('.wn-target').forEach(function (c) { c.classList.remove('wn-target'); });
    document.querySelectorAll('.wn-arrow').forEach(function (a) { a.remove(); });
    clearTimeout(wnArrowTimer);
    card.classList.add('wn-target');
    var dirs = ['t', 'b', 'l', 'r'];
    dirs.forEach(function (dir) {
      var a = document.createElement('div');
      a.className = 'wn-arrow wn-arrow-' + dir;
      a.textContent = dir === 't' ? '\u25BC' : dir === 'b' ? '\u25B2' : dir === 'l' ? '\u25B6' : '\u25C0';
      card.appendChild(a);
    });
    try { card.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { card.scrollIntoView(); }
    wnArrowTimer = setTimeout(function () {
      card.classList.remove('wn-target');
      card.querySelectorAll('.wn-arrow').forEach(function (a) { a.remove(); });
    }, 4000);
  }
  function locateCard(tabId, kind, url, name) {
    var card = null;
    var urlId = url ? String(url).match(/[a-z]{3,4}_[a-f0-9-]+$/i) : null;
    urlId = urlId ? urlId[0].toLowerCase() : null;
    if (kind === 'vrc' && url) {
      var links = document.querySelectorAll('#card-grid-worlds a[href], #card-grid-public-avatars a[href], #card-grid-vrchat-groups a[href]');
      for (var i = 0; i < links.length; i++) {
        var href = links[i].getAttribute('href') || '';
        var hrefId = href.match(/[a-z]{3,4}_[a-f0-9-]+$/i);
        hrefId = hrefId ? hrefId[0].toLowerCase() : null;
        if (href === url || (urlId && hrefId === urlId)) { card = links[i].closest('.card, .group-card'); break; }
      }
    } else if (kind === 'file' && tabId) {
      var grid = document.querySelector('.data-card-grid[data-file="' + tabId + '"]');
      if (grid) {
        var names = grid.querySelectorAll('.dc-name');
        for (var j = 0; j < names.length; j++) {
          if (name && names[j].textContent.trim().indexOf(name) === 0) { card = names[j].closest('.data-card'); break; }
        }
      }
    }
    return card;
  }
  var wnNoticeEl = null;
  var wnNoticeTimer = null;
  function flashNotice(msg) {
    if (wnNoticeEl && wnNoticeEl.parentNode) wnNoticeEl.parentNode.removeChild(wnNoticeEl);
    if (wnNoticeTimer) clearTimeout(wnNoticeTimer);
    var el = document.createElement('div');
    el.className = 'wn-notice';
    el.textContent = msg;
    var anchor = document.getElementById('whatsNew') || document.querySelector('.container');
    if (anchor) anchor.appendChild(el);
    wnNoticeEl = el;
    wnNoticeTimer = setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
      if (wnNoticeEl === el) wnNoticeEl = null;
      wnNoticeTimer = null;
    }, 3200);
  }
  function locateAndMark(tabId, kind, url, name) {
    if (tabId) switchTab(tabId);
    var card = locateCard(tabId, kind, url, name);
    if (card) {
      setTimeout(function () { markTarget(card); }, 60);
    } else if (tabId === 'gallery') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      flashNotice('You can find this image in GALLERY.');
    } else if (tabId === 'sounds') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      flashNotice('You can find this sound in SOUNDS.');
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      flashNotice('This entry isn\u2019t displayed on the site yet.');
    }
  }

  function loadWhatsNew() {
    var el = document.getElementById('whatsNew');
    if (!el) return;
    var list = el.querySelector('.wn-list');
    var FILE_EMOJIS = {
      'models-3d.json': '\ud83d\udcbe', 'avatar-prefabs.json': '\ud83d\udce6', 'world-prefabs.json': '\ud83d\udce6',
      'shaders.json': '\ud83d\uddbc', 'games.json': '\ud83c\udfae', 'tools.json': '\ud83d\udee0',
      'luxury-trash.json': '\ud83d\udcb0', 'useful-things.json': '\ud83d\udc97', 'web-apps.json': '\ud83c\udf10',
      'asset-websites.json': '\ud83c\udf10', 'websites.json': '\ud83c\udf10', 'sounds.json': '\ud83d\udd0a', 'gallery.json': '\ud83d\uddbc',
    };
    // Tab-button labels with emojis, matching the nav exactly.
    var TAB_LABELS = {
      worlds: '\ud83c\udf0eWORLDS', 'public-avatars': '\ud83c\udf39PUBLIC-AVATARS', 'vrchat-groups': '\ud83d\udc65VRCHAT-GROUPS',
      gallery: '\ud83c\udfb4GALLERY', 'models-3d': '\ud83d\udcbe3D-MODELS', sounds: '\ud83d\udd0aSOUNDS',
      'avatar-prefabs': '\ud83d\udce6AVATAR-PREFABS', 'world-prefabs': '\ud83d\udce6WORLD-PREFABS', shaders: '\ud83d\uddbc\ufe0fSHADERS',
      games: '\ud83c\udfaeGAMES', tools: '\ud83d\udee0\ufe0fTOOLS', 'luxury-trash': '\ud83d\udcb0LUXURY TRASH',
      'useful-things': '\ud83d\udc96USEFUL-THINGS', 'web-apps': '\ud83c\udf10WEB-APPS', 'asset-websites': '\ud83c\udf10ASSET-WEBSITES', websites: '\ud83c\udf10WEBSITES',
    };
    var FILE_COLORS = {
      'models-3d.json': '#4466aa', 'avatar-prefabs.json': '#8855bb', 'world-prefabs.json': '#338877',
      'shaders.json': '#55aacc', 'games.json': '#55aa55', 'tools.json': '#cc8833',
      'luxury-trash.json': '#ccaa33', 'useful-things.json': '#cc5588', 'web-apps.json': '#6688dd',
      'asset-websites.json': '#889944', 'websites.json': '#33aa99', 'sounds.json': '#44cc44', 'gallery.json': '#dd66aa',
    };
    var TYPE_META = {
      world: { emoji: '\ud83c\udf0e', label: 'WORLDS', color: '#4466cc' },
      avatar: { emoji: '\ud83c\udf39', label: 'PUBLIC-AVATARS', color: '#cc4488' },
      group: { emoji: '\ud83d\udc65', label: 'VRCHAT-GROUPS', color: '#44aa55' },
    };
    var defaultGroupIcon = DEFAULT_GROUP_ICON;
    function fileLabel(f) { return f ? f.replace('.json', '').replace(/-/g, ' ').toUpperCase() : ''; }
    function show(items) {
      if (!items.length) { list.innerHTML = '<div class="wn-empty">Nothing new yet \u2014 check back soon!</div>'; return; }
      list.innerHTML = items.map(function (e) {
        var img;
        if (e.kind === 'sound') {
          // A div, not a button: this sits inside the card's .wn-link button,
          // and nested <button> elements break the HTML structure.
          img = '<div class="wn-play" role="button" tabindex="0" title="Play" data-url="' + esc(e.audioUrl) + '">\u25B6</div>';
        } else if (e.img) {
          img = '<img class="wn-img" src="' + esc(e.img) + '" loading="lazy" decoding="async" onerror="if(this.dataset.fb){this.style.display=\'none\';this.parentElement.classList.add(\'wn-emoji\')}else{this.dataset.fb=\'1\';this.src=\'' + defaultGroupIcon + '\'}">';
        } else if (e.emoji) {
          img = '<div class="wn-emoji">' + e.emoji + '</div>';
        } else {
          img = '<div class="wn-emoji">' + (TYPE_META[e.type] || TYPE_META.world).emoji + '</div>';
        }
        var linkOpen = '<button type="button" class="wn-link" data-tab="' + e.tab + '" data-kind="' + (e.kind || '') + '" data-url="' + esc(e.url || '') + '" data-name="' + esc(String(e.name).slice(0, 60)) + '">';
        var linkClose = '</button>';
        var authorChip = '';
        if (e.author && e.authorNote !== 'none') {
          // Real creators get "BY <name>"; submitters get just the bare name.
          // Names that are actually URLs (e.g. someone typed their website as
          // their name) display as just the domain.
          var authorTxt = e.author;
          var urlMatch = /^https?:\/\/([^\/]+)/i.exec(e.author);
          if (urlMatch) authorTxt = urlMatch[1];
          authorChip = '<div class="wn-author"' + (e.authorNote === 'submitted' ? ' style="color:#886644;border-color:#443300;background:#1a0f00"' : '') + '>' + (e.authorNote === 'creator' ? 'BY <b>' : '<b>') + esc(authorTxt) + '</b></div>';
        }
        return '<div class="wn-item">'
          + linkOpen
          + '<div class="wn-imgwrap">' + img + '</div>'
          + '<div class="wn-name">' + esc(String(e.name).slice(0, 60)) + '</div>'
          + linkClose
          + authorChip
          + '<div class="wn-meta"><span class="wn-badge">' + esc(e.label) + '</span></div>'
          + '</div>';
      }).join('');
      // Shared audio player for the strip: playing one stops any other, with
      // the .ogg-sibling fallback for converted files.
      var wnAudio = null;
      var wnBtn = null;
      function wnStop() {
        if (wnAudio) { wnAudio.pause(); wnAudio = null; }
        if (wnBtn) { wnBtn.textContent = '\u25B6'; wnBtn.classList.remove('playing'); wnBtn = null; }
      }
      function wnPlay(url, btn) {
        if (wnAudio && wnAudio.dataset.raw === url) { wnStop(); return; }
        wnStop();
        btn.textContent = '\u2026';
        var audio = new Audio(url);
        audio.dataset.raw = url;
        wnAudio = audio;
        wnBtn = btn;
        audio.addEventListener('canplay', function () { btn.textContent = '\u23F8'; btn.classList.add('playing'); });
        audio.addEventListener('error', function () {
          var ogg = url.replace(/\.mp3$/i, '.ogg');
          if (ogg !== url && audio.dataset.tried !== '1') {
            audio.dataset.tried = '1';
            audio.src = ogg;
            audio.play().catch(function () { wnStop(); });
          } else {
            btn.textContent = '\u26A0';
            setTimeout(function () { btn.textContent = '\u25B6'; }, 1200);
            wnAudio = null;
          }
        });
        audio.addEventListener('ended', function () {
          btn.textContent = '\u25B6';
          btn.classList.remove('playing');
          wnAudio = null;
          wnBtn = null;
        });
        audio.play().catch(function () {});
      }
      // Clicking a card jumps to where the item lives in the database (the tab
      // that shows it), scrolls to it, and marks it with four pointing arrows
      // that disappear after a few seconds.
      list.addEventListener('click', function (e) {
        var playBtn = e.target.closest('.wn-play');
        if (playBtn) {
          e.preventDefault();
          var url = playBtn.getAttribute('data-url');
          if (url) wnPlay(url, playBtn);
          return;
        }
        var link = e.target.closest('.wn-link');
        if (link) {
          e.preventDefault();
          locateAndMark(link.getAttribute('data-tab'), link.getAttribute('data-kind') || '', link.getAttribute('data-url'), link.getAttribute('data-name'));
        }
      });
    }
    var vrcUrl = GIST_VRC_QUEUE_URL;
    var filesUrl = GIST_PENDING_FILES_URL;
    var avatarsEcoUrl = GIST_AVATARS_ECO_URL;
    var groupsEcoUrl = GIST_GROUPS_ECO_URL;
    Promise.all([
      fetch(vrcUrl).then(function (r) { return r.json(); }).catch(function () { return []; }),
      fetch(filesUrl).then(function (r) { return r.json(); }).catch(function () { return { submissions: [] }; }),
      fetch(avatarsEcoUrl).then(function (r) { return r.json(); }).catch(function () { return {}; }),
      fetch(groupsEcoUrl).then(function (r) { return r.json(); }).catch(function () { return {}; }),
    ]).then(function (results) {
      var vrc = Array.isArray(results[0]) ? results[0] : ((results[0] && results[0].entries) || []);
      var files = (results[1] && results[1].submissions) || [];
      // The ecosystem gists know the REAL creators/owners and names — the
      // review gist only knows who submitted the link, which is not authorship.
      var authorByUrl = {};
      var nameByUrl = {};
      var imgByUrl = {};
      Object.keys(results[2] || {}).forEach(function (key) {
        (results[2][key] || []).forEach(function (item) {
          var u = item.avatar_link || item.world_link;
          var img = item.avatar_image_url || item.world_image_url;
          if (u && img) imgByUrl[u] = img;
          if (u && item.author) authorByUrl[u] = item.author;
          if (u && (item.avatar_name || item.world_name)) nameByUrl[u] = item.avatar_name || item.world_name;
        });
      });
      (results[3].community_groups || []).forEach(function (g) {
        if (g.group_link && g.icon_url) imgByUrl[g.group_link] = g.icon_url;
        if (g.group_link && g.owner) authorByUrl[g.group_link] = g.owner;
        if (g.group_link && g.group_name) nameByUrl[g.group_link] = g.group_name;
      });
      var items = [];
      vrc.forEach(function (e) {
        if (e.status !== 'approved') return;
        var u = e.url || e.avatar_link || e.world_link;
        var date = e.approvedAt || e.createdAt;
        if (!u || !date) return;
        var meta = TYPE_META[e.type] || TYPE_META.world;
        var realAuthor = u ? authorByUrl[u] : null;
        // Review-gist entries carry no name — prefer the ecosystem gist's real
        // name, then a short ID for groups so the card never shows the raw URL.
        var shortName = nameByUrl[u] || e.name || e.avatar_name || e.world_name;
        if (!shortName && e.type === 'group') {
          var gid = String(u).match(/grp_[a-f0-9]+/i);
          shortName = gid ? gid[0] : u;
        }
        if (!shortName) shortName = u;
        items.push({
          type: e.type,
          name: shortName,
          url: u,
          date: date,
          img: u ? (imgByUrl[u] || (e.type === 'group' ? defaultGroupIcon : '')) : '',
          emoji: meta.emoji,
          author: realAuthor || (e.type === 'group' ? '' : e.submittedBy || ''),
          authorNote: realAuthor ? 'creator' : (e.type === 'group' ? 'none' : 'submitted'),
          tab: e.type === 'group' ? 'vrchat-groups' : (e.type === 'avatar' ? 'public-avatars' : 'worlds'),
          kind: 'vrc',
          label: TAB_LABELS[e.type === 'group' ? 'vrchat-groups' : (e.type === 'avatar' ? 'public-avatars' : 'worlds')] || meta.label,
          color: meta.color,
        });
      });
      files.forEach(function (s) {
        if (s.status !== 'approved' || !s.approvedAt || !s.row || !s.row[0]) return;
        var isMedia = s.file === 'sounds.json' || s.file === 'gallery.json';
        var isSound = s.file === 'sounds.json';
        var link = isMedia ? s.row[0] : (s.row[2] || '');
        var mediaName = String(s.row[0]).split('/').pop().replace(/\.[a-z0-9]+$/i, '') || String(s.row[0]);
        // Files carry the real author in their row's Author column — the
        // submitter is only who uploaded it. Gallery/sounds show no author at all.
        var AUTHOR_FILES = ['models-3d.json', 'avatar-prefabs.json', 'world-prefabs.json', 'shaders.json', 'games.json', 'tools.json', 'useful-things.json', 'websites.json'];
        var rowAuthor = AUTHOR_FILES.indexOf(s.file) >= 0 && s.row[4] ? String(s.row[4]) : '';
        var fileAuthor = rowAuthor || s.submittedBy || '';
        var fileNote = rowAuthor ? 'creator' : 'submitted';
        items.push({
          type: 'file',
          name: isMedia ? mediaName : String(s.row[0]),
          url: link || '',
          date: s.approvedAt,
          img: isSound ? '' : resolveImg(isMedia ? s.row[0] : (s.row[1] || '')),
          audioUrl: isSound ? s.row[0] : '',
          kind: isSound ? 'sound' : 'file',
          emoji: FILE_EMOJIS[s.file] || '\ud83d\udcc1',
          tab: s.file ? s.file.replace('.json', '') : '',
          label: TAB_LABELS[s.file ? s.file.replace('.json', '') : ''] || fileLabel(s.file) || 'FILE',
          color: FILE_COLORS[s.file] || '#885555',
          author: fileAuthor,
          authorNote: fileNote,
        });
      });
      items.sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
      show(items.slice(0, 20));
    }).catch(function () {
      list.innerHTML = '<div class="wn-empty">Couldn\u2019t load recent additions right now.</div>';
    });
  }

  // GLOBAL SEARCH: indexes every data file + the VRC/group sources once, then
  // filters across all tabs. Clicking a result jumps to that tab.
  var gsIndex = null;
  var gsIndexing = null;
  // Shared image resolver for data-file previews, WHAT IS NEW cards and
  // search results: absolute URLs pass through; repo-relative paths map to
  // raw.githubusercontent; /r2/ maps to the worker's public uploads.
  function resolveImg(val) {
    if (!val) return '';
    if (val.indexOf('http') === 0) return val;
    if (val.indexOf('/images/') === 0 || val.indexOf('images/') === 0 || val.indexOf('/previews/') === 0 || val.indexOf('previews/') === 0) {
      return REPO_BASE + val.replace(/^\//, '');
    }
    if (val.indexOf('/r2/') === 0) return WORKER_BASE + val;
    return '';
  }
  function buildGsIndex() {
    if (gsIndex) return Promise.resolve(gsIndex);
    if (gsIndexing) return gsIndexing;
    gsIndexing = (async function () {
      var index = [];
      var grids = document.querySelectorAll('.data-card-grid[data-file]');
      await Promise.all(Array.prototype.map.call(grids, function (grid) {
        return fetch(REPO_BASE + 'data/' + grid.dataset.file + '.json')
          .then(function (r) { return r.json(); })
          .then(function (d) {
            var headers = d.headers || [];
            var nameIdx = 0;
            var infoIdx = headers.findIndex(function (h) { return /info/i.test(h); });
            var picIdx = headers.findIndex(function (h) { return /picture|preview|image/i.test(h); });
            (d.rows || []).forEach(function (row) {
              if (!row || !row[nameIdx]) return;
              var isMedia = grid.dataset.file === 'sounds.json' || grid.dataset.file === 'gallery.json';
              var name = isMedia
                ? String(row[nameIdx]).split('/').pop().replace(/\.[a-z0-9]+$/i, '') || String(row[nameIdx])
                : String(row[nameIdx]);
              index.push({
                tabId: grid.dataset.file,
                label: getTabLabel(grid.dataset.file),
                name: name,
                info: infoIdx >= 0 ? String(row[infoIdx] || '') : '',
                link: '',
                img: resolveImg(picIdx >= 0 ? row[picIdx] : ''),
              });
            });
          })
          .catch(function () {});
      }));
      await fetch(GIST_AVATARS_ECO_URL)
        .then(function (r) { return r.json(); })
        .then(function (json) {
          Object.keys(json).forEach(function (key) {
            var tabId = key === 'community_avatars' ? 'public-avatars' : 'worlds';
            (json[key] || []).forEach(function (item) {
              if (!item) return;
              var name = item.avatar_name || item.world_name;
              if (!name) return;
              index.push({
                tabId: tabId,
                label: getTabLabel(tabId),
                name: String(name),
                info: '',
                link: item.avatar_link || item.world_link || '',
                img: item.avatar_image_url || item.world_image_url || '',
              });
            });
          });
        })
        .catch(function () {});
      await fetch(GIST_GROUPS_ECO_URL)
        .then(function (r) { return r.json(); })
        .then(function (json) {
          (json.community_groups || []).forEach(function (g) {
            if (!g.group_name) return;
            index.push({
              tabId: 'vrchat-groups',
              label: getTabLabel('vrchat-groups'),
              name: String(g.group_name),
              info: '',
              link: g.group_link || '',
              img: g.icon_url || '',
            });
          });
        })
        .catch(function () {});
      gsIndex = index;
      return index;
    })();
    return gsIndexing;
  }
  function getTabLabel(tabId) {
    var btn = document.querySelector('.tab-btn[data-tab="' + tabId + '"]');
    return btn ? btn.textContent.trim() : tabId;
  }
  function highlight(text, q) {
    var escText = esc(text);
    if (!q) return escText;
    var safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return escText.replace(new RegExp('(' + safe + ')', 'ig'), '<mark>$1</mark>');
  }
  function initGlobalSearch() {
    var input = document.getElementById('gsearch');
    if (!input) return;
    var results = document.getElementById('gsearch-results');
    var whatsNewEl = document.getElementById('whatsNew');
    var timer = null;
    var activeIdx = -1;
    function setActive(idx) {
      var items = results.querySelectorAll('.gs-item');
      activeIdx = idx;
      for (var i = 0; i < items.length; i++) {
        items[i].classList.toggle('active', i === idx);
        if (i === idx) items[i].scrollIntoView({ block: 'nearest' });
      }
    }
    input.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(doSearch, 150);
    });
    input.addEventListener('focus', doSearch);
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.gsearch-wrap')) results.style.display = 'none';
    });
    input.addEventListener('keydown', function (e) {
      var items = results.querySelectorAll('.gs-item');
      if (!items.length) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive(Math.min(activeIdx + 1, items.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(Math.max(activeIdx - 1, 0)); }
      else if (e.key === 'Enter' && activeIdx >= 0) { e.preventDefault(); items[activeIdx].click(); }
      else if (e.key === 'Escape') { results.style.display = 'none'; activeIdx = -1; }
    });
    function doSearch() {
      var q = input.value.trim().toLowerCase();
      // Hide the WHAT IS NEW strip while actively searching; restore when empty.
      if (whatsNewEl) whatsNewEl.style.display = q.length >= 2 ? 'none' : '';
      if (q.length < 2) { results.style.display = 'none'; activeIdx = -1; return; }
      buildGsIndex().then(function (index) {
        var hits = [];
        for (var i = 0; i < index.length && hits.length < 12; i++) {
          var it = index[i];
          var hay = (it.name + ' ' + it.info + ' ' + it.label).toLowerCase();
          if (hay.indexOf(q) >= 0) hits.push(it);
        }
        if (!hits.length) {
          results.innerHTML = '<div class="gs-empty">No matches in the whole database.</div>';
        } else {
          results.innerHTML = hits.map(function (h) {
            var img = h.img ? '<img class="gs-img" src="' + esc(h.img) + '" loading="lazy" decoding="async" onerror="this.style.display=\'none\'">' : '<span class="gs-img gs-img-none"></span>';
            return '<button type="button" class="gs-item" data-tab="' + h.tabId + '" data-kind="' + (h.link ? 'vrc' : 'file') + '" data-url="' + esc(h.link || '') + '" data-name="' + esc(h.name) + '">'
              + img
              + '<span class="gs-body"><span class="gs-name">' + highlight(h.name, q) + '</span>'
              + (h.info ? '<span class="gs-info">' + esc(h.info.slice(0, 70)) + '</span>' : '')
              + '</span>'
              + '<span class="gs-tab">' + esc(h.label) + '</span>'
              + '</button>';
          }).join('');
        }
        results.style.display = 'block';
        setActive(-1);
      });
    }
    function openResult(btn) {
      var id = btn.getAttribute('data-tab');
      var kind = btn.getAttribute('data-kind') || '';
      var url = btn.getAttribute('data-url');
      var name = btn.getAttribute('data-name');
      results.style.display = 'none';
      input.value = '';
      activeIdx = -1;
      if (whatsNewEl) whatsNewEl.style.display = '';
      if (!id) return;
      // Same behavior as the WHAT IS NEW cards: jump to the tab, scroll to the
      // cell, and mark it with the four pointing arrows.
      locateAndMark(id, kind, url, name);
    }
    results.addEventListener('click', function (e) {
      var btn = e.target && e.target.closest ? e.target.closest('.gs-item') : null;
      if (!btn) return;
      openResult(btn);
    });
  }

  function loadGroups() {
    var grid = document.getElementById('card-grid-vrchat-groups');
    if (!grid) return;
    var countEl = document.getElementById('count-vrchat-groups');
    function render(groups) {
      if (groups.length === 0) {
        grid.innerHTML = '<div class="empty-state">' + MSG_EMPTY + '</div>';
        return;
      }
      if (countEl) countEl.textContent = groups.length + ' groups';
      grid.innerHTML = groups.map(function (g) {
        return '<div class="group-card">' +
          '<a href="' + esc(g.group_link) + '" target="_blank" class="gc-link-wrap">' +
            '<div class="gc-icon-wrap">' +
              '<img class="gc-icon" src="' + esc(g.icon_url) + '" alt="' + esc(g.group_name) + '" loading="lazy" decoding="async" onerror="this.parentElement.innerHTML=\'<div class=\\\'gc-icon-fallback\\\'>' + esc(g.group_name) + '</div>\'">' +
            '</div>' +
            '<div class="gc-name">' + esc(g.group_name) + '</div>' +
          '</a>' +
        '</div>';
      }).join('');
    }
    fetch(GIST_GROUPS_ECO_URL)
      .then(function (r) { return r.json(); })
      .then(function (json) {
        var groups = json.community_groups || [];
        // Approved groups from the review gist that aren't in the ecosystem
        // list yet still get displayed (default icon, id as name), so they are
        // findable on the site.
        fetch(GIST_VRC_QUEUE_URL)
          .then(function (r) { return r.json(); })
          .then(function (json2) {
            var all = Array.isArray(json2) ? json2 : ((json2 && json2.entries) || []);
            var existing = {};
            groups.forEach(function (g) { existing[g.group_link] = true; });
            all.forEach(function (e) {
              if (!e || e.type !== 'group' || e.status !== 'approved' || !e.url || existing[e.url]) return;
              var idm = String(e.url).match(/grp_[a-f0-9]+/i);
              groups.push({ group_name: idm ? idm[0] : 'NEW GROUP', group_link: e.url, icon_url: DEFAULT_GROUP_ICON });
            });
            render(groups);
          })
          .catch(function () { render(groups); });
      })
      .catch(function () {
        grid.innerHTML = '<div class="empty-state">' + MSG_ERROR + '</div>';
      });
  }

  function loadMembers() {
    var grid = document.getElementById('card-grid-fish-members');
    if (!grid) return;
    var countEl = document.getElementById('count-fish-members');

    fetch(GIST_MEMBERS_URL)
      .then(function (r) { return r.text(); })
      .then(function (raw) {
        var names = raw.split(',').map(function (n) { return n.trim(); }).filter(function (n) { return n.length > 0; });
        if (names.length === 0) {
          grid.innerHTML = '<div class="empty-state">' + MSG_EMPTY + '</div>';
          return;
        }
        if (countEl) countEl.textContent = names.length + ' members';
        grid.innerHTML = '<div class="member-grid-inner">' + names.map(function (n) {
          var d = document.createElement('div');
          d.textContent = n;
          return '<span class="member-pill">' + d.innerHTML + '</span>';
        }).join('') + '</div>';
      })
      .catch(function () {
        grid.innerHTML = '<div class="empty-state">' + MSG_ERROR + '</div>';
      });
  }
})();

