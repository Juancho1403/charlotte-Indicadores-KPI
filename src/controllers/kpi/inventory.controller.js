/**
 * Controlador para Inteligencia de Inventario
 * Análisis de productos y alertas de stock.
 */

export const getPareto = async (req, res) => {
    try {
        const { limit } = req.query;
        // Retorna los productos más vendidos para el gráfico de barras (Análisis de Pareto)
        const response = {
            success: true,
            data: [
                {
                    product_id: 101,
                    name: "Charlotte Burger",
                    revenue_generated: 1200.50,
                    is_top_performer: true // Frontend pinta barra Marrón
                },
                {
                    product_id: 205,
                    name: "Pasta Alfredo",
                    revenue_generated: 950.00,
                    is_top_performer: false // Frontend pinta barra Verde
                }
            ]
        };
        res.status(200).json(response);
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error Interno del Servidor' });
    }
};

export const getAlerts = async (req, res) => {
    try {
        // Lista priorizada de ítems con stock crítico
        const response = {
            critical_count: 2,
            alerts: [
                {
                    item_name: "Tomates Frescos",
                    current_stock_level: 10, // Porcentaje
                    unit: "Kg",
                    severity: "CRITICAL" // CRITICAL | WARNING
                }
            ]
        };
        res.status(200).json(response);
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error Interno del Servidor' });
    }
};
