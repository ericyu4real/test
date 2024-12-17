// src/components/VoiceJournal.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import { createModel, KaldiRecognizer, Model } from "vosk-browser";
import { RecognizerMessage } from "vosk-browser/dist/interfaces";
import { Timer, Mic, MicOff, BookOpen } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SlideOver } from "@/components/SlideOver";
import { useWebSocket } from "../hooks/useWebSocket";
import { Summary } from "@/types";
import { useAuth } from "@/contexts/AuthContext";

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

interface VoiceJournalProps {
  initialTime?: number;
  onTimerComplete?: () => void;
}

export default function VoiceJournal({
  initialTime = 60,
  onTimerComplete,
}: VoiceJournalProps) {
  const [recognizer, setRecognizer] = useState<KaldiRecognizer>();
  const [model, setModel] = useState<Model>();
  const [error, setError] = useState<string | null>(null);
  const [currentText, setCurrentText] = useState<string>("");
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const { isConnected, messages, sendMessage } = useWebSocket();
  const pendingTextRef = useRef<string>("");

  // Timer and control states
  const [isListening, setIsListening] = useState(false);
  const [timeLeft, setTimeLeft] = useState(initialTime);
  const [timerActive, setTimerActive] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const pauseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastProcessedLengthRef = useRef<number>(0);
  const [modelLoading, setModelLoading] = useState(true);
  const modelLoadingRef = useRef<boolean>(true);
  const { getSession } = useAuth();

  useEffect(() => {
    const initializeModel = async () => {
      try {
        console.log("Starting model initialization");
        const loadedModel = await createModel(
          "/models/vosk-model-small-en-us-0.15.tar.gz",
        );
        setModel(loadedModel);

        const rec = new loadedModel.KaldiRecognizer(16000);
        rec.setWords(true);

        rec.on("result", (message: RecognizerMessage) => {
          if (message.event === "error") {
            console.error("Recognition error:", message.error);
            setError(message.error);
            return;
          }

          if (message.event === "result") {
            setError(null);
            const text = message.result.text;
            if (text) {
              pendingTextRef.current += " " + text;
              setCurrentText(pendingTextRef.current.trim());
            }
          }
        });

        rec.on("partialresult", (message: RecognizerMessage) => {
          if (
            message.event === "partialresult" &&
            message.result.partial.trim()
          ) {
            console.log("partial", message.result.partial);
            setCurrentText(
              pendingTextRef.current + " " + message.result.partial,
            );

            if (pauseTimeoutRef.current) {
              clearTimeout(pauseTimeoutRef.current);
            }

            pauseTimeoutRef.current = setTimeout(() => {
              if (pendingTextRef.current) {
                const formattedText = formatText(pendingTextRef.current);
                sendMessage(formattedText);
                pendingTextRef.current = "";
                setCurrentText("");
              }
            }, 1500);
          }
        });

        setRecognizer(rec);
        setModelLoading(false);
        modelLoadingRef.current = false;
        console.log("Model initialization complete");
      } catch (error) {
        console.error("Error initializing model:", error);
        setError("Failed to initialize speech recognition model");
        setModelLoading(false);
        modelLoadingRef.current = false;
      }
    };

    initializeModel();

    return () => {
      model?.terminate();
    };
  }, []);

  const startListening = async () => {
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

      setIsListening(true);
      setTimerActive(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      setError("Failed to access microphone");
    }
  };

  const stopListening = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    workletNodeRef.current?.disconnect();
    setIsListening(false);
    setTimerActive(false);
    if (pauseTimeoutRef.current) {
      clearTimeout(pauseTimeoutRef.current);
    }
    lastProcessedLengthRef.current = 0; // Reset the processed length
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timerActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((time) => {
          if (time <= 1) {
            stopListening();
            onTimerComplete?.();
          }
          return time - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerActive, timeLeft, onTimerComplete]);

  const fetchSummary = async () => {
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
      setShowSummary(true);
    } catch (error) {
      console.error("Error fetching summary:", error);
      setError("Failed to fetch summary");
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <div className="flex flex-col items-center space-y-4">
        <div className="text-4xl font-bold">{formatTime(timeLeft)}</div>

        <button
          onClick={isListening ? stopListening : startListening}
          disabled={modelLoading}
          className={`px-6 py-3 rounded-full flex items-center space-x-2 ${
            isListening
              ? "bg-red-500 hover:bg-red-600"
              : modelLoading
                ? "bg-gray-400"
                : "bg-blue-500 hover:bg-blue-600"
          } text-white transition-colors`}
        >
          {isListening ? (
            <>
              <MicOff className="w-5 h-5" />
              <span>Stop</span>
            </>
          ) : (
            <>
              <Mic className="w-5 h-5" />
              <span>{modelLoading ? "Loading..." : "Start"}</span>
            </>
          )}
        </button>

        {timeLeft === 0 && (
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

        {error && (
          <Alert className="bg-red-50 border-red-200">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {isListening && currentText && (
          <Alert className="bg-blue-50 border-blue-200">
            <Timer className="w-4 h-4" />
            <AlertDescription>Listening... {currentText}</AlertDescription>
          </Alert>
        )}
      </div>

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
            {/* <button
              onClick={() => setShowSummary(false)}
              className="text-gray-400 hover:text-gray-500"
            >
              <span className="sr-only">Close panel</span>
              <X className="h-6 w-6" />
            </button> */}
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
                  {summary.originalEntries.map(
                    (entry: string, index: number) => (
                      <p key={index} className="text-gray-600">
                        {entry}
                      </p>
                    ),
                  )}
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
}
