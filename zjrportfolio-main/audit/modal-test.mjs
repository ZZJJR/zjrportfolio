const PORT = 9222;
const target = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find(t => t.type === 'page');
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0; const pending = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); } };
const send = (method, params = {}) => new Promise((resolve, reject) => { const mid = ++id; pending.set(mid, { resolve, reject }); ws.send(JSON.stringify({ id: mid, method, params })); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const evalJS = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result.value;
await send('Page.enable'); await send('Runtime.enable');
await send('Page.navigate', { url: process.argv[2] || 'http://127.0.0.1:3200/' });
await sleep(3500);
await evalJS("document.querySelector('#showreel .play-btn').click(); true");
await sleep(500);
console.log(JSON.stringify(await evalJS(`(() => {
  const m = document.getElementById('videoModal');
  return {
    open: m.classList.contains('open'),
    ariaHidden: m.getAttribute('aria-hidden'),
    active: document.activeElement && (document.activeElement.id || document.activeElement.tagName),
    tip: document.getElementById('videoModalTip').textContent,
    hasAdminText: document.body.innerText.includes('登录后台'),
    role: m.getAttribute('role')
  };
})()`), null, 2));
await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
await sleep(200);
console.log('after Tab:', await evalJS("document.activeElement && (document.activeElement.id || document.activeElement.tagName)"));
await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
await sleep(300);
console.log(JSON.stringify(await evalJS(`(() => {
  const m = document.getElementById('videoModal');
  return { open: m.classList.contains('open'), ariaHidden: m.getAttribute('aria-hidden'), active: document.activeElement && (document.activeElement.id || document.activeElement.getAttribute('aria-label') || document.activeElement.tagName) };
})()`), null, 2));
ws.close(); process.exit(0);
