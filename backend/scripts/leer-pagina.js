/**
 * Abre una direccion en Chrome (protocolo de DevTools) y devuelve lo que se le
 * pida del DOM. Sirve para comprobar pantallas sin tocar la base.
 *
 *   chrome.exe --remote-debugging-port=9222
 *   node backend/scripts/leer-pagina.js "<url>" "<expresion javascript>"
 *
 * La expresion se evalua en la pagina y su resultado se imprime en JSON.
 * Ejemplo:
 *   node backend/scripts/leer-pagina.js "http://localhost:3000/verificar/CACE-2026-0001" \
 *     "[...document.querySelectorAll('[data-dato]')].map(e => e.dataset.dato + '=' + e.textContent.trim())"
 */
const CDP = process.env.CDP_URL || 'http://127.0.0.1:9222';
const url = process.argv[2];
const expresion = process.argv[3] || `return document.body.innerText.slice(0, 400);`;
const esperaMs = Number(process.env.ESPERA_MS || 4000);

if (!url) {
  console.error('Falta la direccion. Uso: node leer-pagina.js "<url>" "<expresion>"');
  process.exit(2);
}

(async () => {
  const t = await (await fetch(`${CDP}/json/new?about:blank`, { method: 'PUT' })).json();
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  let id = 0;
  const pendientes = new Map();
  const errores = [];
  const enviar = (method, params = {}) =>
    new Promise((res) => { const i = ++id; pendientes.set(i, (d) => res(d.result ?? d.error)); ws.send(JSON.stringify({ id: i, method, params })); });

  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.method === 'Runtime.exceptionThrown') errores.push(d.params.exceptionDetails?.exception?.description?.split('\n')[0] || 'excepcion');
    if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errores.push('console.error: ' + (d.params.args?.[0]?.value ?? ''));
    if (d.id && pendientes.has(d.id)) { pendientes.get(d.id)(d); pendientes.delete(d.id); }
  };
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

  await enviar('Runtime.enable');
  await enviar('Page.enable');
  await enviar('Page.navigate', { url });
  await new Promise((r) => setTimeout(r, esperaMs));

  const r = await enviar('Runtime.evaluate', { expression: `(() => { ${expresion} })()`, returnByValue: true, awaitPromise: true });
  if (r?.exceptionDetails) console.error('Error al evaluar:', r.exceptionDetails.exception?.description);
  console.log('resultado:', JSON.stringify(r?.result?.value, null, 1));
  console.log('errores de consola:', errores.length ? JSON.stringify(errores.slice(0, 4), null, 1) : 'ninguno');

  try { await fetch(`${CDP}/json/close/${t.id}`, { method: 'PUT' }); } catch {}
  try { ws.close(); } catch {}
  process.exit(0);
})();
