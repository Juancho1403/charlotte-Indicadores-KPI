import { z } from 'zod';

export const createUserSchema = z.object({
    email: z.string().email({ message: "Email inválido" }),
    name: z.string().min(2, { message: "El nombre debe tener al menos 2 caracteres" }).optional(),
});
