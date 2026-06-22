// LOGITRACK - loginView.js
// Vista Login:
// - Inicializa fecha actual
// - Verifica conexión con API
// - Carga ruta del chofer
// - Mantiene sesión activa con localStorage
// - Si la fecha guardada no es hoy, consulta automáticamente la ruta de hoy
// - Muestra mensajes diferenciados para ruta de hoy e histórico
// - Oculta login y habilita la app
// - Actualiza paneles iniciales

import { state } from "../state.js";
import { apiGet } from "../api.js";
import { cargarRutaDesdeAPI } from "../services/routeService.js";
import { dibujarMapa } from "../services/mapService.js";
import {
  escapeHtml,
  formatoNum,
  fechaHoyISO
} from "../utils.js";

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

  setTimeout(() => {
    restaurarSesionActiva();
  }, 250);
}

/**
 * Restaura la sesión guardada.
 *
 * Regla:
 * - Si hay CI/chapa guardados, se reutilizan.
 * - Si la fecha guardada no es la fecha actual, se cambia automáticamente a hoy.
 * - Luego intenta cargar la ruta automáticamente.
 */
function restaurarSesionActiva() {
  const sesion = leerSesionActiva();

  if (!sesion || !sesion.mantenerSesion) return;

  const hoy = fechaHoyISO();

  const ci = String(sesion.ci || "").trim();
  const chapa = String(sesion.chapa || "").trim().toUpperCase();
  const fechaGuardada = String(sesion.fecha || "").trim();

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
    setLoginMsg("Sesión activa detectada. La fecha anterior no es de hoy; consultando la ruta actual...", false);
  } else {
    setLoginMsg("Sesión activa detectada. Cargando ruta automáticamente...", false);
  }

  setTimeout(() => {
    cargarRutaChofer(false);
  }, 400);
}

/**
 * Carga la ruta del chofer usando CI + chapa + fecha.
 */
export async function cargarRutaChofer(showLoginErrors = true) {
  const ciInput = document.getElementById("ciInput");
  const chapaInput = document.getElementById("chapaInput");
  const fechaInput = document.getElementById("fechaInput");
  const rememberInput = document.getElementById("rememberSessionInput");
  const btn = document.getElementById("btnLogin");

  const ci = ciInput ? ciInput.value.trim() : "";
  const chapa = chapaInput ? chapaInput.value.trim().toUpperCase() : "";
  const fecha = fechaInput ? fechaInput.value.trim() : "";
  const mantenerSesion = rememberInput ? rememberInput.checked : true;

  if (!ci || !chapa || !fecha) {
    if (showLoginErrors) {
      setLoginMsg("Debe ingresar CI, chapa y fecha.", true);
    }
    return;
  }

  /*
    Guardamos antes de consultar.
    Así, aunque el chofer no tenga ruta asignada, no vuelve a cargar CI/chapa.
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

    if (!result.ok) {
      const mensaje = construirMensajeSinRuta(result, fecha);

      setLoginMsg(mensaje, true);

      if (!showLoginErrors) {
        toastLogin(mensaje, "error");
      }

      return;
    }

    /*
      Si cargó correctamente y el usuario quiere mantener sesión,
      actualizamos la sesión con los datos definitivos.
    */
    if (mantenerSesion) {
      guardarSesionActiva({
        ci,
        chapa,
        fecha,
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

    if (showLoginErrors) {
      setLoginMsg(mensajeError, true);
    } else {
      setLoginMsg(mensajeError, true);
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
 */
function construirMensajeSinRuta(result, fechaConsulta) {
  const mensajeApi = String(result?.mensaje || "").trim();

  if (mensajeApi) {
    const mensajeNormalizado = mensajeApi.toUpperCase();

    if (
      mensajeNormalizado.includes("NO TIENE RUTA") ||
      mensajeNormalizado.includes("NO SE ENCUENTRA") ||
      mensajeNormalizado.includes("NO HAY")
    ) {
      return mensajeApi;
    }
  }

  const hoy = fechaHoyISO();

  if (fechaConsulta === hoy) {
    return "NO TIENE RUTA ASIGNADA PARA HOY";
  }

  return "NO SE ENCUENTRA REGISTRO HISTORICO DE LA FECHA";
}

/**
 * Guarda sesión local.
 */
export function guardarSesionActiva({ ci, chapa, fecha, mantenerSesion }) {
  try {
    const payload = {
      ci: String(ci || "").trim(),
      chapa: String(chapa || "").trim().toUpperCase(),
      fecha: String(fecha || "").trim(),
      mantenerSesion: Boolean(mantenerSesion),
      guardadoEn: new Date().toISOString()
    };

    localStorage.setItem(SESSION_KEY, JSON.stringify(payload));

  } catch (error) {
    console.warn("No se pudo guardar la sesión:", error);
  }
}

/**
 * Lee sesión local.
 */
function leerSesionActiva() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);

    if (!raw) return null;

    return JSON.parse(raw);

  } catch (error) {
    console.warn("No se pudo leer la sesión:", error);
    return null;
  }
}

/**
 * Borra sesión local.
 */
export function limpiarSesionActiva() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch (error) {
    console.warn("No se pudo limpiar la sesión:", error);
  }
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
