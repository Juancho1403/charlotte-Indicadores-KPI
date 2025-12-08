<!-- @format -->

# Schemas (Esquemas de Validación)

## ¿Qué es esto?

Definiciones estrictas de cómo deben ser los datos que recibimos. Usamos la librería **Zod** para esto.

## Responsabilidades

1.  Definir tipos de datos (string, number, boolean).
2.  Definir reglas (min, max, email, optional).
3.  Proveer mensajes de error personalizados.

## ⚠️ Reglas de Oro (Do's and Don'ts)

-   ✅ **SÍ**: Validar TODO lo que venga del usuario (`req.body`).
-   ✅ **SÍ**: Reutilizar esquemas si es posible.

## Convención de Nombres

`[entidad].schema.js`
Ejemplo: `user.schema.js`

## Plantilla (Snippet)

```javascript
import { z } from 'zod';

export const createExampleSchema = z.object({
	email: z.string().email({ message: 'Email inválido' }),
	age: z.number().min(18, { message: 'Debe ser mayor de edad' }),
	isActive: z.boolean().optional(),
});
```
