// LOGITRACK - inicioView.js
// Vista Inicio:
// - Resumen general de la ruta
// - Progreso de jornada
// - Acciones rápidas
// - Header del chofer/ruta

import { state } from "../state.js";
import { calcularEstadoRuta } from "../services/routeService.js";
import {
  escapeHtml,
  formatoNum,
  formatoGs,
  toNumber
} from "../utils.js";

/**
 * Registra funciones globales para mantener compatibilidad
 * mientras terminamos la migración modular.
 */
export function registrarInicioView() {
  window.renderInicio = renderInicio;
  window.actualizarAppHeader = actualizarAppHeader;
}

/**
 * Render principal de la vista Inicio.
 */
export function renderInicio() {
  const contenedor = document.getElementById("inicioContent");

  if (!contenedor) {
    console.warn("No existe #inicioContent en index.html.");
    return;
  }

  if (!state.ci || !state.chapa || !state.fecha) {
    contenedor.innerHTML = renderSinRuta();
    return;
  }

  const resumen = state.resumen || {};
  const estado = calcularEstadoRuta();

  contenedor.innerHTML = `
    ${renderBloqueProgreso(estado)}
    ${renderResumenOperativo(estado, resumen)}
    ${renderDatosChofer()}
    ${renderAccionesRapidas()}
  `;
}

/**
 * Actualiza el encabezado superior de la app.
 */
export function actualizarAppHeader() {
  const chofer = state.chofer || {};
  const movil = state.movil || {};

  const appDriverMeta = document.getElementById("appDriverMeta");
  const appRouteStatus = document.getElementById("appRouteStatus");

  if (appDriverMeta) {
    appDriverMeta.innerHTML =
      `${escapeHtml(chofer.chofer || "Chofer")}<br>` +
      `Chapa: ${escapeHtml(movil.chapa || state.chapa || "")} | Fecha: ${escapeHtml(state.fecha || "")}`;
  }

  if (appRouteStatus) {
    const estado = calcularEstadoRuta();

    if (estado.totalPuntos <= 0) {
      appRouteStatus.textContent = "Sin ruta";
      return;
    }

    if (estado.pendientes <= 0) {
      appRouteStatus.textContent = "Lista para cierre";
      return;
    }

    appRouteStatus.textContent = "Ruta activa";
  }
}

/**
 * Bloque de progreso general.
 */
function renderBloqueProgreso(estado) {
  return `
    <div class="progress-card">
      <div class="progress-title">
        <span>Progreso de ruta</span>
        <span>${estado.gestionados}/${estado.totalPuntos} puntos</span>
      </div>

      <div class="progress-track">
        <div class="progress-fill" style="width:${estado.avance}%"></div>
      </div>

      <div style="margin-top:8px;font-size:11px;color:#64748b;font-weight:800;">
        Avance: ${estado.avance}%
      </div>
    </div>
  `;
}

/**
 * Tarjetas resumen principales.
 */
function renderResumenOperativo(estado, resumen) {
  return `
    <div class="quick-grid">
      <div class="quick-card">
        <b>${estado.pendientes}</b>
        <span>Puntos pendientes</span>
      </div>

      <div class="quick-card">
        <b>${estado.entregados}</b>
        <span>Entregados</span>
      </div>

      <div class="quick-card">
        <b>${estado.parciales}</b>
        <span>Parciales</span>
      </div>

      <div class="quick-card">
        <b>${estado.rechazados}</b>
        <span>Rechazados</span>
      </div>

      <div class="quick-card">
        <b>${resumen.facturas || 0}</b>
        <span>Facturas</span>
      </div>

      <div class="quick-card">
        <b>${resumen.productos || 0}</b>
        <span>Productos</span>
      </div>

      <div class="quick-card">
        <b>${formatoNum.format(toNumber(resumen.totalPesoKg))}</b>
        <span>Peso kg</span>
      </div>

      <div class="quick-card">
        <b>${formatoNum.format(toNumber(resumen.totalPallets))}</b>
        <span>Pallets</span>
      </div>

      <div class="quick-card">
        <b>${formatoNum.format(toNumber(resumen.totalVolumenM3))}</b>
        <span>Volumen m3</span>
      </div>

      <div class="quick-card">
        <b>${formatoGs.format(toNumber(resumen.totalImporte))}</b>
        <span>Importe Gs.</span>
      </div>
    </div>
  `;
}

/**
 * Datos principales del chofer y móvil.
 */
function renderDatosChofer() {
  const chofer = state.chofer || {};
  const movil = state.movil || {};
  const resumen = state.resumen || {};

  return `
    <div class="card">
      <div class="card-header">
        <div>
          <div class="card-title">Datos de jornada</div>

          <div class="card-meta">
            Chofer: ${escapeHtml(chofer.chofer || "-")}<br>
            CI: ${escapeHtml(chofer.ci || state.ci || "-")}<br>
            Transportadora: ${escapeHtml(chofer.transportadora || "-")}<br>
            Chapa: ${escapeHtml(movil.chapa || state.chapa || "-")}<br>
            Fecha: ${escapeHtml(state.fecha || "-")}<br>
            Puntos asignados: ${escapeHtml(resumen.puntos || state.paradas.length || 0)}
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Acciones rápidas de inicio.
 */
function renderAccionesRapidas() {
  return `
    <div class="action-stack">
      <button class="btn-primary" onclick="window.cambiarVista('ruta')">
        📋 Ver mi ruta
      </button>

      <button class="btn-success" onclick="window.cambiarVista('mapa')">
        🗺️ Ver mapa
      </button>

      <button class="btn-secondary" onclick="window.refrescarRuta()">
        🔄 Sincronizar datos
      </button>

      <button class="btn-danger" onclick="window.cambiarVista('cierre')">
        🏁 Ir al cierre
      </button>
    </div>
  `;
}

/**
 * Vista cuando no hay ruta cargada.
 */
function renderSinRuta() {
  return `
    <div class="empty-state">
      No hay una ruta cargada.<br><br>
      Vuelve al login e ingresa CI, chapa y fecha.
    </div>
  `;
}
