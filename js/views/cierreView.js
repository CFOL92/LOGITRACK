// LOGITRACK - cierreView.js
// Vista de cierre de ruta:
// - Muestra avance general
// - Valida pendientes visualmente
// - Lista primeras paradas pendientes
// - Permite ir a pendientes, sincronizar o finalizar ruta

import { state } from "../state.js";
import { calcularEstadoRuta, esParadaPendiente } from "../services/routeService.js";
import { cleanEstado, escapeHtml, formatoNum, formatoGs, toNumber } from "../utils.js";

/**
 * Registra funciones globales para mantener compatibilidad
 * con onclick="window.renderCierre()".
 */
export function registrarCierreView() {
  window.renderCierre = renderCierre;
  window.irAPendientes = irAPendientes;
  window.irAMapaDesdeCierre = irAMapaDesdeCierre;
}

/**
 * Render principal de la vista Cierre.
 */
export function renderCierre() {
  const contenedor = document.getElementById("cierreContent");

  if (!contenedor) {
    console.warn("No existe #cierreContent en index.html.");
    return;
  }

  if (!state.ci || !state.chapa || !state.fecha) {
    contenedor.innerHTML = renderSinRuta();
    return;
  }

  const estado = calcularEstadoRuta();
  const resumen = state.resumen || {};
  const pendientes = obtenerParadasPendientes();
  const puedeCerrar = estado.pendientes <= 0;

  contenedor.innerHTML = `
    ${renderEstadoCierre(estado, puedeCerrar)}
    ${renderResumenCierre(estado, resumen)}
    ${renderPendientesCierre(pendientes, puedeCerrar)}
    ${renderAccionesCierre(puedeCerrar)}
  `;
}

/**
 * Bloque superior: indica si la ruta puede cerrarse.
 */
function renderEstadoCierre(estado, puedeCerrar) {
  if (puedeCerrar) {
    return `
      <div class="cierre-ok">
        Ruta lista para cierre.<br><br>
        Todos los puntos están gestionados. Puedes finalizar la ruta.
      </div>
    `;
  }

  return `
    <div class="cierre-warning">
      No puedes cerrar la ruta todavía.<br><br>
      Pendientes: <b>${estado.pendientes}</b> puntos.<br>
      Gestionados: <b>${estado.gestionados}</b> de <b>${estado.totalPuntos}</b>.
    </div>
  `;
}

/**
 * Tarjetas resumen del cierre.
 */
function renderResumenCierre(estado, resumen) {
  return `
    <div class="progress-card">
      <div class="progress-title">
        <span>Avance para cierre</span>
        <span>${estado.avance}%</span>
      </div>

      <div class="progress-track">
        <div class="progress-fill" style="width:${estado.avance}%"></div>
      </div>

      <div style="margin-top:8px;font-size:11px;color:#64748b;font-weight:800;">
        ${estado.gestionados} gestionados de ${estado.totalPuntos} puntos
      </div>
    </div>

    <div class="quick-grid">
      <div class="quick-card">
        <b>${estado.totalPuntos}</b>
        <span>Total puntos</span>
      </div>

      <div class="quick-card">
        <b>${estado.gestionados}</b>
        <span>Gestionados</span>
      </div>

      <div class="quick-card">
        <b>${estado.pendientes}</b>
        <span>Pendientes</span>
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
        <b>${formatoNum.format(toNumber(resumen.totalPesoKg))}</b>
        <span>Peso kg</span>
      </div>

      <div class="quick-card">
        <b>${formatoGs.format(toNumber(resumen.totalImporte))}</b>
        <span>Importe Gs.</span>
      </div>
    </div>
  `;
}

/**
 * Lista visual de pendientes.
 */
function renderPendientesCierre(pendientes, puedeCerrar) {
  if (puedeCerrar) {
    return `
      <div class="card">
        <div class="card-title">Validación de pendientes</div>
        <div class="card-meta">
          No se detectan paradas pendientes para esta ruta.
        </div>
      </div>
    `;
  }

  const primeros = pendientes.slice(0, 6);

  return `
    <div class="section-title">Primeras paradas pendientes</div>

    ${primeros.map(p => renderPendienteCard(p)).join("")}

    ${pendientes.length > primeros.length ? `
      <div class="empty-state">
        Hay ${pendientes.length - primeros.length} parada(s) pendiente(s) adicional(es).
      </div>
    ` : ""}
  `;
}

/**
 * Tarjeta pequeña de parada pendiente.
 */
function renderPendienteCard(p) {
  const estado = cleanEstado(p.EstadoParada || "PENDIENTE");

  return `
    <div class="stop-card estado-pendiente">
      <div class="stop-top">
        <div class="stop-order">${escapeHtml(p.OrdenPlanificado || "-")}</div>

        <div class="stop-main">
          <div class="stop-name">${escapeHtml(p.Cliente || p.Boca || "Cliente")}</div>

          <div class="stop-meta">
            CodBoca: ${escapeHtml(p.CodBoca || "")}<br>
            ${escapeHtml(p.Ciudad || "")} | ${escapeHtml(p.Zona || "")}<br>
            Facturas: ${p.CantidadFacturas || 0} |
            Productos: ${p.CantidadProductos || 0}<br>
            Peso: ${formatoNum.format(toNumber(p.TotalPesoKg))} kg |
            Pallets: ${formatoNum.format(toNumber(p.TotalPallets))}
          </div>
        </div>

        <span class="badge ${estado}">${estado}</span>
      </div>

      <div class="stop-actions">
        <button class="btn-primary" onclick="window.abrirParadaDesdeLista('${escapeHtml(p.ParadaID || "")}', '${escapeHtml(p.CodBoca || "")}', '${escapeHtml(p.RutaID || "")}')">
          Gestionar
        </button>

        <a class="link-gps" target="_blank" href="https://www.google.com/maps/dir/?api=1&destination=${escapeHtml(p.Latitud || "")},${escapeHtml(p.Longitud || "")}">
          Ir con GPS
        </a>
      </div>
    </div>
  `;
}

/**
 * Botones de cierre.
 */
function renderAccionesCierre(puedeCerrar) {
  return `
    <div class="action-stack">
      <button class="btn-danger" onclick="window.finalizarRuta()" ${puedeCerrar ? "" : ""}>
        🏁 Finalizar ruta
      </button>

      <button class="btn-secondary" onclick="window.irAPendientes()">
        📋 Ver pendientes
      </button>

      <button class="btn-success" onclick="window.irAMapaDesdeCierre()">
        🗺️ Ver mapa
      </button>

      <button class="btn-secondary" onclick="window.refrescarRuta()">
        🔄 Sincronizar
      </button>
    </div>
  `;
}

/**
 * Vista cuando todavía no hay ruta cargada.
 */
function renderSinRuta() {
  return `
    <div class="empty-state">
      No hay una ruta cargada para cerrar.
    </div>
  `;
}

/**
 * Devuelve paradas pendientes.
 */
function obtenerParadasPendientes() {
  return [...(state.paradas || [])]
    .filter(p => esParadaPendiente(p))
    .sort((a, b) => toNumber(a.OrdenPlanificado) - toNumber(b.OrdenPlanificado));
}

/**
 * Lleva al chofer a la vista Ruta filtrada por pendientes.
 */
export function irAPendientes() {
  state.filtroRuta = "PENDIENTE";

  if (typeof window.cambiarVista === "function") {
    window.cambiarVista("ruta");
    return;
  }

  if (typeof window.renderRuta === "function") {
    window.renderRuta();
  }
}

/**
 * Lleva al mapa desde cierre.
 */
export function irAMapaDesdeCierre() {
  if (typeof window.cambiarVista === "function") {
    window.cambiarVista("mapa");
  }
}
