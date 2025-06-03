import { PrismaClient } from '@prisma/client';

// It's good practice to log database interactions or errors,
// especially in development.
// You can also add options for logging:
// const prisma = new PrismaClient({ log: ['query', 'info', 'warn', 'error'] });
const prisma = new PrismaClient();

// No explicit connect() needed for Prisma Client in typical scenarios.
// It connects lazily on the first query.

export default prisma;
