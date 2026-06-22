// LOGITRACK - utils.js
// Utilidades generales reutilizables:
// - Formatos numéricos
// - Fechas
// - Limpieza de estados
// - Conversión numérica
// - Seguridad básica para HTML
// - Toast global
// - LocalStorage seguro
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

export const formatoFechaCorta = new Intl.DateTimeFormat("es-PY", {
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
 * Devuelve fecha y hora local en formato legible.
 */
export function fechaHoraLocal() {
  const d = new Date();

  const fecha = formatoFechaCorta.format(d);
  const hora = d.toLocaleTimeString("es-PY", {
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
