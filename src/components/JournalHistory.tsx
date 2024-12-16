"use client";

import { useState, useEffect } from "react";
import { Calendar } from "@/components/ui/calendar";
import { SlideOver } from "@/components/SlideOver";
import { format, addDays, subDays } from "date-fns";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";
import { useSummaries } from "@/hooks/useSummaries";
import { useJournalDates } from "@/hooks/useJournalDates";
import { TimelineView } from "./TimelineView";

export default function JournalHistory() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [isSlideOverOpen, setIsSlideOverOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());

  const {
    isLoading: isSummaryLoading,
    error: summaryError,
    fetchSummaries,
    summariesMap,
  } = useSummaries();
  const { markedDates, error: datesError, fetchDates } = useJournalDates();

  // Fetch dates for a larger range initially
  useEffect(() => {
    const start = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      1,
    );
    const end = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth() + 1,
      0,
    );
    fetchDates(format(start, "yyyy-MM-dd"), format(end, "yyyy-MM-dd"));
  }, [fetchDates, currentMonth]);

  // Fetch summaries only when a date is selected
  useEffect(() => {
    if (selectedDate) {
      const start = subDays(selectedDate, 15);
      const end = addDays(selectedDate, 15);
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
    return markedDates.has(format(date, "yyyy-MM-dd"));
  };

  const error = summaryError || datesError;

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
        {/* {isDatesLoading ? (
          <div className="flex items-center justify-center h-[350px] w-[350px]">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : ( */}
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleDateSelect}
          month={currentMonth}
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
        {/* )} */}
      </div>

      <SlideOver
        isOpen={isSlideOverOpen}
        onClose={() => {
          setIsSlideOverOpen(false);
          setSelectedDate(undefined);
        }}
      >
        {isSummaryLoading ? (
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
