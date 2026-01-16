### Resumen 
**Propósito**  
Generar reportes Excel en streaming desde la tabla `kpiSnapshotDiario`, subirlos a S3 sin usar disco local, persistir metadata del reporte en la base de datos y exponer una URL prefirmada para descarga. El procesamiento se ejecuta como un worker de BullMQ consumiendo la cola `reports-queue`.

**Tecnologías clave**  
- Redis / BullMQ para cola y ejecución de jobs  
- Prisma para acceso a la base de datos  
- ExcelJS en modo streaming para crear archivos XLSX sin cargar todo en memoria  
- AWS S3 SDK para subir el stream con multipart upload y generar URLs prefirmadas

---

## Variables y clientes globales

#### **REDIS_URL, redisConnection**
- **Descripción**: URL de Redis y cliente ioredis usado por BullMQ.
- **Precondición**: `process.env.REDIS_URL` opcional; Redis accesible en la URL resultante.
- **Postcondición**: `redisConnection` inicializado y disponible para crear el `Worker`.

#### **prisma**
- **Descripción**: Instancia de `PrismaClient` para consultas a la base de datos.
- **Precondición**: Configuración de Prisma válida y acceso a la base de datos.
- **Postcondición**: `prisma` listo para ejecutar consultas `findMany`, `upsert`, etc.

#### **s3Client, BUCKET, PRESIGNED_EXPIRES**
- **Descripción**: Cliente S3 configurado con credenciales y región; `BUCKET` obligatorio; `PRESIGNED_EXPIRES` controla expiración de URL.
- **Precondición**: `process.env.S3_BUCKET` definido; credenciales AWS en variables de entorno.
- **Postcondición**: `s3Client` listo; si `BUCKET` no existe el proceso termina con `process.exit(1)`.

#### **WORKER_CONCURRENCY, BATCH_SIZE**
- **Descripción**: Parámetros de concurrencia del worker y tamaño de lote para paginación.
- **Precondición**: Valores numéricos válidos en variables de entorno o valores por defecto.
- **Postcondición**: Valores usados por el worker y paginador.

---

## Funciones públicas y comportamiento

### uploadStreamToS3
**Descripción**  
Sube un stream a S3 usando `@aws-sdk/lib-storage` (multipart upload) sin escribir en disco.

**Firma**  
`async function uploadStreamToS3(key, stream, contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')`

**Parámetros**
- **key** `string` — ruta/clave en el bucket S3.
- **stream** `Readable` — stream que contiene los bytes a subir.
- **contentType** `string` opcional — tipo MIME del archivo.

**Precondición**
- `s3Client` y `BUCKET` inicializados y accesibles.
- `stream` es un `Readable` válido que emitirá datos y finalizará.
- `key` es una cadena válida para S3.

**Postcondición**
- Retorna la promesa de `upload.done()` que se resuelve cuando la subida multipart finaliza correctamente.
- Si la subida falla, la promesa se rechaza con el error de AWS SDK.

**Efectos secundarios**
- Inicia una operación multipart en S3 que consume el stream hasta su fin.

**Errores**
- Rechaza si credenciales inválidas, bucket inexistente, o error de red.

---

### paginateKpiSnapshots
**Descripción**  
Generador asíncrono que itera la tabla `kpiSnapshotDiario` en bloques ordenados por `idLog` para evitar OOM.

**Firma**  
`async function* paginateKpiSnapshots(batchSize = BATCH_SIZE, filter = {})`

**Parámetros**
- **batchSize** `number` — número de filas por consulta.
- **filter** `object` — condiciones `where` adicionales para la consulta Prisma.

**Precondición**
- `prisma` inicializado y la tabla `kpiSnapshotDiario` existe.
- `batchSize` > 0.
- `filter` es un objeto válido para Prisma `findMany`.

**Postcondición**
- Produce (yield) cada fila encontrada en orden ascendente por `idLog`.
- Termina cuando no quedan filas que cumplan el filtro.

**Efectos secundarios**
- Realiza múltiples consultas `prisma.kpiSnapshotDiario.findMany` paginadas.

**Errores**
- Rechaza si Prisma lanza un error (conexión DB, esquema incorrecto).

**Notas de uso**
- Diseñado para usarse con `for await (const row of paginateKpiSnapshots(...))` para procesar grandes volúmenes sin cargar todo en memoria.

---

### processor
**Descripción**  
Función principal que procesa un job de BullMQ: crea un workbook Excel en streaming, escribe filas desde `paginateKpiSnapshots`, sube el archivo a S3, genera URL prefirmada y persiste metadata en la tabla `report`. Maneja errores y marca el job como failed si ocurre un fallo.

**Firma**  
`async function processor(job)`

**Parámetros**
- **job** objeto de BullMQ que contiene `id` y `data` con `filter` y `reportMeta`.

**Precondición**
- `job` válido provisto por BullMQ.
- `BUCKET`, `s3Client`, `prisma` inicializados.
- `paginateKpiSnapshots` funciona con el `filter` proporcionado.
- Permisos para escribir en S3 y para actualizar la tabla `report`.

**Flujo resumido**
1. Construye `key` único para S3.
2. Crea `PassThrough` stream y `WorkbookWriter` de ExcelJS con `stream: pass`.
3. Define columnas de la hoja.
4. Lanza `uploadStreamToS3(key, pass)` en paralelo (consume el `pass`).
5. Itera `paginateKpiSnapshots` y `sheet.addRow(...).commit()` por cada fila.
6. `await workbook.commit()` para cerrar el stream Excel.
7. `await uploadPromise` para esperar la subida a S3.
8. Genera URL prefirmada con `getSignedUrl`.
9. Persiste metadata en `prisma.report.upsert`.
10. Intenta actualizar `job.data` con `job.update`.
11. Retorna `{ success: true, download_url, s3Key }`.

**Postcondición**
- Si todo va bien:
  - Archivo XLSX almacenado en S3 bajo `key`.
  - URL prefirmada generada y almacenada en la tabla `report` (si el upsert tuvo éxito).
  - Job retorna un objeto con `download_url` y `s3Key`.
- Si ocurre un error:
  - Se intenta mover el job a estado FAILED con `job.moveToFailed`.
  - Se registra el estado FAILED en la tabla `report` (si es posible).
  - La función relanza el error para que Bull marque el job como failed si es necesario.

**Efectos secundarios**
- Subida a S3.
- Escritura/actualización en la tabla `report`.
- Posible actualización del job en Redis/BullMQ.

**Errores y manejo**
- Errores durante la escritura del workbook, subida a S3 o generación de URL son capturados en el `catch`.
- Se intenta mover el job a FAILED y persistir el error en DB; si `moveToFailed` falla, se relanza un error compuesto.

**Consideraciones de rendimiento**
- Streaming evita OOM; `BATCH_SIZE` controla la carga por consulta.
- `WORKER_CONCURRENCY` controla cuántos jobs se procesan en paralelo.

---

## Worker y ciclo de vida

### Creación del Worker
**Código relevante**
```js
const worker = new Worker('reports-queue', processor, { connection: redisConnection, concurrency: WORKER_CONCURRENCY });
```

**Precondición**
- `redisConnection` válido y accesible.
- `processor` definido.

**Postcondición**
- Worker suscrito a la cola `reports-queue` y listo para procesar jobs con la concurrencia configurada.

### Eventos del Worker
- **completed**: `worker.on('completed', (job) => { console.log(...) })`  
  **Precondición**: Job completado por `processor`.  
  **Postcondición**: Mensaje de log indicando finalización.

- **failed**: `worker.on('failed', (job, err) => { console.error(...) })`  
  **Precondición**: Job marcado como failed.  
  **Postcondición**: Mensaje de log con el error.

### Cierre limpio
**Manejador SIGINT**
```js
process.on('SIGINT', async () => {
  console.log('Cerrando worker...');
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
});
```
**Precondición**
- Señal SIGINT recibida (Ctrl+C o similar).

**Postcondición**
- Worker cerrado de forma ordenada.
- Conexión Prisma desconectada.
- Proceso finaliza con código 0.

**Notas**
- Asegura que no queden conexiones abiertas ni jobs en estado inconsistente.

---

## Recomendaciones y buenas prácticas
- **Variables de entorno**: Validar y documentar `REDIS_URL`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET`, `PRESIGNED_EXPIRES`, `WORKER_CONCURRENCY`, `BATCH_SIZE`.
- **Retries y timeouts**: Considerar políticas de reintento en BullMQ y timeouts para operaciones S3/DB.
- **Monitoreo**: Registrar métricas de tiempo de generación, tamaño del archivo y uso de memoria.
- **Seguridad**: No exponer `downloadUrl` indefinidamente; `PRESIGNED_EXPIRES` controla expiración.
- **Transacciones DB**: Si la consistencia entre S3 y DB es crítica, diseñar un mecanismo de reconciliación (por ejemplo, marcar reportes pendientes y reintentar upsert).
- **Validación de datos**: Validar `filter` recibido en `job.data` para evitar consultas inesperadas o costosas.

---

## Resumen rápido de precondiciones y postcondiciones por función
- **uploadStreamToS3**
  - **Pre**: `s3Client` y `BUCKET` válidos; `stream` readable.
  - **Post**: Archivo subido a S3 o error rechazado.

- **paginateKpiSnapshots**
  - **Pre**: `prisma` accesible; `batchSize` válido.
  - **Post**: Produce filas paginadas hasta agotar resultados.

- **processor**
  - **Pre**: Job válido; acceso a DB y S3; `paginateKpiSnapshots` funcional.
  - **Post**: XLSX en S3, URL prefirmada generada, metadata intentada en DB; job completado o marcado como failed con persistencia del error.

- **Worker y handlers**
  - **Pre**: Redis accesible; `processor` registrado.
  - **Post**: Worker procesando jobs; logs en completed/failed; cierre ordenado en SIGINT.