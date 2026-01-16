## Resumen
Este repositorio contiene el módulo **kpiWorker.mjs**, un worker que comprueba métricas KPI periódicamente, genera alertas en base a thresholds almacenados en la base de datos y encola jobs con **BullMQ**. Utiliza **Prisma** para persistencia, **ioredis** para la conexión a Redis y el API `fetch` para obtener datos externos. Está pensado para ejecutarse en Node 18+.

---

## Características principales
- Encolado y procesamiento de jobs con **BullMQ**.  
- Scheduler interno configurable mediante una expresión cron simplificada.  
- Cálculo de métricas a partir de endpoints externos y mapeo flexible de métricas.  
- Persistencia de thresholds y alertas con **Prisma**.  
- Dedupe de alertas recientes para evitar duplicados en ventana de 1 hora.  
- Manejo de timeouts y errores en peticiones HTTP.

---

## Requisitos y dependencias
**Requisitos mínimos**
- Node 18+ (por `fetch` nativo)  
- Redis accesible  
- Base de datos compatible con Prisma y esquema que incluya `kpiThresholdsHistorial` y `kpiAlertaHistorial`

**Dependencias principales**
- `bullmq`  
- `ioredis`  
- `@prisma/client`  
- (opcional) `node-fetch` si el runtime no soporta `fetch`

---

## Variables de entorno
- **REDIS_URL**: URL de Redis. Default `redis://127.0.0.1:6379`  
- **KPI_QUEUE_NAME**: Nombre de la cola. Default `kpi-check-queue`  
- **CLIENTS_URL**: Endpoint para obtener datos de clientes. Default `http://localhost:3000/clients`  
- **SERVICE_REQUESTS_URL**: Endpoint para obtener solicitudes de servicio. Default `http://localhost:3000/service-requests`  
- **KPI_CRON**: Expresión cron simplificada para scheduler interno. Default `*/1 * * * *`  
- **KPI_INTERVAL_MS**: Fallback en milisegundos si KPI_CRON no es compatible

---

## Estructura y mapeo de métricas
**METRIC_KEYS** define las métricas soportadas y para cada una:
- **metricKey**: clave usada para buscar thresholds.  
- **prismaMetric**: tipo usado en la tabla de alertas.  
- **extractValue**: función que extrae el valor desde la respuesta del API.  
- **itemLabel**: función que genera la etiqueta del item afectado.

Métricas incluidas por defecto:
- **USUARIOS**: cuenta de usuarios o total en `meta.total`.  
- **VENTAS**: total de ventas por página o suma de `total_amount`.  
- **ROTACION**: tiempo de permanencia promedio en minutos.  
- **TIEMPO_ESPERA**: tiempo máximo de espera en minutos desde service requests.

---

## API pública del módulo
### startKpiWorker
**Descripción**  
Inicia el scheduler interno y devuelve referencias al worker y la cola.

**Uso**
```js
import { startKpiWorker } from './kpiWorker.mjs';
await startKpiWorker();
```

**Precondición**  
- Variables de entorno configuradas.  
- Redis accesible.  
- Prisma inicializado.

**Postcondición**  
- Scheduler interno iniciado y primer job encolado.  
- Devuelve `{ worker, queue }`.

---

### shutdownKpiWorker
**Descripción**  
Apaga el worker y cierra recursos: limpia interval, cierra worker y queue, desconecta Prisma y cierra conexión Redis.

**Uso**
```js
import { shutdownKpiWorker } from './kpiWorker.mjs';
await shutdownKpiWorker();
```

**Precondición**  
- `worker`, `queue`, `prisma` y `connection` inicializados.

**Postcondición**  
- Intervalo detenido.  
- Worker y queue cerrados.  
- Prisma desconectado.  
- Conexión Redis cerrada.

---

## Funciones internas clave
### loadThresholds
**Descripción**  
Lee `kpiThresholdsHistorial` y devuelve un mapa de thresholds por clave de métrica.

**Precondición**  
- Prisma conectado y tabla `kpiThresholdsHistorial` disponible.

**Postcondición**  
- Devuelve un objeto `{ [metricKey]: { value_warning, value_critical, timestamp } }`.

---

### decideSeverity
**Descripción**  
Determina la severidad comparando un valor con thresholds.

**Precondición**  
- `value` numérico.  
- `threshold` con `value_warning` y/o `value_critical`.

**Postcondición**  
- Devuelve `KpiSeverity.CRITICAL`, `KpiSeverity.WARNING` o `null`.

---

### recentSimilarAlertExists
**Descripción**  
Comprueba si existe una alerta similar en la última hora para evitar duplicados.

**Precondición**  
- Prisma conectado y tabla `kpiAlertaHistorial` disponible.

**Postcondición**  
- Devuelve `true` si existe una alerta similar en la última hora, `false` en caso contrario.

---

### createAlert
**Descripción**  
Crea una alerta en `kpiAlertaHistorial` si no existe una similar reciente.

**Precondición**  
- Prisma conectado.  
- Parámetros válidos: `prismaMetric`, `itemAfectado`, `valorRegistrado`, `severity`.

**Postcondición**  
- Inserta una fila en `kpiAlertaHistorial` y devuelve el objeto creado, o devuelve `null` si se omitió por duplicado.

---

### runKpiCheck
**Descripción**  
Lógica principal: carga thresholds, consulta endpoints externos, extrae valores, decide severidad y crea alertas.

**Precondición**  
- Prisma conectado.  
- Endpoints `CLIENTS_URL` y `SERVICE_REQUESTS_URL` accesibles o manejados como `null`.

**Postcondición**  
- Para cada métrica que supere thresholds se intentará crear una alerta (sujeta a deduplicación).  
- Se registran logs de métricas OK y alertas creadas u omitidas.

---

### cronToIntervalMs
**Descripción**  
Convierte una expresión `*/N * * * *` a milisegundos o devuelve fallback.

**Precondición**  
- `cronExpr` string.

**Postcondición**  
- Devuelve intervalo en milisegundos o el fallback configurado.

---

### startInternalScheduler
**Descripción**  
Encola un job inicial y programa encolado periódico usando `setInterval`.

**Precondición**  
- `queue` conectada y `intervalMs` calculado.

**Postcondición**  
- Job inicial encolado y `setInterval` activo; `intervalHandle` asignado.

---

## Resumen de precondiciones y postcondiciones
| Función | Precondición | Postcondición |
|---|---:|---|
| loadThresholds | Prisma conectado | Devuelve mapa de thresholds |
| decideSeverity | value numérico y threshold | Devuelve severidad o null |
| recentSimilarAlertExists | Prisma conectado | Devuelve booleano |
| createAlert | Prisma conectado y datos válidos | Inserta alerta o devuelve null |
| runKpiCheck | Prisma conectado y endpoints accesibles | Crea alertas según thresholds |
| cronToIntervalMs | cronExpr string | Devuelve intervalo ms o fallback |
| startInternalScheduler | Queue conectada | Encola job inicial y programa interval |
| startKpiWorker | Entorno configurado | Inicia scheduler y devuelve refs |
| shutdownKpiWorker | Recursos inicializados | Cierra recursos y desconecta |

---

## Ejecución y despliegue
**Arranque**
1. Configura las variables de entorno necesarias.  
2. Asegura que Redis y la base de datos estén accesibles.  
3. Inicia tu aplicación que importe y llame a `startKpiWorker()`.

**Apagado**
- Llama a `shutdownKpiWorker()` durante el proceso de cierre para liberar recursos correctamente.

---

## Buenas prácticas y recomendaciones
- **Timeouts y resiliencia**: Mantén `fetchWithTimeout` y asegúrate de que `extractValue` maneje respuestas `null`.  
- **Parámetros de deduplicación**: La ventana de 1 hora está codificada; parametrízala si necesitas otro comportamiento.  
- **Condiciones de carrera**: Si ejecutas múltiples instancias, considera locks o transacciones para evitar duplicados en escenarios de alta concurrencia.  
- **Monitoreo**: Añade métricas y logs estructurados para latencias, errores de fetch y número de alertas creadas.  
- **Pruebas**: Mockea Prisma y endpoints externos para pruebas unitarias de `runKpiCheck` y `METRIC_KEYS.extractValue`.  
- **Seguridad**: Valida y sanitiza datos externos antes de almacenarlos si se reutilizan en otros contextos.

---

## Ejemplos rápidos
**Iniciar worker**
```js
import { startKpiWorker } from './kpiWorker.mjs';
await startKpiWorker();
```

**Apagar worker**
```js
import { shutdownKpiWorker } from './kpiWorker.mjs';
await shutdownKpiWorker();
```