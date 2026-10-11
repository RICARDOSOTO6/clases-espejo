/**
 * Comprueba en el navegador el rediseno de la pantalla del certificado.
 * Solo navega y mide: no toca la base.
 *
 *   chrome.exe --remote-debugging-port=9222
 *   node backend/scripts/revisar-diseno-certificado.js
 */
const APP = process.env.APP_URL || 'http://localhost:3000';
const CDP = process.env.CDP_URL || 'http://127.0.0.1:9222';
const PRESIDENTE = { correo: 'antiniosotobeh@gmail.com', password: process.env.CACE_PASSWORD || 'CaceDemo2026!' };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

let ws, id = 0;
const pendientes = new Map();
const errores = [];

function enviar(method, params = {}) {
  return new Promise((res) => { const i = ++id; pendientes.set(i, (d) => res(d.result ?? d.error)); ws.send(JSON.stringify({ id: i, method, params })); });
}
async function evaluar(expresion) {
  const r = await enviar('Runtime.evaluate', { expression: `(() => { ${expresion} })()`, returnByValue: true, awaitPromise: true });
  if (r?.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'error al evaluar');
  return r?.result?.value;
}
const informe = [];
const anotar = (nombre, ok, detalle) => { informe.push({ nombre, estado: ok ? 'OK' : 'FALLA' }); console.log(`${ok ? 'OK   ' : 'FALLA'} ${nombre}${detalle ? '  · ' + detalle : ''}`); };

(async () => {
  const r = await fetch(`${CDP}/json/new?about:blank`, { method: 'PUT' });
  ws = new WebSocket((await r.json()).webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.method === 'Runtime.exceptionThrown') errores.push(d.params.exceptionDetails?.exception?.description || 'excepcion');
    if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errores.push('console.error');
    if (d.id && pendientes.has(d.id)) { pendientes.get(d.id)(d); pendientes.delete(d.id); }
  };
  await enviar('Runtime.enable'); await enviar('Page.enable');

  await enviar('Page.navigate', { url: `${APP}/login` }); await espera(2200);
  await evaluar(`
    const set = (e, v) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(e, v); e.dispatchEvent(new Event('input', { bubbles: true })); };
    set(document.querySelector('#correo'), ${JSON.stringify(PRESIDENTE.correo)});
    set(document.querySelector('#password'), ${JSON.stringify(PRESIDENTE.password)});
    const f = document.querySelector('#correo').closest('form'); f.requestSubmit();
    return true;
  `);
  await espera(4500);
  await evaluar(`
    const e = [...document.querySelectorAll('.sidebar-link, a, button')].find((n) => /certificado/i.test(n.textContent || ''));
    if (e) e.click(); return !!e;
  `);
  await espera(3000);
  const ruta = await evaluar(`return location.pathname;`);
  anotar('entra como presidente y abre la pantalla', ruta.startsWith('/cace'), `${ruta}`);

  // --- 1. Tres columnas y el lienzo al 60-70 % ---
  const cols = await evaluar(`
    const c = [...document.querySelectorAll('[data-columna]')].map((e) => e.dataset.columna);
    const ed = document.querySelector('[data-columna="editor"]');
    const total = document.querySelector('[data-columna="editor"]')?.parentElement?.getBoundingClientRect().width || 0;
    return { c, anchoEditor: ed ? Math.round(ed.getBoundingClientRect().width) : 0, total: Math.round(total), pct: total ? +((ed.getBoundingClientRect().width / total) * 100).toFixed(1) : 0 };
  `);
  anotar('hay tres columnas (herramientas, editor, propiedades)',
    ['herramientas', 'editor', 'propiedades'].every((n) => cols.c.includes(n)), cols.c.join(', '));
  anotar('la columna del lienzo ocupa entre el 55 % y el 72 %', cols.pct >= 55 && cols.pct <= 72, `${cols.pct} % (${cols.anchoEditor} de ${cols.total} px)`);

  // --- 2. Mesa gris y hoja con sombra ---
  const mesa = await evaluar(`
    const l = document.querySelector('[data-lienzo]');
    const cont = l ? l.parentElement : null;
    const cs = l ? getComputedStyle(l) : null;
    const cc = cont ? getComputedStyle(cont) : null;
    return { fondoMesa: cc?.backgroundColor, sombra: cs?.boxShadow?.slice(0, 60), fondoHoja: cs?.backgroundColor };
  `);
  anotar('la mesa es gris claro', /rgb\(243, 244, 246\)|rgb\(11, 18, 32\)/.test(mesa.fondoMesa || ''), mesa.fondoMesa);
  anotar('la hoja tiene sombra', !!mesa.sombra && mesa.sombra !== 'none', mesa.sombra);

  // --- 3. La ayuda esta plegada por defecto ---
  const ayuda = await evaluar(`
    const a = document.querySelector('[data-ayuda]');
    return a ? { abierto: a.dataset.abierto, visible: a.getBoundingClientRect().height > 20 } : null;
  `);
  anotar('el bloque de ayuda existe y esta cerrado al entrar', !!ayuda && ayuda.abierto === 'false', JSON.stringify(ayuda));

  // --- 4. Botones con jerarquia ---
  const botones = await evaluar(`
    return [...document.querySelectorAll('[data-accion][data-peso]')].map((b) => {
      const cs = getComputedStyle(b);
      return { accion: b.dataset.accion, peso: b.dataset.peso, fondo: cs.backgroundColor, color: cs.color, borde: cs.borderTopColor, bordeAncho: cs.borderTopWidth };
    });
  `);
  const primarios = botones.filter((b) => b.peso === 'primario');
  const secundarios = botones.filter((b) => b.peso === 'secundario');
  anotar('hay botones primarios y secundarios', primarios.length > 0 && secundarios.length > 0,
    `${primarios.length} primarios (${primarios.map((b) => b.accion).join(', ')}) y ${secundarios.length} secundarios`);
  anotar('el primario es solido y el secundario claro',
    primarios.every((b) => !/rgba\(0, 0, 0, 0\)|transparent/.test(b.fondo)) && secundarios.every((b) => b.bordeAncho !== '0px'),
    `primario fondo ${primarios[0]?.fondo} · secundario borde ${secundarios[0]?.bordeAncho} ${secundarios[0]?.borde}`);

  // --- 5. Salud del diseno y huecos ---
  const salud = await evaluar(`
    const s = document.querySelector('[data-salud]');
    return s ? { graves: s.dataset.graves, avisos: s.dataset.avisos, marcas: s.querySelectorAll('[data-estado-item], .salud-item, li').length } : null;
  `);
  anotar('el panel de salud del diseno esta', !!salud, JSON.stringify(salud));

  const huecos = await evaluar(`
    return [...document.querySelectorAll('[data-campo]')].map((e) => {
      const cs = getComputedStyle(e);
      return { campo: e.dataset.campo, radio: cs.borderTopLeftRadius, borde: cs.borderTopWidth, fondo: cs.backgroundColor };
    });
  `);
  anotar('los tres huecos estan y con esquinas redondeadas y borde grueso',
    huecos.length === 3 && huecos.every((h) => parseFloat(h.radio) >= 4 && parseFloat(h.borde) >= 2),
    huecos.map((h) => `${h.campo}: radio ${h.radio}, borde ${h.borde}`).join(' | '));

  // --- 6. Zoom flotante ---
  const zoom = await evaluar(`return { mas: !!document.querySelector('[data-zoom="mas"]'), menos: !!document.querySelector('[data-zoom="menos"]') };`);
  anotar('hay controles de zoom (+ / -)', zoom.mas && zoom.menos, JSON.stringify(zoom));

  // --- 7. Tabla de versiones ---
  const versiones = await evaluar(`
    const filas = [...document.querySelectorAll('[data-version]')];
    const cabeceras = filas[0] ? [...filas[0].closest('table').querySelectorAll('th')].map((t) => (t.textContent || '').trim()) : [];
    return { filas: filas.length, estados: filas.map((f) => f.dataset.estado), cabeceras };
  `);
  anotar('las versiones son una tabla con estado', versiones.filas > 0 && versiones.cabeceras.length >= 3,
    `${versiones.filas} filas · columnas: ${versiones.cabeceras.join(' | ')} · estados: ${versiones.estados.join(', ')}`);
  anotar('nada de "Creada por" repetido en cada fila',
    await evaluar(`return ![...document.querySelectorAll('[data-version]')].some((f) => /creada por/i.test((f.textContent || '').replace(/\\s+/g, ' ')));`), '');

  // --- 8. Los dos botones de descarga siguen ---
  const descargas = await evaluar(`return { zonas: !!document.querySelector('[data-accion="descargar-zonas"]'), guia: !!document.querySelector('[data-accion="descargar-guia"]') };`);
  anotar('los dos botones de descarga siguen', descargas.zonas && descargas.guia, JSON.stringify(descargas));

  const cap = await enviar('Page.captureScreenshot', { format: 'png' });
  if (cap?.data) {
    require('fs').mkdirSync('backend/scripts/_capturas', { recursive: true });
    require('fs').writeFileSync('backend/scripts/_capturas/diseno-certificado.png', Buffer.from(cap.data, 'base64'));
    console.log('     captura en backend/scripts/_capturas/diseno-certificado.png');
  }
  anotar('sin errores en la consola', errores.length === 0, errores.slice(0, 2).join(' | ') || 'ninguno');

  const fallas = informe.filter((i) => i.estado === 'FALLA').length;
  console.log(`\n${informe.length - fallas}/${informe.length} comprobaciones OK`);
  try { ws.close(); } catch {}
  process.exit(fallas ? 1 : 0);
})().catch((e) => { console.error('FALLO EL GUION:', e.message); process.exit(1); });
