// LOGITRACK - mapService.js
// Servicio de mapa Leaflet:
// - Inicializar mapa
// - Dibujar paradas
// - Crear marcadores
// - Crear popup de parada
// - Limpiar mapa
// - Centrar ruta
//
// Versión 1.7:
// - Evita error "Map container is already initialized".
// - Inicializa Leaflet una sola vez.
// - Oculta el mapa por defecto.
// - Muestra el mapa solo en vista Mapa.
// - Mantiene compatibilidad con centrarMapaEnRuta.
// - Agrega nueva función centrarMapaRuta usada por mapaView.js.
// - Refresca tamaño de Leaflet sin reinicializar el mapa.

import { state } from "../state.js";

import {
  cleanEstado,
  toNumber,
  escapeHtml,
  escapeAttr,
  formatoNum
} from "../utils.js?v=1.7";

import { setGpsMap } from "./gpsService.js?v=1.7";

let map = null;
let layerGroup = null;

const DEFAULT_CENTER = [-25.30, -57.60];
const DEFAULT_ZOOM = 11;

/**
 * Registra funciones globales para mantener compatibilidad
 * con botones HTML tipo onclick.
 */
export function registrarMapService() {
  window.dibujarMapa = dibujarMapa;
  window.limpiarMapa = limpiarMapa;
  window.centrarMapaEnRuta = centrarMapaEnRuta;
  window.centrarMapaRuta = centrarMapaRuta;
  window.refrescarTamanioMapa = refrescarTamanioMapa;
  window.mostrarMapa = mostrarMapa;
  window.ocultarMapa = ocultarMapa;
  window.getMap = getMap;
}

/**
 * Inicializa Leaflet.
 * Debe ejecutarse una sola vez desde main.js.
 */
export function initMap() {
  if (map && layerGroup) {
    return map;
  }

  if (!window.L) {
    throw new Error("Leaflet no está cargado. Verifica el script de Leaflet en index.html.");
  }

  let mapElement = document.getElementById("map");

  if (!mapElement) {
    throw new Error("No existe el contenedor #map en index.html.");
  }

  /*
    Leaflet marca el contenedor con _leaflet_id.
    Si por caché, recarga parcial o doble inicialización el contenedor ya quedó marcado,
    lo clonamos para limpiar la referencia interna y evitar:
    "Map container is already initialized".
  */
  if (mapElement._leaflet_id && !map) {
    const cleanMapElement = mapElement.cloneNode(false);
    mapElement.parentNode.replaceChild(cleanMapElement, mapElement);
    mapElement = cleanMapElement;
  }

  try {
    map = window.L.map(mapElement, {
      zoomControl: false,
      attributionControl: true
    }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);

    window.L.control.zoom({
      position: "bottomright"
    }).addTo(map);

    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap"
    }).addTo(map);

    layerGroup = window.L.layerGroup().addTo(map);

    map.on("zoomend", actualizarClaseZoom);
    actualizarClaseZoom();

    if (typeof setGpsMap === "function") {
      setGpsMap(map);
    }

    ocultarMapa();

    return map;

  } catch (error) {
    const mensaje = String(error?.message || error || "");

    if (mensaje.includes("already initialized")) {
      console.warn("Leaflet ya había inicializado el contenedor #map. Se evita reinicialización.");
      return map;
    }

    throw error;
  }
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
 * Muestra físicamente el mapa.
 */
export function mostrarMapa() {
  document.body.classList.add("mapa-activo");

  const mapElement = document.getElementById("map");

  if (mapElement) {
    mapElement.style.display = "block";
  }

  setTimeout(() => {
    refrescarTamanioMapa();
  }, 120);
}

/**
 * Oculta físicamente el mapa.
 */
export function ocultarMapa() {
  document.body.classList.remove("mapa-activo");

  const mapElement = document.getElementById("map");

  if (mapElement) {
    mapElement.style.display = "none";
  }
}

/**
 * Dibuja todas las paradas de la ruta cargada.
 */
export function dibujarMapa() {
  asegurarMapa();

  if (!map || !layerGroup) return;

  layerGroup.clearLayers();

  if (!state.paradas || !state.paradas.length) {
    actualizarStatusMapa("0 puntos cargados");
    return;
  }

  const bounds = [];

  state.paradas.forEach(parada => {
    const lat = obtenerLatitud(parada);
    const lon = obtenerLongitud(parada);

    if (!lat || !lon) return;

    bounds.push([lat, lon]);

    const marker = crearMarcadorParada(parada, lat, lon);
    marker.addTo(layerGroup);
  });

  if (bounds.length) {
    ajustarVistaBounds(bounds);
  }

  actualizarStatusMapa(`${bounds.length} de ${state.paradas.length} puntos cargados`);
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
 * Nueva función usada por mapaView.js.
 * Centra el mapa en las paradas actuales.
 */
export function centrarMapaRuta() {
  asegurarMapa();

  if (!state.paradas || !state.paradas.length) {
    toastMapa("No hay paradas cargadas.", "error");
    return;
  }

  const bounds = [];

  state.paradas.forEach(parada => {
    const lat = obtenerLatitud(parada);
    const lon = obtenerLongitud(parada);

    if (!lat || !lon) return;

    bounds.push([lat, lon]);
  });

  if (!bounds.length) {
    toastMapa("La ruta no tiene coordenadas válidas.", "error");
    return;
  }

  ajustarVistaBounds(bounds);
}

/**
 * Alias para compatibilidad con código anterior.
 */
export function centrarMapaEnRuta() {
  centrarMapaRuta();
}

/**
 * Abre el popup de una parada específica.
 */
export function abrirPopupParada(paradaId, codBoca, rutaId) {
  asegurarMapa();

  if (!state.paradas || !state.paradas.length) {
    toastMapa("No hay paradas cargadas.", "error");
    return;
  }

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

  const lat = obtenerLatitud(parada);
  const lon = obtenerLongitud(parada);

  if (!lat || !lon) {
    toastMapa("La parada no tiene coordenadas válidas.", "error");
    return;
  }

  mostrarMapa();

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
  if (!map) return;

  setTimeout(() => {
    try {
      map.invalidateSize();
    } catch (error) {
      console.warn("No se pudo refrescar tamaño del mapa:", error);
    }
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
 * Ajusta visualmente el mapa a una lista de coordenadas.
 */
function ajustarVistaBounds(bounds) {
  if (!map || !bounds.length) return;

  try {
    if (bounds.length === 1) {
      map.setView(bounds[0], 15);
      return;
    }

    map.fitBounds(bounds, {
      padding: [40, 40],
      maxZoom: 15
    });

  } catch (error) {
    console.warn("No se pudo ajustar el mapa a la ruta:", error);
  }
}

/**
 * Obtiene latitud de forma robusta.
 */
function obtenerLatitud(parada) {
  const raw =
    parada.Latitud ??
    parada.latitud ??
    parada.Lat ??
    parada.lat ??
    "";

  const numero = Number(String(raw).replace(",", "."));

  if (!Number.isFinite(numero)) return null;
  if (numero < -90 || numero > 90) return null;

  return numero;
}

/**
 * Obtiene longitud de forma robusta.
 */
function obtenerLongitud(parada) {
  const raw =
    parada.Longitud ??
    parada.longitud ??
    parada.Lng ??
    parada.lng ??
    parada.Lon ??
    parada.lon ??
    "";

  const numero = Number(String(raw).replace(",", "."));

  if (!Number.isFinite(numero)) return null;
  if (numero < -180 || numero > 180) return null;

  return numero;
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
