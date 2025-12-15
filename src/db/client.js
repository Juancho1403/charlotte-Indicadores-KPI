import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const conectionString = process.env.DATABASE_URL;
const adapter = new PrismaPg({ connectionString: conectionString });
const globalForPrisma = global;
export const prisma = globalForPrisma.prisma || new PrismaClient({ adapter });
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;