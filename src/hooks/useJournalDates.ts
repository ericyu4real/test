// src/hooks/useJournalDates.ts
import { useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";

export function useJournalDates() {
  const [markedDates, setMarkedDates] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { getSession } = useAuth();

  const fetchDates = useCallback(
    async (startDate: string, endDate: string) => {
      setIsLoading(true);
      try {
        const token = getSession();
        if (!token) {
          setError("Not authenticated");
          return;
        }

        const userId = localStorage.getItem("userId");
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/summary-dates?userId=${userId}&startDate=${startDate}&endDate=${endDate}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        if (!response.ok) throw new Error(await response.text());

        const dates = await response.json();
        setMarkedDates(new Set(dates));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error fetching dates");
      } finally {
        setIsLoading(false);
      }
    },
    [getSession],
  );

  return {
    markedDates,
    isLoading,
    error,
    fetchDates,
  };
}
