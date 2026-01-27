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
    // Atención al Cliente: https://charlotte-atencion-cliente.onrender.com/docs/#/
    AT_CLIENT_BASE_URL: process.env.AT_CLIENT_BASE_URL || 'https://charlotte-atencion-cliente.onrender.com/api/v1/atencion-cliente',
    // Cocina (KDS): https://charlotte-cocina.onrender.com/api-docs/#/
    KDS_BASE_URL: process.env.KDS_BASE_URL || 'https://charlotte-cocina.onrender.com/api/kitchen',
    // Delivery/Pickup: https://delivery-pickup.onrender.com/docs/#/
    DELIVERY_BASE_URL: process.env.DELIVERY_BASE_URL || 'https://delivery.irissoftware.lat/api/dp/v1',
    // Inventario está en el módulo de Cocina
    INVENTORY_BASE_URL: process.env.INVENTORY_BASE_URL || 'https://charlotte-cocina.onrender.com/api/inventory',
    SECURITY_BASE_URL: process.env.SECURITY_BASE_URL || 'https://charlotte-seguridad.onrender.com',
    SECURITY_HAS_PERMISSION_PATH: process.env.SECURITY_BASE_URL || '/api/seguridad/auth/hasPermission',
    // Mock switch: si se establece a 'true' usará consumidores mock locales
    USE_MOCK_SERVICES: String(process.env.USE_MOCK_SERVICES || '').toLowerCase() === 'true'
};
