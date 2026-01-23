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
        url: `http://localhost:${envs.PORT}`,
        description: 'Servidor Local',
      },
      {
        url: 'https://charlotte-indicadores-kpi.onrender.com',
        description: 'Producción',
      }
    ],
    components: {
      securitySchemes: {
        // Si usas auth define aqui
      }
    }
  },
  apis: ['./src/routes/*.js', './src/routes/submodulos/*.js'], // Path a los archivos con anotaciones
};

const swaggerSpec = swaggerIds(options);

export default swaggerSpec;
