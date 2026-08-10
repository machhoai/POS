import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase/client";
import type {
  FixedTransferSettings,
  FixedTransferSettingsInput,
} from "@/lib/types/paymentSettings";
import { withDeviceAuth } from "@/lib/services/deviceEnrollmentService";
import { cachePaymentSettings, loadCachedPaymentSettings } from "@/lib/services/paymentSettingsCacheService";

export async function getFixedTransferSettings(
  warehouseId: string,
): Promise<FixedTransferSettings | null> {
  const callable = httpsCallable<
    {
      action: "get-fallback-settings";
      payload: { warehouseId: string };
    },
    { settings: FixedTransferSettings | null }
  >(functions, "payosPayment");
  try {
    const result = await callable(await withDeviceAuth({
      action: "get-fallback-settings" as const,
      payload: { warehouseId },
    }));
    if (result.data.settings) cachePaymentSettings(result.data.settings);
    return result.data.settings;
  } catch (error) {
    const cached = loadCachedPaymentSettings(warehouseId);
    if (cached) return cached;
    throw error;
  }
}

export async function saveFixedTransferSettings(
  input: FixedTransferSettingsInput,
): Promise<FixedTransferSettings> {
  const callable = httpsCallable<
    {
      action: "save-fallback-settings";
      payload: FixedTransferSettingsInput;
    },
    { settings: FixedTransferSettings }
  >(functions, "payosPayment");
  const result = await callable(await withDeviceAuth({
    action: "save-fallback-settings" as const,
    payload: input,
  }));
  cachePaymentSettings(result.data.settings);
  return result.data.settings;
}
