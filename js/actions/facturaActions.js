// LOGITRACK - facturaActions.js
// Acciones relacionadas a facturas:
// - Confirmar factura completa
// - Rechazar factura completa
// - Marcar factura como no despachada
//
// Versión 1.6 - Fase 1.2-A:
// - Bloquea acciones si la ruta está en soloLectura.
// - Bloquea acciones si la ruta está cerrada.
// - Bloquea acciones si modoConsulta = HISTORICO_CERRADO.
// - Mantiene HISTORICO_PENDIENTE editable si soloLectura=false.
// - Evita doble ejecución por doble clic.

import { state } from "../state.js";
import { apiGet } from "../api.js?v=1.6";
import { obtenerGPS } from "../services/gpsService.js";

let accionFacturaEnCurso = false;

/**
 * Registra las funciones en window para que sigan funcionando
 * los botones HTML con onclick="window.confirmarFactura(...)"
 */
export function registrarFacturaActions() {
  window.confirmarFactura = confirmarFactura;
  window.rechazarFactura = rechazarFactura;
  window.noDespachadoFactura = noDespachadoFactura;
  window.validarContextoFactura = validarContextoRuta;
  window.rutaBloqueadaFactura = rutaBloqueadaParaFactura;
}

/**
 * Confirma una factura completa como entregada.
 */
export async function confirmarFactura(facturaId) {
  if (!validarContextoRuta()) return;

  if (!facturaId) {
    toastFactura("Factura inválida.", "error");
    return;
  }

  const confirmar = confirm("¿Confirmar factura completa como entregada?");
  if (!confirmar) return;

  await ejecutarAccionFactura({
    mode: "confirmarFacturaCompleta",
    facturaId,
    motivo: ""
  });
}

/**
 * Rechaza una factura completa.
 */
export async function rechazarFactura(facturaId) {
  if (!validarContextoRuta()) return;

  if (!facturaId) {
    toastFactura("Factura inválida.", "error");
    return;
  }

  const motivo = prompt("Motivo del rechazo total:");
  if (motivo === null) return;

  if (!motivo.trim()) {
    toastFactura("Debe ingresar motivo.", "error");
    return;
  }

  await ejecutarAccionFactura({
    mode: "rechazarFacturaCompleta",
    facturaId,
    motivo: motivo.trim()
  });
}

/**
 * Marca una factura como no despachada.
 */
export async function noDespachadoFactura(facturaId) {
  if (!validarContextoRuta()) return;

  if (!facturaId) {
    toastFactura("Factura inválida.", "error");
    return;
  }

  const motivo = prompt("Motivo de no despachado:");
  if (motivo === null) return;

  if (!motivo.trim()) {
    toastFactura("Debe ingresar motivo.", "error");
    return;
  }

  await ejecutarAccionFactura({
    mode: "noDespachadoFactura",
    facturaId,
    motivo: motivo.trim()
  });
}

/**
 * Ejecuta la acción contra Apps Script.
 */
async function ejecutarAccionFactura({ mode, facturaId, motivo }) {
  if (!validarContextoRuta()) return;

  if (accionFacturaEnCurso) {
    toastFactura("Ya hay una acción de factura en proceso. Aguarde...", "error");
    return;
  }

  accionFacturaEnCurso = true;

  try {
    toastFactura("Capturando ubicación...");

    const gps = await obtenerGPSSeguro();

    const data = await apiGet({
      mode,
      ci: state.ci,
      chapa: state.chapa,
      fecha: state.fecha,
      facturaId,
      motivo: motivo || "",
      lat: gps.lat,
      lng: gps.lng,
      precision: gps.precision
    });

    if (!data.ok) {
      toastFactura(data.mensaje || "No se pudo actualizar la factura.", "error");
      return;
    }

    limpiarCacheDespuesDeAccion();

    toastFactura(data.mensaje || "Factura actualizada.", "ok");

    await refrescarDespuesDeAccionFactura();

  } catch (error) {
    console.error("LOGITRACK facturaActions error:", error);
    toastFactura("Error al actualizar factura:\n" + (error.message || error), "error");

  } finally {
    accionFacturaEnCurso = false;
  }
}

/**
 * Valida que exista ruta cargada antes de ejecutar acciones.
 */
function validarContextoRuta() {
  if (!state.ci || !state.chapa || !state.fecha) {
    toastFactura("No hay una ruta activa. Vuelve a cargar la ruta.", "error");
    return false;
  }

  if (rutaBloqueadaParaFactura()) {
    toastFactura(mensajeRutaBloqueada(), "error");
    return false;
  }

  return true;
}

/**
 * Determina si la ruta actual está bloqueada para gestión de facturas.
 *
 * Reglas:
 * - OPERATIVO: permite gestionar.
 * - HISTORICO_PENDIENTE + soloLectura=false: permite gestionar.
 * - HISTORICO_CERRADO: bloquea.
 * - soloLectura=true: bloquea.
 * - rutaCerrada=true: bloquea.
 */
function rutaBloqueadaParaFactura() {
  const modo = String(state.modoConsulta || "OPERATIVO").trim().toUpperCase();

  return Boolean(
    state.soloLectura === true ||
    state.rutaCerrada === true ||
    modo === "HISTORICO_CERRADO"
  );
}

/**
 * Mensaje visible cuando la ruta no permite gestión.
 */
function mensajeRutaBloqueada() {
  const modo = String(state.modoConsulta || "OPERATIVO").trim().toUpperCase();

  if (modo === "HISTORICO_CERRADO") {
    return "Esta ruta histórica ya está cerrada. Solo se permite consultar.";
  }

  if (state.rutaCerrada) {
    return "La ruta está cerrada. No se pueden modificar facturas.";
  }

  if (state.soloLectura) {
    return "La ruta está en modo solo lectura. No se pueden modificar facturas.";
  }

  return "La ruta no permite gestión en este momento.";
}

/**
 * Obtiene GPS de forma controlada.
 */
async function obtenerGPSSeguro() {
  const gps = await obtenerGPS();

  return {
    lat: gps?.lat ?? "",
    lng: gps?.lng ?? "",
    precision: gps?.precision ?? ""
  };
}

/**
 * Limpia caches locales después de modificar una factura.
 */
function limpiarCacheDespuesDeAccion() {
  state.facturasCache = {};
  state.productosCache = {};
}

/**
 * Refresca la información después de gestionar una factura.
 * Usa funciones globales mientras seguimos migrando por módulos.
 */
async function refrescarDespuesDeAccionFactura() {
  if (typeof window.refrescarDespuesDeGestion === "function") {
    await window.refrescarDespuesDeGestion();
    return;
  }

  if (typeof window.refrescarRuta === "function") {
    await window.refrescarRuta();
    return;
  }

  console.warn("No existe función de refresco registrada.");
}

/**
 * Toast local para este módulo.
 * Más adelante podemos moverlo a utils.js.
 */
function toastFactura(msg, type) {
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
