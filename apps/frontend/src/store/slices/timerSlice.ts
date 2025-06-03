import { createSlice, PayloadAction } from '@reduxjs/toolkit';

// Define a type for the time control configuration
// This should match the structure of timeConfig objects (e.g., timeConfig.RAPID1)
interface TimeControl {
  initialTime: number; // in seconds
  increment: number; // in seconds
  label: string; // e.g., "10 min"
}

interface TimerState {
  timeControl: TimeControl | null;
  whiteTime: number; // in milliseconds
  blackTime: number; // in milliseconds
  timerActive: boolean;
}

// Example: Default time control (e.g., Rapid 10+0)
const defaultTimeControl: TimeControl = {
  initialTime: 10 * 60, // 10 minutes in seconds
  increment: 0,
  label: "10 min",
};

const initialState: TimerState = {
  timeControl: defaultTimeControl,
  whiteTime: defaultTimeControl.initialTime * 1000,
  blackTime: defaultTimeControl.initialTime * 1000,
  timerActive: false,
};

const timerSlice = createSlice({
  name: 'timer',
  initialState,
  reducers: {
    setTimeControlConfiguration: (state, action: PayloadAction<TimeControl>) => {
      state.timeControl = action.payload;
      state.whiteTime = action.payload.initialTime * 1000;
      state.blackTime = action.payload.initialTime * 1000;
      state.timerActive = false; // Reset timer activity on new configuration
    },
    setWhiteTime: (state, action: PayloadAction<number>) => {
      state.whiteTime = action.payload;
    },
    setBlackTime: (state, action: PayloadAction<number>) => {
      state.blackTime = action.payload;
    },
    decrementWhiteTime: (state, action: PayloadAction<number>) => { // payload is the amount to decrement by in ms
      state.whiteTime = Math.max(0, state.whiteTime - action.payload);
    },
    decrementBlackTime: (state, action: PayloadAction<number>) => { // payload is the amount to decrement by in ms
      state.blackTime = Math.max(0, state.blackTime - action.payload);
    },
    setTimerActive: (state, action: PayloadAction<boolean>) => {
      state.timerActive = action.payload;
    },
    resetTimer: (state) => {
      if (state.timeControl) {
        state.whiteTime = state.timeControl.initialTime * 1000;
        state.blackTime = state.timeControl.initialTime * 1000;
      } else {
        // Fallback to a default if timeControl is somehow null
        state.whiteTime = defaultTimeControl.initialTime * 1000;
        state.blackTime = defaultTimeControl.initialTime * 1000;
      }
      state.timerActive = false;
    },
  },
});

export const {
  setTimeControlConfiguration,
  setWhiteTime,
  setBlackTime,
  decrementWhiteTime,
  decrementBlackTime,
  setTimerActive,
  resetTimer,
} = timerSlice.actions;

export default timerSlice.reducer;
