// LOGITRACK - loginView.js
// Vista Login:
// - Inicializa fecha actual Paraguay
// - Verifica conexión con API
// - Carga ruta del chofer
// - Mantiene sesión activa con localStorage
// - Autocarga siempre intenta con fecha de hoy
// - Consulta manual respeta la fecha elegida por el usuario
// - Permite consultar rutas históricas si existen en backend
// - Muestra mensajes diferenciados para hoy, histórico y fecha futura
// - Oculta login y habilita la app
// - Actualiza paneles iniciales
//
// Versión 1.6:
// - Fuerza routeService.js, api.js, mapService.js y utils.js con ?v=1.6
// - Evita que el navegador móvil use módulos viejos desde caché

import { state } from "../state.js";
import { apiGet } from "../api.js?v=1.6";
import { cargarRutaDesdeAPI } from "../services/routeService.js?v=1.6";
import { dibujarMapa } from "../services/mapService.js?v=1.6";
import {
  escapeHtml,
  formatoNum,
  fechaHoyISO,
  normalizarFechaISO,
  mensajeSinRutaPorFecha,
  normalizarCI,
  normalizarChapa,
  storageGet,
  storageSet,
  storageRemove
} from "../utils.js?v=1.6";

const SESSION_KEY = "LOGITRACK_SESSION_V1";

/**
 * Registra funciones globales para mantener compatibilidad
 * con onclick="window.cargarRutaChofer(true)".
 */
export function registrarLoginView() {
  window.cargarRutaChofer = cargarRutaChofer;
  window.inicializarLogin = inicializarLogin;
  window.verificarAPI = verificarAPI;
  window.setLoginMsg = setLoginMsg;
  window.actualizarPanelChofer = actualizarPanelChofer;
  window.guardarSesionActiva = guardarSesionActiva;
  window.limpiarSesionActiva = limpiarSesionActiva;
  window.leerSesionActiva = leerSesionActiva;
}

/**
 * Inicializa el login.
 * Debe ejecutarse desde main.js cuando carga la página.
 */
export function inicializarLogin() {
  const fechaInput = document.getElementById("fechaInput");

  if (fechaInput && !fechaInput.value) {
    fechaInput.value = fechaHoyISO();
  }

  verificarAPI();

  /*
    Se restaura después de registrar módulos y tener el DOM listo.
    La autocarga siempre consulta HOY, no una fecha vieja.
  */
  setTimeout(() => {
    restaurarSesionActiva();
  }, 350);
}

/**
 * Restaura la sesión guardada.
 *
 * Regla operativa:
 * - Mantiene CI y chapa guardados.
 * - Si la fecha guardada no es hoy, reemplaza automáticamente por hoy.
 * - Carga automáticamente la ruta de hoy.
 * - La consulta de fechas históricas queda permitida solo cuando el usuario cambia la fecha manualmente.
 */
function restaurarSesionActiva() {
  const sesion = leerSesionActiva();

  if (!sesion || !sesion.mantenerSesion) return;

  const hoy = fechaHoyISO();

  const ci = normalizarCI(sesion.ci || "");
  const chapa = normalizarChapa(sesion.chapa || "");
  const fechaGuardada = normalizarFechaISO(sesion.fecha || "");

  if (!ci || !chapa) return;

  const fechaParaCargar = fechaGuardada === hoy ? fechaGuardada : hoy;

  const ciInput = document.getElementById("ciInput");
  const chapaInput = document.getElementById("chapaInput");
  const fechaInput = document.getElementById("fechaInput");
  const rememberInput = document.getElementById("rememberSessionInput");

  if (ciInput) ciInput.value = ci;
  if (chapaInput) chapaInput.value = chapa;
  if (fechaInput) fechaInput.value = fechaParaCargar;
  if (rememberInput) rememberInput.checked = true;

  guardarSesionActiva({
    ci,
    chapa,
    fecha: fechaParaCargar,
    mantenerSesion: true
  });

  if (fechaGuardada && fechaGuardada !== hoy) {
    setLoginMsg("Sesión activa detectada. Se actualizará la consulta a la ruta de hoy.", false);
  } else {
    setLoginMsg("Sesión activa detectada. Cargando ruta automáticamente...", false);
  }

  setTimeout(() => {
    cargarRutaChofer(false);
  }, 450);
}

/**
 * Carga la ruta del chofer usando CI + chapa + fecha.
 *
 * Importante:
 * - Si se llama automático desde sesión, usa la fecha que ya colocó restaurarSesionActiva().
 * - Si el usuario cambia manualmente la fecha, se respeta esa fecha.
 */
export async function cargarRutaChofer(showLoginErrors = true) {
  const ciInput = document.getElementById("ciInput");
  const chapaInput = document.getElementById("chapaInput");
  const fechaInput = document.getElementById("fechaInput");
  const rememberInput = document.getElementById("rememberSessionInput");
  const btn = document.getElementById("btnLogin");

  const ci = normalizarCI(ciInput ? ciInput.value : "");
  const chapa = normalizarChapa(chapaInput ? chapaInput.value : "");
  const fecha = normalizarFechaISO(fechaInput ? fechaInput.value : "");
  const mantenerSesion = rememberInput ? rememberInput.checked : true;

  if (!ci || !chapa || !fecha) {
    if (showLoginErrors) {
      setLoginMsg("Debe ingresar CI, chapa y fecha.", true);
    }
    return;
  }

  /*
    Guardamos antes de consultar.
    Así, aunque no exista ruta asignada, CI/chapa quedan guardados.
  */
  if (mantenerSesion) {
    guardarSesionActiva({
      ci,
      chapa,
      fecha,
      mantenerSesion: true
    });
  } else {
    limpiarSesionActiva();
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = "Cargando...";
  }

  try {
    const result = await cargarRutaDesdeAPI({
      ci,
      chapa,
      fecha
    });

    console.log("LOGITRACK cargarRutaChofer result:", result);

    if (!result.ok) {
      const mensaje = construirMensajeSinRuta(result, fecha);

      setLoginMsg(mensaje, true);

      if (!showLoginErrors) {
        toastLogin(mensaje, "error");
      }

      return;
    }

    /*
      Si cargó correctamente, actualizamos sesión con la fecha realmente consultada.
      Si fue una consulta histórica manual, se guarda esa fecha, pero al recargar
      restaurarSesionActiva() volverá a consultar hoy automáticamente.
    */
    if (mantenerSesion) {
      guardarSesionActiva({
        ci,
        chapa,
        fecha: result.fechaRuta || fecha,
        mantenerSesion: true
      });
    }

    ocultarLogin();
    activarNavegacion();

    actualizarPanelChofer();
    ejecutarRenderInicial();

    toastLogin(result.mensaje || "Ruta cargada correctamente.", "ok");

  } catch (error) {
    const mensajeError = "Error al conectar con LOGITRACK:\n" + error.message;

    console.error("LOGITRACK error cargarRutaChofer:", error);

    setLoginMsg(mensajeError, true);

    if (!showLoginErrors) {
      toastLogin(mensajeError, "error");
    }

  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Cargar mi ruta";
    }
  }
}

/**
 * Construye mensaje cuando no se encuentra ruta.
 *
 * Regla:
 * - Hoy sin ruta: NO TIENE RUTA ASIGNADA PARA HOY
 * - Fecha anterior sin ruta: NO SE ENCUENTRA REGISTRO HISTORICO DE LA FECHA
 * - Fecha futura sin ruta: NO EXISTE PLANIFICACION PARA LA FECHA SELECCIONADA
 */
function construirMensajeSinRuta(result, fechaConsulta) {
  const mensajeApi = String(result?.mensaje || "").trim();
  const fecha = normalizarFechaISO(fechaConsulta);

  /*
    Si Apps Script ya devuelve un mensaje específico y claro, se respeta.
    Si devuelve mensaje genérico, se reemplaza por el mensaje estándar del frontend.
  */
  if (mensajeApi) {
    const msg = mensajeApi.toUpperCase();

    const esMensajeEspecifico =
      msg.includes("NO TIENE RUTA ASIGNADA PARA HOY") ||
      msg.includes("NO SE ENCUENTRA REGISTRO HISTORICO") ||
      msg.includes("NO EXISTE PLANIFICACION");

    if (esMensajeEspecifico) {
      return mensajeApi;
    }
  }

  return mensajeSinRutaPorFecha(fecha);
}

/**
 * Guarda sesión local.
 */
export function guardarSesionActiva({ ci, chapa, fecha, mantenerSesion }) {
  const payload = {
    ci: normalizarCI(ci || ""),
    chapa: normalizarChapa(chapa || ""),
    fecha: normalizarFechaISO(fecha || ""),
    mantenerSesion: Boolean(mantenerSesion),
    guardadoEn: new Date().toISOString()
  };

  if (!payload.mantenerSesion) {
    limpiarSesionActiva();
    return false;
  }

  if (!payload.ci || !payload.chapa) {
    return false;
  }

  return storageSet(SESSION_KEY, payload);
}

/**
 * Lee sesión local.
 */
function leerSesionActiva() {
  return storageGet(SESSION_KEY, null);
}

/**
 * Borra sesión local.
 */
export function limpiarSesionActiva() {
  return storageRemove(SESSION_KEY);
}

/**
 * Verifica si la API de Apps Script responde.
 */
export async function verificarAPI() {
  const apiStatus = document.getElementById("apiStatus");

  try {
    const data = await apiGet({
      mode: "status"
    });

    if (apiStatus) {
      apiStatus.textContent = data.ok ? "API: CONECTADA" : "API: ERROR";
    }

    return data.ok === true;

  } catch (error) {
    if (apiStatus) {
      apiStatus.textContent = "API: ERROR";
    }

    return false;
  }
}

/**
 * Oculta pantalla de login.
 */
function ocultarLogin() {
  const loginScreen = document.getElementById("loginScreen");

  if (loginScreen) {
    loginScreen.style.display = "none";
  }
}

/**
 * Muestra pantalla de login.
 */
export function mostrarLogin() {
  const loginScreen = document.getElementById("loginScreen");

  if (loginScreen) {
    loginScreen.style.display = "flex";
  }
}

/**
 * Activa menú inferior.
 */
function activarNavegacion() {
  const bottomNav = document.getElementById("bottomNav");

  if (bottomNav) {
    bottomNav.classList.add("active");
  }
}

/**
 * Ejecuta renders iniciales después de cargar la ruta.
 */
function ejecutarRenderInicial() {
  if (typeof window.actualizarAppHeader === "function") {
    window.actualizarAppHeader();
  }

  dibujarMapa();

  if (typeof window.renderInicio === "function") {
    window.renderInicio();
  }

  if (typeof window.renderRuta === "function") {
    window.renderRuta();
  }

  if (typeof window.renderCierre === "function") {
    window.renderCierre();
  }

  if (typeof window.cambiarVista === "function") {
    window.cambiarVista(state.vistaActiva || "inicio");
  }
}

/**
 * Actualiza panel superior del mapa.
 */
export function actualizarPanelChofer() {
  const chofer = state.chofer || {};
  const movil = state.movil || {};
  const resumen = state.resumen || {};

  const driverName = document.getElementById("driverName");
  const driverMeta = document.getElementById("driverMeta");
  const statPuntos = document.getElementById("statPuntos");
  const statFacturas = document.getElementById("statFacturas");
  const statPeso = document.getElementById("statPeso");
  const statPallets = document.getElementById("statPallets");

  if (driverName) {
    driverName.textContent = chofer.chofer || "Chofer";
  }

  if (driverMeta) {
    driverMeta.innerHTML =
      `CI: ${escapeHtml(chofer.ci || state.ci || "")}<br>` +
      `Transportadora: ${escapeHtml(chofer.transportadora || "")}<br>` +
      `Chapa: ${escapeHtml(movil.chapa || state.chapa || "")} | Fecha: ${escapeHtml(state.fecha || "")}`;
  }

  if (statPuntos) {
    statPuntos.textContent = resumen.puntos || state.paradas.length || 0;
  }

  if (statFacturas) {
    statFacturas.textContent = resumen.facturas || 0;
  }

  if (statPeso) {
    statPeso.textContent = formatoNum.format(resumen.totalPesoKg || 0);
  }

  if (statPallets) {
    statPallets.textContent = formatoNum.format(resumen.totalPallets || 0);
  }
}

/**
 * Mensaje visual del login.
 */
export function setLoginMsg(text, isError = false) {
  const el = document.getElementById("loginMsg");

  if (!el) return;

  el.textContent = text;
  el.className = isError ? "login-msg error" : "login-msg";
}

/**
 * Limpia inputs del login.
 */
export function limpiarLoginInputs() {
  const ciInput = document.getElementById("ciInput");
  const chapaInput = document.getElementById("chapaInput");
  const fechaInput = document.getElementById("fechaInput");
  const rememberInput = document.getElementById("rememberSessionInput");

  if (ciInput) ciInput.value = "";
  if (chapaInput) chapaInput.value = "";
  if (fechaInput) fechaInput.value = fechaHoyISO();
  if (rememberInput) rememberInput.checked = true;

  setLoginMsg("Ingrese CI, chapa y fecha para consultar la ruta asignada.", false);
}

/**
 * Toast local del login.
 */
function toastLogin(msg, type) {
  const el = document.getElementById("toast");

  if (!el) {
    alert(msg);
    return;
  }

  el.textContent = msg;
  el.className = "toast active" + (type ? " " + type : "");

  clearTimeout(window.__toastTimer);

  window.__toastTimer = setTimeout(() => {
    el.className = "toast";
  }, type === "error" ? 8000 : 3000);
}
