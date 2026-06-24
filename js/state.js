// LOGITRACK - state.js
// Estado global centralizado de la aplicación.
// Todos los módulos leen y actualizan este objeto compartido.
//
// Versión 1.6:
// - Agrega control de modoConsulta.
// - Agrega bloqueo por soloLectura.
// - Agrega metadata de ruta histórica / operativa.
// - Prepara Fase 1.2-A: blindaje de rutas históricas cerradas.

export const MODOS_CONSULTA = {
  OPERATIVO: "OPERATIVO",
  HISTORICO_PENDIENTE: "HISTORICO_PENDIENTE",
  HISTORICO_CERRADO: "HISTORICO_CERRADO"
};

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

  // Metadata de ruta / backend
  modoConsulta: MODOS_CONSULTA.OPERATIVO,
  soloLectura: false,
  codigoRuta: "",
  fuenteDatos: "",
  rutaCerrada: false,

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

    // Referencias nuevas para evitar que queden arrays/objetos compartidos.
    paradas: [],
    paradasMap: {},
    facturasCache: {},
    productosCache: {},

    resumen: null,
    chofer: null,
    movil: null,
    paradaActiva: null,
    facturaActiva: null,
    ultimaUbicacion: null,

    modoConsulta: MODOS_CONSULTA.OPERATIVO,
    soloLectura: false,
    codigoRuta: "",
    fuenteDatos: "",
    rutaCerrada: false
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

  state.modoConsulta = MODOS_CONSULTA.OPERATIVO;
  state.soloLectura = false;
  state.codigoRuta = "";
  state.fuenteDatos = "";
  state.rutaCerrada = false;

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
 * Indica si la ruta actual es operativa.
 */
export function esRutaOperativa() {
  return state.modoConsulta === MODOS_CONSULTA.OPERATIVO && !state.soloLectura;
}

/**
 * Indica si la ruta actual es histórica pendiente.
 * En este modo se puede permitir gestión si soloLectura=false.
 */
export function esRutaHistoricaPendiente() {
  return state.modoConsulta === MODOS_CONSULTA.HISTORICO_PENDIENTE;
}

/**
 * Indica si la ruta actual es histórica cerrada.
 */
export function esRutaHistoricaCerrada() {
  return state.modoConsulta === MODOS_CONSULTA.HISTORICO_CERRADO;
}

/**
 * Indica si la ruta debe bloquear acciones operativas.
 *
 * Se debe usar para bloquear:
 * - Entregar producto
 * - Rechazar producto
 * - Confirmar factura
 * - No despachado
 * - Finalizar ruta
 */
export function rutaBloqueadaParaGestion() {
  return Boolean(
    state.soloLectura ||
    state.rutaCerrada ||
    state.modoConsulta === MODOS_CONSULTA.HISTORICO_CERRADO
  );
}

/**
 * Devuelve descripción visible del modo de ruta.
 */
export function getLabelModoConsulta() {
  if (state.modoConsulta === MODOS_CONSULTA.HISTORICO_PENDIENTE) {
    return "Ruta histórica pendiente";
  }

  if (state.modoConsulta === MODOS_CONSULTA.HISTORICO_CERRADO) {
    return "Ruta histórica cerrada";
  }

  return "Ruta activa";
}

/**
 * Devuelve clase CSS sugerida para mostrar el estado de ruta.
 */
export function getClaseModoConsulta() {
  if (state.modoConsulta === MODOS_CONSULTA.HISTORICO_PENDIENTE) {
    return "historico-pendiente";
  }

  if (state.modoConsulta === MODOS_CONSULTA.HISTORICO_CERRADO) {
    return "historico-cerrado";
  }

  return "operativo";
}

/**
 * Registra helpers en window para depuración desde consola.
 */
export function registrarStateService() {
  window.LOGITRACK_STATE = state;
  window.resetLogitrackState = resetState;

  window.LOGITRACK_MODOS_CONSULTA = MODOS_CONSULTA;

  window.hayRutaActiva = hayRutaActiva;
  window.esRutaOperativa = esRutaOperativa;
  window.esRutaHistoricaPendiente = esRutaHistoricaPendiente;
  window.esRutaHistoricaCerrada = esRutaHistoricaCerrada;
  window.rutaBloqueadaParaGestion = rutaBloqueadaParaGestion;
  window.getLabelModoConsulta = getLabelModoConsulta;
}
