/**
 * Controlador para Operaciones y Personal
 * Maneja métricas de eficiencia humana y velocidad de servicio.
 */

export const getStaffRanking = async (req, res) => {
    try {
        const { shift } = req.query;
        // Datos simulados
        // Retorna la lista de meseros ordenados por eficiencia o volumen de ventas
        const response = {
            success: true,
            data: [
                {
                    waiter_id: "W-001",
                    name: "Ana García",
                    avatar_url: "https://cdn.charlotte.com/avatars/ana.jpg",
                    shift: shift || "MORNING",
                    total_orders: 45,
                    avg_time_minutes: 3.8,
                    current_status: "ACTIVE"
                },
                {
                    waiter_id: "W-045",
                    name: "Luis Pérez",
                    total_orders: 22,
                    avg_time_minutes: 12.5,
                    current_status: "ACTIVE"
                }
            ]
        };
        res.status(200).json(response);
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error Interno del Servidor' });
    }
};

export const getSlaBreakdown = async (req, res) => {
    try {
        // Desglose porcentual para el gráfico de semáforo
        const response = {
            green_zone_percent: 85,
            yellow_zone_percent: 10,
            red_zone_percent: 5
        };
        res.status(200).json(response);
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error Interno del Servidor' });
    }
};

export const getPerformance = async (req, res) => {
    try {
        // Métricas de eficiencia operativa (Tiempos y Rotación)
        const response = {
            avg_service_time_minutes: 4.25,
            service_status: "GREEN",
            table_rotation_rate: 1.2,
            abandonment_rate: 3.5
        };
        res.status(200).json(response);
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error Interno del Servidor' });
    }
}
