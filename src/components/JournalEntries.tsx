// src/components/JournalEntries.tsx
"use client";

import React, { useEffect, useRef } from "react";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { Summary } from "@/types";

interface JournalEntriesProps {
  summaries: Summary[];
  isLoading: boolean;
  onLastEntryVisible: () => void;
}

export function JournalEntries({
  summaries,
  isLoading,
  onLastEntryVisible,
}: JournalEntriesProps) {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const lastSummaryRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoading) {
          onLastEntryVisible();
        }
      },
      { threshold: 0.1 },
    );

    observerRef.current = observer;
    return () => observer.disconnect();
  }, [isLoading, onLastEntryVisible]);

  useEffect(() => {
    if (lastSummaryRef.current && observerRef.current) {
      observerRef.current.observe(lastSummaryRef.current);
    }
  }, [summaries]);

  const renderSummary = (summary: Summary, isLast: boolean) => (
    <div
      key={summary.date}
      ref={isLast ? lastSummaryRef : null}
      className="py-6 border-b last:border-b-0"
    >
      <h2 className="text-lg font-medium mb-4">
        {format(new Date(summary.date), "MMMM d, yyyy")}
      </h2>
      <div className="space-y-6">
        <div>
          <h3 className="font-medium mb-2">Polished Entry</h3>
          <p className="text-gray-600">{summary.polishedEntry}</p>
        </div>

        <div>
          <h3 className="font-medium mb-2">Key Points</h3>
          <p className="text-gray-600">{summary.keyPoints}</p>
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
    </div>
  );

  return (
    <div className="p-6">
      {summaries.map((summary, index) =>
        renderSummary(summary, index === summaries.length - 1),
      )}
      {isLoading && (
        <div className="flex justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}
    </div>
  );
}
