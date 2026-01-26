# Resumen de Integración con Módulos Externos

## Fecha: 26 de Enero, 2026

Este documento resume los cambios realizados para consumir los endpoints necesarios de los módulos:
- **Cocina (KDS)**
- **Atención al Cliente (ATC)**
- **Delivery/Pickup (DP)**

## Cambios Realizados

### 1. Expansión de `externalConsumers.js`

Se expandió el archivo de consumidores externos para incluir todos los endpoints necesarios según la documentación de la API v3.0:

#### Módulo Atención al Cliente (ATC):
- `fetchComandas()` - Obtener comandas
- `fetchComandaById()` - Obtener comanda por ID
- `fetchMesas()` - Obtener mesas
- `fetchSesiones()` - Obtener sesiones de clientes
- `fetchClienteTemporal()` - Obtener registros cliente_temporal (para cálculo de tiempo promedio)
- `fetchServiceRequests()` - Obtener solicitudes de servicio

#### Módulo Cocina (KDS):
- `fetchKdsQueue()` - Obtener cola de KDS
- `fetchKdsHistory()` - Obtener historial de KDS (comandas con estados READY/DELIVERED)
- `fetchKdsComandas()` - Obtener comandas de cocina con estados específicos
- `fetchRecetas()` - Obtener recetas
- `fetchInventoryConsumption()` - Obtener consumo de inventario
- `fetchStaff()` - Obtener personal/staff

#### Módulo Delivery/Pickup (DP):
- `fetchDeliveryOrders()` - Obtener órdenes de delivery/pickup
- `fetchDpNotes()` - Obtener dp_notes (notas de entrega) - usado para revenue calculation
- `fetchDpNoteById()` - Obtener una dp_note específica
- `fetchDpNoteItems()` - Obtener items de una dp_note específica
- `fetchAllDpNoteItems()` - Obtener todos los items de dp_notes en un rango (para análisis agregado)
- `fetchDpPayments()` - Obtener pagos de delivery/pickup

#### Módulo Inventario:
- `fetchInventoryItems()` - Obtener items de inventario
- `fetchProducts()` - Obtener productos

### 2. Actualización de `mockConsumers.js`

Se actualizó el archivo de consumidores mock para incluir datos de prueba completos para todas las nuevas funciones, permitiendo testing sin dependencias externas cuando `USE_MOCK_SERVICES=true`.

### 3. Actualización de `dashboard.service.js`

**Cambios principales:**
- Reemplazó llamadas directas con `fetch` por consumidores centralizados
- Implementa lógica de negocio según documentación:
  - **Revenue**: Suma `monto_total` de `dp_notes` (Delivery) y comandas cerradas, excluyendo CANCELLED
  - **Tiempo promedio de servicio**: Calcula desde `cliente_temporal` usando `AVG(closedAt - createdAt)`, excluyendo outliers > 240 min
  - **Rotación de mesas**: Fórmula `(clientes_unicos / mesas_activas) / horas_operativas`
  - **Quarterly Goal**: Lee de `kpi_metas` y calcula progreso

### 4. Actualización de `operations.service.js`

**Cambios principales:**
- `getStaffRanking()`: 
  - Usa `fetchStaff()` y `fetchKdsHistory()` para calcular métricas reales
  - Calcula `efficiency_score` basado en cantidad de órdenes vs tiempo promedio
  - Soporta filtrado por `shift` (MORNING/EVENING)
  - Soporta ordenamiento por `EFFICIENCY` o `VOLUME`

- `getSlaBreakdown()`:
  - Usa `fetchKdsHistory()` para obtener comandas con estados READY/DELIVERED
  - Calcula tiempo de servicio: `deliveredAt - sentAt`
  - Clasifica en buckets: Verde (< 5 min), Amarillo (5-10 min), Rojo (> 10 min)

### 5. Actualización de `inventory.service.js`

**Cambios principales:**
- `getPareto()`:
  - Usa `fetchAllDpNoteItems()` y `fetchComandas()` para obtener datos de ventas
  - Agrupa por `product_id` y normaliza nombres para evitar duplicados
  - Suma `quantity` y `subtotal` para calcular revenue y cantidad vendida
  - Marca el item #1 como `is_champion = true`

- `getStockAlerts()`:
  - Usa `fetchInventoryItems()` para obtener niveles de stock
  - Compara `current_level_pct` vs umbrales (WARNING: 20%, CRITICAL: 10%)
  - Filtra por `severity` (CRITICAL, WARNING, ALL)
  - Retorna alertas ordenadas por severidad

### 6. Actualización de `events.service.js`

**Cambios principales:**
- Expansión para manejar todos los tipos de eventos de los tres módulos:

**Eventos Cocina (KDS):**
- `comanda.created`, `comanda.sent`, `comanda.ready`, `comanda.delivered`
- `inventory.consumed`
- `recipe.used`

**Eventos ATC:**
- `comanda.created`, `comanda.updated`, `comanda.closed`
- `mesa.occupied`, `mesa.available`
- `sesion.started`, `sesion.ended`
- `service-request.created`, `service-request.resolved`
- `cliente_temporal.created`, `cliente_temporal.closed`

**Eventos Delivery/Pickup:**
- `note.created`, `note.paid` / `dp_note.created`, `dp_note.paid`
- `order.status_changed` / `dp_order.status_changed`
- `payment.completed`

- Implementa lógica de negocio:
  - Incrementa `totalPedidos` en snapshot cuando se crea comanda
  - Incrementa `totalVentas` cuando se paga nota o se cierra comanda
  - Excluye comandas/notas canceladas
  - Maneja reversión de ventas si se cancela un pedido

## Configuración

Las URLs base de los módulos se configuran en `src/config/envs.js`:

```javascript
// Atención al Cliente: https://charlotte-atencion-cliente.onrender.com/docs/#/
AT_CLIENT_BASE_URL: 'https://charlotte-atencion-cliente.onrender.com/api/v1/atencion-cliente'

// Cocina (KDS): https://charlotte-cocina.onrender.com/api-docs/#/
KDS_BASE_URL: 'https://charlotte-cocina.onrender.com/api/kitchen'

// Delivery/Pickup: https://delivery-pickup.onrender.com/docs/#/
DELIVERY_BASE_URL: 'https://delivery-pickup.onrender.com/api/dp/v1'

// Inventario está en el módulo de Cocina
INVENTORY_BASE_URL: 'https://charlotte-cocina.onrender.com/api/kitchen'
```

Para usar servicios mock (útil para desarrollo/testing):
```bash
USE_MOCK_SERVICES=true
```

## Endpoints Consumidos (Rutas Reales)

### Módulo Atención al Cliente:
**Base URL:** `https://charlotte-atencion-cliente.onrender.com/api/v1/atencion-cliente`
- `GET /tables` - Lista de mesas
- `GET /clients` - Clientes (cliente_temporal) - usado para cálculo de tiempo promedio
- `GET /clients/active` - Clientes activos (fantasmas)
- `GET /comandas` - Lista de comandas
- `GET /comandas/{id}` - Comanda específica
- `GET /service-requests` - Solicitudes de servicio

**Documentación:** https://charlotte-atencion-cliente.onrender.com/docs/#/

### Módulo Cocina (KDS):
**Base URL:** `https://charlotte-cocina.onrender.com/api/kitchen`
- `GET /staff` - Lista de personal de cocina
- `GET /staff/active` - Personal activo actualmente
- `GET /kds/queue` - Cola de tareas pendientes en cocina
- `GET /kds/history` - Historial de tareas KDS (con estados READY/DELIVERED)
- `GET /inventory/items` - Lista de ítems de inventario
- `GET /inventory/items/{id}/logs` - Logs de consumo de un item
- `GET /products` - Lista de productos
- `GET /products/{id}/recipe` - Receta de un producto específico

**Documentación:** https://charlotte-cocina.onrender.com/api-docs/#/

### Módulo Delivery/Pickup:
**Base URL:** `https://delivery-pickup.onrender.com/api/dp/v1`
- `GET /orders` - Listado general de órdenes (equivalente a dp_notes)
- `GET /orders/active` - Órdenes activas
- `GET /orders/status/{status}` - Órdenes por estado
- `GET /orders/{order_id}` - Detalle completo de una orden (incluye items y pagos)

**Nota:** En este módulo, las "dp_notes" se manejan como "orders". Los items vienen incluidos en el detalle de cada orden.

**Documentación:** https://delivery-pickup.onrender.com/docs/#/

### Módulo Inventario:
**Base URL:** `https://charlotte-cocina.onrender.com/api/kitchen` (mismo que Cocina)
- `GET /inventory/items` - Items de inventario
- `GET /products` - Productos

## Próximos Pasos Recomendados

1. **Implementar tabla de eventos procesados** para idempotencia completa en `events.service.js`
2. **Agregar caché Redis** para respuestas de consumidores externos (reducir latencia)
3. **Implementar WebSocket notifications** cuando aparezcan alertas críticas
4. **Agregar retry logic** con exponential backoff en consumidores externos
5. **Implementar circuit breaker pattern** para evitar cascading failures
6. **Agregar logging estructurado** para todas las llamadas a APIs externas
7. **Actualizar KpiAlertWorker.js** para usar consumidores centralizados (opcional)

## Notas

- Todos los consumidores soportan modo mock para desarrollo/testing
- Los servicios manejan errores gracefully y retornan datos por defecto cuando fallan las APIs externas
- La estructura de datos se normaliza para manejar diferentes formatos de respuesta de los módulos
