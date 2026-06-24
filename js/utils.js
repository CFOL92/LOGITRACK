// LOGITRACK - utils.js
// Utilidades generales reutilizables:
// - Formatos numéricos
// - Fechas Paraguay
// - Limpieza de estados
// - Conversión numérica
// - Seguridad básica para HTML
// - Toast global
// - LocalStorage seguro
// - Helpers generales

export const TIMEZONE_PY = "America/Asuncion";

export const formatoNum = new Intl.NumberFormat("es-PY", {
  maximumFractionDigits: 2
});

export const formatoGs = new Intl.NumberFormat("es-PY", {
  maximumFractionDigits: 0
});

export const formatoDecimal = new Intl.NumberFormat("es-PY", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

export const formatoFechaCorta = new Intl.DateTimeFormat("es-PY", {
  timeZone: TIMEZONE_PY,
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

/**
 * Registra utilidades globales para pruebas desde consola
 * y compatibilidad durante la migración modular.
 */
export function registrarUtils() {
  window.LOGITRACK_UTILS = {
    cleanEstado,
    toNumber,
    escapeHtml,
    escapeAttr,
    fechaHoyISO,
    fechaHoyPY,
    normalizarFechaISO,
    esFechaHoy,
    esFechaHistorica,
    esFechaFutura,
    mensajeSinRutaPorFecha,
    normalizarTexto,
    toastGlobal,
    storageGet,
    storageSet,
    storageRemove,
    googleMapsUrl,
    tieneCoordenadas
  };

  window.cleanEstado = cleanEstado;
  window.toNumber = toNumber;
  window.escapeHtml = escapeHtml;
  window.escapeAttr = escapeAttr;
  window.fechaHoyISO = fechaHoyISO;
  window.fechaHoyPY = fechaHoyPY;
  window.normalizarFechaISO = normalizarFechaISO;
  window.esFechaHoy = esFechaHoy;
  window.esFechaHistorica = esFechaHistorica;
  window.mensajeSinRutaPorFecha = mensajeSinRutaPorFecha;
  window.toastGlobal = toastGlobal;
}

/**
 * Devuelve fecha actual de Paraguay en formato YYYY-MM-DD.
 * Esto evita errores por zona horaria del navegador o UTC.
 */
export function fechaHoyISO() {
  return fechaISODesdeDate(new Date());
}

/**
 * Alias semántico de fechaHoyISO().
 */
export function fechaHoyPY() {
  return fechaHoyISO();
}

/**
 * Convierte un Date a YYYY-MM-DD usando zona horaria de Paraguay.
 */
export function fechaISODesdeDate(date) {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE_PY,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  const year = partes.find(p => p.type === "year")?.value || "";
  const month = partes.find(p => p.type === "month")?.value || "";
  const day = partes.find(p => p.type === "day")?.value || "";

  return `${year}-${month}-${day}`;
}

/**
 * Normaliza fechas recibidas desde inputs, Google Sheets o texto.
 *
 * Soporta:
 * - YYYY-MM-DD
 * - DD/MM/YYYY
 * - DD-MM-YYYY
 * - Date
 */
export function normalizarFechaISO(value) {
  if (!value) return "";

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return fechaISODesdeDate(value);
  }

  const txt = String(value).trim();

  if (!txt) return "";

  // Ya viene como YYYY-MM-DD
  const isoMatch = txt.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return txt;
  }

  // Viene como DD/MM/YYYY o DD-MM-YYYY
  const pyMatch = txt.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (pyMatch) {
    const day = pyMatch[1].padStart(2, "0");
    const month = pyMatch[2].padStart(2, "0");
    const year = pyMatch[3];

    return `${year}-${month}-${day}`;
  }

  // Último intento con Date nativo
  const parsed = new Date(txt);
  if (!Number.isNaN(parsed.getTime())) {
    return fechaISODesdeDate(parsed);
  }

  return txt;
}

/**
 * Devuelve fecha en formato DD/MM/YYYY para mostrar.
 */
export function fechaDisplayPY(value) {
  const iso = normalizarFechaISO(value);

  if (!iso) return "";

  const partes = iso.split("-");

  if (partes.length !== 3) return iso;

  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

/**
 * Compara dos fechas ISO YYYY-MM-DD.
 */
export function compararFechasISO(a, b) {
  const fa = normalizarFechaISO(a);
  const fb = normalizarFechaISO(b);

  if (!fa || !fb) return 0;

  if (fa < fb) return -1;
  if (fa > fb) return 1;

  return 0;
}

/**
 * Indica si la fecha consultada corresponde a hoy en Paraguay.
 */
export function esFechaHoy(value) {
  return normalizarFechaISO(value) === fechaHoyISO();
}

/**
 * Indica si la fecha consultada es anterior a hoy.
 */
export function esFechaHistorica(value) {
  const fecha = normalizarFechaISO(value);
  const hoy = fechaHoyISO();

  if (!fecha) return false;

  return fecha < hoy;
}

/**
 * Indica si la fecha consultada es futura.
 */
export function esFechaFutura(value) {
  const fecha = normalizarFechaISO(value);
  const hoy = fechaHoyISO();

  if (!fecha) return false;

  return fecha > hoy;
}

/**
 * Mensaje estándar cuando no se encuentra ruta.
 *
 * Regla:
 * - Si la fecha es hoy: no tiene ruta para hoy.
 * - Si la fecha es anterior: no hay histórico.
 * - Si la fecha es futura: no hay planificación para esa fecha.
 */
export function mensajeSinRutaPorFecha(fechaConsulta) {
  const fecha = normalizarFechaISO(fechaConsulta);

  if (esFechaHoy(fecha)) {
    return "NO TIENE RUTA ASIGNADA PARA HOY";
  }

  if (esFechaHistorica(fecha)) {
    return "NO SE ENCUENTRA REGISTRO HISTORICO DE LA FECHA";
  }

  if (esFechaFutura(fecha)) {
    return "NO EXISTE PLANIFICACION PARA LA FECHA SELECCIONADA";
  }

  return "NO SE ENCUENTRA RUTA PARA LA FECHA SELECCIONADA";
}

/**
 * Devuelve fecha y hora local de Paraguay en formato legible.
 */
export function fechaHoraLocal() {
  const d = new Date();

  const fecha = formatoFechaCorta.format(d);
  const hora = d.toLocaleTimeString("es-PY", {
    timeZone: TIMEZONE_PY,
    hour: "2-digit",
    minute: "2-digit"
  });

  return `${fecha} ${hora}`;
}

/**
 * Devuelve timestamp ISO.
 */
export function nowISO() {
  return new Date().toISOString();
}

/**
 * Convierte valores a número.
 * Soporta:
 * - 1.234,56
 * - 1234,56
 * - 1234.56
 * - Gs. 1.234
 * - textos vacíos
 */
export function toNumber(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  let txt = String(value ?? "").trim();

  if (!txt) return 0;

  txt = txt.replace(/\s/g, "");

  const tieneComa = txt.includes(",");
  const tienePunto = txt.includes(".");

  if (tieneComa && tienePunto) {
    txt = txt.replace(/\./g, "").replace(",", ".");
  } else if (tieneComa && !tienePunto) {
    txt = txt.replace(",", ".");
  }

  txt = txt.replace(/[^0-9.-]/g, "");

  const n = parseFloat(txt);

  return Number.isFinite(n) ? n : 0;
}

/**
 * Redondea un número a cierta cantidad de decimales.
 */
export function roundNumber(value, decimals = 2) {
  const n = toNumber(value);
  const factor = Math.pow(10, decimals);

  return Math.round(n * factor) / factor;
}

/**
 * Normaliza estados para comparación y clases CSS.
 */
export function cleanEstado(value) {
  return String(value || "PENDIENTE")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");
}

/**
 * Normaliza texto para búsqueda.
 */
export function normalizarTexto(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normaliza chapa.
 */
export function normalizarChapa(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

/**
 * Normaliza CI.
 */
export function normalizarCI(value) {
  return String(value || "")
    .trim()
    .replace(/\D/g, "");
}

/**
 * Escapa texto para insertar dentro de HTML.
 */
export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Escapa texto para insertar dentro de atributos HTML.
 */
export function escapeAttr(value) {
  return escapeHtml(value)
    .replace(/`/g, "&#096;")
    .replace(/\n/g, " ")
    .replace(/\r/g, " ");
}

/**
 * Convierte salto de línea en <br>.
 */
export function nl2br(value) {
  return escapeHtml(value).replace(/\n/g, "<br>");
}

/**
 * Formatea número con formato decimal operativo.
 */
export function formatNumero(value) {
  return formatoNum.format(toNumber(value));
}

/**
 * Formatea importe en guaraníes.
 */
export function formatGs(value) {
  return formatoGs.format(toNumber(value));
}

/**
 * Formatea kg.
 */
export function formatKg(value) {
  return `${formatoNum.format(toNumber(value))} kg`;
}

/**
 * Formatea pallets.
 */
export function formatPallets(value) {
  return formatoNum.format(toNumber(value));
}

/**
 * Formatea volumen.
 */
export function formatVolumen(value) {
  return `${formatoNum.format(toNumber(value))} m³`;
}

/**
 * Valida si un valor tiene contenido real.
 */
export function hasValue(value) {
  return String(value ?? "").trim() !== "";
}

/**
 * Devuelve texto seguro o fallback.
 */
export function valueOr(value, fallback = "-") {
  const txt = String(value ?? "").trim();
  return txt || fallback;
}

/**
 * Pausa simple para flujos async.
 */
export function sleep(ms = 300) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Limita ejecución repetida de una función.
 */
export function debounce(fn, delay = 300) {
  let timer = null;

  return function debounced(...args) {
    clearTimeout(timer);

    timer = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
}

/**
 * Une clases CSS condicionales.
 */
export function classNames(...items) {
  return items
    .flat()
    .filter(Boolean)
    .join(" ");
}

/**
 * Devuelve color lógico por estado.
 */
export function colorPorEstado(estado) {
  const e = cleanEstado(estado);

  if (e === "ENTREGADO" || e === "ENTREGADO_TOTAL") {
    return "#22c55e";
  }

  if (e === "PARCIAL" || e === "ENTREGADO_PARCIAL") {
    return "#f59e0b";
  }

  if (e === "RECHAZADO" || e === "RECHAZADO_TOTAL") {
    return "#ef4444";
  }

  if (e === "NO_DESPACHADO") {
    return "#64748b";
  }

  return "#0284c7";
}

/**
 * Devuelve clase CSS para badge.
 */
export function claseBadgeEstado(estado) {
  return cleanEstado(estado || "PENDIENTE");
}

/**
 * Devuelve descripción corta del estado.
 */
export function labelEstado(estado) {
  const e = cleanEstado(estado);

  const labels = {
    PENDIENTE: "Pendiente",
    ENTREGADO: "Entregado",
    ENTREGADO_TOTAL: "Entregado total",
    PARCIAL: "Parcial",
    ENTREGADO_PARCIAL: "Entregado parcial",
    RECHAZADO: "Rechazado",
    RECHAZADO_TOTAL: "Rechazado total",
    NO_DESPACHADO: "No despachado"
  };

  return labels[e] || e;
}

/**
 * Toast global reutilizable.
 */
export function toastGlobal(msg, type) {
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

/**
 * Alias de toast global.
 */
export function toast(msg, type) {
  toastGlobal(msg, type);
}

/**
 * Limpia un texto para usarlo como clave simple.
 */
export function makeKey(...parts) {
  return parts
    .map(p => String(p ?? "").trim())
    .filter(Boolean)
    .join("|");
}

/**
 * Abre Google Maps con destino.
 */
export function googleMapsUrl(lat, lon) {
  const latLimpio = String(lat ?? "").trim();
  const lonLimpio = String(lon ?? "").trim();

  if (!latLimpio || !lonLimpio) {
    return "#";
  }

  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(latLimpio)},${encodeURIComponent(lonLimpio)}`;
}

/**
 * Valida coordenadas básicas.
 */
export function tieneCoordenadas(lat, lon) {
  const latNum = toNumber(lat);
  const lonNum = toNumber(lon);

  if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) return false;
  if (latNum === 0 || lonNum === 0) return false;
  if (latNum < -90 || latNum > 90) return false;
  if (lonNum < -180 || lonNum > 180) return false;

  return true;
}

/**
 * Convierte objeto a texto de query params.
 */
export function toQueryString(params = {}) {
  const clean = {};

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    clean[key] = String(value);
  });

  return new URLSearchParams(clean).toString();
}

/**
 * LocalStorage seguro: guardar valor JSON.
 */
export function storageSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn("No se pudo guardar en localStorage:", error);
    return false;
  }
}

/**
 * LocalStorage seguro: leer valor JSON.
 */
export function storageGet(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);

    if (!raw) return fallback;

    return JSON.parse(raw);
  } catch (error) {
    console.warn("No se pudo leer localStorage:", error);
    return fallback;
  }
}

/**
 * LocalStorage seguro: eliminar valor.
 */
export function storageRemove(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.warn("No se pudo eliminar localStorage:", error);
    return false;
  }
}

/**
 * LocalStorage seguro: verificar existencia.
 */
export function storageHas(key) {
  try {
    return localStorage.getItem(key) !== null;
  } catch (error) {
    console.warn("No se pudo verificar localStorage:", error);
    return false;
  }
}

/**
 * Limpia espacios internos dobles.
 */
export function compactText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Corta texto largo sin romper la app.
 */
export function truncateText(value, max = 60) {
  const txt = compactText(value);

  if (txt.length <= max) return txt;

  return txt.slice(0, max - 3) + "...";
}

/**
 * Convierte valor a string seguro.
 */
export function asString(value) {
  return String(value ?? "").trim();
}

/**
 * Devuelve true si el dispositivo parece móvil.
 */
export function esMovil() {
  return window.matchMedia("(max-width: 768px)").matches;
}

/**
 * Copia texto al portapapeles si el navegador lo permite.
 */
export async function copiarTexto(texto) {
  try {
    if (!navigator.clipboard) return false;

    await navigator.clipboard.writeText(String(texto ?? ""));
    return true;
  } catch (error) {
    console.warn("No se pudo copiar texto:", error);
    return false;
  }
}
