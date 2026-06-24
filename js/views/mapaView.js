// LOGITRACK - mapaView.js
// Vista Mapa:
// - Activa la pantalla de mapa
// - Oculta el appShell
// - Muestra el panel superior del mapa
// - Refresca tamaño de Leaflet
// - Redibuja paradas
// - Actualiza resumen visual del chofer/ruta
//
// Versión 1.7:
// - Corrige visualización del mapa solo en vista Mapa.
// - Evita que el mapa quede visible en Inicio/Ruta/Cierre.
// - Usa mostrarMapa() del mapService.
// - Usa centrarMapaRuta() del mapService.
// - Actualiza estado visual de ruta histórica / solo lectura.
// - Deshabilita botón Finalizar ruta si la ruta está bloqueada.

import { state } from "../state.js";

import {
  dibujarMapa,
  refrescarTamanioMapa,
  centrarMapaRuta,
  mostrarMapa
} from "../services/mapService.js?v=1.7";

import {
  formatoNum,
  escapeHtml,
  toNumber
} from "../utils.js?v=1.7";

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
  window.ocultarTopPanel = ocultarTopPanel;
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

  activarVistaMapa();
}

/**
 * Activa visualmente la vista Mapa.
 * Esta función será llamada desde main.js cuando vista === "mapa".
 */
export function activarVistaMapa() {
  if (!state.ci || !state.chapa || !state.fecha) {
    toastMapaView("No hay ruta cargada para mostrar en el mapa.", "error");
    return;
  }

  state.vistaActiva = "mapa";

  activarBodyMapa();
  mostrarMapaVisual();
  ocultarAppShell();
  mostrarTopPanel();
  activarNavMapa();

  actualizarPanelMapa();

  setTimeout(() => {
    refrescarTamanioMapa();
    dibujarMapa();
  }, 180);
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
    driverName.textContent = chofer.chofer || chofer.nombre || "Chofer";
  }

  if (driverMeta) {
    driverMeta.innerHTML =
      `CI: ${escapeHtml(chofer.ci || state.ci || "")}<br>` +
      `Transportadora: ${escapeHtml(chofer.transportadora || "")}<br>` +
      `Chapa: ${escapeHtml(movil.chapa || state.chapa || "")} | Fecha: ${escapeHtml(state.fecha || "")}<br>` +
      `${renderTextoModoRuta()}`;
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

  actualizarRoutePillMapa();
  actualizarBotonesPanelMapa();
}

/**
 * Centra nuevamente el mapa en toda la ruta.
 */
export function centrarMapaRutaDesdeVista() {
  if (!state.paradas || !state.paradas.length) {
    toastMapaView("No hay paradas cargadas.", "error");
    return;
  }

  centrarMapaRuta();

  setTimeout(() => {
    refrescarTamanioMapa();
  }, 100);
}

/**
 * Navega desde mapa hacia la lista de ruta.
 */
export function irARutaDesdeMapa() {
  if (typeof window.cambiarVista === "function") {
    window.cambiarVista("ruta");
    return;
  }

  desactivarBodyMapa();
  ocultarMapaVisual();
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

  desactivarBodyMapa();
  ocultarMapaVisual();
  ocultarTopPanel();
  mostrarAppShell();
}

/**
 * Activa clase visual global para mostrar mapa.
 */
function activarBodyMapa() {
  document.body.classList.add("mapa-activo");
}

/**
 * Desactiva clase visual global del mapa.
 */
function desactivarBodyMapa() {
  document.body.classList.remove("mapa-activo");
}

/**
 * Muestra mapa físico.
 */
function mostrarMapaVisual() {
  if (typeof mostrarMapa === "function") {
    mostrarMapa();
    return;
  }

  const mapEl = document.getElementById("map");

  if (mapEl) {
    mapEl.style.display = "block";
  }
}

/**
 * Oculta mapa físico.
 */
function ocultarMapaVisual() {
  const mapEl = document.getElementById("map");

  if (mapEl) {
    mapEl.style.display = "none";
  }
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
 * Actualiza etiqueta visual superior de estado de ruta.
 */
function actualizarRoutePillMapa() {
  const routePill = document.getElementById("appRouteStatus");

  if (!routePill) return;

  const modo = String(state.modoConsulta || "OPERATIVO").trim().toUpperCase();

  routePill.classList.remove("historico-pendiente", "historico-cerrado", "solo-lectura", "operativo");

  if (modo === "HISTORICO_PENDIENTE" && !rutaBloqueadaParaGestion()) {
    routePill.textContent = "RUTA HISTÓRICA PENDIENTE";
    routePill.classList.add("historico-pendiente");
    return;
  }

  if (modo === "HISTORICO_CERRADO") {
    routePill.textContent = "RUTA HISTÓRICA CERRADA";
    routePill.classList.add("historico-cerrado");
    return;
  }

  if (state.soloLectura || state.rutaCerrada) {
    routePill.textContent = "SOLO LECTURA";
    routePill.classList.add("solo-lectura");
    return;
  }

  routePill.textContent = "RUTA ACTIVA";
  routePill.classList.add("operativo");
}

/**
 * Deshabilita botones operativos del panel mapa si corresponde.
 */
function actualizarBotonesPanelMapa() {
  const btnFinalizar = document.getElementById("btnFinalizarRuta");

  if (!btnFinalizar) return;

  const bloqueado = rutaBloqueadaParaGestion();

  btnFinalizar.disabled = bloqueado;
  btnFinalizar.title = bloqueado
    ? mensajeRutaBloqueada()
    : "Finalizar ruta";
}

/**
 * Texto adicional del modo de ruta dentro del panel.
 */
function renderTextoModoRuta() {
  const modo = String(state.modoConsulta || "OPERATIVO").trim().toUpperCase();

  if (modo === "HISTORICO_PENDIENTE" && !rutaBloqueadaParaGestion()) {
    return `<span style="color:#b45309;font-weight:700;">Modo: Ruta histórica pendiente editable</span>`;
  }

  if (modo === "HISTORICO_CERRADO") {
    return `<span style="color:#991b1b;font-weight:700;">Modo: Ruta histórica cerrada</span>`;
  }

  if (state.soloLectura || state.rutaCerrada) {
    return `<span style="color:#991b1b;font-weight:700;">Modo: Solo lectura</span>`;
  }

  return `<span style="color:#166534;font-weight:700;">Modo: Operativo</span>`;
}

/**
 * Indica si la ruta debe bloquear acciones.
 */
function rutaBloqueadaParaGestion() {
  const modo = String(state.modoConsulta || "OPERATIVO").trim().toUpperCase();

  return Boolean(
    state.soloLectura === true ||
    state.rutaCerrada === true ||
    modo === "HISTORICO_CERRADO"
  );
}

/**
 * Mensaje de bloqueo.
 */
function mensajeRutaBloqueada() {
  const modo = String(state.modoConsulta || "OPERATIVO").trim().toUpperCase();

  if (modo === "HISTORICO_CERRADO") {
    return "Ruta histórica cerrada. Solo consulta.";
  }

  if (state.rutaCerrada) {
    return "Ruta cerrada. No permite modificaciones.";
  }

  if (state.soloLectura) {
    return "Ruta en solo lectura. No permite modificaciones.";
  }

  return "Ruta bloqueada para gestión.";
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
