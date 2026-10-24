const PORT = 9222;
const target = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find(t => t.type === 'page');
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0; const pending = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); } };
const send = (method, params = {}) => new Promise((resolve, reject) => { const mid = ++id; pending.set(mid, { resolve, reject }); ws.send(JSON.stringify({ id: mid, method, params })); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const evalJS = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result.value;
await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await send('Page.navigate', { url: process.argv[2] || 'https://zzjjr.github.io/zjrportfolio/#case=city-morning' });
await sleep(6000);
const data = await evalJS(`(() => {
  const imgs = performance.getEntriesByType('resource').filter(r => r.initiatorType === 'img');
  return {
    count: imgs.length,
    total: imgs.reduce((s, r) => s + (r.decodedBodySize || 0), 0),
    items: imgs.map(r => ({name: r.name.split('/').pop(), size: r.decodedBodySize}))
  };
})()`);
console.log(JSON.stringify(data, null, 2));
ws.close(); process.exit(0);
