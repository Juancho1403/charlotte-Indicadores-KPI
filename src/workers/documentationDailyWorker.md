Documentación - KpiDailyWorker.js
Breve descripción: este archivo implementa un Worker de BullMQ que calcula y persiste snapshots diarios de KPIs (ventas, tiempos de servicio, rotación de mesas, etc.) usando datos obtenidos desde una API externa y guardando resultados con Prisma. A continuación se documentan las constantes, funciones y el worker principal, con precondición y postcondición para cada función, además de efectos secundarios, errores esperados y notas de uso para mantenimiento futuro.

Entorno y configuración importantes
Dependencias: bullmq, ioredis, @prisma/client, dayjs (+ plugins utc, timezone), fetch global, logger local.

Variables de entorno relevantes:

REDIS_URL (opcional) — URL de Redis.

OUTLIER_K — factor k para detección de outliers.

OUTLIER_STRATEGY — 'exclude' o 'adjust'.

KPI_CRON — expresión cron para job repetido.

KPI_CRON_TZ — zona horaria para cron.

API_BASE_URL — base URL de la API.

API_AUTH_TOKEN — token Bearer opcional para la API.

Efectos secundarios globales: conexión a Redis, instancia de Prisma, llamadas HTTP a la API, escrituras en la base de datos kpiSnapshotDiario, logs en consola y logger.

scheduleDailyKpiJob
Descripción
Programa un job repetido en la cola kpi-daily que ejecuta la tarea calculate-daily-kpi según la expresión cron y zona horaria configuradas.

Firma: async function scheduleDailyKpiJob()

Precondición

La cola queue ya está inicializada con una conexión válida a Redis.

Variables de entorno KPI_CRON y KPI_CRON_TZ (o sus valores por defecto) están disponibles.

Redis es accesible y la instancia de BullMQ puede añadir jobs.

Postcondición

Se añade (o actualiza) un job repetido llamado calculate-daily-kpi en la cola kpi-daily con removeOnComplete: true y removeOnFail: false.

Si la operación falla, se lanza una excepción que debe ser manejada por el llamador.

Efectos secundarios

Modifica el estado de la cola en Redis (registro del job repetido).

Errores esperados

Errores de conexión a Redis o permisos que provoquen rechazo de queue.add.

Notas

Diseñada para ejecutarse una vez en el arranque de la aplicación (por ejemplo desde el bootstrap del servidor).

median
Descripción
Calcula la mediana de un array de valores numéricos.

Firma: function median(values)

Precondición

values es un array (o convertible a array) de elementos numéricos o valores que puedan convertirse a número.

Postcondición

Devuelve la mediana como número.

Si el array está vacío devuelve 0.

Efectos secundarios

Ninguno (función pura).

Errores esperados

Ninguno; la función normaliza y no lanza si recibe elementos no numéricos (se asume que el llamador filtra si es necesario).

Notas

Ordena una copia del array para no mutar la entrada.

quantile
Descripción
Calcula el cuantíl (interpolado) q de un array de valores numéricos usando interpolación lineal entre posiciones.

Firma: function quantile(values, q)

Precondición

values es un array de números (o convertible).

q es un número entre 0 y 1 (inclusive).

Postcondición

Devuelve el valor del cuantíl solicitado como número.

Si values está vacío devuelve 0.

Efectos secundarios

Ninguno (función pura).

Errores esperados

Si q está fuera de rango, el comportamiento actual no valida explícitamente; se recomienda pasar q en [0,1].

Notas

Implementación basada en la posición (n-1)*q con interpolación entre base y base+1.

handleOutliers
Descripción
Detecta y trata outliers en una muestra numérica. Soporta dos estrategias: 'exclude' (elimina outliers) y 'adjust' (recorta valores fuera de rango). Para muestras pequeñas (<4) aplica heurística basada en mediana y ratio.

Firma: function handleOutliers(valuesInput, k = 2, strategy = 'adjust')

Precondición

valuesInput es un array (o convertible) de valores numéricos o strings numéricos.

k es un número positivo que escala el umbral IQR.

strategy es 'exclude' o 'adjust'.

Postcondición

Devuelve un objeto con la forma:

js
{
  processed: Array<number>, // valores tras excluir o ajustar
  outliersCount: number,    // cantidad de outliers detectados
  mu: number,               // mediana (o fallback) de la muestra original
  sd: number,               // valor calculado (en este código es cuantíl usado como placeholder)
  lower: number,            // límite inferior detectado
  upper: number             // límite superior detectado
}
Si la muestra está vacía devuelve processed: [] y contadores en 0.

Para muestras < 4 aplica la heurística de ratio y devuelve sd: 0 (comportamiento intencional).

Para muestras >= 4 usa IQR con factor 1.5 * iqr * k para calcular lower y upper.

Efectos secundarios

Ninguno (función pura).

Errores esperados

No lanza por entradas no numéricas: convierte y filtra NaN.

Si k es 0 o negativo, los límites pueden colapsar; se recomienda k > 0.

Notas

sd no es desviación estándar real en la implementación actual; es un campo informativo que contiene quantile(values, mu) en el código.

Para muestras pequeñas la heurística usa ratioThreshold = 10 y ajusta/excluye valores extremos relativos a la mediana.

Mantener la lógica actual si se desea compatibilidad histórica; para mejoras futuras documentar claramente el significado de sd.

fetchJson
Descripción
Wrapper para realizar peticiones GET a la API configurada en API_BASE, con soporte de query params y token de autorización opcional. Lanza error si la respuesta HTTP no es ok.

Firma: async function fetchJson(path, params = {})

Precondición

API_BASE está definido (por defecto 'http://localhost:3000').

path es una ruta relativa válida (por ejemplo '/clients').

fetch global está disponible en el entorno de ejecución.

Postcondición

Devuelve el JSON parseado de la respuesta si res.ok es true.

Si la respuesta no es ok lanza un Error con mensaje que incluye status, statusText y el cuerpo de la respuesta (si puede leerse).

Efectos secundarios

Realiza una petición HTTP GET externa.

Errores esperados

TypeError si fetch no está definido en el entorno.

Errores de red o timeouts que resulten en excepción.

Respuestas no-2xx que provocan throw new Error(...).

Notas

Construye query params solo con valores no null/undefined.

Añade header Authorization: Bearer <token> si API_AUTH_TOKEN está presente.

Worker principal y lógica del job
Descripción
Instancia un Worker de BullMQ que procesa la cola kpi-daily. La función de procesamiento:

Calcula targetDay (día anterior en la zona CRON_TIMEZONE).

Llama a la API /clients y /comandas con el rango startIso/endIso.

Filtra clientes cerrados y extrae ingresos.

Calcula tiempos de servicio a partir de métricas o timestamps.

Calcula rotación de mesas.

Detecta y trata outliers en ingresos y tiempos.

Calcula métricas finales y persiste un registro en kpiSnapshotDiario con Prisma.

Loggea resultados o advertencias.

Precondición

Conexión a Redis válida (connection) y Worker puede conectarse.

prisma inicializado y con acceso a la tabla kpiSnapshotDiario.

API_BASE y fetch disponibles para obtener /clients y /comandas.

La API devuelve objetos con la estructura esperada:

/clients → { data: Array } con campos como status, closed_at, total_amount, tableId o table_number.

/comandas → { data: Array } con campos metrics, sent_at, delivered_at, table_number.

Postcondición

Si hay datos: se crea un registro en kpiSnapshotDiario con campos calculados (totalVentas, totalPedidos, tiempoPromedioMin, rotacionMesasIndice, ticketPromedio, alertasGeneradas, metadataJson).

Si no hay datos: se crea un snapshot con totalVentas: '0.00', totalPedidos: 0, y metadataJson.note: 'no_data'.

Se emiten logs informativos o de error según corresponda.

Si ocurre un error no manejado dentro del job, el worker lanza la excepción y BullMQ marca el job como fallido.

Efectos secundarios

Llamadas HTTP a la API.

Escritura en la base de datos mediante Prisma.

Logs y posibles alertas a través de logger.

Errores esperados y manejo

Errores de fetch para /clients o /comandas son capturados y registrados con logger.logFetchWarning, y la ejecución continúa con arrays vacíos.

Errores en Prisma al crear el snapshot provocan que el job falle y la excepción se propague.

Validaciones internas: si totalRevenue no es finito se registra con logger.logUnexpectedValue.

Notas de mantenimiento

Timezone: targetDay se calcula con dayjs().tz(CRON_TIMEZONE) y se resta 1 día; revisar si se desea otro comportamiento en días con DST.

Estructura de la API: cualquier cambio en la forma de /clients o /comandas debe reflejarse en la extracción de campos (total_amount, metrics.service_time_minutes, etc.).

Outliers: la lógica actual mezcla mediana e IQR; documentar cualquier cambio para mantener compatibilidad histórica de metadataJson.

Escalabilidad: concurrency: 1 evita solapamiento; si se cambia, asegurar idempotencia de la creación de snapshots.