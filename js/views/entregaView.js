// LOGITRACK - entregaView.js
// Vista de gestión de entrega:
// - Abrir parada / cliente
// - Cargar facturas de una parada
// - Cargar productos de una factura
// - Renderizar panel lateral de gestión
// - Mantener compatibilidad con onclick globales
//
// Versión 1.6 - Fase 1.2-A:
// - Muestra aviso visual cuando la ruta es histórica.
// - Deshabilita botones operativos si soloLectura=true.
// - Deshabilita botones operativos si rutaCerrada=true.
// - Deshabilita botones operativos si modoConsulta=HISTORICO_CERRADO.
// - Permite consultar facturas/productos aunque esté bloqueada.
// - Mantiene HISTORICO_PENDIENTE editable si soloLectura=false.

import { state } from "../state.js";
import {
  buscarParadaPorClaves,
  cargarFacturasParada,
  cargarProductosFactura,
  buscarFactura
} from "../services/routeService.js?v=1.6";

import {
  cleanEstado,
  escapeHtml,
  escapeAttr,
  formatoNum,
  formatoGs,
  toNumber
} from "../utils.js?v=1.6";

/**
 * Registra funciones globales para mantener compatibilidad
 * con los botones actuales del HTML:
 * onclick="window.abrirParada(...)"
 * onclick="window.verProductos(...)"
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

    <div class="section-title">Facturas de la parada</div>

    ${facturas.map(f => renderFacturaCard(f)).join("")}
  `;

  setSideBody(html);
}

/**
 * Tarjeta visual de una factura.
 */
function renderFacturaCard(f) {
  const estado = cleanEstado(f.EstadoFactura || "PENDIENTE");
  const bloqueado = rutaBloqueadaParaGestion();
  const disabledAttr = bloqueado ? "disabled" : "";
  const disabledTitle = bloqueado ? `title="${escapeAttr(mensajeRutaBloqueada())}"` : "";

  return `
    <div class="card">
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
        <button
          class="btn-success"
          ${disabledAttr}
          ${disabledTitle}
          onclick="window.confirmarFactura('${escapeAttr(f.FacturaID || "")}')"
        >
          Confirmar completa
        </button>

        <button class="btn-secondary" onclick="window.verProductos('${escapeAttr(f.FacturaID || "")}')">
          Gestionar productos
        </button>
      </div>

      <div class="btn-row">
        <button
          class="btn-danger"
          ${disabledAttr}
          ${disabledTitle}
          onclick="window.rechazarFactura('${escapeAttr(f.FacturaID || "")}')"
        >
          Rechazar total
        </button>

        <button
          class="btn-neutral"
          ${disabledAttr}
          ${disabledTitle}
          onclick="window.noDespachadoFactura('${escapeAttr(f.FacturaID || "")}')"
        >
          No despachada
        </button>
      </div>
    </div>
  `;
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
  const titulo = factura ? `Factura ${factura.NumFactura || ""}` : "Productos";

  const html = `
    ${renderAvisoModoRuta()}
    ${renderBotonVolverFacturas()}

    <div class="section-title">${escapeHtml(titulo)}</div>

    ${factura ? renderResumenFactura(factura) : ""}

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
 * Tarjeta visual de producto.
 */
function renderProductoCard(p) {
  const estado = cleanEstado(p.EstadoProducto || "PENDIENTE");
  const bloqueado = rutaBloqueadaParaGestion();
  const disabledAttr = bloqueado ? "disabled" : "";
  const disabledTitle = bloqueado ? `title="${escapeAttr(mensajeRutaBloqueada())}"` : "";

  return `
    <div class="card">
      <div class="card-header">
        <div>
          <div class="card-title">
            ${escapeHtml(p.ProductoMaestro || p.DescripcionProducto || "Producto")}
          </div>

          <div class="card-meta">
            Código: ${escapeHtml(p.CodProducto || "")}<br>
            Planificado: ${formatoNum.format(toNumber(p.CantidadPlanificada))} ${escapeHtml(p.UnidadMedida || "")}<br>
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

      <div class="btn-row-4">
        <button
          class="btn-success"
          ${disabledAttr}
          ${disabledTitle}
          onclick="window.actualizarProducto('${escapeAttr(p.ProductoFacturaID || "")}', 'ENTREGADO_TOTAL')"
        >
          Total
        </button>

        <button
          class="btn-warning"
          ${disabledAttr}
          ${disabledTitle}
          onclick="window.actualizarProducto('${escapeAttr(p.ProductoFacturaID || "")}', 'ENTREGADO_PARCIAL')"
        >
          Parcial
        </button>

        <button
          class="btn-danger"
          ${disabledAttr}
          ${disabledTitle}
          onclick="window.actualizarProducto('${escapeAttr(p.ProductoFacturaID || "")}', 'RECHAZADO_TOTAL')"
        >
          Rechazo
        </button>

        <button
          class="btn-neutral"
          ${disabledAttr}
          ${disabledTitle}
          onclick="window.actualizarProducto('${escapeAttr(p.ProductoFacturaID || "")}', 'NO_DESPACHADO')"
        >
          N/D
        </button>
      </div>
    </div>
  `;
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
