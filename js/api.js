// LOGITRACK - api.js
// Servicio central de conexión con Apps Script.
// Todas las llamadas a Google Sheets pasan por este archivo.

import { SHEET_API } from "./config.js";

const DEFAULT_TIMEOUT_MS = 30000;

/**
 * Registra funciones globales para pruebas rápidas desde consola.
 * No es obligatorio, pero ayuda durante la migración modular.
 */
export function registrarApiService() {
  window.apiGet = apiGet;
  window.verificarConexionAPI = verificarConexionAPI;
}

/**
 * Ejecuta una llamada GET contra Apps Script.
 *
 * Ejemplo:
 * apiGet({
 *   mode: "loginRuta",
 *   ci: "1234567",
 *   chapa: "ABC123",
 *   fecha: "2026-06-22"
 * });
 */
export async function apiGet(params = {}, options = {}) {
  validarConfiguracionAPI();

  const url = construirUrlAPI(params);
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
      signal: controller.signal
    });

    clearTimeout(timer);

    if (!response.ok) {
      throw new Error(`Error HTTP ${response.status}: ${response.statusText}`);
    }

    const text = await response.text();

    if (!text) {
      throw new Error("La API respondió vacío.");
    }

    let data;

    try {
      data = JSON.parse(text);
    } catch (error) {
      console.error("Respuesta no JSON:", text);
      throw new Error("La API no devolvió JSON válido.");
    }

    return data;

  } catch (error) {
    clearTimeout(timer);

    if (error.name === "AbortError") {
      return {
        ok: false,
        mensaje: "Tiempo agotado al conectar con LOGITRACK."
      };
    }

    return {
      ok: false,
      mensaje: error.message || "Error de conexión con LOGITRACK."
    };
  }
}

/**
 * Verifica conexión básica con Apps Script.
 */
export async function verificarConexionAPI() {
  const data = await apiGet({
    mode: "status"
  });

  return {
    ok: data.ok === true,
    mensaje: data.mensaje || (data.ok ? "API conectada." : "API con error."),
    data
  };
}

/**
 * Construye la URL final con parámetros.
 */
export function construirUrlAPI(params = {}) {
  const cleanParams = limpiarParametros(params);

  // Evita cache agresivo en móvil/navegador.
  cleanParams._ts = Date.now();

  const query = new URLSearchParams(cleanParams).toString();

  return `${SHEET_API}?${query}`;
}

/**
 * Elimina parámetros vacíos que puedan romper Apps Script.
 */
export function limpiarParametros(params = {}) {
  const clean = {};

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return;

    if (typeof value === "string") {
      clean[key] = value.trim();
      return;
    }

    clean[key] = value;
  });

  return clean;
}

/**
 * Valida que la URL de Apps Script esté configurada.
 */
function validarConfiguracionAPI() {
  if (!SHEET_API || typeof SHEET_API !== "string") {
    throw new Error("SHEET_API no está configurado en config.js.");
  }

  if (!SHEET_API.startsWith("https://script.google.com/macros/s/")) {
    console.warn("La URL SHEET_API no parece ser una URL válida de Apps Script.");
  }
}
