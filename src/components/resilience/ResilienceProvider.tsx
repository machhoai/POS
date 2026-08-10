"use client";

import { useEffect, type ReactNode } from "react";
import { recordPendingFailure } from "@/lib/services/checkoutJournalService";

interface ResilienceProviderProps {
  children: ReactNode;
}

const ResilienceProvider: React.FC<ResilienceProviderProps> = ({ children }) => {
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      void recordPendingFailure(
        "UNHANDLED_ERROR",
        event.error ?? event.message,
        { source: "window.error" },
      );
    };
    const handleRejection = (event: PromiseRejectionEvent) => {
      void recordPendingFailure(
        "UNHANDLED_REJECTION",
        event.reason,
        { source: "window.unhandledrejection" },
      );
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);
    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  return children;
};

export default ResilienceProvider;
