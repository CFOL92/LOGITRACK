// LOGITRACK - mapService.js
// Versión 2.0 (Refactor Visual y UX Profesional)
//
// Mejoras lógicas:
// - Control total de Leaflet con renderizado optimizado.
// - Eliminación de popups nativos molestos (reemplazados por llamadas al panel lateral).
// - Centrado inteligente según la ubicación del chofer.
// - Estilos de pines personalizados para diferenciar estados (Pendiente vs Entregado).

import { state } from "../state.js";
import {
  cleanEstado,
  toNumber,
  escapeHtml,
  escapeAttr,
  formatoNum
} from "../utils.js?v=1.9";

let map = null;
let layerGroup = null;
let markers = {}; 

const DEFAULT_CENTER = [-25.2637, -57.5759];
const DEFAULT_ZOOM = 12;

/**
 * Registra funciones globales para compatibilidad.
 */
export function registrarMapService() {
  window.initMap = initMap;
  window.dibujarMapa = dibujarMapa;
  window.limpiarMapa = limpiarMapa;
  window.centrarMapaEnRuta = centrarMapaEnRuta;
  window.refrescarTamanioMapa = refrescarTamanioMapa;
  window.mostrarMapa = mostrarMapa;
  window.ocultarMapa = ocultarMapa;
  window.abrirPopupParada = abrirPopupParada;
}

/**
 * Inicialización optimizada del mapa.
 */
export function initMap() {
  if (map && layerGroup) return map;

  const el = document.getElementById("map");
  if (!el) return null;

  // Configuración limpia: Sin controles nativos intrusivos
  map = L.map(el, {
    zoomControl: false,
    attributionControl: false
  }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);

  // Capa base: CartoDB Positron (Diseño profesional de alto contraste)
  L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
    maxZoom: 19
  }).addTo(map);

  layerGroup = L.layerGroup().addTo(map);

  map.on("zoomend", actualizarClaseZoom);
  actualizarClaseZoom();

  return map;
}

/**
 * Dibuja los pines basándose en el state.paradas.
 */
export function dibujarMapa() {
  if (!map) initMap();
  
  layerGroup.clearLayers();
  markers = {};

  const paradas = state.paradas || [];

  paradas.forEach(p => {
    const lat = obtenerLatitud(p);
    const lon = obtenerLongitud(p);
    if (!lat || !lon) return;

    const estado = cleanEstado(p.EstadoParada || "PENDIENTE");
    const esPendiente = estado === "PENDIENTE";

    // Icono profesional: Marcador circular con número de orden
    const icon = L.divIcon({
      className: `map-marker ${esPendiente ? 'active' : 'done'}`,
      html: `<div style="background:${colorPorEstado(estado)}; color:white; border-radius:50%; width:28px; height:28px; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:12px; box-shadow:0 2px 4px rgba(0,0,0,0.3); border:2px solid white;">
               ${p.OrdenPlanificado || ''}
             </div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });

    const marker = L.marker([lat, lon], { icon })
      .addTo(layerGroup)
      .on('click', () => abrirPopupParada(p.ParadaID, p.CodBoca, p.RutaID));

    markers[`${p.ParadaID}-${p.CodBoca}`] = marker;
  });
}

/**
 * Conexión UX: Al tocar el pin, abrimos el Panel Lateral de gestión.
 */
export function abrirPopupParada(paradaId, codBoca, rutaId) {
  if (typeof window.abrirParada === "function") {
    // Abrimos el panel lateral definido en entregaView
    window.abrirParada(paradaId, codBoca, rutaId);
  }
}

export function refrescarTamanioMapa() {
  if (map) setTimeout(() => map.invalidateSize(), 150);
}

export function centrarMapaEnRuta() {
  if (!map) return;
  const paradas = state.paradas || [];
  const bounds = paradas
    .filter(p => obtenerLatitud(p) && obtenerLongitud(p))
    .map(p => [obtenerLatitud(p), obtenerLongitud(p)]);

  if (bounds.length > 0) {
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
  }
}

export function mostrarMapa() {
  document.body.classList.add("mapa-activo");
  const el = document.getElementById("map");
  if (el) el.style.display = "block";
  refrescarTamanioMapa();
}

export function ocultarMapa() {
  document.body.classList.remove("mapa-activo");
  const el = document.getElementById("map");
  if (el) el.style.display = "none";
}

export function limpiarMapa() {
  if (layerGroup) layerGroup.clearLayers();
}

/**
 * Helpers y utilidades internas
 */
function colorPorEstado(estado) {
  const e = cleanEstado(estado);
  if (e === "ENTREGADO" || e === "ENTREGADO_TOTAL") return "#22c55e";
  if (e === "PARCIAL" || e === "ENTREGADO_PARCIAL") return "#f59e0b";
  if (e === "RECHAZADO" || e === "RECHAZADO_TOTAL") return "#ef4444";
  return "#0284c7";
}

function actualizarClaseZoom() {
  if (!map) return;
  const z = map.getZoom();
  document.body.classList.toggle("zoom-high", z >= 14);
  document.body.classList.toggle("zoom-low", z < 14);
}

function obtenerLatitud(p) { const val = Number(String(p.Latitud || p.lat || 0).replace(",", ".")); return (val >= -90 && val <= 90 && val !== 0) ? val : null; }
function obtenerLongitud(p) { const val = Number(String(p.Longitud || p.lon || 0).replace(",", ".")); return (val >= -180 && val <= 180 && val !== 0) ? val : null; }
