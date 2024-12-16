// src/components/TimelineView.tsx
import React, { useEffect, useRef, useState } from "react";
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
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const prevHeightRef = useRef<number>(0);
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
        result.push(formated);
      }
    }
    return result.reverse(); // Most recent first
  });

  // Position the scroll on mount and maintain position when adding items
  useEffect(() => {
    if (!selectedDate || !containerRef.current) return;

    const selectedElement = document.getElementById(`date-${selectedDate}`);
    if (selectedElement && containerRef.current) {
      requestAnimationFrame(() => {
        if (containerRef.current) {
          selectedElement.scrollIntoView();

          // Store initial height after positioning
          prevHeightRef.current = containerRef.current.scrollHeight;

          // Allow loading more items after initial positioning with delay
          setTimeout(() => {
            setIsInitialLoad(false);
          }, 100);
        }
      });
    }
  }, [selectedDate]);

  // Maintain scroll position when adding new items at the top
  useEffect(() => {
    if (!containerRef.current || isInitialLoad) return;

    const heightDiff =
      containerRef.current.scrollHeight - prevHeightRef.current;
    if (heightDiff > 0) {
      containerRef.current.scrollTop += heightDiff;
    }
    prevHeightRef.current = containerRef.current.scrollHeight;
  }, [dates]);

  // Load more dates when scrolling to top
  useEffect(() => {
    if (topInView && dates.length > 0 && !isInitialLoad) {
      console.log("peering into the top");
      const oldestDate = new Date(dates[dates.length - 1]);
      const newDates: string[] = [];
      for (let i = 1; i <= 7; i++) {
        const currentDate = new Date(oldestDate);
        currentDate.setDate(oldestDate.getDate() - i);
        newDates.push(format(currentDate, "yyyy-MM-dd"));
      }
      setDates((prev) => [...prev, ...newDates]);
    }
  }, [topInView, isInitialLoad]);

  // Load more dates when scrolling to bottom
  useEffect(() => {
    if (bottomInView && dates.length > 0 && !isInitialLoad) {
      console.log("peering into the bot");
      const newestDate = new Date(dates[0]);
      const today = format(new Date(), "yyyy-MM-dd");
      const newDates: string[] = [];

      for (let i = 1; i <= 7; i++) {
        const currentDate = new Date(newestDate);
        currentDate.setDate(newestDate.getDate() + i + 1);
        const formated = format(currentDate, "yyyy-MM-dd");
        if (formated <= today) {
          newDates.push(formated);
        }
      }

      newDates.reverse();

      setDates((prev) => [...newDates, ...prev]);
    }
  }, [bottomInView, isInitialLoad]);

  return (
    <div ref={containerRef} className="space-y-8 p-4 h-full overflow-y-auto">
      {/* Top loader */}
      <div ref={bottomRef} className="py-2 flex justify-center">
        {bottomInView &&
          dates[0] &&
          !isInitialLoad &&
          (() => {
            const today = format(new Date(), "yyyy-MM-dd");
            const latestLoadedDate = dates[0];
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
                <div className="space-y-4">
                  <div>
                    <p className="text-gray-600">
                      {summaries[0].polishedEntry}
                    </p>
                  </div>
                </div>
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
        {topInView && dates.length > 0 && !isInitialLoad && (
          <Loader2 className="h-6 w-6 animate-spin" />
        )}
      </div>
    </div>
  );
}
