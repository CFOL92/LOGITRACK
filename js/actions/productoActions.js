// LOGITRACK - productoActions.js
// Acciones relacionadas a productos:
// - Entregado total
// - Entregado parcial
// - Rechazado total
// - No despachado

import { state } from "../state.js";
import { apiGet } from "../api.js";
import { obtenerGPS } from "../services/gpsService.js";

/**
 * Registra las funciones en window para mantener compatibilidad
 * con botones HTML tipo onclick="window.actualizarProducto(...)"
 */
export function registrarProductoActions() {
  window.actualizarProducto = actualizarProducto;
}

/**
 * Actualiza el estado de un producto de factura.
 *
 * Estados esperados:
 * - ENTREGADO_TOTAL
 * - ENTREGADO_PARCIAL
 * - RECHAZADO_TOTAL
 * - NO_DESPACHADO
 */
export async function actualizarProducto(productoFacturaId, estado) {
  if (!productoFacturaId) {
    toastProducto("Producto inválido.", "error");
    return;
  }

  const estadoNormalizado = String(estado || "").trim().toUpperCase();

  if (!estadoNormalizado) {
    toastProducto("Estado de producto inválido.", "error");
    return;
  }

  if (!validarContextoRuta()) return;

  let cantidadEntregada = "";
  let motivo = "";

  if (estadoNormalizado === "ENTREGADO_TOTAL") {
    const confirmar = confirm("¿Confirmar producto como entregado total?");
    if (!confirmar) return;
  }

  if (estadoNormalizado === "ENTREGADO_PARCIAL") {
    cantidadEntregada = prompt("Cantidad entregada:");

    if (cantidadEntregada === null) return;

    cantidadEntregada = String(cantidadEntregada || "").trim();

    if (!cantidadEntregada) {
      toastProducto("Debe ingresar la cantidad entregada.", "error");
      return;
    }

    motivo = prompt("Motivo de entrega parcial:");

    if (motivo === null) return;

    motivo = String(motivo || "").trim();

    if (!motivo) {
      toastProducto("Debe ingresar motivo.", "error");
      return;
    }
  }

  if (estadoNormalizado === "RECHAZADO_TOTAL") {
    motivo = prompt("Motivo del rechazo total:");

    if (motivo === null) return;

    motivo = String(motivo || "").trim();

    if (!motivo) {
      toastProducto("Debe ingresar motivo.", "error");
      return;
    }
  }

  if (estadoNormalizado === "NO_DESPACHADO") {
    motivo = prompt("Motivo de no despachado:");

    if (motivo === null) return;

    motivo = String(motivo || "").trim();

    if (!motivo) {
      toastProducto("Debe ingresar motivo.", "error");
      return;
    }
  }

  await ejecutarAccionProducto({
    productoFacturaId,
    estadoProducto: estadoNormalizado,
    cantidadEntregada,
    motivo
  });
}

/**
 * Ejecuta actualización contra Apps Script.
 */
async function ejecutarAccionProducto({
  productoFacturaId,
  estadoProducto,
  cantidadEntregada,
  motivo
}) {
  try {
    toastProducto("Capturando ubicación...");

    const gps = await obtenerGPS();

    const data = await apiGet({
      mode: "actualizarProducto",
      ci: state.ci,
      chapa: state.chapa,
      fecha: state.fecha,
      productoFacturaId,
      estadoProducto,
      cantidadEntregada: cantidadEntregada || "",
      motivo: motivo || "",
      lat: gps.lat,
      lng: gps.lng,
      precision: gps.precision
    });

    if (!data.ok) {
      toastProducto(data.mensaje || "No se pudo actualizar el producto.", "error");
      return;
    }

    toastProducto(data.mensaje || "Producto actualizado.", "ok");

    await refrescarDespuesDeAccionProducto();

  } catch (error) {
    toastProducto("Error al actualizar producto:\n" + error.message, "error");
  }
}

/**
 * Valida que exista una ruta activa antes de gestionar productos.
 */
function validarContextoRuta() {
  if (!state.ci || !state.chapa || !state.fecha) {
    toastProducto("No hay una ruta activa. Vuelve a cargar la ruta.", "error");
    return false;
  }

  return true;
}

/**
 * Refresca la ruta después de gestionar un producto.
 * Mantiene compatibilidad mientras terminamos la migración modular.
 */
async function refrescarDespuesDeAccionProducto() {
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
 * Toast local del módulo.
 * Más adelante se puede mover a utils.js para reutilizarlo.
 */
function toastProducto(msg, type) {
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
