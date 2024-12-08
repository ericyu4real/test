"use client";

import React, { useState, useEffect, useRef } from "react";
import { Timer, Mic, MicOff, BookOpen, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type {
  Message,
  VoiceJournalProps,
  SpeechRecognition,
  SpeechRecognitionEvent,
  SpeechRecognitionErrorEvent,
} from "../types";
import { useWebSocket } from "../hooks/useWebSocket";
import { SlideOver } from "@/components/SlideOver";

const formatText = (text: string): string => {
  let formatted = text.trim();
  if (formatted.length === 0) return formatted;

  formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);

  const lastChar = formatted.slice(-1);
  if (!/[.!?]$/.test(lastChar)) {
    formatted += ".";
  }

  return formatted;
};

const VoiceJournal: React.FC<VoiceJournalProps> = ({
  initialTime = 120,
  onTimerComplete,
}) => {
  const { isConnected, messages, streamingMessages, sendMessage } =
    useWebSocket();
  const [isListening, setIsListening] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState<number>(initialTime);
  const [currentTranscript, setCurrentTranscript] = useState<string>("");
  const [timerActive, setTimerActive] = useState<boolean>(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const pauseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastProcessedLengthRef = useRef<number>(0);
  const [showSummary, setShowSummary] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);

  const fetchSummary = async () => {
    try {
      const response = await fetch(
        `http://localhost:8000/summary?userId=${localStorage.getItem("userId")}`,
        {
          method: "POST",
        },
      );
      if (!response.ok) throw new Error("Failed to fetch summary");
      const data = await response.json();

      // Parse the response - assumes the OpenAI response has a specific format
      const [polishedEntry, keyPoints] = data.summary.split("\n\n");

      setSummary({
        polishedEntry,
        keyPoints,
        originalEntries: messages
          .filter((msg) => msg.type === "user")
          .map((msg) => msg.content),
      });
      setShowSummary(true);
    } catch (error) {
      console.error("Error fetching summary:", error);
    }
  };

  const initializeRecognition = () => {
    // Clean up existing instance if it exists
    if (recognitionRef.current) {
      recognitionRef.current.onresult = null;
      recognitionRef.current.onerror = null;
      recognitionRef.current.onend = null;
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }

    const SpeechRecognition = window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const fullTranscript = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join(" ");

      const newPart = fullTranscript
        .slice(lastProcessedLengthRef.current)
        .trim();
      setCurrentTranscript(newPart);

      if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);
      pauseTimeoutRef.current = setTimeout(() => {
        if (newPart) {
          const formattedText = formatText(newPart);
          sendMessage(formattedText); // Only change is here - using sendMessage instead of setMessages
          lastProcessedLengthRef.current = fullTranscript.length;
          setCurrentTranscript("");
        }
      }, 2500);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error("Speech recognition error:", event.error);
      stopTimer();
    };

    recognition.onend = () => {
      console.log("Recognition ended");
      // Only restart if we're still supposed to be listening
      if (isListening) {
        console.log("Restarting recognition");
        recognition.start();
      }
    };

    recognitionRef.current = recognition;
  };

  useEffect(() => {
    if (!("webkitSpeechRecognition" in window)) {
      alert("Speech recognition is not supported in this browser");
      return;
    }

    // Initialize recognition instance
    initializeRecognition();

    // Cleanup function
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
    };
  }, []); // Empty dependency array as we only want to initialize once

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timerActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((time) => {
          if (time <= 1) {
            stopTimer();
            onTimerComplete?.();
          }
          return time - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerActive, onTimerComplete]);

  const startTimer = (): void => {
    // Reinitialize recognition to ensure clean state
    initializeRecognition();
    setTimerActive(true);
    setIsListening(true);
    lastProcessedLengthRef.current = 0;
    recognitionRef.current?.start();
  };

  const stopTimer = (): void => {
    console.log("Stopping timer");
    if (recognitionRef.current) {
      console.log("Aborting recognition");
      // Remove all listeners before aborting
      recognitionRef.current.onresult = null;
      recognitionRef.current.onerror = null;
      recognitionRef.current.onend = null;
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }
    setTimerActive(false);
    setIsListening(false);
    lastProcessedLengthRef.current = 0;
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Rest of the component remains the same...
  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      {/* Timer and control buttons */}
      <div className="flex flex-col items-center space-y-4">
        <div className="text-4xl font-bold">{formatTime(timeLeft)}</div>

        <button
          onClick={timerActive ? stopTimer : startTimer}
          className={`px-6 py-3 rounded-full flex items-center space-x-2 ${
            timerActive
              ? "bg-red-500 hover:bg-red-600"
              : "bg-blue-500 hover:bg-blue-600"
          } text-white transition-colors`}
        >
          {timerActive ? (
            <>
              <MicOff className="w-5 h-5" />
              <span>Stop</span>
            </>
          ) : (
            <>
              <Mic className="w-5 h-5" />
              <span>Start</span>
            </>
          )}
        </button>
        {timeLeft === 0 && ( // Only show when timer is done
          <button
            onClick={fetchSummary}
            className="px-4 py-2 rounded-full flex items-center space-x-2 bg-green-500 hover:bg-green-600 text-white transition-colors"
            disabled={messages.length === 0}
          >
            <BookOpen className="w-5 h-5" />
            <span>View Summary</span>
          </button>
        )}

        {!isConnected && (
          <Alert className="bg-yellow-50 border-yellow-200">
            <AlertDescription>Connecting to server...</AlertDescription>
          </Alert>
        )}

        {isListening && (
          <Alert className="bg-blue-50 border-blue-200">
            <Timer className="w-4 h-4" />
            <AlertDescription>
              Listening... {currentTranscript}
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Messages */}
      <div className="space-y-4 mt-8">
        {messages.map((message, index) => (
          <div
            key={`${message.timestamp?.getTime()}-${index}`}
            className={`p-4 rounded-lg ${
              message.type === "user"
                ? "bg-gray-100"
                : message.isStreaming
                  ? "bg-blue-50"
                  : "bg-blue-100"
            }`}
          >
            {message.content}
            {message.isStreaming && (
              <span className="inline-block ml-1 animate-pulse">▊</span>
            )}
          </div>
        ))}
      </div>
      <SlideOver isOpen={showSummary} onClose={() => setShowSummary(false)}>
        <div className="p-6 space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-medium">Journal Summary</h2>
            <button
              onClick={() => setShowSummary(false)}
              className="text-gray-400 hover:text-gray-500"
            >
              <span className="sr-only">Close panel</span>
              <X className="h-6 w-6" />
            </button>
          </div>

          {summary ? (
            <div className="space-y-6">
              <div>
                <h3 className="font-medium mb-2">Summary</h3>
                <p className="text-gray-600">{summary.polishedEntry}</p>
              </div>

              <div>
                <h3 className="font-medium mb-2">Original Entries</h3>
                <div className="space-y-2">
                  {summary.originalEntries.map((entry, index) => (
                    <p key={index} className="text-gray-600">
                      {entry}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
            </div>
          )}
        </div>
      </SlideOver>
    </div>
  );
};

export default VoiceJournal;
