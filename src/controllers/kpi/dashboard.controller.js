/**
 * Controlador para el Dashboard (Resumen Ejecutivo)
 * Este controlador maneja la lógica para obtener los datos principales del dashboard.
 */

export const getDashboardSummary = async (req, res) => {
  try {
    // Datos simulados basados en los requisitos
    // En una implementación real, estos datos vendrían de la base de datos
    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      data: {
        revenue: {
          total: 12450.00,
          currency: "USD",
          trend_percentage: 12.5,
          trend_direction: "UP"
        },
        quarterly_goal: {
          target: 450000.00,
          current: 292500.00,
          progress_percentage: 65.0,
          status: "ON_TRACK"
        },
        operations: {
          avg_service_time: "04:15",
          service_status: "OPTIMAL",
          table_rotation: 1.2,
          rotation_target: 1.7
        }
      }
    };

    res.status(200).json(response);
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error Interno del Servidor' });
  }
};
