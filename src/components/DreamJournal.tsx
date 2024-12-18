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

type Phase = "ready" | "recording" | "completed";

const formatText = (text: string): string => {
  let formatted = text.trim();
  if (formatted.length === 0) return formatted;
  formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);
  if (!/[.!?]$/.test(formatted.slice(-1))) {
    formatted += ".";
  }
  return formatted;
};

export default function DreamJournal() {
  const RECORDING_TIME = 180; // 3 minutes

  // Core state
  const [phase, setPhase] = useState<Phase>("ready");
  const [recordingTimeLeft, setRecordingTimeLeft] = useState(RECORDING_TIME);
  const [currentText, setCurrentText] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  // Model and recognition state
  const [modelLoading, setModelLoading] = useState(true);
  const [recognizer, setRecognizer] = useState<KaldiRecognizer>();

  // Summary state
  const [showSummary, setShowSummary] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);

  // Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pendingTextRef = useRef<string>("");
  const pauseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { messages, sendMessage } = useWebSocket();
  const { getSession } = useAuth();

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
            sendMessage(formatText(message.result.text));
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

  const [loadingProgress, setLoadingProgress] = useState(0);

  // Add right after the other useEffect
  useEffect(() => {
    if (modelLoading) {
      // Start at 0, approach 95% logarithmically
      let progress = 0;
      const interval = setInterval(() => {
        progress += (95 - progress) * 0.1; // Each step gets smaller
        setLoadingProgress(progress);
      }, 100);

      return () => clearInterval(interval);
    } else {
      setLoadingProgress(100); // Jump to 100% when actually loaded
    }
  }, [modelLoading]);

  // Handle recording phase timing
  useEffect(() => {
    if (phase === "recording") {
      const interval = setInterval(() => {
        setRecordingTimeLeft((prev) => {
          if (prev <= 1) {
            stopRecording();
            setPhase("completed");
            clearInterval(interval);
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [phase]);

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
    }
  };

  const fetchSummary = async () => {
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
      setSummary({
        userId: localStorage.getItem("userId") || "",
        date: new Date().toISOString().split("T")[0],
        polishedEntry,
        keyPoints,
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
      <div className="flex-1 p-4 overflow-hidden">
        <div className="max-w-2xl mx-auto space-y-4">
          <AnimatePresence mode="wait">
            <motion.div
              key="title"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-xl text-center font-medium text-gray-700"
            >
              {phase === "ready"
                ? "What was your dream?"
                : phase === "recording"
                  ? "Recording your dream..."
                  : "Recording completed"}
            </motion.div>
          </AnimatePresence>

          {phase === "recording" && currentText && (
            <div className="w-full p-4 rounded-lg bg-gray-100">
              <p className="text-gray-600">{currentText}</p>
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

      <div className="pb-6 flex flex-col items-center flex-1">
        <div className="relative">
          <motion.div
            className="w-28 h-28 rounded-full flex items-center justify-center relative"
            style={{
              background:
                phase === "recording"
                  ? "rgb(239, 68, 68)"
                  : "rgb(59, 130, 246)",
            }}
          >
            {phase === "recording" && (
              <svg viewBox="0 0 100 100" className="absolute inset-0">
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="white"
                  strokeWidth="2"
                  strokeDasharray="283"
                  strokeDashoffset={283 * (recordingTimeLeft / RECORDING_TIME)}
                  transform="rotate(-90 50 50)"
                />
              </svg>
            )}
            <button
              onClick={phase === "recording" ? handleDone : startRecording}
              disabled={phase === "completed" || modelLoading}
              className="w-full h-full rounded-full flex items-center justify-center text-white hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {modelLoading ? (
                <div className="relative w-16 h-16">
                  <svg className="absolute inset-0" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r="45"
                      fill="none"
                      stroke="#E2E8F0"
                      strokeWidth="6"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="45"
                      fill="none"
                      stroke="white"
                      strokeWidth="6"
                      strokeDasharray="283"
                      strokeDashoffset={283 * ((100 - loadingProgress) / 100)}
                      transform="rotate(-90 50 50)"
                      className="transition-all duration-300"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center text-white text-sm">
                    {Math.round(loadingProgress)}%
                  </div>
                </div>
              ) : phase === "recording" ? (
                <span className="text-lg font-medium">
                  {recordingTimeLeft}s
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

      <SlideOver isOpen={showSummary} onClose={() => setShowSummary(false)}>
        <div className="p-6 space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-medium">Dream Summary</h2>
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
