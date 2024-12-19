// src/components/VoiceJournal.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { createModel, KaldiRecognizer } from "vosk-browser";
import { RecognizerMessage } from "vosk-browser/dist/interfaces";
import { BookOpen, Mic } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SlideOver } from "@/components/SlideOver";
import { useWebSocket } from "../hooks/useWebSocket";
import { Summary } from "@/types";
import { useAuth } from "@/contexts/AuthContext";

const MESSAGES = [
  { text: "Reflect on your day...", duration: 6 },
  { text: "Tasks you accomplished...", duration: 9 },
  { text: "Tasks you didn't have time for...", duration: 12 },
  { text: "Things you were grateful for...", duration: 15 },
  { text: "Breathe in...", duration: 17 },
  { text: "Breathe out...", duration: 19 },
];

const TOTAL_PREP_TIME = 20; // Sum of all message durations

interface VoiceJournalProps {
  initialTime?: number;
  onTimerComplete?: () => void;
}

type Phase = "preparing" | "ready" | "recording" | "completed";

const formatText = (text: string): string => {
  let formatted = text.trim();
  if (formatted.length === 0) return formatted;
  formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);
  if (!/[.!?]$/.test(formatted.slice(-1))) {
    formatted += ".";
  }
  return formatted;
};

export default function VoiceJournal({
  initialTime = 60,
  onTimerComplete,
}: VoiceJournalProps) {
  // Core state
  const [phase, setPhase] = useState<Phase>("preparing");
  const [message, setMessage] = useState(MESSAGES[0].text);
  const [prepTimeLeft, setPrepTimeLeft] = useState(TOTAL_PREP_TIME);
  const [recordingTimeLeft, setRecordingTimeLeft] = useState(initialTime);

  // Model and recognition state
  const [modelLoading, setModelLoading] = useState(true);
  const [recognizer, setRecognizer] = useState<KaldiRecognizer>();
  const [currentText, setCurrentText] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  // Summary state
  const [showSummary, setShowSummary] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);

  // Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pendingTextRef = useRef<string>("");
  const pauseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const transcriptionRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage } = useWebSocket();
  const { getSession } = useAuth();

  useEffect(() => {
    if (transcriptionRef.current) {
      transcriptionRef.current.scrollTop =
        transcriptionRef.current.scrollHeight;
    }
  }, [currentText]);

  // Initialize model
  useEffect(() => {
    const initializeModel = async () => {
      try {
        const loadedModel = await createModel(
          "/models/vosk-model-small-en-us-0.15.tar.gz",
        );
        const rec = new loadedModel.KaldiRecognizer(16000);
        rec.setWords(true);

        rec.on("result", (message: RecognizerMessage) => {
          if (message.event === "error") {
            console.error("Recognition error:", message.error);
            setError(message.error);
            return;
          }

          if (message.event === "result" && message.result.text) {
            setError(null);
            pendingTextRef.current += " " + message.result.text;
            setCurrentText(pendingTextRef.current.trim());
          }
        });

        rec.on("partialresult", (message: RecognizerMessage) => {
          if (
            message.event === "partialresult" &&
            message.result.partial.trim()
          ) {
            setCurrentText(
              pendingTextRef.current + " " + message.result.partial,
            );

            if (pauseTimeoutRef.current) {
              clearTimeout(pauseTimeoutRef.current);
            }

            pauseTimeoutRef.current = setTimeout(() => {
              if (pendingTextRef.current) {
                sendMessage(formatText(pendingTextRef.current));
                pendingTextRef.current = "";
                setCurrentText("");
              }
            }, 3000);
          }
        });

        setRecognizer(rec);
        setModelLoading(false);
      } catch (error) {
        console.error("Error initializing model:", error);
        setError("Failed to initialize speech recognition model");
        setModelLoading(false);
      }
    };

    initializeModel();
  }, []);

  // Handle preparation phase messages and timing
  const updateMessage = (timeLeft: number) => {
    for (let i = 0; i < MESSAGES.length; i++) {
      if (timeLeft > TOTAL_PREP_TIME - MESSAGES[i].duration) {
        setMessage(MESSAGES[i].text);
        return;
      }
    }
    // terible code, change later
    // When 4 seconds are left
    setMessage("Start when you're ready");
  };

  // Then in the useEffect:
  useEffect(() => {
    if (phase === "preparing") {
      const interval = setInterval(() => {
        setPrepTimeLeft((prev) => {
          const newTime = prev - 1;
          updateMessage(newTime);

          if (newTime <= 0) {
            clearInterval(interval);
            setPhase("ready");
            return 0;
          }
          return newTime;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [phase]);

  // Handle recording phase timing
  useEffect(() => {
    if (phase === "recording") {
      const interval = setInterval(() => {
        setRecordingTimeLeft((prev) => {
          if (prev <= 1) {
            setMessage("Time's up! Press 'Finish' when you're done");
            onTimerComplete?.();
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [phase, onTimerComplete]);

  const startRecording = async () => {
    if (!recognizer) return;

    try {
      audioContextRef.current = new AudioContext({
        sampleRate: 16000,
        latencyHint: "interactive",
      });

      await audioContextRef.current.audioWorklet.addModule(
        "/audio-processor.js",
      );

      streamRef.current = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      });

      const source = audioContextRef.current.createMediaStreamSource(
        streamRef.current,
      );
      workletNodeRef.current = new AudioWorkletNode(
        audioContextRef.current,
        "audio-processor",
      );

      workletNodeRef.current.port.onmessage = (event) => {
        const { samples } = event.data;
        if (samples.length > 0) {
          const buffer = audioContextRef.current!.createBuffer(
            1,
            samples.length,
            16000,
          );
          buffer.getChannelData(0).set(samples);
          recognizer.acceptWaveform(buffer);
        }
      };

      source.connect(workletNodeRef.current);
      workletNodeRef.current.connect(audioContextRef.current.destination);

      setPhase("recording");
      setMessage("Recording your thoughts...");
    } catch (err) {
      console.error("Error accessing microphone:", err);
      setError("Failed to access microphone");
    }
  };

  const stopRecording = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    workletNodeRef.current?.disconnect();
    if (pauseTimeoutRef.current) {
      clearTimeout(pauseTimeoutRef.current);
    }
  };

  const handleDone = () => {
    if (phase === "recording") {
      stopRecording();
      setPhase("completed");
      setMessage("Recording completed");

      // Send any remaining text
      if (pendingTextRef.current.trim()) {
        sendMessage(formatText(pendingTextRef.current));
        pendingTextRef.current = "";
        setCurrentText("");
      }
    }
  };

  const fetchSummary = async () => {
    const isAuthenticated = !!getSession();
    setShowSummary(true);
    setSummary(null);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/summary?userId=${localStorage.getItem("userId")}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${getSession()}`,
            "Content-Type": "application/json",
          },
        },
      );
      if (!response.ok) throw new Error("Failed to fetch summary");
      const data = await response.json();
      const [polishedEntry, keyPoints] = data.summary.split("\n\n");

      // Add note for unauthenticated users
      const enhancedKeyPoints = !isAuthenticated
        ? keyPoints +
          "\n\nNote: Sign in to save your journal entries and build a collection of memories."
        : keyPoints;

      setSummary({
        userId: localStorage.getItem("userId") || "",
        date: new Date().toISOString().split("T")[0],
        polishedEntry,
        keyPoints: enhancedKeyPoints,
        originalEntries: messages
          .filter((msg) => msg.type === "user")
          .map((msg) => msg.content),
      });
    } catch (error) {
      console.error("Error fetching summary:", error);
      setError("Failed to fetch summary");
    }
  };
  return (
    <div className="h-screen flex flex-col">
      {/* Messages section */}
      <div className="flex-1 p-4 overflow-hidden">
        <div className="max-w-2xl mx-auto space-y-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={message}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-xl text-center font-medium text-gray-700"
            >
              {message}
            </motion.div>
          </AnimatePresence>

          {/* This is where the code goes - replacing the existing message displays */}
          {messages.length > 0 && phase !== "preparing" && (
            <div className="w-full p-4 rounded-lg bg-blue-50">
              <p className="text-gray-600">
                {messages[messages.length - 1].content}
              </p>
            </div>
          )}

          {(phase === "recording" || phase === "completed") &&
            (messages.some((m) => m.type === "user") || currentText) && (
              <div
                ref={transcriptionRef}
                className="w-full p-4 rounded-lg bg-gray-100 h-[72px] overflow-y-auto"
              >
                <p className="text-gray-600 whitespace-pre-wrap">
                  {messages
                    .filter((msg) => msg.type === "user")
                    .map((msg) => msg.content)
                    .join(" ... ") + (currentText ? " ... " + currentText : "")}
                </p>
              </div>
            )}

          {error && (
            <Alert className="bg-red-50 border-red-200">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
      </div>

      <div className="p-4 h-[68px] flex justify-center">
        {phase === "completed" && (
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={fetchSummary}
            className="px-4 py-2 rounded-full flex items-center space-x-2 bg-green-500 hover:bg-green-600 text-white transition-colors"
          >
            <BookOpen className="w-5 h-5" />
            <span>View Summary</span>
          </motion.button>
        )}
      </div>

      {/* Controls section - positioned higher */}
      <div className="pb-6 flex flex-col items-center flex-1">
        {" "}
        {/* Reduced pb-12 to pb-6 */}
        <div className="relative">
          <motion.div
            className="w-28 h-28 rounded-full flex items-center justify-center relative" // Reduced from w-32 h-32 to w-24 h-24
            style={{
              background:
                phase === "recording"
                  ? "rgb(239, 68, 68)"
                  : "rgb(59, 130, 246)",
            }}
          >
            {(phase === "recording" || phase === "preparing") && (
              <svg viewBox="0 0 100 100" className="absolute inset-0">
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="white"
                  strokeWidth="2"
                  strokeDasharray="283"
                  strokeDashoffset={
                    283 *
                    (phase === "recording"
                      ? recordingTimeLeft / initialTime
                      : prepTimeLeft / TOTAL_PREP_TIME)
                  }
                  transform="rotate(-90 50 50)"
                />
              </svg>
            )}
            <button
              onClick={phase === "recording" ? handleDone : startRecording}
              disabled={
                phase === "preparing" || phase === "completed" || modelLoading
              }
              className="w-full h-full rounded-full flex items-center justify-center text-white hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {phase === "preparing" ? (
                <span className="text-lg font-medium">{prepTimeLeft}</span>
              ) : phase === "recording" ? (
                <span className="text-lg font-medium">
                  {recordingTimeLeft > 0 ? `${recordingTimeLeft}s` : "Finish"}
                </span>
              ) : phase === "ready" ? (
                <div className="flex items-center gap-2">
                  <Mic className="w-6 h-6" />
                  <span>Start</span>
                </div>
              ) : (
                <Mic className="w-8 h-8" />
              )}
            </button>
          </motion.div>
        </div>
      </div>

      {/* SlideOver content remains the same */}
      <SlideOver isOpen={showSummary} onClose={() => setShowSummary(false)}>
        <div className="p-6 space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-medium">Journal Summary</h2>
          </div>

          {summary ? (
            <div className="space-y-6">
              <div>
                <h3 className="font-medium mb-2">Summary</h3>
                <p className="text-gray-600">{summary.polishedEntry}</p>
              </div>

              <div>
                <h3 className="font-medium mb-2">Key Points</h3>
                <p className="text-gray-600">{summary.keyPoints}</p>
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
}
