// src/components/JournalHistory.tsx
"use client";

import { useState, useEffect } from "react";
import { Calendar } from "@/components/ui/calendar";
import { SlideOver } from "@/components/SlideOver";
import { format } from "date-fns";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";
import { useSummaries } from "@/hooks/useSummaries";
import { TimelineView } from "./TimelineView";

export default function JournalHistory() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [isSlideOverOpen, setIsSlideOverOpen] = useState(false);

  const { isLoading, error, fetchSummaries, hasSummary, summariesMap } =
    useSummaries();

  useEffect(() => {
    if (selectedDate) {
      const start = new Date(selectedDate);
      const end = new Date(selectedDate);
      start.setDate(start.getDate() - 15);
      end.setDate(end.getDate() + 15);

      fetchSummaries(format(start, "yyyy-MM-dd"), format(end, "yyyy-MM-dd"));
    }
  }, [fetchSummaries, selectedDate]);

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    if (date) {
      setIsSlideOverOpen(true);
    }
  };

  const hasEntries = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return hasSummary(dateStr);
  };

  return (
    <div className="flex flex-col justify-center h-screen">
      {error && (
        <Alert className="mx-auto mb-4 max-w-md">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div
        className={`mx-auto p-4 flex w-full flex-row justify-center mb-9 ${isSlideOverOpen ? "z-[-1] relative" : ""}`}
      >
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleDateSelect}
          modifiers={{ hasEntry: hasEntries }}
          modifiersStyles={{
            hasEntry: {
              textDecoration: "underline",
              fontWeight: "bold",
            },
          }}
          className="rounded-md border"
        />
      </div>

      <SlideOver
        isOpen={isSlideOverOpen}
        onClose={() => {
          setIsSlideOverOpen(false);
          setSelectedDate(undefined);
        }}
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <TimelineView
            summariesMap={summariesMap}
            selectedDate={selectedDate && format(selectedDate, "yyyy-MM-dd")}
          />
        )}
      </SlideOver>
    </div>
  );
}
