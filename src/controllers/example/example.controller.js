import * as exampleService from '../../services/example/example.service.js';
import { createUserSchema } from '../../schemas/example/example.schema.js';

export const getUsers = async (req, res) => {
  try {
    const users = await exampleService.getAllUsers();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createUser = async (req, res) => {
  try {
    // Validación con Zod
    const validation = createUserSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({ errors: validation.error.format() });
    }

    const newUser = await exampleService.createUser(validation.data);
    res.status(201).json(newUser);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
