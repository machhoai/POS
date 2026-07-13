"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface SidebarProps {
  onLogout: () => void;
}

const NAV_ITEMS = [
  {
    href: "/",
    label: "Bán hàng",
    path: "M3.75 21V9.35m0 0a3 3 0 0 0 3.75-.62A3 3 0 0 0 9.75 9.75 3 3 0 0 0 12 8.73a3 3 0 0 0 2.25 1.02 3 3 0 0 0 2.25-1.02 3 3 0 0 0 3.75.62m-16.5 0a3 3 0 0 1-.62-4.72l1.19-1.19A1.5 1.5 0 0 1 5.38 3h13.24a1.5 1.5 0 0 1 1.06.44l1.19 1.19a3 3 0 0 1-.62 4.72M6.75 18h3.75v-5.25H6.75V18Zm6.75 3v-7.5h4.5V21",
  },
  {
    href: "/orders",
    label: "Đơn hàng",
    path: "M9 12h6m-6 3h6m2.25 6H6.75A2.25 2.25 0 0 1 4.5 18.75V5.25A2.25 2.25 0 0 1 6.75 3h7.88c.6 0 1.17.24 1.59.66l2.37 2.37c.42.42.66 1 .66 1.59v11.13A2.25 2.25 0 0 1 17.25 21Z",
  },
  {
    href: "/display",
    label: "Màn hình khách",
    path: "M2.25 5.25A2.25 2.25 0 0 1 4.5 3h15a2.25 2.25 0 0 1 2.25 2.25v10.5A2.25 2.25 0 0 1 19.5 18h-15a2.25 2.25 0 0 1-2.25-2.25V5.25ZM8.25 21h7.5M12 18v3",
  },
];

export default function Sidebar({ onLogout }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="w-[72px] bg-white border-r border-[var(--color-border)] flex flex-col items-center py-5 shrink-0 z-10">
      <div
        className="relative w-10 h-10 flex items-center justify-center mb-7"
        aria-label="Joy POS"
      >
        <span className="absolute w-8 h-2.5 rounded-full bg-orange-400 -rotate-45 translate-y-[-5px]" />
        <span className="absolute w-8 h-2.5 rounded-full bg-[var(--color-accent)] -rotate-45 translate-x-[7px] translate-y-[5px]" />
        <span className="absolute w-5 h-2.5 rounded-full bg-orange-300 -rotate-45 -translate-x-[8px] translate-y-[6px]" />
      </div>

      <nav className="flex flex-col items-center gap-2 w-full" aria-label="Điều hướng chính">
        {NAV_ITEMS.map((item) => {
          const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative w-11 h-11 flex items-center justify-center rounded-xl transition-colors ${
                isActive
                  ? "text-[var(--color-accent)] bg-orange-50"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]"
              }`}
              aria-label={item.label}
              title={item.label}
            >
              {isActive && (
                <span className="absolute -left-[14px] w-[3px] h-6 rounded-r-full bg-[var(--color-accent)]" />
              )}
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d={item.path} />
              </svg>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col items-center gap-2">
        <button
          type="button"
          className="w-11 h-11 flex items-center justify-center rounded-xl text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors"
          title="Cài đặt"
          aria-label="Cài đặt"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.6 3.6c.1-.6.6-1.1 1.3-1.1h2.2c.7 0 1.2.5 1.3 1.1l.2 1.1c.1.4.3.7.7.9l.3.2c.4.2.8.2 1.1.1l1.1-.4c.6-.2 1.3 0 1.6.6l1.1 1.9c.3.6.2 1.3-.3 1.7l-.9.7c-.3.2-.5.6-.5 1v.4c0 .4.2.8.5 1l.9.7c.5.4.7 1.1.3 1.7l-1.1 1.9c-.3.6-1 .8-1.6.6l-1.1-.4c-.4-.1-.8-.1-1.1.1l-.3.2c-.4.2-.6.5-.7.9l-.2 1.1c-.1.6-.6 1.1-1.3 1.1h-2.2c-.7 0-1.2-.5-1.3-1.1l-.2-1.1c-.1-.4-.3-.7-.7-.9l-.3-.2c-.4-.2-.8-.2-1.1-.1l-1.1.4c-.6.2-1.3 0-1.6-.6l-1.1-1.9c-.3-.6-.2-1.3.3-1.7l.9-.7c.3-.2.5-.6.5-1v-.4c0-.4-.2-.8-.5-1l-.9-.7c-.5-.4-.7-1.1-.3-1.7l1.1-1.9c.3-.6 1-.8 1.6-.6l1.1.4c.4.1.8.1 1.1-.1l.3-.2c.4-.2.6-.5.7-.9l.2-1.1Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
          </svg>
        </button>
        <button
          type="button"
          onClick={onLogout}
          className="w-11 h-11 flex items-center justify-center rounded-xl text-[var(--color-text-muted)] hover:text-red-500 hover:bg-red-50 transition-colors"
          title="Đăng xuất"
          aria-label="Đăng xuất"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3-3H9.75m9 0-3-3m3 3-3 3" />
          </svg>
        </button>
      </div>
    </aside>
  );
}
