<!-- @format -->

# Controllers (Controladores)

## ¿Qué es esto?

Los controladores son los encargados de **orquestar** la petición HTTP. Reciben la `request` (req), deciden qué hacer con ella y envían la `response` (res).

## Responsabilidades

1.  Recibir los datos de la petición (`req.body`, `req.params`, `req.query`).
2.  Validar los datos usando **Schemas** (Zod).
3.  Llamar a los **Services** para ejecutar la lógica de negocio.
4.  Manejar los errores y retornar el código HTTP adecuado (200, 400, 500, etc.).

## ⚠️ Reglas de Oro (Do's and Don'ts)

-   ✅ **SÍ**: Validar datos de entrada.
-   ✅ **SÍ**: Llamar a servicios.
-   ❌ **NO**: Escribir lógica de negocio compleja (cálculos, reglas de negocio). Eso va en `services`.
-   ❌ **NO**: Acceder directamente a la base de datos (Prisma). Eso va en `services`.

## Convención de Nombres

`[entidad].controller.js`
Ejemplo: `users.controller.js`, `auth.controller.js`

## Plantilla (Snippet)

```javascript
import * as exampleService from '../../services/example/example.service.js';
import { createExampleSchema } from '../../schemas/example/example.schema.js';

export const getExamples = async (req, res) => {
	try {
		const data = await exampleService.getAll();
		res.json(data);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

export const createExample = async (req, res) => {
	try {
		// 1. Validación
		const validation = createExampleSchema.safeParse(req.body);
		if (!validation.success) {
			return res.status(400).json({ errors: validation.error.format() });
		}

		// 2. Llamada al servicio
		const newItem = await exampleService.create(validation.data);

		// 3. Respuesta
		res.status(201).json(newItem);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};
```
