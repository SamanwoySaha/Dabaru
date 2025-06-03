import { createClient } from 'redis';

const redisClient = createClient({
    // url: 'redis://localhost:6379' // Default URL, will be used if not specified.
    // For production, this should be configured via environment variables.
});

redisClient.on('error', (err) => console.error('Redis Client Error', err));
redisClient.on('connect', () => console.log('Connected to Redis'));
redisClient.on('reconnecting', () => console.log('Redis client is reconnecting'));
redisClient.on('ready', () => console.log('Redis client is ready'));

// For Redis v4, an explicit connect() is needed before commands can be sent if not using features
// that queue commands until connected. However, for basic use, commands often trigger connect.
// To be safe and explicit, especially on startup:
(async () => {
    try {
        // Check if already connected or trying to connect to avoid issues if this file is re-evaluated.
        // However, redis client v4 manages its connection state internally well.
        // A simple connect call is usually sufficient.
        if (!redisClient.isOpen) { // isOpen is true if connected or connecting
             await redisClient.connect();
        }
    } catch (err) {
        console.error('Failed to connect to Redis on initial setup:', err);
    }
})();

export default redisClient;
