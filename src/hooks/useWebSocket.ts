// src/hooks/useWebSocket.ts
import { useState, useEffect, useCallback, useRef } from "react";
import type { ChatMessage, Message, StreamChunk } from "../types";

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const wsRef = useRef<WebSocket | null>(null); // Added this line
  const streamingMessagesRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:8000");

    ws.onopen = () => {
      console.log("Connected to WebSocket");
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      // Handle system messages (including userId)
      if (data.type === "system") {
        if (data.userId) {
          localStorage.setItem("userId", data.userId);
        }
        return;
      }
      if ("chunk" in data) {
        // Handle streaming chunks
        const currentContent =
          (streamingMessagesRef.current.get(data.id) || "") + data.chunk;
        streamingMessagesRef.current.set(data.id, currentContent);

        setMessages((prev) => {
          const messageIndex = prev.findIndex(
            (msg) => msg.type === "assistant" && msg.streamId === data.id,
          );

          if (messageIndex === -1) {
            // Create new streaming message
            return [
              ...prev,
              {
                type: "assistant",
                content: currentContent,
                timestamp: new Date(data.timestamp),
                streamId: data.id,
                isStreaming: true,
              },
            ];
          }

          // Update existing streaming message
          const newMessages = [...prev];
          newMessages[messageIndex] = {
            ...newMessages[messageIndex],
            content: currentContent,
          };
          return newMessages;
        });
      } else {
        // Handle complete messages
        const wsMessage = data as ChatMessage;
        const newMessage: Message = {
          type: wsMessage.type === "error" ? "assistant" : wsMessage.type,
          content: wsMessage.content,
          timestamp: new Date(wsMessage.timestamp),
        };

        if (wsMessage.type === "assistant") {
          // Remove streaming message and add complete message
          setMessages((prev) => {
            const filteredMessages = prev.filter(
              (msg) => msg.streamId !== wsMessage.id,
            );
            return [...filteredMessages, newMessage];
          });
          // Clear from streaming store
          streamingMessagesRef.current.delete(wsMessage.id);
        } else {
          // For user messages, just add them
          setMessages((prev) => [...prev, newMessage]);
        }
      }
    };

    ws.onclose = () => {
      console.log("Disconnected from WebSocket");
      setIsConnected(false);
    };

    wsRef.current = ws;

    return () => {
      ws.close();
    };
  }, []);

  const sendMessage = useCallback((content: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(content);
    }
  }, []);

  return {
    isConnected,
    messages,
    sendMessage,
  };
}
