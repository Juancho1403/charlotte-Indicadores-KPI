### Resumen
Archivo de servicio para la gestión de configuración de métricas y umbrales. Contiene la implementación de la función principal **updateThreshold** junto con placeholders para otras operaciones. Está pensado para usarse desde un controller Express y persiste cambios en la base de datos mediante Prisma.

---

### Exportaciones principales
- **updateThreshold** — función asíncrona que valida y persiste un cambio de umbral en la tabla kpiThresholdsHistorial.  
- **updateGoal** — placeholder que devuelve un objeto de éxito.  
- **currentRules** — placeholder que devuelve un objeto de éxito.  
- **export default** — objeto que expone updateThreshold.

---

### Constantes y dependencias
- **ALLOWED_METRICS**: lista de métricas permitidas  
  `['tiempo', 'rotacion', 'stock', 'ventas']`  
- **Dependencia**: PrismaClient de @prisma/client. Se instancia `prisma = new PrismaClient()` y se usa para operaciones de persistencia.

---

### updateThreshold

#### Firma
```js
export async function updateThreshold(metricKey, payload, user = null)
```

#### Descripción
Valida la clave de métrica y el payload, y crea un registro histórico de umbrales en la tabla kpiThresholdsHistorial usando Prisma. Devuelve el registro creado o lanza errores con la propiedad status para que el controller los mapee a respuestas HTTP.

#### Precondición
- **metricKey** debe ser una cadena no vacía. Se normaliza con trim y toLowerCase.  
- **metricKey** debe estar en la lista ALLOWED_METRICS.  
- **payload** debe ser un objeto con propiedades numéricas **value_warning** y **value_critical**.  
- **value_warning** debe ser estrictamente menor que **value_critical**.  
- Prisma debe estar configurado correctamente y la tabla kpiThresholdsHistorial debe existir y aceptar los campos usados.

#### Postcondición
- Se inserta un nuevo registro en kpiThresholdsHistorial con los campos:
  - **tipoMetrica** igual a metricKey normalizado.  
  - **valorAlerta** igual a Math.trunc de value_warning.  
  - **valorCritico** igual a Math.trunc de value_critical.  
  - **fechaCambio** con la fecha y hora actual.  
- La función devuelve el objeto creado por Prisma.  
- Si ocurre una validación o error de persistencia, la función lanza un Error con la propiedad status adecuada.

#### Parámetros
- **metricKey** string clave de la métrica, por ejemplo ventas.  
- **payload** object con la forma `{ value_warning, value_critical }` donde ambos son números.  
- **user** object o null opcional, actualmente no utilizado pero reservado para auditoría futura.

#### Valor devuelto
- `Promise<object>` registro creado en kpiThresholdsHistorial devuelto por Prisma.

#### Errores y códigos de estado
La función lanza errores con la propiedad status para que el controller los traduzca a respuestas HTTP:

- **400 Bad Request**
  - metric_key es requerido cuando metricKey está vacío.  
  - metric_key inválido con la lista de valores permitidos cuando metricKey no está en ALLOWED_METRICS.  
  - Payload inválido cuando value_warning o value_critical no son numéricos.  
  - Rango inválido cuando value_warning no es menor que value_critical.  

- **500 Internal Server Error**
  - Error al guardar el historial de umbrales cuando falla la operación de persistencia. El error original se adjunta en la propiedad cause del Error lanzado.

#### Mapeo a la base de datos
La inserción se realiza con:
```js
prisma.kpiThresholdsHistorial.create({
  data: {
    tipoMetrica: key,
    valorAlerta: Math.trunc(payload.value_warning),
    valorCritico: Math.trunc(payload.value_critical),
    fechaCambio: new Date(),
    // user: null
  },
});
```
**Campos persistidos**
- tipoMetrica string  
- valorAlerta integer  
- valorCritico integer  
- fechaCambio timestamp

---

### Pruebas sugeridas
- Tests unitarios para validar:
  - Rechazo cuando metricKey es vacío.  
  - Rechazo cuando metricKey no está permitido.  
  - Rechazo cuando payload no tiene números.  
  - Rechazo cuando value_warning es mayor o igual que value_critical.  
  - Inserción exitosa con mock de Prisma.  
  - Manejo de errores de persistencia simulando fallo de Prisma.