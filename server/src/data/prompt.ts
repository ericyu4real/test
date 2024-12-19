// prompts.ts
export interface Prompt {
  category: "reflection" | "gratitude" | "emotional" | "general";
  text: string;
}

export const journalPrompts: Prompt[] = [
  // Reflection Prompts
  // {
  //   category: "reflection",
  //   text: "Tell me about the most interesting part of your day.",
  // },
  // {
  //   category: "reflection",
  //   text: "What did you spend most of your time doing today?",
  // },
  // {
  //   category: "reflection",
  //   text: "Tell me about something unexpected that happened today.",
  // },

  // // Gratitude Prompts
  // {
  //   category: "gratitude",
  //   text: "What moments made today enjoyable?",
  // },
  // {
  //   category: "gratitude",
  //   text: "Tell me about the conversations you had today.",
  // },

  // // Emotional Check-ins
  // {
  //   category: "emotional",
  //   text: "Describe how your day has been making you feel.",
  // },
  // {
  //   category: "emotional",
  //   text: "What's been on your mind lately?",
  // },
  {
    category: "general",
    text: "Describe your day.",
  },
];

export function getRandomPrompt(): Prompt {
  const randomIndex = Math.floor(Math.random() * journalPrompts.length);
  return journalPrompts[randomIndex];
}
