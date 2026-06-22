// LOGITRACK - mapService.js
// Servicio de mapa Leaflet:
// - Inicializar mapa
// - Dibujar paradas
// - Crear marcadores
// - Crear popup de parada
// - Limpiar mapa
// - Centrar ruta

import { state } from "../state.js";
import {
  cleanEstado,
  toNumber,
  escapeHtml,
  escapeAttr,
  formatoNum
} from "../utils.js";
import { setGpsMap } from "./gpsService.js";

let map = null;
let layerGroup = null;

/**
 * Registra funciones globales para mantener compatibilidad
 * con botones HTML tipo onclick.
 */
export function registrarMapService() {
  window.dibujarMapa = dibujarMapa;
  window.limpiarMapa = limpiarMapa;
  window.centrarMapaEnRuta = centrarMapaEnRuta;
}

/**
 * Inicializa Leaflet.
 * Debe ejecutarse una sola vez desde main.js.
 */
export function initMap() {
  if (map) return map;

  if (!window.L) {
    throw new Error("Leaflet no está cargado. Verifica el script de Leaflet en index.html.");
  }

  const mapElement = document.getElementById("map");

  if (!mapElement) {
    throw new Error("No existe el contenedor #map en index.html.");
  }

  map = window.L.map("map", {
    zoomControl: false
  }).setView([-25.30, -57.60], 11);

  window.L.control.zoom({
    position: "bottomright"
  }).addTo(map);

  window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap"
  }).addTo(map);

  layerGroup = window.L.layerGroup().addTo(map);

  map.on("zoomend", actualizarClaseZoom);
  actualizarClaseZoom();

  setGpsMap(map);

  return map;
}

/**
 * Devuelve la instancia actual del mapa.
 */
export function getMap() {
  return map;
}

/**
 * Devuelve el grupo de capas de paradas.
 */
export function getLayerGroup() {
  return layerGroup;
}

/**
 * Dibuja todas las paradas de la ruta cargada.
 */
export function dibujarMapa() {
  asegurarMapa();

  layerGroup.clearLayers();

  if (!state.paradas || !state.paradas.length) {
    toastMapa("No hay paradas para esta ruta.", "error");
    actualizarStatusMapa("0 puntos cargados");
    return;
  }

  const bounds = [];

  state.paradas.forEach(parada => {
    const lat = toNumber(parada.Latitud);
    const lon = toNumber(parada.Longitud);

    if (!lat || !lon) return;

    bounds.push([lat, lon]);

    const marker = crearMarcadorParada(parada, lat, lon);
    marker.addTo(layerGroup);
  });

  if (bounds.length) {
    map.fitBounds(bounds, {
      padding: [40, 40]
    });
  }

  actualizarStatusMapa(`${state.paradas.length} puntos cargados`);
}

/**
 * Crea marcador Leaflet para una parada.
 */
function crearMarcadorParada(parada, lat, lon) {
  const estado = cleanEstado(parada.EstadoParada || "PENDIENTE");
  const color = colorPorEstado(estado);

  const html = `
    <div style="position:relative;">
      <svg width="34" height="34" viewBox="0 0 24 24" style="filter:drop-shadow(0px 2px 2px rgba(0,0,0,0.3))">
        <path d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22S19 14.25 19 9C19 5.13 15.87 2 12 2Z" fill="${color}"></path>
        <circle cx="12" cy="9" r="3.5" fill="white"></circle>
      </svg>
    </div>
  `;

  const marker = window.L.marker([lat, lon], {
    icon: window.L.divIcon({
      className: "custom-marker",
      html,
      iconSize: [34, 34],
      iconAnchor: [17, 34]
    })
  });

  marker.bindTooltip(
    `<div>${escapeHtml(parada.OrdenPlanificado || "")}. ${escapeHtml(parada.Cliente || parada.Boca || "")}</div>`,
    {
      permanent: true,
      direction: "right",
      className: "label-boca",
      offset: [15, -15]
    }
  );

  marker.bindPopup(crearPopupParada(parada));

  marker.on("click", () => {
    state.paradaActiva = parada;
  });

  return marker;
}

/**
 * Crea el contenido HTML del popup de una parada.
 */
export function crearPopupParada(p) {
  const estado = cleanEstado(p.EstadoParada || "PENDIENTE");

  return `
    <div class="popup-card">
      <div class="popup-title">${escapeHtml(p.Cliente || p.Boca || "Cliente")}</div>

      <div class="popup-meta">
        CodBoca: ${escapeHtml(p.CodBoca || "")}<br>
        Ciudad: ${escapeHtml(p.Ciudad || "")}<br>
        Facturas: ${p.CantidadFacturas || 0} | Productos: ${p.CantidadProductos || 0}<br>
        Peso: ${formatoNum.format(toNumber(p.TotalPesoKg))} kg<br>
        Estado: <span class="badge ${estado}">${estado}</span>
      </div>

      <button class="popup-btn" onclick="window.abrirParada('${escapeAttr(p.ParadaID || "")}', '${escapeAttr(p.CodBoca || "")}', '${escapeAttr(p.RutaID || "")}')">
        Ver facturas
      </button>

      <a class="popup-btn" style="display:block;text-align:center;text-decoration:none;margin-top:8px;" target="_blank"
        href="https://www.google.com/maps/dir/?api=1&destination=${escapeAttr(p.Latitud || "")},${escapeAttr(p.Longitud || "")}">
        Ir con GPS
      </a>
    </div>
  `;
}

/**
 * Limpia las paradas del mapa.
 */
export function limpiarMapa() {
  asegurarMapa();

  if (layerGroup) {
    layerGroup.clearLayers();
  }

  actualizarStatusMapa("0 puntos cargados");
}

/**
 * Centra el mapa en las paradas actuales.
 */
export function centrarMapaEnRuta() {
  asegurarMapa();

  if (!state.paradas || !state.paradas.length) {
    toastMapa("No hay paradas cargadas.", "error");
    return;
  }

  const bounds = [];

  state.paradas.forEach(parada => {
    const lat = toNumber(parada.Latitud);
    const lon = toNumber(parada.Longitud);

    if (!lat || !lon) return;

    bounds.push([lat, lon]);
  });

  if (!bounds.length) {
    toastMapa("La ruta no tiene coordenadas válidas.", "error");
    return;
  }

  map.fitBounds(bounds, {
    padding: [40, 40]
  });
}

/**
 * Abre el popup de una parada específica.
 */
export function abrirPopupParada(paradaId, codBoca, rutaId) {
  asegurarMapa();

  const parada = state.paradas.find(p =>
    String(p.ParadaID || "") === String(paradaId || "") ||
    (
      String(p.CodBoca || "") === String(codBoca || "") &&
      String(p.RutaID || "") === String(rutaId || "")
    )
  );

  if (!parada) {
    toastMapa("No se encontró la parada en el mapa.", "error");
    return;
  }

  const lat = toNumber(parada.Latitud);
  const lon = toNumber(parada.Longitud);

  if (!lat || !lon) {
    toastMapa("La parada no tiene coordenadas válidas.", "error");
    return;
  }

  map.setView([lat, lon], 16);
}

/**
 * Devuelve color según estado.
 */
export function colorPorEstado(estado) {
  const estadoLimpio = cleanEstado(estado);

  if (estadoLimpio === "ENTREGADO" || estadoLimpio === "ENTREGADO_TOTAL") {
    return "#22c55e";
  }

  if (estadoLimpio === "PARCIAL" || estadoLimpio === "ENTREGADO_PARCIAL") {
    return "#f59e0b";
  }

  if (estadoLimpio === "RECHAZADO" || estadoLimpio === "RECHAZADO_TOTAL") {
    return "#ef4444";
  }

  if (estadoLimpio === "NO_DESPACHADO") {
    return "#64748b";
  }

  return "#0284c7";
}

/**
 * Ajusta clase del body según zoom para mostrar/ocultar etiquetas.
 */
function actualizarClaseZoom() {
  if (!map) return;

  const z = map.getZoom();

  document.body.classList.toggle("zoom-high", z >= 14);
  document.body.classList.toggle("zoom-low", z < 14);
}

/**
 * Invalida el tamaño del mapa al cambiar de vista.
 */
export function refrescarTamanioMapa() {
  asegurarMapa();

  setTimeout(() => {
    map.invalidateSize();
  }, 150);
}

/**
 * Valida que el mapa esté inicializado.
 */
function asegurarMapa() {
  if (!map || !layerGroup) {
    initMap();
  }
}

/**
 * Actualiza el texto visual de estado del mapa/API.
 */
function actualizarStatusMapa(texto) {
  const el = document.getElementById("apiStatus");

  if (el) {
    el.textContent = texto;
  }
}

/**
 * Toast local del mapa.
 * Más adelante puede moverse a utils.js.
 */
function toastMapa(msg, type) {
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
