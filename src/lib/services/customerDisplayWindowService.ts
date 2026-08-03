import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

const CUSTOMER_DISPLAY_WARNING_EVENT = "customer-display-warning";

export type CustomerDisplayOpenStatus =
  | "OPENED"
  | "ALREADY_OPEN"
  | "NO_SECONDARY_MONITOR";

export async function openCustomerDisplayWindow(): Promise<
  CustomerDisplayOpenStatus | null
> {
  if (!isTauri()) return null;
  return invoke<CustomerDisplayOpenStatus>("open_customer_display");
}

export async function listenCustomerDisplayWarning(
  callback: (message: string) => void,
): Promise<UnlistenFn | null> {
  if (!isTauri()) return null;
  return listen<string>(CUSTOMER_DISPLAY_WARNING_EVENT, (event) => {
    callback(event.payload);
  });
}
