"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { recordPendingFailure } from "@/lib/services/checkoutJournalService";

interface CheckoutSafetyBoundaryProps {
  children: ReactNode;
  fallback: (retry: () => void) => ReactNode;
}

interface CheckoutSafetyBoundaryState {
  failed: boolean;
}

class CheckoutSafetyBoundary extends Component<
  CheckoutSafetyBoundaryProps,
  CheckoutSafetyBoundaryState
> {
  state: CheckoutSafetyBoundaryState = { failed: false };

  static getDerivedStateFromError(): CheckoutSafetyBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[Thanh toán an toàn] Vùng checkout gặp lỗi:", error, info);
    void recordPendingFailure("RENDER_ERROR", error, {
      source: "checkout-boundary",
      componentStack: info.componentStack?.slice(0, 2000) ?? null,
    });
  }

  private retry = (): void => {
    this.setState({ failed: false });
  };

  render(): ReactNode {
    if (this.state.failed) return this.props.fallback(this.retry);
    return this.props.children;
  }
}

export default CheckoutSafetyBoundary;
