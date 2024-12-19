import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import { config } from "dotenv";
import { streamChatResponse } from "./services/openai";
import { ChatMessage } from "./types";
import { getRandomPrompt } from "./data/prompt";
import { storeChatMessage, getChatHistory } from "./services/chat_storage";
import { generateJournalSummary } from "./services/summary";
import {
  storeSummary,
  getSummariesByDateRange,
  JournalSummary,
  getSummaryDates,
} from "./services/dynamo";
import { verifyToken } from "./middleware/auth";

config();

const app = express();
const httpServer = createServer(app);

const corsOptions = {
  origin: process.env.FRONTEND_URL || "*",
  methods: ["GET", "POST"],
  // credentials: true,
};

const io = new Server(httpServer, {
  cors: corsOptions,
});

app.use(cors(corsOptions));
app.use(express.json());

// REST endpoints
app.get("/chat-history", async (req, res) => {
  const userId = req.query.userId as string;
  if (!userId) {
    return res.status(400).send("Missing userId");
  }
  res.json(getChatHistory(userId));
});

app.get("/summaries", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).send("Unauthorized");
  }

  const authenticatedUserId = await verifyToken(token);
  if (!authenticatedUserId) {
    return res.status(401).send("Unauthorized");
  }

  const { userId, startDate, endDate } = req.query;
  if (!userId || userId !== authenticatedUserId) {
    return res.status(403).send("Unauthorized: Invalid userId");
  }

  if (!startDate || !endDate) {
    return res.status(400).send("Missing required parameters");
  }

  try {
    const summaries = await getSummariesByDateRange(
      userId as string,
      startDate as string,
      endDate as string,
    );
    res.json(summaries);
  } catch (error) {
    console.error("Error fetching summaries:", error);
    res.status(500).send("Error fetching summaries");
  }
});

app.post("/summary", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  const authenticatedUserId = token ? await verifyToken(token) : null;
  
  try {
    const { userId } = req.query;
    const history = getChatHistory(userId as string);
    const summary = await generateJournalSummary(history);
    const [polishedEntry, keyPoints] = summary.split("\n\n");

    const summaryResponse = {
      userId: userId as string,
      date: new Date().toISOString().split("T")[0],
      polishedEntry,
      keyPoints,
      originalEntries: history
        .filter((msg) => msg.type === "user")
        .map((msg) => msg.content),
    };

    // Only store if user is authenticated
    if (authenticatedUserId && userId === authenticatedUserId) {
      await storeSummary(summaryResponse);
    }

    res.json({ summary });
  } catch (error) {
    console.error("Error generating summary:", error);
    res.status(500).send("Error generating summary");
  }
});

// In src/server.ts, add this endpoint:
app.get("/summary-dates", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).send("Unauthorized");
  }

  const authenticatedUserId = await verifyToken(token);
  if (!authenticatedUserId) {
    return res.status(401).send("Unauthorized");
  }

  const { userId, startDate, endDate } = req.query;
  if (!userId || userId !== authenticatedUserId) {
    return res.status(403).send("Unauthorized: Invalid userId");
  }

  try {
    const dates = await getSummaryDates(
      userId as string,
      startDate as string,
      endDate as string,
    );
    res.json(dates);
  } catch (error) {
    console.error("Error fetching summary dates:", error);
    res.status(500).send("Error fetching summary dates");
  }
});

// Socket.IO connection handling
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  console.log(token);
  if (!token) {
    // Allow connection without token, but don't set userId
    return next();
  }

  const userId = await verifyToken(token);
  if (userId) {
    socket.data.userId = userId;
  }
  next();
});

io.on("connection", (socket) => {
  const userId = socket.data.userId || null;
  console.log("Client connected:", userId);

  // Send initial connection confirmation with userId
  socket.emit("system", {
    type: "system",
    content: "connected",
    userId,
    timestamp: Date.now(),
  });

  // Send initial prompt
  const initialPrompt = getRandomPrompt();
  const message: ChatMessage = {
    id: crypto.randomUUID(),
    type: "assistant",
    role: "assistant",
    content: initialPrompt.text,
    timestamp: Date.now(),
  };
  storeChatMessage(userId, message);
  socket.emit("message", message);

  // Handle incoming messages
  socket.on("message", async (content: string) => {
    const messageId = crypto.randomUUID();

    try {
      // Store and emit user message
      const userMessage: ChatMessage = {
        id: messageId,
        type: "user",
        role: "user",
        content,
        timestamp: Date.now(),
      };
      storeChatMessage(userId, userMessage);
      socket.emit("message", userMessage);

      // Stream AI response
      const chunks: string[] = [];
      for await (const chunk of streamChatResponse(content, userId)) {
        chunks.push(chunk);
        socket.emit("chunk", {
          id: messageId,
          chunk,
          timestamp: Date.now(),
        });
      }

      // Store and emit complete AI message
      const assistantMessage: ChatMessage = {
        id: messageId,
        type: "assistant",
        role: "assistant",
        content: chunks.join(""),
        timestamp: Date.now(),
      };
      storeChatMessage(userId, assistantMessage);
      socket.emit("message", assistantMessage);
    } catch (error) {
      console.error("Error processing message:", error);
      const errorMessage: ChatMessage = {
        id: messageId,
        type: "error",
        role: "assistant",
        content: "Error processing message",
        timestamp: Date.now(),
      };
      storeChatMessage(userId, errorMessage);
      socket.emit("message", errorMessage);
    }
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", userId);
  });
});

const PORT = process.env.PORT || 8000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
