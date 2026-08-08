"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IoDesktop, IoDocument, IoHome, IoPeople, IoSettings } from "react-icons/io5";

interface SidebarProps {
    onLogout: () => void;
}

const NAV_ITEMS = [
    {
        href: "/",
        label: "Bán hàng",
        icon: <IoHome />
    },
    {
        href: "/orders",
        label: "Đơn hàng",
        icon: <IoDocument />
    },
    {
        href: "/members",
        label: "Thành viên",
        icon: <IoPeople />
    },
    {
        href: "/display",
        label: "Màn hình khách",
        icon: <IoDesktop />
    },
];

export default function Sidebar({ onLogout }: SidebarProps) {
    const pathname = usePathname();

    return (
        <aside className="w-[72px] bg-white border-r border-[var(--color-border)] flex flex-col items-center py-2 shrink-0 z-10">
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
                            className={`relative size-13 flex items-center justify-center rounded-xl transition-colors text-xl ${isActive
                                ? "text-[var(--color-accent)] bg-orange-50"
                                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]"
                                }`}
                            aria-label={item.label}
                            title={item.label}
                        >
                            {isActive && (
                                <span className="absolute -left-[9px] w-[3px] h-9 rounded-r-full bg-[var(--color-accent)]" />
                            )}
                            {item.icon}
                        </Link>
                    );
                })}
            </nav>

            <div className="mt-auto flex flex-col items-center gap-2">
                <Link
                    href="/settings/receipt"
                    className={`w-11 h-11 flex items-center justify-center rounded-xl transition-colors ${pathname.startsWith("/settings")
                        ? "text-[var(--color-accent)] bg-orange-50"
                        : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]"
                        }`}
                    title="Cấu hình biên lai"
                    aria-label="Cấu hình biên lai"
                >
                    <IoSettings className="w-5 h-5" />
                </Link>
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
