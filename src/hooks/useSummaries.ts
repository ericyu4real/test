// src/hooks/useSummaries.ts
import { useCallback, useState } from "react";
import { Summary } from "@/types";
import { useAuth } from "@/contexts/AuthContext";

export function useSummaries() {
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { getSession } = useAuth();

  const fetchSummaries = useCallback(
    async (startDate: string, endDate: string) => {
      try {
        const token = getSession();
        console.log("Token:", token); // Add this to debug
        if (!token) {
          setError("Not authenticated");
          return;
        }

        const userId = localStorage.getItem("userId");
        console.log("UserId:", userId); // Add this to debug
        console.log("Token", token);

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/summaries?userId=${userId}&startDate=${startDate}&endDate=${endDate}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          },
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Error response:", errorText); // Add this to debug
          throw new Error(`Failed to fetch summaries: ${errorText}`);
        }

        const data = await response.json();
        setSummaries(data);
      } catch (err) {
        console.error("Fetch error:", err); // Add this to debug
        setError(
          err instanceof Error ? err.message : "Error fetching summaries",
        );
      }
    },
    [getSession],
  );

  const hasSummary = (date: string) => {
    return summaries.some((summary) => summary.date === date);
  };

  const getSummary = (date: string) => {
    return summaries.find((summary) => summary.date === date);
  };

  return {
    summaries,
    isLoading,
    error,
    fetchSummaries,
    hasSummary,
    getSummary,
  };
}
