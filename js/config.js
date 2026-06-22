// LOGITRACK - config.js
// Configuración general de la aplicación.
// Aquí centralizamos URL de API, versión, mapa y parámetros fijos.

export const SHEET_API = "https://script.google.com/macros/s/AKfycbw4MMDN7k9m9V34L62FDWryaed0iPQZhWqVIC37G7SXNjS8m-vxvthHmiuX70len8-9/exec";

export const APP_CONFIG = {
  nombre: "LOGITRACK",
  descripcion: "Control de ruta por chofer",
  version: "1.2.0",

  // Configuración inicial del mapa
  mapa: {
    centroInicial: [-25.30, -57.60],
    zoomInicial: 11,
    zoomDetalle: 16,
    zoomEtiquetas: 14
  },

  // Configuración visual
  ui: {
    toastOkMs: 3000,
    toastErrorMs: 8000,
    delayMapaMs: 150
  },

  // Estados principales usados en la app
  estados: {
    pendiente: "PENDIENTE",
    entregado: "ENTREGADO",
    parcial: "PARCIAL",
    rechazado: "RECHAZADO",
    noDespachado: "NO_DESPACHADO",
    entregadoTotal: "ENTREGADO_TOTAL",
    entregadoParcial: "ENTREGADO_PARCIAL",
    rechazadoTotal: "RECHAZADO_TOTAL"
  }
};

export const MAP_COLORS = {
  PENDIENTE: "#0284c7",
  ENTREGADO: "#22c55e",
  ENTREGADO_TOTAL: "#22c55e",
  PARCIAL: "#f59e0b",
  ENTREGADO_PARCIAL: "#f59e0b",
  RECHAZADO: "#ef4444",
  RECHAZADO_TOTAL: "#ef4444",
  NO_DESPACHADO: "#64748b"
};

export const API_MODES = {
  status: "status",
  loginRuta: "loginRuta",
  getFacturasParada: "getFacturasParada",
  getProductosFactura: "getProductosFactura",
  actualizarProducto: "actualizarProducto",
  confirmarFacturaCompleta: "confirmarFacturaCompleta",
  rechazarFacturaCompleta: "rechazarFacturaCompleta",
  noDespachadoFactura: "noDespachadoFactura",
  finalizarRuta: "finalizarRuta",
  registrarTracking: "registrarTracking",
  registrarEvento: "registrarEvento"
};
