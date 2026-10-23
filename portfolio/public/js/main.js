/* ============================================================
   前台渲染逻辑 — 数据来自服务端注入的 window.__CONTENT__
   ============================================================ */
(function () {
  'use strict';

  var CONTENT = window.__CONTENT__ || {};
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ---------- SVG 图标库 ---------- */
  var ICONS = {
    mic: '<svg viewBox="0 0 22 22" fill="none"><rect x="8" y="2" width="6" height="11" rx="3" stroke="#FFFFFF" stroke-width="1.8"/><path d="M5.5 10.5C5.5 13.8 8.4 16.5 12 16.5C15.6 16.5 18.5 13.8 18.5 10.5" stroke="#FFFFFF" stroke-width="1.8"/><path d="M12 16.5V20" stroke="#FFFFFF" stroke-width="1.8"/></svg>',
    film: '<svg viewBox="0 0 22 22" fill="none"><rect x="2" y="4" width="18" height="14" rx="1" stroke="#FFFFFF" stroke-width="1.8"/><path d="M7 4V18M15 4V18M2 9.5H7M15 9.5H22M2 14H7M15 14H22" stroke="#FFFFFF" stroke-width="1.8"/></svg>',
    megaphone: '<svg viewBox="0 0 22 22" fill="none"><path d="M2 9V13H4.5L10 17.5V4.5L4.5 9H2Z" stroke="#FFFFFF" stroke-width="1.8"/><path d="M14 8C15.5 9.2 15.5 12.8 14 14" stroke="#FFFFFF" stroke-width="1.8"/><path d="M17 5.5C19.5 7.8 19.5 14.2 17 16.5" stroke="#FFFFFF" stroke-width="1.8"/></svg>',
    mail: '<svg viewBox="0 0 16 16" fill="none"><rect x="1.5" y="3.5" width="13" height="10" rx="1" stroke="#A3A3A3" stroke-width="1.5"/><path d="M2 4.5L8 9L14 4.5" stroke="#A3A3A3" stroke-width="1.5"/></svg>',
    phone: '<svg viewBox="0 0 16 16" fill="none"><path d="M2.5 3C2.5 2.4 3 2 3.6 2H5.8L6.8 5.2L5.2 6.2C6.3 8.4 7.9 10 10.1 11.1L11.1 9.5L14.3 10.5V12.6C14.3 13.2 13.8 13.7 13.2 13.7C7.7 13.4 2.8 8.5 2.5 3Z" stroke="#A3A3A3" stroke-width="1.5"/></svg>',
    pin: '<svg viewBox="0 0 16 16" fill="none"><path d="M8 1.5C5.5 1.5 3.5 3.5 3.5 6C3.5 9.8 8 14.5 8 14.5C8 14.5 12.5 9.8 12.5 6C12.5 3.5 10.5 1.5 8 1.5Z" stroke="#A3A3A3" stroke-width="1.5"/><circle cx="8" cy="6" r="1.8" stroke="#A3A3A3" stroke-width="1.5"/></svg>',
    share: '<svg viewBox="0 0 16 16" fill="none"><circle cx="4" cy="8" r="2" stroke="#A3A3A3" stroke-width="1.5"/><circle cx="12" cy="4" r="2" stroke="#A3A3A3" stroke-width="1.5"/><circle cx="12" cy="12" r="2" stroke="#A3A3A3" stroke-width="1.5"/><path d="M5.8 7L10.2 4.8M5.8 9L10.2 11.2" stroke="#A3A3A3" stroke-width="1.5"/></svg>',
    play: '<svg viewBox="0 0 22 18" fill="none"><path d="M2 1L20 9L2 17Z" fill="#000000"/></svg>'
  };

  /* ---------- 移动端菜单 ---------- */
  var menuBtn = $('menuBtn'), mobileMenu = $('mobileMenu');
  if (menuBtn && mobileMenu) {
    menuBtn.addEventListener('click', function () { mobileMenu.classList.toggle('open'); });
    mobileMenu.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { mobileMenu.classList.remove('open'); });
    });
  }

  /* ---------- 视频弹窗 ---------- */
  var videoModal = $('videoModal');
  function openVideo(videoUrl, posterUrl) {
    var body = $('videoModalBody');
    var tip = $('videoModalTip');
    if (videoUrl) {
      // preload="metadata"：只取元数据，不预先整段下载（视频可能上百 MB）
      body.innerHTML = '<video src="' + esc(videoUrl) + '" poster="' + esc(posterUrl || '') + '" preload="metadata" controls playsinline></video>';
      tip.textContent = '点击播放按钮开始观看';
    } else {
      body.innerHTML = posterUrl ? '<img src="' + esc(posterUrl) + '" alt="视频封面" />' : '';
      tip.textContent = '尚未配置视频文件地址 — 登录后台「作品管理」即可为这部作品粘贴视频链接（mp4 / webm）';
    }
    videoModal.classList.add('open');
    document.body.style.overflow = 'hidden';
    var v = body.querySelector('video');
    if (v && v.play) { var pr = v.play(); if (pr && pr.catch) pr.catch(function () {}); }
  }
  function closeVideo() {
    // 先暂停再移除 DOM，避免移除元素后音视频仍在后台播放
    var body = $('videoModalBody');
    var v = body && body.querySelector('video');
    if (v) { try { v.pause(); v.removeAttribute('src'); v.load(); } catch (e) { /* 忽略 */ } }
    videoModal.classList.remove('open');
    if (body) body.innerHTML = '';
    document.body.style.overflow = '';
  }
  if (videoModal) {
    $('videoModalClose').addEventListener('click', closeVideo);
    videoModal.addEventListener('click', function (e) { if (e.target === videoModal) closeVideo(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeVideo(); });
  }
  // 委托绑定所有播放按钮（案例页内联播放器自行处理，不弹窗）
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.play-btn');
    if (!btn) return;
    if (btn.closest('.player')) return;
    e.preventDefault();
    openVideo(btn.getAttribute('data-video'), btn.getAttribute('data-poster'));
  });

  // 路径为空时不输出 src 属性：src="" 会被浏览器解析为当前页面 URL 并重复请求整页
  function imgTag(src, alt) {
    return src ? '<img src="' + esc(src) + '" alt="' + esc(alt || '') + '" />' : '';
  }

  /* ============================================================
     首页渲染
     ============================================================ */
  function renderHome() {
    var p = CONTENT.profile || {};
    if (!p.name) return;

    $('navName').textContent = p.name || '张君睿';

    // Hero
    $('heroKicker').innerHTML = '<span class="kicker-dot"></span>' + esc(p.kicker || '');
    $('heroHeadline').textContent = p.headline || '';
    $('heroSub').textContent = p.sub || '';
    $('heroTags').innerHTML = (p.tags || []).map(function (t) {
      return '<span class="tag-pill">' + esc(t) + '</span>';
    }).join('');

    var sr = p.showreel || {};
    $('showreelImg').src = sr.cover || '';
    var sb = document.querySelector('#showreel .play-btn');
    sb.setAttribute('data-video', sr.video || '');
    sb.setAttribute('data-poster', sr.cover || '');
    $('showreelDur').textContent = (sr.label ? sr.label + ' · ' : '') + (sr.duration || '');
    $('showreelCap').textContent = sr.caption || '';

    // 简介
    $('portraitImg').src = p.portrait || '';
    $('portraitName').textContent = p.name || '';
    $('portraitRole').textContent = p.role || '';
    $('bio1').textContent = p.bio1 || '';
    $('bio2').textContent = p.bio2 || '';
    $('intentCard').innerHTML = (p.intent || []).map(function (r) {
      return '<div class="intent-row"><span class="l">' + esc(r.label) + '</span><span class="v">' + esc(r.value) + '</span></div>';
    }).join('');

    // 擅长方向
    $('specCards').innerHTML = (CONTENT.specialties || []).map(function (s) {
      return '<div class="spec-card">' +
        '<div class="spec-icon-box">' + (ICONS[s.icon] || ICONS.film) + '</div>' +
        '<div class="spec-name">' + esc(s.name) + '</div>' +
        '<div class="spec-desc">' + esc(s.desc) + '</div>' +
        '<div class="spec-tags">' + esc(s.tags || '') + '</div></div>';
    }).join('');

    // 数据行
    $('statsRow').innerHTML = (p.stats || []).map(function (s) {
      return '<div class="stat-cell"><span class="stat-num">' + esc(s.num) + '</span><span class="stat-label">' + esc(s.label) + '</span></div>';
    }).join('');

    // 作品网格
    $('worksGrid').innerHTML = (CONTENT.works || []).map(function (w) {
      return '<a class="work-card" href="/case?id=' + encodeURIComponent(w.id) + '">' +
        '<div class="work-cover">' +
        imgTag(w.cover, w.title) +
        '<button class="play-btn" data-video="' + esc(w.video || '') + '" data-poster="' + esc(w.cover || '') + '" aria-label="播放">' + ICONS.play + '</button>' +
        '<span class="dur-pill">' + esc(w.duration || '') + '</span>' +
        '</div>' +
        '<div class="work-meta">' +
        '<div class="work-meta-top"><span class="work-cat">' + esc(w.category) + '</span><span class="work-year">' + esc(w.year) + '</span></div>' +
        '<div class="work-title">' + esc(w.title) + '</div>' +
        '<div class="work-desc">' + esc(w.desc) + '</div>' +
        '</div></a>';
    }).join('');

    // 技能
    $('skillsList').innerHTML = (CONTENT.skills || []).map(function (s) {
      return '<div class="skill-row">' +
        '<span class="skill-num">' + esc(s.num) + '</span>' +
        '<div class="skill-mid"><span class="skill-name">' + esc(s.name) + '</span><span class="skill-desc">' + esc(s.desc) + '</span></div>' +
        '<div class="skill-track"><div class="skill-fill" style="width:' + Math.max(0, Math.min(100, s.level || 0)) + '%"></div></div>' +
        '</div>';
    }).join('');

    // 软件
    $('softGrid').innerHTML = (CONTENT.software || []).map(function (s) {
      return '<div class="soft-cell"><div class="soft-glyph-box">' + esc(s.glyph) + '</div><div class="soft-name">' + esc(s.name) + '</div><div class="soft-level">' + esc(s.level) + '</div></div>';
    }).join('');
    $('softNote').textContent = CONTENT.softwareNote || '';

    // 联系
    var c = CONTENT.contact || {};
    $('contactTitle').textContent = c.title || '';
    $('contactSub').textContent = c.sub || '';
    $('mailtoBtn').href = 'mailto:' + (c.email || '');
    var rows = '';
    if (c.email) rows += '<div class="contact-row"><div class="contact-icon-box">' + ICONS.mail + '</div><div class="contact-mid"><span class="contact-label">邮箱</span><span class="contact-value">' + esc(c.email) + '</span></div></div>';
    if (c.phone) rows += '<div class="contact-row"><div class="contact-icon-box">' + ICONS.phone + '</div><div class="contact-mid"><span class="contact-label">电话</span><span class="contact-value">' + esc(c.phone) + '</span></div></div>';
    if (c.location) rows += '<div class="contact-row"><div class="contact-icon-box">' + ICONS.pin + '</div><div class="contact-mid"><span class="contact-label">所在地</span><span class="contact-value cn">' + esc(c.location) + '</span></div></div>';
    if (c.socials && c.socials.length) {
      rows += '<div class="contact-row"><div class="contact-icon-box">' + ICONS.share + '</div><div class="contact-mid"><span class="contact-label">社交媒体</span><div class="social-chips">' +
        c.socials.map(function (s) { return '<a class="social-chip" href="' + esc(s.url || '#') + '" target="_blank" rel="noopener">' + esc(s.name) + ' ↗</a>'; }).join('') +
        '</div></div></div>';
    }
    $('contactCard').innerHTML = rows;

    // 页脚
    $('footerBrand').textContent = (CONTENT.footer || {}).brand || '';
    $('footerNote').textContent = (CONTENT.footer || {}).note || '';

    document.title = (p.name || '张君睿') + ' · 视频剪辑师 — 求职作品集';
  }

  /* ============================================================
     案例详情页渲染
     ============================================================ */
  function renderCase() {
    if (!$('caseRoot')) return;
    var params = new URLSearchParams(location.search);
    var id = params.get('id');
    var works = CONTENT.works || [];
    // 找不到对应 id 时不再回退到第一部作品——否则 URL 与展示内容不一致
    var work = works.filter(function (w) { return w.id === id; })[0];
    if (!work) {
      $('caseRoot').innerHTML = '<div style="padding:120px 24px;text-align:center;color:#737373;">未找到该作品，<a href="/" style="color:#9EFF00;">返回首页</a></div>';
      return;
    }
    document.title = work.title + ' — 张君睿 · 视频剪辑师';

    // 头部元信息 + 标题
    var meta = (work.detail && work.detail.meta) || [
      { label: '类别', value: work.category },
      { label: '年份', value: work.year },
      { label: '时长', value: work.duration }
    ];
    $('caseMetaRow').innerHTML = meta.map(function (m) {
      return '<span class="case-meta"><span class="l">' + esc(m.label) + '</span><span class="v">' + esc(m.value) + '</span></span>';
    }).join('');
    $('caseTitle').textContent = work.title;

    // 播放器（内联真实控件 + 可拖动进度条）
    setupCasePlayer(document.getElementById('player'), work.video || '', work.cover || '', work.duration || '');

    // 左列：项目背景
    var d = work.detail;
    var left = '';
    if (d) {
      left += '<span class="kicker">项目背景 · BRIEF</span>' +
        '<h2 class="case-block-title" style="margin-top:16px;">' + esc(d.bgTitle || '项目背景') + '</h2>' +
        (d.bgParas || []).map(function (t) { return '<p class="case-para">' + esc(t) + '</p>'; }).join('');
      if (d.info && d.info.length) {
        left += '<div class="case-info-card">' + d.info.map(function (r) {
          return '<div class="intent-row"><span class="l">' + esc(r.label) + '</span><span class="v">' + esc(r.value) + '</span></div>';
        }).join('') + '</div>';
      }
    } else {
      left += '<span class="kicker">项目背景 · BRIEF</span>' +
        '<h2 class="case-block-title" style="margin-top:16px;">项目概述</h2>' +
        '<p class="case-para">' + esc(work.desc || '') + '</p>' +
        '<p class="case-para">该作品的详细案例说明（项目背景、剪辑手法）正在整理中。作为求职方向为「' + esc(work.category || '视频') + '」的代表练习，它体现了我在节奏控制与叙事结构上的日常训练。完整 case study 可在约谈时展示工程文件与时间线。</p>';
    }
    $('caseLeftCol').innerHTML = left;

    // 右列：剪辑手法
    var right = '';
    if (d) {
      right += '<span class="kicker">剪辑手法 · APPROACH</span>' +
        '<h2 class="case-block-title" style="margin-top:16px;">' + esc(d.techTitle || '剪辑手法') + '</h2>' +
        (d.techniques || []).map(function (t) {
          return '<div class="tech-item"><span class="tech-num">' + esc(t.num) + '</span><div class="tech-mid"><span class="tech-name">' + esc(t.name) + '</span><span class="tech-desc">' + esc(t.desc) + '</span></div></div>';
        }).join('');
      if (d.tools && d.tools.length) {
        right += '<div class="tools-block"><span class="tools-label">使用软件</span><div class="tools-chips">' +
          d.tools.map(function (t) { return '<span class="tool-chip">' + esc(t) + '</span>'; }).join('') + '</div></div>';
      }
    } else {
      right += '<span class="kicker">剪辑思路 · APPROACH</span>' +
        '<h2 class="case-block-title" style="margin-top:16px;">通用剪辑流程</h2>' +
        '<div class="tech-item"><span class="tech-num">01</span><div class="tech-mid"><span class="tech-name">素材整理</span><span class="tech-desc">按场景 / 人物 / 空镜分类建库，命名规范，标记可用片段。</span></div></div>' +
        '<div class="tech-item"><span class="tech-num">02</span><div class="tech-mid"><span class="tech-name">粗剪结构</span><span class="tech-desc">先搭叙事骨架，再填充细节，保证节奏曲线成立。</span></div></div>' +
        '<div class="tech-item"><span class="tech-num">03</span><div class="tech-mid"><span class="tech-name">精剪与包装</span><span class="tech-desc">卡点、转场、花字、音效分层，最后统一调色输出。</span></div></div>';
    }
    $('caseRightCol').innerHTML = right;

    // 更多作品（取其他 3 部）
    $('moreRow').innerHTML = works.filter(function (w) { return w.id !== work.id; }).slice(0, 3).map(function (w) {
      return '<a class="mini-card" href="/case?id=' + encodeURIComponent(w.id) + '">' +
        '<div class="mini-cover">' + imgTag(w.cover, w.title) + '</div>' +
        '<div class="mini-meta"><span class="mini-title">' + esc(w.title) + '</span><span class="mini-cat">' + esc(w.category) + '</span></div></a>';
    }).join('');
  }

  /* ============================================================
     案例页内联播放器：真实控件 + 可拖动进度条
     ============================================================ */
  var PLAYER_SVG = {
    play: '<svg viewBox="0 0 18 18" fill="none"><path d="M3 2L15 9L3 16V2Z" fill="#FFFFFF"/></svg>',
    pause: '<svg viewBox="0 0 18 18" fill="none"><path d="M4 2H7V16H4ZM11 2H14V16H11Z" fill="#FFFFFF"/></svg>',
    vol: '<svg viewBox="0 0 18 18" fill="none"><path d="M2 6V12H4.5L8.5 15.5V2.5L4.5 6H2Z" stroke="#FFFFFF" stroke-width="1.5"/><path d="M11.5 6C12.8 7.2 12.8 10.8 11.5 12" stroke="#FFFFFF" stroke-width="1.5"/><path d="M14 4C16.2 6 16.2 12 14 14" stroke="#FFFFFF" stroke-width="1.5"/></svg>',
    muted: '<svg viewBox="0 0 18 18" fill="none"><path d="M2 6V12H4.5L8.5 15.5V2.5L4.5 6H2Z" stroke="#FFFFFF" stroke-width="1.5"/><path d="M11 6.5L15 11.5M15 6.5L11 11.5" stroke="#FFFFFF" stroke-width="1.5"/></svg>',
    full: '<svg viewBox="0 0 18 18" fill="none"><path d="M1.5 6V1.5H6M12 1.5H16.5V6M16.5 12V16.5H12M6 16.5H1.5V12" stroke="#FFFFFF" stroke-width="1.5"/></svg>'
  };
  function fmtClock(sec) {
    sec = Math.max(0, Math.round(sec || 0));
    var m = Math.floor(sec / 60), s = sec % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }
  function setupCasePlayer(player, src, posterSrc, fallbackDurationText) {
    if (!player || player.dataset.playerReady) return;
    player.dataset.playerReady = '1';
    var video = document.createElement('video');
    video.className = 'player-video';
    video.preload = 'metadata';
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    if (src) video.src = src;
    player.insertBefore(video, player.firstChild);

    var playBtn = player.querySelector('.play-btn');
    var toggle = player.querySelector('.ctrl-toggle');
    var timeEl = player.querySelector('.ctrl-time');
    var track = player.querySelector('.ctrl-track');
    var fill = player.querySelector('.ctrl-fill');
    var muteBtn = player.querySelector('.ctrl-mute');
    var fullBtn = player.querySelector('.ctrl-full');
    var duration = 0;
    var dragging = false;
    if (fallbackDurationText) timeEl.textContent = '00:00 / ' + fallbackDurationText;

    function paint(cur) {
      var pct = duration ? Math.min(100, (cur / duration) * 100) : 0;
      fill.style.width = pct + '%';
      timeEl.textContent = fmtClock(cur) + ' / ' + fmtClock(duration);
    }
    video.addEventListener('loadedmetadata', function () {
      duration = video.duration || 0;
      paint(video.currentTime);
    });
    video.addEventListener('timeupdate', function () {
      if (!dragging) paint(video.currentTime);
    });
    video.addEventListener('play', function () { toggle.innerHTML = PLAYER_SVG.pause; });
    video.addEventListener('pause', function () { toggle.innerHTML = PLAYER_SVG.play; });
    video.addEventListener('ended', function () {
      player.classList.remove('playing');
      toggle.innerHTML = PLAYER_SVG.play;
      video.currentTime = 0;
    });

    playBtn.addEventListener('click', function () {
      if (!src) { openVideo('', posterSrc); return; }
      player.classList.add('playing');
      video.play().catch(function () {});
    });
    toggle.addEventListener('click', function () {
      if (video.paused) video.play().catch(function () {}); else video.pause();
    });
    muteBtn.addEventListener('click', function () {
      video.muted = !video.muted;
      muteBtn.innerHTML = video.muted ? PLAYER_SVG.muted : PLAYER_SVG.vol;
    });
    fullBtn.addEventListener('click', function () {
      if (document.fullscreenElement) document.exitFullscreen();
      else if (player.requestFullscreen) player.requestFullscreen();
      else if (player.webkitRequestFullscreen) player.webkitRequestFullscreen();
    });

    // 进度条：点击定位 + 按住拖动（Pointer Events，鼠标/触屏通用），拖动时实时同步播放位置
    function seekFromEvent(e) {
      var rect = track.getBoundingClientRect();
      if (!rect.width) return;
      var x = (e.clientX - rect.left) / rect.width;
      x = Math.max(0, Math.min(1, x));
      fill.style.width = (x * 100) + '%';
      if (duration) {
        video.currentTime = x * duration;
        timeEl.textContent = fmtClock(video.currentTime) + ' / ' + fmtClock(duration);
      }
    }
    track.addEventListener('pointerdown', function (e) {
      if (!duration) return;
      dragging = true;
      track.classList.add('dragging');
      if (track.setPointerCapture) { try { track.setPointerCapture(e.pointerId); } catch (err) {} }
      seekFromEvent(e);
      e.preventDefault();
    });
    track.addEventListener('pointermove', function (e) { if (dragging) seekFromEvent(e); });
    track.addEventListener('pointerup', function () { dragging = false; track.classList.remove('dragging'); });
    track.addEventListener('pointercancel', function () { dragging = false; track.classList.remove('dragging'); });
  }

  /* ============================================================
     数字滚动动画（统计格进入视口时触发）
     ============================================================ */
  function countUp(el) {
    if (el.dataset.counted) return;
    var txt = el.textContent || '';
    var m = txt.match(/^(\d+)(.*)$/);
    if (!m) return;
    el.dataset.counted = '1';
    var target = parseInt(m[1], 10);
    var suffix = m[2] || '';
    var dur = 1100, start = null;
    function step(ts) {
      if (!start) start = ts;
      var p = Math.min(1, (ts - start) / dur);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased) + suffix;
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = target + suffix;
    }
    requestAnimationFrame(step);
  }

  /* ============================================================
     滚动显现：自动标记 + IntersectionObserver
     ============================================================ */
  var revealObserver = null;
  function observeReveals() {
    if (!revealObserver) return;
    document.querySelectorAll('.reveal:not(.in)').forEach(function (el) { revealObserver.observe(el); });
  }
  function initRevealObserver() {
    if (!('IntersectionObserver' in window)) {
      document.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('in'); });
      return;
    }
    if (revealObserver) revealObserver.disconnect();
    revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add('in');
          revealObserver.unobserve(en.target);
          en.target.querySelectorAll('.stat-num').forEach(function (n) { countUp(n); });
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -36px 0px' });
    observeReveals();
  }
  function markReveals() {
    var sels = [
      '.hero-left > *', '.hero-right', '.sec-head', '.portrait', '.intent-card', '.bio',
      '.spec-card', '.stat-cell', '.work-card', '.skill-row', '.soft-col', '.soft-cell',
      '.contact-card', '.tech-item', '.case-info-card', '.tools-block', '.mini-card', '.soft-note'
    ];
    sels.forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (el, i) {
        if (el.classList.contains('reveal')) return;
        el.classList.add('reveal');
        el.setAttribute('data-d', String((i % 4) + 1));
      });
    });
    observeReveals();
  }

  /* ---------- 启动 ---------- */
  if ($('worksGrid')) renderHome();
  if ($('caseRoot')) renderCase();
  initRevealObserver();
  markReveals();

  // 导航栏滚动态（加深背景 + 毛玻璃）
  var navEl = document.querySelector('.nav');
  window.addEventListener('scroll', function () {
    if (!navEl) return;
    if (window.scrollY > 8) navEl.classList.add('scrolled');
    else navEl.classList.remove('scrolled');
  }, { passive: true });
})();
