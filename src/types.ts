// Existing frontend types
export interface Message {
  type: "user" | "assistant";
  content: string;
  timestamp?: Date;
  isStreaming?: boolean;
  streamId?: string;
}

export interface VoiceJournalProps {
  initialTime?: number; // in seconds
  onMessageSubmit?: (message: Message) => void;
  onTimerComplete?: () => void;
}

// WebSocket message type (from your server)
export interface ChatMessage {
  id: string;
  type: "user" | "assistant" | "error";
  content: string;
  role: "user" | "assistant";
  timestamp: number;
}

export interface StreamChunk {
  id: string;
  chunk: string;
  timestamp: number;
}

// Speech Recognition types
export interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

export interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

export interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

export interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

export interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

declare global {
  interface Window {
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

export interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

export interface Summary {
  polishedEntry: string;
  keyPoints: string;
  originalEntries: string[];
}

export interface VoskResult {
  result: Array<{
    conf: number;
    start: number;
    end: number;
    word: string;
  }>;
  text: string;
}

export interface VoskResultMessage {
  result: VoskResult;
}
