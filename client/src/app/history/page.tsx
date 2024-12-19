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

  return <JournalHistory/>;
}
