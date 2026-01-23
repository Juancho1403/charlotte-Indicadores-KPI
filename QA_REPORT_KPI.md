# REPORTE DE EJECUCIÓN DE PRUEBAS DE API (QA)

**Módulo:** Indicadores y KPI (Business Intelligence)  
**Herramienta:** Postman Collection Runner  
**Fecha de Ejecución:** 17 de Enero de 2026  
**Estado General:** Aprobado ✅

---

## 1. SUBMÓDULO: DASHBOARD (/dashboard)

### Prueba 1.1: Obtener Resumen Ejecutivo

| Campo                  | Detalle                                                                                                                                       |
| :--------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------- |
| **Número de Prueba**   | 1                                                                                                                                             |
| **Caso de Uso**        | Visualización principal para la toma de decisiones gerenciales.                                                                               |
| **Estrategia**         | Prueba de Integración / Cálculo de Métricas.                                                                                                  |
| **Descripción**        | Se analiza el endpoint `GET /dashboard/summary`. Verifica el cálculo de ingresos totales, progreso de meta trimestral y promedios operativos. |
| **Entradas**           | Query Params: `store_id=1`, `date=2025-01-17`                                                                                                 |
| **Resultado Esperado** | Código 200 OK. JSON con objetos `revenue`, `quarterly_goal` y `operations`. Tiempo de respuesta < 200ms.                                      |
| **Resultado**          | **Exitoso** ✅                                                                                                                                |
| **Observación**        | Los cálculos coinciden con los datos transaccionales. El campo `ui_status` se genera correctamente.                                           |

### Prueba 1.2: Obtener Gráfico de Ventas (Rango)

| Campo                  | Detalle                                                                                                    |
| :--------------------- | :--------------------------------------------------------------------------------------------------------- |
| **Número de Prueba**   | 2                                                                                                          |
| **Caso de Uso**        | Análisis de tendencias históricas.                                                                         |
| **Estrategia**         | Prueba de Estructura de Datos (Series Temporales).                                                         |
| **Descripción**        | Se analiza el endpoint `GET /dashboard/summary/range`. Valida la agrupación por granularidad (DÍA/SEMANA). |
| **Entradas**           | Query Params: `date_from=2025-01-01`, `date_to=2025-01-31`, `granularity=DAY`                              |
| **Resultado Esperado** | Código 200 OK. Array de datos `[ { label: "...", value: ... } ]` listo para graficar.                      |
| **Resultado**          | **Exitoso** ✅                                                                                             |
| **Observación**        | La granularidad es respetada y no hay huecos en las fechas.                                                |

---

## 2. SUBMÓDULO: OPERACIONES (/operations)

### Prueba 2.1: Ranking de Personal

| Campo                  | Detalle                                                                                                        |
| :--------------------- | :------------------------------------------------------------------------------------------------------------- |
| **Número de Prueba**   | 3                                                                                                              |
| **Caso de Uso**        | Evaluación de desempeño del staff.                                                                             |
| **Estrategia**         | Prueba de Ordenamiento y Filtrado.                                                                             |
| **Descripción**        | Se analiza `GET /operations/staff-ranking`. Verifica que el ordenamiento por `EFFICIENCY` u `ORDERS` funcione. |
| **Entradas**           | Query Params: `sort_by=EFFICIENCY`                                                                             |
| **Resultado Esperado** | Código 200 OK. Lista ordenada de meseros con su `efficiency_score`.                                            |
| **Resultado**          | **Exitoso** ✅                                                                                                 |
| **Observación**        | El score se calcula correctamente basado en tiempos de atención.                                               |

### Prueba 2.2: Desglose SLA (Semáforo)

| Campo                  | Detalle                                                                                                       |
| :--------------------- | :------------------------------------------------------------------------------------------------------------ |
| **Número de Prueba**   | 4                                                                                                             |
| **Caso de Uso**        | Monitoreo de velocidad de cocina en tiempo real.                                                              |
| **Estrategia**         | Prueba de Lógica de Negocio.                                                                                  |
| **Descripción**        | Se analiza `GET /operations/sla-breakdown`. Clasifica órdenes en Verde (<5m), Amarillo (5-10m) y Rojo (>10m). |
| **Entradas**           | Ninguna (Snapshot actual)                                                                                     |
| **Resultado Esperado** | Código 200 OK. Porcentajes que sumen 100% (aprox).                                                            |
| **Resultado**          | **Exitoso** ✅                                                                                                |
| **Observación**        | Refleja el estado actual de la cocina con precisión.                                                          |

---

## 3. SUBMÓDULO: INVENTARIO (/inventory)

### Prueba 3.1: Análisis Pareto (Top Productos)

| Campo                  | Detalle                                                                                              |
| :--------------------- | :--------------------------------------------------------------------------------------------------- |
| **Número de Prueba**   | 5                                                                                                    |
| **Caso de Uso**        | Identificación de productos estrella (Regla 80/20).                                                  |
| **Estrategia**         | Prueba de Agregación de Datos.                                                                       |
| **Descripción**        | Se analiza `GET /inventory/pareto`. Identifica los ítems que generan la mayor parte de los ingresos. |
| **Entradas**           | Query Params: `limit=5`                                                                              |
| **Resultado Esperado** | Código 200 OK. Lista de 5 productos con bandera `is_champion` para el #1.                            |
| **Resultado**          | **Exitoso** ✅                                                                                       |
| **Observación**        | Correcta identificación del producto más vendido.                                                    |

### Prueba 3.2: Alertas de Stock

| Campo                  | Detalle                                                                               |
| :--------------------- | :------------------------------------------------------------------------------------ |
| **Número de Prueba**   | 6                                                                                     |
| **Caso de Uso**        | Prevención de quiebres de stock.                                                      |
| **Estrategia**         | Prueba de Reglas de Umbral.                                                           |
| **Descripción**        | Se analiza `GET /inventory/alerts`. Filtra ingredientes por debajo del nivel crítico. |
| **Entradas**           | Query Params: `severity=WARNING`                                                      |
| **Resultado Esperado** | Código 200 OK. Solo retorna ítems con stock < umbral definido.                        |
| **Resultado**          | **Exitoso** ✅                                                                        |
| **Observación**        | Las alertas críticas coinciden con la configuración de umbrales.                      |

---

## 4. SUBMÓDULO: REPORTES (/reports)

### Prueba 4.1: Generar Exportación Asíncrona

| Campo                  | Detalle                                                                                                  |
| :--------------------- | :------------------------------------------------------------------------------------------------------- |
| **Número de Prueba**   | 7                                                                                                        |
| **Caso de Uso**        | Descarga de información histórica masiva.                                                                |
| **Estrategia**         | Prueba de Flujo Asíncrono (Job Queue).                                                                   |
| **Descripción**        | Se analiza `POST /reports/export`. Debe encolar la tarea y retornar un ID de seguimiento inmediatamente. |
| **Entradas**           | JSON: `{ "report_type": "SALES", "format": "CSV" ... }`                                                  |
| **Resultado Esperado** | Código 202 Accepted. `job_id` retornado.                                                                 |
| **Resultado**          | **Exitoso** ✅                                                                                           |
| **Observación**        | La respuesta es inmediata, no bloquea el servidor.                                                       |

### Prueba 4.2: Verificar Estado de Job

| Campo                  | Detalle                                                                  |
| :--------------------- | :----------------------------------------------------------------------- |
| **Número de Prueba**   | 8                                                                        |
| **Caso de Uso**        | Polling para descarga de archivo.                                        |
| **Estrategia**         | Prueba de Persistencia de Estado.                                        |
| **Descripción**        | Se consulta `GET /reports/jobs/:job_id` verificando el cambio de estado. |
| **Entradas**           | `job_id` generado en Prueba 4.1 (o seed test)                            |
| **Resultado Esperado** | Código 200 OK. Status `COMPLETED` y URL de descarga válida.              |
| **Resultado**          | **Exitoso** ✅                                                           |
| **Observación**        | Se verificó con dato de prueba `job-test-123`, obteniendo URL correcta.  |

---

## 5. SUBMÓDULO: CONFIGURACIÓN (/configuration)

### Prueba 5.1: Validar Parámetros de Configuración

| Campo                  | Detalle                                                                                |
| :--------------------- | :------------------------------------------------------------------------------------- |
| **Número de Prueba**   | 9                                                                                      |
| **Caso de Uso**        | Protección de integridad de datos.                                                     |
| **Estrategia**         | Prueba de Validación (Negative Testing).                                               |
| **Descripción**        | Se intenta enviar datos inválidos a `PUT /configuration/thresholds/:metric`.           |
| **Entradas**           | JSON: `{ "value_warning": 20, "value_critical": 5 }` (Incoherente: Warning > Critical) |
| **Resultado Esperado** | Código 400 Bad Request. Mensaje de error descriptivo (Zod).                            |
| **Resultado**          | **Exitoso** ✅                                                                         |
| **Observación**        | El esquema de validación impidió la configuración errónea.                             |
