/* ============================================================
   后台管理逻辑
   ============================================================ */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var TOKEN_KEY = 'portfolio_admin_token';
  var data = null; // 完整内容数据（不含密码）

  function token() { return localStorage.getItem(TOKEN_KEY) || ''; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ---------- 常用软件品牌 Logo（与前台 main.js 保持一致） ---------- */
  var SOFT_ICONS = {
    'pr': '<svg viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" rx="4.5" fill="#EA77FF"/><path fill="#00005B" d="M10.15 8.42a2.93 2.93 0 0 0-1.18-.2 13.9 13.9 0 0 0-1.09.02v3.36l.39.02h.53c.39 0 .78-.06 1.15-.18.32-.09.6-.28.82-.53.21-.25.31-.59.31-1.03a1.45 1.45 0 0 0-.93-1.46zM19.75.3H4.25A4.25 4.25 0 0 0 0 4.55v14.9c0 2.35 1.9 4.25 4.25 4.25h15.5c2.35 0 4.25-1.9 4.25-4.25V4.55C24 2.2 22.1.3 19.75.3zm-7.09 11.65c-.4.56-.96.98-1.61 1.22-.68.25-1.43.34-2.25.34l-.5-.01-.43-.01v3.21a.12.12 0 0 1-.11.14H5.82c-.08 0-.12-.04-.12-.13V6.42c0-.07.03-.11.1-.11l.56-.01.76-.02.87-.02.91-.01c.82 0 1.5.1 2.06.31.5.17.96.45 1.34.82.32.32.57.71.73 1.14.15.42.23.85.23 1.3 0 .86-.2 1.57-.6 2.13zm6.82-3.15v1.95c0 .08-.05.11-.16.11a4.35 4.35 0 0 0-1.92.37c-.19.09-.37.21-.51.37v5.1c0 .1-.04.14-.13.14h-1.97a.14.14 0 0 1-.16-.12v-5.58l-.01-.75-.02-.78c0-.23-.02-.45-.04-.68a.1.1 0 0 1 .07-.11h1.78c.1 0 .18.07.2.16a3.03 3.03 0 0 1 .13.92c.3-.35.67-.64 1.08-.86a3.1 3.1 0 0 1 1.52-.39c.07-.01.13.04.14.11v.04z"/></svg>',
    'ae': '<svg viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" rx="4.5" fill="#9999FF"/><path fill="#00005B" d="M8.54 10.73c-.1-.31-.19-.61-.29-.92s-.19-.6-.27-.89c-.08-.28-.15-.54-.22-.78h-.02c-.09.43-.2.86-.34 1.29-.15.48-.3.98-.46 1.48-.13.51-.29.98-.44 1.4h2.54c-.06-.21-.14-.46-.23-.72-.09-.27-.18-.56-.27-.86zm8.58-.29c-.55-.03-1.07.26-1.33.76-.12.23-.19.47-.22.72h2.109c.26 0 .45 0 .57-.01.08-.01.16-.03.23-.08v-.1c0-.13-.021-.25-.061-.37-.178-.56-.708-.94-1.298-.92zM19.75.3H4.25C1.9.3 0 2.2 0 4.55v14.9c0 2.35 1.9 4.25 4.25 4.25h15.5c2.35 0 4.25-1.9 4.25-4.25V4.55C24 2.2 22.1.3 19.75.3zm-7.04 16.511h-2.09c-.07.01-.14-.041-.16-.11l-.82-2.4H5.92l-.76 2.36c-.02.09-.1.15-.19.14H3.09c-.11 0-.14-.06-.11-.18L6.2 7.39c.03-.1.06-.19.1-.31.04-.21.06-.43.06-.65-.01-.05.03-.1.08-.11h2.59c.07 0 .12.03.13.08l3.65 10.25c.03.11.001.161-.1.161zm7.851-3.991c-.021.189-.031.33-.041.42-.01.07-.069.13-.14.13-.06 0-.17.01-.33.021-.159.02-.35.029-.579.029-.23 0-.471-.04-.73-.04h-3.17c.039.31.14.62.31.89.181.271.431.48.729.601.4.17.841.26 1.281.25.35-.011.699-.04 1.039-.11.311-.039.61-.119.891-.23.05-.039.08-.02.08.08v1.531c0 .039-.01.08-.021.119-.021.03-.04.051-.069.07-.32.14-.65.24-1 .3-.471.09-.94.13-1.42.12-.761 0-1.4-.12-1.92-.35-.49-.211-.921-.541-1.261-.95-.319-.39-.55-.83-.69-1.31-.14-.471-.209-.961-.209-1.461 0-.539.08-1.07.25-1.59.16-.5.41-.96.75-1.37.33-.4.739-.72 1.209-.95.471-.23 1.03-.31 1.67-.31.531-.01 1.06.09 1.55.31.41.18.77.45 1.05.8.26.34.47.72.601 1.14.129.4.189.81.189 1.22 0 .24-.01.45-.019.64z"/></svg>',
    'ps': '<svg viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" rx="4.5" fill="#31A8FF"/><path fill="#001E36" d="M9.85 8.42c-.37-.15-.77-.21-1.18-.2-.26 0-.49 0-.68.01-.2-.01-.34 0-.41.01v3.36c.14.01.27.02.39.02h.53c.39 0 .78-.06 1.15-.18.32-.09.6-.28.82-.53.21-.25.31-.59.31-1.03.01-.31-.07-.62-.23-.89-.17-.26-.41-.46-.7-.57zM19.75.3H4.25C1.9.3 0 2.2 0 4.55v14.899c0 2.35 1.9 4.25 4.25 4.25h15.5c2.35 0 4.25-1.9 4.25-4.25V4.55C24 2.2 22.1.3 19.75.3zm-7.391 11.65c-.399.56-.959.98-1.609 1.22-.68.25-1.43.34-2.25.34-.24 0-.4 0-.5-.01s-.24-.01-.43-.01v3.209c.01.07-.04.131-.11.141H5.52c-.08 0-.12-.041-.12-.131V6.42c0-.07.03-.11.1-.11.17 0 .33 0 .56-.01.24-.01.49-.01.76-.02s.56-.01.87-.02c.31-.01.61-.01.91-.01.82 0 1.5.1 2.06.31.5.17.96.45 1.34.82.32.32.57.71.73 1.14.149.42.229.85.229 1.3.001.86-.199 1.57-.6 2.13zm7.091 3.89c-.28.4-.671.709-1.12.891-.49.209-1.09.318-1.811.318-.459 0-.91-.039-1.359-.129-.35-.061-.7-.17-1.02-.32-.07-.039-.121-.109-.111-.189v-1.74c0-.029.011-.07.041-.09.029-.02.06-.01.09.01.39.23.8.391 1.24.49.379.1.779.15 1.18.15.38 0 .65-.051.83-.141.16-.07.27-.24.27-.42 0-.141-.08-.27-.24-.4-.16-.129-.489-.279-.979-.471-.51-.18-.979-.42-1.42-.719-.31-.221-.569-.51-.761-.85-.159-.32-.239-.67-.229-1.021 0-.43.12-.84.341-1.21.25-.4.619-.72 1.049-.92.469-.239 1.059-.349 1.769-.349.41 0 .83.03 1.24.09.3.04.59.12.86.23.039.01.08.05.1.09.01.04.02.08.02.12v1.63c0 .04-.02.08-.05.1-.09.02-.14.02-.18 0-.3-.16-.62-.27-.96-.34-.37-.08-.74-.13-1.12-.13-.2-.01-.41.02-.601.07-.129.03-.24.1-.31.2-.05.08-.08.18-.08.27s.04.18.101.26c.09.11.209.2.34.27.229.12.47.23.709.33.541.18 1.061.43 1.541.73.33.209.6.49.789.83.16.318.24.67.23 1.029.011.471-.129.94-.389 1.331z"/></svg>',
    'au': '<svg viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" rx="4.5" fill="#00E4BB"/><path fill="#00005B" d="M19.75.3H4.25C1.9.3 0 2.2 0 4.55v14.9c0 2.35 1.9 4.25 4.25 4.25h15.5c2.35 0 4.25-1.9 4.25-4.25V4.55C24 2.2 22.1.3 19.75.3zM12.5 16.8h-2.09c-.07.011-.14-.04-.16-.11l-.82-2.39H5.71l-.76 2.36c-.02.09-.1.15-.19.14H2.88c-.11 0-.14-.06-.11-.18l3.22-9.24c.03-.1.06-.21.1-.33.05-.21.08-.42.08-.64-.01-.05.03-.1.08-.11h2.59c.07 0 .12.03.13.08l3.63 10.261c.03.109 0 .159-.1.159zm7.75.011h-1.721c-.079.01-.159-.041-.189-.11-.02-.08-.04-.171-.061-.25-.02-.07-.02-.14-.02-.21-.32.289-.71.5-1.13.619-.36.101-.739.15-1.11.15-.369 0-.74-.05-1.09-.17-.32-.109-.619-.3-.85-.55-.26-.28-.45-.61-.561-.97-.14-.461-.209-.94-.199-1.42V8.94c-.01-.06.029-.12.1-.13h1.939c.061-.01.121.03.131.1v4.731c0 .439.1.789.289 1.039.191.25.58.381 1.031.381.229 0 .459-.041.68-.121.23-.08.439-.189.63-.33V8.92c0-.07.05-.11.14-.11h1.91c.051-.01.109.03.109.08v6.16c0 .271 0 .511.011.72.01.211.021.391.03.551.02.16.029.25.039.359.012.09-.028.131-.108.131zM8.33 10.73c-.1-.31-.19-.61-.29-.92s-.19-.6-.27-.89c-.08-.28-.15-.54-.22-.78h-.02c-.09.43-.2.86-.34 1.29-.15.48-.3.98-.46 1.48-.13.51-.29.98-.44 1.4h2.54c-.06-.21-.14-.46-.23-.72-.09-.27-.18-.56-.27-.86z"/></svg>',
    'dv': '<svg viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" rx="4.5" fill="#000"/><path fill="#FFF" d="M17.621 0 5.977.004c-1.37 0-2.756.345-3.762 1.11a4.925 4.925 0 0 0-1.61 2.003C.233 3.93 0 5.02 0 5.951l.012 12.2c.002 1.604.479 3.057 1.461 4.112.984 1.056 2.462 1.683 4.331 1.691L16.856 24c1.26.005 3.095-.036 4.303-.714 1.075-.605 2.025-1.556 2.497-2.984.278-.84.345-2.084.344-3.147l-.021-11.13c-.002-.888-.15-2.023-.547-2.934-.425-.976-1.181-1.815-2.322-2.425C20.353.26 19.123 0 17.622 0zm0 .93c1.378 0 2.538.295 3.04.565.977.523 1.544 1.166 1.889 1.96.315.721.47 1.793.473 2.572l.018 11.13c.002 1.013-.097 2.257-.298 2.86-.396 1.202-1.146 1.946-2.063 2.462-.814.457-2.612.593-3.82.588l-11.05-.044c-1.657-.007-2.832-.534-3.626-1.386-.792-.851-1.212-2.06-1.212-3.485L.999 5.95c0-.829.196-1.827.474-2.437.345-.757.75-1.207 1.365-1.674C3.585 1.27 4.868.97 6.08.97zm-5.66 3.423c-1.976.089-3.204 1.658-3.214 3.29.019 1.443 1.635 3.481 2.884 4.53.12.099.154.109.33.18.062.025.198-.047.327-.135.36-.245.993-.947 1.648-1.738a7.67 7.67 0 0 0 1.031-1.683c.409-.89.261-1.599.235-1.888a3.983 3.983 0 0 0-.99-1.692 3.36 3.36 0 0 0-2.251-.864zm4.172 7.922a10.185 10.185 0 0 0-3.244.61c-.15.058-.26.1-.374.17-.057.036-.11.135-.105.292.017.433.29 1.278.624 2.27.384 1.135 1.066 2.27 1.844 2.74a3.23 3.23 0 0 0 2.53.342c.832-.243 1.595-.868 1.962-1.546.986-1.818.19-3.548-1.121-4.417-.447-.296-1.133-.445-1.89-.46-.074 0-.15-.002-.226-.001zm-8.432.038a6.201 6.201 0 0 0-.752.047c-.596.078-.932.273-1.29.51a3.177 3.177 0 0 0-1.365 1.979c-.075.552-.086 1.053.033 1.507.433 1.389 1.326 2.222 2.847 2.452.636.028 1.37-.063 1.99-.45 1.269-.782 2.08-3.17 2.412-4.742.053-.176.035-.357-.013-.42-.005-.067-.044-.113-.19-.183-.398-.192-1.32-.417-2.375-.6a7.68 7.68 0 0 0-1.297-.1z"/></svg>',
    '剪': '<svg viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" rx="4.5" fill="#000"/><path fill="#FFF" d="M6.2 5h3.1l4.4 7-4.4 7H6.2l4.4-7z"/><path fill="#FFF" d="M12.8 5h3.1l4.4 7-4.4 7h-3.1l4.4-7z"/></svg>',
    'jy': '<svg viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" rx="4.5" fill="#000"/><path fill="#FFF" d="M6.2 5h3.1l4.4 7-4.4 7H6.2l4.4-7z"/><path fill="#FFF" d="M12.8 5h3.1l4.4 7-4.4 7h-3.1l4.4-7z"/></svg>'
  };
  function softIcon(s) {
    var n = String((s || {}).name || '').trim().toLowerCase();
    var guess = { 'premiere': 'pr', 'after effects': 'ae', 'photoshop': 'ps', 'audition': 'au', 'davinci': 'dv', 'resolve': 'dv', '剪映': 'jy', 'capcut': 'jy' };
    for (var k in guess) if (n.indexOf(k) >= 0) return SOFT_ICONS[guess[k]];
    return '';
  }

  /* ---------- 登录 / 退出 ---------- */
  function showLogin() {
    $('loginWrap').style.display = 'flex';
    $('adminApp').classList.remove('on');
  }
  function showApp() {
    $('loginWrap').style.display = 'none';
    $('adminApp').classList.add('on');
  }

  $('loginBtn').addEventListener('click', doLogin);
  $('loginPwd').addEventListener('keydown', function (e) { if (e.key === 'Enter') doLogin(); });

  function doLogin() {
    var pwd = $('loginPwd').value;
    $('loginErr').textContent = '';
    fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pwd })
    }).then(function (r) {
      return r.json().then(function (j) { return { ok: r.ok, j: j }; });
    }).then(function (res) {
      if (res.ok && res.j.token) {
        localStorage.setItem(TOKEN_KEY, res.j.token);
        $('loginPwd').value = '';
        loadContent();
      } else {
        $('loginErr').textContent = res.j.error || '登录失败';
      }
    }).catch(function () { $('loginErr').textContent = '网络错误，请重试'; });
  }

  $('logoutBtn').addEventListener('click', function () {
    // 通知服务端作废 token，否则仅清本地存储，服务端会话仍然有效
    var tk = token();
    if (tk) {
      fetch('/api/logout', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + tk }
      }).catch(function () { /* 网络异常也要保证本地退出 */ });
    }
    localStorage.removeItem(TOKEN_KEY);
    showLogin();
  });

  /* ---------- 数据加载 ---------- */
  function loadContent() {
    fetch('/api/content').then(function (r) { return r.json(); }).then(function (j) {
      data = j;
      renderEditors();
      showApp();
    }).catch(function () { alert('内容加载失败，请刷新重试'); });
  }

  /* ---------- 选项卡 ---------- */
  var tabs = document.querySelectorAll('.admin-tab');
  tabs.forEach(function (t) {
    t.addEventListener('click', function () {
      tabs.forEach(function (x) { x.classList.remove('on'); });
      t.classList.add('on');
      document.querySelectorAll('.admin-panel').forEach(function (p) { p.classList.remove('on'); });
      document.querySelector('.admin-panel[data-panel="' + t.getAttribute('data-tab') + '"]').classList.add('on');
      if (t.getAttribute('data-tab') === 'access') fetchAccessLog();
    });
  });

  /* ---------- 访问记录（服务端） ---------- */
  function fmtTs(ts) {
    var d = new Date(ts);
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
      ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }
  function fetchAccessLog() {
    fetch('/api/accesslog', { headers: { 'Authorization': 'Bearer ' + token() } })
      .then(function (r) {
        if (r.status === 401) { localStorage.removeItem(TOKEN_KEY); showLogin(); return null; }
        return r.json();
      })
      .then(function (j) {
        if (!j || !j.ok) return;
        var list = j.list || [];
        var visits = list.filter(function (x) { return x.type === 'visit'; }).length;
        var actions = list.filter(function (x) { return x.type === 'action'; }).length;
        var last = list.length ? fmtTs(list[0].ts) : '—';
        $('accessSummary').innerHTML =
          '<div class="log-summary-cell"><span class="n">' + visits + '</span><span class="t">访问次数</span></div>' +
          '<div class="log-summary-cell"><span class="n">' + actions + '</span><span class="t">操作次数</span></div>' +
          '<div class="log-summary-cell"><span class="n">' + list.length + '</span><span class="t">记录总数（上限 500）</span></div>' +
          '<div class="log-summary-cell"><span class="n" style="font-size:14px;">' + esc(last) + '</span><span class="t">最近活动时间</span></div>';
        $('accessList').innerHTML = list.length ? list.map(function (r) {
          var badge = r.type === 'visit'
            ? '<span class="log-badge visit">访问</span>'
            : '<span class="log-badge action">操作</span>';
          return '<div class="log-row">' + badge +
            '<span class="log-time">' + fmtTs(r.ts) + '</span>' +
            '<span class="log-action">' + esc(r.action) + '</span>' +
            '<span class="log-detail">' + esc(r.detail) + '</span></div>';
        }).join('') : '<p class="admin-panel-desc">暂无记录。访客访问网站或后台操作后，记录将显示在这里。</p>';
      })
      .catch(function () { $('accessList').innerHTML = '<p class="admin-panel-desc">访问记录加载失败</p>'; });
  }
  $('accessClear').addEventListener('click', function () {
    if (!confirm('确定清空全部访问与操作记录？')) return;
    fetch('/api/accesslog', { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token() } })
      .then(function (r) { return r.json(); })
      .then(function (j) { if (j && j.ok) fetchAccessLog(); });
  });

  /* ---------- 通用字段绑定 ---------- */
  function getByPath(obj, path) {
    return path.split('.').reduce(function (o, k) { return (o || {})[k]; }, obj);
  }
  function setByPath(obj, path, val) {
    var keys = path.split('.');
    var o = obj;
    for (var i = 0; i < keys.length - 1; i++) { o = o[keys[i]] = o[keys[i]] || {}; }
    o[keys[keys.length - 1]] = val;
  }
  function fillBinds() {
    document.querySelectorAll('[data-bind]').forEach(function (el) {
      var path = el.getAttribute('data-bind');
      var type = el.getAttribute('data-type');
      var v = getByPath(data, path);
      if (type === 'array') el.value = Array.isArray(v) ? v.join('，') : (v || '');
      else if (type === 'lines') el.value = Array.isArray(v) ? v.join('\n') : (v || '');
      else el.value = v == null ? '' : String(v);
    });
  }
  function readBinds() {
    document.querySelectorAll('[data-bind]').forEach(function (el) {
      var path = el.getAttribute('data-bind');
      var type = el.getAttribute('data-type');
      var v = el.value;
      if (type === 'array') v = v.split(/[，,]/).map(function (s) { return s.trim(); }).filter(Boolean);
      else if (type === 'lines') v = v.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
      setByPath(data, path, v);
    });
  }

  /* ---------- 各编辑器渲染 ---------- */
  function rowField(label, value, attrs) {
    attrs = attrs || '';
    return '<div class="admin-field"><label class="admin-label">' + esc(label) + '</label>' +
      '<input class="admin-input" value="' + esc(value) + '" ' + attrs + ' /></div>';
  }

  /* ---------- 案例详情：可切换作品，不再硬编码 works[0] ---------- */
  var caseWorkId = null;   // 当前正在编辑案例详情的作品 id

  function caseWorkList() { return (data && data.works) || []; }
  function currentCaseWork() {
    var list = caseWorkList();
    var w = list.filter(function (x) { return x && x.id === caseWorkId; })[0];
    if (!w) {
      // 默认优先选中已有案例详情的作品，其次第一部
      w = list.filter(function (x) { return x && x.detail; })[0] || list[0];
      caseWorkId = w ? w.id : null;
    }
    return w || null;
  }
  function currentCaseDetail() {
    var w = currentCaseWork();
    return w ? w.detail : null;
  }
  // 保证 detail 及其中各数组存在，避免删除首部作品后访问 null 崩溃
  function ensureCaseDetail() {
    var w = currentCaseWork();
    if (!w) return null;
    if (!w.detail || typeof w.detail !== 'object') {
      w.detail = { meta: [], bgTitle: '项目背景', bgParas: [], info: [], techTitle: '剪辑手法', techniques: [], tools: [] };
    }
    ['meta', 'bgParas', 'info', 'techniques', 'tools'].forEach(function (k) {
      if (!Array.isArray(w.detail[k])) w.detail[k] = [];
    });
    return w.detail;
  }
  function renderCaseWorkPicker() {
    var box = $('caseWorkPicker');
    if (!box) return;
    var list = caseWorkList();
    if (!list.length) {
      box.innerHTML = '<p class="admin-panel-desc">暂无作品，请先到「作品管理」新增。</p>';
      return;
    }
    var cur = currentCaseWork();
    box.innerHTML = '<select class="admin-input" id="caseWorkSelect">' + list.map(function (w) {
      return '<option value="' + esc(w.id) + '"' + (cur && w.id === cur.id ? ' selected' : '') + '>' +
        esc(w.title || w.id) + (w.detail ? '' : '（暂无案例详情）') + '</option>';
    }).join('') + '</select>';
    $('caseWorkSelect').addEventListener('change', function () {
      caseWorkId = this.value;
      renderCasePanel();
    });
  }
  function renderCasePanel() {
    renderCaseWorkPicker();
    var d = currentCaseDetail();
    var bgEl = document.querySelector('[data-case-bg]');
    var tlEl = document.querySelector('[data-case-tools]');
    if (bgEl) bgEl.value = d ? (d.bgParas || []).join('\n') : '';
    if (tlEl) tlEl.value = d ? (d.tools || []).join('，') : '';
    if ($('caseInfoEditor')) {
      $('caseInfoEditor').innerHTML = d ? (d.info || []).map(function (r, i) {
        return '<div class="admin-grid-2">' + rowField('标签', r.label, 'data-ci-l="' + i + '"') + rowField('内容', r.value, 'data-ci-v="' + i + '"') + '</div>';
      }).join('') : '';
    }
    if ($('techEditor')) {
      $('techEditor').innerHTML = d && (d.techniques || []).length ? (d.techniques).map(function (t, i) {
        return '<div class="admin-card" style="gap:10px;">' +
          '<div class="admin-grid-2">' + rowField('序号', t.num, 'data-te-n="' + i + '"') + rowField('名称', t.name, 'data-te-t="' + i + '"') + '</div>' +
          '<div class="admin-field"><label class="admin-label">描述</label><textarea class="admin-input" data-te-d="' + i + '">' + esc(t.desc) + '</textarea></div>' +
          '<div style="text-align:right;"><button class="admin-mini-btn danger" data-tech-del="' + i + '">删除此条</button></div></div>';
      }).join('') : '<p class="admin-panel-desc">该作品暂无剪辑手法条目，保存后可在此新增。</p>';
    }
  }

  function renderEditors() {
    fillBinds();
    renderCasePanel();

    // 求职意向
    $('intentEditor').innerHTML = (data.profile.intent || []).map(function (r, i) {
      return '<div class="admin-grid-2">' +
        rowField('标签', r.label, 'data-intent-l="' + i + '"') +
        rowField('内容', r.value, 'data-intent-v="' + i + '"') + '</div>';
    }).join('');

    // 数据统计
    $('statsEditor').innerHTML = (data.profile.stats || []).map(function (s, i) {
      return '<div class="admin-card" style="gap:10px;">' +
        rowField('数值', s.num, 'data-stat-n="' + i + '"') +
        rowField('标签', s.label, 'data-stat-l="' + i + '"') + '</div>';
    }).join('');

    // 擅长方向
    $('specEditor').innerHTML = (data.specialties || []).map(function (s, i) {
      return '<div class="admin-card">' +
        '<div class="admin-grid-2">' +
        rowField('名称', s.name, 'data-spec-n="' + i + '"') +
        rowField('图标（mic/film/megaphone）', s.icon, 'data-spec-i="' + i + '"') + '</div>' +
        '<div class="admin-field"><label class="admin-label">描述</label><textarea class="admin-input" data-spec-d="' + i + '">' + esc(s.desc) + '</textarea></div>' +
        rowField('底部标签', s.tags, 'data-spec-t="' + i + '"') + '</div>';
    }).join('');

    // 作品管理
    renderWorks();

    // 技能
    $('skillEditor').innerHTML = (data.skills || []).map(function (s, i) {
      return '<div class="admin-card" style="gap:10px;">' +
        '<div class="admin-grid-2">' + rowField('序号', s.num, 'data-sk-n="' + i + '"') + rowField('名称', s.name, 'data-sk-t="' + i + '"') + '</div>' +
        rowField('描述', s.desc, 'data-sk-d="' + i + '"') +
        rowField('熟练度（0-100）', s.level, 'data-sk-l="' + i + '" type="number"') +
        '<div style="text-align:right;"><button class="admin-mini-btn danger" data-skill-del="' + i + '">删除此条</button></div></div>';
    }).join('');

    // 软件
    $('softEditor').innerHTML = (data.software || []).map(function (s, i) {
      var builtin = softIcon(s);
      var pv = s.icon ? '<img src="' + esc(s.icon) + '" alt="" onerror="this.style.opacity=0" />' : (builtin || esc(String(s.name || '?').charAt(0)));
      return '<div class="admin-card" style="gap:10px;">' +
        '<div class="soft-glyph-box' + (s.icon || builtin ? ' is-img' : '') + '" style="margin:0;">' + pv + '</div>' +
        rowField('Logo 图片地址（留空显示内置图标）', s.icon, 'data-so-i="' + i + '"') +
        '<div><button class="admin-mini-btn" type="button" data-so-up="' + i + '">上传 Logo 图片</button>' +
        '<input type="file" accept=".png,.jpg,.jpeg,.webp,image/*" data-so-f="' + i + '" style="display:none;" />' +
        '<span class="admin-panel-desc" data-so-tip="' + i + '">支持 png / jpg / webp（≤10MB），上传后自动填入上方地址</span></div>' +
        rowField('软件名', s.name, 'data-so-n="' + i + '"') +
        rowField('定位', s.level, 'data-so-l="' + i + '"') + '</div>';
    }).join('');
    bindSoftUploads();

    // 社交媒体
    $('socialEditor').innerHTML = (data.contact.socials || []).map(function (s, i) {
      return '<div class="admin-grid-2">' + rowField('名称', s.name, 'data-sl-n="' + i + '"') + rowField('链接', s.url, 'data-sl-u="' + i + '"') + '</div>';
    }).join('');
  }

  function bindSoftUploads() {
    var ed = $('softEditor');
    if (!ed) return;
    ed.querySelectorAll('[data-so-up]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var inp = ed.querySelector('[data-so-f="' + btn.getAttribute('data-so-up') + '"]');
        if (inp) inp.click();
      });
    });
    ed.querySelectorAll('[data-so-f]').forEach(function (inp) {
      inp.addEventListener('change', function () {
        var i = inp.getAttribute('data-so-f');
        var file = inp.files && inp.files[0];
        if (!file) return;
        uploadFile(file, ed.querySelector('[data-so-tip="' + i + '"]'), function (url) {
          var field = ed.querySelector('[data-so-i="' + i + '"]');
          if (field) field.value = url;
        }, 'image');
      });
    });
  }

  function renderWorks() {
    $('worksEditor').innerHTML = (data.works || []).map(function (w, i) {
      // 封面为空时不输出 src，否则会变成 src="/"，导致浏览器重复请求整页
      var thumb = w.cover
        ? '<img src="/' + esc(w.cover) + '" alt="" onerror="this.style.opacity=0" />'
        : '<span style="font-size:11px;color:#8A8A8A;">无封面</span>';
      return '<div class="admin-work-item">' +
        '<div class="thumb">' + thumb + '</div>' +
        '<div class="info"><div class="tt">' + esc(w.title) + '</div><div class="cc">' + esc(w.category) + ' · ' + esc(w.year) + ' · ' + esc(w.duration) + '</div></div>' +
        '<div class="ops"><button class="admin-mini-btn" data-work-edit="' + i + '">编辑</button>' +
        '<button class="admin-mini-btn danger" data-work-del="' + i + '">删除</button></div></div>';
    }).join('');
  }

  /* ---------- 媒体上传（视频 / 图片，带进度） ---------- */
  var UPLOAD_RULES = {
    video: { exts: ['.mp4', '.webm'], max: 200 * 1024 * 1024, errSize: '文件超过 200MB，请压缩后重试', errExt: '仅支持 mp4 / webm 格式' },
    image: { exts: ['.png', '.jpg', '.jpeg', '.webp'], max: 10 * 1024 * 1024, errSize: '图片超过 10MB，请压缩后重试', errExt: '仅支持 png / jpg / webp 格式' }
  };
  function uploadFile(file, tipEl, onOk, type) {
    var rule = UPLOAD_RULES[type || 'video'];
    var dot = file.name.lastIndexOf('.');
    var ext = dot === -1 ? '' : file.name.slice(dot).toLowerCase();
    if (rule.exts.indexOf(ext) === -1) { tipEl.textContent = rule.errExt; return; }
    if (file.size > rule.max) { tipEl.textContent = rule.errSize; return; }
    tipEl.textContent = '上传中 0%…';
    var xhr = new XMLHttpRequest();
    xhr.open('PUT', '/api/upload?type=' + (type || 'video') + '&name=' + encodeURIComponent(file.name));
    xhr.setRequestHeader('Authorization', 'Bearer ' + token());
    xhr.upload.onprogress = function (e) {
      if (e.lengthComputable) tipEl.textContent = '上传中 ' + Math.round((e.loaded / e.total) * 100) + '%…';
    };
    xhr.onload = function () {
      try {
        var j = JSON.parse(xhr.responseText);
        if (j.ok) { tipEl.textContent = '上传成功 ✓（' + Math.round(file.size / 1024 / 1024 * 10) / 10 + ' MB）'; if (onOk) onOk(j.url); }
        else tipEl.textContent = j.error || '上传失败';
      } catch (e) { tipEl.textContent = '上传失败：服务端响应异常'; }
    };
    xhr.onerror = function () { tipEl.textContent = '上传失败，请检查网络后重试'; };
    xhr.send(file);
  }

  /* ---------- 作品编辑弹层 ---------- */
  var editingIndex = -1;
  function openWorkEditor(i) {
    editingIndex = i;
    var w = data.works[i];
    var isNew = !w;
    if (isNew) {
      w = { id: 'work-' + Date.now(), title: '新作品', category: '', year: '2026', duration: '00:00', desc: '', cover: '', video: '', detail: null };
      data.works.push(w);
      editingIndex = data.works.length - 1;
    }
    var html = '<div style="position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:300;display:flex;align-items:center;justify-content:center;padding:24px;" id="workModal">' +
      '<div style="width:640px;max-width:100%;max-height:90vh;overflow:auto;background:#1A1A1A;border:1px solid #292929;padding:28px;display:flex;flex-direction:column;gap:14px;">' +
      '<div class="admin-card-title" style="font-size:16px;">' + (isNew ? '新增作品' : '编辑作品') + '</div>' +
      rowField('作品标题', w.title, 'id="wTitle"') +
      '<div class="admin-grid-2">' + rowField('分类', w.category, 'id="wCat"') + rowField('年份', w.year, 'id="wYear"') + '</div>' +
      '<div class="admin-grid-2">' + rowField('时长', w.duration, 'id="wDur"') + rowField('封面路径', w.cover, 'id="wCover"') + '</div>' +
      rowField('视频地址（mp4/webm，可留空）', w.video, 'id="wVideo"') +
      '<div class="admin-field"><label class="admin-label">或上传本地视频（mp4 / webm，不超过 200MB）</label>' +
      '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">' +
      '<button class="admin-mini-btn" id="wUploadBtn" type="button">选择文件上传</button>' +
      '<input type="file" id="wUploadFile" accept=".mp4,.webm,video/mp4,video/webm" style="display:none;" />' +
      '<span class="admin-panel-desc" id="wUploadTip">上传后自动填入上方视频地址</span></div></div>' +
      '<div class="admin-field"><label class="admin-label">或上传封面图（png / jpg / webp，不超过 10MB）</label>' +
      '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">' +
      '<button class="admin-mini-btn" id="wCoverBtn" type="button">选择图片上传</button>' +
      '<input type="file" id="wCoverFile" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" style="display:none;" />' +
      '<span class="admin-panel-desc" id="wCoverTip">上传后自动填入上方封面路径</span></div></div>' +
      '<div class="admin-field"><label class="admin-label">一句话描述</label><textarea class="admin-input" id="wDesc">' + esc(w.desc) + '</textarea></div>' +
      '<div style="display:flex;gap:10px;justify-content:flex-end;margin-top:6px;">' +
      '<button class="admin-mini-btn" id="wCancel">取消</button>' +
      '<button class="admin-mini-btn primary" id="wSave">保存作品</button></div></div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
    $('wCancel').addEventListener('click', function () {
      if (isNew) data.works.splice(editingIndex, 1);
      $('workModal').remove(); renderWorks(); renderCaseWorkPicker();
    });
    $('wSave').addEventListener('click', function () {
      var x = data.works[editingIndex];
      if (!x) { $('workModal').remove(); return; }
      x.title = $('wTitle').value; x.category = $('wCat').value; x.year = $('wYear').value;
      x.duration = $('wDur').value; x.cover = $('wCover').value; x.video = $('wVideo').value;
      x.desc = $('wDesc').value;
      $('workModal').remove(); renderWorks(); renderCaseWorkPicker();
    });
    // 本地视频上传
    $('wUploadBtn').addEventListener('click', function () { $('wUploadFile').click(); });
    $('wUploadFile').addEventListener('change', function () {
      var f = this.files && this.files[0];
      this.value = '';
      if (!f) return;
      uploadFile(f, $('wUploadTip'), function (url) { $('wVideo').value = url; }, 'video');
    });
    // 封面图上传
    $('wCoverBtn').addEventListener('click', function () { $('wCoverFile').click(); });
    $('wCoverFile').addEventListener('change', function () {
      var f = this.files && this.files[0];
      this.value = '';
      if (!f) return;
      uploadFile(f, $('wCoverTip'), function (url) { $('wCover').value = url; }, 'image');
    });
  }

  /* ---------- 事件委托：各编辑器读取 ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (t.hasAttribute && t.hasAttribute('data-work-edit')) openWorkEditor(+t.getAttribute('data-work-edit'));
    if (t.hasAttribute && t.hasAttribute('data-work-del')) {
      var wi = +t.getAttribute('data-work-del');
      var target = (data.works || [])[wi];
      if (!target) return;
      if (!confirm('确定删除作品「' + (target.title || target.id) + '」？')) return;
      data.works.splice(wi, 1);
      renderWorks();
      // 被删的正是案例面板选中的作品时，整块重渲染；否则只刷新下拉，避免冲掉其他面板未保存的输入
      if (caseWorkId === target.id) { caseWorkId = null; renderCasePanel(); } else { renderCaseWorkPicker(); }
      return;
    }
    if (t.hasAttribute && t.hasAttribute('data-tech-del')) {
      var cw = currentCaseWork();
      if (cw && cw.detail && Array.isArray(cw.detail.techniques)) {
        cw.detail.techniques.splice(+t.getAttribute('data-tech-del'), 1);
        renderCasePanel();
      }
      return;
    }
    if (t.hasAttribute && t.hasAttribute('data-skill-del')) {
      if (Array.isArray(data.skills)) {
        data.skills.splice(+t.getAttribute('data-skill-del'), 1);
        renderEditors();
      }
    }
  });
  $('addWorkBtn').addEventListener('click', function () { openWorkEditor(-1); });

  /* ---------- Showreel 本地视频上传 ---------- */
  $('srUploadBtn').addEventListener('click', function () { $('srUploadFile').click(); });
  $('srUploadFile').addEventListener('change', function () {
    var f = this.files && this.files[0];
    this.value = '';
    if (!f) return;
    uploadFile(f, $('srUploadTip'), function (url) {
      var el = document.querySelector('[data-bind="profile.showreel.video"]');
      if (el) el.value = url;
    }, 'video');
  });
  /* ---------- Showreel 封面 / 个人照片上传 ---------- */
  $('scUploadBtn').addEventListener('click', function () { $('scUploadFile').click(); });
  $('scUploadFile').addEventListener('change', function () {
    var f = this.files && this.files[0];
    this.value = '';
    if (!f) return;
    uploadFile(f, $('scUploadTip'), function (url) {
      var el = document.querySelector('[data-bind="profile.showreel.cover"]');
      if (el) el.value = url;
    }, 'image');
  });
  $('ptUploadBtn').addEventListener('click', function () { $('ptUploadFile').click(); });
  $('ptUploadFile').addEventListener('change', function () {
    var f = this.files && this.files[0];
    this.value = '';
    if (!f) return;
    uploadFile(f, $('ptUploadTip'), function (url) {
      var el = document.querySelector('[data-bind="profile.portrait"]');
      if (el) el.value = url;
    }, 'image');
  });

  /* ---------- 收集编辑器数据 ---------- */
  // 按下标回填，数组缺失或下标越界时静默跳过，避免保存中断
  function collectRows(selector, arr, key, transform) {
    if (!Array.isArray(arr)) return;
    document.querySelectorAll(selector).forEach(function (el) {
      var i = +el.getAttribute(selector.slice(1, -1));
      var row = arr[i];
      if (row) row[key] = transform ? transform(el.value) : el.value;
    });
  }
  function collectEditors() {
    data.profile = data.profile || {};
    // 求职意向
    collectRows('[data-intent-l]', data.profile.intent, 'label');
    collectRows('[data-intent-v]', data.profile.intent, 'value');
    // 统计
    collectRows('[data-stat-n]', data.profile.stats, 'num');
    collectRows('[data-stat-l]', data.profile.stats, 'label');
    // 擅长方向
    collectRows('[data-spec-n]', data.specialties, 'name');
    collectRows('[data-spec-i]', data.specialties, 'icon');
    collectRows('[data-spec-d]', data.specialties, 'desc');
    collectRows('[data-spec-t]', data.specialties, 'tags');
    // 案例（写入当前选中作品的 detail，逐项判空避免下标越界）
    var d = ensureCaseDetail();
    if (d) {
      var bg = document.querySelector('[data-case-bg]');
      if (bg) d.bgParas = bg.value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
      var tl = document.querySelector('[data-case-tools]');
      if (tl) d.tools = tl.value.split(/[，,]/).map(function (s) { return s.trim(); }).filter(Boolean);
      collectRows('[data-ci-l]', d.info, 'label');
      collectRows('[data-ci-v]', d.info, 'value');
      collectRows('[data-te-n]', d.techniques, 'num');
      collectRows('[data-te-t]', d.techniques, 'name');
      collectRows('[data-te-d]', d.techniques, 'desc');
    }
    // 技能
    collectRows('[data-sk-n]', data.skills, 'num');
    collectRows('[data-sk-t]', data.skills, 'name');
    collectRows('[data-sk-d]', data.skills, 'desc');
    collectRows('[data-sk-l]', data.skills, 'level', function (v) { return Math.max(0, Math.min(100, +v || 0)); });
    // 软件
    collectRows('[data-so-i]', data.software, 'icon');
    collectRows('[data-so-n]', data.software, 'name');
    collectRows('[data-so-l]', data.software, 'level');
    // 社交
    data.contact = data.contact || {};
    collectRows('[data-sl-n]', data.contact.socials, 'name');
    collectRows('[data-sl-u]', data.contact.socials, 'url');
  }

  /* ---------- 保存 ---------- */
  function saveToServer() {
    readBinds();
    collectEditors();
    return fetch('/api/content', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token() },
      body: JSON.stringify(data)
    }).then(function (r) {
      if (r.status === 401) {
        localStorage.removeItem(TOKEN_KEY);
        showLogin();
        throw new Error('登录已失效，请重新登录');
      }
      return r.json().then(function (j) { return { ok: r.ok, j: j }; });
    });
  }

  $('saveBtn').addEventListener('click', function () {
    saveToServer().then(function (res) {
      if (res.ok && res.j.ok) {
        var tip = $('saveTip');
        tip.classList.add('show');
        setTimeout(function () { tip.classList.remove('show'); }, 2000);
      } else {
        alert((res.j && res.j.error) || '保存失败');
      }
    }).catch(function (err) {
      if (err && err.message !== '登录已失效，请重新登录') alert('保存失败，请检查网络后重试');
    });
  });

  /* ---------- 发布上线（构建 + 推送 GitHub） ---------- */
  var publishBtn = $('publishBtn');
  if (publishBtn) {
    publishBtn.addEventListener('click', function () {
      if (!confirm('将先保存当前修改，然后构建静态站并推送到 GitHub main。\n\n推送后 GitHub Pages 约 1 分钟更新，确定继续？')) return;
      var statusEl = $('publishStatus');
      var logEl = $('publishLog');
      var started = Date.now();
      var timer = null;
      function setStatus(text, cls) {
        statusEl.textContent = text;
        statusEl.className = 'publish-status' + (cls ? ' ' + cls : '');
      }
      function appendLog(text) {
        logEl.textContent = text;
        logEl.scrollTop = logEl.scrollHeight;
      }
      publishBtn.disabled = true;
      setStatus('保存中…', 'working');
      appendLog('正在保存当前修改…\n');
      timer = setInterval(function () {
        setStatus('发布中… ' + Math.floor((Date.now() - started) / 1000) + 's', 'working');
      }, 1000);

      saveToServer().then(function (res) {
        if (!res.ok || !res.j.ok) throw new Error((res.j && res.j.error) || '保存失败');
        setStatus('构建中…', 'working');
        appendLog('已保存，正在构建静态站…\n');
        return fetch('/api/publish', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + token() }
        }).then(function (r) {
          if (r.status === 401) {
            localStorage.removeItem(TOKEN_KEY);
            showLogin();
            throw new Error('登录已失效，请重新登录');
          }
          return r.json().then(function (j) { return { ok: r.ok, j: j }; });
        });
      }).then(function (res) {
        clearInterval(timer);
        if (!res.ok || !res.j.ok) {
          var msg = (res.j && res.j.error) || '发布失败';
          if (res.j && res.j.detail) msg += '\n\n' + res.j.detail;
          throw new Error(msg);
        }
        var j = res.j;
        var out = '';
        if (j.build) out += (j.build.stdout || '') + (j.build.stderr || '');
        if (j.push) out += (j.push.stdout || '') + (j.push.stderr || '');
        out += '\n' + (j.commit ? '发布成功，commit: ' + j.commit : '没有检测到需要发布的变化。');
        out += '\n线上：https://zzjjr.github.io/zjrportfolio/';
        appendLog(out.trim());
        setStatus(j.commit ? '发布成功' : '已是最新', 'success');
      }).catch(function (err) {
        clearInterval(timer);
        setStatus('发布失败', 'error');
        appendLog('发布失败：' + (err && err.message ? err.message : '未知错误'));
      }).finally(function () {
        publishBtn.disabled = false;
      });
    });
  }

  /* ---------- 修改密码 ---------- */
  $('changePwdBtn').addEventListener('click', function () {
    var o = $('oldPwd').value, n1 = $('newPwd').value, n2 = $('newPwd2').value;
    $('pwdErr').textContent = '';
    if (n1 !== n2) { $('pwdErr').textContent = '两次输入的新密码不一致'; return; }
    fetch('/api/password', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token() },
      body: JSON.stringify({ oldPassword: o, newPassword: n1 })
    }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (res.ok && res.j.ok) {
          alert('密码修改成功，请使用新密码重新登录');
          localStorage.removeItem(TOKEN_KEY);
          showLogin();
        } else {
          $('pwdErr').textContent = res.j.error || '修改失败';
        }
      }).catch(function () { $('pwdErr').textContent = '网络错误，请重试'; });
  });

  /* ---------- 启动：已有 token 则直接进入 ---------- */
  if (token()) loadContent(); else showLogin();
})();
