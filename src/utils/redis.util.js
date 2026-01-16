import IORedis from 'ioredis';

/**
 * Intenta conectar a Redis y devuelve la instancia conectada.
 * Si Redis no responde rápido (timeout) devuelve null y cierra la conexión.
 */
export async function connectRedisIfAvailable(redisUrl, options = {}, timeoutMs = 1000) {
  const client = new IORedis(redisUrl, options);

  return await new Promise((resolve) => {
    let settled = false;
    const onReady = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      // limpiar listeners
      client.off('error', onError);
      resolve(client);
    };

    const onError = async () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      client.off('ready', onReady);
      try { await client.quit(); } catch (e) { /* ignore */ }
      resolve(null);
    };

    const timer = setTimeout(async () => {
      if (settled) return;
      settled = true;
      client.off('ready', onReady);
      client.off('error', onError);
      try { await client.quit(); } catch (e) { /* ignore */ }
      resolve(null);
    }, timeoutMs);

    client.once('ready', onReady);
    client.once('error', onError);
  });
}
