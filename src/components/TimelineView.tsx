// src/components/TimelineView.tsx
import React, { useEffect } from "react";
import { format } from "date-fns";
import { Summary } from "@/types";

interface TimelineViewProps {
  summariesMap: {
    [date: string]: Summary[];
  };
  selectedDate?: string;
}

export function TimelineView({
  summariesMap,
  selectedDate,
}: TimelineViewProps) {
  const allDates = [...Array(31)].map((_, i) => {
    const date = new Date(selectedDate || new Date());
    date.setDate(date.getDate() + 15 - i); // Changed from -15 + i
    return format(date, "yyyy-MM-dd");
  });

  useEffect(() => {
    if (selectedDate) {
      const element = document.getElementById(`date-${selectedDate}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }, [selectedDate]);

  return (
    <div className="space-y-8 p-4">
      {allDates.map((date) => {
        const summaries = summariesMap[date] || [];
        return (
          <div key={date} id={`date-${date}`} className="space-y-4">
            <div className="sticky top-0 bg-white py-2">
              <h2 className="text-lg font-medium">
                {format(new Date(date + "T00:00:00"), "MMMM d, yyyy")}
              </h2>
              <hr className="mt-2" />
            </div>

            {summaries.length > 0 ? (
              <div className="space-y-8 pl-4">
                {summaries.map((summary, idx) => (
                  <div key={idx} className="space-y-4">
                    <div>
                      <h3 className="font-medium">Entry {idx + 1}</h3>
                      <p className="text-gray-600">{summary.polishedEntry}</p>
                    </div>
                    <div>
                      <h3 className="font-medium">Original Entries</h3>
                      <div className="space-y-2">
                        {summary.originalEntries.map((entry, index) => (
                          <p key={index} className="text-gray-600">
                            {entry}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="pl-4">
                <p className="text-gray-400">No entries for this day</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
