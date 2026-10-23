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
      return '<div class="admin-card" style="gap:10px;">' +
        rowField('角标文字', s.glyph, 'data-so-g="' + i + '"') +
        rowField('软件名', s.name, 'data-so-n="' + i + '"') +
        rowField('定位', s.level, 'data-so-l="' + i + '"') + '</div>';
    }).join('');

    // 社交媒体
    $('socialEditor').innerHTML = (data.contact.socials || []).map(function (s, i) {
      return '<div class="admin-grid-2">' + rowField('名称', s.name, 'data-sl-n="' + i + '"') + rowField('链接', s.url, 'data-sl-u="' + i + '"') + '</div>';
    }).join('');
  }

  function renderWorks() {
    $('worksEditor').innerHTML = (data.works || []).map(function (w, i) {
      // 封面为空时不输出 src，否则会变成 src="/"，导致浏览器重复请求整页
      var thumb = w.cover
        ? '<img src="/' + esc(w.cover) + '" alt="" onerror="this.style.opacity=0" />'
        : '<span style="font-size:11px;color:#737373;">无封面</span>';
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
    collectRows('[data-so-g]', data.software, 'glyph');
    collectRows('[data-so-n]', data.software, 'name');
    collectRows('[data-so-l]', data.software, 'level');
    // 社交
    data.contact = data.contact || {};
    collectRows('[data-sl-n]', data.contact.socials, 'name');
    collectRows('[data-sl-u]', data.contact.socials, 'url');
  }

  /* ---------- 保存 ---------- */
  $('saveBtn').addEventListener('click', function () {
    readBinds();
    collectEditors();
    fetch('/api/content', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token() },
      body: JSON.stringify(data)
    }).then(function (r) {
      if (r.status === 401) { localStorage.removeItem(TOKEN_KEY); showLogin(); return; }
      return r.json();
    }).then(function (j) {
      if (j && j.ok) {
        var tip = $('saveTip');
        tip.classList.add('show');
        setTimeout(function () { tip.classList.remove('show'); }, 2000);
      } else if (j && j.error) {
        alert(j.error);
      }
    }).catch(function () { alert('保存失败，请检查网络后重试'); });
  });

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
