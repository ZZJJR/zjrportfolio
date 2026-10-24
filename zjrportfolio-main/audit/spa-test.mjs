// Verify SPA navigation title and scroll behavior on the live site.
const PORT = 9222;
const target = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find(t => t.type === 'page');
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0;
const pending = new Map();
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const p = pending.get(m.id); pending.delete(m.id);
    m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
  }
};
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const mid = ++id; pending.set(mid, { resolve, reject });
  ws.send(JSON.stringify({ id: mid, method, params }));
});
const sleep = ms => new Promise(r => setTimeout(r, ms));
const evalJS = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result.value;

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await send('Page.navigate', { url: process.argv[2] || 'https://zzjjr.github.io/zjrportfolio/' });
await sleep(4000);

console.log('home title:', await evalJS('document.title'));
await evalJS("location.hash = '#case=city-morning'; true");
await sleep(1200);
console.log('case title:', await evalJS('document.title'));
console.log('case scrollY:', await evalJS('Math.round(scrollY)'));
await evalJS("window.scrollTo(0, document.body.scrollHeight); true");
await sleep(400);
console.log('case bottom scrollY:', await evalJS('Math.round(scrollY)'));
await evalJS("location.hash = '#case=tech-talk'; true");
await sleep(1200);
console.log('case2 title:', await evalJS('document.title'));
console.log('case2 scrollY after nav:', await evalJS('Math.round(scrollY)'));
await evalJS("location.hash = '#/'; true");
await sleep(1200);
console.log('back home title:', await evalJS('document.title'));
console.log('back home scrollY:', await evalJS('Math.round(scrollY)'));
ws.close();
process.exit(0);
