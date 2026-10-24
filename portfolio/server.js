/**
 * 剪辑师个人作品集 — 零依赖 Node.js 服务器
 * 功能：静态站点托管 + 内容 SSR 注入 + 后台管理 API（登录 / 内容保存 / 改密码 / 上传）
 * 运行：node server.js
 *
 * 环境变量：
 *   PORT            监听端口，默认 3000
 *   HOST            监听地址，默认 127.0.0.1（部署到服务器时按需改为 0.0.0.0）
 *   ADMIN_PASSWORD  首次启动时的初始密码，默认 admin123（启动后请立即在后台修改）
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const os = require('os');
const { execFile } = require('child_process');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_FILE = path.join(ROOT, 'data.json');
const BACKUP_FILE = path.join(ROOT, 'data.json.bak');
const ACCESS_LOG_FILE = path.join(ROOT, 'access-log.json');
// 管理员凭据单独存放：data.json 是要提交到仓库的内容数据，不应混入任何密钥
const AUTH_FILE = path.join(ROOT, 'auth.json');
// 发布脚本与站点根目录（portfolio 的上一级）
const PROJECT_ROOT = path.resolve(ROOT, '..');
const PUBLISH_SCRIPT = path.join(PROJECT_ROOT, 'scripts', 'deploy_api.ps1');
let publishing = false;
// 反向代理场景才信任 X-Forwarded-For（Nginx 请用 $proxy_add_x_forwarded_for）
const TRUST_PROXY = process.env.TRUST_PROXY === '1';
// 站点对外地址：用于 canonical / OG；部署时用 SITE_URL 覆盖
const SITE_URL = (process.env.SITE_URL || ('http://' + (HOST === '0.0.0.0' ? '127.0.0.1' : HOST) + ':' + PORT)).replace(/\/$/, '') + '/';

const SESSION_TTL = 2 * 60 * 60 * 1000;      // 登录态 2 小时
const LOGIN_MAX_FAIL = 5;                     // 同一 IP 允许的连续失败次数
const LOGIN_WINDOW = 15 * 60 * 1000;          // 失败计数窗口 15 分钟

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime'
};

// 需要支持 Range 分段读取的类型（视频拖动进度条依赖它）
const MEDIA_EXT = ['.mp4', '.webm', '.mov'];
// 可 gzip 的文本类型
const TEXT_EXT = ['.html', '.css', '.js', '.json', '.svg', '.txt', '.xml'];

// ---------- 媒体上传（视频 / 封面图片） ----------
const UPLOAD_CONF = {
  video: { dir: path.join(PUBLIC_DIR, 'videos'), exts: ['.mp4', '.webm'], max: 200 * 1024 * 1024 },
  image: { dir: path.join(PUBLIC_DIR, 'images'), exts: ['.png', '.jpg', '.jpeg', '.webp'], max: 10 * 1024 * 1024 }
};

// ---------- 密码哈希（scrypt） ----------
function hashPassword(pwd) {
  const salt = crypto.randomBytes(16).toString('hex');
  const key = crypto.scryptSync(String(pwd), salt, 64).toString('hex');
  return 'scrypt$' + salt + '$' + key;
}
function verifyPassword(pwd, stored) {
  if (typeof stored !== 'string') return false;
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const expected = Buffer.from(parts[2], 'hex');
  let actual;
  try {
    actual = crypto.scryptSync(String(pwd), parts[1], expected.length);
  } catch (e) {
    return false;
  }
  // 定长比较，避免时序侧信道
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

// ---------- 数据读写 ----------
// 写入使用「临时文件 + rename」，rename 在同一分区是原子操作，
// 避免写入过程中断（崩溃 / 断电 / 并发保存）产生截断的 data.json。
function writeData(d) {
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(d, null, 2), 'utf8');
  try {
    if (fs.existsSync(DATA_FILE)) fs.copyFileSync(DATA_FILE, BACKUP_FILE); // 保留上一版
  } catch (e) { /* 备份失败不影响主流程 */ }
  fs.renameSync(tmp, DATA_FILE);
}
// 解析失败不再静默返回默认值——那会让全站内容消失并把密码回退成 admin123。
// 这里改为先尝试回滚备份，仍失败就向上抛出，由调用方返回明确的错误。
function readData() {
  let raw;
  try {
    raw = fs.readFileSync(DATA_FILE, 'utf8');
  } catch (e) {
    return ensureDataFile();
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    try { fs.writeFileSync(DATA_FILE + '.corrupt-' + stamp, raw, 'utf8'); } catch (e2) { /* 尽力保留现场 */ }
    if (fs.existsSync(BACKUP_FILE)) {
      try {
        const bak = JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf8'));
        console.error('[警告] data.json 解析失败，已改用 data.json.bak 恢复');
        return bak;
      } catch (e3) { /* 备份同样损坏 */ }
    }
    throw new Error('data.json 解析失败，已保留损坏副本，请从备份恢复');
  }
}
// 首次启动时初始化数据文件（只写空设置项，正文内容由后台填写）
function ensureDataFile() {
  const seed = { settings: {} };
  writeData(seed);
  return seed;
}
function readAuth() {
  try { return JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8')) || {}; } catch (e) { return {}; }
}
// 取当前密码哈希；首次运行按 ADMIN_PASSWORD（默认 admin123）生成并落盘
function getPasswordHash() {
  const a = readAuth();
  if (a.adminPasswordHash) return a.adminPasswordHash;
  if (!process.env.ADMIN_PASSWORD) {
    console.warn('[安全] 未设置 ADMIN_PASSWORD，首次启动使用默认密码 admin123；请登录后立即修改');
  }
  const h = hashPassword(process.env.ADMIN_PASSWORD || 'admin123');
  fs.writeFileSync(AUTH_FILE, JSON.stringify({ adminPasswordHash: h }, null, 2), 'utf8');
  try { fs.chmodSync(AUTH_FILE, 0o600); } catch (e) { /* Windows 上忽略 */ }
  return h;
}
function setPasswordHash(h) {
  fs.writeFileSync(AUTH_FILE, JSON.stringify({ adminPasswordHash: h }, null, 2), 'utf8');
  try { fs.chmodSync(AUTH_FILE, 0o600); } catch (e) { /* Windows 上忽略 */ }
}
// 对外输出时移除密码相关字段
function publicData(d) {
  const c = JSON.parse(JSON.stringify(d));
  if (c.settings) {
    delete c.settings.adminPassword;
    delete c.settings.adminPasswordHash;
  }
  return c;
}

// 启动时把历史遗留的密码字段从 data.json 迁移到 auth.json
(function migratePassword() {
  try {
    const d = readData();
    const s = d.settings || {};
    let changed = false;
    if (!readAuth().adminPasswordHash && s.adminPasswordHash) {
      setPasswordHash(s.adminPasswordHash);
      delete s.adminPasswordHash;
      changed = true;
    }
    if (s.adminPassword) {
      if (!readAuth().adminPasswordHash) setPasswordHash(hashPassword(s.adminPassword));
      delete s.adminPassword;
      changed = true;
    }
    if (changed) {
      d.settings = s;
      writeData(d);
      console.log('[安全] 管理员凭据已迁出 data.json，现存放于 auth.json（该文件不应提交）');
    }
  } catch (e) {
    console.error('[错误] 初始化数据失败：' + e.message);
    process.exit(1);
  }
  getPasswordHash();   // 确保凭据文件存在
})();

// ---------- 会话（内存态，带过期时间） ----------
const sessions = new Map();   // token -> 过期时间戳
function newSession() {
  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, Date.now() + SESSION_TTL);
  return token;
}
function validSession(token) {
  if (!token) return false;
  const exp = sessions.get(token);
  if (!exp) return false;
  if (exp < Date.now()) { sessions.delete(token); return false; }
  sessions.set(token, Date.now() + SESSION_TTL);   // 活跃会话顺延
  return true;
}
function authToken(req) {
  return (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '');
}
setInterval(function () {
  const now = Date.now();
  sessions.forEach(function (exp, tk) { if (exp < now) sessions.delete(tk); });
}, 10 * 60 * 1000).unref();

// ---------- 登录失败计数（按 IP 限速） ----------
const loginFails = new Map();   // ip -> { count, first }
function loginBlocked(ip) {
  const rec = loginFails.get(ip);
  if (!rec) return false;
  if (Date.now() - rec.first > LOGIN_WINDOW) { loginFails.delete(ip); return false; }
  return rec.count >= LOGIN_MAX_FAIL;
}
function loginFail(ip) {
  const rec = loginFails.get(ip);
  if (!rec || Date.now() - rec.first > LOGIN_WINDOW) loginFails.set(ip, { count: 1, first: Date.now() });
  else rec.count += 1;
}
function loginReset(ip) { loginFails.delete(ip); }
function clientIp(req) {
  // 只有明确处于反向代理后才信任 XFF；取代理追加的最后一个地址，防止客户端伪造首个值
  if (TRUST_PROXY) {
    const xff = req.headers['x-forwarded-for'];
    if (xff) {
      const parts = String(xff).split(',');
      const last = parts[parts.length - 1].trim();
      if (last) return last;
    }
  }
  return req.socket.remoteAddress || 'unknown';
}
// 清理过期的失败记录，避免大量唯一 IP 造成内存增长
setInterval(function () {
  const now = Date.now();
  loginFails.forEach(function (rec, ip) {
    if (now - rec.first > LOGIN_WINDOW) loginFails.delete(ip);
  });
  if (loginFails.size > 10000) {
    const first = loginFails.keys().next();
    if (!first.done) loginFails.delete(first.value);
  }
}, 5 * 60 * 1000).unref();

// ---------- 访问与操作日志（批量落盘，避免每次访问同步写文件） ----------
let accessLog = [];
try { accessLog = JSON.parse(fs.readFileSync(ACCESS_LOG_FILE, 'utf8')); } catch (e) { accessLog = []; }
let logDirty = false;
function flushLog() {
  if (!logDirty) return;
  logDirty = false;
  try { fs.writeFileSync(ACCESS_LOG_FILE, JSON.stringify(accessLog)); } catch (e) { /* 写入失败不影响服务 */ }
}
setInterval(flushLog, 3 * 1000).unref();
function logEvent(type, action, detail) {
  accessLog.unshift({ ts: Date.now(), type: type, action: action, detail: detail || '' });
  if (accessLog.length > 500) accessLog = accessLog.slice(0, 500);
  logDirty = true;
}

// ---------- 工具 ----------
function securityHeaders() {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    // 内联 JSON / JSON-LD 需要 'unsafe-inline'；其余仍限制在同源
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data: https:; media-src 'self' https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; script-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
  };
}
function send(res, status, body, headers) {
  const h = Object.assign(securityHeaders(), headers || {});
  if (!h['Content-Type']) h['Content-Type'] = 'text/plain; charset=utf-8';
  res.writeHead(status, h);
  res.end(body);
}
function sendJson(res, obj, status) {
  send(res, status || 200, JSON.stringify(obj), {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
}
function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function parseJsonBody(raw) {
  if (!raw || !String(raw).trim()) throw new Error('BAD_JSON');
  try { return JSON.parse(raw); } catch (e) { throw new Error('BAD_JSON'); }
}
function acceptsGzip(req) {
  return /\bgzip\b/i.test(String(req.headers['accept-encoding'] || ''));
}
function cachePolicy(ext) {
  // HTML / CSS / JS 需要即时反映后台修改；图片与视频可缓存 7 天（配合 ETag 可 304）
  if (ext === '.html' || ext === '.json' || ext === '.css' || ext === '.js') return 'no-cache';
  return 'public, max-age=604800';
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let b = '';
    let aborted = false;
    req.on('data', (c) => {
      b += c;
      if (b.length > 8e6) {
        aborted = true;
        reject(new Error('BODY_TOO_LARGE'));   // 必须显式 reject，否则请求会悬挂
        req.destroy();
      }
    });
    req.on('end', () => { if (!aborted) resolve(b); });
    req.on('error', (e) => { if (!aborted) reject(e); });
  });
}
// 流式落盘：边收边写，不再把整个文件（最大 200MB）一次性读进内存
function saveUpload(req, conf, dest) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const ws = fs.createWriteStream(dest);
    let size = 0;
    let done = false;
    function fail(err) {
      if (done) return;
      done = true;
      ws.destroy();
      fs.unlink(dest, function () {});        // 清理半成品
      reject(err);
    }
    req.on('data', (c) => {
      size += c.length;
      if (size > conf.max) {
        req.destroy();
        fail(new Error('FILE_TOO_LARGE'));
        return;
      }
      if (!ws.write(c)) { req.pause(); ws.once('drain', () => req.resume()); }
    });
    req.on('end', () => {
      if (done) return;
      ws.end(function () {
        if (done) return;
        done = true;
        if (size === 0) { fs.unlink(dest, function () {}); reject(new Error('EMPTY_FILE')); return; }
        resolve(size);
      });
    });
    req.on('error', (e) => fail(e));
    ws.on('error', (e) => fail(e));
  });
}
// 静态资源：先 realpath 解析符号链接，再校验目录边界（含分隔符，防止 publicX 这类绕过）
function serveStatic(res, pathname, req) {
  let p;
  try { p = decodeURIComponent(pathname); } catch (e) { return send(res, 400, 'Bad Request'); }
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(PUBLIC_DIR, p));
  fs.realpath(file, (err, real) => {
    if (err) return send(res, 404, 'Not Found');
    const inDir = real === PUBLIC_DIR || real.startsWith(PUBLIC_DIR + path.sep);
    if (!inDir) return send(res, 403, 'Forbidden');
    fs.stat(real, (e2, st) => {
      if (e2 || !st.isFile()) return send(res, 404, 'Not Found');
      const ext = path.extname(real).toLowerCase();
      const etag = 'W/"' + st.size.toString(16) + '-' + Math.floor(st.mtimeMs).toString(16) + '"';
      const headers = Object.assign(securityHeaders(), {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Cache-Control': cachePolicy(ext),
        'ETag': etag,
        'Last-Modified': st.mtime.toUTCString()
      });
      // 条件请求：避免每次刷新都重新下载 CSS/JS/图片
      if (!req.headers.range) {
        if (req.headers['if-none-match'] === etag) {
          res.writeHead(304, headers);
          return res.end();
        }
        const ims = Date.parse(req.headers['if-modified-since'] || '');
        if (!isNaN(ims) && st.mtimeMs <= ims + 999) {
          res.writeHead(304, headers);
          return res.end();
        }
      }
      const range = req.headers.range;
      if (!range && TEXT_EXT.indexOf(ext) !== -1) {
        // 文本资源：一次性读入并可选 gzip；体积小，避免流式压缩的复杂度
        return fs.readFile(real, (e3, buf) => {
          if (e3) return send(res, 500, 'Read Error');
          let body = buf;
          if (acceptsGzip(req) && buf.length > 1024) {
            body = zlib.gzipSync(buf);
            headers['Content-Encoding'] = 'gzip';
            headers['Vary'] = 'Accept-Encoding';
          }
          headers['Content-Length'] = body.length;
          res.writeHead(200, headers);
          res.end(body);
        });
      }
      let status = 200;
      let stream;
      if (range && MEDIA_EXT.indexOf(ext) !== -1) {
        const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
        if (m) {
          let start;
          let end;
          if (m[1] === '') {                       // bytes=-N：取末尾 N 字节
            const n = parseInt(m[2], 10);
            if (!isNaN(n) && n > 0) { start = Math.max(0, st.size - n); end = st.size - 1; }
          } else {
            start = parseInt(m[1], 10);
            end = m[2] === '' ? st.size - 1 : Math.min(parseInt(m[2], 10), st.size - 1);
          }
          if (start === undefined || isNaN(start) || isNaN(end) || start > end || start >= st.size) {
            return send(res, 416, 'Range Not Satisfiable', { 'Content-Range': 'bytes */' + st.size });
          }
          status = 206;
          headers['Content-Range'] = 'bytes ' + start + '-' + end + '/' + st.size;
          headers['Content-Length'] = end - start + 1;
          headers['Accept-Ranges'] = 'bytes';
          stream = fs.createReadStream(real, { start: start, end: end });
        }
      }
      if (!stream) {
        headers['Content-Length'] = st.size;
        if (MEDIA_EXT.indexOf(ext) !== -1) headers['Accept-Ranges'] = 'bytes';
        stream = fs.createReadStream(real);
      }
      res.writeHead(status, headers);
      stream.pipe(res);
    });
  });
}
// ---------- 页面 meta / 无 JS 摘要 ----------
function renderMeta(data, opts) {
  const p = data.profile || {};
  const c = data.contact || {};
  const work = opts && opts.work;
  const name = p.name || '张君睿';
  const title = work
    ? work.title + ' — ' + name + ' · 视频剪辑师'
    : name + ' · 视频剪辑师 — 求职作品集';
  const desc = (work ? (work.desc || p.sub) : p.sub) || '视频剪辑师求职作品集：口播、短片与广告剪辑。';
  const canonical = work
    ? SITE_URL + 'case?id=' + encodeURIComponent(work.id)
    : SITE_URL;
  const image = SITE_URL + 'images/og-cover.jpg';
  const socials = (c.socials || []).map((s) => s.url).filter((u) => u && u !== '#');
  const address = String(c.location || '山西太原').replace(' · 接受远程合作', '');
  const jsonld = work
    ? {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: work.title,
        description: desc,
        url: canonical,
        image: image,
        isPartOf: { '@type': 'WebSite', name: name + ' 作品集', url: SITE_URL }
      }
    : {
        '@context': 'https://schema.org',
        '@type': 'Person',
        name: name,
        jobTitle: '视频剪辑师',
        description: desc,
        url: SITE_URL,
        image: image,
        email: c.email ? 'mailto:' + c.email : undefined,
        address: { '@type': 'PostalAddress', addressLocality: address },
        knowsAbout: p.tags || [],
        sameAs: socials
      };
  const jsonldText = JSON.stringify(jsonld).replace(/</g, '\\u003c');
  return `<title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(desc)}" />
  <meta name="robots" content="index,follow" />
  <meta name="theme-color" content="#0A0A0A" />
  <link rel="canonical" href="${escapeHtml(canonical)}" />
  <meta property="og:type" content="${work ? 'article' : 'website'}" />
  <meta property="og:locale" content="zh_CN" />
  <meta property="og:site_name" content="${escapeHtml(name)} 作品集" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(desc)}" />
  <meta property="og:url" content="${escapeHtml(canonical)}" />
  <meta property="og:image" content="${escapeHtml(image)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="${escapeHtml(name + ' · 视频剪辑师作品集')}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(desc)}" />
  <meta name="twitter:image" content="${escapeHtml(image)}" />
  <script type="application/ld+json">${jsonldText}</script>`;
}
function renderPreload(data, opts) {
  const p = data.profile || {};
  const work = opts && opts.work;
  const cover = work ? work.cover : ((p.showreel || {}).cover || '');
  return cover ? `<link rel="preload" as="image" href="${escapeHtml(cover)}" fetchpriority="high" />` : '';
}
function renderNoscript(data, opts) {
  const p = data.profile || {};
  const c = data.contact || {};
  const work = opts && opts.work;
  if (work) {
    return `<section class="noscript-summary">
      <h1>${escapeHtml(work.title)}</h1>
      <p>${escapeHtml(work.category || '')} · ${escapeHtml(String(work.year || ''))} · ${escapeHtml(work.duration || '')}</p>
      <p>${escapeHtml(work.desc || '')}</p>
      <p><a href="${escapeHtml(SITE_URL)}">返回作品集首页</a></p>
    </section>`;
  }
  const items = (data.works || []).map((w) =>
    `<li><strong>${escapeHtml(w.title || '')}</strong>（${escapeHtml(w.category || '')}，${escapeHtml(String(w.year || ''))}）— ${escapeHtml(w.desc || '')}</li>`
  ).join('');
  const contact = [
    c.email ? `<p>邮箱：<a href="mailto:${escapeHtml(c.email)}">${escapeHtml(c.email)}</a></p>` : '',
    c.location ? `<p>所在地：${escapeHtml(c.location)}</p>` : ''
  ].join('');
  return `<section class="noscript-summary">
    <h1>${escapeHtml(p.name || '张君睿')} · ${escapeHtml(p.role || '视频剪辑师')}</h1>
    <p>${escapeHtml(p.bio1 || '')}</p>
    <p>${escapeHtml(p.bio2 || '')}</p>
    <h2>精选作品</h2>
    <ul>${items}</ul>
    <h2>联系方式</h2>
    ${contact}
  </section>`;
}

// 服务端注入内容数据（必须位于 main.js 之前执行），保证访客始终拿到最新内容且无加载闪烁
function servePage(res, pageFile, req, opts) {
  fs.readFile(path.join(PUBLIC_DIR, pageFile), (err, buf) => {
    if (err) return send(res, 500, 'Page Error');
    let data;
    try {
      data = publicData(readData());
    } catch (e) {
      console.error('[错误] 读取内容失败：' + e.message);
      return send(res, 500, '内容数据暂时不可用，请稍后再试');
    }
    const injection =
      '<script>window.__CONTENT__=' +
      JSON.stringify(data).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029') +
      '</script>';
    let html = buf.toString('utf8');
    // 用函数形式替换：字符串形式会把内容里的 $& / $' / $` 当成替换模式
    if (opts && opts.page !== 'admin') {
      html = html.replace('<!--META_TAGS-->', function () { return renderMeta(data, opts); })
        .replace('<!--PRELOAD_IMAGE-->', function () { return renderPreload(data, opts); })
        .replace('<!--NOSCRIPT_SUMMARY-->', function () { return renderNoscript(data, opts); });
    }
    html = html.replace('<!--CONTENT_INJECT-->', function () { return injection; });

    const etag = 'W/"' + crypto.createHash('sha1').update(html).digest('hex') + '"';
    const headers = Object.assign(securityHeaders(), {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache',
      'ETag': etag,
      'Vary': 'Accept-Encoding'
    });
    if (opts && opts.page === 'admin') headers['X-Robots-Tag'] = 'noindex, nofollow';
    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304, headers);
      return res.end();
    }
    let body = Buffer.from(html, 'utf8');
    if (acceptsGzip(req) && body.length > 1024) {
      body = zlib.gzipSync(body);
      headers['Content-Encoding'] = 'gzip';
    }
    headers['Content-Length'] = body.length;
    res.writeHead(200, headers);
    res.end(body);
  });
}

// ---------- 发布上线：调用构建脚本 + GitHub API 推送 ----------
function pythonCandidates() {
  const candidates = [
    process.env.PYTHON_BIN,
    path.join(os.homedir(), '.dsh', 'dsh-runtimes', 'dsh-primary-runtime', 'dependencies', 'python', 'python.exe'),
    'python',
    'python3'
  ];
  return Array.from(new Set(candidates.filter(Boolean)));
}
function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    execFile(command, args, {
      cwd: PROJECT_ROOT,
      windowsHide: true,
      timeout: 5 * 60 * 1000,
      maxBuffer: 20 * 1024 * 1024,
      env: Object.assign({}, process.env, { PYTHONIOENCODING: 'utf-8' })
    }, (err, stdout, stderr) => {
      if (err) {
        err.stdout = stdout || '';
        err.stderr = stderr || '';
        return reject(err);
      }
      resolve({ stdout: stdout || '', stderr: stderr || '' });
    });
  });
}
async function runBuild() {
  let lastError = null;
  for (const bin of pythonCandidates()) {
    try {
      const out = await runCommand(bin, ['scripts/build_spa.py', '--strict']);
      return { bin: bin, stdout: out.stdout, stderr: out.stderr };
    } catch (e) {
      if (e.code === 'ENOENT') { lastError = e; continue; }
      throw e;
    }
  }
  throw lastError || new Error('找不到 Python，请设置 PYTHON_BIN 环境变量');
}
async function publishSite() {
  if (!fs.existsSync(PUBLISH_SCRIPT)) {
    throw new Error('找不到发布脚本：' + PUBLISH_SCRIPT);
  }
  const build = await runBuild();
  const push = await runCommand('powershell.exe', [
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', PUBLISH_SCRIPT
  ]);
  const match = String(push.stdout || '').match(/commit:\s*([0-9a-f]{40})/i);
  return { build, push, commit: match ? match[1] : null };
}
function clipOutput(s) {
  return String(s || '').slice(-16000);
}

// ---------- 路由 ----------
const server = http.createServer(async (req, res) => {
  let u;
  try {
    u = new URL(req.url, 'http://internal');
  } catch (e) {
    return send(res, 400, 'Bad Request');
  }
  const p = u.pathname;
  try {
    // 健康检查（供部署探活使用）
    if (p === '/api/health' && req.method === 'GET') {
      return sendJson(res, { ok: true, uptime: Math.round(process.uptime()) });
    }
    // 公开内容
    if (p === '/api/content' && req.method === 'GET') {
      return sendJson(res, publicData(readData()));
    }
    // 登录
    if (p === '/api/login' && req.method === 'POST') {
      const ip = clientIp(req);
      if (loginBlocked(ip)) {
        return sendJson(res, { error: '登录失败次数过多，请 15 分钟后再试' }, 429);
      }
      const body = parseJsonBody(await readBody(req));
      const hash = getPasswordHash();
      if (body.password && verifyPassword(body.password, hash)) {
        loginReset(ip);
        const token = newSession();
        logEvent('action', '登录后台', '密码验证通过');
        return sendJson(res, { token: token });
      }
      loginFail(ip);
      logEvent('action', '登录失败', '来源 ' + ip);
      return sendJson(res, { error: '密码错误，请重试' }, 401);
    }
    // 退出登录（服务端作废 token）
    if (p === '/api/logout' && req.method === 'POST') {
      const tk = authToken(req);
      if (tk) sessions.delete(tk);
      logEvent('action', '退出登录', '');
      return sendJson(res, { ok: true });
    }
    // 保存内容（需登录）
    if (p === '/api/content' && req.method === 'PUT') {
      const token = authToken(req);
      if (!validSession(token)) return sendJson(res, { error: '登录已失效，请重新登录' }, 401);
      const body = parseJsonBody(await readBody(req));
      if (!body || typeof body !== 'object') return sendJson(res, { error: '数据格式错误' }, 400);
      const cur = readData();
      body.settings = cur.settings || {};   // 设置项不通过此接口修改
      writeData(body);
      logEvent('action', '保存内容修改', '通过后台保存全部内容');
      return sendJson(res, { ok: true });
    }
    // 修改密码（需登录）
    if (p === '/api/password' && req.method === 'PUT') {
      const token = authToken(req);
      if (!validSession(token)) return sendJson(res, { error: '登录已失效，请重新登录' }, 401);
      const body = parseJsonBody(await readBody(req));
      if (!body.oldPassword || !verifyPassword(body.oldPassword, getPasswordHash())) {
        return sendJson(res, { error: '原密码错误' }, 400);
      }
      if (!body.newPassword || body.newPassword.length < 8) return sendJson(res, { error: '新密码至少 8 位' }, 400);
      // 只改凭据文件，不碰内容数据
      setPasswordHash(hashPassword(body.newPassword));
      sessions.clear();   // 使所有已登录会话失效，避免旧 token 继续可用
      logEvent('action', '修改后台密码', '');
      return sendJson(res, { ok: true });
    }
    // 访问记录查询 / 清空（需登录）
    if (p === '/api/accesslog' && req.method === 'GET') {
      if (!validSession(authToken(req))) return sendJson(res, { error: '登录已失效，请重新登录' }, 401);
      return sendJson(res, { ok: true, list: accessLog });
    }
    if (p === '/api/accesslog' && req.method === 'DELETE') {
      if (!validSession(authToken(req))) return sendJson(res, { error: '登录已失效，请重新登录' }, 401);
      accessLog = [];
      logDirty = true;
      flushLog();
      logEvent('action', '清空访问记录', '');
      return sendJson(res, { ok: true });
    }
    // 发布上线：构建静态站并推送到 GitHub（需登录；同一时间只允许一个任务）
    if (p === '/api/publish' && req.method === 'POST') {
      if (!validSession(authToken(req))) return sendJson(res, { error: '登录已失效，请重新登录' }, 401);
      if (publishing) return sendJson(res, { error: '已有发布任务正在进行，请稍候' }, 409);
      publishing = true;
      try {
        const result = await publishSite();
        logEvent('action', '发布上线', result.commit ? result.commit : '无变化');
        return sendJson(res, {
          ok: true,
          build: { bin: result.build.bin, stdout: clipOutput(result.build.stdout), stderr: clipOutput(result.build.stderr) },
          push: { stdout: clipOutput(result.push.stdout), stderr: clipOutput(result.push.stderr) },
          commit: result.commit
        });
      } catch (e) {
        logEvent('action', '发布失败', e.message || '未知错误');
        return sendJson(res, {
          error: '发布失败：' + (e.message || '未知错误'),
          detail: clipOutput((e.stdout || '') + (e.stderr || '') || e.message)
        }, 500);
      } finally {
        publishing = false;
      }
    }
    // 媒体上传（需登录）：PUT /api/upload?type=video|image&name=文件名，请求体为原始文件字节
    if (p === '/api/upload' && req.method === 'PUT') {
      if (!validSession(authToken(req))) return sendJson(res, { error: '登录已失效，请重新登录' }, 401);
      const type = (u.searchParams.get('type') || 'video').trim();
      const conf = UPLOAD_CONF[type];
      if (!conf) return sendJson(res, { error: '未知的上传类型：' + type }, 400);
      const rawName = (u.searchParams.get('name') || '').trim() || ('file' + conf.exts[0]);
      const ext = path.extname(rawName).toLowerCase();
      if (conf.exts.indexOf(ext) === -1) {
        return sendJson(res, { error: '该类型仅支持：' + conf.exts.join(' / ') }, 400);
      }
      // 存储名转为 ASCII 安全格式，避免中文文件名的 URL 编码差异
      const base = path.basename(rawName, ext).replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'file';
      const safeName = Date.now() + '-' + base + ext;
      const dest = path.join(conf.dir, safeName);
      let size;
      try {
        size = await saveUpload(req, conf, dest);
      } catch (e) {
        if (e.message === 'FILE_TOO_LARGE') {
          return sendJson(res, { error: type === 'video' ? '文件超过 200MB 限制' : '文件超过 10MB 限制' }, 413);
        }
        if (e.message === 'EMPTY_FILE') return sendJson(res, { error: '文件内容为空' }, 400);
        return sendJson(res, { error: '上传失败或传输中断' }, 400);
      }
      const typeLabel = type === 'video' ? '上传视频' : '上传封面图';
      logEvent('action', typeLabel, safeName + '（' + Math.round(size / 1024) + ' KB）');
      return sendJson(res, { ok: true, url: (type === 'video' ? 'videos/' : 'images/') + safeName, size: size });
    }
    // 删除已上传媒体（需登录）：DELETE /api/upload?type=video|image&name=文件名
    if (p === '/api/upload' && req.method === 'DELETE') {
      if (!validSession(authToken(req))) return sendJson(res, { error: '登录已失效，请重新登录' }, 401);
      const type = (u.searchParams.get('type') || 'image').trim();
      const conf = UPLOAD_CONF[type];
      if (!conf) return sendJson(res, { error: '未知的上传类型：' + type }, 400);
      const rel = (u.searchParams.get('name') || '').trim();
      if (!rel) return sendJson(res, { error: '缺少文件名' }, 400);
      const target = path.normalize(path.join(conf.dir, rel));
      if (target !== conf.dir && !target.startsWith(conf.dir + path.sep)) {
        return sendJson(res, { error: '文件名不合法' }, 400);
      }
      try {
        fs.unlinkSync(target);
      } catch (e) {
        return sendJson(res, { error: '删除失败：文件不存在' }, 404);
      }
      logEvent('action', '删除媒体文件', rel);
      return sendJson(res, { ok: true });
    }

    // 页面（记录访客访问）
    if (p === '/robots.txt' || p === '/sitemap.xml') {
      const name = p.slice(1);
      return fs.readFile(path.join(ROOT, name), (err, buf) => {
        if (err) return send(res, 404, 'Not Found');
        send(res, 200, buf, {
          'Content-Type': name.endsWith('.xml') ? 'application/xml; charset=utf-8' : 'text/plain; charset=utf-8',
          'Cache-Control': 'public, max-age=3600'
        });
      });
    }
    if (p === '/') {
      logEvent('visit', '访问网站首页', '');
      return servePage(res, 'index.html', req, { page: 'home' });
    }
    if (p === '/case' || p === '/case.html') {
      const caseId = u.searchParams.get('id') || '';
      const w = (readData().works || []).filter(function (x) { return x.id === caseId; })[0];
      logEvent('visit', '查看作品案例', w ? w.title : caseId);
      return servePage(res, 'case.html', req, { page: 'case', work: w });
    }
    if (p === '/admin' || p === '/admin.html') return servePage(res, 'admin.html', req, { page: 'admin' });
    // 静态资源
    return serveStatic(res, p, req);
  } catch (e) {
    if (e && e.message === 'BODY_TOO_LARGE') return sendJson(res, { error: '请求体过大' }, 413);
    if (e && e.message === 'BAD_JSON') return sendJson(res, { error: '请求数据不是合法 JSON' }, 400);
    console.error('[错误]', e);
    return sendJson(res, { error: '服务器错误，请稍后重试' }, 500);
  }
});

server.requestTimeout = 10 * 60 * 1000;
server.listen(PORT, HOST, () => {
  console.log('==============================================');
  console.log(' 剪辑师个人作品集网站已启动');
  console.log(' 监听地址：http://' + HOST + ':' + PORT);
  if (HOST === '127.0.0.1') console.log(' （仅本机可访问；部署时设置 HOST=0.0.0.0）');
  console.log(' 后台地址：http://' + HOST + ':' + PORT + '/admin');
  console.log(' 管理员密码：请使用 ADMIN_PASSWORD 或首次登录后修改的密码（不会在日志中输出）');
  console.log('==============================================');
});

// 退出前把日志落盘，避免丢失最后几秒记录
['SIGINT', 'SIGTERM'].forEach(function (sig) {
  process.on(sig, function () {
    flushLog();
    process.exit(0);
  });
});
