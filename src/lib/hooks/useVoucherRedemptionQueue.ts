"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { printReceiptSilently } from "@/features/receipt/components/ReceiptPrintButton";
import { useReceiptSettingsStore } from "@/features/receipt/store/useReceiptSettingsStore";
import { printTicketsSilently } from "@/features/ticket/components/TicketPrintButton";
import { useTicketSettingsStore } from "@/features/ticket/store/useTicketSettingsStore";
import { fetchOrderForReceipt, resolveVoucher } from "@/lib/services/orderService";
import { completeVoucherRedemptionBatch } from "@/lib/services/voucherRedemptionBatchService";
import type { PosVoucherResolution } from "@/lib/types/voucher";
import type { VoucherRedemptionMode, VoucherRedemptionResult } from "@/lib/types/voucherRedemption";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import {
  isDuplicateVoucherScan,
  VOUCHER_BATCH_IDLE_MS,
  VOUCHER_DUPLICATE_WINDOW_MS,
} from "@/lib/utils/voucherRedemptionBatch";
import { showError, showSuccess, showWarning } from "@/lib/utils/toast";

export function useVoucherRedemptionQueue(shopId: number, warehouseId: string) {
  const receiptSettings = useReceiptSettingsStore((state) => state.settings);
  const ticketSettings = useTicketSettingsStore((state) => state.settings);
  const [mode, setMode] = useState<VoucherRedemptionMode>("REDEEM");
  const [results, setResults] = useState<VoucherRedemptionResult[]>([]);
  const [queueCount, setQueueCount] = useState(0);
  const [batchCount, setBatchCount] = useState(0);
  const [isResolving, setIsResolving] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const queueRef = useRef<string[]>([]);
  const batchRef = useRef<PosVoucherResolution[]>([]);
  const activeCodesRef = useRef(new Set<string>());
  const recentCodesRef = useRef(new Map<string, number>());
  const processingRef = useRef(false);
  const finalizingRef = useRef(false);
  const batchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushBatchRef = useRef<() => void>(() => undefined);

  const upsertResult = useCallback((result: Omit<VoucherRedemptionResult, "id">) => {
    setResults((current) => [
      { ...result, id: crypto.randomUUID() },
      ...current.filter((item) => item.code !== result.code),
    ].slice(0, 30));
  }, []);

  const markHandled = useCallback((code: string) => {
    activeCodesRef.current.delete(code);
    const now = Date.now();
    recentCodesRef.current.set(code, now);
    for (const [recentCode, handledAt] of recentCodesRef.current) {
      if (now - handledAt >= VOUCHER_DUPLICATE_WINDOW_MS) recentCodesRef.current.delete(recentCode);
    }
  }, []);

  const scheduleBatchFlush = useCallback(() => {
    if (batchTimerRef.current) clearTimeout(batchTimerRef.current);
    batchTimerRef.current = setTimeout(() => flushBatchRef.current(), VOUCHER_BATCH_IDLE_MS);
  }, []);

  const flushBatch = useCallback(async () => {
    if (processingRef.current || finalizingRef.current || batchRef.current.length === 0) return;
    if (batchTimerRef.current) clearTimeout(batchTimerRef.current);
    batchTimerRef.current = null;
    const vouchers = batchRef.current.splice(0);
    setBatchCount(0);
    finalizingRef.current = true;
    setIsFinalizing(true);
    try {
      const { order, printFailures } = await completeVoucherRedemptionBatch({
        vouchers,
        shopId,
        warehouseId,
        receiptSettings,
        ticketSettings,
      });
      const hasPrintFailure = printFailures.length > 0;
      for (const voucher of vouchers) {
        upsertResult({
          code: voucher.code,
          status: hasPrintFailure ? "PRINT_FAILED" : "COMPLETED",
          title: hasPrintFailure ? "Đã đổi voucher, cần in lại" : "Đổi voucher và in thành công",
          detail: hasPrintFailure
            ? printFailures.includes("RECEIPT")
              ? "Đã ghi nhận voucher nhưng bill chưa in được."
              : "Đã ghi nhận voucher nhưng vé chưa in đủ."
            : `${voucher.product.goodsName} × ${voucher.product.quantity} · Còn thu ${formatCurrency(order.totalAmount)}.`,
          orderId: order.localOrderId,
          campaignName: voucher.campaignName,
          rewardType: voucher.rewardType,
          rewardValue: voucher.rewardValue,
          productName: voucher.product.goodsName,
          productQuantity: voucher.product.quantity,
          productPrice: voucher.product.price,
          orderTotalAmount: order.totalAmount,
          timestamp: Date.now(),
        });
      }
      if (hasPrintFailure) showError("Đã đổi voucher nhưng chưa in đủ", "Vui lòng dùng chức năng in lại của đơn.");
      else showSuccess("Đã hoàn tất lượt đổi voucher", `${vouchers.length} voucher được gom trong một bill.`);
    } catch (error: unknown) {
      console.error("[Voucher] Không thể hoàn tất lô voucher:", error);
      const detail = error instanceof Error ? error.message : "Không thể tạo đơn cho các voucher.";
      for (const voucher of vouchers) {
        upsertResult({ code: voucher.code, status: "FAILED", title: "Không thể sử dụng voucher", detail, timestamp: Date.now() });
      }
      showError("Không thể hoàn tất lượt đổi voucher", detail);
    } finally {
      vouchers.forEach((voucher) => markHandled(voucher.code));
      finalizingRef.current = false;
      setIsFinalizing(false);
      if (batchRef.current.length > 0) scheduleBatchFlush();
    }
  }, [markHandled, receiptSettings, scheduleBatchFlush, shopId, ticketSettings, upsertResult, warehouseId]);
  useEffect(() => {
    flushBatchRef.current = () => void flushBatch();
  }, [flushBatch]);

  const processCode = useCallback(async (code: string) => {
    try {
      if (!navigator.onLine) throw new Error("JPOS cần kết nối mạng để xác nhận voucher.");
      const voucher = await resolveVoucher(code, warehouseId);
      const timestamp = Date.now();
      if (mode === "CHECK") {
        upsertResult({
          code,
          status: "CHECKED",
          title: "Voucher hợp lệ",
          detail: voucher.rewardType === "DISCOUNT_PERCENT"
            ? `Giảm ${voucher.rewardValue}% toàn đơn; sản phẩm áp dụng: ${voucher.product.goodsName}.`
            : `${voucher.product.goodsName} × ${voucher.product.quantity}.`,
          campaignName: voucher.campaignName,
          rewardType: voucher.rewardType,
          rewardValue: voucher.rewardValue,
          productName: voucher.product.goodsName,
          productQuantity: voucher.product.quantity,
          productPrice: voucher.product.price,
          timestamp,
        });
        markHandled(code);
        return;
      }
      if (voucher.rewardType === "DISCOUNT_PERCENT") {
        upsertResult({
          code,
          status: "CHECKED",
          title: "Áp dụng tại màn hình bán hàng",
          detail: `Voucher giảm ${voucher.rewardValue}% cần được thanh toán cùng giỏ hàng. Mã chưa bị sử dụng.`,
          campaignName: voucher.campaignName,
          rewardType: voucher.rewardType,
          rewardValue: voucher.rewardValue,
          productName: voucher.product.goodsName,
          productQuantity: voucher.product.quantity,
          productPrice: voucher.product.price,
          timestamp,
        });
        markHandled(code);
        showWarning("Cần thanh toán tại màn hình bán hàng", "Voucher giảm phần trăm cần thanh toán kèm giỏ hàng.");
        return;
      }
      batchRef.current.push(voucher);
      setBatchCount(batchRef.current.length);
      upsertResult({
        code,
        status: "PENDING",
        title: "Đã nhận voucher",
        detail: `${voucher.product.goodsName} × ${voucher.product.quantity} · Đang chờ gom bill.`,
        campaignName: voucher.campaignName,
        rewardType: voucher.rewardType,
        rewardValue: voucher.rewardValue,
        productName: voucher.product.goodsName,
        productQuantity: voucher.product.quantity,
        productPrice: voucher.product.price,
        timestamp,
      });
    } catch (error: unknown) {
      console.error("[Voucher] Xử lý mã thất bại:", error);
      const detail = error instanceof Error ? error.message : "Voucher không hợp lệ.";
      upsertResult({ code, status: "FAILED", title: "Không thể sử dụng voucher", detail, timestamp: Date.now() });
      markHandled(code);
      showError("Voucher không thể sử dụng", detail);
    }
  }, [markHandled, mode, upsertResult, warehouseId]);

  const enqueue = useCallback((rawCode: string) => {
    const code = rawCode.trim().toUpperCase();
    if (!code || isDuplicateVoucherScan(code, activeCodesRef.current, recentCodesRef.current)) return;
    if (batchTimerRef.current) clearTimeout(batchTimerRef.current);
    batchTimerRef.current = null;
    activeCodesRef.current.add(code);
    queueRef.current.push(code);
    setQueueCount(queueRef.current.length);
    if (processingRef.current) return;
    processingRef.current = true;
    setIsResolving(true);
    void (async () => {
      try {
        while (queueRef.current.length > 0) {
          const nextCode = queueRef.current.shift()!;
          setQueueCount(queueRef.current.length);
          await processCode(nextCode);
        }
      } finally {
        processingRef.current = false;
        setIsResolving(false);
        if (batchRef.current.length > 0) scheduleBatchFlush();
      }
    })();
  }, [processCode, scheduleBatchFlush]);

  const flushNow = useCallback(() => {
    if (batchTimerRef.current) clearTimeout(batchTimerRef.current);
    batchTimerRef.current = null;
    flushBatchRef.current();
  }, []);

  const reprintOrder = useCallback(async (orderId: string) => {
    try {
      const order = await fetchOrderForReceipt(orderId);
      await printReceiptSilently(order, receiptSettings);
      await printTicketsSilently(order, ticketSettings);
      showSuccess("Đã gửi lệnh in lại", `Biên nhận & vé cho đơn ${orderId} đã được gửi tới máy in.`);
    } catch (error: unknown) {
      console.error("[Voucher] Lỗi in lại đơn:", error);
      showError("Không thể in lại", error instanceof Error ? error.message : "Máy in không nhận được lệnh in.");
    }
  }, [receiptSettings, ticketSettings]);

  useEffect(() => () => {
    if (batchTimerRef.current) clearTimeout(batchTimerRef.current);
  }, []);

  const clearResults = useCallback(() => setResults([]), []);
  return {
    mode,
    setMode,
    results,
    isProcessing: isResolving || isFinalizing || batchCount > 0,
    isFinalizing,
    pendingCount: queueCount + batchCount,
    batchCount,
    canFlush: batchCount > 0 && !isResolving && !isFinalizing,
    enqueue,
    flushNow,
    reprintOrder,
    clearResults,
  };
}
