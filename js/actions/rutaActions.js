// LOGITRACK - rutaActions.js
// Acciones generales de ruta:
// - Refrescar ruta
// - Finalizar ruta
// - Salir / cambiar chofer
// - Limpiar estado de jornada

import { state } from "../state.js";
import { apiGet } from "../api.js";
import { obtenerGPS } from "../services/gpsService.js";

/**
 * Registra funciones en window para mantener compatibilidad
 * con botones HTML tipo onclick="window.finalizarRuta()".
 */
export function registrarRutaActions() {
  window.refrescarRuta = refrescarRuta;
  window.finalizarRuta = finalizarRuta;
  window.salir = salir;
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

  const confirmar = confirm(
    "¿Desea finalizar la ruta?\n\nSolo se permitirá si no existen paradas, facturas o productos pendientes."
  );

  if (!confirmar) return;

  try {
    toastRuta("Validando pendientes...");

    const gps = await obtenerGPS();

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

    toastRuta(data.mensaje || "Ruta cerrada correctamente.", "ok");

    if (typeof window.cargarRutaChofer === "function") {
      await window.cargarRutaChofer(false);
    }

  } catch (error) {
    toastRuta("Error al finalizar ruta:\n" + error.message, "error");
  }
}

/**
 * Cambia de chofer / vuelve al login.
 */
export function salir() {
  const confirmar = confirm("¿Cambiar de chofer?");
  if (!confirmar) return;

  limpiarEstadoRuta();

  if (typeof window.cerrarPanel === "function") {
    window.cerrarPanel();
  }

  if (typeof window.limpiarMapa === "function") {
    window.limpiarMapa();
  }

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
function setLoginMsgRuta(text, isError) {
  const el = document.getElementById("loginMsg");

  if (!el) return;

  el.textContent = text;
  el.className = isError ? "login-msg error" : "login-msg";
}

/**
 * Toast local del módulo.
 * Más adelante se puede mover a utils.js para reutilizarlo.
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
