// src/hooks/useWebSocket.ts
import { useState, useEffect, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";
import type { ChatMessage, Message } from "../types";
import { useAuth } from "@/contexts/AuthContext";

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const streamingMessagesRef = useRef<Map<string, string>>(new Map());
  const { getSession, isLoading } = useAuth();

  useEffect(() => {
    const token = getSession();
    if (isLoading) return;
    setMessages([]);

    console.log(
      "connecting to ",
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
      "with token",
      token,
    );
    const socket = io(
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
      {
        auth: { token },
      },
    );

    socket.on("connect", () => {
      console.log("Connected to Socket.IO");
      setIsConnected(true);
    });

    socket.on("disconnect", () => {
      console.log("Disconnected from Socket.IO");
      setIsConnected(false);
    });

    socket.on("system", (data) => {
      console.log(data.userId);
      localStorage.setItem("userId", data.userId);
    });

    socket.on("chunk", (data) => {
      const currentContent =
        (streamingMessagesRef.current.get(data.id) || "") + data.chunk;
      streamingMessagesRef.current.set(data.id, currentContent);

      setMessages((prev) => {
        const messageIndex = prev.findIndex(
          (msg) => msg.type === "assistant" && msg.streamId === data.id,
        );

        if (messageIndex === -1) {
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

        const newMessages = [...prev];
        newMessages[messageIndex] = {
          ...newMessages[messageIndex],
          content: currentContent,
        };
        return newMessages;
      });
    });

    socket.on("message", (data: ChatMessage) => {
      const newMessage: Message = {
        type: data.type === "error" ? "assistant" : data.type,
        content: data.content,
        timestamp: new Date(data.timestamp),
      };

      if (data.type === "assistant") {
        setMessages((prev) => {
          const filteredMessages = prev.filter(
            (msg) => msg.streamId !== data.id,
          );
          return [...filteredMessages, newMessage];
        });
        streamingMessagesRef.current.delete(data.id);
      } else {
        setMessages((prev) => [...prev, newMessage]);
      }
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, [isLoading, getSession]);

  const sendMessage = useCallback((content: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("message", content);
    }
  }, []);

  return {
    isConnected,
    messages,
    sendMessage,
  };
}
