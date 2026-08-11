"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Check, ImagePlus, Info, Printer, RotateCcw, Save, Settings2, Trash2 } from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import SettingsTabs from "@/components/settings/SettingsTabs";
import { RECEIPT_FONT_WEIGHT_OPTIONS, RECEIPT_PAPER_PROFILES } from "@/features/receipt/config/receiptConfig";
import type { ReceiptFontWeight, ReceiptPaperSize } from "@/features/receipt/types/receipt";
import TicketDocument from "@/features/ticket/components/TicketDocument";
import { printTicketPreviewWithDialog } from "@/features/ticket/components/TicketPrintButton";
import { SettingsSection, SliderField, TextAreaField, TextField, ToggleField, ticketFieldClassName } from "@/features/ticket/components/TicketSettingsFields";
import { DEFAULT_TICKET_SETTINGS } from "@/features/ticket/config/ticketConfig";
import { SAMPLE_PRINTABLE_TICKET } from "@/features/ticket/data/sampleTicket";
import { mapRemoteTicketSettings } from "@/features/ticket/helpers/remoteTicketSettings";
import { useTicketSettingsStore } from "@/features/ticket/store/useTicketSettingsStore";
import type { TicketSettings } from "@/features/ticket/types/ticket";
import { useAuth } from "@/lib/contexts/AuthContext";
import { saveRemoteTicketSettings } from "@/lib/services/deviceEnrollmentService";
import { showError, showSuccess } from "@/lib/utils/toast";

export default function TicketSettingsPage() {
    const router = useRouter();
    const { user, userDoc, isLoading: authLoading, logout } = useAuth();
    const appliedSettings = useTicketSettingsStore((state) => state.settings);
    const applyRemoteSettings = useTicketSettingsStore((state) => state.applyRemoteSettings);
    const remoteVersion = useTicketSettingsStore((state) => state.remoteVersion);
    const [draftSettings, setDraftSettings] = useState<TicketSettings | null>(null);
    const [isPrinting, setIsPrinting] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const settings = draftSettings ?? appliedSettings;
    const isDirty = draftSettings !== null;

    useEffect(() => {
        if (!authLoading && (!user || !userDoc)) router.replace("/login");
    }, [authLoading, router, user, userDoc]);

    const updateSettings = useCallback((patch: Partial<TicketSettings>) => {
        setDraftSettings((current) => ({ ...(current ?? appliedSettings), ...patch }));
    }, [appliedSettings]);

    const handleLogoChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            showError("Logo không hợp lệ", "Vui lòng chọn tệp ảnh PNG, JPG hoặc WEBP.");
            return;
        }
        if (file.size > 600 * 1024) {
            showError("Logo quá lớn", "Vui lòng chọn ảnh nhỏ hơn 600 KB.");
            return;
        }
        const reader = new FileReader();
        reader.addEventListener("load", () => {
            if (typeof reader.result !== "string") return;
            updateSettings({ logoDataUrl: reader.result, showLogo: true });
        });
        reader.addEventListener("error", () => showError("Không thể đọc logo", "Vui lòng chọn một tệp ảnh khác."));
        reader.readAsDataURL(file);
    }, [updateSettings]);

    const handleSave = useCallback(async () => {
        if (!isDirty || isSaving) return;
        setIsSaving(true);
        try {
            const remote = await saveRemoteTicketSettings(settings);
            applyRemoteSettings(remote.warehouse_id, remote.version, mapRemoteTicketSettings(remote));
            setDraftSettings(null);
            showSuccess("Đã lưu cấu hình vé", "Cấu hình đã đồng bộ lên JPULSE và áp dụng cho các máy JPOS của cửa hàng.");
        } catch (error: unknown) {
            showError("Không thể lưu cấu hình vé", error instanceof Error ? error.message : "Vui lòng thử lại.");
        } finally {
            setIsSaving(false);
        }
    }, [applyRemoteSettings, isDirty, isSaving, settings]);

    const handleReset = useCallback(() => {
        setDraftSettings(DEFAULT_TICKET_SETTINGS);
        showSuccess("Đã tạo cấu hình mặc định", "Nhấn Lưu cấu hình để áp dụng thay đổi.");
    }, []);

    const handlePrintPreview = useCallback(async () => {
        if (isPrinting) return;
        setIsPrinting(true);
        try {
            await printTicketPreviewWithDialog(SAMPLE_PRINTABLE_TICKET, settings);
        } catch (error: unknown) {
            showError("Không thể mở bản in thử", error instanceof Error ? error.message : "Vui lòng thử lại.");
        } finally {
            setIsPrinting(false);
        }
    }, [isPrinting, settings]);

    if (authLoading || !user || !userDoc) {
        return <div className="flex h-screen items-center justify-center bg-[var(--color-background)]"><div className="flex flex-col items-center gap-3"><div className="size-10 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" /><p className="text-sm text-[var(--color-text-muted)]">Đang tải cấu hình...</p></div></div>;
    }

    return (
        <div className="flex h-screen bg-[var(--color-background)]">
            <Sidebar onLogout={logout} />
            <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
                <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] bg-white px-5 py-3 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="flex size-10 items-center justify-center rounded-xl bg-orange-50 text-[var(--color-accent)]"><Settings2 className="size-5" /></div>
                        <div><h1 className="text-lg font-extrabold tracking-tight text-[var(--color-text-primary)]">Cấu hình vé</h1><p className="text-xs text-[var(--color-text-muted)]">Bố cục vé nhiệt và in tự động sau thanh toán</p></div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className={`hidden items-center gap-1.5 text-xs font-semibold sm:flex ${isDirty ? "text-amber-600" : "text-emerald-600"}`}><Check className="size-3.5" />{isDirty ? "Có thay đổi chưa lưu" : `Đã đồng bộ JPULSE · v${remoteVersion ?? 0}`}</span>
                        <button type="button" onClick={handleReset} disabled={isSaving} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[var(--color-border)] bg-white px-3 text-xs font-bold text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] disabled:opacity-50"><RotateCcw className="size-3.5" />Khôi phục mặc định</button>
                        <button type="button" onClick={() => void handleSave()} disabled={!isDirty || isSaving} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[var(--color-accent)] px-4 text-xs font-bold text-white disabled:opacity-50"><Save className="size-3.5" />{isSaving ? "Đang lưu..." : "Lưu cấu hình"}</button>
                    </div>
                </header>

                <SettingsTabs />

                <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto xl:grid-cols-[minmax(560px,1fr)_430px] xl:overflow-hidden">
                    <fieldset className="space-y-4 p-4 xl:overflow-y-auto">
                        <SettingsSection title="Khổ vé và máy in" description="Mỗi mã vé được in thành một trang riêng để máy in nhiệt có thể cắt theo từng vé.">
                            <div className="grid gap-2 sm:grid-cols-3">
                                {Object.values(RECEIPT_PAPER_PROFILES).map((profile) => {
                                    const selected = settings.paperSize === profile.id;
                                    return <button key={profile.id} type="button" onClick={() => updateSettings({ paperSize: profile.id as ReceiptPaperSize })} className={`rounded-2xl border p-3 text-left transition-all ${selected ? "border-[var(--color-accent)] bg-orange-50 shadow-[0_0_0_1px_var(--color-accent)]" : "border-[var(--color-border)] bg-white hover:border-orange-200"}`}><span className="block text-sm font-extrabold">{profile.label}</span><span className="mt-1 block text-[11px] text-[var(--color-text-muted)]">{profile.description}</span></button>;
                                })}
                            </div>
                            <div className="mt-4 grid gap-4 sm:grid-cols-2">
                                <SliderField label="Chiều dài mỗi vé" value={settings.ticketHeightMm} min={80} max={160} step={2} unit="mm" onChange={(ticketHeightMm) => updateSettings({ ticketHeightMm })} />
                                <SliderField label="Kích thước mã QR" value={settings.qrSizeMm} min={24} max={48} step={1} unit="mm" onChange={(qrSizeMm) => updateSettings({ qrSizeMm })} />
                            </div>
                            <div className="mt-3 flex items-start gap-2 rounded-xl bg-blue-50 px-3 py-2.5 text-xs leading-relaxed text-blue-700"><Info className="mt-0.5 size-4 shrink-0" />Nếu máy in không tự cắt giữa các vé, hãy bật chế độ cắt theo trang trong driver máy in Windows.</div>
                        </SettingsSection>

                        <SettingsSection title="Nhận diện vé" description="Logo được chuyển sang đơn sắc khi in nhiệt.">
                            <div className="grid gap-4 md:grid-cols-[150px_1fr]">
                                <div className="rounded-2xl border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-background)] p-3 text-center">
                                    <div className="flex h-20 items-center justify-center overflow-hidden rounded-xl bg-white">
                                        {settings.logoDataUrl ? <Image src={settings.logoDataUrl} alt="Logo vé" width={160} height={100} unoptimized className="object-contain grayscale" style={{ maxHeight: 68, filter: `grayscale(1) contrast(${settings.logoContrastPercent}%)` }} /> : <ImagePlus className="size-7 text-[var(--color-text-muted)]" />}
                                    </div>
                                    <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleLogoChange} className="hidden" />
                                    <div className="mt-2 flex justify-center gap-1"><button type="button" onClick={() => fileInputRef.current?.click()} className="rounded-lg border bg-white px-2 py-1 text-[11px] font-bold">Chọn logo</button>{settings.logoDataUrl ? <button type="button" onClick={() => updateSettings({ logoDataUrl: null })} className="rounded-lg border bg-white p-1.5" aria-label="Xóa logo"><Trash2 className="size-3.5" /></button> : null}</div>
                                </div>
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <TextField label="Tên cửa hàng" value={settings.storeName} maxLength={80} onChange={(storeName) => updateSettings({ storeName })} />
                                    <TextField label="Tiêu đề vé" value={settings.ticketTitle} maxLength={60} onChange={(ticketTitle) => updateSettings({ ticketTitle })} />
                                    <div className="sm:col-span-2"><TextField label="Dòng giới thiệu" value={settings.subtitle} maxLength={120} onChange={(subtitle) => updateSettings({ subtitle })} /></div>
                                    <SliderField label="Độ rộng logo" value={settings.logoWidthMm} min={12} max={45} step={1} unit="mm" onChange={(logoWidthMm) => updateSettings({ logoWidthMm })} />
                                    <SliderField label="Tương phản logo" value={settings.logoContrastPercent} min={80} max={200} step={5} unit="%" onChange={(logoContrastPercent) => updateSettings({ logoContrastPercent })} />
                                </div>
                            </div>
                        </SettingsSection>

                        <SettingsSection title="Nội dung và cỡ chữ" description="Điều chỉnh thông tin hiển thị trên từng vé.">
                            <div className="grid gap-4 sm:grid-cols-3">
                                <SliderField label="Tiêu đề" value={settings.titleFontSizePt} min={10} max={22} step={1} unit="pt" onChange={(titleFontSizePt) => updateSettings({ titleFontSizePt })} />
                                <SliderField label="Tên sản phẩm" value={settings.productFontSizePt} min={9} max={20} step={1} unit="pt" onChange={(productFontSizePt) => updateSettings({ productFontSizePt })} />
                                <SliderField label="Nội dung phụ" value={settings.bodyFontSizePt} min={6} max={12} step={0.5} unit="pt" onChange={(bodyFontSizePt) => updateSettings({ bodyFontSizePt })} />
                            </div>
                            <label className="mt-4 grid gap-1.5 text-xs font-bold text-[var(--color-text-secondary)]">Độ đậm tên vé<select value={settings.fontWeight} onChange={(event) => updateSettings({ fontWeight: Number(event.target.value) as ReceiptFontWeight })} className={ticketFieldClassName}>{RECEIPT_FONT_WEIGHT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                            <div className="mt-4 grid gap-3"><TextAreaField label="Hướng dẫn sử dụng" value={settings.instructions} maxLength={240} onChange={(instructions) => updateSettings({ instructions })} /><TextField label="Lời nhắn cuối vé" value={settings.footerMessage} maxLength={120} onChange={(footerMessage) => updateSettings({ footerMessage })} /></div>
                        </SettingsSection>

                        <SettingsSection title="Thông tin hiển thị và in tự động" description="Số vé thực tế luôn lấy từ dữ liệu đã snapshot trong đơn hàng.">
                            <div className="grid gap-3 md:grid-cols-2">
                                <ToggleField label="Tự động in vé" description="In ngay sau biên lai khi thanh toán thành công" checked={settings.autoPrintAfterPayment} onChange={(autoPrintAfterPayment) => updateSettings({ autoPrintAfterPayment })} />
                                <ToggleField label="Hiển thị logo" description="Ẩn logo nhưng vẫn giữ tệp đã chọn" checked={settings.showLogo} onChange={(showLogo) => updateSettings({ showLogo })} />
                                <ToggleField label="Hiển thị mã đơn" description="Hỗ trợ tra cứu giao dịch gốc" checked={settings.showOrderCode} onChange={(showOrderCode) => updateSettings({ showOrderCode })} />
                                <ToggleField label="Hiển thị thời gian" description="Thời điểm thanh toán/phát hành vé" checked={settings.showIssuedAt} onChange={(showIssuedAt) => updateSettings({ showIssuedAt })} />
                                <ToggleField label="Hiển thị giá" description="In giá sản phẩm trên từng vé" checked={settings.showPrice} onChange={(showPrice) => updateSettings({ showPrice })} />
                                <ToggleField label="Hiển thị thứ tự" description="Ví dụ Vé 2/7 đối với sản phẩm nhiều vé" checked={settings.showSequence} onChange={(showSequence) => updateSettings({ showSequence })} />
                            </div>
                        </SettingsSection>
                    </fieldset>

                    <aside className="border-t border-[var(--color-border)] bg-[#e9e8e5] p-4 xl:overflow-y-auto xl:border-l xl:border-t-0">
                        <div className="mx-auto max-w-[390px] xl:sticky xl:top-0">
                            <div className="mb-3 flex items-center justify-between"><div><h2 className="text-sm font-extrabold text-[var(--color-text-primary)]">Xem trước thực tế</h2><p className="text-[11px] text-[var(--color-text-muted)]">{RECEIPT_PAPER_PROFILES[settings.paperSize].printableWidthMm} × {settings.ticketHeightMm} mm · đơn sắc</p></div><button type="button" onClick={() => void handlePrintPreview()} disabled={isPrinting} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#202124] px-3.5 text-xs font-bold text-white shadow-md disabled:opacity-60"><Printer className="size-4" />{isPrinting ? "Đang mở..." : "In thử"}</button></div>
                            <div className="overflow-x-auto rounded-2xl bg-[#d8d6d1] p-5 shadow-inner"><div className="mx-auto w-fit overflow-hidden bg-white shadow-[0_12px_35px_rgba(0,0,0,.18)]"><TicketDocument ticket={SAMPLE_PRINTABLE_TICKET} settings={settings} /></div></div>
                            <p className="mt-3 text-center text-[11px] leading-relaxed text-[var(--color-text-muted)]">Bản xem trước dùng dữ liệu mẫu. Đơn thật sẽ tạo đúng một mã QR duy nhất cho mỗi vé và lưu mã cùng đơn hàng.</p>
                        </div>
                    </aside>
                </div>
            </main>
        </div>
    );
}
