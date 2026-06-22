# LOGITRACK

**LOGITRACK** es una aplicación web móvil para control de rutas de entrega por chofer.
La aplicación trabaja con **Google Sheets + Apps Script** como backend/API y se publica mediante **GitHub Pages** como frontend.

---

## Objetivo del sistema

LOGITRACK permite que cada chofer consulte su ruta diaria ingresando:

* Cédula de identidad
* Chapa del móvil
* Fecha de ruta

Luego puede visualizar:

* Resumen de la jornada
* Lista de paradas/clientes
* Mapa de entregas
* Facturas por parada
* Productos por factura
* Gestión de entregas completas, parciales, rechazos y no despachados
* Cierre de ruta

---

## Estructura del repositorio

```text
LOGITRACK/
│
├── index.html
│
├── README.md
│
├── css/
│   ├── base.css
│   ├── login.css
│   ├── app-shell.css
│   ├── ruta.css
│   ├── mapa.css
│   ├── panel.css
│   └── responsive.css
│
└── js/
    ├── config.js
    ├── state.js
    ├── api.js
    ├── utils.js
    ├── main.js
    │
    ├── services/
    │   ├── mapService.js
    │   ├── gpsService.js
    │   └── routeService.js
    │
    ├── views/
    │   ├── loginView.js
    │   ├── inicioView.js
    │   ├── rutaView.js
    │   ├── mapaView.js
    │   ├── cierreView.js
    │   └── entregaView.js
    │
    └── actions/
        ├── facturaActions.js
        ├── productoActions.js
        └── rutaActions.js
```

---

## Descripción de carpetas

### `index.html`

Archivo principal de la aplicación.
Contiene solamente la estructura HTML base, los enlaces CSS, Leaflet y el llamado al módulo principal:

```html
<script type="module" src="./js/main.js?v=1.2"></script>
```

---

### `css/`

Contiene todos los estilos separados por responsabilidad.

| Archivo          | Función                                                         |
| ---------------- | --------------------------------------------------------------- |
| `base.css`       | Variables globales, botones, badges, toast y estilos base       |
| `login.css`      | Pantalla de acceso del chofer                                   |
| `app-shell.css`  | Layout principal, header, vistas internas y navegación inferior |
| `ruta.css`       | Vista de ruta, filtros, buscador, tarjetas de parada y cierre   |
| `mapa.css`       | Leaflet, marcadores, popup y etiquetas del mapa                 |
| `panel.css`      | Panel superior del mapa y panel lateral de gestión              |
| `responsive.css` | Ajustes móviles, tablets y pantallas pequeñas                   |

---

### `js/`

Contiene la lógica modular de la aplicación.

| Archivo     | Función                                                                 |
| ----------- | ----------------------------------------------------------------------- |
| `config.js` | URL de Apps Script, versión, configuración general y modos API          |
| `state.js`  | Estado global compartido de la app                                      |
| `api.js`    | Conexión centralizada con Apps Script                                   |
| `utils.js`  | Funciones reutilizables: formato, fechas, escape HTML, estados, números |
| `main.js`   | Punto de entrada de la app y registro de módulos                        |

---

### `js/services/`

Servicios técnicos y de datos.

| Archivo           | Función                                                               |
| ----------------- | --------------------------------------------------------------------- |
| `mapService.js`   | Inicializa Leaflet, dibuja paradas y controla el mapa                 |
| `gpsService.js`   | Obtiene GPS, muestra ubicación y prepara tracking futuro              |
| `routeService.js` | Carga ruta, calcula avance, filtra paradas y carga facturas/productos |

---

### `js/views/`

Vistas visuales de la aplicación.

| Archivo          | Función                                            |
| ---------------- | -------------------------------------------------- |
| `loginView.js`   | Login, carga de ruta y validación inicial          |
| `inicioView.js`  | Resumen general de jornada                         |
| `rutaView.js`    | Lista de paradas, buscador, filtros y ordenamiento |
| `mapaView.js`    | Control visual de la vista mapa                    |
| `cierreView.js`  | Validación visual para cierre de ruta              |
| `entregaView.js` | Panel lateral de facturas y productos              |

---

### `js/actions/`

Acciones que modifican datos en Google Sheets mediante Apps Script.

| Archivo              | Función                                                    |
| -------------------- | ---------------------------------------------------------- |
| `facturaActions.js`  | Confirmar, rechazar o marcar factura como no despachada    |
| `productoActions.js` | Gestionar producto total, parcial, rechazo o no despachado |
| `rutaActions.js`     | Refrescar ruta, finalizar ruta y cambiar de chofer         |

---

## Backend utilizado

El backend se encuentra en Google Apps Script y responde mediante una URL pública tipo:

```javascript
https://script.google.com/macros/s/XXXXXXXXXXXX/exec
```

La URL se configura en:

```text
js/config.js
```

Variable principal:

```javascript
export const SHEET_API = "URL_DE_APPS_SCRIPT";
```

---

## Modos principales de la API

La app espera que Apps Script soporte estos modos:

```text
status
loginRuta
getFacturasParada
getProductosFactura
actualizarProducto
confirmarFacturaCompleta
rechazarFacturaCompleta
noDespachadoFactura
finalizarRuta
registrarTracking
registrarEvento
```

---

## Flujo operativo

1. El chofer ingresa CI, chapa y fecha.
2. La app consulta Apps Script con `loginRuta`.
3. Apps Script devuelve:

   * Chofer
   * Móvil
   * Resumen
   * Paradas
4. LOGITRACK muestra:

   * Inicio
   * Ruta
   * Mapa
   * Cierre
5. El chofer gestiona facturas y productos.
6. Cada acción captura ubicación GPS si está disponible.
7. Al finalizar, se valida que no existan pendientes.

---

## Publicación en GitHub Pages

La aplicación está preparada para publicarse con GitHub Pages.

Configuración recomendada:

```text
Settings > Pages
Source: Deploy from branch
Branch: main
Folder: / root
```

URL esperada:

```text
https://USUARIO.github.io/LOGITRACK/
```

---

## Reglas importantes de desarrollo

No volver a concentrar todo el código en `index.html`.

Cada mejora debe ir en su módulo correspondiente:

| Tipo de mejora             | Archivo recomendado                                         |
| -------------------------- | ----------------------------------------------------------- |
| Cambios visuales generales | `css/base.css`                                              |
| Login                      | `js/views/loginView.js` y `css/login.css`                   |
| Vista inicio               | `js/views/inicioView.js`                                    |
| Vista ruta                 | `js/views/rutaView.js` y `css/ruta.css`                     |
| Mapa                       | `js/services/mapService.js` y `css/mapa.css`                |
| GPS                        | `js/services/gpsService.js`                                 |
| Facturas                   | `js/actions/facturaActions.js` y `js/views/entregaView.js`  |
| Productos                  | `js/actions/productoActions.js` y `js/views/entregaView.js` |
| Cierre                     | `js/views/cierreView.js` y `js/actions/rutaActions.js`      |
| API                        | `js/api.js`                                                 |
| Configuración              | `js/config.js`                                              |
| Estado global              | `js/state.js`                                               |

---

## Control de caché

Para forzar actualización en GitHub Pages, los archivos se cargan con versión:

```html
<link rel="stylesheet" href="./css/base.css?v=1.2">
<script type="module" src="./js/main.js?v=1.2"></script>
```

Cuando se hagan cambios grandes, aumentar la versión:

```text
v=1.2
v=1.3
v=1.4
```

---

## Estado actual del proyecto

### Fase 1.1

Implementado:

* Login funcional
* Menú inferior
* Vista Inicio
* Vista Ruta
* Vista Mapa
* Vista Cierre
* CSS modular
* JS modular base

### Fase 1.2

En desarrollo:

* Buscador de paradas
* Filtros por estado
* Ordenamiento de ruta
* Tarjetas de parada mejoradas
* Mejor navegación hacia mapa y gestión

---

## Próximas fases

### Fase 1.3

Mejorar pantalla Inicio:

* Estado de jornada
* Alertas de pendientes
* Última sincronización
* Acciones rápidas más claras

### Fase 1.4

Mejorar pantalla Cierre:

* Validación visual más detallada
* Pendientes por factura/producto
* Bloqueo visual de cierre si hay pendientes

### Fase 1.5

Pulido móvil:

* Tamaño de botones
* Panel lateral
* Mensajes
* Navegación
* Rendimiento

### Fase 2

Gestión avanzada de entrega:

* Tabs por parada
* Resumen de cliente
* Facturas tipo acordeón
* Productos agrupados
* Eventos de entrega
* Evidencias o comentarios

---

## Requisitos del navegador

LOGITRACK usa:

* JavaScript moderno con módulos ES
* Fetch API
* Geolocation API
* Leaflet
* Conexión a internet
* Permiso de ubicación para registrar GPS

Navegadores recomendados:

* Google Chrome Android
* Google Chrome Desktop
* Microsoft Edge
* Safari móvil reciente

---

## Notas de seguridad

La URL de Apps Script queda visible en el frontend porque la app está publicada en GitHub Pages.

Para una versión más segura se recomienda implementar después:

* PIN por chofer
* Validación CI + chapa + PIN
* Restricción de acciones por usuario
* Reducción de información expuesta en `status`
* Migración futura a Apps Script HtmlService o backend intermedio

---

## Mantenimiento

Antes de subir una mejora:

1. Verificar que el archivo correcto fue modificado.
2. Hacer commit en GitHub.
3. Esperar actualización de GitHub Pages.
4. Probar desde navegador incógnito o móvil.
5. Revisar consola del navegador si algo no carga.
6. Aumentar `?v=` si el navegador mantiene caché vieja.

---

## Autor / Proyecto

Proyecto desarrollado como sistema interno de control de entregas y rutas.

Nombre del sistema:

```text
LOGITRACK
```

Tipo:

```text
Aplicación web logística móvil
```

Stack:

```text
Google Sheets + Apps Script + GitHub Pages + JavaScript + Leaflet
```

