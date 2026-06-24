// LOGITRACK - productoActions.js
// Acciones relacionadas a productos:
// - Entregado total
// - Entregado parcial
// - Rechazado total
// - No despachado
//
// Versión 1.7 - Fase 1.2-B:
// - Mantiene compatibilidad con window.actualizarProducto(...).
// - Agrega window.actualizarProductoConDatos(...) para gestión desde pantalla.
// - Permite actualizar productos sin prompt cuando la vista ya capturó cantidad/motivo.
// - Bloquea acciones si la ruta está en soloLectura.
// - Bloquea acciones si la ruta está cerrada.
// - Bloquea acciones si modoConsulta = HISTORICO_CERRADO.
// - Mantiene HISTORICO_PENDIENTE editable si soloLectura=false.
// - Evita doble ejecución por doble clic.
// - Valida cantidad entregada para entrega parcial.
// - Limpia caches después de actualizar.

import { state } from "../state.js";
import { apiGet } from "../api.js?v=1.7";
import { obtenerGPS } from "../services/gpsService.js?v=1.7";

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
  window.actualizarProductoConDatos = actualizarProductoConDatos;
  window.validarContextoProducto = validarContextoRuta;
  window.rutaBloqueadaProducto = rutaBloqueadaParaProducto;
}

/**
 * MODO COMPATIBLE ANTERIOR.
 *
 * Actualiza el estado de un producto usando confirm/prompt.
 * Se mantiene para botones antiguos o pruebas rápidas.
 *
 * Estados esperados:
 * - ENTREGADO_TOTAL
 * - ENTREGADO_PARCIAL
 * - RECHAZADO_TOTAL
 * - NO_DESPACHADO
 */
export async function actualizarProducto(productoFacturaId, estado) {
  if (!validarContextoRuta()) return;

  const productoId = normalizarTexto(productoFacturaId);
  const estadoNormalizado = normalizarEstadoProducto(estado);

  if (!productoId) {
    toastProducto("Producto inválido.", "error");
    return;
  }

  if (!estadoNormalizado) {
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

    motivo = normalizarTexto(motivo);

    if (!motivo) {
      toastProducto("Debe ingresar motivo.", "error");
      return;
    }
  }

  if (estadoNormalizado === "RECHAZADO_TOTAL") {
    motivo = prompt("Motivo del rechazo total:");

    if (motivo === null) return;

    motivo = normalizarTexto(motivo);

    if (!motivo) {
      toastProducto("Debe ingresar motivo.", "error");
      return;
    }
  }

  if (estadoNormalizado === "NO_DESPACHADO") {
    motivo = prompt("Motivo de no despachado:");

    if (motivo === null) return;

    motivo = normalizarTexto(motivo);

    if (!motivo) {
      toastProducto("Debe ingresar motivo.", "error");
      return;
    }
  }

  await ejecutarAccionProducto({
    productoFacturaId: productoId,
    estadoProducto: estadoNormalizado,
    cantidadEntregada,
    motivo
  });
}

/**
 * MODO NUEVO PARA LA PANTALLA DE GESTIÓN.
 *
 * Permite actualizar sin prompt, usando datos capturados en entregaView.js.
 *
 * Uso esperado:
 * window.actualizarProductoConDatos({
 *   productoFacturaId: "ABC123",
 *   estadoProducto: "ENTREGADO_PARCIAL",
 *   cantidadEntregada: "5",
 *   motivo: "Cliente no recibe"
 * })
 */
export async function actualizarProductoConDatos({
  productoFacturaId,
  estadoProducto,
  cantidadEntregada = "",
  motivo = ""
} = {}) {
  if (!validarContextoRuta()) return;

  const productoId = normalizarTexto(productoFacturaId);
  const estadoNormalizado = normalizarEstadoProducto(estadoProducto);
  const cantidadNormalizada = normalizarCantidadSiAplica(cantidadEntregada, estadoNormalizado);
  const motivoNormalizado = normalizarTexto(motivo);

  if (!productoId) {
    toastProducto("Producto inválido.", "error");
    return {
      ok: false,
      mensaje: "Producto inválido."
    };
  }

  if (!estadoNormalizado) {
    toastProducto("Estado de producto inválido.", "error");
    return {
      ok: false,
      mensaje: "Estado de producto inválido."
    };
  }

  const validacion = validarDatosProducto({
    estadoProducto: estadoNormalizado,
    cantidadEntregada: cantidadNormalizada,
    motivo: motivoNormalizado
  });

  if (!validacion.ok) {
    toastProducto(validacion.mensaje, "error");
    return validacion;
  }

  return await ejecutarAccionProducto({
    productoFacturaId: productoId,
    estadoProducto: estadoNormalizado,
    cantidadEntregada: cantidadNormalizada,
    motivo: motivoNormalizado
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
  if (!validarContextoRuta()) {
    return {
      ok: false,
      mensaje: "Ruta inválida."
    };
  }

  if (accionProductoEnCurso) {
    toastProducto("Ya hay una acción de producto en proceso. Aguarde...", "error");
    return {
      ok: false,
      mensaje: "Ya hay una acción de producto en proceso."
    };
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
      return data;
    }

    limpiarCacheDespuesDeAccion();

    toastProducto(data.mensaje || "Producto actualizado.", "ok");

    await refrescarDespuesDeAccionProducto();

    return data;

  } catch (error) {
    console.error("LOGITRACK productoActions error:", error);

    const mensaje = "Error al actualizar producto:\n" + (error.message || error);

    toastProducto(mensaje, "error");

    return {
      ok: false,
      mensaje
    };

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
 * Valida datos según el estado del producto.
 */
function validarDatosProducto({
  estadoProducto,
  cantidadEntregada,
  motivo
}) {
  if (estadoProducto === "ENTREGADO_TOTAL") {
    return {
      ok: true,
      mensaje: "OK"
    };
  }

  if (estadoProducto === "ENTREGADO_PARCIAL") {
    if (!cantidadEntregada) {
      return {
        ok: false,
        mensaje: "Debe ingresar una cantidad entregada válida."
      };
    }

    if (!motivo) {
      return {
        ok: false,
        mensaje: "Debe ingresar motivo de entrega parcial."
      };
    }

    return {
      ok: true,
      mensaje: "OK"
    };
  }

  if (estadoProducto === "RECHAZADO_TOTAL") {
    if (!motivo) {
      return {
        ok: false,
        mensaje: "Debe ingresar motivo del rechazo."
      };
    }

    return {
      ok: true,
      mensaje: "OK"
    };
  }

  if (estadoProducto === "NO_DESPACHADO") {
    if (!motivo) {
      return {
        ok: false,
        mensaje: "Debe ingresar motivo de no despachado."
      };
    }

    return {
      ok: true,
      mensaje: "OK"
    };
  }

  return {
    ok: false,
    mensaje: "Estado de producto inválido."
  };
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
 * Normaliza estado de producto.
 */
function normalizarEstadoProducto(value) {
  const estado = String(value || "").trim().toUpperCase();

  if (!ESTADOS_PRODUCTO_VALIDOS.includes(estado)) {
    return "";
  }

  return estado;
}

/**
 * Normaliza textos.
 */
function normalizarTexto(value) {
  return String(value || "").trim();
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
 * Solo exige cantidad para entrega parcial.
 */
function normalizarCantidadSiAplica(cantidadEntregada, estadoProducto) {
  if (estadoProducto !== "ENTREGADO_PARCIAL") {
    return "";
  }

  return normalizarCantidad(cantidadEntregada);
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
