# Dabaru.com
Chess is a game of unlimited beauty. Enjoy Chess.

1. Sign up
2. Create game in different formats
   1. Bullet
   2. Blitz
   3. Rapid
   4. Classical
3. Rating System
4. Create Tournament
5. Create Clubs
6. Analyze your games
7. Learn Basics, Puzzles, Openings, GM Masterclass.

## Tech Stack

1. Frontend: React
2. Backend: Node.js
3. Language: Typescript
4. Database: Postgres
5. WebSocket: Handle real time games
6. Redis: Store all moves of a game in a queue

## Setting it up locally

- Clone the repo
- Copy over .env.example to .env everywhere
- Update .env
  - Postgres DB credentials
  - Auth credentials
- `npm install`
- Start ws server
  - `cd apps/ws`
  - `npm run dev`
- Start Backend
  - `cd apps/backend`
  - `npm run dev`
- Start Frontend
  - `cd apps/frontend`
  - `npm run dev`
