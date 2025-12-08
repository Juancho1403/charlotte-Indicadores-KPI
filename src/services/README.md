<!-- @format -->

# Services (Servicios)

## ¿Qué es esto?

Aquí reside la **Lógica de Negocio** y la interacción con la base de datos. Los servicios son funciones puras que reciben datos, los procesan y retornan resultados.

## Responsabilidades

1.  Interactuar con la base de datos usando **Prisma**.
2.  Aplicar reglas de negocio (ej: "Un usuario no puede tener más de 3 pedidos activos").
3.  Retornar datos limpios al controlador.

## ⚠️ Reglas de Oro (Do's and Don'ts)

-   ✅ **SÍ**: Usar `prisma` para consultas a la BD.
-   ❌ **NO**: Recibir `req` o `res` (objetos de Express). Los servicios no deben saber que están en una API web.
-   ❌ **NO**: Manejar códigos de estado HTTP (404, 200). Si algo falla, lanza un error (`throw new Error(...)`).

## Convención de Nombres

`[entidad].service.js`
Ejemplo: `users.service.js`, `orders.service.js`

## Plantilla (Snippet)

```javascript
import { prisma } from '../../db/client.js';

export const getAll = async () => {
	return await prisma.example.findMany();
};

export const create = async (data) => {
	// Lógica de negocio aquí (ej: verificar si ya existe)
	const exists = await prisma.example.findUnique({
		where: { email: data.email },
	});
	if (exists) {
		throw new Error('El registro ya existe');
	}

	return await prisma.example.create({
		data,
	});
};
```
