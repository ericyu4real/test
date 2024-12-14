"use client";

import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { SlideOver } from "@/components/SlideOver";
import { format } from "date-fns";

interface HistoryEntry {
  content: string;
  timestamp: Date;
}

interface JournalHistoryProps {
  // We'll expand this later with actual data
  entries: {
    [date: string]: HistoryEntry[];
  };
}

export default function JournalHistory({ entries }: JournalHistoryProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [isSlideOverOpen, setIsSlideOverOpen] = useState(false);

  // Function to handle date selection
  const handleSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    if (date) {
      setIsSlideOverOpen(true);
    }
  };

  // Function to check if a date has entries
  const hasEntries = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return !!entries[dateStr]?.length;
  };

  // Get entries for selected date
  const getSelectedEntries = () => {
    if (!selectedDate) return [];
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    return entries[dateStr] || [];
  };

  return (
    <div className="flex flex-col justify-center h-screen">
      <div className="mx-auto p-4 flex w-full flex-row justify-center mb-9">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleSelect}
          modifiers={{ hasEntry: (date) => hasEntries(date) }}
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
          <div className="space-y-4">
            {getSelectedEntries().map((entry, index) => (
              <div key={index} className="p-4 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-500 mb-2">
                  {format(entry.timestamp, "h:mm a")}
                </div>
                <p className="text-gray-700">{entry.content}</p>
              </div>
            ))}
          </div>
        </div>
      </SlideOver>
    </div>
  );
}
