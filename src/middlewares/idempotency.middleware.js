import { connection } from '../config/queue.js'; // Importamos la conexión existente

export const idempotencyMiddleware = async (req, res, next) => {
  //  Busca la clave en las cabeceras
  const key = req.headers['idempotency-key'];

  //  Si no hay clave, dejamos pasar (no es obligatorio para todos los endpoints)
  if (!key) {
    return next();
  }

  const redisKey = `idempotency:${key}`;

  try {
    //  Pregunta a Redis si ya existe
    const cachedJobId = await connection.get(redisKey);

    if (cachedJobId) {
      // REQUISITO 5.6: No devolvemos error, sino el JobID original
      console.log(`[Idempotencia] Devolviendo JobID existente: ${cachedJobId}`);
      return res.status(200).json({
        success: true,
        message: "Esta operación ya está en proceso.",
        jobId: cachedJobId, // <--- CUMPLO CON EL REQUISITO AQUÍ
        status: 'DUPLICATE_IGNORED'
      });
    }

    //  Inyectamos una función helper en el request.
    // Esto permite que el Controller guarde el JobID *después* de crearlo exitosamente.
    req.saveIdempotencyKey = async (jobId) => {
      // Guardamos el JobID por 5 minutos (300s) para reportes pesados
      await connection.set(redisKey, jobId, 'EX', 300);
    };

    next();

  } catch (error) {
    console.error("Error en Idempotency Middleware:", error);
    // En caso de error de Redis, dejamos pasar la petición para no bloquear al usuario (Fail-open)
    next();
  }
};