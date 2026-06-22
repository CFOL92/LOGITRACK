// LOGITRACK - rutaView.js
// Vista Ruta:
// - Lista de paradas
// - Buscador por cliente, CodBoca, ciudad, zona o dirección
// - Filtros por estado
// - Ordenamiento operativo
// - Acciones: gestionar, ver en mapa, ir con GPS

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
 * Registra funciones globales para mantener compatibilidad
 * con onclick="window.renderRuta()", onclick="window.filtrarRuta(...)", etc.
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

  if (!contenedor) {
    console.warn("No existe #rutaContent en index.html.");
    return;
  }

  inicializarEstadoRutaView();

  if (!state.ci || !state.chapa || !state.fecha) {
    contenedor.innerHTML = renderSinRuta();
    return;
  }

  const estado = calcularEstadoRuta();

  contenedor.innerHTML = `
    ${renderResumenRuta(estado)}
    ${renderBuscadorRuta()}
    ${renderFiltrosRuta(estado)}
    ${renderOrdenRuta()}
    <div id="routeCount" class="route-count"></div>
    <div id="routeListContent"></div>
  `;

  renderResultadoRuta();
}

/**
 * Inicializa campos adicionales de la vista ruta.
 */
function inicializarEstadoRutaView() {
  if (!state.filtroRuta) {
    state.filtroRuta = "TODOS";
  }

  if (state.busquedaRuta === undefined || state.busquedaRuta === null) {
    state.busquedaRuta = "";
  }

  if (!state.ordenRuta) {
    state.ordenRuta = "PLANIFICADO";
  }
}

/**
 * Renderiza solo el resultado de la lista.
 * Se usa para búsqueda sin redibujar todo el formulario.
 */
export function renderResultadoRuta() {
  const listContent = document.getElementById("routeListContent");
  const routeCount = document.getElementById("routeCount");

  if (!listContent) return;

  const lista = obtenerParadasFiltradas({
    filtro: state.filtroRuta || "TODOS",
    busqueda: state.busquedaRuta || "",
    orden: state.ordenRuta || "PLANIFICADO"
  });

  if (routeCount) {
    routeCount.textContent = `${lista.length} parada(s) encontrada(s)`;
  }

  if (!lista.length) {
    listContent.innerHTML = renderSinResultados();
    return;
  }

  listContent.innerHTML = lista.map(p => renderParadaCard(p)).join("");
}

/**
 * Resumen superior de la ruta.
 */
function renderResumenRuta(estado) {
  return `
    <div class="route-summary">
      <div class="route-summary-title">Mi ruta</div>

      <div class="route-summary-meta">
        Puntos: <b>${estado.totalPuntos}</b> |
        Pendientes: <b>${estado.pendientes}</b> |
        Avance: <b>${estado.avance}%</b>
      </div>

      <div class="progress-track" style="margin-top:10px;">
        <div class="progress-fill" style="width:${estado.avance}%"></div>
      </div>
    </div>
  `;
}

/**
 * Buscador de ruta.
 */
function renderBuscadorRuta() {
  return `
    <div class="route-search-box">
      <input
        id="rutaSearchInput"
        type="text"
        placeholder="Buscar cliente, CodBoca, ciudad, zona..."
        value="${escapeAttr(state.busquedaRuta || "")}"
        oninput="window.buscarRuta(this.value)"
      />

      ${state.busquedaRuta ? `
        <button
          class="btn-secondary"
          style="width:100%;margin-top:8px;"
          onclick="window.limpiarBusquedaRuta()"
        >
          Limpiar búsqueda
        </button>
      ` : ""}
    </div>
  `;
}

/**
 * Filtros por estado.
 */
function renderFiltrosRuta(estado) {
  const filtros = [
    {
      id: "TODOS",
      label: `Todos ${estado.totalPuntos}`
    },
    {
      id: "PENDIENTE",
      label: `Pendientes ${estado.pendientes}`
    },
    {
      id: "ENTREGADO",
      label: `Entregados ${estado.entregados}`
    },
    {
      id: "PARCIAL",
      label: `Parciales ${estado.parciales}`
    },
    {
      id: "RECHAZADO",
      label: `Rechazados ${estado.rechazados}`
    }
  ];

  const filtroActivo = state.filtroRuta || "TODOS";

  return `
    <div class="route-filters">
      ${filtros.map(f => `
        <button
          class="filter-chip ${filtroActivo === f.id ? "active" : ""}"
          onclick="window.filtrarRuta('${f.id}')"
        >
          ${escapeHtml(f.label)}
        </button>
      `).join("")}
    </div>
  `;
}

/**
 * Selector de ordenamiento.
 */
function renderOrdenRuta() {
  const orden = state.ordenRuta || "PLANIFICADO";

  return `
    <div class="route-sort-box">
      <select id="rutaOrdenSelect" onchange="window.cambiarOrdenRuta(this.value)">
        <option value="PLANIFICADO" ${orden === "PLANIFICADO" ? "selected" : ""}>
          Orden planificado
        </option>

        <option value="ESTADO" ${orden === "ESTADO" ? "selected" : ""}>
          Ordenar por estado
        </option>

        <option value="MAYOR_PESO" ${orden === "MAYOR_PESO" ? "selected" : ""}>
          Mayor peso
        </option>

        <option value="MAYOR_FACTURAS" ${orden === "MAYOR_FACTURAS" ? "selected" : ""}>
          Mayor cantidad de facturas
        </option>

        <option value="CLIENTE" ${orden === "CLIENTE" ? "selected" : ""}>
          Cliente A-Z
        </option>
      </select>
    </div>
  `;
}

/**
 * Tarjeta principal de parada.
 */
function renderParadaCard(p) {
  const estado = cleanEstado(p.EstadoParada || "PENDIENTE");
  const claseEstado = obtenerClaseEstadoCard(p);

  const lat = p.Latitud || "";
  const lon = p.Longitud || "";

  return `
    <div class="stop-card ${claseEstado}">
      <div class="stop-top">
        <div class="stop-order">
          ${escapeHtml(p.OrdenPlanificado || "-")}
        </div>

        <div class="stop-main">
          <div class="stop-name">
            ${escapeHtml(p.Cliente || p.Boca || "Cliente")}
          </div>

          <div class="stop-meta">
            CodBoca: ${escapeHtml(p.CodBoca || "")}<br>
            ${escapeHtml(p.Ciudad || "-")} | ${escapeHtml(p.Zona || "-")}<br>
            Facturas: ${p.CantidadFacturas || 0} |
            Productos: ${p.CantidadProductos || 0}<br>
            Peso: ${formatoNum.format(toNumber(p.TotalPesoKg))} kg |
            Pallets: ${formatoNum.format(toNumber(p.TotalPallets))}<br>
            Volumen: ${formatoNum.format(toNumber(p.TotalVolumenM3))} m³ |
            Importe: Gs. ${formatoGs.format(toNumber(p.TotalImporte))}
          </div>
        </div>

        <span class="badge ${estado}">
          ${estado}
        </span>
      </div>

      ${renderDetallePendiente(p)}

      <div class="stop-actions">
        <button
          class="btn-primary"
          onclick="window.abrirParadaDesdeLista('${escapeAttr(p.ParadaID || "")}', '${escapeAttr(p.CodBoca || "")}', '${escapeAttr(p.RutaID || "")}')"
        >
          Gestionar
        </button>

        <button
          class="btn-secondary"
          onclick="window.verParadaEnMapa('${escapeAttr(p.ParadaID || "")}', '${escapeAttr(p.CodBoca || "")}', '${escapeAttr(p.RutaID || "")}')"
        >
          Ver mapa
        </button>

        ${lat && lon ? `
          <a
            class="link-gps"
            style="grid-column:1 / -1;"
            target="_blank"
            href="https://www.google.com/maps/dir/?api=1&destination=${escapeAttr(lat)},${escapeAttr(lon)}"
          >
            Ir con GPS
          </a>
        ` : `
          <button
            class="btn-secondary"
            style="grid-column:1 / -1;"
            onclick="window.toastRutaView('Esta parada no tiene coordenadas.', 'error')"
          >
            GPS no disponible
          </button>
        `}
      </div>
    </div>
  `;
}

/**
 * Mensaje compacto si una parada tiene pendientes.
 */
function renderDetallePendiente(p) {
  if (!esParadaPendiente(p)) {
    return "";
  }

  return `
    <div class="product-line">
      Estado operativo: pendiente de gestión.
    </div>
  `;
}

/**
 * Determina clase visual para borde izquierdo.
 */
function obtenerClaseEstadoCard(parada) {
  const estado = cleanEstado(parada.EstadoParada || "PENDIENTE");

  if (esParadaPendiente(parada)) {
    return "estado-pendiente";
  }

  if (estado === "ENTREGADO" || estado === "ENTREGADO_TOTAL") {
    return "estado-entregado";
  }

  if (estado === "PARCIAL" || estado === "ENTREGADO_PARCIAL") {
    return "estado-parcial";
  }

  if (
    estado === "RECHAZADO" ||
    estado === "RECHAZADO_TOTAL" ||
    estado === "NO_DESPACHADO"
  ) {
    return "estado-rechazado";
  }

  return "estado-pendiente";
}

/**
 * Cambia filtro de ruta.
 */
export function filtrarRuta(filtro) {
  state.filtroRuta = String(filtro || "TODOS").trim().toUpperCase();

  const input = document.getElementById("rutaSearchInput");

  if (input) {
    state.busquedaRuta = input.value || "";
  }

  renderRuta();
}

/**
 * Busca en la lista de ruta.
 */
export function buscarRuta(valor) {
  state.busquedaRuta = String(valor || "");

  renderResultadoRuta();
}

/**
 * Cambia ordenamiento de la ruta.
 */
export function cambiarOrdenRuta(orden) {
  state.ordenRuta = String(orden || "PLANIFICADO").trim().toUpperCase();

  renderResultadoRuta();
}

/**
 * Limpia búsqueda.
 */
export function limpiarBusquedaRuta() {
  state.busquedaRuta = "";

  const input = document.getElementById("rutaSearchInput");

  if (input) {
    input.value = "";
  }

  renderResultadoRuta();
}

/**
 * Abre parada para gestión desde la vista ruta.
 */
export function abrirParadaDesdeLista(paradaId, codBoca, rutaId) {
  if (typeof window.abrirParada !== "function") {
    toastRutaView("La vista de entrega todavía no está cargada.", "error");
    return;
  }

  window.abrirParada(paradaId, codBoca, rutaId);
}

/**
 * Cambia a mapa y centra la parada seleccionada.
 */
export function verParadaEnMapa(paradaId, codBoca, rutaId) {
  if (typeof window.cambiarVista === "function") {
    window.cambiarVista("mapa");
  }

  setTimeout(() => {
    try {
      abrirPopupParada(paradaId, codBoca, rutaId);
    } catch (error) {
      toastRutaView("No se pudo ubicar la parada en el mapa.", "error");
    }
  }, 250);
}

/**
 * Vista sin ruta cargada.
 */
function renderSinRuta() {
  return `
    <div class="empty-state">
      No hay una ruta cargada.<br><br>
      Ingresa CI, chapa y fecha para consultar la ruta asignada.
    </div>
  `;
}

/**
 * Vista sin resultados luego de filtro o búsqueda.
 */
function renderSinResultados() {
  return `
    <div class="empty-state">
      No hay paradas para el filtro o búsqueda seleccionada.
    </div>
  `;
}

/**
 * Toast local de la vista ruta.
 */
export function toastRutaView(msg, type) {
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
