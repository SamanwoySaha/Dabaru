import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Chess } from 'chess.js';

interface GameState {
  fen: string;
  gameState: string; // e.g., 'waiting', 'active', 'checkmate', 'stalemate', 'draw'
  playerColor: 'white' | 'black' | '';
  isMyTurn: boolean;
  moveHistory: string[];
  gameId: string | null;
}

const initialChess = new Chess();
const initialState: GameState = {
  fen: initialChess.fen(),
  gameState: 'waiting',
  playerColor: '',
  isMyTurn: false,
  moveHistory: [],
  gameId: null,
};

const gameSlice = createSlice({
  name: 'game',
  initialState,
  reducers: {
    setGameFen: (state, action: PayloadAction<string>) => {
      state.fen = action.payload;
      // Optionally, update a chess.js instance here if needed for validation,
      // but primarily rely on FEN for serializable state.
    },
    setGameState: (state, action: PayloadAction<string>) => {
      state.gameState = action.payload;
    },
    setPlayerColor: (state, action: PayloadAction<'white' | 'black' | ''>) => {
      state.playerColor = action.payload;
    },
    setIsMyTurn: (state, action: PayloadAction<boolean>) => {
      state.isMyTurn = action.payload;
    },
    addMoveToHistory: (state, action: PayloadAction<string>) => {
      state.moveHistory.push(action.payload);
    },
    setGameId: (state, action: PayloadAction<string | null>) => {
      state.gameId = action.payload;
    },
    resetGame: (state) => {
      const newChess = new Chess();
      state.fen = newChess.fen();
      state.gameState = 'waiting';
      state.playerColor = '';
      state.isMyTurn = false;
      state.moveHistory = [];
      // gameId might persist or be cleared depending on desired behavior
    },
    // Example: if you need to update fen based on a move and chess.js logic
    makeMove: (state, action: PayloadAction<string>) => {
      const chess = new Chess(state.fen);
      try {
        chess.move(action.payload);
        state.fen = chess.fen();
        // Potentially update moveHistory here as well
      } catch (error) {
        console.error("Invalid move:", action.payload, error);
        // Handle invalid move, maybe set an error state
      }
    }
  },
});

export const {
  setGameFen,
  setGameState,
  setPlayerColor,
  setIsMyTurn,
  addMoveToHistory,
  setGameId,
  resetGame,
  makeMove,
} = gameSlice.actions;

export default gameSlice.reducer;
