"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSettingsAccess, resolveSettingsAccessGroup } from "@/features/settings/hooks/useSettingsAccess";
import { useAuth } from "@/lib/contexts/AuthContext";

interface SettingsAccessGateProps {
  children: ReactNode;
}

const SettingsAccessGate: React.FC<SettingsAccessGateProps> = ({ children }) => {
  const pathname = usePathname();
  const router = useRouter();
  const { user, userDoc, isLoading } = useAuth();
  const { canAccessGroup } = useSettingsAccess();
  const accessGroup = resolveSettingsAccessGroup(pathname);
  const isAuthenticated = Boolean(user && userDoc);
  const canAccess = canAccessGroup(accessGroup);

  useEffect(() => {
    if (isLoading || !isAuthenticated || canAccess) return;
    router.replace("/settings/printer");
  }, [canAccess, isAuthenticated, isLoading, router]);

  if (isLoading || (isAuthenticated && !canAccess)) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--color-background)]">
        <div className="flex flex-col items-center gap-3">
          <div className="size-10 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />
          <p className="text-sm text-[var(--color-text-muted)]">Đang kiểm tra quyền cài đặt...</p>
        </div>
      </div>
    );
  }

  return children;
};

export default SettingsAccessGate;
