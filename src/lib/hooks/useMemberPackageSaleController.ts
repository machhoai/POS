"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePayOSCheckoutController } from "@/lib/hooks/usePayOSCheckoutController";
import { lookupMember, toMemberServiceError } from "@/lib/services/memberService";
import {
  fetchMemberPackages,
  finalizeMemberPackageSale,
  prepareMemberPackageOrder,
  sellMemberPackageForCash,
} from "@/lib/services/memberPackageService";
import { generateLocalOrderId } from "@/lib/services/orderService";
import {
  selectSelectedMemberPackage,
  useMemberStore,
} from "@/lib/stores/useMemberStore";
import type { PaymentMethod } from "@/lib/types/order";
import { showPromise } from "@/lib/utils/toast";

function clickButton(id: string): void {
  const button = document.getElementById(id);
  if (button instanceof HTMLButtonElement) button.click();
}

interface MemberPackageSaleControllerInput {
  shopId: number;
  warehouseId: string | null;
}

export function useMemberPackageSaleController({
  shopId,
  warehouseId,
}: MemberPackageSaleControllerInput) {
  const member = useMemberStore((state) => state.currentMember);
  const packages = useMemberStore((state) => state.packages);
  const packagesRequest = useMemberStore((state) => state.packagesRequest);
  const selectedPackage = useMemberStore(selectSelectedMemberPackage);
  const mutation = useMemberStore((state) => state.mutation);
  const lookupMode = useMemberStore((state) => state.lookupMode);
  const lookupQuery = useMemberStore((state) => state.lookupQuery);
  const cardReaderStatus = useMemberStore((state) => state.cardReaderStatus);
  const startLoading = useMemberStore((state) => state.startLoadingPackages);
  const setPackages = useMemberStore((state) => state.setPackages);
  const failLoading = useMemberStore((state) => state.failLoadingPackages);
  const selectPackage = useMemberStore((state) => state.selectPackage);
  const startMutation = useMemberStore((state) => state.startMutation);
  const markWaitingApi = useMemberStore((state) => state.markMutationWaitingApi);
  const completeMutation = useMemberStore((state) => state.completeMutation);
  const failMutation = useMemberStore((state) => state.failMutation);
  const resetMutation = useMemberStore((state) => state.resetMutation);
  const completeLookup = useMemberStore((state) => state.completeLookup);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [isCheckoutOpen, setCheckoutOpen] = useState(false);
  const [localOrderId, setLocalOrderId] = useState<string | null>(null);
  const [paymentCollected, setPaymentCollected] = useState(false);
  const loadedKeyRef = useRef<string | null>(null);

  const loadPackages = useCallback(async () => {
    if (!member || !warehouseId) return;
    startLoading();
    try {
      const result = await showPromise(
        fetchMemberPackages({ shopId, warehouseId, uid: member.uid }),
        {
          loading: "Đang tải gói điểm từ OpenAPI...",
          success: "Đã tải gói thành viên",
          error: "Không thể tải gói thành viên",
          successDescription: "Giá và số điểm đã được tính trực tiếp từ OpenAPI.",
          errorDescription: "Danh sách chưa được cập nhật. Vui lòng thử lại.",
          onRetry: () => clickButton("member-package-reload"),
        },
      );
      setPackages(result.packages);
    } catch (error: unknown) {
      const serviceError = toMemberServiceError(error);
      console.error("[Thành viên] Tải gói thất bại:", serviceError);
      failLoading(serviceError.message, serviceError.code);
    }
  }, [failLoading, member, setPackages, shopId, startLoading, warehouseId]);

  useEffect(() => {
    const key = member && warehouseId ? `${warehouseId}:${member.uid}` : null;
    if (!key) {
      loadedKeyRef.current = null;
      return;
    }
    if (loadedKeyRef.current === key) return;
    loadedKeyRef.current = key;
    void loadPackages();
  }, [loadPackages, member, warehouseId]);

  const refreshMember = useCallback(async () => {
    if (!member || !warehouseId) return;
    const canReuseQuery = lookupQuery.trim().length > 0;
    const result = await lookupMember({
      shopId,
      warehouseId,
      mode: canReuseQuery ? lookupMode : "PHONE",
      query: canReuseQuery ? lookupQuery : member.phone,
      cardLookupKind: canReuseQuery && lookupMode === "CARD" && cardReaderStatus === "SUCCEEDED"
        ? "SERIAL_NUMBER"
        : undefined,
    });
    completeLookup(result.member);
  }, [cardReaderStatus, completeLookup, lookupMode, lookupQuery, member, shopId, warehouseId]);

  const finishRemoteSale = useCallback(async (orderId: string) => {
    setPaymentCollected(true);
    setCheckoutOpen(false);
    markWaitingApi();
    try {
      const result = await showPromise(finalizeMemberPackageSale(orderId), {
        loading: "OpenAPI đang nạp gói vào thẻ...",
        success: "Nạp gói thành công",
        error: "OpenAPI chưa hoàn tất nạp gói",
        successDescription: "Đơn đã được xác nhận thanh toán và cộng điểm.",
        errorDescription: "Tiền đã được ghi nhận. Không tạo đơn mới; hãy thử lại đơn hiện tại.",
        onRetry: () => clickButton("member-package-retry-remote"),
      });
      completeMutation(result.remoteOrderNumber ?? undefined);
      await refreshMember();
    } catch (error: unknown) {
      const serviceError = toMemberServiceError(error);
      console.error("[Thành viên] Hoàn tất gói thất bại:", serviceError);
      failMutation(serviceError.message, serviceError.code);
    }
  }, [completeMutation, failMutation, markWaitingApi, refreshMember]);

  const orderItems = useMemo(() => selectedPackage ? [{
    goodsId: selectedPackage.goodsId,
    goodsName: selectedPackage.name,
    price: selectedPackage.paymentAmountVnd,
    quantity: 1,
  }] : [], [selectedPackage]);

  const payOSPayment = usePayOSCheckoutController({
    shopId,
    warehouseId,
    draftOrderId: localOrderId,
    items: orderItems,
    manageCartLock: false,
    requireRemoteCompletion: true,
    onCompleted: (orderId) => finishRemoteSale(orderId),
    onCancelled: resetMutation,
  });
  const createPayOSPayment = payOSPayment.createPayment;

  const openCheckout = useCallback(() => {
    if (!selectedPackage) return;
    setPaymentCollected(false);
    resetMutation();
    setLocalOrderId(generateLocalOrderId());
    setCheckoutOpen(true);
  }, [resetMutation, selectedPackage]);

  const closeCheckout = useCallback(() => {
    if (payOSPayment.session || payOSPayment.isBusy) return;
    setCheckoutOpen(false);
  }, [payOSPayment.isBusy, payOSPayment.session]);

  const sellForCash = useCallback(async () => {
    if (!member || !selectedPackage || !warehouseId || !localOrderId) return;
    setPaymentCollected(true);
    startMutation("PACKAGE_TOP_UP", "WAITING_API");
    try {
      const result = await showPromise(sellMemberPackageForCash({
        shopId,
        warehouseId,
        uid: member.uid,
        localOrderId,
        goodsId: selectedPackage.goodsId,
      }), {
        loading: "Đang chờ OpenAPI tạo và thanh toán đơn...",
        success: "Bán gói thành công",
        error: "Không thể hoàn tất bán gói",
        successDescription: "OpenAPI đã xác nhận đơn và cộng điểm cho thành viên.",
        errorDescription: "Đã ghi nhận tiền mặt. Hãy thử lại đúng đơn hiện tại.",
        onRetry: () => clickButton("member-package-retry-remote"),
      });
      completeMutation(result.remoteOrderNumber ?? undefined);
      setCheckoutOpen(false);
      await refreshMember();
    } catch (error: unknown) {
      const serviceError = toMemberServiceError(error);
      console.error("[Thành viên] Bán gói tiền mặt thất bại:", serviceError);
      failMutation(serviceError.message, serviceError.code);
      setCheckoutOpen(false);
    }
  }, [
    completeMutation,
    failMutation,
    localOrderId,
    member,
    refreshMember,
    selectedPackage,
    shopId,
    startMutation,
    warehouseId,
  ]);

  const startQrPayment = useCallback(async () => {
    if (!member || !selectedPackage || !warehouseId || !localOrderId) return;
    startMutation("PACKAGE_TOP_UP", "WAITING_PAYMENT");
    try {
      await showPromise(prepareMemberPackageOrder({
        shopId,
        warehouseId,
        uid: member.uid,
        localOrderId,
        goodsId: selectedPackage.goodsId,
      }), {
        loading: "Đang xác minh giá gói với OpenAPI...",
        success: "Đơn gói đã sẵn sàng",
        error: "Không thể chuẩn bị đơn gói",
        successDescription: "Giá thanh toán đã được khóa theo dữ liệu OpenAPI mới nhất.",
        errorDescription: "Chưa tạo mã chuyển khoản. Vui lòng thử lại.",
        onRetry: () => clickButton("member-package-start-qr"),
      });
      await createPayOSPayment();
    } catch (error: unknown) {
      const serviceError = toMemberServiceError(error);
      console.error("[Thành viên] Chuẩn bị QR thất bại:", serviceError);
      failMutation(serviceError.message, serviceError.code);
    }
  }, [
    failMutation,
    localOrderId,
    member,
    createPayOSPayment,
    selectedPackage,
    shopId,
    startMutation,
    warehouseId,
  ]);

  const retryRemoteSale = useCallback(() => {
    if (localOrderId && paymentCollected) void finishRemoteSale(localOrderId);
  }, [finishRemoteSale, localOrderId, paymentCollected]);

  return {
    packages,
    packagesRequest,
    selectedPackage,
    mutation,
    paymentMethod,
    isCheckoutOpen,
    payOSPayment,
    selectPackage,
    setPaymentMethod,
    loadPackages,
    openCheckout,
    closeCheckout,
    sellForCash,
    startQrPayment,
    retryRemoteSale,
    canRetryRemote: Boolean(localOrderId && paymentCollected),
  };
}
