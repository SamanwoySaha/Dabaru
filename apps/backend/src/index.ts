import express from 'express';
import dotenv from 'dotenv';
import cors from "cors";
import session from 'express-session';
import RedisStore from 'connect-redis';
import passport from 'passport'; // Passport default export
import { initPassport } from './passport'; // The function to configure passport
import { backendRedisClient } from './redisClient'; // Your backend Redis client
import v1Router from './router/v1';
import authRouter from './router/auth'; // Import the auth router
import statsRouter from './router/stats'; // Import the stats router

const app = express();
dotenv.config();

// Initialize Passport strategies and serializers/deserializers
initPassport();

app.use(express.json());

// Session Configuration
// Ensure backendRedisClient is connected or connecting before session middleware uses it.
// The redisClient.ts already attempts to connect.
app.use(session({
    store: new RedisStore({ client: backendRedisClient }),
    secret: process.env.SESSION_SECRET || 'fallback_super_secret_key_for_dev', // Fallback for dev
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production', // True if using https
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 // 24 hours
    }
}));

// Passport Middleware
app.use(passport.initialize());
app.use(passport.session());

const allowedHosts = process.env.ALLOWED_HOSTS
  ? process.env.ALLOWED_HOSTS.split(',') 
  : [];

app.use(
  cors({
    origin: allowedHosts,
    methods: 'GET,POST,PUT,DELETE',
    credentials: true
  })
);

app.use('/v1', v1Router);
app.use('/auth', authRouter); // Mount the auth router
app.use('/stats', statsRouter); // Mount the stats router

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});