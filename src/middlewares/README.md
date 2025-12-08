<!-- @format -->

# Middlewares

## ¿Qué es esto?

Funciones que se ejecutan **antes** de que la petición llegue al controlador. Sirven para interceptar, validar o modificar la petición.

## Usos Comunes

-   Autenticación (verificar tokens).
-   Logging (registrar peticiones).
-   Manejo de errores.
-   Validación previa.

## ⚠️ Reglas de Oro (Do's and Don'ts)

-   ✅ **SÍ**: Siempre llamar a `next()` si todo está bien, o responder con `res.json(...)` si hay error.
-   ❌ **NO**: Olvidar el `next()`, la petición se quedará "colgada" infinitamente.

## Convención de Nombres

`[nombre].middleware.js`
Ejemplo: `auth.middleware.js`, `logger.middleware.js`

## Plantilla (Snippet)

```javascript
export const myMiddleware = (req, res, next) => {
	// Lógica del middleware
	const token = req.headers.authorization;

	if (!token) {
		return res.status(401).json({ error: 'No autorizado' });
	}

	// Si todo está bien, continuamos
	next();
};
```
