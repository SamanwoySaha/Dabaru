import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface PlayerState {
  yourRating: number;
  opponentRating: number | null;
  playerCount: number; // Online players, or players in a lobby, etc.
}

const initialState: PlayerState = {
  yourRating: 1200, // Default starting rating
  opponentRating: null,
  playerCount: 0,
};

const playerSlice = createSlice({
  name: 'player',
  initialState,
  reducers: {
    setYourRating: (state, action: PayloadAction<number>) => {
      state.yourRating = action.payload;
    },
    setOpponentRating: (state, action: PayloadAction<number | null>) => {
      state.opponentRating = action.payload;
    },
    setPlayerCount: (state, action: PayloadAction<number>) => {
      state.playerCount = action.payload;
    },
  },
});

export const {
  setYourRating,
  setOpponentRating,
  setPlayerCount,
} = playerSlice.actions;

export default playerSlice.reducer;
