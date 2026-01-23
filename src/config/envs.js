import 'dotenv/config'; // Carga las variables del archivo .env

export const envs = {
    // --- Configuración Base ---
    PORT: process.env.PORT || 3000,
    DATABASE_URL: process.env.DATABASE_URL,

    // --- Redis (Lo que ya tenías) ---
    REDIS_HOST: process.env.REDIS_HOST || 'localhost',
    REDIS_PORT: process.env.REDIS_PORT || 6379,

    // --- AWS S3 (NUEVO - Requerido para Tarea 5.5) ---
    // Estas variables las leerá el Worker para subir los archivos
    AWS_ACCESS_KEY: process.env.AWS_ACCESS_KEY,
    AWS_SECRET_KEY: process.env.AWS_SECRET_KEY,
    AWS_BUCKET_NAME: process.env.AWS_BUCKET_NAME,
    AWS_REGION: process.env.AWS_REGION || 'us-east-1',
    // --- Servicios externos ---
    AT_CLIENT_BASE_URL: process.env.AT_CLIENT_BASE_URL || 'https://charlotte-atencion-cliente.onrender.com/api/v1/atencion-cliente',
    KDS_BASE_URL: process.env.KDS_BASE_URL || 'https://charlotte-cocina.onrender.com', // Base para Cocina e Inventario
    DELIVERY_BASE_URL: process.env.DELIVERY_BASE_URL || 'https://delivery-pickup.onrender.com/api/dp/v1',
    INVENTORY_BASE_URL: process.env.INVENTORY_BASE_URL || 'https://charlotte-cocina.onrender.com/inventory', // Asumiendo que inventario vive en cocina o tiene ruta propia, ajustaremos si falla
    // Mock switch: si se establece a 'true' usará consumidores mock locales
    USE_MOCK_SERVICES: String(process.env.USE_MOCK_SERVICES || '').toLowerCase() === 'true'
};
