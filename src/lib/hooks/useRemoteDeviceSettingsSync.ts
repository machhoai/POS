"use client";

import { useCallback, useEffect } from "react";
import { mapRemoteReceiptSettings } from "@/features/receipt/helpers/remoteReceiptSettings";
import { useReceiptSettingsStore } from "@/features/receipt/store/useReceiptSettingsStore";
import { mapRemoteTicketSettings } from "@/features/ticket/helpers/remoteTicketSettings";
import { useTicketSettingsStore } from "@/features/ticket/store/useTicketSettingsStore";
import { applyCustomerDisplayAdvertisingView } from "@/lib/services/customerDisplayAdvertisingSyncService";
import {
  DeviceSessionError,
  isDeviceEnrollmentRuntime,
  watchRemoteCustomerDisplaySettings,
  watchRemoteReceiptSettings,
  watchRemoteTicketSettings,
} from "@/lib/services/deviceEnrollmentService";
import { cachePaymentSettings } from "@/lib/services/paymentSettingsCacheService";
import { useCustomerDisplayAdvertisingStore } from "@/lib/stores/useCustomerDisplayAdvertisingStore";
import type {
  PosDeviceCredential,
  PosDeviceSessionResult,
} from "@/lib/types/deviceEnrollment";
import {
  getRemoteSettingsRetryDelayMs,
  REMOTE_SETTINGS_SUCCESS_RECONNECT_DELAY_MS,
} from "@/lib/utils/remoteSettingsPolling";

interface RemoteSettingsSyncInput {
  credential: PosDeviceCredential | null;
  blocked: boolean;
  onRevoked: (message: string) => void;
}

export function useRemoteDeviceSettingsSync({ credential, blocked, onRevoked }: RemoteSettingsSyncInput) {
  const applyReceipt = useReceiptSettingsStore((state) => state.applyRemoteSettings);
  const clearReceipt = useReceiptSettingsStore((state) => state.clearRemoteSettings);
  const receiptVersion = useReceiptSettingsStore((state) => state.remoteVersion);
  const applyTicket = useTicketSettingsStore((state) => state.applyRemoteSettings);
  const clearTicket = useTicketSettingsStore((state) => state.clearRemoteSettings);
  const ticketVersion = useTicketSettingsStore((state) => state.remoteVersion);
  const advertisingVersion = useCustomerDisplayAdvertisingStore(
    (state) => state.view?.settings?.version ?? 0,
  );

  const applySessionSettings = useCallback(async (session: PosDeviceSessionResult) => {
    if (session.receipt_settings) {
      applyReceipt(
        session.receipt_settings.warehouse_id,
        session.receipt_settings.version,
        mapRemoteReceiptSettings(session.receipt_settings),
      );
    } else clearReceipt(session.device.warehouse_id);
    if (session.ticket_settings) {
      applyTicket(
        session.ticket_settings.warehouse_id,
        session.ticket_settings.version,
        mapRemoteTicketSettings(session.ticket_settings),
      );
    } else clearTicket(session.device.warehouse_id);
    if (session.payment_settings) cachePaymentSettings(session.payment_settings);
    if (session.customer_display_settings) {
      await applyCustomerDisplayAdvertisingView(session.customer_display_settings);
    }
  }, [applyReceipt, applyTicket, clearReceipt, clearTicket]);

  useEffect(() => {
    if (!credential || blocked || !isDeviceEnrollmentRuntime()) return;
    let cancelled = false;
    let controller: AbortController | null = null;
    let failureCount = 0;
    const watch = async () => {
      while (!cancelled) {
        controller = new AbortController();
        try {
          const result = await watchRemoteReceiptSettings(
            credential,
            receiptVersion,
            controller.signal,
          );
          if (cancelled) return;
          if (result.changed && result.receipt_settings) {
            applyReceipt(
              result.receipt_settings.warehouse_id,
              result.receipt_settings.version,
              mapRemoteReceiptSettings(result.receipt_settings),
            );
          } else if (result.changed) clearReceipt(credential.warehouse_id);
          failureCount = 0;
          await new Promise((resolve) =>
            window.setTimeout(resolve, REMOTE_SETTINGS_SUCCESS_RECONNECT_DELAY_MS),
          );
        } catch (reason: unknown) {
          if (cancelled) return;
          if (reason instanceof DeviceSessionError && reason.revoked) {
            onRevoked(reason.message);
            return;
          }
          failureCount += 1;
          const retryAfterMs =
            reason instanceof DeviceSessionError ? reason.retryAfterMs : null;
          await new Promise((resolve) =>
            window.setTimeout(
              resolve,
              getRemoteSettingsRetryDelayMs(failureCount, retryAfterMs),
            ),
          );
        }
      }
    };
    void watch();
    return () => { cancelled = true; controller?.abort(); };
  }, [applyReceipt, blocked, clearReceipt, credential, onRevoked, receiptVersion]);

  useEffect(() => {
    if (!credential || blocked || !isDeviceEnrollmentRuntime()) return;
    let cancelled = false;
    let controller: AbortController | null = null;
    let failureCount = 0;
    const watch = async () => {
      while (!cancelled) {
        controller = new AbortController();
        try {
          const result = await watchRemoteTicketSettings(
            credential,
            ticketVersion,
            controller.signal,
          );
          if (cancelled) return;
          if (result.changed && result.ticket_settings) {
            applyTicket(
              result.ticket_settings.warehouse_id,
              result.ticket_settings.version,
              mapRemoteTicketSettings(result.ticket_settings),
            );
          } else if (result.changed) clearTicket(credential.warehouse_id);
          failureCount = 0;
          await new Promise((resolve) =>
            window.setTimeout(resolve, REMOTE_SETTINGS_SUCCESS_RECONNECT_DELAY_MS),
          );
        } catch (reason: unknown) {
          if (cancelled) return;
          if (reason instanceof DeviceSessionError && reason.revoked) {
            onRevoked(reason.message);
            return;
          }
          failureCount += 1;
          const retryAfterMs =
            reason instanceof DeviceSessionError ? reason.retryAfterMs : null;
          await new Promise((resolve) =>
            window.setTimeout(
              resolve,
              getRemoteSettingsRetryDelayMs(failureCount, retryAfterMs),
            ),
          );
        }
      }
    };
    void watch();
    return () => { cancelled = true; controller?.abort(); };
  }, [applyTicket, blocked, clearTicket, credential, onRevoked, ticketVersion]);

  useEffect(() => {
    if (!credential || blocked || !isDeviceEnrollmentRuntime()) return;
    let cancelled = false;
    let controller: AbortController | null = null;
    let failureCount = 0;
    const watch = async () => {
      while (!cancelled) {
        controller = new AbortController();
        try {
          const result = await watchRemoteCustomerDisplaySettings(
            credential,
            advertisingVersion,
            controller.signal,
          );
          if (cancelled) return;
          if (result.changed && result.customer_display_settings) {
            await applyCustomerDisplayAdvertisingView(result.customer_display_settings);
          }
          failureCount = 0;
          await new Promise((resolve) =>
            window.setTimeout(resolve, REMOTE_SETTINGS_SUCCESS_RECONNECT_DELAY_MS),
          );
        } catch (reason: unknown) {
          if (cancelled) return;
          if (reason instanceof DeviceSessionError && reason.revoked) {
            onRevoked(reason.message);
            return;
          }
          failureCount += 1;
          const retryAfterMs =
            reason instanceof DeviceSessionError ? reason.retryAfterMs : null;
          await new Promise((resolve) =>
            window.setTimeout(
              resolve,
              getRemoteSettingsRetryDelayMs(failureCount, retryAfterMs),
            ),
          );
        }
      }
    };
    void watch();
    return () => { cancelled = true; controller?.abort(); };
  }, [advertisingVersion, blocked, credential, onRevoked]);

  return { applySessionSettings };
}
