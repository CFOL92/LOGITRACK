// LOGITRACK - utils.js
// Utilidades generales reutilizables:
// - Formatos numéricos
// - Fechas
// - Limpieza de estados
// - Conversión numérica
// - Seguridad básica para HTML
// - Toast global
// - Helpers generales

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

/**
 * Registra utilidades globales para pruebas desde consola
 * y compatibilidad durante la migración modular.
 */
export function registrarUtils() {
  window.cleanEstado = cleanEstado;
  window.toNumber = toNumber;
  window.escapeHtml = escapeHtml;
  window.escapeAttr = escapeAttr;
  window.fechaHoyISO = fechaHoyISO;
  window.toastGlobal = toastGlobal;
}

/**
 * Devuelve fecha actual local en formato YYYY-MM-DD.
 */
export function fechaHoyISO() {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);

  return local.toISOString().slice(0, 10);
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
    .trim();
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
  return Boolean(toNumber(lat) && toNumber(lon));
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
