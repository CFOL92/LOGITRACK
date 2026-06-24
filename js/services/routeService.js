// LOGITRACK - routeService.js
// Servicio de datos de ruta:
// - Cargar ruta desde Apps Script
// - Guardar datos en state
// - Calcular avance de ruta
// - Filtrar, buscar y ordenar paradas
// - Cargar facturas y productos relacionados
//
// Versión 1.6 - Fase 1.2-A:
// - Respeta respuesta histórica de Apps Script.
// - Guarda modoConsulta, soloLectura, codigoRuta y fuenteDatos.
// - Agrega rutaCerrada al state.
// - Prepara bloqueo de acciones para rutas históricas cerradas.
// - Mantiene ruta histórica pendiente como operativa si soloLectura=false.

import { state } from "../state.js";
import { apiGet } from "../api.js?v=1.6";
import {
  cleanEstado,
  toNumber,
  normalizarFechaISO
} from "../utils.js?v=1.6";

/**
 * Registra funciones globales útiles mientras seguimos migrando módulos.
 */
export function registrarRouteService() {
  window.calcularEstadoRuta = calcularEstadoRuta;
  window.buscarParadaPorClaves = buscarParadaPorClaves;
  window.obtenerParadasFiltradas = obtenerParadasFiltradas;
  window.cargarRutaDesdeAPI = cargarRutaDesdeAPI;
  window.aplicarDatosRuta = aplicarDatosRuta;
  window.detectarRutaCerrada = detectarRutaCerrada;
}

/**
 * Carga la ruta del chofer desde Apps Script.
 */
export async function cargarRutaDesdeAPI({ ci, chapa, fecha }) {
  const ciLimpio = String(ci || "").trim().replace(/\D/g, "");
  const chapaLimpia = String(chapa || "").trim().toUpperCase().replace(/\s+/g, "");
  const fechaLimpia = normalizarFechaISO
    ? normalizarFechaISO(fecha || "")
    : String(fecha || "").trim();

  if (!ciLimpio || !chapaLimpia || !fechaLimpia) {
    return {
      ok: false,
      mensaje: "Debe ingresar CI, chapa y fecha."
    };
  }

  const data = await apiGet({
    mode: "loginRuta",
    ci: ciLimpio,
    chapa: chapaLimpia,
    fecha: fechaLimpia
  });

  console.log("LOGITRACK loginRuta respuesta:", data);

  if (!data.ok) {
    return {
      ok: false,
      mensaje: data.mensaje || "No se pudo cargar la ruta.",
      codigo: data.codigo || "",
      raw: data
    };
  }

  aplicarDatosRuta({
    ci: ciLimpio,
    chapa: chapaLimpia,
    fecha: data.fechaRuta || fechaLimpia,
    data
  });

  return {
    ok: true,
    mensaje: data.mensaje || "Ruta cargada correctamente.",
    codigo: data.codigo || "RUTA_ENCONTRADA",
    modoConsulta: state.modoConsulta || data.modoConsulta || "OPERATIVO",
    soloLectura: Boolean(state.soloLectura),
    rutaCerrada: Boolean(state.rutaCerrada),
    fuenteDatos: state.fuenteDatos || data.fuenteDatos || "",
    fechaRuta: state.fecha || data.fechaRuta || fechaLimpia,
    chofer: state.chofer,
    movil: state.movil,
    resumen: state.resumen,
    paradas: state.paradas,
    raw: data
  };
}

/**
 * Aplica la respuesta de loginRuta al estado global.
 */
export function aplicarDatosRuta({ ci, chapa, fecha, data }) {
  const paradas = Array.isArray(data.data) ? data.data : [];
  const rutaCerradaDetectada = detectarRutaCerrada(paradas);

  state.ci = ci || "";
  state.chapa = chapa || "";
  state.fecha = data.fechaRuta || fecha || "";

  state.chofer = data.chofer || null;
  state.movil = data.movil || null;
  state.resumen = data.resumen || {};
  state.paradas = paradas;

  /*
    Campos nuevos del backend:
    - OPERATIVO
    - HISTORICO_PENDIENTE
    - HISTORICO_CERRADO
  */
  state.modoConsulta = data.modoConsulta || "OPERATIVO";
  state.soloLectura = Boolean(data.soloLectura);
  state.codigoRuta = data.codigo || "";
  state.fuenteDatos = data.fuenteDatos || "";
  state.rutaCerrada = Boolean(data.soloLectura || rutaCerradaDetectada);

  state.paradasMap = construirParadasMap(state.paradas);

  // Al refrescar la ruta se limpian caches para evitar datos viejos.
  state.facturasCache = {};
  state.productosCache = {};

  // Se conserva la vista activa, pero se limpia selección si ya no existe.
  if (state.paradaActiva) {
    const parada = buscarParadaPorClaves({
      paradaId: state.paradaActiva.ParadaID || "",
      codBoca: state.paradaActiva.CodBoca || "",
      rutaId: state.paradaActiva.RutaID || ""
    });

    state.paradaActiva = parada || null;
  }

  console.log("LOGITRACK state ruta:", {
    fecha: state.fecha,
    modoConsulta: state.modoConsulta,
    soloLectura: state.soloLectura,
    rutaCerrada: state.rutaCerrada,
    codigoRuta: state.codigoRuta,
    fuenteDatos: state.fuenteDatos,
    paradas: state.paradas.length
  });
}

/**
 * Detecta si la ruta está cerrada según los datos de paradas.
 */
export function detectarRutaCerrada(paradas = []) {
  if (!Array.isArray(paradas) || paradas.length === 0) {
    return false;
  }

  const conCampoCierre = paradas.filter(p => {
    const valor = String(p.RutaCerrada ?? p.rutaCerrada ?? "").trim();
    return valor !== "";
  });

  if (conCampoCierre.length === 0) {
    return false;
  }

  return conCampoCierre.every(p => {
    const valor = cleanEstado(p.RutaCerrada ?? p.rutaCerrada ?? "");
    return valor === "SI" || valor === "CERRADA" || valor === "CERRADO";
  });
}

/**
 * Construye índice rápido de paradas.
 */
export function construirParadasMap(paradas) {
  const map = {};

  (paradas || []).forEach(p => {
    const paradaId = String(p.ParadaID || "").trim();
    const rutaId = String(p.RutaID || "").trim();
    const codBoca = String(p.CodBoca || "").trim();

    if (paradaId) {
      map[paradaId] = p;
    }

    if (rutaId || codBoca) {
      map[`${rutaId}|${codBoca}`] = p;
    }
  });

  return map;
}

/**
 * Busca una parada por ParadaID o por RutaID + CodBoca.
 */
export function buscarParadaPorClaves({ paradaId = "", codBoca = "", rutaId = "" }) {
  const pId = String(paradaId || "").trim();
  const cBoca = String(codBoca || "").trim();
  const rId = String(rutaId || "").trim();

  if (pId && state.paradasMap[pId]) {
    return state.paradasMap[pId];
  }

  const claveCompuesta = `${rId}|${cBoca}`;

  if ((rId || cBoca) && state.paradasMap[claveCompuesta]) {
    return state.paradasMap[claveCompuesta];
  }

  return (state.paradas || []).find(p =>
    String(p.ParadaID || "") === pId ||
    (
      String(p.CodBoca || "") === cBoca &&
      String(p.RutaID || "") === rId
    )
  ) || null;
}

/**
 * Calcula estado general de la ruta.
 */
export function calcularEstadoRuta() {
  const paradas = state.paradas || [];
  const totalPuntos = paradas.length;

  const pendientes = paradas.filter(p => esParadaPendiente(p)).length;

  const entregados = paradas.filter(p => {
    const estado = cleanEstado(p.EstadoParada || "");
    return estado === "ENTREGADO" || estado === "ENTREGADO_TOTAL";
  }).length;

  const parciales = paradas.filter(p => {
    const estado = cleanEstado(p.EstadoParada || "");
    return estado === "PARCIAL" || estado === "ENTREGADO_PARCIAL";
  }).length;

  const rechazados = paradas.filter(p => {
    const estado = cleanEstado(p.EstadoParada || "");
    return estado === "RECHAZADO" ||
           estado === "RECHAZADO_TOTAL" ||
           estado === "NO_DESPACHADO";
  }).length;

  const gestionados = Math.max(totalPuntos - pendientes, 0);
  const avance = totalPuntos > 0 ? Math.round((gestionados / totalPuntos) * 100) : 0;

  return {
    totalPuntos,
    pendientes,
    entregados,
    parciales,
    rechazados,
    gestionados,
    avance,
    modoConsulta: state.modoConsulta || "OPERATIVO",
    soloLectura: Boolean(state.soloLectura),
    rutaCerrada: Boolean(state.rutaCerrada),
    codigoRuta: state.codigoRuta || "",
    fuenteDatos: state.fuenteDatos || ""
  };
}

/**
 * Determina si una parada sigue pendiente.
 */
export function esParadaPendiente(parada) {
  const estado = cleanEstado(parada.EstadoParada || "PENDIENTE");
  const tienePendientes = cleanEstado(parada.TienePendientes || "");

  return estado === "PENDIENTE" || tienePendientes === "SI";
}

/**
 * Devuelve paradas filtradas, buscadas y ordenadas.
 *
 * Filtros admitidos:
 * - TODOS
 * - PENDIENTE
 * - ENTREGADO
 * - PARCIAL
 * - RECHAZADO
 *
 * Orden admitido:
 * - PLANIFICADO
 * - ESTADO
 * - MAYOR_PESO
 * - MAYOR_FACTURAS
 * - CLIENTE
 */
export function obtenerParadasFiltradas({
  filtro = "TODOS",
  busqueda = "",
  orden = "PLANIFICADO"
} = {}) {
  let lista = [...(state.paradas || [])];

  const filtroNormalizado = cleanEstado(filtro || "TODOS");
  const textoBusqueda = normalizarBusqueda(busqueda);

  if (filtroNormalizado !== "TODOS") {
    lista = lista.filter(p => coincideFiltroParada(p, filtroNormalizado));
  }

  if (textoBusqueda) {
    lista = lista.filter(p => coincideBusquedaParada(p, textoBusqueda));
  }

  lista = ordenarParadas(lista, orden);

  return lista;
}

/**
 * Evalúa si una parada coincide con el filtro seleccionado.
 */
export function coincideFiltroParada(parada, filtro) {
  const estado = cleanEstado(parada.EstadoParada || "PENDIENTE");

  if (filtro === "PENDIENTE") {
    return esParadaPendiente(parada);
  }

  if (filtro === "ENTREGADO") {
    return estado === "ENTREGADO" || estado === "ENTREGADO_TOTAL";
  }

  if (filtro === "PARCIAL") {
    return estado === "PARCIAL" || estado === "ENTREGADO_PARCIAL";
  }

  if (filtro === "RECHAZADO") {
    return estado === "RECHAZADO" ||
           estado === "RECHAZADO_TOTAL" ||
           estado === "NO_DESPACHADO";
  }

  return true;
}

/**
 * Evalúa búsqueda por cliente, boca, código, ciudad, zona o dirección.
 */
export function coincideBusquedaParada(parada, textoBusqueda) {
  const texto = [
    parada.Cliente,
    parada.Boca,
    parada.CodBoca,
    parada.Ciudad,
    parada.Zona,
    parada.Direccion,
    parada.RutaID,
    parada.ParadaID
  ].map(v => normalizarBusqueda(v)).join(" ");

  return texto.includes(textoBusqueda);
}

/**
 * Ordena paradas según criterio.
 */
export function ordenarParadas(lista, orden = "PLANIFICADO") {
  const criterio = cleanEstado(orden || "PLANIFICADO");

  const copia = [...lista];

  if (criterio === "CLIENTE") {
    return copia.sort((a, b) =>
      String(a.Cliente || a.Boca || "").localeCompare(String(b.Cliente || b.Boca || ""), "es")
    );
  }

  if (criterio === "ESTADO") {
    return copia.sort((a, b) => {
      const pesoA = pesoEstadoParada(a);
      const pesoB = pesoEstadoParada(b);

      if (pesoA !== pesoB) return pesoA - pesoB;

      return toNumber(a.OrdenPlanificado) - toNumber(b.OrdenPlanificado);
    });
  }

  if (criterio === "MAYOR_PESO") {
    return copia.sort((a, b) =>
      toNumber(b.TotalPesoKg) - toNumber(a.TotalPesoKg)
    );
  }

  if (criterio === "MAYOR_FACTURAS") {
    return copia.sort((a, b) =>
      toNumber(b.CantidadFacturas) - toNumber(a.CantidadFacturas)
    );
  }

  return copia.sort((a, b) =>
    toNumber(a.OrdenPlanificado) - toNumber(b.OrdenPlanificado)
  );
}

/**
 * Peso lógico del estado para ordenar.
 */
function pesoEstadoParada(parada) {
  const estado = cleanEstado(parada.EstadoParada || "PENDIENTE");

  if (esParadaPendiente(parada)) return 1;
  if (estado === "PARCIAL" || estado === "ENTREGADO_PARCIAL") return 2;
  if (estado === "RECHAZADO" || estado === "RECHAZADO_TOTAL" || estado === "NO_DESPACHADO") return 3;
  if (estado === "ENTREGADO" || estado === "ENTREGADO_TOTAL") return 4;

  return 9;
}

/**
 * Carga facturas de una parada.
 */
export async function cargarFacturasParada(parada) {
  if (!parada) {
    return {
      ok: false,
      mensaje: "Parada inválida.",
      data: []
    };
  }

  const paradaId = parada.ParadaID || "";
  const cacheKey = String(paradaId || `${parada.RutaID || ""}|${parada.CodBoca || ""}`);

  if (cacheKey && state.facturasCache[cacheKey]) {
    return {
      ok: true,
      data: state.facturasCache[cacheKey],
      desdeCache: true
    };
  }

  const data = await apiGet({
    mode: "getFacturasParada",
    paradaId: parada.ParadaID || "",
    rutaId: parada.RutaID || "",
    codBoca: parada.CodBoca || "",
    fecha: state.fecha
  });

  if (!data.ok) {
    return {
      ok: false,
      mensaje: data.mensaje || "No se pudieron cargar las facturas.",
      data: []
    };
  }

  const facturas = data.data || [];

  if (cacheKey) {
    state.facturasCache[cacheKey] = facturas;
  }

  if (paradaId) {
    state.facturasCache[String(paradaId)] = facturas;
  }

  return {
    ok: true,
    data: facturas,
    desdeCache: false
  };
}

/**
 * Carga productos de una factura.
 */
export async function cargarProductosFactura(facturaId) {
  const id = String(facturaId || "").trim();

  if (!id) {
    return {
      ok: false,
      mensaje: "Factura inválida.",
      data: []
    };
  }

  if (state.productosCache[id]) {
    return {
      ok: true,
      data: state.productosCache[id],
      desdeCache: true
    };
  }

  const data = await apiGet({
    mode: "getProductosFactura",
    facturaId: id
  });

  if (!data.ok) {
    return {
      ok: false,
      mensaje: data.mensaje || "No se pudieron cargar los productos.",
      data: []
    };
  }

  const productos = data.data || [];
  state.productosCache[id] = productos;

  return {
    ok: true,
    data: productos,
    desdeCache: false
  };
}

/**
 * Busca una factura dentro del cache actual.
 */
export function buscarFactura(facturaId) {
  const id = String(facturaId || "").trim();

  if (!id) return null;

  const listas = Object.values(state.facturasCache || {});

  for (const lista of listas) {
    const factura = (lista || []).find(f => String(f.FacturaID || "") === id);
    if (factura) return factura;
  }

  return null;
}

/**
 * Limpia caches de facturas y productos.
 */
export function limpiarCachesRuta() {
  state.facturasCache = {};
  state.productosCache = {};
}

/**
 * Normaliza texto para búsqueda simple.
 */
function normalizarBusqueda(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}
