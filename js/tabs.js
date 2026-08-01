(function () {
  const ALLOWED_TAGS = ['ROSE_FISH', 'FISH'];

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
  });

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

    fetch('https://gist.githubusercontent.com/TheZiver/9b85c8b8b6c1b4caa17dda8d37dc18ac/raw')
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
          listEl.innerHTML = '<p class="empty-note">No members data available.</p>';
        } else {
          listEl.innerHTML = members.map(function (m) {
            function esc(str) {
              if (str == null) return '';
              var d = document.createElement('div');
              d.textContent = str;
              return d.innerHTML;
            }
            return '<div class="member"><div class="member-name">' + esc(m.name) + '</div><div class="member-desc">' + esc(m.contribution) + '</div></div>';
          }).join('');
        }
      })
      .catch(function () {
        listEl.innerHTML = '<p class="empty-note">Failed to load contributions.</p>';
      });
  }

  function loadGistTabs() {
    var grids = document.querySelectorAll('.card-grid[data-gist-key]');
    if (grids.length === 0) return;
    if (grids.length === 0) return;

    fetch('https://gist.githubusercontent.com/TheZiver/bb99f9facb8d14fd607dbb79e9a99d83/raw')
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
            grid.innerHTML = '<div class="empty-state">No items found.</div>';
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
              card += '<img class="card-img" src="' + esc(image) + '" alt="' + esc(name) + '" loading="lazy">';
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
              this.parentElement.innerHTML = '<div class="card-img-placeholder">?</div>';
            });
          });
        });
      })
      .catch(function () {
        grids.forEach(function (grid) {
          grid.innerHTML = '<div class="empty-state">Failed to load data.</div>';
        });
      });
  }

  function loadDataTabs() {
    var grids = document.querySelectorAll('.data-card-grid[data-file]');
    if (grids.length === 0) return;

    var downloadTabs = new Set(['models-3d', 'avatar-prefabs', 'shaders']);
    var noButtonTabs = new Set(['asset-websites', 'useful-things', 'luxury-trash', 'tools', 'web-apps']);

    function findCol(headers, pattern) {
      var re = new RegExp(pattern, 'i');
      for (var i = 0; i < headers.length; i++) {
        if (re.test(headers[i])) return i;
      }
      return -1;
    }

    function imgUrl(val) {
      if (!val || val.indexOf('http') === 0) return val;
      if (val.indexOf('/images/') === 0 || val.indexOf('images/') === 0 || val.indexOf('/previews/') === 0 || val.indexOf('previews/') === 0) {
        var clean = val.replace(/^\//, '');
        return 'https://raw.githubusercontent.com/FishStructuredChaos/database/main/' + clean;
      }
      return val;
    }

    grids.forEach(function (grid) {
      var fileId = grid.dataset.file;
      var url = 'https://raw.githubusercontent.com/FishStructuredChaos/database/main/data/' + fileId + '.json';
      if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
        url = '/api/json-data?file=' + fileId + '.json';
      }

      fetch(url)
        .then(function (r) { return r.json(); })
        .then(function (d) {
          var rows = d.rows || [];
          var headers = d.headers || [];
          var countEl = document.getElementById('count-' + fileId);
          if (countEl) countEl.textContent = rows.length + ' items';

          if (rows.length === 0) {
            grid.innerHTML = '<div class="empty-state">No entries yet.</div>';
            return;
          }

          var picIdx = findCol(headers, 'picture|preview|image');
          var linkIdx = findCol(headers, 'link|website|download');
          var priceIdx = findCol(headers, 'price');
          var btnIdx = findCol(headers, 'button');
          var isNoBtn = noButtonTabs.has(fileId);
          var defaultLabel = downloadTabs.has(fileId) ? 'DOWNLOAD' : 'OPEN';
          var isModelsTab = fileId === 'models-3d';

          var html = '';
          for (var ri = 0; ri < rows.length; ri++) {
            var row = rows[ri];
            var name = row[0] || '';
            var img = picIdx >= 0 ? (row[picIdx] || '') : '';
            var link = linkIdx >= 0 ? (row[linkIdx] || '') : '';
            var rowLabel = (btnIdx >= 0 && row[btnIdx]) ? row[btnIdx] : defaultLabel;
            var isModel = isModelsTab && /\.(obj|fbx)(\?|#|$)/i.test(link);

            if (isNoBtn && link) {
              html += '<a href="' + esc(link.indexOf('/r2/') === 0 ? 'https://tokens.theziver.com' + link : link) + '" target="_blank" class="data-card-link">';
            }
            html += '<div class="data-card">';
            if (img) {
              html += '<div class="dc-img-wrap"><img class="table-img" src="' + esc(imgUrl(img)) + '" alt="' + esc(name) + '" loading="lazy"></div>';
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
              html += '<div class="dc-link-out"><a href="' + esc(link.indexOf('/r2/') === 0 ? 'https://tokens.theziver.com' + link : link) + '" target="_blank">' + esc(rowLabel) + '</a></div>';
            }
            if (isModel) {
              var modelUrl = link.indexOf('/r2/') === 0 ? 'https://tokens.theziver.com' + link : link;
              html += '<div class="dc-link-out"><button type="button" class="dc-btn3d" data-model-url="' + esc(encodeURIComponent(modelUrl)) + '" data-model-name="' + esc(encodeURIComponent(name)) + '">&#x1F3AF; 3D VIEW</button></div>';
            }
            html += '</div></div>';
            if (isNoBtn && link) {
              html += '</a>';
            }
          }
          grid.innerHTML = html;
        })
        .catch(function () {
          grid.innerHTML = '<div class="empty-state">Failed to load data.</div>';
        });
    });
  }

  function loadGroups() {
    var grid = document.getElementById('card-grid-vrchat-groups');
    if (!grid) return;
    var countEl = document.getElementById('count-vrchat-groups');

    fetch('https://gist.githubusercontent.com/TheZiver/9fdd3f8c495098ffa0beceece373d382/raw/c7b161cf283aded62242df37a1e66a5b5a428a21/structured_chaos_community_ecosystem_groups.json')
      .then(function (r) { return r.json(); })
      .then(function (json) {
        var groups = json.community_groups || [];
        if (groups.length === 0) {
          grid.innerHTML = '<div class="empty-state">No groups found.</div>';
          return;
        }
        if (countEl) countEl.textContent = groups.length + ' groups';

        grid.innerHTML = groups.map(function (g) {
          return '<div class="group-card">' +
            '<a href="' + esc(g.group_link) + '" target="_blank" class="gc-link-wrap">' +
              '<div class="gc-icon-wrap">' +
                '<img class="gc-icon" src="' + esc(g.icon_url) + '" alt="' + esc(g.group_name) + '" loading="lazy" onerror="this.parentElement.innerHTML=\'<div class=\\\'gc-icon-fallback\\\'>' + esc(g.group_name) + '</div>\'">' +
              '</div>' +
              '<div class="gc-name">' + esc(g.group_name) + '</div>' +
            '</a>' +
          '</div>';
        }).join('');
      })
      .catch(function () {
        grid.innerHTML = '<div class="empty-state">Failed to load groups.</div>';
      });
  }

  function loadMembers() {
    var grid = document.getElementById('card-grid-fish-members');
    if (!grid) return;
    var countEl = document.getElementById('count-fish-members');

    fetch('https://gist.githubusercontent.com/TheZiver/def41cbeb9b2e8eb071015f58bf8eb54/raw/48b6c7290489157d85e01f23d51915e4105c78dd/fish_community_members.txt')
      .then(function (r) { return r.text(); })
      .then(function (raw) {
        var names = raw.split(',').map(function (n) { return n.trim(); }).filter(function (n) { return n.length > 0; });
        if (names.length === 0) {
          grid.innerHTML = '<div class="empty-state">No members found.</div>';
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
        grid.innerHTML = '<div class="empty-state">Failed to load members.</div>';
      });
  }

  window.filterCards = function (input, gridId) {
    var q = input.value.toLowerCase();
    var container = document.getElementById(gridId);
    if (!container) return;
    var cards = container.querySelectorAll('.card, .data-card, .group-card, .member-pill');
    var count = 0;
    cards.forEach(function (card) {
      var match = card.textContent.toLowerCase().indexOf(q) >= 0;
      card.style.display = match ? '' : 'none';
      if (match) count++;
    });
    var info = input.parentElement.previousElementSibling;
    if (info && info.classList.contains('section-info')) {
      var countEl = info.querySelector('.count');
      if (countEl) {
        var label = countEl.dataset.label || '';
        countEl.textContent = count + ' ' + label;
      }
    }
  };

  // ============================================================
  // 3D MODEL VIEWER (OBJ / FBX) — rotates models in an overlay
  // ============================================================

  var MODEL_LIB = 'https://cdn.jsdelivr.net/npm/three@0.147.0/';
  // 0.8.2: 0.8.1's UMD referenced `exports` directly and crashed in browsers
  var FFLATE_LIB = 'https://cdn.jsdelivr.net/npm/fflate@0.8.2/umd/index.js';
  var modelLibsLoaded = false;
  var activeViewer = null;

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.dc-btn3d');
    if (!btn) return;
    var url = btn.dataset.modelUrl ? decodeURIComponent(btn.dataset.modelUrl) : '';
    var name = btn.dataset.modelName ? decodeURIComponent(btn.dataset.modelName) : '3D MODEL';
    if (url) openModelViewer(url, name);
  });

  window.openModelViewer = function (url, name) {
    loadModelLibs(function () {
      openViewer(url, name);
    });
  };

  function loadModelLibs(cb) {
    if (modelLibsLoaded) { cb(); return; }
    var scripts = [
      MODEL_LIB + 'build/three.min.js',
      MODEL_LIB + 'examples/js/controls/OrbitControls.js',
      MODEL_LIB + 'examples/js/loaders/OBJLoader.js',
      FFLATE_LIB,
      MODEL_LIB + 'examples/js/loaders/FBXLoader.js',
    ];
    var i = 0;
    function next() {
      if (i >= scripts.length) { modelLibsLoaded = true; cb(); return; }
      var s = document.createElement('script');
      s.src = scripts[i++];
      s.onload = next;
      s.onerror = function () {
        alert('Failed to load the 3D library. Check your connection.');
      };
      document.head.appendChild(s);
    }
    next();
  }

  function openViewer(url, name) {
    if (activeViewer) return;
    var overlay = document.createElement('div');
    overlay.className = 'viewer-overlay';
    overlay.innerHTML =
      '<div class="viewer-top"><div class="viewer-title">' + esc(name) + '</div>' +
      '<button type="button" class="viewer-close">&#x2715;</button></div>' +
      '<div class="viewer-canvas-wrap"></div>' +
      '<div class="viewer-status">LOADING MODEL...</div>';
    document.body.appendChild(overlay);
    activeViewer = overlay;

    var wrap = overlay.querySelector('.viewer-canvas-wrap');
    var statusEl = overlay.querySelector('.viewer-status');
    var closed = false;
    var renderer = null, controls = null, animId = null;

    function setStatus(msg, isErr) {
      statusEl.textContent = msg;
      statusEl.style.color = isErr ? '#cc8888' : '#ddcc88';
    }

    function close() {
      if (closed) return;
      closed = true;
      overlay.remove();
      window.removeEventListener('resize', onResize);
      if (animId) cancelAnimationFrame(animId);
      if (renderer) renderer.dispose();
      if (controls) controls.dispose();
      activeViewer = null;
    }
    overlay.querySelector('.viewer-close').addEventListener('click', close);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });

    var scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0000);
    var camera = new THREE.PerspectiveCamera(45, 1, 0.1, 5000);
    camera.position.set(3, 2, 5);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    wrap.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 3;

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    var dir = new THREE.DirectionalLight(0xffffff, 1.2);
    dir.position.set(5, 10, 7);
    scene.add(dir);
    scene.add(new THREE.HemisphereLight(0x886666, 0x220000, 0.6));

    function onResize() {
      var w = wrap.clientWidth, h = wrap.clientHeight;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    onResize();
    window.addEventListener('resize', onResize);

    var isFbx = /\.fbx(\?|#|$)/i.test(url);
    // Fetch manually instead of using the loader's internal XHR: this surfaces
    // the REAL error (HTTP status, CORS failures, parse errors) in the status
    // bar instead of a generic message.
    fetch(url)
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status + (r.status === 429 ? ' — too many downloads, wait a minute and retry' : ''));
        return isFbx ? r.arrayBuffer() : r.text();
      })
      .then(function (data) {
        if (closed) return;
        var obj = isFbx ? new THREE.FBXLoader().parse(data, '') : new THREE.OBJLoader().parse(data, '');
        setStatus('LOADED');
        var box = new THREE.Box3().setFromObject(obj);
        var size = box.getSize(new THREE.Vector3());
        var maxDim = Math.max(size.x, size.y, size.z) || 1;
        var scale = 2.5 / maxDim;
        obj.scale.setScalar(scale);
        obj.position.x = -(box.min.x + size.x / 2) * scale;
        obj.position.y = -box.min.y * scale;
        obj.position.z = -(box.min.z + size.z / 2) * scale;
        obj.traverse(function (child) {
          if (!child.isMesh || !child.material) return;
          var mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach(function (m) {
            if (!m.map) m.color = new THREE.Color(0xcc9999);
            m.side = THREE.DoubleSide;
            if (m.roughness === undefined) m.roughness = 0.7;
          });
        });
        scene.add(obj);
        statusEl.style.display = 'none';
        animate();
      })
      .catch(function (e) {
        if (closed) return;
        var msg = (e && e.message) ? e.message : 'unknown error';
        setStatus('FAILED TO LOAD MODEL — ' + msg, true);
      });

    function animate() {
      if (closed) return;
      animId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
  }
})();
