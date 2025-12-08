<!-- @format -->

# Utils (Utilidades)

## ¿Qué es esto?

Funciones auxiliares genéricas que se usan en varias partes de la aplicación.

## Ejemplos

-   Formateadores de fecha.
-   Generadores de IDs aleatorios.
-   Funciones matemáticas complejas.
-   Parsers de archivos.

## ⚠️ Reglas de Oro (Do's and Don'ts)

-   ✅ **SÍ**: Funciones puras (misma entrada -> misma salida).
-   ❌ **NO**: Lógica de negocio específica (eso va en services).
-   ❌ **NO**: Acceso a base de datos (eso va en services).

## Convención de Nombres

`[nombre].util.js`
Ejemplo: `date.util.js`, `string.util.js`

## Plantilla (Snippet)

```javascript
/**
 * Descripción de lo que hace la función.
 * @param {string} input
 * @returns {string}
 */
export const myHelper = (input) => {
	return input.toUpperCase();
};
```
