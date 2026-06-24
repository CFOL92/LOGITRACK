// LOGITRACK - rutaActions.js
// Acciones generales de ruta:
// - Refrescar ruta
// - Finalizar ruta
// - Cerrar sesión
// - Salir / cambiar chofer
// - Limpiar estado de jornada
// - Limpiar sesión local guardada
//
// Versión 1.6 - Fase 1.2-A:
// - Bloquea finalizar ruta si está en soloLectura.
// - Bloquea finalizar ruta si la ruta está cerrada.
// - Bloquea finalizar ruta si modoConsulta = HISTORICO_CERRADO.
// - Mantiene HISTORICO_PENDIENTE editable si soloLectura=false.
// - Evita doble ejecución por doble clic.
// - Limpia metadata de ruta al cerrar sesión.

import { state } from "../state.js";
import { apiGet } from "../api.js?v=1.6";
import { obtenerGPS } from "../services/gpsService.js";
import { fechaHoyISO } from "../utils.js?v=1.6";

const SESSION_KEY = "LOGITRACK_SESSION_V1";

let finalizacionEnCurso = false;

/**
 * Registra funciones en window para mantener compatibilidad
 * con botones HTML tipo onclick="window.finalizarRuta()".
 */
export function registrarRutaActions() {
  window.refrescarRuta = refrescarRuta;
  window.finalizarRuta = finalizarRuta;
  window.salir = salir;
  window.cerrarSesion = cerrarSesion;
  window.limpiarEstadoRuta = limpiarEstadoRuta;

  window.rutaBloqueadaParaFinalizar = rutaBloqueadaParaFinalizar;
  window.validarContextoRutaGeneral = validarContextoRuta;
}

/**
 * Refresca la ruta actual usando los datos ya cargados:
 * CI + chapa + fecha.
 */
export async function refrescarRuta() {
  if (!state.ci || !state.chapa || !state.fecha) {
    toastRuta("No hay una ruta activa para refrescar.", "error");
    return;
  }

  if (typeof window.cargarRutaChofer === "function") {
    await window.cargarRutaChofer(false);
    return;
  }

  toastRuta("La función cargarRutaChofer todavía no está registrada.", "error");
}

/**
 * Finaliza la ruta.
 * El backend debe validar si existen pendientes.
 */
export async function finalizarRuta() {
  if (!validarContextoRuta()) return;

  if (rutaBloqueadaParaFinalizar()) {
    toastRuta(mensajeRutaBloqueada(), "error");
    return;
  }

  if (finalizacionEnCurso) {
    toastRuta("La finalización de ruta ya está en proceso. Aguarde...", "error");
    return;
  }

  const confirmar = confirm(
    "¿Desea finalizar la ruta?\n\nSolo se permitirá si no existen paradas, facturas o productos pendientes."
  );

  if (!confirmar) return;

  finalizacionEnCurso = true;

  try {
    toastRuta("Validando pendientes...");

    const gps = await obtenerGPSSeguro();

    const data = await apiGet({
      mode: "finalizarRuta",
      ci: state.ci,
      chapa: state.chapa,
      fecha: state.fecha,
      lat: gps.lat,
      lng: gps.lng,
      precision: gps.precision
    });

    if (!data.ok) {
      const mensaje = construirMensajePendientes(data);
      toastRuta(mensaje, "error");

      if (typeof window.renderCierre === "function") {
        window.renderCierre();
      }

      return;
    }

    state.rutaCerrada = true;
    state.soloLectura = true;

    toastRuta(data.mensaje || "Ruta cerrada correctamente.", "ok");

    if (typeof window.cargarRutaChofer === "function") {
      await window.cargarRutaChofer(false);
    }

  } catch (error) {
    console.error("LOGITRACK finalizarRuta error:", error);
    toastRuta("Error al finalizar ruta:\n" + (error.message || error), "error");

  } finally {
    finalizacionEnCurso = false;
  }
}

/**
 * Cierra sesión real:
 * - Borra sesión guardada
 * - Limpia estado
 * - Limpia mapa/paneles
 * - Vuelve al login
 */
export function cerrarSesion() {
  const confirmar = confirm("¿Desea cerrar la sesión de LOGITRACK en este dispositivo?");

  if (!confirmar) return;

  limpiarSesionLocal();
  limpiarEstadoRuta();
  volverLogin();

  toastRuta("Sesión cerrada correctamente.", "ok");
}

/**
 * Cambiar chofer:
 * también borra sesión guardada para evitar autocarga
 * con el chofer anterior.
 */
export function salir() {
  const confirmar = confirm("¿Cambiar de chofer?");

  if (!confirmar) return;

  limpiarSesionLocal();
  limpiarEstadoRuta();
  volverLogin();

  toastRuta("Puede ingresar otro chofer.", "ok");
}

/**
 * Vuelve visualmente al login.
 */
function volverLogin() {
  cerrarPanelesVisuales();
  limpiarMapaVisual();
  limpiarVistasVisuales();
  limpiarInputsLoginVisual();

  const topPanel = document.getElementById("topPanel");
  const appShell = document.getElementById("appShell");
  const bottomNav = document.getElementById("bottomNav");
  const loginScreen = document.getElementById("loginScreen");

  if (topPanel) topPanel.classList.remove("active");
  if (appShell) appShell.classList.remove("active");
  if (bottomNav) bottomNav.classList.remove("active");
  if (loginScreen) loginScreen.style.display = "flex";

  setLoginMsgRuta("Ingrese CI, chapa y fecha para consultar la ruta asignada.", false);
}

/**
 * Cierra panel lateral si existe.
 */
function cerrarPanelesVisuales() {
  if (typeof window.cerrarPanel === "function") {
    window.cerrarPanel();
  }

  if (typeof window.cerrarTodoPanel === "function") {
    window.cerrarTodoPanel();
  }

  const sidePanel = document.getElementById("sidePanel");

  if (sidePanel) {
    sidePanel.classList.remove("active");
  }
}

/**
 * Limpia mapa si el servicio está disponible.
 */
function limpiarMapaVisual() {
  if (typeof window.limpiarMapa === "function") {
    window.limpiarMapa();
  }

  if (typeof window.limpiarGPS === "function") {
    window.limpiarGPS();
  }
}

/**
 * Limpia contenedores visuales para evitar datos anteriores.
 */
function limpiarVistasVisuales() {
  const inicioContent = document.getElementById("inicioContent");
  const rutaContent = document.getElementById("rutaContent");
  const cierreContent = document.getElementById("cierreContent");
  const mapaContent = document.getElementById("mapaContent");
  const sideBody = document.getElementById("sideBody");
  const sideTitle = document.getElementById("sideTitle");
  const sideSubtitle = document.getElementById("sideSubtitle");
  const appDriverMeta = document.getElementById("appDriverMeta");
  const appRouteStatus = document.getElementById("appRouteStatus");
  const apiStatus = document.getElementById("apiStatus");

  if (inicioContent) inicioContent.innerHTML = "";
  if (rutaContent) rutaContent.innerHTML = "";
  if (cierreContent) cierreContent.innerHTML = "";
  if (mapaContent) mapaContent.innerHTML = "";
  if (sideBody) sideBody.innerHTML = "";
  if (sideTitle) sideTitle.textContent = "Detalle";
  if (sideSubtitle) sideSubtitle.textContent = "";
  if (appDriverMeta) appDriverMeta.textContent = "Ruta no cargada";
  if (appRouteStatus) appRouteStatus.textContent = "Ruta activa";
  if (apiStatus) apiStatus.textContent = "API: CONECTANDO...";

  limpiarNavVisual();
}

/**
 * Limpia navegación inferior.
 */
function limpiarNavVisual() {
  const navs = ["navInicio", "navRuta", "navMapa", "navCierre"];

  navs.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove("active");
  });

  const navInicio = document.getElementById("navInicio");

  if (navInicio) {
    navInicio.classList.add("active");
  }

  document.querySelectorAll(".app-view").forEach(view => {
    view.classList.remove("active");
  });

  const inicioView = document.getElementById("viewInicio");
  if (inicioView) inicioView.classList.add("active");
}

/**
 * Limpia inputs del login al cerrar sesión o cambiar chofer.
 */
function limpiarInputsLoginVisual() {
  const ciInput = document.getElementById("ciInput");
  const chapaInput = document.getElementById("chapaInput");
  const fechaInput = document.getElementById("fechaInput");
  const rememberInput = document.getElementById("rememberSessionInput");

  if (ciInput) ciInput.value = "";
  if (chapaInput) chapaInput.value = "";
  if (fechaInput) fechaInput.value = fechaHoyISO();

  if (rememberInput) {
    rememberInput.checked = true;
  }
}

/**
 * Borra sesión local guardada.
 */
function limpiarSesionLocal() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch (error) {
    console.warn("No se pudo limpiar la sesión local:", error);
  }
}

/**
 * Limpia el estado global de la ruta.
 */
export function limpiarEstadoRuta() {
  state.ci = "";
  state.chapa = "";
  state.fecha = "";

  state.chofer = null;
  state.movil = null;
  state.resumen = null;

  state.paradas = [];
  state.paradasMap = {};

  state.facturasCache = {};
  state.productosCache = {};

  state.paradaActiva = null;
  state.facturaActiva = null;

  state.vistaActiva = "inicio";
  state.filtroRuta = "TODOS";
  state.busquedaRuta = "";
  state.ordenRuta = "PLANIFICADO";

  state.gpsActivo = false;
  state.ultimaUbicacion = null;
  state.trackingActivo = false;

  state.modoConsulta = "OPERATIVO";
  state.soloLectura = false;
  state.codigoRuta = "";
  state.fuenteDatos = "";
  state.rutaCerrada = false;

  state.cargandoRuta = false;
  state.ultimaSincronizacion = null;
  state.errorActual = null;

  finalizacionEnCurso = false;
}

/**
 * Valida si hay una ruta activa.
 */
function validarContextoRuta() {
  if (!state.ci || !state.chapa || !state.fecha) {
    toastRuta("No hay una ruta activa. Vuelve a cargar la ruta.", "error");
    return false;
  }

  return true;
}

/**
 * Determina si la ruta está bloqueada para finalizar.
 *
 * Reglas:
 * - OPERATIVO: permite finalizar.
 * - HISTORICO_PENDIENTE + soloLectura=false: permite finalizar.
 * - HISTORICO_CERRADO: bloquea.
 * - soloLectura=true: bloquea.
 * - rutaCerrada=true: bloquea.
 */
function rutaBloqueadaParaFinalizar() {
  const modo = String(state.modoConsulta || "OPERATIVO").trim().toUpperCase();

  return Boolean(
    state.soloLectura === true ||
    state.rutaCerrada === true ||
    modo === "HISTORICO_CERRADO"
  );
}

/**
 * Mensaje visible cuando la ruta no permite finalizar.
 */
function mensajeRutaBloqueada() {
  const modo = String(state.modoConsulta || "OPERATIVO").trim().toUpperCase();

  if (modo === "HISTORICO_CERRADO") {
    return "Esta ruta histórica ya está cerrada. Solo se permite consultar.";
  }

  if (state.rutaCerrada) {
    return "La ruta ya está cerrada. No se puede finalizar nuevamente.";
  }

  if (state.soloLectura) {
    return "La ruta está en modo solo lectura. No se puede finalizar.";
  }

  return "La ruta no permite cierre en este momento.";
}

/**
 * Obtiene GPS de forma controlada.
 */
async function obtenerGPSSeguro() {
  const gps = await obtenerGPS();

  return {
    lat: gps?.lat ?? "",
    lng: gps?.lng ?? "",
    precision: gps?.precision ?? ""
  };
}

/**
 * Construye el mensaje visual cuando el cierre no está permitido.
 */
function construirMensajePendientes(data) {
  const pendientes = data.pendientes || {};

  let msg = data.mensaje || "No se puede cerrar la ruta.";

  msg += `\n\nParadas pendientes: ${pendientes.paradas || 0}`;
  msg += `\nFacturas pendientes: ${pendientes.facturas || 0}`;
  msg += `\nProductos pendientes: ${pendientes.productos || 0}`;

  if (data.primerosPendientes && data.primerosPendientes.length) {
    msg += "\n\nPrimeros pendientes:";

    data.primerosPendientes.forEach(p => {
      msg += `\n- Fact ${p.NumFactura || ""} | ${p.Boca || ""} | ${p.CodProducto || ""}`;
    });
  }

  return msg;
}

/**
 * Actualiza el mensaje del login.
 */
function setLoginMsgRuta(text, isError = false) {
  const el = document.getElementById("loginMsg");

  if (!el) return;

  el.textContent = text;
  el.className = isError ? "login-msg error" : "login-msg";
}

/**
 * Toast local del módulo.
 */
function toastRuta(msg, type) {
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
