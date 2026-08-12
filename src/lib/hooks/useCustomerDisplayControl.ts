"use client";

import { useEffect, useState } from "react";

import {
  listenCustomerDisplayControl,
} from "@/lib/services/customerDisplayControlBridge";
import {
  DEFAULT_CUSTOMER_DISPLAY_CONTROL,
  type CustomerDisplayControlState,
} from "@/lib/types/customerDisplayControl";

export function useCustomerDisplayControl(): CustomerDisplayControlState {
  const [control, setControl] = useState<CustomerDisplayControlState>(
    DEFAULT_CUSTOMER_DISPLAY_CONTROL,
  );

  useEffect(() => {
    let disposed = false;
    let stopListening: (() => void) | null = null;

    void listenCustomerDisplayControl((nextControl) => {
      if (!disposed) setControl(nextControl);
    }).then((stop) => {
      if (disposed) stop();
      else stopListening = stop;
    });

    return () => {
      disposed = true;
      stopListening?.();
    };
  }, []);

  return control;
}
