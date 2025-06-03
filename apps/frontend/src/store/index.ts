import { configureStore } from '@reduxjs/toolkit';
import gameReducer from './slices/gameSlice';
import timerReducer from './slices/timerSlice';
import playerReducer from './slices/playerSlice';
import chatReducer from './slices/chatSlice';

const rootReducer = {
  game: gameReducer,
  timer: timerReducer,
  player: playerReducer,
  chat: chatReducer,
};

const store = configureStore({
  reducer: rootReducer,
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export default store;
