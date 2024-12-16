// src/hooks/useSummaries.ts
import { useCallback, useState } from "react";
import { Summary } from "@/types";
import { useAuth } from "@/contexts/AuthContext";

// src/hooks/useSummaries.ts
interface SummaryMap {
  [date: string]: Summary[];
}

export function useSummaries() {
  const [summariesMap, setSummariesMap] = useState<SummaryMap>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { getSession } = useAuth();

  const fetchSummaries = useCallback(
    async (startDate: string, endDate: string) => {
      setIsLoading(true);
      try {
        const token = getSession();
        if (!token) {
          setError("Not authenticated");
          setIsLoading(false);
          return;
        }

        const userId = localStorage.getItem("userId");
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/summaries?userId=${userId}&startDate=${startDate}&endDate=${endDate}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        if (!response.ok) throw new Error(await response.text());

        const data = await response.json();
        setSummariesMap(() => {
          // Changed from prev => {...}
          const newMap: SummaryMap = {};
          data.forEach((summary: Summary) => {
            if (!newMap[summary.date]) {
              newMap[summary.date] = [];
            }
            newMap[summary.date].push(summary);
          });

          // Sort entries by timestamp
          Object.keys(newMap).forEach((date) => {
            newMap[date].sort(
              (a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0),
            );
          });

          return newMap;
        });
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Error fetching summaries",
        );
      } finally {
        setIsLoading(false);
      }
    },
    [getSession],
  );

  const hasSummary = (date: string) => {
    return !!summariesMap[date]?.length;
  };

  const getSummariesForDate = (date: string) => {
    return summariesMap[date] || [];
  };

  return {
    summariesMap,
    isLoading,
    error,
    fetchSummaries,
    hasSummary,
    getSummariesForDate,
  };
}
