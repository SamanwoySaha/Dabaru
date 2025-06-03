import { Request, Response, Router, NextFunction } from 'express'; // Added NextFunction
import passport from 'passport';
import jwt from 'jsonwebtoken';
import { db } from '../db'; // Kept for existing /guest and /refresh routes
import prisma from '../prismaClient'; // Import new Prisma client
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { COOKIE_MAX_AGE } from '../consts';
const router = Router();

const CLIENT_URL =
  process.env.AUTH_REDIRECT_URL ?? 'http://localhost:5173/game/random';
const JWT_SECRET = process.env.JWT_SECRET || 'your_secret_key';

interface userJwtClaims {
  userId: string;
  name: string;
  isGuest?: boolean;
}

interface UserDetails {
  id: string;
  token?: string;
  name: string;
  isGuest?: boolean;
}

// this route is to be hit when the user wants to login as a guest
router.post('/guest', async (req: Request, res: Response) => {
  const bodyData = req.body;
  let guestUUID = 'guest-' + uuidv4();

  const user = await db.user.create({
    data: {
      username: guestUUID,
      email: guestUUID + '@dabaru.com',
      name: bodyData.name || guestUUID,
      provider: 'GUEST',
    },
  });

  const token = jwt.sign(
    { userId: user.id, name: user.name, isGuest: true },
    JWT_SECRET,
  );
  const UserDetails: UserDetails = {
    id: user.id,
    name: user.name!,
    token: token,
    isGuest: true,
  };
  res.cookie('guest', token, { maxAge: COOKIE_MAX_AGE });
  res.json(UserDetails);
});

router.get('/refresh', async (req: Request, res: Response) => {
  if (req.user) {
    const user = req.user as UserDetails;

    // Token is issued so it can be shared b/w HTTP and ws server
    // Todo: Make this temporary and add refresh logic here

    const userDb = await db.user.findFirst({
      where: {
        id: user.id,
      },
    });

    const token = jwt.sign({ userId: user.id, name: userDb?.name }, JWT_SECRET);
    res.json({
      token,
      id: user.id,
      name: userDb?.name,
    });
  } else if (req.cookies && req.cookies.guest) {
    const decoded = jwt.verify(req.cookies.guest, JWT_SECRET) as userJwtClaims;
    const token = jwt.sign(
      { userId: decoded.userId, name: decoded.name, isGuest: true },
      JWT_SECRET,
    );
    let User: UserDetails = {
      id: decoded.userId,
      name: decoded.name,
      token: token,
      isGuest: true,
    };
    res.cookie('guest', token, { maxAge: COOKIE_MAX_AGE });
    res.json(User);
  } else {
    res.status(401).json({ success: false, message: 'Unauthorized' });
  }
});

// New POST /register route
router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, password, name, username } = req.body; // Added username
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required.' });
        }

        // Basic email validation
        if (!/\S+@\S+\.\S+/.test(email)) {
            return res.status(400).json({ message: 'Invalid email format.' });
        }
        // Basic password length validation
        if (password.length < 8) {
            return res.status(400).json({ message: 'Password must be at least 8 characters long.' });
        }

        const existingUserByEmail = await prisma.user.findUnique({ where: { email } });
        if (existingUserByEmail) {
            return res.status(409).json({ message: 'User already exists with this email.' });
        }

        if (username) {
            const existingUserByUsername = await prisma.user.findUnique({ where: { username } });
            if (existingUserByUsername) {
                return res.status(409).json({ message: 'User already exists with this username.' });
            }
        }

        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        const user = await prisma.user.create({
            data: {
                email,
                passwordHash,
                name,
                username, // Add username if provided
                provider: 'EMAIL', // Assuming 'EMAIL' is a valid value for AuthProvider enum if it's not optional
                                  // Or ensure provider is optional in your User model in schema.prisma
            },
        });

        // Exclude passwordHash from response
        const { passwordHash: _, ...userWithoutPassword } = user;

        // Log in the user directly after registration
        req.login(userWithoutPassword, (err) => { // Pass userWithoutPassword or full user if serializer handles it
            if (err) {
                console.error("Error logging in after registration:", err);
                // Decide if this is a fatal error for the registration process
                // For now, we'll still return success for registration, but log the login error
                // Alternatively, return an error to the client: return next(err);
            }
            return res.status(201).json({ message: 'User registered successfully', user: userWithoutPassword });
        });

    } catch (error) {
        console.error("Error in /register route:", error);
        next(error); // Pass error to global error handler
    }
});

// New POST /login route for local strategy
router.post('/login', passport.authenticate('local', {
    session: true // Ensure session is established
    // successRedirect and failureRedirect can be used if not sending JSON
}), (req, res) => {
    // If this function gets called, authentication was successful.
    // req.user contains the authenticated user.
    res.json({ message: 'Login successful', user: req.user });
});

// Modified /logout to be POST and use standard session destruction
router.post('/logout', (req: Request, res: Response, next) => {
    req.logout((err) => {
        if (err) {
            console.error('Logout error:', err);
            return next(err);
        }
        req.session.destroy((destroyErr) => {
            if (destroyErr) {
                console.error('Session destruction error:', destroyErr);
                // Optionally, still try to clear cookie or send success if critical parts worked
            }
            res.clearCookie('connect.sid'); // Default session cookie name
            // Also clear other custom cookies if set during login, like 'guest' or 'jwt' if they are session-related
            res.clearCookie('guest');
            res.clearCookie('jwt');
            res.json({ message: 'Logout successful' });
        });
    });
});

// New GET /me route
router.get('/me', (req, res) => {
    if (req.isAuthenticated()) {
        res.json(req.user);
    } else {
        res.status(401).json({ message: 'Not authenticated' });
    }
});

router.get('/login/failed', (req: Request, res: Response) => {
  res.status(401).json({ success: false, message: 'failure' });
});

// Original GET /logout is removed in favor of POST /logout above.
// If a GET /logout is still desired for some reason (e.g. direct browser link), it should be added separately
// and perhaps only clear cookies if no CSRF protection is in place for it.
// For now, assuming POST is the standard.

router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'] }),
);

router.get(
  '/google/callback',
  passport.authenticate('google', {
    successRedirect: CLIENT_URL,
    failureRedirect: '/login/failed',
  }),
);

router.get(
  '/github',
  passport.authenticate('github', { scope: ['read:user', 'user:email'] }),
);

router.get(
  '/github/callback',
  passport.authenticate('github', {
    successRedirect: CLIENT_URL,
    failureRedirect: '/login/failed',
  }),
);

export default router;