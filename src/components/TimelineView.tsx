// src/components/TimelineView.tsx
import React, { useEffect, useRef } from "react";
import { format } from "date-fns";
import { Summary } from "@/types";
import { useInView } from "react-intersection-observer";
import { Loader2 } from "lucide-react";

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
  const containerRef = useRef<HTMLDivElement>(null);
  const [topRef, topInView] = useInView();
  const [bottomRef, bottomInView] = useInView();
  const [dates, setDates] = React.useState<string[]>(() => {
    if (!selectedDate) return [];
    const date = new Date(selectedDate);
    const result = [];
    const today = format(new Date(), "yyyy-MM-dd");
    // Load 15 days before and after selected date
    for (let i = -15; i <= 15; i++) {
      const currentDate = new Date(date);
      currentDate.setDate(date.getDate() + i);
      const formated = format(currentDate, "yyyy-MM-dd");
      // Don't load dates beyond today
      if (formated <= today) {
        console.log("inserting", formated);
        result.push(formated);
      }
    }
    return result.reverse(); // Most recent first
  });

  // Position the scroll on mount
  useEffect(() => {
    if (!selectedDate || !containerRef.current) return;

    const selectedElement = document.getElementById(`date-${selectedDate}`);
    if (selectedElement && containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const elementRect = selectedElement.getBoundingClientRect();

      // Position the selected date in the middle of the container
      containerRef.current.scrollTop =
        elementRect.top -
        containerRect.top -
        (containerRect.height - elementRect.height) / 2;
    }
  }, [selectedDate]);

  // Load more dates when scrolling to top
  useEffect(() => {
    if (topInView && dates.length > 0) {
      const oldestDate = new Date(dates[dates.length - 1]);
      const newDates: string[] = [];
      for (let i = 1; i <= 7; i++) {
        const currentDate = new Date(oldestDate);
        currentDate.setDate(oldestDate.getDate() - i);
        newDates.push(format(currentDate, "yyyy-MM-dd"));
      }
      setDates((prev) => [...prev, ...newDates]);
    }
  }, [topInView]);

  // Load more dates when scrolling to bottom
  useEffect(() => {
    if (bottomInView && dates.length > 0) {
      const newestDate = new Date(dates[0]);
      const today = new Date();
      const newDates: string[] = [];

      for (let i = 1; i <= 7; i++) {
        const currentDate = new Date(newestDate);
        currentDate.setDate(newestDate.getDate() + i);
        if (currentDate <= today) {
          newDates.push(format(currentDate, "yyyy-MM-dd"));
        }
      }
      setDates((prev) => [...newDates.reverse(), ...prev]);
    }
  }, [bottomInView]);

  return (
    <div ref={containerRef} className="space-y-8 p-4 h-full overflow-y-auto">
      {/* Top loader */}
      <div ref={bottomRef} className="py-2 flex justify-center">
        {bottomInView &&
          dates[0] &&
          (() => {
            console.log("All dates:", dates); // Add this to see full array
            const today = format(new Date(), "yyyy-MM-dd");
            const latestLoadedDate = dates[0];
            console.log("comp", latestLoadedDate, today);
            return latestLoadedDate !== today;
          })() && <Loader2 className="h-6 w-6 animate-spin" />}
      </div>

      {dates.map((date) => {
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

      {/* Bottom loader */}
      <div ref={topRef} className="py-2 flex justify-center">
        {topInView && dates.length > 0 && (
          <Loader2 className="h-6 w-6 animate-spin" />
        )}
      </div>
    </div>
  );
}
