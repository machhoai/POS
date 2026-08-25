import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase/client";
import { withDeviceAuth } from "@/lib/services/deviceEnrollmentService";
import type {
  LuckyDrawSettings,
  LuckyDrawSettingsInput,
} from "@/features/lucky-draw/types/luckyDraw";

export async function getLuckyDrawSettings(
  warehouseId: string,
): Promise<LuckyDrawSettings | null> {
  const callable = httpsCallable<
    { action: "getLuckyDrawSettings"; payload: { warehouseId: string } },
    { settings: LuckyDrawSettings | null }
  >(functions, "getPosAuthSession");
  const result = await callable(await withDeviceAuth({
    action: "getLuckyDrawSettings" as const,
    payload: { warehouseId },
  }));
  return result.data.settings;
}

export async function saveLuckyDrawSettings(
  input: LuckyDrawSettingsInput,
): Promise<LuckyDrawSettings> {
  const callable = httpsCallable<
    { action: "saveLuckyDrawSettings"; payload: LuckyDrawSettingsInput },
    { settings: LuckyDrawSettings }
  >(functions, "getPosAuthSession");
  const result = await callable(await withDeviceAuth({
    action: "saveLuckyDrawSettings" as const,
    payload: input,
  }));
  return result.data.settings;
}
