import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as GoogleStrategyType } from 'passport-google-oauth20'; // Use alias for clarity
// const GoogleStrategy = require('passport-google-oauth20').Strategy; // Original require, now replaced by import for placeholder
const GithubStrategy = require('passport-github2').Strategy; // Keep for GitHub
import passport from 'passport';
import dotenv from 'dotenv';
import { db } from './db'; // Kept for GitHubStrategy
import prisma from './prismaClient'; // For LocalStrategy and deserializeUser
import bcrypt from 'bcrypt';

interface GithubEmailRes {
  email: string;
  primary: boolean;
  verified: boolean;
  visibility: 'private' | 'public';
}

dotenv.config();
const GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID || 'your_google_client_id';
const GOOGLE_CLIENT_SECRET =
  process.env.GOOGLE_CLIENT_SECRET || 'your_google_client_secret';
const GITHUB_CLIENT_ID =
  process.env.GITHUB_CLIENT_ID || 'your_github_client_id';
const GITHUB_CLIENT_SECRET =
  process.env.GITHUB_CLIENT_SECRET || 'your_github_client_secret';

export function initPassport() {
  if (
    !GOOGLE_CLIENT_ID ||
    !GOOGLE_CLIENT_SECRET ||
    !GITHUB_CLIENT_ID ||
    !GITHUB_CLIENT_SECRET
  ) {
    throw new Error(
      'Missing environment variables for authentication providers',
    );
  }

  // Local Strategy with Prisma
  passport.use(new LocalStrategy(
      { usernameField: 'email' },
      async (email, password, done) => {
          try {
              const user = await prisma.user.findUnique({
                  where: { email },
              });

              if (!user) {
                  return done(null, false, { message: 'Incorrect email or password.' });
              }

              if (!user.passwordHash) {
                  // User might have registered with OAuth, has no local password
                  return done(null, false, { message: 'Please log in using the method you originally signed up with.' });
              }

              const isMatch = await bcrypt.compare(password, user.passwordHash);
              if (!isMatch) {
                  return done(null, false, { message: 'Incorrect email or password.' });
              }
              return done(null, user); // Return full user object from DB
          } catch (error) {
              return done(error);
          }
      }
  ));

  // Google Strategy with Prisma
  passport.use(new GoogleStrategyType(
      {
          clientID: process.env.GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID_PLACEHOLDER',
          clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'YOUR_GOOGLE_CLIENT_SECRET_PLACEHOLDER',
          callbackURL: process.env.GOOGLE_CALLBACK_URL || '/auth/google/callback',
          passReqToCallback: false // Set to false as req is not used in the new logic
      },
      async (accessToken, refreshToken, profile, done) => {
          try {
              const googleId = profile.id;
              const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
              const name = profile.displayName;

              if (!email) {
                  return done(new Error('Email not found in Google profile'), undefined);
              }

              let user = await prisma.user.findUnique({
                  where: { googleId },
              });

              if (user) {
                  return done(null, user);
              }

              user = await prisma.user.findUnique({
                  where: { email },
              });

              if (user) {
                  // User exists with this email, link Google ID
                  user = await prisma.user.update({
                      where: { email },
                      data: {
                          googleId: googleId,
                          name: user.name || name, // Keep existing name or update if empty
                          provider: 'GOOGLE' // Assuming 'GOOGLE' is a valid value for AuthProvider enum
                      },
                  });
                  return done(null, user);
              }

              // No user found, create a new one
              const newUser = await prisma.user.create({
                  data: {
                      googleId,
                      email,
                      name,
                      passwordHash: null, // No local password for OAuth users initially
                      provider: 'GOOGLE', // Assuming 'GOOGLE' is a valid value for AuthProvider enum
                      // rating: 1200 // Default is in schema
                  },
              });
              return done(null, newUser);

          } catch (error) {
              return done(error);
          }
      }
  ));

  // Existing GitHub Strategy (with DB interaction) - kept as is.
  passport.use(
    new GithubStrategy(
      {
        clientID: GITHUB_CLIENT_ID,
        clientSecret: GITHUB_CLIENT_SECRET,
        callbackURL: '/auth/github/callback',
      },
      async function (
        accessToken: string,
        refreshToken: string,
        profile: any,
        done: (error: any, user?: any) => void,
      ) {
        const res = await fetch('https://api.github.com/user/emails', {
          headers: {
            Authorization: `token ${accessToken}`,
          },
        });
        const data: GithubEmailRes[] = await res.json();
        const primaryEmail = data.find((item) => item.primary === true);

        const user = await db.user.upsert({
          create: {
            email: primaryEmail!.email,
            name: profile.displayName,
            provider: 'GITHUB',
          },
          update: {
            name: profile.displayName,
          },
          where: {
            email: primaryEmail?.email,
          },
        });

        done(null, user);
      },
    ),
  );

  passport.serializeUser((user: any, done) => {
    // Store only the user ID in the session, as per typical practice and subtask spirit.
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    // In a real app, fetch user from DB by id.
    // const user = await db.user.findUnique({ where: { id } });
    // if (user) {
    //    done(null, user);
    // } else {
    //    done(new Error('User not found'), null);
    // }

    // Fetch user from DB using Prisma
    try {
        const user = await prisma.user.findUnique({ where: { id } });
        done(null, user); // user will be null if not found by Prisma, which Passport handles
    } catch (error) {
        done(error);
    }
  });
}