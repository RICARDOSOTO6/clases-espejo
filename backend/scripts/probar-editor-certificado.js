/**
 * Prueba del editor visual de la plantilla del certificado, manejando Chrome
 * por el protocolo de DevTools. Solo navega y pulsa: no toca la base.
 *
 *   chrome.exe --remote-debugging-port=9222
 *   node backend/scripts/probar-editor-certificado.js
 */
const APP = process.env.APP_URL || 'http://localhost:3000';
const CDP = process.env.CDP_URL || 'http://127.0.0.1:9222';
const PRESIDENTE = { correo: 'antiniosotobeh@gmail.com', password: process.env.CACE_PASSWORD || 'CaceDemo2026!' };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

let ws, id = 0, pendientes = new Map();
const errores = [];

async function abrirPestana() {
  const r = await fetch(`${CDP}/json/new?about:blank`, { method: 'PUT' });
  const t = await r.json();
  ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.method === 'Runtime.exceptionThrown') errores.push(d.params.exceptionDetails?.exception?.description || 'excepcion');
    if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errores.push('console.error');
    if (d.id && pendientes.has(d.id)) { pendientes.get(d.id)(d); pendientes.delete(d.id); }
  };
  enviar('Runtime.enable'); enviar('Page.enable');
}

function enviar(method, params = {}) {
  return new Promise((res) => {
    const i = ++id;
    pendientes.set(i, (d) => res(d.result ?? d.error));
    ws.send(JSON.stringify({ id: i, method, params }));
  });
}

async function evaluar(expresion) {
  const r = await enviar('Runtime.evaluate', { expression: `(() => { ${expresion} })()`, returnByValue: true, awaitPromise: true });
  if (r?.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'error al evaluar');
  return r?.result?.value;
}

async function ir(url, ms = 2500) {
  await enviar('Page.navigate', { url });
  await espera(ms);
}

/** Clic real en un punto de la pantalla. */
async function raton(x, y, tipo, extra = {}) {
  await enviar('Input.dispatchMouseEvent', { type: tipo, x, y, button: 'left', buttons: tipo === 'mouseReleased' ? 0 : 1, clickCount: 1, ...extra });
}

async function centro(selector) {
  return evaluar(`
    const e = document.querySelector(${JSON.stringify(selector)});
    if (!e) return null;
    const r = e.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), ancho: Math.round(r.width), alto: Math.round(r.height) };
  `);
}

async function arrastrar(desde, dx, dy) {
  await raton(desde.x, desde.y, 'mousePressed');
  await espera(120);
  await raton(desde.x + dx / 2, desde.y + dy / 2, 'mouseMoved');
  await espera(120);
  await raton(desde.x + dx, desde.y + dy, 'mouseMoved');
  await espera(120);
  await raton(desde.x + dx, desde.y + dy, 'mouseReleased');
  await espera(500);
}

const informe = [];
const anotar = (nombre, ok, detalle) => {
  informe.push({ nombre, estado: ok ? 'OK' : 'FALLA', detalle });
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${nombre}${detalle ? '  · ' + detalle : ''}`);
};

(async () => {
  await abrirPestana();

  // --- entrar como presidente (por el formulario, como un usuario) ---
  await ir(`${APP}/login`, 2000);
  const camposLogin = await evaluar(`
    return {
      entradas: [...document.querySelectorAll('input')].map((i) => i.id || i.name || i.type),
      botones: [...document.querySelectorAll('button')].map((b) => (b.textContent || '').trim().slice(0, 24)),
    };
  `);
  console.log('     formulario de acceso:', JSON.stringify(camposLogin));
  await evaluar(`
    const correo = document.querySelector('#correo, input[type="email"], input[name="correo"]');
    const clave = document.querySelector('#password, input[type="password"]');
    if (!correo || !clave) return 'faltan campos';
    const set = (e, v) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(e, v);
      e.dispatchEvent(new Event('input', { bubbles: true }));
      e.dispatchEvent(new Event('change', { bubbles: true }));
    };
    set(correo, ${JSON.stringify(PRESIDENTE.correo)});
    set(clave, ${JSON.stringify(PRESIDENTE.password)});
    const form = correo.closest('form');
    if (form && form.requestSubmit) form.requestSubmit();
    else if (form) form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    else (document.querySelector('button[type="submit"]') || document.querySelector('button')).click();
    return 'enviado';
  `);
  await espera(4500);
  const enCace = await evaluar(`return location.pathname;`);
  if (!enCace || !enCace.startsWith('/cace')) {
    const aviso = await evaluar(`const a = document.querySelector('.error, .mensaje-error, [role="alert"], .alerta'); return a ? (a.textContent || '').trim().slice(0, 160) : '(sin mensaje en pantalla)';`);
    console.log('     mensaje de la pantalla:', aviso);
  }
  anotar('entra como presidente', enCace && enCace.startsWith('/cace'), `quedo en ${enCace}`);

  // --- abrir la seccion de la plantilla ---
  let hay = await evaluar(`return !!document.querySelector('[data-lienzo]');`);
  if (!hay) {
    await evaluar(`
      const enlaces = [...document.querySelectorAll('.sidebar-link, a, button')];
      const e = enlaces.find((n) => /certificado|plantilla/i.test(n.textContent || ''));
      if (e) e.click();
      return !!e;
    `);
    await espera(2500);
    hay = await evaluar(`return !!document.querySelector('[data-lienzo]');`);
  }
  anotar('el lienzo del editor aparece', hay, hay ? '' : 'no se encontro [data-lienzo]');
  if (!hay) { await cerrar(); return; }

  const lienzo = await evaluar(`
    const l = document.querySelector('[data-lienzo]');
    const r = l.getBoundingClientRect();
    return { anchoPx: l.dataset.anchoPx, altoPx: l.dataset.altoPx, ancho: Math.round(r.width), alto: Math.round(r.height), proporcion: +(r.width / r.height).toFixed(3) };
  `);
  anotar('el lienzo tiene la proporcion del certificado (A4 horizontal)', Math.abs(lienzo.proporcion - 1.414) < 0.06,
    `${lienzo.ancho}x${lienzo.alto} en pantalla · ${lienzo.anchoPx}x${lienzo.altoPx} px reales · proporcion ${lienzo.proporcion}`);

  const campos = await evaluar(`return [...document.querySelectorAll('[data-campo]')].map((c) => c.dataset.campo);`);
  anotar('estan los campos de datos', campos.length >= 5, campos.join(', '));

  // --- arrastrar el nombre ---
  const antes = await evaluar(`
    const c = document.querySelector('[data-campo="nombre"]');
    return { x: +c.dataset.x, y: +c.dataset.y, ancho: +c.dataset.ancho, alto: +c.dataset.alto };
  `);
  let caja = await centro('[data-campo="nombre"]');
  await arrastrar({ x: caja.x, y: caja.y }, 80, 40);
  const despues = await evaluar(`
    const c = document.querySelector('[data-campo="nombre"]');
    return { x: +c.dataset.x, y: +c.dataset.y };
  `);
  anotar('el campo se arrastra con el raton', despues.x !== antes.x || despues.y !== antes.y,
    `de (${antes.x}, ${antes.y}) a (${despues.x}, ${despues.y})`);

  // --- deshacer ---
  await evaluar(`document.querySelector('[data-accion="deshacer"]')?.click(); return true;`);
  await espera(600);
  const deshecho = await evaluar(`
    const c = document.querySelector('[data-campo="nombre"]');
    return { x: +c.dataset.x, y: +c.dataset.y };
  `);
  anotar('deshacer devuelve el campo a su sitio', deshecho.x === antes.x && deshecho.y === antes.y,
    `(${deshecho.x}, ${deshecho.y}) frente a (${antes.x}, ${antes.y})`);

  // --- alejar el campo hasta que no quepa (problema grave) ---
  await evaluar(`
    const c = document.querySelector('[data-campo="nombre"]');
    c.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 1, clientY: 1 }));
    return true;
  `);
  await espera(300);
  const problemas = await evaluar(`
    const p = document.querySelector('[data-problemas]');
    return p ? { texto: (p.textContent || '').trim().slice(0, 220), graves: p.dataset.graves, avisos: p.dataset.avisos } : null;
  `);
  anotar('la lista de problemas esta a la vista', !!problemas, problemas ? `graves=${problemas.graves} avisos=${problemas.avisos}` : 'no hay [data-problemas]');

  const botones = await evaluar(`return [...document.querySelectorAll('[data-accion]')].map((b) => b.dataset.accion);`);
  anotar('la barra de herramientas tiene sus botones',
    ['deshacer', 'rehacer', 'zoom-ajustar', 'restaurar', 'guardar'].every((a) => botones.includes(a)), botones.join(', '));

  const guardarBloqueado = await evaluar(`
    const b = document.querySelector('[data-accion="guardar"]');
    return b ? { deshabilitado: !!b.disabled || b.getAttribute('aria-disabled') === 'true' } : null;
  `);
  anotar('el boton de guardar responde', !!guardarBloqueado, `deshabilitado=${guardarBloqueado?.deshabilitado}`);

  // --- captura ---
  const cap = await enviar('Page.captureScreenshot', { format: 'png' });
  if (cap?.data) {
    const fs = require('fs');
    fs.mkdirSync('backend/scripts/_capturas', { recursive: true });
    fs.writeFileSync('backend/scripts/_capturas/editor-certificado.png', Buffer.from(cap.data, 'base64'));
    console.log('     captura en backend/scripts/_capturas/editor-certificado.png');
  }

  anotar('sin errores en la consola', errores.length === 0, errores.slice(0, 3).join(' | ') || 'ninguno');
  const fallas = informe.filter((i) => i.estado === 'FALLA').length;
  console.log(`\n${informe.length - fallas}/${informe.length} comprobaciones OK`);
  await cerrar();
})().catch(async (e) => { console.error('FALLO EL GUION:', e.message); await cerrar(); process.exit(1); });

async function cerrar() {
  try { await fetch(`${CDP}/json/close/${(await (await fetch(`${CDP}/json/list`)).json()).find((t) => t.type === 'page')?.id}`, { method: 'PUT' }); } catch {}
  try { ws.close(); } catch {}
  process.exit(informe.some((i) => i.estado === 'FALLA') ? 1 : 0);
}
