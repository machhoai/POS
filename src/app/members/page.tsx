"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MonitorCheck, SearchX, UsersRound } from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import MemberLookupPanel from "@/components/members/MemberLookupPanel";
import MemberDetailsPanel from "@/components/members/MemberDetailsPanel";
import MemberCompensationConfirmModal from "@/components/members/MemberCompensationConfirmModal";
import MemberCompensationPanel from "@/components/members/MemberCompensationPanel";
import MemberPackageCheckoutModal from "@/components/members/MemberPackageCheckoutModal";
import MemberProductCatalog from "@/components/members/MemberProductCatalog";
import MemberRegistrationForm from "@/components/members/MemberRegistrationForm";
import StoreSelector from "@/components/pos/StoreSelector";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useCustomerDisplayWindow } from "@/lib/hooks/useCustomerDisplayWindow";
import { useBarcodeScanner } from "@/lib/hooks/useBarcodeScanner";
import { useMemberCustomerDisplayPublisher } from "@/lib/hooks/useMemberCustomerDisplayPublisher";
import { useMemberActivityController } from "@/lib/hooks/useMemberActivityController";
import { useMemberCompensationController } from "@/lib/hooks/useMemberCompensationController";
import { useMemberPackageCustomerDisplayPublisher } from "@/lib/hooks/useMemberPackageCustomerDisplayPublisher";
import { useMemberPackageSaleController } from "@/lib/hooks/useMemberPackageSaleController";
import {
    lookupMember,
    registerMember,
    toMemberServiceError,
    validateMemberRegistrationDraft,
} from "@/lib/services/memberService";
import {
    confirmMemberCardIssue,
    getMemberCardIssueInfo,
    prepareMemberCardForIssue,
    type PreparedMemberCard,
} from "@/lib/services/memberCardIssueService";
import {
    cancelMemberCardRead,
    readMemberCard,
    toCardReaderServiceError,
} from "@/lib/services/cardReaderService";
import { useMemberStore } from "@/lib/stores/useMemberStore";
import { useCartStore } from "@/lib/stores/useCartStore";
import { useProductStore } from "@/lib/stores/useProductStore";
import type {
    CardReaderStatus,
    MemberCardLookupKind,
    MemberLookupMode,
    MemberProfile,
    MemberRegistrationDraft,
} from "@/lib/types/member";
import type { Product } from "@/lib/types/product";
import { findProductByBarcode } from "@/lib/utils/productBarcode";
import { showError, showPromise, showSuccess, showWarning } from "@/lib/utils/toast";

type MemberOperation = "LOOKUP" | "REGISTER" | "COMPENSATION";

interface LookupOverride {
    mode: MemberLookupMode;
    query: string;
    cardLookupKind?: MemberCardLookupKind;
}

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
    const [registrationCardReaderStatus, setRegistrationCardReaderStatus] = useState<CardReaderStatus>("IDLE");
    const [registrationCardReaderError, setRegistrationCardReaderError] = useState<string | null>(null);
    const [registrationCard, setRegistrationCard] = useState<PreparedMemberCard | null>(null);
    const [pendingRegistrationMember, setPendingRegistrationMember] = useState<MemberProfile | null>(null);
    const cardReadAttemptRef = useRef(0);

    const mode = useMemberStore((state) => state.lookupMode);
    const query = useMemberStore((state) => state.lookupQuery);
    const request = useMemberStore((state) => state.lookupRequest);
    const cardReaderStatus = useMemberStore((state) => state.cardReaderStatus);
    const cardReaderError = useMemberStore((state) => state.cardReaderError);
    const lastCardLookupKind = useMemberStore((state) => state.lastCardLookupKind);
    const member = useMemberStore((state) => state.currentMember);
    const draft = useMemberStore((state) => state.registrationDraft);
    const mutation = useMemberStore((state) => state.mutation);
    const products = useProductStore((state) => state.products);
    const productsLoading = useProductStore((state) => state.isLoading);
    const productsError = useProductStore((state) => state.error);
    const fetchProducts = useProductStore((state) => state.fetchProducts);
    const cartItems = useCartStore((state) => state.items);
    const isPaymentLocked = useCartStore((state) => state.isPaymentLocked);
    const addCartItem = useCartStore((state) => state.addItem);
    const updateCartQuantity = useCartStore((state) => state.updateQuantity);
    const setCartMember = useCartStore((state) => state.setMember);
    const requestCheckoutModal = useCartStore((state) => state.requestCheckoutModal);
    const setCheckoutContext = useCartStore((state) => state.setCheckoutContext);
    const hydrateCheckoutJournal = useCartStore((state) => state.hydrateCheckoutJournal);

    const setMode = useMemberStore((state) => state.setLookupMode);
    const setQuery = useMemberStore((state) => state.setLookupQuery);
    const startCardRead = useMemberStore((state) => state.startCardRead);
    const completeCardRead = useMemberStore((state) => state.completeCardRead);
    const failCardRead = useMemberStore((state) => state.failCardRead);
    const startLookup = useMemberStore((state) => state.startLookup);
    const completeLookup = useMemberStore((state) => state.completeLookup);
    const failLookup = useMemberStore((state) => state.failLookup);
    const updateDraft = useMemberStore((state) => state.updateRegistrationDraft);
    const startNewRegistration = useMemberStore((state) => state.startNewRegistration);
    const startMutation = useMemberStore((state) => state.startMutation);
    const completeMutation = useMemberStore((state) => state.completeMutation);
    const failMutation = useMemberStore((state) => state.failMutation);
    const resetSession = useMemberStore((state) => state.resetMemberSession);

    const registrationMember = mutation.kind === "REGISTER" && mutation.status === "SUCCEEDED" ? member : null;
    const shopId = Number(process.env.NEXT_PUBLIC_SHOP_ID) || 1;

    const refreshAfterCompensation = useCallback(async () => {
        if (!auth.effectiveWarehouseId) return;
        try {
            const result = await lookupMember({
                shopId,
                warehouseId: auth.effectiveWarehouseId,
                mode,
                query,
                cardLookupKind: mode === "CARD" && cardReaderStatus === "SUCCEEDED"
                    ? lastCardLookupKind ?? "MEMBER_CODE"
                    : undefined,
            });
            completeLookup(result.member);
            setFetchedAt(result.fetchedAt);
        } catch (error: unknown) {
            const parsed = toMemberServiceError(error);
            showWarning("Đã nạp bù nhưng chưa tải lại được số dư", parsed.message);
        }
    }, [auth.effectiveWarehouseId, cardReaderStatus, completeLookup, lastCardLookupKind, mode, query, shopId]);

    const memberActivity = useMemberActivityController({
        member: operation === "LOOKUP" || operation === "COMPENSATION" ? member : null,
        shopId,
        warehouseId: auth.effectiveWarehouseId,
    });

    const compensation = useMemberCompensationController({
        member: operation === "COMPENSATION" ? member : null,
        shopId,
        warehouseId: auth.effectiveWarehouseId,
        onSucceeded: refreshAfterCompensation,
    });

    const canCompensate = auth.hasPermission("pos.members.compensate", auth.effectiveWarehouseId || undefined);
    const memberPackageSale = useMemberPackageSaleController({
        shopId,
        warehouseId: operation === "LOOKUP" ? auth.effectiveWarehouseId : null,
        products,
        productsLoading,
        productsError,
        reloadProducts: fetchProducts,
    });
    const isMemberPackageDisplayEnabled = operation === "LOOKUP" &&
        Boolean(member && memberPackageSale.selectedPackage);

    useMemberCustomerDisplayPublisher({
        enabled: operation === "REGISTER" ||
            (operation === "LOOKUP" && Boolean(member) && !isMemberPackageDisplayEnabled),
        suppressWhenDisabled: isMemberPackageDisplayEnabled,
        showLookupBalances: operation === "LOOKUP",
        draft,
        mutationStatus: mutation.status,
        member: operation === "LOOKUP"
            ? member
            : registrationMember ?? pendingRegistrationMember,
    });
    useMemberPackageCustomerDisplayPublisher({
        enabled: isMemberPackageDisplayEnabled,
        selectedPackage: memberPackageSale.selectedPackage,
        mutation: memberPackageSale.mutation,
        paymentMethod: memberPackageSale.paymentMethod,
        payment: memberPackageSale.payOSPayment,
    });

    useEffect(() => {
        if (!auth.isLoading && (!auth.user || !auth.userDoc)) router.replace("/login");
    }, [auth.isLoading, auth.user, auth.userDoc, router]);

    useEffect(() => {
        if (
            (operation === "REGISTER" || operation === "LOOKUP") &&
            auth.user &&
            auth.userDoc &&
            products.length === 0 &&
            !productsLoading &&
            !productsError
        ) {
            void fetchProducts();
        }
    }, [auth.user, auth.userDoc, fetchProducts, operation, products.length, productsError, productsLoading]);

    useEffect(() => {
        if (!auth.effectiveWarehouseId) return;
        setCheckoutContext(shopId, auth.effectiveWarehouseId);
        void hydrateCheckoutJournal();
    }, [auth.effectiveWarehouseId, hydrateCheckoutJournal, setCheckoutContext, shopId]);

    useEffect(() => () => {
        cardReadAttemptRef.current += 1;
        void cancelMemberCardRead();
    }, []);

    const handleLookup = useCallback(async (override?: LookupOverride) => {
        const lookupMode = override?.mode ?? mode;
        const lookupQuery = override?.query ?? query;
        const cardLookupKind = override?.cardLookupKind ?? (
            lookupMode === "CARD" && cardReaderStatus === "SUCCEEDED"
                ? lastCardLookupKind ?? "MEMBER_CODE"
                : "MEMBER_CODE"
        );
        if (!auth.effectiveWarehouseId) {
            showError("Chưa chọn điểm bán", "Vui lòng chọn điểm bán trước khi tra cứu.");
            return;
        }
        startLookup();
        try {
            const result = await showPromise(
                lookupMember({
                    shopId,
                    warehouseId: auth.effectiveWarehouseId,
                    mode: lookupMode,
                    query: lookupQuery,
                    cardLookupKind: lookupMode === "CARD" ? cardLookupKind : undefined,
                }),
                {
                    loading: "Đang tra cứu OpenAPI...",
                    success: "Đã tìm thấy thành viên",
                    error: "Tra cứu không thành công",
                    successDescription: "Thông tin và số dư mới nhất đã được tải.",
                    errorDescription: "Lý do chi tiết được hiển thị trên màn hình.",
                    onRetry: retryLookup,
                }
            );
            completeLookup(result.member);
            setFetchedAt(result.fetchedAt);
        } catch (error: unknown) {
            const memberError = toMemberServiceError(error);
            console.error("[Thành viên] Tra cứu thất bại:", memberError);
            failLookup(memberError.message, memberError.code);
            setFetchedAt(null);
        }
    }, [auth.effectiveWarehouseId, cardReaderStatus, completeLookup, failLookup, lastCardLookupKind, mode, query, shopId, startLookup]);

    const handleCardRead = useCallback(async () => {
        const attemptId = cardReadAttemptRef.current + 1;
        cardReadAttemptRef.current = attemptId;
        startCardRead();

        try {
            const result = await readMemberCard();
            if (cardReadAttemptRef.current !== attemptId) return;
            const cardNumber = result.memberCode ?? result.serialNumber;
            if (!cardNumber) {
                throw new Error("Đầu đọc không trả mã thành viên hoặc serial thẻ.");
            }
            const cardLookupKind: MemberCardLookupKind = result.memberCode
                ? "MEMBER_CODE"
                : "SERIAL_NUMBER";
            completeCardRead(cardNumber, cardLookupKind);
            await handleLookup({
                mode: "CARD",
                query: cardNumber,
                cardLookupKind,
            });
        } catch (error: unknown) {
            if (cardReadAttemptRef.current !== attemptId) return;
            const readerError = toCardReaderServiceError(error);
            if (readerError.code === "READ_CANCELLED") return;
            failCardRead(readerError.message);
        }
    }, [completeCardRead, failCardRead, handleLookup, startCardRead]);

    const handleRegistrationCardRead = useCallback(async () => {
        if (!auth.effectiveWarehouseId) {
            showError("Chưa chọn điểm bán", "Vui lòng chọn điểm bán trước khi đọc thẻ.");
            return;
        }
        const attemptId = cardReadAttemptRef.current + 1;
        cardReadAttemptRef.current = attemptId;
        setRegistrationCardReaderStatus("READING");
        setRegistrationCardReaderError(null);
        setRegistrationCard(null);
        updateDraft({ memberCode: "" });

        try {
            const result = await prepareMemberCardForIssue({
                shopId,
                warehouseId: auth.effectiveWarehouseId,
            });
            if (cardReadAttemptRef.current !== attemptId) return;
            updateDraft({ memberCode: result.memberCode });
            setRegistrationCard(result);
            setRegistrationCardReaderStatus("SUCCEEDED");
        } catch (error: unknown) {
            if (cardReadAttemptRef.current !== attemptId) return;
            const readerError = toCardReaderServiceError(error);
            if (readerError.code === "READ_CANCELLED") return;
            setRegistrationCardReaderStatus("FAILED");
            setRegistrationCardReaderError(readerError.message);
        }
    }, [auth.effectiveWarehouseId, shopId, updateDraft]);

    const handleCancelRegistrationCardRead = useCallback(() => {
        cardReadAttemptRef.current += 1;
        void cancelMemberCardRead().catch((error: unknown) => {
            console.warn("[Đầu đọc thẻ] Không thể gửi lệnh hủy:", error);
        });
        setRegistrationCard(null);
        updateDraft({ memberCode: "" });
        setRegistrationCardReaderStatus("FAILED");
        setRegistrationCardReaderError("Đã hủy chờ đọc thẻ. Có thể thử lại hoặc để trống.");
    }, [updateDraft]);

    const handleRegistrationDraftChange = useCallback((values: Partial<MemberRegistrationDraft>) => {
        updateDraft(values);
    }, [updateDraft]);

    const handleCancelCardRead = useCallback(() => {
        cardReadAttemptRef.current += 1;
        void cancelMemberCardRead().catch((error: unknown) => {
            console.warn("[Đầu đọc thẻ] Không thể gửi lệnh hủy:", error);
        });
        failCardRead("Đã hủy chờ đọc thẻ. Bạn có thể đọc lại hoặc nhập mã thẻ thủ công.");
    }, [failCardRead]);

    const handleModeChange = useCallback((nextMode: MemberLookupMode) => {
        if (nextMode === mode) return;
        if (cardReaderStatus === "READING") {
            cardReadAttemptRef.current += 1;
            void cancelMemberCardRead();
        }
        setFetchedAt(null);
        setMode(nextMode);
        if (nextMode === "CARD") void handleCardRead();
    }, [cardReaderStatus, handleCardRead, mode, setMode]);

    const handleQueryChange = useCallback((nextQuery: string) => {
        if (cardReaderStatus === "READING") {
            cardReadAttemptRef.current += 1;
            void cancelMemberCardRead();
        }
        setQuery(nextQuery);
    }, [cardReaderStatus, setQuery]);

    const handleOperationChange = useCallback((nextOperation: MemberOperation) => {
        if (nextOperation === "REGISTER") {
            if (isPaymentLocked) {
                showWarning(
                    "Giỏ hàng đang được khóa",
                    "Hãy hoàn tất hoặc hủy thanh toán hiện tại trước khi tạo thành viên mới.",
                );
                return;
            }
            setCartMember(null);
        }
        if (cardReaderStatus === "READING" || registrationCardReaderStatus === "READING") {
            cardReadAttemptRef.current += 1;
            void cancelMemberCardRead();
        }
        setOperation(nextOperation);
    }, [cardReaderStatus, isPaymentLocked, registrationCardReaderStatus, setCartMember]);

    const handleAddProduct = useCallback((product: Product): boolean => {
        if (isPaymentLocked) {
            showWarning("Giỏ hàng đang được khóa", "Hãy hoàn tất hoặc hủy thanh toán hiện tại trước khi sửa đơn.");
            return false;
        }
        addCartItem({
            goodsId: product.goodsId,
            goodsName: product.goodsName,
            price: product.afterTaxPrice > 0 ? product.afterTaxPrice : product.price,
            quantity: 1,
        });
        return true;
    }, [addCartItem, isPaymentLocked]);

    const handleBarcodeScan = useCallback((barcode: string) => {
        const product = findProductByBarcode(products, barcode);
        if (!product) {
            showWarning(
                "Không tìm thấy mã vạch",
                `Không có sản phẩm nào mang mã ${barcode} trong danh mục hiện tại.`,
            );
            return;
        }

        if (handleAddProduct(product)) {
            showSuccess("Đã quét sản phẩm", `${product.goodsName} đã được thêm vào giỏ hàng đăng ký.`);
        }
    }, [handleAddProduct, products]);

    useBarcodeScanner({
        enabled: operation === "REGISTER" &&
            !auth.isLoading &&
            Boolean(auth.user && auth.userDoc) &&
            !auth.needsWarehouseSelection,
        onScan: handleBarcodeScan,
    });

    const handleRegister = useCallback(async (): Promise<boolean> => {
        const warehouseId = auth.effectiveWarehouseId;
        if (!warehouseId) {
            showError("Chưa chọn điểm bán", "Vui lòng chọn điểm bán trước khi đăng ký.");
            return false;
        }

        let normalizedDraft: MemberRegistrationDraft;
        try {
            normalizedDraft = validateMemberRegistrationDraft(draft);
            updateDraft(normalizedDraft);
        } catch (error: unknown) {
            const memberError = toMemberServiceError(error);
            showError("Thông tin chưa hợp lệ", memberError.message);
            return false;
        }

        if (
            normalizedDraft.memberCode &&
            (!registrationCard || registrationCard.memberCode !== normalizedDraft.memberCode)
        ) {
            showError(
                "Thẻ chưa được xác thực",
                "Vui lòng đọc thẻ vật lý bằng đầu đọc trước khi đăng ký.",
            );
            return false;
        }
        if (pendingRegistrationMember && !registrationCard) {
            showError(
                "Cần đọc lại thẻ",
                "Thành viên đã được tạo. Vui lòng đọc thẻ vật lý để hoàn tất bước gắn thẻ.",
            );
            return false;
        }

        startMutation("REGISTER");
        let registeredMember = pendingRegistrationMember;
        let createdAt = fetchedAt;
        try {
            const result = await showPromise(
                (async () => {
                    if (!registeredMember) {
                        const registration = await registerMember({
                            ...normalizedDraft,
                            memberCode: "",
                            shopId,
                            warehouseId,
                        });
                        registeredMember = registration.member;
                        createdAt = registration.createdAt;
                        setPendingRegistrationMember(registration.member);
                        completeLookup(registration.member);
                    }

                    let completedMember = registeredMember;
                    if (registrationCard) {
                        const issueInfo = await getMemberCardIssueInfo({
                            shopId,
                            warehouseId,
                            uid: registeredMember.uid,
                            lookupQuery: registeredMember.phone || registeredMember.uid,
                        });
                        await confirmMemberCardIssue({
                            shopId,
                            warehouseId,
                            uid: registeredMember.uid,
                            lookupQuery: registeredMember.phone || registeredMember.uid,
                            memberAcctId: issueInfo.memberAcctId,
                            memberCode: registrationCard.memberCode,
                            memberIcCard: registrationCard.memberIcCard,
                            dynamicSerialNo: registrationCard.dynamicSerialNo,
                        });
                        completedMember = {
                            ...registeredMember,
                            memberCode: registrationCard.memberCode,
                        };
                    }

                    return { member: completedMember, createdAt };
                })(),
                {
                    loading: pendingRegistrationMember
                        ? "Đang thử gắn lại thẻ trên Joyworld..."
                        : registrationCard
                            ? "Đang tạo thành viên và gắn thẻ..."
                            : "Đang chờ OpenAPI đăng ký...",
                    success: registrationCard
                        ? "Đăng ký và gắn thẻ thành công"
                        : "Đăng ký thành viên thành công",
                    error: "Đăng ký không thành công",
                    successDescription: registrationCard
                        ? "Joyworld đã xác nhận thẻ và POS đã lưu mã thẻ."
                        : "OpenAPI đã xác nhận và POS đã lưu hồ sơ.",
                    errorDescription: "Xem trạng thái chi tiết trên màn hình và thử lại an toàn.",
                    onRetry: retryRegistration,
                }
            );
            completeLookup(result.member);
            completeMutation();
            setPendingRegistrationMember(null);
            setCartMember({
                uid: result.member.uid,
                memberCode: result.member.memberCode,
                fullName: result.member.fullName,
                phone: result.member.phone,
                levelName: result.member.levelName,
            });
            setFetchedAt(result.createdAt ?? new Date().toISOString());
            return true;
        } catch (error: unknown) {
            const memberError = toMemberServiceError(error);
            console.error("[Thành viên] Đăng ký thất bại:", memberError);
            failMutation(
                registeredMember
                    ? `Thành viên đã được tạo nhưng thẻ chưa được gắn: ${memberError.message}`
                    : memberError.message,
                memberError.code,
            );
            return false;
        }
    }, [auth.effectiveWarehouseId, completeLookup, completeMutation, draft, failMutation, fetchedAt, pendingRegistrationMember, registrationCard, setCartMember, shopId, startMutation, updateDraft]);

    const handleRegisterAndCheckout = useCallback(async () => {
        if (!registrationMember) {
            const registered = await handleRegister();
            if (!registered) return;
        }

        requestCheckoutModal();
        router.push("/");
    }, [handleRegister, registrationMember, requestCheckoutModal, router]);

    if (auth.isLoading || !auth.user || !auth.userDoc) {
        return (
            <div className="flex h-screen items-center justify-center bg-[var(--color-background)]">
                <div className="size-10 animate-spin rounded-full border-4 border-[var(--color-accent)] border-t-transparent" />
            </div>
        );
    }

    if (auth.needsWarehouseSelection) {
        return (
            <StoreSelector
                userName={auth.userDoc.full_name}
                warehouses={auth.availableWarehouses}
                onSelectWarehouse={auth.selectWarehouse}
                onLogout={auth.logout}
            />
        );
    }

    return (
        <div className="flex h-screen bg-[var(--color-background)]">
            <Sidebar onLogout={auth.logout} />
            <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
                <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] bg-white px-4 py-3 md:px-6">
                    <div className="flex items-center gap-3">
                        <span className="flex size-11 items-center justify-center rounded-2xl bg-orange-50 text-[var(--color-accent)]">
                            <UsersRound className="size-6" />
                        </span>
                        <div>
                            <h1 className="text-xl font-extrabold">Thành viên</h1>
                            <p className="text-xs text-[var(--color-text-muted)]">
                                Điểm bán: {auth.effectiveWarehouseName || auth.effectiveWarehouseId}
                            </p>
                        </div>
                    </div>
                    <div className="flex overflow-x-auto rounded-full bg-[var(--color-surface-hover)] p-1.5">
                        {(["LOOKUP", "REGISTER", ...(canCompensate ? (["COMPENSATION"] as const) : [])] as const).map(
                            (item) => (
                                <button
                                    key={item}
                                    type="button"
                                    onClick={() => handleOperationChange(item)}
                                    className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-bold ${operation === item
                                        ? "bg-white text-[var(--color-accent)] shadow-sm"
                                        : "text-[var(--color-text-secondary)]"
                                        }`}
                                >
                                    {item === "LOOKUP"
                                        ? "Tra cứu"
                                        : item === "REGISTER"
                                            ? "Đăng ký mới"
                                            : "Nạp bù"}
                                </button>
                            )
                        )}
                    </div>
                </header>

                <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-3 lg:overflow-hidden">
                    <div className="mx-auto grid gap-4 lg:h-full lg:min-h-0 lg:grid-cols-[minmax(340px,440px)_1fr]">
                        <div className="space-y-3 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
                            {operation !== "REGISTER" ? (
                                <MemberLookupPanel
                                    mode={mode}
                                    query={query}
                                    isLookingUp={request.status === "WAITING_API"}
                                    cardReaderStatus={cardReaderStatus}
                                    cardReaderError={cardReaderError}
                                    onModeChange={handleModeChange}
                                    onQueryChange={handleQueryChange}
                                    onReadCard={() => void handleCardRead()}
                                    onCancelCardRead={handleCancelCardRead}
                                    onSubmit={() => void handleLookup()}
                                />
                            ) : (
                                <MemberRegistrationForm
                                    draft={draft}
                                    mutation={mutation}
                                    cardReaderStatus={registrationCardReaderStatus}
                                    cardReaderError={registrationCardReaderError}
                                    onChange={handleRegistrationDraftChange}
                                    onReadCard={() => void handleRegistrationCardRead()}
                                    onCancelCardRead={handleCancelRegistrationCardRead}
                                    memberCreated={Boolean(pendingRegistrationMember)}
                                    onRegister={() => void handleRegister()}
                                    onStartNew={() => {
                                        startNewRegistration();
                                        setPendingRegistrationMember(null);
                                        setRegistrationCard(null);
                                        setRegistrationCardReaderStatus("IDLE");
                                        setRegistrationCardReaderError(null);
                                        setCartMember(null);
                                        setFetchedAt(null);
                                    }}
                                />
                            )}
                            {operation !== "REGISTER" ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        resetSession();
                                        setFetchedAt(null);
                                    }}
                                    className="min-h-12 w-full rounded-2xl border border-[var(--color-border)] bg-white px-4 text-sm font-bold text-[var(--color-text-secondary)] active:scale-[0.98]"
                                >
                                    Xóa phiên tra cứu
                                </button>
                            ) : null}
                        </div>
                        {operation === "REGISTER" ? (
                            <MemberProductCatalog
                                products={products}
                                items={cartItems}
                                isLoading={productsLoading}
                                error={productsError}
                                isPaymentLocked={isPaymentLocked}
                                memberReady={Boolean(registrationMember)}
                                isRegistering={mutation.kind === "REGISTER" && mutation.status === "WAITING_API"}
                                onReload={() => void fetchProducts()}
                                onAdd={handleAddProduct}
                                onUpdateQuantity={updateCartQuantity}
                                onRegisterAndCheckout={() => void handleRegisterAndCheckout()}
                            />
                        ) : operation === "LOOKUP" && member ? (
                            <MemberDetailsPanel
                                member={member}
                                shopId={shopId}
                                warehouseId={auth.effectiveWarehouseId || ""}
                                fetchedAt={fetchedAt}
                                activity={memberActivity}
                                packageSale={memberPackageSale}
                            />
                        ) : operation === "COMPENSATION" && member ? (
                            <MemberCompensationPanel
                                member={member}
                                fetchedAt={fetchedAt}
                                activity={memberActivity}
                                compensation={compensation}
                            />
                        ) : request.status === "FAILED" ? (
                            <div className="flex min-h-72 flex-col items-center justify-center rounded-3xl border border-red-200 bg-red-50 p-8 text-center">
                                <SearchX className="mb-3 size-10 text-red-500" />
                                <h2 className="text-lg font-extrabold text-red-800">Không thể hiển thị thành viên</h2>
                                <p className="mt-2 text-sm text-red-700">{request.errorMessage}</p>
                                <p className="mt-3 text-xs font-semibold text-red-500">
                                    Mã lỗi: {request.errorCode || "không xác định"}
                                </p>
                            </div>
                        ) : (
                            <div className="flex min-h-72 flex-col items-center justify-center rounded-3xl border border-dashed border-[var(--color-border-subtle)] bg-white p-8 text-center">
                                <MonitorCheck className="mb-3 size-11 text-orange-300" />
                                <h2 className="text-lg font-extrabold">
                                    {operation === "COMPENSATION"
                                        ? "Tra cứu trước khi nạp bù"
                                        : "Tra cứu thành viên"}
                                </h2>
                                <p className="mt-2 max-w-md text-sm text-[var(--color-text-muted)]">
                                    {operation === "COMPENSATION"
                                        ? "Chọn đúng khách hàng trước khi thực hiện điều chỉnh số dư."
                                        : "Nhập số điện thoại hoặc mã thẻ để tải dữ liệu mới nhất từ OpenAPI."}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </main>
            {operation === "COMPENSATION" && member && compensation.isConfirmOpen ? (
                <MemberCompensationConfirmModal
                    member={member}
                    draft={compensation.draft}
                    warehouseName={
                        auth.effectiveWarehouseName || auth.effectiveWarehouseId || "Điểm bán hiện tại"
                    }
                    busy={
                        compensation.mutation.kind === "COMPENSATION_TOP_UP" &&
                        compensation.mutation.status === "WAITING_API"
                    }
                    onClose={compensation.closeConfirmation}
                    onConfirm={() => void compensation.submit()}
                />
            ) : null}
            {operation === "LOOKUP" && member && memberPackageSale.isCheckoutOpen && memberPackageSale.selectedPackage ? (
                <MemberPackageCheckoutModal
                    selectedPackage={memberPackageSale.selectedPackage}
                    paymentMethod={memberPackageSale.paymentMethod}
                    mutationBusy={
                        memberPackageSale.mutation.kind === "PACKAGE_TOP_UP" &&
                        ["WAITING_PAYMENT", "WAITING_API"].includes(memberPackageSale.mutation.status)
                    }
                    payOSPayment={memberPackageSale.payOSPayment}
                    onPaymentMethodChange={memberPackageSale.setPaymentMethod}
                    onClose={memberPackageSale.closeCheckout}
                    onCashConfirm={() => void memberPackageSale.sellForCash()}
                    onQrConfirm={() => void memberPackageSale.startQrPayment()}
                />
            ) : null}
        </div>
    );
}
