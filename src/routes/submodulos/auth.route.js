import { Router } from 'express';

const router = Router();

/**
 * @swagger
 * /api/v1/kpi/auth/login:
 *   post:
 *     summary: Iniciar sesión (Módulo de Seguridad)
 *     tags: [Auth]
 *     description: Obtiene el token JWT necesario para las rutas protegidas.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "usuario.p11@charlotte.com"
 *               password:
 *                 type: string
 *                 example: "SuperSeguraPassword"
 *     responses:
 *       200:
 *         description: Login exitoso, retorna el token JWT.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 token: { type: string, example: "eyJhbGciOiJIUzI1Ni..." }
 *       401:
 *         description: Credenciales inválidas.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/login', (req, res) => {
    // Simulación de login para documentación
    res.json({ token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." });
});

export default router;
