// src/components/JournalHistory.tsx
"use client";

import { useState, useEffect } from "react";
import { Calendar } from "@/components/ui/calendar";
import { SlideOver } from "@/components/SlideOver";
import { format } from "date-fns";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";
import { useSummaries } from "@/hooks/useSummaries";

// Helper functions to replace startOfMonth and endOfMonth
const getFirstDayOfMonth = (date: Date) => {
  return new Date(date.getFullYear(), date.getMonth(), 1);
};

const getLastDayOfMonth = (date: Date) => {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
};

export default function JournalHistory() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [isSlideOverOpen, setIsSlideOverOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const { isLoading, error, fetchSummaries, hasSummary, getSummary } =
    useSummaries();

  useEffect(() => {
    const start = format(getFirstDayOfMonth(currentMonth), "yyyy-MM-dd");
    const end = format(getLastDayOfMonth(currentMonth), "yyyy-MM-dd");
    fetchSummaries(start, end);
  }, [currentMonth, fetchSummaries]);

  const hasEntries = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return hasSummary(dateStr);
  };

  const getSelectedSummary = () => {
    if (!selectedDate) return null;
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    return getSummary(dateStr);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col justify-center h-screen">
      {error && (
        <Alert className="mx-auto mb-4 max-w-md">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="mx-auto p-4 flex w-full flex-row justify-center mb-9">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(date) => {
            setSelectedDate(date);
            if (date) {
              setIsSlideOverOpen(true);
            }
          }}
          onMonthChange={setCurrentMonth}
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
        onClose={() => setIsSlideOverOpen(false)}
      >
        <div className="p-6">
          <h2 className="text-lg font-medium mb-4">
            {selectedDate ? format(selectedDate, "MMMM d, yyyy") : ""}
          </h2>
          {getSelectedSummary() ? (
            <div className="space-y-6">
              <div>
                <h3 className="font-medium mb-2">Polished Entry</h3>
                <p className="text-gray-600">
                  {getSelectedSummary()?.polishedEntry}
                </p>
              </div>

              <div>
                <h3 className="font-medium mb-2">Key Points</h3>
                <p className="text-gray-600">
                  {getSelectedSummary()?.keyPoints}
                </p>
              </div>

              <div>
                <h3 className="font-medium mb-2">Original Entries</h3>
                <div className="space-y-2">
                  {getSelectedSummary()?.originalEntries.map((entry, index) => (
                    <p key={index} className="text-gray-600">
                      {entry}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-gray-500">No entries for this date.</p>
          )}
        </div>
      </SlideOver>
    </div>
  );
}
