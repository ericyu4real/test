import { ChatMessage } from "../types";

// In-memory storage for chat history
const chatHistory = new Map<string, ChatMessage[]>();

export function storeChatMessage(userId: string, message: ChatMessage) {
  if (!chatHistory.has(userId)) {
    chatHistory.set(userId, []);
  }
  chatHistory.get(userId)?.push(message);
}

export function getChatHistory(userId: string): ChatMessage[] {
  return chatHistory.get(userId) || [];
}
