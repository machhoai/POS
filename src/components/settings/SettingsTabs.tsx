"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CreditCard, type LucideIcon } from "lucide-react";

type SettingsTab = {
  href: string;
  label: string;
  icon: LucideIcon;
};

// Add future settings pages here to expose them in the shared tab bar.
const SETTINGS_TABS: readonly SettingsTab[] = [
  {
    href: "/settings/payment",
    label: "Thanh toán",
    icon: CreditCard,
  },
];

const SettingsTabs: React.FC = () => {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Danh mục cài đặt"
      className="shrink-0 overflow-x-auto border-b border-[var(--color-border)] bg-white px-4 sm:px-5"
    >
      <div className="flex min-w-max gap-1" role="tablist">
        {SETTINGS_TABS.map((tab) => {
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
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default SettingsTabs;
