import swaggerIds from 'swagger-jsdoc';
import { envs } from './envs.js';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Charlotte KPI API',
      version: '1.0.0',
      description: 'API para el módulo de Indicadores y KPI de Charlotte',
      contact: {
        name: 'Soporte Charlotte',
      },
    },
    servers: [
      {
        url: 'https://charlotte-indicadores-kpi.onrender.com',
        description: 'Servidor Producción (Render)',
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        DashboardSummary: {
          type: 'object',
          properties: {
            revenue: {
              type: 'object',
              properties: {
                total: { type: 'number', example: 125000.50 },
                currency: { type: 'string', example: 'USD' },
                trend_percentage: { type: 'number', example: 12.5 },
                trend_direction: { type: 'string', example: 'UP' }
              }
            },
            quarterly_goal: {
              type: 'object',
              properties: {
                target: { type: 'number', example: 450000 },
                current: { type: 'number', example: 325000 },
                progress_percentage: { type: 'number', example: 72.2 },
                ui_status: { type: 'string', example: 'ON_TRACK' }
              }
            },
            operations: {
              type: 'object',
              properties: {
                avg_service_time: { type: 'string', example: '12 min' },
                time_status: { type: 'string', example: 'OPTIMAL' },
                table_rotation: { type: 'number', example: 1.8 }
              }
            }
          }
        },
        StaffMember: {
          type: 'object',
          properties: {
            waiter_id: { type: 'string', example: 'W-101' },
            name: { type: 'string', example: 'Juan Pérez' },
            total_orders: { type: 'integer', example: 45 },
            avg_time_minutes: { type: 'number', example: 12.5 },
            efficiency_score: { type: 'integer', example: 95 },
            current_status: { type: 'string', example: 'ACTIVE' }
          }
        },
        InventoryAlert: {
          type: 'object',
          properties: {
            item_name: { type: 'string', example: 'Charlotte Burger Bun' },
            current_level_pct: { type: 'number', example: 15 },
            severity: { type: 'string', example: 'CRITICAL' },
            action_required: { type: 'string', example: 'RESTOCK' }
          }
        },
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: { type: 'string', example: 'Mensaje detallado del error' }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./src/routes/*.js', './src/routes/submodulos/*.js'], // Path a los archivos con anotaciones
};

const swaggerSpec = swaggerIds(options);

export default swaggerSpec;
