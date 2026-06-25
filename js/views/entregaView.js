// LOGITRACK - entregaView.js
// Vista de gestión de entrega:
// - Abrir parada / cliente
// - Cargar facturas de una parada
// - Cargar productos de una factura
// - Renderizar panel lateral de gestión
// - Gestión intuitiva por producto desde pantalla
// - Mantener compatibilidad con onclick globales
//
// Versión 1.7 - Fase 1.2-B Visual Pro:
// - Agrega bloque "Estado de entrega" al entrar a Gestionar.
// - Mantiene Cantidad Ruteada / Planificada como dato fijo.
// - Permite editar solo Cantidad Entregada / Recibida.
// - Agrega controles + / - para cantidad entregada.
// - Entregado total: cantidad entregada = cantidad ruteada.
// - Parcial: cantidad entregada editable y motivo obligatorio.
// - Rechazado / No despachado: cantidad entregada = 0 y motivo obligatorio.
// - Quita GPS y Refrescar dentro del módulo Gestionar.
// - Centraliza actualización de producto en productoActions.js.
// - Mantiene bloqueo por soloLectura, rutaCerrada o HISTORICO_CERRADO.

import { state } from "../state.js";

import {
  buscarParadaPorClaves,
  cargarFacturasParada,
  cargarProductosFactura,
  buscarFactura
} from "../services/routeService.js?v=1.7";

import {
  cleanEstado,
  escapeHtml,
  escapeAttr,
  formatoNum,
  formatoGs,
  toNumber
} from "../utils.js?v=1.7";

const ESTADOS_PRODUCTO = {
  ENTREGADO_TOTAL: "ENTREGADO_TOTAL",
  ENTREGADO_PARCIAL: "ENTREGADO_PARCIAL",
  RECHAZADO_TOTAL: "RECHAZADO_TOTAL",
  NO_DESPACHADO: "NO_DESPACHADO"
};

const ESTADO_ENTREGA_DEFAULT = ESTADOS_PRODUCTO.ENTREGADO_TOTAL;

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

  window.seleccionarEstadoEntrega = seleccionarEstadoEntrega;
  window.seleccionarEstadoProducto = seleccionarEstadoProducto;
  window.ajustarCantidadProducto = ajustarCantidadProducto;
  window.sincronizarCantidadProducto = sincronizarCantidadProducto;
  window.guardarGestionProducto = guardarGestionProducto;
  window.limpiarGestionProducto = limpiarGestionProducto;

  window.rutaBloqueadaEntrega = rutaBloqueadaParaGestion;
  window.renderAvisoModoRuta = renderAvisoModoRuta;
}

export function abrirParadaDesdeLista(paradaId, codBoca, rutaId) {
  abrirParada(paradaId, codBoca, rutaId);
}

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
  state.estadoEntregaSeleccionado = ESTADO_ENTREGA_DEFAULT;

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

export function renderFacturas(facturas) {
  const parada = state.paradaActiva;

  if (!parada) {
    setSideBody(renderPanelMensaje("No hay una parada activa."));
    return;
  }

  if (!facturas || !facturas.length) {
    setSideBody(`
      ${renderAvisoModoRuta()}
      ${renderHeaderGestionParada(parada)}
      ${renderEstadoEntrega()}
      ${renderPanelMensaje("No hay facturas para esta parada.")}
    `);
    return;
  }

  const html = `
    ${renderAvisoModoRuta()}
    ${renderHeaderGestionParada(parada)}
    ${renderEstadoEntrega()}

    <div class="gestion-section-head">
      <div>
        <div class="gestion-section-title">Entrega por documentos</div>
        <div class="gestion-section-subtitle">${facturas.length} factura(s) asociada(s) a este cliente</div>
      </div>
    </div>

    ${facturas.map(f => renderFacturaCard(f)).join("")}
  `;

  setSideBody(html);
}

function renderHeaderGestionParada(parada) {
  const estado = cleanEstado(parada.EstadoParada || "PENDIENTE");

  return `
    <div class="gestion-cliente-card">
      <div class="gestion-cliente-top">
        <div>
          <div class="gestion-small-label">Detalle de parada</div>
          <div class="gestion-cliente-nombre">${escapeHtml(parada.Cliente || parada.Boca || "Cliente")}</div>
          <div class="gestion-cliente-meta">
            CodBoca: ${escapeHtml(parada.CodBoca || "")}<br>
            ${escapeHtml(parada.Ciudad || "")} | ${escapeHtml(parada.Zona || "")}
          </div>
        </div>

        <span class="badge ${estado}">${estado}</span>
      </div>

      <div class="gestion-kpi-grid">
        <div class="gestion-kpi">
          <b>${parada.CantidadFacturas || 0}</b>
          <span>Facturas</span>
        </div>

        <div class="gestion-kpi">
          <b>${parada.CantidadProductos || 0}</b>
          <span>Productos</span>
        </div>

        <div class="gestion-kpi">
          <b>${formatoNum.format(toNumber(parada.TotalPesoKg))}</b>
          <span>Kg</span>
        </div>

        <div class="gestion-kpi">
          <b>${formatoNum.format(toNumber(parada.TotalPallets))}</b>
          <span>Pallets</span>
        </div>
      </div>
    </div>
  `;
}

function renderEstadoEntrega() {
  const estadoActual = state.estadoEntregaSeleccionado || ESTADO_ENTREGA_DEFAULT;
  const bloqueado = rutaBloqueadaParaGestion();
  const disabledAttr = bloqueado ? "disabled" : "";

  return `
    <div class="gestion-estado-card">
      <div class="gestion-section-title" style="margin-bottom:10px;">Estado de entrega</div>

      <div class="gestion-estado-list">
        ${renderEstadoOption({
          estado: ESTADOS_PRODUCTO.ENTREGADO_TOTAL,
          label: "Entregado",
          ayuda: "Entrega completa de la factura o producto.",
          estadoActual,
          disabledAttr
        })}

        ${renderEstadoOption({
          estado: ESTADOS_PRODUCTO.ENTREGADO_PARCIAL,
          label: "Entrega parcial",
          ayuda: "Permite cargar cantidad entregada real.",
          estadoActual,
          disabledAttr
        })}

        ${renderEstadoOption({
          estado: ESTADOS_PRODUCTO.RECHAZADO_TOTAL,
          label: "Rechazado",
          ayuda: "Cliente rechaza la mercadería.",
          estadoActual,
          disabledAttr
        })}

        ${renderEstadoOption({
          estado: ESTADOS_PRODUCTO.NO_DESPACHADO,
          label: "No despachado",
          ayuda: "Mercadería no salió o no corresponde entregar.",
          estadoActual,
          disabledAttr
        })}
      </div>
    </div>
  `;
}

function renderEstadoOption({
  estado,
  label,
  ayuda,
  estadoActual,
  disabledAttr
}) {
  const active = estadoActual === estado ? "active" : "";

  return `
    <button
      type="button"
      class="gestion-estado-option ${active}"
      ${disabledAttr}
      onclick="window.seleccionarEstadoEntrega('${escapeAttr(estado)}')"
    >
      <span class="gestion-radio-dot"></span>
      <span>
        <b>${escapeHtml(label)}</b>
        <small>${escapeHtml(ayuda)}</small>
      </span>
    </button>
  `;
}

export function seleccionarEstadoEntrega(estado) {
  if (rutaBloqueadaParaGestion()) {
    toastEntrega(mensajeRutaBloqueada(), "error");
    return;
  }

  const estadoNormalizado = String(estado || "").trim().toUpperCase();

  if (!Object.values(ESTADOS_PRODUCTO).includes(estadoNormalizado)) {
    toastEntrega("Estado de entrega inválido.", "error");
    return;
  }

  state.estadoEntregaSeleccionado = estadoNormalizado;

  document.querySelectorAll(".gestion-estado-option").forEach(btn => {
    btn.classList.remove("active");
  });

  document.querySelectorAll(".gestion-estado-option").forEach(btn => {
    const onclick = btn.getAttribute("onclick") || "";
    if (onclick.includes(estadoNormalizado)) {
      btn.classList.add("active");
    }
  });

  aplicarEstadoEntregaAProductosVisibles(estadoNormalizado);
}

function aplicarEstadoEntregaAProductosVisibles(estado) {
  document.querySelectorAll(".producto-gestion-card").forEach(card => {
    const productoId = card.dataset.productoId || "";
    if (productoId) {
      seleccionarEstadoProducto(productoId, estado);
    }
  });
}

function renderFacturaCard(f) {
  const estado = cleanEstado(f.EstadoFactura || "PENDIENTE");
  const facturaId = String(f.FacturaID || "");
  const bloqueado = rutaBloqueadaParaGestion();
  const disabledAttr = bloqueado ? "disabled" : "";
  const disabledTitle = bloqueado ? `title="${escapeAttr(mensajeRutaBloqueada())}"` : "";
  const opcionesId = crearIdDom("factura-opciones", facturaId);

  return `
    <div class="gestion-factura-card" data-factura-id="${escapeAttr(facturaId)}">
      <div class="gestion-factura-head">
        <div>
          <div class="gestion-factura-title">Factura ${escapeHtml(f.NumFactura || "")}</div>
          <div class="gestion-factura-meta">
            Pedido: ${escapeHtml(f.NumPedido || "")}<br>
            Productos: ${f.CantidadProductos || 0} |
            Peso: ${formatoNum.format(toNumber(f.TotalPesoKg))} kg<br>
            Importe: Gs. ${formatoGs.format(toNumber(f.TotalImporte))}
          </div>
        </div>

        <span class="badge ${estado}">${estado}</span>
      </div>

      <div class="gestion-action-primary">
        <button class="btn-secondary" onclick="window.verProductos('${escapeAttr(facturaId)}')">
          Gestionar productos
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

      <button class="gestion-link-danger" onclick="window.toggleOpcionesFactura('${escapeAttr(facturaId)}')">
        Mostrar acciones de excepción
      </button>

      <div id="${escapeAttr(opcionesId)}" class="gestion-exception-box" style="display:none;">
        <div class="gestion-exception-title">Acciones de excepción</div>
        <div class="gestion-exception-text">
          Use estas opciones solo cuando la factura completa no será entregada.
        </div>

        <div class="gestion-action-primary">
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

export function toggleOpcionesFactura(facturaId) {
  const id = crearIdDom("factura-opciones", facturaId);
  const el = document.getElementById(id);

  if (!el) return;

  el.style.display = el.style.display === "none" || !el.style.display
    ? "block"
    : "none";
}

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

export function renderProductos(facturaId, productos) {
  if (!productos || !productos.length) {
    setSideBody(`
      ${renderAvisoModoRuta()}
      ${renderBotonVolverFacturas()}
      ${renderEstadoEntrega()}
      ${renderPanelMensaje("No hay productos para esta factura.")}
    `);
    return;
  }

  const factura = buscarFactura(facturaId);

  const html = `
    ${renderAvisoModoRuta()}
    ${renderBotonVolverFacturas()}
    ${renderEstadoEntrega()}

    ${factura ? renderHeaderFacturaProductos(factura) : ""}

    <div class="gestion-section-head">
      <div>
        <div class="gestion-section-title">Productos asociados</div>
        <div class="gestion-section-subtitle">
          La cantidad ruteada no se modifica. Solo registre la cantidad entregada real.
        </div>
      </div>
    </div>

    ${productos.map(p => renderProductoCard(p)).join("")}
  `;

  setSideBody(html);

  setTimeout(() => {
    aplicarEstadoEntregaAProductosVisibles(state.estadoEntregaSeleccionado || ESTADO_ENTREGA_DEFAULT);
  }, 50);
}

function renderHeaderFacturaProductos(factura) {
  const estado = cleanEstado(factura.EstadoFactura || "PENDIENTE");

  return `
    <div class="gestion-factura-resumen">
      <div class="gestion-factura-head">
        <div>
          <div class="gestion-factura-title">Factura ${escapeHtml(factura.NumFactura || "")}</div>
          <div class="gestion-factura-meta">
            Pedido: ${escapeHtml(factura.NumPedido || "")}<br>
            Productos: ${factura.CantidadProductos || 0} |
            Peso: ${formatoNum.format(toNumber(factura.TotalPesoKg))} kg<br>
            Importe: Gs. ${formatoGs.format(toNumber(factura.TotalImporte))}
          </div>
        </div>

        <span class="badge ${estado}">${estado}</span>
      </div>
    </div>
  `;
}

function renderProductoCard(p) {
  const estado = cleanEstado(p.EstadoProducto || "PENDIENTE");
  const productoFacturaId = String(p.ProductoFacturaID || "");
  const planificado = toNumber(p.CantidadPlanificada);
  const cantidadActual = obtenerCantidadInicialEntregada(p, planificado);
  const bloqueado = rutaBloqueadaParaGestion();
  const disabledAttr = bloqueado ? "disabled" : "";
  const disabledTitle = bloqueado ? `title="${escapeAttr(mensajeRutaBloqueada())}"` : "";

  return `
    <div
      class="gestion-producto-card producto-gestion-card"
      data-producto-id="${escapeAttr(productoFacturaId)}"
      data-planificado="${escapeAttr(planificado)}"
      data-estado-seleccionado=""
    >
      <div class="gestion-producto-head">
        <div>
          <div class="gestion-producto-title">
            ${escapeHtml(p.ProductoMaestro || p.DescripcionProducto || "Producto")}
          </div>

          <div class="gestion-producto-meta">
            Código: ${escapeHtml(p.CodProducto || "")}<br>
            Cantidad ruteada: <b>${formatoNum.format(planificado)} ${escapeHtml(p.UnidadMedida || "")}</b><br>
            Cajas: ${formatoNum.format(toNumber(p.CajasCalculadas))} |
            Pallets: ${formatoNum.format(toNumber(p.PalletsCalculados))} |
            Peso: ${formatoNum.format(toNumber(p.PesoKgCalculado))} kg
          </div>
        </div>

        <span class="badge ${estado}">${estado}</span>
      </div>

      <div class="gestion-producto-resultado">
        Registrado entregado: ${escapeHtml(p.CantidadEntregada || "-")} |
        Rechazado: ${escapeHtml(p.CantidadRechazada || "-")}<br>
        Motivo: ${escapeHtml(p.MotivoProducto || "-")}
      </div>

      <div class="gestion-mini-label">Cantidad entregada real</div>

      <div class="gestion-qty-control">
        <button
          type="button"
          class="gestion-qty-btn"
          ${disabledAttr}
          ${disabledTitle}
          onclick="window.ajustarCantidadProducto('${escapeAttr(productoFacturaId)}', -1)"
        >
          −
        </button>

        <input
          class="producto-cantidad-input"
          type="number"
          inputmode="decimal"
          min="0"
          step="0.01"
          value="${escapeAttr(cantidadActual)}"
          onchange="window.sincronizarCantidadProducto('${escapeAttr(productoFacturaId)}')"
        />

        <button
          type="button"
          class="gestion-qty-btn"
          ${disabledAttr}
          ${disabledTitle}
          onclick="window.ajustarCantidadProducto('${escapeAttr(productoFacturaId)}', 1)"
        >
          +
        </button>
      </div>

      <div class="gestion-diferencia-line">
        Ruteado: <b>${formatoNum.format(planificado)}</b> |
        Entregado: <b class="producto-cantidad-preview">${formatoNum.format(toNumber(cantidadActual))}</b> |
        Diferencia: <b class="producto-diferencia-preview">${formatoNum.format(Math.max(planificado - toNumber(cantidadActual), 0))}</b>
      </div>

      <div class="gestion-mini-label">Resultado del producto</div>

      <div class="gestion-product-status-grid">
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

      <div class="producto-form gestion-producto-form" style="display:none;">
        <div class="gestion-form-help producto-ayuda">
          Seleccione un tipo de entrega.
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

        <div class="gestion-action-primary">
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

function obtenerCantidadInicialEntregada(p, planificado) {
  const entregado = toNumber(p.CantidadEntregada);

  if (entregado > 0) {
    return String(entregado);
  }

  return String(planificado || 0);
}

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
  });

  const botones = Array.from(card.querySelectorAll(".product-status-btn"));
  const botonSeleccionado = botones.find(btn => {
    const onclick = btn.getAttribute("onclick") || "";
    return onclick.includes(estadoNormalizado);
  });

  if (botonSeleccionado) {
    botonSeleccionado.classList.add("selected", "active");
  }

  actualizarFormularioProducto(card, estadoNormalizado);
}

function actualizarFormularioProducto(card, estado) {
  const form = card.querySelector(".producto-form");
  const ayuda = card.querySelector(".producto-ayuda");
  const motivoWrap = card.querySelector(".producto-motivo-wrap");
  const motivoOtroWrap = card.querySelector(".producto-motivo-otro-wrap");
  const motivoSelect = card.querySelector(".producto-motivo-select");
  const motivoOtro = card.querySelector(".producto-motivo-otro");
  const cantidadInput = card.querySelector(".producto-cantidad-input");
  const planificado = toNumber(card.dataset.planificado || 0);

  if (form) form.style.display = "block";
  if (motivoWrap) motivoWrap.style.display = "none";
  if (motivoOtroWrap) motivoOtroWrap.style.display = "none";
  if (motivoSelect) motivoSelect.value = "";
  if (motivoOtro) motivoOtro.value = "";

  if (estado === ESTADOS_PRODUCTO.ENTREGADO_TOTAL) {
    if (cantidadInput) {
      cantidadInput.value = String(planificado || 0);
      cantidadInput.disabled = true;
    }

    actualizarVistaCantidadProducto(card);

    if (ayuda) {
      ayuda.innerHTML = "Se registrará como <b>entregado total</b>. La cantidad entregada será igual a la ruteada.";
    }

    return;
  }

  if (estado === ESTADOS_PRODUCTO.ENTREGADO_PARCIAL) {
    if (cantidadInput) {
      cantidadInput.disabled = false;

      if (toNumber(cantidadInput.value) >= planificado && planificado > 0) {
        cantidadInput.value = String(Math.max(planificado - 1, 0));
      }
    }

    actualizarVistaCantidadProducto(card);

    if (ayuda) {
      ayuda.innerHTML = "Entrega parcial: ajuste la cantidad entregada real y seleccione motivo.";
    }

    if (motivoWrap) motivoWrap.style.display = "block";
    return;
  }

  if (estado === ESTADOS_PRODUCTO.RECHAZADO_TOTAL) {
    if (cantidadInput) {
      cantidadInput.value = "0";
      cantidadInput.disabled = true;
    }

    actualizarVistaCantidadProducto(card);

    if (ayuda) {
      ayuda.innerHTML = "Rechazo total: la cantidad entregada será 0. Seleccione motivo.";
    }

    if (motivoWrap) motivoWrap.style.display = "block";
    return;
  }

  if (estado === ESTADOS_PRODUCTO.NO_DESPACHADO) {
    if (cantidadInput) {
      cantidadInput.value = "0";
      cantidadInput.disabled = true;
    }

    actualizarVistaCantidadProducto(card);

    if (ayuda) {
      ayuda.innerHTML = "No despachado: la cantidad entregada será 0. Seleccione motivo.";
    }

    if (motivoWrap) motivoWrap.style.display = "block";
  }
}

export function ajustarCantidadProducto(productoFacturaId, delta) {
  const card = buscarCardProducto(productoFacturaId);

  if (!card) return;

  const estado = String(card.dataset.estadoSeleccionado || "").trim().toUpperCase();

  if (estado !== ESTADOS_PRODUCTO.ENTREGADO_PARCIAL) {
    toastEntrega("Solo puede modificar cantidad cuando el estado es Entrega parcial.", "error");
    return;
  }

  const input = card.querySelector(".producto-cantidad-input");
  const planificado = toNumber(card.dataset.planificado || 0);

  if (!input) return;

  const actual = toNumber(input.value || 0);
  let nuevo = actual + Number(delta || 0);

  if (nuevo < 0) nuevo = 0;
  if (planificado > 0 && nuevo > planificado) nuevo = planificado;

  input.value = String(nuevo);
  actualizarVistaCantidadProducto(card);
}

export function sincronizarCantidadProducto(productoFacturaId) {
  const card = buscarCardProducto(productoFacturaId);

  if (!card) return;

  const input = card.querySelector(".producto-cantidad-input");
  const planificado = toNumber(card.dataset.planificado || 0);

  if (!input) return;

  let value = normalizarCantidad(input.value);

  if (!value) {
    value = "0";
  }

  let numero = toNumber(value);

  if (numero < 0) numero = 0;
  if (planificado > 0 && numero > planificado) numero = planificado;

  input.value = String(numero);

  actualizarVistaCantidadProducto(card);
}

function actualizarVistaCantidadProducto(card) {
  const input = card.querySelector(".producto-cantidad-input");
  const entregadoPreview = card.querySelector(".producto-cantidad-preview");
  const diferenciaPreview = card.querySelector(".producto-diferencia-preview");

  const planificado = toNumber(card.dataset.planificado || 0);
  const entregado = toNumber(input?.value || 0);
  const diferencia = Math.max(planificado - entregado, 0);

  if (entregadoPreview) {
    entregadoPreview.textContent = formatoNum.format(entregado);
  }

  if (diferenciaPreview) {
    diferenciaPreview.textContent = formatoNum.format(diferencia);
  }
}

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

  if (estadoProducto === ESTADOS_PRODUCTO.ENTREGADO_TOTAL) {
    cantidadEntregada = "";
  }

  if (estadoProducto === ESTADOS_PRODUCTO.ENTREGADO_PARCIAL) {
    cantidadEntregada = normalizarCantidad(card.querySelector(".producto-cantidad-input")?.value || "");

    if (!cantidadEntregada) {
      toastEntrega("Ingrese una cantidad entregada válida.", "error");
      return;
    }

    const planificado = toNumber(card.dataset.planificado || 0);

    if (planificado > 0 && toNumber(cantidadEntregada) >= planificado) {
      toastEntrega("Para entrega parcial, la cantidad debe ser menor a la ruteada.", "error");
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

  if (typeof window.actualizarProductoConDatos !== "function") {
    toastEntrega("No está registrada la función actualizarProductoConDatos. Verifique productoActions.js.", "error");
    return;
  }

  await window.actualizarProductoConDatos({
    productoFacturaId,
    estadoProducto,
    cantidadEntregada,
    motivo
  });
}

export function limpiarGestionProducto(productoFacturaId) {
  const card = buscarCardProducto(productoFacturaId);

  if (!card) return;

  card.dataset.estadoSeleccionado = "";

  card.querySelectorAll(".product-status-btn").forEach(btn => {
    btn.classList.remove("selected", "active");
  });

  const form = card.querySelector(".producto-form");
  const ayuda = card.querySelector(".producto-ayuda");
  const cantidadInput = card.querySelector(".producto-cantidad-input");
  const motivoSelect = card.querySelector(".producto-motivo-select");
  const motivoOtro = card.querySelector(".producto-motivo-otro");

  if (form) form.style.display = "none";
  if (ayuda) ayuda.textContent = "Seleccione un tipo de entrega.";
  if (cantidadInput) {
    cantidadInput.disabled = false;
    cantidadInput.value = card.dataset.planificado || "0";
  }
  if (motivoSelect) motivoSelect.value = "";
  if (motivoOtro) motivoOtro.value = "";

  actualizarVistaCantidadProducto(card);
}

function renderBotonVolverFacturas() {
  return `
    <button class="gestion-back-btn" onclick="window.volverAFacturas()">
      ← Volver a facturas
    </button>
  `;
}

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

export function abrirPanel() {
  const panel = document.getElementById("sidePanel");

  if (panel) {
    panel.classList.add("active");
  }
}

export function cerrarPanel() {
  const panel = document.getElementById("sidePanel");

  if (panel) {
    panel.classList.remove("active");
  }

  state.facturaActiva = null;
}

export function setSideBody(html) {
  const sideBody = document.getElementById("sideBody");

  if (!sideBody) {
    console.warn("No existe #sideBody en index.html.");
    return;
  }

  sideBody.innerHTML = html;
  inicializarEventosProductoForm();
}

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

function rutaBloqueadaParaGestion() {
  const modo = String(state.modoConsulta || "OPERATIVO").trim().toUpperCase();

  return Boolean(
    state.soloLectura === true ||
    state.rutaCerrada === true ||
    modo === "HISTORICO_CERRADO"
  );
}

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

function renderAvisoModoRuta() {
  const modo = String(state.modoConsulta || "OPERATIVO").trim().toUpperCase();

  if (modo === "HISTORICO_PENDIENTE" && !rutaBloqueadaParaGestion()) {
    return `
      <div class="gestion-alert-info">
        ⚠️ Ruta histórica pendiente editable.
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

function buscarCardProducto(productoFacturaId) {
  const id = String(productoFacturaId || "");

  return Array.from(document.querySelectorAll(".producto-gestion-card"))
    .find(card => String(card.dataset.productoId || "") === id) || null;
}

function normalizarCantidad(value) {
  const raw = String(value || "")
    .trim()
    .replace(",", ".");

  if (!raw) return "";

  const numero = Number(raw);

  if (!Number.isFinite(numero) || numero < 0) {
    return "";
  }

  return String(numero);
}

function obtenerMotivoProducto(card) {
  const select = card.querySelector(".producto-motivo-select");
  const otro = card.querySelector(".producto-motivo-otro");

  const motivoBase = String(select?.value || "").trim();

  if (motivoBase === "Otro") {
    return String(otro?.value || "").trim();
  }

  return motivoBase;
}

function crearIdDom(prefix, value) {
  return `${prefix}-${String(value || "")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 80)}`;
}

function renderLoading(texto) {
  return `
    <div class="panel-loading">
      ${escapeHtml(texto || "Cargando...")}
    </div>
  `;
}

function renderPanelMensaje(texto, isError = false) {
  return `
    <div class="${isError ? "cierre-warning" : "panel-empty"}">
      ${escapeHtml(texto || "Sin datos.").replace(/\n/g, "<br>")}
    </div>
  `;
}

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
