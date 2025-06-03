import { PrismaClient } from '@prisma/client';

// Initialize Prisma Client
const prisma = new PrismaClient({
  // Optional: configure logging for development
  // log: ['query', 'info', 'warn', 'error'],
});

// No explicit connect() needed for Prisma Client in typical scenarios.
// It connects lazily on the first query.

export default prisma;
