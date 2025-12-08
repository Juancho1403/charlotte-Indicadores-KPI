<!-- @format -->

# Config (Configuración)

## ¿Qué es esto?

Aquí centralizamos la configuración de la aplicación y las variables de entorno.

## Responsabilidades

1.  Leer `process.env`.
2.  Validar que las variables requeridas existan.
3.  Exportar constantes para usar en toda la app.

## ⚠️ Reglas de Oro (Do's and Don'ts)

-   ✅ **SÍ**: Usar este módulo en lugar de `process.env.VARIABLE` disperso por el código.
-   ❌ **NO**: Guardar secretos (passwords, keys) directamente en el código. Usa variables de entorno.

## Convención de Nombres

`envs.js` o `[modulo].config.js`

## Plantilla (Snippet)

```javascript
export const envs = {
	PORT: process.env.PORT || 3000,
	DB_HOST: process.env.DB_HOST,
	API_KEY: process.env.API_KEY,
};
```
