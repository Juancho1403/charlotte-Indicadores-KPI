import { Router } from 'express';
import * as exampleController from '../../controllers/example/example.controller.js';
import { requestLogger } from '../../middlewares/example/example.middleware.js';

const router = Router();

// Aplicar middleware a todas las rutas de este router
router.use(requestLogger);

router.get('/', exampleController.getUsers);
router.post('/', exampleController.createUser);

export default router;
