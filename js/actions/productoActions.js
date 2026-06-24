// LOGITRACK - productoActions.js
// Acciones relacionadas a productos:
// - Entregado total
// - Entregado parcial
// - Rechazado total
// - No despachado
//
// Versión 1.6 - Fase 1.2-A:
// - Bloquea acciones si la ruta está en soloLectura.
// - Bloquea acciones si la ruta está cerrada.
// - Bloquea acciones si modoConsulta = HISTORICO_CERRADO.
// - Mantiene HISTORICO_PENDIENTE editable si soloLectura=false.
// - Evita doble ejecución por doble clic.
// - Valida cantidad entregada para entrega parcial.

import { state } from "../state.js";
import { apiGet } from "../api.js?v=1.6";
import { obtenerGPS } from "../services/gpsService.js";

let accionProductoEnCurso = false;

const ESTADOS_PRODUCTO_VALIDOS = [
  "ENTREGADO_TOTAL",
  "ENTREGADO_PARCIAL",
  "RECHAZADO_TOTAL",
  "NO_DESPACHADO"
];

/**
 * Registra las funciones en window para mantener compatibilidad
 * con botones HTML tipo onclick="window.actualizarProducto(...)"
 */
export function registrarProductoActions() {
  window.actualizarProducto = actualizarProducto;
  window.validarContextoProducto = validarContextoRuta;
  window.rutaBloqueadaProducto = rutaBloqueadaParaProducto;
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
  if (!validarContextoRuta()) return;

  if (!productoFacturaId) {
    toastProducto("Producto inválido.", "error");
    return;
  }

  const estadoNormalizado = String(estado || "").trim().toUpperCase();

  if (!estadoNormalizado || !ESTADOS_PRODUCTO_VALIDOS.includes(estadoNormalizado)) {
    toastProducto("Estado de producto inválido.", "error");
    return;
  }

  let cantidadEntregada = "";
  let motivo = "";

  if (estadoNormalizado === "ENTREGADO_TOTAL") {
    const confirmar = confirm("¿Confirmar producto como entregado total?");
    if (!confirmar) return;
  }

  if (estadoNormalizado === "ENTREGADO_PARCIAL") {
    cantidadEntregada = prompt("Cantidad entregada:");

    if (cantidadEntregada === null) return;

    cantidadEntregada = normalizarCantidad(cantidadEntregada);

    if (!cantidadEntregada) {
      toastProducto("Debe ingresar una cantidad entregada válida.", "error");
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
  if (!validarContextoRuta()) return;

  if (accionProductoEnCurso) {
    toastProducto("Ya hay una acción de producto en proceso. Aguarde...", "error");
    return;
  }

  accionProductoEnCurso = true;

  try {
    toastProducto("Capturando ubicación...");

    const gps = await obtenerGPSSeguro();

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

    limpiarCacheDespuesDeAccion();

    toastProducto(data.mensaje || "Producto actualizado.", "ok");

    await refrescarDespuesDeAccionProducto();

  } catch (error) {
    console.error("LOGITRACK productoActions error:", error);
    toastProducto("Error al actualizar producto:\n" + (error.message || error), "error");

  } finally {
    accionProductoEnCurso = false;
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

  if (rutaBloqueadaParaProducto()) {
    toastProducto(mensajeRutaBloqueada(), "error");
    return false;
  }

  return true;
}

/**
 * Determina si la ruta actual está bloqueada para gestión de productos.
 *
 * Reglas:
 * - OPERATIVO: permite gestionar.
 * - HISTORICO_PENDIENTE + soloLectura=false: permite gestionar.
 * - HISTORICO_CERRADO: bloquea.
 * - soloLectura=true: bloquea.
 * - rutaCerrada=true: bloquea.
 */
function rutaBloqueadaParaProducto() {
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
    return "La ruta está cerrada. No se pueden modificar productos.";
  }

  if (state.soloLectura) {
    return "La ruta está en modo solo lectura. No se pueden modificar productos.";
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
 * Normaliza cantidad entregada.
 * Acepta coma o punto decimal.
 */
function normalizarCantidad(value) {
  const raw = String(value || "")
    .trim()
    .replace(",", ".");

  if (!raw) return "";

  const numero = Number(raw);

  if (!Number.isFinite(numero) || numero <= 0) {
    return "";
  }

  return String(numero);
}

/**
 * Limpia caches locales después de modificar un producto.
 */
function limpiarCacheDespuesDeAccion() {
  state.facturasCache = {};
  state.productosCache = {};
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
