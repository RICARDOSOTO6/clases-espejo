#!/usr/bin/env node
/**
 * capturar-pantallas.js — recorrido de capturas de pantalla de la aplicación.
 *
 * Lo ejecuta una persona (no forma parte de la aplicación): se conecta a un
 * Chrome ya abierto con el puerto de depuración, entra con los usuarios de
 * demostración y guarda **una captura por pantalla, en orden**, en
 * `docs/capturas/recorrido/`, para documentar la aplicación.
 *
 * **No modifica la base de datos ni el código**: solo navega, rellena el
 * formulario de acceso, pulsa botones de interfaz y hace capturas. Tampoco
 * levanta ningún servidor: usa el que ya está corriendo en `APP_URL`.
 *
 * Antes de ejecutarlo hacen falta dos cosas:
 *
 *   1. La aplicación en marcha:            http://localhost:3000
 *   2. Chrome con el puerto de depuración:
 *      chrome.exe --headless=new --remote-debugging-port=9222 --window-size=1440,900
 *
 * Uso:
 *   node backend/scripts/capturar-pantallas.js
 *
 * Variables de entorno opcionales:
 *   APP_URL           (por defecto http://localhost:3000)
 *   CDP_URL           (por defecto http://127.0.0.1:9222)
 *   PROYECTO_ID       (por defecto 17: la clase espejo finalizada)
 *   FOLIO             (por defecto CACE-2026-0001: el folio que se verifica)
 *   ESPERA_MS         (por defecto 20000: lo que se espera a cada pantalla)
 *   CARPETA_CAPTURAS  (por defecto docs/capturas/recorrido)
 *
 * Si una pantalla falla (no carga, no encuentra un selector, no entra), **queda
 * anotada y el recorrido sigue con las demás**: nada aborta el guion salvo no
 * poder hablar con Chrome. Al final imprime un resumen con OK/FALLA por captura,
 * el motivo, y los archivos escritos con su tamaño.
 *
 * Códigos de salida: 0 si todas las pantallas quedaron capturadas, 1 si falló
 * alguna (o si no se pudo conectar con Chrome).
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

// --- Configuración ---------------------------------------------------------

const CDP = (process.env.CDP_URL ?? 'http://127.0.0.1:9222').replace(/\/+$/, '');
const APP = (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
const CARPETA = path.resolve(
  process.env.CARPETA_CAPTURAS ??
    path.join(__dirname, '..', '..', 'docs', 'capturas', 'recorrido'),
);

/** Ventana de escritorio: es donde la aplicación se ve como en la documentación. */
const ANCHO = 1440;
const ALTO = 900;
/** Lo que se espera a que una pantalla concreta esté lista. */
const ESPERA = Number(process.env.ESPERA_MS ?? 20000);
/** El acceso tarda más: el servidor tiene que responder y firmar el token. */
const ESPERA_LOGIN = 25000;
/** Respiro tras ver la pantalla lista (no es una espera a ciegas: es el margen). */
const MARGEN = 450;
/**
 * Si la página es más alta que esto, no se captura de una pieza: se parte en dos
 * capturas (arriba y abajo). Chrome no maneja bien las imágenes enormes.
 */
const ALTO_MAXIMO_PAGINA = 9000;

const PROYECTO = String(process.env.PROYECTO_ID ?? '17');
const FOLIO = String(process.env.FOLIO ?? 'CACE-2026-0001');

/** Credenciales de demostración: todas funcionan hoy. */
const USUARIOS = {
  presidencia: {
    correo: 'antiniosotobeh@gmail.com',
    password: 'CaceDemo2026!',
    panel: '/cace',
  },
  secretaria: {
    correo: 'secretaria.cace@clasesespejo.mx',
    password: 'SecretariaCace2026!',
    panel: '/cace',
  },
  agente: {
    correo: 'agente.calkini@clasesespejo.mx',
    password: 'Demo1234',
    panel: '/agente',
  },
  docente: {
    correo: 'sofia.gomez@clasesespejo.mx',
    password: 'Demo1234',
    panel: '/docente',
  },
};

// --- Expresiones que se evalúan dentro de la página ------------------------
//
// Todas viven aquí, juntas y en un solo sitio, para poder revisarlas de un
// vistazo: son las que deciden **cuándo** una pantalla está lista y **qué** se
// pulsa. Las que llevan argumentos son funciones que devuelven el texto.

const EXP = {
  // --- Acceso ---------------------------------------------------------------
  FORMULARIO_LOGIN: `!!document.querySelector('.auth-card #correo') &&
    !!document.querySelector('.auth-card #password') &&
    !!document.querySelector('.auth-card form button[type="submit"]')`,

  BOTON_ENTRAR_LISTO: `(() => {
    const boton = document.querySelector('.auth-card form button[type="submit"]');
    return !!boton && !boton.disabled;
  })()`,

  ENVIAR_LOGIN: `(() => {
    const formulario = document.querySelector('.auth-card form');
    if (!formulario) return false;
    if (typeof formulario.requestSubmit === 'function') {
      formulario.requestSubmit();
      return true;
    }
    formulario.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    return true;
  })()`,

  RESULTADO_LOGIN: `(() => {
    if (location.pathname.replace(/\\/+$/, '') !== '/login') {
      return { estado: 'dentro', url: location.pathname };
    }
    const alerta = document.querySelector('.alert-error');
    if (alerta && alerta.textContent.trim()) {
      return { estado: 'error', mensaje: alerta.textContent.trim().slice(0, 200) };
    }
    return null;
  })()`,

  LOCALSTORAGE_LIMPIAR: `(() => {
    localStorage.clear();
    sessionStorage.clear();
    return true;
  })()`,

  // --- Registro público -----------------------------------------------------
  REGISTRO_LISTO: `!!document.querySelector('#nombres') &&
    !!document.querySelector('.inst-paso') &&
    !!document.querySelector('#buscarInstitucion')`,

  // --- Verificación pública -------------------------------------------------
  VERIFICACION_LISTA: `(() => {
    if (!document.querySelector('.verificacion')) return false;
    if (document.querySelector('.verificacion-espera')) return false;
    return !!document.querySelector('.verificacion-titulo');
  })()`,

  // --- Paneles con esqueleto (agente, docente, clase espejo) ----------------
  PANEL_LISTO: `!!document.querySelector('app-layout .navbar') &&
    !!document.querySelector('app-layout .content') &&
    !!document.querySelector('.content section.card')`,

  AGENTE_LISTO: `!!document.querySelector('app-layout .navbar') &&
    !!document.querySelector('.content') &&
    !!document.querySelector('.content .welcome h1, .content section.card h1')`,

  /** El botón del panel del agente que abre el formulario de invitar docente. */
  BOTON_INVITAR: `document.querySelector('.welcome-action') ||
    [...document.querySelectorAll('button')].find((b) => /invitar\\s+docente/i.test(b.textContent || '')) ||
    null`,

  MODAL_INVITAR_LISTO: `!!document.querySelector('app-modal .modal #d-correo') &&
    !!document.querySelector('app-modal .modal')`,

  DOCENTE_LISTO: `!!document.querySelector('app-layout .navbar') &&
    !!document.querySelector('.content .welcome h1') &&
    !!document.querySelector('#solicitudes')`,

  /** La clase espejo: `#sesiones` solo existe cuando el proyecto se dibujó. */
  PROYECTO_ESTADO: `(() => {
    if (document.querySelector('#sesiones')) return { cargado: true };
    const alerta = document.querySelector('.alert-error');
    if (alerta && alerta.textContent.trim()) {
      return { cargado: false, mensaje: alerta.textContent.trim().slice(0, 160) };
    }
    return null;
  })()`,

  ALUMNOS_SECCION: `!!document.querySelector('#alumnos')`,
  ALUMNOS_PLANTILLA: `!!document.querySelector('#alumnos a[download]')`,

  // --- Panel de la CACE (presidencia y secretaría) --------------------------
  /**
   * El panel de la CACE no pinta ninguna sección hasta saber los permisos: la
   * espera termina cuando `data-capacidades` ya trae el rol y la sección pedida
   * está dibujada. Si pide cambiar la contraseña provisional, lo dice.
   */
  cacePanel: (selector) => `(() => {
    const pantalla = document.querySelector('.cace-pantalla');
    if (document.querySelector('#actual')) return { estado: 'password' };
    const errorPermisos = document.querySelector('#error-permisos');
    if (errorPermisos && errorPermisos.textContent.trim()) {
      return { estado: 'error-permisos', mensaje: errorPermisos.textContent.trim().slice(0, 160) };
    }
    if (!pantalla || document.querySelector('#cargando-permisos')) return null;
    const capacidades = pantalla.getAttribute('data-capacidades') || '';
    if (!capacidades || capacidades === 'sin-rol') return null;
    ${selector ? `if (!document.querySelector(${JSON.stringify(selector)})) return null;` : ''}
    return {
      estado: 'listo',
      capacidades: capacidades,
      secciones: [...document.querySelectorAll('[data-seccion]')].map((e) => e.id),
    };
  })()`,

  CONTEO_LISTA: (selector) => `document.querySelectorAll(${JSON.stringify(selector)}).length`,

  /** ¿Hay al menos un elemento que coincida? (para esperar listados que cargan solos) */
  HAY_EN_LISTA: (selector) =>
    `document.querySelectorAll(${JSON.stringify(selector)}).length > 0`,

  /** Deja un elemento a dos tercios de la ventana, con lo anterior a la vista. */
  centrarAbajo: (selector) => `(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return false;
    const y = el.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.68;
    window.scrollTo(0, Math.max(0, y));
    return true;
  })()`,

  /** Región (en píxeles del documento) que abarca de «Miembros» a «Cambiar de presidente». */
  REGION_MIEMBROS: `(() => {
    const miembros = document.querySelector('#miembros');
    const boton = document.querySelector('[data-accion="cambiar-presidente"]');
    if (!miembros || !boton) return null;
    const cabecera = boton.closest('.card-head') || boton.closest('.card') || boton;
    const ancho = Math.max(document.documentElement.clientWidth, 1024);
    const arriba = Math.max(0, Math.floor(miembros.getBoundingClientRect().top + window.scrollY) - 12);
    const abajo = Math.ceil(cabecera.getBoundingClientRect().bottom + window.scrollY) + 12;
    return { x: 0, y: arriba, width: ancho, height: Math.max(240, abajo - arriba), scale: 1 };
  })()`,

  // --- Utilidades -----------------------------------------------------------
  esperaUrl: (ruta) => `(() => {
    const esperada = ${JSON.stringify(String(ruta || '/').replace(/\/+$/, '') || '/')};
    const actual = location.pathname.replace(/\\/+$/, '') || '/';
    if (actual === esperada) return document.readyState === 'complete' ? 'ok' : null;
    if (actual === '/login' && esperada !== '/login') return 'login';
    return null;
  })()`,

  desplazar: (selector, bloque) => `(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return false;
    el.scrollIntoView({ block: ${JSON.stringify(bloque)}, inline: 'nearest', behavior: 'instant' });
    return true;
  })()`,

  puntoDe: (expresion) => `(() => {
    const el = (${expresion});
    if (!el) return null;
    el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
    const caja = el.getBoundingClientRect();
    if (caja.width === 0 || caja.height === 0) return null;
    return {
      x: Math.round(caja.left + caja.width / 2),
      y: Math.round(caja.top + caja.height / 2),
      texto: (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 60),
    };
  })()`,

  MEDIDAS_PAGINA: `(() => ({
    ancho: Math.max(
      document.documentElement.scrollWidth,
      document.body ? document.body.scrollWidth : 0
    ),
    alto: Math.max(
      document.documentElement.scrollHeight,
      document.body ? document.body.scrollHeight : 0
    ),
  }))()`,

  IMAGENES_CARGADAS: `[...document.images].every((imagen) => imagen.complete)`,
  FUENTES_LISTAS: `document.fonts && document.fonts.ready
    ? document.fonts.ready.then(() => true)
    : true`,

  ARRIBA: `(() => { window.scrollTo(0, 0); return true; })()`,
  ABAJO: `(() => {
    window.scrollTo(0, document.documentElement.scrollHeight);
    return true;
  })()`,

  ETIQUETAS_MENU: `[...document.querySelectorAll('.sidebar-nav .sidebar-label')]
    .map((e) => e.textContent.trim())`,
};

// --- Registro del recorrido ------------------------------------------------

/** Una entrada por captura, en el orden en que se intenta. */
const capturas = [];

/** Motivo con el que nace una captura que todavía no se ha intentado. */
const NO_INTENTADA = 'no se llegó a intentar';

/** Devuelve (creándola si hace falta) la entrada de una captura. */
function registroDe(archivo) {
  let registro = capturas.find((c) => c.archivo === archivo);
  if (!registro) {
    registro = {
      archivo,
      paso: '—',
      selector: '—',
      estado: 'FALLA',
      motivo: NO_INTENTADA,
      detalle: '',
      bytes: 0,
      /** Grupo: item 7 admite 07, o bien 07a + 07b. */
      grupo: archivo,
    };
    capturas.push(registro);
  }
  return registro;
}

/** Anota un detalle informativo en la captura (no cambia su estado). */
function anotarDetalle(archivo, texto) {
  registroDe(archivo).detalle = texto;
}

/** Marca como FALLA las capturas de un tramo que no se pudo ni empezar. */
function marcarFallidas(archivos, motivo) {
  for (const archivo of archivos) {
    const registro = registroDe(archivo);
    if (registro.motivo === NO_INTENTADA) {
      registro.estado = 'FALLA';
      registro.motivo = motivo;
    }
  }
}

/** ¿El punto (grupo) del recorrido quedó cubierto por alguna de sus capturas? */
function grupoCubierto(grupo) {
  return capturas.some((c) => c.grupo === grupo && c.estado === 'OK');
}

const pausa = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// --- Sesión de DevTools ----------------------------------------------------

class Sesion {
  constructor(destino) {
    this.id = destino.id;
    this.ws = new WebSocket(destino.webSocketDebuggerUrl);
    this.contador = 1;
    this.pendientes = new Map();
    /** Excepciones y console.error: sirven para explicar un fallo. */
    this.errores = [];
    this.listo = new Promise((resolver, rechazar) => {
      const fallo = () =>
        rechazar(
          new Error(
            'No se pudo abrir el canal de DevTools (¿Chrome con --remote-debugging-port=9222?)',
          ),
        );
      this.ws.addEventListener('open', () => resolver());
      this.ws.addEventListener('error', fallo);
    });
    this.ws.addEventListener('message', (evento) => this.alMensaje(evento));
  }

  /** Abre una pestaña nueva y devuelve la sesión conectada a ella. */
  static async abrir() {
    let respuesta = await fetch(`${CDP}/json/new?about:blank`, { method: 'PUT' });
    if (!respuesta.ok) {
      // Un Chromium antiguo quiere GET en lugar de PUT.
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
      this.apuntar(`excepción: ${detalles.exception?.description ?? detalles.text ?? 'sin detalle'}`);
      return;
    }

    if (mensaje.method === 'Runtime.consoleAPICalled' && mensaje.params.type === 'error') {
      const texto = (mensaje.params.args ?? [])
        .map((a) => a.value ?? a.description ?? a.type)
        .join(' ');
      this.apuntar(`console.error: ${texto}`);
    }
  }

  apuntar(texto) {
    this.errores.push(String(texto).split('\n')[0].slice(0, 220));
    if (this.errores.length > 20) this.errores.shift();
  }

  /** Envía un comando del protocolo y espera su respuesta. */
  async enviar(metodo, parametros = {}, tiempoMaximo = 25000) {
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

  /** Prepara la pestaña: dominios y tamaño de ventana. */
  async configurar() {
    await this.enviar('Runtime.enable');
    await this.enviar('Page.enable');
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
        `la página lanzó un error al evaluar: ${detalles.exception?.description ?? detalles.text}`,
      );
    }
    return resultado.result?.value;
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
      `se agotó el tiempo esperando ${descripcion}${ultimoError ? ` (${ultimoError.message})` : ''}`,
    );
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
    if (!escrito) throw new Error(`no se pudo escribir en ${selector}`);
  }

  /** Pulsa con el ratón de verdad (Input.dispatchMouseEvent) sobre un elemento. */
  async clic(expresion, etiqueta = 'el elemento') {
    const punto = await this.evaluar(EXP.puntoDe(expresion));
    if (!punto) throw new Error(`no se encontró ${etiqueta} para pulsarlo`);

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

  /**
   * Guarda una captura en la carpeta del recorrido.
   *
   * `completo: true` captura la página entera (para las pantallas largas) con
   * `captureBeyondViewport`; `recorte` captura una región concreta del documento.
   */
  async captura(nombre, { completo = false, recorte = null } = {}) {
    const parametros = { format: 'png', captureBeyondViewport: false };

    if (completo || recorte) {
      let region = recorte;
      if (!region) {
        const medidas = await this.evaluar(EXP.MEDIDAS_PAGINA);
        region = { x: 0, y: 0, width: medidas.ancho, height: medidas.alto, scale: 1 };
      }
      if (!region || !region.width || !region.height) {
        throw new Error('no se pudo medir la página para capturarla entera');
      }
      if (region.height > ALTO_MAXIMO_PAGINA) {
        throw new Error(
          `la página mide ${Math.round(region.height)} px de alto: no cabe en una sola captura (límite ${ALTO_MAXIMO_PAGINA} px)`,
        );
      }
      parametros.captureBeyondViewport = true;
      parametros.fromSurface = true;
      parametros.clip = {
        x: Math.max(0, Math.round(region.x)),
        y: Math.max(0, Math.round(region.y)),
        width: Math.round(region.width),
        height: Math.round(region.height),
        scale: region.scale ?? 1,
      };
    }

    const respuesta = await this.enviar('Page.captureScreenshot', parametros, 60000);
    if (!respuesta || !respuesta.data) throw new Error('Chrome no devolvió la imagen');

    const destino = path.join(CARPETA, nombre);
    fs.writeFileSync(destino, Buffer.from(respuesta.data, 'base64'));
    return destino;
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

/** La sesión única del recorrido (una pestaña, que se cierra al terminar). */
let sesion = null;

// --- Ayudas de pantalla ----------------------------------------------------

/** Deja que la pantalla termine de asentarse: fuentes, imágenes y un respiro. */
async function asentar() {
  await sesion.evaluar(EXP.FUENTES_LISTAS).catch(() => {});
  await sesion
    .esperarValor(EXP.IMAGENES_CARGADAS, {
      descripcion: 'que terminen de cargar las imágenes',
      tiempoMaximo: 6000,
      intervalo: 200,
    })
    .catch(() => {});
  await pausa(MARGEN);
}

/** Baja hasta un elemento antes de capturar. */
async function desplazarA(selector, bloque = 'start') {
  const hecho = await sesion.evaluar(EXP.desplazar(selector, bloque));
  if (!hecho) throw new Error(`no se encontró ${selector} para desplazarse hasta ahí`);
  await pausa(350);
}

/**
 * Navega y espera de verdad: primero la URL pedida (avisando si el guardia
 * devolvió al acceso) y después el elemento característico de la pantalla.
 */
async function abrirPantalla(url, { selector, descripcion, tiempoMaximo = ESPERA } = {}) {
  const ruta = new URL(url).pathname;
  await sesion.enviar('Page.navigate', { url });

  const destino = await sesion.esperarValor(EXP.esperaUrl(ruta), {
    descripcion: `que cargue ${ruta}`,
    tiempoMaximo,
  });
  if (destino === 'login') {
    throw new Error(`la aplicación devolvió al acceso (/login): no hay sesión válida para ${ruta}`);
  }
  if (selector) {
    await sesion.esperarValor(`!!document.querySelector(${JSON.stringify(selector)})`, {
      descripcion: descripcion ?? `que aparezca ${selector}`,
      tiempoMaximo,
    });
  }
}

/**
 * Deja la pantalla de acceso limpia: borra la sesión guardada y vuelve a
 * `/login`. Si no se borra, el guardia redirige al panel anterior y la captura
 * sale mal.
 */
async function abrirLogin() {
  await sesion
    .enviar('Storage.clearDataForOrigin', { origin: APP, storageTypes: 'local_storage' })
    .catch(() => {});

  // Primera carga: sirve para borrar la sesión desde dentro de la aplicación.
  await sesion.enviar('Page.navigate', { url: `${APP}/login` }).catch(() => {});
  await pausa(1200);
  await sesion.evaluar(EXP.LOCALSTORAGE_LIMPIAR).catch(() => {});

  // Segunda carga: ya sin sesión, el formulario se queda en pantalla.
  await abrirPantalla(`${APP}/login`, {
    selector: '#correo',
    descripcion: 'el formulario de acceso',
  });
  await sesion.esperarValor(EXP.FORMULARIO_LOGIN, {
    descripcion: 'el formulario de acceso completo (#correo, #password y el botón)',
  });
  await asentar();
}

/** Rellena el formulario de acceso y lo envía. Devuelve si llegó a entrar. */
async function iniciarSesion(clave) {
  const usuario = USUARIOS[clave];
  if (!usuario) return { ok: false, motivo: `no hay credenciales para «${clave}»` };

  try {
    await abrirLogin();
    await sesion.escribir('#correo', usuario.correo);
    await sesion.escribir('#password', usuario.password);
    await sesion.esperarValor(EXP.BOTON_ENTRAR_LISTO, {
      descripcion: 'que el botón de entrar se habilite',
      tiempoMaximo: 10000,
    });

    const enviado = await sesion.evaluar(EXP.ENVIAR_LOGIN);
    if (!enviado) throw new Error('no se encontró el formulario de acceso para enviarlo');

    const resultado = await sesion.esperarValor(EXP.RESULTADO_LOGIN, {
      descripcion: 'la respuesta del servidor al iniciar sesión',
      tiempoMaximo: ESPERA_LOGIN,
    });
    if (resultado.estado !== 'dentro') {
      return { ok: false, motivo: `no se pudo entrar con ${usuario.correo}: ${resultado.mensaje}` };
    }
    const llegada = resultado.url.replace(/\/+$/, '') || '/';
    if (usuario.panel && llegada !== usuario.panel) {
      return {
        ok: false,
        motivo: `se entró con ${usuario.correo} pero la aplicación llevó a ${resultado.url} (se esperaba ${usuario.panel})`,
      };
    }
    return { ok: true, motivo: '' };
  } catch (error) {
    return { ok: false, motivo: `no se pudo entrar con ${usuario.correo}: ${error.message}` };
  }
}

/**
 * Espera a que el panel de la CACE esté listo (permisos resueltos y, si se pide,
 * con una sección concreta dibujada).
 */
async function esperarCace(selector, descripcion, tiempoMaximo = ESPERA) {
  const estado = await sesion.esperarValor(EXP.cacePanel(selector), {
    descripcion,
    tiempoMaximo,
  });
  if (estado.estado === 'password') {
    throw new Error(
      'el panel pide cambiar la contraseña provisional antes de mostrar sus secciones',
    );
  }
  if (estado.estado === 'error-permisos') {
    throw new Error(`no se pudieron cargar los permisos del rol: ${estado.mensaje}`);
  }
  return estado;
}

/** Abre la clase espejo y comprueba que se dibujó. */
async function cargarProyecto() {
  await abrirPantalla(`${APP}/proyectos/${PROYECTO}`, {
    selector: '#sesiones',
    descripcion: `que se dibuje la clase espejo #${PROYECTO}`,
  });
  const estado = await sesion.esperarValor(EXP.PROYECTO_ESTADO, {
    descripcion: `que cargue la clase espejo #${PROYECTO}`,
    tiempoMaximo: ESPERA,
  });
  if (!estado.cargado) {
    throw new Error(`la clase espejo #${PROYECTO} no se abrió: ${estado.mensaje ?? 'sin mensaje'}`);
  }
}

// --- Captura ----------------------------------------------------------------

/**
 * Prepara la pantalla y la captura. Nunca lanza: los fallos se anotan en el
 * registro y el recorrido sigue con la siguiente pantalla.
 *
 * `recorte` puede ser una región o una función que la devuelve: hace falta que
 * sea función cuando la región solo se puede medir con la pantalla ya montada
 * (que es lo que hace `preparar`).
 */
async function capturar(opciones) {
  const { archivo, paso, selector, preparar, completo = false, recorte = null } = opciones;
  const registro = registroDe(archivo);

  registro.paso = paso;
  registro.selector = selector;
  registro.estado = 'FALLA';
  registro.motivo = '';
  registro.detalle = '';
  registro.bytes = 0;
  registro.fase = '';

  try {
    if (preparar) await preparar();
  } catch (error) {
    registro.fase = 'preparar';
    registro.motivo = `no se pudo preparar la pantalla: ${error.message}`;
    registrarErrores(registro);
    return false;
  }

  try {
    const region = typeof recorte === 'function' ? recorte() : recorte;
    const destino = await sesion.captura(archivo, { completo, recorte: region });
    registro.estado = 'OK';
    registro.bytes = fs.statSync(destino).size;
    return true;
  } catch (error) {
    registro.fase = 'captura';
    registro.motivo = `no se pudo capturar: ${error.message}`;
    registrarErrores(registro);
    return false;
  }
}

/** Añade al motivo lo último que dijo la consola de la página (si dijo algo). */
function registrarErrores(registro) {
  const ultimos = sesion ? sesion.errores.slice(-2) : [];
  if (ultimos.length > 0) {
    registro.motivo += ` · consola: ${ultimos.join(' | ')}`;
  }
}

// --- Recorrido --------------------------------------------------------------

/** 1-3: lo que se ve sin sesión (acceso, registro y verificación pública). */
async function tramoPublico() {
  // 1) Acceso. Se borra la sesión antes, para que el guardia no devuelva al panel.
  await capturar({
    archivo: '01-acceso.png',
    paso: 'Pantalla de acceso',
    selector: ".auth-card #correo + #password + botón 'Entrar'",
    preparar: async () => {
      await abrirLogin();
    },
  });

  // 2) Registro público: el formulario donde se busca la institución.
  await capturar({
    archivo: '02-registro.png',
    paso: 'Registro público (buscar la institución)',
    selector: '#buscarInstitucion (dentro de .inst-paso)',
    preparar: async () => {
      await abrirPantalla(`${APP}/register`, {
        selector: '#nombres',
        descripcion: 'el formulario de registro',
      });
      await sesion.esperarValor(EXP.REGISTRO_LISTO, {
        descripcion: 'el campo de buscar institución',
      });
      await desplazarA('.inst-paso', 'start');
      await asentar();
    },
  });

  // 3) Verificación pública de un certificado (con un folio sin emitir).
  await capturar({
    archivo: '03-verificacion-publica.png',
    paso: `Verificación pública (${FOLIO})`,
    selector: '.verificacion-titulo (sin .verificacion-espera)',
    preparar: async () => {
      await abrirPantalla(`${APP}/verificar/${FOLIO}`, {
        selector: '.verificacion',
        descripcion: 'la página de verificación',
      });
      await sesion.esperarValor(EXP.VERIFICACION_LISTA, {
        descripcion: 'el resultado de la verificación',
      });
      await sesion.evaluar(EXP.ARRIBA);
      await asentar();
    },
  });
}

/** 4-5: panel del agente y su formulario de invitar docente. */
async function tramoAgente() {
  const archivos = ['04-panel-agente.png', '05-invitacion-docente.png'];
  const acceso = await iniciarSesion('agente');
  if (!acceso.ok) {
    marcarFallidas(archivos, acceso.motivo);
    return;
  }

  // 4) Panel del agente.
  await capturar({
    archivo: '04-panel-agente.png',
    paso: 'Panel del agente',
    selector: '.content .welcome h1 (o la tarjeta #institucion si falta completar la institución)',
    preparar: async () => {
      await abrirPantalla(`${APP}/agente`, {
        selector: '.content',
        descripcion: 'el panel del agente',
      });
      await sesion.esperarValor(EXP.AGENTE_LISTO, {
        descripcion: 'que el panel del agente se dibuje',
      });
      await sesion.evaluar(EXP.ARRIBA);
      await asentar();
    },
  });

  // 5) Invitación de docentes: es un formulario que se abre con un botón.
  await capturar({
    archivo: '05-invitacion-docente.png',
    paso: 'Invitación de docentes (formulario del agente)',
    selector: 'app-modal .modal #d-correo (modal «Invitar docente»)',
    preparar: async () => {
      await sesion.esperarValor(EXP.AGENTE_LISTO, {
        descripcion: 'el panel del agente',
      });
      const hayBoton = await sesion.evaluar(`!!(${EXP.BOTON_INVITAR})`);
      if (!hayBoton) {
        throw new Error(
          'no aparece el botón «Invitar docente»: el panel del agente no está completo (institución sin completar o bloqueada)',
        );
      }
      const punto = await sesion.clic(EXP.BOTON_INVITAR, 'el botón «Invitar docente»');
      await sesion.esperarValor(EXP.MODAL_INVITAR_LISTO, {
        descripcion: 'que se abra el formulario de invitar docente',
        tiempoMaximo: 10000,
      });
      anotarDetalle('05-invitacion-docente.png', `se pulsó «${punto.texto}»`);
      await asentar();
    },
  });
}

/** 6-8: panel del docente, la clase espejo y su sección de Alumnos. */
async function tramoDocente() {
  const archivos = ['06-panel-docente.png', '07-clase-espejo.png', '08-alumnos.png'];
  const acceso = await iniciarSesion('docente');
  if (!acceso.ok) {
    marcarFallidas(archivos, acceso.motivo);
    return;
  }

  // 6) Panel del docente.
  await capturar({
    archivo: '06-panel-docente.png',
    paso: 'Panel del docente',
    selector: '.content .welcome h1 + #solicitudes',
    preparar: async () => {
      await abrirPantalla(`${APP}/docente`, {
        selector: '.content',
        descripcion: 'el panel del docente',
      });
      await sesion.esperarValor(EXP.DOCENTE_LISTO, {
        descripcion: 'que el panel del docente se dibuje',
      });
      await sesion.evaluar(EXP.ARRIBA);
      await asentar();
    },
  });

  // 7) La clase espejo #17, que es una página larga: se intenta de una pieza y,
  //    si no cabe, se parte en dos (arriba y abajo), como pide la documentación.
  const registro7 = registroDe('07-clase-espejo.png');
  registro7.grupo = '07-clase-espejo';
  const okCompleta = await capturar({
    archivo: '07-clase-espejo.png',
    paso: `Clase espejo /proyectos/${PROYECTO} (página completa)`,
    selector: '#sesiones (o .alert-error si no se puede abrir)',
    completo: true,
    preparar: async () => {
      await cargarProyecto();
      await desplazarA('#datos', 'start');
      await asentar();
    },
  });

  if (!okCompleta) {
    for (const [archivo, paso, accion] of [
      [
        '07a-clase-espejo-arriba.png',
        `Clase espejo /proyectos/${PROYECTO} (parte de arriba)`,
        EXP.ARRIBA,
      ],
      [
        '07b-clase-espejo-abajo.png',
        `Clase espejo /proyectos/${PROYECTO} (parte de abajo)`,
        EXP.ABAJO,
      ],
    ]) {
      registroDe(archivo).grupo = '07-clase-espejo';
      await capturar({
        archivo,
        paso,
        selector: '#sesiones (la clase espejo dibujada)',
        preparar: async () => {
          await cargarProyecto();
          await sesion.evaluar(accion);
          await asentar();
        },
      });
    }
  }

  // 8) Alumnos: hay que bajar hasta la sección, donde está la plantilla.
  await capturar({
    archivo: '08-alumnos.png',
    paso: 'Sección «Alumnos» de la clase espejo (plantilla de descarga)',
    selector: '#alumnos (y #alumnos a[download])',
    preparar: async () => {
      await cargarProyecto();
      await sesion.esperarValor(EXP.ALUMNOS_SECCION, {
        descripcion: 'la sección Alumnos de la clase espejo',
        tiempoMaximo: 10000,
      });
      await desplazarA('#alumnos', 'start');
      const hayPlantilla = await sesion
        .esperarValor(EXP.ALUMNOS_PLANTILLA, {
          descripcion: 'el botón de descargar la plantilla',
          tiempoMaximo: 8000,
        })
        .then(() => true)
        .catch(() => false);
      anotarDetalle(
        '08-alumnos.png',
        hayPlantilla
          ? 'con el botón «Descargar plantilla (.xlsx)» a la vista'
          : 'sin el botón de la plantilla: el enlace de descarga no apareció en #alumnos',
      );
      await asentar();
    },
  });
}

/** 9-12: panel de la presidencia de la CACE. */
async function tramoPresidencia() {
  const archivos = [
    '09-panel-cace-instituciones.png',
    '10-panel-cace-personalizacion.png',
    '11-panel-cace-certificado.png',
    '12-panel-cace-miembros.png',
  ];
  const acceso = await iniciarSesion('presidencia');
  if (!acceso.ok) {
    marcarFallidas(archivos, acceso.motivo);
    return;
  }

  // 9) Instituciones.
  await capturar({
    archivo: '09-panel-cace-instituciones.png',
    paso: 'Panel de la presidencia · Instituciones',
    selector: '#instituciones (con #cargando-permisos fuera de pantalla)',
    preparar: async () => {
      await abrirPantalla(`${APP}/cace`, {
        selector: '.cace-pantalla',
        descripcion: 'el panel de la CACE',
      });
      await esperarCace('#instituciones', 'la sección Instituciones del panel de la CACE');
      const filas = await sesion
        .esperarValor(EXP.HAY_EN_LISTA('#instituciones .lista-item'), {
          descripcion: 'la lista de instituciones',
          tiempoMaximo: 12000,
        })
        .then(() => sesion.evaluar(EXP.CONTEO_LISTA('#instituciones .lista-item')))
        .catch(() => 0);
      anotarDetalle('09-panel-cace-instituciones.png', `${filas} institución(es) en la lista`);
      await sesion.evaluar(EXP.ARRIBA);
      await desplazarA('#instituciones', 'start');
      await asentar();
    },
  });

  // 10) Personalización: tiene página propia, en el panel general no se repite.
  await capturar({
    archivo: '10-panel-cace-personalizacion.png',
    paso: 'Panel de la presidencia · Personalización',
    selector: '#personalizacion (con #personalizacion-form)',
    preparar: async () => {
      await abrirPantalla(`${APP}/cace/personalizacion`, {
        selector: '.cace-pantalla',
        descripcion: 'la sección Personalización',
      });
      await esperarCace('#personalizacion-form', 'el formulario de Personalización');
      await sesion
        .esperarValor(EXP.HAY_EN_LISTA('#personalizacion-temas .tema-card'), {
          descripcion: 'las paletas de temas',
          tiempoMaximo: 8000,
        })
        .catch(() => false);
      await sesion.evaluar(EXP.ARRIBA);
      await asentar();
    },
  });

  // 11) Certificado: también tiene página propia, con el diseño de la plantilla.
  await capturar({
    archivo: '11-panel-cace-certificado.png',
    paso: 'Panel de la presidencia · Certificado (diseño de la plantilla)',
    selector: '#certificado app-diseno-certificado .lienzo',
    preparar: async () => {
      await abrirPantalla(`${APP}/cace/certificado`, {
        selector: '.cace-pantalla',
        descripcion: 'la sección Certificado',
      });
      await esperarCace('#certificado', 'la sección Certificado del panel de la CACE');
      await sesion.esperarValor(
        `!!document.querySelector('#certificado app-diseno-certificado')`,
        { descripcion: 'el editor del certificado', tiempoMaximo: 12000 },
      );
      await sesion.esperarValor(`!!document.querySelector('#certificado app-diseno-certificado .lienzo')`, {
        descripcion: 'el lienzo del certificado',
        tiempoMaximo: 15000,
      });
      await sesion.evaluar(EXP.ARRIBA);
      await asentar();
    },
  });

  // 12) Miembros, con la presidencia (y su «Cambiar de presidente») debajo.
  //
  // La sección Miembros puede ser más alta que la ventana, así que primero se
  // mide la región que va del principio de «Miembros» al botón «Cambiar de
  // presidente» y se captura esa región entera (`captureBeyondViewport`). Si es
  // desproporcionada, se captura la ventana con el botón a la vista.
  let regionMiembros = null;
  await capturar({
    archivo: '12-panel-cace-miembros.png',
    paso: 'Panel de la presidencia · Miembros (con «Cambiar de presidente»)',
    selector: '#miembros y [data-accion="cambiar-presidente"]',
    recorte: () => regionMiembros,
    preparar: async () => {
      await abrirPantalla(`${APP}/cace`, {
        selector: '.cace-pantalla',
        descripcion: 'el panel de la CACE',
      });
      await esperarCace('#miembros', 'la sección Miembros del panel de la CACE');
      await sesion.esperarValor(`!!document.querySelector('#miembro-correo')`, {
        descripcion: 'el alta de secretarías dentro de Miembros',
        tiempoMaximo: 10000,
      });
      await sesion
        .esperarValor(`!!document.querySelector('[data-accion="cambiar-presidente"]')`, {
          descripcion: 'el botón «Cambiar de presidente»',
          tiempoMaximo: 10000,
        });
      await asentar();

      const region = await sesion.evaluar(EXP.REGION_MIEMBROS);
      if (!region) {
        throw new Error(
          'no se pudo medir la sección Miembros ni el botón «Cambiar de presidente»',
        );
      }
      if (region.height > 2600) {
        // Demasiado alta para una sola imagen: se deja el botón a la vista
        // dentro de la ventana y se captura la ventana.
        await sesion.evaluar(EXP.centrarAbajo('[data-accion="cambiar-presidente"]'));
        await asentar();
        anotarDetalle(
          '12-panel-cace-miembros.png',
          `la sección mide ${Math.round(region.height)} px de alto: se capturó la ventana con «Cambiar de presidente» a la vista`,
        );
        return;
      }
      regionMiembros = region;
      anotarDetalle(
        '12-panel-cace-miembros.png',
        `región Miembros → «Cambiar de presidente» (${Math.round(region.height)} px de alto)`,
      );
    },
  });
}

/** 13: el panel de la secretaría (con menos secciones que el de la presidencia). */
async function tramoSecretaria() {
  const archivos = ['13-panel-secretaria.png'];
  const acceso = await iniciarSesion('secretaria');
  if (!acceso.ok) {
    marcarFallidas(archivos, acceso.motivo);
    return;
  }

  await capturar({
    archivo: '13-panel-secretaria.png',
    paso: 'Panel de la secretaría (menos secciones que la presidencia)',
    selector: '.cace-pantalla[data-capacidades] + #cabecera (sin #instituciones, #miembros ni #certificado)',
    preparar: async () => {
      await abrirPantalla(`${APP}/cace`, {
        selector: '.cace-pantalla',
        descripcion: 'el panel de la CACE',
      });
      const estado = await esperarCace(null, 'el panel de la secretaría');
      await sesion.esperarValor(`!!document.querySelector('#cabecera')`, {
        descripcion: 'la cabecera del panel de la CACE',
      });
      await sesion.evaluar(EXP.ARRIBA);
      await asentar();

      // Se anota lo que ve la secretaría: es la prueba de que tiene menos
      // secciones que la presidencia (no debe haber Instituciones, Miembros ni
      // Certificado). Es informativo: si falla, no impide la captura.
      try {
        const comprobacion = await sesion.evaluar(`(() => {
          const prohibidas = ['instituciones', 'miembros', 'certificado'];
          const presentes = ${EXP.CACE_SECCIONES};
          return {
            secciones: presentes,
            sobran: prohibidas.filter((p) => presentes.indexOf(p) >= 0),
            menu: ${EXP.ETIQUETAS_MENU},
          };
        })()`);
        const nota = [
          `secciones: ${comprobacion.secciones.join(', ') || 'ninguna'}`,
          comprobacion.sobran.length
            ? `AVISO: aparecen secciones que la secretaría no debería ver: ${comprobacion.sobran.join(', ')}`
            : 'sin Instituciones, Miembros ni Certificado',
          `menú: ${comprobacion.menu.join(', ')}`,
        ].join(' · ');
        anotarDetalle('13-panel-secretaria.png', nota);
        registroDe('13-panel-secretaria.png').sobran = comprobacion.sobran;
        registroDe('13-panel-secretaria.png').capacidades = estado.capacidades;
      } catch (error) {
        anotarDetalle(
          '13-panel-secretaria.png',
          `no se pudo leer la lista de secciones de la secretaría: ${error.message}`,
        );
      }
    },
  });
}

// --- Informe ----------------------------------------------------------------

function formatearTamano(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function imprimirInforme(informe) {
  const linea = '─'.repeat(78);
  console.log('');
  console.log('══════════════════════════════════════════════════════════════════════════════');
  console.log('  CAPTURAS DE PANTALLA — Clases Espejo');
  console.log(`  Aplicación: ${APP}     DevTools: ${CDP}`);
  console.log(`  Carpeta:    ${CARPETA}`);
  console.log('══════════════════════════════════════════════════════════════════════════════');

  const grupos = [];
  for (const captura of capturas) {
    if (!grupos.includes(captura.grupo)) grupos.push(captura.grupo);
  }

  for (const captura of capturas) {
    const cubierto = grupoCubierto(captura.grupo);
    let marca;
    if (captura.estado === 'OK') marca = '[OK]   ';
    else if (cubierto) marca = '[nota] ';
    else marca = '[FALLA]';

    console.log('');
    console.log(`  ${marca} ${captura.archivo}  (${formatearTamano(captura.bytes)})`);
    console.log(`          ${captura.paso}`);
    console.log(`          espera: ${captura.selector}`);
    if (captura.estado !== 'OK' && captura.motivo) {
      console.log(`          motivo: ${captura.motivo}`);
    }
    if (captura.detalle) console.log(`          detalle: ${captura.detalle}`);
  }

  console.log('');
  console.log(`── RESUMEN ${linea.slice(10)}`);
  const ok = grupos.filter(grupoCubierto).length;
  const fallidos = grupos.filter((g) => !grupoCubierto(g));
  console.log(`  Puntos del recorrido: ${grupos.length}    Capturados: ${ok}    Con falla: ${fallidos.length}`);
  console.log(`  Intentos de captura:  ${capturas.filter((c) => c.estado === 'OK').length} correctos de ${capturas.length}`);

  const escritos = capturas.filter((c) => c.estado === 'OK' && c.bytes > 0);
  console.log('');
  console.log(`  Archivos escritos (${escritos.length}):`);
  if (escritos.length === 0) console.log('    (ninguno)');
  for (const captura of escritos) {
    console.log(
      `    · ${path.join(CARPETA, captura.archivo)} — ${formatearTamano(captura.bytes)}`,
    );
  }

  if (fallidos.length > 0) {
    console.log('');
    console.log('  Puntos que no se pudieron capturar:');
    for (const grupo of fallidos) {
      const registro = capturas.find((c) => c.grupo === grupo);
      console.log(`    · ${registro.archivo} — ${registro.motivo}`);
    }
  }

  const conAviso = capturas.filter((c) => (c.sobran ?? []).length > 0);
  for (const captura of conAviso) {
    console.log('');
    console.log(`  AVISO en ${captura.archivo}: aparecen secciones que no tocaban → ${captura.sobran.join(', ')}`);
  }

  console.log('');
  console.log(`  Duración: ${informe.segundos} s`);
  console.log('');
}

// --- Puesta en marcha -------------------------------------------------------

/** Comprueba que hay un Chrome escuchando en el puerto de depuración. */
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
    console.error('  chrome.exe --headless=new --remote-debugging-port=9222 --window-size=1440,900');
    console.error('');
    console.error(`Y comprueba que la aplicación responde en ${APP}.`);
    console.error('');
    process.exit(1);
  }
}

async function principal() {
  const inicio = Date.now();
  fs.mkdirSync(CARPETA, { recursive: true });

  const navegador = await comprobarConexion();
  console.log(`Conectado a ${navegador} en ${CDP}.`);
  console.log(`Capturando ${APP} en ${CARPETA} …`);

  sesion = await Sesion.abrir();
  try {
    await sesion.configurar();

    // Cada tramo va aislado: si uno se cortase por algo imprevisto, el resto del
    // recorrido sigue y las capturas que faltaban quedan anotadas.
    const tramos = [
      ['la parte pública', tramoPublico],
      ['el panel del agente', tramoAgente],
      ['el panel del docente y la clase espejo', tramoDocente],
      ['el panel de la presidencia', tramoPresidencia],
      ['el panel de la secretaría', tramoSecretaria],
    ];
    for (const [nombre, tramo] of tramos) {
      try {
        await tramo();
      } catch (error) {
        console.error(`  El tramo «${nombre}» se cortó: ${error.message}`);
        for (const registro of capturas) {
          if (registro.motivo === NO_INTENTADA) {
            registro.motivo = `el tramo «${nombre}» se cortó: ${error.message}`;
          }
        }
      }
    }
  } finally {
    await sesion.cerrar();
  }

  // Las 13 pantallas prometidas: las que no se hayan llegado a intentar quedan
  // anotadas como FALLA en lugar de desaparecer del resumen.
  for (const archivo of [
    '01-acceso.png',
    '02-registro.png',
    '03-verificacion-publica.png',
    '04-panel-agente.png',
    '05-invitacion-docente.png',
    '06-panel-docente.png',
    '07-clase-espejo.png',
    '08-alumnos.png',
    '09-panel-cace-instituciones.png',
    '10-panel-cace-personalizacion.png',
    '11-panel-cace-certificado.png',
    '12-panel-cace-miembros.png',
    '13-panel-secretaria.png',
  ]) {
    registroDe(archivo);
  }

  const grupos = [];
  for (const captura of capturas) {
    if (!grupos.includes(captura.grupo)) grupos.push(captura.grupo);
  }
  const fallidos = grupos.filter((g) => !grupoCubierto(g));

  imprimirInforme({ segundos: Math.round((Date.now() - inicio) / 1000) });
  process.exit(fallidos.length > 0 ? 1 : 0);
}

if (require.main === module) {
  principal().catch((error) => {
    console.error('');
    console.error('El recorrido de capturas no pudo terminar:', error);
    console.error('');
    try {
      if (sesion) void sesion.cerrar();
    } catch {
      /* la pestaña ya no existe */
    }
    imprimirInforme({ segundos: 0 });
    process.exit(1);
  });
}

// Se exportan las expresiones de la página para poder revisarlas (sintaxis) en
// una comprobación aparte; ejecutar el guion no depende de esto.
module.exports = { EXP };
