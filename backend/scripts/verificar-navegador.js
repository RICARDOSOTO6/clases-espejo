#!/usr/bin/env node
/**
 * verificar-navegador.js — verificación de las pantallas en un Chrome real.
 *
 * Lo ejecuta una persona (no forma parte de la aplicación): se conecta a un
 * Chrome ya abierto con el puerto de depuración activo, entra con los usuarios
 * de demostración, recorre las pantallas y comprueba con medidas reales del DOM
 * lo que a simple vista cuesta ver (desbordes, botones fuera de su tarjeta,
 * contraste de un botón, columnas desequilibradas…). Deja una captura por
 * pantalla y un informe legible + JSON.
 *
 * **No modifica la base de datos**: solo navega, lee el DOM, pulsa botones de
 * interfaz (abrir un desplegable, abrir un reporte plegado) y hace capturas.
 * Tampoco levanta ningún servidor: usa el que ya está corriendo.
 *
 * Antes de ejecutarlo hacen falta dos cosas:
 *
 *   1. La aplicación en marcha:            http://localhost:3000
 *   2. Chrome con el puerto de depuración:
 *      chrome.exe --remote-debugging-port=9222
 *
 * Uso:
 *   node scripts/verificar-navegador.js
 *
 * Variables de entorno opcionales:
 *   APP_URL        (por defecto http://localhost:3000)
 *   CDP_URL        (por defecto http://127.0.0.1:9222)
 *   PROYECTO_ID    (por defecto 17: la clase espejo que se inspecciona)
 *   CACE_PASSWORD  contraseña del presidente de la CACE (si se conoce)
 *
 * Códigos de salida: 0 si no hay ninguna FALLA, 1 si hay alguna (o si no se
 * pudo conectar con Chrome). Los AVISO son comprobaciones que no se pudieron
 * hacer (por ejemplo, la contraseña del presidente, que el guion no conoce).
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

// --- Configuración ---------------------------------------------------------

const CDP = (process.env.CDP_URL ?? 'http://127.0.0.1:9222').replace(/\/+$/, '');
const APP = (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
const PASSWORD_DEMO = process.env.PASSWORD_DEMO ?? 'Demo1234';
/** Contraseña del presidente: no se conoce, así que se admite por entorno. */
const PASSWORD_CACE = process.env.CACE_PASSWORD ?? PASSWORD_DEMO;
const PROYECTO = Number(process.env.PROYECTO_ID ?? 17);
const CARPETA_CAPTURAS = path.join(__dirname, '_capturas');
const ARCHIVO_JSON = path.join(CARPETA_CAPTURAS, 'informe-verificacion.json');

const DOCENTES = [
  'sofia.gomez@clasesespejo.mx',
  'isabella.cardenas@clasesespejo.co',
];
const AGENTES = [
  'agente.calkini@clasesespejo.mx',
  'agente.colombia@clasesespejo.co',
];
const PRESIDENTE = 'antiniosotobeh@gmail.com';
/** Instituciones sembradas por `seed-demo.js`; la sección debe listarlas todas. */
const INSTITUCIONES_ESPERADAS = 2;

/** Ventana de escritorio: es donde la clase espejo se pinta en dos columnas. */
const ANCHO = 1440;
const ALTO = 900;
const ESPERA = 15000;
/** Diferencia máxima admitida entre las dos columnas de la clase espejo. */
const TOLERANCIA_COLUMNAS = 150;
/** Contraste mínimo del texto de un botón sobre su fondo (WCAG AA, texto normal). */
const CONTRASTE_MINIMO = 4.5;

// --- Registro de comprobaciones -------------------------------------------

const informe = {
  app: APP,
  cdp: CDP,
  proyecto: PROYECTO,
  inicio: null,
  fin: null,
  comprobaciones: [],
  capturas: [],
  avisosConsola: [],
  resumen: { ok: 0, falla: 0, aviso: 0 },
};

function anotar(pantalla, nombre, estado, detalle) {
  informe.comprobaciones.push({
    pantalla,
    nombre,
    estado,
    detalle: String(detalle ?? ''),
  });
  informe.resumen[estado === 'OK' ? 'ok' : estado === 'FALLA' ? 'falla' : 'aviso'] += 1;
}

/** Comprueba una condición: OK si se cumple, FALLA si no. */
function comprobar(pantalla, nombre, condicion, detalle) {
  anotar(pantalla, nombre, condicion ? 'OK' : 'FALLA', detalle);
  return !!condicion;
}

/** No se pudo comprobar (no es un fallo de la aplicación). */
function avisar(pantalla, nombre, detalle) {
  anotar(pantalla, nombre, 'AVISO', detalle);
}

const pausa = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** La captura del acceso se hace una sola vez, antes del primer login. */
let capturoLogin = false;

/** Una línea de texto; los detalles vacíos no se muestran. */
function describir(partes) {
  return partes.filter((p) => p !== undefined && p !== null && p !== '').join(' · ');
}

// --- Sesión de DevTools ----------------------------------------------------

/**
 * Ayudas que se instalan **dentro de la página** (se pierden al navegar, así que
 * se reinstalan tras cada navegación). Sirven para calcular el contraste de un
 * color contra su fondo real, subiendo por los ancestros hasta encontrar uno
 * opaco.
 */
const AYUDAS_PAGINA = `
window.__verif = {
  rgb: function (color) {
    if (!color || color.indexOf('(') < 0) return { r: 0, g: 0, b: 0, a: 0 };
    var dentro = color.slice(color.indexOf('(') + 1, color.indexOf(')'));
    var n = dentro.split(',').map(function (v) { return parseFloat(v); });
    return { r: n[0] || 0, g: n[1] || 0, b: n[2] || 0, a: n.length > 3 ? n[3] : 1 };
  },
  luminancia: function (color) {
    var c = window.__verif.rgb(color);
    var f = function (v) {
      var x = v / 255;
      return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  },
  contraste: function (a, b) {
    var l1 = window.__verif.luminancia(a);
    var l2 = window.__verif.luminancia(b);
    var alto = Math.max(l1, l2);
    var bajo = Math.min(l1, l2);
    return Math.round(((alto + 0.05) / (bajo + 0.05)) * 100) / 100;
  },
  fondoDe: function (el) {
    var nodo = el;
    while (nodo && nodo.nodeType === 1) {
      var color = getComputedStyle(nodo).backgroundColor;
      if (color && color !== 'transparent' && window.__verif.rgb(color).a > 0) return color;
      nodo = nodo.parentElement;
    }
    return 'rgb(255, 255, 255)';
  }
};
true;
`;

class Sesion {
  constructor(destino) {
    this.id = destino.id;
    this.ws = new WebSocket(destino.webSocketDebuggerUrl);
    this.contador = 1;
    this.pendientes = new Map();
    /** Excepciones y console.error: son las que hacen FALLA. */
    this.errores = [];
    /** Errores de red o de recursos (Log): informativos, no hacen FALLA. */
    this.ruido = [];
    this.listo = new Promise((resolve, reject) => {
      const fallo = () =>
        reject(
          new Error(
            'No se pudo abrir el canal de DevTools (¿Chrome con --remote-debugging-port=9222?)',
          ),
        );
      this.ws.addEventListener('open', () => resolve());
      this.ws.addEventListener('error', fallo);
    });
    this.ws.addEventListener('message', (evento) => this.alMensaje(evento));
  }

  /** Abre una pestaña nueva y devuelve la sesión conectada a ella. */
  static async abrir() {
    let respuesta = await fetch(`${CDP}/json/new?about:blank`, { method: 'PUT' });
    if (!respuesta.ok) {
      // Chromium antiguo quiere GET en lugar de PUT.
      respuesta = await fetch(`${CDP}/json/new?about:blank`);
    }
    if (!respuesta.ok) {
      throw new Error(`No se pudo abrir una pestaña en ${CDP} (HTTP ${respuesta.status})`);
    }
    const destino = await respuesta.json();
    if (!destino.webSocketDebuggerUrl) {
      throw new Error('La pestaña abierta no expone webSocketDebuggerUrl');
    }
    const sesion = new Sesion(destino);
    await sesion.listo;
    return sesion;
  }

  alMensaje(evento) {
    let mensaje;
    try {
      mensaje = JSON.parse(evento.data);
    } catch {
      return;
    }

    if (mensaje.id && this.pendientes.has(mensaje.id)) {
      const { resolver, rechazar } = this.pendientes.get(mensaje.id);
      this.pendientes.delete(mensaje.id);
      if (mensaje.error) rechazar(new Error(`${mensaje.error.message} (${mensaje.error.code})`));
      else resolver(mensaje.result);
      return;
    }

    if (mensaje.method === 'Runtime.exceptionThrown') {
      const detalles = mensaje.params.exceptionDetails ?? {};
      this.errores.push(
        `excepción: ${detalles.exception?.description ?? detalles.text ?? 'sin detalle'}`,
      );
      return;
    }

    if (mensaje.method === 'Runtime.consoleAPICalled' && mensaje.params.type === 'error') {
      const texto = (mensaje.params.args ?? [])
        .map((a) => a.value ?? a.description ?? a.type)
        .join(' ');
      this.errores.push(`console.error: ${texto}`);
      return;
    }

    if (mensaje.method === 'Log.entryAdded') {
      const entrada = mensaje.params.entry ?? {};
      if (entrada.level === 'error') {
        this.ruido.push(`${entrada.source}: ${entrada.text}`);
      }
    }
  }

  /** Envía un comando del protocolo y espera su respuesta. */
  async enviar(metodo, parametros = {}, tiempoMaximo = 20000) {
    const id = this.contador++;
    const promesa = new Promise((resolver, rechazar) => {
      this.pendientes.set(id, { resolver, rechazar });
    });
    this.ws.send(JSON.stringify({ id, method: metodo, params: parametros }));

    let reloj;
    const expirado = new Promise((_, rechazar) => {
      reloj = setTimeout(
        () => rechazar(new Error(`El comando ${metodo} no respondió en ${tiempoMaximo} ms`)),
        tiempoMaximo,
      );
    });

    try {
      return await Promise.race([promesa, expirado]);
    } finally {
      clearTimeout(reloj);
      this.pendientes.delete(id);
    }
  }

  /** Prepara la pestaña: dominios, tamaño de ventana y ayudas de la página. */
  async configurar() {
    await this.enviar('Runtime.enable');
    await this.enviar('Page.enable');
    await this.enviar('Log.enable');
    await this.enviar('Emulation.setDeviceMetricsOverride', {
      width: ANCHO,
      height: ALTO,
      deviceScaleFactor: 1,
      mobile: false,
    });
  }

  /** Evalúa una expresión en la página y devuelve el valor ya deserializado. */
  async evaluar(expresion, { awaitPromise = true } = {}) {
    const resultado = await this.enviar('Runtime.evaluate', {
      expression: expresion,
      returnByValue: true,
      awaitPromise,
      userGesture: true,
    });
    if (resultado.exceptionDetails) {
      const detalles = resultado.exceptionDetails;
      throw new Error(
        `La página lanzó un error al evaluar: ${
          detalles.exception?.description ?? detalles.text
        }`,
      );
    }
    return resultado.result?.value;
  }

  /** Inserta las ayudas de cálculo (se pierden al navegar). */
  async instalarAyudas() {
    await this.evaluar(AYUDAS_PAGINA);
  }

  /** Espera a que la expresión devuelva algo distinto de null/false. */
  async esperarValor(expresion, opciones = {}) {
    const {
      tiempoMaximo = ESPERA,
      intervalo = 150,
      descripcion = 'la condición',
    } = opciones;
    const limite = Date.now() + tiempoMaximo;
    let ultimoError = null;

    while (Date.now() < limite) {
      try {
        const valor = await this.evaluar(expresion);
        if (valor !== null && valor !== undefined && valor !== false) return valor;
      } catch (error) {
        // La navegación destruye el contexto de ejecución: se reintenta.
        ultimoError = error;
      }
      await pausa(intervalo);
    }
    throw new Error(
      `Se agotó el tiempo esperando ${descripcion}${
        ultimoError ? ` (${ultimoError.message})` : ''
      }`,
    );
  }

  /** Navega y espera a que la página esté cargada de verdad. */
  async ir(url) {
    const esperada = url.replace(/\/+$/, '') || '/';
    await this.enviar('Page.navigate', { url });
    await this.esperarValor(
      `location.origin + location.pathname === ${JSON.stringify(esperada)} && document.readyState === 'complete'`,
      { descripcion: `que cargue ${url}` },
    );
    await pausa(300);
    await this.instalarAyudas();
  }

  /** Escribe en un campo como lo haría una persona (setter nativo + input). */
  async escribir(selector, texto) {
    const escrito = await this.evaluar(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return false;
      const prototipo = el instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
      const descriptor = Object.getOwnPropertyDescriptor(prototipo, 'value');
      descriptor.set.call(el, ${JSON.stringify(texto)});
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return el.value === ${JSON.stringify(texto)};
    })()`);
    if (!escrito) throw new Error(`No se pudo escribir en ${selector}`);
  }

  /** Pulsa con el ratón de verdad (Input.dispatchMouseEvent) sobre un elemento. */
  async clic(selector) {
    const punto = await this.evaluar(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return null;
      el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return null;
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })()`);
    if (!punto) throw new Error(`No se encontró el elemento que hay que pulsar: ${selector}`);

    const base = { x: punto.x, y: punto.y };
    await this.enviar('Input.dispatchMouseEvent', { type: 'mouseMoved', ...base, button: 'none' });
    await this.enviar('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      ...base,
      button: 'left',
      clickCount: 1,
    });
    await this.enviar('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      ...base,
      button: 'left',
      clickCount: 1,
    });
    return punto;
  }

  /** Guarda una captura en `_capturas/`. */
  async captura(nombre) {
    const { data } = await this.enviar('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false,
    });
    const destino = path.join(CARPETA_CAPTURAS, nombre);
    fs.writeFileSync(destino, Buffer.from(data, 'base64'));
    informe.capturas.push(destino);
    return destino;
  }

  /** Marca de posición en los registros de consola. */
  marca() {
    return { errores: this.errores.length, ruido: this.ruido.length };
  }

  /** Lo que se ha registrado en la consola desde una marca. */
  desde(marca) {
    return {
      errores: this.errores.slice(marca.errores),
      ruido: this.ruido.slice(marca.ruido),
    };
  }

  async cerrar() {
    try {
      this.ws.close();
    } catch {
      /* ya estaba cerrado */
    }
    try {
      await fetch(`${CDP}/json/close/${this.id}`);
    } catch {
      /* la pestaña ya no existe */
    }
  }
}

// --- Comprobaciones compartidas -------------------------------------------

/** Consola limpia y, si procede, el esqueleto dibujado. */
async function revisarPantalla(sesion, pantalla, marca, { layout = true } = {}) {
  const { errores, ruido } = sesion.desde(marca);
  comprobar(
    pantalla,
    'sin errores en la consola (excepciones y console.error)',
    errores.length === 0,
    errores.length ? errores.join(' | ') : 'ninguno',
  );
  if (ruido.length > 0) {
    informe.avisosConsola.push({ pantalla, entradas: ruido });
  }

  if (!layout) return;

  const dibujo = await sesion.evaluar(`(() => {
    const esqueleto = document.querySelector('app-layout');
    const barra = document.querySelector('.navbar');
    const marca = document.querySelector('.navbar-brand, .navbar-name');
    const alto = barra ? Math.round(barra.getBoundingClientRect().height) : 0;
    return { esqueleto: !!esqueleto, barra: !!barra, marca: !!marca, alto };
  })()`);
  comprobar(
    pantalla,
    'el esqueleto se dibuja (app-layout y barra superior)',
    dibujo.esqueleto && dibujo.barra && dibujo.alto > 0,
    describir([
      `app-layout=${dibujo.esqueleto}`,
      `barra=${dibujo.barra} (${dibujo.alto}px)`,
      `marca de la aplicación=${dibujo.marca}`,
    ]),
  );
}

/**
 * Abre la pantalla de acceso y espera a que esté lista.
 *
 * La sesión vive en `localStorage`, que se comparte entre pestañas: si queda la
 * del usuario anterior (o la de una prueba manual), `/login` redirige al panel
 * y no habría formulario que rellenar. Así que primero se borra la sesión
 * guardada y solo después se navega.
 *
 * Devuelve la marca de consola desde la que cuenta la pantalla de acceso: así
 * entra en la comprobación lo que pase al cargarla.
 */
async function abrirLogin(sesion) {
  await sesion
    .enviar('Storage.clearDataForOrigin', { origin: APP, storageTypes: 'local_storage' })
    .catch(() => {});

  // Primera carga: sirve para borrar la sesión desde dentro de la propia
  // aplicación, por si quedaba alguna (la pestaña puede acabar en el panel).
  await sesion.enviar('Page.navigate', { url: `${APP}/login` });
  await pausa(1500);
  await sesion.evaluar('localStorage.clear(); true').catch(() => {});

  // Segunda carga: ya sin sesión, el formulario se queda en pantalla.
  const marca = sesion.marca();
  await sesion.ir(`${APP}/login`);
  await sesion.esperarValor(
    `!!document.querySelector('#correo') && !!document.querySelector('#password')`,
    { descripcion: 'el formulario de acceso' },
  );
  return marca;
}

/** Rellena el formulario de acceso y lo envía, como lo haría una persona. */
async function enviarCredenciales(sesion, correo, password) {
  await sesion.escribir('#correo', correo);
  await sesion.escribir('#password', password);
  await sesion.esperarValor(
    `!document.querySelector('.auth-card form button[type="submit"]').disabled`,
    { descripcion: 'que el botón de entrar se habilite' },
  );
  await sesion.clic('.auth-card form button[type="submit"]');

  return sesion.esperarValor(
    `(() => {
      if (location.pathname !== '/login') return { estado: 'dentro', url: location.pathname };
      const alerta = document.querySelector('.alert-error');
      if (alerta && alerta.textContent.trim()) {
        return { estado: 'error', mensaje: alerta.textContent.trim().slice(0, 200) };
      }
      return null;
    })()`,
    { descripcion: 'la respuesta del servidor al iniciar sesión', tiempoMaximo: 25000 },
  );
}

/** Espera a que el panel del rol esté montado. */
async function esperarPanel(sesion, pantalla) {
  await sesion.esperarValor(
    `!!document.querySelector('app-layout .navbar') && !!document.querySelector('.content')`,
    { descripcion: 'que se dibuje el panel' },
  );
  await pausa(600); // deja terminar las primeras peticiones de la pantalla
  await sesion.instalarAyudas();
  return pantalla;
}

// --- Docente ---------------------------------------------------------------

async function verificarDocente(correo, { intentarProyecto }) {
  const pantalla = 'docente';
  const sesion = await Sesion.abrir();
  try {
    await sesion.configurar();

    // 1. La pantalla de acceso: se mide, se captura y solo después se entra.
    const pantallaLogin = 'login';
    const marcaLogin = await abrirLogin(sesion);
    const formulario = await sesion.evaluar(`(() => ({
      correo: !!document.querySelector('#correo'),
      password: !!document.querySelector('#password'),
      boton: !!document.querySelector('.auth-card form button[type="submit"]'),
    }))()`);
    comprobar(
      pantallaLogin,
      'el formulario de acceso se dibuja',
      formulario.correo && formulario.password && formulario.boton,
      `#correo=${formulario.correo} · #password=${formulario.password} · botón=${formulario.boton}`,
    );
    if (!capturoLogin) {
      await sesion.captura('01-login.png');
      capturoLogin = true;
    }
    await revisarPantalla(sesion, pantallaLogin, marcaLogin, { layout: false });

    // 2. Entrar.
    const acceso = await enviarCredenciales(sesion, correo, PASSWORD_DEMO);
    if (acceso.estado !== 'dentro') {
      comprobar(
        pantallaLogin,
        `acceso de ${correo}`,
        false,
        `no se pudo entrar: ${acceso.mensaje ?? 'sin mensaje'}`,
      );
      return false;
    }
    comprobar(
      pantallaLogin,
      `acceso de ${correo}`,
      acceso.url === '/docente',
      `llega a ${acceso.url}`,
    );

    // 3. El panel del docente: consola limpia y esqueleto dibujado.
    const marcaPanel = sesion.marca();
    await esperarPanel(sesion, pantalla);
    await revisarPantalla(sesion, pantalla, marcaPanel);

    if (!intentarProyecto) return false;
    return await verificarProyecto(sesion, correo);
  } finally {
    await sesion.cerrar();
  }
}

// --- Clase espejo y Alumnos ------------------------------------------------

async function verificarProyecto(sesion, correo) {
  const pantalla = 'clase-espejo';
  const marca = sesion.marca();

  await sesion.ir(`${APP}/proyectos/${PROYECTO}`);
  const estado = await sesion.esperarValor(
    `(() => {
      if (document.querySelector('#sesiones')) return { cargado: true };
      const alerta = document.querySelector('.alert-error');
      if (alerta && alerta.textContent.trim()) {
        return { cargado: false, mensaje: alerta.textContent.trim().slice(0, 160) };
      }
      return null;
    })()`,
    { descripcion: `que cargue la clase espejo #${PROYECTO}` },
  );

  if (!estado.cargado) {
    avisar(
      pantalla,
      `abrir la clase espejo #${PROYECTO}`,
      `con ${correo} no se abrió: ${estado.mensaje ?? 'sin mensaje'}`,
    );
    return false;
  }

  await pausa(700);
  await sesion.instalarAyudas();
  await sesion.evaluar('window.scrollTo(0, 0); true');

  // 1) La tarjeta de sesiones no desborda su contenedor ni la página.
  const desborde = await sesion.evaluar(`(() => {
    const seccion = document.querySelector('#sesiones');
    const tarjeta = seccion.closest('.card');
    const lista = tarjeta.querySelector('.lista') ?? tarjeta;
    const medir = (el) => el
      ? { scroll: el.scrollWidth, cliente: el.clientWidth }
      : null;
    return {
      tarjeta: medir(tarjeta),
      lista: medir(lista),
      body: { scroll: document.documentElement.scrollWidth, cliente: document.documentElement.clientWidth },
    };
  })()`);

  const medidas = [
    ['la tarjeta de sesiones', desborde.tarjeta],
    ['la lista de sesiones', desborde.lista],
    ['el cuerpo de la página', desborde.body],
  ];
  for (const [nombre, medida] of medidas) {
    if (!medida) {
      avisar(pantalla, `${nombre} no desborda`, 'no se encontró el elemento para medirlo');
      continue;
    }
    comprobar(
      pantalla,
      `${nombre} no desborda`,
      medida.scroll <= medida.cliente + 1,
      `scrollWidth=${medida.scroll} · clientWidth=${medida.cliente}`,
    );
  }

  // 2) Ningún botón de la tarjeta de sesiones se sale de ella.
  const botones = await sesion.evaluar(`(() => {
    const tarjeta = document.querySelector('#sesiones').closest('.card');
    const caja = tarjeta.getBoundingClientRect();
    const fuera = [];
    let revisados = 0;
    for (const boton of tarjeta.querySelectorAll('button, a[href], a.btn')) {
      const r = boton.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      revisados += 1;
      if (r.left < caja.left - 1 || r.right > caja.right + 1) {
        fuera.push((boton.textContent ?? '').trim().slice(0, 40) || '(sin texto)');
      }
    }
    return {
      revisados,
      fuera,
      caja: { izquierda: Math.round(caja.left), derecha: Math.round(caja.right) },
    };
  })()`);
  comprobar(
    pantalla,
    'ningún botón de la tarjeta de sesiones queda fuera de su tarjeta',
    botones.fuera.length === 0,
    describir([
      `${botones.revisados} botones revisados`,
      `tarjeta de ${botones.caja.izquierda} a ${botones.caja.derecha}px`,
      botones.fuera.length ? `fuera: ${botones.fuera.join(', ')}` : 'ninguno fuera',
    ]),
  );

  // 3) Los reportes de clase están plegados al entrar y se abren al pulsarlos.
  const reportes = await sesion.evaluar(`(() => {
    const lista = [...document.querySelectorAll('#sesiones details.reporte')];
    return { total: lista.length, abiertos: lista.filter((d) => d.open).length };
  })()`);
  if (reportes.total === 0) {
    avisar(pantalla, 'los reportes de clase están plegados al entrar', 'esta clase espejo no tiene reportes de clase');
  } else {
    comprobar(
      pantalla,
      'los reportes de clase están plegados al entrar',
      reportes.abiertos === 0,
      `${reportes.total} reportes · ${reportes.abiertos} abiertos · ${reportes.total - reportes.abiertos} plegados`,
    );

    await sesion.clic('#sesiones details.reporte summary');
    await pausa(400);
    const abierto = await sesion.evaluar(`(() => {
      const detalle = document.querySelector('#sesiones details.reporte');
      const cuerpo = detalle.querySelector('.reporte-cuerpo');
      const r = cuerpo ? cuerpo.getBoundingClientRect() : null;
      return {
        open: detalle.open,
        alto: r ? Math.round(r.height) : 0,
        texto: (cuerpo.textContent ?? '').replace(/\\s+/g, ' ').trim().slice(0, 120),
      };
    })()`);
    comprobar(
      pantalla,
      'al abrir un reporte se ve su contenido',
      abierto.open && abierto.alto > 0 && abierto.texto.length > 20,
      `open=${abierto.open} · alto=${abierto.alto}px · «${abierto.texto}»`,
    );
    // Se vuelve a plegar para dejar la pantalla como estaba.
    await sesion.clic('#sesiones details.reporte summary');
    await pausa(250);
  }

  // 4) Las dos columnas de la clase espejo están equilibradas.
  await sesion.evaluar('window.scrollTo(0, 0); true');
  await pausa(250);
  const columnas = await sesion.evaluar(`(() => {
    const contenedor = document.querySelector('.proyecto-cols');
    if (!contenedor) return null;
    const grupos = new Map();
    for (const hijo of contenedor.children) {
      const r = hijo.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      const clave = Math.round(r.left);
      const grupo = grupos.get(clave) ?? { izquierda: clave, arriba: r.top, abajo: r.bottom, tarjetas: 0 };
      grupo.arriba = Math.min(grupo.arriba, r.top);
      grupo.abajo = Math.max(grupo.abajo, r.bottom);
      grupo.tarjetas += 1;
      grupos.set(clave, grupo);
    }
    const lista = [...grupos.values()]
      .sort((a, b) => a.izquierda - b.izquierda)
      .map((g) => ({ izquierda: g.izquierda, alto: Math.round(g.abajo - g.arriba), tarjetas: g.tarjetas }));
    return {
      columnas: lista,
      diferencia: lista.length >= 2 ? Math.abs(lista[0].alto - lista[1].alto) : null,
    };
  })()`);

  if (!columnas) {
    avisar(pantalla, 'las columnas están equilibradas', 'no se encontró el contenedor .proyecto-cols');
  } else if (columnas.columnas.length < 2) {
    avisar(
      pantalla,
      'las columnas están equilibradas',
      `solo se midió ${columnas.columnas.length} columna (¿ventana estrecha?)`,
    );
  } else {
    const [primera, segunda] = columnas.columnas;
    comprobar(
      pantalla,
      'las columnas están equilibradas',
      columnas.diferencia <= TOLERANCIA_COLUMNAS,
      `1ª columna ${primera.alto}px (${primera.tarjetas} tarjetas) · 2ª columna ${segunda.alto}px (${segunda.tarjetas} tarjetas) · diferencia ${columnas.diferencia}px (límite ${TOLERANCIA_COLUMNAS}px)`,
    );
  }

  await revisarPantalla(sesion, pantalla, marca);
  await sesion.evaluar('window.scrollTo(0, 0); true');
  await pausa(250);
  await sesion.captura('02-clase-espejo.png');

  // 5) Alumnos: la plantilla se descarga desde un botón que se ve sin hover.
  const marcaAlumnos = sesion.marca();
  const pantallaAlumnos = 'alumnos';
  const existe = await sesion.evaluar(`!!document.querySelector('#alumnos')`);
  if (!existe) {
    avisar(pantallaAlumnos, 'la sección Alumnos existe', 'esta sesión no ve la sección Alumnos de esta clase espejo');
    return true;
  }

  await sesion.evaluar(
    `document.querySelector('#alumnos').scrollIntoView({ block: 'start', behavior: 'instant' }); true`,
  );
  await pausa(400);

  const plantilla = await sesion.evaluar(`(() => {
    const seccion = document.querySelector('#alumnos');
    const boton = seccion.querySelector('a[download], a[href*="plantilla"]');
    if (!boton) return { existe: false };
    const r = boton.getBoundingClientRect();
    const estilo = getComputedStyle(boton);
    const fondo = window.__verif.fondoDe(boton);
    return {
      existe: true,
      texto: (boton.textContent ?? '').replace(/\\s+/g, ' ').trim(),
      href: boton.getAttribute('href') ?? '',
      visible: r.width > 0 && r.height > 0 && estilo.display !== 'none' &&
        estilo.visibility !== 'hidden' && Number(estilo.opacity) > 0,
      ancho: Math.round(r.width),
      alto: Math.round(r.height),
      color: estilo.color,
      fondo,
      contraste: window.__verif.contraste(estilo.color, fondo),
    };
  })()`);

  if (!plantilla.existe) {
    comprobar(
      pantallaAlumnos,
      'el botón de descargar la plantilla existe',
      false,
      'no se encontró ningún enlace de descarga dentro de la sección Alumnos',
    );
    await sesion.captura('03-alumnos.png');
    await revisarPantalla(sesion, pantallaAlumnos, marcaAlumnos);
    return true;
  }

  comprobar(
    pantallaAlumnos,
    'el botón de descargar la plantilla existe',
    true,
    `«${plantilla.texto}» → ${plantilla.href}`,
  );
  comprobar(
    pantallaAlumnos,
    'el botón se ve (tamaño y visibilidad)',
    plantilla.visible && plantilla.ancho > 40 && plantilla.alto > 20,
    `${plantilla.ancho}×${plantilla.alto}px · visible=${plantilla.visible}`,
  );
  comprobar(
    pantallaAlumnos,
    'el texto del botón se distingue del fondo sin pasar el cursor',
    plantilla.color !== plantilla.fondo && plantilla.contraste >= CONTRASTE_MINIMO,
    `color=${plantilla.color} · fondo=${plantilla.fondo} · contraste=${plantilla.contraste}:1 (mínimo ${CONTRASTE_MINIMO}:1)`,
  );

  await sesion.captura('03-alumnos.png');
  await revisarPantalla(sesion, pantallaAlumnos, marcaAlumnos);
  return true;
}

// --- Agente ----------------------------------------------------------------

async function verificarAgente(correo) {
  const pantalla = 'agente';
  const sesion = await Sesion.abrir();
  try {
    await sesion.configurar();
    await abrirLogin(sesion);
    const acceso = await enviarCredenciales(sesion, correo, PASSWORD_DEMO);
    comprobar(
      'login',
      `acceso de ${correo}`,
      acceso.estado === 'dentro' && acceso.url === '/agente',
      acceso.estado === 'dentro' ? `llega a ${acceso.url}` : `no entró: ${acceso.mensaje ?? ''}`,
    );
    if (acceso.estado !== 'dentro') return;

    const marcaPanel = sesion.marca();
    await esperarPanel(sesion, pantalla);
    await revisarPantalla(sesion, pantalla, marcaPanel);

    const menu = await sesion.evaluar(
      `document.querySelectorAll('.sidebar-nav .sidebar-link').length`,
    );
    comprobar(
      pantalla,
      'el menú lateral del agente sigue completo',
      menu >= 9,
      `${menu} entradas en el menú lateral`,
    );
  } finally {
    await sesion.cerrar();
  }
}

// --- Presidencia de la CACE ------------------------------------------------

async function verificarPresidente() {
  const pantalla = 'cace';
  const sesion = await Sesion.abrir();
  try {
    await sesion.configurar();
    await abrirLogin(sesion);
    const acceso = await enviarCredenciales(sesion, PRESIDENTE, PASSWORD_CACE);

    if (acceso.estado !== 'dentro') {
      avisar(
        'login',
        `acceso de ${PRESIDENTE} (presidencia de la CACE)`,
        describir([
          'no se pudo entrar: el guion no conoce su contraseña',
          `mensaje del login: ${acceso.mensaje ?? 'sin mensaje'}`,
          'para comprobar el panel, repite con: CACE_PASSWORD="<su contraseña>" node scripts/verificar-navegador.js',
        ]),
      );
      avisar(
        pantalla,
        'panel de la presidencia (/cace)',
        'no se pudo comprobar: hace falta entrar como presidente (CACE_PASSWORD)',
      );
      return;
    }

    comprobar('login', `acceso de ${PRESIDENTE}`, acceso.url === '/cace', `llega a ${acceso.url}`);

    // La marca se pone al llegar a /cace: lo que pase después es de esta pantalla.
    const marca = sesion.marca();
    await esperarPanel(sesion, pantalla);
    await sesion.evaluar('window.scrollTo(0, 0); true');
    await pausa(300);
    const sinPasswordProvisional = await sesion.evaluar(
      `!document.querySelector('#actual')`,
    );
    if (!sinPasswordProvisional) {
      avisar(
        pantalla,
        'la sección Instituciones es visible',
        'el presidente entró con la contraseña provisional: el panel pide cambiarla antes de mostrar las instituciones',
      );
    }

    // La campana: visible, con su etiqueta de accesibilidad.
    const campana = await sesion.evaluar(`(() => {
      const boton = document.querySelector('.navbar [aria-label^="Notificaciones"]');
      if (!boton) return { existe: false };
      const r = boton.getBoundingClientRect();
      return {
        existe: true,
        etiqueta: boton.getAttribute('aria-label'),
        insignia: (boton.querySelector('.navbar-badge')?.textContent ?? '').trim(),
        visible: r.width > 0 && r.height > 0,
      };
    })()`);
    comprobar(
      pantalla,
      'la campana se ve en la barra superior',
      campana.existe && campana.visible,
      campana.existe
        ? `aria-label=«${campana.etiqueta}» · insignia=${campana.insignia || 'sin insignia'}`
        : 'no se encontró [aria-label^="Notificaciones"]',
    );

    // La captura se hace al final, con la lista de instituciones a la vista.

    // Al pulsar la campana aparece el panel de pendientes.
    if (campana.existe) {
      await sesion.clic('.navbar [aria-label^="Notificaciones"]');
      const panel = await sesion.esperarValor(
        `(() => {
          const dialogo = document.querySelector('.dropdown-panel[aria-label="Notificaciones"]');
          if (!dialogo) return null;
          const r = dialogo.getBoundingClientRect();
          return {
            visible: r.width > 0 && r.height > 0,
            titulo: (dialogo.querySelector('.dropdown-title')?.textContent ?? '').trim(),
            avisos: [...dialogo.querySelectorAll('.dropdown-item')].map((i) =>
              (i.textContent ?? '').replace(/\\s+/g, ' ').trim().slice(0, 90),
            ),
            vacio: (dialogo.querySelector('.dropdown-empty')?.textContent ?? '').trim(),
          };
        })()`,
        { descripcion: 'el panel de pendientes de la campana', tiempoMaximo: 5000 },
      ).catch(() => null);

      comprobar(
        pantalla,
        'al pulsar la campana aparece el panel de pendientes',
        !!panel && panel.visible,
        panel
          ? describir([
              `título «${panel.titulo}»`,
              panel.avisos.length ? `avisos: ${panel.avisos.join(' / ')}` : `sin avisos (${panel.vacio || 'vacío'})`,
            ])
          : 'no apareció el diálogo de notificaciones',
      );

      if (panel && panel.avisos.length > 0) {
        comprobar(
          pantalla,
          'la campana avisa de las instituciones por aprobar',
          panel.avisos.some((a) => /instituci/i.test(a)),
          panel.avisos.join(' / '),
        );
      }
      await sesion.evaluar(
        `document.querySelector('.navbar')?.click(); window.scrollTo(0, 0); true`,
      );
      await pausa(200);
    }

    // La sección Instituciones lista las dos instituciones sembradas.
    if (sinPasswordProvisional) {
      const instituciones = await sesion.esperarValor(
        `(() => {
          const seccion = document.querySelector('#instituciones');
          if (!seccion) return null;
          const filas = [...seccion.querySelectorAll('.lista-item')];
          return {
            total: filas.length,
            nombres: filas.map((f) => (f.querySelector('.inst-name strong')?.textContent ?? '').trim()),
            estados: filas.map((f) => (f.querySelector('.estado')?.textContent ?? '').trim()),
          };
        })()`,
        { descripcion: 'la lista de instituciones', tiempoMaximo: 10000 },
      ).catch(() => null);

      if (!instituciones) {
        comprobar(
          pantalla,
          `la sección Instituciones lista las ${INSTITUCIONES_ESPERADAS} instituciones`,
          false,
          'no se encontró #instituciones con filas',
        );
      } else {
        comprobar(
          pantalla,
          `la sección Instituciones lista las ${INSTITUCIONES_ESPERADAS} instituciones`,
          instituciones.total === INSTITUCIONES_ESPERADAS,
          `${instituciones.total} instituciones: ${instituciones.nombres.join(', ')} (${instituciones.estados.join(', ')})`,
        );
      }

      await sesion.evaluar(
        `document.querySelector('#instituciones')?.scrollIntoView({ block: 'start', behavior: 'instant' }); true`,
      );
      await pausa(300);
      await sesion.captura('04-cace.png');
    } else {
      await sesion.evaluar('window.scrollTo(0, 0); true');
      await pausa(200);
      await sesion.captura('04-cace.png');
    }

    await revisarPantalla(sesion, pantalla, marca);
  } finally {
    await sesion.cerrar();
  }
}

// --- Informe ---------------------------------------------------------------

const ICONO = { OK: '[OK]   ', FALLA: '[FALLA]', AVISO: '[AVISO]' };

function imprimirInforme() {
  const linea = '─'.repeat(78);
  console.log('');
  console.log('══════════════════════════════════════════════════════════════════════════════');
  console.log('  VERIFICACIÓN EN EL NAVEGADOR — Clases Espejo');
  console.log(`  Aplicación: ${APP}     DevTools: ${CDP}`);
  console.log('══════════════════════════════════════════════════════════════════════════════');

  let pantallaActual = null;
  for (const c of informe.comprobaciones) {
    if (c.pantalla !== pantallaActual) {
      pantallaActual = c.pantalla;
      console.log('');
      console.log(`── ${pantallaActual.toUpperCase()} ${linea.slice(pantallaActual.length + 4)}`);
    }
    console.log(`  ${ICONO[c.estado]} ${c.nombre}`);
    if (c.detalle) console.log(`           ${c.detalle}`);
  }

  if (informe.avisosConsola.length > 0) {
    console.log('');
    console.log(`── CONSOLA (errores de red o recursos, informativos) ${'─'.repeat(26)}`);
    for (const aviso of informe.avisosConsola) {
      console.log(`  ${aviso.pantalla}:`);
      for (const entrada of aviso.entradas) console.log(`    · ${entrada}`);
    }
  }

  console.log('');
  console.log('── RESUMEN ──────────────────────────────────────────────────────────────────');
  console.log(
    `  OK: ${informe.resumen.ok}    FALLA: ${informe.resumen.falla}    AVISO: ${informe.resumen.aviso}`,
  );
  console.log(`  Capturas en: ${CARPETA_CAPTURAS}`);
  for (const captura of informe.capturas) {
    console.log(`    · ${path.basename(captura)}`);
  }
  console.log(`  Informe JSON: ${ARCHIVO_JSON}`);
  console.log('');
  console.log('  JSON:');
  console.log(JSON.stringify(informe, null, 2));
  console.log('');
}

async function comprobarConexion() {
  try {
    const respuesta = await fetch(`${CDP}/json/version`);
    if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
    const version = await respuesta.json();
    return version.Browser ?? 'Chrome';
  } catch (error) {
    console.error('');
    console.error('No se pudo hablar con Chrome en el puerto de depuración.');
    console.error(`  Dirección: ${CDP}`);
    console.error(`  Motivo:    ${error.message}`);
    console.error('');
    console.error('Arranca Chrome con el puerto abierto y vuelve a intentarlo:');
    console.error('  chrome.exe --remote-debugging-port=9222');
    console.error('');
    console.error(`Y comprueba que la aplicación responde en ${APP}.`);
    console.error('');
    process.exit(1);
  }
}

async function principal() {
  informe.inicio = new Date().toISOString();
  fs.mkdirSync(CARPETA_CAPTURAS, { recursive: true });

  const navegador = await comprobarConexion();
  console.log(`Conectado a ${navegador} en ${CDP}.`);
  console.log(`Verificando ${APP} …`);

  // Docentes: se verifica el panel de los dos; la clase espejo, con el primero
  // que consiga abrirla (el proyecto #PROYECTO no tiene por qué ser de los dos).
  let proyectoVerificado = false;
  for (const correo of DOCENTES) {
    try {
      const hecho = await verificarDocente(correo, { intentarProyecto: !proyectoVerificado });
      proyectoVerificado = proyectoVerificado || hecho;
    } catch (error) {
      anotar('docente', `verificación de ${correo}`, 'FALLA', error.message);
    }
  }

  for (const correo of AGENTES) {
    try {
      await verificarAgente(correo);
    } catch (error) {
      anotar('agente', `verificación de ${correo}`, 'FALLA', error.message);
    }
  }

  try {
    await verificarPresidente();
  } catch (error) {
    anotar('cace', 'verificación de la presidencia', 'FALLA', error.message);
  }

  informe.fin = new Date().toISOString();
  fs.writeFileSync(ARCHIVO_JSON, `${JSON.stringify(informe, null, 2)}\n`, 'utf8');
  imprimirInforme();
  process.exit(informe.resumen.falla > 0 ? 1 : 0);
}

principal().catch((error) => {
  console.error('');
  console.error('La verificación no pudo terminar:', error);
  console.error('');
  try {
    informe.fin = new Date().toISOString();
    informe.comprobaciones.push({
      pantalla: 'guion',
      nombre: 'ejecución completa',
      estado: 'FALLA',
      detalle: error.stack ?? error.message,
    });
    informe.resumen.falla += 1;
    fs.mkdirSync(CARPETA_CAPTURAS, { recursive: true });
    fs.writeFileSync(ARCHIVO_JSON, `${JSON.stringify(informe, null, 2)}\n`, 'utf8');
    imprimirInforme();
  } catch {
    /* el informe es lo de menos cuando el guion ya falló */
  }
  process.exit(1);
});
