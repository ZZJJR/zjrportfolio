// Minimal CDP driver: navigate, measure layout overflow, collect resources, screenshot.
import fs from 'node:fs';

const PORT = process.env.CDP_PORT || 9222;
const URL_TO_OPEN = process.argv[2] || 'http://127.0.0.1:3100/';
const WIDTH = parseInt(process.argv[3] || '390', 10);
const HEIGHT = parseInt(process.argv[4] || '844', 10);
const OUT = process.argv[5] || 'D:/zjrportfolio-main/audit/cdp-shot.png';

async function getTarget() {
  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  return list.find(t => t.type === 'page');
}

const target = await getTarget();
if (!target) throw new Error('no page target');
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0;
const pending = new Map();
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
  }
};
function send(method, params = {}) {
  const mid = ++id;
  ws.send(JSON.stringify({ id: mid, method, params }));
  return new Promise((resolve, reject) => pending.set(mid, { resolve, reject }));
}

await send('Page.enable');
await send('Runtime.enable');
await send('Network.enable');
if (process.env.NO_JS === '1') {
  await send('Emulation.setScriptExecutionDisabled', { value: true });
}
await send('Emulation.setDeviceMetricsOverride', {
  width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: WIDTH < 800
});
await send('Page.addScriptToEvaluateOnNewDocument', {
  source: `
    window.__lcp = 0;
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) window.__lcp = e.startTime;
    }).observe({type:'largest-contentful-paint', buffered:true});
    window.__cls = 0;
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value;
    }).observe({type:'layout-shift', buffered:true});
  `
});
const logs = [];
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
    logs.push(m.params.args.map(a => a.value ?? a.description).join(' '));
  }
  if (m.method === 'Runtime.exceptionThrown') {
    logs.push('EXC ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
  }
});

await send('Page.navigate', { url: URL_TO_OPEN });
await new Promise(r => setTimeout(r, 3500));

const evalJS = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
};

const metrics = await evalJS(`(() => {
  const d = document.documentElement, b = document.body;
  const over = [];
  document.querySelectorAll('*').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && (r.right > innerWidth + 1 || r.left < -1)) {
      over.push({tag: el.tagName, cls: (el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className) || '', id: el.id || '', left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width)});
    }
  });
  return {
    innerWidth, innerHeight, scrollY: Math.round(window.scrollY),
    clientWidth: d.clientWidth, scrollWidth: d.scrollWidth,
    bodyScrollWidth: b.scrollWidth, bodyClientWidth: b.clientWidth,
    hero: (() => { const e = document.querySelector('.hero-left'); if(!e) return null; const r=e.getBoundingClientRect(); return {left:r.left,right:r.right,width:r.width,computed:getComputedStyle(e).width}; })(),
    nav: (() => { const e = document.querySelector('.nav'); if(!e) return null; const r=e.getBoundingClientRect(); return {left:r.left,right:r.right,width:r.width}; })(),
    navRight: (() => { const e = document.querySelector('.nav-right'); if(!e) return null; const r=e.getBoundingClientRect(); return {left:r.left,right:r.right,width:r.width,display:getComputedStyle(e).display}; })(),
    menuBtn: (() => { const e = document.querySelector('.nav-menu-btn'); if(!e) return null; const r=e.getBoundingClientRect(); return {left:r.left,right:r.right,width:r.width,display:getComputedStyle(e).display}; })(),
    over: over.slice(0, 30),
    overCount: over.length,
    title: document.title,
    meta: {
      description: document.querySelector('meta[name="description"]')?.content || '',
      og: document.querySelectorAll('meta[property^="og:"]').length,
      twitter: document.querySelectorAll('meta[name^="twitter:"]').length,
      canonical: document.querySelector('link[rel="canonical"]')?.href || null,
      jsonld: document.querySelectorAll('script[type="application/ld+json"]').length,
      themeColor: document.querySelector('meta[name="theme-color"]')?.content || null
    },
    bodyTextLength: document.body.innerText.trim().length,
    h1: document.querySelector('h1')?.textContent,
    lcp: window.__lcp || null,
    cls: window.__cls || 0,
    fonts: document.fonts.status,
    imgs: [...document.images].map(i => ({src: i.currentSrc.split('/').slice(-1)[0], attr: (i.getAttribute('src') || '').split('/').slice(-1)[0], loading: i.loading, top: Math.round(i.getBoundingClientRect().top), w: i.naturalWidth, h: i.naturalHeight, complete: i.complete})),
    resources: performance.getEntriesByType('resource').map(r => ({name: r.name.split('/').slice(-1)[0], type: r.initiatorType, transfer: r.transferSize, decoded: r.decodedBodySize, dur: Math.round(r.duration)})),
    navEntries: performance.getEntriesByType('navigation').map(n => ({domContentLoaded: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd), transfer: n.transferSize, decoded: n.decodedBodySize})),
    caseRight: (() => { const e = document.querySelector('.case-col-right'); return e ? {html: e.innerHTML.slice(0, 300), tech: e.querySelectorAll('.tech-item').length, tools: e.querySelectorAll('.tools-block').length, h: Math.round(e.getBoundingClientRect().height)} : null; })(),
    caseLeft: (() => { const e = document.querySelector('.case-col-left'); return e ? {info: e.querySelectorAll('.case-info-card').length, html: e.innerHTML.slice(0, 200), h: Math.round(e.getBoundingClientRect().height)} : null; })(),
    reveals: (() => { const all = document.querySelectorAll('.reveal'); let hidden = 0; all.forEach(e => { const s = getComputedStyle(e); if (parseFloat(s.opacity) < 0.5) hidden++; }); return {total: all.length, hidden}; })(),
    playerPoster: (() => { const e = document.querySelector('#playerPoster'); return e ? {src: e.getAttribute('src'), complete: e.complete, nw: e.naturalWidth} : null; })()
  };
})()`);

await send('Emulation.setDeviceMetricsOverride', {
  width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: WIDTH < 800
});
if (process.env.FORCE_REVEAL === '1') {
  await evalJS(`(() => { const s = document.createElement('style'); s.textContent = '.reveal{opacity:1!important;transform:none!important}'; document.head.appendChild(s); document.querySelectorAll('.reveal').forEach(e=>e.classList.add('in')); return true; })()`);
  await new Promise(r => setTimeout(r, 1000));
}
if (process.env.FORCE_EAGER === '1') {
  const fullHeight = await evalJS('document.body.scrollHeight');
  for (let y = 0; y < fullHeight; y += 600) {
    await evalJS(`window.scrollTo(0, ${y}); true`);
    await new Promise(r => setTimeout(r, 120));
  }
  await evalJS('document.documentElement.style.scrollBehavior = "auto"; window.scrollTo(0, 0); true');
  await new Promise(r => setTimeout(r, 500));
}
const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: process.env.NO_BEYOND !== '1' });
fs.writeFileSync(OUT, Buffer.from(shot.data, 'base64'));

console.log(JSON.stringify({ metrics, logs }, null, 2));
ws.close();
process.exit(0);
