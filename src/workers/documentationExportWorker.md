# Resumen

Descripción general del archivo: este módulo crea y ejecuta un **Worker** de BullMQ** que procesa jobs de exportación de KPIs**, registra auditoría en la base de datos mediante **Prisma**, y mantiene trazabilidad del job actualizando su progreso en Redis. También gestiona el cierre ordenado del worker ante señales del sistema.

---

## Importaciones y recursos globales

- **`Worker`, `Queue`** desde `bullmq` — componentes para consumir y manipular la cola.
- **`IORedis`** — cliente Redis para la conexión compartida.
- **`PrismaClient`** desde `@prisma/client` — cliente para acceder a la base de datos.
- **Instancias creadas**
  - `prisma` — instancia de PrismaClient.
  - `connection` — instancia de IORedis con configuración desde variables de entorno.
  - `queue` — instancia de Queue apuntando a `QUEUE_NAME`.

**Precondición global**  
- Variables de entorno necesarias (ver sección Variables de entorno) disponibles y Redis accesible.

**Postcondición global**  
- Objetos `prisma`, `connection` y `queue` inicializados y listos para uso por el worker.

---

## Variables de entorno

| **Variable** | **Descripción** | **Valor por defecto** |
|---|---:|---|
| **REDIS_HOST** | Host de Redis | `127.0.0.1` |
| **REDIS_PORT** | Puerto de Redis | `6379` |
| **REDIS_PASSWORD** | Contraseña de Redis | `undefined` |
| **QUEUE_NAME** | Nombre de la cola a escuchar | `kpi-export-queue` |
| **WORKER_CONCURRENCY** | Concurrency del worker | `1` |

---

## Worker principal (callback de procesamiento de jobs)

### Firma
```js
async (job) => { ... }
```

### Propósito
Procesar cada job entrante: validar datos, crear un registro de auditoría en la tabla `kpi_auditoria_export` y actualizar el progreso del job con el `idExport` creado.

### Flujo resumido
1. Extrae `job.data`.
2. Valida `usuarioId`.
3. Normaliza `ip`, `filters` y `format`.
4. Inserta un registro en `kpi_auditoria_export` con `codigoEstado = 0` (pending).
5. Intenta actualizar el progreso del job en Redis con `{ idExport }`.
6. Retorna `{ idExport }` como resultado del job.

### Precondición
- `job.data` debe existir y contener **`usuarioId`** convertible a número distinto de 0.
- Conexión válida a la base de datos (Prisma) y a Redis.
- La tabla `kpi_auditoria_export` debe existir y aceptar los campos usados.

### Postcondición
- Se crea un registro en `kpi_auditoria_export` con `codigoEstado = 0`.
- Si la actualización de progreso en Redis tiene éxito, el job en BullMQ contiene `progress` con `{ idExport }`.
- El job finaliza con valor de retorno `{ idExport }` (queda en el historial del job).

### Efectos secundarios
- Inserción en la base de datos.
- Escritura de progreso en Redis (si `queue.getJob(job.id)` y `updateProgress` funcionan).
- Posible logging de advertencia si falla la actualización de progreso.

### Errores y excepciones
- Lanza `Error('usuarioId inválido en job.data')` si `usuarioId` es inválido.
- Cualquier error de Prisma (p. ej. constraints, conexión) hará que el job falle y se propague la excepción a BullMQ.
- Fallos en `queuedJob.updateProgress` se capturan y no detienen el flujo (se registra `console.warn`).

### Valor de retorno
- Objeto `{ idExport: number }` con el identificador del registro creado.

---

## Manejadores de eventos del worker

### Evento `completed`
```js
worker.on('completed', (job) => { ... });
```

**Descripción**  
Registra en consola que el job se completó, mostrando `job.id` y `job.returnvalue`.

**Precondición**  
- El job ha terminado exitosamente y `job.returnvalue` está disponible.

**Postcondición**  
- Mensaje de log con información del job completado.

**Efectos secundarios**  
- Ninguno en la base de datos; solo logging.

---

### Evento `failed`
```js
worker.on('failed', (job, err) => { ... });
```

**Descripción**  
Registra en consola el fallo del job con `job.id` y el mensaje de error.

**Precondición**  
- El job ha lanzado una excepción durante su procesamiento.

**Postcondición**  
- Mensaje de error en consola con detalles del fallo.

**Efectos secundarios**  
- Ninguno adicional; BullMQ maneja reintentos/estado según configuración externa.

---

### Evento `error`
```js
worker.on('error', (err) => { ... });
```

**Descripción**  
Captura errores del worker (p. ej. problemas de conexión) y los registra.

**Precondición**  
- Ocurre un error a nivel del worker (no necesariamente ligado a un job concreto).

**Postcondición**  
- Mensaje de error en consola.

---

## Función `shutdown`

### Firma
```js
const shutdown = async () => { ... };
```

### Propósito
Cerrar ordenadamente el worker, la cola, la conexión de Prisma y la conexión Redis, y terminar el proceso.

### Flujo resumido
1. Log de inicio de cierre.
2. `await worker.close()`.
3. `await queue.close()`.
4. `await prisma.$disconnect()`.
5. `await connection.quit()`.
6. En caso de error, registra el error.
7. Llama a `process.exit(0)` en `finally`.

### Precondición
- El proceso está corriendo y las instancias `worker`, `queue`, `prisma` y `connection` están inicializadas.

### Postcondición
- Worker y queue cerrados.
- Conexión Prisma desconectada.
- Conexión Redis cerrada.
- Proceso finalizado con código 0.

### Efectos secundarios
- Termina el proceso Node.js.
- Si alguna promesa falla, el error se registra pero el `finally` asegura `process.exit(0)`.

### Errores y consideraciones
- Si `worker.close()` o `queue.close()` tardan o fallan, el catch registra el error; aún así el proceso termina.
- Llamar `process.exit(0)` fuerza la terminación; si se desea un shutdown más suave (esperar jobs en curso), habría que ajustar la lógica para esperar a que los jobs activos finalicen.

---

## Manejo de señales del sistema

- `process.on('SIGINT', shutdown);`
- `process.on('SIGTERM', shutdown);`

**Descripción**  
Al recibir `SIGINT` o `SIGTERM` se invoca `shutdown` para cerrar recursos.

**Precondición**  
- El proceso recibe la señal del sistema.

**Postcondición**  
- Se ejecuta el flujo de `shutdown` y el proceso termina.

---

## Mensajes en consola al iniciar

```js
console.log(`Worker escuchando cola "${QUEUE_NAME}" (concurrency=${worker.opts.concurrency})`);
```

**Propósito**  
Informar en logs que el worker está activo y la concurrencia configurada.