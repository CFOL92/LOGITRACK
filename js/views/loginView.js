// LOGITRACK - loginView.js
// Vista Login:
// - Inicializa fecha actual
// - Verifica conexión con API
// - Carga ruta del chofer
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
}

/**
 * Carga la ruta del chofer usando CI + chapa + fecha.
 */
export async function cargarRutaChofer(showLoginErrors = true) {
  const ciInput = document.getElementById("ciInput");
  const chapaInput = document.getElementById("chapaInput");
  const fechaInput = document.getElementById("fechaInput");
  const btn = document.getElementById("btnLogin");

  const ci = ciInput ? ciInput.value.trim() : "";
  const chapa = chapaInput ? chapaInput.value.trim().toUpperCase() : "";
  const fecha = fechaInput ? fechaInput.value.trim() : "";

  if (!ci || !chapa || !fecha) {
    if (showLoginErrors) {
      setLoginMsg("Debe ingresar CI, chapa y fecha.", true);
    }
    return;
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
      if (showLoginErrors) {
        setLoginMsg(result.mensaje || "No se pudo cargar la ruta.", true);
      }
      return;
    }

    ocultarLogin();
    activarNavegacion();

    actualizarPanelChofer();
    ejecutarRenderInicial();

    toastLogin(result.mensaje || "Ruta cargada correctamente.", "ok");

  } catch (error) {
    if (showLoginErrors) {
      setLoginMsg("Error al conectar con LOGITRACK:\n" + error.message, true);
    } else {
      toastLogin("Error al refrescar ruta:\n" + error.message, "error");
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Cargar mi ruta";
    }
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

  if (ciInput) ciInput.value = "";
  if (chapaInput) chapaInput.value = "";
  if (fechaInput) fechaInput.value = fechaHoyISO();

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
