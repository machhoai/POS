"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CreditCard, Megaphone, Printer, ReceiptText, Settings2, TicketCheck, type LucideIcon } from "lucide-react";
import { useSettingsAccess, type SettingsAccessGroup } from "@/features/settings/hooks/useSettingsAccess";
import { useUpdater } from "@/features/updater/components/UpdateProvider";

type SettingsTab = {
  href: string;
  label: string;
  icon: LucideIcon;
  accessGroup: SettingsAccessGroup;
  showsUpdateBadge?: boolean;
};

// Add future settings pages here to expose them in the shared tab bar.
const SETTINGS_TABS: readonly SettingsTab[] = [
  {
    href: "/settings/printer",
    label: "Máy in",
    icon: Printer,
    accessGroup: "public",
  },
  {
    href: "/settings/receipt",
    label: "In biên lai",
    icon: ReceiptText,
    accessGroup: "general",
  },
  {
    href: "/settings/ticket",
    label: "In vé",
    icon: TicketCheck,
    accessGroup: "general",
  },
  {
    href: "/settings/payment",
    label: "Thanh toán",
    icon: CreditCard,
    accessGroup: "general",
  },
  {
    href: "/settings/advertising",
    label: "Quảng cáo",
    icon: Megaphone,
    accessGroup: "advertising",
  },
  {
    href: "/settings/system",
    label: "Hệ thống",
    icon: Settings2,
    accessGroup: "public",
    showsUpdateBadge: true,
  },
];

const SettingsTabs: React.FC = () => {
  const pathname = usePathname();
  const { canAccessGroup } = useSettingsAccess();
  const updater = useUpdater();
  const hasAvailableUpdate = updater.availableVersion !== null;
  const visibleTabs = SETTINGS_TABS.filter((tab) => canAccessGroup(tab.accessGroup));

  return (
    <nav
      aria-label="Danh mục cài đặt"
      className="shrink-0 overflow-x-auto border-b border-[var(--color-border)] bg-white px-4 sm:px-5"
    >
      <div className="flex min-w-max gap-1" role="tablist">
        {visibleTabs.map((tab) => {
          const isActive = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          const Icon = tab.icon;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              role="tab"
              aria-selected={isActive}
              className={`relative inline-flex min-h-12 items-center gap-2 px-3 text-sm font-bold transition-colors after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:transition-colors ${
                isActive
                  ? "text-[var(--color-accent)] after:bg-[var(--color-accent)]"
                  : "text-[var(--color-text-muted)] after:bg-transparent hover:text-[var(--color-text-primary)]"
              }`}
            >
              <Icon className="size-4" aria-hidden="true" />
              {tab.label}
              {tab.showsUpdateBadge && hasAvailableUpdate && (
                <span
                  className="size-2 rounded-full bg-red-500 shadow-[0_0_0_3px_rgba(239,68,68,0.14)]"
                  aria-label="Có bản cập nhật JPOS mới"
                />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default SettingsTabs;
