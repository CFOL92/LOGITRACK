// LOGITRACK - rutaView.js
// Vista Ruta:
// - Lista de paradas
// - Buscador por cliente, CodBoca, ciudad, zona o dirección
// - Filtros por estado
// - Ordenamiento operativo
// - Acciones: gestionar, ir con GPS
//
// Versión 1.9:
// - Corrige botón Gestionar con fallback robusto.
// - Quita botón Ver mapa.
// - Mantiene Ir con GPS.
// - Gestionar busca la parada desde state.paradas.
// - Si existe window.abrirParadaObjeto(), abre la gestión con el objeto completo.
// - Si no existe, usa window.abrirParada(paradaId, codBoca, rutaId).
// - Agrega diagnóstico visible en consola.

import { state } from "../state.js";

import {
  obtenerParadasFiltradas,
  calcularEstadoRuta,
  esParadaPendiente
} from "../services/routeService.js?v=1.9";

import {
  cleanEstado,
  escapeHtml,
  escapeAttr,
  formatoNum,
  formatoGs,
  toNumber
} from "../utils.js?v=1.9";

export function registrarRutaView() {
  window.renderRuta = renderRuta;
  window.renderResultadoRuta = renderResultadoRuta;
  window.filtrarRuta = filtrarRuta;
  window.buscarRuta = buscarRuta;
  window.cambiarOrdenRuta = cambiarOrdenRuta;
  window.limpiarBusquedaRuta = limpiarBusquedaRuta;

  window.gestionarParadaRuta = gestionarParadaRuta;
  window.abrirParadaDesdeLista = abrirParadaDesdeLista;
  window.debugGestionarParadaRuta = debugGestionarParadaRuta;

  window.toastRutaView = toastRutaView;
}

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

function renderFiltrosRuta(estado) {
  const filtros = [
    { id: "TODOS", label: `Todos ${estado.totalPuntos}` },
    { id: "PENDIENTE", label: `Pendientes ${estado.pendientes}` },
    { id: "ENTREGADO", label: `Entregados ${estado.entregados}` },
    { id: "PARCIAL", label: `Parciales ${estado.parciales}` },
    { id: "RECHAZADO", label: `Rechazados ${estado.rechazados}` }
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

function renderParadaCard(p) {
  const estado = cleanEstado(p.EstadoParada || "PENDIENTE");
  const claseEstado = obtenerClaseEstadoCard(p);
  const lat = p.Latitud || "";
  const lon = p.Longitud || "";
  const paradaKey = crearClaveParada(p);

  return `
    <div class="stop-card ${claseEstado}" data-parada-key="${escapeAttr(paradaKey)}">
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
          type="button"
          class="btn-primary"
          style="grid-column:1 / -1;"
          onclick="window.gestionarParadaRuta('${escapeAttr(paradaKey)}')"
        >
          Gestionar
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
            type="button"
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

function renderDetallePendiente(p) {
  if (!esParadaPendiente(p)) return "";

  return `
    <div class="product-line">
      Estado operativo: pendiente de gestión.
    </div>
  `;
}

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

function crearClaveParada(parada) {
  const paradaId = String(parada.ParadaID || "").trim();
  const rutaId = String(parada.RutaID || "").trim();
  const codBoca = String(parada.CodBoca || "").trim();

  if (paradaId) {
    return `PID:${paradaId}`;
  }

  if (rutaId || codBoca) {
    return `RID:${rutaId}|CB:${codBoca}`;
  }

  return `ORD:${String(parada.OrdenPlanificado || "")}|CLI:${String(parada.Cliente || parada.Boca || "")}`;
}

function buscarParadaPorClaveVista(key) {
  const clave = String(key || "").trim();
  const paradas = Array.isArray(state.paradas) ? state.paradas : [];

  if (!clave) return null;

  if (clave.startsWith("PID:")) {
    const paradaId = clave.replace("PID:", "");

    return paradas.find(p =>
      String(p.ParadaID || "").trim() === paradaId
    ) || null;
  }

  if (clave.startsWith("RID:")) {
    const raw = clave.replace("RID:", "");
    const partes = raw.split("|CB:");
    const rutaId = partes[0] || "";
    const codBoca = partes[1] || "";

    return paradas.find(p =>
      String(p.RutaID || "").trim() === rutaId &&
      String(p.CodBoca || "").trim() === codBoca
    ) || paradas.find(p =>
      String(p.CodBoca || "").trim() === codBoca
    ) || null;
  }

  return paradas.find(p => crearClaveParada(p) === clave) || null;
}

function buscarParadaPorIdsVista(paradaId, codBoca, rutaId) {
  const pId = String(paradaId || "").trim();
  const cBoca = String(codBoca || "").trim();
  const rId = String(rutaId || "").trim();

  const paradas = Array.isArray(state.paradas) ? state.paradas : [];

  return paradas.find(p =>
    pId && String(p.ParadaID || "").trim() === pId
  ) || paradas.find(p =>
    rId &&
    cBoca &&
    String(p.RutaID || "").trim() === rId &&
    String(p.CodBoca || "").trim() === cBoca
  ) || paradas.find(p =>
    cBoca &&
    String(p.CodBoca || "").trim() === cBoca
  ) || null;
}

export function gestionarParadaRuta(paradaKey) {
  const parada = buscarParadaPorClaveVista(paradaKey);

  console.log("LOGITRACK gestionarParadaRuta:", {
    paradaKey,
    paradaEncontrada: Boolean(parada),
    totalParadas: Array.isArray(state.paradas) ? state.paradas.length : 0,
    abrirParadaObjeto: typeof window.abrirParadaObjeto,
    abrirParada: typeof window.abrirParada
  });

  if (!parada) {
    toastRutaView("No se pudo abrir la gestión de esta parada.", "error");
    return;
  }

  state.paradaActiva = parada;

  if (typeof window.abrirParadaObjeto === "function") {
    window.abrirParadaObjeto(parada);
    return;
  }

  abrirParadaDesdeLista(
    parada.ParadaID || "",
    parada.CodBoca || "",
    parada.RutaID || ""
  );
}

export function abrirParadaDesdeLista(paradaId, codBoca, rutaId) {
  const pId = String(paradaId || "").trim();
  const cBoca = String(codBoca || "").trim();
  const rId = String(rutaId || "").trim();

  const parada = buscarParadaPorIdsVista(pId, cBoca, rId);

  console.log("LOGITRACK abrirParadaDesdeLista:", {
    paradaId: pId,
    codBoca: cBoca,
    rutaId: rId,
    paradaEncontrada: Boolean(parada),
    abrirParadaObjeto: typeof window.abrirParadaObjeto,
    abrirParada: typeof window.abrirParada
  });

  if (parada) {
    state.paradaActiva = parada;

    if (typeof window.abrirParadaObjeto === "function") {
      window.abrirParadaObjeto(parada);
      return;
    }
  }

  if (typeof window.abrirParada === "function") {
    window.abrirParada(pId, cBoca, rId);
    return;
  }

  toastRutaView("No está registrada la función de gestión de entrega.", "error");

  console.error("LOGITRACK: no existe función para abrir gestión.", {
    abrirParadaObjeto: typeof window.abrirParadaObjeto,
    abrirParada: typeof window.abrirParada
  });
}

export function debugGestionarParadaRuta(index = 0) {
  const paradas = Array.isArray(state.paradas) ? state.paradas : [];
  const parada = paradas[index];

  console.log("LOGITRACK debugGestionarParadaRuta:", {
    index,
    totalParadas: paradas.length,
    parada,
    abrirParadaObjeto: typeof window.abrirParadaObjeto,
    abrirParada: typeof window.abrirParada,
    gestionarParadaRuta: typeof window.gestionarParadaRuta
  });

  if (!parada) {
    toastRutaView("No existe parada en ese índice.", "error");
    return;
  }

  gestionarParadaRuta(crearClaveParada(parada));
}

export function filtrarRuta(filtro) {
  state.filtroRuta = String(filtro || "TODOS").trim().toUpperCase();

  const input = document.getElementById("rutaSearchInput");

  if (input) {
    state.busquedaRuta = input.value || "";
  }

  renderRuta();
}

export function buscarRuta(valor) {
  state.busquedaRuta = String(valor || "");
  renderResultadoRuta();
}

export function cambiarOrdenRuta(orden) {
  state.ordenRuta = String(orden || "PLANIFICADO").trim().toUpperCase();
  renderResultadoRuta();
}

export function limpiarBusquedaRuta() {
  state.busquedaRuta = "";

  const input = document.getElementById("rutaSearchInput");

  if (input) {
    input.value = "";
  }

  renderResultadoRuta();
}

function renderSinRuta() {
  return `
    <div class="empty-state">
      No hay una ruta cargada.<br><br>
      Ingresa CI, chapa y fecha para consultar la ruta asignada.
    </div>
  `;
}

function renderSinResultados() {
  return `
    <div class="empty-state">
      No hay paradas para el filtro o búsqueda seleccionada.
    </div>
  `;
}

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
