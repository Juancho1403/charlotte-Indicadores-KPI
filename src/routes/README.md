<!-- @format -->

# Routes (Rutas)

## ¿Qué es esto?

Definen los **endpoints** (URLs) de la API y conectan las peticiones HTTP con los controladores correspondientes.

## Responsabilidades

1.  Definir los métodos HTTP (GET, POST, PUT, DELETE).
2.  Asignar la URL (ej: `/users/:id`).
3.  Inyectar **Middlewares** específicos para esa ruta (ej: autenticación).
4.  Llamar a la función del controlador.

## ⚠️ Reglas de Oro (Do's and Don'ts)

-   ✅ **SÍ**: Usar `express.Router()`.
-   ❌ **NO**: Escribir lógica aquí. Solo definiciones de ruta.
-   ❌ **NO**: Definir funciones anónimas largas `(req, res) => { ... }`. Usa controladores.

## Convención de Nombres

`[entidad].routes.js`
Ejemplo: `users.routes.js`

## Plantilla (Snippet)

```javascript
import { Router } from 'express';
import * as exampleController from '../../controllers/example/example.controller.js';
// import { authMiddleware } from '../../middlewares/auth.middleware.js';

const router = Router();

// Rutas públicas
router.get('/', exampleController.getExamples);

// Rutas protegidas (ejemplo)
// router.post('/', authMiddleware, exampleController.createExample);
router.post('/', exampleController.createExample);

export default router;
```
