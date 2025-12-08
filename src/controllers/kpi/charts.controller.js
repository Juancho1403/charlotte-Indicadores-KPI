/**
 * Controlador para Análisis Gráfico
 * Estos servicios devuelven estructuras de datos complejas para alimentar librerías gráficas.
 */

export const getSalesHourly = async (req, res) => {
    try {
        const { date } = req.query;
        // Devuelve los puntos X,Y para graficar la curva de demanda por hora.
        // Datos simulados
        const response = {
            success: true,
            data: [
                { hour: "08:00", sales: 120 },
                { hour: "09:00", sales: 340 },
                { hour: "10:00", sales: 560 },
                { hour: "11:00", sales: 890 },
                { hour: "12:00", sales: 1200 },
                { hour: "13:00", sales: 1500 },
                { hour: "14:00", sales: 1100 },
                { hour: "15:00", sales: 900 },
                { hour: "16:00", sales: 750 },
                { hour: "17:00", sales: 600 }
            ]
        };
        res.status(200).json(response);
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error Interno del Servidor' });
    }
};

export const getParetoProducts = async (req, res) => {
    try {
        const { limit } = req.query;
        // Devuelve la lista ordenada de productos más vendidos y su % de contribución.
        // Datos simulados
        const response = {
            success: true,
            data: [
                { product: "Charlotte Burger", contribution_percent: 15.5 },
                { product: "Pasta Alfredo", contribution_percent: 12.0 },
                { product: "Pizza Margarita", contribution_percent: 10.5 },
                { product: "Ensalada Cesar", contribution_percent: 8.0 },
                { product: "Limonada", contribution_percent: 5.0 }
            ]
        };
        res.status(200).json(response);
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error Interno del Servidor' });
    }
};
