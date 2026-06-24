// LOGITRACK - entregaView.js
// Vista de gestión de entrega:
// - Abrir parada / cliente
// - Cargar facturas de una parada
// - Cargar productos de una factura
// - Renderizar panel lateral de gestión
// - Gestión intuitiva por producto desde pantalla
// - Mantener compatibilidad con onclick globales
//
// Versión 1.7 - Fase 1.2-B:
// - Rediseña la gestión para choferes.
// - Factura: muestra primero "Ver productos" y "Entregar completa".
// - Acciones críticas de factura quedan dentro de "Más opciones".
// - Producto: permite seleccionar ENTREGADO, PARCIAL, RECHAZADO, NO DESPACHADO.
// - Para PARCIAL solicita cantidad entregada y motivo.
// - Para RECHAZADO / NO DESPACHADO solicita motivo.
// - Elimina prompts para gestión de productos.
// - Mantiene compatibilidad con acciones existentes de factura.
// - Respeta ruta histórica pendiente editable.
// - Bloquea acciones si soloLectura, rutaCerrada o HISTORICO_CERRADO.

import { state } from "../state.js";

import {
  buscarParadaPorClaves,
  cargarFacturasParada,
  cargarProductosFactura,
  buscarFactura
} from "../services/routeService.js?v=1.7";

import { apiGet } from "../api.js?v=1.7";
import { obtenerGPS } from "../services/gpsService.js?v=1.7";

import {
  cleanEstado,
  escapeHtml,
  escapeAttr,
  formatoNum,
  formatoGs,
  toNumber
} from "../utils.js?v=1.7";

let accionProductoPantallaEnCurso = false;

const ESTADOS_PRODUCTO = {
  ENTREGADO_TOTAL: "ENTREGADO_TOTAL",
  ENTREGADO_PARCIAL: "ENTREGADO_PARCIAL",
  RECHAZADO_TOTAL: "RECHAZADO_TOTAL",
  NO_DESPACHADO: "NO_DESPACHADO"
};

const MOTIVOS_PRODUCTO = [
  "Cliente no recibe",
  "Producto averiado",
  "Diferencia de cantidad",
  "Producto no solicitado",
  "Local cerrado",
  "Sin espacio para recibir",
  "Documento no coincide",
  "Pedido fuera de horario",
  "No despachado en depósito",
  "Otro"
];

/**
 * Registra funciones globales para mantener compatibilidad
 * con los botones actuales del HTML.
 */
export function registrarEntregaView() {
  window.abrirParada = abrirParada;
  window.abrirParadaDesdeLista = abrirParadaDesdeLista;
  window.verProductos = verProductos;
  window.volverAFacturas = volverAFacturas;
  window.refrescarParadaActiva = refrescarParadaActiva;
  window.abrirPanel = abrirPanel;
  window.cerrarPanel = cerrarPanel;
  window.setSideBody = setSideBody;

  window.toggleOpcionesFactura = toggleOpcionesFactura;
  window.seleccionarEstadoProducto = seleccionarEstadoProducto;
  window.guardarGestionProducto = guardarGestionProducto;
  window.limpiarGestionProducto = limpiarGestionProducto;

  window.rutaBloqueadaEntrega = rutaBloqueadaParaGestion;
  window.renderAvisoModoRuta = renderAvisoModoRuta;
}

/**
 * Abre una parada desde la lista de ruta.
 */
export function abrirParadaDesdeLista(paradaId, codBoca, rutaId) {
  abrirParada(paradaId, codBoca, rutaId);
}

/**
 * Abre una parada, carga sus facturas y muestra el panel lateral.
 */
export async function abrirParada(paradaId, codBoca, rutaId) {
  const parada = buscarParadaPorClaves({
    paradaId,
    codBoca,
    rutaId
  });

  if (!parada) {
    toastEntrega("No se encontró la parada.", "error");
    return;
  }

  state.paradaActiva = parada;
  state.facturaActiva = null;

  actualizarHeaderPanel(parada);
  abrirPanel();

  setSideBody(renderLoading("Cargando facturas..."));

  try {
    const result = await cargarFacturasParada(parada);

    if (!result.ok) {
      setSideBody(renderPanelMensaje(result.mensaje || "No se pudieron cargar las facturas."));
      return;
    }

    renderFacturas(result.data || []);

  } catch (error) {
    console.error("LOGITRACK abrirParada error:", error);
    setSideBody(renderPanelMensaje("Error al cargar facturas:\n" + (error.message || error), true));
  }
}

/**
 * Renderiza las facturas de la parada activa.
 */
export function renderFacturas(facturas) {
  const parada = state.paradaActiva;

  if (!parada) {
    setSideBody(renderPanelMensaje("No hay una parada activa."));
    return;
  }

  if (!facturas || !facturas.length) {
    setSideBody(`
      ${renderAvisoModoRuta()}
      ${renderResumenParada(parada)}
      ${renderPanelMensaje("No hay facturas para esta parada.")}
    `);
    return;
  }

  const html = `
    ${renderAvisoModoRuta()}
    ${renderResumenParada(parada)}

    <div class="section-title">Facturas a entregar</div>

    ${facturas.map(f => renderFacturaCard(f)).join("")}
  `;

  setSideBody(html);
}

/**
 * Tarjeta visual de una factura.
 */
function renderFacturaCard(f) {
  const estado = cleanEstado(f.EstadoFactura || "PENDIENTE");
  const facturaId = String(f.FacturaID || "");
  const bloqueado = rutaBloqueadaParaGestion();
  const disabledAttr = bloqueado ? "disabled" : "";
  const disabledTitle = bloqueado ? `title="${escapeAttr(mensajeRutaBloqueada())}"` : "";
  const opcionesId = crearIdDom("factura-opciones", facturaId);

  return `
    <div class="card factura-card" data-factura-id="${escapeAttr(facturaId)}">
      <div class="card-header">
        <div>
          <div class="card-title">Factura ${escapeHtml(f.NumFactura || "")}</div>

          <div class="card-meta">
            Pedido: ${escapeHtml(f.NumPedido || "")}<br>
            Productos: ${f.CantidadProductos || 0}<br>
            Peso: ${formatoNum.format(toNumber(f.TotalPesoKg))} kg |
            Importe: Gs. ${formatoGs.format(toNumber(f.TotalImporte))}
          </div>
        </div>

        <span class="badge ${estado}">${estado}</span>
      </div>

      <div class="btn-row">
        <button class="btn-secondary" onclick="window.verProductos('${escapeAttr(facturaId)}')">
          Ver productos
        </button>

        <button
          class="btn-success"
          ${disabledAttr}
          ${disabledTitle}
          onclick="window.confirmarFactura('${escapeAttr(facturaId)}')"
        >
          Entregar completa
        </button>
      </div>

      <div class="btn-row">
        <button class="btn-neutral" onclick="window.toggleOpcionesFactura('${escapeAttr(facturaId)}')">
          Más opciones
        </button>
      </div>

      <div id="${escapeAttr(opcionesId)}" class="factura-opciones" style="display:none;margin-top:10px;">
        <div class="panel-empty" style="margin-bottom:10px;">
          Acciones críticas de la factura. Usar solo si corresponde.
        </div>

        <div class="btn-row">
          <button
            class="btn-danger"
            ${disabledAttr}
            ${disabledTitle}
            onclick="window.rechazarFactura('${escapeAttr(facturaId)}')"
          >
            Rechazar total
          </button>

          <button
            class="btn-neutral"
            ${disabledAttr}
            ${disabledTitle}
            onclick="window.noDespachadoFactura('${escapeAttr(facturaId)}')"
          >
            No despachada
          </button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Muestra/oculta opciones críticas de factura.
 */
export function toggleOpcionesFactura(facturaId) {
  const id = crearIdDom("factura-opciones", facturaId);
  const el = document.getElementById(id);

  if (!el) return;

  el.style.display = el.style.display === "none" || !el.style.display
    ? "block"
    : "none";
}

/**
 * Carga y muestra los productos de una factura.
 */
export async function verProductos(facturaId) {
  const id = String(facturaId || "").trim();

  if (!id) {
    toastEntrega("Factura inválida.", "error");
    return;
  }

  state.facturaActiva = id;

  setSideBody(renderLoading("Cargando productos..."));

  try {
    const result = await cargarProductosFactura(id);

    if (!result.ok) {
      setSideBody(renderPanelMensaje(result.mensaje || "No se pudieron cargar los productos."));
      return;
    }

    renderProductos(id, result.data || []);

  } catch (error) {
    console.error("LOGITRACK verProductos error:", error);
    setSideBody(renderPanelMensaje("Error al cargar productos:\n" + (error.message || error), true));
  }
}

/**
 * Renderiza productos de una factura.
 */
export function renderProductos(facturaId, productos) {
  if (!productos || !productos.length) {
    setSideBody(`
      ${renderAvisoModoRuta()}
      ${renderBotonVolverFacturas()}
      ${renderPanelMensaje("No hay productos para esta factura.")}
    `);
    return;
  }

  const factura = buscarFactura(facturaId);
  const titulo = factura ? `Factura ${factura.NumFactura || ""}` : "Productos de factura";

  const html = `
    ${renderAvisoModoRuta()}
    ${renderBotonVolverFacturas()}

    <div class="section-title">${escapeHtml(titulo)}</div>

    ${factura ? renderResumenFactura(factura) : ""}

    <div class="panel-empty" style="margin-bottom:10px;">
      Seleccione el tipo de entrega de cada producto. Solo se pedirá cantidad o motivo cuando aplique.
    </div>

    ${productos.map(p => renderProductoCard(p)).join("")}
  `;

  setSideBody(html);
}

/**
 * Resumen superior de la parada.
 */
function renderResumenParada(parada) {
  const estado = cleanEstado(parada.EstadoParada || "PENDIENTE");

  return `
    <div class="card">
      <div class="card-header">
        <div>
          <div class="card-title">${escapeHtml(parada.Cliente || parada.Boca || "Cliente")}</div>

          <div class="card-meta">
            CodBoca: ${escapeHtml(parada.CodBoca || "")}<br>
            ${escapeHtml(parada.Ciudad || "")} | ${escapeHtml(parada.Zona || "")}<br>
            Dirección: ${escapeHtml(parada.Direccion || "-")}<br>
            Facturas: ${parada.CantidadFacturas || 0} |
            Productos: ${parada.CantidadProductos || 0}<br>
            Peso: ${formatoNum.format(toNumber(parada.TotalPesoKg))} kg |
            Pallets: ${formatoNum.format(toNumber(parada.TotalPallets))}
          </div>
        </div>

        <span class="badge ${estado}">${estado}</span>
      </div>

      <div class="btn-row">
        <a class="link-gps" target="_blank" href="https://www.google.com/maps/dir/?api=1&destination=${escapeAttr(parada.Latitud || "")},${escapeAttr(parada.Longitud || "")}">
          Ir con GPS
        </a>

        <button class="btn-secondary" onclick="window.refrescarParadaActiva()">
          Refrescar
        </button>
      </div>
    </div>
  `;
}

/**
 * Resumen de factura antes de los productos.
 */
function renderResumenFactura(factura) {
  const estado = cleanEstado(factura.EstadoFactura || "PENDIENTE");

  return `
    <div class="card">
      <div class="card-header">
        <div>
          <div class="card-title">Resumen factura</div>

          <div class="card-meta">
            Factura: ${escapeHtml(factura.NumFactura || "")}<br>
            Pedido: ${escapeHtml(factura.NumPedido || "")}<br>
            Productos: ${factura.CantidadProductos || 0}<br>
            Peso: ${formatoNum.format(toNumber(factura.TotalPesoKg))} kg |
            Importe: Gs. ${formatoGs.format(toNumber(factura.TotalImporte))}
          </div>
        </div>

        <span class="badge ${estado}">${estado}</span>
      </div>
    </div>
  `;
}

/**
 * Tarjeta visual de producto con gestión intuitiva.
 */
function renderProductoCard(p) {
  const estado = cleanEstado(p.EstadoProducto || "PENDIENTE");
  const productoFacturaId = String(p.ProductoFacturaID || "");
  const planificado = toNumber(p.CantidadPlanificada);
  const bloqueado = rutaBloqueadaParaGestion();
  const disabledAttr = bloqueado ? "disabled" : "";
  const disabledTitle = bloqueado ? `title="${escapeAttr(mensajeRutaBloqueada())}"` : "";

  return `
    <div
      class="card producto-gestion-card"
      data-producto-id="${escapeAttr(productoFacturaId)}"
      data-planificado="${escapeAttr(planificado)}"
      data-estado-seleccionado=""
    >
      <div class="card-header">
        <div>
          <div class="card-title">
            ${escapeHtml(p.ProductoMaestro || p.DescripcionProducto || "Producto")}
          </div>

          <div class="card-meta">
            Código: ${escapeHtml(p.CodProducto || "")}<br>
            Planificado: ${formatoNum.format(planificado)} ${escapeHtml(p.UnidadMedida || "")}<br>
            Unidades: ${formatoNum.format(toNumber(p.CantidadUnidades))}<br>
            Cajas: ${formatoNum.format(toNumber(p.CajasCalculadas))} |
            Pallets: ${formatoNum.format(toNumber(p.PalletsCalculados))}<br>
            Peso: ${formatoNum.format(toNumber(p.PesoKgCalculado))} kg
          </div>
        </div>

        <span class="badge ${estado}">${estado}</span>
      </div>

      <div class="product-line">
        Entregado: ${escapeHtml(p.CantidadEntregada || "-")} |
        Rechazado: ${escapeHtml(p.CantidadRechazada || "-")}<br>
        Motivo: ${escapeHtml(p.MotivoProducto || "-")}
      </div>

      <div class="section-title" style="margin-top:12px;">Tipo de entrega</div>

      <div class="btn-row-4 product-status-row">
        <button
          class="btn-success product-status-btn"
          ${disabledAttr}
          ${disabledTitle}
          onclick="window.seleccionarEstadoProducto('${escapeAttr(productoFacturaId)}', 'ENTREGADO_TOTAL')"
        >
          Entregado
        </button>

        <button
          class="btn-warning product-status-btn"
          ${disabledAttr}
          ${disabledTitle}
          onclick="window.seleccionarEstadoProducto('${escapeAttr(productoFacturaId)}', 'ENTREGADO_PARCIAL')"
        >
          Parcial
        </button>

        <button
          class="btn-danger product-status-btn"
          ${disabledAttr}
          ${disabledTitle}
          onclick="window.seleccionarEstadoProducto('${escapeAttr(productoFacturaId)}', 'RECHAZADO_TOTAL')"
        >
          Rechazado
        </button>

        <button
          class="btn-neutral product-status-btn"
          ${disabledAttr}
          ${disabledTitle}
          onclick="window.seleccionarEstadoProducto('${escapeAttr(productoFacturaId)}', 'NO_DESPACHADO')"
        >
          No desp.
        </button>
      </div>

      <div class="producto-form" style="display:none;margin-top:12px;">
        <div class="panel-empty producto-ayuda" style="margin-bottom:10px;">
          Seleccione un tipo de entrega.
        </div>

        <div class="form-group producto-cantidad-wrap" style="display:none;">
          <label>Cantidad entregada</label>
          <input
            class="producto-cantidad-input"
            type="number"
            inputmode="decimal"
            min="0"
            step="0.01"
            placeholder="Ej: ${escapeAttr(planificado)}"
          />
        </div>

        <div class="form-group producto-motivo-wrap" style="display:none;">
          <label>Motivo</label>
          <select class="producto-motivo-select">
            <option value="">Seleccione motivo</option>
            ${MOTIVOS_PRODUCTO.map(m => `<option value="${escapeAttr(m)}">${escapeHtml(m)}</option>`).join("")}
          </select>
        </div>

        <div class="form-group producto-motivo-otro-wrap" style="display:none;">
          <label>Detalle del motivo</label>
          <textarea
            class="producto-motivo-otro"
            rows="2"
            placeholder="Detalle brevemente el motivo"
          ></textarea>
        </div>

        <div class="btn-row">
          <button
            class="btn-success"
            ${disabledAttr}
            ${disabledTitle}
            onclick="window.guardarGestionProducto('${escapeAttr(productoFacturaId)}')"
          >
            Guardar producto
          </button>

          <button
            class="btn-secondary"
            onclick="window.limpiarGestionProducto('${escapeAttr(productoFacturaId)}')"
          >
            Limpiar
          </button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Selecciona visualmente el estado del producto.
 */
export function seleccionarEstadoProducto(productoFacturaId, estado) {
  if (rutaBloqueadaParaGestion()) {
    toastEntrega(mensajeRutaBloqueada(), "error");
    return;
  }

  const card = buscarCardProducto(productoFacturaId);

  if (!card) {
    toastEntrega("No se encontró el producto en pantalla.", "error");
    return;
  }

  const estadoNormalizado = String(estado || "").trim().toUpperCase();

  if (!Object.values(ESTADOS_PRODUCTO).includes(estadoNormalizado)) {
    toastEntrega("Estado de producto inválido.", "error");
    return;
  }

  card.dataset.estadoSeleccionado = estadoNormalizado;

  card.querySelectorAll(".product-status-btn").forEach(btn => {
    btn.classList.remove("selected", "active");
    btn.style.outline = "";
    btn.style.transform = "";
  });

  const botones = Array.from(card.querySelectorAll(".product-status-btn"));
  const botonSeleccionado = botones.find(btn => {
    const onclick = btn.getAttribute("onclick") || "";
    return onclick.includes(estadoNormalizado);
  });

  if (botonSeleccionado) {
    botonSeleccionado.classList.add("selected", "active");
    botonSeleccionado.style.outline = "3px solid rgba(15, 23, 42, 0.25)";
    botonSeleccionado.style.transform = "scale(0.98)";
  }

  actualizarFormularioProducto(card, estadoNormalizado);
}

/**
 * Ajusta campos visibles según estado elegido.
 */
function actualizarFormularioProducto(card, estado) {
  const form = card.querySelector(".producto-form");
  const ayuda = card.querySelector(".producto-ayuda");
  const cantidadWrap = card.querySelector(".producto-cantidad-wrap");
  const motivoWrap = card.querySelector(".producto-motivo-wrap");
  const motivoOtroWrap = card.querySelector(".producto-motivo-otro-wrap");
  const cantidadInput = card.querySelector(".producto-cantidad-input");
  const motivoSelect = card.querySelector(".producto-motivo-select");
  const motivoOtro = card.querySelector(".producto-motivo-otro");

  if (form) form.style.display = "block";

  if (cantidadWrap) cantidadWrap.style.display = "none";
  if (motivoWrap) motivoWrap.style.display = "none";
  if (motivoOtroWrap) motivoOtroWrap.style.display = "none";

  if (cantidadInput) cantidadInput.value = "";
  if (motivoSelect) motivoSelect.value = "";
  if (motivoOtro) motivoOtro.value = "";

  if (estado === ESTADOS_PRODUCTO.ENTREGADO_TOTAL) {
    if (ayuda) {
      ayuda.innerHTML = "Se marcará como <b>entregado total</b>. No necesita cantidad ni motivo.";
    }
    return;
  }

  if (estado === ESTADOS_PRODUCTO.ENTREGADO_PARCIAL) {
    if (ayuda) {
      ayuda.innerHTML = "Entrega parcial: cargue la cantidad entregada y el motivo.";
    }
    if (cantidadWrap) cantidadWrap.style.display = "block";
    if (motivoWrap) motivoWrap.style.display = "block";
    return;
  }

  if (estado === ESTADOS_PRODUCTO.RECHAZADO_TOTAL) {
    if (ayuda) {
      ayuda.innerHTML = "Rechazo total: indique el motivo del rechazo.";
    }
    if (motivoWrap) motivoWrap.style.display = "block";
    return;
  }

  if (estado === ESTADOS_PRODUCTO.NO_DESPACHADO) {
    if (ayuda) {
      ayuda.innerHTML = "No despachado: indique el motivo.";
    }
    if (motivoWrap) motivoWrap.style.display = "block";
  }
}

/**
 * Guarda la gestión del producto sin usar prompts.
 */
export async function guardarGestionProducto(productoFacturaId) {
  if (!validarContextoGestionProducto()) return;

  const card = buscarCardProducto(productoFacturaId);

  if (!card) {
    toastEntrega("No se encontró el producto en pantalla.", "error");
    return;
  }

  const estadoProducto = String(card.dataset.estadoSeleccionado || "").trim().toUpperCase();

  if (!estadoProducto) {
    toastEntrega("Seleccione el tipo de entrega del producto.", "error");
    return;
  }

  let cantidadEntregada = "";
  let motivo = "";

  if (estadoProducto === ESTADOS_PRODUCTO.ENTREGADO_PARCIAL) {
    cantidadEntregada = normalizarCantidad(card.querySelector(".producto-cantidad-input")?.value || "");

    if (!cantidadEntregada) {
      toastEntrega("Ingrese una cantidad entregada válida.", "error");
      return;
    }
  }

  if (
    estadoProducto === ESTADOS_PRODUCTO.ENTREGADO_PARCIAL ||
    estadoProducto === ESTADOS_PRODUCTO.RECHAZADO_TOTAL ||
    estadoProducto === ESTADOS_PRODUCTO.NO_DESPACHADO
  ) {
    motivo = obtenerMotivoProducto(card);

    if (!motivo) {
      toastEntrega("Debe seleccionar o escribir un motivo.", "error");
      return;
    }
  }

  await ejecutarActualizacionProducto({
    productoFacturaId,
    estadoProducto,
    cantidadEntregada,
    motivo
  });
}

/**
 * Ejecuta actualización de producto contra Apps Script.
 */
async function ejecutarActualizacionProducto({
  productoFacturaId,
  estadoProducto,
  cantidadEntregada,
  motivo
}) {
  if (accionProductoPantallaEnCurso) {
    toastEntrega("Ya hay una gestión de producto en proceso. Aguarde...", "error");
    return;
  }

  accionProductoPantallaEnCurso = true;

  try {
    toastEntrega("Capturando ubicación...");

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
      toastEntrega(data.mensaje || "No se pudo actualizar el producto.", "error");
      return;
    }

    state.facturasCache = {};
    state.productosCache = {};

    toastEntrega(data.mensaje || "Producto actualizado.", "ok");

    if (typeof window.refrescarDespuesDeGestion === "function") {
      await window.refrescarDespuesDeGestion();
      return;
    }

    await refrescarParadaActiva();

  } catch (error) {
    console.error("LOGITRACK guardarGestionProducto error:", error);
    toastEntrega("Error al actualizar producto:\n" + (error.message || error), "error");

  } finally {
    accionProductoPantallaEnCurso = false;
  }
}

/**
 * Limpia selección y campos de un producto.
 */
export function limpiarGestionProducto(productoFacturaId) {
  const card = buscarCardProducto(productoFacturaId);

  if (!card) return;

  card.dataset.estadoSeleccionado = "";

  card.querySelectorAll(".product-status-btn").forEach(btn => {
    btn.classList.remove("selected", "active");
    btn.style.outline = "";
    btn.style.transform = "";
  });

  const form = card.querySelector(".producto-form");
  const ayuda = card.querySelector(".producto-ayuda");
  const cantidadInput = card.querySelector(".producto-cantidad-input");
  const motivoSelect = card.querySelector(".producto-motivo-select");
  const motivoOtro = card.querySelector(".producto-motivo-otro");

  if (form) form.style.display = "none";
  if (ayuda) ayuda.textContent = "Seleccione un tipo de entrega.";
  if (cantidadInput) cantidadInput.value = "";
  if (motivoSelect) motivoSelect.value = "";
  if (motivoOtro) motivoOtro.value = "";
}

/**
 * Botón para volver desde productos a facturas.
 */
function renderBotonVolverFacturas() {
  return `
    <button class="btn-secondary" style="margin-bottom:10px;width:100%;" onclick="window.volverAFacturas()">
      ← Volver a facturas
    </button>
  `;
}

/**
 * Vuelve a facturas de la parada activa.
 */
export async function volverAFacturas() {
  const parada = state.paradaActiva;

  if (!parada) {
    setSideBody(renderPanelMensaje("No hay una parada activa."));
    return;
  }

  state.facturaActiva = null;

  setSideBody(renderLoading("Cargando facturas..."));

  try {
    const result = await cargarFacturasParada(parada);

    if (!result.ok) {
      setSideBody(renderPanelMensaje(result.mensaje || "No se pudieron cargar las facturas."));
      return;
    }

    renderFacturas(result.data || []);

  } catch (error) {
    console.error("LOGITRACK volverAFacturas error:", error);
    setSideBody(renderPanelMensaje("Error al volver a facturas:\n" + (error.message || error), true));
  }
}

/**
 * Refresca la parada activa ignorando el cache local.
 */
export async function refrescarParadaActiva() {
  const parada = state.paradaActiva;

  if (!parada) {
    toastEntrega("No hay una parada activa.", "error");
    return;
  }

  const cacheKey = String(parada.ParadaID || `${parada.RutaID || ""}|${parada.CodBoca || ""}`);

  if (cacheKey && state.facturasCache[cacheKey]) {
    delete state.facturasCache[cacheKey];
  }

  if (parada.ParadaID && state.facturasCache[String(parada.ParadaID)]) {
    delete state.facturasCache[String(parada.ParadaID)];
  }

  await abrirParada(
    parada.ParadaID || "",
    parada.CodBoca || "",
    parada.RutaID || ""
  );
}

/**
 * Actualiza título y subtítulo del panel lateral.
 */
function actualizarHeaderPanel(parada) {
  const sideTitle = document.getElementById("sideTitle");
  const sideSubtitle = document.getElementById("sideSubtitle");

  if (sideTitle) {
    sideTitle.textContent = parada.Cliente || parada.Boca || "Cliente";
  }

  if (sideSubtitle) {
    sideSubtitle.innerHTML =
      `CodBoca: ${escapeHtml(parada.CodBoca || "")}<br>` +
      `Ciudad: ${escapeHtml(parada.Ciudad || "")} | Estado: ${escapeHtml(parada.EstadoParada || "PENDIENTE")}`;
  }
}

/**
 * Abre panel lateral.
 */
export function abrirPanel() {
  const panel = document.getElementById("sidePanel");

  if (panel) {
    panel.classList.add("active");
  }
}

/**
 * Cierra panel lateral.
 */
export function cerrarPanel() {
  const panel = document.getElementById("sidePanel");

  if (panel) {
    panel.classList.remove("active");
  }

  state.facturaActiva = null;
}

/**
 * Escribe contenido dentro del panel lateral.
 */
export function setSideBody(html) {
  const sideBody = document.getElementById("sideBody");

  if (!sideBody) {
    console.warn("No existe #sideBody en index.html.");
    return;
  }

  sideBody.innerHTML = html;

  inicializarEventosProductoForm();
}

/**
 * Inicializa listeners internos de formularios de producto.
 */
function inicializarEventosProductoForm() {
  document.querySelectorAll(".producto-motivo-select").forEach(select => {
    select.addEventListener("change", () => {
      const card = select.closest(".producto-gestion-card");
      if (!card) return;

      const otroWrap = card.querySelector(".producto-motivo-otro-wrap");

      if (!otroWrap) return;

      otroWrap.style.display = select.value === "Otro" ? "block" : "none";
    });
  });
}

/**
 * Valida contexto general de gestión.
 */
function validarContextoGestionProducto() {
  if (!state.ci || !state.chapa || !state.fecha) {
    toastEntrega("No hay una ruta activa. Vuelve a cargar la ruta.", "error");
    return false;
  }

  if (rutaBloqueadaParaGestion()) {
    toastEntrega(mensajeRutaBloqueada(), "error");
    return false;
  }

  return true;
}

/**
 * Indica si la ruta debe bloquear botones operativos.
 */
function rutaBloqueadaParaGestion() {
  const modo = String(state.modoConsulta || "OPERATIVO").trim().toUpperCase();

  return Boolean(
    state.soloLectura === true ||
    state.rutaCerrada === true ||
    modo === "HISTORICO_CERRADO"
  );
}

/**
 * Mensaje operativo cuando la ruta está bloqueada.
 */
function mensajeRutaBloqueada() {
  const modo = String(state.modoConsulta || "OPERATIVO").trim().toUpperCase();

  if (modo === "HISTORICO_CERRADO") {
    return "Ruta histórica cerrada. Solo consulta.";
  }

  if (state.rutaCerrada) {
    return "Ruta cerrada. No permite modificaciones.";
  }

  if (state.soloLectura) {
    return "Ruta en solo lectura. No permite modificaciones.";
  }

  return "Ruta bloqueada para gestión.";
}

/**
 * Aviso visible del modo de ruta.
 */
function renderAvisoModoRuta() {
  const modo = String(state.modoConsulta || "OPERATIVO").trim().toUpperCase();

  if (modo === "HISTORICO_PENDIENTE" && !rutaBloqueadaParaGestion()) {
    return `
      <div class="panel-empty" style="margin-bottom:10px;border-left:4px solid #f59e0b;">
        ⚠️ Ruta histórica pendiente. Se permite continuar la gestión porque no está cerrada.
      </div>
    `;
  }

  if (modo === "HISTORICO_CERRADO" || rutaBloqueadaParaGestion()) {
    return `
      <div class="cierre-warning" style="margin-bottom:10px;">
        🔒 ${escapeHtml(mensajeRutaBloqueada())}
      </div>
    `;
  }

  return "";
}

/**
 * Busca card de producto en pantalla.
 */
function buscarCardProducto(productoFacturaId) {
  const id = String(productoFacturaId || "");

  return Array.from(document.querySelectorAll(".producto-gestion-card"))
    .find(card => String(card.dataset.productoId || "") === id) || null;
}

/**
 * Normaliza cantidad entregada.
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
 * Obtiene motivo desde select o texto libre.
 */
function obtenerMotivoProducto(card) {
  const select = card.querySelector(".producto-motivo-select");
  const otro = card.querySelector(".producto-motivo-otro");

  const motivoBase = String(select?.value || "").trim();

  if (motivoBase === "Otro") {
    return String(otro?.value || "").trim();
  }

  return motivoBase;
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
 * Crea ID seguro para elementos DOM.
 */
function crearIdDom(prefix, value) {
  return `${prefix}-${String(value || "")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 80)}`;
}

/**
 * Mensaje de carga.
 */
function renderLoading(texto) {
  return `
    <div class="panel-loading">
      ${escapeHtml(texto || "Cargando...")}
    </div>
  `;
}

/**
 * Mensaje simple del panel.
 */
function renderPanelMensaje(texto, isError = false) {
  return `
    <div class="${isError ? "cierre-warning" : "panel-empty"}">
      ${escapeHtml(texto || "Sin datos.").replace(/\n/g, "<br>")}
    </div>
  `;
}

/**
 * Toast local del módulo.
 */
function toastEntrega(msg, type) {
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
