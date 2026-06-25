// LOGITRACK - main.js
// Punto central de arranque de la aplicación modular.
//
// Versión 1.8:
// - Fuerza recarga de rutaView.js y entregaView.js con query ?v=1.8.
// - Mantiene state/config/utils base sin query para evitar duplicar estado interno.
// - Corrige botón Gestionar en módulo Ruta.
// - Quita botón Ver mapa de las tarjetas de ruta.
// - Mantiene Ir con GPS.
// - Mantiene control visual del mapa solo en vista Mapa.
// - Evita abrir Mapa si no hay ruta cargada.
// - Evita doble redibujado de Leaflet.
// - Expone diagnóstico global para consola.
// - Mejora control de conexión online/offline.

import { APP_CONFIG } from "./config.js";
import { state } from "./state.js";

import { registrarUtils } from "./utils.js";

import { registrarApiService, verificarConexionAPI } from "./api.js?v=1.7";

import {
  initMap,
  registrarMapService,
  dibujarMapa,
  refrescarTamanioMapa
} from "./services/mapService.js?v=1.7";

import {
  registrarGpsService
} from "./services/gpsService.js?v=1.7";

import {
  registrarRouteService
} from "./services/routeService.js?v=1.7";

import {
  registrarLoginView,
  inicializarLogin,
  cargarRutaChofer,
  actualizarPanelChofer
} from "./views/loginView.js?v=1.7";

import {
  registrarInicioView,
  renderInicio,
  actualizarAppHeader
} from "./views/inicioView.js?v=1.7";

import {
  registrarRutaView,
  renderRuta
} from "./views/rutaView.js?v=1.8";

import {
  registrarMapaView,
  activarVistaMapa,
  ocultarTopPanel,
  actualizarPanelMapa
} from "./views/mapaView.js?v=1.7";

import {
  registrarCierreView,
  renderCierre
} from "./views/cierreView.js?v=1.7";

import {
  registrarEntregaView,
  abrirParada,
  verProductos,
  cerrarPanel
} from "./views/entregaView.js?v=1.8";

import {
  registrarFacturaActions
} from "./actions/facturaActions.js?v=1.7";

import {
  registrarProductoActions
} from "./actions/productoActions.js?v=1.7";

import {
  registrarRutaActions
} from "./actions/rutaActions.js?v=1.7";

const FRONTEND_BUILD = "v1.8";

/**
 * Arranque principal.
 */
document.addEventListener("DOMContentLoaded", () => {
  inicializarAplicacion();
});

/**
 * Inicializa toda la aplicación.
 */
function inicializarAplicacion() {
  try {
    configurarVentanaGlobal();
    registrarModulos();
    inicializarMapa();
    ocultarMapaVisual();
    configurarEventosBase();
    configurarErroresGlobales();
    configurarEventosConexion();
    verificarConexionInicial();

    /*
      Importante:
      inicializarLogin() debe ejecutarse después de registrar módulos.
      Ahí se restaura la sesión desde localStorage si existe.
    */
    inicializarLogin();

    console.info(`${APP_CONFIG.nombre} ${APP_CONFIG.version} inicializado correctamente.`);
    console.info(`LOGITRACK frontend build: ${FRONTEND_BUILD}`);

  } catch (error) {
    console.error("Error al inicializar LOGITRACK:", error);
    toastMain("Error al inicializar LOGITRACK:\n" + (error.message || error), "error");
  }
}

/**
 * Registra funciones globales mínimas para mantener compatibilidad
 * con los botones HTML que usan onclick="window.funcion(...)"
 */
function configurarVentanaGlobal() {
  window.LOGITRACK = {
    app: APP_CONFIG,
    state,
    build: FRONTEND_BUILD
  };

  window.LOGITRACK_FRONTEND_BUILD = FRONTEND_BUILD;

  window.cambiarVista = cambiarVista;
  window.renderApp = renderApp;
  window.renderTodo = renderApp;
  window.refrescarDespuesDeGestion = refrescarDespuesDeGestion;
  window.cerrarTodoPanel = cerrarTodoPanel;
  window.refrescarMapaVisual = refrescarMapaVisual;
  window.mostrarMapaVisual = mostrarMapaVisual;
  window.ocultarMapaVisual = ocultarMapaVisual;
  window.toast = toastMain;

  window.diagnosticoLogitrack = diagnosticoLogitrack;
}

/**
 * Registra todos los módulos.
 */
function registrarModulos() {
  registrarUtils();

  registrarApiService();
  registrarMapService();
  registrarGpsService();
  registrarRouteService();

  registrarLoginView();
  registrarInicioView();
  registrarRutaView();
  registrarMapaView();
  registrarCierreView();
  registrarEntregaView();

  registrarFacturaActions();
  registrarProductoActions();
  registrarRutaActions();
}

/**
 * Inicializa Leaflet.
 */
function inicializarMapa() {
  try {
    initMap();
  } catch (error) {
    const mensaje = String(error?.message || error || "");

    /*
      Este error aparece cuando Leaflet ya inicializó #map.
      No debe bloquear el resto de la app.
    */
    if (mensaje.includes("already initialized")) {
      console.warn("Mapa ya inicializado. Se continúa sin reinicializar Leaflet.");
      return;
    }

    throw error;
  }
}

/**
 * Eventos generales de la app.
 */
function configurarEventosBase() {
  configurarEnterLogin();
}

/**
 * Permite presionar Enter en el login.
 */
function configurarEnterLogin() {
  const ciInput = document.getElementById("ciInput");
  const chapaInput = document.getElementById("chapaInput");
  const fechaInput = document.getElementById("fechaInput");

  [ciInput, chapaInput, fechaInput].forEach(input => {
    if (!input) return;

    input.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        cargarRutaChofer(true);
      }
    });
  });
}

/**
 * Captura errores no controlados.
 */
function configurarErroresGlobales() {
  window.addEventListener("error", event => {
    console.error("Error global:", event.error || event.message);
  });

  window.addEventListener("unhandledrejection", event => {
    console.error("Promesa rechazada:", event.reason);
  });
}

/**
 * Controla eventos de conexión del navegador.
 */
function configurarEventosConexion() {
  window.addEventListener("online", () => {
    actualizarEstadoConexionVisual(true);
    toastMain("Conexión restablecida.", "ok");
    verificarConexionInicial();
  });

  window.addEventListener("offline", () => {
    actualizarEstadoConexionVisual(false);
    toastMain("Sin conexión a internet.", "error");
  });

  actualizarEstadoConexionVisual(navigator.onLine);
}

/**
 * Actualiza indicador visual de conexión.
 */
function actualizarEstadoConexionVisual(online) {
  const apiStatus = document.getElementById("apiStatus");

  if (!apiStatus) return;

  if (!online) {
    apiStatus.textContent = "API: SIN CONEXIÓN";
    return;
  }

  if (!apiStatus.textContent || apiStatus.textContent === "API: SIN CONEXIÓN") {
    apiStatus.textContent = "API: CONECTANDO...";
  }
}

/**
 * Verifica API al iniciar.
 */
async function verificarConexionInicial() {
  const apiStatus = document.getElementById("apiStatus");

  if (!navigator.onLine) {
    if (apiStatus) apiStatus.textContent = "API: SIN CONEXIÓN";
    return;
  }

  try {
    const result = await verificarConexionAPI();

    if (apiStatus) {
      apiStatus.textContent = result.ok ? "API: CONECTADA" : "API: ERROR";
    }

  } catch (error) {
    console.error("Error verificando API:", error);

    if (apiStatus) {
      apiStatus.textContent = "API: ERROR";
    }
  }
}

/**
 * Navegación principal entre vistas:
 * - inicio
 * - ruta
 * - mapa
 * - cierre
 */
export function cambiarVista(vista) {
  const vistaNormalizada = String(vista || "inicio").trim().toLowerCase();

  if (vistaNormalizada === "mapa") {
    if (!hayRutaValidaParaMapa()) {
      ocultarMapaVisual();
      activarAppShell();
      ocultarTopPanel();

      state.vistaActiva = "inicio";
      limpiarNavegacion();
      activarVista("viewInicio", "navInicio");
      renderInicio();

      toastMain("No hay una ruta cargada para mostrar en el mapa.", "error");
      return;
    }

    state.vistaActiva = "mapa";
    limpiarNavegacion();

    mostrarMapaVisual();
    activarVistaMapa();

    /*
      activarVistaMapa() ya refresca y dibuja el mapa.
      No repetimos dibujarMapa() acá para evitar doble render.
    */
    return;
  }

  state.vistaActiva = vistaNormalizada;

  limpiarNavegacion();
  ocultarMapaVisual();
  activarAppShell();
  ocultarTopPanel();

  if (vistaNormalizada === "inicio") {
    activarVista("viewInicio", "navInicio");
    renderInicio();
    return;
  }

  if (vistaNormalizada === "ruta") {
    activarVista("viewRuta", "navRuta");
    renderRuta();
    return;
  }

  if (vistaNormalizada === "cierre") {
    activarVista("viewCierre", "navCierre");
    renderCierre();
    return;
  }

  activarVista("viewInicio", "navInicio");
  renderInicio();
}

/**
 * Valida si se puede abrir el mapa.
 */
function hayRutaValidaParaMapa() {
  return Boolean(
    state.ci &&
    state.chapa &&
    state.fecha &&
    Array.isArray(state.paradas) &&
    state.paradas.length
  );
}

/**
 * Limpia vistas y botones activos.
 */
function limpiarNavegacion() {
  document.querySelectorAll(".app-view").forEach(view => {
    view.classList.remove("active");
  });

  document.querySelectorAll(".nav-item").forEach(nav => {
    nav.classList.remove("active");
  });
}

/**
 * Activa una vista interna del appShell.
 */
function activarVista(viewId, navId) {
  const view = document.getElementById(viewId);
  const nav = document.getElementById(navId);

  if (view) {
    view.classList.add("active");
  }

  if (nav) {
    nav.classList.add("active");
  }
}

/**
 * Muestra el appShell.
 */
function activarAppShell() {
  const appShell = document.getElementById("appShell");

  if (appShell) {
    appShell.classList.add("active");
  }
}

/**
 * Muestra el mapa únicamente para vista Mapa.
 */
function mostrarMapaVisual() {
  document.body.classList.add("mapa-activo");

  const mapEl = document.getElementById("map");

  if (mapEl) {
    mapEl.style.display = "block";
  }
}

/**
 * Oculta el mapa para Inicio, Ruta y Cierre.
 */
function ocultarMapaVisual() {
  document.body.classList.remove("mapa-activo");

  const mapEl = document.getElementById("map");

  if (mapEl) {
    mapEl.style.display = "none";
  }
}

/**
 * Render general después de cargar o refrescar datos.
 */
export function renderApp() {
  actualizarAppHeader();
  actualizarPanelChofer();
  actualizarPanelMapa();

  /*
    Importante:
    No dibujamos el mapa en cada render general.
    Solo se dibuja cuando el usuario entra a la vista Mapa.
    Esto evita que el mapa quede visible en Inicio.
  */
  if (state.vistaActiva === "mapa" && hayRutaValidaParaMapa()) {
    mostrarMapaVisual();

    setTimeout(() => {
      refrescarTamanioMapa();
      dibujarMapa();
    }, 150);
  } else {
    ocultarMapaVisual();
  }

  renderInicio();
  renderRuta();
  renderCierre();
}

/**
 * Refresca la ruta luego de gestionar factura/producto.
 * Mantiene la vista anterior y reabre panel si corresponde.
 */
export async function refrescarDespuesDeGestion() {
  const vistaAnterior = state.vistaActiva || "ruta";

  const facturaAnterior = state.facturaActiva;

  const paradaAnterior = state.paradaActiva
    ? {
        ParadaID: state.paradaActiva.ParadaID || "",
        CodBoca: state.paradaActiva.CodBoca || "",
        RutaID: state.paradaActiva.RutaID || ""
      }
    : null;

  try {
    await cargarRutaChofer(false);

    renderApp();

    if (vistaAnterior === "mapa" && !hayRutaValidaParaMapa()) {
      cambiarVista("inicio");
      return;
    }

    cambiarVista(vistaAnterior);

    if (facturaAnterior) {
      await verProductos(facturaAnterior);
      return;
    }

    if (paradaAnterior) {
      await abrirParada(
        paradaAnterior.ParadaID,
        paradaAnterior.CodBoca,
        paradaAnterior.RutaID
      );
    }

  } catch (error) {
    console.error("LOGITRACK refrescarDespuesDeGestion error:", error);
    toastMain("Error al refrescar datos:\n" + (error.message || error), "error");
  }
}

/**
 * Cierre de panel y limpieza visual auxiliar.
 */
export function cerrarTodoPanel() {
  cerrarPanel();
}

/**
 * Redibuja el mapa cuando vuelve al frente.
 */
export function refrescarMapaVisual() {
  if (!hayRutaValidaParaMapa()) {
    ocultarMapaVisual();
    toastMain("No hay una ruta cargada para mostrar en el mapa.", "error");
    return;
  }

  mostrarMapaVisual();

  setTimeout(() => {
    refrescarTamanioMapa();
    dibujarMapa();
  }, 150);
}

/**
 * Diagnóstico rápido desde consola.
 */
function diagnosticoLogitrack() {
  const mapEl = document.getElementById("map");

  const data = {
    build: FRONTEND_BUILD,
    appVersion: APP_CONFIG.version,
    online: navigator.onLine,
    vistaActiva: state.vistaActiva,
    ci: state.ci,
    chapa: state.chapa,
    fecha: state.fecha,
    modoConsulta: state.modoConsulta || "OPERATIVO",
    soloLectura: Boolean(state.soloLectura),
    rutaCerrada: Boolean(state.rutaCerrada),
    codigoRuta: state.codigoRuta || "",
    fuenteDatos: state.fuenteDatos || "",
    totalParadas: Array.isArray(state.paradas) ? state.paradas.length : 0,
    hayRutaValidaParaMapa: hayRutaValidaParaMapa(),
    paradaActiva: state.paradaActiva
      ? {
          ParadaID: state.paradaActiva.ParadaID || "",
          CodBoca: state.paradaActiva.CodBoca || "",
          RutaID: state.paradaActiva.RutaID || ""
        }
      : null,
    facturaActiva: state.facturaActiva || null,
    apiUrl: window.LOGITRACK_SHEET_API || null,
    lastApiUrl: window.LOGITRACK_LAST_API_URL || null,
    mapaDisplay: mapEl ? mapEl.style.display || getComputedStyle(mapEl).display : "SIN_MAPA"
  };

  console.table(data);
  return data;
}

/**
 * Toast global.
 */
function toastMain(msg, type) {
  const el = document.getElementById("toast");

  if (!el) {
    alert(msg);
    return;
  }

  el.textContent = msg;
  el.className = "toast active" + (type ? " " + type : "");

  clearTimeout(window.__toastTimer);

  const timeout = type === "error"
    ? APP_CONFIG.ui.toastErrorMs
    : APP_CONFIG.ui.toastOkMs;

  window.__toastTimer = setTimeout(() => {
    el.className = "toast";
  }, timeout);
}
