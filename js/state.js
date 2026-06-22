// LOGITRACK - state.js
// Estado global centralizado de la aplicación.
// Todos los módulos leen y actualizan este objeto compartido.

export const INITIAL_STATE = {
  // Datos de acceso / ruta activa
  ci: "",
  chapa: "",
  fecha: "",

  // Datos del chofer y móvil
  chofer: null,
  movil: null,

  // Resumen general de la ruta
  resumen: null,

  // Datos operativos
  paradas: [],
  paradasMap: {},

  // Cache local para evitar llamadas repetidas
  facturasCache: {},
  productosCache: {},

  // Selecciones activas
  paradaActiva: null,
  facturaActiva: null,

  // Navegación principal
  vistaActiva: "inicio",

  // Vista Ruta - Fase 1.2
  filtroRuta: "TODOS",
  busquedaRuta: "",
  ordenRuta: "PLANIFICADO",

  // GPS / tracking futuro
  gpsActivo: false,
  ultimaUbicacion: null,
  trackingActivo: false,

  // Control interno
  cargandoRuta: false,
  ultimaSincronizacion: null,
  errorActual: null
};

export const state = crearEstadoInicial();

/**
 * Crea una copia limpia del estado inicial.
 */
export function crearEstadoInicial() {
  return {
    ...INITIAL_STATE,
    paradas: [],
    paradasMap: {},
    facturasCache: {},
    productosCache: {},
    resumen: null,
    chofer: null,
    movil: null,
    paradaActiva: null,
    facturaActiva: null,
    ultimaUbicacion: null
  };
}

/**
 * Reinicia todo el estado global.
 * Se usa al cambiar de chofer o cerrar sesión local.
 */
export function resetState() {
  const limpio = crearEstadoInicial();

  Object.keys(state).forEach(key => {
    delete state[key];
  });

  Object.assign(state, limpio);
}

/**
 * Actualiza varias propiedades del estado.
 */
export function patchState(values = {}) {
  Object.assign(state, values);
}

/**
 * Limpia solo datos operativos de ruta,
 * manteniendo CI, chapa y fecha si se necesita refrescar.
 */
export function limpiarDatosRuta() {
  state.chofer = null;
  state.movil = null;
  state.resumen = null;
  state.paradas = [];
  state.paradasMap = {};
  state.facturasCache = {};
  state.productosCache = {};
  state.paradaActiva = null;
  state.facturaActiva = null;
  state.errorActual = null;
}

/**
 * Limpia caches de facturas y productos.
 */
export function limpiarCaches() {
  state.facturasCache = {};
  state.productosCache = {};
}

/**
 * Limpia selección activa de parada/factura.
 */
export function limpiarSeleccion() {
  state.paradaActiva = null;
  state.facturaActiva = null;
}

/**
 * Actualiza la última ubicación GPS conocida.
 */
export function setUltimaUbicacion(gps) {
  state.ultimaUbicacion = gps || null;
}

/**
 * Marca hora de última sincronización.
 */
export function marcarSincronizacion() {
  state.ultimaSincronizacion = new Date().toISOString();
}

/**
 * Indica si actualmente hay una ruta cargada.
 */
export function hayRutaActiva() {
  return Boolean(
    state.ci &&
    state.chapa &&
    state.fecha &&
    Array.isArray(state.paradas) &&
    state.paradas.length
  );
}

/**
 * Registra helpers en window para depuración desde consola.
 */
export function registrarStateService() {
  window.LOGITRACK_STATE = state;
  window.resetLogitrackState = resetState;
}
