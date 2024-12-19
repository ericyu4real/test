export interface ChatMessage {
  id: string; // Add message ID for tracking
  type: "user" | "assistant" | "error";
  content: string;
  role: "user" | "assistant"; // Add role to match OpenAI format
  timestamp: number;
}

export interface StreamChunk {
  id: string; // Same ID as original message
  chunk: string; // The new content chunk
  timestamp: number;
}

export interface ChatMessage {
  id: string;
  type: "user" | "assistant" | "error";
  content: string;
  role: "user" | "assistant";
  timestamp: number;
}
