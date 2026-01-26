// External API endpoints configuration
export const API_ENDPOINTS = {
  // Atención al Cliente (ATC) endpoints
  ATC: {
    BASE_URL: process.env.ATC_API_URL || 'https://charlotte-atencion-cliente.onrender.com/api/v1/atencion-cliente',
    ENDPOINTS: {
      MESAS: '/tables',
      CLIENTES: '/clients',
      SERVICE_REQUESTS: '/service-requests',
    },
  },
  
  // Cocina endpoints
  KITCHEN: {
    // Nota: El usuario indicó /api/kitchen como servidor principal en el texto, pero la documentación a veces es inconsistente.
    // Ajustamos a lo que parece ser la convención de los otros módulos o lo que indicó explícitamente.
    // User doc: "/api/kitchen - Servidor principal"
    BASE_URL: process.env.KITCHEN_API_URL || 'https://charlotte-cocina.onrender.com/api/kitchen',
    ENDPOINTS: {
      KDS_QUEUE: '/kds/queue',
      KDS_HISTORY: '/kds/history',
      STAFF: '/staff',
      PRODUCTS: '/products',
      INVENTORY_ITEMS: '/inventory/items',
    },
  },
  
  // Delivery & Pickup endpoints
  DELIVERY: {
    BASE_URL: process.env.DELIVERY_API_URL || 'https://delivery.irissoftware.lat/api/dp/v1',
    ENDPOINTS: {
      ORDERS: '/orders',
      DASHBOARD: '/dashboard',
      THRESHOLDS: '/thresholds',
      ZONES: '/zones',
    },
  },
  
  // Authentication
  AUTH: {
    BASE_URL: process.env.AUTH_API_URL || 'https://charlotte-atencion-cliente.onrender.com/api/seguridad',
    ENDPOINTS: {
      LOGIN: '/auth/login',
    },
  },
};

export const CACHE_TTL = {
  SHORT: 60, // 1 minute
  MEDIUM: 300, // 5 minutes
  LONG: 3600, // 1 hour
};
