// LOGITRACK - gpsService.js
// Servicio de GPS:
// - Obtener ubicación actual
// - Mostrar ubicación del chofer en el mapa
// - Preparado para tracking futuro

let gpsMap = null;
let gpsMarker = null;
let gpsAccuracyCircle = null;
let watchId = null;

/**
 * Registra funciones globales para mantener compatibilidad
 * con botones HTML tipo onclick="window.activarGPS()".
 */
export function registrarGpsService() {
  window.activarGPS = activarGPS;
  window.obtenerGPS = obtenerGPS;
  window.iniciarSeguimientoGPS = iniciarSeguimientoGPS;
  window.detenerSeguimientoGPS = detenerSeguimientoGPS;
}

/**
 * Recibe el mapa Leaflet desde mapService.js o main.js.
 */
export function setGpsMap(mapInstance) {
  gpsMap = mapInstance;
}

/**
 * Obtiene una sola ubicación GPS.
 * Devuelve siempre un objeto, aunque falle.
 */
export function obtenerGPS(options = {}) {
  const config = {
    enableHighAccuracy: true,
    timeout: options.timeout || 12000,
    maximumAge: options.maximumAge || 10000
  };

  return new Promise(resolve => {
    if (!navigator.geolocation) {
      resolve({
        lat: "",
        lng: "",
        precision: "",
        ok: false,
        mensaje: "GPS no disponible en este dispositivo."
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      position => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          precision: position.coords.accuracy || "",
          ok: true,
          mensaje: "Ubicación obtenida."
        });
      },
      error => {
        resolve({
          lat: "",
          lng: "",
          precision: "",
          ok: false,
          mensaje: normalizarErrorGPS(error)
        });
      },
      config
    );
  });
}

/**
 * Activa el GPS y centra el mapa en la ubicación actual.
 */
export async function activarGPS() {
  if (!navigator.geolocation) {
    toastGPS("GPS no disponible en este dispositivo.", "error");
    return;
  }

  try {
    toastGPS("Buscando ubicación...");

    const gps = await obtenerGPS({
      timeout: 15000,
      maximumAge: 5000
    });

    if (!gps.ok) {
      toastGPS(gps.mensaje || "No se pudo obtener ubicación.", "error");
      return;
    }

    pintarUbicacionEnMapa(gps.lat, gps.lng, gps.precision);

    toastGPS("Ubicación detectada.", "ok");

  } catch (error) {
    toastGPS("Error al activar GPS:\n" + error.message, "error");
  }
}

/**
 * Inicia seguimiento continuo del GPS.
 * Esto queda preparado para una fase posterior de tracking en tiempo real.
 */
export function iniciarSeguimientoGPS(callback) {
  if (!navigator.geolocation) {
    toastGPS("GPS no disponible en este dispositivo.", "error");
    return null;
  }

  detenerSeguimientoGPS();

  watchId = navigator.geolocation.watchPosition(
    position => {
      const gps = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        precision: position.coords.accuracy || "",
        ok: true,
        timestamp: new Date().toISOString()
      };

      pintarUbicacionEnMapa(gps.lat, gps.lng, gps.precision, false);

      if (typeof callback === "function") {
        callback(gps);
      }
    },
    error => {
      toastGPS(normalizarErrorGPS(error), "error");
    },
    {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 5000
    }
  );

  return watchId;
}

/**
 * Detiene el seguimiento continuo del GPS.
 */
export function detenerSeguimientoGPS() {
  if (watchId !== null && navigator.geolocation) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
}

/**
 * Dibuja o actualiza la ubicación del chofer en el mapa.
 */
function pintarUbicacionEnMapa(lat, lng, precision, centrar = true) {
  if (!gpsMap) {
    console.warn("gpsService: no hay mapa configurado. Usa setGpsMap(map).");
    return;
  }

  if (!window.L) {
    console.warn("gpsService: Leaflet no está disponible en window.L.");
    return;
  }

  const punto = [lat, lng];

  if (gpsMarker) {
    gpsMarker.setLatLng(punto);
  } else {
    gpsMarker = window.L.circleMarker(punto, {
      radius: 8,
      color: "#0ea5e9",
      fillColor: "#38bdf8",
      fillOpacity: 0.9,
      weight: 3
    }).addTo(gpsMap);

    gpsMarker.bindPopup("📍 Mi ubicación");
  }

  if (precision) {
    if (gpsAccuracyCircle) {
      gpsAccuracyCircle.setLatLng(punto);
      gpsAccuracyCircle.setRadius(Number(precision) || 0);
    } else {
      gpsAccuracyCircle = window.L.circle(punto, {
        radius: Number(precision) || 0,
        color: "#0ea5e9",
        fillColor: "#bae6fd",
        fillOpacity: 0.18,
        weight: 1
      }).addTo(gpsMap);
    }
  }

  if (centrar) {
    gpsMap.setView(punto, 16);
  }
}

/**
 * Limpia los marcadores GPS del mapa.
 */
export function limpiarGPS() {
  detenerSeguimientoGPS();

  if (gpsMap && gpsMarker) {
    gpsMap.removeLayer(gpsMarker);
  }

  if (gpsMap && gpsAccuracyCircle) {
    gpsMap.removeLayer(gpsAccuracyCircle);
  }

  gpsMarker = null;
  gpsAccuracyCircle = null;
}

/**
 * Traduce errores técnicos del navegador a mensajes simples.
 */
function normalizarErrorGPS(error) {
  if (!error) {
    return "No se pudo obtener ubicación.";
  }

  if (error.code === 1) {
    return "Permiso de ubicación denegado. Activa el GPS y permite ubicación en el navegador.";
  }

  if (error.code === 2) {
    return "Ubicación no disponible. Verifica señal GPS o conexión.";
  }

  if (error.code === 3) {
    return "Tiempo agotado al obtener ubicación. Intenta nuevamente.";
  }

  return error.message || "No se pudo obtener ubicación.";
}

/**
 * Toast local del servicio GPS.
 * Más adelante se puede mover a utils.js.
 */
function toastGPS(msg, type) {
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
