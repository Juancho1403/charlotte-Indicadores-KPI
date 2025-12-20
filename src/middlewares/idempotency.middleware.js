import { connection } from '../config/queue.js'; // Importamos la conexión a Redis

export const idempotencyMiddleware = async (req, res, next) => {
  //  Busca la clave en las cabeceras
  const key = req.headers['idempotency-key'];

  //  Si no hay clave, dejamos pasar (llama next)
  if (!key) {
    return next();
  }

  const redisKey = `idempotency:${key}`;

  try {
    //  Pregunta a Redis si ya existe
    const exists = await connection.get(redisKey);

    if (exists) {
      // Si existe, respondemos con error (evitamos duplicados)
      return res.status(409).json({
        success: false,
        message: "Esta operación ya fue procesada (Idempotency Key duplicada)."
      });
    }

    //  Si no existe, la guardamos por 60 segundos
    await connection.set(redisKey, 'processing', 'EX', 60);

    // 6. Todo bien, continuamos (llamar a next)
    next();

  } catch (error) {
    console.error("Error en Idempotency Middleware:", error);
    // En caso de error de conexión, dejamos pasar por seguridad
    next();
  }
};