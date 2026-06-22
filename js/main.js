// LOGITRACK - main.js
// Punto central de arranque de la aplicación modular.
// Aquí se conectan:
// - Configuración
// - API
// - Estado
// - Servicios
// - Vistas
// - Acciones
// - Navegación principal

import { APP_CONFIG } from "./config.js";
import { state } from "./state.js";

import { registrarApiService, verificarConexionAPI } from "./api.js";

import {
  initMap,
  registrarMapService,
  dibujarMapa,
  refrescarTamanioMapa
} from "./services/mapService.js";

import {
  registrarGpsService
} from "./services/gpsService.js";

import {
  registrarRouteService
} from "./services/routeService.js";

import {
  registrarLoginView,
  inicializarLogin,
  cargarRutaChofer,
  actualizarPanelChofer
} from "./views/loginView.js";

import {
  registrarInicioView,
  renderInicio,
  actualizarAppHeader
} from "./views/inicioView.js";

import {
  registrarRutaView,
  renderRuta
} from "./views/rutaView.js";

import {
  registrarMapaView,
  activarVistaMapa,
  ocultarTopPanel,
  actualizarPanelMapa
} from "./views/mapaView.js";

import {
  registrarCierreView,
  renderCierre
} from "./views/cierreView.js";

import {
  registrarEntregaView,
  abrirParada,
  verProductos,
  cerrarPanel
} from "./views/entregaView.js";

import {
  registrarFacturaActions
} from "./actions/facturaActions.js";

import {
  registrarProductoActions
} from "./actions/productoActions.js";

import {
  registrarRutaActions
} from "./actions/rutaActions.js";

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
    inicializarLogin();
    configurarEventosBase();
    verificarConexionInicial();

    console.info(`${APP_CONFIG.nombre} ${APP_CONFIG.version} inicializado correctamente.`);

  } catch (error) {
    console.error("Error al inicializar LOGITRACK:", error);
    toastMain("Error al inicializar LOGITRACK:\n" + error.message, "error");
  }
}

/**
 * Registra funciones globales mínimas para mantener compatibilidad
 * con los botones HTML que usan onclick="window.funcion(...)"
 */
function configurarVentanaGlobal() {
  window.LOGITRACK = {
    app: APP_CONFIG,
    state
  };

  window.cambiarVista = cambiarVista;
  window.renderApp = renderApp;
  window.renderTodo = renderApp;
  window.refrescarDespuesDeGestion = refrescarDespuesDeGestion;
  window.toast = toastMain;
}

/**
 * Registra todos los módulos.
 */
function registrarModulos() {
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
  initMap();
}

/**
 * Eventos generales de la app.
 */
function configurarEventosBase() {
  configurarEnterLogin();
  configurarErroresGlobales();
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
 * Verifica API al iniciar.
 */
async function verificarConexionInicial() {
  const apiStatus = document.getElementById("apiStatus");

  try {
    const result = await verificarConexionAPI();

    if (apiStatus) {
      apiStatus.textContent = result.ok ? "API: CONECTADA" : "API: ERROR";
    }

  } catch (error) {
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

  state.vistaActiva = vistaNormalizada;

  limpiarNavegacion();

  if (vistaNormalizada === "mapa") {
    activarVistaMapa();
    return;
  }

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
 * Render general después de cargar o refrescar datos.
 */
export function renderApp() {
  actualizarAppHeader();
  actualizarPanelChofer();
  actualizarPanelMapa();

  dibujarMapa();

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
    toastMain("Error al refrescar datos:\n" + error.message, "error");
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
  refrescarTamanioMapa();
  dibujarMapa();
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
