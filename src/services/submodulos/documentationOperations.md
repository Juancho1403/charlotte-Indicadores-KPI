## Resumen

**Archivo**  
`operations.service.js`

**Propósito**  
Proveer funciones del backend para métricas y SLA del personal de servicio de una cafetería. Incluye lógica para obtener el desglose de SLA por fecha y series temporales de métricas por mesero. Se apoya en llamadas HTTP a servicios externos y en consultas a la base de datos mediante Prisma.

**Tecnologías**  
- Node.js  
- `node-fetch` para llamadas HTTP  
- `@prisma/client` para acceso a la base de datos  
- `date-fns` para manejo de fechas  
- Helpers locales en `../../utils` para cálculos de tiempo y métricas

---

## Requisitos y configuración

**Variables de entorno**  
- **COMANDAS_API_URL** URL del servicio de comandas. Valor por defecto `http://localhost:3000/comandas`.  
- **KITCHEN_API_BASE** Base URL del servicio de kitchen para obtener lista de staff (opcional).  
- Configuración de Prisma según tu `schema.prisma` y `DATABASE_URL`.

**Dependencias principales**  
- `node-fetch`  
- `@prisma/client`  
- `date-fns`  
- Helpers locales exportados desde `../../utils/timeHelpers.js` y `../../utils/staffMetricsHelpers.js`

**Efectos secundarios**  
- Conexión a la base de datos vía Prisma.  
- Llamadas HTTP a servicios externos.  
- Lectura de variables de entorno.

---

## Funciones exportadas

### getSlaBreakdown

**Firma**  
`export async function getSlaBreakdown(query = {})`

**Descripción**  
Calcula el porcentaje de comandas entregadas que caen en zonas verde, amarilla y roja según el tiempo de servicio. Obtiene comandas desde `COMANDAS_API_URL`, filtra por entregadas y por fecha si se proporciona, calcula `service_time_minutes` y devuelve porcentajes enteros ajustados para sumar 100.

**Parámetros**  
- **query** objeto opcional con:  
  - **date** cadena ISO o `YYYY-MM-DD` para filtrar por fecha de entrega.

**Precondición**  
- `COMANDAS_API_URL` debe responder JSON con `payload.data` como arreglo de comandas.  
- Cada comanda puede contener `delivered_at`, `sent_at` y/o `metrics.service_time_minutes`.  
- Si se pasa `date`, debe ser una cadena válida para comparar con `delivered_at` mediante `isSameUtcDate`.

**Postcondición**  
- Devuelve un objeto con claves **green_zone_percent**, **yellow_zone_percent**, **red_zone_percent** y **data_timestamp** (ISO).  
- Si no hay comandas entregadas para la fecha, devuelve 0% en las tres zonas y `data_timestamp` actual.  
- Si hay datos, los porcentajes son enteros redondeados y ajustados para sumar 100; el ajuste se aplica al grupo más grande.

**Comportamiento clave**  
- Llama a `COMANDAS_API_URL` con GET; si `query.date` existe, la añade como query param.  
- Filtra comandas con `delivered_at` no nulo.  
- Para cada comanda en la fecha: usa `metrics.service_time_minutes` si existe; si no, calcula minutos con `minutesBetween(sent_at, delivered_at)`; si no puede calcular, omite la comanda.  
- Clasificación: `< 5` minutos → verde; `<= 10` minutos → amarillo; `> 10` minutos → rojo.

**Errores**  
- Si la llamada fetch falla o responde con `!resp.ok`, lanza un `Error` con el status.  
- Otras excepciones se propagan para que el controlador HTTP las maneje.

**Ejemplo de uso**  
```js
const breakdown = await getSlaBreakdown({ date: '2025-12-29' });
// { green_zone_percent: 60, yellow_zone_percent: 30, red_zone_percent: 10, data_timestamp: '...' }
```

---

### getStaffMetrics

**Firma**  
`export async function getStaffMetrics(waiter_id, query = {})`

**Descripción**  
Genera una serie temporal paginada de métricas para un mesero entre dos fechas. Recupera lista de staff desde `KITCHEN_API_BASE`, pedidos desde Prisma y reglas SLA desde la base de datos. Construye buckets por fecha con conteo de órdenes, tiempo promedio y cumplimiento SLA.

**Parámetros**  
- **waiter_id** identificador del mesero (string o number).  
- **query** objeto opcional con:  
  - **date_from** cadena ISO.  
  - **date_to** cadena ISO.  
  - **granularity** string, por defecto `daily`.  
  - **page** número, por defecto `1`.  
  - **page_size** número, por defecto `30`.

**Precondición**  
- Prisma configurado y accesible con tablas `order` y `kpiReglaSemaforo`.  
- Helpers `buildDateBuckets`, `dateKey`, `durationSecondsForOrder` y `computeSlaComplianceForDurations` implementados y exportados.  
- Opcionalmente `KITCHEN_API_BASE` apuntando a `/api/kitchen/staff` para obtener información del mesero.

**Postcondición**  
- Devuelve un objeto con `meta` y `data`:  
  - **meta** incluye `total`, `page`, `page_size`, `waiter`, `date_from`, `date_to`, `granularity`.  
  - **data** es un arreglo de puntos ordenados por fecha con `date`, `daily_orders`, `avg_time` (segundos o null) y `sla_compliance`.  
- Si fallan llamadas externas, la función degrada a arreglos vacíos y continúa con los datos disponibles.

**Comportamiento clave**  
1. Normaliza fechas usando `parseISO`, `startOfDay`, `endOfDay`. Si faltan o son inválidas, usa últimos 7 días por defecto. Si `date_from > date_to`, las intercambia.  
2. Intenta obtener lista de staff desde `${KITCHEN_API_BASE}/api/kitchen/staff`. Si falla, usa `[]`. Busca `staffMember` por `id`, `userId` o `workerCode`.  
3. Consulta `prisma.order.findMany` filtrando por `waiterId` en varias formas y por `createdAt` entre `start` y `end`. Si falla, usa `[]`.  
4. Construye buckets con `buildDateBuckets` y acumula `count` y `durationsSeconds` por bucket usando `durationSecondsForOrder`.  
5. Lee reglas SLA desde `prisma.kpiReglaSemaforo.findMany()`. Si falla, usa `[]`. Calcula `avgTime` y `sla_compliance` por bucket.  
6. Ordena puntos por fecha y aplica paginación.

**Errores**  
- Las llamadas a Prisma y a la API de kitchen están en `try/catch` y degradan a arreglos vacíos; la función no lanza por esas fallas.  
- Errores en helpers importados o excepciones no controladas se propagan y deben ser manejados por el controlador.

**Ejemplo de uso**  
```js
const res = await getStaffMetrics('42', {
  date_from: '2025-12-01',
  date_to: '2025-12-07',
  page: 1,
  page_size: 7
});
// res.meta, res.data -> serie diaria con avg_time y sla_compliance
```

---

## Ejemplos de respuestas

**Ejemplo getSlaBreakdown con datos**  
```json
{
  "green_zone_percent": 60,
  "yellow_zone_percent": 30,
  "red_zone_percent": 10,
  "data_timestamp": "2025-12-29T20:31:00.000Z"
}
```

**Ejemplo getSlaBreakdown sin datos**  
```json
{
  "green_zone_percent": 0,
  "yellow_zone_percent": 0,
  "red_zone_percent": 0,
  "data_timestamp": "2025-12-29T20:31:00.000Z"
}
```

**Ejemplo getStaffMetrics meta y data**  
```json
{
  "meta": {
    "total": 7,
    "page": 1,
    "page_size": 7,
    "waiter": { "id": "42", "name": "María" },
    "date_from": "2025-12-01T00:00:00.000Z",
    "date_to": "2025-12-07T23:59:59.999Z",
    "granularity": "daily"
  },
  "data": [
    { "date": "2025-12-01", "daily_orders": 12, "avg_time": 420, "sla_compliance": { "green": 8, "yellow": 3, "red": 1 } },
    { "date": "2025-12-02", "daily_orders": 10, "avg_time": 390, "sla_compliance": { "green": 7, "yellow": 2, "red": 1 } }
  ]
}
```