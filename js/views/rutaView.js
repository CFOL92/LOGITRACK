// LOGITRACK - rutaView.js
// Versión 2.0 (Refactor Pro - Itinerario Inteligente)
//
// Mejoras lógicas:
// - Separa la "Próxima Parada" del resto del itinerario.
// - Minimiza visualmente las paradas ya gestionadas (Historial).
// - Genera barra de progreso dinámica.
// - Implementa navegación por Chips (Filtros horizontales nativos).
// - Mantiene compatibilidad absoluta con la v1.9 original.

import { state } from "../state.js";

import {
  obtenerParadasFiltradas,
  calcularEstadoRuta,
  esParadaPendiente
} from "../services/routeService.js";

import {
  abrirPopupParada
} from "../services/mapService.js";

import {
  cleanEstado,
  escapeHtml,
  escapeAttr,
  formatoNum,
  formatoGs,
  toNumber
} from "../utils.js";

/**
 * Registra funciones globales para mantener compatibilidad con DOM.
 */
export function registrarRutaView() {
  window.renderRuta = renderRuta;
  window.renderResultadoRuta = renderResultadoRuta;
  window.filtrarRuta = filtrarRuta;
  window.buscarRuta = buscarRuta;
  window.cambiarOrdenRuta = cambiarOrdenRuta;
  window.limpiarBusquedaRuta = limpiarBusquedaRuta;
  window.abrirParadaDesdeLista = abrirParadaDesdeLista;
  window.verParadaEnMapa = verParadaEnMapa;
  window.toastRutaView = toastRutaView;
}

/**
 * Render principal de la vista Ruta.
 */
export function renderRuta() {
  const contenedor = document.getElementById("rutaContent");
  if (!contenedor) return;

  if (!state.ruta || !Array.isArray(state.paradas) || state.paradas.length === 0) {
    contenedor.innerHTML = renderSinRuta();
    return;
  }

  // Prepara estado inicial si no existen filtros
  if (!state.filtroRuta) state.filtroRuta = "TODOS";
  if (!state.busquedaRuta) state.busquedaRuta = "";

  const html = `
    ${renderResumenProgreso()}
    ${renderBuscador()}
    ${renderFiltrosChips()}
    <div id=\"rutaResultados\">
      ${renderTarjetasInteligentes()}
    </div>
  `;

  contenedor.innerHTML = html;
}

/**
 * Renderiza solo los resultados (útil al escribir en el buscador o filtrar).
 */
export function renderResultadoRuta() {
  const contenedor = document.getElementById("rutaResultados");
  if (!contenedor) return;
  contenedor.innerHTML = renderTarjetasInteligentes();
}

/**
 * 1. RESUMEN Y BARRA DE PROGRESO
 */
function renderResumenProgreso() {
  const stats = calcularEstadoRuta() || {};
  const total = toNumber(stats.totalParadas);
  const gestionadas = toNumber(stats.entregadas) + toNumber(stats.rechazadas);
  
  // Calcula porcentaje para la barra visual (CSS: .progress-fill)
  let porcentaje = 0;
  if (total > 0) {
    porcentaje = Math.round((gestionadas / total) * 100);
  }

  return `
    <div class="route-summary">
      <div class="route-summary-title">Avance de Ruta</div>
      <div class="route-summary-meta">Completado: ${gestionadas} de ${total} clientes (${porcentaje}%)</div>
      <div class="progress-track">
        <div class="progress-fill" style="width: ${porcentaje}%"></div>
      </div>
    </div>
  `;
}

/**
 * 2. BUSCADOR (Limpio y directo)
 */
function renderBuscador() {
  const val = escapeAttr(state.busquedaRuta || "");
  return `
    <div class="route-search-box">
      <div class="form-group" style="margin: 0;">
        <input 
          id="rutaSearchInput" 
          type="text" 
          placeholder="Buscar cliente, dirección o CodBoca..." 
          value="${val}"
          oninput="window.buscarRuta(this.value)"
          autocomplete="off"
        />
      </div>
    </div>
  `;
}

/**
 * 3. FILTROS CHIPS (Estilo App Nativa)
 */
function renderFiltrosChips() {
  const actual = String(state.filtroRuta || "TODOS").toUpperCase();
  const stats = calcularEstadoRuta() || {};

  const chips = [
    { id: "TODOS", label: `Todos (${stats.totalParadas || 0})` },
    { id: "PENDIENTE", label: `Pendientes (${stats.pendientes || 0})` },
    { id: "ENTREGADO", label: `Entregados (${stats.entregadas || 0})` },
    { id: "RECHAZADO", label: `Rechazados (${stats.rechazadas || 0})` }
  ];

  const htmlChips = chips.map(c => {
    const active = c.id === actual ? "active" : "";
    return `<button type="button" class="filter-chip ${active}" onclick="window.filtrarRuta('${c.id}')">${c.label}</button>`;
  }).join("");

  return `
    <div class="route-filters">
      ${htmlChips}
    </div>
  `;
}

/**
 * 4. RENDER DE TARJETAS INTELIGENTE (El Motor del Itinerario)
 */
function renderTarjetasInteligentes() {
  const paradas = obtenerParadasFiltradas() || [];

  if (paradas.length === 0) {
    return renderSinResultados();
  }

  let html = "";
  let proximaParadaEncontrada = false;

  paradas.forEach((parada) => {
    const estado = cleanEstado(parada.Estado || "PENDIENTE");
    const esPendiente = estado === "PENDIENTE";
    
    // Identificar la "Próxima Parada" (La primera pendiente de la lista)
    const esProxima = esPendiente && !proximaParadaEncontrada && (state.filtroRuta === "TODOS" || state.filtroRuta === "PENDIENTE");
    
    if (esProxima) {
      proximaParadaEncontrada = true;
      html += `<div class="route-count">📍 Siguiente destino</div>`;
      html += generarTarjeta(parada, estado, true);
      html += `<div class="route-count" style="margin-top:20px;">📋 Resto del itinerario</div>`;
    } else {
      // Las paradas ya entregadas/rechazadas se renderizan en formato "minimizado"
      const minimizar = !esPendiente;
      html += generarTarjeta(parada, estado, false, minimizar);
    }
  });

  return html;
}

/**
 * GENERADOR DE TARJETA HTML
 */
function generarTarjeta(parada, estadoLimpio, esDestacada, minimizada = false) {
  const pId = escapeAttr(parada.ParadaID || "");
  const cb = escapeAttr(parada.CodBoca || "");
  const rId = escapeAttr(parada.RutaID || "");
  
  // Clases CSS dinámicas para pintar el borde lateral y minimizar historial
  const claseEstado = `estado-${estadoLimpio.toLowerCase().replace("_", "-")}`;
  const claseMinimizada = minimizada ? "opacity: 0.75;" : "";
  
  const nombreCliente = escapeHtml(parada.Cliente || "Cliente sin nombre");
  const direccion = escapeHtml(parada.Direccion || "Sin dirección");
  const orden = escapeHtml(parada.OrdenPlanificado || "-");

  // Mostrar aviso naranja si hay productos en la parada
  let htmlAlerta = "";
  if (parada._tieneProductos) {
    htmlAlerta = `<div class="product-line">📦 Contiene productos específicos</div>`;
  }

  // Renderizar Acciones (Si está minimizada, ocultamos el botón GPS para limpiar pantalla)
  let htmlAcciones = "";
  if (!minimizada) {
    htmlAcciones = `
      <div class="stop-actions">
        <button type="button" class="btn-primary" onclick="window.abrirParadaDesdeLista('${pId}', '${cb}', '${rId}')">
          Gestionar
        </button>
        <button type="button" class="link-gps" onclick="window.verParadaEnMapa('${pId}', '${cb}', '${rId}')">
          📍 Ver en mapa
        </button>
      </div>
    `;
  } else {
    // Si está en el historial (entregado/rechazado), solo dejamos ver detalles (Gestionar)
    htmlAcciones = `
      <div class="stop-actions" style="grid-template-columns: 1fr;">
        <button type="button" class="btn-secondary" onclick="window.abrirParadaDesdeLista('${pId}', '${cb}', '${rId}')">
          Ver detalles de gestión
        </button>
      </div>
    `;
  }

  return `
    <div class="stop-card ${claseEstado}" style="${claseMinimizada}">
      <div class="stop-top">
        <div class="stop-order">${orden}</div>
        <div class="stop-main">
          <div class="stop-name">${nombreCliente}</div>
          <div class="stop-meta">
            ${cb ? `<b>Cod:</b> ${cb} <br>` : ""}
            ${direccion}
          </div>
          ${htmlAlerta}
        </div>
      </div>
      ${htmlAcciones}
    </div>
  `;
}

/**
 * ACCIONES Y EVENTOS
 */
export function filtrarRuta(filtro) {
  state.filtroRuta = String(filtro || "TODOS").trim().toUpperCase();
  renderRuta(); // Refrescamos todo para pintar los Chips activos correctamente
}

export function buscarRuta(valor) {
  state.busquedaRuta = String(valor || "");
  renderResultadoRuta(); // Refrescamos solo el listado para no trabar el teclado del celular
}

export function cambiarOrdenRuta(orden) {
  state.ordenRuta = String(orden || "PLANIFICADO").trim().toUpperCase();
  renderResultadoRuta();
}

export function limpiarBusquedaRuta() {
  state.busquedaRuta = "";
  const input = document.getElementById("rutaSearchInput");
  if (input) input.value = "";
  renderResultadoRuta();
}

export function abrirParadaDesdeLista(paradaId, codBoca, rutaId) {
  if (typeof window.abrirParada !== "function") {
    toastRutaView("El módulo de entrega todavía no está cargado.", "error");
    return;
  }
  // Invoca al módulo de gestión (entregaView.js)
  window.abrirParada(paradaId, codBoca, rutaId);
}

export function verParadaEnMapa(paradaId, codBoca, rutaId) {
  if (typeof window.cambiarVista === "function") {
    window.cambiarVista("mapa");
  }
  // Pequeño delay para dejar que Leaflet ajuste el tamaño del contenedor
  setTimeout(() => {
    try {
      abrirPopupParada(paradaId, codBoca, rutaId);
    } catch (error) {
      toastRutaView("No se pudo ubicar la parada en el mapa.", "error");
    }
  }, 250);
}

/**
 * ESTADOS VACÍOS
 */
function renderSinRuta() {
  return `
    <div class="empty-state" style="text-align: center; padding: 40px 20px; color: #64748b;">
      <b>No hay una ruta cargada.</b><br><br>
      Vuelve a Inicio e ingresa tus credenciales.
    </div>
  `;
}

function renderSinResultados() {
  return `
    <div class="empty-state" style="text-align: center; padding: 40px 20px; color: #64748b;">
      No se encontraron paradas con ese filtro o búsqueda.
    </div>
  `;
}

export function toastRutaView(msg, type) {
  if (typeof window.toast === "function") {
    window.toast(msg, type);
  } else {
    alert(msg);
  }
}
