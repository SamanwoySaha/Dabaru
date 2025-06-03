import { createClient } from 'redis';

// For backend sessions, ensure a distinct client or configuration if needed.
// Default URL 'redis://localhost:6379' will be used if not specified.
export const backendRedisClient = createClient({
    // url: process.env.BACKEND_REDIS_URL || 'redis://localhost:6379'
    // Consider using a different DB number for sessions if sharing a Redis instance
    // database: 1 // Example: Use DB 1 for backend sessions
});

backendRedisClient.on('error', (err) => console.error('Backend Redis Client Error:', err));
backendRedisClient.on('connect', () => console.log('Backend connected to Redis for sessions'));
backendRedisClient.on('reconnecting', () => console.log('Backend Redis client is reconnecting'));
backendRedisClient.on('ready', () => console.log('Backend Redis client is ready'));

(async () => {
    try {
        if (!backendRedisClient.isOpen) {
            await backendRedisClient.connect();
        }
    } catch (err) {
        console.error('Failed to connect Backend Redis Client on initial setup:', err);
    }
})();
