import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../prismaClient';
// Use backendRedisClient, assuming it's configured for the same Redis instance as apps/ws
import { backendRedisClient as redisClient } from '../redisClient';

const router = Router();

interface AuthenticatedRequest extends Request {
    user?: {
        id: string;
        // other properties from deserializeUser might be here
    };
}

// Middleware to check for authentication
const isAuthenticated = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (req.isAuthenticated && req.isAuthenticated()) { // req.isAuthenticated() is the standard Passport check
        return next();
    }
    res.status(401).json({ message: 'User not authenticated' });
};

router.use(isAuthenticated); // Apply auth check to all stat routes

// GET /stats/my-games
// Fetches GameRecord entries for the authenticated user
router.get('/my-games', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({ message: 'User not properly authenticated or user ID missing.' });
        }
        const userId = req.user.id;
        const games = await prisma.gameRecord.findMany({
            where: {
                OR: [
                    { whitePlayerId: userId },
                    { blackPlayerId: userId },
                ],
            },
            orderBy: {
                playedAt: 'desc',
            },
            include: {
                whitePlayer: { select: { name: true, username: true, id: true } },
                blackPlayer: { select: { name: true, username: true, id: true } },
                winner: { select: { name: true, username: true, id: true } }
            }
        });
        res.json(games);
    } catch (error) {
        console.error("Error fetching my-games:", error);
        next(error);
    }
});

// GET /stats/game/:originalWsGameId/moves
// Fetches moves for a specific game (originalWsGameId) from Redis
router.get('/game/:originalWsGameId/moves', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const { originalWsGameId } = req.params;
        const userId = req.user?.id;

        // Optional: Verify user was part of this game or is an admin
        // This requires originalWsGameId to be reliably stored and unique in GameRecord
        if (userId && prisma.gameRecord.findFirst) { // Check if findFirst exists to be safe
             const gameRecord = await prisma.gameRecord.findFirst({
                 where: {
                     originalWsGameId: originalWsGameId, // Assumes originalWsGameId field exists
                     OR: [{ whitePlayerId: userId }, { blackPlayerId: userId }]
                 }
             });
             // if (!gameRecord && req.user.role !== 'ADMIN') { // Example check if user has roles
             if (!gameRecord) { // If user must be a player
                 return res.status(403).json({ message: 'Forbidden: You did not play in this game or game not found.' });
             }
        } else if (!userId) {
             return res.status(401).json({ message: 'User not properly authenticated.' });
        }


        if (!redisClient.isOpen) {
            await redisClient.connect().catch(err => {
                console.error("Failed to connect to Redis for fetching moves:", err);
                throw new Error("Redis connection error"); // Propagate error
            });
        }
        const moves = await redisClient.lRange(`game:${originalWsGameId}:moves`, 0, -1);
        res.json(moves);
    } catch (error) {
        console.error("Error fetching game moves from Redis:", error);
        next(error);
    }
});

// GET /stats/my-rating-history
// Gathers data for rating graph from GameRecord
router.get('/my-rating-history', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({ message: 'User not properly authenticated or user ID missing.' });
        }
        const userId = req.user.id;
        const gameRecords = await prisma.gameRecord.findMany({
            where: {
                OR: [
                    { whitePlayerId: userId },
                    { blackPlayerId: userId },
                ],
                // Ensure game has a conclusive result that affects rating
                // result: { not: 'PENDING' } // Example if you have such states
            },
            orderBy: {
                playedAt: 'asc', // Important for chronological rating history
            },
            select: {
                playedAt: true,
                whitePlayerId: true,
                whitePlayerRatingAfter: true,
                blackPlayerId: true,
                blackPlayerRatingAfter: true,
                result: true, // Useful for context on graph if needed
            }
        });

        const ratingHistory = gameRecords.map(record => ({
            date: record.playedAt,
            rating: record.whitePlayerId === userId ? record.whitePlayerRatingAfter : record.blackPlayerRatingAfter,
            result: record.result, // Optionally include result for more detailed chart points
        }));

        res.json(ratingHistory);
    } catch (error) {
        console.error("Error fetching rating history:", error);
        next(error);
    }
});

export default router;
