import { ChatMessage } from "../types";

interface OpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
    index: number;
  }>;
}

// replace with official package later

export async function generateJournalSummary(messages: ChatMessage[]) {
  // Filter only user messages
  console.log("generating journal");
  const userEntries = messages
    .filter((msg) => msg.type === "user")
    .map((msg) => msg.content)
    .join("\n");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "You are a journal entry editor. Take the provided journal entries and create a brief summary of the key points",
        },
        {
          role: "user",
          content: userEntries,
        },
      ],
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const data = (await response.json()) as OpenAIResponse;
  return data.choices[0].message.content;
}
