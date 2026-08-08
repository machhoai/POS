"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MonitorCheck, PackageOpen, SearchX, UserPlus, UsersRound } from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import MemberLookupPanel from "@/components/members/MemberLookupPanel";
import MemberPackageCatalog from "@/components/members/MemberPackageCatalog";
import MemberPackageCheckoutModal from "@/components/members/MemberPackageCheckoutModal";
import MemberProfileCard from "@/components/members/MemberProfileCard";
import MemberRegistrationForm from "@/components/members/MemberRegistrationForm";
import StoreSelector from "@/components/pos/StoreSelector";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useCustomerDisplayWindow } from "@/lib/hooks/useCustomerDisplayWindow";
import { useMemberCustomerDisplayPublisher } from "@/lib/hooks/useMemberCustomerDisplayPublisher";
import { useMemberPackageCustomerDisplayPublisher } from "@/lib/hooks/useMemberPackageCustomerDisplayPublisher";
import { useMemberPackageSaleController } from "@/lib/hooks/useMemberPackageSaleController";
import {
  lookupMember,
  registerMember,
  toMemberServiceError,
  validateMemberRegistrationDraft,
} from "@/lib/services/memberService";
import { useMemberStore } from "@/lib/stores/useMemberStore";
import { showError, showInfo, showPromise, showSuccess } from "@/lib/utils/toast";

type MemberOperation = "LOOKUP" | "REGISTER" | "PACKAGE";

function retryLookup(): void {
  const form = document.getElementById("member-lookup-form");
  if (form instanceof HTMLFormElement) form.requestSubmit();
}

function retryRegistration(): void {
  const button = document.getElementById("member-register-button");
  if (button instanceof HTMLButtonElement) button.click();
}

export default function MembersPage() {
  useCustomerDisplayWindow();
  const router = useRouter();
  const auth = useAuth();
  const [operation, setOperation] = useState<MemberOperation>("LOOKUP");
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const mode = useMemberStore((state) => state.lookupMode);
  const query = useMemberStore((state) => state.lookupQuery);
  const request = useMemberStore((state) => state.lookupRequest);
  const member = useMemberStore((state) => state.currentMember);
  const draft = useMemberStore((state) => state.registrationDraft);
  const reviewStatus = useMemberStore((state) => state.registrationReviewStatus);
  const mutation = useMemberStore((state) => state.mutation);
  const setMode = useMemberStore((state) => state.setLookupMode);
  const setQuery = useMemberStore((state) => state.setLookupQuery);
  const startLookup = useMemberStore((state) => state.startLookup);
  const completeLookup = useMemberStore((state) => state.completeLookup);
  const failLookup = useMemberStore((state) => state.failLookup);
  const updateDraft = useMemberStore((state) => state.updateRegistrationDraft);
  const startReview = useMemberStore((state) => state.startRegistrationReview);
  const confirmReview = useMemberStore((state) => state.confirmRegistrationReview);
  const editRegistration = useMemberStore((state) => state.editRegistration);
  const startNewRegistration = useMemberStore((state) => state.startNewRegistration);
  const startMutation = useMemberStore((state) => state.startMutation);
  const completeMutation = useMemberStore((state) => state.completeMutation);
  const failMutation = useMemberStore((state) => state.failMutation);
  const resetMutation = useMemberStore((state) => state.resetMutation);
  const resetSession = useMemberStore((state) => state.resetMemberSession);
  const registrationMember = mutation.kind === "REGISTER" && mutation.status === "SUCCEEDED" ? member : null;
  const shopId = Number(process.env.NEXT_PUBLIC_SHOP_ID) || 1;
  const packageSale = useMemberPackageSaleController({
    shopId,
    warehouseId: operation === "PACKAGE" ? auth.effectiveWarehouseId : null,
  });

  useMemberCustomerDisplayPublisher({ enabled: operation === "REGISTER", suppressWhenDisabled: operation === "PACKAGE", draft, reviewStatus, mutationStatus: mutation.status, member: registrationMember });
  useMemberPackageCustomerDisplayPublisher({ enabled: operation === "PACKAGE", selectedPackage: packageSale.selectedPackage, mutation: packageSale.mutation, paymentMethod: packageSale.paymentMethod, payment: packageSale.payOSPayment });

  useEffect(() => {
    if (!auth.isLoading && (!auth.user || !auth.userDoc)) router.replace("/login");
  }, [auth.isLoading, auth.user, auth.userDoc, router]);

  const handleLookup = useCallback(async () => {
    if (!auth.effectiveWarehouseId) {
      showError("Chưa chọn điểm bán", "Vui lòng chọn điểm bán trước khi tra cứu.");
      return;
    }
    startLookup();
    try {
      const result = await showPromise(lookupMember({ shopId, warehouseId: auth.effectiveWarehouseId, mode, query }), {
        loading: "Đang tra cứu OpenAPI...", success: "Đã tìm thấy thành viên", error: "Tra cứu không thành công",
        successDescription: "Thông tin và số dư mới nhất đã được tải.", errorDescription: "Lý do chi tiết được hiển thị trên màn hình.", onRetry: retryLookup,
      });
      completeLookup(result.member);
      setFetchedAt(result.fetchedAt);
    } catch (error: unknown) {
      const memberError = toMemberServiceError(error);
      console.error("[Thành viên] Tra cứu thất bại:", memberError);
      failLookup(memberError.message, memberError.code);
      setFetchedAt(null);
    }
  }, [auth.effectiveWarehouseId, completeLookup, failLookup, mode, query, shopId, startLookup]);

  const handleStartReview = useCallback(() => {
    try {
      const normalized = validateMemberRegistrationDraft(draft);
      resetMutation();
      updateDraft(normalized);
      startReview();
      showInfo("Đã gửi sang màn hình khách", "Vui lòng nhờ khách kiểm tra và xác nhận thông tin.");
    } catch (error: unknown) {
      const memberError = toMemberServiceError(error);
      showError("Thông tin chưa hợp lệ", memberError.message);
    }
  }, [draft, resetMutation, startReview, updateDraft]);

  const handleRegister = useCallback(async () => {
    if (!auth.effectiveWarehouseId) {
      showError("Chưa chọn điểm bán", "Vui lòng chọn điểm bán trước khi đăng ký.");
      return;
    }
    startMutation("REGISTER");
    try {
      const result = await showPromise(registerMember({ ...draft, shopId, warehouseId: auth.effectiveWarehouseId }), {
        loading: "Đang chờ OpenAPI đăng ký...", success: "Đăng ký thành viên thành công", error: "Đăng ký không thành công",
        successDescription: "OpenAPI đã xác nhận và POS đã lưu hồ sơ.", errorDescription: "Hồ sơ chưa được lưu. Xem lý do trên màn hình và thử lại.", onRetry: retryRegistration,
      });
      completeLookup(result.member);
      completeMutation();
      setFetchedAt(result.createdAt);
    } catch (error: unknown) {
      const memberError = toMemberServiceError(error);
      console.error("[Thành viên] Đăng ký thất bại:", memberError);
      failMutation(memberError.message, memberError.code);
    }
  }, [auth.effectiveWarehouseId, completeLookup, completeMutation, draft, failMutation, shopId, startMutation]);

  if (auth.isLoading || !auth.user || !auth.userDoc) {
    return <div className="flex h-screen items-center justify-center bg-[var(--color-background)]"><div className="size-10 animate-spin rounded-full border-4 border-[var(--color-accent)] border-t-transparent" /></div>;
  }
  if (auth.needsWarehouseSelection) {
    return <StoreSelector userName={auth.userDoc.full_name} warehouses={auth.availableWarehouses} onSelectWarehouse={auth.selectWarehouse} onLogout={auth.logout} />;
  }

  return (
    <div className="flex h-screen bg-[var(--color-background)]">
      <Sidebar onLogout={auth.logout} />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] bg-white px-4 py-3 md:px-6">
          <div className="flex items-center gap-3"><span className="flex size-11 items-center justify-center rounded-2xl bg-orange-50 text-[var(--color-accent)]"><UsersRound className="size-6" /></span><div><h1 className="text-xl font-extrabold">Thành viên</h1><p className="text-xs text-[var(--color-text-muted)]">Điểm bán: {auth.effectiveWarehouseName || auth.effectiveWarehouseId}</p></div></div>
          <div className="flex rounded-2xl bg-[var(--color-surface-hover)] p-1.5">{(["LOOKUP", "REGISTER", "PACKAGE"] as const).map((item) => <button key={item} type="button" onClick={() => setOperation(item)} className={`min-h-11 rounded-xl px-4 text-sm font-bold ${operation === item ? "bg-white text-[var(--color-accent)] shadow-sm" : "text-[var(--color-text-secondary)]"}`}>{item === "LOOKUP" ? "Tra cứu" : item === "REGISTER" ? "Đăng ký mới" : "Bán gói"}</button>)}</div>
        </header>

        <div className="scrollbar-thin flex-1 overflow-y-auto p-3 md:p-5">
          <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[minmax(340px,440px)_1fr]">
            <div className="space-y-3">
              {operation !== "REGISTER" ? <MemberLookupPanel mode={mode} query={query} isLookingUp={request.status === "WAITING_API"} onModeChange={(nextMode) => { setFetchedAt(null); setMode(nextMode); }} onQueryChange={setQuery} onSubmit={() => void handleLookup()} /> : <MemberRegistrationForm draft={draft} reviewStatus={reviewStatus} mutation={mutation} onChange={updateDraft} onStartReview={handleStartReview} onConfirmCustomer={() => { confirmReview(); showSuccess("Khách đã xác nhận", "Có thể gửi yêu cầu đăng ký đến OpenAPI."); }} onEdit={() => { resetMutation(); editRegistration(); }} onRegister={() => void handleRegister()} onStartNew={() => { startNewRegistration(); setFetchedAt(null); }} />}
              {operation !== "REGISTER" ? <button type="button" onClick={() => { resetSession(); setFetchedAt(null); }} className="min-h-12 w-full rounded-2xl border border-[var(--color-border)] bg-white px-4 text-sm font-bold text-[var(--color-text-secondary)] active:scale-[0.98]">Xóa phiên tra cứu</button> : null}
            </div>

            {operation === "PACKAGE" && member ? <div className="space-y-4"><MemberProfileCard member={member} fetchedAt={fetchedAt} /><MemberPackageCatalog packages={packageSale.packages} request={packageSale.packagesRequest} selectedPackage={packageSale.selectedPackage} mutation={packageSale.mutation} canRetryRemote={packageSale.canRetryRemote} onSelect={packageSale.selectPackage} onReload={() => void packageSale.loadPackages()} onBuy={packageSale.openCheckout} onRetryRemote={packageSale.retryRemoteSale} /></div> : operation === "LOOKUP" && member ? <MemberProfileCard member={member} fetchedAt={fetchedAt} /> : operation !== "REGISTER" && request.status === "FAILED" ? <div className="flex min-h-72 flex-col items-center justify-center rounded-3xl border border-red-200 bg-red-50 p-8 text-center"><SearchX className="mb-3 size-10 text-red-500" /><h2 className="text-lg font-extrabold text-red-800">Không thể hiển thị thành viên</h2><p className="mt-2 text-sm text-red-700">{request.errorMessage}</p><p className="mt-3 text-xs font-semibold text-red-500">Mã lỗi: {request.errorCode || "không xác định"}</p></div> : operation === "REGISTER" && registrationMember ? <MemberProfileCard member={registrationMember} fetchedAt={fetchedAt} /> : <div className="flex min-h-72 flex-col items-center justify-center rounded-3xl border border-dashed border-[var(--color-border-subtle)] bg-white p-8 text-center"><MonitorCheck className="mb-3 size-11 text-orange-300" /><h2 className="text-lg font-extrabold">{operation === "REGISTER" ? "Xác nhận trên màn hình phụ" : operation === "PACKAGE" ? "Tra cứu trước khi bán gói" : "Tra cứu thành viên"}</h2><p className="mt-2 max-w-md text-sm text-[var(--color-text-muted)]">{operation === "REGISTER" ? "Thông tin chỉ được gửi OpenAPI sau khi khách đã kiểm tra và xác nhận đúng." : operation === "PACKAGE" ? "Mỗi đơn gói bắt buộc gắn với đúng UID thành viên trên OpenAPI." : "Nhập số điện thoại hoặc mã thẻ để tải dữ liệu mới nhất từ OpenAPI."}</p>{operation === "REGISTER" ? <UserPlus className="mt-5 size-8 text-[var(--color-accent)]" /> : operation === "PACKAGE" ? <PackageOpen className="mt-5 size-8 text-[var(--color-accent)]" /> : null}</div>}
          </div>
        </div>
      </main>
      {operation === "PACKAGE" && packageSale.isCheckoutOpen && packageSale.selectedPackage ? <MemberPackageCheckoutModal selectedPackage={packageSale.selectedPackage} paymentMethod={packageSale.paymentMethod} mutationBusy={["WAITING_PAYMENT", "WAITING_API"].includes(packageSale.mutation.status)} payOSPayment={packageSale.payOSPayment} onPaymentMethodChange={packageSale.setPaymentMethod} onClose={packageSale.closeCheckout} onCashConfirm={() => void packageSale.sellForCash()} onQrConfirm={() => void packageSale.startQrPayment()} /> : null}
    </div>
  );
}
