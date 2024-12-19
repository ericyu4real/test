// services/openai.ts

import { ChatMessage } from "../types";
import { getChatHistory } from "./chat_storage";

interface DeltaContent {
  content?: string;
}

interface Choice {
  delta: DeltaContent;
  index: number;
  finish_reason: string | null;
}

interface ChatCompletionChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Choice[];
}

function convertToOpenAIMessages(messages: ChatMessage[]) {
  return messages.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));
}

export async function* streamChatResponse(
  message: string,
  userId: string,
): AsyncGenerator<string> {
  // Get recent chat history (limit to last 10 messages to manage tokens)
  const history = getChatHistory(userId);

  const messages = [
    {
      role: "system",
      content:
        "You are helping someone talk about their day. Encourage them to express how they feel. Give tips on what to talk about. Do not dwell on one topic. Keep your responses 1-2 sentence max. Start your response with 'Talk about ...'",
    },
    ...convertToOpenAIMessages(history),
    { role: "user", content: message },
  ];

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages,
      stream: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  if (!reader) {
    throw new Error("No reader available");
  }

  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");

    // Keep the last partial line in the buffer
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine === "data: [DONE]") continue;

      if (trimmedLine.startsWith("data: ")) {
        try {
          const chunk = JSON.parse(trimmedLine.slice(6)) as ChatCompletionChunk;
          const content = chunk.choices[0]?.delta?.content;
          if (content) {
            yield content;
          }
        } catch (e) {
          console.error("Error parsing chunk:", e);
        }
      }
    }
  }

  // Process any remaining buffer content
  if (buffer) {
    const trimmedLine = buffer.trim();
    if (
      trimmedLine &&
      trimmedLine !== "data: [DONE]" &&
      trimmedLine.startsWith("data: ")
    ) {
      try {
        const chunk = JSON.parse(trimmedLine.slice(6)) as ChatCompletionChunk;
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          yield content;
        }
      } catch (e) {
        console.error("Error parsing final chunk:", e);
      }
    }
  }
}
