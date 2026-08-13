import type { ReactNode } from "react";
import SettingsAccessGate from "@/features/settings/components/SettingsAccessGate";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return <SettingsAccessGate>{children}</SettingsAccessGate>;
}
