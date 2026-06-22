// LOGITRACK - mapaView.js
// Vista Mapa:
// - Activa la pantalla de mapa
// - Oculta el appShell
// - Muestra el panel superior del mapa
// - Refresca tamaño de Leaflet
// - Redibuja paradas
// - Actualiza resumen visual del chofer/ruta

import { state } from "../state.js";
import {
  dibujarMapa,
  refrescarTamanioMapa,
  centrarMapaEnRuta
} from "../services/mapService.js";

import {
  formatoNum,
  escapeHtml,
  toNumber
} from "../utils.js";

/**
 * Registra funciones globales para mantener compatibilidad
 * con onclick="window.cambiarVista('mapa')" y acciones del panel.
 */
export function registrarMapaView() {
  window.renderMapa = renderMapa;
  window.activarVistaMapa = activarVistaMapa;
  window.actualizarPanelMapa = actualizarPanelMapa;
  window.centrarMapaRutaDesdeVista = centrarMapaRutaDesdeVista;
  window.irARutaDesdeMapa = irARutaDesdeMapa;
  window.irACierreDesdeMapa = irACierreDesdeMapa;
}

/**
 * Render principal de la vista Mapa.
 * En esta app el mapa no está dentro de appShell;
 * se muestra como capa principal con topPanel activo.
 */
export function renderMapa() {
  if (!state.ci || !state.chapa || !state.fecha) {
    toastMapaView("No hay ruta cargada para mostrar en el mapa.", "error");
    return;
  }

  actualizarPanelMapa();
  refrescarTamanioMapa();
  dibujarMapa();
}

/**
 * Activa visualmente la vista Mapa.
 * Esta función será llamada desde main.js cuando vista === "mapa".
 */
export function activarVistaMapa() {
  ocultarAppShell();
  mostrarTopPanel();
  activarNavMapa();

  actualizarPanelMapa();

  setTimeout(() => {
    refrescarTamanioMapa();
    dibujarMapa();
  }, 150);
}

/**
 * Actualiza el panel superior flotante del mapa.
 */
export function actualizarPanelMapa() {
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
    statPeso.textContent = formatoNum.format(toNumber(resumen.totalPesoKg));
  }

  if (statPallets) {
    statPallets.textContent = formatoNum.format(toNumber(resumen.totalPallets));
  }
}

/**
 * Centra nuevamente el mapa en toda la ruta.
 */
export function centrarMapaRutaDesdeVista() {
  if (!state.paradas || !state.paradas.length) {
    toastMapaView("No hay paradas cargadas.", "error");
    return;
  }

  centrarMapaEnRuta();
}

/**
 * Navega desde mapa hacia la lista de ruta.
 */
export function irARutaDesdeMapa() {
  if (typeof window.cambiarVista === "function") {
    window.cambiarVista("ruta");
    return;
  }

  ocultarTopPanel();
  mostrarAppShell();
}

/**
 * Navega desde mapa hacia cierre.
 */
export function irACierreDesdeMapa() {
  if (typeof window.cambiarVista === "function") {
    window.cambiarVista("cierre");
    return;
  }

  ocultarTopPanel();
  mostrarAppShell();
}

/**
 * Muestra appShell.
 */
function mostrarAppShell() {
  const appShell = document.getElementById("appShell");

  if (appShell) {
    appShell.classList.add("active");
  }
}

/**
 * Oculta appShell.
 */
function ocultarAppShell() {
  const appShell = document.getElementById("appShell");

  if (appShell) {
    appShell.classList.remove("active");
  }
}

/**
 * Muestra panel superior del mapa.
 */
function mostrarTopPanel() {
  const topPanel = document.getElementById("topPanel");

  if (topPanel) {
    topPanel.classList.add("active");
  }
}

/**
 * Oculta panel superior del mapa.
 */
export function ocultarTopPanel() {
  const topPanel = document.getElementById("topPanel");

  if (topPanel) {
    topPanel.classList.remove("active");
  }
}

/**
 * Activa visualmente el botón Mapa del menú inferior.
 */
function activarNavMapa() {
  document.querySelectorAll(".nav-item").forEach(btn => {
    btn.classList.remove("active");
  });

  const navMapa = document.getElementById("navMapa");

  if (navMapa) {
    navMapa.classList.add("active");
  }
}

/**
 * Toast local de la vista mapa.
 */
function toastMapaView(msg, type) {
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
