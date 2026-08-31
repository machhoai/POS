"use client";

import { useMemo } from "react";
import { useAuth } from "@/lib/contexts/AuthContext";

export type SettingsAccessGroup = "public" | "general" | "advertising";

export const SETTINGS_READ_PERMISSION = "pos.settings.read";
export const SETTINGS_MANAGE_PERMISSION = "pos.settings.manage";
export const ADVERTISING_READ_PERMISSION = "pos.advertising.read";
export const ADVERTISING_MANAGE_PERMISSION = "pos.advertising.manage";

export function resolveSettingsAccessGroup(pathname: string): SettingsAccessGroup {
  if (pathname.startsWith("/settings/advertising")) return "advertising";
  if (
    pathname.startsWith("/settings/receipt")
    || pathname.startsWith("/settings/ticket")
    || pathname.startsWith("/settings/lucky-draw")
    || pathname.startsWith("/settings/payment")
    || pathname.startsWith("/settings/products")
  ) {
    return "general";
  }
  return "public";
}

export interface SettingsAccess {
  canReadGeneralSettings: boolean;
  canManageGeneralSettings: boolean;
  canReadAdvertisingSettings: boolean;
  canManageAdvertisingSettings: boolean;
  canAccessGroup: (group: SettingsAccessGroup) => boolean;
}

export function useSettingsAccess(): SettingsAccess {
  const { effectiveWarehouseId, hasPermission } = useAuth();

  return useMemo(() => {
    if (!effectiveWarehouseId) {
      return {
        canReadGeneralSettings: false,
        canManageGeneralSettings: false,
        canReadAdvertisingSettings: false,
        canManageAdvertisingSettings: false,
        canAccessGroup: (group: SettingsAccessGroup) => group === "public",
      };
    }

    const canManageGeneralSettings = hasPermission(
      SETTINGS_MANAGE_PERMISSION,
      effectiveWarehouseId,
    );
    const canReadGeneralSettings = canManageGeneralSettings || hasPermission(
      SETTINGS_READ_PERMISSION,
      effectiveWarehouseId,
    );
    const canManageAdvertisingSettings = hasPermission(
      ADVERTISING_MANAGE_PERMISSION,
      effectiveWarehouseId,
    );
    const canReadAdvertisingSettings = canManageAdvertisingSettings || hasPermission(
      ADVERTISING_READ_PERMISSION,
      effectiveWarehouseId,
    );

    return {
      canReadGeneralSettings,
      canManageGeneralSettings,
      canReadAdvertisingSettings,
      canManageAdvertisingSettings,
      canAccessGroup: (group: SettingsAccessGroup) => {
        if (group === "general") return canReadGeneralSettings;
        if (group === "advertising") return canReadAdvertisingSettings;
        return true;
      },
    };
  }, [effectiveWarehouseId, hasPermission]);
}
