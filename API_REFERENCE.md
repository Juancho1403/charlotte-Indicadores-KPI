# 📚 Referencia de API para Integración Frontend

Esta guía conecta las pantallas del diseño de Charlotte con los endpoints del Backend.

**Base URL:** `http://localhost:3000/api/v1/kpi`

---

## 1. 📊 Dashboard (Pantalla Principal)

**Objetivo:** Mostrar métricas en tiempo real para gerentes.

| Componente UI                                        | Endpoint                   | Método | Parámetros Clave                                      |
| :--------------------------------------------------- | :------------------------- | :----- | :---------------------------------------------------- |
| **Tarjetas Superiores**<br>(Ingresos, Meta, Tiempos) | `/dashboard/summary`       | `GET`  | `store_id=1`<br>`date=YYYY-MM-DD`                     |
| **Gráfico de Ventas**<br>(Curva de ventas por hora)  | `/dashboard/summary/range` | `GET`  | `granularity=DAY`<br>`date_from=...`<br>`date_to=...` |
| **Meta Trimestral**                                  | `/dashboard/summary`       | `GET`  | (Viene dentro del objeto `quarterly_goal`)            |

---

## 2. 👷 Operaciones y Personal

**Objetivo:** Monitorear rendimiento del equipo y tiempos de servicio.

| Componente UI                                        | Endpoint                        | Método | Parámetros Clave                        |
| :--------------------------------------------------- | :------------------------------ | :----- | :-------------------------------------- |
| **Semáforo de Servicio**<br>(Órdenes Rápidas/Lentas) | `/operations/sla-breakdown`     | `GET`  | -                                       |
| **Ranking de Personal**<br>(Tabla de empleados)      | `/operations/staff-ranking`     | `GET`  | `sort_by=EFFICIENCY`<br>`shift=MORNING` |
| **Métricas Individuales**<br>(Detalle por mesero)    | `/operations/staff-metrics/:id` | `GET`  | `date_from=...`                         |

---

## 3. 📦 Inventario Inteligente

**Objetivo:** Alertas de stock y productos top.

| Componente UI                                   | Endpoint            | Método | Parámetros Clave                     |
| :---------------------------------------------- | :------------------ | :----- | :----------------------------------- |
| **Top 5 Platos**<br>(Pareto Chart)              | `/inventory/pareto` | `GET`  | `limit=5`                            |
| **Alertas de Stock**<br>(Lista lateral derecha) | `/inventory/alerts` | `GET`  | `severity=WARNING`<br>(o `CRITICAL`) |

---

## 4. 📄 Reportes y Exportación

**Objetivo:** Generar archivos históricos (CSV/Excel).

| Acción UI                                          | Endpoint                | Método | Cuerpo (JSON)                                    |
| :------------------------------------------------- | :---------------------- | :----- | :----------------------------------------------- |
| **Botón "Generar Reporte"**                        | `/reports/export`       | `POST` | `{"report_type": "SALES", "format": "CSV", ...}` |
| **Verificar Estado**<br>(Polling / Barra de carga) | `/reports/jobs/:job_id` | `GET`  | (Usar el ID devuelto por el POST anterior)       |

---

## 5. ⚙️ Configuración

**Objetivo:** Ajustar metas y reglas del sistema.

| Componente UI        | Endpoint                            | Método  | Ejemplo JSON              |
| :------------------- | :---------------------------------- | :------ | :------------------------ |
| **Actualizar Metas** | `/configuration/goals/:id`          | `PATCH` | `{"target_amount": 5000}` |
| **Ajustar Umbrales** | `/configuration/thresholds/:metric` | `PUT`   | `{"value_warning": 10}`   |

---

### 🧪 ¿Cómo probar rápido?

Usa el archivo `kpi_collection.json` incluido en este proyecto. Impórtalo en **Postman** y tendrás todas estas peticiones pre-configuradas y listas para ejecutar.
