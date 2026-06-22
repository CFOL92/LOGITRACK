// LOGITRACK - facturaActions.js
// Acciones relacionadas a facturas:
// - Confirmar factura completa
// - Rechazar factura completa
// - Marcar factura como no despachada

import { state } from "../state.js";
import { apiGet } from "../api.js";
import { obtenerGPS } from "../services/gpsService.js";

/**
 * Registra las funciones en window para que sigan funcionando
 * los botones HTML con onclick="window.confirmarFactura(...)"
 */
export function registrarFacturaActions() {
  window.confirmarFactura = confirmarFactura;
  window.rechazarFactura = rechazarFactura;
  window.noDespachadoFactura = noDespachadoFactura;
}

/**
 * Confirma una factura completa como entregada.
 */
export async function confirmarFactura(facturaId) {
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

  try {
    toastFactura("Capturando ubicación...");

    const gps = await obtenerGPS();

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

    toastFactura(data.mensaje || "Factura actualizada.", "ok");

    await refrescarDespuesDeAccionFactura();

  } catch (error) {
    toastFactura("Error al actualizar factura:\n" + error.message, "error");
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

  return true;
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
