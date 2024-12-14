// src/app/history/page.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import JournalHistory from "@/components/JournalHistory";
import { useAuth } from "@/contexts/AuthContext";

export default function HistoryPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/");
    }
  }, [isAuthenticated, isLoading, router]);

  // If still loading or not authenticated, don't show content
  if (isLoading || !isAuthenticated) {
    return null;
  }

  // This is temporary mock data - we'll replace it with real data later
  const mockEntries = {
    "2024-12-13": [
      {
        content: "Sample journal entry for today",
        timestamp: new Date(),
      },
    ],
  };

  return <JournalHistory entries={mockEntries} />;
}
