import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface ChatMessage {
  id: string; // Unique ID for each message
  sender: 'user' | 'opponent' | 'system';
  text: string;
  timestamp: string; // ISO string for date/time
}

interface ChatState {
  chatHistory: ChatMessage[];
}

const initialState: ChatState = {
  chatHistory: [],
};

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    addChatMessage: (state, action: PayloadAction<ChatMessage>) => {
      state.chatHistory.push(action.payload);
    },
    clearChat: (state) => {
      state.chatHistory = [];
    },
  },
});

export const { addChatMessage, clearChat } = chatSlice.actions;

export default chatSlice.reducer;
