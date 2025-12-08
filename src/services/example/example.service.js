import { prisma } from '../../db/client.js';

export const getAllUsers = async () => {
    return await prisma.user.findMany();
};

export const createUser = async (data) => {
    return await prisma.user.create({
        data,
    });
};
