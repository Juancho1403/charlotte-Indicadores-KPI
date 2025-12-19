export const envs = {
    PORT: process.env.PORT || 3000,
    DATABASE_URL: process.env.DATABASE_URL,

    // --- AGREGAMOS ESTO PARA REDIS ---
    REDIS_HOST: process.env.REDIS_HOST || 'localhost',
    REDIS_PORT: process.env.REDIS_PORT || 6379,
};